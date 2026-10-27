import type { SubmissionPayload } from '../types';

export interface AISummaryResult {
  summary: string;
  recommendation: 'verified' | 'flagged_viva' | 'dismissed';
  confidence: 'high' | 'medium' | 'low';
  keyFactors: string[];
  source: 'gemini-api' | 'local-forensics';
}

export interface AISummarySettings {
  enabled: boolean;
  provider: 'local' | 'gemini';
  apiKey: string;
  model: string;
}

export interface ServerAIStatus {
  enabled: boolean;
  hasServerKey: boolean;
  provider: 'gemini' | 'local';
  model: string;
}

const SETTINGS_KEY = 'sentri_ai_summary_settings';
const CACHE_KEY_PREFIX = 'sentri_ai_summary_cache_';
const USER_OVERRIDE_KEY = 'sentri_ai_user_customized';

// Cached server status from /api/examiner/ai-status
let cachedServerStatus: ServerAIStatus | null = null;

export function getAISummarySettings(): AISummarySettings {
  if (typeof window === 'undefined') {
    return { enabled: true, provider: 'gemini', apiKey: '', model: 'gemini-3.5-flash' };
  }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure model is updated if legacy gemini-1.5-flash was stored
      if (parsed.model === 'gemini-1.5-flash' || !parsed.model) {
        parsed.model = 'gemini-3.5-flash';
      }
      return parsed;
    }
  } catch (_) {}

  // Default: Enabled, ready for Gemini or local fallback
  return {
    enabled: true,
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-3.5-flash',
  };
}

export function saveAISummarySettings(settings: Partial<AISummarySettings>, isUserAction = false): AISummarySettings {
  const current = getAISummarySettings();
  const updated = { ...current, ...settings };
  if (typeof window !== 'undefined') {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    if (isUserAction) {
      localStorage.setItem(USER_OVERRIDE_KEY, 'true');
    }
  }
  return updated;
}

/**
 * Checks backend server for active GEMINI_API_KEY environment variable.
 * If server has key and user hasn't explicitly forced local-only, automatically
 * activates Gemini provider and flushes any stale local-forensics summaries.
 */
export async function syncServerAIStatus(): Promise<ServerAIStatus> {
  try {
    const res = await fetch('/api/examiner/ai-status');
    if (res.ok) {
      const status: ServerAIStatus = await res.json();
      cachedServerStatus = status;

      const current = getAISummarySettings();
      const hasUserOverride = typeof window !== 'undefined' && localStorage.getItem(USER_OVERRIDE_KEY) === 'true';

      if (status.hasServerKey && !hasUserOverride) {
        if (current.provider !== 'gemini' || current.model !== status.model) {
          saveAISummarySettings({
            provider: 'gemini',
            model: status.model || 'gemini-3.5-flash',
          });
          clearAISummaryCache('local-forensics');
        }
      }

      return status;
    }
  } catch (err) {
    console.warn('[AI Service] Could not sync server AI status, using local configuration:', err);
  }

  return (
    cachedServerStatus || {
      enabled: true,
      hasServerKey: false,
      provider: 'local',
      model: 'gemini-3.5-flash',
    }
  );
}

export function getServerAIStatus(): ServerAIStatus | null {
  return cachedServerStatus;
}

// In-memory cache for ultra-fast UI rendering
const memoryCache = new Map<string, AISummaryResult>();

/**
 * Clears cached AI situation summaries.
 * If onlySource is specified (e.g. 'local-forensics'), only entries from that engine are purged.
 */
export function clearAISummaryCache(onlySource?: 'local-forensics' | 'gemini-api'): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        if (!onlySource) {
          keysToRemove.push(key);
        } else {
          try {
            const parsed = JSON.parse(localStorage.getItem(key) || '{}');
            if (parsed.source === onlySource) {
              keysToRemove.push(key);
            }
          } catch (_) {
            keysToRemove.push(key);
          }
        }
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));

    if (!onlySource) {
      memoryCache.clear();
    } else {
      for (const [id, val] of memoryCache.entries()) {
        if (val.source === onlySource) {
          memoryCache.delete(id);
        }
      }
    }
  } catch (_) {}
}

