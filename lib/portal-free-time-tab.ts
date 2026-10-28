import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { consoleDate } from './console-dates';
import { earliestLastDay, formatShortDay, todayEastern } from './free-time';
import { readCoach, readPortalGiveFacts, type Actor } from './portal-free-time-give';
import { runningPortalFreeTime } from './portal-free-time-server';
import {
  firstGiveDayOf,
  freeTeamLabel,
  freeTimePortalOf,
  offerableTeams,
  portalCapWords,
  portalGiveBlockOf,
  portalLatestLastDay,
  type CoachPortalFacts,
  type PortalGiveBlock,
} from './portal-free-time';

/**
 * A person's Coaches Portal tab (Support console Stage 4b, drawing A): the coach's free teams with what each holds and
 * the tournament it is in, their Premium Coaches Portals, and, for a role holding the `portal_free_time` power, the door
 * or the one line where it would be. The first place the console shows a free coach's team. Every role that opens a
 * person sees the tab; only a giver is handed `give` (R6: absent beats disabled). The rules are the give's own
 * (`portalGiveBlockOf`), read from the same facts the server decides from, so the tab and the server cannot disagree.
 */

export type CoachTabTeam = {
  id: string;
  name: string;
  /** "UAT Free Team · Baseball, U13". */
  label: string;
  /** "Free Coaches Portal · 12 players · 6 events · 3 fees · entered in … (accepted) · created Oct 18, 2026". */
  holds: string;
  players: number;
  events: number;
  fees: number;
};

export type CoachTabPortal = { orgId: string; name: string; state: string };

/** The window's limits: the shared date field greys every day outside them (Q2/Q5). */
export type PortalFreeTimeBounds = {
  earliest: string;
  latest: string;
  capWords: string;
  superAdmin: boolean;
  /** The day free time was first given (the limits' anchor), or null for a first give. */
  firstGiveDay: string | null;
};

export type CoachPortalTab = {
  coachName: string;
  teams: CoachTabTeam[];
  portals: CoachTabPortal[];
  /** The band's figure, in the coach's words: "Free" with only a free team, "Premium" while a portal is in force. */
  band: { value: string; sub: string; orgId: string | null };
  /** Only for a role holding the power. */
  give: null | {
    block: PortalGiveBlock | null;
    mode: 'first' | 'again';
    /** The teams the window offers (first give). */
    offer: CoachTabTeam[];
    /** The one staff-given portal a later give reuses (Super admin, Q5). */
    againPortal: { orgId: string; name: string } | null;
    bounds: PortalFreeTimeBounds;
  };
};

const CLUB_BILLED_MODES = new Set(['club_included', 'org_team_addon', 'club_extra_team']);

/** A Premium portal's state in a few words, for its row on the tab. */
function portalState(p: CoachPortalFacts): string {
  if (p.movedIntoClub || CLUB_BILLED_MODES.has(p.billingMode)) return 'In a club, and the club pays for it';
  if (p.freeTimeGivenAt && p.billingMode === 'platform_override') {
    if (p.runningGrant) return `Free time through ${formatShortDay(p.runningGrant.lastDay)}`;
    if (p.endedLastDay) return `Free time ran through ${formatShortDay(p.endedLastDay)} · back on the free Coaches Portal`;
  }
  if (p.foundingLastDay) return `Founding Season, free through ${formatShortDay(p.foundingLastDay)}`;
  if (!p.inForce) return 'Cancelled';
  if (p.billingMode === 'platform_override') return 'Free from FieldLogicHQ';
  return 'Pays through Stripe';
}

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

async function countOf(table: string, teamId: string): Promise<number> {
  const { count, error } = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('basic_coach_team_id', teamId);
  if (error) throw error;
  return count ?? 0;
}

