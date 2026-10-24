import React, { useState, useRef, useCallback, useMemo } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { BaselineCalibration } from '../../types';
import { calculateShannonEntropy } from '../../telemetry/slidingWindow';
import {
  ArrowRight, ShieldCheck, Sparkles, CheckCircle2, BookOpen, Brain,
  Eye, Keyboard, ChevronRight, Info, MessageSquare, Smartphone,
} from 'lucide-react';

interface BaselineCalibrationModalProps {
  isOpen: boolean;
  onComplete: (baseline: BaselineCalibration) => void;
  candidateId: string;
}

// ─── Phase 1: Read & Type Code Snippet ───────────────────────────────────────
// A realistic 14-line snippet for the candidate to read and type.
const TRANSCRIPTION_CODE_DISPLAY = `function mergeIntervals(intervals) {
  if (!intervals.length) return [];

  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [intervals[0]];

  for (const [start, end] of intervals.slice(1)) {
    const last = merged[merged.length - 1];
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}`;

// Non-whitespace characters in the snippet (~296 characters)
const SNIPPET_TARGET_CHARS = TRANSCRIPTION_CODE_DISPLAY.replace(/\s+/g, '').length;

// Starter header text in Monaco editor
const TRANSCRIPTION_STARTER = `// Type the code snippet shown on the left:\n\n`;

// ─── Phase 2: Personal Question Pool ─────────────────────────────────────────
const PERSONAL_QUESTIONS = [
  {
    id: 'project',
    prompt: 'Briefly describe a programming project you have worked on — what it did, which language you used, and one thing you learned from building it.',
    placeholder: 'e.g. I built a real-time chat application using React, Node.js, and WebSockets. The trickiest challenge was managing message ordering and connection drops, which taught me...',
  },
  {
    id: 'background',
    prompt: 'What is your strongest programming language, and what is the most complex problem you have solved using it? Give a short example.',
    placeholder: 'e.g. Python is my strongest language. I used it to implement a custom graph traversal algorithm with memoization for finding the shortest path between...',
  },
  {
    id: 'journey',
    prompt: 'How did you get started with programming, and what motivated you to keep learning? Describe in 2–3 sentences.',
    placeholder: 'e.g. I started programming when I was curious about how automation scripts worked. Building small utility tools that saved time for my team motivated me to keep learning...',
  },
];

const PERSONAL_QUESTION = PERSONAL_QUESTIONS[Math.floor(Date.now() / 1000) % 3];
const PHASE2_TARGET_CHARS = 100; // Target ~2-3 thoughtful sentences

// ─── Keystroke Collector Hook ─────────────────────────────────────────────────
function useKeystrokeCollector() {
  const flightTimesRef = useRef<number[]>([]);
  const dwellTimesRef = useRef<number[]>([]);
  const glancePausesRef = useRef<number[]>([]); // Pauses between 400ms and 3500ms
  const backspaceCountRef = useRef<number>(0);
  const keystrokeCountRef = useRef<number>(0);
  const lastKeyTimeRef = useRef<number>(performance.now());
  const keyDownMapRef = useRef<Map<string, number>>(new Map());

  const reset = useCallback(() => {
    flightTimesRef.current = [];
    dwellTimesRef.current = [];
    glancePausesRef.current = [];
    backspaceCountRef.current = 0;
    keystrokeCountRef.current = 0;
    lastKeyTimeRef.current = performance.now();
    keyDownMapRef.current.clear();
  }, []);

  const onKeyDown = useCallback((browserEvent: { code?: string; key: string }) => {
    const now = performance.now();
    const codeKey = browserEvent.code || browserEvent.key;
    if (codeKey === 'Backspace' || codeKey === 'Delete') {
      backspaceCountRef.current++;
    }
    if (!keyDownMapRef.current.has(codeKey)) {
      keyDownMapRef.current.set(codeKey, now);
    }
    const flight = Math.max(10, Math.round(now - lastKeyTimeRef.current));
    if (flight >= 400 && flight <= 3500) {
      glancePausesRef.current.push(flight);
    }
    if (flight < 4000) {
      flightTimesRef.current.push(flight);
      keystrokeCountRef.current++;
    }
  }, []);

  const onKeyUp = useCallback((browserEvent: { code?: string; key: string }) => {
    const now = performance.now();
    const codeKey = browserEvent.code || browserEvent.key;
    const downTime = keyDownMapRef.current.get(codeKey);
    keyDownMapRef.current.delete(codeKey);
    const dwell = downTime ? Math.max(10, Math.round(now - downTime)) : 70;
    lastKeyTimeRef.current = now;
    if (dwell < 800) dwellTimesRef.current.push(dwell);
  }, []);

  const snapshot = useCallback(() => ({
    flightTimes: [...flightTimesRef.current],
    dwellTimes: [...dwellTimesRef.current],
    glancePauses: [...glancePausesRef.current],
    backspaceCount: backspaceCountRef.current,
    keystrokeCount: keystrokeCountRef.current,
  }), []);

  return { onKeyDown, onKeyUp, reset, snapshot, keystrokeCountRef };
}

