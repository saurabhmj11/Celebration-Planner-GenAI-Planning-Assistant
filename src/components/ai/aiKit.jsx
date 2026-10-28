import React, { useCallback, useState } from 'react';
import { Sparkles, RefreshCw, WifiOff, Zap } from 'lucide-react';

/**
 * Shared building blocks for every AI panel — one consistent visual language:
 * amber "AI" gradient headers, uniform buttons, source attribution (live vs
 * offline engine), loading skeletons, and an aria-live state machine hook.
 */

/** Days from today (noon-anchored) until dateStr; negative when past. */
export function daysUntil(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 0;
  const target = new Date(`${dateStr}T12:00:00`);
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

export const AI_ACCENT_CLASSES = {
  card: 'bg-gradient-to-br from-amber-50 via-orange-50/60 to-rose-50/70 border-amber-200/80',
  iconWrap: 'bg-gradient-to-tr from-amber-400 via-orange-400 to-rose-400 shadow-md shadow-amber-500/25',
  button:
    'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:via-orange-600 hover:to-rose-600 text-white shadow-lg shadow-amber-500/30',
};

/** Card shell for AI surfaces. */
export function AiCard({ icon: Icon = Sparkles, title, subtitle, children, actions, id }) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={`rounded-3xl border shadow-card ${AI_ACCENT_CLASSES.card}`}
    >
      <div className="flex items-start justify-between gap-3 p-5 pb-0">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 ${AI_ACCENT_CLASSES.iconWrap}`}
            aria-hidden="true"
          >
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h3 id={id ? `${id}-title` : undefined} className="font-display font-extrabold text-slate-900 text-base leading-tight">
              {title}
            </h3>
            {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
      <div className="p-5 pt-4">{children}</div>
    </section>
  );
}

/** Primary "ask the AI" button with loading spinner state. */
export function AiButton({ onClick, loading = false, disabled = false, children, small = false, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-bold rounded-2xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        small ? 'px-3.5 py-1.5 text-xs' : 'px-5 py-2.5 text-sm'
      } ${AI_ACCENT_CLASSES.button} ${className}`}
    >
      {loading ? (
        <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        <Sparkles className="w-4 h-4" aria-hidden="true" />
      )}
      <span>{loading ? 'AI is thinking…' : children}</span>
    </button>
  );
}

/** Live-engine vs offline-engine attribution line. */
export function AiSourceNote({ result }) {
  if (!result) return null;
  if (result.source === 'live-ai') {
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 mt-3">
        <Zap className="w-3.5 h-3.5" aria-hidden="true" />
        Generated live by {result.model || 'GenAI engine'}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 mt-3">
      <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
      Smart Offline Planning Engine (live AI unavailable — try again later for live results)
    </p>
  );
}

/** Pulsing placeholder rows while the engine works. */
export function AiSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-2.5 animate-pulse" role="status" aria-label="AI is generating content">
      <div className="h-3 bg-amber-200/60 rounded-full w-3/4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3 bg-slate-200/80 rounded-full" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function AiErrorNote({ error }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mt-3">
      {error}
    </p>
  );
}

/**
 * Tiny state machine shared by every AI panel:
 *   status: idle -> loading -> done | error
 * `run` never throws — failures land in `error`.
 */
export function useAiRequest() {
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = useCallback(async (fn) => {
    setStatus('loading');
    setError(null);
    try {
      const res = await fn();
      setResult(res);
      setStatus('done');
      return res;
    } catch (err) {
      setError(err?.message || 'Something went wrong while generating AI guidance.');
      setStatus('error');
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  return { status, result, error, run, reset, isIdle: status === 'idle', isLoading: status === 'loading', isDone: status === 'done' };
}

/** Best-overlap mapping of a free-text category label onto a known id list. */
export function mapCategoryToFallback(rawLabel, knownCategories) {
  const normalize = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/&/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  const words = normalize(rawLabel);
  if (!words.length) return null;

  let best = null;
  let bestScore = 0;
  for (const cat of knownCategories) {
    const catWords = new Set(normalize(`${cat.label || cat.name || ''} ${cat.id || ''}`));
    let hits = 0;
    for (const w of words) if (catWords.has(w)) hits += 1;
    if (hits > bestScore) {
      bestScore = hits;
      best = cat.id;
    }
  }
  return bestScore > 0 ? best : null;
}

/** Map a task dueDate onto the app's timeline phase buckets. */
export function derivePhase(dueDate, eventDate) {
  if (!dueDate || !eventDate) return 'mid';
  const diff = daysUntil(eventDate) - daysUntil(dueDate); // days dueDate is before event
  if (diff > 45) return 'early';
  if (diff > 7) return 'mid';
  if (diff >= 1) return 'final';
  if (diff === 0) return 'day_of';
  return 'post';
}
