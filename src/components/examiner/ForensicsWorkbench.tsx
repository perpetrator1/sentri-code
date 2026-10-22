import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import {
  ArrowLeft, Play, Pause, RotateCcw,
  ShieldCheck, Clock, AlertTriangle, BookOpen, CheckCircle2, MessageSquare, Brain,
} from 'lucide-react';
import type { SubmissionPayload, CodeSnapshot } from '../../types';
import { db, seedReplaySnapshots } from '../../db';

interface ForensicsWorkbenchProps {
  submission: SubmissionPayload;
  onBack: () => void;
}

export const ForensicsWorkbench: React.FC<ForensicsWorkbenchProps> = ({ submission, onBack }) => {
  const [snapshots, setSnapshots] = useState<CodeSnapshot[]>([]);
  const [idx, setIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [verdictStatus, setVerdictStatus] = useState(submission.examinerVerdict?.status || 'pending');
  const [notes, setNotes] = useState(submission.examinerVerdict?.professorNotes || '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await seedReplaySnapshots(submission.id, submission.code);
      const list = await db.snapshots
        .where('trigger').equals(`replay-${submission.id}`)
        .toArray();
      if (!cancelled) {
        if (list.length > 0) {
          setSnapshots(list);
          setIdx(list.length - 1);
        } else {
          setSnapshots([{
            timestamp: submission.submittedAt,
            code: submission.code,
            language: submission.language,
            trigger: 'manual',
            charCount: submission.code.length,
          }]);
          setIdx(0);
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, [submission.id]);

  useEffect(() => {
    if (!isPlaying || snapshots.length === 0) return;
    const t = setInterval(() => {
      setIdx(prev => {
        if (prev >= snapshots.length - 1) { setIsPlaying(false); return prev; }
        return prev + 1;
      });
    }, 1000 / speed);
    return () => clearInterval(t);
  }, [isPlaying, speed, snapshots.length]);

  const handleSave = async (status: 'verified' | 'flagged_viva' | 'dismissed') => {
    setVerdictStatus(status);
    const updatedPayload = {
      ...submission,
      examinerVerdict: { status, professorNotes: notes, reviewedBy: 'Prof. Henderson', reviewedAt: Date.now() },
    };
    await db.submissions.put(updatedPayload);

    if (navigator.onLine) {
      try {
        await fetch('/api/examiner/verdict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submissionId: submission.id,
            status,
            notes,
            reviewedBy: 'Prof. Henderson',
          }),
        });
      } catch (err) {
        console.warn('Verdict sync deferred to offline storage:', err);
      }
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const currentSnapshot = snapshots[idx];
  const pct = Math.round(submission.telemetrySummary.averageIntegrityConfidence * 100);
  const risk = pct >= 80 ? 'low' : pct >= 60 ? 'medium' : 'high';

  return (
    <div className="h-full flex flex-col bg-base-100 overflow-hidden">
      {/* Header */}
      <div className="navbar bg-base-200 border-b border-base-300 px-4 min-h-12 shrink-0">
        <div className="navbar-start gap-2">
          <button onClick={onBack} className="btn btn-sm btn-ghost gap-1.5 text-xs">
            <ArrowLeft className="w-4 h-4" /> Candidate List
          </button>
          <div className="divider divider-horizontal mx-0 hidden sm:flex" />
          <div className="text-sm font-bold text-base-content hidden sm:block">{submission.candidateName}</div>
          <div className="text-xs text-base-content/40 font-mono hidden md:block">({submission.candidateId})</div>
        </div>
        <div className="navbar-end gap-2">
          <div className="flex items-center gap-1.5 text-xs text-base-content/50 font-mono">
            <Clock className="w-3.5 h-3.5" />
            {Math.round(submission.durationSeconds / 60)}m
          </div>
          <div className={`badge badge-sm font-bold font-mono ${
            risk === 'low' ? 'badge-success text-white' :
            risk === 'medium' ? 'badge-warning' : 'badge-error text-white'
          }`}>
            {pct}% authentic
          </div>
        </div>
      </div>

      {/* Main split */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

        {/* ── LEFT: Replay editor ── */}
        <div className="flex-1 flex flex-col border-r border-base-300 overflow-hidden min-w-0">

          {/* Replay controls */}
          <div className="p-3 bg-base-200/60 border-b border-base-300 space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(p => !p)}
                  className="btn btn-xs btn-primary gap-1"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={() => { setIsPlaying(false); setIdx(0); }}
                  className="btn btn-xs btn-ghost"
                  title="Rewind"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <div className="join">
                  {([1, 2, 4] as const).map(s => (
                    <button key={s} onClick={() => setSpeed(s)}
                      className={`join-item btn btn-xs ${speed === s ? 'btn-neutral' : 'btn-ghost border border-base-300'}`}>
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-xs font-mono text-base-content/50">
                {idx + 1} / {snapshots.length}
              </span>
            </div>

            {/* Scrubber */}
            <input
              type="range" min="0" max={Math.max(0, snapshots.length - 1)} value={idx}
              onChange={e => { setIsPlaying(false); setIdx(+e.target.value); }}
              className="range range-xs range-primary w-full"
            />

            {/* Heatmap */}
            <div className="flex gap-px h-2 rounded-full overflow-hidden bg-base-300">
              {snapshots.map((snap, i) => {
                const suspicious = submission.anomalyTimeline.some(
                  a => Math.abs(a.timestamp - snap.timestamp) < 60000 && a.severity === 'high'
                ) || (pct < 60 && i > 3 && i < 12);
                return (
                  <div
                    key={i}
                    className={`flex-1 h-full transition-opacity ${
                      suspicious ? 'bg-error' : i % 5 === 0 ? 'bg-warning' : 'bg-success'
                    } ${i === idx ? 'opacity-100 ring-1 ring-primary' : 'opacity-70'}`}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-base-content/40">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success inline-block" />Organic</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning inline-block" />Fast burst</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-error inline-block" />Anomaly</span>
            </div>
          </div>

          {/* Monaco read-only */}
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              theme="vs"
              language={submission.language}
              value={currentSnapshot?.code ?? submission.code}
              options={{
                readOnly: true, fontSize: 13, minimap: { enabled: false },
                lineNumbers: 'on', scrollBeyondLastLine: false, wordWrap: 'on',
                domReadOnly: true, padding: { top: 12, bottom: 12 },
              }}
            />
          </div>
        </div>

        {/* ── RIGHT: Audit panel ── */}
        <div className="w-full lg:w-80 xl:w-96 flex flex-col overflow-y-auto bg-base-50 border-t lg:border-t-0 border-base-300">

          {/* Telemetry comparison */}
          <div className="p-4 space-y-3 border-b border-base-300">
            <h4 className="text-xs font-bold uppercase tracking-widest text-base-content/50">
              Biometric Comparison
            </h4>
            <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
              <div className="bg-base-200 rounded-xl p-2.5 space-y-1 border border-base-300">
                <div className="text-[9px] text-base-content/50 font-sans uppercase tracking-wider mb-1">Cognitive Baseline</div>
                <div>Flight: {submission.baseline.meanFlightTime}ms</div>
                <div>Var: {submission.baseline.varianceFlightTime}</div>
                <div>Dwell: {submission.baseline.meanDwellTime}ms</div>
              </div>
              {submission.baseline.transcriptionMeanFlightTime && (
                <div className="bg-warning/8 rounded-xl p-2.5 space-y-1 border border-warning/25">
                  <div className="text-[9px] text-warning/70 font-sans uppercase tracking-wider mb-1">Read & Type</div>
                  <div>Flight: {submission.baseline.transcriptionMeanFlightTime}ms</div>
                  <div>Var: {submission.baseline.transcriptionVarianceFlightTime}</div>
                  <div>BS: {((submission.baseline.transcriptionBackspaceRate ?? 0) * 100).toFixed(1)}%</div>
                </div>
              )}
              <div className="bg-base-200 rounded-xl p-2.5 space-y-1 border border-base-300">
                <div className="text-[9px] text-base-content/50 font-sans uppercase tracking-wider mb-1">Live Exam</div>
                <div className={submission.telemetrySummary.meanFlightTime < 100 ? 'text-warning font-bold' : ''}>
                  Flight: {submission.telemetrySummary.meanFlightTime}ms
                </div>
                <div>Backsp.: {submission.telemetrySummary.backspaceCount}</div>
                <div>Refact.: {submission.telemetrySummary.refactoringEdits}</div>
              </div>
            </div>
            <div className="text-xs text-base-content/60">
              Cognitive pauses: <strong>{Math.round(submission.telemetrySummary.cognitivePauseRatio * 100)}%</strong> of exam time
            </div>
          </div>

          {/* Candidate personal statement */}
          {submission.baseline.candidateStatement && (
            <div className="p-4 space-y-2 border-b border-base-300">
              <h4 className="text-xs font-bold uppercase tracking-widest text-base-content/50 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-secondary" />
                Candidate's Statement
              </h4>
              {submission.baseline.personalQuestionAsked && (
                <p className="text-[10px] text-base-content/45 italic leading-snug">
                  Q: {submission.baseline.personalQuestionAsked}
                </p>
              )}
              <blockquote className="text-xs text-base-content/80 leading-relaxed bg-secondary/5 border-l-2 border-secondary/40 pl-3 py-1 rounded-r-lg">
                {submission.baseline.candidateStatement}
              </blockquote>
            </div>
          )}

          {/* Anomaly feed */}
          <div className="p-4 space-y-2.5 border-b border-base-300 flex-1">
            <h4 className="text-xs font-bold uppercase tracking-widest text-base-content/50 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-warning" />
              Flagged Events ({submission.anomalyTimeline.length})
            </h4>

            {submission.anomalyTimeline.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-success bg-success/5 border border-success/20 rounded-xl px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                No anomalies detected — clean session.
              </div>
            ) : (
              <div className="space-y-2">
                {submission.anomalyTimeline.map((item, i) => (
                  <div key={i} className={`rounded-xl border p-2.5 text-xs space-y-0.5 ${
                    item.severity === 'high' ? 'bg-error/8 border-error/25 text-error-content' :
                    item.severity === 'medium' ? 'bg-warning/8 border-warning/25' :
                    'bg-base-200 border-base-300 text-base-content/70'
                  }`}>
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="font-bold uppercase">{item.severity}</span>
                      <span>{Math.round(item.confidenceScore * 100)}% conf.</span>
                    </div>
                    <p className="text-[11px] leading-snug">{item.anomalyReason}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 pt-1">
              <BookOpen className="w-3 h-3 text-primary" />
              Docs consulted {submission.telemetrySummary.referenceQueriesCount}×,
              snippets inserted {submission.telemetrySummary.snippetsInsertedCount}×
            </div>
          </div>

          {/* Verdict form */}
          <div className="p-4 space-y-3 bg-base-200/40">
            <h4 className="text-xs font-bold uppercase tracking-widest text-base-content/50 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              Examiner Verdict
            </h4>

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes, observations, or follow-up questions..."
              rows={3}
              className="textarea textarea-bordered textarea-sm w-full text-xs bg-base-100 focus:textarea-primary"
            />

            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSave('verified')}
                  className={`btn btn-sm ${verdictStatus === 'verified' ? 'btn-success text-white' : 'btn-outline btn-success'}`}
                >
                  ✓ Verified
                </button>
                <button
                  onClick={() => handleSave('flagged_viva')}
                  className={`btn btn-sm ${verdictStatus === 'flagged_viva' ? 'btn-warning text-white' : 'btn-outline btn-warning'}`}
                >
                  🎤 Oral Viva
                </button>
              </div>
              <button
                onClick={() => handleSave('dismissed')}
                className={`btn btn-sm ${verdictStatus === 'dismissed' ? 'btn-neutral' : 'btn-ghost border border-base-300'}`}
              >
                Dismiss Flag
              </button>
            </div>

            {saved && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-success font-medium">
                <CheckCircle2 className="w-4 h-4" /> Verdict saved!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
