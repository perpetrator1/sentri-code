import React, { useEffect } from 'react';
import { X, BookOpen } from 'lucide-react';
import { ReferenceManual } from './ReferenceManual';

interface QuickReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertSnippet: (snippet: string) => void;
  activeLanguage?: 'javascript' | 'python';
}

export const QuickReferenceModal: React.FC<QuickReferenceModalProps> = ({
  isOpen,
  onClose,
  onInsertSnippet,
  activeLanguage = 'javascript',
}) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl h-[88vh] bg-base-100 rounded-2xl shadow-2xl border border-base-300 flex flex-col overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-base-300 bg-base-200/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-base-content">Developer Reference Manual</span>
                <span className="badge badge-xs badge-success/15 text-success border border-success/30 font-semibold">
                  100% Offline
                </span>
              </div>
              <p className="text-[10px] text-base-content/50 hidden sm:block">Standard library algorithms, time complexities & syntax snippets</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-base-content/40 hidden md:inline">Press</span>
            <kbd className="kbd kbd-xs font-mono">⌘K</kbd>
            <span className="text-[11px] text-base-content/40 hidden md:inline">or</span>
            <kbd className="kbd kbd-xs font-mono">Esc</kbd>
            <button
              onClick={onClose}
              className="btn btn-xs btn-circle btn-ghost ml-1 hover:bg-base-300"
              title="Close Reference Manual (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          <ReferenceManual
            onInsertSnippet={snippet => { onInsertSnippet(snippet); onClose(); }}
            activeLanguage={activeLanguage}
          />
        </div>
      </div>
    </div>
  );
};