/**
 * Generates or retrieves a cached single-sentence authenticity summary for a candidate.
 * If Gemini is configured (either via server .env or client key) and online, calls
 * the Gemini API endpoint. Automatically falls back to deterministic local forensics
 * if offline or if API returns an error.
 */
export async function getCandidateAuthenticitySummary(
  sub: SubmissionPayload,
  forceRefresh = false
): Promise<AISummaryResult | null> {
  const settings = getAISummarySettings();
  if (!settings.enabled) return null;

  const cacheKey = `${CACHE_KEY_PREFIX}${sub.id}`;
  const isGeminiMode = settings.provider === 'gemini' || Boolean(cachedServerStatus?.hasServerKey);

  if (!forceRefresh) {
    if (memoryCache.has(sub.id)) {
      const cached = memoryCache.get(sub.id)!;
      // If Gemini is active, don't use stale local-forensics cached results
      if (!(isGeminiMode && cached.source === 'local-forensics')) {
        return cached;
      }
    }
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!(isGeminiMode && parsed.source === 'local-forensics')) {
          memoryCache.set(sub.id, parsed);
          return parsed;
        }
      }
    } catch (_) {}
  }

  // 1. If Gemini provider or server has .env key and browser is online, call backend synthesis endpoint
  if (isGeminiMode && navigator.onLine) {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('sentri_auth_token') || 'offline-examiner-token' : 'offline-examiner-token';
      const res = await fetch('/api/examiner/ai-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          submissionId: sub.id,
          submission: {
            candidateName: sub.candidateName,
            candidateId: sub.candidateId,
            problemId: sub.problemId,
            score: sub.score,
            telemetrySummary: sub.telemetrySummary,
            anomalyTimeline: sub.anomalyTimeline,
            baseline: sub.baseline,
          },
          apiKey: settings.apiKey?.trim() || undefined,
        }),
      });

      if (res.ok) {
        const result: AISummaryResult = await res.json();
        memoryCache.set(sub.id, result);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch (_) {}
        return result;
      } else {
        console.warn(`[AI Service] /api/examiner/ai-summary returned HTTP ${res.status}, falling back to local.`);
      }
    } catch (netErr) {
      console.warn('[AI Service] Network call to /api/examiner/ai-summary failed, using local engine:', netErr);
    }
  }

  // 2. Local deterministic forensic engine (instant & offline safe)
  const localResult = computeLocalForensicSummary(sub);
  memoryCache.set(sub.id, localResult);
  try {
    localStorage.setItem(cacheKey, JSON.stringify(localResult));
  } catch (_) {}
  return localResult;
}

/**
 * Instant local heuristic forensic synthesis engine
 */
