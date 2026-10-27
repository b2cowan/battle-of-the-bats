import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { ADMIN_EMAIL, sendEmail } from '@/lib/email';
import { openSentEmailRow } from '@/lib/email-log';
import { isUuid } from '@/lib/utils';
import {
  NO_REPLY_WORDS, REPLIES_PER_DAY, REPLY_FROM_NAME, REPLY_MAX_CHARS, REPLY_WORDS, RETRY_WINDOW_MS,
  cleanText, concurrentWords, replySubject, replyTarget, replyText, signedFirstName, stateAfterReply,
} from '@/lib/feedback-reply';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REPLY_TIMEOUT_MS = 10_000;
const STALL_MS = 120_000;
const REPLY_COLUMNS = 'id, feedback_id, staff_user_id, body, status, attempt, signed_name, to_email, sending_at, claimed_at, account_email_id';

type ReplyRow = {
  id: string; feedback_id: string; staff_user_id: string; body: string; status: string; attempt: number;
  signed_name: string; to_email: string; sending_at: string | null; claimed_at: string | null; account_email_id: string | null;
};

const refuse = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status });

/**
 * REPLY TO A FEEDBACK ITEM BY EMAIL (Support console Stage 5, owner Q5 2026-10-26; drawings D and G; threats T18-T23).
 *
 * The browser sends `{ replyId, message, latestSeenAt?, sendAnyway? }` — the reply's own number (made when the window
 * opened), the words, the newest reply it showed, and "Send mine too". Never an address or a header (T18, T21).
 *
 * Order (the Stage 3 refund pattern: our record first, one outside call with a once-only key, fixed sentences):
 *   1. the reply power, before anything is read (T23);
 *   2. the feedback, and who it may go to: the account behind it, still the same confirmed, unlocked address, under 90
 *      days (T19) — re-checked on a retry too;
 *   3. a known reply number: the same words or refused; sent = answered again as sent; after a day = refused (T22);
 *      a new one: the daily limit (T20) and "someone replied while you were writing" (once), then the row as a draft;
 *   4. one server claims it (draft / failed / unknown → sending, by a conditional update), so a double click on two
 *      servers sends once (T22);
 *   5. one send, keyed `feedback-reply-{id}-{attempt}`: a retry after no answer repeats the key (the mail service sends
 *      it at most once); a retry after a refusal takes the next attempt;
 *   6. sent → the item moves New or Triaged to Acknowledged (never Resolved) and an audit entry records who.
 * No reason is asked (a console work tool, Q5).
 */
