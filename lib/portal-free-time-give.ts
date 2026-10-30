import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { writePlatformAuditLog } from './platform-audit';
import { isPlatformAdminEmail } from './platform-auth';
import { isDemoOrganizerEmail } from './demo-org';
import { grantsEnabled } from './entitlement-grants';
import { endInstantForLastDay, isGrantRunning, lastDayOfInstant, todayEastern } from './free-time';
import { endFreeTimeNow, staleSentence, type Actor } from './free-time-writes';
import { isFoundingSeasonCompExpiry } from './plan-config';
import { keysOf, portalsInForce } from './portal-in-force-server';
import { normalizeSportId } from './sports';
import { staffBelongsToClub } from './staff-own-club';
import { provisionStandaloneTeamWorkspace, TeamWorkspaceProvisioningError } from './team-workspace-provisioning';
import {
  PORTAL_FREE_TIME_GRANT_TYPE,
  PORTAL_GIVES_WINDOW_DAYS,
  copyShortfallLine,
  decidePortalGive,
  firstNameOf,
  endedLastDay,
  firstGiveDayOf,
  portalCapWords,
  portalChangeRefusal,
  type CoachPortalFacts,
  type CopyOutcome,
  type FreeTeamFacts,
  type PortalGiveFacts,
  type Refusal,
} from './portal-free-time';

/**
 * Giving, changing and ending free time on a Coaches Portal (Support console Stage 4b, Part 3): the SERVER's rules.
 * The tab's absent doors are a courtesy; these are the guard. The decisions are pure (`lib/portal-free-time.ts`); this
 * file reads the facts they need and writes only on a yes.
 *
 * The coach is the person record's address (an auth user id), never the body; the team is one of the coach's own free
 * teams, read from their memberships here (T23). The end is a last free day `YYYY-MM-DD`, turned into the first moment
 * of the next day in Eastern time (T5).
 *
 * THE GIVE'S ORDER (T31, owner gate ruling (b) 2026-10-27), so a stop at any point leaves nothing in force past the
 * last free day: the organization is born, then the billing-status grant (bounded), then the workspace and the
 * entitlement, born ended and bounded (organization and workspace `canceled`, entitlement `active` until the end), then
 * the claim of the free team, then the copy with family reminders off. A throw undoes it all (the organization's
 * delete cascades; the claim falls back to null). It is the same function a paid upgrade runs, so Premium is real.
 *
 * ⚠ The end runs NOTHING (T15): no cancel, retention, archive, Stripe or email is reachable from here.
 */

export type { Actor, Refusal };

const NOT_FOUND: Refusal = { ok: false, status: 404, error: 'That person was not found.' };

type WorkspaceRow = {
  id: string;
  workspace_org_id: string;
  rep_team_id: string;
  billing_mode: string;
  workspace_state: string;
  free_time_given_at: string | null;
};

type GrantRow = { id: string; org_id: string; type: string; starts_at: string | null; expires_at: string | null; revoked_at: string | null };

/** The coach's free teams (any active membership: free-team membership is role-agnostic) with what the give needs. */
async function readFreeTeams(coachUserId: string): Promise<FreeTeamFacts[]> {
  const { data: memberships, error } = await supabaseAdmin
    .from('basic_coach_team_users')
    .select('basic_coach_team_id')
    .eq('user_id', coachUserId)
    .eq('status', 'active');
  if (error) throw error;
  const ids = [...new Set((memberships ?? []).map(m => m.basic_coach_team_id as string))];
  if (ids.length === 0) return [];
  const { data: teams, error: teamsError } = await supabaseAdmin
    .from('basic_coach_teams')
    .select('id, name, sport, age_group, source, team_workspace_id, created_at')
    .in('id', ids)
    .order('created_at', { ascending: true });
  if (teamsError) throw teamsError;
  return (teams ?? []).map(t => ({
    id: t.id as string,
    name: t.name as string,
    sport: (t.sport as string | null) ?? null,
    ageGroup: (t.age_group as string | null) ?? null,
    claimed: t.team_workspace_id != null,
    shadow: t.source === 'premium_upgrade',
  }));
}

