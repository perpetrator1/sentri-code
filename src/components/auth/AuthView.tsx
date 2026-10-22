import React, { useState } from 'react';
import { useAuth, type UserRole } from '../../context/AuthContext';
import { Shield, Sparkles, UserCheck, GraduationCap, ArrowRight, Lock, Mail, User as UserIcon } from 'lucide-react';

export const AuthView: React.FC = () => {
  const { login, register, quickLoginAs } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('candidate');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === 'login') {
        const res = await login(email, password);
        if (!res.success) {
          setError(res.error || 'Failed to sign in.');
        }
      } else {
        const res = await register(name, email, password, role);
        if (!res.success) {
          setError(res.error || 'Failed to create account.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (selectedRole: UserRole) => {
    setError(null);
    setLoading(true);
    try {
      await quickLoginAs(selectedRole);
    } catch (err: any) {
      setError('Could not complete demo login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-base-200/60 p-4 font-sans text-base-content antialiased">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-3 shadow-sm border border-primary/20">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-base-content">
            Sentri<span className="text-primary font-normal">Code</span>
          </h1>
          <p className="text-sm text-base-content/70 mt-1">
            Offline-first, anxiety-free coding assessments
          </p>
        </div>

        {/* Main Card */}
        <div className="card bg-base-100 shadow-xl border border-base-200">
          <div className="card-body p-6">
            {/* Quick Demo Logins Section */}
            <div className="mb-6 p-3.5 bg-base-200/50 rounded-xl border border-base-300/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-base-content/60 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Instant Demo Access
                </span>
                <span className="badge badge-xs badge-ghost text-[10px]">1-Click</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin('candidate')}
                  className="btn btn-sm btn-outline hover:btn-primary justify-start gap-2 h-auto py-2 normal-case font-medium text-xs"
                >
                  <UserCheck className="w-4 h-4 text-primary shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold leading-tight">Candidate</div>
                    <div className="text-[10px] opacity-70">Exam environment</div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin('examiner')}
                  className="btn btn-sm btn-outline hover:btn-secondary justify-start gap-2 h-auto py-2 normal-case font-medium text-xs"
                >
                  <GraduationCap className="w-4 h-4 text-secondary shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold leading-tight">Professor</div>
                    <div className="text-[10px] opacity-70">Forensics triage</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="divider text-xs text-base-content/40 my-1">OR CONTINUE WITH CREDENTIALS</div>

            {/* Tab switch */}
            <div className="tabs tabs-boxed bg-base-200/80 p-1 mb-4 grid grid-cols-2">
              <button
                type="button"
                className={`tab tab-sm font-medium ${tab === 'login' ? 'tab-active' : ''}`}
                onClick={() => { setTab('login'); setError(null); }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`tab tab-sm font-medium ${tab === 'register' ? 'tab-active' : ''}`}
                onClick={() => { setTab('register'); setError(null); }}
              >
                Create Account
              </button>
            </div>

            {error && (
              <div className="alert alert-error text-xs py-2 px-3 mb-4 rounded-lg flex items-center">
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {tab === 'register' && (
                <>
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Full Name</span>
                    </label>
                    <label className="input input-bordered input-sm flex items-center gap-2">
                      <UserIcon className="w-4 h-4 opacity-50" />
                      <input
                        type="text"
                        placeholder="e.g. Alex Rivera"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="grow text-xs"
                      />
                    </label>
                  </div>

                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-medium">Platform Role</span>
                    </label>
                    <select
                      className="select select-bordered select-sm text-xs"
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                    >
                      <option value="candidate">Candidate (Taking Assessment)</option>
                      <option value="examiner">Professor / Examiner (Review Audits)</option>
                      <option value="admin">System Administrator</option>
                    </select>
                  </div>
                </>
              )}

              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-xs font-medium">Email Address</span>
                </label>
                <label className="input input-bordered input-sm flex items-center gap-2">
                  <Mail className="w-4 h-4 opacity-50" />
                  <input
                    type="email"
                    placeholder="you@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="grow text-xs"
                  />
                </label>
              </div>

              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-xs font-medium">Password</span>
                </label>
                <label className="input input-bordered input-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 opacity-50" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="grow text-xs"
                  />
                </label>
                {tab === 'login' && (
                  <label className="label py-1 justify-end">
                    <span className="label-text-alt text-[11px] text-base-content/60">
                      Default password: <code className="bg-base-200 px-1 rounded">password123</code>
                    </span>
                  </label>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-sm w-full gap-2 mt-2 font-medium"
              >
                {loading ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <>
                    <span>{tab === 'login' ? 'Enter Assessment Portal' : 'Register & Enter'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Offline & Privacy Reassurance */}
        <div className="mt-4 text-center text-xs text-base-content/60 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success"></span>
          <span>Offline-capable • Privacy-first biometric telemetry • No webcam needed</span>
        </div>
      </div>
    </div>
  );
};
