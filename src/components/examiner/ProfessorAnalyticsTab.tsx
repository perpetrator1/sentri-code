import React, { useMemo, useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Users,
  CheckCircle2,
  Clock,
  Smartphone,
  Copy,
  TrendingUp,
  Brain,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Code2,
} from 'lucide-react';
import type { SubmissionPayload } from '../../types';
import { computeLocalForensicSummary, getCandidateAuthenticitySummary } from '../../services/aiSummaryService';

interface ProfessorAnalyticsTabProps {
  submissions: SubmissionPayload[];
  onSelectCandidate: (submission: SubmissionPayload) => void;
}

const AnalyticsCandidateSummary: React.FC<{ sub: SubmissionPayload }> = ({ sub }) => {
  const [summary, setSummary] = useState<string>(() => computeLocalForensicSummary(sub).summary);
  const [source, setSource] = useState<'gemini-api' | 'local-forensics'>('local-forensics');

  useEffect(() => {
    let active = true;
    getCandidateAuthenticitySummary(sub).then((res) => {
      if (active && res) {
        setSummary(res.summary);
        setSource(res.source);
      }
    });
    return () => {
      active = false;
    };
  }, [sub]);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="badge badge-xs badge-primary font-mono text-[9px] uppercase tracking-wider">
          {source === 'gemini-api' ? 'Gemini 3.5' : 'Forensic AI'}
        </span>
      </div>
      <p className="text-[11px] text-base-content/80 leading-relaxed italic border-l-2 border-warning pl-2 break-words">
        "{summary}"
      </p>
    </div>
  );
};

