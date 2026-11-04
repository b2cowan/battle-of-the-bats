import type { PublicPageKey } from './public-pages';
import type { Division } from './types';

/**
 * Canonical order + label for a tournament's public page nav — the single source consumed by every surface that
 * renders those tabs: the band's tab row, the desktop side rail and the footer's page list. Filter against the
 * tournament's hidden pages at each call site; the landing "Overview" tab is NOT here (it isn't a PublicPageKey and is
 * never hideable — each surface renders it explicitly). Words only on every surface since the old dark rail and tab
 * row went (Public tournament pages Stage 8 Part 4a), so the list carries no icons.
 *
 * Register is absent here (Stage 6): it is never structural, only ever conditionally inserted by
 * `visibleTournamentTabs`'s `frameContent` argument, below.
 */
export const TOURNAMENT_PAGE_TABS: { key: PublicPageKey; label: string }[] = [
  { key: 'news', label: 'News' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'standings', label: 'Standings' },
  { key: 'teams', label: 'Teams' },
  { key: 'rules', label: 'Rules' },
];

/** A rendered tab: `key` is the URL segment under `/{org}/{tournament}/`. */
export interface TournamentTab {
  key: string;
  label: string;
}

/**
 * The Playoffs tab.
 *
 * Not a `PublicPageKey`, deliberately: the organizer cannot hide it independently, because it is
 * a view of the seeding and therefore inherits the Standings page's visibility. It sits directly
 * after Standings for the same reason — a fan who wants to know who plays whom next looks in one
 * of those two places, and they should be adjacent.
 *
 * ⚠ The bracket page has existed since long before this tab and had NO entry in any nav surface,
 * on any tournament. The overview linked to it only once pool play finished completely, so for
 * most of an event it was reachable only by typing the URL. The "See it live" demo made the gap
 * obvious — its tour sent strangers there and left them with no way back — but the gap belonged
 * to every customer.
 */
const PLAYOFFS_TAB: TournamentTab = { key: 'playoffs', label: 'Playoffs' };
const CHAMPIONS_TAB: TournamentTab = { key: 'champions', label: 'Champions' };
const REGISTER_TAB: TournamentTab = { key: 'register', label: 'Register' };

/**
 * Public tournament pages Stage 6 (Ask 14, "tabs follow what there is"): the extra facts the row needs beyond
 * `hiddenPages`/`hasBracket`. Every layout passes them; omitted (a bare call), News/Rules always show and Register and
 * Champions never do.
 *
 *   · `hasNews` / `hasRules`   — does the page currently have anything to show (the same "empty" each page's own
 *     body already uses: zero announcements; zero rule sections AND zero resources).
 *   · `registrationOpen`      — the Overview's own signal, exactly: the Register page isn't hidden/invite-only
 *     AND `getRegistrationState(...).cta !== null`. Ruled 2026-10-31: the tab disappears the moment this is false,
 *     never a closed-state card kept in the row.
 *   · `hasChampion`           — the one-time `championsCrownedAt` stamp, with all current divisions published
 *     (lib/champions-notify.ts only claims it once no division's schedule is held back and the whole tournament's
 *     playoffs are decided) every other "is there a title to show" surface already reads. Ruled 2026-10-31: this
 *     tab waits for the whole tournament and respects any later withholding, not "the first
 *     division decided."
 */
export interface FrameTabContent {
  hasNews: boolean;
  hasRules: boolean;
  registrationOpen: boolean;
  hasChampion: boolean;
}

/** One computation for live and preview layouts. A one-way crown stamp never overrides a newly withheld schedule. */
export function tournamentFrameTabContent(input: {
  announcementCount: number; ruleCount: number; resourceCount: number;
  registrationCta: 'register' | 'waitlist' | null;
  championsCrownedAt?: string | null;
  divisions: readonly Pick<Division, 'scheduleVisibility'>[];
}): FrameTabContent {
  return {
    hasNews: input.announcementCount > 0,
    hasRules: input.ruleCount > 0 || input.resourceCount > 0,
    registrationOpen: input.registrationCta !== null,
    hasChampion: !!input.championsCrownedAt && input.divisions.length > 0
      && input.divisions.every(division => division.scheduleVisibility === 'published'),
  };
}

/**
 * The tabs to render, in canonical order, for one tournament and one visitor.
 *
 * Every nav surface calls this rather than filtering `TOURNAMENT_PAGE_TABS` itself, so the
 * bracket cannot appear in the side rail and go missing from the phone tabs — the exact class of
 * drift the shared list exists to prevent.
 *
 * @param hiddenPages the tournament's hidden public pages (already resolved for playoff-only).
 * @param hasBracket  the organizer configured a bracket AND Standings is public. Structural, so
 *                    the tab does not appear and disappear as pool play finishes.
 * @param frameContent the extras above (every layout passes them).
 */
export function visibleTournamentTabs(
  hiddenPages: PublicPageKey[],
  hasBracket: boolean,
  frameContent?: FrameTabContent,
): TournamentTab[] {
  const tabs: TournamentTab[] = [];
  // Champions sits second, right after the Overview slot every renderer already draws for itself (Ask 14) — and
  // only when Standings itself would be visible, the same gate the Champions page's own body already applies.
  if (frameContent?.hasChampion && !hiddenPages.includes('standings')) tabs.push(CHAMPIONS_TAB);
  for (const tab of TOURNAMENT_PAGE_TABS) {
    const emptyUnderFrame = !!frameContent
      && ((tab.key === 'news' && !frameContent.hasNews) || (tab.key === 'rules' && !frameContent.hasRules));
    if (!hiddenPages.includes(tab.key) && !emptyUnderFrame) tabs.push(tab);
    // Playoffs takes Standings' place in the running order whether or not Standings itself shows.
    // A bracket-only event hides Standings BY FORMAT — there is no round robin to rank — and that
    // is precisely the event whose bracket matters most, so an `else`/`continue` here would drop
    // the tab from the one tournament that is nothing but a bracket.
    if (tab.key === 'standings' && hasBracket) tabs.push(PLAYOFFS_TAB);
  }
  // Register goes last, as in the approved hub's f-reg frame (the inv tab list).
  if (frameContent?.registrationOpen && !hiddenPages.includes('register')) tabs.push(REGISTER_TAB);
  return tabs;
}
