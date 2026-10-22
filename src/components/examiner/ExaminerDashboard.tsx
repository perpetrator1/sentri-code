import React, { useState, useEffect, useRef } from 'react';
import { db, seedInitialMockDataIfEmpty } from '../../db';
import type { SubmissionPayload } from '../../types';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  ArrowRight,
  AlertTriangle,
  User,
  ArrowLeft,
} from 'lucide-react';
import { ForensicsWorkbench } from './ForensicsWorkbench';

interface ExaminerDashboardProps {
  onBackToAssessment: () => void;
  selectedSubmissionId?: string | null;
  user?: any;
  onLogout?: () => void;
}

export const ExaminerDashboard: React.FC<ExaminerDashboardProps> = ({
  onBackToAssessment,
  selectedSubmissionId = null,
  user,
  onLogout,
}) => {
  const [submissions, setSubmissions] = useState<SubmissionPayload[]>([]);
  const [activeCandidate, setActiveCandidate] = useState<SubmissionPayload | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [isLoading, setIsLoading] = useState(true);
  // prevent auto-navigate from running more than once per dashboard mount
  const hasAutoNavigatedRef = useRef(false);

  const loadSubmissions = async () => {
    setIsLoading(true);
    try {
      await seedInitialMockDataIfEmpty();
      let list = await db.submissions.toArray();

      if (navigator.onLine) {
        try {
          const res = await fetch('/api/examiner/submissions');
          if (res.ok) {
            const data = await res.json();
            if (data.submissions && data.submissions.length > 0) {
              for (const sub of data.submissions) {
                await db.submissions.put(sub);
              }
              list = await db.submissions.toArray();
            }
          }
        } catch (netErr) {
          console.warn('Could not load remote examiner submissions, using IndexedDB');
        }
      }

      setSubmissions(list);
      // Auto-navigate to a specific submission only once (e.g. right after submitting)
      if (selectedSubmissionId && !hasAutoNavigatedRef.current) {
        hasAutoNavigatedRef.current = true;
        const found = list.find((s) => s.id === selectedSubmissionId);
        if (found) setActiveCandidate(found);
      }
    } catch (e) {
      console.error('Failed to load submissions:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []); // only load once on mount

  const handleBack = async () => {
    setActiveCandidate(null);
    // Reload list so verdicts saved in workbench are reflected
    const list = await db.submissions.toArray();
    setSubmissions(list);
  };

  const getRiskLevel = (sub: SubmissionPayload): 'low' | 'medium' | 'high' => {
    const c = sub.telemetrySummary.averageIntegrityConfidence;
    if (c < 0.6) return 'high';
    if (c < 0.85) return 'medium';
    return 'low';
  };

  const filteredSubmissions = submissions.filter((sub) => {
    const risk = getRiskLevel(sub);
    const matchesFilter = riskFilter === 'all' || risk === riskFilter;
    const matchesQuery =
      sub.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.candidateId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.problemId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  if (activeCandidate) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <ForensicsWorkbench
          submission={activeCandidate}
          onBack={handleBack}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-base-100 overflow-hidden">
      {/* Navbar */}
      <div className="navbar bg-base-200 border-b border-base-300 px-4 min-h-14 shrink-0">
        <div className="navbar-start gap-3">
          <button
            onClick={onBackToAssessment}
            className="btn btn-sm btn-ghost gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs">Back to IDE</span>
          </button>
          <div className="divider divider-horizontal mx-0" />
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-secondary" />
            <span className="font-bold text-sm tracking-tight">
              Examiner Review Dashboard
            </span>
          </div>
        </div>
        <div className="navbar-end gap-2">
          <div className="badge badge-neutral text-xs">
            {submissions.length} submissions
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="btn btn-xs btn-outline btn-error gap-1 text-xs"
              title="Sign Out"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Stats Row */}
        <div className="stats stats-horizontal shadow border border-base-300 w-full bg-base-200">
          <div className="stat">
            <div className="stat-title text-xs">Total Candidates</div>
            <div className="stat-value text-2xl">{submissions.length}</div>
          </div>
          <div className="stat">
            <div className="stat-title text-xs text-success">Verified (Low Risk)</div>
            <div className="stat-value text-2xl text-success">
              {submissions.filter((s) => getRiskLevel(s) === 'low').length}
            </div>
          </div>
          <div className="stat">
            <div className="stat-title text-xs text-warning">Moderate</div>
            <div className="stat-value text-2xl text-warning">
              {submissions.filter((s) => getRiskLevel(s) === 'medium').length}
            </div>
          </div>
          <div className="stat">
            <div className="stat-title text-xs text-error">High Risk</div>
            <div className="stat-value text-2xl text-error">
              {submissions.filter((s) => getRiskLevel(s) === 'high').length}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <label className="input input-sm input-bordered flex items-center gap-2 w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-base-content/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate name or ID..."
              className="grow text-xs"
            />
          </label>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-base-content/40" />
            <div className="join">
              {(['all', 'low', 'medium', 'high'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRiskFilter(r)}
                  className={`join-item btn btn-xs capitalize ${
                    riskFilter === r ? 'btn-primary' : 'btn-ghost border border-base-300'
                  }`}
                >
                  {r === 'all' ? 'All' : `${r}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100 shadow-sm">
          {isLoading ? (
            <div className="p-12 text-center">
              <span className="loading loading-spinner loading-md text-primary" />
            </div>
          ) : (
            <table className="table table-sm w-full">
              <thead className="bg-base-200 text-xs text-base-content/70">
                <tr>
                  <th>Candidate</th>
                  <th>Problem</th>
                  <th>Score</th>
                  <th>Duration</th>
                  <th>Integrity</th>
                  <th>Risk</th>
                  <th>Verdict</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-base-content/50 text-sm">
                      No submissions found.
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((sub) => {
                    const risk = getRiskLevel(sub);
                    const pct = Math.round(sub.telemetrySummary.averageIntegrityConfidence * 100);
                    return (
                      <tr key={sub.id} className="hover:bg-base-200/50 transition-colors text-xs">
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="avatar placeholder">
                              <div className="bg-neutral text-neutral-content rounded-full w-7">
                                <span className="text-xs">{sub.candidateName[0]}</span>
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold">{sub.candidateName}</div>
                              <div className="font-mono text-[10px] text-base-content/50">{sub.candidateId}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="font-medium capitalize">{sub.problemId.replace(/-/g, ' ')}</div>
                          <div className="badge badge-xs badge-neutral uppercase font-mono">{sub.language}</div>
                        </td>
                        <td>
                          <span className={`badge badge-sm font-mono font-bold ${sub.score === 100 ? 'badge-success text-white' : 'badge-warning'}`}>
                            {sub.score}%
                          </span>
                        </td>
                        <td className="font-mono text-base-content/70">{formatDuration(sub.durationSeconds)}</td>
                        <td>
                          <div className="flex items-center gap-2 min-w-[80px]">
                            <progress
                              className={`progress w-16 ${risk === 'low' ? 'progress-success' : risk === 'medium' ? 'progress-warning' : 'progress-error'}`}
                              value={pct}
                              max="100"
                            />
                            <span className="font-mono font-bold text-[11px]">{pct}%</span>
                          </div>
                        </td>
                        <td>
                          <div className={`badge badge-sm font-semibold capitalize ${
                            risk === 'low' ? 'badge-success badge-outline' :
                            risk === 'medium' ? 'badge-warning badge-outline' :
                            'badge-error text-white'
                          }`}>
                            {risk}
                          </div>
                        </td>
                        <td>
                          <div className={`badge badge-xs font-mono uppercase ${
                            sub.examinerVerdict?.status === 'verified' ? 'badge-success' :
                            sub.examinerVerdict?.status === 'flagged_viva' ? 'badge-warning' :
                            'badge-ghost'
                          }`}>
                            {sub.examinerVerdict?.status || 'pending'}
                          </div>
                        </td>
                        <td>
                          <button
                            onClick={() => setActiveCandidate(sub)}
                            className="btn btn-xs btn-primary gap-1 text-white"
                          >
                            Audit <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
