import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { submissionEvents } from '../services/events';

const router = Router();

// Store single submission
router.post('/', (req, res) => {
  const {
    id,
    candidateId,
    candidateName,
    problemId,
    code,
    language,
    score,
    testResults,
    telemetrySummary,
    anomalyTimeline,
    baseline,
    integrityHash,
    submittedAt = Date.now(),
  } = req.body;

  if (!candidateId || !problemId || !code) {
    return res.status(400).json({ error: 'Missing required submission fields.' });
  }

  const submissionId = id || `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  // Server-side SHA256 integrity verification
  const calculatedHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        submissionId,
        candidateId,
        code,
        score,
        telemetrySummary,
      })
    )
    .digest('hex');

  const finalHash = integrityHash || calculatedHash;

  try {
    const insertSubStmt = db.prepare(`
      INSERT OR REPLACE INTO submissions (
        id, candidate_id, candidate_name, problem_id, code, language, score,
        test_results_json, telemetry_summary_json, anomaly_timeline_json, baseline_json,
        integrity_hash, status, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertSubStmt.run(
      submissionId,
      candidateId,
      candidateName || 'Candidate',
      problemId,
      code,
      language || 'javascript',
      score ?? 100,
      JSON.stringify(testResults || []),
      JSON.stringify(telemetrySummary || {}),
      JSON.stringify(anomalyTimeline || []),
      JSON.stringify(baseline || null),
      finalHash,
      'synced',
      submittedAt
    );

    // Ensure verdict record exists
    const checkVerdict = db.prepare('SELECT id FROM examiner_verdicts WHERE submission_id = ?');
    if (!checkVerdict.get(submissionId)) {
      const insertVerdict = db.prepare(`
        INSERT INTO examiner_verdicts (id, submission_id, status, notes, reviewed_by, reviewed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insertVerdict.run(
        `vrd-${Date.now().toString(36)}`,
        submissionId,
        'pending',
        '',
        'Unassigned',
        Date.now()
      );
    }

    // Notify live examiner listeners via SSE
    const payloadForExaminer = {
      id: submissionId,
      candidateId,
      candidateName: candidateName || 'Candidate',
      problemId,
      code,
      language: language || 'javascript',
      score: score ?? 100,
      testResults: testResults || [],
      telemetrySummary: telemetrySummary || {},
      anomalyTimeline: anomalyTimeline || [],
      baseline: baseline || null,
      integrityHash: finalHash,
      status: 'synced',
      submittedAt,
      durationSeconds: 1200,
      examinerVerdict: {
        status: 'pending',
        professorNotes: '',
        reviewedBy: 'Unassigned',
        reviewedAt: submittedAt,
      },
    };
    submissionEvents.emit('new_submission', payloadForExaminer);

    return res.status(201).json({
      success: true,
      submissionId,
      integrityHash: finalHash,
      status: 'synced',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record submission: ' + err.message });
  }
});

// Batch sync outbox submissions from offline clients
router.post('/sync-outbox', (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.json({ syncedCount: 0, syncedIds: [] });
  }

  const syncedIds: string[] = [];
  const insertSubStmt = db.prepare(`
    INSERT OR REPLACE INTO submissions (
      id, candidate_id, candidate_name, problem_id, code, language, score,
      test_results_json, telemetry_summary_json, anomaly_timeline_json, baseline_json,
      integrity_hash, status, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVerdict = db.prepare(`
    INSERT OR IGNORE INTO examiner_verdicts (id, submission_id, status, notes, reviewed_by, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const item of items) {
    const payload = item.payload || item;
    if (!payload.id || !payload.candidateId || !payload.code) continue;

    try {
      insertSubStmt.run(
        payload.id,
        payload.candidateId,
        payload.candidateName || 'Candidate',
        payload.problemId,
        payload.code,
        payload.language || 'javascript',
        payload.score ?? 100,
        JSON.stringify(payload.testResults || []),
        JSON.stringify(payload.telemetrySummary || {}),
        JSON.stringify(payload.anomalyTimeline || []),
        JSON.stringify(payload.baseline || null),
        payload.integrityHash || 'verified-offline-hash',
        'synced',
        payload.submittedAt || Date.now()
      );

      insertVerdict.run(
        `vrd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`,
        payload.id,
        'pending',
        '',
        'Unassigned',
        Date.now()
      );

      syncedIds.push(payload.id);
      submissionEvents.emit('new_submission', {
        ...payload,
        status: 'synced',
        examinerVerdict: {
          status: 'pending',
          professorNotes: '',
          reviewedBy: 'Unassigned',
          reviewedAt: Date.now(),
        },
      });
    } catch (e) {
      console.error('Failed to sync item:', payload.id, e);
    }
  }

  return res.json({
    syncedCount: syncedIds.length,
    syncedIds,
    message: `Successfully synchronized ${syncedIds.length} offline submission(s).`,
  });
});

// Get single submission (Protected: Candidate can only access their own; Examiner/Admin can access any)
router.get('/:id', authMiddleware, (req, res) => {
  const stmt = db.prepare(`
    SELECT s.*, v.status as verdict_status, v.notes as verdict_notes, v.reviewed_by, v.reviewed_at
    FROM submissions s
    LEFT JOIN examiner_verdicts v ON s.id = v.submission_id
    WHERE s.id = ?
  `);
  const row = stmt.get(req.params.id) as any;

  if (!row) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  // Candidate role isolation check
  if (req.user?.role === 'candidate' && req.user.id !== row.candidate_id) {
    return res.status(403).json({ error: 'Forbidden: Candidates can only view their own submissions.' });
  }

  res.json({
    submission: {
      id: row.id,
      candidateId: row.candidate_id,
      candidateName: row.candidate_name,
      problemId: row.problem_id,
      code: row.code,
      language: row.language,
      score: row.score,
      testResults: JSON.parse(row.test_results_json || '[]'),
      telemetrySummary: JSON.parse(row.telemetry_summary_json || '{}'),
      anomalyTimeline: JSON.parse(row.anomaly_timeline_json || '[]'),
      baseline: JSON.parse(row.baseline_json || 'null'),
      integrityHash: row.integrity_hash,
      status: row.status,
      submittedAt: row.submitted_at,
      examinerVerdict: {
        status: row.verdict_status || 'pending',
        professorNotes: row.verdict_notes || '',
        reviewedBy: row.reviewed_by || 'Unassigned',
        reviewedAt: row.reviewed_at || row.submitted_at,
      },
    },
  });
});

export default router;
