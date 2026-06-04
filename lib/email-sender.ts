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
import { buildUnsubscribeUrl } from '@/lib/unsubscribe-token';

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
function injectUnsubscribeFooter(html: string, orgId: string): string {
  const unsubscribeUrl = buildUnsubscribeUrl(orgId);
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
    scheduledAt,
  } = opts;

  // ── 1. Opt-out check ───────────────────────────────────────────────────────
  if (!skipOptOutCheck) {
    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .select('email_marketing_opt_out')
      .eq('id', orgId)
      .maybeSingle();

    if (orgErr) {
      console.error('[email-sender] Opt-out check error:', orgErr);
    }

    if (org?.email_marketing_opt_out === true) {
      await logSend({
        emailKey, orgId, toEmail, toName, subject, batchId,
        status: 'suppressed',
        suppressionReason: 'opt_out',
      });
      await incrementBatchCounter(batchId, 'suppressed');
      return 'suppressed';
    }
  }

  // ── 2. Inject unsubscribe footer (all marketing emails) ───────────────────
  const htmlWithFooter = skipOptOutCheck ? html : injectUnsubscribeFooter(html, orgId);

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
