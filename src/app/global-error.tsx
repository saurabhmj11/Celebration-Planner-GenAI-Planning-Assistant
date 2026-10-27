'use client';

import { useEffect } from 'react';

/**
 * Root-level error boundary — the last line of defense when the root layout
 * itself throws. Must render its own <html>/<body> (it replaces the layout).
 * LocalStorage data is untouched by any of this.
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[app/global-error]', error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b1220',
          color: '#e2e8f0',
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          padding: '1.5rem',
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: '26rem',
            borderRadius: '1.5rem',
            border: '1px solid #334155',
            background: '#141d33',
            padding: '2rem',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.15rem' }}>
            Celebration &amp; Event Planner
          </h1>
          <p
            style={{
              margin: '0.75rem 0 0',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              color: '#94a3b8',
            }}
          >
            A critical error stopped the app from loading. Your celebration
            data is safe in this browser&apos;s local storage — nothing was
            lost. Try again, or reload the page.
          </p>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                borderRadius: '0.75rem',
                border: 'none',
                padding: '0.6rem 1.1rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                background: '#7c3aed',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                borderRadius: '0.75rem',
                border: '1px solid #334155',
                padding: '0.6rem 1.1rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                background: 'transparent',
                color: '#cbd5e1',
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
