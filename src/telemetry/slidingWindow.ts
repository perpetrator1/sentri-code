import type {
  KeystrokeEventTuple,
  SlidingWindowMetrics,
  BaselineCalibration,
} from '../types';

export const WINDOW_SIZE = 50;

/**
 * Calculates continuous Shannon entropy of flight times across distribution bins.
 * High entropy = organic, variable rhythm.
 * Low entropy = robotic, metronomic cadence (external transcription).
 */
export function calculateShannonEntropy(flightTimes: number[]): number {
  if (flightTimes.length === 0) return 1.0;

  // Bins: [0-100ms, 100-200ms, 200-350ms, 350-600ms, 600-1200ms, >1200ms]
  const bins = [0, 0, 0, 0, 0, 0];
  for (const ft of flightTimes) {
    if (ft < 100) bins[0]++;
    else if (ft < 200) bins[1]++;
    else if (ft < 350) bins[2]++;
    else if (ft < 600) bins[3]++;
    else if (ft < 1200) bins[4]++;
    else bins[5]++;
  }

  const total = flightTimes.length;
  let entropy = 0;
  for (const count of bins) {
    if (count > 0) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }
  }

  // Max possible entropy with 6 bins is log2(6) ≈ 2.585
  // Normalize to 0.0 - 1.0
  return Math.min(1.0, entropy / 2.585);
}

/**
 * Computes multi-dimensional features for a 50-keystroke sliding window
 */
export function analyzeWindow(
  windowTuples: KeystrokeEventTuple[],
  baseline?: BaselineCalibration
): SlidingWindowMetrics {
  const count = windowTuples.length;
  if (count < 5) {
    return {
      windowSize: count,
      digraphLatencyMean: 180,
      digraphLatencyVariance: 2500,
      trigraphLatencyMean: 360,
      burstinessRatio: 0.35,
      metronomicEntropy: 0.85,
      refactoringIndex: 0.25,
      pauseDistribution: { micro: 0.4, cognitive: 0.5, deepIdle: 0.1 },
      integrityConfidence: 1.0,
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

  for (let i = 0; i < count; i++) {
    const [, , keyClass, flightTime, dwellTime] = windowTuples[i];

    if (flightTime > 0) {
      flightTimes.push(flightTime);
      if (flightTime < 180) rapidBurstCount++;
      else if (flightTime >= 200 && flightTime <= 800) microPauses++;
      else if (flightTime > 800 && flightTime <= 5000) cognitivePauses++;
      else if (flightTime > 5000) deepIdle++;
    }

    if (dwellTime > 0) {
      dwellTimes.push(dwellTime);
    }

    if (keyClass === 'backspace_delete') backspaceCount++;
    if (keyClass === 'nav_arrow') navCount++;
  }

  // 1. Digraph flight times
  const sumFlight = flightTimes.reduce((a, b) => a + b, 0);
  const meanFlight = flightTimes.length > 0 ? sumFlight / flightTimes.length : 180;

  let varFlight = 0;
  if (flightTimes.length > 1) {
    const sumSqDiff = flightTimes.reduce((acc, ft) => acc + Math.pow(ft - meanFlight, 2), 0);
    varFlight = sumSqDiff / (flightTimes.length - 1);
  } else {
    varFlight = 2000;
  }

  // 2. Trigraph latency (triplets)
  let trigraphSum = 0;
  let trigraphCount = 0;
  for (let i = 0; i < count - 2; i++) {
    const t0 = windowTuples[i][0];
    const t2 = windowTuples[i + 2][0];
    const duration = t2 - t0;
    if (duration > 0 && duration < 8000) {
      trigraphSum += duration;
      trigraphCount++;
    }
  }
  const meanTrigraph = trigraphCount > 0 ? trigraphSum / trigraphCount : meanFlight * 2;

  // 3. Burstiness & Metronomic Entropy
  const burstinessRatio = flightTimes.length > 0 ? rapidBurstCount / flightTimes.length : 0.3;
  const metronomicEntropy = calculateShannonEntropy(flightTimes);

  // 4. Edit-Distance & Refactoring Index
  // Organic programming involves corrections, arrow jumps, bracket tweaking
  const refactoringIndex = (backspaceCount + navCount) / count;

  // 5. Pause Distribution
  const totalPauses = (microPauses + cognitivePauses + deepIdle) || 1;
  const pauseDistribution = {
    micro: Number((microPauses / totalPauses).toFixed(2)),
    cognitive: Number((cognitivePauses / totalPauses).toFixed(2)),
    deepIdle: Number((deepIdle / totalPauses).toFixed(2)),
  };

  // 6. Integrity Confidence Index (Continuous 0.0 to 1.0)
  // Higher score = high confidence of authentic, human problem solving
  // Lower score = potential external mechanical transcription
  let confidence = 0.95;
  let isTranscribingAnomaly = false;

  // Penalty 1: Low entropy combined with unnaturally low flight variance (sight-typing beat)
  // Baseline check: if student calibrated natural variance is ~2000, but live window is <300
  const baselineVariance = baseline?.varianceFlightTime || 2200;
  if (varFlight < baselineVariance * 0.25 && metronomicEntropy < 0.45 && count >= 30) {
    confidence -= 0.35;
    isTranscribingAnomaly = true;
  }

  // Penalty 2: Zero refactoring over a sustained 40+ code keystrokes window
  // Linear copying with zero backspace/navigation is rare during genuine problem solving
  if (refactoringIndex === 0 && count >= 35) {
    confidence -= 0.20;
    if (metronomicEntropy < 0.6) isTranscribingAnomaly = true;
  }

  // Penalty 3: Unnaturally uniform dwell times (key held down exact same duration)
  if (dwellTimes.length > 10) {
    const meanDwell = dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length;
    const dwellVar = dwellTimes.reduce((acc, dt) => acc + Math.pow(dt - meanDwell, 2), 0) / dwellTimes.length;
    if (dwellVar < 40 && meanDwell < 50) {
      confidence -= 0.25;
      isTranscribingAnomaly = true;
    }
  }

  // Reassurance Boost: Organic cognitive pause pattern
  // Pauses of 800ms - 5s are classic indicators of human reflection, which boosts confidence!
  if (cognitivePauses >= 2 && refactoringIndex > 0.08) {
    confidence = Math.min(1.0, confidence + 0.08);
  }

  // Clamp confidence to [0.10, 1.00]
  confidence = Math.max(0.12, Math.min(1.0, Number(confidence.toFixed(2))));

  return {
    windowSize: count,
    digraphLatencyMean: Math.round(meanFlight),
    digraphLatencyVariance: Math.round(varFlight),
    trigraphLatencyMean: Math.round(meanTrigraph),
    burstinessRatio: Number(burstinessRatio.toFixed(2)),
    metronomicEntropy: Number(metronomicEntropy.toFixed(2)),
    refactoringIndex: Number(refactoringIndex.toFixed(2)),
    pauseDistribution,
    integrityConfidence: confidence,
    isTranscribingAnomaly,
  };
}
