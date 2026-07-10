import { extendTryoutOffer, clearTryoutOffer } from './db';
import {
  sendEmail,
  tryoutOfferHtml,
  tryoutWaitlistHtml,
  tryoutDeclinedHtml,
  SITE_URL,
} from './email';
import { sendTransactionalEmail } from './platform-email-templates';
import type { RepTryoutRegistration, RepTryoutRegistrationStatus } from './types';

/**
 * The single side-effects entry point for a tryout status decision (Phase 2B.5). BOTH the admin
 * applicant route and the coach decision board route call this after updating status, so the two
 * surfaces email families identically.
 *
 *  - offered   → mint a fresh no-login response token (7-day deadline) + send the org-branded offer
 *                email with Accept/Decline links.
 *  - waitlisted→ clear any prior offer link + send the "you're on the waitlist" email.
 *  - declined  → clear any prior offer link + send the dignified release email.
 *  - withdrawn → clear any prior offer link, no email (family-initiated / staff cleanup).
 *
 * The token-mint + clear are AWAITED (they're the durable part); the email send is fire-and-forget
 * (guardian transactional mail — a provider hiccup must not fail the decision).
 */
export async function applyTryoutDecisionSideEffects(params: {
  reg: RepTryoutRegistration;
  newStatus: RepTryoutRegistrationStatus;
  teamName: string;
  yearName: string;
  orgName?: string;
  orgLogoUrl?: string;
  contactEmail?: string;
}): Promise<void> {
  const { reg, newStatus, teamName, yearName, orgName, orgLogoUrl, contactEmail } = params;

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
    const { token, expiresAt } = await extendTryoutOffer(reg.id);
    const acceptUrl = `${SITE_URL}/tryout-response/${token}?r=accept`;
    const declineUrl = `${SITE_URL}/tryout-response/${token}?r=decline`;
    const respondBy = new Date(expiresAt).toLocaleDateString('en-CA', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    sendTransactionalEmail({
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

  // Any non-offered transition kills a stale response link first.
  await clearTryoutOffer(reg.id);

  if (newStatus === 'waitlisted') {
    sendEmail(
      reg.guardianEmail,
      `${teamName} — Tryout Update`,
      tryoutWaitlistHtml(base),
    ).catch(e => console.error('[email] tryout waitlist:', e));
  } else if (newStatus === 'declined') {
    sendTransactionalEmail({
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
