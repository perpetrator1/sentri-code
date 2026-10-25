import React, { useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import {
  Search,
  Copy,
  Check,
  Code2,
  Clock,
  HardDrive,
  BookOpen,
  Layers,
  Hash,
  Type,
  Calculator,
  ArrowUpDown,
  FileText,
  Lightbulb,
  X,
  Sparkles,
} from 'lucide-react';
import { REFERENCE_ENTRIES, CATEGORY_LABELS } from '../../data/referenceManual';
import type { ReferenceEntry } from '../../types';
import { db } from '../../db';

interface ReferenceManualProps {
  onInsertSnippet: (snippet: string) => void;
  activeLanguage?: 'javascript' | 'python';
}

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  all: BookOpen,
  arrays: Layers,
  objects_maps: Hash,
  strings: Type,
  math: Calculator,
  sorting_searching: ArrowUpDown,
  io_parsing: FileText,
};

export const ReferenceManual: React.FC<ReferenceManualProps> = ({
  onInsertSnippet,
  activeLanguage = 'javascript',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLang, setSelectedLang] = useState<'all' | 'javascript' | 'python'>(activeLanguage);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [insertedId, setInsertedId] = useState<string | null>(null);

  const fuse = useMemo(
    () =>
      new Fuse(REFERENCE_ENTRIES, {
        keys: ['name', 'signature', 'description', 'snippet', 'tags', 'edgeCasesNotes'],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    []
  );

  // Category counts based on active language filter
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    for (const key of Object.keys(CATEGORY_LABELS)) {
      counts[key] = 0;
    }
    for (const entry of REFERENCE_ENTRIES) {
      if (selectedLang === 'all' || entry.language === selectedLang) {
        counts.all = (counts.all || 0) + 1;
        if (counts[entry.category] !== undefined) {
          counts[entry.category] += 1;
        }
      }
    }
    return counts;
  }, [selectedLang]);

  const entries = useMemo(() => {
    let list = REFERENCE_ENTRIES;
    if (searchQuery.trim()) {
      list = fuse.search(searchQuery.trim()).map((r) => r.item);
    }
    if (selectedCategory !== 'all') {
      list = list.filter((e) => e.category === selectedCategory);
    }
    if (selectedLang !== 'all') {
      list = list.filter((e) => e.language === selectedLang);
    }
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
    db.reference_logs
      .add({
        timestamp: Date.now(),
        query: searchQuery || entry.name,
        categoryFilter: selectedCategory,
        action: 'insert_snippet',
        entryId: entry.id,
      })
      .catch(() => {});
  };

  const isMutating = (entry: ReferenceEntry) => {
    const text = `${entry.mutatesVsReturns} ${entry.tags.join(' ')}`.toLowerCase();
    return text.includes('mutates') || text.includes('mutate') || text.includes('in-place');
  };

  return (
    <div className="flex h-full bg-base-100 overflow-hidden select-none">
      {/* ── Left Category Sidebar ── */}
      <aside className="w-64 shrink-0 border-r border-base-300 bg-base-200/50 flex flex-col justify-between overflow-y-auto">
        <div className="p-3 space-y-1">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-base-content/40">
            Categories
          </div>
          {Object.entries(CATEGORY_LABELS).map(([key, config]) => {
            const Icon = CATEGORY_ICONS[key] || BookOpen;
            const count = categoryCounts[key] || 0;
            const isActive = selectedCategory === key;

            return (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-primary-content shadow-sm'
                    : 'text-base-content/75 hover:bg-base-300/70 hover:text-base-content'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary-content' : 'text-primary'}`} />
                  <span className="truncate">{config.label}</span>
                </div>
                <span
                  className={`badge badge-xs shrink-0 font-mono ${
                    isActive ? 'badge-neutral bg-primary-content/20 text-primary-content border-none' : 'badge-ghost border-base-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer Hint */}
        <div className="p-3 m-3 rounded-xl bg-base-300/40 border border-base-300/60 text-[11px] text-base-content/60 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-primary">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Developer Tip</span>
          </div>
          <p className="leading-snug">
            Click <strong className="text-base-content/80">Insert</strong> on any card to immediately paste the snippet into Monaco at your cursor.
          </p>
        </div>
      </aside>

      {/* ── Right Content Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-base-100">
        {/* Top Search & Filter Bar */}
        <div className="p-4 border-b border-base-300 bg-base-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          {/* Search Box */}
          <label className="input input-sm input-bordered flex items-center gap-2 grow bg-base-200/50 focus-within:bg-base-100 transition-colors">
            <Search className="w-3.5 h-3.5 text-base-content/40 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search methods, syntax, or algorithms (e.g. slice, Map, heapq, sort)..."
              className="grow text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="btn btn-ghost btn-xs btn-circle text-base-content/50 hover:text-base-content"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </label>

          {/* Language Switcher Join */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="join border border-base-300 rounded-xl overflow-hidden bg-base-200/50">
              <button
                onClick={() => setSelectedLang('all')}
                className={`join-item btn btn-xs px-3 font-semibold ${
                  selectedLang === 'all' ? 'btn-primary shadow-xs' : 'btn-ghost text-base-content/70'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedLang('javascript')}
                className={`join-item btn btn-xs px-3 font-semibold ${
                  selectedLang === 'javascript' ? 'btn-primary shadow-xs' : 'btn-ghost text-base-content/70'
                }`}
              >
                JavaScript
              </button>
              <button
                onClick={() => setSelectedLang('python')}
                className={`join-item btn btn-xs px-3 font-semibold ${
                  selectedLang === 'python' ? 'btn-primary shadow-xs' : 'btn-ghost text-base-content/70'
                }`}
              >
                Python
              </button>
            </div>
          </div>
        </div>

        {/* Results Counter Sub-bar */}
        <div className="px-5 py-2 text-[11px] text-base-content/50 bg-base-200/30 border-b border-base-300/40 flex items-center justify-between shrink-0">
          <span>
            Showing <strong className="text-base-content">{entries.length}</strong> {entries.length === 1 ? 'entry' : 'entries'}
            {selectedCategory !== 'all' && ` in ${CATEGORY_LABELS[selectedCategory]?.label || selectedCategory}`}
            {searchQuery && ` matching "${searchQuery}"`}
          </span>
          <span className="hidden md:inline">No memorization required · Full API docs available</span>
        </div>

        {/* Scrollable Cards Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 select-text">
          {entries.length === 0 ? (
            <div className="text-center py-16 text-base-content/40 space-y-3">
              <Search className="w-10 h-10 text-base-content/30 mx-auto" />
              <p className="font-semibold text-sm">No references found</p>
              <p className="text-xs max-w-sm mx-auto leading-relaxed">
                We couldn't find matching references for "{searchQuery}". Try searching for concepts like "slice", "sort", "map", "heap", or clear your filters.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setSelectedLang('all');
                }}
                className="btn btn-xs btn-outline btn-primary mt-2"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            entries.map((entry) => {
              const mutating = isMutating(entry);

              return (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-base-300 bg-base-100 hover:border-primary/40 shadow-sm transition-all overflow-hidden"
                >
                  <div className="p-4 space-y-3">
                    {/* Header: Name, Language, Complexities */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm font-mono text-base-content tracking-tight">
                            {entry.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wide uppercase border ${
                              entry.language === 'javascript'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                            }`}
                          >
                            {entry.language}
                          </span>
                        </div>
                        <p className="text-xs text-base-content/75 leading-relaxed">{entry.description}</p>
                      </div>

                      {/* Complexity Badges */}
                      <div className="flex sm:flex-col items-end gap-1.5 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-mono bg-base-200 text-base-content/70 border border-base-300">
                          <Clock className="w-3 h-3 text-primary/70 shrink-0" />
                          <span>{entry.timeComplexity}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-mono bg-base-200 text-base-content/70 border border-base-300">
                          <HardDrive className="w-3 h-3 text-secondary/70 shrink-0" />
                          <span>{entry.spaceComplexity}</span>
                        </span>
                      </div>
                    </div>

                    {/* Method Signature Box */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-1.5 font-mono text-xs text-primary break-all">
                      {entry.signature}
                    </div>

                    {/* In-Place Mutation vs Returns Copy Alert */}
                    <div
                      className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs leading-relaxed border ${
                        mutating
                          ? 'bg-warning/10 border-warning/30 text-base-content/90'
                          : 'bg-success/10 border-success/30 text-base-content/90'
                      }`}
                    >
                      <span
                        className={`badge badge-xs shrink-0 mt-0.5 uppercase tracking-wider font-bold ${
                          mutating ? 'badge-warning text-warning-content' : 'badge-success text-success-content'
                        }`}
                      >
                        {mutating ? 'Mutates in-place' : 'Immutable'}
                      </span>
                      <span>{entry.mutatesVsReturns}</span>
                    </div>

                    {/* Snippet Block with Action Buttons */}
                    <div className="relative rounded-xl bg-base-200/80 border border-base-300 overflow-hidden">
                      <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-base-300/70 bg-base-200 text-[11px] text-base-content/50 font-mono">
                        <span className="font-semibold">Example & Pattern</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCopy(entry)}
                            className={`btn btn-xs gap-1 font-sans ${
                              copiedId === entry.id
                                ? 'btn-success text-white'
                                : 'btn-ghost hover:bg-base-300 text-base-content/70 border border-base-300'
                            }`}
                            title="Copy snippet to clipboard"
                          >
                            {copiedId === entry.id ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleInsert(entry)}
                            className={`btn btn-xs gap-1 font-sans ${
                              insertedId === entry.id
                                ? 'btn-success text-white'
                                : 'btn-primary text-white shadow-xs'
                            }`}
                            title="Insert snippet directly into editor at cursor"
                          >
                            {insertedId === entry.id ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Inserted!</span>
                              </>
                            ) : (
                              <>
                                <Code2 className="w-3 h-3" />
                                <span>Insert</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <pre className="p-3.5 text-xs font-mono text-base-content/90 leading-relaxed overflow-x-auto select-text whitespace-pre">
                        {entry.snippet}
                      </pre>
                    </div>

                    {/* Gotchas & Edge Cases */}
                    {entry.edgeCasesNotes && (
                      <div className="flex items-start gap-2 text-xs bg-warning/5 border border-warning/20 rounded-xl p-2.5">
                        <Lightbulb className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                        <span className="text-base-content/80 leading-relaxed">
                          <strong className="text-warning font-semibold">Gotcha: </strong>
                          {entry.edgeCasesNotes}
                        </span>
                      </div>
                    )}

                    {/* Styled Pill Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-base-content/40 font-medium mr-0.5">Tags:</span>
                      {entry.tags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setSearchQuery(tag)}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-base-200 hover:bg-base-300 text-base-content/75 border border-base-300/80 hover:border-primary/40 transition-colors cursor-pointer group shadow-2xs"
                          title={`Filter by tag #${tag}`}
                        >
                          <span className="text-primary/70 font-mono text-[10px] group-hover:text-primary">#</span>
                          <span>{tag}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};