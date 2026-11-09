import { escText, warmEmailButton, warmEmailFootnote, WARM_EMAIL_STYLE } from './email-envelope-warm';
import { SECOND_PARENT_WORDS } from './league-second-parent';
import { FAMILY_INVITATION_WORDS } from './family-invitation-words';
import type { InvitationSender } from './family-invitation';

/**
 * THE INVITATION'S HTML, PURE (Signed-in family accounts Stage 4a, Part 5; drawing tab 1; /legal draft (c)). No database and no
 * send here, so every piece is unit-tested over real output (tests/unit/family-invitation-mail.test.ts). The sends are
 * lib/family-invitation-mail.ts and lib/house-league-placement-mail.ts.
 *
 * ⚠ The panel promotes nothing (/legal condition 6): no plan, price, offer or FieldLogicHQ pitch — only the invitation.
 * ⚠ The invitation's link only opens the accept page; no address rides in it.
 */

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';
const W = FAMILY_INVITATION_WORDS;

/** Where a parent lands after joining, or from "Open the team" (E) and the email's "Open it". Part 6 builds the page: with
 *  exactly one team it opens that team, otherwise the "Your family" list. */
export const FAMILY_HOME_PATH = '/family';

/** The accept page for an invitation token. */
export const acceptUrl = (token: string) => `${SITE_URL}/family/claim/${token}`;

// ── The slots in the placement and moved emails ──────────────────────────────────────────────

/**
 * The placement and moved email builders (lib/email.ts) draw these only when asked (`invitationSlots`, which the sender passes
 * only while the guardian tier is on and the club can be named), so with the tier off the email is today's, byte for byte. Each
 * copy fills them for its own address. HTML comments: an unfilled slot shows nothing.
 */
/** Under the greeting: the second parent's who-added line (drawing 1d). */
export const INVITE_WHO_SLOT = '<!--fl-invite-who-->';
/** Under the "Your sign-up" button, above the contact line: the panel or the one-liner (drawing 1b, 1c, 1e). */
export const INVITE_PANEL_SLOT = '<!--fl-invite-panel-->';

export interface SlotFill { who: string; panel: string }
export const EMPTY_FILL: SlotFill = { who: '', panel: '' };

/** Both slots filled (each with '' when this address gets nothing there). */
export function fillInvitationSlots(html: string, fill: SlotFill): string {
  return html.replace(INVITE_WHO_SLOT, () => fill.who).replace(INVITE_PANEL_SLOT, () => fill.panel);
}

// ── The panel ────────────────────────────────────────────────────────────────────────────────

/** One child the email names, for the panel's words. */
export interface MailChild { registrationId: string; firstName: string; team: string }

const teamCount = (children: readonly MailChild[]) => new Set(children.map(c => c.team)).size || 1;

/** The invitation panel (drawing 1b/1d; /legal draft (c)). `who` = the first parent's panel, or the second parent's. */
export function invitationPanelHtml(p: {
  who: 'first' | 'second'; children: readonly MailChild[]; email: string; url: string; sender: InvitationSender;
}): string {
  const names = p.children.map(c => c.firstName);
  const teams = teamCount(p.children);
  const finePrint = p.who === 'first'
    ? W.mail.firstFinePrint(p.email, names, p.sender.clubName, p.sender.contact ?? '', teams)
    : W.mail.secondFinePrint(p.email, names, SECOND_PARENT_WORDS.stop.button);
  return `<div style="${WARM_EMAIL_STYLE.panel}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">${escText(W.mail.panelTitle(names, teams))}</p>
      ${p.who === 'first' ? `<p style="${WARM_EMAIL_STYLE.paragraph}">${escText(W.mail.panelBody)}</p>` : ''}
      ${warmEmailButton(escText(W.mail.panelButton(names, teams)), escText(p.url))}
      <p style="${WARM_EMAIL_STYLE.small}margin:0;">${escText(finePrint)}</p>
    </div>`;
}

/** "Leo and Ava’s team is in your app. Open it" (drawing 1e): one line and a plain link to the family page. */
export function connectedLineHtml(children: readonly MailChild[]): string {
  const names = children.map(c => c.firstName);
  return `<div style="${WARM_EMAIL_STYLE.panel}">
      <p style="${WARM_EMAIL_STYLE.paragraph}margin:0;">${escText(W.mail.connected(names, teamCount(children)))} <a href="${escText(`${SITE_URL}${FAMILY_HOME_PATH}`)}" style="${WARM_EMAIL_STYLE.textLink}">${escText(W.mail.connectedLink)}</a></p>
    </div>`;
}

/** The second parent's who-added line, under the greeting (drawing 1d). */
export function whoAddedHtml(firstParent: string, children: readonly MailChild[]): string {
  return `<p style="${WARM_EMAIL_STYLE.small}">${escText(W.mail.secondAddedYou(firstParent, children.map(c => c.firstName)))}</p>`;
}

/** The second parent's sender line at the card's end, after the Stop footer (/legal draft (c), O3). */
export function secondSenderFootnote(sender: InvitationSender): string {
  return warmEmailFootnote(escText(W.mail.secondSender(sender.clubName, sender.mailingAddress ?? '', sender.contact ?? '')));
}

// ── The rep coach's invitation (drawing 1f) ──────────────────────────────────────────────────

/** The rep coach's invitation email's content (inside the envelope). Plain words from the words module; every value escaped. */
export function repInvitationHtml(p: {
  coach: string; team: string; child: string; email: string; url: string; stopUrl: string; sender: InvitationSender;
}): string {
  const M = W.repMail;
  const senderLine = p.sender.teamWorkspace
    ? M.senderCoachTeam(p.coach, p.sender.contact ?? '')
    : M.senderClub(p.coach, p.sender.clubName, p.sender.mailingAddress ?? '', p.sender.contact ?? '');
  return `
    <h1 style="${WARM_EMAIL_STYLE.heading}">${escText(M.heading(p.child))}</h1>
    <p style="${WARM_EMAIL_STYLE.paragraph}">${escText(M.greeting)}</p>
    <p style="${WARM_EMAIL_STYLE.paragraph}">${escText(M.lead(p.coach, p.team, p.child))}</p>
    ${warmEmailButton(escText(M.button(p.child)), escText(p.url))}
    <p style="${WARM_EMAIL_STYLE.small}">${escText(M.finePrint(p.email, p.child))}</p>
    <div style="${WARM_EMAIL_STYLE.footRule}">
      <p style="${WARM_EMAIL_STYLE.finePrint}">${escText(M.stopLead)} <a href="${escText(p.stopUrl)}" style="${WARM_EMAIL_STYLE.finePrintLink}">${escText(M.stopLink)}</a></p>
      <p style="${WARM_EMAIL_STYLE.finePrint}margin-top:6px;">${escText(senderLine)}</p>
    </div>`;
}
