import Dexie, { type Table } from 'dexie';
import type {
  CodeSnapshot,
  AnomalyTimelineEntry,
  OutboxItem,
  SubmissionPayload,
  BaselineCalibration,
  KeystrokeEventTuple,
} from '../types';

export interface TelemetryBatch {
  id?: number;
  sessionId: string;
  timestamp: number;
  events: KeystrokeEventTuple[];
}

export interface ReferenceSearchLog {
  id?: number;
  timestamp: number;
  query: string;
  categoryFilter?: string;
  action: 'search' | 'view_entry' | 'insert_snippet';
  entryId?: string;
}

export class SentriDatabase extends Dexie {
  snapshots!: Table<CodeSnapshot, number>;
  keystroke_telemetry!: Table<TelemetryBatch, number>;
  anomaly_timeline!: Table<AnomalyTimelineEntry, number>;
  outbox!: Table<OutboxItem, number>;
  submissions!: Table<SubmissionPayload, string>;
  baselines!: Table<BaselineCalibration, string>;
  reference_logs!: Table<ReferenceSearchLog, number>;

  constructor() {
    super('SentriCodeDB');
    this.version(1).stores({
      snapshots: '++id, timestamp, language, trigger',
      keystroke_telemetry: '++id, sessionId, timestamp',
      anomaly_timeline: '++id, timestamp, severity, confidenceScore',
      outbox: '++id, submissionId, synced, createdAt',
      submissions: 'id, candidateId, problemId, submittedAt, score',
      baselines: 'candidateId, recordedAt',
      reference_logs: '++id, timestamp, action',
    });
  }
}

export const db = new SentriDatabase();

