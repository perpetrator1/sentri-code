import React, { useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import { Search, Copy, Check, Code2, Clock, HardDrive } from 'lucide-react';
import { REFERENCE_ENTRIES, CATEGORY_LABELS } from '../../data/referenceManual';
import type { ReferenceEntry } from '../../types';
import { db } from '../../db';

interface ReferenceManualProps {
  onInsertSnippet: (snippet: string) => void;
  activeLanguage?: 'javascript' | 'python';
}

export const ReferenceManual: React.FC<ReferenceManualProps> = ({
  onInsertSnippet,
  activeLanguage = 'javascript',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLang, setSelectedLang] = useState<'all' | 'javascript' | 'python'>(activeLanguage);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [insertedId, setInsertedId] = useState<string | null>(null);

  const fuse = useMemo(() =>
    new Fuse(REFERENCE_ENTRIES, {
      keys: ['name', 'signature', 'description', 'snippet', 'tags', 'edgeCasesNotes'],
      threshold: 0.35,
      ignoreLocation: true,
    }), []);

  const entries = useMemo(() => {
    let list = REFERENCE_ENTRIES;
    if (searchQuery.trim()) list = fuse.search(searchQuery.trim()).map(r => r.item);
    if (selectedCategory !== 'all') list = list.filter(e => e.category === selectedCategory);
    if (selectedLang !== 'all') list = list.filter(e => e.language === selectedLang);
    return list;
  }, [searchQuery, selectedCategory, selectedLang, fuse]);

  const handleCopy = (entry: ReferenceEntry) => {
    navigator.clipboard.writeText(entry.snippet);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleInsert = (entry: ReferenceEntry) => {
    onInsertSnippet(entry.snippet);
    setInsertedId(entry.id);
    setTimeout(() => setInsertedId(null), 1500);
    db.reference_logs.add({ timestamp: Date.now(), query: searchQuery || entry.name, categoryFilter: selectedCategory, action: 'insert_snippet', entryId: entry.id }).catch(() => {});
  };

  return (
    <div className="flex flex-col h-full bg-base-100 overflow-hidden">

      {/* Search & filters */}
      <div className="p-3 space-y-2 border-b border-base-300 bg-base-200/60 shrink-0">
        {/* Search input */}
        <label className="input input-sm input-bordered flex items-center gap-2 bg-base-100">
          <Search className="w-3.5 h-3.5 text-base-content/40 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search — e.g. slice, Map, heapq, sort..."
            className="grow text-xs"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-base-content/40 hover:text-base-content text-sm font-bold">×</button>
          )}
        </label>

        {/* Lang toggle + category pills */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
          <div className="join shrink-0">
            {(['all', 'javascript', 'python'] as const).map(l => (
              <button key={l} onClick={() => setSelectedLang(l)}
                className={`join-item btn btn-xs capitalize ${selectedLang === l ? 'btn-primary' : 'btn-ghost border border-base-300'}`}>
                {l === 'all' ? 'All' : l === 'javascript' ? 'JS' : 'Py'}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-base-300 shrink-0" />

          {Object.entries(CATEGORY_LABELS).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`btn btn-xs rounded-full shrink-0 whitespace-nowrap ${
                selectedCategory === key ? 'btn-primary shadow-sm' : 'btn-ghost border border-base-300 text-base-content/60'
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div className="px-3 py-1.5 text-[11px] text-base-content/40 border-b border-base-300/50 bg-base-200/30 shrink-0">
        {entries.length} {entries.length === 1 ? 'entry' : 'entries'} · offline · no memorisation needed 😊
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {entries.length === 0 ? (
          <div className="text-center py-12 text-base-content/40 text-sm space-y-2">
            <div className="text-3xl">🔍</div>
            <p className="font-medium">Nothing found</p>
            <p className="text-xs">Try "sort", "map", "string", or "heap"</p>
          </div>
        ) : (
          entries.map(entry => (
            <div key={entry.id} className="card bg-base-100 border border-base-300 hover:border-primary/40 shadow-sm transition-all overflow-hidden">
              <div className="p-3.5 space-y-2.5">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm font-mono text-base-content">{entry.name}</span>
                      <span className="badge badge-xs badge-ghost border border-base-300 uppercase text-[9px] font-mono">{entry.language}</span>
                    </div>
                    <code className="text-[11px] text-primary font-mono block mt-0.5 break-all">{entry.signature}</code>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="badge badge-xs badge-ghost border border-base-300 gap-1 text-[10px] font-mono">
                      <Clock className="w-2.5 h-2.5" />{entry.timeComplexity}
                    </span>
                    <span className="badge badge-xs badge-ghost border border-base-300 gap-1 text-[10px] font-mono">
                      <HardDrive className="w-2.5 h-2.5" />{entry.spaceComplexity}
                    </span>
                  </div>
                </div>

                {/* Behaviour highlight */}
                <div className="bg-primary/5 border border-primary/20 rounded-lg px-2.5 py-1.5 text-[11px] text-base-content/80 flex items-start gap-2">
                  <span className="badge badge-xs badge-primary shrink-0 mt-0.5">Behaviour</span>
                  <span className="leading-snug">{entry.mutatesVsReturns}</span>
                </div>

                {/* Snippet */}
                <div className="relative group rounded-lg bg-base-200 border border-base-300 overflow-hidden">
                  <pre className="text-[11px] font-mono p-3 text-base-content/85 leading-relaxed overflow-x-auto select-text">{entry.snippet}</pre>
                  <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopy(entry)}
                      className={`btn btn-xs gap-1 ${copiedId === entry.id ? 'btn-success text-white' : 'bg-base-100 hover:bg-white border border-base-300'}`}
                    >
                      {copiedId === entry.id ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                    </button>
                    <button
                      onClick={() => handleInsert(entry)}
                      className={`btn btn-xs gap-1 ${insertedId === entry.id ? 'btn-success text-white' : 'btn-primary text-white'}`}
                    >
                      {insertedId === entry.id ? <><Check className="w-3 h-3" />Done!</> : <><Code2 className="w-3 h-3" />Insert</>}
                    </button>
                  </div>
                </div>

                {/* Edge case */}
                {entry.edgeCasesNotes && (
                  <p className="text-[11px] text-base-content/60 italic">
                    <span className="not-italic font-semibold text-warning">⚠ Gotcha: </span>
                    {entry.edgeCasesNotes}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
