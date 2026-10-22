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
        className="relative w-full max-w-3xl h-[82vh] bg-base-100 rounded-2xl shadow-2xl border border-base-300 flex flex-col overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 bg-base-200 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm text-base-content">Reference Manual</span>
            <span className="badge badge-xs badge-ghost">No internet needed</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="kbd kbd-xs">Esc</kbd>
            <button onClick={onClose} className="btn btn-xs btn-circle btn-ghost">
              <X className="w-3.5 h-3.5" />
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
