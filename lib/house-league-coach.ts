import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import {
  coachPageOpenUntil, houseLeagueCoachAccess, type HouseLeagueCoachLink, type HouseLeagueCoachView,
} from './house-league-access';
import { clubPublicContact } from './club-email-context';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A HOUSE-LEAGUE COACH READS (Club Tier Stage 9c, ruling 9c·1 + 9c·9; the coach column of the one gate).
 *
 * A coach is a row of league_team_coaches carrying their user id once they accept. They read ONE thing: their team's
 * accepted players and each family's guardian name, email and phone. Never a rating, a fee, a note, another team, or a
 * child who has left. The player read below names its columns and filters on the team the access check approved, so a
 * coach of the Jays reads nothing of the Cardinals (tests/unit/house-league-coach-read-guard.test.ts).
 *
 * No Coaches Portal: a house-league coach has no club membership from this (lib/user-contexts.ts builds their card
 * from these rows), and nothing here touches the portal.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The ONLY registration columns a coach's page reads. Adding one here is a decision about children's data (9c·9). */
export const COACH_PLAYER_COLUMNS =
  'id, player_first_name, player_last_name, guardian_first_name, guardian_last_name, guardian_email, guardian_phone' as const;

export interface CoachTeamCard {
  teamId: string;
  teamName: string;
  divisionName: string;
  seasonName: string;
  seasonSlug: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
}

export interface CoachPlayer {
  id: string;
  firstName: string;
  lastName: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string | null;
}

export interface CoachTeamPage {
  view: HouseLeagueCoachView;
  team: CoachTeamCard;
  coaches: string[];
  /** Empty unless the view is open or finished. */
  players: CoachPlayer[];
  /** A finished season: the day the page closes (copy §10.3). */
  openUntil: string | null;
  contactEmail: string | null;
  /** Every team this person coaches now, for the switcher (copy §10.2), this one included. */
  myTeams: CoachTeamCard[];
}

interface LinkRow {
  team_id: string;
  user_id: string | null;
  accepted_at: string | null;
  removed_at: string | null;
}

