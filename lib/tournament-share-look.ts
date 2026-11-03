import { getOrganizationBySlug } from './db';
import { resolveTheme, type ResolvedTheme } from './themes';
import { resolveTournamentLook, type LookTournament } from './tournament-look';

/**
 * The three share images' colour (Public tournament pages Stage 1a, owner 2026-11-02: the share images follow the same
 * rule as the page). The one rule is lib/tournament-look.ts; the images keep their own dark card, so the neutral band of a
 * free event and Tournament Plus's plain look both read as the FieldLogicHQ colour on it. These images are fetched
 * without the preview switch: this reaches customers as soon as it ships (ruled).
 *
 * The public page data carries a narrowed organization, so the org is read here, once per image.
 */
export async function shareImageTheme(orgSlug: string, tournament: LookTournament): Promise<ResolvedTheme> {
  const org = await getOrganizationBySlug(orgSlug);
  const look = org
    ? resolveTournamentLook(org, tournament)
    : { preset: 'platform', primary: null, accent: null };
  return resolveTheme(look.preset, look.primary, look.accent);
}
