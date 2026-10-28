import { CURATED_THEMES } from '../data/defaultData.js';

export const GEMINI_MODEL = 'gemini-2.0-flash';
export const BUILTIN_AI_ENDPOINT = '/api/ai/themes';
export const DEFAULT_TIMEOUT_MS = 45000; // 45 seconds timeout for complex JSON generation

/**
 * Service to generate personalized theme ideas and suggestions.
 *
 * Resolution order:
 * 1. If the user supplied their own Google Gemini API key -> call the live Gemini API directly.
 * 2. Otherwise -> call the app's built-in server-side GenAI engine (`/api/ai/themes`,
 *    powered by z-ai-web-dev-sdk on the backend).
 * 3. If live generation is unavailable -> instantly fall back to the Smart Offline
 *    Recommendation Engine (curated themes adapted to the event).
 */

// Helper to sanitize text and parse JSON reliably
function extractAndParseJSON(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response content received from the AI engine.');
  }

  let text = rawText.trim();

  // Strip markdown code fences if present (e.g. ```json ... ```)
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  // 1. Direct JSON parse attempt
  try {
    const directParsed = JSON.parse(text);
    if (directParsed && typeof directParsed === 'object') {
      return directParsed;
    }
  } catch {
    // Continue to regex extraction
  }

  // 2. Extract outermost { ... }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const extracted = JSON.parse(jsonMatch[0]);
      if (extracted && typeof extracted === 'object') {
        return extracted;
      }
    } catch {
      // Extracted block wasn't valid JSON; fall through to throw descriptive error below
    }
  }

  throw new Error('The AI response did not contain a valid themes JSON structure.');
}

// Map HTTP statuses, timeouts, and network failures to clear, accurate diagnostics
export function categorizeGeminiError(err) {
  const status = err?.status;
  const message = err?.message || '';
  const lowerMsg = message.toLowerCase();

  // 1. Explicit Timeout
  if (err?.isTimeout || err?.name === 'TimeoutError' || lowerMsg.includes('timed out')) {
    return {
      type: 'TIMEOUT',
      status: 408,
      title: 'Request Timed Out',
      userMessage: `The AI request timed out after ${Math.round(DEFAULT_TIMEOUT_MS / 1000)} seconds.`,
      guidance: 'The model took too long to complete theme generation. Please retry, or use the instant offline smart recommendations below.',
    };
  }

  // 2. Client Abort
  if (err?.name === 'AbortError' && !err?.isTimeout) {
    return {
      type: 'ABORTED',
      status: null,
      title: 'Request Cancelled',
      userMessage: 'The request was cancelled by the browser.',
      guidance: 'Click "Generate AI Concepts" to trigger a fresh request.',
    };
  }

  // 3. Network Failure
  if (err?.isNetwork || lowerMsg.includes('failed to fetch') || lowerMsg.includes('networkerror')) {
    return {
      type: 'NETWORK_ERROR',
      status: null,
      title: 'Network Connection Error',
      userMessage: 'Unable to reach the AI generation service.',
      guidance: 'Check your internet connection, proxy, or browser ad-blockers/firewalls.',
    };
  }

  // 4. Temporary High Demand / Server Overload (HTTP 503 or high demand text)
  if (
    status === 503 ||
    lowerMsg.includes('high demand') ||
    lowerMsg.includes('spikes in demand') ||
    lowerMsg.includes('temporarily unavailable')
  ) {
    return {
      type: 'TEMPORARY_HIGH_DEMAND',
      status: status || 503,
      title: `Temporary High Demand (HTTP ${status || 503})`,
      userMessage: 'The AI engine is currently experiencing high demand.',
      guidance: 'Spikes in demand are usually temporary. Wait 15–30 seconds and retry, or load our smart offline recommendations immediately.',
    };
  }

  // 5. Quota / Rate Limit Exceeded (HTTP 429 without high demand text)
  if (status === 429) {
    return {
      type: 'QUOTA_EXCEEDED',
      status: 429,
      title: 'Rate Limit / Quota Exceeded (HTTP 429)',
      userMessage: 'Your AI request rate limit or project quota has been reached.',
      guidance: 'Please wait a moment before retrying, or switch to the instant offline recommendation engine.',
    };
  }

  // 6. Authentication / Invalid Key (HTTP 401 / 403 / 400 with key error)
  if (status === 401 || status === 403 || (status === 400 && (lowerMsg.includes('key') || lowerMsg.includes('api_key')))) {
    return {
      type: 'INVALID_KEY',
      status: status || 401,
      title: `Authentication Error (HTTP ${status})`,
      userMessage: 'The provided Gemini API key is invalid or lacks access.',
      guidance: 'Please open AI Settings and verify that your API key is active and correctly copied from Google AI Studio.',
    };
  }

  // 7. Model Not Found (HTTP 404)
  if (status === 404) {
    return {
      type: 'MODEL_NOT_FOUND',
      status: 404,
      title: 'Model Not Found (HTTP 404)',
      userMessage: `Model ${GEMINI_MODEL} was not found on API version v1beta.`,
      guidance: 'Verify that this model is supported and accessible for your API key project.',
    };
  }

  // 8. Bad Request (HTTP 400)
  if (status === 400) {
    return {
      type: 'BAD_REQUEST',
      status: 400,
      title: 'Bad Request (HTTP 400)',
      userMessage: message || 'Invalid parameters supplied in the request body.',
      guidance: 'Check prompt contents or generation configuration.',
    };
  }

  // 9. Other Server Errors (5xx)
  if (status >= 500) {
    return {
      type: 'SERVER_ERROR',
      status: status,
      title: `AI Engine Error (HTTP ${status})`,
      userMessage: 'The AI generation service encountered an internal error.',
      guidance: 'This is usually a temporary upstream issue. Please wait a moment and try again.',
    };
  }

  return {
    type: 'UNKNOWN',
    status: status || null,
    title: status ? `API Error (HTTP ${status})` : 'Unexpected Error',
    userMessage: message || 'An unexpected error occurred while communicating with the AI service.',
    guidance: 'Review browser console diagnostics for more details.',
  };
}

