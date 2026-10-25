import React from 'react';
import type { SlidingWindowMetrics, BaselineCalibration } from '../../types';
import { Lock, Brain, Smartphone, Edit3, Scale, Activity } from 'lucide-react';

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
      icon: Lock,
      title: 'Code privacy',
      desc: 'Only typing intervals and timing are tracked — never your characters, words, or variable names.',
    },
    {
      icon: Brain,
      title: 'Thinking pauses',
      desc: 'Natural pauses are expected and recognized as authentic problem-solving cadence.',
    },
    {
      icon: Smartphone,
      title: 'Distance intelligence',
      desc: 'Calibrated modeling distinguishes screen transcription glances from external phone glance pauses.',
    },
    {
      icon: Edit3,
      title: 'Refactoring and corrections',
      desc: 'Backspaces, cursor navigation, and code edits represent authentic human problem-solving.',
    },
    {
      icon: Scale,
      title: 'Personalized baseline',
      desc: `Your personal baseline is calibrated at ~${baseline.meanFlightTime}ms between keys.`,
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5 select-text">

      {/* Intro */}
      <div>
        <h3 className="font-bold text-base text-base-content mb-1">
          Telemetry & Privacy Details
        </h3>
        <p className="text-sm text-base-content/60 leading-relaxed">
          Overview of local keystroke dynamics and privacy protections.
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-3">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="flex gap-3 p-3.5 rounded-xl border border-base-300 bg-base-200/50">
              <div className="w-8 h-8 rounded-lg bg-base-300 flex items-center justify-center shrink-0 text-base-content/70">
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-sm text-base-content">{c.title}</div>
                <p className="text-xs text-base-content/60 mt-0.5 leading-relaxed">{c.desc}</p>
              </div>
            </div>
          );
        })}
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
          <p className="text-[11px] text-base-content/50">
            {pct >= 85 ? 'Authentic typing rhythm' :
             pct >= 65 ? 'Normal range' :
             'Unusual patterns flagged'}
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
