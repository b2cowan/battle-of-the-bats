/**
 * lib/public-focused-page.ts — THE FOCUSED PAGE: a public tournament page that wears none of the event's chrome
 * (Public tournament pages Stage 7, Ask 6 ruled 2026-10-27 "a focused page"; build prompt
 * docs/projects/active/PUBLIC_TOURNAMENT_STAGE7_BUILD_PROMPT.md).
 *
 * The team pay page (`/{org}/{tournament}/pay/{token}`) has one job. Under the frame it keeps a slim band and a short
 * footer, and drops the tabs, the rail, today's games line, the my-team dock, the follow/alerts/install prompts and the
 * free plan's badge and banner. A layout cannot see its child segment, and moving every other tournament page into a
 * route group was ruled out (the build prompt's one technical choice), so each chrome piece asks THIS rule through
 * `usePublicPathname()`, as the ticker (lib/public-ticker-pages.ts) and the acquisition banner already do. No piece
 * names `pay` itself: this file is the only place that says which pages are focused.
 */

/** The path segments after `/{org}/{tournament}`, or null when the path is not that tournament's (or a slug is missing). */
export function tournamentPageSegments(pathname: string, orgSlug: string, tournamentSlug: string): string[] | null {
  const base = `/${orgSlug}/${tournamentSlug}`;
  if (!orgSlug || !tournamentSlug || (pathname !== base && !pathname.startsWith(`${base}/`))) return null;
  return pathname.slice(base.length + 1).split('/').filter(Boolean);
}

/** The sections whose pages are focused. A section's page needs its own segment after it (the pay link's token). */
export const FOCUSED_SECTIONS = ['pay'] as const;

/** Is this the focused page? `pathname` is the club-named path (`usePublicPathname`): `/{org}/{tournament}/…`. */
export function isFocusedPublicPage(pathname: string, orgSlug: string, tournamentSlug: string): boolean {
  const seg = tournamentPageSegments(pathname, orgSlug, tournamentSlug);
  return !!seg && seg.length >= 2 && (FOCUSED_SECTIONS as readonly string[]).includes(seg[0]);
}
