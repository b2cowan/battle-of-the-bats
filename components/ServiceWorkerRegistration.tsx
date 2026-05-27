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
