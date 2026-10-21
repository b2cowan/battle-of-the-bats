/**
 * lib/org-public-sections.ts — the ONE vocabulary for "which named section of a club's public site is this?" — the
 * club's tabs (Nav Unification Stage F; in the club's own bar since Club Tier Stage 4b-1).
 *
 * One name per thing (Club Tier Stage 4, design log "Names", ruled 2026-10-19): the tab says what the page says —
 * "House league", "Past tournaments" — never a second word for the same place. (The Stage E "›" crumb that used to
 * read this table retired with the platform's org bar in 4b-1: the tabs and the page's own title answer "where am I",
 * and the club's name in its bar is the way home.)
 */

/** A section of an org's public site, as the tab row renders it. */
export interface OrgSection {
  /** URL segment — '' is the org root. */
  key: string;
  label: string;
}

/**
 * The section table, in tab order: Home · Teams · Tryouts · House league · Past tournaments (Club Tier Stage 4b-2a, Ask
 * 9A; the club Tryouts tab joined third in 4b-2b, Ask 14 — seasonal: present only while the Tryouts page has a team to
 * list, `tryoutsTabShows`). `''` (the club's home) is the first tab. Every section is a real page: until
 * 4b-2a `/{orgSlug}/teams` was a redirect shim, nameable but never a tab (a tab on a redirect would have laundered that
 * into navigation); a section must have its page before it joins this table.
 */
const ORG_SECTIONS: OrgSection[] = [
  { key: '',         label: 'Home' },
  { key: 'teams',    label: 'Teams' },
  { key: 'tryouts',  label: 'Tryouts' },
  { key: 'league',   label: 'House league' },
  { key: 'archives', label: 'Past tournaments' },
];

/**
 * Which tab (if any) is active for this pathname — the tab row's own highlight rule. Returns the
 * section key (`''` for the org home) or null when the visitor is on an unnamed section, where no
 * tab should read as current rather than one falsely claiming to.
 */
export function activeOrgSectionKey(pathname: string, orgSlug: string): string | null {
  if (!orgSlug) return null;
  const base = `/${orgSlug}`;
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return null;
  const segment = pathname.slice(base.length).replace(/^\//, '').split(/[/?#]/)[0];
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
export function orgSectionsFor(available: { league: boolean; archives: boolean; teams: boolean; tryouts?: boolean }): OrgSection[] {
  return ORG_SECTIONS.filter(s => {
    if (s.key === 'teams') return available.teams;
    if (s.key === 'tryouts') return !!available.tryouts;
    if (s.key === 'league') return available.league;
    if (s.key === 'archives') return available.archives;
    return true; // Home is always present
  });
}

/** The Stage F render gate: a tab row is only honest when there is somewhere else to go. */
export const ORG_SECTION_TABS_MIN = 2;
