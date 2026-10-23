import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, WifiOff, Wifi, Copy, Hash, Check } from 'lucide-react';
import type { SubmissionPayload } from '../../types';

interface SubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: SubmissionPayload | null;
  isOfflineQueued: boolean;
}

export const SubmissionModal: React.FC<SubmissionModalProps> = ({
  isOpen,
  onClose,
  submission,
  isOfflineQueued,
}) => {
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Warm, celebratory confetti
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#e07b39', '#f59e0b', '#10b981', '#8b5cf6', '#f97316'],
        ticks: 200,
      });
    }
  }, [isOpen]);

  if (!isOpen || !submission) return null;

  const score = submission.score;
  const integrity = Math.round(submission.telemetrySummary.averageIntegrityConfidence * 100);

  const scoreEmoji = score === 100 ? '🎉' : score >= 80 ? '🙌' : score >= 60 ? '👍' : '💪';
  const scoreMsg =
    score === 100 ? "Perfect score — all test cases passed!" :
    score >= 80 ? "Great work — almost there!" :
    score >= 60 ? "Good effort, keep going!" :
    "You gave it a shot — that's what counts!";

  const handleCopyHash = () => {
    navigator.clipboard.writeText(submission.integrityHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md bg-base-100 shadow-2xl border border-base-300 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="card-body p-6 space-y-4">

          {/* Hero */}
          <div className="text-center space-y-2">
            <div className="text-5xl">{scoreEmoji}</div>
            <h2 className="text-xl font-black text-base-content">You're done!</h2>
            <p className="text-sm text-base-content/60">{scoreMsg}</p>
          </div>

          {/* Score + sync status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="stat bg-base-200 rounded-2xl p-3 text-center">
              <div className="stat-title text-xs">Score</div>
              <div className={`stat-value text-2xl ${score === 100 ? 'text-success' : 'text-warning'}`}>{score}%</div>
            </div>
            <div className="stat bg-base-200 rounded-2xl p-3 text-center">
              <div className="stat-title text-xs">Authenticity</div>
              <div className="stat-value text-2xl text-primary">{integrity}%</div>
            </div>
          </div>

          {/* Sync status */}
          {isOfflineQueued ? (
            <div className="alert alert-warning rounded-xl py-2.5 text-xs">
              <WifiOff className="w-4 h-4 shrink-0" />
              <div>
                <div className="font-bold">Saved locally — you're good!</div>
                <div className="opacity-80">Your exam is stored safely and will sync automatically when you're back online.</div>
              </div>
            </div>
          ) : (
            <div className="alert alert-success rounded-xl py-2.5 text-xs">
              <Wifi className="w-4 h-4 shrink-0" />
              <div>
                <div className="font-bold">Submitted & synced ✓</div>
                <div className="opacity-80">Your submission was received successfully.</div>
              </div>
            </div>
          )}

          {/* SHA-256 integrity seal — collapsible, low-key */}
          <details className="collapse collapse-arrow border border-base-300 rounded-xl bg-base-200/50">
            <summary className="collapse-title text-xs font-medium py-2.5 min-h-0">
              <div className="flex items-center gap-1.5 text-base-content/60">
                <Hash className="w-3.5 h-3.5" /> Integrity seal (SHA-256)
              </div>
            </summary>
            <div className="collapse-content pb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-base-content/40">Tamper-proof hash of your submission</span>
                <button onClick={handleCopyHash} className="btn btn-xs btn-ghost gap-1 text-[10px]">
                  {copiedHash ? <><Check className="w-3 h-3 text-success" />Copied!</> : <><Copy className="w-3 h-3" />Copy</>}
                </button>
              </div>
              <p className="font-mono text-[9px] text-base-content/50 break-all select-all bg-base-300 rounded-lg p-2">
                {submission.integrityHash}
              </p>
            </div>
          </details>

          {/* Actions */}
          <div className="flex items-center justify-end pt-1">
            <button
              onClick={onClose}
              className="btn btn-primary btn-sm px-6 font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
