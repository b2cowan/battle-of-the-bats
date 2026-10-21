import 'server-only';
import { getLeagueSeasons, getTournamentsByOrg } from '@/lib/db';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { clubTeamsAddress } from '@/lib/public-club-access';
import { clubHomeTournaments, runningLeagueSeason } from '@/lib/club-site-home';
import { countArchives, countListedTeams } from '@/lib/org-section-availability';
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
 * the listed teams, the running house-league season, the tournaments the home lists (`clubHomeTournaments`: running,
 * coming, or finished in the last 30 days), the sealed ones; and what the plan carries, so a section the plan lacks is
 * absent. A failed read counts as none, which says "Shows once…" rather than breaking the editor. `contentRead` is the
 * route's own read of the site's row (the about text), shared rather than repeated.
 */
export async function publicSiteEditorFacts(
  org: Organization,
  contentRead: Promise<OrgPublicSiteContent | null>,
): Promise<{ facts: SectionFacts; carries: SectionCarries }> {
  const carries = siteSectionCarries(org);
  const [teams, tournaments, archives, seasons, content] = await Promise.all([
    carries.teams ? countListedTeams(org.id) : 0,
    carries.tournaments ? getTournamentsByOrg(org.id).then(all => clubHomeTournaments(all, tournamentToday()).length, () => 0) : 0,
    countArchives(org.id),
    carries.league ? getLeagueSeasons(org.id).catch(() => []) : [],
    contentRead.catch(() => null),
  ]);
  const publicSeasons = seasons.filter(s => s.status !== 'draft');
  return {
    facts: {
      teams,
      leagueSeason: runningLeagueSeason(publicSeasons)?.name ?? null,
      leaguePast: publicSeasons.length > 0 && !runningLeagueSeason(publicSeasons),
      tournaments,
      archives,
      about: !!content?.description?.trim(),
    },
    carries,
  };
}
