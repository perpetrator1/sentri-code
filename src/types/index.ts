export type KeyClass =
  | 'alpha'
  | 'numeric'
  | 'nav_arrow'
  | 'backspace_delete'
  | 'bracket_quote'
  | 'modifier'
  | 'enter'
  | 'whitespace'
  | 'punctuation';

// Tuple schema: [timestamp, event_type (down/up), key_class, flight_time, dwell_time, cursor_offset]
export type KeystrokeEventTuple = [
  timestamp: number,
  eventType: 'down' | 'up',
  keyClass: KeyClass,
  flightTime: number,
  dwellTime: number,
  cursorOffset: number
];

export interface BaselineCalibration {
  id?: string;
  candidateId: string;
  meanFlightTime: number; // in ms
  varianceFlightTime: number;
  stdDevFlightTime?: number;
  meanDwellTime: number; // in ms
  naturalBurstVelocity: number; // chars per minute
  baselineEntropy?: number; // individual Shannon cadence entropy
  naturalPauseThresholdMs?: number; // personalized glance-pause boundary (e.g. 3.5 * meanFlight)
  naturalBackspaceRate?: number; // individual natural typo correction rate
  recordedAt: number;
  sampleCount: number;
  lastAdaptedAt?: number;
}

export interface SlidingWindowMetrics {
  windowSize: number;
  digraphLatencyMean: number; // ms
  digraphLatencyVariance: number;
  trigraphLatencyMean: number;
  burstinessRatio: number; // 0 to 1
  metronomicEntropy: number; // low = robotic transcription, normal = organic
  refactoringIndex: number; // backspaces + navigation edits / window
  pauseDistribution: {
    micro: number; // 200 - 800ms
    cognitive: number; // 800ms - 5000ms
    deepIdle: number; // > 5000ms
  };
  integrityConfidence: number; // 0.0 to 1.0 continuous float
  isTranscribingAnomaly: boolean;
}

export interface AnomalyTimelineEntry {
  id?: number;
  timestamp: number;
  confidenceScore: number; // 0.0 to 1.0
  anomalyReason: string;
  severity: 'low' | 'medium' | 'high';
  cursorOffset?: number;
  metricsSnapshot?: Partial<SlidingWindowMetrics>;
}

export interface CodeSnapshot {
  id?: number;
  timestamp: number;
  code: string;
  language: 'javascript' | 'python';
  trigger: 'autosave' | 'test_run' | 'snippet_insert' | 'manual';
  cursorOffset?: number;
  charCount: number;
  integrityScoreAtMoment?: number;
}

export type ReferenceCategory =
  | 'arrays'
  | 'objects_maps'
  | 'strings'
  | 'math'
  | 'sorting_searching'
  | 'io_parsing';

export interface ReferenceEntry {
  id: string;
  name: string;
  category: ReferenceCategory;
  language: 'javascript' | 'python';
  signature: string;
  mutatesVsReturns: string; // Plain English mutates-vs-returns explanation
  timeComplexity: string;
  spaceComplexity: string;
  description: string;
  snippet: string;
  edgeCasesNotes: string;
  tags: string[];
}

export interface TestCase {
  id: string;
  label: string;
  input: string; // Serialized input
  expected: string; // Serialized expected
  rawInput?: any;
  rawExpected?: any;
  isHidden?: boolean;
}

export interface TestResult {
  testCaseId: string;
  label: string;
  passed: boolean;
  actual?: string;
  expected?: string;
  executionTimeMs?: number;
  error?: string;
  stdout?: string;
}

export interface Problem {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  timeLimitMinutes: number;
  description: string;
  tags: string[];
  constraints: string[];
  examples: {
    input: string;
    output: string;
    explanation?: string;
  }[];
  starterCode: {
    javascript: string;
    python: string;
  };
  testCases: TestCase[];
}

export interface TelemetrySummary {
  totalKeystrokes: number;
  meanFlightTime: number;
  meanDwellTime: number;
  averageIntegrityConfidence: number;
  backspaceCount: number;
  refactoringEdits: number;
  cognitivePauseRatio: number;
  pasteEventCount: number;
  referenceQueriesCount: number;
  snippetsInsertedCount: number;
  anomaliesDetected: number;
  speedDivergenceRatio?: number;
  varianceDivergenceRatio?: number;
  cadenceEntropy?: number;
}

export interface ExaminerVerdict {
  status: 'pending' | 'verified' | 'flagged_viva' | 'dismissed';
  professorNotes: string;
  reviewedBy?: string;
  reviewedAt?: number;
}

export interface SubmissionPayload {
  id: string;
  candidateId: string;
  candidateName: string;
  problemId: string;
  code: string;
  language: 'javascript' | 'python';
  submittedAt: number;
  durationSeconds: number;
  integrityHash: string; // SHA-256
  score: number; // percentage (e.g., 100, 80)
  testResults: TestResult[];
  telemetrySummary: TelemetrySummary;
  anomalyTimeline: AnomalyTimelineEntry[];
  baseline: BaselineCalibration;
  status: 'pending_sync' | 'synced';
  examinerVerdict?: ExaminerVerdict;
}

export interface OutboxItem {
  id?: number;
  submissionId: string;
  payload: SubmissionPayload;
  createdAt: number;
  attempts: number;
  synced: boolean;
  syncedAt?: number;
}
