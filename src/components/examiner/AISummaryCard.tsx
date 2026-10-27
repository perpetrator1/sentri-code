import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  Copy,
  Check,
  FileText,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import type { SubmissionPayload } from '../../types';
import {
  getCandidateAuthenticitySummary,
  getAISummarySettings,
  type AISummaryResult,
} from '../../services/aiSummaryService';

interface AISummaryCardProps {
  submission: SubmissionPayload;
  onInsertIntoNotes?: (summaryText: string) => void;
  onApplyVerdict?: (status: 'verified' | 'flagged_viva' | 'dismissed') => void;
  onViewWorkbench?: () => void;
  compact?: boolean;
}

export const AISummaryCard: React.FC<AISummaryCardProps> = ({
  submission,
  onInsertIntoNotes,
  onApplyVerdict,
  onViewWorkbench,
  compact = false,
}) => {
  const [summaryData, setSummaryData] = useState<AISummaryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const settings = getAISummarySettings();

  const loadSummary = async (force = false) => {
    if (!settings.enabled) return;
    setIsLoading(true);
    try {
      const res = await getCandidateAuthenticitySummary(submission, force);
      setSummaryData(res);
    } catch (e) {
      console.warn('Failed to load AI authenticity summary:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSummary(false);
  }, [submission.id, settings.enabled, settings.provider]);

  if (!settings.enabled || (!isLoading && !summaryData)) {
    return null;
  }

  const handleCopy = () => {
    if (!summaryData) return;
    navigator.clipboard.writeText(summaryData.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isVerified = summaryData?.recommendation === 'verified';
  const isFlagged = summaryData?.recommendation === 'flagged_viva';

  if (compact) {
    return (
      <div className="p-2.5 rounded-xl bg-base-200/70 border border-base-300 text-xs space-y-1.5 animate-fade-in max-w-full overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-bold text-[11px] text-base-content/80 truncate">Forensic Assessment</span>
          </div>
          {summaryData && (
            <span
              className={`badge badge-xs font-mono font-bold shrink-0 ${
                isVerified
                  ? 'badge-success text-white'
                  : isFlagged
                  ? 'badge-warning text-warning-content'
                  : 'badge-neutral'
              }`}
            >
              {isVerified ? 'Verified' : isFlagged ? 'Oral Viva' : 'Review'}
            </span>
          )}
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 py-1 text-base-content/50 text-[11px]">
            <span className="loading loading-spinner loading-xs text-primary" />
            <span>Analyzing biometrics...</span>
          </div>
        ) : (
          <p className="text-[11px] text-base-content/80 leading-relaxed italic break-words">
            "{summaryData?.summary}"
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/8 via-base-100 to-secondary/8 border border-primary/25 shadow-xs space-y-2.5 animate-fade-in max-w-full overflow-hidden">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-xs text-base-content whitespace-nowrap">
                Authenticity Assessment
              </span>
              <span className="badge badge-xs badge-primary font-mono text-[9px] uppercase tracking-wider shrink-0">
                {summaryData?.source === 'gemini-api' ? 'Gemini 3.5' : 'Forensic AI'}
              </span>
            </div>
            <p className="text-[10px] text-base-content/50 truncate">
              Decision support synthesis for professors
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Refresh Button */}
          <button
            onClick={() => loadSummary(true)}
            disabled={isLoading}
            className="btn btn-ghost btn-xs btn-circle text-base-content/50 hover:text-base-content h-6 w-6 min-h-0"
            title="Regenerate summary with latest data"
          >
            <RotateCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-primary' : ''}`} />
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            disabled={!summaryData}
            className="btn btn-ghost btn-xs btn-circle text-base-content/50 hover:text-base-content h-6 w-6 min-h-0"
            title="Copy summary sentence"
          >
            {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Main Sentence Content Box */}
      <div className="p-2.5 rounded-xl bg-base-100/90 border border-base-300/80 shadow-2xs space-y-2 max-w-full overflow-hidden">
        {isLoading ? (
          <div className="flex items-center gap-2 py-2 text-base-content/60 text-xs">
            <span className="loading loading-spinner loading-xs text-primary shrink-0" />
            <span className="text-[11px]">Evaluating flight variance, cadence entropy & glance latencies...</span>
          </div>
        ) : summaryData ? (
          <div className="space-y-2.5">
            <blockquote className="text-xs text-base-content/90 font-medium leading-relaxed italic border-l-2 border-primary/60 pl-2 break-words">
              "{summaryData.summary}"
            </blockquote>

            {/* Recommendation Badges & Quick Actions */}
            <div className="space-y-2 pt-1 border-t border-base-300/60">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span className="text-[10px] text-base-content/60 font-semibold uppercase tracking-wider">
                    Verdict:
                  </span>
                  <span
                    className={`badge badge-sm font-bold font-mono shrink-0 ${
                      isVerified
                        ? 'badge-success text-white'
                        : isFlagged
                        ? 'badge-warning text-warning-content'
                        : 'badge-neutral'
                    }`}
                  >
                    {isVerified ? 'Verified' : isFlagged ? 'Oral Viva' : 'Dismiss'}
                  </span>
                  <span className="badge badge-xs badge-ghost border border-base-300 font-mono text-[9px] shrink-0">
                    {summaryData.confidence} conf.
                  </span>
                </div>

                {/* Apply Verdict Quick Button */}
                {onApplyVerdict && (
                  <div className="shrink-0">
                    {isVerified ? (
                      <button
                        onClick={() => onApplyVerdict('verified')}
                        className="btn btn-2xs btn-success text-white gap-1 shadow-2xs font-semibold"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        <span>Accept</span>
                      </button>
                    ) : isFlagged ? (
                      <button
                        onClick={() => onApplyVerdict('flagged_viva')}
                        className="btn btn-2xs btn-warning text-warning-content gap-1 shadow-2xs font-semibold"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Flag Viva</span>
                      </button>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Action Buttons: Insert into Notes / Replay Biometrics */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {onInsertIntoNotes && (
                  <button
                    type="button"
                    onClick={() => onInsertIntoNotes(summaryData.summary)}
                    className="btn btn-xs btn-outline btn-primary flex-1 min-w-[140px] gap-1.5 text-[11px] font-semibold hover:text-white"
                    title="Insert this summary into professor's grading notes"
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Insert into Notes</span>
                  </button>
                )}

                {onViewWorkbench && (
                  <button
                    type="button"
                    onClick={onViewWorkbench}
                    className="btn btn-xs btn-primary text-white gap-1 text-[11px] font-semibold shadow-xs shrink-0"
                    title="Open Forensics Workbench to replay candidate keystrokes"
                  >
                    <span>Replay Biometrics</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Supporting Key Factors Accordion */}
      {summaryData && summaryData.keyFactors && summaryData.keyFactors.length > 0 && (
        <div className="pt-0.5">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-wider text-base-content/60 hover:text-base-content transition-colors py-0.5"
          >
            <span className="truncate">Biometric Factors ({summaryData.keyFactors.length})</span>
            {isExpanded ? <ChevronUp className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
          </button>

          {isExpanded && (
            <ul className="mt-1.5 space-y-1 text-[10px] text-base-content/75 pl-2 list-disc list-inside animate-fade-in break-words">
              {summaryData.keyFactors.map((factor, i) => (
                <li key={i} className="leading-snug">
                  {factor}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