// Pre-fill mock submissions for examiner triage view if empty
export async function seedInitialMockDataIfEmpty() {
  const count = await db.submissions.count();
  if (count > 0) return;

  const now = Date.now();

  const organicSubmission: SubmissionPayload = {
    id: 'sub-org-01',
    candidateId: 'cand-4821',
    candidateName: 'Elena Rostova',
    problemId: 'two-sum',
    language: 'javascript',
    submittedAt: now - 3600000 * 2,
    durationSeconds: 1420,
    integrityHash: 'a7b8c9e0d1f234567890abcdef1234567890abcdef1234567890abcdef123456',
    score: 100,
    testResults: [
      { testCaseId: '1', label: 'Basic Positive Pair', passed: true, executionTimeMs: 1.2 },
      { testCaseId: '2', label: 'Negative Numbers & Zero', passed: true, executionTimeMs: 0.9 },
      { testCaseId: '3', label: 'Large Dispersed Array', passed: true, executionTimeMs: 2.1 },
      { testCaseId: '4', label: 'Duplicates Elements', passed: true, executionTimeMs: 1.0 },
    ],
    telemetrySummary: {
      totalKeystrokes: 420,
      meanFlightTime: 165,
      meanDwellTime: 82,
      averageIntegrityConfidence: 0.96,
      backspaceCount: 54,
      refactoringEdits: 38,
      cognitivePauseRatio: 0.28,
      pasteEventCount: 0,
      referenceQueriesCount: 3,
      snippetsInsertedCount: 1,
      anomaliesDetected: 0,
    },
    baseline: {
      candidateId: 'cand-4821',
      meanFlightTime: 172,
      varianceFlightTime: 2400,
      meanDwellTime: 85,
      naturalBurstVelocity: 260,
      recordedAt: now - 3600000 * 2 - 1500000,
      sampleCount: 85,
      onScreenGlancePauseMeanMs: 890,
      phoneDistanceOffsetMs: 1800,
      phoneDistanceGlanceMinMs: 1890,
      phoneDistanceGlanceMaxMs: 7500,
      isPhoneDistanceCalibrated: true,
    },
    anomalyTimeline: [
      {
        timestamp: now - 3600000 * 2 + 180000,
        confidenceScore: 0.98,
        anomalyReason: 'Initial problem formulation, healthy 4.2s cognitive pause',
        severity: 'low',
      },
      {
        timestamp: now - 3600000 * 2 + 620000,
        confidenceScore: 0.94,
        anomalyReason: 'Reference manual query: "Map.get vs has"',
        severity: 'low',
      },
      {
        timestamp: now - 3600000 * 2 + 910000,
        confidenceScore: 0.95,
        anomalyReason: 'Active refactoring: loop boundary correction',
        severity: 'low',
      },
    ],
    status: 'synced',
    code: `function twoSum(nums, target) {
  // Hash map for O(n) one-pass lookup
  const seen = new Map();
  
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) {
      return [seen.get(complement), i];
    }
    seen.set(nums[i], i);
  }
  
  return [];
}`,
    examinerVerdict: {
      status: 'verified',
      professorNotes: 'Natural cadence with authentic thought pauses and refactoring. Verified.',
      reviewedBy: 'Prof. Henderson',
      reviewedAt: now - 3600000,
    },
  };

  const suspiciousSubmission: SubmissionPayload = {
    id: 'sub-sus-02',
    candidateId: 'cand-9134',
    candidateName: 'Arthur Vance',
    problemId: 'two-sum',
    language: 'javascript',
    submittedAt: now - 3600000 * 1,
    durationSeconds: 310,
    integrityHash: '8f2d91b4c731e09a34bcfa892019483019840293847291039847291837462019',
    score: 100,
    testResults: [
      { testCaseId: '1', label: 'Basic Positive Pair', passed: true, executionTimeMs: 1.1 },
      { testCaseId: '2', label: 'Negative Numbers & Zero', passed: true, executionTimeMs: 0.8 },
      { testCaseId: '3', label: 'Large Dispersed Array', passed: true, executionTimeMs: 1.9 },
      { testCaseId: '4', label: 'Duplicates Elements', passed: true, executionTimeMs: 0.9 },
    ],
    telemetrySummary: {
      totalKeystrokes: 310,
      meanFlightTime: 92,
      meanDwellTime: 45,
      averageIntegrityConfidence: 0.42,
      backspaceCount: 2,
      refactoringEdits: 1,
      cognitivePauseRatio: 0.04,
      pasteEventCount: 1,
      referenceQueriesCount: 0,
      snippetsInsertedCount: 0,
      anomaliesDetected: 5,
    },
    baseline: {
      candidateId: 'cand-9134',
      meanFlightTime: 185,
      varianceFlightTime: 2800,
      meanDwellTime: 88,
      naturalBurstVelocity: 240,
      recordedAt: now - 3600000 * 1 - 400000,
      sampleCount: 70,
      onScreenGlancePauseMeanMs: 820,
      phoneDistanceOffsetMs: 1800,
      phoneDistanceGlanceMinMs: 1820,
      phoneDistanceGlanceMaxMs: 7500,
      isPhoneDistanceCalibrated: true,
      transcriptionMeanFlightTime: 110,
      transcriptionVarianceFlightTime: 650,
    },
    anomalyTimeline: [
      {
        timestamp: now - 3600000 * 1 + 30000,
        confidenceScore: 0.48,
        anomalyReason: 'Phone / off-screen transcription cadence: periodic 2.8s distant-glance pauses with flat memory bursts',
        severity: 'high',
      },
      {
        timestamp: now - 3600000 * 1 + 95000,
        confidenceScore: 0.35,
        anomalyReason: 'Zero-backspace linear typing anomaly: entire hashmap lookup typed without refactoring',
        severity: 'high',
      },
      {
        timestamp: now - 3600000 * 1 + 160000,
        confidenceScore: 0.40,
        anomalyReason: 'Bulk insertion / fast transcription burst (>650 cpm vs calibrated 240 cpm)',
        severity: 'medium',
      },
    ],
    status: 'synced',
    code: `function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const diff = target - nums[i];
    if (map.has(diff)) return [map.get(diff), i];
    map.set(nums[i], i);
  }
  return [];
}`,
    examinerVerdict: {
      status: 'flagged_viva',
      professorNotes: 'Extremely flat metronomic pacing with 0 backspaces; requires 10-minute code walkthrough interview.',
      reviewedBy: 'Prof. Henderson',
      reviewedAt: now - 1800000,
    },
  };

  const mixedSubmission: SubmissionPayload = {
    id: 'sub-mix-03',
    candidateId: 'cand-6712',
    candidateName: 'Mira Patel',
    problemId: 'merge-intervals',
    language: 'javascript',
    submittedAt: now - 1800000,
    durationSeconds: 1850,
    integrityHash: 'c4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
    score: 80,
    testResults: [
      { testCaseId: '1', label: 'Overlapping Pairs', passed: true, executionTimeMs: 1.4 },
      { testCaseId: '2', label: 'Non-overlapping', passed: true, executionTimeMs: 1.1 },
      { testCaseId: '3', label: 'Subsumed Interval', passed: true, executionTimeMs: 1.3 },
      { testCaseId: '4', label: 'Single Element & Empty', passed: false, error: 'Cannot read properties of undefined' },
    ],
    telemetrySummary: {
      totalKeystrokes: 580,
      meanFlightTime: 158,
      meanDwellTime: 79,
      averageIntegrityConfidence: 0.88,
      backspaceCount: 68,
      refactoringEdits: 45,
      cognitivePauseRatio: 0.31,
      pasteEventCount: 0,
      referenceQueriesCount: 5,
      snippetsInsertedCount: 2,
      anomaliesDetected: 1,
    },
    baseline: {
      candidateId: 'cand-6712',
      meanFlightTime: 160,
      varianceFlightTime: 2200,
      meanDwellTime: 80,
      naturalBurstVelocity: 275,
      recordedAt: now - 1800000 - 2000000,
      sampleCount: 90,
    },
    anomalyTimeline: [
      {
        timestamp: now - 1800000 + 350000,
        confidenceScore: 0.89,
        anomalyReason: 'Consulted Reference Manual: Array.prototype.sort comparator',
        severity: 'low',
      },
      {
        timestamp: now - 1800000 + 820000,
        confidenceScore: 0.76,
        anomalyReason: 'Brief linear burst while adapting reference snippet',
        severity: 'medium',
      },
    ],
    status: 'synced',
    code: `function mergeIntervals(intervals) {
  if (intervals.length <= 1) return intervals;
  
  // Sort by start time using built-in comparator
  intervals.sort((a, b) => a[0] - b[0]);
  
  const merged = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const current = intervals[i];
    const last = merged[merged.length - 1];
    
    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push(current);
    }
  }
  return merged;
}`,
    examinerVerdict: {
      status: 'pending',
      professorNotes: '',
    },
  };

  await db.submissions.bulkPut([organicSubmission, suspiciousSubmission, mixedSubmission]);
}

