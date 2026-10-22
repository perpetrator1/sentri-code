import React, { useState, useRef } from 'react';
import type { BaselineCalibration } from '../../types';
import { ArrowRight, Coffee, ShieldCheck } from 'lucide-react';

interface BaselineCalibrationModalProps {
  isOpen: boolean;
  onComplete: (baseline: BaselineCalibration) => void;
  candidateId: string;
}

const WARMUP_PROMPT = `function doubleAll(items) {
  const result = [];
  for (let i = 0; i < items.length; i++) {
    result.push(items[i] * 2);
  }
  return result;
}`;

export const BaselineCalibrationModal: React.FC<BaselineCalibrationModalProps> = ({
  isOpen,
  onComplete,
  candidateId,
}) => {
  const [typedText, setTypedText] = useState('');
  const [flightTimes, setFlightTimes] = useState<number[]>([]);
  const [dwellTimes, setDwellTimes] = useState<number[]>([]);
  const lastKeyTimeRef = useRef<number>(performance.now());
  const keyDownMapRef = useRef<Map<string, number>>(new Map());

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const now = performance.now();
    if (!keyDownMapRef.current.has(e.code)) keyDownMapRef.current.set(e.code, now);
    const flight = Math.max(10, Math.round(now - lastKeyTimeRef.current));
    if (flight < 4000) setFlightTimes(prev => [...prev.slice(-80), flight]);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const now = performance.now();
    const downTime = keyDownMapRef.current.get(e.code);
    keyDownMapRef.current.delete(e.code);
    const dwell = downTime ? Math.max(10, Math.round(now - downTime)) : 70;
    lastKeyTimeRef.current = now;
    if (dwell < 1000) setDwellTimes(prev => [...prev.slice(-80), dwell]);
  };

  const calculateBaseline = (): BaselineCalibration => {
    const vf = flightTimes.length > 5 ? flightTimes : [150, 180, 160, 210, 190, 140];
    const vd = dwellTimes.length > 5 ? dwellTimes : [75, 80, 85, 70, 90];
    const mf = Math.round(vf.reduce((a, b) => a + b, 0) / vf.length);
    const varF = Math.round(vf.reduce((acc, ft) => acc + (ft - mf) ** 2, 0) / vf.length);
    const md = Math.round(vd.reduce((a, b) => a + b, 0) / vd.length);
    return {
      candidateId,
      meanFlightTime: Math.max(90, mf),
      varianceFlightTime: Math.max(1200, varF),
      meanDwellTime: Math.max(40, md),
      naturalBurstVelocity: Math.round(60000 / (mf + md)),
      recordedAt: Date.now(),
      sampleCount: vf.length,
    };
  };

  const progress = Math.min(100, Math.round((typedText.length / WARMUP_PROMPT.length) * 100));
  const ready = typedText.length >= 15;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-xl bg-base-100 shadow-2xl border border-base-300 animate-slide-up">

        {/* Header */}
        <div className="card-body p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl">👋</div>
            <div>
              <h2 className="text-lg font-bold text-base-content">Welcome! Let's get you set up.</h2>
              <p className="text-sm text-base-content/60 mt-0.5">
                A quick 30-second warm-up — type at your own normal pace. No pressure at all!
              </p>
            </div>
          </div>

          {/* Privacy reassurance — small and friendly */}
          <div className="alert alert-info py-2.5 text-xs rounded-xl">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              <strong>No cameras, no surveillance.</strong> We only measure the <em>rhythm</em> of your typing
              (timing between keys), never the actual characters you type.
            </span>
          </div>

          {/* Reference code block */}
          <div>
            <p className="text-xs text-base-content/50 mb-1.5 font-medium">Type this snippet at your natural pace:</p>
            <div className="mockup-code text-xs rounded-xl !bg-base-200 border border-base-300">
              <pre className="text-base-content/80 px-4 py-3 font-mono text-[12px] leading-relaxed"><code>{WARMUP_PROMPT}</code></pre>
            </div>
          </div>

          {/* Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-base-content/50">Your turn — type it out:</span>
              {flightTimes.length > 0 && (
                <span className="text-primary font-medium">{progress}% done ✓</span>
              )}
            </div>
            <textarea
              autoFocus
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              rows={4}
              placeholder="Start typing..."
              className="textarea textarea-bordered w-full font-mono text-sm focus:textarea-primary bg-base-100 leading-relaxed"
            />
            {flightTimes.length > 3 && (
              <progress className="progress progress-primary w-full" value={progress} max="100" />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => onComplete({ candidateId, meanFlightTime: 170, varianceFlightTime: 2350, meanDwellTime: 82, naturalBurstVelocity: 245, recordedAt: Date.now(), sampleCount: 60 })}
              className="btn btn-ghost btn-sm text-xs text-base-content/50"
            >
              Skip (use defaults)
            </button>

            <button
              onClick={() => onComplete(calculateBaseline())}
              disabled={!ready}
              className="btn btn-primary btn-sm gap-2"
            >
              <Coffee className="w-4 h-4" />
              I'm ready — Start!
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