// ─── Derive biometric profile from flight-time samples ───────────────────────
function deriveProfile(
  flights: number[],
  dwells: number[],
  bsCount: number,
  ksCount: number,
  glancePauses: number[] = []
) {
  const vf = flights.length >= 8 ? flights : [145, 175, 160, 210, 190, 135, 165, 180];
  const vd = dwells.length >= 8 ? dwells : [70, 75, 80, 65, 85, 75, 70, 80];
  const mf = Math.round(vf.reduce((a, b) => a + b, 0) / vf.length);
  const varF = Math.round(vf.reduce((acc, ft) => acc + (ft - mf) ** 2, 0) / vf.length);
  const stdDev = Math.round(Math.sqrt(varF));
  const md = Math.round(vd.reduce((a, b) => a + b, 0) / vd.length);
  const entropy = calculateShannonEntropy(vf);
  const pauseThreshold = Math.max(1200, Math.round(mf * 3.5));
  const bsRate = ksCount > 0 ? Number((bsCount / ksCount).toFixed(3)) : 0.09;

  // Near-field on-screen glance pause average:
  const onScreenGlance = glancePauses.length >= 3
    ? Math.round(glancePauses.reduce((a, b) => a + b, 0) / glancePauses.length)
    : 850;

  return {
    mf,
    varF,
    stdDev,
    md,
    entropy,
    pauseThreshold,
    bsRate,
    onScreenGlance,
    sampleCount: vf.length,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
type Phase = 'intro' | 'phase1' | 'phase2';

export const BaselineCalibrationModal: React.FC<BaselineCalibrationModalProps> = ({
  isOpen,
  onComplete,
  candidateId,
}) => {
  const [phase, setPhase] = useState<Phase>('intro');
  const [phase1Code, setPhase1Code] = useState(TRANSCRIPTION_STARTER);
  const [phase1KeyCount, setPhase1KeyCount] = useState(0);
  const [phase2KeyCount, setPhase2KeyCount] = useState(0);
  const [thoughtText, setThoughtText] = useState('');

  // Collectors for each phase
  const phase1Collector = useKeystrokeCollector();
  const phase2Collector = useKeystrokeCollector();

  // Snapshot of Phase 1 transcription
  const phase1SnapshotRef = useRef<ReturnType<typeof phase1Collector.snapshot> | null>(null);

  // ── Calculate Progress of Phase 1 Code Typing ──────────────────────────────
  // Exclude comment lines and spaces to accurately evaluate how much code is typed
  const { typedCharsCount, phase1Progress, phase1Ready } = useMemo(() => {
    const codeLines = phase1Code
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    const typedClean = codeLines.replace(/\s+/g, '');
    const count = typedClean.length;
    // Progress scales across the full 296 non-whitespace characters of the snippet
    const progress = Math.min(100, Math.round((count / SNIPPET_TARGET_CHARS) * 100));
    // Ready when candidate has typed at least 88% of the snippet and generated sufficient keystrokes
    const isReady = progress >= 88 && phase1KeyCount >= 140;
    return { typedCharsCount: count, phase1Progress: progress, phase1Ready: isReady };
  }, [phase1Code, phase1KeyCount]);

  // ── Calculate Progress of Phase 2 Thought Text ─────────────────────────────
  const { phase2Progress, phase2Ready } = useMemo(() => {
    const len = thoughtText.trim().length;
    const progress = Math.min(100, Math.round((len / PHASE2_TARGET_CHARS) * 100));
    const isReady = len >= PHASE2_TARGET_CHARS && phase2KeyCount >= 60;
    return { phase2Progress: progress, phase2Ready: isReady };
  }, [thoughtText, phase2KeyCount]);

  if (!isOpen) return null;

  // ── Phase 1 Editor Mount ────────────────────────────────────────────────────
  const handlePhase1Mount: OnMount = (editor) => {
    editor.focus();
    const lineCount = editor.getModel()?.getLineCount() || 3;
    editor.setPosition({ lineNumber: lineCount, column: 1 });

    editor.onKeyDown((e) => {
      phase1Collector.onKeyDown(e.browserEvent);
      setPhase1KeyCount(phase1Collector.keystrokeCountRef.current + 1);
    });
    editor.onKeyUp((e) => phase1Collector.onKeyUp(e.browserEvent));
  };

  // ── Phase 2 Textarea Key Listeners ─────────────────────────────────────────
  const handlePhase2KeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    phase2Collector.onKeyDown({ code: e.code, key: e.key });
    setPhase2KeyCount(phase2Collector.keystrokeCountRef.current + 1);
  };
  const handlePhase2KeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    phase2Collector.onKeyUp({ code: e.code, key: e.key });
  };

  // ── Advance from Phase 1 → Phase 2 ─────────────────────────────────────────
  const advanceToPhase2 = () => {
    phase1SnapshotRef.current = phase1Collector.snapshot();
    phase2Collector.reset();
    setPhase('phase2');
  };

  // ── Build & complete final baseline ────────────────────────────────────────
  const buildAndComplete = () => {
    const p2 = phase2Collector.snapshot();
    const p2Profile = deriveProfile(p2.flightTimes, p2.dwellTimes, p2.backspaceCount, p2.keystrokeCount);

    // Phase 1 transcription profile
    const p1 = phase1SnapshotRef.current;
    let txMean: number | undefined;
    let txVar: number | undefined;
    let txBsRate: number | undefined;
    let onScreenGlanceMean = 850;

    if (p1 && p1.flightTimes.length >= 8) {
      const p1Profile = deriveProfile(
        p1.flightTimes,
        p1.dwellTimes,
        p1.backspaceCount,
        p1.keystrokeCount,
        p1.glancePauses
      );
      txMean = p1Profile.mf;
      txVar = p1Profile.varF;
      txBsRate = p1Profile.bsRate;
      onScreenGlanceMean = p1Profile.onScreenGlance;
    }

    // Biomechanical latency offset for head tilt down to a phone (30-45 deg pitch) + ocular accommodation (60cm -> 30cm)
    const phoneDistanceOffsetMs = 1800;
    const phoneDistanceGlanceMinMs = Math.max(1800, onScreenGlanceMean + 1000);
    const phoneDistanceGlanceMaxMs = 7500;

    const baseline: BaselineCalibration = {
      candidateId,
      // Primary: Phase 2 (authentic cognitive typing)
      meanFlightTime: Math.max(70, p2Profile.mf),
      varianceFlightTime: Math.max(800, p2Profile.varF),
      stdDevFlightTime: Math.max(28, p2Profile.stdDev),
      meanDwellTime: Math.max(30, p2Profile.md),
      naturalBurstVelocity: Math.round(60000 / (p2Profile.mf + p2Profile.md)),
      baselineEntropy: p2Profile.entropy,
      naturalPauseThresholdMs: p2Profile.pauseThreshold,
      naturalBackspaceRate: Math.max(0.04, p2Profile.bsRate),
      recordedAt: Date.now(),
      sampleCount: p2Profile.sampleCount,
      // Phase 1 transcription reference
      transcriptionMeanFlightTime: txMean,
      transcriptionVarianceFlightTime: txVar,
      transcriptionBackspaceRate: txBsRate,
      // Phone / Distant Device Distance Calibration
      onScreenGlancePauseMeanMs: onScreenGlanceMean,
      phoneDistanceOffsetMs,
      phoneDistanceGlanceMinMs,
      phoneDistanceGlanceMaxMs,
      isPhoneDistanceCalibrated: true,
      // Candidate statement for evaluators
      candidateStatement: thoughtText.trim() || undefined,
      personalQuestionAsked: PERSONAL_QUESTION.prompt,
    };

    onComplete(baseline);
  };

  const skipWithDefaults = () => {
    onComplete({
      candidateId,
      meanFlightTime: 165,
      varianceFlightTime: 2200,
      meanDwellTime: 78,
      naturalBurstVelocity: 255,
      recordedAt: Date.now(),
      sampleCount: 0,
      onScreenGlancePauseMeanMs: 850,
      phoneDistanceOffsetMs: 1800,
      phoneDistanceGlanceMinMs: 1850,
      phoneDistanceGlanceMaxMs: 7500,
      isPhoneDistanceCalibrated: true,
    });
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-4xl bg-base-100 shadow-2xl border border-base-300 flex flex-col max-h-[95vh]">

        {/* ── Step Indicator Header ─────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-4 border-b border-base-300 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="text-2xl">🎯</div>
              <div>
                <h2 className="text-base font-bold text-base-content leading-tight">
                  Biometric Typing Calibration
                </h2>
                <p className="text-xs text-base-content/55 mt-0.5">
                  Type the code snippet, then answer a personal question. Timing only, no passwords/secrets logged.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-success bg-success/10 border border-success/20 rounded-full px-2.5 py-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Biometric rhythm only</span>
            </div>
          </div>

          {/* Progress steps */}
          <ul className="steps steps-horizontal w-full text-xs">
            <li className={`step ${['intro', 'phase1', 'phase2'].includes(phase) ? 'step-primary' : ''}`}>
              Overview
            </li>
            <li className={`step ${['phase1', 'phase2'].includes(phase) ? 'step-primary' : ''}`}>
              1. Type Full Code Snippet
            </li>
            <li className={`step ${phase === 'phase2' ? 'step-primary' : ''}`}>
              2. Personal Perspective
            </li>
          </ul>
        </div>

        {/* ── Phase: Intro ──────────────────────────────────────────────── */}
        {phase === 'intro' && (
          <div className="card-body p-6 space-y-5 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Phase 1 card */}
              <div className="bg-base-200/60 rounded-2xl border border-base-300 p-4 space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <Eye className="w-4 h-4" />
                  Step 1 — Read & Type the Full Code
                </div>
                <p className="text-xs text-base-content/70 leading-relaxed">
                  A realistic 14-line algorithm function is shown on the left. Type the full snippet into the Monaco editor on the right. The progress bar will fill up as you type each line of the code snippet.
                </p>
                <div className="badge badge-outline badge-sm text-[10px]">~300 characters / 14 lines</div>
              </div>

              {/* Phase 2 card */}
              <div className="bg-base-200/60 rounded-2xl border border-base-300 p-4 space-y-2">
                <div className="flex items-center gap-2 text-secondary font-bold text-sm">
                  <Brain className="w-4 h-4" />
                  Step 2 — Answer From the Mind
                </div>
                <p className="text-xs text-base-content/70 leading-relaxed">
                  You will answer a personal question about your programming projects and experience. Type your answer naturally from thought (2–3 sentences) to capture your authentic cognitive typing pattern.
                </p>
                <div className="badge badge-outline badge-sm text-[10px]">~100+ characters / 2–3 sentences</div>
              </div>
            </div>

            <div className="alert py-2.5 px-3.5 rounded-xl text-xs">
              <Info className="w-4 h-4 shrink-0" />
              <span>
                <strong>Accurate Personalization:</strong> Measuring both your reading/transcription speed and your thinking/formulating cadence allows the system to eliminate false positives and catch true sight-typing anomalies.
              </span>
            </div>

            <div className="alert py-2.5 px-3.5 rounded-xl text-xs bg-base-200 border border-base-300">
              <Smartphone className="w-4 h-4 shrink-0 text-primary" />
              <span>
                <strong>Distance-Aware Pause Modeling:</strong> Copying on-screen code produces short glances (~0.8s). Sentri Code automatically calculates the physical head-tilt offset (+1.8s) for phone or external device glances (2.0s–7.5s) to guarantee legitimate thinking pauses are never misclassified as external transcription.
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button onClick={skipWithDefaults} className="btn btn-ghost btn-sm text-xs text-base-content/40">
                Skip (use default profile)
              </button>
              <button onClick={() => setPhase('phase1')} className="btn btn-primary btn-sm gap-2">
                <ChevronRight className="w-4 h-4" />
                Begin Step 1
              </button>
            </div>
          </div>
        )}

        {/* ── Phase 1: Read & Type ───────────────────────────────────────── */}
        {phase === 'phase1' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-5 pt-3.5 pb-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-base-content">
                  <Eye className="w-4 h-4 text-primary" />
                  <span>Step 1 of 2 — Type the code snippet shown on the left</span>
                </div>
                <span className="text-xs font-mono font-semibold text-primary">
                  {phase1Progress}% Completed
                </span>
              </div>
              <p className="text-xs text-base-content/55 mt-0.5">
                Type the full function below. The progress bar will advance as you type out each line of code.
              </p>
            </div>

            {/* Distance awareness indicator */}
            <div className="mx-5 mb-2 px-3 py-1.5 rounded-xl bg-base-200/60 border border-base-300 text-xs flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-base-content/75 text-[11px]">
                  <strong>Screen vs. Phone Distance Calibration:</strong> You're copying from a close-by screen (~0.8s glances). The system applies a calibrated +1.8s physical distance model for phone glances so thinking pauses stay protected.
                </span>
              </div>
              <span className="badge badge-xs badge-success text-white font-mono shrink-0">
                Distance Model Active
              </span>
            </div>

            {/* Split: Code to read | Editor to type into */}
            <div className="flex-1 flex min-h-0 gap-0 mx-4 mb-3 rounded-2xl border border-base-300 overflow-hidden shadow-inner">

              {/* Left: Read-only reference code */}
              <div className="w-1/2 bg-[#1e1e2e] flex flex-col border-r border-white/10 overflow-hidden">
                <div className="px-3 py-2 bg-white/5 border-b border-white/10 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[11px] text-white/70 font-mono font-semibold uppercase tracking-wide">
                      Reference Code Snippet
                    </span>
                  </div>
                  <span className="text-[10px] text-white/40 font-mono">14 lines</span>
                </div>
                <pre className="flex-1 overflow-y-auto p-4 text-[13px] font-mono leading-relaxed text-green-300/90 whitespace-pre-wrap select-none">
                  {TRANSCRIPTION_CODE_DISPLAY}
                </pre>
              </div>

              {/* Right: Monaco typing area */}
              <div className="w-1/2 flex flex-col overflow-hidden bg-base-100">
                <div className="px-3 py-2 bg-base-200/60 border-b border-base-300 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Keyboard className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] text-base-content/70 font-semibold uppercase tracking-wide">
                      Your Editor (Suggestions ON)
                    </span>
                  </div>
                  <span className="text-[10px] text-base-content/40 font-mono">
                    {typedCharsCount} / {SNIPPET_TARGET_CHARS} chars
                  </span>
                </div>
                <div className="flex-1 min-h-0">
                  <Editor
                    height="100%"
                    language="javascript"
                    value={phase1Code}
                    onChange={(val) => setPhase1Code(val || '')}
                    onMount={handlePhase1Mount}
                    theme="vs-dark"
                    options={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', monospace",
                      minimap: { enabled: false },
                      lineNumbers: 'on',
                      quickSuggestions: true,
                      suggestOnTriggerCharacters: true,
                      tabCompletion: 'on',
                      autoClosingBrackets: 'always',
                      autoClosingQuotes: 'always',
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Footer with accurate full-snippet progress */}
            <div className="px-5 pb-4 space-y-2 shrink-0">
              <div className="flex items-center justify-between text-xs">
                <span className="text-base-content/70">
                  Snippet completion: <strong className="text-base-content">{typedCharsCount}</strong> of <strong>{SNIPPET_TARGET_CHARS}</strong> code characters typed ({phase1KeyCount} keystrokes)
                </span>
                <span className={`font-mono font-bold ${phase1Ready ? 'text-success' : 'text-primary'}`}>
                  {phase1Progress}%
                </span>
              </div>
              <progress
                className={`progress w-full h-2 transition-all duration-200 ${phase1Ready ? 'progress-success' : 'progress-primary'}`}
                value={phase1Progress}
                max="100"
              />
              <div className="flex items-center justify-between pt-1">
                <button onClick={skipWithDefaults} className="btn btn-ghost btn-sm text-xs text-base-content/40">
                  Skip calibration
                </button>
                <button
                  onClick={advanceToPhase2}
                  disabled={!phase1Ready}
                  className="btn btn-primary btn-sm gap-2"
                >
                  {phase1Ready ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>Snippet Complete! Continue to Step 2</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <Keyboard className="w-4 h-4 animate-pulse" />
                      <span>Type whole snippet to proceed ({phase1Progress}%)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Phase 2: Personal Question ─────────────────────────────────── */}
        {phase === 'phase2' && (
          <div className="card-body p-6 space-y-4 overflow-y-auto">

            {/* Question banner */}
            <div className="bg-secondary/8 border border-secondary/25 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-secondary">
                  <MessageSquare className="w-4 h-4" />
                  <span>Step 2 of 2 — Answer a Personal Question</span>
                </div>
                <span className="text-xs font-mono font-semibold text-secondary">
                  {phase2Progress}%
                </span>
              </div>
              <p className="text-sm text-base-content font-medium leading-relaxed">
                {PERSONAL_QUESTION.prompt}
              </p>
              <p className="text-[11px] text-base-content/55 leading-snug">
                Type your answer from thought. Pauses to think, sentence revisions, and backspaces are authentic and expected. Evaluators will also see your statement for perspective.
              </p>
            </div>

            {/* Answer textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-base-content/70 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-secondary" />
                  Your answer (type naturally from memory — 2–3 sentences):
                </span>
                <span className="font-mono text-[11px] text-base-content/50">
                  {thoughtText.trim().length} / {PHASE2_TARGET_CHARS} characters minimum
                </span>
              </label>
              <textarea
                className="textarea textarea-bordered w-full h-32 text-sm font-sans leading-relaxed resize-none focus:outline-secondary focus:border-secondary"
                placeholder={PERSONAL_QUESTION.placeholder}
                value={thoughtText}
                onChange={(e) => setThoughtText(e.target.value)}
                onKeyDown={handlePhase2KeyDown}
                onKeyUp={handlePhase2KeyUp}
                autoFocus
                spellCheck
              />
            </div>

            {/* Phase 2 Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-base-content/70">
                <span>Response completion: <strong className="text-base-content">{thoughtText.trim().length}</strong> of {PHASE2_TARGET_CHARS} characters typed</span>
                <span className={`font-mono font-bold ${phase2Ready ? 'text-success' : 'text-secondary'}`}>
                  {phase2Progress}%
                </span>
              </div>
              <progress
                className={`progress w-full h-2 transition-all duration-200 ${phase2Ready ? 'progress-success' : 'progress-secondary'}`}
                value={phase2Progress}
                max="100"
              />
            </div>

            <div className="alert alert-info py-2 px-3 text-xs rounded-xl flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                <strong>Evaluator Perspective:</strong> Your written answer will provide context about your programming background to your evaluator during grading.
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button onClick={skipWithDefaults} className="btn btn-ghost btn-sm text-xs text-base-content/40">
                Skip calibration
              </button>
              <button
                onClick={buildAndComplete}
                disabled={!phase2Ready}
                className="btn btn-secondary btn-sm gap-2"
              >
                {phase2Ready ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Complete Calibration & Start Assessment</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span>Write a bit more ({phase2Progress}%)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
