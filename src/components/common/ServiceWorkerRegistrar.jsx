'use client';

import React, { useEffect } from 'react';

/**
 * Registers the service worker — production builds only.
 *
 * In dev, a caching layer fights Turbopack HMR (stale chunks, ghost updates),
 * so registration is gated on NODE_ENV. The manifest + install prompt still
 * work everywhere; this component only controls the offline cache.
 */
export const ServiceWorkerRegistrar = () => {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return undefined;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return undefined;

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.warn('[sw] registration skipped:', err));
    };

    if (document.readyState === 'complete') {
      register();
      return undefined;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
};
