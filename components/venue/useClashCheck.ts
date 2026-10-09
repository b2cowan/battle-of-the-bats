'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClashFinding } from '@/lib/venue-clash';

/**
 * The Venue field's live check (Club Tier Stage 6a, Ask 5): re-asked on any change of date, times, venue or facility,
 * debounced, one small read through the shared lookup. `request` is null while the form can't be checked (no club
 * venue, no date); a result is shown only for the exact request it answered, so the line never describes a diamond
 * the person has already moved off.
 *
 * `lineIsCurrent` is Save's own check — ONE rule for every form that wears the field: it asks again at once, and if
 * the fresh answer holds more than the line on screen (a booking made while the form sat open), the line updates
 * and the form does NOT save yet; pressing Save again saves anyway. It never refuses, and a failed read never
 * holds a save back.
 *
 * `checking` is true while Save's own check is out. A form disables its Save on it: the save now starts after an
 * awaited read rather than inside the press, so without it a double press would create the booking twice. A press
 * that lands while a check is out answers false (the same press, never a second save).
 */
export function useClashCheck<T>(
  request: { path: string; body: unknown } | null,
  read: (json: unknown) => T,
  count: (result: T) => number,
  delayMs = 350,
): { result: T | null; checking: boolean; lineIsCurrent: () => Promise<boolean> } {
  const [state, setState] = useState<{ key: string; result: T } | null>(null);
  const [checking, setChecking] = useState(false);
  const inFlight = useRef(false);
  const key = request ? JSON.stringify([request.path, request.body]) : null;
  const latest = useRef({ request, read, count, key });
  // Kept current after every render; declared before the debounce, so it runs first.
  useEffect(() => { latest.current = { request, read, count, key }; });

  const run = useCallback(async (): Promise<T> => {
    const { request: r, read: parse } = latest.current;
    if (!r) throw new Error('nothing to check');
    const res = await fetch(r.path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r.body) });
    if (!res.ok) throw new Error('check failed');
    return parse(await res.json());
  }, []);

  useEffect(() => {
    if (key === null) return;
    let live = true;
    const t = setTimeout(() => {
      run().then(result => { if (live) setState({ key, result }); })
        .catch(() => { /* offline or refused — no line, never an error on the form */ });
    }, delayMs);
    return () => { live = false; clearTimeout(t); };
  }, [key, delayMs, run]);

  const result = key !== null && state?.key === key ? state.result : null;

  const lineIsCurrent = useCallback(async (): Promise<boolean> => {
    if (key === null) return true;
    if (inFlight.current) return false;
    inFlight.current = true;
    setChecking(true);
    const shown = result === null ? 0 : latest.current.count(result);
    try {
      const fresh = await run();
      // Only while the form still asks the same question — an answer for a diamond already left never replaces
      // the line for the one now picked.
      if (latest.current.key === key) setState({ key, result: fresh });
      return latest.current.count(fresh) <= shown;
    } catch {
      return true;
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }, [key, result, run]);

  return { result, checking, lineIsCurrent };
}

/** The coach's check answers one list of findings per date it was asked about (`…/venue-clashes`). */
export function readFindingsPerDate(json: unknown): ClashFinding[][] {
  const results = (json as { results?: unknown } | null)?.results;
  return Array.isArray(results) ? results as ClashFinding[][] : [];
}

/** How many findings a per-date answer holds — what Save compares with the line on screen. */
export function countFindings(perDate: readonly (readonly ClashFinding[])[]): number {
  return perDate.reduce((n, f) => n + f.length, 0);
}
