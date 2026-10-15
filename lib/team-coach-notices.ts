import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { isDemoOrgId } from './demo-org-server';
import { filterUnpausedUsers } from './notification-pause';
import { findAuthUserIdByEmail } from './auth-account-lookup';
import { chunked, fetchAllIn } from './supabase-paging';
import type { TeamCoachEventType } from './notification-labels';
import {
  TEAM_COACH_WORDS,
  holdsFreeTeam,
  planTeamCoachNotices,
  type TeamCoachNotice,
  type TeamCoachNoticeContext,
  type TeamCoachNoticeRow,
} from './team-coach-notice-plan';

/**
 * lib/team-coach-notices.ts — a FREE coach's bell notices (Free coach header parity, owner 2026-10-13).
 *
 * Every coach email a host's action sends also writes a row to the free coach's bell: the emailed kinds
 * plus game changes (A4), to every coach on the free team (A5), whatever the host's email switches say
 * (A6), and an invitation from a club (A8). The rule for who and the words live in
 * lib/team-coach-notice-plan.ts (pure, unit-tested); this file fetches the facts and writes the rows.
 *
 * ⚠ BELL ONLY — never notify(). notify() would also email and push by preference, and the coach is
 * already emailed by the sender that calls this: routing these through it would send them the same
 * email twice. The existing email and push paths are untouched.
 *
 * ⚠ BEST-EFFORT, AND NEVER THROWS. A notice that fails to write must never fail the organizer's action:
 * every caller awaits it (Amplify has no after() bridge — a detached promise can be frozen mid-write),
 * and every failure ends in a log line.
 */

const INSERT_CHUNK = 500;

async function insertRows(rows: TeamCoachNoticeRow[]): Promise<void> {
  for (const part of chunked(rows, INSERT_CHUNK)) {
    const { error } = await supabaseAdmin.from('notifications').insert(part);
    if (error) console.error('[team-coach-notices] insert failed:', error.message);
  }
}

/** The not-paused subset, or null when the lookup failed (deliver anyway — fail-open, as notify()). */
async function unpausedOf(userIds: string[]): Promise<ReadonlySet<string> | null> {
  try {
    return new Set(await filterUnpausedUsers(userIds));
  } catch (err) {
    console.error('[team-coach-notices] pause lookup failed; delivering without it (fail-open):', err);
    return null;
  }
}

/**
 * Tell every coach on the free teams linked to these registrations. `compose` writes the words for one
 * registration — use TEAM_COACH_WORDS — and may return null to skip it. Returns how many rows it wrote.
 */
export async function notifyTeamCoaches(opts: {
  registrationIds: (string | null | undefined)[];
  eventType: TeamCoachEventType;
  compose: (ctx: TeamCoachNoticeContext) => TeamCoachNotice | null;
  /** The person who acted — nobody is told about their own action. */
  excludeUserIds?: (string | null | undefined)[];
}): Promise<number> {
  const registrationIds = [...new Set(opts.registrationIds.filter((id): id is string => Boolean(id)))];
  // A whole tournament's schedule can name hundreds of registrations; each read takes a slice, so no
  // `in` list outgrows a request.
  let written = 0;
  for (const part of chunked(registrationIds)) written += await notifyChunk(part, opts);
  return written;
}