// Utility to eliminate consecutive duplicates and repeated cycle blocks (e.g., if history was accidentally duplicated)
export function removeDuplicateReplaySequence(list: CodeSnapshot[]): CodeSnapshot[] {
  if (!list || list.length <= 1) return list || [];

  // Pass 1: remove identical consecutive frames
  let cleaned = list.filter((snap, i, arr) => i === 0 || snap.code !== arr[i - 1].code);

  // Pass 2: detect and remove repeated cyclic blocks (e.g. 2x, 3x, or 4x duplicate cycles)
  for (let parts = 2; parts <= 4; parts++) {
    if (cleaned.length >= parts && cleaned.length % parts === 0) {
      const chunkSize = cleaned.length / parts;
      const firstChunk = cleaned.slice(0, chunkSize);
      let allMatch = true;
      for (let p = 1; p < parts; p++) {
        const chunk = cleaned.slice(p * chunkSize, (p + 1) * chunkSize);
        if (!chunk.every((snap, i) => snap.code === firstChunk[i].code)) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        cleaned = firstChunk;
        break;
      }
    }
  }

  return cleaned;
}

// Concurrency mutex lock to prevent concurrent double-seeding from React StrictMode / multi-mounts
const seedingLocks = new Map<string, Promise<void>>();

// Generate forensic snapshots for replaying a submission
export async function seedReplaySnapshots(submissionId: string, finalCode: string) {
  if (seedingLocks.has(submissionId)) {
    return seedingLocks.get(submissionId);
  }

  const seedingPromise = (async () => {
    const existingList = await db.snapshots
      .where('trigger')
      .equals(`replay-${submissionId}`)
      .toArray();

    const cleaned = removeDuplicateReplaySequence(existingList);
    // If clean snapshots already exist without duplicate sequence repetition, keep them
    if (existingList.length > 0 && cleaned.length === existingList.length) {
      return;
    }

    // Always clear existing corrupted/duplicated snapshots before generating new ones
    await db.snapshots.where('trigger').equals(`replay-${submissionId}`).delete();

    const lines = finalCode.split('\n');
    const snapshots: CodeSnapshot[] = [];
    const baseTime = Date.now() - 1500000;
    const currentLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      currentLines.push(lines[i]);
      const code = currentLines.join('\n');
      snapshots.push({
        timestamp: baseTime + snapshots.length * 30000,
        code,
        language: 'javascript',
        trigger: `replay-${submissionId}` as any,
        charCount: code.length,
        integrityScoreAtMoment: Math.min(1.0, 0.85 + Math.sin(snapshots.length) * 0.1),
      });
    }

    // Ensure finalCode is explicitly the final snapshot
    if (snapshots.length === 0 || snapshots[snapshots.length - 1].code !== finalCode) {
      snapshots.push({
        timestamp: baseTime + snapshots.length * 30000,
        code: finalCode,
        language: 'javascript',
        trigger: `replay-${submissionId}` as any,
        charCount: finalCode.length,
        integrityScoreAtMoment: 0.95,
      });
    }

    // Strict deduplication pass: guarantee no two consecutive frames have identical code or cyclic loops
    const uniqueSnapshots = removeDuplicateReplaySequence(snapshots);

    await db.snapshots.bulkAdd(uniqueSnapshots);
  })();

  seedingLocks.set(submissionId, seedingPromise);
  try {
    await seedingPromise;
  } finally {
    seedingLocks.delete(submissionId);
  }
}
