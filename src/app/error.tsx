'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, RefreshCw, Home } from 'lucide-react';

/**
 * App-router error boundary (safety net behind the in-app tab boundary).
 * The planner stores everything client-side in localStorage — an error here
 * never destroys data, so the copy leads with reassurance + recovery.
 */
export default function AppError({ error, reset }) {
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div
        role="alert"
        className="w-full max-w-xl rounded-3xl border border-rose-200 bg-white p-8 shadow-card"
      >
        <div className="flex items-start gap-4">
          <div className="shrink-0 rounded-2xl bg-rose-50 p-3 text-rose-600">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold text-slate-900">
              The planner hit a snag
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              An unexpected error interrupted this page. Your celebration data
              is safe in this browser&apos;s local storage — nothing was lost.
            </p>
            <p className="mt-2 truncate rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">
              {error?.digest || error?.message || 'Unknown error'}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Try Again
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Planner
          </a>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}
