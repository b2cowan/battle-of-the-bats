/**
 * The account-email log's writer (Support console Stage 5, owner Q6/Q8 2026-10-26; migration 389
 * `platform_account_emails`). Server only; the shared sender (lib/email.ts) loads it with a dynamic import so nothing
 * that renders an email template pulls the database client into a browser bundle.
 *
 * ⚠ BEST EFFORT, NEVER A GATE (threat T24). A reset link matters more than its log line: a row that fails to write
 * returns null and the email still goes. The failure is counted in the server log only, as one fixed line — never sent
 * to error capture, whose alerts are emails themselves (a broken log would mail us about every email it failed to log).
 *
 * ⚠ The row keeps the KIND, never the subject, body or a link (T13). Nothing here accepts them.
 *
 * Kept 90 days by pruning on write (no scheduled job), at most once every ten minutes per server.
 */
import { supabaseAdmin } from './supabase-admin';
import type { LoggedEmailKind } from './email-kinds';
import { isUuid } from './utils';

export const SENT_LOG_KEEP_DAYS = 90;
const PRUNE_EVERY_MS = 10 * 60_000;
let lastPruneAt = 0;

/** The tag names the row's number and its database travel on (lib/email.ts sets them; the callback reads them). */
export const ROW_TAG = 'flhq_row';
export const DB_TAG = 'flhq_db';

/** The database this site writes to: the Supabase project ref (dev and prod are separate projects). Letters only. */
export function logDatabaseRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? 'local';
  return ref.toLowerCase();
}

export type LogContext = {
  kind: LoggedEmailKind;
  to: string;
  orgId?: string | null;
  askedBy?: string | null;
  feedbackId?: string | null;
};

const uuidOrNull = (v: string | null | undefined) => (isUuid(v) ? v : null);

/** Writes the row before the email leaves; its id, or null when it could not be written. */
export async function openSentEmailRow(ctx: LogContext): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_account_emails')
      .insert({
        kind: ctx.kind,
        recipient_email: ctx.to.trim().toLowerCase(),
        org_id: uuidOrNull(ctx.orgId),
        asked_by_user_id: uuidOrNull(ctx.askedBy),
        feedback_id: uuidOrNull(ctx.feedbackId),
      })
      .select('id')
      .single();
    if (error || !data) {
      console.warn('[email-log] a sent-email row could not be written');
      return null;
    }
    void pruneOld();
    return data.id as string;
  } catch {
    console.warn('[email-log] a sent-email row could not be written');
    return null;
  }
}

/** Our own outcome for a row: the mail service's number, and failed / not_sent / unconfirmed when it did not take it. */
export async function settleSentEmailRow(
  id: string,
  outcome: { resendId?: string | null; state?: 'failed' | 'not_sent' | 'unconfirmed' },
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc('platform_account_email_settle', {
      p_email_id: id,
      p_state: outcome.state ?? 'sent',
      p_resend_id: outcome.resendId && /^[A-Za-z0-9-]{8,64}$/.test(outcome.resendId) ? outcome.resendId : null,
    });
    if (error) console.warn('[email-log] a sent-email row could not be settled');
  } catch {
    console.warn('[email-log] a sent-email row could not be settled');
  }
}

async function pruneOld(): Promise<void> {
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_EVERY_MS) return;
  lastPruneAt = now;
  try {
    const cutoff = new Date(now - SENT_LOG_KEEP_DAYS * 86_400_000).toISOString(); // utc-intentional: retention instant
    await supabaseAdmin.from('platform_account_emails').delete().lt('created_at', cutoff);
  } catch {
    // The prune runs again on a later write.
  }
}
