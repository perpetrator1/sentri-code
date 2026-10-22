import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, BookOpen, Play, Send, Eye, Clock,
  ChevronDown, Wifi, WifiOff, Moon, Sun, LogOut, User as UserIcon
} from 'lucide-react';
import type { Problem } from '../../types';
import type { User } from '../../context/AuthContext';

interface TopBarProps {
  problem: Problem;
  allProblems?: Problem[];
  onSelectProblem?: (p: Problem) => void;
  onOpenReference: () => void;
  onRunTests: () => void;
  onSubmitExam: () => void;
  isExecuting: boolean;
  lastAutosaveTime: number | null;
  currentMode: 'candidate' | 'examiner';
  onToggleMode: (mode: 'candidate' | 'examiner') => void;
  theme: string;
  onToggleTheme: () => void;
  user: User | null;
  onLogout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  problem,
  allProblems = [],
  onSelectProblem,
  onOpenReference,
  onRunTests,
  onSubmitExam,
  isExecuting,
  lastAutosaveTime,
  currentMode,
  onToggleMode,
  theme,
  onToggleTheme,
  user,
  onLogout,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [remainingSeconds, setRemainingSeconds] = useState(problem.timeLimitMinutes * 60);

  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setRemainingSeconds(p => p > 0 ? p - 1 : 0), 1000);
    return () => clearInterval(t);
  }, []);

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timerStr = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  const timerUrgent = remainingSeconds < 300; // last 5 min — subtle, no panic

  const autosaveStr = lastAutosaveTime
    ? new Date(lastAutosaveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const isStaff = user?.role === 'examiner' || user?.role === 'admin';

  return (
    <header className="navbar bg-base-200 border-b border-base-300 px-3 min-h-14 shrink-0 gap-2 select-none z-30">

      {/* ── Brand & Problem ── */}
      <div className="navbar-start gap-2 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <ShieldCheck className="w-4.5 h-4.5 text-primary" strokeWidth={2.2} />
          </div>
          <span className="font-extrabold text-sm text-primary hidden sm:block tracking-tight">
            Sentri Code
          </span>
        </div>

        <div className="divider divider-horizontal mx-0 hidden sm:flex" />

        {/* Problem picker */}
        {allProblems.length > 1 && onSelectProblem ? (
          <div className="dropdown">
            <label tabIndex={0} className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-lg hover:bg-base-300 transition-colors max-w-[220px]">
              <span className="text-sm font-semibold text-base-content truncate">{problem.title}</span>
              <span className={`badge badge-xs shrink-0 ${
                problem.difficulty === 'Easy' ? 'badge-success' :
                problem.difficulty === 'Medium' ? 'badge-warning' : 'badge-error'
              }`}>{problem.difficulty}</span>
              <ChevronDown className="w-3 h-3 text-base-content/40 shrink-0" />
            </label>
            <ul tabIndex={0} className="dropdown-content menu menu-sm shadow-lg bg-base-100 border border-base-300 rounded-2xl w-72 p-2 mt-1 z-50">
              <li className="menu-title text-xs text-base-content/50 mb-1">Choose a problem</li>
              {allProblems.map(p => (
                <li key={p.id}>
                  <button onClick={() => onSelectProblem(p)} className={`flex items-center justify-between rounded-xl ${p.id === problem.id ? 'bg-primary/10 font-semibold text-primary' : ''}`}>
                    <span>{p.title}</span>
                    <span className={`badge badge-xs ${p.difficulty === 'Easy' ? 'badge-success' : p.difficulty === 'Medium' ? 'badge-warning' : 'badge-error'}`}>{p.difficulty}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-base-content truncate max-w-[180px] md:max-w-[280px]">{problem.title}</span>
            <span className={`badge badge-xs shrink-0 ${
              problem.difficulty === 'Easy' ? 'badge-success' :
              problem.difficulty === 'Medium' ? 'badge-warning' : 'badge-error'
            }`}>{problem.difficulty}</span>
          </div>
        )}
      </div>

      {/* ── Centre: timer + autosave (calm, minimal) ── */}
      <div className="navbar-center hidden lg:flex items-center gap-4">
        {/* Calm timer */}
        <div className={`flex items-center gap-1.5 text-sm font-mono font-bold tabular-nums ${timerUrgent ? 'text-warning' : 'text-base-content/60'}`}>
          <Clock className="w-3.5 h-3.5" strokeWidth={2} />
          {timerStr}
        </div>

        {/* Online pill */}
        <div className={`flex items-center gap-1 text-[11px] ${isOnline ? 'text-success' : 'text-warning'}`}>
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span className="hidden xl:inline">{isOnline ? 'Connected' : 'Offline — saving locally'}</span>
        </div>

        {autosaveStr && (
          <span className="text-[11px] text-base-content/40 hidden xl:block">
            Autosaved {autosaveStr}
          </span>
        )}
      </div>

      {/* ── Right: actions & User Profile ── */}
      <div className="navbar-end gap-1.5">
        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="btn btn-xs btn-ghost btn-circle"
          title="Toggle theme"
        >
          {theme === 'cozy' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </button>

        {/* Reference Manual button */}
        <button
          onClick={onOpenReference}
          className="btn btn-sm btn-ghost gap-1.5 border border-base-300 hover:border-primary/50 text-xs"
          title="Reference Manual (Ctrl+K)"
        >
          <BookOpen className="w-3.5 h-3.5 text-primary" />
          <span className="hidden sm:inline">Docs</span>
          <kbd className="kbd kbd-xs hidden md:inline">⌘K</kbd>
        </button>

        {/* Run Tests */}
        <button
          onClick={onRunTests}
          disabled={isExecuting}
          className="btn btn-sm btn-primary gap-1.5 text-xs font-semibold"
        >
          {isExecuting
            ? <span className="loading loading-spinner loading-xs" />
            : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>Run</span>
        </button>

        {/* Submit */}
        <button
          onClick={onSubmitExam}
          className="btn btn-sm btn-accent gap-1.5 text-xs font-bold text-accent-content"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Submit</span>
        </button>

        {/* Examiner mode toggle (only visible to staff) */}
        {isStaff && (
          <button
            onClick={() => onToggleMode(currentMode === 'candidate' ? 'examiner' : 'candidate')}
            className={`btn btn-sm ${currentMode === 'examiner' ? 'btn-secondary' : 'btn-ghost border border-base-300 text-base-content/70'} text-xs gap-1`}
            title={currentMode === 'candidate' ? 'Forensics Triage' : 'Candidate Workspace'}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{currentMode === 'candidate' ? 'Triage' : 'Candidate'}</span>
          </button>
        )}

        {/* User Profile dropdown */}
        <div className="dropdown dropdown-end ml-1">
          <label tabIndex={0} className="btn btn-ghost btn-xs btn-circle avatar placeholder border border-base-300">
            <div className="bg-primary/10 text-primary rounded-full w-6 text-[10px] font-bold">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
            </div>
          </label>
          <ul tabIndex={0} className="dropdown-content menu menu-sm shadow-xl bg-base-100 border border-base-200 rounded-2xl w-56 p-2 mt-2 z-50">
            <li className="menu-title px-2 py-1.5 border-b border-base-200 mb-1">
              <div className="font-semibold text-xs text-base-content truncate">{user?.name || 'Candidate'}</div>
              <div className="text-[10px] text-base-content/60 truncate">{user?.email || 'user@sentri.dev'}</div>
              <div className="mt-1">
                <span className={`badge badge-xs uppercase font-bold tracking-wider ${
                  user?.role === 'examiner' ? 'badge-secondary' :
                  user?.role === 'admin' ? 'badge-accent' : 'badge-ghost'
                }`}>
                  {user?.role || 'candidate'}
                </span>
              </div>
            </li>
            <li>
              <button onClick={onLogout} className="text-error font-medium text-xs flex items-center gap-2 rounded-xl">
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
};