export const ProfessorAnalyticsTab: React.FC<ProfessorAnalyticsTabProps> = ({
  submissions,
  onSelectCandidate,
}) => {
  // Aggregate statistics across submissions
  const analytics = useMemo(() => {
    if (submissions.length === 0) {
      return null;
    }

    const total = submissions.length;
    let totalAuth = 0;
    let totalScore = 0;
    let totalDuration = 0;
    let totalKeystrokes = 0;
    let totalBackspaces = 0;
    let totalPauseRatio = 0;
    let totalFlight = 0;
    let totalBaseFlight = 0;

    let lowRiskCount = 0;
    let mediumRiskCount = 0;
    let highRiskCount = 0;

    let verifiedVerdicts = 0;
    let vivaVerdicts = 0;
    let pendingVerdicts = 0;

    // Anomaly counters
    let phoneAnomaliesTotal = 0;
    let metronomicAnomaliesTotal = 0;
    let pasteAnomaliesTotal = 0;
    let burstAnomaliesTotal = 0;

    // Problem stats map
    const problemMap: Record<
      string,
      { title: string; count: number; totalScore: number; totalAuth: number; vivaCount: number }
    > = {};

    submissions.forEach((sub) => {
      const auth = sub.telemetrySummary.averageIntegrityConfidence;
      totalAuth += auth;
      totalScore += sub.score;
      totalDuration += sub.durationSeconds || 1200;
      totalKeystrokes += sub.telemetrySummary.totalKeystrokes || 0;
      totalBackspaces += sub.telemetrySummary.backspaceCount || 0;
      totalPauseRatio += sub.telemetrySummary.cognitivePauseRatio || 0;
      totalFlight += sub.telemetrySummary.meanFlightTime || 0;
      totalBaseFlight += sub.baseline?.meanFlightTime || 170;

      if (auth >= 0.85) lowRiskCount++;
      else if (auth >= 0.6) mediumRiskCount++;
      else highRiskCount++;

      const verdict = sub.examinerVerdict?.status || 'pending';
      if (verdict === 'verified') verifiedVerdicts++;
      else if (verdict === 'flagged_viva') vivaVerdicts++;
      else pendingVerdicts++;

      // Count anomalies
      sub.anomalyTimeline.forEach((a) => {
        const text = a.anomalyReason.toLowerCase();
        if (text.includes('phone') || text.includes('glance')) phoneAnomaliesTotal++;
        else if (text.includes('metronomic') || text.includes('invariance')) metronomicAnomaliesTotal++;
        else if (text.includes('paste') || text.includes('clipboard')) pasteAnomaliesTotal++;
        else burstAnomaliesTotal++;
      });

      // Group by problem
      const pId = sub.problemId;
      if (!problemMap[pId]) {
        problemMap[pId] = {
          title: pId.replace(/-/g, ' '),
          count: 0,
          totalScore: 0,
          totalAuth: 0,
          vivaCount: 0,
        };
      }
      problemMap[pId].count++;
      problemMap[pId].totalScore += sub.score;
      problemMap[pId].totalAuth += auth;
      if (auth < 0.6 || verdict === 'flagged_viva') {
        problemMap[pId].vivaCount++;
      }
    });

    const avgAuth = Math.round((totalAuth / total) * 100);
    const avgScore = Math.round(totalScore / total);
    const avgDurationMins = Math.round(totalDuration / total / 60);
    const avgFlight = Math.round(totalFlight / total);
    const avgBaseFlight = Math.round(totalBaseFlight / total);
    const avgBackspaceRate = totalKeystrokes > 0 ? Math.round((totalBackspaces / totalKeystrokes) * 100) : 12;
    const avgPauseRatio = Math.round((totalPauseRatio / total) * 100);

    // Candidates requiring triage (high risk or pending viva)
    const triageCandidates = submissions
      .filter((s) => s.telemetrySummary.averageIntegrityConfidence < 0.65 || s.examinerVerdict?.status === 'flagged_viva')
      .slice(0, 5);

    return {
      total,
      avgAuth,
      avgScore,
      avgDurationMins,
      avgFlight,
      avgBaseFlight,
      avgBackspaceRate,
      avgPauseRatio,
      lowRiskCount,
      mediumRiskCount,
      highRiskCount,
      verifiedVerdicts,
      vivaVerdicts,
      pendingVerdicts,
      phoneAnomaliesTotal,
      metronomicAnomaliesTotal,
      pasteAnomaliesTotal,
      burstAnomaliesTotal,
      problemMap,
      triageCandidates,
    };
  }, [submissions]);

  if (!analytics) {
    return (
      <div className="p-12 text-center text-base-content/50">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="font-semibold text-xs">No analytics data available yet</p>
        <p className="text-[11px] text-base-content/40">Waiting for candidates to submit assessments...</p>
      </div>
    );
  }

  const {
    total,
    avgAuth,
    avgScore,
    avgDurationMins,
    avgFlight,
    avgBaseFlight,
    avgBackspaceRate,
    avgPauseRatio,
    lowRiskCount,
    mediumRiskCount,
    highRiskCount,
    verifiedVerdicts,
    vivaVerdicts,
    pendingVerdicts,
    phoneAnomaliesTotal,
    metronomicAnomaliesTotal,
    pasteAnomaliesTotal,
    burstAnomaliesTotal,
    problemMap,
    triageCandidates,
  } = analytics;

  const lowPct = Math.round((lowRiskCount / total) * 100);
  const medPct = Math.round((mediumRiskCount / total) * 100);
  const highPct = Math.round((highRiskCount / total) * 100);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── 1. Top Executive Stats Bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Cohort Authenticity */}
        <div className="card bg-base-200 border border-base-300 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-base-content/60 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Cohort Authenticity</span>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-base-content">{avgAuth}%</span>
            <span
              className={`badge badge-xs font-bold ${
                avgAuth >= 80 ? 'badge-success text-white' : avgAuth >= 65 ? 'badge-warning' : 'badge-error text-white'
              }`}
            >
              {avgAuth >= 80 ? 'Healthy' : avgAuth >= 65 ? 'Moderate' : 'High Risk'}
            </span>
          </div>
          <p className="text-[11px] text-base-content/50 mt-1">Biometric keystroke verification average</p>
        </div>

        {/* Viva / Audit Queue */}
        <div className="card bg-base-200 border border-base-300 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-base-content/60 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Oral Viva Queue</span>
            <AlertTriangle className="w-4 h-4 text-warning" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-warning">{highRiskCount + vivaVerdicts}</span>
            <span className="text-xs text-base-content/50">of {total} candidates</span>
          </div>
          <p className="text-[11px] text-base-content/50 mt-1">
            {highRiskCount} high risk flags · {vivaVerdicts} verified scheduled
          </p>
        </div>

        {/* Avg Assessment Score */}
        <div className="card bg-base-200 border border-base-300 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-base-content/60 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Cohort Test Score</span>
            <TrendingUp className="w-4 h-4 text-success" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-success">{avgScore}%</span>
            <span className="text-xs text-base-content/50">pass rate</span>
          </div>
          <p className="text-[11px] text-base-content/50 mt-1">Automated test case pass average</p>
        </div>

        {/* Avg Exam Time */}
        <div className="card bg-base-200 border border-base-300 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-base-content/60 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Avg Completion Time</span>
            <Clock className="w-4 h-4 text-secondary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-base-content">{avgDurationMins}m</span>
            <span className="text-xs text-base-content/50">per exam</span>
          </div>
          <p className="text-[11px] text-base-content/50 mt-1">Natural thinking and refactoring time</p>
        </div>
      </div>

      {/* ── 2. Authenticity Distribution & Risk Breakdown ── */}
      <div className="card bg-base-200/80 border border-base-300 p-5 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-extrabold text-sm text-base-content flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span>Authenticity Risk Spectrum</span>
            </h4>
            <p className="text-[11px] text-base-content/60">
              Proportion of candidates categorized by biometric flight consistency & cognitive pauses
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-success">
              <span className="w-2.5 h-2.5 rounded-full bg-success" />
              <span>{lowRiskCount} Verified ({lowPct}%)</span>
            </span>
            <span className="flex items-center gap-1.5 text-warning">
              <span className="w-2.5 h-2.5 rounded-full bg-warning" />
              <span>{mediumRiskCount} Moderate ({medPct}%)</span>
            </span>
            <span className="flex items-center gap-1.5 text-error">
              <span className="w-2.5 h-2.5 rounded-full bg-error" />
              <span>{highRiskCount} High Risk ({highPct}%)</span>
            </span>
          </div>
        </div>

        {/* Stacked Multi-Color Progress Bar */}
        <div className="w-full h-4 rounded-full overflow-hidden flex bg-base-300 p-0.5 shadow-inner">
          <div
            style={{ width: `${lowPct}%` }}
            className="h-full bg-success rounded-l-full transition-all duration-500"
            title={`Verified / Low Risk: ${lowRiskCount} (${lowPct}%)`}
          />
          <div
            style={{ width: `${medPct}%` }}
            className="h-full bg-warning transition-all duration-500"
            title={`Moderate Risk: ${mediumRiskCount} (${medPct}%)`}
          />
          <div
            style={{ width: `${highPct}%` }}
            className="h-full bg-error rounded-r-full transition-all duration-500"
            title={`High Risk / Oral Viva: ${highRiskCount} (${highPct}%)`}
          />
        </div>
      </div>

      {/* ── 3. Biometric Benchmarks & Flagged Anomaly Radar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Cohort Biometric Typing Rhythm */}
        <div className="card bg-base-200/80 border border-base-300 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-sm text-base-content flex items-center gap-2">
              <Brain className="w-4 h-4 text-secondary" />
              <span>Biometric Keystroke Dynamics</span>
            </h4>
            <span className="badge badge-xs badge-neutral text-[10px]">Cohort vs Baseline</span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Flight Latency Comparison */}
            <div className="space-y-1">
              <div className="flex justify-between text-base-content/70 text-[11px]">
                <span>Mean Flight Time (Digraph interval)</span>
                <span className="font-mono font-bold">
                  {avgFlight}ms <span className="text-base-content/40">(Base: {avgBaseFlight}ms)</span>
                </span>
              </div>
              <progress
                className="progress progress-primary w-full h-2"
                value={Math.min(100, (avgFlight / Math.max(1, avgBaseFlight)) * 100)}
                max="100"
              />
            </div>

            {/* Backspace Correction Rate */}
            <div className="space-y-1">
              <div className="flex justify-between text-base-content/70 text-[11px]">
                <span>Typo Refactoring & Backspace Frequency</span>
                <span className="font-mono font-bold">
                  {avgBackspaceRate}% <span className="text-base-content/40">(Normal: 10-18%)</span>
                </span>
              </div>
              <progress
                className={`progress w-full h-2 ${avgBackspaceRate >= 8 ? 'progress-success' : 'progress-error'}`}
                value={Math.min(100, (avgBackspaceRate / 18) * 100)}
                max="100"
              />
            </div>

            {/* Cognitive Pause Ratio */}
            <div className="space-y-1">
              <div className="flex justify-between text-base-content/70 text-[11px]">
                <span>Cognitive Contemplation Pauses (&gt;800ms)</span>
                <span className="font-mono font-bold">
                  {avgPauseRatio}% <span className="text-base-content/40">(Organic: 20-40%)</span>
                </span>
              </div>
              <progress
                className="progress progress-accent w-full h-2"
                value={Math.min(100, (avgPauseRatio / 40) * 100)}
                max="100"
              />
            </div>
          </div>
        </div>

        {/* Right: Flagged Anomaly Vectors Breakdown */}
        <div className="card bg-base-200/80 border border-base-300 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-sm text-base-content flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-error" />
              <span>Flagged Anomaly Vectors</span>
            </h4>
            <span className="badge badge-xs badge-error text-white font-mono text-[10px]">
              {phoneAnomaliesTotal + metronomicAnomaliesTotal + pasteAnomaliesTotal + burstAnomaliesTotal} Total Flags
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Phone Sight-Typing */}
            <div className="p-3 rounded-xl bg-base-100 border border-base-300 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-base-content/80 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-error" /> Phone Glances
                </span>
                <span className="font-mono font-extrabold text-error">{phoneAnomaliesTotal}</span>
              </div>
              <p className="text-[10px] text-base-content/50 leading-tight">
                Off-screen accommodation pauses (1.8s–7.5s)
              </p>
            </div>

            {/* Metronomic Cadence */}
            <div className="p-3 rounded-xl bg-base-100 border border-base-300 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-base-content/80 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-warning" /> Robotic Cadence
                </span>
                <span className="font-mono font-extrabold text-warning">{metronomicAnomaliesTotal}</span>
              </div>
              <p className="text-[10px] text-base-content/50 leading-tight">
                Unnatural flight variance invariance (&lt;400ms²)
              </p>
            </div>

            {/* Clipboard Dumps */}
            <div className="p-3 rounded-xl bg-base-100 border border-base-300 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-base-content/80 flex items-center gap-1">
                  <Copy className="w-3.5 h-3.5 text-secondary" /> Clipboard Pastes
                </span>
                <span className="font-mono font-extrabold text-secondary">{pasteAnomaliesTotal}</span>
              </div>
              <p className="text-[10px] text-base-content/50 leading-tight">
                Large chunk injections outside manual typing
              </p>
            </div>

            {/* Rapid Bursts */}
            <div className="p-3 rounded-xl bg-base-100 border border-base-300 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-base-content/80 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" /> Rapid Bursts
                </span>
                <span className="font-mono font-extrabold text-primary">{burstAnomaliesTotal}</span>
              </div>
              <p className="text-[10px] text-base-content/50 leading-tight">
                Typing velocity exceeding 450 chars/min
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Problem-by-Problem Integrity Matrix ── */}
      <div className="card bg-base-200/80 border border-base-300 p-5 rounded-2xl space-y-3">
        <h4 className="font-extrabold text-sm text-base-content flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" />
          <span>Problem Integrity & Difficulty Matrix</span>
        </h4>

        <div className="overflow-x-auto">
          <table className="table table-sm w-full bg-base-100 rounded-xl">
            <thead className="bg-base-200 text-xs text-base-content/70">
              <tr>
                <th>Problem</th>
                <th>Submissions</th>
                <th>Pass Score Avg</th>
                <th>Authenticity Avg</th>
                <th>Oral Viva Flags</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {Object.entries(problemMap).map(([pId, data]) => {
                const pScore = Math.round(data.totalScore / data.count);
                const pAuth = Math.round((data.totalAuth / data.count) * 100);

                return (
                  <tr key={pId} className="hover:bg-base-200/40">
                    <td className="font-bold capitalize text-base-content">{data.title}</td>
                    <td>{data.count}</td>
                    <td className="font-mono font-semibold">{pScore}%</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <progress
                          className={`progress w-14 ${
                            pAuth >= 80 ? 'progress-success' : pAuth >= 60 ? 'progress-warning' : 'progress-error'
                          }`}
                          value={pAuth}
                          max="100"
                        />
                        <span className="font-mono font-bold">{pAuth}%</span>
                      </div>
                    </td>
                    <td>
                      {data.vivaCount > 0 ? (
                        <span className="badge badge-xs badge-error text-white font-mono font-bold">
                          {data.vivaCount} flagged
                        </span>
                      ) : (
                        <span className="badge badge-xs badge-success text-white">0 flags</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge badge-xs ${
                          pAuth >= 80 ? 'badge-success badge-outline' : 'badge-warning badge-outline'
                        }`}
                      >
                        {pAuth >= 80 ? 'High Integrity' : 'Review Suggested'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 5. Immediate Action Triage Queue (With AI Summary Sentence) ── */}
      {triageCandidates.length > 0 && (
        <div className="card bg-base-200/80 border border-warning/30 p-5 rounded-2xl space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-warning/20 text-warning flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-base-content">
                  Priority Review Queue ({triageCandidates.length})
                </h4>
                <p className="text-[11px] text-base-content/60">
                  Submissions requiring immediate professor decision or Oral Viva scheduling
                </p>
              </div>
            </div>
            <span className="badge badge-xs badge-warning text-warning-content font-bold uppercase">
              Action Required
            </span>
          </div>

          <div className="space-y-2.5">
            {triageCandidates.map((sub) => {
              const authPct = Math.round(sub.telemetrySummary.averageIntegrityConfidence * 100);

              return (
                <div
                  key={sub.id}
                  className="p-3 rounded-xl bg-base-100 border border-base-300 hover:border-primary/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs overflow-hidden"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-base-content">{sub.candidateName}</span>
                      <span className="font-mono text-[10px] text-base-content/50">({sub.candidateId})</span>
                      <span className="badge badge-xs badge-neutral capitalize font-medium">
                        {sub.problemId.replace(/-/g, ' ')}
                      </span>
                      <span className="badge badge-xs badge-error text-white font-mono font-bold">
                        {authPct}% authentic
                      </span>
                      <span className="badge badge-xs badge-warning text-warning-content font-bold">
                        Score: {sub.score}%
                      </span>
                    </div>
                    {/* The 1-sentence Situation Summary (Gemini or Local) */}
                    <AnalyticsCandidateSummary sub={sub} />
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={() => onSelectCandidate(sub)}
                      className="btn btn-xs btn-primary gap-1 text-white shadow-xs font-semibold"
                    >
                      <span>Audit Candidate</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
