/**
 * lib/org-public-sections.ts — the ONE vocabulary for "which named section of a club's public site is this?" — the
 * club's tabs (Nav Unification Stage F; in the club's own bar since Club Tier Stage 4b-1).
 *
 * One name per thing (Club Tier Stage 4, design log "Names", ruled 2026-10-19): the tab says what the page says —
 * "House league", "Tournaments" — never a second word for the same place. (Stage 4f, ruled 2026-10-25, Ask 1: one
 * Tournaments tab holds current, upcoming and past; the Past tournaments tab retired into its page.) (The Stage E "›" crumb that used to
 * read this table retired with the platform's org bar in 4b-1: the tabs and the page's own title answer "where am I",
 * and the club's name in its bar is the way home.)
 */

/** A section of an org's public site, as the tab row renders it. */
export interface OrgSection {
  /** URL segment — '' is the org root. */
  key: string;
  label: string;
}

/** A tab that has no place of its own in the club's order sorts with another (Tryouts, seasonal, rides with Teams). */
const ORDERED_WITH: Record<string, string> = { tryouts: 'teams' };

/**
 * The section table, in tab order: Home · Teams · Tryouts · House league · Tournaments (Club Tier Stage 4b-2a, Ask
 * 9A; the club Tryouts tab joined third in 4b-2b, Ask 14 — seasonal: present only while the Tryouts page has a team to
 * list, `tryoutsTabShows`; Tournaments took Past tournaments' place in 4f). `''` (the club's home) is the first tab. Every section is a real page: until
 * 4b-2a `/{orgSlug}/teams` was a redirect shim, nameable but never a tab (a tab on a redirect would have laundered that
 * into navigation); a section must have its page before it joins this table.
 */
const ORG_SECTIONS: OrgSection[] = [
  { key: '',         label: 'Home' },
  { key: 'teams',    label: 'Teams' },
  { key: 'tryouts',  label: 'Tryouts' },
  { key: 'league',   label: 'House league' },
  { key: 'tournaments', label: 'Tournaments' },
];

/**
 * Which tab (if any) is active for this pathname — the tab row's own highlight rule. Returns the
 * section key (`''` for the org home) or null when the visitor is on an unnamed section, where no
 * tab should read as current rather than one falsely claiming to.
 */
export function activeOrgSectionKey(pathname: string, orgSlug: string, sections?: readonly OrgSection[]): string | null {
  if (!orgSlug) return null;
  const base = `/${orgSlug}`;
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return null;
  const parts = pathname.slice(base.length).replace(/^\//, '').split(/[?#]/)[0].split('/');
  const segment = parts[0];
  // A team's tryout pages (`/teams/{team}/tryouts/…`) are tryout pages, so they light Tryouts however the visitor got
  // there — the tab is the way back to the club's list, and "← {team}" on the page is the way on to the team. While
  // the seasonal tab is absent they stay under Teams, where the URL lives (design log 2026-10-21).
  if (segment === 'teams' && parts[2] === 'tryouts' && sections?.some(s => s.key === 'tryouts')) return 'tryouts';
  // An archived tournament's page is one of the club's tournaments (Stage 4f, Ask 6): the tab is its way back.
  if (segment === 'archives') return 'tournaments';
  return ORG_SECTIONS.some(s => s.key === segment) ? segment : null;
}

/**
 * The sections THIS org actually has, for the Stage F tab row.
 *
 * The caller resolves availability server-side (module entitlements + whether any content exists)
 * and passes it in — this stays a pure shaping function so it can be unit-tested and so the
 * ordering lives in one place.
 *
 * Returns fewer than 2 entries when the org has nothing to navigate between; the caller treats
 * that as "render no tab row" rather than showing a row with a single Home tab in it.
 */
export function orgSectionsFor(
  available: { league: boolean; tournaments: boolean; teams: boolean; tryouts?: boolean },
  /** The club's section order from its editor (Stage 4c-1): it SORTS the tabs after Home and never hides one (a hidden
   *  section arrives here as not available). A tab it does not rank keeps its table place after the ranked ones. */
  order?: readonly string[],
): OrgSection[] {
  const present = ORG_SECTIONS.filter(s => {
    if (s.key === 'teams') return available.teams;
    if (s.key === 'tryouts') return !!available.tryouts;
    if (s.key === 'league') return available.league;
    if (s.key === 'tournaments') return available.tournaments;
    return true; // Home is always present
  });
  if (!order) return present;
  const rank = (s: OrgSection) => {
    const i = order.indexOf(ORDERED_WITH[s.key] ?? s.key);
    return s.key === '' ? -1 : i < 0 ? order.length : i;
  };
  return [...present].sort((a, b) => rank(a) - rank(b)); // stable: Teams before Tryouts, unranked in table order
}

/** The Stage F render gate: a tab row is only honest when there is somewhere else to go. */
export const ORG_SECTION_TABS_MIN = 2;
