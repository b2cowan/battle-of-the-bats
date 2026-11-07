'use client';

import { useEffect, useState } from 'react';
import { useOrg } from '@/lib/org-context';
import type { BoardPerson } from '@/lib/board-people';

/**
 * The club's board by name, for a screen that says who does something (Club Tier Stage 13a): GET /api/admin/board —
 * names and roles only. Its own file so a hub that only wants the names does not pull the "not yours" screen along.
 *
 * Kept per club in memory so a second screen does not ask again and does not flash the fallback wording ("The club's
 * owner") before the name. A club's board changes rarely and the read is org-scoped names, so a cached answer is
 * dropped after a minute rather than cleared on sign-out (lib/use-current-org-coach-access.ts avoids a cache because
 * its answer is per PERSON; this one is the same for every member of the club).
 */
const BOARD_TTL_MS = 60_000;

type BoardRead = { pending: Promise<BoardPerson[]>; people: BoardPerson[] | null };
const boardCache = new Map<string, BoardRead>();

function readBoard(slug: string): BoardRead {
  const hit = boardCache.get(slug);
  if (hit) return hit;
  const entry: BoardRead = {
    people: null,
    pending: fetch(`/api/admin/board?orgSlug=${encodeURIComponent(slug)}`)
      .then(res => (res.ok ? res.json() : { people: [] }))
      .then((body: { people?: BoardPerson[] }) => body.people ?? [])
      .catch(() => [] as BoardPerson[]),
  };
  boardCache.set(slug, entry);
  // The entry lives a minute, then goes — so a render never has to read the clock to know it is stale.
  const expiry = setTimeout(() => { if (boardCache.get(slug) === entry) boardCache.delete(slug); }, BOARD_TTL_MS);
  if (typeof expiry === 'object') expiry.unref?.(); // never keep a test run (or a server render) waiting on it
  void entry.pending.then(people => {
    entry.people = people;
    // A failed (empty) read is not kept: the next screen that needs a name asks again.
    if (!people.length && boardCache.get(slug) === entry) boardCache.delete(slug);
  });
  return entry;
}

/**
 * `null` while loading (and when `enabled` is false — a screen that names no one never reads it). Best-effort: a failed
 * read is an empty board, and every sentence built from it falls back to the role in words.
 */
export function useBoardPeople(enabled = true): BoardPerson[] | null {
  const { currentOrg } = useOrg();
  const slug = currentOrg?.slug ?? '';
  const [state, setState] = useState<{ slug: string; people: BoardPerson[] } | null>(null);
  useEffect(() => {
    if (!enabled || !slug) return;
    let live = true;
    void readBoard(slug).pending.then(people => { if (live) setState({ slug, people }); });
    return () => { live = false; };
  }, [enabled, slug]);
  if (!enabled) return null;
  if (state && state.slug === slug) return state.people;
  // Already read this minute: say the name on the first paint instead of a tick later.
  return (slug ? boardCache.get(slug)?.people : null) ?? null;
}
