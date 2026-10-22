import React, { useState, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useKeystrokeInference } from '../../telemetry/useKeystrokeInference';
import type { BaselineCalibration } from '../../types';
import {
  ShieldAlert, ShieldCheck, Activity, RotateCcw,
  Sparkles, CheckCircle2, AlertTriangle, Eye, ArrowLeft, Coffee,
  Gauge, Flame, Terminal, Play, Lock, Sliders, Zap, Check, ChevronRight
} from 'lucide-react';

interface KeystrokeLabViewProps {
  onBack: () => void;
  onOpenCalibration: () => void;
  theme: string;
}

const PRESET_PROFILES: {
  id: string;
  label: string;
  shortDesc: string;
  data: BaselineCalibration;
}[] = [
  {
    id: 'fast',
    label: 'Fast Typist',
    shortDesc: '85ms flight, 1100ms² jitter',
    data: {
      candidateId: 'lab-tester-1',
      meanFlightTime: 85,
      varianceFlightTime: 1100,
      stdDevFlightTime: 33,
      meanDwellTime: 65,
      naturalBurstVelocity: 380,
      baselineEntropy: 0.86,
      naturalPauseThresholdMs: 1300,
      naturalBackspaceRate: 0.08,
      recordedAt: Date.now(),
      sampleCount: 50,
    },
  },
  {
    id: 'balanced',
    label: 'Average Developer',
    shortDesc: '165ms flight, 2200ms² jitter',
    data: {
      candidateId: 'lab-tester-1',
      meanFlightTime: 165,
      varianceFlightTime: 2200,
      stdDevFlightTime: 47,
      meanDwellTime: 78,
      naturalBurstVelocity: 255,
      baselineEntropy: 0.82,
      naturalPauseThresholdMs: 1800,
      naturalBackspaceRate: 0.10,
      recordedAt: Date.now(),
      sampleCount: 50,
    },
  },
  {
    id: 'deliberate',
    label: 'Deliberate / Slower',
    shortDesc: '260ms flight, 4200ms² jitter',
    data: {
      candidateId: 'lab-tester-1',
      meanFlightTime: 260,
      varianceFlightTime: 4200,
      stdDevFlightTime: 65,
      meanDwellTime: 95,
      naturalBurstVelocity: 170,
      baselineEntropy: 0.78,
      naturalPauseThresholdMs: 2500,
      naturalBackspaceRate: 0.12,
      recordedAt: Date.now(),
      sampleCount: 50,
    },
  },
];

