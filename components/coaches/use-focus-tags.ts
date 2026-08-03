'use client';
import { useCallback, useEffect, useState } from 'react';
import type { PickableTag } from './TagPicker';

/**
 * The team's shared 'focus' vocabulary, for any surface that offers a `TagPicker`.
 *
 * ⚠ **Why this exists.** The same twelve lines — fetch the library, POST a new tag, fold the result
 * into local state without duplicating it — were written out independently on the practice plan,
 * the drill library, the template room and the template editor. The SERVER side of this exact
 * vocabulary was just collapsed into one factory for the same reason ("five copies of an auth chain
 * is five places for one to quietly stop checking something"); the client side had simply not
 * followed. A bug fixed in one copy — a duplicate-tag race, a trim rule — has to be found and
 * re-applied in the other three otherwise.
 *
 * ⚠ **It fetches EVERY tag the team has, not just the ones already in use on this screen.** A
 * picker built from what is on screen hides vocabulary a focus area or a template already uses and
 * quietly invites the coach to mint a duplicate — which is the whole drift tags exist to prevent.
 * (The filter CHIPS on a room are derived from what is on screen; that is a different question.)
 *
 * ⚠ **Failure is silent and safe.** If the library cannot be read the picker degrades to "no tags
 * yet" and the thing being edited still saves — losing the vocabulary must never take the surface
 * down with it.
 *
 * @param seed when the caller already received the library on its own GET (the practice plan does),
 *   pass it to skip the extra round trip; the hook still owns creation and local merging.
 */
export function useFocusTags(
  orgSlug: string,
  teamId: string,
  opts: { seed?: PickableTag[]; skipFetch?: boolean } = {},
) {
  const [tags, setTags] = useState<PickableTag[]>(opts.seed ?? []);
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/focus-tags`;

  const reload = useCallback(async () => {
    try {
      const res = await fetch(base);
      if (!res.ok) return;
      const json = await res.json();
      setTags(json.tags ?? []);
    } catch { /* the picker degrades to "no tags yet"; the edit still saves */ }
  }, [base]);

  const { skipFetch } = opts;
  useEffect(() => {
    if (skipFetch) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(base);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setTags(json.tags ?? []);
      } catch { /* as above */ }
    })();
    return () => { cancelled = true; };
  }, [base, skipFetch]);

  /**
   * Mint one. ⚠ Returns null rather than throwing on refusal — the picker treats that as "not
   * created" and leaves the coach's typing in place. The server answers 409 on a name that already
   * exists (case-insensitively), which is the guard that makes "Hitting" and "hitting" impossible.
   */
  const createTag = useCallback(async (name: string): Promise<PickableTag | null> => {
    const res = await fetch(base, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const tag: PickableTag = json.tag;
    setTags(prev => (prev.some(t => t.id === tag.id) ? prev : [...prev, tag]));
    return tag;
  }, [base]);

  return { tags, setTags, createTag, reload };
}
