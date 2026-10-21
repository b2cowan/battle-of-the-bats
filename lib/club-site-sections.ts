/**
 * lib/club-site-sections.ts — THE CLUB DECIDES ITS HOME'S ORDER (Club Tier Stage 4c-1; drawings ruled 2026-10-19,
 * section 6 "Home page sections"; words CLUB_TIER_STAGE4C1_COPY.md §B; storage mig 343).
 *
 * The editor lists the home's middle sections; the club shows or hides each and holds-and-drags the order. Pure, tested
 * in tests/unit/club-stage4c1.test.ts:
 *   · Open now is never listed in storage: it always comes first and shows only while something is open;
 *   · a section the club does not run YET keeps a live switch and a line saying when it shows;
 *   · a section the PLAN does not carry is absent from the editor and never shows (no explanation);
 *   · the home and the tab row follow the same order and show/hide (the tab row's half is lib/org-public-sections.ts).
 */

export type SiteSectionKey = 'teams' | 'league' | 'tournaments' | 'about' | 'archives';

/** Today's ruled order (Ask 3A) + Past tournaments: a club that never opened the editor sees no change. */
export const DEFAULT_SECTION_ORDER: readonly SiteSectionKey[] = ['teams', 'league', 'tournaments', 'about', 'archives'];

const KNOWN = new Set<string>(DEFAULT_SECTION_ORDER);

export interface SectionPrefs {
  order: readonly string[] | null | undefined;
  hidden: readonly string[] | null | undefined;
}

/** What the plan carries. About is every public site's; Past tournaments rides with tournaments. */
export interface SectionCarries {
  teams: boolean;
  league: boolean;
  tournaments: boolean;
}

function carried(key: SiteSectionKey, c: SectionCarries): boolean {
  if (key === 'about') return true;
  if (key === 'archives') return c.tournaments;
  return c[key];
}

/** Unknown keys dropped, each key once, missing keys appended in the default order. */
export function normalizeSectionOrder(order: readonly string[] | null | undefined): SiteSectionKey[] {
  const out: SiteSectionKey[] = [];
  for (const k of order ?? []) if (KNOWN.has(k) && !out.includes(k as SiteSectionKey)) out.push(k as SiteSectionKey);
  for (const k of DEFAULT_SECTION_ORDER) if (!out.includes(k)) out.push(k);
  return out;
}

export function normalizeHiddenSections(hidden: readonly string[] | null | undefined): SiteSectionKey[] {
  const out: SiteSectionKey[] = [];
  for (const k of hidden ?? []) if (KNOWN.has(k) && !out.includes(k as SiteSectionKey)) out.push(k as SiteSectionKey);
  return out;
}

/** Does the club show this section: its plan carries it and the club did not hide it. (It still needs something to
 *  show — that is the page's to know.) */
export function isSectionShown(key: SiteSectionKey, prefs: SectionPrefs, carries: SectionCarries): boolean {
  return carried(key, carries) && !normalizeHiddenSections(prefs.hidden).includes(key);
}

export type ClubHomeSection = 'openNow' | 'teams' | 'league' | 'tournaments' | 'about';

/**
 * The home's sections, in the club's order: Open now first while something is open, then each section the plan
 * carries, the club shows, and that has something to show. Past tournaments is a tab, not a home section.
 */
export function clubHomeSectionsFor(
  has: { openNow: number; teams: number; league: boolean; tournaments: number; about: boolean },
  prefs: SectionPrefs,
  carries: SectionCarries,
): ClubHomeSection[] {
  const out: ClubHomeSection[] = has.openNow > 0 ? ['openNow'] : [];
  for (const k of normalizeSectionOrder(prefs.order)) {
    if (k === 'archives' || !isSectionShown(k, prefs, carries)) continue;
    const present = k === 'teams' ? has.teams > 0 : k === 'tournaments' ? has.tournaments > 0 : has[k];
    if (present) out.push(k);
  }
  return out;
}

export interface SectionFacts {
  teams: number;
  /** The running house-league season's name ("2027"), or null when none is running. */
  leagueSeason: string | null;
  /** Past seasons are published but none is running: the home's door says "Past seasons and results". */
  leaguePast?: boolean;
  tournaments: number;
  archives: number;
  about: boolean;
}

export interface EditorSectionRow {
  key: 'openNow' | SiteSectionKey;
  name: string;
  sub: string;
  shown: boolean;
  locked: boolean;
}

const SECTION_NAME: Record<'openNow' | SiteSectionKey, string> = {
  openNow: 'Open now',
  teams: 'Teams',
  league: 'House league',
  tournaments: 'Tournaments',
  about: 'About the club',
  archives: 'Past tournaments',
};

function stateLine(key: SiteSectionKey, f: SectionFacts): string {
  switch (key) {
    case 'teams':
      if (f.teams === 0) return 'Shows once you add a team';
      return f.teams === 1 ? 'Your 1 team in your groups, with its tryout state' : `Your ${f.teams} teams in your groups, each with its tryout state`;
    case 'league':
      return f.leagueSeason ? `Your ${f.leagueSeason} sign-up and divisions`
        : f.leaguePast ? 'Past seasons and results' // the home's own line for this door
        : 'Shows once you publish a season';
    case 'tournaments':
      return f.tournaments > 0 ? 'Your upcoming tournaments' : 'Shows once you host a tournament';
    case 'archives':
      return f.archives > 0 ? 'A way to your archived tournaments' : 'Shows once you have an archived tournament';
    case 'about':
      return 'Your about text, with a way to your About page';
  }
}

/** The editor's Home page rows: Open now locked first, then the club's order, each with its live state line. */
export function editorSectionRows(prefs: SectionPrefs, facts: SectionFacts, carries: SectionCarries): EditorSectionRow[] {
  const hidden = new Set(normalizeHiddenSections(prefs.hidden));
  const rows: EditorSectionRow[] = [{
    key: 'openNow',
    name: SECTION_NAME.openNow,
    sub: 'Open tryouts and an open house-league sign-up, while they are open',
    shown: true,
    locked: true,
  }];
  for (const k of normalizeSectionOrder(prefs.order)) {
    if (!carried(k, carries)) continue;
    const shown = !hidden.has(k);
    rows.push({ key: k, name: SECTION_NAME[k], sub: shown ? stateLine(k, facts) : 'Hidden from families', shown, locked: false });
  }
  return rows;
}

/** The order to store after a drag: the visible rows' new order, with the plan-absent keys kept where they were. */
export function reorderedSections(current: readonly string[] | null | undefined, visibleInNewOrder: readonly SiteSectionKey[]): SiteSectionKey[] {
  const full = normalizeSectionOrder(current);
  const moved = new Set(visibleInNewOrder);
  const queue = [...visibleInNewOrder];
  return full.map(k => (moved.has(k) ? queue.shift()! : k));
}
