'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * A Reports view's read for the page's dates (the GST/HST return, Sales): one read per period and per Try again, and an answer is
 * kept only for the read that asked for it (a slow answer for old dates never paints over new ones). `fallback` is the sentence
 * when the route gives none.
 */
export type ReportRead<T> = { state: 'idle' | 'loading' } | { state: 'ready'; body: T } | { state: 'error'; error: string };

export function useReportRead<T>(path: string, from: string, to: string, ready: boolean, fallback: string): { load: ReportRead<T>; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; body?: T; error?: string } | null>(null);
  const key = ready ? `${from}|${to}|${attempt}` : null;

  useEffect(() => {
    if (!key) return;
    const abort = new AbortController();
    fetch(`${path}?${new URLSearchParams({ from, to })}`, { cache: 'no-store', signal: abort.signal })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (abort.signal.aborted) return; // aborted while the body was read: an empty body must not paint as an answer
        if (!response.ok) throw new Error(body.error ?? fallback);
        setResult({ key, body: body as T });
      })
      .catch(cause => { if (!abort.signal.aborted) setResult({ key, error: cause instanceof Error ? cause.message : fallback }); });
    return () => abort.abort();
  }, [key, path, from, to, fallback]);
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  const load: ReportRead<T> = !key ? { state: 'idle' } : result?.key !== key ? { state: 'loading' }
    : result.body ? { state: 'ready', body: result.body } : { state: 'error', error: result.error ?? fallback };
  return { load, retry };
}
