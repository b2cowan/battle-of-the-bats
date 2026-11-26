import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { sendEmail } from './email';
import { writePlatformAuditLog } from './platform-audit';
import { captureError } from './observability';
import { FIELDLOGICHQ_CONTACT_EMAIL, FIELDLOGICHQ_SELLER_MAILING_ADDRESS } from './fieldlogichq-contact';
import { buildAddressUnsubscribeUrl, oneClickUnsubscribeHeaders } from './unsubscribe-token';
import { isAddressStopped } from './email-address-stops';
import { maskEmail } from './family-invitation-rules';
import { isPreviewEmailRole, previewAddress, type PreviewEmailRole } from './preview-claim';
import { removalDateLabel } from './prospect-clubs';
import { formatShortWeekdayDate, orgDayKey } from './timezone';
import { previewDayLabel } from './preview-ended';
import { PREVIEW_EMAIL_WORDS, previewLinkEmail } from './preview-link-email';
import { looksLikeEmailAddress } from './sent-log-words';
import { canonicalAppOrigin } from './app-origin';

/**
 * The one email's send (Club Website Track P, Session P4; T13; /legal's Track P review finding 3). From the room window's
 * Email the link (owner only). In this order, and every refusal keeps NOTHING:
 *   1. no mailing address → refused (T13: it stays refused until FieldLogicHQ has one; owed from the owner);
 *   2. the address and the role (an officer's role, never "Other") and the tick;
 *   3. the preview is open (unclaimed, not removed) and the meeting day has come (the address was given AT the meeting);
 *   4. the address has not asked for no more email from us (email_address_stops, fail-closed);
 *   5. the consent record is written first (one per preview: a second send is refused by the database), then the email,
 *      then its send time. A send that surely failed deletes the record; one with no clear answer keeps it (it may have gone).
 */
/** The one email, once it has gone: the address masked, and the day. */
export type SentLink = { to: string; on: string };
export type PreviewLinkSend =
  | { ok: true; to: string }
  /** `sent`: what went before; null when it cannot be read yet (another request's send is still in hand). */
  | { ok: false; why: 'already_sent'; sent: SentLink | null }
  | { ok: false; why: 'no_mailing_address' | 'bad_address' | 'bad_role' | 'no_tick' | 'not_open' | 'before_meeting' | 'stopped' | 'no_unsubscribe' | 'failed' };

/** An unsent record older than this was left by a request that died: the send itself gives up after 10 seconds. */
const STALE_UNSENT_MS = 10 * 60_000;

/** Is the send refused before anything is read? (T13: the mailing address.) The room window asks the same question. */
export function previewLinkRefusedForAddress(): boolean {
  return FIELDLOGICHQ_SELLER_MAILING_ADDRESS.trim() === '';
}