interface TeamRow {
  id: string;
  name: string;
  league_divisions: { name: string } | { name: string }[] | null;
  league_seasons: {
    name: string; slug: string; status: string; finished_at: string | null; org_id: string;
    organizations: { slug: string; name: string } | { slug: string; name: string }[] | null;
  } | null;
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

const TEAM_SELECT =
  'id, name, league_divisions(name), league_seasons(name, slug, status, finished_at, org_id, organizations(slug, name))';

function toCard(t: TeamRow): CoachTeamCard | null {
  const season = t.league_seasons;
  const org = one(season?.organizations);
  if (!season || !org) return null;
  return {
    teamId: t.id, teamName: t.name, divisionName: one(t.league_divisions)?.name ?? '',
    seasonName: season.name, seasonSlug: season.slug, orgId: season.org_id, orgSlug: org.slug, orgName: org.name,
  };
}

const toLink = (r: LinkRow): HouseLeagueCoachLink => ({
  teamId: r.team_id, userId: r.user_id, acceptedAt: r.accepted_at, removedAt: r.removed_at,
});

/**
 * The teams this person coaches whose page is still there: a live season, or one that finished in the last 30 days.
 * One sign-in card per team (copy §10.1).
 */
export async function getCoachTeamCards(userId: string, now: Date = new Date()): Promise<CoachTeamCard[]> {
  const { data: links, error } = await supabaseAdmin.from('league_team_coaches')
    .select('team_id, user_id, accepted_at, removed_at')
    .eq('user_id', userId).is('removed_at', null).not('accepted_at', 'is', null);
  if (error) throw new Error(`Couldn't read coaching links: ${error.message}`);
  const teamIds = [...new Set((links ?? []).map(l => l.team_id as string))];
  if (teamIds.length === 0) return [];
  const { data: teams, error: teamError } = await supabaseAdmin.from('league_teams').select(TEAM_SELECT).in('id', teamIds);
  if (teamError) throw new Error(`Couldn't read coached teams: ${teamError.message}`);
  const cards: CoachTeamCard[] = [];
  for (const team of (teams ?? []) as unknown as TeamRow[]) {
    const season = team.league_seasons;
    const view = houseLeagueCoachAccess((links ?? []).map(l => toLink(l as LinkRow)), userId, team.id,
      season ? { status: season.status, finishedAt: season.finished_at } : null, now);
    if (view !== 'open' && view !== 'finished') continue;
    const card = toCard(team);
    if (card) cards.push(card);
  }
  return cards.sort((a, b) => a.seasonName.localeCompare(b.seasonName) || a.teamName.localeCompare(b.teamName));
}

/**
 * One coach's page for one team, or null when they never coached it (a 404: not even that the team exists).
 * The org slug from the URL must match the team's club.
 */
export async function readCoachTeamPage(
  userId: string, orgSlug: string, teamId: string, now: Date = new Date(),
): Promise<CoachTeamPage | null> {
  const { data: links, error } = await supabaseAdmin.from('league_team_coaches')
    .select('team_id, user_id, accepted_at, removed_at').eq('user_id', userId).eq('team_id', teamId);
  if (error) throw new Error(`Couldn't read the coaching link: ${error.message}`);
  if (!links || links.length === 0) return null;

  const { data: teamRow, error: teamError } = await supabaseAdmin.from('league_teams')
    .select(TEAM_SELECT).eq('id', teamId).maybeSingle();
  if (teamError) throw new Error(`Couldn't read the team: ${teamError.message}`);
  const team = teamRow as unknown as TeamRow | null;
  const card = team ? toCard(team) : null;
  if (!team || !card || card.orgSlug !== orgSlug) return null;

  const season = team.league_seasons!;
  const view = houseLeagueCoachAccess(links.map(l => toLink(l as LinkRow)), userId, teamId,
    { status: season.status, finishedAt: season.finished_at }, now);
  if (view === 'none') return null;

  const [coachRows, players, myTeams, contactEmail] = await Promise.all([
    view === 'gone' ? Promise.resolve([] as { name: string }[]) : readCoachNames(teamId),
    view === 'open' || view === 'finished' ? readTeamPlayers(teamId) : Promise.resolve([] as CoachPlayer[]),
    getCoachTeamCards(userId, now),
    clubPublicContact(card.orgId),
  ]);
  const until = coachPageOpenUntil(season.finished_at, now);
  return {
    view, team: card, coaches: coachRows.map(c => c.name), players,
    openUntil: view === 'finished' && until ? until.toISOString() : null,
    contactEmail,
    myTeams,
  };
}

async function readCoachNames(teamId: string): Promise<{ name: string }[]> {
  const { data, error } = await supabaseAdmin.from('league_team_coaches')
    .select('name').eq('team_id', teamId).is('removed_at', null).order('created_at');
  if (error) throw new Error(`Couldn't read the team's coaches: ${error.message}`);
  return (data ?? []) as { name: string }[];
}

/** The team's accepted players and their families' contacts — the whole of what 9c·9 lets a coach see. */
async function readTeamPlayers(teamId: string): Promise<CoachPlayer[]> {
  const { data, error } = await supabaseAdmin.from('league_registrations')
    .select(COACH_PLAYER_COLUMNS).eq('team_id', teamId).eq('status', 'active')
    .order('player_last_name').order('player_first_name');
  if (error) throw new Error(`Couldn't read the team's players: ${error.message}`);
  return (data ?? []).map(r => ({
    id: r.id,
    firstName: r.player_first_name,
    lastName: r.player_last_name,
    guardianName: [r.guardian_first_name, r.guardian_last_name].filter(Boolean).join(' '),
    guardianEmail: r.guardian_email,
    guardianPhone: r.guardian_phone?.trim() ? r.guardian_phone.trim() : null,
  }));
}
