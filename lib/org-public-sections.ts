/**
 * lib/org-public-sections.ts — the ONE vocabulary for "which named section of an org's public
 * site is this?" (Nav Unification Stage E.3 crumb + Stage F section tabs).
 *
 * The org's public pages all render through one shared navbar, which knows only the pathname.
 * This maps that pathname to the section a visitor is in, and lists the sections an org actually
 * has. Both consumers read the SAME table, so the crumb and the tab row can never disagree about
 * what a section is called.
 *
 * SECTION names, not entity names (owner ruling 2026-08-01, mockup-reviewed). A season page reads
 * "League", not "Spring 2026" — the trail's job is getting back UP, and the page's own heading
 * already names the thing you opened one line below. The alternative required four more pages to
 * publish their names into the shared nav context, which is the exact plumbing that blanked an
 * org's identity earlier in this project (the OrgNavSync restore fix), and it needs a truncation
 * rule long season/team names would keep tripping.
 *
 * DELIBERATELY PARTIAL: only the sections Stage E/F cover are named. The tournament-shim routes
 * (`/schedule`, `/standings`, `/results`, `/rules`, `/register`, `/news`) and anything added later
 * return null and render today's plain identity. A crumb that guesses a label is worse than none.
 */

/** A section of an org's public site, as the tab row renders it. */
export interface OrgSection {
  /** URL segment — '' is the org root. */
  key: string;
  label: string;
}

/**
 * The section table — ONE label vocabulary, TWO views over it.
 *
 * `''` (the org root) is deliberately included: the tab row's first tab is the org home, and the
 * crumb resolver skips it by key rather than by a separate rule.
 *
 * `tabbable` is the difference between what the two consumers need. A CRUMB only needs a name for
 * where you are — its text isn't a link (only the org name beside it is). A TAB needs a real
 * destination to send you to. So a section can be nameable without being navigable, and `teams` is
 * exactly that today: `/{orgSlug}/teams` is a redirect shim with no index page (the org home's
 * "Tryouts Are Open" card pointing at it is a known broken link on the platform defect list), while
 * `/{orgSlug}/teams/{team}` renders a real rep-team page that still deserves a way back up.
 * Putting a TAB on a redirect would launder that bug into navigation; dropping the CRUMB would
 * strip a working affordance off the team page. Hence the flag rather than a second table.
 */
interface OrgSectionEntry extends OrgSection {
  /** Can this section be a tab destination — i.e. does a real index page exist for it? */
  tabbable: boolean;
}

const ORG_SECTIONS: OrgSectionEntry[] = [
  { key: '',         label: 'Home',     tabbable: true  },
  { key: 'league',   label: 'League',   tabbable: true  },
  { key: 'teams',    label: 'Teams',    tabbable: false }, // no index page yet — crumb only
  { key: 'archives', label: 'Archives', tabbable: true  },
];

/**
 * The crumb label for an org public pathname, or null at the org root / on any unnamed section.
 *
 * Depth-insensitive by design: `/{org}/league` and `/{org}/league/spring-2026/standings` both read
 * "League", so the trail stays the same width and the same word however deep the visitor goes.
 */
export function orgSectionCrumb(pathname: string, orgSlug: string): string | null {
  const key = activeOrgSectionKey(pathname, orgSlug);
  if (!key) return null; // null = unnamed section; '' = the org root, which keeps plain identity
  return ORG_SECTIONS.find(s => s.key === key)?.label ?? null;
}

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
export function orgSectionsFor(available: { league: boolean; archives: boolean }): OrgSection[] {
  return ORG_SECTIONS
    .filter(s => {
      if (!s.tabbable) return false; // a section with no index page can be named, never linked to
      if (s.key === 'league') return available.league;
      if (s.key === 'archives') return available.archives;
      return true; // Home is always present
    })
    .map(({ key, label }) => ({ key, label }));
}

/** The Stage F render gate: a tab row is only honest when there is somewhere else to go. */
export const ORG_SECTION_TABS_MIN = 2;