export async function sendPreviewLink(input: {
  orgId: string; to: string; role: unknown; ticked: boolean; staffEmail: string;
}): Promise<PreviewLinkSend> {
  if (previewLinkRefusedForAddress()) return { ok: false, why: 'no_mailing_address' };
  const to = input.to.trim().toLowerCase();
  if (!looksLikeEmailAddress(to)) return { ok: false, why: 'bad_address' };
  if (!isPreviewEmailRole(input.role)) return { ok: false, why: 'bad_role' };
  const role: PreviewEmailRole = input.role;
  if (!input.ticked) return { ok: false, why: 'no_tick' };

  const { data: rec, error: recErr } = await supabaseAdmin
    .from('organization_previews')
    .select('org_id, org_slug, org_name, meeting_at, claimed_at, removed_at')
    .eq('org_id', input.orgId)
    .maybeSingle();
  if (recErr) throw new Error(`[preview-link] the preview could not be read: ${recErr.message}`);
  const r = rec as { org_id: string; org_slug: string; org_name: string; meeting_at: string; claimed_at: string | null; removed_at: string | null } | null;
  if (!r || r.claimed_at || r.removed_at) return { ok: false, why: 'not_open' };
  const meetingDayKey = orgDayKey(r.meeting_at);
  // Not before the meeting has started (/review 2026-11-26): the record says the address was given there, in person.
  if (Date.now() < Date.parse(r.meeting_at)) return { ok: false, why: 'before_meeting' };

  const already = await readSentLink(input.orgId);
  if (already) return { ok: false, why: 'already_sent', sent: already };
  if (await isAddressStopped(to)) return { ok: false, why: 'stopped' };

  const unsubscribeUrl = buildAddressUnsubscribeUrl(to);
  const email = previewLinkEmail({
    club: r.org_name,
    url: `${canonicalAppOrigin()}/${r.org_slug}`,
    addressText: previewAddress(r.org_slug),
    meetingDay: formatShortWeekdayDate(meetingDayKey),
    removalDay: removalDateLabel(r.meeting_at, true),
    mailingAddress: FIELDLOGICHQ_SELLER_MAILING_ADDRESS,
    unsubscribeUrl,
  });
  if (!email) return { ok: false, why: 'no_unsubscribe' };

  // A record left without its send by a request that died part-way (/review 2026-11-26) would block the one email for
  // good: one older than any send could take is cleared first.
  const stale = new Date(Date.now() - STALE_UNSENT_MS).toISOString(); // utc-intentional: an instant window
  await supabaseAdmin.from('preview_email_consents').delete().eq('org_id', r.org_id).is('sent_at', null).lt('created_at', stale);

  // The consent record first (CASL s. 13: the proof is ours to keep). The database allows one per preview.
  const { data: row, error: insErr } = await supabaseAdmin
    .from('preview_email_consents')
    .insert({ org_id: r.org_id, org_name: r.org_name, email: to, role, given_on: meetingDayKey, given_how: 'in_person', recorded_by: input.staffEmail })
    .select('id')
    .single();
  if (insErr) {
    if (insErr.code === '23505') {
      return { ok: false, why: 'already_sent', sent: await readSentLink(input.orgId) };
    }
    throw new Error(`[preview-link] the consent record could not be written: ${insErr.message}`);
  }
  const consentId = (row as { id: number }).id;

  // orgId null: FieldLogicHQ's own mail (a preview never sends, T1). One key per record: a definite refusal deletes the
  // record, so a corrected address is a new attempt with a new key (the same key with a new body would be refused).
  const forget = async () => {
    const { error } = await supabaseAdmin.from('preview_email_consents').delete().eq('id', consentId);
    if (error) await captureError(new Error(`[preview-link] an unsent consent record could not be deleted: ${error.message}`));
  };
  let result: Awaited<ReturnType<typeof sendEmail>>;
  try {
    result = await sendEmail(to, email.subject, email.html, {
      kind: 'preview_link',
      orgId: null,
      fromName: PREVIEW_EMAIL_WORDS.fromName,
      replyTo: FIELDLOGICHQ_CONTACT_EMAIL,
      headers: oneClickUnsubscribeHeaders(unsubscribeUrl),
      idempotencyKey: `preview-link:${r.org_id}:${consentId}`,
      timeoutMs: 10_000,
    });
  } catch (e) {
    await forget();
    throw e;
  }
  // `skipped` is a mail service that is not set up (no key): nothing left, so the one email is not used up.
  const mayHaveGone = result.status === 'no_answer' || (result.status === 'provider_error' && !result.refused && !result.throttled);
  if (result.status === 'sent' || mayHaveGone) {
    const { error: stampErr } = await supabaseAdmin.from('preview_email_consents').update({ sent_at: new Date().toISOString() }).eq('id', consentId);
    if (stampErr) await captureError(new Error(`[preview-link] the send time could not be kept on consent record ${consentId}: ${stampErr.message}`));
    await writePlatformAuditLog(input.staffEmail, null, 'preview_link_sent', 'email', null,
      { orgId: r.org_id, orgSlug: r.org_slug, to: maskEmail(to), role, unconfirmed: mayHaveGone },
      { reason: 'The one email with the link, after the meeting (T13)' });
    return { ok: true, to: maskEmail(to) };
  }
  await forget();
  return { ok: false, why: 'failed' };
}

/** The one email already sent for this preview, for the room window and a second send's refusal. null = none (or not readable). */
export async function readSentLink(orgId: string): Promise<SentLink | null> {
  const { data, error } = await supabaseAdmin
    .from('preview_email_consents')
    .select('email, sent_at')
    .eq('org_id', orgId)
    .not('sent_at', 'is', null)
    .maybeSingle();
  if (error || !data) return null;
  const d = data as { email: string; sent_at: string };
  return { to: maskEmail(d.email), on: previewDayLabel(d.sent_at)! }; // the query reads only a record that has its send time
}
