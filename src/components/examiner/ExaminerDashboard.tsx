import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
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
  LogOut,
  RotateCw,
  Bell,
  Sparkles,
  X,
  Radio,
  FileText,
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newSubmissionBanner, setNewSubmissionBanner] = useState<SubmissionPayload | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(Date.now());

  // Prevent auto-navigate from running more than once per dashboard mount
  const hasAutoNavigatedRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());

  // Reactive Dexie Live Query: updates across tabs & IndexedDB changes in real-time
  const dexieSubmissions = useLiveQuery(
    () => db.submissions.orderBy('submittedAt').reverse().toArray(),
    []
  );

  useEffect(() => {
    if (dexieSubmissions !== undefined) {
      setSubmissions(dexieSubmissions);
      setIsLoading(false);
      // Track known IDs to detect new arrivals
      if (knownIdsRef.current.size === 0 && dexieSubmissions.length > 0) {
        dexieSubmissions.forEach((s) => knownIdsRef.current.add(s.id));
      }
    }
  }, [dexieSubmissions]);

  // Load and merge remote submissions from server
  const loadSubmissions = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      await seedInitialMockDataIfEmpty();
      let list = await db.submissions.orderBy('submittedAt').reverse().toArray();

      if (navigator.onLine) {
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('sentri_auth_token') : null;
          const res = await fetch('/api/examiner/submissions', {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) {
            const data = await res.json();
            if (data.submissions && data.submissions.length > 0) {
              for (const sub of data.submissions) {
                // If a new submission arrived while watching, flag it
                if (knownIdsRef.current.size > 0 && !knownIdsRef.current.has(sub.id)) {
                  setNewSubmissionBanner(sub);
                }
                knownIdsRef.current.add(sub.id);
                await db.submissions.put(sub);
              }
              list = await db.submissions.orderBy('submittedAt').reverse().toArray();
            }
          }
        } catch (netErr) {
          console.warn('Remote examiner submissions query offline, using local IndexedDB');
        }
      }

      setSubmissions(list);
      setLastRefreshedAt(Date.now());

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
      if (isManual) setIsRefreshing(false);
    }
  };

  // Initial load on mount
  useEffect(() => {
    loadSubmissions(false);
  }, []);

  // 1. Background Polling (Every 4 seconds for remote candidates)
  useEffect(() => {
    const timer = setInterval(() => {
      if (navigator.onLine && !document.hidden) {
        loadSubmissions(false);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // 2. Server-Sent Events (SSE) for instant push notifications from server
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('sentri_auth_token') || 'offline-examiner-token';
    const sseUrl = `/api/examiner/live-stream?token=${encodeURIComponent(token)}`;
    let es: EventSource | null = null;

    try {
      es = new EventSource(sseUrl);
      es.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NEW_SUBMISSION' && data.submission) {
            const sub = data.submission;
            knownIdsRef.current.add(sub.id);
            await db.submissions.put(sub);
            setNewSubmissionBanner(sub);
          }
        } catch (e) {
          console.warn('Error parsing live SSE event:', e);
        }
      };
    } catch (e) {
      console.warn('Failed to start SSE live stream:', e);
    }

    return () => {
      es?.close();
    };
  }, []);

  // 3. BroadcastChannel for instant local cross-tab / window sync
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const bc = new BroadcastChannel('sentri_live_submissions');
    bc.onmessage = async (e) => {
      if (e.data?.type === 'NEW_SUBMISSION' && e.data.submission) {
        const sub = e.data.submission;
        knownIdsRef.current.add(sub.id);
        await db.submissions.put(sub);
        setNewSubmissionBanner(sub);
      } else if (e.data?.type === 'SUBMISSIONS_SYNCED') {
        const list = await db.submissions.orderBy('submittedAt').reverse().toArray();
        setSubmissions(list);
      }
    };
    return () => {
      bc.close();
    };
  }, []);

  const handleBack = async () => {
    setActiveCandidate(null);
    const list = await db.submissions.orderBy('submittedAt').reverse().toArray();
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
          user={user}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-base-100 overflow-hidden">
      {/* ── Examiner Portal Header ── */}
      <header className="navbar bg-base-200 border-b border-base-300 px-4 min-h-14 shrink-0 select-none">
        <div className="navbar-start gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-secondary/15 flex items-center justify-center">
              <ShieldAlert className="w-4.5 h-4.5 text-secondary" strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight text-base-content">
                  Sentri Code
                </span>
                <span className="badge badge-secondary badge-xs font-semibold uppercase tracking-wider">
                  Examiner Portal
                </span>
              </div>
              <p className="text-[11px] text-base-content/50">Forensics & Live Submission Triage</p>
            </div>
          </div>
        </div>

        <div className="navbar-end gap-2.5">
          {/* Live Sync Active Pill */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/30 text-success text-[11px] font-semibold"
            title="Real-time submission listener active via SSE & local database sync"
          >
            <span className="w-2 h-2 rounded-full bg-success animate-ping" />
            <span>Live Sync</span>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={() => loadSubmissions(true)}
            disabled={isRefreshing}
            className="btn btn-xs btn-ghost gap-1.5 border border-base-300 text-xs hover:bg-base-300"
            title="Refresh submissions list immediately"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : 'text-base-content/60'}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          {/* Total Submissions Badge */}
          <div className="badge badge-neutral text-xs font-medium px-2.5 py-1">
            {submissions.length} submission{submissions.length === 1 ? '' : 's'}
          </div>

          {/* User Profile Info */}
          {user && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-base-100 border border-base-300/80">
              <div className="w-6 h-6 rounded-lg bg-secondary/15 text-secondary font-bold text-[11px] flex items-center justify-center">
                {user.name ? user.name.slice(0, 2).toUpperCase() : 'EX'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold leading-tight">{user.name}</div>
                <div className="text-[10px] text-base-content/50 leading-tight capitalize">{user.role}</div>
              </div>
            </div>
          )}

          {/* Candidate IDE Preview for Admins */}
          {user?.role === 'admin' && onBackToAssessment && (
            <button
              onClick={onBackToAssessment}
              className="btn btn-xs btn-ghost border border-base-300 text-xs gap-1"
              title="Preview candidate workspace (Admin only)"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Candidate IDE Preview</span>
            </button>
          )}

          {/* Sign Out Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="btn btn-xs btn-outline btn-error gap-1.5 text-xs font-medium ml-1"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Scrollable Dashboard Content ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* New Live Submission Alert Banner */}
        {newSubmissionBanner && (
          <div className="alert alert-info shadow-md border border-info/30 rounded-2xl flex items-center justify-between py-2.5 px-4 animate-slide-down">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-info/20 text-info flex items-center justify-center">
                <Bell className="w-4 h-4 animate-bounce" />
              </div>
              <div>
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <span>New Live Submission Received!</span>
                  <span className="badge badge-xs badge-primary">Just now</span>
                </div>
                <div className="text-[11px] opacity-90">
                  <strong>{newSubmissionBanner.candidateName}</strong> ({newSubmissionBanner.candidateId}) submitted{' '}
                  <span className="capitalize">{newSubmissionBanner.problemId.replace(/-/g, ' ')}</span> with{' '}
                  <strong>{newSubmissionBanner.score}% score</strong>.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setActiveCandidate(newSubmissionBanner);
                  setNewSubmissionBanner(null);
                }}
                className="btn btn-xs btn-primary gap-1 font-semibold text-white shadow-xs"
              >
                <span>Inspect Forensics</span>
                <ArrowRight className="w-3 h-3" />
              </button>
              <button
                onClick={() => setNewSubmissionBanner(null)}
                className="btn btn-xs btn-ghost btn-circle text-base-content/60 hover:text-base-content"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

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

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <label className="input input-sm input-bordered flex items-center gap-2 w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-base-content/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate name, ID, or problem..."
              className="grow text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-base-content/40 hover:text-base-content text-xs font-bold"
              >
                ×
              </button>
            )}
          </label>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-base-content/40" />
            <div className="join border border-base-300 rounded-xl overflow-hidden">
              {(['all', 'low', 'medium', 'high'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRiskFilter(r)}
                  className={`join-item btn btn-xs capitalize ${
                    riskFilter === r ? 'btn-primary shadow-xs' : 'btn-ghost text-base-content/70'
                  }`}
                >
                  {r === 'all' ? 'All Risks' : `${r}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Submissions Table */}
        <div className="overflow-x-auto rounded-2xl border border-base-300 bg-base-100 shadow-sm">
          {isLoading ? (
            <div className="p-14 text-center space-y-3">
              <span className="loading loading-spinner loading-md text-primary" />
              <p className="text-xs text-base-content/50">Listening for submissions...</p>
            </div>
          ) : (
            <table className="table table-sm w-full">
              <thead className="bg-base-200 text-xs text-base-content/70">
                <tr>
                  <th>Candidate</th>
                  <th>Problem</th>
                  <th>Score</th>
                  <th>Submitted</th>
                  <th>Integrity</th>
                  <th>Risk Level</th>
                  <th>Verdict</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-base-content/50 text-sm">
                      <div className="space-y-1">
                        <FileText className="w-8 h-8 text-base-content/30 mx-auto mb-1" />
                        <p className="font-semibold text-xs">No submissions found</p>
                        <p className="text-[11px] text-base-content/40">
                          {searchQuery || riskFilter !== 'all'
                            ? 'Try clearing search or risk filters.'
                            : 'Waiting for candidates to submit their exams...'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((sub) => {
                    const risk = getRiskLevel(sub);
                    const pct = Math.round(sub.telemetrySummary.averageIntegrityConfidence * 100);
                    const submittedTimeStr = new Date(sub.submittedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <tr key={sub.id} className="hover:bg-base-200/50 transition-colors text-xs">
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="avatar placeholder">
                              <div className="bg-neutral text-neutral-content rounded-full w-7 h-7 text-xs font-bold">
                                <span>{sub.candidateName[0]}</span>
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-base-content">{sub.candidateName}</div>
                              <div className="font-mono text-[10px] text-base-content/50">{sub.candidateId}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="font-medium capitalize text-base-content">
                            {sub.problemId.replace(/-/g, ' ')}
                          </div>
                          <span className="badge badge-xs badge-neutral uppercase font-mono text-[9px]">
                            {sub.language}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge badge-sm font-mono font-bold ${
                              sub.score === 100 ? 'badge-success text-white' : 'badge-warning'
                            }`}
                          >
                            {sub.score}%
                          </span>
                        </td>
                        <td className="font-mono text-base-content/70">
                          <div>{submittedTimeStr}</div>
                          <div className="text-[10px] text-base-content/40">{formatDuration(sub.durationSeconds)}</div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2 min-w-[90px]">
                            <progress
                              className={`progress w-16 ${
                                risk === 'low'
                                  ? 'progress-success'
                                  : risk === 'medium'
                                  ? 'progress-warning'
                                  : 'progress-error'
                              }`}
                              value={pct}
                              max="100"
                            />
                            <span className="font-mono font-bold text-[11px]">{pct}%</span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge badge-sm font-semibold capitalize ${
                              risk === 'low'
                                ? 'badge-success badge-outline'
                                : risk === 'medium'
                                ? 'badge-warning badge-outline'
                                : 'badge-error text-white'
                            }`}
                          >
                            {risk}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge badge-xs font-mono uppercase font-bold ${
                              sub.examinerVerdict?.status === 'verified'
                                ? 'badge-success'
                                : sub.examinerVerdict?.status === 'flagged_viva'
                                ? 'badge-warning'
                                : 'badge-ghost border border-base-300'
                            }`}
                          >
                            {sub.examinerVerdict?.status || 'pending'}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => setActiveCandidate(sub)}
                            className="btn btn-xs btn-primary gap-1 text-white shadow-xs"
                          >
                            <span>Audit</span>
                            <ArrowRight className="w-3 h-3" />
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