/** Each free team's tournament entries: "UAT Chat Review Cup (accepted)". Plain reads, no embeds (PGRST201). */
async function entriesByTeam(teamIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (teamIds.length === 0) return out;
  const { data: links, error } = await supabaseAdmin
    .from('basic_coach_team_registrations')
    .select('basic_coach_team_id, tournament_team_id')
    .in('basic_coach_team_id', teamIds);
  if (error) throw error;
  const regIds = [...new Set((links ?? []).map(l => l.tournament_team_id as string))];
  if (regIds.length === 0) return out;
  const { data: regs, error: regError } = await supabaseAdmin.from('teams').select('id, tournament_id, status').in('id', regIds);
  if (regError) throw regError;
  const tournamentIds = [...new Set((regs ?? []).map(r => r.tournament_id as string).filter(Boolean))];
  const { data: tournaments, error: tError } = tournamentIds.length
    ? await supabaseAdmin.from('tournaments').select('id, name').in('id', tournamentIds)
    : { data: [], error: null };
  if (tError) throw tError;
  const nameOf = new Map((tournaments ?? []).map(t => [t.id as string, t.name as string]));
  const regOf = new Map((regs ?? []).map(r => [r.id as string, r as { tournament_id: string; status: string | null }]));
  for (const l of links ?? []) {
    const reg = regOf.get(l.tournament_team_id as string);
    const name = reg ? nameOf.get(reg.tournament_id) : null;
    if (!name) continue;
    const words = reg?.status ? `${name} (${reg.status})` : name;
    out.set(l.basic_coach_team_id as string, [...(out.get(l.basic_coach_team_id as string) ?? []), words]);
  }
  return out;
}

/**
 * Free time on a Coaches Portal's own record (drawing B): whether staff gave it free time, the grant running now, and,
 * for a giver, Change the end date's limits (from the first give, Q5) and a later give from here (Super admin) or the
 * one line where its door would be. Null for an organization that is not a Coaches Portal.
 */
export type PortalRecordFreeTime = {
  /** Staff gave this portal free time and nobody pays for it yet (the mark, mig 406). */
  freeTime: boolean;
  coachName: string;
  ownerUserId: string | null;
  running: { id: string; lastDay: string; expiresAt: string } | null;
  changeBounds: PortalFreeTimeBounds | null;
  give: CoachPortalTab['give'];
  /** The line in place of the Access list's Give free time, for a giver. */
  giveLine: PortalGiveBlock | null;
};

