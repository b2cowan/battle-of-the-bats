'use client';
import { useLayoutEffect } from 'react';
import { useOrgNav } from './OrgNavContext';

/**
 * Mounted by the root 404 only. Tells the shell a not-found page is on screen, so the root-mounted tournament bar stands
 * down: a made-up two-part address (`/x/y`) matches the tournament route, and the browser's copy of the route carries a
 * `tournamentSlug` for it even though the layout found no event (owner ruling 2026-11-19: the 404 takes no bottom bar).
 * A layout effect, so the bar is gone before the first paint rather than drawn and taken back.
 */
export default function NotFoundPageSync() {
  const { setNotFoundPage } = useOrgNav();

  useLayoutEffect(() => {
    setNotFoundPage(true);
    return () => setNotFoundPage(false);
  }, [setNotFoundPage]);

  return null;
}
