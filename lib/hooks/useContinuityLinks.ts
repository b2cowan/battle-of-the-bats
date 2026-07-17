'use client';
import { useState, useEffect, useCallback } from 'react';
import type { ContinuityRow } from '@/lib/continuity-match';

/**
 * The returning-player scan + decide plumbing, shared by BOTH verify doors (the player
 * profile's Development card and the tryout Decision Board) so the fetch/reconcile/409
 * handling can never drift between them (3C /simplify extraction).
 *
 * `apiBase` = …/development/continuity (null/undefined disables — e.g. non-head-coach).
 * Scan errors are QUIET by design: no chip is the honest no-data state, and a scan hiccup
 * must never error its host surface. Decide errors surface via `error`.
 */
export function useContinuityLinks(
  apiBase: string | null | undefined,
  target: 'roster' | 'registrations',
  playerId?: string,
) {
  const [byCurrent, setByCurrent] = useState<Record<string, ContinuityRow[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!apiBase) return;
    let stale = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ target });
        if (playerId) qs.set('playerId', playerId);
        const res = await fetch(`${apiBase}?${qs.toString()}`);
        const json = await res.json().catch(() => null);
        if (!res.ok || !json || stale) return;
        setByCurrent(json.byCurrent ?? {});
      } catch { /* quiet */ }
    })();
    return () => { stale = true; };
  }, [apiBase, target, playerId]);

  const decide = useCallback(async (currentId: string, row: ContinuityRow, action: 'confirm' | 'reject') => {
    if (!apiBase || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/${row.linkId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.link) throw new Error(json?.error ?? "Couldn't save that — try again.");
      // Trust the SERVER's resulting status, not the requested action — a guarded
      // transition that answered anything other than confirmed must not paint confirmed.
      const confirmed = json.link.status === 'confirmed';
      setByCurrent(map => ({
        ...map,
        [currentId]: action === 'reject'
          ? (map[currentId] ?? []).filter(r => r.linkId !== row.linkId)
          : (map[currentId] ?? []).map(r => r.linkId === row.linkId && confirmed
            ? { ...r, status: 'confirmed' as const, decidedAt: json.link.decidedAt ?? null } : r),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that — try again.");
    } finally {
      setBusy(false);
    }
  }, [apiBase, busy]);

  /** "Not sure yet" — local dismiss only; the suggestion stays server-side and honestly
   *  resurfaces on a later visit. */
  const dismiss = useCallback((currentId: string, linkId: string) => {
    setByCurrent(map => ({ ...map, [currentId]: (map[currentId] ?? []).filter(r => r.linkId !== linkId) }));
  }, []);

  return { byCurrent, decide, dismiss, busy, error };
}
