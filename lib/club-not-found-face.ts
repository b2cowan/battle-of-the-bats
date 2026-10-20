import { showsOrgPublicChrome } from './consumer-routes';
import type { PublicClub } from '../components/public/PublicClubContext';

/**
 * Which face a club's "not found" wears (Club Tier Stage 4a, S4-01). Kept apart from the access rule
 * (`lib/public-club-access.ts`, which pulls in the plan tables) because the face is a client component.
 */

export type ClubNotFoundFace =
  | { face: 'refusal' }
  | { face: 'in-club'; variant: 'teams' | 'league' | 'page' }
  | { face: 'platform' };

/** Is this address one of THIS club's own public pages (not a tournament, not the signed-in tools)? */
export function isClubPagePath(pathname: string, clubSlug: string): boolean {
  return pathname.split('/').filter(Boolean)[0] === clubSlug && showsOrgPublicChrome(pathname);
}

/**
 * Does this address wear the club's site frame (Club Tier Stage 4b-1)? A club page of a LIVE club — the same pages, by
 * the same rule, as the "not found" faces below, so the frame and the faces cannot disagree about what a club page is.
 * A closed club's pages are the refusal, which wears no club bar.
 */
export function wearsClubFrame(pathname: string, club: Pick<PublicClub, 'slug' | 'siteOpen'> | null): boolean {
  return !!club && club.siteOpen && isClubPagePath(pathname, club.slug);
}

/**
 * A club page of a club whose site is closed → the neutral refusal (the same words on every page, never saying which
 * reason). A club page of a live club → "not found" inside the club's site with a way home (an unknown team, `/league`
 * with no house league, a shortcut with nothing running, a page the plan does not carry — the site is up, so "this
 * club's site isn't available" would be false). Anything else under the org — a tournament, the signed-in tools —
 * keeps the platform's page.
 *
 * "A club page" is the club's own public site exactly as its chrome knows it (`showsOrgPublicChrome`): one list, so the
 * pages that refuse and the bars the refusal steps aside (ClubNotFound.module.css) cannot drift apart.
 */
export function clubNotFoundFace(pathname: string, club: Pick<PublicClub, 'slug' | 'siteOpen'> | null): ClubNotFoundFace {
  if (!club || !isClubPagePath(pathname, club.slug)) return { face: 'platform' };
  if (!club.siteOpen) return { face: 'refusal' };
  const [, section, ...rest] = pathname.split('/').filter(Boolean);
  if (section === 'teams') return { face: 'in-club', variant: 'teams' };
  if (section === 'league' && rest.length === 0) return { face: 'in-club', variant: 'league' };
  return { face: 'in-club', variant: 'page' };
}
