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
  getAnnouncements,
  resolveTournamentContactEmail,
} from './db';
import { hasPlanFeature } from './plan-features';
import { getPublicStandingsByDivision, onlyPublishedGames } from './public-games';
import { isPublicPageEnabled, isPublicBracketVisible, isPublicTournamentStatus, withInviteOnlyPages, type PublicPageKey } from './public-pages';
import { runsInviteOnlyEvents } from './invite-only-event';
import { publishedCompetitionData, publishedGameTeams } from './public-standings';
import { publicFrameGame, publicTeamsData, publicVenue, type PublicVenue } from './public-teams';
import { publicDivisions, publicNotices, publicPosts, publicTournament, type PublicNotice, type PublicTournament, type PublicTournamentOptions } from './public-tournament-shape';
import type { Division, Game, Organization, Resource, RuleSection, Team, PublicTeam, Tournament, TournamentRegistrationField } from './types';

/**
 * The sections of the public feed. The plain `schedule`, `teams` and `standings` sections are gone (the public feed
 * fix, Stage 8 §16): they carried every division, held-back teams, 0-0-0 standings rows and each game's private
 * notes, and everything still asking for them was server-side. A public reader gets the published-only `-preview`
 * family, `playoffs`, and the two pages that are public by design (`rules`, `register`). `scores` is the consumer
 * feeds' own and server-only — the HTTP route does not serve it.
 */
export type PublicTournamentSection = Extract<PublicPageKey, 'rules' | 'register'> | 'context' | 'scores' | 'standings-preview' | 'playoffs' | 'teams-preview' | 'schedule-preview';

/**
 * Strip a {@link Team} down to its public-safe fields ({@link PublicTeam}). The single
 * choke point for every public/anonymous tournament surface: `getPublicTournamentPageData`
 * feeds BOTH the public pages (server components) and the anonymous
 * `/api/public/tournament-data` endpoint, so sanitizing here closes the J6-001 leak
 * everywhere at once. Never return raw `Team` rows from this module.
 *
 * `showCoachName` gates the coach NAME per the tournament's `coachNamesShowOnPublic`
 * toggle (migration 150, default off). When false the name is stripped to `''` here —
 * at the data layer — so it never reaches the browser/JSON payload, not merely hidden in
 * the UI. The public components already guard `team.coach && …`, so an empty value hides
 * the coach line, search match, and datalist option automatically.
 */
export function toPublicTeam(t: Team, showCoachName: boolean): PublicTeam {
  return {
    id: t.id,
    tournamentId: t.tournamentId,
    divisionId: t.divisionId,
    name: t.name,
    coach: showCoachName ? t.coach : '',
    status: t.status,
    poolId: t.poolId,
    seed: t.seed ?? null,
  };
}

export type PublicTournamentPageData = {
  organization: Pick<Organization, 'id' | 'name' | 'slug' | 'logoUrl' | 'contactEmail' | 'requireScoreFinalization'>;
  /** The public shape of the event (lib/public-tournament-shape.ts) — never the internal record. */
  tournament: PublicTournament | null;
  pageEnabled: boolean;
  divisions: Division[];
  venues: PublicVenue[];
  games: Game[];
  resources: Resource[];
  rules: RuleSection[];
  /** Public-safe teams only — see {@link toPublicTeam} / J6-001. */
  teams: PublicTeam[];
  registrationFields: TournamentRegistrationField[];
  /** Pinned notices for the Schedule's game-day strip (J6-033): only while News is shown, never one aimed at a
   *  held-back division, and only the fields the strip reads — see {@link publicNotices}. Optional so manual payload
   *  constructors (e.g. admin preview) don't have to set it; consumers treat undefined as an empty list. */
  announcements?: PublicNotice[];
  standingsByDivision: Record<string, Awaited<ReturnType<typeof getStandings>>>;
  /** True while the organizer holds some division's games back (Stage 0 · D1). Only the yes/no leaves the server —
   *  it keeps a reader from calling the event finished on the divisions it can show. Set by the game sections. */
  gamesWithheld?: boolean;
  /** Stage 5 preview: a yes/no only, for the all-divisions-held-back Teams state. No hidden names or counts. */
  teamsWithheld?: boolean;
  /** Whether the org's plan includes fan push score alerts (Tournament Plus+).
   *  Optional so manual payload constructors (e.g. admin preview) don't have to
   *  set it; the resolver always populates it and consumers treat undefined as false. */
  fanAlertsEnabled?: boolean;
};

