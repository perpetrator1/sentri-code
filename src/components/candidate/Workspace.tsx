import React, { useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { FileText, BookOpen, Heart, RotateCcw, Code2, ChevronDown } from 'lucide-react';
import type { Problem } from '../../types';
import { ProblemStatement } from './ProblemStatement';
import { ReferenceManual } from './ReferenceManual';
import { KeystrokeReassuranceTab } from './KeystrokeReassuranceTab';

interface WorkspaceProps {
  problem: Problem;
  code: string;
  onChangeCode: (code: string) => void;
  language: 'javascript' | 'python';
  onChangeLanguage: (lang: 'javascript' | 'python') => void;
  onResetCode: () => void;
  onKeyDown: (e: any) => void;
  onKeyUp: (e: any) => void;
  onCursorChange: (offset: number) => void;
  onPaste: (length: number) => void;
  onInsertSnippet: (snippet: string) => void;
  theme: string;
  metrics: any;
  baseline: any;
  keystrokeCount: number;
  editorRef: React.MutableRefObject<any>;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  problem,
  code,
  onChangeCode,
  language,
  onChangeLanguage,
  onResetCode,
  onKeyDown,
  onKeyUp,
  onCursorChange,
  onPaste,
  onInsertSnippet,
  theme,
  metrics,
  baseline,
  keystrokeCount,
  editorRef,
}) => {
  const [activeLeftTab, setActiveLeftTab] = useState<'statement' | 'reference' | 'vibe'>('statement');
  const [fontSize, setFontSize] = useState<number>(14);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;

    editor.onDidChangeCursorPosition((e) => {
      const model = editor.getModel();
      if (model) onCursorChange(model.getOffsetAt(e.position));
    });

    editor.onKeyDown((e) => {
      onKeyDown({ key: e.browserEvent.key, code: e.browserEvent.code });
    });

    editor.onKeyUp((e) => {
      onKeyUp({ key: e.browserEvent.key, code: e.browserEvent.code });
    });

    editor.onDidPaste((e) => {
      const len = e.range ? e.range.endColumn - e.range.startColumn : 20;
      onPaste(len);
    });
  };

  const isDark = theme === 'ember';

  const tabs = [
    { id: 'statement', label: 'Problem', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'reference', label: 'Reference', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'vibe', label: '😌 How it Works', icon: null },
  ] as const;

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
      {/* ── Left Pane ── */}
      <div className="w-full md:w-[48%] flex flex-col border-r border-base-300 overflow-hidden bg-base-100">
        {/* Tab strip */}
        <div className="tabs tabs-bordered bg-base-200 border-b border-base-300 px-3 pt-1 shrink-0 gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveLeftTab(tab.id)}
              className={`tab tab-sm gap-1.5 text-xs font-medium transition-all ${
                activeLeftTab === tab.id
                  ? 'tab-active text-primary border-primary'
                  : 'text-base-content/60 hover:text-base-content'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {activeLeftTab === 'statement' && <ProblemStatement problem={problem} />}
          {activeLeftTab === 'reference' && (
            <ReferenceManual onInsertSnippet={onInsertSnippet} activeLanguage={language} />
          )}
          {activeLeftTab === 'vibe' && (
            <KeystrokeReassuranceTab metrics={metrics} baseline={baseline} keystrokeCount={keystrokeCount} />
          )}
        </div>
      </div>

      {/* ── Right Pane: Editor ── */}
      <div className="w-full md:w-[52%] flex flex-col overflow-hidden bg-base-100">
        {/* Editor toolbar */}
        <div className="h-10 px-3 bg-base-200 border-b border-base-300 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2">
            <Code2 className="w-3.5 h-3.5 text-primary" />
            <div className="join">
              <button
                onClick={() => onChangeLanguage('javascript')}
                className={`join-item btn btn-xs ${language === 'javascript' ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
              >
                JS
              </button>
              <button
                onClick={() => onChangeLanguage('python')}
                className={`join-item btn btn-xs ${language === 'python' ? 'btn-secondary' : 'btn-ghost border border-base-300'}`}
              >
                Py
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[11px] text-base-content/60">
              Font
              <select
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                className="select select-xs select-bordered bg-base-100 text-[11px] ml-1"
              >
                {[12, 13, 14, 15, 16, 18].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>

            <button
              onClick={onResetCode}
              className="btn btn-xs btn-ghost text-base-content/50 hover:text-error gap-1"
              title="Reset to starter code"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline text-[11px]">Reset</span>
            </button>
          </div>
        </div>

        {/* Monaco */}
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            theme={isDark ? 'vs-dark' : 'vs'}
            language={language}
            value={code}
            onChange={(val) => onChangeCode(val || '')}
            onMount={handleEditorDidMount}
            options={{
              fontSize,
              fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
              fontLigatures: true,
              minimap: { enabled: false },
              tabSize: 2,
              automaticLayout: true,
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              lineNumbers: 'on',
              folding: false,
              renderWhitespace: 'selection',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>
      </div>
    </div>
  );
};
