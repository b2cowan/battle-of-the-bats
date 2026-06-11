'use client';

import { useEffect } from 'react';
import { recordFromResponse } from '@/lib/observability/client-request-id';

type TaggedFetch = typeof window.fetch & { __flhqWrapped?: boolean };

/**
 * Installs a one-time window.fetch wrapper that records the `x-request-id` response header from any
 * same-origin API call into the client requestId stash, so the feedback widget can attach the last
 * error the user hit. Renders nothing. Mount once per authenticated shell (admin / coach / etc.).
 *
 * The "already wrapped" flag rides on window.fetch itself (not a module variable) so it stays
 * idempotent across Fast Refresh / HMR — a module-scope guard would reset on hot reload and stack
 * a fresh wrapper over the previous one each time.
 */
export default function FeedbackRequestIdProvider() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
    if ((window.fetch as TaggedFetch).__flhqWrapped) return;

    const original = window.fetch.bind(window);
    const wrapped = (async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const res = await original(...args);
      try {
        recordFromResponse(res);
      } catch {
        /* never let observability break the app's fetch */
      }
      return res;
    }) as TaggedFetch;
    wrapped.__flhqWrapped = true;
    window.fetch = wrapped;
  }, []);

  return null;
}
