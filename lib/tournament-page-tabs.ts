import { Megaphone, Calendar, Trophy, GitFork, Users, ScrollText, type LucideIcon } from 'lucide-react';
import type { PublicPageKey } from './public-pages';

/**
 * Canonical order + label + icon for a tournament's public page nav — the single
 * source consumed by every surface that renders those tabs: the desktop side rail,
 * the mobile top-tab row, the admin-preview bottom bar, and the tablet top-bar
 * links. Filter against the tournament's hidden pages at each call site; the landing
 * "Overview" tab is NOT here (it isn't a PublicPageKey and is never hideable — each
 * surface renders it explicitly). Register is intentionally absent (CTA-only).
 *
 * Kept icon-carrying but plain-data so a text-only consumer (the desktop top-bar
 * links) can ignore `Icon` while the icon consumers share one list — one edit to
 * add/relabel/re-icon a tab, everywhere.
 */
export const TOURNAMENT_PAGE_TABS: { key: PublicPageKey; label: string; Icon: LucideIcon }[] = [
  { key: 'news', label: 'News', Icon: Megaphone },
  { key: 'schedule', label: 'Schedule', Icon: Calendar },
  { key: 'standings', label: 'Standings', Icon: Trophy },
  { key: 'teams', label: 'Teams', Icon: Users },
  { key: 'rules', label: 'Rules', Icon: ScrollText },
];

/** A rendered tab: `key` is the URL segment under `/{org}/{tournament}/`. */
export interface TournamentTab {
  key: string;
  label: string;
  Icon: LucideIcon;
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
const PLAYOFFS_TAB: TournamentTab = { key: 'playoffs', label: 'Playoffs', Icon: GitFork };

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
 */
export function visibleTournamentTabs(
  hiddenPages: PublicPageKey[],
  hasBracket: boolean,
): TournamentTab[] {
  const tabs: TournamentTab[] = [];
  for (const tab of TOURNAMENT_PAGE_TABS) {
    if (!hiddenPages.includes(tab.key)) tabs.push(tab);
    // Playoffs takes Standings' place in the running order whether or not Standings itself shows.
    // A bracket-only event hides Standings BY FORMAT — there is no round robin to rank — and that
    // is precisely the event whose bracket matters most, so an `else`/`continue` here would drop
    // the tab from the one tournament that is nothing but a bracket.
    if (tab.key === 'standings' && hasBracket) tabs.push(PLAYOFFS_TAB);
  }
  return tabs;
}