// Fill in any missing theme fields with sensible defaults
function formatThemes(rawThemes) {
  return (rawThemes || []).map((t, idx) => ({
    id: t.id || `live-ai-${Date.now()}-${idx}`,
    name: t.name || `Theme Concept #${idx + 1}`,
    tagline: t.tagline || 'Custom celebration concept crafted by AI',
    palette: Array.isArray(t.palette) && t.palette.length > 0 ? t.palette : ['#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4'],
    paletteNames: Array.isArray(t.paletteNames) ? t.paletteNames : ['Primary', 'Accent', 'Warm Glow', 'Highlight'],
    decorHighlights: Array.isArray(t.decorHighlights) && t.decorHighlights.length > 0
      ? t.decorHighlights
      : ['Custom tailored celebration decor styling'],
    recommendedMusic: t.recommendedMusic || 'Curated celebration playlist',
    cateringIdeas: t.cateringIdeas || 'Tailored catering and signature drink pairings',
    budgetTip: t.budgetTip || 'Prioritize 35-40% of budget on core venue & ambiance.',
  }));
}

export const geminiService = {
  /**
   * Generates tailored event themes and recommendations.
   *
   * @param {object} param0
   * @param {object} param0.event Active celebration data
   * @param {string} [param0.customPrompt] Optional vibe/vision notes
   * @param {string} [param0.apiKey] Optional user-supplied Gemini key for direct calls
   * @param {number} [param0.timeoutMs] Abort timeout in ms
   */
  async generateThemes({ event, customPrompt = '', apiKey = '', timeoutMs = DEFAULT_TIMEOUT_MS }) {
    const cleanKey = (apiKey || '').trim();

    // Case 1: User supplied their own Gemini key -> attempt a direct live Gemini API call
    if (cleanKey) {
      try {
        const liveResult = await this.callGeminiApi({ event, customPrompt, apiKey: cleanKey, timeoutMs });

        const rawThemes = Array.isArray(liveResult.themes)
          ? liveResult.themes
          : (Array.isArray(liveResult) ? liveResult : []);

        if (!rawThemes || rawThemes.length === 0) {
          throw new Error('Gemini API returned an empty list of theme concepts.');
        }

        return {
          success: true,
          source: 'gemini-live',
          modelUsed: liveResult._modelUsed || GEMINI_MODEL,
          themes: formatThemes(rawThemes),
          summary: liveResult.summary || `Personalized AI recommendations tailored for your ${event?.type || 'celebration'}.`,
        };
      } catch (err) {
        const errorInfo = categorizeGeminiError(err);
        const fallbackThemes = this.generateFallbackThemes(event, customPrompt);

        return {
          success: false,
          source: 'error',
          errorTitle: errorInfo.title,
          error: errorInfo.userMessage,
          guidance: errorInfo.guidance,
          errorType: errorInfo.type,
          rawError: err.message,
          status: err.status || errorInfo.status || null,
          fallbackThemes,
          summary: 'Live AI generation could not be completed.',
        };
      }
    }

    // Case 2: Built-in server-side GenAI engine (z-ai-web-dev-sdk backend route)
    try {
      const builtinResult = await this.callBuiltinEngine({ event, customPrompt, timeoutMs });

      if (builtinResult.themes && builtinResult.themes.length > 0) {
        return {
          success: true,
          source: 'live-ai',
          modelUsed: builtinResult.modelUsed || 'GenAI Engine',
          themes: formatThemes(builtinResult.themes),
          summary: builtinResult.summary || `Personalized AI recommendations tailored for your ${event?.type || 'celebration'}.`,
        };
      }
      throw new Error('The built-in AI engine returned no theme concepts.');
    } catch {
      // Fall through to Case 3 offline engine
    }

    // Case 3: Smart Offline Recommendation Engine (zero latency, always available)
    const fallbackThemes = this.generateFallbackThemes(event, customPrompt);
    return {
      success: true,
      source: 'local-ai-engine',
      notice: 'Generated using the Smart Offline Planning Engine.',
      themes: fallbackThemes,
      summary: `Tailored celebration concepts designed for a ${event?.type || 'celebration'} with ${event?.guestCount || 50} guests and a $${(event?.budget || 5000).toLocaleString()} budget.`,
    };
  },

  /**
   * Calls the app's built-in server-side GenAI route with an AbortController timeout.
   */
  async callBuiltinEngine({ event, customPrompt, timeoutMs = DEFAULT_TIMEOUT_MS }) {
    const controller = new AbortController();
    let isTimeout = false;
    const timeoutId = setTimeout(() => {
      isTimeout = true;
      controller.abort(new DOMException(`Request timed out after ${timeoutMs / 1000} seconds`, 'TimeoutError'));
    }, timeoutMs);

    try {
      const response = await fetch(BUILTIN_AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ event, customPrompt }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data) {
        const err = new Error(data?.error || `The built-in AI engine responded with HTTP ${response.status}.`);
        err.status = response.status;
        throw err;
      }

      const rawThemes = Array.isArray(data.themes) ? data.themes : [];
      if (rawThemes.length === 0) {
        throw new Error('The built-in AI engine returned no theme concepts.');
      }

      return {
        themes: rawThemes,
        summary: data.summary,
        modelUsed: data.model || 'GenAI Engine',
      };
    } catch (err) {
      if (isTimeout || err.name === 'TimeoutError') {
        const timeoutErr = new Error(`The AI request timed out after ${timeoutMs / 1000} seconds.`);
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Direct Gemini API Call using the v1beta generateContent endpoint
   * (only used when the user supplies their own Google AI Studio key).
   */
  async callGeminiApi({ event, customPrompt, apiKey, timeoutMs = DEFAULT_TIMEOUT_MS }) {
    const model = GEMINI_MODEL;
    // Use secure x-goog-api-key header; never expose key in URL query parameter
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const promptText = `
You are an elite celebration and luxury event designer.
Generate 3 distinct, creative, and actionable event theme ideas for:
- Event Type: ${event.type}
- Event Title: ${event.title}
- Guest Count: ${event.guestCount || 'Not specified'}
- Location: ${event.location || 'Local venue'}
- Total Budget: $${event.budget || 5000}
- Additional User Notes/Vibe: ${customPrompt || event.description || 'Modern, memorable, and elegant'}

Please respond strictly in valid JSON matching this schema:
{
  "summary": "Brief executive vision of these concepts (1-2 sentences)",
  "themes": [
    {
      "id": "unique-slug",
      "name": "Theme Name",
      "tagline": "Catchy evocative 1-sentence tagline",
      "palette": ["#HEX1", "#HEX2", "#HEX3", "#HEX4"],
      "paletteNames": ["Color 1", "Color 2", "Color 3", "Color 4"],
      "decorHighlights": [
        "Specific decor highlight 1",
        "Specific decor highlight 2",
        "Specific decor highlight 3",
        "Specific decor highlight 4"
      ],
      "recommendedMusic": "Atmosphere and music direction",
      "cateringIdeas": "Signature dishes, drinks, or serving style",
      "budgetTip": "Actionable budget optimization advice for this theme"
    }
  ]
}
Do not wrap in markdown quotes if possible, output raw JSON.
`;

    const controller = new AbortController();
    let isTimeout = false;
    const timeoutId = setTimeout(() => {
      isTimeout = true;
      controller.abort(new DOMException(`Request timed out after ${timeoutMs / 1000} seconds`, 'TimeoutError'));
    }, timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errorMsg = errData?.error?.message || `HTTP ${response.status} from ${model}`;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.details = errData?.error;
        throw err;
      }

      const data = await response.json();

      // Safely navigate candidates[0].content.parts[0].text
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText || typeof candidateText !== 'string' || !candidateText.trim()) {
        const finishReason = data?.candidates?.[0]?.finishReason;
        throw new Error(`Model ${model} returned no text content in candidates (finishReason: ${finishReason || 'UNKNOWN'}).`);
      }

      const parsed = extractAndParseJSON(candidateText);
      parsed._modelUsed = model;
      return parsed;
    } catch (err) {
      if (isTimeout || err.name === 'TimeoutError') {
        const timeoutErr = new Error(`Gemini API request timed out after ${timeoutMs / 1000} seconds.`);
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }

      if (err.name === 'AbortError' && !isTimeout) {
        const abortErr = new Error('Request was cancelled.');
        abortErr.isAborted = true;
        throw abortErr;
      }

      if (err instanceof TypeError || (err.message && err.message.toLowerCase().includes('failed to fetch'))) {
        const netErr = new Error('Network error: Unable to reach generativelanguage.googleapis.com');
        netErr.isNetwork = true;
        throw netErr;
      }

      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Smart local fallback theme generator customized to the user's specific event parameters
   */
  generateFallbackThemes(event, customPrompt = '') {
    const safeEvent = event || {};
    const type = (safeEvent.type || 'wedding').toLowerCase();
    const lowerPrompt = (customPrompt || '').toLowerCase();

    // Curated themes filtered by event type
    const matchingThemes = CURATED_THEMES.filter((t) => t.eventType === type);
    const otherThemes = CURATED_THEMES.filter((t) => t.eventType !== type);

    // Build 3 customized variations
    const baseList = matchingThemes.length >= 2
      ? [...matchingThemes, ...otherThemes].slice(0, 3)
      : [...matchingThemes, ...CURATED_THEMES].slice(0, 3);

    // Deep copy and adapt based on guest count and budget
    return baseList.map((item, idx) => {
      const budget = safeEvent.budget || 5000;
      const guests = safeEvent.guestCount || 50;
      const perGuest = Math.round(budget / (guests || 1));

      let adaptedBudgetTip = item.budgetTip;
      if (budget < 8000) {
        adaptedBudgetTip = `At ~$${perGuest}/guest: ${item.budgetTip} Prioritize statement lighting and DIY accents over dense flower walls.`;
      } else {
        adaptedBudgetTip = `With a healthy $${budget.toLocaleString()} budget: allocate 35% to premium venue & immersive ambiance to elevate this concept.`;
      }

      if (lowerPrompt && idx === 0) {
        return {
          ...item,
          id: `custom-ai-${Date.now()}-${idx}`,
          name: `${item.name} · Custom Tailored`,
          tagline: `Adapted for "${customPrompt}": ${item.tagline}`,
          budgetTip: adaptedBudgetTip,
        };
      }

      return {
        ...item,
        id: `adapted-${item.id}-${idx}`,
        budgetTip: adaptedBudgetTip,
      };
    });
  },
};
