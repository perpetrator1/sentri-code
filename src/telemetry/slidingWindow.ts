import type {
  KeystrokeEventTuple,
  SlidingWindowMetrics,
  BaselineCalibration,
} from '../types';

export const WINDOW_SIZE = 50;

export interface TypingChunk {
  charCount: number;
  pauseBeforeMs: number;
  intraFlightMean: number;
  intraFlightVariance: number;
  backspaceCount: number;
  isMotorSlipOnly: boolean;
}

export interface WindowAnomalyReport {
  isAnomaly: boolean;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  confidenceScore: number;
  divergenceMetrics?: {
    speedRatio: number; // live speed / personal baseline
    varianceRatio: number; // live variance / personal baseline variance
    entropyDelta: number; // personal baseline entropy - live entropy
  };
}

/**
 * Calculates continuous Shannon entropy of active typing flight times.
 */
export function calculateShannonEntropy(flightTimes: number[]): number {
  const activeFlights = flightTimes.filter(ft => ft > 0 && ft < 1000);
  if (activeFlights.length < 6) return 0.85;

  // 6 Cadence Bins: [0-90ms, 90-160ms, 160-250ms, 250-400ms, 400-650ms, >650ms]
  const bins = [0, 0, 0, 0, 0, 0];
  for (const ft of activeFlights) {
    if (ft < 90) bins[0]++;
    else if (ft < 160) bins[1]++;
    else if (ft < 250) bins[2]++;
    else if (ft < 400) bins[3]++;
    else if (ft < 650) bins[4]++;
    else bins[5]++;
  }

  const total = activeFlights.length;
  let entropy = 0;
  for (const count of bins) {
    if (count > 0) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }
  }

  return Math.min(1.0, Number((entropy / 2.585).toFixed(3)));
}

/**
 * Personalized, pattern-based keystroke telemetry analyzer.
 * Evaluates live typing relative to each candidate's individual calibrated baseline:
 * - Velocity Divergence Ratio: compares typing speed against personal baseline
 * - Personal Variance Ratio: compares intra-token jitter against personal calibrated variance
 * - Saccadic Glance-Pause Rhythm: scaled to personal cognitive pause threshold
 * - Natural vs Motor-Slip Refactoring
 */