/**
 * A tournament's games as the scores feeds send them, read and gated in one place for the `scores` section and the club
 * home's read: published divisions only, a held-back opponent blanked, the public game shape (no notes, no score-entry
 * details). `gamesWithheld`: some game was left out. Three reads, in parallel.
 */
async function readScoresGames(
  tournamentId: string,
  /** The club home's all-or-nothing read: a failed read throws instead of reading as no games. */
  strict = false,
): Promise<{ games: Game[]; gamesWithheld: boolean; teams: Team[] }> {
  const [games, teams, divisions] = await Promise.all([
    getGames(tournamentId, { admin: true, strict }),
    getTeams(tournamentId, { admin: true, strict }),
    getDivisions(tournamentId, { admin: true, strict }),
  ]);
  const shown = onlyPublishedGames(games, divisions);
  // A published division's crossover game must not name a held-back opponent: this feed's consumers resolve names from
  // `teams`, which keeps every accepted team (the follow status counts them), so blank the held-back sides here.
  const publishedIds = new Set(divisions.filter(d => d.scheduleVisibility === 'published').map(d => d.id));
  // Every team of a published division, whatever its status: a withdrawn finalist is still the one who played the final.
  const openTeamIds = new Set(teams.filter(t => publishedIds.has(t.divisionId)).map(t => t.id));
  return { games: shown.map(g => publicFrameGame(publishedGameTeams(g, openTeamIds))), gamesWithheld: shown.length !== games.length, teams };
}

function isPublicStatus(tournament: Tournament) {
  return isPublicTournamentStatus(tournament.status);
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

  // An invite-only event has no Registration page (R6): every public reader sees its switch off.
  return { org, tournament: tournament ? withInviteOnlyPages(tournament, runsInviteOnlyEvents(org.planId)) : null };
}

