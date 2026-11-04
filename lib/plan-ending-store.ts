/**
 * The waiting rows of lib/plan-ending.ts (Plans end at renewal): read, update, withdraw. No `server-only` import, so the
 * reactivation and team-transfer paths (and their tests) can withdraw a waiting change without the rest.
 *
 * ⚠ A waiting row is a CANCEL (Stage 1) or a MOVE TO THE FREE PLAN (Stage 2) — one at a time per account (migration 431).
 * Every reader gets either kind and must branch on `intentType`; nothing here filters a kind out.
 */
import { supabaseAdmin } from './supabase-admin';
import type { OrgPlan } from './types';
import type { EndingIntent, EndingIntentPatch, EndingLogEntry, EndingStatus } from './plan-ending';

export const INTENT_COLUMNS = 'id, org_id, intent_type, target_plan, keep_tournament_ids, status, effective_at, retention_until, reason, from_plan, created_by, created_by_email, applied_at, '
  + 'stripe_subscription_id, held_move_plan, notify_owner, ended_email_sent_at, ends_on_email_sent_at, reminder_email_sent_at, kept_email_sent_at, '
  + 'created_at, change_log';

export type IntentRow = {
  id: string; org_id: string; intent_type: 'cancellation' | 'downgrade'; target_plan: string | null; keep_tournament_ids: string[] | null;
  status: EndingStatus; effective_at: string; retention_until: string; reason: string | null;
  from_plan: string | null; created_by: string | null; created_by_email: string | null; applied_at: string | null;
  stripe_subscription_id: string | null; held_move_plan: string | null; notify_owner: boolean | null;
  ended_email_sent_at: string | null; ends_on_email_sent_at: string | null; reminder_email_sent_at: string | null;
  kept_email_sent_at: string | null; created_at: string; change_log: EndingLogEntry[] | null;
};

export function fromRow(r: IntentRow): EndingIntent {
  return {
    id: r.id, orgId: r.org_id, intentType: r.intent_type, targetPlan: (r.target_plan as OrgPlan | null) ?? null,
    keepTournamentIds: Array.isArray(r.keep_tournament_ids) ? r.keep_tournament_ids : [], status: r.status, effectiveAt: r.effective_at, retentionUntil: r.retention_until, reason: r.reason,
    fromPlan: r.from_plan, createdBy: r.created_by, createdByEmail: r.created_by_email, appliedAt: r.applied_at,
    stripeSubscriptionId: r.stripe_subscription_id, heldMovePlan: (r.held_move_plan as OrgPlan | null) ?? null,
    notifyOwner: r.notify_owner ?? true, endedEmailSentAt: r.ended_email_sent_at,
    endsOnEmailSentAt: r.ends_on_email_sent_at ?? null, reminderEmailSentAt: r.reminder_email_sent_at ?? null,
    keptEmailSentAt: r.kept_email_sent_at ?? null, createdAt: r.created_at, changeLog: Array.isArray(r.change_log) ? r.change_log : [],
  };
}

export function toRow(p: EndingIntentPatch): Record<string, unknown> {
  const map: Record<string, string> = {
    intentType: 'intent_type', targetPlan: 'target_plan', keepTournamentIds: 'keep_tournament_ids', status: 'status', effectiveAt: 'effective_at', retentionUntil: 'retention_until', reason: 'reason', fromPlan: 'from_plan',
    createdBy: 'created_by', createdByEmail: 'created_by_email', appliedAt: 'applied_at', stripeSubscriptionId: 'stripe_subscription_id',
    heldMovePlan: 'held_move_plan', notifyOwner: 'notify_owner', endedEmailSentAt: 'ended_email_sent_at', endsOnEmailSentAt: 'ends_on_email_sent_at',
    reminderEmailSentAt: 'reminder_email_sent_at', keptEmailSentAt: 'kept_email_sent_at', changeLog: 'change_log',
  };
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(p)) if (key in map && value !== undefined) row[map[key]] = value;
  return row;
}

export async function findPending(orgId: string): Promise<EndingIntent | null> {
  const { data, error } = await supabaseAdmin
    .from('billing_retention_intents')
    .select(INTENT_COLUMNS)
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .maybeSingle<IntentRow>();
  if (error) throw new Error(`Couldn't read the waiting change: ${error.message}`);
  return data ? fromRow(data) : null;
}

/** The waiting change (a cancel or a move to the free plan), if any — for the billing page, the refusals and the trial email. */
export async function readPendingEnding(orgId: string): Promise<EndingIntent | null> {
  return findPending(orgId);
}

/**
 * A waiting change withdrawn by something that ends the subscription some other way — a team moving into a club, the
 * retiring add-on replacing a coach's subscription, a reactivation. Those stay immediate (outside the ruling), but must
 * not leave a waiting row behind for the deletion to find and suspend (or move) the account with (the one rule, "withdraw").
 */
export async function withdrawPendingEnding(where: { orgId: string } | { subscriptionId: string }, note: string): Promise<number> {
  let query = supabaseAdmin.from('billing_retention_intents').select(INTENT_COLUMNS).eq('status', 'pending');
  query = 'orgId' in where ? query.eq('org_id', where.orgId) : query.eq('stripe_subscription_id', where.subscriptionId);
  const { data, error } = await query;
  if (error) throw new Error(`Couldn't read the waiting change: ${error.message}`);
  let withdrawn = 0;
  for (const row of (data ?? []) as unknown as IntentRow[]) {
    const intent = fromRow(row);
    const entry: EndingLogEntry = { at: new Date().toISOString(), action: 'withdrawn', door: 'system', by: null, note };
    const updated = await updateIntent(intent.id, { status: 'canceled', changeLog: [...intent.changeLog, entry] }, ['pending']);
    if (updated) withdrawn += 1;
  }
  return withdrawn;
}

export async function updateIntent(id: string, patch: EndingIntentPatch, onlyIf: EndingStatus[]): Promise<EndingIntent | null> {
  const { data, error } = await supabaseAdmin
    .from('billing_retention_intents')
    .update({ ...toRow(patch), updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', onlyIf)
    .select(INTENT_COLUMNS)
    .maybeSingle<IntentRow>();
  if (error) throw new Error(`Couldn't update the waiting change: ${error.message}`);
  return data ? fromRow(data) : null;
}

