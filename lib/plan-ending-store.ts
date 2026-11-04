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

/** A row's columns from an insert (which carries the whole first log) or a patch (whose `log` the store appends — never here). */
export function toRow(p: EndingIntentPatch & { changeLog?: EndingLogEntry[] }): Record<string, unknown> {
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
    const updated = await updateIntent(intent.id, { status: 'canceled', log: [entry] }, ['pending']);
    if (updated) withdrawn += 1;
  }
  return withdrawn;
}

/** How many times a log append re-reads after another writer got in between (each retry is one more writer's line kept). */
const APPEND_TRIES = 5;

/**
 * Writes `patch` while the row's status is one of `onlyIf`; null when it is not (another writer moved it).
 *
 * ⚠⚠ THE CHANGE LOG IS AN APPEND (Stage 2 Part C, owner 2026-11-04). `patch.log` is added to the log the row holds AT THE
 * WRITE, never to the writer's own earlier read — before, every writer rewrote the whole log from its read, so two writers
 * close together (a Keep and Stripe's event, a changed pick and the click) dropped one line. PostgREST cannot write
 * `change_log = change_log || $1`, so the append is a compare-and-swap on `updated_at`: read the log and its stamp, write
 * the longer log only while the stamp is unchanged, re-read and try again when it moved. An append's new stamp is always LATER
 * than the one it read, so two APPENDERS can never both pass on the same read. (A plain write — no log — stamps the app's
 * clock, which could in theory land exactly on a stamp an appender read; it never touches the log, so the only miss is that
 * millisecond-exact, clock-skewed collision — accepted; /review 2026-11-04.)
 */
export async function updateIntent(id: string, patch: EndingIntentPatch, onlyIf: EndingStatus[]): Promise<EndingIntent | null> {
  const { log, ...fields } = patch;
  /** The one write: `row` while the status allows (and, for an append, while `updated_at` is still what was read). */
  const write = async (row: Record<string, unknown>, readStamp?: string): Promise<EndingIntent | null> => {
    let query = supabaseAdmin.from('billing_retention_intents').update(row).eq('id', id).in('status', onlyIf);
    if (readStamp) query = query.eq('updated_at', readStamp);
    const { data, error } = await query.select(INTENT_COLUMNS).maybeSingle<IntentRow>();
    if (error) throw new Error(`Couldn't update the waiting change: ${error.message}`);
    return data ? fromRow(data) : null;
  };
  if (!log || log.length === 0) return write({ ...toRow(fields), updated_at: new Date().toISOString() });
  for (let attempt = 0; attempt < APPEND_TRIES; attempt += 1) {
    const { data: current, error: readError } = await supabaseAdmin
      .from('billing_retention_intents')
      .select('status, change_log, updated_at')
      .eq('id', id)
      .maybeSingle<{ status: EndingStatus; change_log: EndingLogEntry[] | null; updated_at: string }>();
    if (readError) throw new Error(`Couldn't read the waiting change: ${readError.message}`);
    if (!current || !onlyIf.includes(current.status)) return null;
    const stamp = new Date(Math.max(Date.now(), new Date(current.updated_at).getTime() + 1)).toISOString();
    const written = await write(
      { ...toRow(fields), change_log: [...(Array.isArray(current.change_log) ? current.change_log : []), ...log], updated_at: stamp },
      current.updated_at,
    );
    if (written) return written;
  }
  throw new Error('The waiting change kept changing while it was being written. Try again in a moment.');
}

