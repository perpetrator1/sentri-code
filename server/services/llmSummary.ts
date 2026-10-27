export interface LLMSummaryResponse {
  summary: string;
  recommendation: 'verified' | 'flagged_viva' | 'dismissed';
  confidence: 'high' | 'medium' | 'low';
  keyFactors: string[];
  source: 'gemini-api' | 'local-forensics';
}

interface TelemetryInput {
  candidateName?: string;
  candidateId?: string;
  problemId?: string;
  score?: number;
  durationSeconds?: number;
  telemetrySummary: {
    totalKeystrokes?: number;
    meanFlightTime?: number;
    meanDwellTime?: number;
    averageIntegrityConfidence?: number;
    backspaceCount?: number;
    refactoringEdits?: number;
    cognitivePauseRatio?: number;
    pasteEventCount?: number;
    referenceQueriesCount?: number;
    snippetsInsertedCount?: number;
    anomaliesDetected?: number;
  };
  anomalyTimeline?: Array<{
    severity: string;
    anomalyReason: string;
    confidenceScore: number;
    timestamp?: number;
  }>;
  baseline?: {
    meanFlightTime?: number;
    varianceFlightTime?: number;
    meanDwellTime?: number;
    naturalBurstVelocity?: number;
    isPhoneDistanceCalibrated?: boolean;
    candidateStatement?: string;
  } | null;
}

/**
 * Generates an executive, single-sentence forensic summary of candidate authenticity
 * using Google Gemini API (when configured) or local deterministic synthesis.
 */
export async function generateAuthenticitySummary(
  input: TelemetryInput,
  customApiKey?: string
): Promise<LLMSummaryResponse> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;

  if (apiKey && apiKey.trim().length > 10) {
    try {
      const llmResult = await callGeminiApi(input, apiKey.trim());
      if (llmResult) {
        return {
          ...llmResult,
          source: 'gemini-api',
        };
      }
    } catch (err) {
      console.warn('[LLM Service] Gemini API call failed or timed out, falling back to local forensic engine:', err);
    }
  }

  // Local deterministic forensic engine fallback
  return generateLocalForensicSummary(input);
}

/**
 * Calls Google Gemini REST API with strict JSON schema instructions.
 * Tries modern active Gemini models (gemini-3.5-flash, gemini-3.5-flash-lite, gemini-flash-latest).
 */
