import React, { useState, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { BaselineCalibration } from '../../types';
import { calculateShannonEntropy } from '../../telemetry/slidingWindow';
import { ArrowRight, Coffee, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';

interface BaselineCalibrationModalProps {
  isOpen: boolean;
  onComplete: (baseline: BaselineCalibration) => void;
  candidateId: string;
}

const WARMUP_STARTER_CODE = `// 👋 Quick 30-Second Warm-Up
// Type a few lines naturally with Monaco code suggestions and autocomplete enabled!

function multiply(a, b) {
  const result = a * b;
  return result;
}

// Try typing a line or two below:
`;

export const BaselineCalibrationModal: React.FC<BaselineCalibrationModalProps> = ({
  isOpen,
  onComplete,
  candidateId,
}) => {
  const [code, setCode] = useState(WARMUP_STARTER_CODE);
  const [keystrokeCount, setKeystrokeCount] = useState(0);
  const flightTimesRef = useRef<number[]>([]);
  const dwellTimesRef = useRef<number[]>([]);
  const backspaceCountRef = useRef<number>(0);
  const lastKeyTimeRef = useRef<number>(performance.now());
  const keyDownMapRef = useRef<Map<string, number>>(new Map());

  if (!isOpen) return null;

  const handleEditorMount: OnMount = (editor) => {
    editor.focus();
    // Position cursor at the end
    const lineCount = editor.getModel()?.getLineCount() || 9;
    editor.setPosition({ lineNumber: lineCount, column: 1 });

    editor.onKeyDown((e) => {
      const now = performance.now();
      const codeKey = e.browserEvent.code || e.browserEvent.key;
      if (codeKey === 'Backspace' || codeKey === 'Delete' || e.browserEvent.key === 'Backspace') {
        backspaceCountRef.current++;
      }
      if (!keyDownMapRef.current.has(codeKey)) {
        keyDownMapRef.current.set(codeKey, now);
      }
      const flight = Math.max(10, Math.round(now - lastKeyTimeRef.current));
      if (flight < 3500) {
        flightTimesRef.current.push(flight);
        setKeystrokeCount((prev) => prev + 1);
      }
    });

    editor.onKeyUp((e) => {
      const now = performance.now();
      const codeKey = e.browserEvent.code || e.browserEvent.key;
      const downTime = keyDownMapRef.current.get(codeKey);
      keyDownMapRef.current.delete(codeKey);
      const dwell = downTime ? Math.max(10, Math.round(now - downTime)) : 70;
      lastKeyTimeRef.current = now;
      if (dwell < 800) {
        dwellTimesRef.current.push(dwell);
      }
    });
  };

  const calculateBaseline = (): BaselineCalibration => {
    const vf = flightTimesRef.current.length >= 8 ? flightTimesRef.current : [145, 175, 160, 210, 190, 135, 165, 180];
    const vd = dwellTimesRef.current.length >= 8 ? dwellTimesRef.current : [70, 75, 80, 65, 85, 75, 70, 80];
    
    const mf = Math.round(vf.reduce((a, b) => a + b, 0) / vf.length);
    const varF = Math.round(vf.reduce((acc, ft) => acc + (ft - mf) ** 2, 0) / vf.length);
    const stdDev = Math.round(Math.sqrt(varF));
    const md = Math.round(vd.reduce((a, b) => a + b, 0) / vd.length);
    const personalEntropy = calculateShannonEntropy(vf);
    const personalPauseThreshold = Math.max(1200, Math.round(mf * 3.5));

    const bs = backspaceCountRef.current;
    const personalBackspaceRate = keystrokeCount > 0 ? Number((bs / keystrokeCount).toFixed(3)) : 0.09;

    return {
      candidateId,
      meanFlightTime: Math.max(70, mf),
      varianceFlightTime: Math.max(800, varF),
      stdDevFlightTime: Math.max(28, stdDev),
      meanDwellTime: Math.max(30, md),
      naturalBurstVelocity: Math.round(60000 / (mf + md)),
      baselineEntropy: personalEntropy,
      naturalPauseThresholdMs: personalPauseThreshold,
      naturalBackspaceRate: Math.max(0.04, personalBackspaceRate),
      recordedAt: Date.now(),
      sampleCount: vf.length,
    };
  };

  const targetKeystrokes = 25;
  const progress = Math.min(100, Math.round((keystrokeCount / targetKeystrokes) * 100));
  const ready = keystrokeCount >= 15;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-2xl bg-base-100 shadow-2xl border border-base-300 animate-slide-up flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="card-body p-6 space-y-3.5 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">👋</div>
              <div>
                <h2 className="text-lg font-bold text-base-content flex items-center gap-2">
                  <span>Welcome! Let's Calibrate Your Typing</span>
                  <span className="badge badge-sm badge-primary gap-1">
                    <Sparkles className="w-3 h-3" /> Monaco Powered
                  </span>
                </h2>
                <p className="text-xs text-base-content/60 mt-0.5">
                  Type 20-30 characters in the editor below. Full autocompletion & suggestions are active!
                </p>
              </div>
            </div>
            {ready && (
              <div className="badge badge-success gap-1 text-xs py-2 px-2.5 text-white shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" /> Calibrated!
              </div>
            )}
          </div>

          {/* Privacy note */}
          <div className="alert alert-info py-2 px-3 text-xs rounded-xl flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="leading-tight">
              <strong>Zero characters recorded.</strong> We calibrate purely your natural rhythm (keystroke intervals) inside Monaco editor so suggestions and editor mechanics match the live exam 1:1.
            </span>
          </div>

          {/* Monaco Editor Container for authentic calibration */}
          <div className="flex-1 min-h-[220px] rounded-xl border border-base-300 overflow-hidden relative shadow-inner bg-base-200">
            <Editor
              height="220px"
              language="javascript"
              value={code}
              onChange={(v) => setCode(v || '')}
              onMount={handleEditorMount}
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

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-base-content/70">
              <span>Keystrokes captured: <strong>{keystrokeCount}</strong> / {targetKeystrokes}</span>
              <span className="font-mono text-primary font-bold">{progress}%</span>
            </div>
            <progress className="progress progress-primary w-full h-2" value={progress} max="100" />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => onComplete({
                candidateId,
                meanFlightTime: 165,
                varianceFlightTime: 2200,
                meanDwellTime: 78,
                naturalBurstVelocity: 255,
                recordedAt: Date.now(),
                sampleCount: 50,
              })}
              className="btn btn-ghost btn-sm text-xs text-base-content/50"
            >
              Skip (use default profile)
            </button>

            <button
              onClick={() => onComplete(calculateBaseline())}
              disabled={!ready}
              className="btn btn-primary btn-sm gap-2 font-medium"
            >
              <Coffee className="w-4 h-4" />
              <span>Continue to Assessment</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
