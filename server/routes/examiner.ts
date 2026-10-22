import { Router } from 'express';
import { db } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// GET all submissions for Examiner Triage View
router.get('/submissions', (req, res) => {
  const query = `
    SELECT 
      s.id,
      s.candidate_id as candidateId,
      s.candidate_name as candidateName,
      s.problem_id as problemId,
      s.code,
      s.language,
      s.score,
      s.test_results_json,
      s.telemetry_summary_json,
      s.anomaly_timeline_json,
      s.baseline_json,
      s.integrity_hash as integrityHash,
      s.status,
      s.submitted_at as submittedAt,
      v.status as verdictStatus,
      v.notes as verdictNotes,
      v.reviewed_by as reviewedBy,
      v.reviewed_at as reviewedAt
    FROM submissions s
    LEFT JOIN examiner_verdicts v ON s.id = v.submission_id
    ORDER BY s.submitted_at DESC
  `;

  const rows = db.prepare(query).all() as any[];

  const submissions = rows.map((r) => {
    const telemetry = JSON.parse(r.telemetry_summary_json || '{}');
    const anomalyTimeline = JSON.parse(r.anomaly_timeline_json || '[]');
    const baseline = JSON.parse(r.baseline_json || 'null');
    const testResults = JSON.parse(r.test_results_json || '[]');

    return {
      id: r.id,
      candidateId: r.candidateId,
      candidateName: r.candidateName,
      problemId: r.problemId,
      code: r.code,
      language: r.language,
      score: r.score,
      testResults,
      telemetrySummary: telemetry,
      anomalyTimeline,
      baseline,
      integrityHash: r.integrityHash,
      status: r.status,
      submittedAt: r.submittedAt,
      durationSeconds: 1200,
      examinerVerdict: {
        status: r.verdictStatus || 'pending',
        professorNotes: r.verdictNotes || '',
        reviewedBy: r.reviewedBy || 'Unassigned',
        reviewedAt: r.reviewedAt || r.submittedAt,
      },
    };
  });

  res.json({ submissions });
});

// Update Examiner Verdict
router.post('/verdict', (req, res) => {
  const { submissionId, status, notes = '', reviewedBy = 'Prof. Henderson' } = req.body;

  if (!submissionId || !status) {
    return res.status(400).json({ error: 'submissionId and status are required.' });
  }

  const validStatuses = ['verified', 'flagged_viva', 'dismissed', 'pending'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const check = db.prepare('SELECT id FROM examiner_verdicts WHERE submission_id = ?').get(submissionId) as any;
  const now = Date.now();

  if (check) {
    const updateStmt = db.prepare(`
      UPDATE examiner_verdicts
      SET status = ?, notes = ?, reviewed_by = ?, reviewed_at = ?
      WHERE submission_id = ?
    `);
    updateStmt.run(status, notes, reviewedBy, now, submissionId);
  } else {
    const insertStmt = db.prepare(`
      INSERT INTO examiner_verdicts (id, submission_id, status, notes, reviewed_by, reviewed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(`vrd-${Date.now().toString(36)}`, submissionId, status, notes, reviewedBy, now);
  }

  res.json({
    success: true,
    verdict: {
      submissionId,
      status,
      professorNotes: notes,
      reviewedBy,
      reviewedAt: now,
    },
  });
});

export default router;
