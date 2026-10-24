import React from 'react';
import type { SlidingWindowMetrics, BaselineCalibration } from '../../types';
import { Lock, Brain, RotateCcw, Gauge, Activity } from 'lucide-react';

interface KeystrokeReassuranceTabProps {
  metrics: SlidingWindowMetrics;
  baseline: BaselineCalibration;
  keystrokeCount: number;
}

export const KeystrokeReassuranceTab: React.FC<KeystrokeReassuranceTabProps> = ({
  metrics,
  baseline,
  keystrokeCount,
}) => {
  const pct = Math.round(metrics.integrityConfidence * 100);

  const cards = [
    {
      emoji: '🔒',
      title: 'Your code stays private',
      desc: 'We only track the timing between keystrokes — never the actual characters, words, or your variable names.',
    },
    {
      emoji: '🧠',
      title: 'Thinking pauses = ✓ good',
      desc: 'Stopping to think for a second (or five) is totally normal. Our system knows pauses are part of real problem-solving.',
    },
    {
      emoji: '📱',
      title: 'Distance & pause intelligence',
      desc: 'We model the difference between looking at an adjacent screen vs. looking down at a phone. Healthy thinking pauses have natural rhythm variation and edits, keeping you protected.',
    },
    {
      emoji: '✏️',
      title: 'Fixing typos is healthy',
      desc: 'Backspacing, rewording, navigating around your code — this is what authentic coding looks like.',
    },
    {
      emoji: '📐',
      title: 'Calibrated to you',
      desc: `Your warm-up set your personal baseline at ~${baseline.meanFlightTime}ms between keys. You're judged against yourself, not anyone else.`,
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5 select-text">

      {/* Intro */}
      <div>
        <h3 className="font-bold text-base text-base-content mb-1">
          😌 How Sentri Code watches out for you
        </h3>
        <p className="text-sm text-base-content/60 leading-relaxed">
          This tab is fully transparent — here's exactly what our local telemetry does (and doesn't do).
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-3">
        {cards.map((c, i) => (
          <div key={i} className="flex gap-3 p-3.5 rounded-xl border border-base-300 bg-base-200/50">
            <span className="text-xl shrink-0">{c.emoji}</span>
            <div>
              <div className="font-semibold text-sm text-base-content">{c.title}</div>
              <p className="text-xs text-base-content/60 mt-0.5 leading-relaxed">{c.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Live meter */}
      <div className="rounded-xl border border-base-300 bg-base-200/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-base-content/70 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-primary" />
            Live session stats
          </span>
          <span className="text-xs text-base-content/50 font-mono">{keystrokeCount} keys so far</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-base-content/60">Typing authenticity</span>
            <span className="font-bold font-mono text-success">{pct}%</span>
          </div>
          <progress className="progress progress-success w-full h-2" value={pct} max="100" />
          <p className="text-[11px] text-base-content/40">
            {pct >= 85 ? '🟢 Looks completely natural — great rhythm!' :
             pct >= 65 ? '🟡 Within normal range — keep going.' :
             '🔴 Some unusual patterns detected. Remember: this is just informational.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Key interval', value: `${metrics.digraphLatencyMean}ms`, sub: 'avg time between keys' },
            { label: 'Thought pauses', value: `${Math.round(metrics.pauseDistribution.cognitive * 100)}%`, sub: 'healthy cognitive pauses' },
          ].map(stat => (
            <div key={stat.label} className="bg-base-100 rounded-lg p-2.5 border border-base-300/70 text-center">
              <div className="text-[10px] text-base-content/50 mb-0.5">{stat.label}</div>
              <div className="font-bold font-mono text-sm text-base-content">{stat.value}</div>
              <div className="text-[10px] text-base-content/40">{stat.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
