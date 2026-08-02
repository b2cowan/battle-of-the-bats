import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { sendEmail, escapeHtml, type SendEmailResult } from './email';
import { buildGuardianUnsubscribeUrl } from './unsubscribe-token';
import { normalizeGuardianEmail } from './guardian-email';

/**
 * lib/family-email.ts — the ONE way to email a family.
 *
 * CASL compliance for family mail is two rules: never mail an address that opted out, and
 * always carry a working per-family unsubscribe with the sender identified. Before this
 * module those two rules lived inside each sender, which meant they held only for as long as
 * every future sender remembered them — and a third sender (the free-tier "Email families")
 * is already known to be coming. Compliance that depends on remembering is compliance that
 * eventually lapses.
 *
 * So `sendFamilyEmail` is the choke point: it re-checks the suppression list itself and
 * appends the footer itself. A caller CANNOT mail an opted-out family through it, and a
 * caller that reaches for the raw `sendEmail` instead is now a visible mistake rather than an
 * indistinguishable one.
 *
 * Callers that need the suppression list up front (to tell a coach "2 families have
 * unsubscribed" before a send) fetch it once with `getFamilySuppressionList` and hand it
 * back in — the guard still runs, it just does not re-query per recipient.
 */

/** Normalized addresses that have opted out of this org's family email.
 *
 *  Throws rather than returning empty on error — the send path must FAIL CLOSED. Refusing to
 *  send is a missed message; mailing someone who opted out is a compliance breach, and those
 *  are not the same size of mistake. (Deliberately the opposite posture from the
 *  notification-pause lookup, which fails open because a missed alert is the worse outcome
 *  there.) */
export async function getFamilySuppressionList(orgId: string): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from('family_email_optouts')
    .select('email')
    .eq('org_id', orgId);
  if (error) throw error;
  return new Set((data ?? []).map(row => (row as { email: string }).email));
}

export interface FamilyEmailContent {
  /** Small uppercase kicker above the title — the team, so a family knows which one. */
  teamName: string;
  /** The organization, named in the footer. CASL requires the sender be identifiable, and
   *  the org is the sender a family recognizes; a team name alone is ambiguous in a club. */
  orgName: string | null;
  title: string;
  /** Plain text. Escaped and newline-converted here — callers never hand-build HTML. */
  body: string;
  /** Optional call to action, e.g. "See the full schedule →". */
  cta?: { href: string; label: string };
  /** Why this family is receiving it, completing "Sent by {org} because …". */
  reason: string;
}

/** The shared envelope. One home for the markup AND for the footer that carries sender
 *  identification plus the unsubscribe link. */
function familyEmailHtml(content: FamilyEmailContent, orgId: string, recipientEmail: string): string {
  const sender = content.orgName ? escapeHtml(content.orgName) : escapeHtml(content.teamName);
  const unsubscribeUrl = buildGuardianUnsubscribeUrl(orgId, recipientEmail);
  const cta = content.cta
    ? `<p style="margin:1.5rem 0 0;"><a href="${content.cta.href}" style="color:#D9F99D;font-weight:700;">${escapeHtml(content.cta.label)}</a></p>`
    : '';
  return `
<div style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;background:#111827;color:#F1F5F9;max-width:600px;margin:0 auto;padding:2rem;border:1px solid rgba(96,165,250,0.25);">
  <div style="margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid rgba(96,165,250,0.18);">
    <span style="font-size:0.72rem;font-weight:900;color:#60A5FA;letter-spacing:0.14em;text-transform:uppercase;">${escapeHtml(content.teamName)}</span>
  </div>
  <h2 style="margin:0 0 1rem;color:#fff;font-size:1.25rem;line-height:1.3;">${escapeHtml(content.title)}</h2>
  <div style="color:rgba(241,245,249,0.82);font-size:0.95rem;line-height:1.7;">${escapeHtml(content.body)}</div>
  ${cta}
  <p style="margin:1.75rem 0 0;color:rgba(241,245,249,0.45);font-size:0.78rem;line-height:1.5;">
    Sent by ${sender} because ${escapeHtml(content.reason)}.<br>
    <a href="${unsubscribeUrl}" style="color:rgba(241,245,249,0.6);">Unsubscribe from ${sender} team emails</a>
  </p>
</div>`;
}

export type FamilySendResult = SendEmailResult | { status: 'suppressed' };

/**
 * Send one family email. The ONLY sanctioned way to mail a guardian or follower.
 *
 * Pass `suppressed` when the caller already loaded the list (a bulk send); omit it and this
 * fetches per recipient. Either way the guard runs — an opted-out address returns
 * `'suppressed'` without a send, so a caller cannot bypass the check by forgetting it.
 */
export async function sendFamilyEmail(params: {
  orgId: string;
  to: string;
  subject: string;
  content: FamilyEmailContent;
  suppressed?: Set<string>;
}): Promise<FamilySendResult> {
  const to = normalizeGuardianEmail(params.to);
  if (!to) return { status: 'suppressed' };

  const suppressed = params.suppressed ?? (await getFamilySuppressionList(params.orgId));
  if (suppressed.has(to)) return { status: 'suppressed' };

  return sendEmail(to, params.subject, familyEmailHtml(params.content, params.orgId, to));
}
