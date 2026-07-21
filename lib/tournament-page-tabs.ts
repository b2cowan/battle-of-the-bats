import { Megaphone, Calendar, Trophy, Users, ScrollText, type LucideIcon } from 'lucide-react';
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
