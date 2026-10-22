import React, { useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { FileText, RotateCcw, Code2 } from 'lucide-react';
import type { Problem } from '../../types';
import { ProblemStatement } from './ProblemStatement';

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
  onInsertSnippet?: (snippet: string) => void;
  theme: string;
  metrics?: any;
  baseline?: any;
  keystrokeCount?: number;
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
  theme,
  editorRef,
}) => {
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

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
      {/* ── Left Pane: Dedicated Problem Statement ── */}
      <div className="w-full md:w-[48%] flex flex-col border-r border-base-300 overflow-hidden bg-base-100">
        <div className="h-10 px-4 bg-base-200 border-b border-base-300 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold tracking-wide uppercase text-base-content/80">
              Problem Description
            </span>
          </div>
          <span className={`badge badge-xs font-medium ${
            problem.difficulty === 'Easy' ? 'badge-success' :
            problem.difficulty === 'Medium' ? 'badge-warning' : 'badge-error'
          }`}>
            {problem.difficulty}
          </span>
        </div>

        <div className="flex-1 overflow-hidden">
          <ProblemStatement problem={problem} />
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
            <span className="text-[11px] font-mono text-base-content/50 hidden sm:inline">
              {language === 'javascript' ? 'solution.js' : 'solution.py'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Font size */}
            <div className="join border border-base-300 rounded-lg overflow-hidden hidden sm:flex">
              <button
                onClick={() => setFontSize(f => Math.max(12, f - 1))}
                className="join-item btn btn-xs btn-ghost px-2 font-mono"
                title="Decrease font"
              >
                A-
              </button>
              <span className="join-item px-1.5 text-[11px] font-mono flex items-center bg-base-100 text-base-content/60">
                {fontSize}
              </span>
              <button
                onClick={() => setFontSize(f => Math.min(20, f + 1))}
                className="join-item btn btn-xs btn-ghost px-2 font-mono"
                title="Increase font"
              >
                A+
              </button>
            </div>

            {/* Reset */}
            <button
              onClick={onResetCode}
              className="btn btn-xs btn-ghost gap-1 text-base-content/60 hover:text-warning"
              title="Reset starter template"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden md:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 min-h-0 relative">
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={(val) => onChangeCode(val || '')}
            onMount={handleEditorDidMount}
            theme={isDark ? 'vs-dark' : 'vs'}
            options={{
              fontSize,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', monospace",
              fontLigatures: true,
              tabSize: 2,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              padding: { top: 12, bottom: 12 },
              wordWrap: 'on',
              folding: true,
              bracketPairColorization: { enabled: true },
            }}
          />
        </div>
      </div>
    </div>
  );
};
