import 'server-only';
/**
 * CLUB COMMUNICATIONS — WHO IS IN EACH GROUP, read live (Stage 1, Session 1; coach drawing tab 2 and tab 8; board ask 15).
 *
 * Two reads, both returning PEOPLE (with an address the sender uses internally; the rules and the routes never hand one out):
 *  · coaches — every active staff membership on a rep team that isn't archived (whether its season is live or closed: tab 8),
 *    with the not-yet-accepted invitations as team-named "left out" lines; and every house-league coach of a live season
 *    whose row isn't removed (signed in or not, ask 8). The capability filter of the schedule send is NOT applied: a team's
 *    whole staff counts (ask 4).
 *  · the board — `club-group-email-board.ts` (its own module: legal §2a.5 / T5 forbid it any family import).
 */
import { supabaseAdmin } from './supabase-admin';
import { listActiveStaffForTeams, resolveMembershipCapabilities } from './coach-membership';
import { STAFF_KIND_COPY, staffKindWord, type StaffKind } from './coach-capabilities';
import { resolveCoachUserIdentities } from './db';
import { seasonGroup } from './house-league-season';
import { LINES } from './club-group-email-words';
import type { LeagueRow, RepRow } from './club-group-email-rules';

interface LiveSeason { id: string; name: string; divisions: { id: string; name: string }[] }
/** An invitation not accepted yet: left out of every send and named by team (coach ask 8). `head`: a head-coach invitation. */
interface InvitedSlot { line: string; head: boolean }
export interface CoachRows { rep: RepRow[]; league: LeagueRow[]; invited: InvitedSlot[]; seasons: LiveSeason[] }

const personName = (first: string | null, last: string | null, whole: string | null) =>
  [first, last].map(s => (s ?? '').trim()).filter(Boolean).join(' ') || (whole ?? '').trim() || null;

/** Rep staff (when `rep`) and house-league coaches (when `league`), as raw rows; `unionCoaches` makes them people. */
export async function loadCoachRows(orgId: string, want: { rep: boolean; league: boolean }): Promise<CoachRows> {
  const [rep, league] = await Promise.all([
    want.rep ? loadRep(orgId) : Promise.resolve({ rows: [] as RepRow[], invited: [] as InvitedSlot[] }),
    want.league ? loadLeague(orgId) : Promise.resolve({ rows: [] as LeagueRow[], seasons: [] as LiveSeason[] }),
  ]);
  return { rep: rep.rows, invited: rep.invited, league: league.rows, seasons: league.seasons };
}

async function loadRep(orgId: string): Promise<{ rows: RepRow[]; invited: InvitedSlot[] }> {
  const { data: teams, error } = await supabaseAdmin.from('rep_teams').select('id, name').eq('org_id', orgId).eq('is_archived', false);
  if (error) throw error;
  const teamName = new Map((teams ?? []).map(t => [t.id as string, t.name as string]));
  const teamIds = [...teamName.keys()];
  if (teamIds.length === 0) return { rows: [], invited: [] };
  const [staff, invites] = await Promise.all([
    listActiveStaffForTeams(teamIds),
    supabaseAdmin.from('assistant_invite_tokens').select('team_id, coach_role, staff_kind, status, expires_at')
      .in('team_id', teamIds).in('status', ['pending', 'pending_approval']),
  ]);
  if (invites.error) throw invites.error;
  const who = await resolveCoachUserIdentities(orgId, [...new Set(staff.map(s => s.userId))]);
  const rows: RepRow[] = staff.map(s => ({
    userId: s.userId, teamId: s.teamId, teamName: teamName.get(s.teamId) ?? '',
    word: staffKindWord(resolveMembershipCapabilities(s), s.staffKind), head: s.coachRole === 'head_coach',
    name: who.get(s.userId)?.displayName ?? null, email: who.get(s.userId)?.email ?? null,
  }));
  const now = Date.now();
  const invited = (invites.data ?? [])
    .filter(i => !i.expires_at || new Date(i.expires_at as string).getTime() > now)
    .map(i => ({
      head: i.coach_role === 'head_coach',
      line: LINES.invited(teamName.get(i.team_id as string) ?? '',
        i.coach_role === 'head_coach' ? 'Head coach' : STAFF_KIND_COPY[((i.staff_kind as StaffKind | null) ?? 'assistant')]?.name ?? 'Assistant'),
    }))
    .sort((a, b) => a.line.localeCompare(b.line));
  return { rows, invited };
}

async function loadLeague(orgId: string): Promise<{ rows: LeagueRow[]; seasons: LiveSeason[] }> {
  const { data: seasons, error } = await supabaseAdmin.from('league_seasons').select('id, name, status').eq('org_id', orgId);
  if (error) throw error;
  const live = (seasons ?? []).filter(s => seasonGroup({ status: s.status as string }) === 'running');
  const ids = live.map(s => s.id as string);
  if (ids.length === 0) return { rows: [], seasons: [] };
  const [divs, teams, coaches] = await Promise.all([
    supabaseAdmin.from('league_divisions').select('id, name, season_id, sort_order').in('season_id', ids)
      .order('sort_order', { ascending: true }).order('name', { ascending: true }),
    supabaseAdmin.from('league_teams').select('id, name, division_id, season_id').in('season_id', ids),
    supabaseAdmin.from('league_team_coaches').select('id, season_id, team_id, name, first_name, last_name, email, user_id')
      .eq('org_id', orgId).in('season_id', ids).is('removed_at', null),
  ]);
  if (divs.error) throw divs.error;
  if (teams.error) throw teams.error;
  if (coaches.error) throw coaches.error;
  const divName = new Map((divs.data ?? []).map(d => [d.id as string, d.name as string]));
  const team = new Map((teams.data ?? []).map(t => [t.id as string, t]));
  const seasonName = new Map(live.map(s => [s.id as string, s.name as string]));
  const rows: LeagueRow[] = (coaches.data ?? []).map(c => {
    const t = team.get(c.team_id as string);
    const divisionId = (t?.division_id as string | null) ?? null;
    return {
      leagueCoachId: c.id as string, userId: (c.user_id as string | null) ?? null, seasonId: c.season_id as string,
      seasonName: seasonName.get(c.season_id as string) ?? '', divisionId, divisionName: divisionId ? divName.get(divisionId) ?? null : null,
      teamName: (t?.name as string | undefined) ?? '', name: personName(c.first_name, c.last_name, c.name), email: (c.email as string | null) ?? null,
    };
  });
  return {
    rows,
    seasons: live.map(s => ({
      id: s.id as string, name: s.name as string,
      divisions: (divs.data ?? []).filter(d => d.season_id === s.id).map(d => ({ id: d.id as string, name: d.name as string })),
    })),
  };
}
