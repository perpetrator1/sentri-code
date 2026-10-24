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
    meanFlightTime: 165,
    varianceFlightTime: 2200,
    meanDwellTime: 78,
    naturalBurstVelocity: 255,
    recordedAt: Date.now(),
    sampleCount: 50,
    onScreenGlancePauseMeanMs: 850,
    phoneDistanceOffsetMs: 1800,
    phoneDistanceGlanceMinMs: 1850,
    phoneDistanceGlanceMaxMs: 7500,
    isPhoneDistanceCalibrated: true,
  });

  const [currentMetrics, setCurrentMetrics] = useState<SlidingWindowMetrics>({
    windowSize: 0,
    digraphLatencyMean: 175,
    digraphLatencyVariance: 2200,
    trigraphLatencyMean: 350,
    burstinessRatio: 0.35,
    metronomicEntropy: 0.85,
    refactoringIndex: 0.20,
    pauseDistribution: { micro: 0.45, cognitive: 0.45, deepIdle: 0.1 },
    integrityConfidence: 0.98,
    isTranscribingAnomaly: false,
    isPhoneTranscriptionAnomaly: false,
    phoneGlancePauseCount: 0,
  });

  const [anomalyTimeline, setAnomalyTimeline] = useState<AnomalyTimelineEntry[]>([]);
  const [keystrokeCount, setKeystrokeCount] = useState(0);
  const [lastCognitivePauseTimestamp, setLastCognitivePauseTimestamp] = useState<number | null>(null);
  const [isAdapting, setIsAdapting] = useState(false);

  // Mutable tracking references
  const baselineRef = useRef<BaselineCalibration>(baseline);
  baselineRef.current = baseline;
  const lastAdaptKeystrokeRef = useRef<number>(0);
  const adaptationCountRef = useRef<number>(0);
  const slidingBufferRef = useRef<KeystrokeEventTuple[]>([]);
  const pendingBatchRef = useRef<KeystrokeEventTuple[]>([]);
  const activeKeysDownRef = useRef<Map<string, number>>(new Map()); // code -> timestamp
  const lastKeyUpTimestampRef = useRef<number>(performance.now());
  const currentCursorOffsetRef = useRef<number>(0);
  const backspaceCountRef = useRef<number>(0);
  const pasteCountRef = useRef<number>(0);
  const refactorCountRef = useRef<number>(0);
  const cognitivePausesCountRef = useRef<number>(0);

  // History of all evaluated sliding window confidence scores
  const allWindowScoresRef = useRef<number[]>([]);
  const lastRecordedAnomalyTimeRef = useRef<number>(0);

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

      // Check if this was a pause (>800ms)
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
      const newKeystrokeCount = keystrokeCount + 1;
      setKeystrokeCount((prev) => prev + 1);

      // Run personalized pattern-based feature engineering on the sliding window
      const curBase = baselineRef.current;
      const metrics = analyzeWindow(buffer, curBase);
      setCurrentMetrics(metrics);

      // Accumulate window scores for holistic session accuracy
      if (buffer.length >= 8) {
        allWindowScoresRef.current.push(metrics.integrityConfidence);
      }

      // Online Adaptive Learning: EMA update on verified authentic human coding windows
      const keysSinceAdapt = newKeystrokeCount - lastAdaptKeystrokeRef.current;
      const isAuthenticWindow =
        metrics.integrityConfidence >= 0.88 &&
        !metrics.isTranscribingAnomaly &&
        (metrics.refactoringIndex >= 0.06 || metrics.pauseDistribution.cognitive >= 0.15);

      if (buffer.length >= 15 && keysSinceAdapt >= 25 && isAuthenticWindow) {
        lastAdaptKeystrokeRef.current = newKeystrokeCount;
        adaptationCountRef.current++;
        setIsAdapting(true);

        const alpha = 0.04; // Smooth EMA learning rate (4% drift per cycle)
        const newMean = Math.round((1 - alpha) * curBase.meanFlightTime + alpha * metrics.digraphLatencyMean);
        const newVar = Math.round((1 - alpha) * curBase.varianceFlightTime + alpha * metrics.digraphLatencyVariance);
        const newEntropy = Number(
          ((1 - alpha) * (curBase.baselineEntropy ?? 0.82) + alpha * metrics.metronomicEntropy).toFixed(3)
        );
        const newPauseThreshold = Math.max(1200, Math.round(newMean * 3.5));

        const updatedBaseline: BaselineCalibration = {
          ...curBase,
          meanFlightTime: newMean,
          varianceFlightTime: newVar,
          stdDevFlightTime: Math.round(Math.sqrt(newVar)),
          baselineEntropy: newEntropy,
          naturalPauseThresholdMs: newPauseThreshold,
          lastAdaptedAt: Date.now(),
        };

        baselineRef.current = updatedBaseline;
        setBaseline(updatedBaseline);
        db.baselines.put(updatedBaseline).catch(() => {});
      } else if (metrics.isTranscribingAnomaly) {
        // Freeze baseline adaptation immediately upon any anomaly to prevent adversarial poisoning
        setIsAdapting(false);
      }

      // If an anomaly is detected, record on timeline (throttled to at most one per 2.0s)
      const nowMs = Date.now();
      if (
        metrics.anomalyReport &&
        metrics.anomalyReport.isAnomaly &&
        nowMs - lastRecordedAnomalyTimeRef.current > 2000
      ) {
        lastRecordedAnomalyTimeRef.current = nowMs;

        const anomalyEntry: AnomalyTimelineEntry = {
          timestamp: nowMs,
          confidenceScore: metrics.anomalyReport.confidenceScore,
          anomalyReason: metrics.anomalyReport.reason,
          severity: metrics.anomalyReport.severity,
          cursorOffset: currentCursorOffsetRef.current,
          metricsSnapshot: {
            metronomicEntropy: metrics.metronomicEntropy,
            digraphLatencyVariance: metrics.digraphLatencyVariance,
            refactoringIndex: metrics.refactoringIndex,
          },
        };

        setAnomalyTimeline((prev) => [...prev.slice(-30), anomalyEntry]);

        // Persist anomaly to Dexie
        db.anomaly_timeline.add(anomalyEntry).catch(() => {});
      }
    },
    [keystrokeCount]
  );

  // Process keyup event to record dwell time
  const handleKeyUp = useCallback((e: KeyboardEvent | { key: string; code?: string }) => {
    const now = performance.now();
    const code = e.code || e.key;
    const downTime = activeKeysDownRef.current.get(code);
    activeKeysDownRef.current.delete(code);

    const dwellTime = downTime ? Math.max(0, Math.round(now - downTime)) : 70;
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
    if (pastedLength > 20) {
      const anomalyEntry: AnomalyTimelineEntry = {
        timestamp: Date.now(),
        confidenceScore: 0.45,
        anomalyReason: `Large external clipboard insertion (${pastedLength} characters)`,
        severity: 'high',
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

  // Compute accurate holistic telemetry summary for final submission
  const getTelemetrySummary = useCallback(
    (referenceQueriesCount = 0, snippetsInsertedCount = 0): TelemetrySummary => {
      const totalKeys = keystrokeCount;
      const totalBackspaces = backspaceCountRef.current;
      const scores = allWindowScoresRef.current;

      // Calculate baseline average confidence across all typing windows
      const totalWindows = Math.max(1, scores.length);
      const rawAvg = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : currentMetrics.integrityConfidence;

      let holisticConfidence = rawAvg;
      const sessionBackspaceRate = totalKeys > 0 ? totalBackspaces / totalKeys : 0.08;
      const anomaliesCount = anomalyTimeline.length;

      // Holistic Session Integrity Evaluation
      if (totalKeys >= 12) {
        if (anomaliesCount >= 1) {
          // If anomalies were detected (e.g. phone sight-typing), reflect the penalized score directly!
          const minAnomalyScore = Math.min(...anomalyTimeline.map((a) => a.confidenceScore));
          holisticConfidence = Math.min(rawAvg, minAnomalyScore, 0.42);
        } else if (totalBackspaces === 0 && totalKeys >= 16) {
          // Linear transcription with zero backspaces/corrections across 16+ keys
          holisticConfidence = Math.min(rawAvg, 0.38);
        } else if (sessionBackspaceRate < 0.03 && totalKeys >= 25) {
          // Abnormally low backspace rate without corrections
          holisticConfidence = Math.min(rawAvg, 0.55);
        } else if (anomaliesCount === 0 && sessionBackspaceRate >= 0.04) {
          // Clean session with authentic human self-corrections: high confidence (88% - 98%)
          holisticConfidence = Math.min(0.98, Math.max(0.88, rawAvg));
        } else {
          holisticConfidence = Math.min(0.85, Math.max(0.40, rawAvg));
        }

        // Reinforce authentic coding ONLY when healthy cognitive pauses AND genuine self-corrections exist, with 0 anomalies
        if (anomaliesCount === 0 && currentMetrics.pauseDistribution.cognitive >= 0.15 && sessionBackspaceRate >= 0.04) {
          holisticConfidence = Math.min(0.98, holisticConfidence + 0.04);
        }
      }

      if (pasteCountRef.current > 0) {
        holisticConfidence = Math.min(holisticConfidence, 0.45);
      }

      const finalConfidence = Math.max(0.15, Math.min(0.98, Number(holisticConfidence.toFixed(2))));

      const curBase = baselineRef.current;
      const speedDivergenceRatio = Number((curBase.meanFlightTime / Math.max(45, currentMetrics.digraphLatencyMean)).toFixed(2));
      const varianceDivergenceRatio = Number((currentMetrics.digraphLatencyVariance / Math.max(400, curBase.varianceFlightTime)).toFixed(2));

      return {
        totalKeystrokes: totalKeys,
        meanFlightTime: currentMetrics.digraphLatencyMean,
        meanDwellTime: 78,
        averageIntegrityConfidence: finalConfidence,
        backspaceCount: totalBackspaces,
        refactoringEdits: refactorCountRef.current,
        cognitivePauseRatio: currentMetrics.pauseDistribution.cognitive,
        pasteEventCount: pasteCountRef.current,
        referenceQueriesCount,
        snippetsInsertedCount,
        anomaliesDetected: anomalyTimeline.length,
        speedDivergenceRatio,
        varianceDivergenceRatio,
        cadenceEntropy: currentMetrics.metronomicEntropy,
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
    isAdapting,
    adaptationCount: adaptationCountRef.current,
    handleKeyDown,
    handleKeyUp,
    handleCursorChange,
    handlePaste,
    updateBaseline,
    getTelemetrySummary,
    flushBatch,
  };
}
