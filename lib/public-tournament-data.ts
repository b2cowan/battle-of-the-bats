import {
  getDivisions,
  getVenues,
  getGames,
  getOrganizationBySlug,
  getTournamentRegistrationFields,
  getRules,
  getResources,
  getStandings,
  getTeams,
  getTournamentsByOrg,
  resolveTournamentContactEmail,
} from './db';
import { hasPlanFeature } from './plan-features';
import { isPublicPageEnabled, type PublicPageKey } from './public-pages';
import type { Division, Venue, Game, Organization, Resource, RuleSection, Team, PublicTeam, Tournament, TournamentRegistrationField } from './types';

export type PublicTournamentSection = Extract<PublicPageKey, 'schedule' | 'standings' | 'teams' | 'rules' | 'register'> | 'context';

/**
 * Strip a {@link Team} down to its public-safe fields ({@link PublicTeam}). The single
 * choke point for every public/anonymous tournament surface: `getPublicTournamentPageData`
 * feeds BOTH the public pages (server components) and the anonymous
 * `/api/public/tournament-data` endpoint, so sanitizing here closes the J6-001 leak
 * everywhere at once. Never return raw `Team` rows from this module.
 */
export function toPublicTeam(t: Team): PublicTeam {
  return {
    id: t.id,
    tournamentId: t.tournamentId,
    divisionId: t.divisionId,
    name: t.name,
    coach: t.coach,
    status: t.status,
    poolId: t.poolId,
    seed: t.seed ?? null,
  };
}

export type PublicTournamentPageData = {
  organization: Pick<Organization, 'id' | 'name' | 'slug' | 'logoUrl' | 'contactEmail' | 'requireScoreFinalization'>;
  tournaments: Tournament[];
  tournament: Tournament | null;
  pageEnabled: boolean;
  divisions: Division[];
  venues: Venue[];
  games: Game[];
  resources: Resource[];
  rules: RuleSection[];
  /** Public-safe teams only — see {@link toPublicTeam} / J6-001. */
  teams: PublicTeam[];
  registrationFields: TournamentRegistrationField[];
  standingsByDivision: Record<string, Awaited<ReturnType<typeof getStandings>>>;
  /** Whether the org's plan includes fan push score alerts (Tournament Plus+).
   *  Optional so manual payload constructors (e.g. admin preview) don't have to
   *  set it; the resolver always populates it and consumers treat undefined as false. */
  fanAlertsEnabled?: boolean;
};

const PUBLIC_STATUSES = new Set<Tournament['status']>(['active', 'completed']);

function isPublicStatus(tournament: Tournament) {
  return PUBLIC_STATUSES.has(tournament.status);
}

function publicOrganization(org: Organization, tournament?: Tournament | null): PublicTournamentPageData['organization'] {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logoUrl,
    contactEmail: org.contactEmail,
    requireScoreFinalization: tournament?.requireScoreFinalization ?? org.requireScoreFinalization,
  };
}

async function getPublicContext(orgSlug: string, tournamentSlug: string | null) {
  const org = await getOrganizationBySlug(orgSlug);
  // Tournament public pages are independent of the org's public-profile setting.
  // org.isPublic gates the org home/league pages (League/Club only), NOT tournament pages —
  // Tournament Plus organizers have no org profile but their tournaments must still be public.
  if (!org || org.subscriptionStatus === 'canceled') return null;

  const tournaments = (await getTournamentsByOrg(org.id, { admin: true }))
    .filter(isPublicStatus)
    .sort((a, b) => b.year - a.year);
  const tournament = tournamentSlug
    ? tournaments.find(t => t.slug === tournamentSlug) ?? null
    : tournaments.find(t => t.status === 'active') ?? tournaments[0] ?? null;

  if (tournamentSlug && !tournament) return null;

  return { org, tournaments, tournament };
}

export async function getPublicTournamentPageData(
  orgSlug: string,
  tournamentSlug: string | null,
  section: PublicTournamentSection = 'context',
): Promise<PublicTournamentPageData | null> {
  const context = await getPublicContext(orgSlug, tournamentSlug);
  if (!context) return null;

  const { org, tournaments, tournament } = context;
  const sectionKey = section === 'context' ? null : section;
  const pageEnabled = !sectionKey || isPublicPageEnabled(tournament, sectionKey);

  // Resolve the contact email shown on public pages, honoring the per-tournament
  // `contact_show_on_public` toggle (migration 120). Override BOTH the tournament and org
  // contact fields so the components' `tournament.contactEmail ?? organization.contactEmail`
  // fallback can never leak an address the organizer chose to hide.
  const publicContactEmail = tournament
    ? await resolveTournamentContactEmail(tournament.id, org.contactEmail ?? null, 'public')
    : (org.contactEmail ?? null);

  const base: PublicTournamentPageData = {
    organization: { ...publicOrganization(org, tournament), contactEmail: publicContactEmail },
    tournaments,
    tournament: tournament ? { ...tournament, contactEmail: publicContactEmail ?? undefined } : null,
    pageEnabled,
    divisions: [],
    venues: [],
    games: [],
    resources: [],
    rules: [],
    teams: [],
    registrationFields: [],
    standingsByDivision: {},
    fanAlertsEnabled: hasPlanFeature(org.planId, 'fan_score_alerts'),
  };

  if (!tournament || !pageEnabled || section === 'context') {
    return base;
  }

  if (section === 'schedule') {
    const [games, teams, venues, divisions] = await Promise.all([
      getGames(tournament.id, { admin: true }),
      getTeams(tournament.id, { admin: true }),
      getVenues(tournament.id, { admin: true }),
      getDivisions(tournament.id, { admin: true }),
    ]);
    return { ...base, games, teams: teams.filter(t => t.status === 'accepted').map(toPublicTeam), venues, divisions };
  }

  if (section === 'teams') {
    const [teams, divisions, games] = await Promise.all([
      getTeams(tournament.id, { admin: true }),
      getDivisions(tournament.id, { admin: true }),
      getGames(tournament.id, { admin: true }),
    ]);
    return { ...base, teams: teams.filter(t => t.status === 'accepted').map(toPublicTeam), divisions, games };
  }

  if (section === 'standings') {
    const [divisions, games, teams, venues] = await Promise.all([
      getDivisions(tournament.id, { admin: true }),
      getGames(tournament.id, { admin: true }),
      getTeams(tournament.id, { admin: true }),
      getVenues(tournament.id, { admin: true }),
    ]);
    const standingsEntries = await Promise.all(
      divisions.map(async group => [
        group.id,
        await getStandings(group.id, group.playoffConfig, { admin: true }, tournament.settings),
      ] as const),
    );
    return {
      ...base,
      divisions,
      games,
      teams: teams.filter(t => t.status === 'accepted').map(toPublicTeam),
      venues,
      standingsByDivision: Object.fromEntries(standingsEntries),
    };
  }

  if (section === 'rules') {
    const [rules, resources, divisions] = await Promise.all([
      getRules(tournament.id, { admin: true }),
      getResources(tournament.id, { admin: true }),
      getDivisions(tournament.id, { admin: true }),
    ]);
    return { ...base, rules, resources, divisions };
  }

  if (section === 'register') {
    const [divisions, registrationFields] = await Promise.all([
      getDivisions(tournament.id, { admin: true }),
      hasPlanFeature(org.planId, 'custom_registration_fields')
        ? getTournamentRegistrationFields(tournament.id)
        : Promise.resolve([]),
    ]);
    return { ...base, divisions, registrationFields };
  }

  return base;
}
