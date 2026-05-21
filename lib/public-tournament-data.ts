import {
  getAgeGroups,
  getContacts,
  getDiamonds,
  getGames,
  getOrganizationBySlug,
  getTournamentRegistrationFields,
  getRules,
  getResources,
  getStandings,
  getTeams,
  getTournamentsByOrg,
} from './db';
import { hasPlanFeature } from './plan-features';
import { isPublicPageEnabled, type PublicPageKey } from './public-pages';
import type { AgeGroup, Contact, Diamond, Game, Organization, Resource, RuleSection, Team, Tournament, TournamentRegistrationField } from './types';

export type PublicTournamentSection = Extract<PublicPageKey, 'schedule' | 'standings' | 'teams' | 'rules' | 'register'> | 'context';

export type PublicTournamentPageData = {
  organization: Pick<Organization, 'id' | 'name' | 'slug' | 'logoUrl' | 'contactEmail' | 'requireScoreFinalization'>;
  tournaments: Tournament[];
  tournament: Tournament | null;
  pageEnabled: boolean;
  ageGroups: AgeGroup[];
  contacts: Contact[];
  diamonds: Diamond[];
  games: Game[];
  resources: Resource[];
  rules: RuleSection[];
  teams: Team[];
  registrationFields: TournamentRegistrationField[];
  standingsByAgeGroup: Record<string, Awaited<ReturnType<typeof getStandings>>>;
};

const PUBLIC_STATUSES = new Set<Tournament['status']>(['active', 'completed']);

function isPublicStatus(tournament: Tournament) {
  return PUBLIC_STATUSES.has(tournament.status);
}

function publicOrganization(org: Organization): PublicTournamentPageData['organization'] {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logoUrl,
    contactEmail: org.contactEmail,
    requireScoreFinalization: org.requireScoreFinalization,
  };
}

async function getPublicContext(orgSlug: string, tournamentSlug: string | null) {
  const org = await getOrganizationBySlug(orgSlug);
  if (!org || !org.isPublic || org.subscriptionStatus === 'canceled') return null;

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
  const base: PublicTournamentPageData = {
    organization: publicOrganization(org),
    tournaments,
    tournament,
    pageEnabled,
    ageGroups: [],
    contacts: [],
    diamonds: [],
    games: [],
    resources: [],
    rules: [],
    teams: [],
    registrationFields: [],
    standingsByAgeGroup: {},
  };

  if (!tournament || !pageEnabled || section === 'context') {
    return base;
  }

  if (section === 'schedule') {
    const [games, teams, diamonds, ageGroups] = await Promise.all([
      getGames(tournament.id, { admin: true }),
      getTeams(tournament.id, { admin: true }),
      getDiamonds(tournament.id, { admin: true }),
      getAgeGroups(tournament.id, { admin: true }),
    ]);
    return { ...base, games, teams: teams.filter(t => t.status === 'accepted'), diamonds, ageGroups };
  }

  if (section === 'teams') {
    const [teams, ageGroups] = await Promise.all([
      getTeams(tournament.id, { admin: true }),
      getAgeGroups(tournament.id, { admin: true }),
    ]);
    return { ...base, teams: teams.filter(t => t.status === 'accepted'), ageGroups };
  }

  if (section === 'standings') {
    const ageGroups = await getAgeGroups(tournament.id, { admin: true });
    const standingsEntries = await Promise.all(
      ageGroups.map(async group => [
        group.id,
        await getStandings(group.id, group.playoffConfig, { admin: true }),
      ] as const),
    );
    return { ...base, ageGroups, standingsByAgeGroup: Object.fromEntries(standingsEntries) };
  }

  if (section === 'rules') {
    const [rules, resources, ageGroups] = await Promise.all([
      getRules(tournament.id, { admin: true }),
      getResources(tournament.id, { admin: true }),
      getAgeGroups(tournament.id, { admin: true }),
    ]);
    return { ...base, rules, resources, ageGroups };
  }

  if (section === 'register') {
    const [ageGroups, contacts, registrationFields] = await Promise.all([
      getAgeGroups(tournament.id, { admin: true }),
      getContacts(tournament.id, { admin: true }),
      hasPlanFeature(org.planId, 'custom_registration_fields')
        ? getTournamentRegistrationFields(tournament.id)
        : Promise.resolve([]),
    ]);
    return { ...base, ageGroups, contacts, registrationFields };
  }

  return base;
}
