import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { writePlatformAuditLog } from './platform-audit';
import { isDemoOrgId } from './demo-org-server';
import { hasLiveSubscription } from './plan-move';
import { grantsEnabled } from './entitlement-grants';
import { endClubOverride } from './club-record-changes';
import {
  decideGive,
  endInstantForLastDay,
  formatLongDay,
  freeTimeBlockOf,
  isGrantRunning,
  lastDayOfInstant,
  lastDayRefusal,
  planGrantBlockOf,
  type ClubFacts,
  type GiveBlock,
  type GiveContext,
  type PlanBlock,
  type Refusal,
} from './free-time';
import type { OrgPlan, SubscriptionStatus } from './types';

/**
 * Giving, changing and ending free time (Support console Stage 4): the SERVER's rules. The window's absent doors and
 * greyed days are a courtesy; these are the guard. The decisions are pure (`decideGive` and friends in lib/free-time.ts,
 * tested there); this file reads the facts they need and writes only on a yes.
 *
 * The club always comes from the record's address (the route's `[id]`), never the body (T16). The end always comes
 * from a last free day `YYYY-MM-DD`, turned into the end of that day in Eastern time (T5): an instant is refused.
 * Every write keeps its reason, in the audit entry's `new_value` (Stage 2's way), which the Story reads.
 */

export type Actor = { id: string; email: string; role: string };
export type { GiveBlock, PlanBlock, Refusal };

type ClubRow = {
  id: string;
  name: string;
  plan_id: string | null;
  account_kind: string | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
};

/** The club's running plan grant, if any (there is only ever one: a second is refused). */
export async function runningPlanGrant(orgId: string): Promise<{ id: string; plan: OrgPlan; lastDay: string; expiresAt: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('org_overrides')
    .select('id, target, starts_at, expires_at, revoked_at')
    .eq('org_id', orgId)
    .eq('type', 'plan_tier')
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const row = (data ?? []).find(r => isGrantRunning(r) && r.expires_at);
  if (!row) return null;
  return { id: row.id, plan: (row.target as { plan: OrgPlan }).plan, lastDay: lastDayOfInstant(row.expires_at!), expiresAt: row.expires_at! };
}

/** Read what the decisions need about a club (its OWN plan, its Stripe standing, its running plan grant). */
export async function readClubFacts(orgId: string): Promise<ClubFacts | null> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, plan_id, account_kind, subscription_status, stripe_subscription_id')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const club = data as ClubRow;
  const planId = (club.plan_id ?? 'tournament') as OrgPlan;
  const running = await runningPlanGrant(club.id);
  return {
    id: club.id,
    name: club.name,
    planId,
    accountKind: club.account_kind,
    payingThroughStripe: hasLiveSubscription({
      id: club.id,
      planId,
      stripeSubscriptionId: club.stripe_subscription_id,
      subscriptionStatus: (club.subscription_status ?? 'active') as SubscriptionStatus,
    }),
    runningPlanGrant: running ? { id: running.id, plan: running.plan, lastDay: running.lastDay } : null,
  };
}

