import { escText, insertAtWarmCardEnd, warmEmailFootnote, WARM_EMAIL_STYLE } from './email-envelope-warm';
import { SECOND_PARENT_WORDS } from './league-second-parent';
import { buildSecondParentStopUrl } from './unsubscribe-token';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE STOP BUTTON ON A SECOND PARENT'S COPY (Signed-in family accounts Stage 3b, Part 4; CASL_SECOND_PARENT_EMAIL.md).
 *
 *   ONE footer builder for every path that sends a second parent a sign-up email, so they cannot drift:
 *     · the shared point — lib/league-second-parent-mail.ts (approve, waitlist, promote, decline, placement, schedule,
 *       practice times, practice changes);
 *     · the four that bypass it — the register route's confirmation, the pay link (lib/online-payment-receipt.ts), the
 *       sign-up-link notices (lib/league-signup-link-mail.ts), and the placement email's re-send to ONE address with a fresh
 *       invitation (lib/house-league-placement-mail.ts resendPlacementInvitation, Signed-in family accounts Stage 4a).
 *   tests/unit/league-second-parent-fanout.test.ts holds that every one of those calls this and no first-parent path does.
 *
 *   The link opens a confirm page (/second-parent-stop); nothing is written until its button is pressed. No link can be
 *   signed without UNSUBSCRIBE_SECRET: then NO footer is drawn (never a forgeable or dead link), and `addedYou` says so.
 *   ⚠ This module only DRAWS the link. It never reads `second_parent_stops`: the stop IS the removal (the address is gone
 *   from the sign-up, so a sender never reaches it), and no send path gets a suppression check.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The footer for one second-parent address at one club, or '' when no link can be signed here. */
function secondParentStopFooterHtml(orgId: string, to: string): string {
  const url = buildSecondParentStopUrl(orgId, to);
  if (!url) return '';
  const W = SECOND_PARENT_WORDS;
  return warmEmailFootnote(
    `${escText(W.footer.lead)} <a href="${escText(url)}" style="${WARM_EMAIL_STYLE.finePrintLink}">${escText(W.stop.button)}</a>`,
  );
}

/** A second parent's copy of a built email with the footer inside the card's end. Unchanged when no link can be signed. */
export function withSecondParentStop(html: string, orgId: string, to: string): string {
  const footer = secondParentStopFooterHtml(orgId, to);
  return footer ? insertAtWarmCardEnd(html, footer) : html;
}

/** Whether a copy to this address will carry the button (the confirmation's "who added you" line asks before it is built). */
export function hasSecondParentStop(orgId: string, to: string): boolean {
  return buildSecondParentStopUrl(orgId, to) !== null;
}
