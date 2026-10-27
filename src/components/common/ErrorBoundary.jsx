'use client';

import React from 'react';
import { AlertTriangle, RotateCcw, Home, Download, RefreshCw } from 'lucide-react';

/**
 * Tab-level React error boundary.
 *
 * Rationale (gap audit): the planner is a client-heavy SPA — one throwing
 * component (a map tile, a chart, a malformed record) used to white-screen
 * the whole app. This boundary keeps the navbar/footer alive, explains that
 * localStorage data is untouched, and offers recovery paths in order of
 * destructiveness:
 *   1. Try Again      — re-render the tab (transient render errors clear)
 *   2. Dashboard      — reset + navigate home, other tabs still work
 *   3. Export Backup  — dump all events to JSON before anything else
 *   4. Reload Page    — last resort, still keeps localStorage
 *
 * The parent remounts the boundary via `key={currentTab}` so switching tabs
 * always starts from a clean slate.
 */
const buttonBase =
  'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // Surfaced in dev tooling; never exposes user data.
    console.error('[ErrorBoundary]', this.props.boundaryName || 'tab', error, errorInfo?.componentStack);
  }

  reset = () => this.setState({ error: null });

  goHome = () => {
    this.reset();
    this.props.onNavigateHome?.();
  };

  exportBackup = () => {
    this.props.onExportBackup?.();
  };

  reload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    const { error } = this.state;
    const { children } = this.props;

    if (!error) return children;

    const summary =
      typeof error?.message === 'string' && error.message.trim()
        ? error.message
        : 'Unknown error';

    return (
      <div
        role="alert"
        className="mx-auto my-10 w-full max-w-xl rounded-3xl border border-rose-200 bg-white p-8 shadow-card"
      >
        <div className="flex items-start gap-4">
          <div className="shrink-0 rounded-2xl bg-rose-50 p-3 text-rose-600">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold text-slate-900">
              Something went wrong
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              This section hit an unexpected error. Your celebration data is
              safe — everything lives in this browser&apos;s local storage and
              was not touched.
            </p>
            <p className="mt-2 truncate rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">
              {summary}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={this.reset}
            className={`${buttonBase} bg-brand-600 text-white hover:bg-brand-700`}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Try Again
          </button>
          <button
            type="button"
            onClick={this.goHome}
            className={`${buttonBase} bg-slate-100 text-slate-700 hover:bg-slate-200`}
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Dashboard
          </button>
          <button
            type="button"
            onClick={this.exportBackup}
            className={`${buttonBase} bg-slate-100 text-slate-700 hover:bg-slate-200`}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export Backup
          </button>
          <button
            type="button"
            onClick={this.reload}
            className={`${buttonBase} border border-slate-200 text-slate-600 hover:bg-slate-50`}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}
