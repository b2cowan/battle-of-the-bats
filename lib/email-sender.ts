/**
 * lib/email-sender.ts
 *
 * Resend wrapper for FieldLogicHQ founding season marketing emails.
 *
 * Responsibilities:
 *  1. Opt-out check — skip sending if org has email_marketing_opt_out = true
 *  2. Pre-send logging to email_sends (status: 'queued')
 *  3. Unsubscribe token injection into every email footer
 *  4. Resend API call
 *  5. Post-send update to email_sends (status: 'sent' | 'failed')
 *  6. Batch counter increments on email_batches when batchId is provided
 *
 * Usage:
 *   import { sendMarketingEmail } from '@/lib/email-sender';
 *   const result = await sendMarketingEmail({ ... });
 *   // result: 'sent' | 'suppressed' | 'failed'
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildUnsubscribeUrl, buildUserUnsubscribeUrl } from '@/lib/unsubscribe-token';

const RESEND_API = 'https://api.resend.com/emails';
const FROM = process.env.RESEND_FROM ?? 'FieldLogicHQ <hello@fieldlogichq.ca>';

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Appends a CASL-compliant unsubscribe footer to outgoing marketing email HTML.
 * Injected before the closing </body> or at the end of the HTML string.
 */
function injectUnsubscribeFooter(html: string, unsubscribeUrl: string): string {
  const footer = `
<div style="margin-top:2.5rem;padding-top:1.25rem;border-top:1px solid rgba(217,249,157,0.1);font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;">
  <p style="margin:0 0 0.4rem;color:rgba(241,245,249,0.3);font-size:0.72rem;line-height:1.55;">
    You're receiving this because you signed up for FieldLogicHQ.
  </p>
  <p style="margin:0;color:rgba(241,245,249,0.25);font-size:0.72rem;line-height:1.55;">
    <a href="${unsubscribeUrl}" style="color:rgba(217,249,157,0.5);text-decoration:underline;">Unsubscribe</a>
    &nbsp;·&nbsp; FieldLogicHQ · Canada
  </p>
</div>`;

  // Insert before </body> if present, otherwise append
  if (html.includes('</body>')) {
    return html.replace('</body>', `${footer}\n</body>`);
  }
  return html + footer;
}

export interface SendEmailOptions {
  emailKey: string;
  orgId: string;
  toEmail: string;
  toName?: string;
  subject: string;
  html: string;
  batchId?: string;
  /**
   * Set true for transactional emails (welcome, billing) that bypass the
   * marketing opt-out check. CASL allows transactional messages regardless
   * of consent status.
   */
  skipOptOutCheck?: boolean;
  /**
   * Set for emails targeted at an INDIVIDUAL (a coach), not an org. When present, opt-out is
   * checked against that person's own opt-out and the unsubscribe footer opts out THAT PERSON
   * — never the org the send is attributed to (CASL fix). `orgId` is still used for logging.
   */
  recipientUserId?: string;
  /**
   * Optional ISO 8601 timestamp (or Resend natural-language string like "in 1 day")
   * to schedule the send for later via Resend's native `scheduled_at`. When omitted
   * the email sends immediately. Used for the post-plan-selection welcome / upsell
   * emails — no cron required.
   */
  scheduledAt?: string;
}

export type SendResult = 'sent' | 'suppressed' | 'failed';

/**
 * Send a marketing email with full logging, opt-out suppression,
 * and unsubscribe footer injection.
 */