export async function getPublicTournamentPageData(
  orgSlug: string,
  tournamentSlug: string | null,
  section: PublicTournamentSection = 'context',
  /** Server-only callers: `{ look: true }` puts the event's theme and logo on `tournament`. The HTTP route never passes it. */
  load: Pick<PublicTournamentOptions, 'look'> & {
    /** Server-only callers that read the games and never send them on (the share image's champion card): keep the
     *  Teams section's games even while the Schedule page is switched off. The HTTP route never passes it. */
    keepGames?: boolean;
  } = {},
): Promise<PublicTournamentPageData | null> {
  const context = await getPublicContext(orgSlug, tournamentSlug);
  if (!context) return null;

  const { org, tournament } = context;
  // 'scores' is the cross-tournament consumer feed (My Games) — gate it on the SCHEDULE
  // page's visibility, exactly like the 'schedule-preview' section, so a hidden schedule never
  // leaks games here either.
  const sectionKey = section === 'context' || section === 'playoffs' ? null : section === 'scores' || section === 'schedule-preview' ? 'schedule' : section === 'teams-preview' ? 'teams' : section === 'standings-preview' ? 'standings' : section;
  const pageEnabled = section === 'playoffs' ? isPublicBracketVisible(tournament) : !sectionKey || isPublicPageEnabled(tournament, sectionKey);

  // Resolve the contact email shown on public pages, honoring the per-tournament
  // `contact_show_on_public` toggle (migration 120). Override BOTH the tournament and org
  // contact fields so the components' `tournament.contactEmail ?? organization.contactEmail`
  // fallback can never leak an address the organizer chose to hide.
  const publicContactEmail = tournament
    ? await resolveTournamentContactEmail(tournament.id, org.contactEmail ?? null, 'public')
    : (org.contactEmail ?? null);

  // The event as the public sees it: a fixed list of fields, never the record (lib/public-tournament-shape.ts).
  // The fee schedule and how-to-pay text travel only on the Register section, as far as the organizer shows them — and
  // not at all while the organizer has the Register page off (an invite-only event always does).
  const base: PublicTournamentPageData = {
    organization: { ...publicOrganization(org, tournament), contactEmail: publicContactEmail },
    tournament: tournament ? publicTournament(tournament, publicContactEmail ?? undefined, { register: section === 'register' && pageEnabled, look: load.look }) : null,
    pageEnabled,
    divisions: [],
    venues: [],
    games: [],
    resources: [],
    rules: [],
    teams: [],
    registrationFields: [],
    announcements: [],
    standingsByDivision: {},
    fanAlertsEnabled: hasPlanFeature(org.planId, 'fan_score_alerts'),
  };

  if (!tournament || !pageEnabled || section === 'context') {
    return base;
  }

  // Divisions travel without their fee schedule everywhere but a Register page that shows fees.
  const sendDivisions = (divisions: Division[], register = false) => publicDivisions(divisions, tournament.settings, register);

  // Cross-tournament consumer scores feed (Unified Home Scores tab): only games + teams are
  // read downstream, so skip the schedule-preview section's venues / divisions / announcements fetches
  // — this path is polled, so those extra round-trips would repeat every tick. Server-only: the
  // HTTP route does not serve it.
  if (section === 'scores') {
    const { games, gamesWithheld, teams } = await readScoresGames(tournament.id);
    return { ...base, games, gamesWithheld, teams: teams.filter(t => t.status === 'accepted').map(t => toPublicTeam(t, tournament.coachNamesShowOnPublic === true)) };
  }

  if (section === 'schedule-preview') {
    const [games, teams, venues, divisions, announcements] = await Promise.all([
      getGames(tournament.id, { admin: true }),
      getTeams(tournament.id, { admin: true }),
      getVenues(tournament.id, { admin: true, includeFacilities: true }),
      getDivisions(tournament.id, { admin: true }),
      // Read only when the strip could show them: a hidden News page sends none.
      isPublicPageEnabled(tournament, 'news') ? getAnnouncements(tournament.id, { admin: true }) : Promise.resolve([]),
    ]);
    return publicTeamsData({
      ...base,
      games: onlyPublishedGames(games, divisions),
      teams: teams.filter(t => t.status === 'accepted').map(t => toPublicTeam(t, tournament.coachNamesShowOnPublic === true)),
      venues: venues.map(publicVenue),
      divisions: sendDivisions(divisions),
      // Judged against the full division list: a post aimed at a held-back division must not reach the strip.
      announcements: publicNotices(announcements, tournament, divisions),
    });
  }

  // The Schedule page is the games' own switch (sweep 3, finding 6). While it is off, the Teams, Standings and Playoffs
  // sections send no round-robin game: no date, time, place, pairing or score a hidden Schedule would have shown. The
  // playoff games stay, because the bracket is its own page that hiding Schedule has never hidden
  // (tests/unit/public-bracket-visibility.test.ts), and a bracket is those games.
  const scheduleShown = isPublicPageEnabled(tournament, 'schedule');
  const unlessScheduleHidden = (games: Game[]) => scheduleShown ? games : games.filter(g => g.isPlayoff);

  if (section === 'teams-preview') {
    const [teams, divisions, games] = await Promise.all([
      getTeams(tournament.id, { admin: true }),
      getDivisions(tournament.id, { admin: true }),
      getGames(tournament.id, { admin: true }),
    ]);
    // The Teams page shows a record and a place only while BOTH Standings and Schedule are on (its own rule, in
    // PublicTeams), and a "next game" line from the games alone: with either switch off there is nothing here to send.
    const recordsShown = scheduleShown && isPublicPageEnabled(tournament, 'standings');
    return publicTeamsData({
      ...base,
      teams: teams.filter(t => t.status === 'accepted').map(t => toPublicTeam(t, tournament.coachNamesShowOnPublic === true)),
      divisions: sendDivisions(divisions),
      games: scheduleShown || load.keepGames ? onlyPublishedGames(games, divisions) : [],
      standingsByDivision: recordsShown ? await getPublicStandingsByDivision(tournament, divisions, { games, teams }) : {},
    });
  }

  if (section === 'standings-preview' || section === 'playoffs') {
    const [divisions, games, teams, venues] = await Promise.all([
      getDivisions(tournament.id, { admin: true }),
      getGames(tournament.id, { admin: true }),
      getTeams(tournament.id, { admin: true }),
      getVenues(tournament.id, { admin: true, includeFacilities: true }),
    ]);
    // The new Standings and Playoffs bodies ship their games to the browser (initial data + the live feed): published
    // divisions only, and never a game's private notes or the scorekeeper's identity (Stage 8 Part 3c, found at /review).
    const published = publishedCompetitionData({
      ...base,
      divisions: sendDivisions(divisions),
      games: unlessScheduleHidden(onlyPublishedGames(games, divisions)),
      teams: teams.filter(t => t.status === 'accepted').map(t => toPublicTeam(t, tournament.coachNamesShowOnPublic === true)),
      venues: venues.map(publicVenue),
      standingsByDivision: await getPublicStandingsByDivision(tournament, divisions, { games, teams }),
    });
    return { ...published, games: published.games.map(publicFrameGame) };
  }

  if (section === 'rules') {
    const [rules, resources, divisions] = await Promise.all([
      getRules(tournament.id, { admin: true }),
      getResources(tournament.id, { admin: true }),
      getDivisions(tournament.id, { admin: true }),
    ]);
    // Only published divisions: the Rules page reads the divisions for its filter, and a held-back division's name and
    // settings must not ride along (Register still gets them all, below: a team signs up for any open division).
    // A rule section aimed at a held-back division is not sent either (the same filter as a post, judged against ALL divisions).
    return { ...base, rules: publicPosts(rules, divisions), resources, divisions: sendDivisions(divisions.filter(d => d.scheduleVisibility === 'published')) };
  }

  if (section === 'register') {
    const [divisions, registrationFields] = await Promise.all([
      getDivisions(tournament.id, { admin: true }),
      hasPlanFeature(org.planId, 'custom_registration_fields')
        ? getTournamentRegistrationFields(tournament.id)
        : Promise.resolve([]),
    ]);
    return { ...base, divisions: sendDivisions(divisions, true), registrationFields };
  }

  return base;
}

