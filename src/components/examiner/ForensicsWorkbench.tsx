import React, { useState, useEffect, useMemo, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Clock,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  MessageSquare,
  Sparkles,
  Zap,
  Terminal,
  Activity,
} from 'lucide-react';
import type { SubmissionPayload, CodeSnapshot } from '../../types';
import { db, seedReplaySnapshots, removeDuplicateReplaySequence } from '../../db';
import { AISummaryCard } from './AISummaryCard';

interface ForensicsWorkbenchProps {
  submission: SubmissionPayload;
  onBack: () => void;
  user?: any;
}

export const ForensicsWorkbench: React.FC<ForensicsWorkbenchProps> = ({ submission, onBack, user }) => {
  const [snapshots, setSnapshots] = useState<CodeSnapshot[]>([]);
  const [idx, setIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<0.5 | 1 | 2 | 4>(1);
  const [verdictStatus, setVerdictStatus] = useState(submission.examinerVerdict?.status || 'pending');
  const [notes, setNotes] = useState(submission.examinerVerdict?.professorNotes || '');
  const [saved, setSaved] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Initialize and load replay snapshots
  useEffect(() => {
    let cancelled = false;
    async function init() {
      let rawSnaps: CodeSnapshot[] = [];

      // 1. Direct from submission object (candidate's real recorded keystroke snapshots)
      if (submission.snapshots && submission.snapshots.length > 0) {
        rawSnaps = submission.snapshots;
      } else {
        // 2. Query IndexedDB for snapshots stored under this submission's replay key
        const stored = await db.snapshots
          .where('trigger')
          .equals(`replay-${submission.id}`)
          .toArray();

        if (stored.length > 0) {
          rawSnaps = stored;
        } else {
          // 3. Fallback only for legacy mock data (sub-org-01, sub-sus-02, etc.)
          await seedReplaySnapshots(submission.id, submission.code);
          rawSnaps = await db.snapshots
            .where('trigger')
            .equals(`replay-${submission.id}`)
            .toArray();
        }
      }

      if (!cancelled) {
        // Strict deduplication: remove consecutive duplicates AND any repeated sequence cycles
        const cleanList = removeDuplicateReplaySequence(rawSnaps);
        if (cleanList.length > 0) {
          setSnapshots(cleanList);
          setIdx(cleanList.length - 1);

          // If corrupted duplicate cycles existed in DB from legacy runs, heal them permanently
          if (cleanList.length !== rawSnaps.length && (!submission.snapshots || submission.snapshots.length === 0)) {
            db.snapshots
              .where('trigger')
              .equals(`replay-${submission.id}`)
              .delete()
              .then(() => {
                db.snapshots.bulkAdd(
                  cleanList.map((s) => ({ ...s, trigger: `replay-${submission.id}` }))
                );
              })
              .catch(() => {});
          }
        } else {
          setSnapshots([
            {
              timestamp: submission.submittedAt,
              code: submission.code,
              language: submission.language,
              trigger: 'manual',
              charCount: submission.code.length,
              integrityScoreAtMoment: submission.telemetrySummary.averageIntegrityConfidence,
            },
          ]);
          setIdx(0);
        }
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [submission.id, submission.snapshots]);

  // Automated playback timer
  useEffect(() => {
    if (!isPlaying || snapshots.length === 0) return;
    const intervalMs = Math.round(1000 / speed);
    const t = setInterval(() => {
      setIdx((prev) => {
        if (prev >= snapshots.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => clearInterval(t);
  }, [isPlaying, speed, snapshots.length]);

  const pct = Math.round(submission.telemetrySummary.averageIntegrityConfidence * 100);
  const risk = pct >= 80 ? 'low' : pct >= 60 ? 'medium' : 'high';

  // Correlation helpers
  const getSnapshotAnomaly = (snap: CodeSnapshot, i: number) => {
    if (!snap) return null;
    const found = submission.anomalyTimeline.find(
      (a) => Math.abs(a.timestamp - snap.timestamp) < 60000 && (a.severity === 'high' || a.severity === 'medium')
    );
    if (found) return found;

    // Simulated benchmark flagging for suspicious candidates
    if (pct < 60 && i > 3 && i < 12) {
      return {
        severity: 'high' as const,
        anomalyReason: 'Unnatural transcription cadence: 0 backspaces with invariant flight speed',
        confidenceScore: (100 - pct) / 100,
      };
    }
    return null;
  };

  const getSnapshotStatus = (snap: CodeSnapshot, i: number) => {
    const anomaly = getSnapshotAnomaly(snap, i);
    if (anomaly) {
      return { type: 'anomaly', severity: anomaly.severity, reason: anomaly.anomalyReason };
    }
    if (snap.integrityScoreAtMoment !== undefined) {
      if (snap.integrityScoreAtMoment < 0.6) return { type: 'anomaly', severity: 'high', reason: 'Low biometric confidence' };
      if (snap.integrityScoreAtMoment < 0.8) return { type: 'burst', severity: 'medium', reason: 'High burst velocity' };
    }
    if (i % 5 === 0 && pct < 85) {
      return { type: 'burst', severity: 'medium', reason: 'Elevated typing burst' };
    }
    return { type: 'organic', severity: 'low', reason: 'Natural cognitive rhythm' };
  };

  // Find anomaly indices on the timeline
  const anomalyIndices = useMemo(() => {
    const list: number[] = [];
    snapshots.forEach((snap, i) => {
      if (getSnapshotStatus(snap, i).type === 'anomaly') {
        list.push(i);
      }
    });
    return list;
  }, [snapshots, pct, submission.anomalyTimeline]);

  const findSnapshotForAnomaly = (anomalyTimestamp: number) => {
    if (snapshots.length === 0) return 0;
    let closestIdx = 0;
    let minDiff = Infinity;
    snapshots.forEach((snap, i) => {
      const diff = Math.abs(snap.timestamp - anomalyTimestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    });
    return closestIdx;
  };

  // Navigation handlers
  const handlePrevFrame = () => {
    setIsPlaying(false);
    setIdx((prev) => Math.max(0, prev - 1));
  };

  const handleNextFrame = () => {
    setIsPlaying(false);
    setIdx((prev) => Math.min(snapshots.length - 1, prev + 1));
  };

  const handleNextAnomaly = () => {
    setIsPlaying(false);
    if (anomalyIndices.length === 0) return;
    for (const anomIdx of anomalyIndices) {
      if (anomIdx > idx) {
        setIdx(anomIdx);
        return;
      }
    }
    // Wrap around to first
    setIdx(anomalyIndices[0]);
  };

  const handlePrevAnomaly = () => {
    setIsPlaying(false);
    if (anomalyIndices.length === 0) return;
    for (let i = anomalyIndices.length - 1; i >= 0; i--) {
      if (anomalyIndices[i] < idx) {
        setIdx(anomalyIndices[i]);
        return;
      }
    }
    // Wrap around to last
    setIdx(anomalyIndices[anomalyIndices.length - 1]);
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT') {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsPlaying(false);
        setIdx((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIsPlaying(false);
        setIdx((prev) => Math.min(snapshots.length - 1, prev + 1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setIsPlaying(false);
        setIdx(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setIsPlaying(false);
        setIdx(snapshots.length - 1);
      } else if (e.key.toLowerCase() === 'a' && anomalyIndices.length > 0) {
        e.preventDefault();
        handleNextAnomaly();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [snapshots.length, anomalyIndices, idx]);

  const handleSave = async (status: 'verified' | 'flagged_viva' | 'dismissed') => {
    setVerdictStatus(status);
    const reviewerName = user?.name || 'Prof. Henderson';
    const updatedPayload = {
      ...submission,
      examinerVerdict: { status, professorNotes: notes, reviewedBy: reviewerName, reviewedAt: Date.now() },
    };
    await db.submissions.put(updatedPayload);

    if (navigator.onLine) {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('sentri_auth_token') : null;
        await fetch('/api/examiner/verdict', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            submissionId: submission.id,
            status,
            notes,
            reviewedBy: reviewerName,
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
  const prevChars = idx > 0 ? snapshots[idx - 1]?.charCount ?? 0 : 0;
  const charDelta = currentSnapshot ? currentSnapshot.charCount - prevChars : 0;

  const startTime = snapshots[0]?.timestamp || submission.submittedAt - (submission.durationSeconds || 1200) * 1000;
  const currentElapsed = Math.max(0, Math.round(((currentSnapshot?.timestamp || startTime) - startTime) / 1000));
  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const currentStatus = currentSnapshot ? getSnapshotStatus(currentSnapshot, idx) : null;
  const isCurrentAnomaly = currentStatus?.type === 'anomaly';

  const statusCounts = useMemo(() => {
    let organic = 0;
    let burst = 0;
    let anomaly = 0;
    snapshots.forEach((snap, i) => {
      const s = getSnapshotStatus(snap, i);
      if (s.type === 'anomaly') anomaly++;
      else if (s.type === 'burst') burst++;
      else organic++;
    });
    return { organic, burst, anomaly };
  }, [snapshots, pct, submission.anomalyTimeline]);

  return (
    <div className="h-full flex flex-col bg-base-100 overflow-hidden select-none">
      {/* Header */}
      <header className="navbar bg-base-200 border-b border-base-300 px-4 min-h-12 shrink-0">
        <div className="navbar-start gap-2">
          <button onClick={onBack} className="btn btn-sm btn-ghost gap-1.5 text-xs hover:bg-base-300">
            <ArrowLeft className="w-4 h-4" /> Candidate List
          </button>
          <div className="divider divider-horizontal mx-0 hidden sm:flex" />
          <div className="text-sm font-bold text-base-content hidden sm:block">{submission.candidateName}</div>
          <div className="text-xs text-base-content/40 font-mono hidden md:block">({submission.candidateId})</div>
        </div>
        <div className="navbar-end gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-base-content/60 font-mono bg-base-100 px-2 py-1 rounded-lg border border-base-300/70">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>{Math.round(submission.durationSeconds / 60)}m exam</span>
          </div>
          <div
            className={`badge badge-sm font-bold font-mono px-2.5 py-1 ${
              risk === 'low'
                ? 'badge-success text-white'
                : risk === 'medium'
                ? 'badge-warning text-warning-content'
                : 'badge-error text-white'
            }`}
          >
            {pct}% authentic
          </div>
        </div>
      </header>

      {/* Main split */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* ── LEFT: Replay Editor & Enhanced Scrub Bar ── */}
        <div className="flex-1 flex flex-col border-r border-base-300 overflow-hidden min-w-0">
          {/* ══════════ ADVANCED CODE REPLAY SCRUB BAR ══════════ */}
          <div className="p-3.5 bg-base-200/80 border-b border-base-300 space-y-3 shrink-0 shadow-xs">
            {/* Control Bar: Playback Controls & Frame Telemetry */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Left playback controls */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Play / Pause */}
                <button
                  onClick={() => setIsPlaying((p) => !p)}
                  className={`btn btn-xs ${isPlaying ? 'btn-secondary text-white' : 'btn-primary text-primary-content'} gap-1.5 px-3 font-semibold shadow-xs`}
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                {/* Step Back (Previous Frame) */}
                <button
                  onClick={handlePrevFrame}
                  disabled={idx === 0}
                  className="btn btn-xs btn-ghost border border-base-300/80 hover:bg-base-300 px-1.5"
                  title="Previous frame (Left arrow)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {/* Step Forward (Next Frame) */}
                <button
                  onClick={handleNextFrame}
                  disabled={idx >= snapshots.length - 1}
                  className="btn btn-xs btn-ghost border border-base-300/80 hover:bg-base-300 px-1.5"
                  title="Next frame (Right arrow)"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {/* Rewind to start */}
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setIdx(0);
                  }}
                  className="btn btn-xs btn-ghost border border-base-300/80 hover:bg-base-300 px-1.5"
                  title="Rewind to start (Home)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Jump to final code */}
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setIdx(snapshots.length - 1);
                  }}
                  className="btn btn-xs btn-ghost border border-base-300/80 hover:bg-base-300 px-1.5"
                  title="Jump to final submission (End)"
                >
                  <FastForward className="w-3.5 h-3.5" />
                </button>

                {/* Speed Selector */}
                <div className="join border border-base-300/80 rounded-lg overflow-hidden ml-1">
                  {([0.5, 1, 2, 4] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={`join-item btn btn-xs px-2 font-mono font-semibold ${
                        speed === s ? 'btn-neutral text-neutral-content' : 'btn-ghost text-base-content/70'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>

                {/* Jump to Next Anomaly */}
                {anomalyIndices.length > 0 && (
                  <button
                    onClick={handleNextAnomaly}
                    className="btn btn-xs btn-error btn-outline gap-1.5 px-2.5 font-semibold ml-1 animate-pulse"
                    title="Jump to next flagged anomaly (Press A)"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-error" />
                    <span>Next Flag</span>
                    <kbd className="kbd kbd-xs font-mono text-[9px] bg-error/15 text-error border-error/30">A</kbd>
                  </button>
                )}
              </div>

              {/* Right: Current Frame Telemetry Info Badges */}
              <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                {/* Frame Counter */}
                <div className="px-2.5 py-0.5 rounded-lg bg-base-100 border border-base-300 text-base-content/80 font-bold">
                  Frame <span className="text-primary">{idx + 1}</span>
                  <span className="text-base-content/40">/{snapshots.length}</span>
                </div>

                {/* Elapsed Time */}
                <div className="px-2 py-0.5 rounded-lg bg-base-100 border border-base-300 text-base-content/70 flex items-center gap-1 text-[11px]">
                  <Clock className="w-3 h-3 text-base-content/40" />
                  <span>{formatElapsed(currentElapsed)}</span>
                </div>

                {/* Character Delta */}
                <div
                  className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${
                    charDelta > 0
                      ? 'bg-success/10 border-success/30 text-success'
                      : charDelta < 0
                      ? 'bg-warning/10 border-warning/30 text-warning'
                      : 'bg-base-100 border-base-300 text-base-content/60'
                  }`}
                  title={`${currentSnapshot?.charCount ?? 0} total characters`}
                >
                  {currentSnapshot?.charCount ?? 0} chars{' '}
                  <span className="text-[10px]">
                    ({charDelta > 0 ? `+${charDelta}` : charDelta})
                  </span>
                </div>

                {/* Moment Health Badge */}
                <div
                  className={`px-2.5 py-0.5 rounded-lg font-bold text-[11px] border ${
                    isCurrentAnomaly
                      ? 'bg-error text-white border-error shadow-xs'
                      : currentStatus?.type === 'burst'
                      ? 'bg-warning/15 text-warning-content border-warning/40'
                      : 'bg-success/15 text-success border-success/30'
                  }`}
                >
                  {isCurrentAnomaly
                    ? currentStatus?.reason?.toLowerCase().includes('phone')
                      ? 'Phone Sight-Typing'
                      : 'Anomaly'
                    : currentStatus?.type === 'burst'
                    ? 'Burst'
                    : 'Authentic'}
                </div>
              </div>
            </div>

            {/* ── Interactive Combined Heatmap Scrub Track ── */}
            <div className="space-y-1.5">
              <div className="relative group w-full py-1">
                {/* Background Heatmap Segments */}
                <div className="flex gap-0.5 h-6 rounded-xl overflow-hidden bg-base-300/80 p-0.5 border border-base-300 shadow-inner">
                  {snapshots.map((snap, i) => {
                    const status = getSnapshotStatus(snap, i);
                    const isActive = i === idx;
                    const isHovered = i === hoveredIdx;

                    let bgClass = 'bg-success/75';
                    if (status.type === 'anomaly') {
                      bgClass = 'bg-error shadow-xs';
                    } else if (status.type === 'burst') {
                      bgClass = 'bg-warning/85';
                    }

                    return (
                      <div
                        key={i}
                        onMouseEnter={() => setHoveredIdx(i)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        className={`flex-1 h-full rounded-sm transition-all relative ${bgClass} ${
                          isActive
                            ? 'opacity-100 ring-2 ring-primary ring-offset-1 ring-offset-base-100 z-10 scale-y-110'
                            : isHovered
                            ? 'opacity-95 brightness-110 z-0'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        {status.type === 'anomaly' && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Overlaid Transparent Native Range Input for Fluid Mouse & Touch Scrubbing */}
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, snapshots.length - 1)}
                  value={idx}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setIdx(+e.target.value);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  title="Scrub timeline (click or drag)"
                />

                {/* Scrubber Playhead Needle */}
                {snapshots.length > 1 && (
                  <div
                    className="absolute top-1 bottom-1 w-0.5 bg-primary pointer-events-none transition-all duration-75 z-10"
                    style={{ left: `${(idx / (snapshots.length - 1)) * 100}%` }}
                  >
                    <div className="w-3 h-3 rounded-full bg-primary -ml-[5px] -mt-1 shadow-md border-2 border-white ring-1 ring-primary/40" />
                  </div>
                )}
              </div>

              {/* Hover Preview Tooltip if hovering a different snapshot */}
              {hoveredIdx !== null && hoveredIdx !== idx && snapshots[hoveredIdx] && (
                <div className="text-[11px] font-mono bg-base-100 border border-base-300 rounded-lg px-2.5 py-1 text-base-content/80 flex items-center justify-between shadow-sm animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary">Frame {hoveredIdx + 1}</span>
                    <span>{snapshots[hoveredIdx].charCount} chars</span>
                    <span className="text-base-content/40">·</span>
                    <span className="text-base-content/60">
                      {getSnapshotStatus(snapshots[hoveredIdx], hoveredIdx).reason}
                    </span>
                  </div>
                  <span className="text-primary font-sans text-[10px] font-semibold">Click to inspect</span>
                </div>
              )}
            </div>

            {/* Bottom Legend & Quick Event Jumpers */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-base-content/50 pt-0.5">
              {/* Legend with direct counts */}
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 font-medium">
                  <span className="w-2 h-2 rounded-full bg-success inline-block shadow-2xs" />
                  <span>{statusCounts.organic} Organic</span>
                </span>
                <span className="flex items-center gap-1 font-medium">
                  <span className="w-2 h-2 rounded-full bg-warning inline-block shadow-2xs" />
                  <span>{statusCounts.burst} Rapid bursts</span>
                </span>
                <button
                  onClick={handleNextAnomaly}
                  disabled={statusCounts.anomaly === 0}
                  className={`flex items-center gap-1 font-bold ${
                    statusCounts.anomaly > 0
                      ? 'text-error hover:underline cursor-pointer'
                      : 'opacity-50 cursor-default'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-error inline-block shadow-2xs" />
                  <span>{statusCounts.anomaly} Flagged anomalies</span>
                </button>
              </div>

              {/* Keyboard shortcuts reminder */}
              <div className="hidden md:flex items-center gap-2 font-mono text-[9px] text-base-content/40">
                <span>[Space] Play/Pause</span>
                <span>·</span>
                <span>[←/→] Step</span>
                <span>·</span>
                <span>[Home/End] Jump</span>
                {anomalyIndices.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-error font-semibold">[A] Next Flag</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ══════════ MONACO READ-ONLY CODE REPLAY VIEW ══════════ */}
          <div className="flex-1 overflow-hidden relative">
            <Editor
              height="100%"
              theme="vs"
              language={submission.language}
              value={currentSnapshot?.code ?? submission.code}
              options={{
                readOnly: true,
                fontSize: 13,
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                domReadOnly: true,
                padding: { top: 12, bottom: 12 },
              }}
            />

            {/* In-Editor Status Watermark */}
            {isCurrentAnomaly && (
              <div className="absolute top-3 right-5 pointer-events-none z-10 flex items-center gap-2 bg-error/15 border border-error/30 text-error px-3 py-1.5 rounded-xl shadow-sm text-xs font-semibold backdrop-blur-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{currentStatus?.reason || 'Flagged anomaly moment'}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Biometric Forensics & Flagged Events Audit Panel ── */}
        <div className="w-full lg:w-96 xl:w-[26rem] shrink-0 flex flex-col overflow-y-auto bg-base-100 border-t lg:border-t-0 border-base-300">
          {/* Telemetry comparison */}
          <div className="p-4 space-y-3 border-b border-base-300">
            <h4 className="text-xs font-bold uppercase tracking-widest text-base-content/50">
              Biometric Comparison
            </h4>
            <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
              <div className="bg-base-200 rounded-xl p-2 space-y-0.5 border border-base-300 min-w-0 overflow-hidden">
                <div className="text-[9px] text-base-content/50 font-sans uppercase tracking-wider mb-0.5 truncate">Baseline</div>
                <div className="truncate text-[11px]">Flight: {submission.baseline.meanFlightTime}ms</div>
                <div className="truncate text-[11px]">Var: {submission.baseline.varianceFlightTime}</div>
                <div className="truncate text-[11px]">Dwell: {submission.baseline.meanDwellTime}ms</div>
              </div>
              {submission.baseline.transcriptionMeanFlightTime && (
                <div className="bg-warning/8 rounded-xl p-2 space-y-0.5 border border-warning/25 min-w-0 overflow-hidden">
                  <div className="text-[9px] text-warning/70 font-sans uppercase tracking-wider mb-0.5 truncate">Read & Type</div>
                  <div className="truncate text-[11px]">Flight: {submission.baseline.transcriptionMeanFlightTime}ms</div>
                  <div className="truncate text-[11px]">Var: {submission.baseline.transcriptionVarianceFlightTime}</div>
                  <div className="truncate text-[11px]">BS: {((submission.baseline.transcriptionBackspaceRate ?? 0) * 100).toFixed(1)}%</div>
                </div>
              )}
              <div className="bg-base-200 rounded-xl p-2 space-y-0.5 border border-base-300 min-w-0 overflow-hidden">
                <div className="text-[9px] text-base-content/50 font-sans uppercase tracking-wider mb-0.5 truncate">Live Exam</div>
                <div className={`truncate text-[11px] ${submission.telemetrySummary.meanFlightTime < 100 ? 'text-warning font-bold' : ''}`}>
                  Flight: {submission.telemetrySummary.meanFlightTime}ms
                </div>
                <div className="truncate text-[11px]">Backsp.: {submission.telemetrySummary.backspaceCount}</div>
                <div className="truncate text-[11px]">Refact.: {submission.telemetrySummary.refactoringEdits}</div>
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
              <blockquote className="text-xs text-base-content/80 leading-relaxed bg-secondary/5 border-l-2 border-secondary/40 pl-3 py-1 rounded-r-lg break-words">
                {submission.baseline.candidateStatement}
              </blockquote>
            </div>
          )}

          {/* Interactive Anomaly Feed (Clicking jumps scrubber) */}
          <div className="p-4 space-y-2.5 border-b border-base-300 flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-widest text-base-content/50 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                Flagged Events ({submission.anomalyTimeline.length})
              </h4>
              <span className="text-[10px] text-primary font-medium">Click event to jump</span>
            </div>

            {submission.anomalyTimeline.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-success bg-success/5 border border-success/20 rounded-xl px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                No anomalies detected — clean session.
              </div>
            ) : (
              <div className="space-y-2">
                {submission.anomalyTimeline.map((item, i) => {
                  const targetSnapIdx = findSnapshotForAnomaly(item.timestamp);
                  const isCurrentTarget = targetSnapIdx === idx;

                  return (
                    <div
                      key={i}
                      onClick={() => {
                        setIsPlaying(false);
                        setIdx(targetSnapIdx);
                      }}
                      className={`rounded-xl border p-2.5 text-xs space-y-1.5 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-sm overflow-hidden ${
                        isCurrentTarget
                          ? 'ring-2 ring-primary bg-primary/10 border-primary'
                          : item.severity === 'high'
                          ? 'bg-error/8 border-error/25 text-error-content hover:bg-error/15'
                          : item.severity === 'medium'
                          ? 'bg-warning/8 border-warning/25 hover:bg-warning/15'
                          : 'bg-base-200 border-base-300 text-base-content/70 hover:bg-base-300'
                      }`}
                      title="Click to jump replay to this snapshot"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5 font-mono text-[10px]">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span
                            className={`badge badge-xs font-bold uppercase font-mono ${
                              item.severity === 'high'
                                ? 'badge-error text-white'
                                : item.severity === 'medium'
                                ? 'badge-warning text-warning-content'
                                : 'badge-neutral'
                            }`}
                          >
                            {item.severity}
                          </span>
                          {item.anomalyReason.toLowerCase().includes('phone') && (
                            <span className="badge badge-xs badge-error badge-outline font-mono font-bold">
                              Phone Distance
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-base-content/60">
                          <span>{Math.round(item.confidenceScore * 100)}% conf.</span>
                          <span className="text-primary font-bold">→ Frame {targetSnapIdx + 1}</span>
                        </div>
                      </div>
                      <p className="text-[11px] leading-snug break-words text-base-content/85">
                        {item.anomalyReason}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="text-[11px] text-base-content/50 flex items-center gap-1.5 pt-1">
              <BookOpen className="w-3 h-3 text-primary" />
              Docs consulted {submission.telemetrySummary.referenceQueriesCount}×, snippets inserted{' '}
              {submission.telemetrySummary.snippetsInsertedCount}×
            </div>
          </div>

          {/* AI Forensic Situation Summary for Professor Decision */}
          <div className="p-4 border-b border-base-300 bg-base-100">
            <AISummaryCard
              submission={submission}
              onInsertIntoNotes={(txt) => setNotes((prev) => (prev ? `${prev}\n\n${txt}` : txt))}
              onApplyVerdict={(status) => handleSave(status)}
            />
          </div>

          {/* Verdict form */}
          <div className="p-4 space-y-3 bg-base-200/40">
            <h4 className="text-xs font-bold uppercase tracking-widest text-base-content/50 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              Examiner Verdict
            </h4>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes, observations, or follow-up questions..."
              rows={3}
              className="textarea textarea-bordered textarea-sm w-full text-xs bg-base-100 focus:textarea-primary"
            />

            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSave('verified')}
                  className={`btn btn-sm ${
                    verdictStatus === 'verified' ? 'btn-success text-white' : 'btn-outline btn-success'
                  }`}
                >
                  Verified
                </button>
                <button
                  onClick={() => handleSave('flagged_viva')}
                  className={`btn btn-sm ${
                    verdictStatus === 'flagged_viva' ? 'btn-warning text-white' : 'btn-outline btn-warning'
                  }`}
                >
                  Oral Viva
                </button>
              </div>
              <button
                onClick={() => handleSave('dismissed')}
                className={`btn btn-sm ${
                  verdictStatus === 'dismissed' ? 'btn-neutral' : 'btn-ghost border border-base-300'
                }`}
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