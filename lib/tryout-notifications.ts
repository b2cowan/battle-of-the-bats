import { extendTryoutOffer, clearTryoutOffer } from './db';
import {
  sendEmail,
  tryoutOfferHtml,
  tryoutWaitlistHtml,
  tryoutDeclinedHtml,
  SITE_URL,
} from './email';
import { sendTransactionalEmail } from './platform-email-templates';
import { ORG_TIME_ZONE } from './timezone';
import type { RepTryoutRegistration, RepTryoutRegistrationStatus } from './types';

/**
 * The single side-effects entry point for a tryout status decision (Phase 2B.5). BOTH the admin
 * applicant route and the coach decision board route call this after updating status, so the two
 * surfaces email families identically.
 *
 * `notifyFamily` (Chunk E, D-E9): on the COACH board, family emails are opt-in — most coaches
 * deliver decisions personally. When false, nothing family-facing happens: no offer link is
 * minted (there is no email to carry it) and no email is sent. Durable cleanup — killing a stale
 * response link on any non-offered transition — always runs, whatever the flag says. The flag is
 * REQUIRED (no default): the two surfaces want opposite answers (admin always notifies, the coach
 * board asks its switch), so a defaulted direction would be a trap for the next caller.
 *
 *  - offered   → [notify] mint a fresh no-login response token (7-day deadline) + send the
 *                org-branded offer email with Accept/Decline links.
 *  - waitlisted→ clear any prior offer link + [notify] send the "you're on the waitlist" email.
 *  - declined  → clear any prior offer link + [notify] send the dignified release email.
 *  - withdrawn → clear any prior offer link, no email (family-initiated / staff cleanup).
 *
 * Sends are AWAITED (non-fatal, logged): this platform has no post-response work guarantee
 * (the Amplify `after()` gotcha) — a fire-and-forget decline email that silently never sends is
 * this feature's worst failure. A missing guardian email skips the send outright (walk-ups);
 * the board surfaces that with its "no email on file" chip.
 */
export async function applyTryoutDecisionSideEffects(params: {
  reg: RepTryoutRegistration;
  newStatus: RepTryoutRegistrationStatus;
  teamName: string;
  yearName: string;
  orgName?: string;
  orgLogoUrl?: string;
  contactEmail?: string;
  notifyFamily: boolean;
}): Promise<void> {
  const { reg, newStatus, teamName, yearName, orgName, orgLogoUrl, contactEmail, notifyFamily } = params;
  const canEmail = notifyFamily && !!reg.guardianEmail?.trim();

  const base = {
    guardianFirstName: reg.guardianFirstName,
    playerFirstName: reg.playerFirstName,
    playerLastName: reg.playerLastName,
    teamName,
    yearName,
    contactEmail,
    orgName,
    orgLogoUrl,
  };

  if (newStatus === 'offered') {
    // No email → no link: the response token only ever travels inside the offer email, so a
    // record-only offer mints nothing (and leaves nothing to lapse or resend).
    if (!canEmail) return;
    const { token, expiresAt } = await extendTryoutOffer(reg.id);
    const acceptUrl = `${SITE_URL}/tryout-response/${token}?r=accept`;
    const declineUrl = `${SITE_URL}/tryout-response/${token}?r=decline`;
    // Org timezone, explicitly — the server runs UTC in prod, and a deadline that prints
    // tomorrow's date for a Toronto family is a wrong deadline (WI-11).
    const respondBy = new Date(expiresAt).toLocaleDateString('en-CA', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: ORG_TIME_ZONE,
    });
    await sendTransactionalEmail({
      key: 'tryout_offer_extended',
      to: reg.guardianEmail,
      vars: {
        guardianFirstName: reg.guardianFirstName,
        playerFirstName: reg.playerFirstName,
        playerLastName: reg.playerLastName,
        teamName,
        yearName,
      },
      defaultSubject: `${teamName} — Offer Extended`,
      defaultHtml: tryoutOfferHtml({ ...base, acceptUrl, declineUrl, respondBy }),
    }).catch(e => console.error('[email] tryout offer:', e));
    return;
  }

  // Any non-offered transition kills a stale response link first — durable cleanup, never
  // gated on the notify flag.
  await clearTryoutOffer(reg.id);

  if (!canEmail) return;

  if (newStatus === 'waitlisted') {
    await sendEmail(
      reg.guardianEmail,
      `${teamName} — Tryout Update`,
      tryoutWaitlistHtml(base),
    ).catch(e => console.error('[email] tryout waitlist:', e));
  } else if (newStatus === 'declined') {
    await sendTransactionalEmail({
      key: 'tryout_declined',
      to: reg.guardianEmail,
      vars: {
        guardianFirstName: reg.guardianFirstName,
        playerFirstName: reg.playerFirstName,
        playerLastName: reg.playerLastName,
        teamName,
        yearName,
      },
      defaultSubject: `${teamName} — Tryout Update`,
      defaultHtml: tryoutDeclinedHtml(base),
    }).catch(e => console.error('[email] tryout declined:', e));
  }
  // 'withdrawn' and 'pending_review'/'accepted' send nothing here.
}