/** Is this staff member a member of the club, in any role or state? By membership, on the server (T1). */
async function staffBelongsTo(orgId: string, userId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('user_id', userId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function readGiveContext(orgId: string, staffUserId: string): Promise<GiveContext> {
  const [staffIsMember, isDemo] = await Promise.all([staffBelongsTo(orgId, staffUserId), isDemoOrgId(orgId)]);
  return { switchOn: grantsEnabled(), staffIsMember, isDemo };
}

/** For the record: why the door is absent (one line), and why a whole plan cannot be given (in the window). */
export async function freeTimeDoorFacts(orgId: string, staffUserId: string): Promise<{ block: GiveBlock | null; planBlock: PlanBlock | null; ownPlan: OrgPlan } | null> {
  const club = await readClubFacts(orgId);
  if (!club) return null;
  const ctx = await readGiveContext(orgId, staffUserId);
  return { block: freeTimeBlockOf(club, ctx), planBlock: planGrantBlockOf(club), ownPlan: club.planId };
}

export type GiveInput = { orgId: string; kind: unknown; plan?: unknown; addons?: unknown; lastDay: unknown; reason: unknown; actor: Actor };

/** Give free time. Writes only when `decideGive` says yes. */
export async function giveFreeTime(input: GiveInput): Promise<Refusal | { ok: true; override: { id: string } }> {
  const club = await readClubFacts(input.orgId);
  if (!club) return { ok: false, status: 404, error: 'Club not found.' };
  const ctx = await readGiveContext(club.id, input.actor.id);
  const decision = decideGive(
    { kind: input.kind, plan: input.plan, addons: input.addons, lastDay: input.lastDay, reason: input.reason, role: input.actor.role },
    club,
    ctx,
  );
  if (!decision.ok) return decision;

  const { data: created, error } = await supabaseAdmin
    .from('org_overrides')
    .insert({
      org_id: club.id,
      ...decision.row,
      starts_at: new Date().toISOString(),
      reason: decision.reason,
      created_by: input.actor.email,
    })
    .select('id')
    .single();
  if (error || !created) return { ok: false, status: 500, error: 'Nothing was given. The server could not save it. Your answers are kept; try again.' };

  await writePlatformAuditLog(input.actor.email, club.id, 'create_override', 'type', null, {
    ...decision.row, last_day: decision.lastDay, reason: decision.reason, override_id: created.id,
  });
  return { ok: true, override: { id: created.id } };
}

export type ChangeInput = {
  orgId: string;
  overrideId: string;
  /** The end the window was opened with (compare-and-set, T11). */
  expectedExpiresAt: unknown;
  lastDay: unknown;
  reason: unknown;
  actor: Actor;
  extra?: Record<string, unknown>;
};

/**
 * Change a running grant's end date (owner ruling Q6). Compare-and-set on the end the window was opened with: if the
 * grant changed since, refused with who changed it and to what (T11). Same cap and reason rules as giving.
 */
export async function changeFreeTimeEnd(input: ChangeInput): Promise<Refusal | { ok: true }> {
  const refuse = (status: number, error: string): Refusal => ({ ok: false, status, error });
  const club = await readClubFacts(input.orgId);
  if (!club) return refuse(404, 'Club not found.');
  const block = freeTimeBlockOf(club, await readGiveContext(club.id, input.actor.id));
  if (block) return refuse(block.kind === 'switch' ? 409 : 403, `${block.lead}${block.rest}`);

  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) return refuse(400, "Say why you're changing it.");
  const dayRefusal = lastDayRefusal(input.lastDay, input.actor.role);
  if (dayRefusal) return refuse(400, dayRefusal);
  const lastDay = input.lastDay as string;
  const expiresAt = endInstantForLastDay(lastDay)!;
  if (typeof input.expectedExpiresAt !== 'string') return refuse(400, 'Open the free time again and change it from there.');

  const { data: row, error: readError } = await supabaseAdmin
    .from('org_overrides')
    .select('id, type, starts_at, expires_at, revoked_at, created_by')
    .eq('id', input.overrideId)
    .eq('org_id', club.id)
    .maybeSingle();
  if (readError) return refuse(500, 'Nothing was changed. The server could not read it.');
  if (!row || row.type === 'comp_period') return refuse(404, 'That free time was not found.');
  if (!isGrantRunning(row) || !row.expires_at) return refuse(409, 'That free time has already ended. Nothing was changed.');
  if (new Date(row.expires_at).getTime() !== new Date(input.expectedExpiresAt).getTime()) {
    return refuse(409, await staleSentence(club.id, row.id, row.created_by, row.expires_at));
  }
  if (new Date(row.expires_at).getTime() === new Date(expiresAt).getTime()) return refuse(400, 'That is already its last free day.');

  // Compare-and-set: only the row whose end is still the one the window was opened with.
  const { data: written, error } = await supabaseAdmin
    .from('org_overrides')
    .update({ expires_at: expiresAt })
    .eq('id', row.id)
    .eq('org_id', club.id)
    .is('revoked_at', null)
    .eq('expires_at', row.expires_at)
    .select('id');
  if (error) return refuse(500, 'Nothing was changed. The server could not save it.');
  if (!written || written.length === 0) {
    const { data: now } = await supabaseAdmin.from('org_overrides').select('expires_at, created_by').eq('id', row.id).maybeSingle();
    return refuse(409, await staleSentence(club.id, row.id, now?.created_by ?? row.created_by, now?.expires_at ?? row.expires_at));
  }

  await writePlatformAuditLog(input.actor.email, club.id, 'change_override_end', 'expires_at', row.expires_at, {
    override_id: row.id, expires_at: expiresAt, last_day: lastDay, was_last_day: lastDayOfInstant(row.expires_at), reason, ...input.extra,
  });
  return { ok: true };
}

/** "{who} changed this free time while you had it open. It now runs through {day}. Look again before you change it." */
async function staleSentence(orgId: string, overrideId: string, createdBy: string, expiresAt: string | null): Promise<string> {
  const { data } = await supabaseAdmin
    .from('platform_audit_log')
    .select('actor_email, new_value')
    .eq('org_id', orgId)
    .eq('action', 'change_override_end')
    .order('created_at', { ascending: false })
    .limit(50);
  const last = (data ?? []).find(e => (e.new_value as { override_id?: string } | null)?.override_id === overrideId);
  const who = last?.actor_email ?? createdBy;
  const runs = expiresAt ? ` It now runs through ${formatLongDay(lastDayOfInstant(expiresAt))}.` : '';
  return `${who} changed this free time while you had it open.${runs} Look again before you change it.`;
}

/** End a running grant now, with its reason (the existing end path). A comp period is not free time and is refused. */
export async function endFreeTimeNow(input: { orgId: string; overrideId: string; reason: unknown; actor: Actor; extra?: Record<string, unknown> }): Promise<Refusal | { ok: true }> {
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) return { ok: false, status: 400, error: "Say why you're ending it early." };
  // A comp period is a billing tag (Founding Season's cohort mark): it gives nothing to end, and Founding's access moves
  // only at its turn-off decision (owner ruling Q4).
  const { data: row } = await supabaseAdmin.from('org_overrides').select('type').eq('id', input.overrideId).eq('org_id', input.orgId).maybeSingle();
  if (!row) return { ok: false, status: 404, error: 'That free time was not found.' };
  if (row.type === 'comp_period') return { ok: false, status: 409, error: "A comp period gives nothing to end. Founding Season's ends with its own turn-off." };
  const result = await endClubOverride({ orgId: input.orgId, overrideId: input.overrideId, reason, actorEmail: input.actor.email, extra: input.extra });
  return result.ok ? { ok: true } : { ok: false, status: result.status, error: result.error };
}
