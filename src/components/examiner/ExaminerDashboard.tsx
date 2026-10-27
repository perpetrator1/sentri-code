import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  FileText,
  BarChart3,
  SlidersHorizontal,
  Settings,
  ChevronDown,
  ChevronUp,
  Cpu,
  Globe,
  CheckCircle2,
} from 'lucide-react';
import { ForensicsWorkbench } from './ForensicsWorkbench';
import { ProfessorAnalyticsTab } from './ProfessorAnalyticsTab';
import { AISettingsModal } from './AISettingsModal';
import { AISummaryCard } from './AISummaryCard';
import {
  getAISummarySettings,
  saveAISummarySettings,
  syncServerAIStatus,
  type AISummarySettings,
} from '../../services/aiSummaryService';

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
  const [viewMode, setViewMode] = useState<'triage' | 'analytics'>('triage');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [problemFilter, setProblemFilter] = useState<string>('all');
  const [verdictFilter, setVerdictFilter] = useState<'all' | 'verified' | 'flagged_viva' | 'pending' | 'dismissed'>('all');
  const [sortBy, setSortBy] = useState<'auth_asc' | 'auth_desc' | 'score_desc' | 'date_desc' | 'duration_desc'>('auth_asc');

  // AI Summary Settings
  const [aiSettings, setAiSettings] = useState<AISummarySettings>(getAISummarySettings());
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [expandedSummaryIds, setExpandedSummaryIds] = useState<Set<string>>(new Set());

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
    syncServerAIStatus().then((status) => {
      if (status.hasServerKey) {
        setAiSettings(getAISummarySettings());
      }
    });
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

  const toggleSummaryExpand = (id: string) => {
    setExpandedSummaryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSummaries = () => {
    if (expandedSummaryIds.size === submissions.length) {
      setExpandedSummaryIds(new Set());
    } else {
      setExpandedSummaryIds(new Set(submissions.map((s) => s.id)));
    }
  };

  // Filtered & Sorted submissions
  const filteredSubmissions = useMemo(() => {
    return submissions
      .filter((sub) => {
        const risk = getRiskLevel(sub);
        const matchesRisk = riskFilter === 'all' || risk === riskFilter;
        const matchesProblem = problemFilter === 'all' || sub.problemId === problemFilter;
        const subVerdict = sub.examinerVerdict?.status || 'pending';
        const matchesVerdict = verdictFilter === 'all' || subVerdict === verdictFilter;
        const matchesQuery =
          sub.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sub.candidateId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sub.problemId.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesRisk && matchesProblem && matchesVerdict && matchesQuery;
      })
      .sort((a, b) => {
        if (sortBy === 'auth_asc') {
          return a.telemetrySummary.averageIntegrityConfidence - b.telemetrySummary.averageIntegrityConfidence;
        }
        if (sortBy === 'auth_desc') {
          return b.telemetrySummary.averageIntegrityConfidence - a.telemetrySummary.averageIntegrityConfidence;
        }
        if (sortBy === 'score_desc') {
          return b.score - a.score;
        }
        if (sortBy === 'duration_desc') {
          return (b.durationSeconds || 0) - (a.durationSeconds || 0);
        }
        // date_desc default
        return b.submittedAt - a.submittedAt;
      });
  }, [submissions, riskFilter, problemFilter, verdictFilter, searchQuery, sortBy]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  // Quick toggle for AI feature
  const handleQuickToggleAI = () => {
    const updated = saveAISummarySettings({ enabled: !aiSettings.enabled });
    setAiSettings(updated);
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

        <div className="navbar-end gap-2 flex-wrap">
          {/* Live Sync Active Pill */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/30 text-success text-[11px] font-semibold"
            title="Real-time submission listener active via SSE & local database sync"
          >
            <span className="w-2 h-2 rounded-full bg-success animate-ping" />
            <span className="hidden sm:inline">Live Sync</span>
          </div>

          {/* AI Situation Summary Feature Toggle & Settings Pill (Optional Feature) */}
          <div className="join border border-base-300 rounded-xl overflow-hidden shadow-2xs">
            <button
              onClick={handleQuickToggleAI}
              className={`join-item btn btn-xs gap-1.5 px-2.5 font-bold transition-all ${
                aiSettings.enabled
                  ? 'btn-primary text-white'
                  : 'btn-ghost text-base-content/50 hover:text-base-content'
              }`}
              title={aiSettings.enabled ? 'Click to disable AI Authenticity Summaries' : 'Click to enable AI Authenticity Summaries'}
            >
              <Sparkles className="w-3 h-3" />
              <span>AI Summary: {aiSettings.enabled ? 'ON' : 'OFF'}</span>
            </button>
            <button
              onClick={() => setIsAISettingsOpen(true)}
              className="join-item btn btn-xs btn-ghost px-2 border-l border-base-300 hover:bg-base-300"
              title="Configure LLM API & forensic summary engine"
            >
              <Settings className="w-3 h-3 text-base-content/70" />
            </button>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={() => loadSubmissions(true)}
            disabled={isRefreshing}
            className="btn btn-xs btn-ghost gap-1.5 border border-base-300 text-xs hover:bg-base-300"
            title="Refresh submissions list immediately"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : 'text-base-content/60'}`} />
            <span className="hidden md:inline">{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          {/* User Profile Info */}
          {user && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-base-100 border border-base-300/80">
              <div className="w-6 h-6 rounded-lg bg-secondary/15 text-secondary font-bold text-[11px] flex items-center justify-center">
                {user.name ? user.name.slice(0, 2).toUpperCase() : 'EX'}
              </div>
              <div className="hidden lg:block text-left">
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
              <span className="hidden sm:inline">IDE Preview</span>
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
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>
      </header>

      {/* ── View Mode Navigation Tabs ── */}
      <div className="px-6 pt-4 pb-0 bg-base-100 border-b border-base-300 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="tabs tabs-boxed bg-base-200/80 p-1 border border-base-300 rounded-xl inline-flex">
            <button
              onClick={() => setViewMode('triage')}
              className={`tab tab-sm gap-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'triage'
                  ? 'tab-active bg-primary text-white shadow-xs'
                  : 'text-base-content/70 hover:text-base-content'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Submissions Triage</span>
              <span className="badge badge-xs badge-neutral ml-1">{submissions.length}</span>
            </button>

            <button
              onClick={() => setViewMode('analytics')}
              className={`tab tab-sm gap-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'analytics'
                  ? 'tab-active bg-primary text-white shadow-xs'
                  : 'text-base-content/70 hover:text-base-content'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Cohort Analytics & Forensics</span>
              {highRiskCountCandidate(submissions) > 0 && (
                <span className="badge badge-xs badge-error text-white ml-1 font-bold">
                  {highRiskCountCandidate(submissions)} Flagged
                </span>
              )}
            </button>
          </div>

          {/* AI Status Badge */}
          {aiSettings.enabled && (
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-base-content/60 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>
                Situation summaries active via{' '}
                <strong className={aiSettings.provider === 'gemini' ? 'text-secondary font-bold' : 'text-base-content font-bold'}>
                  {aiSettings.provider === 'gemini' ? `Google Gemini (${aiSettings.model || 'gemini-3.5-flash'})` : 'Local Forensics Engine'}
                </strong>
              </span>
              {aiSettings.provider === 'gemini' && (
                <span className="badge badge-xs badge-success text-white py-0 h-3.5 font-mono">Cloud Active</span>
              )}
            </div>
          )}
        </div>
      </div>

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

        {/* ── MODE 1: COHORT ANALYTICS & INSIGHTS ── */}
        {viewMode === 'analytics' && (
          <ProfessorAnalyticsTab
            submissions={submissions}
            onSelectCandidate={(sub) => setActiveCandidate(sub)}
          />
        )}

        {/* ── MODE 2: SUBMISSIONS TRIAGE TABLE ── */}
        {viewMode === 'triage' && (
          <div className="space-y-4">
            {/* Stats Row with Quick Filter Clicking */}
            <div className="stats stats-horizontal shadow border border-base-300 w-full bg-base-200">
              <div
                onClick={() => setRiskFilter('all')}
                className={`stat cursor-pointer hover:bg-base-300/60 transition-colors ${
                  riskFilter === 'all' ? 'bg-base-300/40 ring-1 ring-primary/40' : ''
                }`}
              >
                <div className="stat-title text-xs">Total Candidates</div>
                <div className="stat-value text-2xl">{submissions.length}</div>
                <div className="stat-desc text-[10px]">All submitted sessions</div>
              </div>

              <div
                onClick={() => setRiskFilter('low')}
                className={`stat cursor-pointer hover:bg-base-300/60 transition-colors ${
                  riskFilter === 'low' ? 'bg-base-300/40 ring-1 ring-success/40' : ''
                }`}
              >
                <div className="stat-title text-xs text-success">Verified (Low Risk)</div>
                <div className="stat-value text-2xl text-success">
                  {submissions.filter((s) => getRiskLevel(s) === 'low').length}
                </div>
                <div className="stat-desc text-[10px]">Natural cognitive cadence</div>
              </div>

              <div
                onClick={() => setRiskFilter('medium')}
                className={`stat cursor-pointer hover:bg-base-300/60 transition-colors ${
                  riskFilter === 'medium' ? 'bg-base-300/40 ring-1 ring-warning/40' : ''
                }`}
              >
                <div className="stat-title text-xs text-warning">Moderate Risk</div>
                <div className="stat-value text-2xl text-warning">
                  {submissions.filter((s) => getRiskLevel(s) === 'medium').length}
                </div>
                <div className="stat-desc text-[10px]">Needs visual confirmation</div>
              </div>

              <div
                onClick={() => setRiskFilter('high')}
                className={`stat cursor-pointer hover:bg-base-300/60 transition-colors ${
                  riskFilter === 'high' ? 'bg-base-300/40 ring-1 ring-error/40' : ''
                }`}
              >
                <div className="stat-title text-xs text-error">High Risk / Oral Viva</div>
                <div className="stat-value text-2xl text-error">
                  {submissions.filter((s) => getRiskLevel(s) === 'high').length}
                </div>
                <div className="stat-desc text-[10px]">Flagged transcription & phone glances</div>
              </div>
            </div>

            {/* Filters, Problem Selector, Sorting & Search Toolbar */}
            <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between bg-base-200/60 p-3 rounded-2xl border border-base-300">
              {/* Search input */}
              <label className="input input-sm input-bordered flex items-center gap-2 w-full lg:w-72 bg-base-100">
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

              {/* Filters & Sorting Controls */}
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                {/* Risk filter buttons */}
                <div className="join border border-base-300 rounded-xl overflow-hidden bg-base-100">
                  {(['all', 'low', 'medium', 'high'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRiskFilter(r)}
                      className={`join-item btn btn-xs capitalize ${
                        riskFilter === r ? 'btn-primary shadow-xs font-bold' : 'btn-ghost text-base-content/70'
                      }`}
                    >
                      {r === 'all' ? 'All Risks' : `${r}`}
                    </button>
                  ))}
                </div>

                {/* Problem selector */}
                <select
                  value={problemFilter}
                  onChange={(e) => setProblemFilter(e.target.value)}
                  className="select select-bordered select-xs text-[11px] bg-base-100"
                >
                  <option value="all">All Problems</option>
                  <option value="two-sum">Two Sum</option>
                  <option value="valid-anagram">Valid Anagram</option>
                  <option value="merge-intervals">Merge Intervals</option>
                </select>

                {/* Verdict filter */}
                <select
                  value={verdictFilter}
                  onChange={(e) => setVerdictFilter(e.target.value as any)}
                  className="select select-bordered select-xs text-[11px] bg-base-100"
                >
                  <option value="all">All Verdicts</option>
                  <option value="verified">Verified</option>
                  <option value="flagged_viva">Oral Viva</option>
                  <option value="pending">Pending</option>
                  <option value="dismissed">Dismissed</option>
                </select>

                {/* Sort By selector */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="select select-bordered select-xs text-[11px] bg-base-100 font-semibold"
                >
                  <option value="auth_asc">Sort: Lowest Authenticity (Triage first)</option>
                  <option value="auth_desc">Sort: Highest Authenticity</option>
                  <option value="score_desc">Sort: Highest Score</option>
                  <option value="date_desc">Sort: Newest Submissions</option>
                  <option value="duration_desc">Sort: Longest Duration</option>
                </select>

                {/* Toggle All Summaries expansion if AI summary is enabled */}
                {aiSettings.enabled && (
                  <button
                    onClick={toggleAllSummaries}
                    className="btn btn-xs btn-ghost border border-base-300 text-[11px] gap-1"
                    title="Expand or collapse all candidate situation summaries"
                  >
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span>
                      {expandedSummaryIds.size === submissions.length ? 'Collapse AI Summaries' : 'Expand All Summaries'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Submissions Table with Single-Sentence AI Authenticity Summaries */}
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
                            <p className="font-semibold text-xs">No submissions matching criteria</p>
                            <p className="text-[11px] text-base-content/40">
                              Try clearing filters or search query.
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
                        const isExpanded = expandedSummaryIds.has(sub.id);

                        return (
                          <React.Fragment key={sub.id}>
                            <tr className="hover:bg-base-200/50 transition-colors text-xs border-b border-base-200">
                              <td className="min-w-[170px]">
                                <div className="flex items-center gap-2.5">
                                  <div className="avatar placeholder">
                                    <div className="bg-neutral text-neutral-content rounded-full w-7 h-7 text-xs font-bold">
                                      <span>{sub.candidateName[0]}</span>
                                    </div>
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-base-content truncate">{sub.candidateName}</div>
                                    <div className="font-mono text-[10px] text-base-content/50 truncate">{sub.candidateId}</div>
                                  </div>
                                </div>
                              </td>

                              <td className="whitespace-nowrap">
                                <div className="font-medium capitalize text-base-content">
                                  {sub.problemId.replace(/-/g, ' ')}
                                </div>
                                <span className="badge badge-xs badge-neutral uppercase font-mono text-[9px]">
                                  {sub.language}
                                </span>
                              </td>

                              <td className="whitespace-nowrap">
                                <span
                                  className={`badge badge-sm font-mono font-bold ${
                                    sub.score === 100 ? 'badge-success text-white' : 'badge-warning'
                                  }`}
                                >
                                  {sub.score}%
                                </span>
                              </td>

                              <td className="font-mono text-base-content/70 whitespace-nowrap">
                                <div>{submittedTimeStr}</div>
                                <div className="text-[10px] text-base-content/40">{formatDuration(sub.durationSeconds)}</div>
                              </td>

                              <td className="whitespace-nowrap">
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

                              <td className="whitespace-nowrap">
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

                              <td className="whitespace-nowrap">
                                <span
                                  className={`badge badge-xs font-mono uppercase font-bold ${
                                    sub.examinerVerdict?.status === 'verified'
                                      ? 'badge-success'
                                      : sub.examinerVerdict?.status === 'flagged_viva'
                                      ? 'badge-warning text-warning-content'
                                      : 'badge-ghost border border-base-300'
                                  }`}
                                >
                                  {sub.examinerVerdict?.status || 'pending'}
                                </span>
                              </td>

                              <td className="text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {aiSettings.enabled && (
                                    <button
                                      onClick={() => toggleSummaryExpand(sub.id)}
                                      className={`btn btn-xs gap-1 border border-base-300 font-medium ${
                                        isExpanded ? 'btn-primary text-white shadow-xs' : 'btn-ghost text-base-content/70 hover:bg-base-200'
                                      }`}
                                      title={isExpanded ? 'Hide authenticity summary' : 'View candidate situation summary'}
                                    >
                                      <Sparkles className="w-3 h-3 text-current" />
                                      <span className="hidden sm:inline">{isExpanded ? 'Hide' : 'Summary'}</span>
                                    </button>
                                  )}

                                  <button
                                    onClick={() => setActiveCandidate(sub)}
                                    className="btn btn-xs btn-primary gap-1 text-white shadow-xs font-semibold"
                                  >
                                    <span>Audit</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Full-width Collapsible Situation Summary Accordion Row */}
                            {isExpanded && aiSettings.enabled && (
                              <tr className="bg-primary/5 border-b border-base-300/80 animate-fade-in">
                                <td colSpan={8} className="p-3 pl-8 pr-6">
                                  <AISummaryCard
                                    submission={sub}
                                    onViewWorkbench={() => setActiveCandidate(sub)}
                                  />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── AI Summary Settings Modal ── */}
      <AISettingsModal
        isOpen={isAISettingsOpen}
        onClose={() => setIsAISettingsOpen(false)}
        onSettingsSaved={(newSettings) => setAiSettings(newSettings)}
      />
    </div>
  );
};

function highRiskCountCandidate(subs: SubmissionPayload[]): number {
  return subs.filter(
    (s) => s.telemetrySummary.averageIntegrityConfidence < 0.6 || s.examinerVerdict?.status === 'flagged_viva'
  ).length;
}
