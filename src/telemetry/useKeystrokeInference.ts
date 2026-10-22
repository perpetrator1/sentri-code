import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  KeystrokeEventTuple,
  SlidingWindowMetrics,
  AnomalyTimelineEntry,
  BaselineCalibration,
  TelemetrySummary,
} from '../types';
import { classifyKeyEvent } from './eventClassifier';
import { analyzeWindow, WINDOW_SIZE } from './slidingWindow';
import { db } from '../db';

export function useKeystrokeInference(candidateId: string, problemId: string) {
  // Candidate's baseline typing profile
  const [baseline, setBaseline] = useState<BaselineCalibration>({
    candidateId,
    meanFlightTime: 175,
    varianceFlightTime: 2300,
    meanDwellTime: 82,
    naturalBurstVelocity: 250,
    recordedAt: Date.now(),
    sampleCount: 50,
  });

  const [currentMetrics, setCurrentMetrics] = useState<SlidingWindowMetrics>({
    windowSize: 0,
    digraphLatencyMean: 175,
    digraphLatencyVariance: 2300,
    trigraphLatencyMean: 350,
    burstinessRatio: 0.35,
    metronomicEntropy: 0.82,
    refactoringIndex: 0.22,
    pauseDistribution: { micro: 0.45, cognitive: 0.45, deepIdle: 0.1 },
    integrityConfidence: 0.98,
    isTranscribingAnomaly: false,
  });

  const [anomalyTimeline, setAnomalyTimeline] = useState<AnomalyTimelineEntry[]>([]);
  const [keystrokeCount, setKeystrokeCount] = useState(0);
  const [lastCognitivePauseTimestamp, setLastCognitivePauseTimestamp] = useState<number | null>(null);

  // Mutable tracking references
  const slidingBufferRef = useRef<KeystrokeEventTuple[]>([]);
  const pendingBatchRef = useRef<KeystrokeEventTuple[]>([]);
  const activeKeysDownRef = useRef<Map<string, number>>(new Map()); // code -> timestamp
  const lastKeyUpTimestampRef = useRef<number>(performance.now());
  const currentCursorOffsetRef = useRef<number>(0);
  const backspaceCountRef = useRef<number>(0);
  const pasteCountRef = useRef<number>(0);
  const refactorCountRef = useRef<number>(0);
  const cognitivePausesCountRef = useRef<number>(0);

  // Load existing baseline from Dexie if available
  useEffect(() => {
    async function loadBaseline() {
      try {
        const saved = await db.baselines.get(candidateId);
        if (saved) {
          setBaseline(saved);
        }
      } catch (e) {
        console.error('Failed to load baseline from DB:', e);
      }
    }
    loadBaseline();
  }, [candidateId]);

  // Flush pending telemetry batches to Dexie
  const flushBatch = useCallback(async () => {
    if (pendingBatchRef.current.length === 0) return;
    const batch = [...pendingBatchRef.current];
    pendingBatchRef.current = [];

    try {
      await db.keystroke_telemetry.add({
        sessionId: `${candidateId}-${problemId}`,
        timestamp: Date.now(),
        events: batch,
      });
    } catch (err) {
      console.warn('Failed to flush telemetry batch to IndexedDB:', err);
    }
  }, [candidateId, problemId]);

  // Periodic flush every 15 seconds or before unload
  useEffect(() => {
    const interval = setInterval(flushBatch, 15000);
    window.addEventListener('beforeunload', flushBatch);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', flushBatch);
      flushBatch();
    };
  }, [flushBatch]);

  // Process a keydown event (privacy preserving: no character recorded)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent | { key: string; code?: string; preventDefault?: () => void }) => {
      const now = performance.now();
      const code = e.code || e.key;
      const keyClass = classifyKeyEvent(e.key, code);

      // Record keydown timestamp for dwell calculation
      if (!activeKeysDownRef.current.has(code)) {
        activeKeysDownRef.current.set(code, now);
      }

      // Flight time = interval since last key up
      const flightTime = Math.max(0, Math.round(now - lastKeyUpTimestampRef.current));

      // Check if this was a cognitive pause (>800ms)
      if (flightTime >= 800) {
        cognitivePausesCountRef.current++;
        setLastCognitivePauseTimestamp(Date.now());
      }

      if (keyClass === 'backspace_delete') {
        backspaceCountRef.current++;
        refactorCountRef.current++;
      } else if (keyClass === 'nav_arrow') {
        refactorCountRef.current++;
      }

      // Tuple: [timestamp, eventType, keyClass, flightTime, dwellTime (pending), cursorOffset]
      const tuple: KeystrokeEventTuple = [
        Date.now(),
        'down',
        keyClass,
        flightTime,
        0, // dwell completed on keyUp
        currentCursorOffsetRef.current,
      ];

      // Append to sliding buffer (capped at WINDOW_SIZE)
      const buffer = slidingBufferRef.current;
      buffer.push(tuple);
      if (buffer.length > WINDOW_SIZE) {
        buffer.shift();
      }

      // Queue for Dexie persistence
      pendingBatchRef.current.push(tuple);
      setKeystrokeCount((prev) => prev + 1);

      // Run feature engineering on the sliding window
      const metrics = analyzeWindow(buffer, baseline);
      setCurrentMetrics(metrics);

      // If an anomaly is detected, record on timeline
      if (metrics.isTranscribingAnomaly || metrics.integrityConfidence < 0.65) {
        const reason =
          metrics.metronomicEntropy < 0.5
            ? 'Metronomic cadence: flat flight-time variance across consecutive tokens'
            : metrics.refactoringIndex === 0
            ? 'Zero refactoring: continuous linear appending without hesitation or corrections'
            : 'Cadence divergence from baseline calibration';

        const anomalyEntry: AnomalyTimelineEntry = {
          timestamp: Date.now(),
          confidenceScore: metrics.integrityConfidence,
          anomalyReason: reason,
          severity: metrics.integrityConfidence < 0.4 ? 'high' : 'medium',
          cursorOffset: currentCursorOffsetRef.current,
          metricsSnapshot: {
            metronomicEntropy: metrics.metronomicEntropy,
            digraphLatencyVariance: metrics.digraphLatencyVariance,
            refactoringIndex: metrics.refactoringIndex,
          },
        };

        setAnomalyTimeline((prev) => [...prev.slice(-20), anomalyEntry]);

        // Persist anomaly to Dexie
        db.anomaly_timeline.add(anomalyEntry).catch(() => {});
      }
    },
    [baseline]
  );

  // Process keyup event to record dwell time
  const handleKeyUp = useCallback((e: KeyboardEvent | { key: string; code?: string }) => {
    const now = performance.now();
    const code = e.code || e.key;
    const downTime = activeKeysDownRef.current.get(code);
    activeKeysDownRef.current.delete(code);

    const dwellTime = downTime ? Math.max(0, Math.round(now - downTime)) : 65;
    lastKeyUpTimestampRef.current = now;

    // Update the last down tuple's dwell time in buffer if applicable
    const buffer = slidingBufferRef.current;
    if (buffer.length > 0) {
      buffer[buffer.length - 1][4] = dwellTime;
    }
  }, []);

  // Update cursor position from Monaco
  const handleCursorChange = useCallback((offset: number) => {
    currentCursorOffsetRef.current = offset;
  }, []);

  // Record paste event
  const handlePaste = useCallback((pastedLength: number) => {
    pasteCountRef.current++;
    if (pastedLength > 25) {
      const anomalyEntry: AnomalyTimelineEntry = {
        timestamp: Date.now(),
        confidenceScore: 0.55,
        anomalyReason: `Large clipboard insertion (${pastedLength} characters)`,
        severity: 'medium',
        cursorOffset: currentCursorOffsetRef.current,
      };
      setAnomalyTimeline((prev) => [...prev, anomalyEntry]);
      db.anomaly_timeline.add(anomalyEntry).catch(() => {});
    }
  }, []);

  // Set calibrated baseline
  const updateBaseline = useCallback(
    async (calibrated: BaselineCalibration) => {
      setBaseline(calibrated);
      try {
        await db.baselines.put(calibrated);
      } catch (e) {
        console.error('Failed to save baseline:', e);
      }
    },
    []
  );

  // Compute telemetry summary for final submission
  const getTelemetrySummary = useCallback(
    (referenceQueriesCount = 0, snippetsInsertedCount = 0): TelemetrySummary => {
      return {
        totalKeystrokes: keystrokeCount,
        meanFlightTime: currentMetrics.digraphLatencyMean,
        meanDwellTime: 78,
        averageIntegrityConfidence: currentMetrics.integrityConfidence,
        backspaceCount: backspaceCountRef.current,
        refactoringEdits: refactorCountRef.current,
        cognitivePauseRatio: currentMetrics.pauseDistribution.cognitive,
        pasteEventCount: pasteCountRef.current,
        referenceQueriesCount,
        snippetsInsertedCount,
        anomaliesDetected: anomalyTimeline.length,
      };
    },
    [keystrokeCount, currentMetrics, anomalyTimeline.length]
  );

  return {
    baseline,
    currentMetrics,
    anomalyTimeline,
    keystrokeCount,
    lastCognitivePauseTimestamp,
    handleKeyDown,
    handleKeyUp,
    handleCursorChange,
    handlePaste,
    updateBaseline,
    getTelemetrySummary,
    flushBatch,
  };
}