export async function sendMarketingEmail(opts: SendEmailOptions): Promise<SendResult> {
  const {
    emailKey,
    orgId,
    toEmail,
    toName,
    subject,
    html,
    batchId,
    skipOptOutCheck = false,
    recipientUserId,
    scheduledAt,
  } = opts;

  // ── 1. Opt-out check — per-person for individual (coach) sends, else per-org ──
  if (!skipOptOutCheck) {
    let optedOut = false;

    if (recipientUserId) {
      const { data: row, error: userErr } = await supabaseAdmin
        .from('user_marketing_opt_outs')
        .select('user_id')
        .eq('user_id', recipientUserId)
        .maybeSingle();
      if (userErr) console.error('[email-sender] User opt-out check error:', userErr);
      optedOut = !!row;
    } else {
      const { data: org, error: orgErr } = await supabaseAdmin
        .from('organizations')
        .select('email_marketing_opt_out')
        .eq('id', orgId)
        .maybeSingle();
      if (orgErr) console.error('[email-sender] Opt-out check error:', orgErr);
      optedOut = org?.email_marketing_opt_out === true;
    }

    if (optedOut) {
      await logSend({
        emailKey, orgId, toEmail, toName, subject, batchId,
        status: 'suppressed',
        suppressionReason: 'opt_out',
      });
      await incrementBatchCounter(batchId, 'suppressed');
      return 'suppressed';
    }
  }

  // ── 2. Inject unsubscribe footer — opts out the person for individual sends ──
  const unsubscribeUrl = recipientUserId
    ? buildUserUnsubscribeUrl(recipientUserId)
    : buildUnsubscribeUrl(orgId);
  const htmlWithFooter = skipOptOutCheck ? html : injectUnsubscribeFooter(html, unsubscribeUrl);

  // ── 3. Insert queued send record ──────────────────────────────────────────
  const sendId = await logSend({
    emailKey, orgId, toEmail, toName, subject, batchId,
    status: 'queued',
  });

  // ── 4. Call Resend ────────────────────────────────────────────────────────
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email-sender] RESEND_API_KEY not set — skipping send for ${emailKey} to ${toEmail}`);
    await updateSend(sendId, 'failed', undefined, 'no_api_key');
    await incrementBatchCounter(batchId, 'failed');
    return 'failed';
  }

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: toName ? `${toName} <${toEmail}>` : toEmail,
        subject,
        html: htmlWithFooter,
        text: htmlToText(htmlWithFooter),
        reply_to: 'hello@fieldlogichq.ca',
        ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[email-sender] Resend error for ${emailKey}:`, errText);
      await updateSend(sendId, 'failed', undefined, 'send_error');
      await incrementBatchCounter(batchId, 'failed');
      return 'failed';
    }

    const resData = await res.json() as { id?: string };
    const resendId = resData.id;

    await updateSend(sendId, 'sent', resendId);
    await incrementBatchCounter(batchId, 'sent');
    return 'sent';
  } catch (err) {
    console.error(`[email-sender] Network error for ${emailKey}:`, err);
    await updateSend(sendId, 'failed', undefined, 'send_error');
    await incrementBatchCounter(batchId, 'failed');
    return 'failed';
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function logSend(params: {
  emailKey: string;
  orgId: string;
  toEmail: string;
  toName?: string;
  subject: string;
  batchId?: string;
  status: 'queued' | 'sent' | 'failed' | 'suppressed';
  suppressionReason?: string;
  resendMessageId?: string;
}): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('email_sends')
    .insert({
      email_key: params.emailKey,
      subject: params.subject,
      recipient_org_id: params.orgId,
      recipient_email: params.toEmail,
      recipient_name: params.toName ?? null,
      status: params.status,
      suppression_reason: params.suppressionReason ?? null,
      resend_message_id: params.resendMessageId ?? null,
      batch_id: params.batchId ?? null,
      sent_at: params.status === 'sent' ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[email-sender] Failed to log email send:', error);
    return null;
  }
  return data?.id ?? null;
}

async function updateSend(
  sendId: string | null,
  status: 'sent' | 'failed',
  resendMessageId?: string,
  suppressionReason?: string,
): Promise<void> {
  if (!sendId) return;
  const { error } = await supabaseAdmin
    .from('email_sends')
    .update({
      status,
      resend_message_id: resendMessageId ?? null,
      suppression_reason: suppressionReason ?? null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    })
    .eq('id', sendId);

  if (error) {
    console.error('[email-sender] Failed to update email send status:', error);
  }
}

async function incrementBatchCounter(
  batchId: string | undefined,
  counter: 'sent' | 'failed' | 'suppressed',
): Promise<void> {
  if (!batchId) return;

  // Increment the appropriate counter using a raw RPC or update+increment pattern.
  // Supabase doesn't have a built-in atomic increment via the JS client,
  // so we do a read-then-write here. For a founding cohort of 30-50 orgs
  // this is fine; revisit with a Postgres function if send volume grows.
  const { data, error: fetchErr } = await supabaseAdmin
    .from('email_batches')
    .select(`${counter}_count`)
    .eq('id', batchId)
    .single();

  if (fetchErr || !data) {
    console.error('[email-sender] Failed to fetch batch for counter increment:', fetchErr);
    return;
  }

  const current = (data as Record<string, number>)[`${counter}_count`] ?? 0;

  const { error: updateErr } = await supabaseAdmin
    .from('email_batches')
    .update({ [`${counter}_count`]: current + 1 })
    .eq('id', batchId);

  if (updateErr) {
    console.error('[email-sender] Failed to increment batch counter:', updateErr);
  }
}

/**
 * Create a new email_batches row and return the batch ID.
 * Call this before starting a bulk send loop.
 */
export async function createEmailBatch(params: {
  emailKey: string;
  subject: string;
  triggeredBy: string; // 'signup' | 'platform_admin:<email>'
  recipientCount: number;
}): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('email_batches')
    .insert({
      email_key: params.emailKey,
      subject: params.subject,
      triggered_by: params.triggeredBy,
      recipient_count: params.recipientCount,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[email-sender] Failed to create email batch:', error);
    return null;
  }
  return data?.id ?? null;
}

/**
 * Mark a batch as complete/failed after all sends have been processed.
 */
export async function finalizeBatch(
  batchId: string,
  status: 'complete' | 'failed',
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('email_batches')
    .update({ status, completed_at: new Date().toISOString() })
    .eq('id', batchId);

  if (error) {
    console.error('[email-sender] Failed to finalize batch:', error);
  }
}

/**
 * Cancel a still-scheduled email for an org by email_key (best-effort, never throws).
 *
 * Used for cancel-on-upgrade: when a free-tier org upgrades, cancel the pending
 * `tournament_plus_upsell` (scheduled ~7 days out via Resend `scheduled_at`) so they
 * don't receive a now-stale "here's what you're missing" nudge after they've upgraded.
 *
 * We don't store the Resend id separately — `sendMarketingEmail` already logged it to
 * `email_sends.resend_message_id`. We look up recent sends for this org + key and call
 * Resend's cancel endpoint. Rows are marked suppressed afterwards so a later upgrade
 * doesn't retry them. If the email already went out (cancel window passed), Resend
 * returns an error which we swallow — there's nothing left to cancel.
 */
export async function cancelScheduledEmail(orgId: string, emailKey: string): Promise<void> {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('email_sends')
      .select('id, resend_message_id')
      .eq('recipient_org_id', orgId)
      .eq('email_key', emailKey)
      .eq('status', 'sent')
      .not('resend_message_id', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(5);

    if (error || !rows || rows.length === 0) return;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    for (const row of rows) {
      try {
        const res = await fetch(`${RESEND_API}/${row.resend_message_id}/cancel`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) {
          // Already delivered or already cancelled — nothing more to do.
          const txt = await res.text().catch(() => '');
          console.warn(`[email-sender] cancel ${emailKey} for org ${orgId}: ${res.status} ${txt}`);
        }
      } catch (err) {
        console.error(`[email-sender] cancel ${emailKey} request error (non-fatal):`, err);
      }

      // Mark suppressed regardless of the Resend outcome so we don't retry this row
      // on every future upgrade.
      await supabaseAdmin
        .from('email_sends')
        .update({ status: 'suppressed', suppression_reason: 'cancelled_on_upgrade' })
        .eq('id', row.id);
    }
  } catch (err) {
    console.error('[email-sender] cancelScheduledEmail error (non-fatal):', err);
  }
}

/** Email key for the per-team game-day reminder (Phase 5m). Shared by the scheduler
 *  (schedule-publish) and the cancel-on-reject sites so the string never drifts. */
export const COACH_GAME_DAY_REMINDER_EMAIL_KEY = 'coach_game_day_reminder';

/**
 * Cancel a still-scheduled email for ONE recipient (org + key + recipient_email), best-effort,
 * never throws (free-tier Coaches Phase 5m). Unlike `cancelScheduledEmail` (org-wide, built for the
 * single per-org upsell), the game-day reminder is per-team, so a withdrawn/rejected team's reminder
 * must be cancelled WITHOUT touching the other teams' scheduled reminders for the same tournament.
 * `recipientEmail` must match the address the reminder was sent to (the resolved coach recipient).
 */
export async function cancelScheduledEmailForRecipient(
  orgId: string,
  emailKey: string,
  recipientEmail: string,
): Promise<void> {
  try {
    const normalized = recipientEmail.trim().toLowerCase();
    if (!normalized) return;
    const { data: rows, error } = await supabaseAdmin
      .from('email_sends')
      .select('id, resend_message_id')
      .eq('recipient_org_id', orgId)
      .eq('email_key', emailKey)
      .eq('recipient_email', normalized)
      .eq('status', 'sent')
      .not('resend_message_id', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(5);

    if (error || !rows || rows.length === 0) return;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    for (const row of rows) {
      try {
        const res = await fetch(`${RESEND_API}/${row.resend_message_id}/cancel`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          console.warn(`[email-sender] cancel ${emailKey} for ${normalized}: ${res.status} ${txt}`);
        }
      } catch (err) {
        console.error(`[email-sender] cancel ${emailKey} request error (non-fatal):`, err);
      }
      await supabaseAdmin
        .from('email_sends')
        .update({ status: 'suppressed', suppression_reason: 'cancelled_team_withdrawn' })
        .eq('id', row.id);
    }
  } catch (err) {
    console.error('[email-sender] cancelScheduledEmailForRecipient error (non-fatal):', err);
  }
}

// ── Founding-season marketing audiences ───────────────────────────────────────
// Per-email recipient counts for the platform-admin Email dashboard. These mirror
// the org-level filters the send route (app/api/admin/email/send) applies when it
// resolves each audience, so the displayed count tracks the actual send. Like the
// dashboard's existing global count, these are qualifying counts that don't resolve
// the recipient's email the way the send does: the founding/not-on-club counts
// count orgs without verifying the owner has a resolvable email, and the coaches
// count counts distinct coach users without verifying each has an auth email. The
// send drops recipients with no resolvable email, so the real send can be slightly
// LOWER than these counts — never higher. (An over-count is the safe direction:
// the operator never under-estimates a blast.)

const FOUNDING_SEASON_EXPIRES = '2027-01-01T00:00:00.000Z';

/** The three audience segments a marketing email can target. */
export type MarketingAudience = 'founding' | 'not_on_club' | 'coaches';

/** Which audience each marketing email key sends to (source of truth: the send route). */
export const MARKETING_EMAIL_AUDIENCE: Record<string, MarketingAudience> = {
  founding_welcome: 'founding',
  founding_checkin: 'founding',
  founding_renewal: 'founding',
  founding_final: 'founding',
  spotlight_club: 'founding',
  spotlight_league: 'founding',
  spotlight_coaches_org: 'founding',
  spotlight_coaches_coach: 'coaches',
  spotlight_club_last: 'not_on_club',
  spotlight_full_picture: 'founding',
};

async function foundingOrgIds(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('org_overrides')
    .select('org_id')
    .eq('type', 'comp_period')
    .eq('expires_at', FOUNDING_SEASON_EXPIRES);
  return (data ?? []).map(o => o.org_id as string);
}

/**
 * Recipient counts per audience segment for the founding-season marketing emails.
 * Returns one entry per `MarketingAudience`. Counts exclude opted-out orgs.
 */
export async function getMarketingAudienceCounts(): Promise<Record<MarketingAudience, number>> {
  const orgIds = await foundingOrgIds();
  if (orgIds.length === 0) return { founding: 0, not_on_club: 0, coaches: 0 };

  const [foundingRes, notOnClubRes, coachRes] = await Promise.all([
    // founding: all founding orgs that haven't opted out
    supabaseAdmin
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .in('id', orgIds)
      .eq('email_marketing_opt_out', false),
    // not_on_club: founding, not opted out, plan not on a League/Club tier (league, club, club_large)
    supabaseAdmin
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .in('id', orgIds)
      .eq('email_marketing_opt_out', false)
      .not('plan_id', 'in', '(league,club,club_large)'),
    // coaches: distinct coach members across non-opted-out founding orgs
    supabaseAdmin
      .from('organizations')
      .select('id')
      .in('id', orgIds)
      .eq('email_marketing_opt_out', false),
  ]);

  let coaches = 0;
  const activeOrgIds = (coachRes.data ?? []).map(o => o.id as string);
  if (activeOrgIds.length > 0) {
    const { data: coachRows } = await supabaseAdmin
      .from('organization_members')
      .select('user_id')
      .in('organization_id', activeOrgIds)
      .eq('role', 'coach');
    // The send dedupes coaches by user_id (one email per person).
    coaches = new Set((coachRows ?? []).map(r => r.user_id as string)).size;
  }

  return {
    founding: foundingRes.count ?? 0,
    not_on_club: notOnClubRes.count ?? 0,
    coaches,
  };
}

/** Recipient count keyed by email key, derived from each key's audience segment. */
export function recipientCountForEmailKey(
  emailKey: string,
  counts: Record<MarketingAudience, number>,
): number {
  const audience = MARKETING_EMAIL_AUDIENCE[emailKey] ?? 'founding';
  return counts[audience];
}
