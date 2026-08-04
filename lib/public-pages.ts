// Relative, with the explicit `.ts` extension (repo convention, `allowImportingTsExtensions`), so
// these visibility rules can be imported by a plain Node unit test as well as by the app. They
// decide what the public can see, which is exactly the kind of rule that should be pinned by tests
// rather than only by rendering a page.
import type { Tournament } from './types.ts';
import { isPlayoffOnly } from './tournament-phase.ts';

export const PUBLIC_PAGE_OPTIONS = [
  { key: 'news', label: 'News' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'standings', label: 'Standings' },
  { key: 'teams', label: 'Teams' },
  { key: 'rules', label: 'Rules' },
  { key: 'register', label: 'Registration' },
] as const;

export type PublicPageKey = typeof PUBLIC_PAGE_OPTIONS[number]['key'];

const PUBLIC_PAGE_KEYS = new Set<PublicPageKey>(PUBLIC_PAGE_OPTIONS.map(page => page.key));

export function normalizeHiddenPublicPages(value: unknown): PublicPageKey[] {
  if (!Array.isArray(value)) return [];
  const hidden = new Set(value.filter((item): item is PublicPageKey => PUBLIC_PAGE_KEYS.has(item as PublicPageKey)));
  return PUBLIC_PAGE_OPTIONS.map(page => page.key).filter(key => hidden.has(key));
}

export function isPublicPageEnabled(tournament: Pick<Tournament, 'publicHiddenPages' | 'settings'> | null | undefined, key: PublicPageKey): boolean {
  // Bracket-only tournaments have no round-robin standings.
  if (key === 'standings' && isPlayoffOnly(tournament)) return false;
  return !normalizeHiddenPublicPages(tournament?.publicHiddenPages).includes(key);
}

/**
 * Should the public playoff bracket be visible?
 *
 * The bracket has no hideable page key of its own — it borrows the Standings page's visibility,
 * because a bracket gives the seeding away and an organizer who hid Standings must not have it leak
 * through this URL. That rule is right, but asking `isPublicPageEnabled(…, 'standings')` for the
 * answer conflated two very different reasons Standings can be unavailable:
 *
 *   • **the organizer hid it** — a privacy choice, which should take the bracket with it; and
 *   • **the format has no round robin** — a bracket-only event, where Standings is meaningless and
 *     force-hidden above… and the bracket is the ENTIRE tournament.
 *
 * So the one format most defined by having a bracket was the only one that could never show it: the
 * page hid itself, and the nav tab (correctly matching the page, so nothing dead-ends) never
 * appeared either. Found while adding that tab, 2026-08-04.
 *
 * A bracket-only event therefore reads the organizer's RAW choice rather than the derived answer —
 * hiding Standings there is still respected as "hide the bracket", since it is the only lever they
 * have over it, but the format alone no longer suppresses it.
 */
export function isPublicBracketVisible(
  tournament: Pick<Tournament, 'publicHiddenPages' | 'settings'> | null | undefined,
): boolean {
  const hiddenByOrganizer = normalizeHiddenPublicPages(tournament?.publicHiddenPages).includes('standings');
  if (isPlayoffOnly(tournament)) return !hiddenByOrganizer;
  return isPublicPageEnabled(tournament, 'standings');
}

export function visiblePublicPages(tournament: Pick<Tournament, 'publicHiddenPages' | 'settings'> | null | undefined) {
  const hidden = normalizeHiddenPublicPages(tournament?.publicHiddenPages);
  const playoffOnly = isPlayoffOnly(tournament);
  return PUBLIC_PAGE_OPTIONS.filter(page => !hidden.includes(page.key) && !(playoffOnly && page.key === 'standings'));
}
