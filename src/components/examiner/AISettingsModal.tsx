import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Shield,
  Key,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Cpu,
  Globe,
  X,
  ExternalLink,
  Server,
  RefreshCw,
} from 'lucide-react';
import {
  getAISummarySettings,
  saveAISummarySettings,
  syncServerAIStatus,
  getServerAIStatus,
  clearAISummaryCache,
  type AISummarySettings,
  type ServerAIStatus,
} from '../../services/aiSummaryService';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved: (settings: AISummarySettings) => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
}) => {
  const currentSettings = getAISummarySettings();
  const [enabled, setEnabled] = useState(currentSettings.enabled);
  const [provider, setProvider] = useState<'local' | 'gemini'>(currentSettings.provider);
  const [apiKey, setApiKey] = useState(currentSettings.apiKey);
  const [model, setModel] = useState(currentSettings.model || 'gemini-3.5-flash');
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [serverStatus, setServerStatus] = useState<ServerAIStatus | null>(getServerAIStatus());

  useEffect(() => {
    if (isOpen) {
      syncServerAIStatus().then((status) => {
        setServerStatus(status);
        if (status.hasServerKey && provider !== 'gemini') {
          setProvider('gemini');
        }
        if (status.model) {
          setModel(status.model);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const updated = saveAISummarySettings(
      {
        enabled,
        provider,
        apiKey: apiKey.trim(),
        model,
      },
      true
    );
    clearAISummaryCache();
    onSettingsSaved(updated);
    onClose();
  };

  const handleTestKey = async () => {
    setTestStatus('testing');
    setTestMessage('Verifying Gemini API connectivity...');

    // If candidate entered a custom key, test directly against Generative Language API
    if (apiKey.trim()) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Respond with the single word: OK' }] }],
          }),
        });

        if (res.ok) {
          setTestStatus('success');
          setTestMessage(`Gemini ${model} is working and verified!`);
        } else {
          const errorData = await res.json().catch(() => ({}));
          setTestStatus('error');
          setTestMessage(
            `Gemini Error (${res.status}): ${errorData?.error?.message || 'Invalid key or quota exceeded'}`
          );
        }
      } catch (err: any) {
        setTestStatus('error');
        setTestMessage(`Network failure: ${err.message || 'Could not reach Gemini API'}`);
      }
      return;
    }

    // If testing server-configured .env key
    if (serverStatus?.hasServerKey) {
      try {
        const token = localStorage.getItem('sentri_auth_token') || 'offline-examiner-token';
        const res = await fetch('/api/examiner/ai-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            submission: {
              candidateName: 'Test Connectivity Candidate',
              candidateId: 'test-ping-01',
              problemId: 'two-sum',
              score: 100,
              telemetrySummary: {
                totalKeystrokes: 150,
                meanFlightTime: 160,
                averageIntegrityConfidence: 0.95,
                backspaceCount: 12,
                cognitivePauseRatio: 0.2,
              },
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.source === 'gemini-api') {
            setTestStatus('success');
            setTestMessage(`Server .env key active: Successfully verified with Gemini (${serverStatus.model || 'gemini-3.5-flash'})`);
          } else {
            setTestStatus('error');
            setTestMessage('Backend returned local synthesis. Please check GEMINI_API_KEY in .env');
          }
        } else {
          setTestStatus('error');
          setTestMessage(`Server endpoint returned HTTP ${res.status}`);
        }
      } catch (err: any) {
        setTestStatus('error');
        setTestMessage(`Could not contact server: ${err.message}`);
      }
      return;
    }

    setTestStatus('error');
    setTestMessage('Please enter an API key or define GEMINI_API_KEY in .env file.');
  };

  return (
    <div className="modal modal-open modal-bottom sm:modal-middle z-50">
      <div className="modal-box bg-base-100 border border-base-300 shadow-2xl max-w-lg p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-base-300">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-base-content flex items-center gap-2">
                AI Authenticity Summary
                <span className="badge badge-xs badge-primary font-bold uppercase tracking-wider">
                  Optional
                </span>
              </h3>
              <p className="text-xs text-base-content/60">
                Executive forensic situation summaries for professors
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Master Feature Toggle */}
        <div className="p-3.5 rounded-2xl bg-base-200 border border-base-300 flex items-center justify-between">
          <div className="space-y-0.5 pr-4">
            <div className="font-bold text-xs text-base-content flex items-center gap-1.5">
              <span>Enable AI Situation Summaries</span>
              {enabled && (
                <span className="badge badge-xs badge-success text-white">Active</span>
              )}
            </div>
            <p className="text-[11px] text-base-content/60 leading-snug">
              Synthesizes typing variance, flight consistency, and glances into a 1-sentence professor recommendation.
            </p>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="toggle toggle-primary toggle-sm shrink-0"
          />
        </div>

        {enabled && (
          <div className="space-y-4 animate-fade-in">
            {/* Server .env Status Banner */}
            {serverStatus?.hasServerKey ? (
              <div className="p-3 rounded-xl bg-success/10 border border-success/30 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5 min-w-0">
                  <div className="font-bold text-success flex items-center gap-1.5">
                    <span>Server .env Key Detected</span>
                    <span className="badge badge-xs badge-success text-white font-mono">
                      {serverStatus.model || 'gemini-3.5-flash'}
                    </span>
                  </div>
                  <p className="text-base-content/75 text-[11px] leading-snug break-words">
                    Your key in <code className="font-mono text-[10px] bg-base-200 px-1 py-0.5 rounded">.env</code> is active. The professor dashboard automatically routes synthesis through Google Gemini.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-warning/10 border border-warning/30 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-warning-content flex items-center gap-1.5">
                    <span>No Server .env Key Found</span>
                  </div>
                  <p className="text-base-content/75 text-[11px] leading-snug">
                    Running in offline local forensic mode. To enable Google Gemini, paste your key below or add <code className="font-mono text-[10px] bg-base-200 px-1 rounded">GEMINI_API_KEY</code> to your <code className="font-mono text-[10px] bg-base-200 px-1 rounded">.env</code> file.
                  </p>
                </div>
              </div>
            )}

            {/* Provider Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-base-content/60">
                AI Engine Provider
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {/* Gemini Cloud API */}
                <button
                  type="button"
                  onClick={() => setProvider('gemini')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    provider === 'gemini'
                      ? 'border-secondary bg-secondary/10 ring-2 ring-secondary/30'
                      : 'border-base-300 bg-base-200/50 hover:bg-base-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-4 h-4 text-secondary" />
                    <span className="font-bold text-xs text-base-content">
                      Google Gemini API
                    </span>
                  </div>
                  <p className="text-[10px] text-base-content/60 leading-relaxed">
                    Cloud LLM synthesis with dynamic forensic reasoning.
                  </p>
                </button>

                {/* Local Engine */}
                <button
                  type="button"
                  onClick={() => setProvider('local')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    provider === 'local'
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                      : 'border-base-300 bg-base-200/50 hover:bg-base-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Cpu className="w-4 h-4 text-primary" />
                    <span className="font-bold text-xs text-base-content">
                      Local Forensics
                    </span>
                  </div>
                  <p className="text-[10px] text-base-content/60 leading-relaxed">
                    100% offline, privacy safe, zero latency.
                  </p>
                </button>
              </div>
            </div>

            {/* Gemini Configuration Inputs */}
            {provider === 'gemini' && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-secondary/5 border border-secondary/20 animate-slide-up">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-base-content flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-secondary" />
                    Gemini API Key
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-secondary hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Get Free Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setTestStatus('idle');
                    }}
                    placeholder={
                      serverStatus?.hasServerKey
                        ? 'Using server .env key (or enter custom key to override)'
                        : 'AIzaSy...'
                    }
                    className="input input-sm input-bordered w-full font-mono text-xs pr-16 bg-base-100 placeholder:text-base-content/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content text-xs p-1"
                    title={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-base-content/60">Model:</span>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="select select-bordered select-xs text-[11px] font-mono"
                    >
                      <option value="gemini-3.5-flash">gemini-3.5-flash (Recommended)</option>
                      <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Fastest)</option>
                      <option value="gemini-flash-latest">gemini-flash-latest</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestKey}
                    disabled={testStatus === 'testing' || (!apiKey.trim() && !serverStatus?.hasServerKey)}
                    className="btn btn-xs btn-outline btn-secondary gap-1"
                  >
                    {testStatus === 'testing' && <span className="loading loading-spinner loading-xs" />}
                    <span>Test Connection</span>
                  </button>
                </div>

                {testStatus === 'success' && (
                  <div className="text-[11px] text-success flex items-center gap-1.5 font-medium bg-success/10 p-2.5 rounded-lg border border-success/20">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="break-words">{testMessage}</span>
                  </div>
                )}

                {testStatus === 'error' && (
                  <div className="text-[11px] text-error flex items-center gap-1.5 font-medium bg-error/10 p-2.5 rounded-lg border border-error/20">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="break-words">{testMessage}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div className="modal-action pt-2 border-t border-base-300 flex items-center justify-between">
          <button onClick={onClose} className="btn btn-sm btn-ghost text-xs">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-sm btn-primary text-white text-xs px-4 gap-1.5 font-bold shadow-xs"
          >
            <span>Save Preferences</span>
          </button>
        </div>
      </div>
    </div>
  );
};