export function analyzeWindow(
  windowTuples: KeystrokeEventTuple[],
  baseline?: BaselineCalibration
): SlidingWindowMetrics & { anomalyReport?: WindowAnomalyReport } {
  const count = windowTuples.length;

  // Personalized Baseline Reference Values
  const baselineMean = baseline?.meanFlightTime || 165;
  const baselineVar = baseline?.varianceFlightTime || 2200;
  const baselineEntropy = baseline?.baselineEntropy || 0.82;
  // Personalized Glance Pause Boundaries: human gaze saccades to secondary screen take 1.4s–4.8s
  const glancePauseMin = Math.max(1400, Math.min(2000, baseline?.naturalPauseThresholdMs || 1600));
  const glancePauseMax = Math.max(4800, Math.round(baselineMean * 9.0));

  if (count < 8) {
    return {
      windowSize: count,
      digraphLatencyMean: baselineMean,
      digraphLatencyVariance: baselineVar,
      trigraphLatencyMean: baselineMean * 2,
      burstinessRatio: 0.35,
      metronomicEntropy: baselineEntropy,
      refactoringIndex: 0.20,
      pauseDistribution: { micro: 0.4, cognitive: 0.5, deepIdle: 0.1 },
      integrityConfidence: 0.98,
      isTranscribingAnomaly: false,
    };
  }

  const flightTimes: number[] = [];
  const dwellTimes: number[] = [];
  let backspaceCount = 0;
  let navCount = 0;
  let rapidBurstCount = 0;
  let microPauses = 0;
  let cognitivePauses = 0;
  let deepIdle = 0;

  // ── Chunk-Pause Saccadic Segmentation (Personalized to user's glance threshold) ──
  const chunks: TypingChunk[] = [];
  let currentChunkKeys: number[] = [];
  let currentChunkBackspaces = 0;
  let lastPauseDuration = 0;

  let consecutiveBackspaces = 0;
  let maxConsecutiveBackspaces = 0;

  for (let i = 0; i < count; i++) {
    const [, , keyClass, flightTime, dwellTime] = windowTuples[i];

    if (flightTime > 0) {
      flightTimes.push(flightTime);

      if (flightTime < 180) {
        rapidBurstCount++;
      } else if (flightTime >= 180 && flightTime <= 750) {
        microPauses++;
      } else if (flightTime > 750 && flightTime < glancePauseMin) {
        cognitivePauses++;
      } else if (flightTime >= glancePauseMin && flightTime <= glancePauseMax) {
        // Glance pause range (measured by chunk segmentation below)
      } else if (flightTime > glancePauseMax) {
        deepIdle++;
      }

      // Personalized Eye-Glance Pause detection based on candidate's own pause threshold
      if (flightTime >= glancePauseMin && flightTime <= glancePauseMax) {
        if (currentChunkKeys.length >= 8) {
          const meanF = currentChunkKeys.reduce((a, b) => a + b, 0) / currentChunkKeys.length;
          const varF = currentChunkKeys.reduce((acc, ft) => acc + Math.pow(ft - meanF, 2), 0) / currentChunkKeys.length;

          chunks.push({
            charCount: currentChunkKeys.length,
            pauseBeforeMs: lastPauseDuration,
            intraFlightMean: Math.round(meanF),
            intraFlightVariance: Math.round(varF),
            backspaceCount: currentChunkBackspaces,
            isMotorSlipOnly: currentChunkBackspaces <= 2,
          });
        }

        lastPauseDuration = flightTime;
        currentChunkKeys = [];
        currentChunkBackspaces = 0;
      } else if (flightTime < 1000) {
        currentChunkKeys.push(flightTime);
      }
    }

    if (dwellTime > 0) {
      dwellTimes.push(dwellTime);
    }

    if (keyClass === 'backspace_delete') {
      backspaceCount++;
      currentChunkBackspaces++;
      consecutiveBackspaces++;
      maxConsecutiveBackspaces = Math.max(maxConsecutiveBackspaces, consecutiveBackspaces);
    } else {
      consecutiveBackspaces = 0;
    }

    if (keyClass === 'nav_arrow') {
      navCount++;
    }
  }

  // Push final chunk
  if (currentChunkKeys.length >= 8) {
    const meanF = currentChunkKeys.reduce((a, b) => a + b, 0) / currentChunkKeys.length;
    const varF = currentChunkKeys.reduce((acc, ft) => acc + Math.pow(ft - meanF, 2), 0) / currentChunkKeys.length;
    chunks.push({
      charCount: currentChunkKeys.length,
      pauseBeforeMs: lastPauseDuration,
      intraFlightMean: Math.round(meanF),
      intraFlightVariance: Math.round(varF),
      backspaceCount: currentChunkBackspaces,
      isMotorSlipOnly: currentChunkBackspaces <= 2,
    });
  }

  // 1. Overall Flight Mean & Variance
  const sumFlight = flightTimes.reduce((a, b) => a + b, 0);
  const meanFlight = flightTimes.length > 0 ? sumFlight / flightTimes.length : baselineMean;

  let totalVarFlight = baselineVar;
  if (flightTimes.length > 1) {
    const sumSqDiff = flightTimes.reduce((acc, ft) => acc + Math.pow(ft - meanFlight, 2), 0);
    totalVarFlight = sumSqDiff / (flightTimes.length - 1);
  }

  // Intra-burst flight variance (within active words)
  const intraFlights = flightTimes.filter(ft => ft > 0 && ft < 750);
  let intraBurstVariance = baselineVar;
  if (intraFlights.length > 1) {
    const meanB = intraFlights.reduce((a, b) => a + b, 0) / intraFlights.length;
    intraBurstVariance = intraFlights.reduce((acc, ft) => acc + Math.pow(ft - meanB, 2), 0) / (intraFlights.length - 1);
  }

  // 2. Trigraph latency
  let trigraphSum = 0;
  let trigraphCount = 0;
  for (let i = 0; i < count - 2; i++) {
    const t0 = windowTuples[i][0];
    const t2 = windowTuples[i + 2][0];
    const duration = t2 - t0;
    if (duration > 0 && duration < 6000) {
      trigraphSum += duration;
      trigraphCount++;
    }
  }
  const meanTrigraph = trigraphCount > 0 ? trigraphSum / trigraphCount : meanFlight * 2;

  // 3. Cadence & Refactoring Metrics
  const burstinessRatio = flightTimes.length > 0 ? rapidBurstCount / flightTimes.length : 0.3;
  const metronomicEntropy = calculateShannonEntropy(flightTimes);
  const refactoringIndex = Number(((backspaceCount + navCount) / count).toFixed(3));
  
  // Authentic coding characteristics (structural refactoring, cross-line navigation)
  // Isolated 1-2 backspaces are merely motor-slips (which transcribers also make)
  const hasStructuralRefactoring = maxConsecutiveBackspaces >= 4 || navCount >= 3;
  const hasAuthenticEdits = hasStructuralRefactoring;
  const hasCognitivePauses = cognitivePauses >= 1;
  const hasOrganicCadence = metronomicEntropy >= 0.65;

  // 4. Pause Distribution
  const totalPauses = (microPauses + cognitivePauses + deepIdle) || 1;
  const pauseDistribution = {
    micro: Number((microPauses / totalPauses).toFixed(2)),
    cognitive: Number((cognitivePauses / totalPauses).toFixed(2)),
    deepIdle: Number((deepIdle / totalPauses).toFixed(2)),
  };

  // ── 5. PERSONALIZED DIVERGENCE METRICS ──
  // Speed Ratio: > 1.8x personal baseline indicates unnatural burst velocity
  const speedRatio = Number((baselineMean / Math.max(45, meanFlight)).toFixed(2));
  // Variance Ratio: < 0.22 indicates cadence collapsed to a robotic beat relative to personal jitter
  const varianceRatio = Number((intraBurstVariance / Math.max(400, baselineVar)).toFixed(2));
  // Entropy Delta: collapse from personal baseline entropy
  const entropyDelta = Number((baselineEntropy - metronomicEntropy).toFixed(2));

  let confidence = 0.96;
  let isTranscribingAnomaly = false;
  let anomalyReason = '';
  let anomalySeverity: 'low' | 'medium' | 'high' = 'low';

  // ── PERSONALIZED VECTOR A: Saccadic Glance-Burst Rhythm ──
  // Periodic glance pauses (1.5s–5s looking away to phone/second screen) followed by flat memory bursts
  const saccadicChunks = chunks.filter(c => 
    c.pauseBeforeMs >= 1500 && 
    c.pauseBeforeMs <= glancePauseMax && 
    c.charCount >= 10 && 
    c.charCount <= 45 &&
    c.intraFlightVariance < (baselineVar * 0.42) // rhythmically flat relative to personal baseline
  );

  if (saccadicChunks.length >= 2 && !hasAuthenticEdits) {
    confidence -= 0.45;
    isTranscribingAnomaly = true;
    anomalySeverity = 'high';
    anomalyReason = `Saccadic transcription rhythm: detected ${saccadicChunks.length} periodic glance pauses (1.5s–5s) followed by flat memory bursts`;
  }

  // ── PERSONALIZED VECTOR B: Personal Variance Collapse (Sight-Typing Beat) ──
  // Cadence collapsed to a flat robotic beat relative to candidate's own natural jitter
  if (intraFlights.length >= 16 && varianceRatio < 0.25 && !hasAuthenticEdits) {
    confidence -= 0.35;
    isTranscribingAnomaly = true;
    if (!anomalyReason) {
      anomalySeverity = varianceRatio < 0.15 ? 'high' : 'medium';
      anomalyReason = `Cadence flattening: typing variance collapsed to ${(varianceRatio * 100).toFixed(0)}% of personal baseline (${Math.round(intraBurstVariance)}ms² vs calibrated ${baselineVar}ms²)`;
    }
  }

  // ── PERSONALIZED VECTOR C: Velocity Acceleration without Refactoring ──
  // Typing at more than double their calibrated natural speed without refactoring
  if (count >= 25 && speedRatio >= 1.95 && !hasAuthenticEdits) {
    confidence -= 0.30;
    isTranscribingAnomaly = true;
    if (!anomalyReason) {
      anomalySeverity = speedRatio >= 2.3 ? 'high' : 'medium';
      anomalyReason = `Abnormal acceleration: typing at ${speedRatio}x personal baseline speed (${Math.round(meanFlight)}ms vs calibrated ${baselineMean}ms) without refactoring`;
    }
  }

  // ── PERSONALIZED VECTOR D: Linear Photocopy Anomaly ──
  // Requires a long sequence (45+ keys) with ZERO corrections AND robotic cadence collapse (not normal clean coding)
  if (count >= 45 && backspaceCount === 0 && varianceRatio < 0.25 && entropyDelta > 0.22) {
    confidence -= 0.35;
    isTranscribingAnomaly = true;
    if (!anomalyReason) {
      anomalySeverity = 'medium';
      anomalyReason = 'Linear photocopy anomaly: sustained tokens typed with zero corrections and robotic cadence collapse';
    }
  }

  // ── PERSONALIZED VECTOR E: Empirical Transcription Signature Match (Phase 1 Calibration) ──
  // Matches Phase 1 transcription speed and variance COMBINED with saccadic glance pauses
  if (
    baseline?.transcriptionMeanFlightTime &&
    baseline?.transcriptionVarianceFlightTime &&
    count >= 20 &&
    (saccadicChunks.length >= 1 || varianceRatio < 0.30) &&
    !hasAuthenticEdits
  ) {
    const txMean = baseline.transcriptionMeanFlightTime;
    const txVar = baseline.transcriptionVarianceFlightTime;
    const flightRatioToTx = meanFlight / txMean;

    if (flightRatioToTx >= 0.75 && flightRatioToTx <= 1.25 && intraBurstVariance <= txVar * 1.35) {
      confidence -= 0.40;
      isTranscribingAnomaly = true;
      if (!anomalyReason) {
        anomalySeverity = 'high';
        anomalyReason = `Transcription signature match: live cadence (${Math.round(meanFlight)}ms, ${Math.round(intraBurstVariance)}ms²) matches calibrated Phase 1 read-and-type profile (${txMean}ms, ${txVar}ms²)`;
      }
    }
  }

  // ── REASSURANCE BOOST: Authentic Conceptual Problem Solving ──
  if (hasAuthenticEdits || (hasCognitivePauses && hasOrganicCadence)) {
    confidence = Math.min(0.98, confidence + 0.05);
  }

  confidence = Math.max(0.15, Math.min(1.0, Number(confidence.toFixed(2))));

  return {
    windowSize: count,
    digraphLatencyMean: Math.round(meanFlight),
    digraphLatencyVariance: Math.round(totalVarFlight),
    trigraphLatencyMean: Math.round(meanTrigraph),
    burstinessRatio: Number(burstinessRatio.toFixed(2)),
    metronomicEntropy,
    refactoringIndex,
    pauseDistribution,
    integrityConfidence: confidence,
    isTranscribingAnomaly,
    anomalyReport: isTranscribingAnomaly ? {
      isAnomaly: true,
      reason: anomalyReason,
      severity: anomalySeverity,
      confidenceScore: confidence,
      divergenceMetrics: {
        speedRatio,
        varianceRatio,
        entropyDelta,
      },
    } : undefined,
  };
}
