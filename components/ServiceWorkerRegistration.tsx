'use client';
/**
 * components/ServiceWorkerRegistration.tsx
 *
 * Registers /sw.js as the application service worker.
 * Must be a 'use client' component — navigator.serviceWorker is browser-only.
 * Renders nothing; side-effect only.
 *
 * Guards:
 *   - SSR: typeof window !== 'undefined'
 *   - Unsupported browsers: 'serviceWorker' in navigator
 */

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // In development, Turbopack reuses /_next/static chunk URLs while changing their
    // contents on every edit. The SW caches those chunks cache-first, so it serves stale
    // JS and throws "X is not a function" after an edit (see public/sw.js). The SW (push +
    // offline shell) is a production-only feature, so in dev we unregister it and drop its
    // caches instead — this also self-heals any already-registered stale SW on next load.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
      if (window.caches) {
        caches.keys().then(keys => keys.forEach(k => { if (k.startsWith('flhq-')) caches.delete(k); }));
      }
      return;
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then(registration => {
        // Log only in dev so production stays quiet
        if (process.env.NODE_ENV === 'development') {
          console.log('[SW] Registered:', registration.scope);
        }
      })
      .catch(err => {
        // Non-fatal — app works without the SW; push just won't be available
        console.warn('[SW] Registration failed:', err);
      });
  }, []);

  return null;
}