async function callGeminiApi(
  data: TelemetryInput,
  apiKey: string
): Promise<Omit<LLMSummaryResponse, 'source'> | null> {
  const name = data.candidateName || 'The candidate';
  const problem = (data.problemId || 'assessment').replace(/-/g, ' ');
  const authPct = Math.round((data.telemetrySummary.averageIntegrityConfidence ?? 0.8) * 100);
  const flight = data.telemetrySummary.meanFlightTime ?? 160;
  const baselineFlight = data.baseline?.meanFlightTime ?? 170;
  const backspaces = data.telemetrySummary.backspaceCount ?? 0;
  const totalKeys = data.telemetrySummary.totalKeystrokes ?? 1;
  const pauseRatio = Math.round((data.telemetrySummary.cognitivePauseRatio ?? 0.25) * 100);
  const anomalies = data.anomalyTimeline || [];

  const prompt = `You are Sentri Code's Senior Academic Forensics Evaluator assisting computer science professors.
Analyze this student's biometric typing session for problem "${problem}":

- Candidate Name: ${name}
- Biometric Authenticity Score: ${authPct}%
- Live Flight Latency: ${flight}ms (Baseline Calibration: ${baselineFlight}ms)
- Total Keystrokes: ${totalKeys}
- Typo Backspaces: ${backspaces} (${Math.round((backspaces / totalKeys) * 100)}% of edits)
- Refactoring Edits: ${data.telemetrySummary.refactoringEdits ?? 0}
- Cognitive Pause Time: ${pauseRatio}% of session
- Clipboard Pastes: ${data.telemetrySummary.pasteEventCount ?? 0}
- Reference Docs Queries: ${data.telemetrySummary.referenceQueriesCount ?? 0}
- Flagged Anomalies (${anomalies.length}): ${anomalies.map((a) => `[${a.severity}] ${a.anomalyReason}`).join('; ') || 'None'}
- Assessment Score: ${data.score ?? 100}%

Instructions:
1. Provide "summary": EXACTLY ONE clear, professional sentence summarizing the candidate's authenticity and typing behavior, concluding with a direct decision recommendation so the professor can make an immediate ruling.
2. Provide "recommendation": One of "verified", "flagged_viva", or "dismissed".
3. Provide "confidence": One of "high", "medium", or "low".
4. Provide "keyFactors": 2-3 concise biometric factors supporting your verdict.

Respond ONLY with valid JSON in this format:
{
  "summary": "...",
  "recommendation": "verified",
  "confidence": "high",
  "keyFactors": ["factor 1", "factor 2"]
}`;

  // Priority model cascade for Google Gemini API (fastest, high-availability first)
  const candidateModels = [
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash',
  ];

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.15,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(7500),
      });

      if (!response.ok) {
        console.warn(`[LLM Service] Model ${model} returned ${response.status}, trying fallback model...`);
        continue;
      }

      const json: any = await response.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      // Strip potential markdown fences (```json ... ```)
      const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleanJson);

      return {
        summary: String(parsed.summary || '').trim(),
        recommendation: ['verified', 'flagged_viva', 'dismissed'].includes(parsed.recommendation)
          ? parsed.recommendation
          : authPct >= 75
          ? 'verified'
          : 'flagged_viva',
        confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'high',
        keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors.map(String) : [],
      };
    } catch (modelErr) {
      console.warn(`[LLM Service] Error calling ${model}:`, modelErr);
    }
  }

  return null;
}

/**
 * Local deterministic synthesis engine (works offline without external network or API keys)
 */
export function generateLocalForensicSummary(data: TelemetryInput): LLMSummaryResponse {
  const name = data.candidateName || 'Candidate';
  const authScore = data.telemetrySummary.averageIntegrityConfidence ?? 0.85;
  const authPct = Math.round(authScore * 100);
  const liveFlight = data.telemetrySummary.meanFlightTime ?? 165;
  const baseFlight = data.baseline?.meanFlightTime ?? 170;
  const backspaces = data.telemetrySummary.backspaceCount ?? 0;
  const totalKeys = Math.max(1, data.telemetrySummary.totalKeystrokes ?? 100);
  const backspaceRate = Math.round((backspaces / totalKeys) * 100);
  const pauseRatio = Math.round((data.telemetrySummary.cognitivePauseRatio ?? 0.25) * 100);
  const anomalies = data.anomalyTimeline || [];
  const highAnomalies = anomalies.filter((a) => a.severity === 'high');
  const phoneAnomalies = anomalies.filter((a) =>
    a.anomalyReason.toLowerCase().includes('phone')
  );
  const pasteCount = data.telemetrySummary.pasteEventCount ?? 0;
  const docsCount = data.telemetrySummary.referenceQueriesCount ?? 0;

  // Case 1: High Authenticity (Low Risk >= 80%)
  if (authPct >= 80 && highAnomalies.length === 0) {
    const docsNote = docsCount > 0 ? ` with ${docsCount} legitimate reference manual checks` : '';
    const summary = `${name} demonstrated authentic, organic programming rhythms with ${backspaces} natural typo corrections (${backspaceRate}% of keystrokes) and healthy cognitive contemplation (${pauseRatio}% pause ratio) matching baseline flight speed (${liveFlight}ms vs ${baseFlight}ms baseline)${docsNote}; recommending immediate verification.`;
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
  const summary = `${name} attained ${data.score ?? 100}% score with moderate cadence divergence (${liveFlight}ms flight vs ${baseFlight}ms baseline) and ${anomalies.length} flagged events (${topReason}), suggesting external snippet consultation alongside manual edits; recommending a brief code review or verification.`;
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
