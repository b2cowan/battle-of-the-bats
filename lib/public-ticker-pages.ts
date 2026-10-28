/**
 * lib/public-ticker-pages.ts — THE PAGES THAT CARRY TODAY'S GAMES LINE (the frame's ticker, components/public/
 * TodaysResultsLine.tsx; Public tournament pages Ask 17, owner 2026-10-27). The layout mounts the line above every
 * page; the line itself asks this list, so no layout has to know its pages.
 *
 * The Overview is not on it: its Live now is the fuller copy of the same games (Stage 2). Stage 3 takes the Schedule
 * and a game's page off by deleting `'schedule'` here. A page not listed does not carry the line, so a new page decides
 * by being added.
 */
export const TICKER_PAGES = ['schedule', 'standings', 'teams', 'playoffs', 'news', 'rules', 'register', 'champions', 'pay'] as const;

/** Does this page carry the line? `pathname` is the club-named path (`usePublicPathname`): `/{org}/{tournament}/…`. */
export function pageCarriesTicker(pathname: string, orgSlug: string, tournamentSlug: string): boolean {
  const base = `/${orgSlug}/${tournamentSlug}`;
  if (!orgSlug || !tournamentSlug || (pathname !== base && !pathname.startsWith(`${base}/`))) return false;
  const section = pathname.slice(base.length + 1).split('/')[0];
  return (TICKER_PAGES as readonly string[]).includes(section);
}