/** Every portal the coach owns, live or not, read as the give needs it (the one question decides "in force"). */
async function readCoachPortals(coachUserId: string): Promise<CoachPortalFacts[]> {
  const { data, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, workspace_org_id, rep_team_id, billing_mode, workspace_state, free_time_given_at')
    .eq('primary_owner_user_id', coachUserId);
  if (error) throw error;
  const rows = (data ?? []) as WorkspaceRow[];
  if (rows.length === 0) return [];
  const orgIds = rows.map(r => r.workspace_org_id);
  // Names and grants read on their own: an embed of `organizations` is ambiguous here (two FKs, PGRST201).
  const [inForce, { data: orgs, error: orgError }, { data: grants, error: grantError }, { data: clocks, error: clockError }] = await Promise.all([
    portalsInForce(keysOf(rows)),
    supabaseAdmin.from('organizations').select('id, name').in('id', orgIds),
    supabaseAdmin
      .from('org_overrides')
      .select('id, org_id, type, starts_at, expires_at, revoked_at')
      .in('org_id', orgIds)
      .in('type', [PORTAL_FREE_TIME_GRANT_TYPE, 'comp_period'])
      .order('created_at', { ascending: false }),
    // A READ of the clock a cancellation started, never a way to start or move one (T15): a restored one is no longer applied.
    supabaseAdmin
      .from('billing_retention_intents')
      .select('org_id, applied_at, retention_until')
      .in('org_id', orgIds)
      .eq('intent_type', 'cancellation')
      .eq('status', 'applied')
      .order('applied_at', { ascending: false }),
  ]);
  if (orgError) throw orgError;
  if (grantError) throw grantError;
  if (clockError) throw clockError;
  const nameOf = new Map((orgs ?? []).map(o => [o.id as string, o.name as string]));
  return rows.map(r => {
    const mine = ((grants ?? []) as GrantRow[]).filter(g => g.org_id === r.workspace_org_id);
    const status = mine.filter(g => g.type === PORTAL_FREE_TIME_GRANT_TYPE);
    const running = status.find(g => g.expires_at && isGrantRunning(g));
    const clock = (clocks ?? []).find(c => c.org_id === r.workspace_org_id && c.retention_until);
    const founding = mine.find(g => g.type === 'comp_period' && g.expires_at && isFoundingSeasonCompExpiry(g.expires_at) && isGrantRunning(g));
    return {
      workspaceId: r.id,
      orgId: r.workspace_org_id,
      name: nameOf.get(r.workspace_org_id) ?? 'Coaches Portal',
      billingMode: r.billing_mode,
      movedIntoClub: r.workspace_state === 'org_owned',
      inForce: inForce.has(r.id),
      freeTimeGivenAt: r.free_time_given_at,
      foundingLastDay: founding?.expires_at ? lastDayOfInstant(founding.expires_at) : null,
      runningGrant: running ? { overrideId: running.id, lastDay: lastDayOfInstant(running.expires_at!), expiresAt: running.expires_at! } : null,
      endedLastDay: status[0] ? endedLastDay(status[0]) : null,
      retention: clock
        ? { cancelledDay: clock.applied_at ? todayEastern(new Date(clock.applied_at as string)) : null, deleteDay: todayEastern(new Date(clock.retention_until as string)) }
        : null,
    };
  });
}

/**
 * This giver's portal gives in the last seven days (T2). Counted from the grants themselves, which a give writes before
 * it succeeds and a refused one deletes: the audit row is written after the give commits and a failed write only logs,
 * so counting it would let a give with a failed audit write go uncounted (review, 4b).
 */
async function givesInWindow(actorEmail: string): Promise<number> {
  const since = new Date(Date.now() - PORTAL_GIVES_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from('org_overrides')
    .select('id', { count: 'exact', head: true })
    .eq('type', PORTAL_FREE_TIME_GRANT_TYPE)
    .eq('created_by', actorEmail)
    .gte('created_at', since);
  if (error) throw error;
  return count ?? 0;
}

export type CoachIdentity = { id: string; email: string | null; name: string };

/** The person on the record, from the auth store. */
export async function readCoach(coachUserId: string): Promise<CoachIdentity | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(coachUserId);
  if (error || !data?.user) return null;
  const meta = (data.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  return { id: data.user.id, email: data.user.email ?? null, name: meta.full_name ?? meta.name ?? data.user.email ?? 'This coach' };
}

/** Everything the give decides from, for this giver and this coach. Throws on a read error (fails closed). */
export async function readPortalGiveFacts(coach: CoachIdentity, actor: Actor): Promise<PortalGiveFacts> {
  const [freeTeams, portals, coachIsStaff, weekCount] = await Promise.all([
    readFreeTeams(coach.id),
    readCoachPortals(coach.id),
    coach.email ? isPlatformAdminEmail(coach.email) : Promise.resolve(false),
    givesInWindow(actor.email),
  ]);
  const teamIds = freeTeams.map(t => t.id);
  const [{ data: giverRows, error }, giverInPortal] = await Promise.all([
    teamIds.length
      ? supabaseAdmin.from('basic_coach_team_users').select('id').eq('user_id', actor.id).eq('status', 'active').in('basic_coach_team_id', teamIds).limit(1)
      : Promise.resolve({ data: [], error: null }),
    Promise.all(portals.map(p => staffBelongsToClub(p.orgId, actor))).then(r => r.some(Boolean)),
  ]);
  if (error) throw error;
  return {
    switchOn: grantsEnabled(),
    coachIsGiver: coach.id === actor.id,
    coachIsStaff,
    coachIsDemo: isDemoOrganizerEmail(coach.email),
    giverOnTeam: (giverRows ?? []).length > 0 || giverInPortal,
    freeTeams,
    portals,
    givesInWindow: weekCount,
  };
}

export type PortalGiveInput = { coachUserId: string; teamId: unknown; lastDay: unknown; reason: unknown; actor: Actor };
export type PortalGiveResult = Refusal | { ok: true; orgId: string; mode: 'first' | 'again'; copyShort?: string | null };

/** Give a free coach the Premium Coaches Portal for a set time, or give its one portal more time (Super admin). */
export async function givePortalFreeTime(input: PortalGiveInput): Promise<PortalGiveResult> {
  const coach = await readCoach(input.coachUserId);
  if (!coach) return NOT_FOUND;
  const facts = await readPortalGiveFacts(coach, input.actor);
  const decision = decidePortalGive({ teamId: input.teamId, lastDay: input.lastDay, reason: input.reason, role: input.actor.role }, facts);
  if (!decision.ok) return decision;

  const { lastDay, expiresAt, reason } = decision;
  const grantRow = (orgId: string) => ({
    org_id: orgId,
    type: PORTAL_FREE_TIME_GRANT_TYPE,
    value: 'active',
    target: null,
    starts_at: new Date().toISOString(),
    expires_at: expiresAt,
    reason,
    created_by: input.actor.email,
  });

  if (decision.mode === 'again') return giveAgain(decision.portal, grantRow(decision.portal.orgId), { lastDay, reason, actor: input.actor, coach });

  const { team } = decision;
  let overrideId: string | null = null;
  let orgId: string;
  try {
    const result = await provisionStandaloneTeamWorkspace({
      ownerUserId: coach.id,
      ownerEmail: coach.email,
      teamName: team.name,
      sport: normalizeSportId(team.sport), // free teams store the label ("Baseball")
      division: team.ageGroup,
      source: 'platform_admin',
      basicCoachTeamId: team.id,
      billingMode: 'platform_override',
      subscriptionStatus: 'canceled',
      entitlementSource: 'platform_override',
      entitlementStatus: 'active',
      eventSource: 'platform_admin',
      actorUserId: input.actor.id,
      actorEmail: input.actor.email,
      freeTime: {
        givenAt: new Date().toISOString(),
        entitlementEndsAt: expiresAt,
        onOrgCreated: async (newOrgId: string) => {
          const { data, error } = await supabaseAdmin.from('org_overrides').insert(grantRow(newOrgId)).select('id').single();
          if (error || !data) throw error ?? new Error('The free-time grant was not saved.');
          overrideId = data.id as string;
        },
      },
    });
    orgId = result.org.id;
  } catch (err) {
    // Two gives racing for one coach or one team: the database's one-portal rule (mig 406) or the lost claim refuses
    // the second, and nothing of it is left (the organization's delete cascades).
    if ((err as { code?: string } | null)?.code === '23505' || (err instanceof TeamWorkspaceProvisioningError && err.code === 'free_team_claimed')) {
      return { ok: false, status: 409, error: 'Someone gave this coach free time while you had it open. Look again before you give.' };
    }
    console.error('[portal-free-time-give] the give stopped and was undone:', err);
    return { ok: false, status: 500, error: 'Nothing was given. The server could not make the portal. Your answers are kept; try again.' };
  }

  await writePlatformAuditLog(input.actor.email, orgId, 'give_portal_free_time', 'type', null, {
    mode: 'first', override_id: overrideId, last_day: lastDay, team: team.name, basic_coach_team_id: team.id, coach_user_id: coach.id,
  }, { reason });
  // What the copy brought across (drawing F2): free time runs either way; a shortfall is said in the window's answer.
  const { data: ws } = await supabaseAdmin.from('team_workspaces').select('migration_summary').eq('workspace_org_id', orgId).maybeSingle();
  const copyShort = copyShortfallLine((ws?.migration_summary ?? null) as CopyOutcome | null, team.name, firstNameOf(coach.name));
  return { ok: true, orgId, mode: 'first', copyShort };
}

/** A later give (Super admin, Q5): the same portal, a new grant, the same entitlement row given the new end (T21). */
async function giveAgain(
  portal: CoachPortalFacts,
  row: Record<string, unknown>,
  ctx: { lastDay: string; reason: string; actor: Actor; coach: CoachIdentity },
): Promise<PortalGiveResult> {
  const { data: grant, error } = await supabaseAdmin.from('org_overrides').insert(row).select('id').single();
  if (error || !grant) return { ok: false, status: 500, error: 'Nothing was given. The server could not save it. Your answers are kept; try again.' };

  // Compare-and-set: only an entitlement that has ended. Two Super admins at once: the second finds it running.
  const now = new Date().toISOString();
  const { data: opened, error: entError } = await supabaseAdmin
    .from('team_entitlements')
    .update({ ends_at: row.expires_at, status: 'active', updated_at: now })
    .eq('team_workspace_id', portal.workspaceId)
    .eq('source', 'platform_override')
    .lte('ends_at', now)
    .select('id');
  if (entError || !opened || opened.length !== 1) {
    // No entitlement row AT ALL is a portal an earlier give left half-made (the entitlement is the give's last write):
    // this give finishes it instead of failing for good. A row that merely has not ended is the lost race below.
    if (!entError && (opened ?? []).length === 0) {
      const finished = await finishHalfMadePortal(portal, String(row.expires_at));
      if (finished) {
        await writePlatformAuditLog(ctx.actor.email, portal.orgId, 'give_portal_free_time', 'type', null, {
          mode: 'again', override_id: grant.id, last_day: ctx.lastDay, coach_user_id: ctx.coach.id, finished_half_made: true,
        }, { reason: ctx.reason });
        return { ok: true, orgId: portal.orgId, mode: 'again' };
      }
    }
    const { error: undoError } = await supabaseAdmin.from('org_overrides').delete().eq('id', grant.id);
    if (undoError) console.error('[portal-free-time-give] a refused give left its grant behind; remove it by hand:', grant.id, undoError.message);
    return entError
      ? { ok: false, status: 500, error: 'Nothing was given. The server could not save it. Your answers are kept; try again.' }
      : { ok: false, status: 409, error: 'Someone gave this coach free time while you had it open. Look again before you give.' };
  }

  await writePlatformAuditLog(ctx.actor.email, portal.orgId, 'give_portal_free_time', 'type', null, {
    mode: 'again', override_id: grant.id, last_day: ctx.lastDay, coach_user_id: ctx.coach.id,
  }, { reason: ctx.reason });
  return { ok: true, orgId: portal.orgId, mode: 'again' };
}

/**
 * Insert the entitlement a half-made portal never got, when it has none at all. True when this call made it. Born the way
 * the first give makes it (`platform_override`, active, bounded by the new end), so nothing is in force past the last day.
 */
async function finishHalfMadePortal(portal: CoachPortalFacts, endsAt: string): Promise<boolean> {
  const { data: ws, error } = await supabaseAdmin
    .from('team_workspaces').select('rep_team_id').eq('id', portal.workspaceId).maybeSingle<{ rep_team_id: string }>();
  if (error || !ws) return false;
  const { count, error: countError } = await supabaseAdmin
    .from('team_entitlements').select('id', { count: 'exact', head: true }).eq('team_workspace_id', portal.workspaceId);
  if (countError || (count ?? 0) > 0) return false;
  const { error: insertError } = await supabaseAdmin.from('team_entitlements').insert({
    team_workspace_id: portal.workspaceId,
    org_id: portal.orgId,
    rep_team_id: ws.rep_team_id,
    source: 'platform_override',
    status: 'active',
    ends_at: endsAt,
  });
  return !insertError;
}

/** The portal on this organization if staff gave it free time and nobody pays for it yet, else null. */
export async function readFreeTimePortal(orgId: string): Promise<{ workspaceId: string; firstGiveDay: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, billing_mode, free_time_given_at')
    .eq('workspace_org_id', orgId)
    .maybeSingle<{ id: string; billing_mode: string; free_time_given_at: string | null }>();
  if (error) throw error;
  if (!data?.free_time_given_at || data.billing_mode !== 'platform_override') return null;
  return { workspaceId: data.id, firstGiveDay: firstGiveDayOf(data.free_time_given_at) };
}

/** The checks every later write on a portal's free time shares: the switch, and the giver's own portal (T1). */
async function portalWriteBlock(orgId: string, actor: Actor): Promise<Refusal | null> {
  if (!grantsEnabled()) return { ok: false, status: 409, error: 'Free time is switched off on this server, so anything given here would do nothing. An engineer can switch it on.' };
  if (await staffBelongsToClub(orgId, actor)) return { ok: false, status: 403, error: "You belong to this portal, so you can't change its free time. Another staff member can." };
  return null;
}

export type PortalChangeInput = {
  orgId: string; overrideId: string; expectedExpiresAt: unknown; lastDay: unknown; reason: unknown; actor: Actor;
  /** Kept on the audit entry (a Put it back's `put_back_of`). */
  extra?: Record<string, unknown>;
};

/**
 * Change the running end (Q5): compare-and-set on the end the window opened with (T11), the limits measured from the
 * first give. The grant first (it is the race check), then the entitlement; if the entitlement cannot follow, the
 * grant is put back as it was.
 */
export async function changePortalFreeTimeEnd(input: PortalChangeInput): Promise<Refusal | { ok: true }> {
  const refuse = (status: number, error: string): Refusal => ({ ok: false, status, error });
  const portal = await readFreeTimePortal(input.orgId);
  if (!portal) return refuse(404, 'That free time was not found.');
  const block = await portalWriteBlock(input.orgId, input.actor);
  if (block) return block;
  const refusal = portalChangeRefusal({ lastDay: input.lastDay, reason: input.reason, role: input.actor.role }, portal.firstGiveDay);
  if (refusal) return refuse(refusal.startsWith('Your role') ? 403 : 400, refusal);
  const reason = (input.reason as string).trim();
  const lastDay = input.lastDay as string;
  const expiresAt = endInstantForLastDay(lastDay)!;
  if (typeof input.expectedExpiresAt !== 'string') return refuse(400, 'Open the free time again and change it from there.');

  const { data: row, error: readError } = await supabaseAdmin
    .from('org_overrides')
    .select('id, type, starts_at, expires_at, revoked_at, created_by')
    .eq('id', input.overrideId)
    .eq('org_id', input.orgId)
    .maybeSingle();
  if (readError) return refuse(500, 'Nothing was changed. The server could not read it.');
  if (!row || row.type !== PORTAL_FREE_TIME_GRANT_TYPE) return refuse(404, 'That free time was not found.');
  if (!isGrantRunning(row) || !row.expires_at) return refuse(409, 'That free time has already ended. Nothing was changed.');
  if (new Date(row.expires_at).getTime() !== new Date(input.expectedExpiresAt).getTime()) {
    return refuse(409, await staleSentence(input.orgId, row.id, row.created_by, row.expires_at));
  }
  if (new Date(row.expires_at).getTime() === new Date(expiresAt).getTime()) return refuse(400, 'That is already its last free day.');

  const { data: written, error } = await supabaseAdmin
    .from('org_overrides')
    .update({ expires_at: expiresAt })
    .eq('id', row.id)
    .eq('org_id', input.orgId)
    .is('revoked_at', null)
    .eq('expires_at', row.expires_at)
    .gt('expires_at', new Date().toISOString()) // never revive a grant that ran out since it was read
    .select('id');
  if (error) return refuse(500, 'Nothing was changed. The server could not save it.');
  if (!written || written.length === 0) {
    const { data: now } = await supabaseAdmin.from('org_overrides').select('expires_at, created_by').eq('id', row.id).maybeSingle();
    return refuse(409, await staleSentence(input.orgId, row.id, now?.created_by ?? row.created_by, now?.expires_at ?? row.expires_at));
  }

  const { data: ent, error: entError } = await supabaseAdmin
    .from('team_entitlements')
    .update({ ends_at: expiresAt, updated_at: new Date().toISOString() })
    .eq('team_workspace_id', portal.workspaceId)
    .eq('source', 'platform_override')
    .eq('ends_at', row.expires_at)
    .select('id');
  if (entError || !ent || ent.length !== 1) {
    await supabaseAdmin.from('org_overrides').update({ expires_at: row.expires_at }).eq('id', row.id).eq('expires_at', expiresAt);
    return refuse(500, 'Nothing was changed. The server could not save it.');
  }

  await writePlatformAuditLog(input.actor.email, input.orgId, 'change_override_end', 'expires_at', row.expires_at, {
    override_id: row.id, expires_at: expiresAt, last_day: lastDay, was_last_day: lastDayOfInstant(row.expires_at), portal: true, ...input.extra,
  }, { reason });
  return { ok: true };
}

/**
 * End it now (D-1), with a reason. The entitlement first, so the per-team gate closes even if the grant's end then
 * fails; then Stage 4's own end path. Nothing else: no cancel, no retention, no email (T15).
 */
export async function endPortalFreeTimeNow(input: {
  orgId: string; overrideId: string; reason: unknown; actor: Actor; extra?: Record<string, unknown>;
}): Promise<Refusal | { ok: true }> {
  const portal = await readFreeTimePortal(input.orgId);
  if (!portal) return { ok: false, status: 404, error: 'That free time was not found.' };
  const block = await portalWriteBlock(input.orgId, input.actor);
  if (block) return block;
  if (portalCapWords(input.actor.role) == null) return { ok: false, status: 403, error: "Your role can't end free time." };
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) return { ok: false, status: 400, error: "Say why you're ending it early." };

  const { data: row } = await supabaseAdmin
    .from('org_overrides')
    .select('type, starts_at, expires_at, revoked_at')
    .eq('id', input.overrideId)
    .eq('org_id', input.orgId)
    .maybeSingle();
  if (!row || row.type !== PORTAL_FREE_TIME_GRANT_TYPE) return { ok: false, status: 404, error: 'That free time was not found.' };
  if (!isGrantRunning(row)) return { ok: false, status: 409, error: 'That free time has already ended. Nothing was changed.' };

  const now = new Date().toISOString();
  const { error: entError } = await supabaseAdmin
    .from('team_entitlements')
    .update({ ends_at: now, updated_at: now })
    .eq('team_workspace_id', portal.workspaceId)
    .eq('source', 'platform_override')
    .gt('ends_at', now);
  if (entError) return { ok: false, status: 500, error: 'Nothing was ended. The server could not save it.' };

  return endFreeTimeNow({ orgId: input.orgId, overrideId: input.overrideId, reason, actor: input.actor, extra: { portal: true, ...input.extra } });
}
