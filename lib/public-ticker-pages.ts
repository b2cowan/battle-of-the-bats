/**
 * lib/public-ticker-pages.ts — THE PAGES THAT CARRY TODAY'S GAMES LINE (the frame's ticker, components/public/
 * TodaysResultsLine.tsx; Public tournament pages Ask 17, owner 2026-10-27). The layout mounts the line above every
 * page; the line itself asks this list, so no layout has to know its pages.
 *
 * The Overview is not on it: its Live now is the fuller copy of the same games (Stage 2). Neither are the Schedule and a
 * game's page (Stage 3, Ask 17): their own Live now cards say it, and the match is on the first path segment, so
 * `/schedule/{gameId}` goes with `/schedule`. Nor is the team pay page: it is the focused page (Stage 7,
 * lib/public-focused-page.ts), which carries no event chrome. A page not listed does not carry the line, so a new page
 * decides by being added.
 */
import { tournamentPageSegments } from './public-focused-page';

export const TICKER_PAGES = ['standings', 'teams', 'playoffs', 'news', 'rules', 'register', 'champions'] as const;

/** Does this page carry the line? `pathname` is the club-named path (`usePublicPathname`): `/{org}/{tournament}/…`. */
export function pageCarriesTicker(pathname: string, orgSlug: string, tournamentSlug: string): boolean {
  const section = tournamentPageSegments(pathname, orgSlug, tournamentSlug)?.[0];
  return !!section && (TICKER_PAGES as readonly string[]).includes(section);
}