export async function readPortalRecordFreeTime(orgId: string, orgName: string, viewer: Actor, canGive: boolean): Promise<PortalRecordFreeTime | null> {
  const { data: ws, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('primary_owner_user_id, billing_mode, free_time_given_at')
    .eq('workspace_org_id', orgId)
    .maybeSingle<{ primary_owner_user_id: string | null; billing_mode: string; free_time_given_at: string | null }>();
  if (error) throw error;
  if (!ws) return null;
  const freeTime = !!ws.free_time_given_at && ws.billing_mode === 'platform_override';
  const [running, owner] = await Promise.all([
    freeTime ? runningPortalFreeTime(orgId) : Promise.resolve(null),
    ws.primary_owner_user_id ? readCoach(ws.primary_owner_user_id) : Promise.resolve(null),
  ]);
  const base = {
    freeTime,
    coachName: owner?.name ?? 'The coach',
    ownerUserId: ws.primary_owner_user_id,
    running: running ? { id: running.overrideId, lastDay: running.lastDay, expiresAt: running.expiresAt } : null,
  };
  if (!canGive || !portalCapWords(viewer.role)) return { ...base, changeBounds: null, give: null, giveLine: null };

  const firstGiveDay = ws.free_time_given_at ? firstGiveDayOf(ws.free_time_given_at) : null;
  const changeBounds = freeTime && firstGiveDay ? {
    earliest: earliestLastDay(),
    latest: portalLatestLastDay(viewer.role, firstGiveDay)!,
    capWords: portalCapWords(viewer.role)!,
    superAdmin: viewer.role === 'super_admin',
    firstGiveDay,
  } : null;
  // While it runs, Give answers from the running entry instead (drawing B: "Give it more time from that entry").
  if (running) {
    return {
      ...base, changeBounds, give: null,
      giveLine: { kind: 'running', tone: 'quiet', line: `${orgName} already has Premium free through ${formatShortDay(running.lastDay)}. Give it more time from that entry instead.` },
    };
  }
  const tab = owner ? await readCoachPortalTab(owner.id, viewer, true) : null;
  const give = tab?.give ?? null;
  // A later give from here only for THIS portal; any other answer is the coach's line, as their record shows it.
  const here = give && !give.block && give.mode === 'again' && give.againPortal?.orgId === orgId ? give : null;
  return { ...base, changeBounds, give: here, giveLine: here ? null : give?.block ?? null };
}

/** The tab for this person, read as `viewer` sees it. Null when the person is not found. Throws on a read error. */
export async function readCoachPortalTab(personId: string, viewer: Actor, canGive: boolean): Promise<CoachPortalTab | null> {
  const coach = await readCoach(personId);
  if (!coach) return null;
  const facts = await readPortalGiveFacts(coach, viewer);

  // The coach's own free teams; a shadow minted for a paid portal is the product's mirror, not a team they made.
  const own = facts.freeTeams.filter(t => !t.shadow);
  const { data: created } = own.length
    ? await supabaseAdmin.from('basic_coach_teams').select('id, created_at').in('id', own.map(t => t.id))
    : { data: [] };
  const createdOf = new Map((created ?? []).map(t => [t.id as string, t.created_at as string]));
  const [entries, counts] = await Promise.all([
    entriesByTeam(own.map(t => t.id)),
    Promise.all(own.map(t => Promise.all([
      countOf('basic_coach_team_players', t.id), countOf('basic_coach_team_events', t.id), countOf('basic_coach_team_fees', t.id),
    ]))),
  ]);
  const teams: CoachTabTeam[] = own.map((t, i) => {
    const [players, events, fees] = counts[i];
    const holds = [
      'Free Coaches Portal',
      counted(players, 'player', 'players'), counted(events, 'event', 'events'), counted(fees, 'fee', 'fees'),
      ...(entries.get(t.id) ?? []).map(e => `entered in ${e}`),
      ...(t.claimed ? ['has a Premium Coaches Portal'] : []),
      ...(createdOf.get(t.id) ? [`created ${consoleDate(createdOf.get(t.id))}`] : []),
    ].join(' · ');
    return { id: t.id, name: t.name, label: freeTeamLabel(t), holds, players, events, fees };
  });

  const portals = facts.portals.map(p => ({ orgId: p.orgId, name: p.name, state: portalState(p) }));
  const live = facts.portals.find(p => p.inForce) ?? null;
  const band = live
    ? { value: 'Premium', sub: live.runningGrant ? `free through ${formatShortDay(live.runningGrant.lastDay)}` : live.name, orgId: live.orgId }
    : teams.length
      ? { value: 'Free', sub: `${counted(teams.length, 'team', 'teams')}, ${facts.portals.length ? 'Premium not running' : 'no Premium portal'}`, orgId: null }
      : { value: '—', sub: 'no Coaches Portal team', orgId: null };

  let give: CoachPortalTab['give'] = null;
  if (canGive && portalCapWords(viewer.role)) {
    const again = freeTimePortalOf(facts);
    const firstGiveDay = again?.freeTimeGivenAt ? firstGiveDayOf(again.freeTimeGivenAt) : null;
    const offerIds = new Set(offerableTeams(facts).map(t => t.id));
    give = {
      block: portalGiveBlockOf(facts, viewer.role),
      mode: again ? 'again' : 'first',
      offer: teams.filter(t => offerIds.has(t.id)),
      againPortal: again ? { orgId: again.orgId, name: again.name } : null,
      bounds: {
        earliest: earliestLastDay(),
        latest: portalLatestLastDay(viewer.role, firstGiveDay ?? todayEastern())!,
        capWords: portalCapWords(viewer.role)!,
        superAdmin: viewer.role === 'super_admin',
        firstGiveDay,
      },
    };
  }
  return { coachName: coach.name, teams, portals, band, give };
}
