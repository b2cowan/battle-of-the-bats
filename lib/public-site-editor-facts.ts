import 'server-only';
import { getLeagueSeasons, getTournamentsByOrg } from '@/lib/db';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { clubTeamsAddress } from '@/lib/public-club-access';
import { clubTournamentParts, runningLeagueSeason } from '@/lib/club-site-home';
import { countListedTeams } from '@/lib/org-section-availability';
import { listClubArchives } from '@/lib/club-archives';
import { tournamentToday } from '@/lib/timezone';
import type { Organization, OrgPublicSiteContent } from '@/lib/types';
import type { SectionCarries, SectionFacts } from '@/lib/club-site-sections';

/** What the club's plan carries, for its home, its editor and its tab row alike (Club Tier Stage 4c-1). About is every
 *  public site's; Past tournaments rides with tournaments. */
export function siteSectionCarries(org: Organization): SectionCarries {
  return {
    teams: clubTeamsAddress(org) === 'teams-page',
    league: hasModuleEntitlement(org, 'module_house_league'),
    tournaments: hasModuleEntitlement(org, 'module_tournaments'),
  };
}

/**
 * What the public-site editor's Home page rows say (Club Tier Stage 4c-1) — by the SAME rules the home shows them:
 * the listed teams, the running house-league season, the club's tournaments as its Tournaments page sorts them
 * (`clubTournamentParts`, Stage 4f: running and coming; finished or sealed, for Past tournaments); and what the plan carries, so a section the plan lacks is
 * absent. A failed read counts as none, which says "Shows once…" rather than breaking the editor. `contentRead` is the
 * route's own read of the site's row (the about text), shared rather than repeated.
 */
const NO_TOURNAMENTS = { current: 0, past: 0 };

export async function publicSiteEditorFacts(
  org: Organization,
  contentRead: Promise<OrgPublicSiteContent | null>,
): Promise<{ facts: SectionFacts; carries: SectionCarries }> {
  const carries = siteSectionCarries(org);
  const [teams, tournaments, seasons, content] = await Promise.all([
    carries.teams ? countListedTeams(org.id) : 0,
    carries.tournaments
      ? Promise.all([getTournamentsByOrg(org.id), listClubArchives(org.id)])
          .then(([all, sealed]) => clubTournamentParts(all, sealed, tournamentToday()))
          .then(p => ({ current: p.current.length, past: p.finished.length + p.archives.length }), () => NO_TOURNAMENTS)
      : NO_TOURNAMENTS,
    carries.league ? getLeagueSeasons(org.id).catch(() => []) : [],
    contentRead.catch(() => null),
  ]);
  const publicSeasons = seasons.filter(s => s.status !== 'draft');
  return {
    facts: {
      teams,
      leagueSeason: runningLeagueSeason(publicSeasons)?.name ?? null,
      leaguePast: publicSeasons.length > 0 && !runningLeagueSeason(publicSeasons),
      tournaments: tournaments.current,
      past: tournaments.past,
      about: !!content?.description?.trim(),
    },
    carries,
  };
}
