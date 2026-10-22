import React from 'react';
import type { Problem } from '../../types';
import { Lightbulb, CheckCircle2 } from 'lucide-react';

interface ProblemStatementProps {
  problem: Problem;
}

export const ProblemStatement: React.FC<ProblemStatementProps> = ({ problem }) => {
  return (
    <div className="h-full overflow-y-auto p-5 space-y-5 select-text text-base-content">

      {/* Title */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-bold tracking-tight">{problem.title}</h2>
          <span className={`badge badge-sm ${
            problem.difficulty === 'Easy' ? 'badge-success' :
            problem.difficulty === 'Medium' ? 'badge-warning' : 'badge-error'
          }`}>
            {problem.difficulty}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {problem.tags.map(tag => (
            <span key={tag} className="badge badge-xs badge-ghost border border-base-300">{tag}</span>
          ))}
        </div>
      </div>

      <div className="divider my-0" />

      {/* Description — parse for guidance blocks */}
      <div className="prose prose-sm max-w-none text-base-content/90 leading-relaxed space-y-3">
        {problem.description.split('\n\n').map((para, idx) => {
          if (para.includes('Stress-Free Guidance')) {
            const lines = para.split('\n').filter(l => l && !l.includes('###'));
            return (
              <div key={idx} className="alert rounded-xl py-3 px-4 border border-primary/20 bg-primary/5 text-sm space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-primary text-xs">
                  <Lightbulb className="w-3.5 h-3.5" />
                  Tips for this problem
                </div>
                <ul className="space-y-1 mt-1">
                  {lines.map((line, li) => (
                    <li key={li} className="text-xs text-base-content/80 leading-relaxed">{line}</li>
                  ))}
                </ul>
              </div>
            );
          }
          return <p key={idx} className="text-sm">{para}</p>;
        })}
      </div>

      {/* Examples */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-base-content/50">Examples</h3>
        <div className="space-y-2">
          {problem.examples.map((ex, i) => (
            <div key={i} className="rounded-xl border border-base-300 bg-base-200/50 overflow-hidden text-xs font-mono">
              <div className="px-3 py-2 border-b border-base-300 text-[10px] font-bold text-base-content/50 font-sans uppercase tracking-wider">
                Example {i + 1}
              </div>
              <div className="p-3 space-y-1.5">
                <div><span className="text-base-content/50 font-sans">Input: </span>{ex.input}</div>
                <div><span className="text-base-content/50 font-sans">Output: </span><span className="text-primary font-bold">{ex.output}</span></div>
                {ex.explanation && (
                  <div className="pt-1 border-t border-base-300/60 text-[11px] font-sans text-base-content/60">
                    {ex.explanation}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Constraints */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-base-content/50">Constraints</h3>
        <ul className="space-y-1">
          {problem.constraints.map((c, i) => (
            <li key={i} className="text-xs font-mono text-base-content/70 flex items-start gap-2">
              <span className="text-base-content/30 mt-0.5">·</span>
              {c}
            </li>
          ))}
        </ul>
      </div>

      {/* Warm note at bottom */}
      <div className="flex items-start gap-2 text-xs text-base-content/50 bg-base-200/50 rounded-xl p-3 border border-base-300/50">
        <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
        <span>Take your time — pausing to think is a good sign, not a red flag.</span>
      </div>
    </div>
  );
};