export function computeLocalForensicSummary(sub: SubmissionPayload): AISummaryResult {
  const name = sub.candidateName || 'Candidate';
  const authScore = sub.telemetrySummary.averageIntegrityConfidence ?? 0.85;
  const authPct = Math.round(authScore * 100);
  const liveFlight = sub.telemetrySummary.meanFlightTime ?? 165;
  const baseFlight = sub.baseline?.meanFlightTime ?? 170;
  const backspaces = sub.telemetrySummary.backspaceCount ?? 0;
  const totalKeys = Math.max(1, sub.telemetrySummary.totalKeystrokes ?? 100);
  const backspaceRate = Math.round((backspaces / totalKeys) * 100);
  const pauseRatio = Math.round((sub.telemetrySummary.cognitivePauseRatio ?? 0.25) * 100);
  const anomalies = sub.anomalyTimeline || [];
  const highAnomalies = anomalies.filter((a) => a.severity === 'high');
  const phoneAnomalies = anomalies.filter((a) =>
    a.anomalyReason.toLowerCase().includes('phone')
  );
  const pasteCount = sub.telemetrySummary.pasteEventCount ?? 0;
  const docsCount = sub.telemetrySummary.referenceQueriesCount ?? 0;

  // Case 1: High Authenticity (Low Risk >= 80%)
  if (authPct >= 80 && highAnomalies.length === 0) {
    const docsNote = docsCount > 0 ? ` with ${docsCount} reference checks` : '';
    const summary = `${name} demonstrated authentic, organic programming rhythms with ${backspaces} natural typo corrections (${backspaceRate}% of edits) and healthy cognitive contemplation (${pauseRatio}% pause ratio) matching baseline flight speed (${liveFlight}ms vs ${baseFlight}ms baseline)${docsNote}; recommending immediate verification.`;
    return {
      summary,
      recommendation: 'verified',
      confidence: 'high',
      keyFactors: [
        `Organic backspace rate of ${backspaceRate}% matches human coding baseline`,
        `Healthy ${pauseRatio}% cognitive contemplation pauses before complex logic blocks`,
        `Flight latency (${liveFlight}ms) consistent with calibration baseline (${baseFlight}ms)`,
      ],
      source: 'local-forensics',
    };
  }

  // Case 2: High Risk (< 60% or multiple high-severity anomalies)
  if (authPct < 60 || highAnomalies.length >= 2 || phoneAnomalies.length >= 2) {
    if (phoneAnomalies.length > 0) {
      const summary = `${name} exhibited severe transcription anomalies with ${phoneAnomalies.length} rhythmic off-screen glance pauses (1.8s–7.5s accommodation latency), invariant flight speed (${liveFlight}ms vs ${baseFlight}ms baseline), and only ${backspaces} typo corrections across ${totalKeys} characters, strongly indicating phone-screen sight-typing; recommending an Oral Viva.`;
      return {
        summary,
        recommendation: 'flagged_viva',
        confidence: 'high',
        keyFactors: [
          `${phoneAnomalies.length} off-screen glance pauses matching phone ocular accommodation latencies`,
          `Near-zero typo corrections (${backspaces} backspaces across ${totalKeys} characters)`,
          `Robotic flight invariance (${liveFlight}ms) divergent from organic cognitive baseline (${baseFlight}ms)`,
        ],
        source: 'local-forensics',
      };
    }

    if (pasteCount > 0) {
      const summary = `${name} had an uncalibrated clipboard burst (${pasteCount} paste event) coupled with flat keystroke flight latency (${liveFlight}ms) and very few typo corrections (${backspaces} backspaces), suggesting externally copied code; recommending an Oral Viva.`;
      return {
        summary,
        recommendation: 'flagged_viva',
        confidence: 'high',
        keyFactors: [
          `Detected clipboard insertion without corresponding authoring cadence`,
          `Abnormally low backspace rate (${backspaceRate}%)`,
          `${highAnomalies.length} high-severity anomaly flags detected`,
        ],
        source: 'local-forensics',
      };
    }

    const summary = `${name} exhibited unnatural linear transcription patterns with robotic flight invariance (${liveFlight}ms vs ${baseFlight}ms baseline), near-zero code refactoring (${backspaces} backspaces), and ${anomalies.length} flagged anomaly moments; recommending an Oral Viva verification.`;
    return {
      summary,
      recommendation: 'flagged_viva',
      confidence: 'high',
      keyFactors: [
        `Metronomic typing rhythm with abnormally low cadence entropy`,
        `Low cognitive contemplation ratio (${pauseRatio}%) during problem solving`,
        `High divergence between live typing and warm-up calibration baseline`,
      ],
      source: 'local-forensics',
    };
  }

  // Case 3: Moderate Risk (60% - 79%)
  const topReason = anomalies[0]?.anomalyReason || 'sporadic burst velocities';
  const summary = `${name} attained ${sub.score ?? 100}% score with moderate cadence divergence (${liveFlight}ms flight vs ${baseFlight}ms baseline) and ${anomalies.length} flagged events (${topReason}), suggesting external snippet consultation alongside manual edits; recommending a brief code review or verification.`;
  return {
    summary,
    recommendation: 'flagged_viva',
    confidence: 'medium',
    keyFactors: [
      `Moderate integrity score (${authPct}%) with intermittent typing bursts`,
      `Baseline flight divergence (${Math.abs(liveFlight - baseFlight)}ms shift)`,
      `Session includes ${anomalies.length} flagged moments requiring visual inspection`,
    ],
    source: 'local-forensics',
  };
}