/** One of a club's tournaments with public games in a window (Club Website Stage 1, the home's one games read). */
export interface PublicTournamentDayGames {
  tournament: Pick<Tournament, 'id' | 'name' | 'slug'>;
  /** The organizer's "a submitted score waits for confirmation" setting, as the tournament's pages read it. */
  requireFinalization: boolean;
  games: Game[];
}

/**
 * A club's tournament games on [fromDay, toDay] (club days, YYYY-MM-DD), by THE tournament public rule — the `scores`
 * section's, without re-reading the club per tournament: the club not cancelled, a public status (active or completed),
 * the organizer's Schedule page on (while it is off, NO entry at all: the home would show dates, times and places, which is
 * what the organizer hid — the cross-tournament scores feed's rule), published divisions only, a held-back opponent
 * blanked, the public game shape. Like every tournament page, it never asks the club site's switch. One list read, then
 * three reads per tournament whose dates reach the window. ⚠ Every read here throws on a failure (the home's read is all or
 * nothing, Stage 1 G11), so a failed read can never look like a day with no games.
 */
export async function publicTournamentGamesBetween(
  org: Pick<Organization, 'id' | 'planId' | 'subscriptionStatus' | 'requireScoreFinalization'>,
  fromDay: string,
  toDay: string,
): Promise<PublicTournamentDayGames[]> {
  if (org.subscriptionStatus === 'canceled') return [];
  const reaching = (await getTournamentsByOrg(org.id, { admin: true, strict: true }))
    .filter(isPublicStatus)
    .filter(t => !!t.startDate && t.startDate <= toDay && (t.endDate ?? t.startDate) >= fromDay)
    .map(t => withInviteOnlyPages(t, runsInviteOnlyEvents(org.planId)))
    .filter(t => isPublicPageEnabled(t, 'schedule'));
  const out = await Promise.all(reaching.map(async tournament => {
    const { games } = await readScoresGames(tournament.id, true);
    const inWindow = games.filter(g => !!g.date && g.date >= fromDay && g.date <= toDay);
    return inWindow.length ? {
      tournament: { id: tournament.id, name: tournament.name, slug: tournament.slug },
      requireFinalization: tournament.requireScoreFinalization ?? org.requireScoreFinalization ?? true,
      games: inWindow,
    } : null;
  }));
  return out.filter((x): x is PublicTournamentDayGames => x !== null);
}
