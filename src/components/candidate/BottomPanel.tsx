import React, { useState } from 'react';
import type { TestCase, TestResult } from '../../types';
import {
  CheckCircle2, XCircle, Play, ChevronUp, ChevronDown, Terminal, AlertTriangle,
} from 'lucide-react';

interface BottomPanelProps {
  testCases: TestCase[];
  testResults: TestResult[];
  isExecuting: boolean;
  onRunTests: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  testCases,
  testResults,
  isExecuting,
  onRunTests,
  isExpanded,
  onToggleExpand,
}) => {
  const [activeTab, setActiveTab] = useState(testCases[0]?.id || '');

  const resultMap = new Map(testResults.map(r => [r.testCaseId, r]));
  const selectedCase = testCases.find(tc => tc.id === activeTab) || testCases[0];
  const selectedResult = resultMap.get(selectedCase?.id);
  const passedCount = testResults.filter(r => r.passed).length;
  const allPassed = testResults.length > 0 && passedCount === testResults.length;

  return (
    <div className={`border-t border-base-300 bg-base-200 flex flex-col shrink-0 transition-all duration-200 ${isExpanded ? 'h-60 sm:h-72' : 'h-11'}`}>

      {/* Header strip */}
      <div className="h-11 px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button onClick={onToggleExpand} className="flex items-center gap-1.5 text-xs font-semibold text-base-content/70 hover:text-base-content transition-colors">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            Test Results
          </button>

          {testResults.length > 0 && (
            <span className={`badge badge-sm font-mono ${allPassed ? 'badge-success text-white' : 'badge-warning'}`}>
              {passedCount}/{testResults.length} passed
            </span>
          )}
        </div>

        <button
          onClick={onRunTests}
          disabled={isExecuting}
          className="btn btn-xs btn-primary gap-1.5"
        >
          {isExecuting ? <span className="loading loading-spinner loading-xs" /> : <Play className="w-3 h-3 fill-current" />}
          Run Tests
        </button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden bg-base-100 border-t border-base-300">
          {/* Test case list */}
          <div className="sm:w-44 shrink-0 border-r border-base-300 overflow-y-auto bg-base-200/40 p-2 flex sm:flex-col flex-row gap-1">
            {testCases.map((tc, idx) => {
              const r = resultMap.get(tc.id);
              const sel = activeTab === tc.id;
              return (
                <button
                  key={tc.id}
                  onClick={() => setActiveTab(tc.id)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors whitespace-nowrap sm:whitespace-normal ${
                    sel ? 'bg-base-300 font-semibold text-base-content' : 'hover:bg-base-200 text-base-content/60'
                  }`}
                >
                  <span className="flex-1 truncate">
                    {tc.isHidden ? `Case ${idx + 1} (Hidden)` : `Case ${idx + 1}`}
                  </span>
                  {r ? (
                    r.passed
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-error shrink-0" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-base-content/20 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Detail pane */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs select-text">
            {selectedCase && (
              <>
                <div className="flex items-center justify-between font-sans">
                  <span className="font-semibold text-sm text-base-content">{selectedCase.label}</span>
                  {selectedResult && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-base-content/50">{selectedResult.executionTimeMs ?? 0}ms</span>
                      <span className={`badge badge-sm font-bold ${selectedResult.passed ? 'badge-success text-white' : 'badge-error text-white'}`}>
                        {selectedResult.passed ? 'Pass' : 'Fail'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40 font-sans">Input</div>
                  <pre className="p-2.5 rounded-lg bg-base-200 border border-base-300 text-[11px] overflow-x-auto">{selectedCase.input}</pre>
                </div>

                {/* Expected */}
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40 font-sans">Expected</div>
                  <pre className="p-2.5 rounded-lg bg-base-200 border border-base-300 text-primary font-bold text-[11px] overflow-x-auto">{selectedCase.expected}</pre>
                </div>

                {/* Actual / Error */}
                {selectedResult && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40 font-sans">Your Output</div>
                    {selectedResult.error ? (
                      <div className="p-2.5 rounded-lg bg-error/10 border border-error/30 text-error text-[11px] flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{selectedResult.error}</span>
                      </div>
                    ) : (
                      <pre className={`p-2.5 rounded-lg border text-[11px] overflow-x-auto ${
                        selectedResult.passed ? 'bg-success/5 border-success/30 text-success' : 'bg-error/5 border-error/30 text-error'
                      }`}>{selectedResult.actual ?? 'undefined'}</pre>
                    )}
                  </div>
                )}

                {/* Stdout */}
                {selectedResult?.stdout && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40 font-sans flex items-center gap-1">
                      <Terminal className="w-3 h-3" /> Console
                    </div>
                    <pre className="p-2.5 rounded-lg bg-base-300/60 border border-base-300 text-[11px] overflow-x-auto">{selectedResult.stdout}</pre>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
