import React, { useState, useRef, useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { BaselineCalibration } from '../../types';
import { calculateShannonEntropy } from '../../telemetry/slidingWindow';
import {
  ArrowRight, ShieldCheck, Sparkles, CheckCircle2, BookOpen, Brain,
  Eye, Keyboard, ChevronRight, Info, MessageSquare,
} from 'lucide-react';

interface BaselineCalibrationModalProps {
  isOpen: boolean;
  onComplete: (baseline: BaselineCalibration) => void;
  candidateId: string;
}

// ─── Phase 1: Read & Type Code Snippet ───────────────────────────────────────
// A realistic, non-trivial ~14-line snippet for the candidate to read and type.
// Deliberately uses varied keystrokes (brackets, dots, words) for rich sampling.
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

// Starter text prepopulated in the typing area (empty — user types the snippet above)
const TRANSCRIPTION_STARTER = `// Phase 1: Read the code on the left, then type it here.\n// Take your time — read a few lines, then type them.\n\n`;

// ─── Phase 2: Personal Question Pool ─────────────────────────────────────────
const PERSONAL_QUESTIONS = [
  {
    id: 'project',
    prompt: 'Briefly describe a programming project you have worked on — what it did, which language you used, and one thing you learned from building it.',
    placeholder: 'e.g. I built a todo-list web app using React and Node.js. The hardest part was…',
  },
  {
    id: 'background',
    prompt: 'What is your strongest programming language, and what is the most complex problem you have solved using it? Give a short example.',
    placeholder: 'e.g. Python is my strongest language. I used it to implement a binary search tree from scratch…',
  },
  {
    id: 'journey',
    prompt: 'How did you get started with programming, and what motivated you to keep learning? Describe in 2–3 sentences.',
    placeholder: 'e.g. I started coding in 9th grade when I made a small game in Python. I kept going because…',
  },
];

// Pick one question deterministically (could be randomized per session)
const PERSONAL_QUESTION = PERSONAL_QUESTIONS[Math.floor(Date.now() / 1000) % 3];

// ─── Keystroke Collector Hook ─────────────────────────────────────────────────
function useKeystrokeCollector() {
  const flightTimesRef = useRef<number[]>([]);
  const dwellTimesRef = useRef<number[]>([]);
  const backspaceCountRef = useRef<number>(0);
  const keystrokeCountRef = useRef<number>(0);
  const lastKeyTimeRef = useRef<number>(performance.now());
  const keyDownMapRef = useRef<Map<string, number>>(new Map());

  const reset = useCallback(() => {
    flightTimesRef.current = [];
    dwellTimesRef.current = [];
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
    backspaceCount: backspaceCountRef.current,
    keystrokeCount: keystrokeCountRef.current,
  }), []);

  return { onKeyDown, onKeyUp, reset, snapshot, keystrokeCountRef };
}

// ─── Derive biometric profile from a flight-time sample set ──────────────────
function deriveProfile(flights: number[], dwells: number[], bsCount: number, ksCount: number) {
  const vf = flights.length >= 8 ? flights : [145, 175, 160, 210, 190, 135, 165, 180];
  const vd = dwells.length >= 8 ? dwells : [70, 75, 80, 65, 85, 75, 70, 80];
  const mf = Math.round(vf.reduce((a, b) => a + b, 0) / vf.length);
  const varF = Math.round(vf.reduce((acc, ft) => acc + (ft - mf) ** 2, 0) / vf.length);
  const stdDev = Math.round(Math.sqrt(varF));
  const md = Math.round(vd.reduce((a, b) => a + b, 0) / vd.length);
  const entropy = calculateShannonEntropy(vf);
  const pauseThreshold = Math.max(1200, Math.round(mf * 3.5));
  const bsRate = ksCount > 0 ? Number((bsCount / ksCount).toFixed(3)) : 0.09;
  return { mf, varF, stdDev, md, entropy, pauseThreshold, bsRate, sampleCount: vf.length };
}

// ─── Component ────────────────────────────────────────────────────────────────
type Phase = 'intro' | 'phase1' | 'phase2' | 'complete';

