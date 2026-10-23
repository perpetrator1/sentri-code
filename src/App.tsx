import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PROBLEMS } from './data/problems';
import { db, seedInitialMockDataIfEmpty } from './db';
import { useKeystrokeInference } from './telemetry/useKeystrokeInference';
import { executeCode } from './sandbox/sandboxRunner';
import { computeSHA256 } from './utils/crypto';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthView } from './components/auth/AuthView';
import { SyncToastContainer } from './components/common/SyncToastContainer';
import { syncManager } from './services/syncManager';
import type {
  Problem,
  TestResult,
  SubmissionPayload,
} from './types';

// Candidate UI Components
import { TopBar } from './components/candidate/TopBar';
import { Workspace } from './components/candidate/Workspace';
import { BottomPanel } from './components/candidate/BottomPanel';
import { QuickReferenceModal } from './components/candidate/QuickReferenceModal';
import { BaselineCalibrationModal } from './components/candidate/BaselineCalibrationModal';
import { SubmissionModal } from './components/candidate/SubmissionModal';

// Examiner Review Dashboard
import { ExaminerDashboard } from './components/examiner/ExaminerDashboard';

const MainApp: React.FC = () => {
  const { user, logout, isAuthenticated, isLoading } = useAuth();

  // Navigation Mode: Candidate Assessment vs Examiner Forensics
  const [currentMode, setCurrentMode] = useState<'candidate' | 'examiner'>('candidate');
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);

  // Active Problem & Candidate
  const [activeProblem, setActiveProblem] = useState<Problem>(PROBLEMS[0]);
  const candidateId = user?.id || 'cand-user-77';
  const candidateName = user?.name || 'Candidate (You)';
  const [language, setLanguage] = useState<'javascript' | 'python'>('javascript');
  const [code, setCode] = useState<string>(PROBLEMS[0].starterCode.javascript);
  const [theme, setTheme] = useState<'cozy' | 'ember'>('cozy');

  // Test Runner State
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isTestPanelExpanded, setIsTestPanelExpanded] = useState(true);

  // Reference Manual / Docs Modal State
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [referenceQueryCount, setReferenceQueryCount] = useState(0);
  const [snippetInsertCount, setSnippetInsertCount] = useState(0);

  // Warm-Up Baseline Calibration Modal
  const [isWarmupOpen, setIsWarmupOpen] = useState(false);

  // Submission State
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submittedPayload, setSubmittedPayload] = useState<SubmissionPayload | null>(null);
  const [isOfflineQueued, setIsOfflineQueued] = useState(false);
  const [lastAutosaveTime, setLastAutosaveTime] = useState<number | null>(null);

  // Fullscreen State & Handlers
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    return typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false;
  });

  const enterFullscreen = useCallback(() => {
    if (typeof document !== 'undefined' && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      enterFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, [enterFullscreen]);

  // Monaco Editor Reference
  const editorRef = useRef<any>(null);

  // Automatically adapt mode based on user role upon login
  useEffect(() => {
    if (user?.role === 'examiner' || user?.role === 'admin') {
      setCurrentMode('examiner');
    } else {
      setCurrentMode('candidate');
    }
  }, [user?.role]);

  // Strict role isolation: candidates are locked to candidate mode; examiners are locked to examiner mode
  const effectiveMode: 'candidate' | 'examiner' =
    user?.role === 'candidate'
      ? 'candidate'
      : user?.role === 'examiner'
      ? 'examiner'
      : currentMode;

  // Fullscreen event listener and automatic entry for candidates
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Auto-enter fullscreen in candidate assessment mode
    if (effectiveMode === 'candidate') {
      enterFullscreen();

      // Many browsers require a user gesture; trigger on candidate's first interaction
      const onUserGesture = () => {
        if (!document.fullscreenElement) {
          enterFullscreen();
        }
      };

      window.addEventListener('click', onUserGesture, { once: true });
      window.addEventListener('keydown', onUserGesture, { once: true });

      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        window.removeEventListener('click', onUserGesture);
        window.removeEventListener('keydown', onUserGesture);
      };
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [effectiveMode, enterFullscreen]);

  // Keystroke dynamics & inference hook
  const {
    baseline,
    currentMetrics,
    anomalyTimeline,
    keystrokeCount,
    handleKeyDown,
    handleKeyUp,
    handleCursorChange,
    handlePaste,
    updateBaseline,
    getTelemetrySummary,
  } = useKeystrokeInference(candidateId, activeProblem.id);

  // Check if baseline exists or if fresh session; show warm-up modal for candidates
  useEffect(() => {
    async function checkBaseline() {
      await seedInitialMockDataIfEmpty();
      if (user?.role === 'candidate') {
        const seenInSession = sessionStorage.getItem('sentri_warmup_seen');
        const existing = await db.baselines.get(candidateId);
        // Show if no baseline exists OR if candidate hasn't seen it in this session
        if (!existing || !seenInSession) {
          setIsWarmupOpen(true);
        }
      }
      // Check for any pending outbox items to sync
      syncManager.syncOutbox();
    }
    checkBaseline();
  }, [candidateId, user?.role]);

  // Synchronize document theme attribute with Tailwind/DaisyUI
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Handle Ctrl+K / Cmd+K / F1 for Quick Docs / Reference Manual
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsReferenceOpen((prev) => !prev);
      } else if (e.key === 'F1') {
        e.preventDefault();
        setIsReferenceOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Autosave code snapshots to Dexie IndexedDB every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await db.snapshots.add({
          timestamp: Date.now(),
          code,
          language,
          trigger: 'autosave',
          charCount: code.length,
          integrityScoreAtMoment: currentMetrics.integrityConfidence,
        });
        setLastAutosaveTime(Date.now());
      } catch (err) {
        console.warn('Autosave snapshot failed:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [code, language, currentMetrics.integrityConfidence]);

  // Change problem
  const handleSelectProblem = (prob: Problem) => {
    setActiveProblem(prob);
    setCode(prob.starterCode[language]);
    setTestResults([]);
  };

  // Change language
  const handleChangeLanguage = (newLang: 'javascript' | 'python') => {
    setLanguage(newLang);
    setCode(activeProblem.starterCode[newLang]);
    setTestResults([]);
  };

  // Reset code to starter template
  const handleResetCode = () => {
    if (window.confirm('Reset code to initial problem template? Current changes will be stored in history.')) {
      setCode(activeProblem.starterCode[language]);
    }
  };

  // Insert code snippet into Monaco editor at cursor
  const handleInsertSnippetAtCursor = useCallback((snippet: string) => {
    setSnippetInsertCount((prev) => prev + 1);
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const selection = editor.getSelection();

    if (selection) {
      editor.executeEdits('sentri-reference-insert', [
        {
          range: selection,
          text: snippet,
          forceMoveMarkers: true,
        },
      ]);
      editor.focus();
    }
  }, []);

  // Run Test Cases via Sandboxed Runner (Server API or local fallback)
  const handleRunTests = async () => {
    setIsExecuting(true);
    setIsTestPanelExpanded(true);

    try {
      // Snapshot before test run
      await db.snapshots.add({
        timestamp: Date.now(),
        code,
        language,
        trigger: 'test_run',
        charCount: code.length,
      });

      const functionName =
        activeProblem.id === 'two-sum'
          ? 'twoSum'
          : activeProblem.id === 'valid-anagram'
          ? 'isAnagram'
          : 'merge';

      const results = await executeCode(
        code,
        language,
        activeProblem.testCases,
        functionName,
        activeProblem.id
      );

      setTestResults(results);
    } catch (err: any) {
      setTestResults(
        activeProblem.testCases.map((tc) => ({
          testCaseId: tc.id,
          label: tc.label,
          passed: false,
          error: err.message || 'Execution Error',
        }))
      );
    } finally {
      setIsExecuting(false);
    }
  };

  // Final Submission Flow
  const handleSubmitExam = async () => {
    let currentResults = testResults;
    const functionName =
      activeProblem.id === 'two-sum'
        ? 'twoSum'
        : activeProblem.id === 'valid-anagram'
        ? 'isAnagram'
        : 'merge';

    if (currentResults.length === 0) {
      currentResults = await executeCode(
        code,
        language,
        activeProblem.testCases,
        functionName,
        activeProblem.id
      );
      setTestResults(currentResults);
    }

    const passedCount = currentResults.filter((r) => r.passed).length;
    const score = Math.round((passedCount / currentResults.length) * 100);

    const telemetrySummary = getTelemetrySummary(
      referenceQueryCount,
      snippetInsertCount
    );

    const submissionId = `sub-${Date.now().toString(36)}`;
    const rawDataForHash = JSON.stringify({
      submissionId,
      candidateId,
      code,
      score,
      telemetrySummary,
      timestamp: Date.now(),
    });

    const integrityHash = await computeSHA256(rawDataForHash);

    const payload: SubmissionPayload = {
      id: submissionId,
      candidateId,
      candidateName,
      problemId: activeProblem.id,
      code,
      language,
      submittedAt: Date.now(),
      durationSeconds: 1200,
      integrityHash,
      score,
      testResults: currentResults,
      telemetrySummary,
      anomalyTimeline,
      baseline,
      status: 'synced',
    };

    // Always store in IndexedDB
    await db.submissions.put(payload);

    // If online, post to server immediately; if offline, enqueue in outbox
    let syncedImmediately = false;
    if (navigator.onLine) {
      try {
        const res = await fetch('/api/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          syncedImmediately = true;
          setIsOfflineQueued(false);
        }
      } catch (e) {
        console.warn('Direct submission sync failed, enqueuing to local outbox:', e);
      }
    }

    if (!syncedImmediately) {
      payload.status = 'pending_sync';
      await db.submissions.put(payload);
      await db.outbox.add({
        submissionId: payload.id,
        payload,
        createdAt: Date.now(),
        attempts: 0,
        synced: false,
      });
      setIsOfflineQueued(true);
    }

    setSubmittedPayload(payload);
    setIsSubmitModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-base-100 gap-3">
        <span className="loading loading-ring loading-lg text-primary" />
        <p className="text-xs text-base-content/60 font-medium">Starting secure assessment environment...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthView />;
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-base-100 overflow-hidden font-sans text-base-content antialiased">
      {effectiveMode === 'candidate' ? (
        <>
          {/* Top Bar Navigation & Status */}
          <TopBar
            problem={activeProblem}
            allProblems={PROBLEMS}
            onSelectProblem={handleSelectProblem}
            onOpenReference={() => setIsReferenceOpen(true)}
            onRunTests={handleRunTests}
            onSubmitExam={handleSubmitExam}
            isExecuting={isExecuting}
            lastAutosaveTime={lastAutosaveTime}
            currentMode={effectiveMode}
            onToggleMode={setCurrentMode}
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'cozy' ? 'ember' : 'cozy')}
            user={user}
            onLogout={logout}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onOpenCalibration={() => setIsWarmupOpen(true)}
          />

          {/* Main IDE Split Workspace */}
          <Workspace
            problem={activeProblem}
            code={code}
            onChangeCode={setCode}
            language={language}
            onChangeLanguage={handleChangeLanguage}
            onResetCode={handleResetCode}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onCursorChange={handleCursorChange}
            onPaste={handlePaste}
            onInsertSnippet={handleInsertSnippetAtCursor}
            theme={theme}
            editorRef={editorRef}
          />

          {/* Bottom Test Runner Drawer */}
          <BottomPanel
            testCases={activeProblem.testCases}
            testResults={testResults}
            isExecuting={isExecuting}
            onRunTests={handleRunTests}
            isExpanded={isTestPanelExpanded}
            onToggleExpand={() => setIsTestPanelExpanded(!isTestPanelExpanded)}
          />

          {/* Quick Docs / Reference Modal (Ctrl+K or TopBar Docs button) */}
          <QuickReferenceModal
            isOpen={isReferenceOpen}
            onClose={() => setIsReferenceOpen(false)}
            onInsertSnippet={handleInsertSnippetAtCursor}
            activeLanguage={language}
          />

          {/* Baseline Warm-Up Modal (Monaco Powered) */}
          <BaselineCalibrationModal
            isOpen={isWarmupOpen}
            onComplete={(calibrated) => {
              updateBaseline(calibrated);
              sessionStorage.setItem('sentri_warmup_seen', 'true');
              setIsWarmupOpen(false);
            }}
            candidateId={candidateId}
          />

          {/* Submission Modal */}
          <SubmissionModal
            isOpen={isSubmitModalOpen}
            onClose={() => setIsSubmitModalOpen(false)}
            submission={submittedPayload}
            isOfflineQueued={isOfflineQueued}
          />
        </>
      ) : (
        /* Examiner Review & Forensics Workbench */
        <div className="flex-1 min-h-0 overflow-hidden">
          <ExaminerDashboard
            onBackToAssessment={() => setCurrentMode('candidate')}
            selectedSubmissionId={selectedAuditId}
            user={user}
            onLogout={logout}
          />
        </div>
      )}

      {/* Sync Toast Container */}
      <SyncToastContainer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default App;