async function notifyChunk(
  registrationIds: string[],
  opts: Parameters<typeof notifyTeamCoaches>[0],
): Promise<number> {
  try {
    // The registrations, and which free teams they are linked to.
    const [regRes, linkRes] = await Promise.all([
      supabaseAdmin.from('teams').select('id, name, tournament_id').in('id', registrationIds),
      supabaseAdmin.from('basic_coach_team_registrations').select('tournament_team_id, basic_coach_team_id').in('tournament_team_id', registrationIds),
    ]);
    if (regRes.error) throw regRes.error;
    if (linkRes.error) throw linkRes.error;
    const links = linkRes.data ?? [];
    const basicTeamIds = [...new Set(links.map(l => l.basic_coach_team_id as string | null).filter((id): id is string => Boolean(id)))];
    // Nobody's free team is linked to any of them: nothing to tell, and nothing more to read.
    if (basicTeamIds.length === 0) return 0;

    const tournamentIds = [...new Set((regRes.data ?? []).map(r => r.tournament_id as string | null).filter((id): id is string => Boolean(id)))];
    type Seat = { basic_coach_team_id: string | null; user_id: string | null; status: string | null };
    const [tourRes, teamRes, members] = await Promise.all([
      supabaseAdmin.from('tournaments').select('id, name, org_id, start_date, end_date').in('id', tournamentIds),
      supabaseAdmin.from('basic_coach_teams').select('id, team_workspace_id').in('id', basicTeamIds),
      // Paged: a big batch of teams can hold more seats than one read returns, and a cut-off list would
      // silently leave coaches out.
      fetchAllIn<Seat>(basicTeamIds, (chunk, from, to) => supabaseAdmin.from('basic_coach_team_users')
        .select('basic_coach_team_id, user_id, status').in('basic_coach_team_id', chunk).eq('status', 'active')
        .order('basic_coach_team_id').order('user_id').range(from, to)),
    ]);
    if (tourRes.error) throw tourRes.error;
    if (teamRes.error) throw teamRes.error;

    const orgIds = [...new Set((tourRes.data ?? []).map(t => t.org_id as string | null).filter((id): id is string => Boolean(id)))];
    const { data: clubs, error: clubErr } = await supabaseAdmin.from('organizations').select('id, name').in('id', orgIds);
    if (clubErr) throw clubErr;

    // A demo club never notifies anyone. FAIL-CLOSED, like notify(): unable to tell, say nothing.
    const demoOrgIds = new Set<string>();
    for (const orgId of orgIds) {
      try {
        if (await isDemoOrgId(orgId)) demoOrgIds.add(orgId);
      } catch {
        return 0;
      }
    }

    const candidates = [...new Set(members.map(m => m.user_id as string | null).filter((id): id is string => Boolean(id)))];
    const rows = planTeamCoachNotices(
      {
        registrations: regRes.data ?? [],
        tournaments: tourRes.data ?? [],
        clubs: clubs ?? [],
        links,
        freeTeams: teamRes.data ?? [],
        members,
        unpaused: await unpausedOf(candidates),
        demoOrgIds,
      },
      opts.eventType,
      opts.compose,
      (opts.excludeUserIds ?? []).filter((id): id is string => Boolean(id)),
    );
    if (rows.length > 0) await insertRows(rows);
    return rows.length;
  } catch (err) {
    console.error(`[team-coach-notices] ${opts.eventType} failed (non-fatal):`, err);
    return 0;
  }
}

/**
 * A club invited this address to coach one of its teams (A8 — the invitation that waits on Home). The
 * bell carries it only for an EXISTING account that holds a seat on a genuinely free team: that is the
 * free portal's bell, the only one these kinds reach. Filed under the inviting club. Never throws.
 */
export async function notifyInvitedFreeCoach(opts: {
  orgId: string;
  email: string;
  clubName: string;
  teamName: string | null;
  inviteId?: string | null;
}): Promise<void> {
  try {
    if (await isDemoOrgId(opts.orgId)) return;
    const userId = await findAuthUserIdByEmail(opts.email);
    if (!userId) return;

    const { data: seats, error } = await supabaseAdmin
      .from('basic_coach_team_users')
      .select('basic_coach_team_id, status')
      .eq('user_id', userId)
      .eq('status', 'active');
    if (error) throw error;
    const teamIds = [...new Set((seats ?? []).map(s => s.basic_coach_team_id as string | null).filter((id): id is string => Boolean(id)))];
    if (teamIds.length === 0) return;
    const { data: teams, error: teamErr } = await supabaseAdmin
      .from('basic_coach_teams').select('id, team_workspace_id').in('id', teamIds);
    if (teamErr) throw teamErr;
    if (!holdsFreeTeam(seats ?? [], teams ?? [])) return;

    const unpaused = await unpausedOf([userId]);
    if (unpaused && !unpaused.has(userId)) return;

    const words = TEAM_COACH_WORDS.invitation(opts.clubName, opts.teamName);
    await insertRows([{
      org_id: opts.orgId,
      user_id: userId,
      event_type: 'team_coach_invitation',
      title: words.title,
      body: words.body ?? null,
      link: words.link ?? null,
      metadata: opts.inviteId ? { inviteId: opts.inviteId } : {},
    }]);
  } catch (err) {
    // Fail closed on the demo check and on everything else: no notice, and the invitation still went.
    console.error('[team-coach-notices] invitation notice failed (non-fatal):', err);
  }
}
