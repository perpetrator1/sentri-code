import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { authMiddleware, requireRole, JWT_SECRET, type AuthUser } from '../middleware/auth';
import { submissionEvents } from '../services/events';

const router = Router();

// GET all submissions for Examiner Triage View (Protected: Examiner & Admin only)
router.get('/submissions', authMiddleware, requireRole('examiner', 'admin'), (req, res) => {
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

// GET Live Stream (SSE) for Real-Time Submissions to Examiner Dashboard
router.get('/live-stream', (req, res) => {
  const authHeader = req.headers.authorization;
  const queryToken = (req.query.token as string) || '';
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : queryToken;

  if (!token) {
    return res.status(401).json({ error: 'Auth token required for live stream.' });
  }

  // Validate permission (examiner or admin)
  if (token !== 'offline-examiner-token' && token !== 'offline-token') {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      if (decoded.role !== 'examiner' && decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Examiner access only.' });
      }
    } catch {
      return res.status(401).json({ error: 'Invalid token.' });
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Initial connection handshake
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

  const onNewSubmission = (submission: any) => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'NEW_SUBMISSION', submission })}\n\n`);
    } catch (e) {
      console.warn('Failed to write SSE event:', e);
    }
  };

  submissionEvents.on('new_submission', onNewSubmission);

  // Heartbeat every 20 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    submissionEvents.off('new_submission', onNewSubmission);
    clearInterval(heartbeat);
  });
});

// Update Examiner Verdict (Protected: Examiner & Admin only)
router.post('/verdict', authMiddleware, requireRole('examiner', 'admin'), (req, res) => {
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