export const POST = withObservability(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('reply');
  if (auth.response) return auth.response;
  const staffUserId = auth.user.id;
  const staffEmail = (auth.user.email ?? 'platform-admin').toLowerCase();

  const { id: feedbackId } = await ctx.params;
  if (!isUuid(feedbackId)) return refuse(400, 'Invalid feedback id.');
  const input = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const replyId = isUuid(input.replyId) ? input.replyId.toLowerCase() : null;
  if (!replyId) return refuse(400, 'Invalid reply number.');
  const message = typeof input.message === 'string' ? cleanText(input.message).trim() : '';
  if (!message) return refuse(400, REPLY_WORDS.empty);
  if (message.length > REPLY_MAX_CHARS) return refuse(400, REPLY_WORDS.tooLong);
  const latestSeenAt = typeof input.latestSeenAt === 'string' && Number.isFinite(Date.parse(input.latestSeenAt)) ? input.latestSeenAt : null;
  const sendAnyway = input.sendAnyway === true;

  const { data: feedback } = await supabaseAdmin
    .from('feedback_submissions')
    .select('id, org_id, user_id, user_email, title, body, status, created_at')
    .eq('id', feedbackId)
    .maybeSingle();
  if (!feedback) return refuse(404, 'Feedback not found.');

  const target = await replyTarget(feedback);
  if (!target.ok) return refuse(409, NO_REPLY_WORDS[target.reason], { reason: target.reason });

  // ── 3. The reply row ─────────────────────────────────────────────────────────────────────────
  const { data: existing } = await supabaseAdmin
    .from('platform_feedback_replies')
    .select(REPLY_COLUMNS)
    .eq('id', replyId)
    .maybeSingle<ReplyRow>();

  let row: ReplyRow;
  if (existing) {
    if (existing.feedback_id !== feedbackId || existing.staff_user_id !== staffUserId) return refuse(409, 'Invalid reply number.');
    if (existing.body !== message) return refuse(409, REPLY_WORDS.edited, { state: 'edited' });
    if (existing.status === 'sent') return NextResponse.json({ ok: true, state: 'sent', to: existing.to_email });
    // A send whose server stopped answering mid-way stays "sending"; two minutes after ITS CLAIM (not the first send:
    // a retry's claim is fresh) it is Not confirmed, which retries under the same once-only key, and the stalled
    // request can no longer finish it (its claim is gone).
    const claimedAt = existing.claimed_at ?? existing.sending_at;
    const stalled = existing.status === 'sending' && claimedAt && Date.now() - Date.parse(claimedAt) > STALL_MS;
    if (stalled) {
      const { data: moved } = await supabaseAdmin.from('platform_feedback_replies')
        .update({ status: 'unknown' }).eq('id', existing.id).eq('status', 'sending').eq('claimed_at', existing.claimed_at as string).select('id');
      if (moved && moved.length > 0) existing.status = 'unknown';
    }
    // A draft goes on to the claim below, which lets exactly one request take it.
    if (existing.status === 'sending') return refuse(409, REPLY_WORDS.sending, { state: 'sending' });
    if (existing.sending_at && Date.now() - Date.parse(existing.sending_at) > RETRY_WINDOW_MS) {
      return refuse(410, REPLY_WORDS.tooLate, { state: 'too_late' });
    }
    if (existing.to_email !== target.to) return refuse(409, NO_REPLY_WORDS.changed, { reason: 'changed' });
    row = existing;
  } else {
    const since = new Date(Date.now() - 86_400_000).toISOString(); // utc-intentional: an instant comparison
    const { count } = await supabaseAdmin
      .from('platform_feedback_replies')
      .select('id', { count: 'exact', head: true })
      .eq('staff_user_id', staffUserId)
      .gte('created_at', since);
    if ((count ?? 0) >= REPLIES_PER_DAY) return refuse(429, REPLY_WORDS.limit, { state: 'limit' });

    if (!sendAnyway) {
      let q = supabaseAdmin
        .from('platform_feedback_replies')
        .select('staff_email, signed_name, body, created_at')
        .eq('feedback_id', feedbackId)
        .in('status', ['sending', 'sent', 'unknown'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (latestSeenAt) q = q.gt('created_at', latestSeenAt);
      const { data: newer } = await q;
      const other = newer?.[0];
      if (other) {
        const by = other.signed_name || 'Someone';
        return refuse(409, concurrentWords(by, other.created_at as string), {
          state: 'concurrent',
          theirs: { by, at: other.created_at, body: other.body },
        });
      }
    }

    const { data: staff } = await supabaseAdmin.from('platform_users').select('display_name').eq('email', staffEmail).maybeSingle();
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('platform_feedback_replies')
      .insert({
        id: replyId, feedback_id: feedbackId, staff_user_id: staffUserId, staff_email: staffEmail,
        signed_name: signedFirstName(staff?.display_name as string | null), to_email: target.to, body: message,
      })
      .select(REPLY_COLUMNS)
      .single<ReplyRow>();
    // Two clicks raced to write the same number: the other one holds it.
    if (insertError || !inserted) return refuse(409, REPLY_WORDS.sending, { state: 'sending' });
    row = inserted;
  }

  // ── 4. One server claims it ──────────────────────────────────────────────────────────────────
  const attempt = row.status === 'failed' ? row.attempt + 1 : row.attempt;
  const myClaim = new Date().toISOString(); // utc-intentional: an instant
  const { data: claimed } = await supabaseAdmin
    .from('platform_feedback_replies')
    .update({ status: 'sending', attempt, sending_at: row.sending_at ?? myClaim, claimed_at: myClaim })
    .eq('id', row.id)
    .eq('status', row.status)
    .select('id');
  if (!claimed || claimed.length === 0) return refuse(409, REPLY_WORDS.sending, { state: 'sending' });

  // The attempt's log row, kept on the reply at once: a retry after no answer is the same email under the same
  // once-only key, so it must carry the same row (and tag), or the mail service would see a different message.
  let logId = row.status === 'unknown' ? row.account_email_id : null;
  if (!logId) {
    logId = await openSentEmailRow({
      kind: 'feedback_reply', to: row.to_email, orgId: feedback.org_id as string | null, askedBy: staffUserId, feedbackId,
    });
    if (logId) {
      await supabaseAdmin.from('platform_feedback_replies').update({ account_email_id: logId }).eq('id', row.id).eq('claimed_at', myClaim);
    }
  }

  // ── 5. One send ──────────────────────────────────────────────────────────────────────────────
  const result = await sendEmail(row.to_email, replySubject(feedback.title as string | null), '', {
    kind: 'feedback_reply',
    text: replyText({ body: row.body, signedName: row.signed_name, feedbackAt: feedback.created_at as string, feedbackBody: feedback.body as string | null }),
    fromName: REPLY_FROM_NAME,
    replyTo: ADMIN_EMAIL,
    orgId: feedback.org_id as string | null,
    askedBy: staffUserId,
    feedbackId,
    idempotencyKey: `feedback-reply-${row.id}-${attempt}`,
    timeoutMs: REPLY_TIMEOUT_MS,
    logId,
  });

  // Only the request holding the claim finishes the attempt; a stale one (its claim taken over) changes nothing.
  const finish = async (status: 'sent' | 'failed' | 'unknown') => {
    const { error } = await supabaseAdmin
      .from('platform_feedback_replies')
      .update({ status, finished_at: new Date().toISOString(), account_email_id: result.logId ?? logId ?? row.account_email_id })
      .eq('id', row.id)
      .eq('status', 'sending')
      .eq('claimed_at', myClaim);
    if (error) console.warn('[feedback-reply] a reply attempt could not be finished');
  };

  if (result.status === 'sent') {
    await finish('sent');
    const after = stateAfterReply(feedback.status as string);
    if (after.next) {
      await supabaseAdmin
        .from('feedback_submissions')
        .update({ status: after.next, updated_at: new Date().toISOString() })
        .eq('id', feedbackId)
        .in('status', ['new', 'triaged']);
    }
    await writePlatformAuditLog(staffEmail, feedback.org_id as string | null, 'feedback_reply_sent', 'reply', null, {
      feedbackId, replyId: row.id, attempt,
    });
    return NextResponse.json({ ok: true, state: 'sent', to: row.to_email, moved: after.next });
  }
  // No answer, or an answer that does not prove nothing went (5xx, 429, a once-only key already in flight): Not
  // confirmed, and a retry repeats the same key. Only a definite refusal (or no mail key) is "nothing was sent".
  if (result.status === 'no_answer' || (result.status === 'provider_error' && !result.refused)) {
    await finish('unknown');
    await writePlatformAuditLog(staffEmail, feedback.org_id as string | null, 'feedback_reply_unconfirmed', 'reply', null, {
      feedbackId, replyId: row.id, attempt,
    });
    return NextResponse.json({ ok: false, state: 'unknown', error: REPLY_WORDS.unconfirmed }, { status: 202 });
  }
  await finish('failed');
  return refuse(502, result.status === 'skipped' ? REPLY_WORDS.noKey : REPLY_WORDS.refused, { state: 'failed' });
}, { route: '/api/platform-admin/feedback/[id]/reply' });