export const KeystrokeLabView: React.FC<KeystrokeLabViewProps> = ({
  onBack,
  onOpenCalibration,
  theme,
}) => {
  const [testMode, setTestMode] = useState<'reading' | 'organic'>('reading');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('balanced');
  const [code, setCode] = useState<string>(
    `// 🧪 PERSONALIZED KEYSTROKE LAB
// 1. Choose your typist profile below (or calibrate your own via Monaco)
// 2. Select test mode: Sight-Typing vs Authentic Coding
// 3. Type code in this editor to see relative divergence in real time!

function solution(numbers) {
  
}
`
  );

  const {
    currentMetrics,
    anomalyTimeline,
    keystrokeCount,
    handleKeyDown,
    handleKeyUp,
    handleCursorChange,
    handlePaste,
    getTelemetrySummary,
    baseline,
    updateBaseline,
    isAdapting,
    adaptationCount,
  } = useKeystrokeInference('lab-tester-1', 'lab-problem-1');

  const editorRef = useRef<any>(null);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;

    editor.onDidChangeCursorPosition((e) => {
      const model = editor.getModel();
      if (model) handleCursorChange(model.getOffsetAt(e.position));
    });

    editor.onKeyDown((e) => {
      handleKeyDown({ key: e.browserEvent.key, code: e.browserEvent.code });
    });

    editor.onKeyUp((e) => {
      handleKeyUp({ key: e.browserEvent.key, code: e.browserEvent.code });
    });

    editor.onDidPaste((e) => {
      const len = e.range ? e.range.endColumn - e.range.startColumn : 25;
      handlePaste(len);
    });
  };

  const isDark = theme === 'ember';
  const confidencePct = Math.round(currentMetrics.integrityConfidence * 100);

  // Status diagnosis based on real-time inference
  const isHighRisk = confidencePct < 60;
  const isMediumRisk = confidencePct >= 60 && confidencePct < 80;
  const isAuthentic = confidencePct >= 80;

  // Relative divergence metrics against the personalized baseline
  const baselineMean = baseline.meanFlightTime || 165;
  const baselineVar = baseline.varianceFlightTime || 2200;
  const baselineEntropy = baseline.baselineEntropy || 0.82;

  const liveSpeedRatio = Number((baselineMean / Math.max(45, currentMetrics.digraphLatencyMean)).toFixed(2));
  const liveVarianceRatio = Number((currentMetrics.digraphLatencyVariance / Math.max(400, baselineVar)).toFixed(2));
  const liveEntropyDelta = Number((baselineEntropy - currentMetrics.metronomicEntropy).toFixed(2));

  // Ground truth evaluation
  const evaluationResult = (() => {
    if (keystrokeCount < 15) return { status: 'collecting', label: 'Type 15+ keys to evaluate biometric pattern' };
    if (testMode === 'reading') {
      if (isHighRisk || anomalyTimeline.length > 0) {
        return { status: 'success', label: '🎯 Accurately Flagged Sight-Typing (True Positive)' };
      }
      return { status: 'warning', label: '⚠️ Sight-Typing not yet flagged. Type chunk-by-chunk with glance pauses' };
    } else {
      if (isAuthentic && anomalyTimeline.length === 0) {
        return { status: 'success', label: '🛡️ Accurately Verified Authentic Coding (True Negative)' };
      }
      return { status: 'warning', label: '⚠️ Refactor or pause naturally to verify authentic problem solving' };
    }
  })();

  const summary = getTelemetrySummary(0, 0);

  const applyPreset = (preset: typeof PRESET_PROFILES[0]) => {
    setSelectedPresetId(preset.id);
    updateBaseline(preset.data);
  };

  return (
    <div className="h-full w-full flex flex-col bg-base-100 overflow-hidden font-sans">
      {/* Top Bar */}
      <div className="navbar bg-base-200 border-b border-base-300 px-4 min-h-12 shrink-0">
        <div className="navbar-start gap-3">
          <button onClick={onBack} className="btn btn-sm btn-ghost gap-1.5 text-xs">
            <ArrowLeft className="w-4 h-4" /> Back to Assessment
          </button>
          <div className="divider divider-horizontal mx-0" />
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary animate-pulse" />
            <span className="font-bold text-sm tracking-tight text-base-content">
              Personalized Keystroke Telemetry Lab
            </span>
            <span className="badge badge-xs badge-primary font-mono text-[10px]">Adaptive Biometrics</span>
          </div>
        </div>

        <div className="navbar-end gap-2">
          <button
            onClick={onOpenCalibration}
            className="btn btn-xs btn-outline btn-secondary gap-1.5 text-xs"
            title="Open the Monaco calibration modal to calibrate your personal typing"
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Calibrate My Typing (Warm-Up)</span>
          </button>

          <button
            onClick={() => {
              setCode(`function solution(numbers) {\n  \n}\n`);
              window.location.reload();
            }}
            className="btn btn-xs btn-ghost gap-1 border border-base-300 text-xs"
            title="Reset test session"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Test Data</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

        {/* ── Left Pane: Monaco Editor Testing Playground ── */}
        <div className="w-full lg:w-[48%] flex flex-col border-r border-base-300 bg-base-100 overflow-hidden">
          {/* Test Scenario Selector Banner */}
          <div className="p-3 bg-base-200/60 border-b border-base-300 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-base-content/70">Simulation Target:</span>
            </div>

            <div className="join">
              <button
                onClick={() => setTestMode('reading')}
                className={`join-item btn btn-xs ${testMode === 'reading' ? 'btn-error text-white' : 'btn-ghost border border-base-300'}`}
              >
                👁️ Sight-Typing (Transcribing)
              </button>
              <button
                onClick={() => setTestMode('organic')}
                className={`join-item btn btn-xs ${testMode === 'organic' ? 'btn-success text-white' : 'btn-ghost border border-base-300'}`}
              >
                🧠 Authentic Coding
              </button>
            </div>
          </div>

          {/* Test Instructions Prompt */}
          <div className="px-4 py-2 bg-base-200/30 border-b border-base-300 text-xs text-base-content/70 flex items-center justify-between">
            {testMode === 'reading' ? (
              <span className="text-error font-medium flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" />
                <strong>Sight-Typing Simulation:</strong> Pause for 1.5–3s to glance at a second screen/phone, then type a chunk (12–30 chars). Typos & backspaces are natural and accounted for!
              </span>
            ) : (
              <span className="text-success font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <strong>Authentic Simulation:</strong> Code naturally. Pause to formulate logic, rewrite expressions, navigate lines, and use autocomplete.
              </span>
            )}
            <span className="text-[11px] font-mono text-base-content/50">Monaco suggestions: ON</span>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 min-h-0 relative">
            <Editor
              height="100%"
              language="javascript"
              value={code}
              onChange={(val) => setCode(val || '')}
              onMount={handleEditorMount}
              theme={isDark ? 'vs-dark' : 'vs'}
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', monospace",
                lineNumbers: 'on',
                quickSuggestions: true,
                suggestOnTriggerCharacters: true,
                tabCompletion: 'on',
                autoClosingBrackets: 'always',
                autoClosingQuotes: 'always',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                minimap: { enabled: false },
              }}
            />
          </div>
        </div>

        {/* ── Right Pane: Real-Time Telemetry HUD & Diagnostics ── */}
        <div className="w-full lg:w-[52%] flex flex-col bg-base-100 overflow-y-auto p-4 space-y-3.5">

          {/* 1. Real-Time Integrity Score Card */}
          <div className={`card border shadow-sm p-4 ${
            isHighRisk ? 'bg-error/10 border-error/30 text-error-content' :
            isMediumRisk ? 'bg-warning/10 border-warning/30 text-warning-content' :
            'bg-success/10 border-success/30 text-success-content'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase font-bold tracking-wider opacity-75">
                  Live Integrity Confidence Index
                </div>
                <div className="text-3xl font-extrabold flex items-baseline gap-2 mt-1">
                  <span>{confidencePct}%</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isHighRisk ? 'bg-error text-white' :
                    isMediumRisk ? 'bg-warning text-black' :
                    'bg-success text-white'
                  }`}>
                    {isHighRisk ? '🚨 SIGHT-TYPING DETECTED' :
                     isMediumRisk ? '⚠️ BORDERLINE IRREGULARITY' :
                     '✓ AUTHENTIC HUMAN PROBLEM SOLVING'}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[11px] opacity-75">Session Verdict</div>
                <div className="font-mono text-sm font-bold">
                  {summary.averageIntegrityConfidence < 0.6 ? 'FLAGGED FOR VIVA' : 'VERIFIED'}
                </div>
              </div>
            </div>

            {/* Ground Truth Validation Banner */}
            <div className="mt-3 pt-3 border-t border-base-content/10 flex items-center justify-between text-xs">
              <span className="font-semibold">{evaluationResult.label}</span>
              <span className="text-[11px] opacity-70">Target: {testMode === 'reading' ? 'Sight-Typer' : 'Authentic Developer'}</span>
            </div>
          </div>

          {/* 2. Personalized Biometric Baseline & Adaptive Learning Card */}
          <div className="bg-base-200/50 rounded-2xl border border-base-300 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-base-content">
                  Personalized Biometric Profile
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {currentMetrics.isTranscribingAnomaly ? (
                  <span className="badge badge-error badge-xs gap-1 text-[10px] text-white py-2 px-2">
                    <Lock className="w-3 h-3" /> Baseline Locked (Anomaly Active)
                  </span>
                ) : isAdapting ? (
                  <span className="badge badge-success badge-xs gap-1 text-[10px] text-white py-2 px-2 animate-pulse">
                    <Sparkles className="w-3 h-3" /> Online Adapting (EMA α=0.04)
                  </span>
                ) : (
                  <span className="badge badge-ghost badge-xs text-[10px] py-2 px-2 font-mono">
                    Calibrated ({baseline.sampleCount || 50} samples)
                  </span>
                )}
              </div>
            </div>

            {/* Profile Preset Switcher (Instantly proves personalization accuracy) */}
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-base-content/60 uppercase">
                Quick-Switch Profile Preset (Test How Identical Typing Yields Different Scores):
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {PRESET_PROFILES.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className={`btn btn-xs flex flex-col items-start py-1.5 h-auto text-left rounded-lg border ${
                      selectedPresetId === preset.id
                        ? 'btn-primary shadow-sm'
                        : 'btn-ghost bg-base-100 border-base-300 hover:border-primary/50'
                    }`}
                  >
                    <div className="font-bold text-[11px] leading-tight flex items-center justify-between w-full">
                      <span>{preset.label}</span>
                      {selectedPresetId === preset.id && <Check className="w-3 h-3" />}
                    </div>
                    <div className="text-[9px] opacity-70 font-mono mt-0.5">{preset.shortDesc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Calibrated Baseline Values */}
            <div className="grid grid-cols-4 gap-2 text-center pt-1 border-t border-base-300">
              <div className="bg-base-100 p-2 rounded-lg border border-base-300">
                <div className="text-[9px] text-base-content/60 uppercase font-semibold">Base Flight (μ)</div>
                <div className="text-sm font-mono font-bold text-base-content mt-0.5">{baselineMean}ms</div>
              </div>
              <div className="bg-base-100 p-2 rounded-lg border border-base-300">
                <div className="text-[9px] text-base-content/60 uppercase font-semibold">Base Jitter (σ²)</div>
                <div className="text-sm font-mono font-bold text-base-content mt-0.5">{baselineVar}ms²</div>
              </div>
              <div className="bg-base-100 p-2 rounded-lg border border-base-300">
                <div className="text-[9px] text-base-content/60 uppercase font-semibold">Glance Pause (t)</div>
                <div className="text-sm font-mono font-bold text-base-content mt-0.5">
                  {( (baseline.naturalPauseThresholdMs || 1800) / 1000).toFixed(1)}s
                </div>
              </div>
              <div className="bg-base-100 p-2 rounded-lg border border-base-300">
                <div className="text-[9px] text-base-content/60 uppercase font-semibold">Natural Entropy (H)</div>
                <div className="text-sm font-mono font-bold text-base-content mt-0.5">{baselineEntropy}</div>
              </div>
            </div>
          </div>

          {/* 3. Personalized Relative Divergence Gauges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* Speed Divergence Ratio */}
            <div className={`p-3 rounded-xl border ${
              liveSpeedRatio >= 1.85
                ? 'bg-error/15 border-error/40 text-error'
                : 'bg-base-200/70 border-base-300'
            }`}>
              <div className="text-[10px] uppercase font-semibold opacity-75">Speed Ratio (R_speed)</div>
              <div className="text-xl font-mono font-bold mt-0.5">{liveSpeedRatio}x</div>
              <div className="text-[10px] opacity-75">
                {liveSpeedRatio >= 1.85 ? '🚨 Unnatural acceleration' : 'Normal personal pace'}
              </div>
            </div>

            {/* Variance Collapse Ratio */}
            <div className={`p-3 rounded-xl border ${
              liveVarianceRatio < 0.28 && keystrokeCount > 15
                ? 'bg-error/15 border-error/40 text-error'
                : 'bg-base-200/70 border-base-300'
            }`}>
              <div className="text-[10px] uppercase font-semibold opacity-75">Jitter Ratio (R_var)</div>
              <div className="text-xl font-mono font-bold mt-0.5">{(liveVarianceRatio * 100).toFixed(0)}%</div>
              <div className="text-[10px] opacity-75">
                {liveVarianceRatio < 0.28 && keystrokeCount > 15 ? '🚨 Flattened sight beat' : 'Healthy human jitter'}
              </div>
            </div>

            {/* Refactoring Edits */}
            <div className={`p-3 rounded-xl border ${
              currentMetrics.refactoringIndex === 0 && keystrokeCount > 30
                ? 'bg-warning/15 border-warning/40 text-warning-content'
                : 'bg-base-200/70 border-base-300'
            }`}>
              <div className="text-[10px] uppercase font-semibold opacity-75">Refactoring Index</div>
              <div className="text-xl font-mono font-bold mt-0.5">{currentMetrics.refactoringIndex}</div>
              <div className="text-[10px] opacity-75">
                Backspaces: {summary.backspaceCount}
              </div>
            </div>

            {/* Metronomic Entropy */}
            <div className={`p-3 rounded-xl border ${
              liveEntropyDelta > 0.20 && keystrokeCount > 20
                ? 'bg-warning/15 border-warning/40 text-warning-content'
                : 'bg-base-200/70 border-base-300'
            }`}>
              <div className="text-[10px] uppercase font-semibold opacity-75">Entropy Delta (ΔH)</div>
              <div className="text-xl font-mono font-bold mt-0.5">
                {liveEntropyDelta > 0 ? `-${liveEntropyDelta}` : `+${Math.abs(liveEntropyDelta)}`}
              </div>
              <div className="text-[10px] opacity-75">
                Live: {currentMetrics.metronomicEntropy}
              </div>
            </div>
          </div>

          {/* 4. Live Flagged Anomaly Feed */}
          <div className="bg-base-200/40 rounded-2xl border border-base-300 p-4 space-y-3 flex-1 flex flex-col min-h-[160px]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                Live Detected Anomalies ({anomalyTimeline.length})
              </h3>
              {anomalyTimeline.length > 0 && (
                <span className="badge badge-error badge-xs text-[10px] text-white">Triggered</span>
              )}
            </div>

            {anomalyTimeline.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-base-content/50 border border-dashed border-base-300 rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-success/50 mb-2" />
                <p className="font-semibold text-base-content/70">No anomalies detected in current window.</p>
                <p className="mt-1 max-w-sm text-[11px] leading-relaxed">
                  If testing sight-typing: glance away for 1.5–3s (simulating reading phone/screen), then type 15–30 characters. Even with normal typos and backspaces, the saccadic glance rhythm is detected!
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {anomalyTimeline.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                      item.severity === 'high'
                        ? 'bg-error/10 border-error/30 text-error-content'
                        : 'bg-warning/10 border-warning/30 text-warning-content'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {item.severity} SEVERITY ANOMALY
                      </span>
                      <span>Confidence: {Math.round(item.confidenceScore * 100)}%</span>
                    </div>
                    <div className="font-medium text-xs leading-snug">{item.anomalyReason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Forensic Explanation for Examiners & Users */}
          <div className="p-3.5 bg-base-200/60 rounded-xl border border-base-300 text-xs text-base-content/70 space-y-1.5">
            <div className="font-semibold text-base-content flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-primary" />
              <span>How Sight-Typing vs Genuine Coding is Differentiated (Pattern-Based):</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed">
              <li><strong>Saccadic Glance Rhythm</strong>: A glance pause of 1.2s–4.5s (reading phone/second screen) followed by a rapid memory burst of 12–35 characters.</li>
              <li><strong>Motor Slips vs Structural Refactoring</strong>: Sight-typers only make isolated 1–2 key typo corrections. They never erase entire algorithmic logic blocks or navigate lines.</li>
              <li><strong>Relative Jitter Collapse</strong>: Live intra-burst flight variance is compared to the candidate's personal calibrated variance. A drop below 28% signifies a mechanical sight beat.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
