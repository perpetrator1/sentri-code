import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'sentri.sqlite');
export const db = new DatabaseSync(DB_PATH);

// Initialize schema
export function initDatabase() {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('candidate', 'examiner', 'admin')),
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS problems (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      category TEXT NOT NULL,
      time_limit_mins INTEGER NOT NULL,
      description TEXT NOT NULL,
      constraints TEXT NOT NULL,
      starter_code_json TEXT NOT NULL,
      function_name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS test_cases (
      id TEXT PRIMARY KEY,
      problem_id TEXT NOT NULL,
      label TEXT NOT NULL,
      input TEXT NOT NULL,
      expected TEXT NOT NULL,
      is_hidden INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL,
      candidate_name TEXT NOT NULL,
      problem_id TEXT NOT NULL,
      code TEXT NOT NULL,
      language TEXT NOT NULL,
      score INTEGER NOT NULL,
      test_results_json TEXT NOT NULL,
      telemetry_summary_json TEXT NOT NULL,
      anomaly_timeline_json TEXT NOT NULL,
      baseline_json TEXT,
      integrity_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      submitted_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS examiner_verdicts (
      id TEXT PRIMARY KEY,
      submission_id TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('verified', 'flagged_viva', 'dismissed', 'pending')),
      notes TEXT DEFAULT '',
      reviewed_by TEXT NOT NULL,
      reviewed_at INTEGER NOT NULL,
      FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS telemetry_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      problem_id TEXT NOT NULL,
      batch_json TEXT NOT NULL,
      recorded_at INTEGER NOT NULL
    );
  `);

  seedDataIfEmpty();
}

function seedDataIfEmpty() {
  const userCountStmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const userCount = (userCountStmt.get() as any)?.count || 0;

  if (userCount === 0) {
    console.log('🌱 Seeding initial users...');
    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('password123', salt);
    const now = Date.now();

    insertUser.run('usr-cand-1', 'candidate@sentri.dev', hash, 'Alex Rivera', 'candidate', now);
    insertUser.run('usr-exam-1', 'professor@sentri.dev', hash, 'Prof. Henderson', 'examiner', now);
    insertUser.run('usr-adm-1', 'admin@sentri.dev', hash, 'System Administrator', 'admin', now);
  }

  const problemCountStmt = db.prepare('SELECT COUNT(*) as count FROM problems');
  const problemCount = (problemCountStmt.get() as any)?.count || 0;

  if (problemCount === 0) {
    console.log('🌱 Seeding problems and test cases...');
    const insertProblem = db.prepare(`
      INSERT INTO problems (id, title, difficulty, category, time_limit_mins, description, constraints, starter_code_json, function_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTestCase = db.prepare(`
      INSERT INTO test_cases (id, problem_id, label, input, expected, is_hidden, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();

    // 1. Two Sum
    insertProblem.run(
      'two-sum',
      'Two Sum',
      'Easy',
      'Arrays & Hash Maps',
      30,
      `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice. You can return the answer in any order.`,
      `* \`2 <= nums.length <= 10^4\`
* \`-10^9 <= nums[i] <= 10^9\`
* \`-10^9 <= target <= 10^9\`
* Only one valid answer exists.`,
      JSON.stringify({
        javascript: `function twoSum(nums, target) {
  // Write your calm, deliberate solution here
  // Tip: Check the Reference Manual (Ctrl+K) for Map & Object usage
  
  return [];
}`,
        python: `def twoSum(nums, target):
    # Write your solution here
    # Tip: Check the Reference Manual (Ctrl+K) for dict usage
    return []`,
      }),
      'twoSum',
      now
    );

    // Visible test cases
    insertTestCase.run('tc-1', 'two-sum', 'Sample 1: Basic Target', '[[2, 7, 11, 15], 9]', '[0, 1]', 0, now);
    insertTestCase.run('tc-2', 'two-sum', 'Sample 2: Consecutive Elements', '[[3, 2, 4], 6]', '[1, 2]', 0, now);
    insertTestCase.run('tc-3', 'two-sum', 'Sample 3: Duplicate Values', '[[3, 3], 6]', '[0, 1]', 0, now);
    // Hidden evaluation test cases
    insertTestCase.run('tc-4-h', 'two-sum', 'Evaluation 1: Negative numbers', '[[-3, 4, 3, 90], 0]', '[0, 2]', 1, now);
    insertTestCase.run('tc-5-h', 'two-sum', 'Evaluation 2: Dispersed large array', '[[100, 25, 4, 18, 9, 3, 50], 75]', '[1, 6]', 1, now);

    // 2. Valid Anagram
    insertProblem.run(
      'valid-anagram',
      'Valid Anagram',
      'Easy',
      'Strings & Hashing',
      25,
      `Given two strings \`s\` and \`t\`, return \`true\` if \`t\` is an anagram of \`s\`, and \`false\` otherwise.

An **Anagram** is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.`,
      `* \`1 <= s.length, t.length <= 5 * 10^4\`
* \`s\` and \`t\` consist of lowercase English letters.`,
      JSON.stringify({
        javascript: `function isAnagram(s, t) {
  // Reference Manual (Ctrl+K) has quick guides for frequency maps
  
  return false;
}`,
        python: `def isAnagram(s, t):
    # Tip: Check collections.Counter or dict in Reference Manual
    return False`,
      }),
      'isAnagram',
      now
    );

    insertTestCase.run('tc-6', 'valid-anagram', 'Sample 1: Standard Match', '["anagram", "nagaram"]', 'true', 0, now);
    insertTestCase.run('tc-7', 'valid-anagram', 'Sample 2: Mismatched Length/Chars', '["rat", "car"]', 'false', 0, now);
    insertTestCase.run('tc-8-h', 'valid-anagram', 'Evaluation 1: Single Character Match', '["a", "a"]', 'true', 1, now);
    insertTestCase.run('tc-9-h', 'valid-anagram', 'Evaluation 2: Frequency Mismatch', '["aacc", "ccac"]', 'false', 1, now);

    // 3. Merge Intervals
    insertProblem.run(
      'merge-intervals',
      'Merge Intervals',
      'Medium',
      'Intervals & Sorting',
      40,
      `Given an array of \`intervals\` where \`intervals[i] = [start_i, end_i]\`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.`,
      `* \`1 <= intervals.length <= 10^4\`
* \`intervals[i].length == 2\`
* \`0 <= start_i <= end_i <= 10^4\``,
      JSON.stringify({
        javascript: `function merge(intervals) {
  // Tip: Check Array.prototype.sort in Reference Manual (Ctrl+K)
  
  return [];
}`,
        python: `def merge(intervals):
    # Tip: Check list.sort in Reference Manual (Ctrl+K)
    return []`,
      }),
      'merge',
      now
    );

    insertTestCase.run('tc-10', 'merge-intervals', 'Sample 1: Overlapping Pairs', '[[[1, 3], [2, 6], [8, 10], [15, 18]]]', '[[1, 6], [8, 10], [15, 18]]', 0, now);
    insertTestCase.run('tc-11', 'merge-intervals', 'Sample 2: Contiguous Overlap', '[[[1, 4], [4, 5]]]', '[[1, 5]]', 0, now);
    insertTestCase.run('tc-12-h', 'merge-intervals', 'Evaluation 1: Single Interval', '[[[1, 4]]]', '[[1, 4]]', 1, now);
    insertTestCase.run('tc-13-h', 'merge-intervals', 'Evaluation 2: Subsumed Interval', '[[[1, 10], [2, 3], [4, 5]]]', '[[1, 10]]', 1, now);
  }

  // Pre-seed mock candidate submissions for examiner view if empty
  const subCountStmt = db.prepare('SELECT COUNT(*) as count FROM submissions');
  const subCount = (subCountStmt.get() as any)?.count || 0;

  if (subCount === 0) {
    console.log('🌱 Seeding initial examiner submissions...');
    const insertSub = db.prepare(`
      INSERT INTO submissions (
        id, candidate_id, candidate_name, problem_id, code, language, score,
        test_results_json, telemetry_summary_json, anomaly_timeline_json, baseline_json,
        integrity_hash, status, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertVerdict = db.prepare(`
      INSERT INTO examiner_verdicts (id, submission_id, status, notes, reviewed_by, reviewed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();

    // 1. Elena Rostova - Organic (Verified)
    insertSub.run(
      'sub-org-01',
      'cand-4821',
      'Elena Rostova',
      'two-sum',
      `function twoSum(nums, target) {
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
      'javascript',
      100,
      JSON.stringify([
        { testCaseId: 'tc-1', label: 'Basic Positive Pair', passed: true, executionTimeMs: 1.2 },
        { testCaseId: 'tc-2', label: 'Negative Numbers & Zero', passed: true, executionTimeMs: 0.9 },
        { testCaseId: 'tc-3', label: 'Large Dispersed Array', passed: true, executionTimeMs: 2.1 },
      ]),
      JSON.stringify({
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
      }),
      JSON.stringify([
        { timestamp: now - 3600000 * 2 + 180000, confidenceScore: 0.98, anomalyReason: 'Initial problem formulation, healthy 4.2s cognitive pause', severity: 'low' },
        { timestamp: now - 3600000 * 2 + 620000, confidenceScore: 0.94, anomalyReason: 'Reference manual query: "Map.get vs has"', severity: 'low' },
      ]),
      JSON.stringify({
        candidateId: 'cand-4821',
        meanFlightTime: 172,
        varianceFlightTime: 2400,
        meanDwellTime: 85,
        naturalBurstVelocity: 260,
        recordedAt: now - 3600000 * 2 - 1500000,
        sampleCount: 85,
      }),
      'a7b8c9e0d1f234567890abcdef1234567890abcdef1234567890abcdef123456',
      'synced',
      now - 3600000 * 2
    );

    insertVerdict.run('vrd-1', 'sub-org-01', 'verified', 'Natural cadence with authentic thought pauses and refactoring. Verified.', 'Prof. Henderson', now - 3600000);

    // 2. Arthur Vance - Suspicious (Flagged Viva)
    insertSub.run(
      'sub-sus-02',
      'cand-9134',
      'Arthur Vance',
      'two-sum',
      `function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const diff = target - nums[i];
    if (map.has(diff)) return [map.get(diff), i];
    map.set(nums[i], i);
  }
  return [];
}`,
      'javascript',
      100,
      JSON.stringify([
        { testCaseId: 'tc-1', label: 'Basic Positive Pair', passed: true, executionTimeMs: 1.1 },
        { testCaseId: 'tc-2', label: 'Negative Numbers & Zero', passed: true, executionTimeMs: 0.8 },
      ]),
      JSON.stringify({
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
      }),
      JSON.stringify([
        { timestamp: now - 3600000 + 30000, confidenceScore: 0.48, anomalyReason: 'Metronomic transcription detected: abnormally low flight variance across 80 chars', severity: 'high' },
        { timestamp: now - 3600000 + 95000, confidenceScore: 0.35, anomalyReason: 'Zero-backspace linear typing anomaly: entire hashmap lookup typed without refactoring', severity: 'high' },
      ]),
      JSON.stringify({
        candidateId: 'cand-9134',
        meanFlightTime: 185,
        varianceFlightTime: 2800,
        meanDwellTime: 88,
        naturalBurstVelocity: 240,
        recordedAt: now - 3600000 - 400000,
        sampleCount: 70,
      }),
      '8f2d91b4c731e09a34bcfa892019483019840293847291039847291837462019',
      'synced',
      now - 3600000
    );

    insertVerdict.run('vrd-2', 'sub-sus-02', 'flagged_viva', 'Extremely flat metronomic pacing with 0 backspaces; requires 10-minute viva.', 'Prof. Henderson', now - 1800000);

    // 3. Mira Patel - Mixed (Pending)
    insertSub.run(
      'sub-mix-03',
      'cand-6712',
      'Mira Patel',
      'merge-intervals',
      `function merge(intervals) {
  if (intervals.length <= 1) return intervals;
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
      'javascript',
      80,
      JSON.stringify([
        { testCaseId: 'tc-10', label: 'Overlapping Pairs', passed: true, executionTimeMs: 1.4 },
        { testCaseId: 'tc-11', label: 'Contiguous Overlap', passed: true, executionTimeMs: 1.1 },
        { testCaseId: 'tc-12-h', label: 'Single Interval', passed: true, executionTimeMs: 1.3 },
      ]),
      JSON.stringify({
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
      }),
      JSON.stringify([
        { timestamp: now - 1800000 + 350000, confidenceScore: 0.89, anomalyReason: 'Consulted Reference Manual: Array.prototype.sort comparator', severity: 'low' },
      ]),
      JSON.stringify({
        candidateId: 'cand-6712',
        meanFlightTime: 160,
        varianceFlightTime: 2200,
        meanDwellTime: 80,
        naturalBurstVelocity: 275,
        recordedAt: now - 1800000 - 2000000,
        sampleCount: 90,
      }),
      'c4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
      'synced',
      now - 1800000
    );

    insertVerdict.run('vrd-3', 'sub-mix-03', 'pending', '', 'Unassigned', now - 1800000);
  }
}