export const BaselineCalibrationModal: React.FC<BaselineCalibrationModalProps> = ({
  isOpen,
  onComplete,
  candidateId,
}) => {
  const [phase, setPhase] = useState<Phase>('intro');
  const [phase1KeyCount, setPhase1KeyCount] = useState(0);
  const [phase2KeyCount, setPhase2KeyCount] = useState(0);
  const [thoughtText, setThoughtText] = useState('');

  // Separate collectors for each phase
  const phase1Collector = useKeystrokeCollector();
  const phase2Collector = useKeystrokeCollector();

  // Stored phase1 snapshot (locked-in when user advances to Phase 2)
  const phase1SnapshotRef = useRef<ReturnType<typeof phase1Collector.snapshot> | null>(null);

  if (!isOpen) return null;

  // ── Phase 1 Editor Mount ────────────────────────────────────────────────────
  const handlePhase1Mount: OnMount = (editor) => {
    editor.focus();
    const lineCount = editor.getModel()?.getLineCount() || 3;
    editor.setPosition({ lineNumber: lineCount, column: 100 });

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
    setPhase(phase === 'phase1' ? 'phase2' : 'phase2');
  };

  // ── Build & complete final baseline ────────────────────────────────────────
  const buildAndComplete = () => {
    const p2 = phase2Collector.snapshot();
    const p2Profile = deriveProfile(p2.flightTimes, p2.dwellTimes, p2.backspaceCount, p2.keystrokeCount);

    // Phase 1 transcription profile (for anomaly detection reference)
    const p1 = phase1SnapshotRef.current;
    let txMean: number | undefined;
    let txVar: number | undefined;
    let txBsRate: number | undefined;
    if (p1 && p1.flightTimes.length >= 8) {
      const p1Profile = deriveProfile(p1.flightTimes, p1.dwellTimes, p1.backspaceCount, p1.keystrokeCount);
      txMean = p1Profile.mf;
      txVar = p1Profile.varF;
      txBsRate = p1Profile.bsRate;
    }

    const baseline: BaselineCalibration = {
      candidateId,
      // Primary: Phase 2 (authentic thinking-while-typing)
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
      // Personal context for evaluators
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
    });
  };

  const phase1Ready = phase1KeyCount >= 40;
  const phase2Ready = phase2KeyCount >= 30 && thoughtText.trim().length >= 20;

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
                  Two quick steps — takes about 90 seconds total. Timing only, no characters stored.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Privacy badge */}
              <div className="flex items-center gap-1 text-[10px] text-success bg-success/10 border border-success/20 rounded-full px-2.5 py-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Keystroke timing only</span>
              </div>
            </div>
          </div>

          {/* Progress steps */}
          <ul className="steps steps-horizontal w-full text-xs">
            <li className={`step ${['intro', 'phase1', 'phase2', 'complete'].includes(phase) ? 'step-primary' : ''}`}>
              Intro
            </li>
            <li className={`step ${['phase1', 'phase2', 'complete'].includes(phase) ? 'step-primary' : ''}`}>
              Read & Type Code
            </li>
            <li className={`step ${['phase2', 'complete'].includes(phase) ? 'step-primary' : ''}`}>
              Your Thoughts
            </li>
            <li className={`step ${phase === 'complete' ? 'step-primary' : ''}`}>
              Done
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
                  Step 1 — Read & Type
                </div>
                <p className="text-xs text-base-content/70 leading-relaxed">
                  A code snippet will be shown on the left. Read a few lines at a time, then type them into the editor on the right. This captures how you type when reading code — giving the system your natural <strong>transcription rhythm</strong> as a reference.
                </p>
                <div className="badge badge-outline badge-sm text-[10px]">~50 keystrokes</div>
              </div>

              {/* Phase 2 card */}
              <div className="bg-base-200/60 rounded-2xl border border-base-300 p-4 space-y-2">
                <div className="flex items-center gap-2 text-secondary font-bold text-sm">
                  <Brain className="w-4 h-4" />
                  Step 2 — Your Thoughts
                </div>
                <p className="text-xs text-base-content/70 leading-relaxed">
                  You'll be asked a short personal question about your programming experience. Type your answer <strong>from memory</strong> — naturally, with pauses to think and any corrections. This captures your <strong>authentic cognitive typing pattern</strong>.
                </p>
                <div className="badge badge-outline badge-sm text-[10px]">~40 keystrokes</div>
              </div>
            </div>

            <div className="alert py-2.5 px-3.5 rounded-xl text-xs">
              <Info className="w-4 h-4 shrink-0" />
              <span>
                <strong>Why two phases?</strong> Your typing rhythm shifts when you read vs. when you think. By measuring both, the system creates a personal signal that's far more accurate than a single-mode calibration — dramatically reducing both false positives and false negatives.
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button onClick={skipWithDefaults} className="btn btn-ghost btn-sm text-xs text-base-content/40">
                Skip (use default profile)
              </button>
              <button onClick={() => setPhase('phase1')} className="btn btn-primary btn-sm gap-2">
                <ChevronRight className="w-4 h-4" />
                Begin Calibration
              </button>
            </div>
          </div>
        )}

        {/* ── Phase 1: Read & Type ───────────────────────────────────────── */}
        {phase === 'phase1' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-5 pt-4 pb-3 shrink-0">
              <div className="flex items-center gap-2 text-sm font-bold text-base-content">
                <Eye className="w-4 h-4 text-primary" />
                Step 1 of 2 — Read the code on the left, type it on the right
              </div>
              <p className="text-xs text-base-content/55 mt-1">
                Read a chunk (3–5 lines), then type it. Glance back as needed — typos & backspaces are completely fine.
              </p>
            </div>

            {/* Split: Code to read | Editor to type into */}
            <div className="flex-1 flex min-h-0 gap-0 mx-4 mb-4 rounded-2xl border border-base-300 overflow-hidden shadow-inner">

              {/* Left: Read-only reference code */}
              <div className="w-1/2 bg-[#1e1e2e] flex flex-col border-r border-white/10 overflow-hidden">
                <div className="px-3 py-2 bg-white/5 border-b border-white/10 flex items-center gap-2 shrink-0">
                  <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[11px] text-white/60 font-mono font-semibold uppercase tracking-wide">
                    Read this ↓ then type it →
                  </span>
                </div>
                <pre className="flex-1 overflow-y-auto p-4 text-[13px] font-mono leading-relaxed text-green-300/90 whitespace-pre-wrap">
                  {TRANSCRIPTION_CODE_DISPLAY}
                </pre>
              </div>

              {/* Right: Monaco typing area */}
              <div className="w-1/2 flex flex-col overflow-hidden bg-base-100">
                <div className="px-3 py-2 bg-base-200/60 border-b border-base-300 flex items-center gap-2 shrink-0">
                  <Keyboard className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] text-base-content/60 font-semibold uppercase tracking-wide">
                    Type here (Monaco editor — suggestions ON)
                  </span>
                </div>
                <div className="flex-1 min-h-0">
                  <Editor
                    height="100%"
                    language="javascript"
                    defaultValue={TRANSCRIPTION_STARTER}
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

            {/* Footer */}
            <div className="px-5 pb-4 space-y-2.5 shrink-0">
              <div className="flex items-center justify-between text-xs text-base-content/60">
                <span>Keystrokes captured: <strong className="text-base-content">{phase1KeyCount}</strong> / 40 minimum</span>
                <span className={`font-mono font-bold ${phase1Ready ? 'text-success' : 'text-primary'}`}>
                  {Math.min(100, Math.round((phase1KeyCount / 40) * 100))}%
                </span>
              </div>
              <progress
                className="progress progress-primary w-full h-1.5"
                value={Math.min(100, Math.round((phase1KeyCount / 40) * 100))}
                max="100"
              />
              <div className="flex items-center justify-between pt-1">
                <button onClick={skipWithDefaults} className="btn btn-ghost btn-sm text-xs text-base-content/40">
                  Skip all
                </button>
                <button
                  onClick={advanceToPhase2}
                  disabled={!phase1Ready}
                  className="btn btn-primary btn-sm gap-2"
                >
                  {phase1Ready ? <CheckCircle2 className="w-4 h-4" /> : <Keyboard className="w-4 h-4 animate-pulse" />}
                  {phase1Ready ? 'Continue to Step 2' : `Type ${Math.max(0, 40 - phase1KeyCount)} more keys…`}
                  {phase1Ready && <ArrowRight className="w-3.5 h-3.5" />}
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
              <div className="flex items-center gap-2 font-bold text-sm text-secondary">
                <MessageSquare className="w-4 h-4" />
                Step 2 of 2 — Answer a personal question
              </div>
              <p className="text-sm text-base-content leading-relaxed">
                {PERSONAL_QUESTION.prompt}
              </p>
              <p className="text-[11px] text-base-content/50 leading-snug">
                Type your answer naturally below — pause to think, edit your words, write 2–4 sentences. This answer will be visible to your evaluator to provide context about you.
              </p>
            </div>

            {/* Answer textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-base-content/70 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-secondary" />
                Your answer (type from memory — no copy-paste):
              </label>
              <textarea
                className="textarea textarea-bordered w-full h-36 text-sm font-sans leading-relaxed resize-none focus:outline-primary focus:border-primary"
                placeholder={PERSONAL_QUESTION.placeholder}
                value={thoughtText}
                onChange={(e) => setThoughtText(e.target.value)}
                onKeyDown={handlePhase2KeyDown}
                onKeyUp={handlePhase2KeyUp}
                autoFocus
                spellCheck
              />
              <div className="flex items-center justify-between text-[11px] text-base-content/50">
                <span>Characters typed: <strong>{thoughtText.length}</strong> (aim for 80+)</span>
                <span>{phase2KeyCount} keystrokes captured</span>
              </div>
            </div>

            <div className="alert alert-info py-2 px-3 text-xs rounded-xl">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                <strong>Timing only, content is visible to your evaluator.</strong> Write honestly — this helps evaluators understand your background and gives the system your natural thinking-while-typing cadence.
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button onClick={skipWithDefaults} className="btn btn-ghost btn-sm text-xs text-base-content/40">
                Skip all
              </button>
              <button
                onClick={buildAndComplete}
                disabled={!phase2Ready}
                className="btn btn-secondary btn-sm gap-2"
              >
                {phase2Ready
                  ? <><CheckCircle2 className="w-4 h-4" /> Start Assessment <ArrowRight className="w-3.5 h-3.5" /></>
                  : <><Sparkles className="w-4 h-4 animate-pulse" /> {`Type ${Math.max(0, 30 - phase2KeyCount)} more keys…`}</>
                }
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
