import { COACHES_TOURNAMENTS_PATH } from '@/lib/coaches-portal-routes';
import { joinWithAnd, possessive, registrationReference } from '@/lib/utils';
import { REFUND_BLOCK_WORDS } from './online-payment-words';
import { nameList, ordinal, signupHeadline, signupToPay, type PlacedChild } from './league-signup';
import { dollarsLine } from './house-league-season';
import { methodInBrackets } from './house-league-money-words';
import { LEAGUE_PAY_WORDS } from './league-pay-words';
import { formatStoredDate } from './timezone';
import { STAFF_KIND_COPY, staffKindCopyFor, type StaffKind } from '@/lib/coach-capabilities';
import {
  FOUNDING_SEASON_END_LABEL,
  FOUNDING_SEASON_FIRST_CHARGE_LABEL,
  FOUNDING_SEASON_SIGNUP_CLOSE_LABEL,
  FOUNDING_SEASON_NEXT_YEAR_LABEL,
  PLAN_CONFIG,
  formatPriceAmount,
} from '@/lib/plan-config';
import { INVITATION_EMAIL_WORDS as INVITE } from '@/lib/invite-only-words';
import {
  WARM_EMAIL, WARM_EMAIL_STYLE, warmPanelStyle,
  warmEmailButton, warmEmailDocument, warmEmailHeading, warmEmailParagraph, warmEmailSmall,
} from '@/lib/email-envelope-warm';
import { VERIFICATION_NEXT_STEP, type VerificationNextStep } from '@/lib/verification-next-step';
import { htmlToText } from '@/lib/email-plain-text';
import type { FamilyMailFace } from '@/lib/email-club-identity';
import { accountNoticeFootnoteHtml } from '@/lib/family-mail-footer';

const RESEND_API = 'https://api.resend.com/emails';
const FROM = process.env.RESEND_FROM ?? 'FieldLogicHQ <onboarding@resend.dev>';

/**
 * The From header for one send. The verified address never changes; a family email puts the club's name in front of it
 * (lib/email-club-identity.ts familySenderName, already cleaned, so it is safe inside the quotes). The address is the part
 * of RESEND_FROM inside <>, or the whole value when it has none.
 */
const FROM_ADDRESS = (FROM.match(/<([^>]+)>/)?.[1] ?? FROM).trim();
function fromHeader(fromName?: string | null): string {
  return fromName ? `"${fromName}" <${FROM_ADDRESS}>` : FROM;
}
const ADMIN_EMAIL = 'fieldlogichq@gmail.com';
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/** Escape user/organizer-authored text before interpolating into an HTML email body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

export type SendEmailResult = { status: 'sent' | 'skipped' | 'provider_error' };

/**
 * `opts.replyTo` — where a reply goes (Club Tier Stage 3a: an allocation reminder's reply reaches the
 * person who sent it, question 3 ruled 2026-09-30 — the club has no payment-instructions setting, so
 * the coach replies to arrange payment). Omitted, replies go to the From address as before.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  opts: { replyTo?: string | null; fromName?: string | null } = {},
): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set - skipping send');
    return { status: 'skipped' };
  }
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromHeader(opts.fromName), to, subject, html, text: htmlToText(html),
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[email] Resend error:', err);
    return { status: 'provider_error' };
  }
  return { status: 'sent' };
}

/** The provider's batch limit: one request carries up to this many separate emails (Resend's `/emails/batch`). */
export const EMAIL_BATCH_SIZE = 100;

/**
 * Up to `EMAIL_BATCH_SIZE` separate emails in ONE provider request (Club Tier Stage 7c, Put to the owner 3: a club's
 * Email families reaches hundreds of families inside the request — one email per request would meet the provider's
 * per-second limit partway through, and work after the response is not kept alive on this host). Each email is its own
 * recipient, words and Reply-To; the provider accepts or refuses the request as a whole, so the result is the batch's.
 * More than the limit is a caller's bug and throws before anything is sent.
 */
export async function sendEmailBatch(
  emails: readonly { to: string; subject: string; html: string; replyTo?: string | null; fromName?: string | null }[],
): Promise<SendEmailResult> {
  if (emails.length === 0) return { status: 'sent' };
  if (emails.length > EMAIL_BATCH_SIZE) throw new Error(`sendEmailBatch: ${emails.length} emails exceeds the batch limit of ${EMAIL_BATCH_SIZE}`);
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set - skipping batch send');
    return { status: 'skipped' };
  }
  const request = {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(emails.map(e => ({
      from: fromHeader(e.fromName), to: e.to, subject: e.subject, html: e.html, text: htmlToText(e.html),
      ...(e.replyTo ? { reply_to: e.replyTo } : {}),
    }))),
  };
  let res = await fetch(`${RESEND_API}/batch`, request);
  if (res.status === 429) {
    // The provider's per-second limit, met by back-to-back batches: wait out what it asks (at most three seconds), once.
    const asked = Number(res.headers.get('retry-after'));
    await new Promise(r => setTimeout(r, Math.min(Number.isFinite(asked) && asked > 0 ? asked * 1000 : 1000, 3000)));
    res = await fetch(`${RESEND_API}/batch`, request);
  }
  if (!res.ok) {
    const err = await res.text();
    console.error('[email] Resend batch error:', err);
    return { status: 'provider_error' };
  }
  return { status: 'sent' };
}

export { ADMIN_EMAIL, SITE_URL };

// ── Automatic coach-email preferences ───────────────────────────────────────────
// The coach-email rule (the per-type switches, the master pause, the recipient) lives in a module
// a client confirm can import too; re-exported here so every sending route keeps its import.
export { coachEmailsPaused, coachEmailEnabled, coachEmailBlock, resolveCoachRecipient, type CoachEmailType } from './coach-email-rules';

// ── Email templates ────────────────────────────────────────────────────────────

// The shared envelope: the warm one (lib/email-envelope-warm.ts), for every email. The verification and password-reset
// emails call it directly; The public face's S3a moved the rest onto it, so this is its name for the builders below.
export const wrap = (content: string) => warmEmailDocument(content);

// A reference number or an ID is set as data (P1: the typewriter face is for the wordmark, a plan chip and real data).
// One place carries the marker, because an email template string cannot hold a comment.
// type-ok: data
const DATA_FACE = 'font-family:monospace;';

/**
 * Build the coach-portal link for an email. Carries registrationId + email so it doubles as a
 * CLAIM link: a coach WITH access lands on their team; a coach WITHOUT creates an account and
 * the registration links automatically (the email half of the claim-by-email gap fix).
 */
export function coachPortalUrl(p: { registrationId?: string; email?: string; registered?: boolean }): string {
  const params = new URLSearchParams();
  if (p.registrationId) params.set('registrationId', p.registrationId);
  if (p.email) params.set('email', p.email);
  // A4.1: `/coaches/join` greets a just-registered coach differently (`fromReg`), so the
  // confirmation email must keep this flag when it adopts the helper — dropping it would
  // silently downgrade the welcome for the one coach who most needs it.
  if (p.registered) params.set('registered', '1');
  // A3.3: the shared constant, not string literals — a route change can't silently strand
  // the 8+ coach email templates that funnel through here.
  params.set('next', p.registrationId ? `${COACHES_TOURNAMENTS_PATH}/${p.registrationId}` : COACHES_TOURNAMENTS_PATH);
  return `${SITE_URL}/coaches/join?${params.toString()}`;
}

/**
 * A consistent, quiet footer CTA appended INSIDE coach-facing template content — NEVER in the
 * shared wrap() shell (which org/billing/founding/auth/league/rep emails also use, so a footer
 * there would leak the coach CTA everywhere). Gives every coach email one tap back to the portal.
 */
export function coachPortalFooter(p: { registrationId?: string; email?: string }): string {
  return `
    <div style="${WARM_EMAIL_STYLE.footRule}">
      <a href="${coachPortalUrl(p)}" style="${WARM_EMAIL_STYLE.textLink}font-family:${WARM_EMAIL.font};font-size:14px;line-height:1.55;">See your team's schedule, status and updates in your Coaches Portal</a>
    </div>`;
}

/**
 * Who a coach email greets: the name, or "Coach" when none is on file. An entry's coach may be empty
 * (an organizer's import with no coach column; a Premium head coach with no name — Register Your
 * Existing Team, Stage 1b), and "Hi ," or "Hi null" is worse than the role. Every builder below that
 * greets a coach goes through here, escaped: the name was typed by a member of the public.
 */
export function greetingName(name: string | null | undefined): string {
  return escapeEmailHtml(name?.trim() || 'Coach');
}

/** A details block's "Coach: …" line, left out when the entry has no coach. */
function coachLineHtml(coachName: string | null | undefined): string {
  return coachName?.trim() ? `Coach: <strong>${escapeEmailHtml(coachName.trim())}</strong><br>` : '';
}

/** What the registration confirmation and the waitlist confirmation are both built from (`/api/register`). */
type RegistrationEmailParams = {
  teamName: string;
  /** The entry's coach — the "Coach" line, left out when there is none. */
  coachName: string | null;
  /** Who the email greets and goes to: the person who registered (Stage 1b), null when they have no name. */
  registrantName: string | null;
  /** The head coach is not the person who registered: the email says where the organizer's emails go. */
  headCoachElsewhere?: boolean;
  divisionName: string; tournamentName: string;
  contactEmail?: string;
  coachEmail?: string;
  registrationId?: string;
};

/**
 * The confirmations' "Organizer emails … go to …" sentence (Stage 1b, C1; the words Review and the
 * portal's head-coach editor use for the same setting): said only when the person who registered is
 * not the team's head coach, since the organizer's later emails go to the head coach.
 */
function updatesGoToHtml(p: RegistrationEmailParams): string {
  if (!p.headCoachElsewhere) return '';
  const who = p.coachName?.trim()
    ? `<strong>${escapeEmailHtml(p.coachName.trim())}</strong>, your team’s head coach`
    : 'your team’s head coach';
  return `<p>Organizer emails about this registration go to ${who}. You can change that on the tournament’s page in your Coaches Portal.</p>`;
}

export function registrationConfirmationHtml(p: RegistrationEmailParams & {
  /** False for "Not tracked here" (lib/tournament-payments-tracked): the email says nothing about payment. */
  paymentsTracked?: boolean;
}) {
  // Carry the registrationId so the portal link is a CLAIM link: a coach who clicks it
  // (signed out, or on another device) lands on /coaches/join with this exact registration
  // pre-selected and links it on sign-in — the email half of the claim-by-email gap fix.
  // A4.1: this used to hand-build the URL and hard-code `next` to the LIST even though it
  // holds the registrationId, so the one email every new coach opens was the only one that
  // didn't deep-link to the registration it's about. Now it uses the shared helper like its
  // 8 siblings (which resolves `next` to the record when an id is present).
  const joinUrl = p.coachEmail
    ? coachPortalUrl({ registrationId: p.registrationId, email: p.coachEmail, registered: true })
    : `${SITE_URL}/coaches/join`;
  const teamName = escapeEmailHtml(p.teamName);
  const divisionName = escapeEmailHtml(p.divisionName);
  const tournamentName = escapeEmailHtml(p.tournamentName);
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Registration Received!</h2>
    <p>Hi <strong>${greetingName(p.registrantName)}</strong>,</p>
    <p>Thanks for registering <strong>${teamName}</strong> for <strong>${tournamentName}</strong>! 🎉 We've got your entry for the <strong>${divisionName}</strong> division.</p>
    ${updatesGoToHtml(p)}
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">Registration Details</p>
      <p style="margin:0;line-height:1.8;color:${WARM_EMAIL.ink};">
        Team: <strong>${teamName}</strong><br>
        ${coachLineHtml(p.coachName)}
        Division: <strong>${divisionName}</strong><br>
        Tournament: <strong>${tournamentName}</strong>
      </p>
    </div>
    <p>Your registration is currently <strong>pending review</strong>.${p.paymentsTracked === false ? '' : ' If payment is required, the organizer will share payment instructions directly. FieldLogicHQ does not process online payments.'}</p>
    <div style="${warmPanelStyle('olive')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">Track your registration</p>
      <p style="margin:0 0 1rem;color:${WARM_EMAIL.ink};line-height:1.6;">Your free FieldLogicHQ Coaches Portal account is ready. Open it to track your registration status, see your game schedule once it's published, and receive announcements from the organizer.</p>
      ${warmEmailButton('Open your Coaches Portal', joinUrl)}
    </div>
  `);
}

export function manualTeamRegistrationHtml(p: {
  teamName: string; coachName: string; divisionName: string; tournamentName: string;
  paymentStatus: 'pending' | 'paid';
  /** False for "Not tracked here" (lib/tournament-payments-tracked): the email says nothing about payment. */
  paymentsTracked?: boolean;
  contactEmail?: string;
  registrationId?: string;
  coachEmail?: string;
}) {
  const paymentLine = p.paymentsTracked === false ? null
    : p.paymentStatus === 'paid'
      ? 'The organizer has marked your tournament fee as paid.'
      : 'If payment is required, the organizer will follow up with payment instructions.';
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Team Registered</h2>
    <p>Hi <strong>${greetingName(p.coachName)}</strong>,</p>
    <p><strong>${p.teamName}</strong> has been registered in the <strong>${p.divisionName}</strong> division for <strong>${p.tournamentName}</strong>.</p>
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">Registration Details</p>
      <p style="margin:0;line-height:1.8;color:${WARM_EMAIL.ink};">
        Team: <strong>${p.teamName}</strong><br>
        Coach: <strong>${p.coachName || 'Not provided'}</strong><br>
        Division: <strong>${p.divisionName}</strong><br>
        Tournament: <strong>${p.tournamentName}</strong>
      </p>
    </div>
    ${paymentLine ? `<p>${paymentLine}</p>` : ''}
    ${coachPortalFooter({ registrationId: p.registrationId, email: p.coachEmail })}
  `);
}

/**
 * THE INVITATION (the free tournament tier, B3 — owner 2026-10-16; /marketing's words). On an invite-only event the host
 * adds every team, and this email is how its coach learns of it and claims the team into a Coaches Portal: today's
 * "team added" email in invitation words — no "has been registered", no payment line, one button to the claim. A paid
 * event keeps `manualTeamRegistrationHtml`. Add team sends it; the record's "Resend the invitation" sends it again.
 * The subject is `INVITATION_EMAIL_WORDS.subject`. Every name is escaped: the host typed them.
 */
export function teamInvitationHtml(p: {
  teamName: string; coachName: string; divisionName: string; tournamentName: string;
  registrationId: string; coachEmail: string;
}) {
  const teamName = escapeEmailHtml(p.teamName);
  const divisionName = escapeEmailHtml(p.divisionName);
  const tournamentName = escapeEmailHtml(p.tournamentName);
  const claimUrl = coachPortalUrl({ registrationId: p.registrationId, email: p.coachEmail });
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">${INVITE.heading}</h2>
    <p>Hi <strong>${greetingName(p.coachName)}</strong>,</p>
    <p>${INVITE.body(`<strong>${tournamentName}</strong>`, `<strong>${teamName}</strong>`, `<strong>${divisionName}</strong>`)}</p>
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">${INVITE.detailsHeading}</p>
      <p style="margin:0;line-height:1.8;color:${WARM_EMAIL.ink};">
        Team: <strong>${teamName}</strong><br>
        ${coachLineHtml(p.coachName)}
        Division: <strong>${divisionName}</strong><br>
        Tournament: <strong>${tournamentName}</strong>
      </p>
    </div>
    <div style="${warmPanelStyle('olive')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">${INVITE.claimHeading}</p>
      <p style="margin:0 0 1rem;color:${WARM_EMAIL.ink};line-height:1.6;">${INVITE.claimBody}</p>
      ${warmEmailButton(INVITE.button, claimUrl)}
    </div>
  `);
}

export function adminNotificationHtml(p: {
  teamName: string;
  /** The entry's coach — left out when there is none. */
  coachName: string | null;
  /** "Contact": where the organizer's emails to this team go (the head coach's, else the registration email). */
  contactEmail: string;
  /** Set when someone other than the coach registered (Stage 1b): who pressed Submit. */
  registeredBy?: { name: string | null; email: string } | null;
  divisionName: string; tournamentName: string;
}) {
  const adminUrl = `${SITE_URL}/admin/registrations`;
  const email = escapeEmailHtml(p.contactEmail);
  const by = p.registeredBy;
  const byEmail = by ? escapeEmailHtml(by.email) : '';
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">📋 New Team Registration</h2>
    <p>A new team has registered for <strong>${escapeEmailHtml(p.tournamentName)}</strong>:</p>
    <div style="${warmPanelStyle('secondary', { margin: '1rem 0' })}">
      <p style="margin:0;line-height:1.8;color:${WARM_EMAIL.ink};">
        Team: <strong>${escapeEmailHtml(p.teamName)}</strong><br>
        ${coachLineHtml(p.coachName)}
        Division: <strong>${escapeEmailHtml(p.divisionName)}</strong><br>
        Contact: <a href="mailto:${email}" style="color:${WARM_EMAIL.olive};">${email}</a>
        ${by ? `<br>Registered by: ${by.name?.trim() ? `<strong>${escapeEmailHtml(by.name.trim())}</strong>, ` : ''}<a href="mailto:${byEmail}" style="color:${WARM_EMAIL.olive};">${byEmail}</a>` : ''}
      </p>
    </div>
    ${warmEmailButton('Review in Admin Panel', adminUrl)}
  `);
}

/** PostgREST numerics arrive as strings — coerce to a finite number (0 fallback). */
function feeNum(v: number | string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function feeMoney(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(amount);
}

function feeDueLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = dateOnly ? new Date(value + 'T00:00:00') : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

type AcceptanceFeeSchedule = {
  depositAmount: number | string | null;
  depositDueDate: string | null;
  totalFeeAmount: number | string | null;
  totalFeeDueDate: string | null;
};

/**
 * Build the "Amount due" line for the acceptance email — what a freshly-accepted (unpaid) team owes:
 * the deposit first (if there is one), else the full fee, with its due date. Division fee overrides
 * apply in division fee-mode. Returns undefined when there's no fee schedule (free event). Pure (no
 * payment state) — callers skip it for an already-paid team.
 */
export function acceptanceFeeLine(input: {
  feeMode: string | null;
  tournament: AcceptanceFeeSchedule | null;
  division: AcceptanceFeeSchedule | null;
}): string | undefined {
  const useDivision = input.feeMode === 'division' && feeNum(input.division?.totalFeeAmount) > 0;
  const src = useDivision ? input.division : input.tournament;
  if (!src) return undefined;
  const deposit = feeNum(src.depositAmount);
  const total = feeNum(src.totalFeeAmount);
  if (total <= 0 && deposit <= 0) return undefined;
  // Deposit phase: a partial deposit is owed first, with the full fee shown for context.
  if (deposit > 0 && deposit < total) {
    const due = feeDueLabel(src.depositDueDate);
    return `${feeMoney(deposit)} deposit${due ? ` due by ${due}` : ''} (${feeMoney(total)} total)`;
  }
  const owe = total > 0 ? total : deposit;
  const due = feeDueLabel(src.totalFeeDueDate ?? src.depositDueDate);
  return `${feeMoney(owe)}${due ? ` due by ${due}` : ''}`;
}

export function acceptanceHtml(p: {
  teamName: string; coachName: string; divisionName: string; tournamentName: string; teamId: string;
  contactEmail?: string;
  dashboardUrl?: string;
  coachEmail?: string;
  /** Organizer-authored "how to pay" text (from tournament settings). Shown verbatim when set. */
  paymentInstructions?: string;
  /** Pre-formatted "amount due" line (build with acceptanceFeeLine). Shown above the instructions. */
  feeLine?: string;
  /** False for "Not tracked here" (lib/tournament-payments-tracked): no Payment panel — no amount, no how-to-pay,
   *  no "if payment is required" — only the organizer contact, on its own line. */
  paymentsTracked?: boolean;
  /** Club Tier Stage 12a: the team's pay link while the club takes payments online. Absent → today's email exactly. */
  payUrl?: string | null;
}) {
  // Claim-aware portal link: carries the registration (teamId) so the coach lands on this team
  // (or creates an account and it links). dashboardUrl override kept for back-compat.
  const dashboardUrl = p.dashboardUrl ?? coachPortalUrl({ registrationId: p.teamId, email: p.coachEmail });
  const contact = p.contactEmail ?? ADMIN_EMAIL;
  const instructions = p.paymentInstructions?.trim();
  const paymentBody = instructions
    ? escapeHtml(instructions)
    : 'If payment is required, the tournament organizer will follow up with instructions for paying outside FieldLogicHQ.';
  // Online (copy §11): a line under the amount, the organizer's text under "Other ways to pay", and Pay now as the
  // primary button. Today's fallback sentence goes: it would be false beside a Pay button.
  const online = p.payUrl ? `
      <p style="margin:0 0 0.75rem;color:${WARM_EMAIL.ink};">${instructions ? 'Pay online by card, or pay another way below.' : 'Pay online by card.'}</p>
      ${instructions ? `<p style="${WARM_EMAIL_STYLE.panelLabel}">Other ways to pay</p><p style="margin:0 0 0.75rem;color:${WARM_EMAIL.ink};">${escapeHtml(instructions)}</p>` : ''}` : '';
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">🎉 Team Accepted!</h2>
    <p>Hi <strong>${greetingName(p.coachName)}</strong>,</p>
    <p>Great news! <strong>${p.teamName}</strong> has been accepted into the <strong>${p.divisionName}</strong> division for <strong>${p.tournamentName}</strong>.</p>
    ${p.paymentsTracked === false ? `
    <p style="margin:1.5rem 0;color:${WARM_EMAIL.secondary};font-size:0.85rem;">Questions? Contact <a href="mailto:${contact}" style="color:${WARM_EMAIL.olive};">${contact}</a>.</p>` : `
    <div style="${warmPanelStyle('secondary', { padding: '1.5rem' })}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">Payment</p>
      ${p.feeLine ? `<p style="margin:0 0 0.75rem;color:${WARM_EMAIL.ink};font-size:0.98rem;"><strong>Amount due:</strong> ${p.feeLine}</p>` : ''}
      ${p.payUrl ? online : `<p style="margin:0 0 0.75rem;color:${WARM_EMAIL.ink};">${paymentBody}</p>`}
      <p style="margin:1rem 0 0;color:${WARM_EMAIL.secondary};font-size:0.85rem;">Questions? Contact <a href="mailto:${contact}" style="color:${WARM_EMAIL.olive};">${contact}</a>.</p>
    </div>`}
    ${p.payUrl && p.paymentsTracked !== false ? warmEmailButton('Pay now', p.payUrl) : ''}
    ${warmEmailButton('View Your Registration Dashboard', dashboardUrl)}
  `);
}

export function waitlistConfirmationHtml(p: RegistrationEmailParams) {
  const teamName = escapeEmailHtml(p.teamName);
  const divisionName = escapeEmailHtml(p.divisionName);
  const tournamentName = escapeEmailHtml(p.tournamentName);
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">You're on the Waitlist</h2>
    <p>Hi <strong>${greetingName(p.registrantName)}</strong>,</p>
    <p>Thanks for registering <strong>${teamName}</strong> for the <strong>${divisionName}</strong> division of <strong>${tournamentName}</strong>.</p>
    ${updatesGoToHtml(p)}
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">Waitlist Status</p>
      <p style="margin:0;line-height:1.8;color:${WARM_EMAIL.ink};">
        Team: <strong>${teamName}</strong><br>
        ${coachLineHtml(p.coachName)}
        Division: <strong>${divisionName}</strong><br>
        Tournament: <strong>${tournamentName}</strong>
      </p>
    </div>
    <p>The <strong>${divisionName}</strong> division is currently full. Your team has been added to the waitlist and you will be notified by email if a spot becomes available.</p>
    ${coachPortalFooter({ registrationId: p.registrationId, email: p.coachEmail })}
  `);
}

export function rejectionHtml(p: {
  teamName: string; coachName: string; divisionName: string; tournamentName: string;
  contactEmail?: string;
}) {
  const contact = p.contactEmail ?? ADMIN_EMAIL;
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Registration Update</h2>
    <p>Hi <strong>${greetingName(p.coachName)}</strong>,</p>
    <p>Thank you for your interest in <strong>${p.tournamentName}</strong>. Unfortunately, we are unable to accommodate <strong>${p.teamName}</strong> in the <strong>${p.divisionName}</strong> division at this time.</p>
    <p>This may be due to division capacity or eligibility requirements. If you'd like to be considered for another division or a future event, reach out — many organizers run more than one tournament a season.</p>
    ${warmEmailButton('Contact the organizer', `mailto:${contact}`)}
  `);
}

export function paymentConfirmationHtml(p: {
  teamName: string; coachName: string; divisionName: string; tournamentName: string;
  contactEmail?: string;
  teamId?: string;
  coachEmail?: string;
}) {
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Payment Recorded</h2>
    <p>Hi <strong>${greetingName(p.coachName)}</strong>,</p>
    <p>The tournament organizer has recorded payment for <strong>${p.teamName}</strong>. Your registration for the <strong>${p.divisionName}</strong> division of <strong>${p.tournamentName}</strong> is now marked <strong>paid</strong>.</p>
    <p>Stay tuned for schedule announcements — good luck this season!</p>
    ${coachPortalFooter({ registrationId: p.teamId, email: p.coachEmail })}
  `);
}

/** "a scorekeeper" / "an administrator" — the invite mails said "as a administrator". */
function withArticle(noun: string): string {
  return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
}

function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Every string field of a builder's params, HTML-escaped; numbers pass through. For the builders
 * whose every field is family- or organizer-typed text — the house-league and tryout emails, which
 * a PUBLIC form triggers with names the submitter chose and sends to an address the submitter chose
 * (trust-plan defect 6 / Club Tier Readiness I01, 2026-09-25). Escape once at the top so no single
 * interpolation can be missed; `tests/unit/league-season-scope-guard.test.ts` pins every such
 * builder to it.
 */
function escapeEmailFields<T extends object>(p: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) out[k] = typeof v === 'string' ? escapeEmailHtml(v) : v;
  return out as T;
}

/**
 * Organizer announcement broadcast (Communications → email channel). Wraps the organizer's
 * plain-text title + body in the FieldLogicHQ shell with a contact line and a portal link, so a
 * coach gets a branded, actionable email instead of a raw, unstyled, link-less blob. The body is
 * ESCAPED (organizer-authored free text) then split into paragraphs — never injected as raw HTML.
 */
export function announcementHtml(p: {
  title: string;
  body: string;
  tournamentName: string;
  contactEmail?: string;
  /** Recipient address — pre-fills the portal claim link (generic tournaments list, no per-team id). */
  coachEmail?: string;
}) {
  const bodyHtml = escapeEmailHtml(p.body)
    .split('\n')
    .map(line => (line.trim() ? `<p style="margin:0 0 0.75rem;line-height:1.7;color:${WARM_EMAIL.ink};">${line}</p>` : ''))
    .join('');
  return wrap(`
    <p style="${WARM_EMAIL_STYLE.eyebrow}">Announcement &middot; ${escapeEmailHtml(p.tournamentName)}</p>
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.35rem;margin:0 0 1.25rem;">${escapeEmailHtml(p.title)}</h2>
    ${bodyHtml}
    ${p.contactEmail ? `<p style="color:${WARM_EMAIL.secondary};font-size:0.85rem;margin-top:1.5rem;">Questions? Contact <a href="mailto:${escapeEmailHtml(p.contactEmail)}" style="color:${WARM_EMAIL.olive};">${escapeEmailHtml(p.contactEmail)}</a></p>` : ''}
    ${coachPortalFooter({ email: p.coachEmail })}
  `);
}

export function paymentReminderHtml(p: {
  teamName: string;
  coachName: string;
  divisionName: string;
  tournamentName: string;
  amountDue: string;
  dueDate?: string | null;
  paymentInstructions: string;
  contactEmail?: string;
  registrationId?: string;
  coachEmail?: string;
  /** Club Tier Stage 12a: the team's pay link while the club takes payments online. Absent → today's email exactly. */
  payUrl?: string | null;
  /** Something is already paid: the button says "Pay the balance", else "Pay now". */
  paidSome?: boolean;
}) {
  const instructions = escapeEmailHtml(p.paymentInstructions)
    .split('\n')
    .map(line => line.trim() ? `<p style="margin:0 0 0.75rem;line-height:1.6;">${line}</p>` : '<br>')
    .join('');

  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Tournament Payment Reminder</h2>
    <p>Hi <strong>${greetingName(p.coachName)}</strong>,</p>
    <p>This is a friendly reminder that payment is still outstanding for <strong>${escapeEmailHtml(p.teamName)}</strong> in the <strong>${escapeEmailHtml(p.divisionName)}</strong> division of <strong>${escapeEmailHtml(p.tournamentName)}</strong>.</p>
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">Payment Details</p>
      <p style="margin:0;line-height:1.8;color:${WARM_EMAIL.ink};">
        Amount due: <strong>${escapeEmailHtml(p.amountDue)}</strong><br>
        ${p.dueDate ? `Due date: <strong>${escapeEmailHtml(p.dueDate)}</strong><br>` : ''}
        Team: <strong>${escapeEmailHtml(p.teamName)}</strong><br>
        Division: <strong>${escapeEmailHtml(p.divisionName)}</strong>
      </p>
    </div>
    ${p.payUrl ? warmEmailButton(p.paidSome ? 'Pay the balance' : 'Pay now', p.payUrl) : ''}
    <div style="color:${WARM_EMAIL.ink};">${instructions}</div>
    <p style="color:${WARM_EMAIL.secondary};font-size:0.86rem;">${p.payUrl
      ? 'Paid by another way already? Tell the organizer and they’ll update your record.'
      : 'FieldLogicHQ records payment status for the organizer but does not process tournament payments online.'}</p>
    ${coachPortalFooter({ registrationId: p.registrationId, email: p.coachEmail })}
  `);
}

export function basicCoachTeamWelcomeHtml(p: {
  teamName: string;
  coachName?: string | null;
  teamUrl: string;
}) {
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Your team home is ready</h2>
    <p>Hi <strong>${greetingName(p.coachName)}</strong>,</p>
    <p><strong>${escapeEmailHtml(p.teamName)}</strong> now has a free FieldLogicHQ team home.</p>
    <div style="${warmPanelStyle('olive')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">Start with the basics</p>
      <p style="margin:0;line-height:1.8;color:${WARM_EMAIL.ink};">
        Build your roster<br>
        Add practices and games<br>
        Track manual team fees<br>
        Send announcements to roster contacts
      </p>
    </div>
    ${warmEmailButton('Open Team Home', escapeEmailHtml(p.teamUrl))}
    <p style="color:${WARM_EMAIL.secondary};font-size:0.86rem;margin-top:1.5rem;">Advanced tools like lineups, attendance, documents, budget, and dues automation can be requested from your team home.</p>
  `);
}

/**
 * Welcome email sent once when a coach's Premium Coaches Portal workspace is first provisioned.
 * Confirms the upgrade, names what's now unlocked, and links into the portal. Naming canon: the
 * product is the "Coaches Portal"; the paid tier is "Premium Coaches Portal".
 *
 * `comp: true` is the Founding Season variant — the workspace is comped (no Stripe subscription),
 * so the closing line must NOT say "manage or cancel your subscription" (there is none). It mirrors
 * the org `founding_welcome` "free through the season, no card required" reassurance instead.
 */
export function teamWorkspaceWelcomeHtml(p: {
  teamName: string;
  coachName?: string | null;
  portalUrl: string;
  comp?: boolean;
}) {
  const closingLine = p.comp
    ? `<p style="color:${WARM_EMAIL.secondary};font-size:0.86rem;margin-top:1.5rem;">Your Premium Coaches Portal is <strong>free through ${FOUNDING_SEASON_END_LABEL}</strong> — no credit card, and nothing is charged before ${FOUNDING_SEASON_FIRST_CHARGE_LABEL}. We'll email you during the summer so you can choose a plan for your ${FOUNDING_SEASON_NEXT_YEAR_LABEL} season.</p>`
    : `<p style="color:${WARM_EMAIL.secondary};font-size:0.86rem;margin-top:1.5rem;">You can manage or cancel your subscription anytime from your portal billing settings.</p>`;
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Welcome to the Premium Coaches Portal 🎉</h2>
    <p>Hi <strong>${greetingName(p.coachName)}</strong>,</p>
    <p>Your <strong>Premium Coaches Portal</strong> is ready for <strong>${escapeEmailHtml(p.teamName)}</strong>, with the full season toolkit.</p>
    <div style="${warmPanelStyle('olive')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">What's included now</p>
      <p style="margin:0;line-height:1.8;color:${WARM_EMAIL.ink};">
        Player positions, attendance &amp; game-day lineups<br>
        Recurring events &amp; calendar sync<br>
        Dues schedules, reminders &amp; a season budget<br>
        Documents for waivers and team forms
      </p>
    </div>
    ${warmEmailButton('Open your Coaches Portal', escapeEmailHtml(p.portalUrl))}
    ${closingLine}
  `);
}

export function coachAccessReminderHtml(p: {
  teamName: string;
  coachName: string;
  tournamentName: string;
  joinUrl: string;
  loginUrl: string;
  /**
   * Set when the nudge comes from the dashboard's chat-adoption panel — the organizer is chasing
   * this coach specifically so they can reach the group chat, so the email says a room is waiting.
   * Off by default: the single-team resend-access flow uses the same template on events that may
   * have no chat at all, and must not promise one.
   */
  mentionsChat?: boolean;
}) {
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Your Registration Dashboard</h2>
    <p>Hi <strong>${greetingName(p.coachName)}</strong>,</p>
    <p>Here's your access link for <strong>${escapeEmailHtml(p.teamName)}</strong> in <strong>${escapeEmailHtml(p.tournamentName)}</strong>. Your dashboard shows your registration status, game schedule, and any announcements from the organizer.</p>
    ${p.mentionsChat ? `<p>The organizer has also opened a group chat for this event's coaches — you'll join it automatically once you're signed in.</p>` : ''}
    ${warmEmailButton('Create Account &amp; View Dashboard', escapeEmailHtml(p.joinUrl))}
    <p style="color:${WARM_EMAIL.secondary};font-size:0.85rem;">Already have an account? <a href="${escapeEmailHtml(p.loginUrl)}" style="color:${WARM_EMAIL.olive};">Sign in instead →</a></p>
    <p style="color:${WARM_EMAIL.secondary};font-size:0.82rem;">If you did not register for this tournament, you can ignore this email.</p>
  `);
}

export function tournamentResultsFinalizedHtml(p: {
  tournamentName: string;
  coachName: string;
  resultsUrl: string;
  scheduleUrl: string;
  teamsUrl: string;
  fieldLogicUrl: string;
  /** Express-interest destination ("keep this team going"). NOT a checkout link (no billing param). */
  teamUrl?: string;
  contactEmail?: string;
  /** Coach-portal claim footer (Phase 5m) — carries the registration + claim-key email. */
  registrationId?: string;
  coachEmail?: string;
}) {
  // The afterglow earned-ask: ONE express-interest bridge ("keep this team going"), framed as
  // interest — not a purchase (the pressure ladder allows a single post-event ask). The
  // checkout-flavored billing link was removed (Phase 5m / J5-059); teamUrl now points at the
  // repaired express-interest destination.
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">That's a wrap — final results are in 🎉</h2>
    <p>Hi <strong>${greetingName(p.coachName)}</strong>,</p>
    <p>The organizer has finalized results for <strong>${escapeEmailHtml(p.tournamentName)}</strong>. See where your team landed, then relive the weekend from the public tournament site.</p>
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">See how it finished</p>
      <p style="margin:0;line-height:1.9;">
        <a href="${escapeEmailHtml(p.resultsUrl)}" style="color:${WARM_EMAIL.olive};font-weight:700;">View final standings</a><br>
        <a href="${escapeEmailHtml(p.scheduleUrl)}" style="color:${WARM_EMAIL.olive};">View scores &amp; schedule</a><br>
        <a href="${escapeEmailHtml(p.teamsUrl)}" style="color:${WARM_EMAIL.olive};">View teams</a>
      </p>
    </div>
    <p style="color:${WARM_EMAIL.secondary};font-size:0.88rem;">Thanks for being part of the tournament.</p>
    ${p.teamUrl ? `
      <div style="${warmPanelStyle('olive')}">
        <p style="${WARM_EMAIL_STYLE.panelLabel}">Keep this team going</p>
        <p style="margin:0 0 1rem;color:${WARM_EMAIL.ink};line-height:1.6;">Your Coaches Portal stays free between tournaments — roster, schedule, and team comms in one place. Tell us which tools you'd want next; no commitment.</p>
        ${warmEmailButton('Explore the Coaches Portal', escapeEmailHtml(p.teamUrl))}
      </div>
    ` : ''}
    <p style="color:${WARM_EMAIL.secondary};font-size:0.82rem;line-height:1.55;margin-top:1.5rem;">
      Running your own tournament? <a href="${escapeEmailHtml(p.fieldLogicUrl)}" style="color:${WARM_EMAIL.olive};">See how FieldLogicHQ helps organizers manage registration, schedules, results, and post-event reporting.</a>
    </p>
    ${coachPortalFooter({ registrationId: p.registrationId, email: p.coachEmail })}
  `);
}

/**
 * Game-day reminder (free-tier Coaches Phase 5m). TRANSACTIONAL — sent via
 * `sendMarketingEmail({ skipOptOutCheck: true })` so the organizer's marketing opt-out can't
 * suppress a coach knowing when/where to show up. Scheduled at schedule-publish time via Resend
 * `scheduled_at` for the evening before the team's first game; cancelled if the team is withdrawn
 * or rejected. The opponent is honesty-gated by the caller (only passed when matchups are public).
 */
export function gameDayReminderHtml(p: {
  teamName: string;
  coachName: string;
  tournamentName: string;
  firstGameLabel: string;
  location?: string | null;
  opponentName?: string | null;
  portalUrl: string;
  contactEmail?: string;
  /** False for "Not tracked here" (lib/tournament-payments-tracked): the gate confirms the roster only. */
  paymentsTracked?: boolean;
}) {
  const detailRows = [
    `When: <strong>${escapeEmailHtml(p.firstGameLabel)}</strong>`,
    p.opponentName ? `Opponent: <strong>${escapeEmailHtml(p.opponentName)}</strong>` : null,
    p.location ? `Where: <strong>${escapeEmailHtml(p.location)}</strong>` : null,
  ].filter(Boolean).join('<br>');
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">${escapeEmailHtml(p.teamName)} plays soon</h2>
    <p>Hi <strong>${greetingName(p.coachName)}</strong>,</p>
    <p>Your first game at <strong>${escapeEmailHtml(p.tournamentName)}</strong> is coming up. Here's what to know.</p>
    <div style="${warmPanelStyle('olive')}">
      <p style="margin:0;line-height:1.9;color:${WARM_EMAIL.ink};">${detailRows}</p>
    </div>
    <p style="color:${WARM_EMAIL.ink};font-size:0.9rem;line-height:1.6;">Plan to check in with the organizer when you arrive — they'll confirm your roster${p.paymentsTracked === false ? '' : ' and payment'} at the gate.</p>
    ${warmEmailButton('Open your team in the Coaches Portal', escapeEmailHtml(p.portalUrl))}
    ${p.contactEmail ? `<p style="color:${WARM_EMAIL.secondary};font-size:0.82rem;">Questions? <a href="mailto:${escapeEmailHtml(p.contactEmail)}" style="color:${WARM_EMAIL.olive};">${escapeEmailHtml(p.contactEmail)}</a></p>` : ''}
  `);
}

// ── House League registration emails ──────────────────────────────────────────

/**
 * A family notice (a registration email, the tryout receipt) wearing the club (The public face, warm: S3b): the band, a
 * footnote that says why it was sent and where a reply goes, the platform line. With no `face` it is exactly the plain
 * `wrap()` document the builder always produced. `reason` completes "Sent by {club} because …" and is raw text.
 */
function familyNotice(content: string, face: FamilyMailFace | null | undefined, reason: string): string {
  if (!face) return wrap(content);
  return warmEmailDocument(
    `${content}
${accountNoticeFootnoteHtml({ clubName: face.club.name, reason, replyLine: face.replyLine })}`,
    face.club,
  );
}

/** One child in the sign-up email (Club Tier 9b-1, Part 6): what happened to them and what they pay. */
export type SignupMailChild = PlacedChild;


/** A house-league family can pay this email's amount by card (Club Tier Stage 12b): the pay link, and whether the family
 *  pays the processing fee (then the email says it is shown before paying). Absent = the club is not taking card
 *  payments, and the email is today's, word for word (A6). */
export interface LeagueMailPay { payUrl: string; familyPaysFee: boolean }

/** The how-to-pay block (copy §10): the total, the club's own words (escaped), "payable separately". While the club
 *  takes card payments (12b copy §3): Pay now, "Pay online by card", the fee line, and the club's words as the OTHER way
 *  to pay — "payable separately" goes, since beside a Pay button it would read as "not here". */
function payBlock(toPay: number, howToPay: string | null, clubName: string, online?: LeagueMailPay | null): string {
  if (toPay <= 0) return '';
  if (online) {
    const M = LEAGUE_PAY_WORDS.mail;
    return `<div style="${warmPanelStyle('olive')}">
      <p style="margin:0;color:${WARM_EMAIL.ink};"><strong>To pay: ${dollarsLine(toPay)}.</strong></p>
      <p style="margin:0.4rem 0 0;color:${WARM_EMAIL.ink};">${howToPay ? M.payLine : M.payLineOnly}</p>
      ${online.familyPaysFee ? `<p style="margin:0.4rem 0 0;color:${WARM_EMAIL.secondary};font-size:0.9rem;">${M.feeShown}</p>` : ''}
      ${howToPay ? `<p style="margin:0.75rem 0 0;color:${WARM_EMAIL.ink};"><strong>${M.otherWaysLabel}</strong></p>
      <p style="margin:0.25rem 0 0;color:${WARM_EMAIL.ink};">${escapeEmailHtml(howToPay)}</p>` : ''}
    </div>
    ${warmEmailButton(M.payButton, online.payUrl)}`;
  }
  const how = howToPay
    ? `<p style="margin:0.4rem 0 0;color:${WARM_EMAIL.ink};">${escapeEmailHtml(howToPay)}</p>`
    : `<p style="margin:0.4rem 0 0;color:${WARM_EMAIL.ink};">${escapeEmailHtml(clubName)} will tell you how to pay.</p>`;
  return `<div style="${warmPanelStyle('olive')}">
      <p style="margin:0;color:${WARM_EMAIL.ink};"><strong>To pay: ${dollarsLine(toPay)}.</strong></p>
      ${how}
      <p style="margin:0.4rem 0 0;color:${WARM_EMAIL.secondary};font-size:0.9rem;">Payable separately to ${escapeEmailHtml(clubName)}.</p>
    </div>`;
}

/** The reference and the way back to the status page (copy §10 `mail.ref`, `mail.status`). */
function refBlock(reference: string, statusPath: string): string {
  const url = `${SITE_URL}${statusPath}`;
  return `<p style="margin:0.75rem 0 0;">Reference: <strong style="${DATA_FACE}">${escapeEmailHtml(reference)}</strong></p>
    <p style="margin:0.25rem 0 0;color:${WARM_EMAIL.secondary};font-size:0.9rem;">Check your registration any time: <a href="${escapeEmailHtml(url)}" style="color:${WARM_EMAIL.olive};">${escapeEmailHtml(url)}</a>. You’ll need this reference and your email.</p>`;
}

/**
 * ONE EMAIL PER SIGN-UP (Club Tier 9b-1, Part 6; owner Q5, 9b·12; copy §10.1–§10.4): every child with their outcome and price,
 * the total for the accepted ones, the club's how-to-pay words once a child is accepted, the reference and the way back.
 * "Accepted", never "Approved". A received child's price says "once accepted"; a waitlisted child pays nothing unless a spot
 * opens. All family-typed fields are escaped.
 */
export function leagueSignupHtml(input: {
  guardianFirstName: string;
  seasonName: string;
  clubName: string;
  reference: string;
  /** The club's own how-to-pay words (shown only once a child is accepted). */
  howToPay: string | null;
  /** The family's status page, as a path on the platform ("/{org}/league/{season}/status"). */
  statusPath: string;
  children: SignupMailChild[];
  face?: FamilyMailFace | null;
  /** 12b: Pay now by card, while the club takes card payments. */
  online?: LeagueMailPay | null;
}) {
  const p = escapeEmailFields(input);
  const kids = input.children;
  const first = (c: SignupMailChild) => escapeEmailHtml(c.firstName);
  const full = (c: SignupMailChild) => escapeEmailHtml(`${c.firstName} ${c.lastName}`);
  const accepted = kids.filter(c => c.status === 'active');
  const received = kids.filter(c => c.status === 'pending_review');
  const waiting = kids.filter(c => c.status === 'waitlisted');
  const toPay = signupToPay(kids);
  const free = kids.every(c => (c.fee ?? 0) === 0);

  let lead: string;
  if (waiting.length === kids.length) {
    lead = kids.length === 1
      ? `<strong>${full(kids[0])}</strong> is on the waitlist for <strong>${escapeEmailHtml(kids[0].divisionName)}</strong>, ${ordinal(kids[0].waitlistPosition ?? 1)} in line. The division is full right now.`
      : `${escapeEmailHtml(nameList(kids.map(c => c.firstName)))} are on the waitlist for <strong>${p.seasonName}</strong>.`;
  } else if (received.length === kids.length) {
    lead = 'The club will review it and email you as each child is accepted. Nothing is due until then.';
  } else if (accepted.length === kids.length) {
    lead = kids.length === 1
      ? `<strong>${possessive(full(kids[0]))}</strong> registration for <strong>${p.seasonName}</strong> is accepted.`
      : `Your sign-up for <strong>${p.seasonName}</strong> is accepted for ${escapeEmailHtml(nameList(kids.map(c => c.firstName)))}.`;
  } else {
    const done = accepted.length
      ? `${escapeEmailHtml(nameList(accepted.map(c => c.firstName)))} ${accepted.length === 1 ? 'is' : 'are'} accepted.`
      : `${escapeEmailHtml(nameList(received.map(c => c.firstName)))} ${received.length === 1 ? 'is' : 'are'} received and waiting for the club’s review.`;
    const wait = waiting.map(c => `${first(c)} is on the waitlist for ${escapeEmailHtml(c.divisionName)}, ${ordinal(c.waitlistPosition ?? 1)} in line.`).join(' ');
    lead = `${done} ${wait}`;
  }

  const rows = kids.map(c => {
    const price = c.fee == null ? '' : ` · ${dollarsLine(c.fee)}`;
    const tail = c.status === 'waitlisted' ? ` · ${ordinal(c.waitlistPosition ?? 1)} on the waitlist`
      : c.status === 'pending_review' ? `${price}${c.fee ? ' once accepted' : ''}`
      : price;
    return `<strong>${full(c)}</strong> · ${escapeEmailHtml(c.divisionName)}${tail}`;
  }).join('<br>');
  const panelLabel = waiting.length === kids.length ? 'Waitlist' : 'Registration details';

  const waitNote = waiting.length && waiting.length < kids.length
    ? `<p>${escapeEmailHtml(nameList(waiting.map(c => c.firstName)))} ${waiting.length === 1 ? 'pays' : 'pay'} nothing unless a spot opens. We’ll email you if one does.</p>` : '';
  const allWaitNote = waiting.length === kids.length ? '<p>You pay nothing unless a spot opens. We’ll email you if one does.</p>' : '';
  const freeNote = accepted.length && free ? '<p>There is nothing to pay: this season is free.</p>' : '';

  return familyNotice(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">${escapeEmailHtml(signupHeadline(kids))}</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p>${lead}</p>
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">${panelLabel}</p>
      <p style="margin:0;line-height:1.8;color:${WARM_EMAIL.ink};">${rows}</p>
    </div>
    ${accepted.length && !free ? payBlock(toPay, input.howToPay, input.clubName, input.online) : ''}
    ${freeNote}${waitNote}${allWaitNote}
    ${refBlock(input.reference, input.statusPath)}
    ${accepted.length ? `<p>We look forward to seeing ${escapeEmailHtml(nameList(accepted.map(c => c.firstName)))} on the field.</p>` : ''}
  `, input.face, kids.length === 1 ? `${input.children[0].firstName} was signed up for ${input.seasonName}` : `your children were signed up for ${input.seasonName}`);
}

// ── House League admin-triggered status-change emails ─────────────────────────

/** The price block on a single-child acceptance (staff Approve, a promotion): "To pay" + the club's words, or "free". */
function acceptedPay(fee: number | null, howToPay: string | null, clubName: string, online?: LeagueMailPay | null): string {
  if (fee == null) return '';
  if (fee === 0) return '<p>There is nothing to pay: this season is free.</p>';
  return payBlock(fee, howToPay, clubName, online);
}

export function leagueAdminApprovedHtml(input: {
  playerFirstName: string;
  playerLastName: string;
  guardianFirstName: string;
  seasonName: string;
  divisionName: string;
  registrationId: string;
  /** The sign-up's reference, when the registration has one (else its own id's first eight characters). */
  reference?: string | null;
  /** The price this registration recorded at sign-up (9b-1: the acceptance email now states it). */
  fee?: number | null;
  howToPay?: string | null;
  clubName?: string;
  /** The family's status page path. */
  statusPath?: string;
  contactEmail?: string;
  /** The club this notice wears (The public face, warm: S3b): its band, a footnote and the reply line. Omitted, the plain card. */
  face?: FamilyMailFace | null;
  /** 12b: Pay now by card, while the club takes card payments. */
  online?: LeagueMailPay | null;
}) {
  const p = escapeEmailFields(input);
  const ref = input.reference ?? registrationReference(input.registrationId);
  return familyNotice(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">${p.playerFirstName} is accepted</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p><strong>${possessive(`${p.playerFirstName} ${p.playerLastName}`)}</strong> registration for <strong>${p.seasonName}</strong> — <strong>${p.divisionName}</strong> is accepted.</p>
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">Registration details</p>
      <p style="margin:0;line-height:1.8;color:${WARM_EMAIL.ink};">
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong><br>
        Season: <strong>${p.seasonName}</strong><br>
        Division: <strong>${p.divisionName}</strong>${input.fee != null ? `<br>
        Price: <strong>${dollarsLine(input.fee)}</strong>` : ''}
      </p>
    </div>
    ${acceptedPay(input.fee ?? null, input.howToPay ?? null, input.clubName ?? (input.face?.club.name ?? 'the club'), input.online)}
    ${input.statusPath ? refBlock(ref, input.statusPath) : `<p>Reference: <strong style="${DATA_FACE}">${escapeEmailHtml(ref)}</strong></p>`}
    <p>We look forward to seeing ${p.playerFirstName} on the field.</p>
  `, input.face, `${input.playerFirstName} was signed up for ${input.seasonName}`);
}

export function leagueAdminWaitlistedHtml(input: {
  playerFirstName: string;
  playerLastName: string;
  guardianFirstName: string;
  seasonName: string;
  divisionName: string;
  registrationId: string;
  reference?: string | null;
  waitlistPosition: number;
  statusPath?: string;
  contactEmail?: string;
  /** The club this notice wears (The public face, warm: S3b): its band, a footnote and the reply line. Omitted, the plain card. */
  face?: FamilyMailFace | null;
}) {
  const p = escapeEmailFields(input);
  const ref = input.reference ?? registrationReference(input.registrationId);
  return familyNotice(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Added to the waitlist</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p><strong>${p.playerFirstName} ${p.playerLastName}</strong> is on the waitlist for <strong>${p.divisionName}</strong>, ${ordinal(input.waitlistPosition)} in line.</p>
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">Waitlist</p>
      <p style="margin:0;line-height:1.8;color:${WARM_EMAIL.ink};">
        <strong>${p.playerFirstName} ${p.playerLastName}</strong> · ${p.divisionName} · ${ordinal(input.waitlistPosition)} on the waitlist
      </p>
    </div>
    <p>You pay nothing unless a spot opens. We’ll email you if one does.</p>
    ${input.statusPath ? refBlock(ref, input.statusPath) : `<p>Reference: <strong style="${DATA_FACE}">${escapeEmailHtml(ref)}</strong></p>`}
  `, input.face, `${input.playerFirstName} was signed up for ${input.seasonName}`);
}

export function leagueWaitlistPromotedHtml(input: {
  playerFirstName: string;
  playerLastName: string;
  guardianFirstName: string;
  seasonName: string;
  divisionName: string;
  registrationId: string;
  /** The sign-up's reference, when the registration has one (else its own id's first eight characters). */
  reference?: string | null;
  /** The price this registration recorded at sign-up (Q4: the promotion email carries the pay block). */
  fee?: number | null;
  howToPay?: string | null;
  clubName?: string;
  statusPath?: string;
  contactEmail?: string;
  /** The club this notice wears (The public face, warm: S3b): its band, a footnote and the reply line. Omitted, the plain card. */
  face?: FamilyMailFace | null;
  /** 12b: Pay now by card, while the club takes card payments. */
  online?: LeagueMailPay | null;
}) {
  const p = escapeEmailFields(input);
  const ref = input.reference ?? registrationReference(input.registrationId);
  return familyNotice(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">A spot opened for ${p.playerFirstName}</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p><strong>${p.playerFirstName} ${p.playerLastName}</strong> has moved off the waitlist and is accepted into <strong>${p.divisionName}</strong>. Welcome.</p>
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">Registration details</p>
      <p style="margin:0;line-height:1.8;color:${WARM_EMAIL.ink};">
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong><br>
        Season: <strong>${p.seasonName}</strong><br>
        Division: <strong>${p.divisionName}</strong>${input.fee != null ? `<br>
        Price: <strong>${dollarsLine(input.fee)}</strong>` : ''}
      </p>
    </div>
    ${acceptedPay(input.fee ?? null, input.howToPay ?? null, input.clubName ?? (input.face?.club.name ?? 'the club'), input.online)}
    ${input.statusPath ? refBlock(ref, input.statusPath) : `<p>Reference: <strong style="${DATA_FACE}">${escapeEmailHtml(ref)}</strong></p>`}
    <p>We look forward to seeing ${p.playerFirstName} on the field.</p>
  `, input.face, `${input.playerFirstName} was signed up for ${input.seasonName}`);
}

export function leagueRegistrationDeclinedHtml(input: {
  playerFirstName: string;
  playerLastName: string;
  guardianFirstName: string;
  seasonName: string;
  divisionName: string;
  registrationId: string;
  contactEmail?: string;
  /** The club this notice wears (The public face, warm: S3b): its band, a footnote and the reply line. Omitted, the plain card. */
  face?: FamilyMailFace | null;
  /** The registrar's note to the family (9b-2 copy `mail.declined.note`), verbatim in its own paragraph. */
  note?: string | null;
  /** What happened to money the family paid (9b-2 copy §15.1): a refund, or the club keeping it with its reason. */
  money?: EndedMoneyLine | null;
}) {
  const p = escapeEmailFields(input);
  return familyNotice(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Registration update</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p>We’re sorry: <strong>${possessive(`${p.playerFirstName} ${p.playerLastName}`)}</strong> registration for <strong>${p.seasonName}</strong> — <strong>${p.divisionName}</strong> was not accepted.</p>
    ${noteAndMoney(input.note ?? null, input.money ?? null)}
    <p>${pleaseContactLine(input.face, p.contactEmail)}</p>
  `, input.face, `${input.playerFirstName} was registered for ${input.seasonName}`);
}

/** What happened to money on an ended house-league registration, for the family's email (9b-2 copy §15). */
export type EndedMoneyLine =
  | { answer: 'refunded'; amount: number; day: string; method: string | null }
  | { answer: 'kept'; amount: number; reason: string }
  /** 12c words §4: a refund to the card rides as the one refund block — the lead, the club's reason, the block and what the
   *  club keeps of the rest, built by the caller (lib/online-refund-email.ts) and already escaped. */
  | { answer: 'card'; html: string }
  /** 12c Part 6 (words §3.3 `endMail.clearBack` / `clearKept`): ended while a bank debit cleared — what happens if it clears. */
  | { answer: 'clearBack'; total: number; back: number }
  | { answer: 'clearKept'; base: number; reason: string; club: string };

/** Who a house-league family email sends the family to: the club's own address when it has a public contact (or the caller
 *  passed one), otherwise the club by name — never the platform's inbox (S3b, copy item 9); with no club at all the old
 *  line stands. `contactEmail` arrives escaped. */
function familyContact(face: FamilyMailFace | null | undefined, contactEmail: string | undefined) {
  const club = face ? escapeEmailHtml(face.club.name) : null;
  const contact = contactEmail ?? (face?.contact ? escapeEmailHtml(face.contact) : club ? null : ADMIN_EMAIL);
  return { club, contact };
}

/** The declined and withdrawn emails' last line. */
function pleaseContactLine(face: FamilyMailFace | null | undefined, contactEmail: string | undefined): string {
  const { club, contact } = familyContact(face, contactEmail);
  return contact
    ? `Please contact ${club ? `${club} at ` : ''}<a href="mailto:${contact}" style="color:${WARM_EMAIL.olive};">${contact}</a> for more information.`
    : `Please contact ${club} for more information.`;
}

/** The released email's last line (copy `mail.released.contact`). */
function releasedContactLine(face: FamilyMailFace | null | undefined, contactEmail: string | undefined): string {
  const { club, contact } = familyContact(face, contactEmail);
  return contact
    ? `If you think this is a mistake, contact ${club ? `${club} at ` : ''}<a href="mailto:${contact}" style="color:${WARM_EMAIL.olive};">${contact}</a>.`
    : `If you think this is a mistake, contact ${club}.`;
}

/** The registrar's note, then the money sentence — each only when it applies, both escaped (copy §15.1). */
function noteAndMoney(note: string | null, money: EndedMoneyLine | null): string {
  const out: string[] = [];
  if (note && note.trim()) out.push(`<p>${escapeEmailHtml(note.trim()).replace(/\n/g, '<br>')}</p>`);
  if (money?.answer === 'refunded') {
    // 12c (F3): the day is the refund's, so the sentence says only that — "We refunded $150.00 on Oct 26 (Cheque)." — never
    // "the $X you paid on {refund day}", which dated the payment wrong and is false for a part refund.
    out.push(`<p>We refunded ${dollarsLine(money.amount)} on ${formatStoredDate(money.day)}${escapeEmailHtml(methodInBrackets(money.method))}.</p>`);
  } else if (money?.answer === 'card') {
    out.push(money.html);
  } else if (money?.answer === 'kept') {
    out.push(`<p>The club is keeping the ${dollarsLine(money.amount)} you paid. The reason: ${escapeEmailHtml(money.reason)}.</p>`);
  } else if (money?.answer === 'clearBack') {
    // A bank account's refund time is the one the refund block prints (Stripe's, plan §0k), never typed here.
    out.push(`<p>Your ${dollarsLine(money.total)} bank debit is still clearing. If it clears, we’ll send ${dollarsLine(money.back)} back to the same account. ${escapeEmailHtml(REFUND_BLOCK_WORDS.arrives(true))}</p>`);
  } else if (money?.answer === 'clearKept') {
    out.push(`<p>Your bank debit is still clearing. If it clears, ${escapeEmailHtml(money.club)} is keeping the ${dollarsLine(money.base)}. The reason: ${escapeEmailHtml(money.reason)}.</p>`);
  }
  return out.join('\n    ');
}

/** A withdrawal that moved money (Club Tier 9b-2, owner 2026-10-25, copy §18.2): sent only when a refund was recorded
 *  or the club kept the fee — a withdrawal with no money stays silent, as before. */
export function leagueRegistrationWithdrawnHtml(input: {
  playerFirstName: string;
  playerLastName: string;
  guardianFirstName: string;
  seasonName: string;
  divisionName: string;
  money: EndedMoneyLine;
  contactEmail?: string;
  face?: FamilyMailFace | null;
}) {
  const p = escapeEmailFields(input);
  return familyNotice(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Registration update</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p><strong>${possessive(`${p.playerFirstName} ${p.playerLastName}`)}</strong> registration for <strong>${p.seasonName}</strong> — <strong>${p.divisionName}</strong> has been withdrawn.</p>
    ${noteAndMoney(null, input.money)}
    <p>${pleaseContactLine(input.face, p.contactEmail)}</p>
  `, input.face, `${input.playerFirstName} was registered for ${input.seasonName}`);
}

/** The club released an unpaid (or part-paid) spot (Club Tier 9b-2, copy §15.2). */
export function leagueSpotReleasedHtml(input: {
  playerFirstName: string;
  playerLastName: string;
  guardianFirstName: string;
  seasonName: string;
  divisionName: string;
  /** The price fixed on the registration; with nothing received, the email says it was not received. */
  fee: number | null;
  note?: string | null;
  money?: EndedMoneyLine | null;
  contactEmail?: string;
  face?: FamilyMailFace | null;
}) {
  const p = escapeEmailFields(input);
  const unpaid = !input.money && (input.fee ?? 0) > 0 ? `<p>The ${dollarsLine(input.fee!)} fee was not received.</p>` : '';
  return familyNotice(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Spot released</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p>The club has released <strong>${possessive(`${p.playerFirstName} ${p.playerLastName}`)}</strong> spot in <strong>${p.divisionName}</strong> for <strong>${p.seasonName}</strong>. ${p.playerFirstName} is no longer registered.</p>
    ${unpaid}
    ${noteAndMoney(input.note ?? null, input.money ?? null)}
    <p>${releasedContactLine(input.face, p.contactEmail)}</p>
  `, input.face, `${input.playerFirstName} was signed up for ${input.seasonName}`);
}

// ── House League teams (Club Tier 9c, copy §9) ────────────────────────────────

/** One child's team in a placement email: "Nora Test: Cardinals, coach Pat Volunteer" (copy §9.1 mail.placed.line). */
export interface PlacedTeamLine { child: string; team: string; coaches: string[] }

/** "Questions? Contact {club} at {email}." (copy §9: the 9b-1 contact line), or nothing when the club has no public contact. */
function teamsContactLine(clubName: string, contactEmail: string | null | undefined): string {
  if (!contactEmail) return '';
  const contact = escapeEmailHtml(contactEmail);
  return `<p style="color:${WARM_EMAIL.secondary};font-size:0.9rem;margin-top:1.25rem;">Questions? Contact ${escapeEmailHtml(clubName)} at <a href="mailto:${contact}" style="color:${WARM_EMAIL.olive};">${contact}</a>.</p>`;
}

/**
 * THE PLACEMENT EMAIL (Club Tier 9c, copy §9.1): one per family per division published, every child of theirs in it with
 * their team and coach. A SERVICE notice (ruling 9c·4): sent through `sendFamilyServiceBatch`, so it reaches a family who
 * unsubscribed from club news and carries no unsubscribe link. A late placement is the same email with one line.
 */
export function leagueTeamsPlacedHtml(input: {
  guardianFirstName: string;
  seasonName: string;
  divisionName: string;
  clubName: string;
  lines: readonly PlacedTeamLine[];
  /** The family's status page, opened for their sign-up. */
  statusUrl: string;
  contactEmail?: string | null;
  face?: FamilyMailFace | null;
}) {
  const p = escapeEmailFields(input);
  const coachClause = (names: readonly string[]) => names.length === 0
    ? 'coach to be announced'
    : `${names.length === 1 ? 'coach' : 'coaches'} ${escapeEmailHtml(joinWithAnd(names))}`;
  const rows = input.lines.map(l =>
    `<li style="margin:0 0 0.35rem;"><strong>${escapeEmailHtml(l.child)}</strong>: ${escapeEmailHtml(l.team)}, ${coachClause(l.coaches)}</li>`).join('');
  const withCoach = input.lines.filter(l => l.coaches.length > 0);
  const teams = new Set(withCoach.map(l => l.team));
  const next = withCoach.length === 0 ? ''
    : `<p>${teams.size > 1 ? 'Each coach will be in touch about getting started.' : 'The coach will be in touch about getting started.'}</p>`;
  return familyNotice(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">The teams are set</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p>The ${p.divisionName} teams for ${p.seasonName} are set.</p>
    <ul style="margin:0.5rem 0 1rem;padding-left:1.2rem;color:${WARM_EMAIL.ink};">${rows}</ul>
    ${next}
    ${warmEmailButton('See your registration', input.statusUrl)}
    ${teamsContactLine(input.clubName, input.contactEmail)}
  `, input.face, `your family is registered for ${input.seasonName}`);
}

/** Moved after publishing (Club Tier 9c, copy §9.2): the held move's one email. A service notice, as the placement email. */
export function leagueTeamMovedHtml(input: {
  guardianFirstName: string;
  childName: string;
  seasonName: string;
  divisionName: string;
  clubName: string;
  fromTeam: string;
  toTeam: string;
  coaches: readonly string[];
  statusUrl: string;
  contactEmail?: string | null;
  face?: FamilyMailFace | null;
}) {
  const p = escapeEmailFields(input);
  const first = input.childName.split(' ')[0] ?? input.childName;
  const coach = input.coaches.length === 0
    ? 'Coach to be announced.'
    : `${input.coaches.length === 1 ? 'Coach' : 'Coaches'}: ${escapeEmailHtml(joinWithAnd(input.coaches))}`;
  return familyNotice(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">A new team for ${escapeEmailHtml(first)}</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p>${p.childName} has moved from ${p.fromTeam} to ${p.toTeam} in ${p.divisionName}.</p>
    <p>${coach}</p>
    ${warmEmailButton('See your registration', input.statusUrl)}
    ${teamsContactLine(input.clubName, input.contactEmail)}
  `, input.face, `${first} is registered for ${input.seasonName}`);
}

/**
 * The house-league coach invite (Club Tier 9c, copy §9.3): the club's rep coach invite's pattern (`clubCoachInviteHtml`) —
 * the button, the 7-day foot, "you can safely ignore this email" — for a team page, never the Coaches Portal.
 */
export function leagueCoachInviteHtml(input: {
  clubName: string;
  teamName: string;
  seasonName: string;
  divisionName: string;
  playerCount: number;
  invitedEmail: string;
  inviteUrl: string;
}) {
  const p = escapeEmailFields(input);
  const club = p.clubName;
  const team = p.teamName;
  const count = `${input.playerCount} ${input.playerCount === 1 ? 'player' : 'players'}`;
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">${club} added you as a coach of ${team}</h2>
    <p>Your team page lists your ${count} in ${p.divisionName} and how to reach their families. The season’s schedule is on ${escapeEmailHtml(possessive(input.clubName))} site.</p>
    ${warmEmailButton('Accept and open your team', input.inviteUrl)}
    <p style="color:${WARM_EMAIL.secondary};font-size:0.82rem;">This link works for 7 days and signs in with ${p.invitedEmail}. If you don’t have a FieldLogicHQ account, you’ll set one up first. If you weren’t expecting this, you can safely ignore this email.</p>
  `);
}

/** The coach invite's subject (copy §9.3 mail.coach.subject). */
export function leagueCoachInviteSubject(p: { teamName: string; seasonName: string }): string {
  return `You’re coaching ${p.teamName} — ${p.seasonName}`;
}

/* `leagueBroadcastHtml` lived here until 2026-08-18. The season broadcast now goes through
   `lib/family-email.ts` like every other bulk family announcement, so it renders in the shared
   family envelope — which is what gives it the sender identification and the unsubscribe link
   it never had. Deleted rather than kept "in case": a second family-email template with no
   compliance footer is precisely the thing that made this gap possible. */

// ── Rep Teams tryout registration email ──────────────────────────────────────

export function tryoutRegistrationConfirmationHtml(input: {
  guardianFirstName: string;
  playerFirstName: string;
  playerLastName: string;
  teamName: string;
  yearName: string;
  registrationId: string;
  contactEmail?: string;
  /** The club this notice wears (The public face, warm: S3b): its band, a footnote and the reply line. Omitted, the plain card. */
  face?: FamilyMailFace | null;
}) {
  const p = escapeEmailFields(input);
  const ref = registrationReference(p.registrationId);
  return familyNotice(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Tryout Application Received</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p>We've received <strong>${possessive(`${p.playerFirstName} ${p.playerLastName}`)}</strong> tryout application for the <strong>${p.teamName}</strong> <strong>${p.yearName}</strong> program.</p>
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">Application Details</p>
      <p style="margin:0;line-height:1.8;color:${WARM_EMAIL.ink};">
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong><br>
        Program: <strong>${p.teamName} — ${p.yearName}</strong><br>
        Reference: <strong style="${DATA_FACE}">#${ref}</strong>
      </p>
    </div>
    <p>Our coaching staff will review all applications and be in touch. No further action is required at this time.</p>
  `, input.face, `${input.playerFirstName} applied for a tryout with ${input.teamName} ${input.yearName}`);
}


// Every account holder gets this one (the forgot-password page and support's reset from the platform admin
// both send it), so it never words the reader as staff and has no greeting: it goes to an address, not a person.
// The warm envelope and words ruled 2026-10-20 (The first look, U5). ⚠ "1 hour" is Supabase's email-link expiry
// (3600 s on dev and production, checked 2026-10-20): if that setting changes, change this sentence with it.
export function platformPasswordResetHtml(resetLink: string) {
  return warmEmailDocument([
    warmEmailHeading('Reset your password'),
    warmEmailParagraph('We got a request to reset the password for your FieldLogicHQ account.'),
    warmEmailParagraph('Use the button to choose a new one. The link works for 1 hour.'),
    warmEmailButton('Reset my password', resetLink),
    warmEmailSmall('If you didn’t ask for this, ignore this email. Your password won’t change.'),
  ].join('\n'));
}

// The confirmation email (The first look, Ask 8 2026-10-19, U6 2026-10-20). `firstName` arrives escaped. It names the
// next step (lib/verification-next-step.ts), never a typed team or organization. ⚠ "1 hour" is the same Supabase
// email-link expiry as the reset email's (owner call 2, 2026-10-20).
export function signupVerificationHtml(p: {
  verifyUrl: string;
  firstName?: string;
  nextStep: VerificationNextStep;
}) {
  return warmEmailDocument([
    warmEmailHeading('Confirm your email'),
    warmEmailParagraph(p.firstName ? `Hi ${p.firstName}, welcome to FieldLogicHQ.` : 'Welcome to FieldLogicHQ.'),
    warmEmailParagraph(`Confirm your email to finish your account. ${VERIFICATION_NEXT_STEP[p.nextStep]}`),
    warmEmailButton('Confirm my email', p.verifyUrl),
    warmEmailSmall('The link works for 1 hour.'),
    warmEmailSmall('If you didn’t create this account, you can ignore this email.'),
  ].join('\n'));
}

export function schedulePublishedHtml(p: {
  tournamentName: string;
  coachName: string;
  divisions: string[];
  scheduleUrl: string;
  contactEmail?: string;
  registrationId?: string;
  coachEmail?: string;
}) {
  const divisionList = p.divisions.map(d => `<li style="margin-bottom:0.25rem;">${d}</li>`).join('');
  // Published schedules always show real team names (mig 129).
  const nameNote = 'Your team name appears on the public schedule.';
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Your Schedule is Live!</h2>
    <p>Hi <strong>${greetingName(p.coachName)}</strong>,</p>
    <p>The schedule for <strong>${p.tournamentName}</strong> has been published. You can now view game times, dates, and locations on the public tournament page.</p>
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">Published Divisions</p>
      <ul style="margin:0;padding-left:1.25rem;line-height:1.8;color:${WARM_EMAIL.ink};">${divisionList}</ul>
    </div>
    <p style="color:${WARM_EMAIL.secondary};font-size:0.88rem;">${nameNote}</p>
    ${warmEmailButton('View Schedule', p.scheduleUrl)}
    ${coachPortalFooter({ registrationId: p.registrationId, email: p.coachEmail })}
  `);
}

export function billingRetentionWarningHtml(p: {
  orgName: string;
  records: { displayName: string; recordType: string; retentionUntil: string }[];
  retentionUrl: string;
  daysUntilExpiry: number;
  isPendingPurge?: boolean;
}) {
  const rows = p.records.map(r => `
    <li style="margin-bottom:0.5rem;">
      <strong>${r.displayName}</strong>
      <span style="color:${WARM_EMAIL.secondary};">(${r.recordType}, retained until ${r.retentionUntil})</span>
    </li>
  `).join('');

  const title = p.isPendingPurge ? 'Retention window expired' : 'Retention window ending soon';
  const body = p.isPendingPurge
    ? `The retained data below has reached the end of its retention window and is now pending purge. Contact FieldLogicHQ support if you need more time or want to restore access.`
    : `The retained data below is scheduled to leave the restore window in about ${p.daysUntilExpiry} day${p.daysUntilExpiry === 1 ? '' : 's'}.`;

  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">${title}</h2>
    <p>Hi,</p>
    <p>${body}</p>
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">${p.orgName}</p>
      <ul style="margin:0;padding-left:1.25rem;color:${WARM_EMAIL.ink};">${rows}</ul>
    </div>
    ${warmEmailButton('Review Subscription', p.retentionUrl)}
  `);
}

export function trialEndingHtml(p: {
  orgName: string;
  planLabel: string;
  trialEndDate: string;
  billingUrl: string;
}) {
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.3rem;font-weight:700;margin:0 0 1rem;">Your trial ends soon</h2>
    <p style="margin:0 0 1rem;">Your FieldLogicHQ <strong>${p.planLabel}</strong> trial for <strong>${p.orgName}</strong> ends on <strong>${p.trialEndDate}</strong>.</p>
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">What happens next</p>
      <p style="margin:0;line-height:1.75;color:${WARM_EMAIL.ink};">
        Your payment method on file will be charged automatically when the trial expires.<br>
        No action is needed if you'd like to continue.
      </p>
    </div>
    <p style="color:${WARM_EMAIL.ink};margin:0 0 1.5rem;">To update your payment method or review your plan before the trial ends, visit your billing settings.</p>
    ${warmEmailButton('Manage Billing', p.billingUrl)}
  `);
}

export function planDowngradedHtml(p: {
  orgName: string;
  fromPlanLabel: string;
  toPlanLabel: string;
  retainedTournaments: number;
  retentionUntil?: string;
  billingUrl: string;
}) {
  const retainedNote = p.retainedTournaments > 0 && p.retentionUntil
    ? `<p style="margin:0;line-height:1.75;color:${WARM_EMAIL.ink};">${p.retainedTournaments} tournament${p.retainedTournaments === 1 ? '' : 's'} that exceed the ${p.toPlanLabel} limit have been archived and retained until <strong>${p.retentionUntil}</strong>. They will be restored if you upgrade again before that date.</p>`
    : `<p style="margin:0;line-height:1.75;color:${WARM_EMAIL.ink};">Your account is active on the ${p.toPlanLabel} plan.</p>`;

  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.3rem;font-weight:700;margin:0 0 1rem;">Plan updated</h2>
    <p style="margin:0 0 1rem;">Your <strong>${p.orgName}</strong> subscription has been changed from <strong>${p.fromPlanLabel}</strong> to <strong>${p.toPlanLabel}</strong>.</p>
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">What changed</p>
      ${retainedNote}
    </div>
    ${warmEmailButton('Manage Billing', p.billingUrl)}
  `);
}

export function teamWorkspaceCancelledHtml(p: {
  workspaceName: string;
  resubscribeUrl: string;
  /** Display date the team is kept until — "September 24, 2027". */
  retentionUntil: string;
}) {
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.3rem;font-weight:700;margin:0 0 1rem;">Coaches Portal cancelled</h2>
    <p style="margin:0 0 1rem;">Your <strong>${escapeHtml(p.workspaceName)}</strong> Coaches Portal subscription has been cancelled. Premium tools are now inactive.</p>
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">Your data</p>
      <p style="margin:0;line-height:1.75;color:${WARM_EMAIL.ink};">Your team is kept until <strong>${p.retentionUntil}</strong>. Resubscribe before then and everything comes back as you left it. Basic tournament records remain available in Coaches Portal.</p>
    </div>
    ${warmEmailButton('Resubscribe', p.resubscribeUrl)}
  `);
}

export function welcomeBackHtml(p: {
  orgName: string;
  planLabel: string;
  restoredTournaments: number;
  dashboardUrl: string;
}) {
  const restoredNote = p.restoredTournaments > 0
    ? `<p style="margin:0;line-height:1.75;color:${WARM_EMAIL.ink};">We've restored <strong>${p.restoredTournaments} tournament${p.restoredTournaments === 1 ? '' : 's'}</strong> to your account — everything is exactly as you left it.</p>`
    : `<p style="margin:0;line-height:1.75;color:${WARM_EMAIL.ink};">Your account is active and ready to go.</p>`;

  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.3rem;font-weight:700;margin:0 0 1rem;">Welcome back!</h2>
    <p style="margin:0 0 1rem;">Your <strong>${p.planLabel}</strong> subscription for <strong>${p.orgName}</strong> is active again.</p>
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">Your account</p>
      ${restoredNote}
    </div>
    ${warmEmailButton('Go to Dashboard', p.dashboardUrl)}
  `);
}

export function orgClosedHtml(p: {
  orgName: string;
  planLabel: string;
  contactEmail?: string;
}) {
  const contact = p.contactEmail ?? ADMIN_EMAIL;
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.3rem;font-weight:700;margin:0 0 1rem;">Account closed</h2>
    <p style="margin:0 0 1rem;">Your FieldLogicHQ account for <strong>${p.orgName}</strong> (${p.planLabel}) has been permanently closed.</p>
    <div style="${warmPanelStyle('secondary')}">
      <p style="margin:0;line-height:1.75;color:${WARM_EMAIL.ink};">The tournaments, registrations, and other data tied to this organization have been removed. This can't be undone.</p>
    </div>
    <p style="color:${WARM_EMAIL.ink};margin:0;">If you have questions or this was unexpected, contact us at <a href="mailto:${contact}" style="color:${WARM_EMAIL.olive};">${contact}</a>.</p>
  `);
}

export function orgInviteHtml(p: {
  orgName: string;
  roleLabel: string;
  inviteUrl: string;
  ctaLabel: string;
  /** A volunteer's job, said to them (`VOLUNTEER_EMAIL_NOTE`, Stage 6) — a fixed sentence, never user text. */
  note?: string | null;
  /** Who sent it (J10-010, Club Tier Stage 1) — named when known, so the invitee knows who is asking. */
  inviterName?: string | null;
}) {
  const note = p.note ? `<p>${p.note}</p>` : '';
  // org.name and the sender's name are editable by other people → escape before interpolating.
  const org = escapeEmailHtml(p.orgName);
  const who = p.inviterName ? `<strong>${escapeEmailHtml(p.inviterName)}</strong> invited you` : "You've been invited";
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">You're invited</h2>
    <p>${who} to join <strong>${org}</strong> on <strong>FieldLogicHQ</strong> as ${withArticle(p.roleLabel)}.</p>
    ${note}
    <p>Click below to accept your invitation and set up your account.</p>
    ${warmEmailButton(p.ctaLabel, p.inviteUrl)}
    <p style="color:${WARM_EMAIL.secondary};font-size:0.82rem;">This link expires in 24 hours. If you weren't expecting this invitation, you can safely ignore this email.</p>
  `);
}

export function assistantCoachInviteHtml(p: {
  teamName: string;
  invitedByName: string | null;
  inviteUrl: string;
  /**
   * Which of the four kinds the invite offers (pass 2 of the staff access plan, 2026-09-11). The
   * heading, the line and the promise all come from `STAFF_KIND_COPY`, so the email says what
   * that kind's preset actually grants — the helper's used to be the only one that did, and it
   * existed because telling a parent volunteer they were getting "the team's chat, attendance and
   * lineups" would have been false on all three counts.
   */
  staffKind: StaffKind;
  /** A standalone Premium workspace — where the manager's promise includes the team's tournaments. */
  isTeamWorkspace?: boolean;
}) {
  // The inviter's name and the team's name are typed by people → escaped before interpolating
  // (found in Club Tier Stage 2: this template was the one invite email that did not).
  const by = p.invitedByName ? `<strong>${escapeEmailHtml(p.invitedByName)}</strong>` : 'The head coach';
  const copy = staffKindCopyFor(p.staffKind, { isTeamWorkspace: p.isTeamWorkspace ?? false });
  const heading = copy.emailHeading;
  const line = `${by} invited you ${copy.inviteVerb} <strong>${escapeEmailHtml(p.teamName)}</strong> as <strong>${copy.asA}</strong> on <strong>FieldLogicHQ</strong>.`;
  const what = copy.emailWhat;
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">${heading}</h2>
    <p>${line}</p>
    <p>${what}</p>
    ${warmEmailButton('Accept invite', p.inviteUrl)}
    <p style="color:${WARM_EMAIL.secondary};font-size:0.82rem;">This link expires in 7 days. If you weren't expecting this, you can safely ignore this email.</p>
  `);
}

/**
 * THE CLUB'S "INVITE A COACH" EMAIL (Club Tier Stage 2, D10 + S2-02; specimen 6, frame 1).
 *
 * The portal's staff invite knows four helper kinds and, with no inviter name, says "The head
 * coach invited you". Neither fits a club naming a team's coach: the words must say WHO (the club,
 * and the person who pressed Send, with their role) and WHAT SEAT. So the club's door has its own
 * template, and it NEVER falls back to "The head coach" — without an inviter name it names the club
 * alone.
 *
 * ⚠ COPY IS /marketing's (drafted 2026-09-28 to the drawing, marked for review in the plan's call
 * list). The subject lines live in `clubCoachInviteSubject` beside this so the two cannot drift.
 */
export function clubCoachInviteSubject(p: { clubName: string; teamName: string; coachRole: 'head_coach' | 'assistant_coach' }): string {
  return p.coachRole === 'head_coach'
    ? `You’re the head coach of ${p.teamName} at ${p.clubName}`
    : `You’re invited to help coach ${p.teamName} at ${p.clubName}`;
}

export function clubCoachInviteHtml(p: {
  clubName: string;
  teamName: string;
  coachRole: 'head_coach' | 'assistant_coach';
  invitedByName: string | null;
  /** The inviter's club role, in words ("the club’s owner", "a club admin"); null to leave it out. */
  invitedByRoleWords: string | null;
  inviteUrl: string;
}) {
  const club = escapeEmailHtml(p.clubName);
  const team = escapeEmailHtml(p.teamName);
  const isHead = p.coachRole === 'head_coach';
  const heading = isHead
    ? `${club} named you head coach of ${team}`
    : `${club} invited you to help coach ${team}`;
  const inviter = p.invitedByName
    ? `<strong>${escapeEmailHtml(p.invitedByName)}</strong>${p.invitedByRoleWords ? `, ${escapeEmailHtml(p.invitedByRoleWords)},` : ''} invited you`
    : `<strong>${club}</strong> invited you`;
  const line = isHead
    ? `${inviter} on <strong>FieldLogicHQ</strong>. You’ll run the team in its Coaches Portal: roster, schedule, practices, tryouts, money and your own staff. The club manages the team’s seasons.`
    : `${inviter} on <strong>FieldLogicHQ</strong> as <strong>an assistant coach</strong>. ${STAFF_KIND_COPY.assistant.emailWhat}`;
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">${heading}</h2>
    <p>${line}</p>
    ${warmEmailButton('Accept and set up your account', p.inviteUrl)}
    <p style="color:${WARM_EMAIL.secondary};font-size:0.82rem;">This link works for 7 days. If you weren't expecting this, you can safely ignore this email.</p>
  `);
}

export function orgMemberAddedHtml(p: {
  orgName: string;
  roleLabel: string;
  signInUrl: string;
  ctaLabel: string;
  /** A volunteer's job, said to them (`VOLUNTEER_EMAIL_NOTE`, Stage 6) — a fixed sentence, never user text. */
  note?: string | null;
}) {
  const note = p.note ?? 'No action is required — just sign in to get started.';
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">You've been added to ${p.orgName}</h2>
    <p>You now have access to <strong>${p.orgName}</strong> on <strong>FieldLogicHQ</strong> as ${withArticle(p.roleLabel)}.</p>
    <p>${note}</p>
    ${warmEmailButton(p.ctaLabel, p.signInUrl)}
    <p style="color:${WARM_EMAIL.secondary};font-size:0.82rem;">If you weren't expecting this, you can safely ignore this email.</p>
  `);
}

/**
 * member_suspended — sent when an org owner suspends a member (J10-019). Transactional
 * account-state notice (not marketing): tells the person their access was suspended, by which org,
 * and what to do. Pairs with the /auth/suspended page they hit on next sign-in.
 */
export function memberSuspendedHtml(p: {
  orgName: string;
}) {
  // org.name is admin-editable → escape before interpolating into the (different) recipient's HTML
  // body, as memberRemovedHtml below already did.
  const org = escapeEmailHtml(p.orgName);
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Your access to ${org} was suspended</h2>
    <p>An administrator at <strong>${org}</strong> has suspended your access on <strong>FieldLogicHQ</strong>.</p>
    <p>You won't be able to sign in to this workspace until your access is restored. If you think this was a mistake, please contact an administrator at ${org} directly.</p>
    <p style="color:${WARM_EMAIL.secondary};font-size:0.82rem;">This message is about your access to ${org} only; any other organizations or workspaces on your account are unaffected.</p>
  `);
}

/**
 * member_access_changed — sent when an owner or admin changes a member's role or the programs they
 * can open (J10-020, Club Tier Stage 1). `changes` are the sentences `describeAccessChange` builds
 * (lib/member-access.ts), already worded for the member; each is escaped here.
 */
export function memberAccessChangedHtml(p: {
  orgName: string;
  changes: string[];
  signInUrl: string;
}) {
  const org = escapeEmailHtml(p.orgName);
  const items = p.changes
    .map(line => `<li style="margin:0 0 0.4rem;">${escapeEmailHtml(line)}</li>`)
    .join('');
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Your access to ${org} changed</h2>
    <p>An administrator at <strong>${org}</strong> changed what you can do on <strong>FieldLogicHQ</strong>:</p>
    <ul style="margin:0.75rem 0 1rem;padding-left:1.25rem;">${items}</ul>
    ${warmEmailButton('Sign In', p.signInUrl)}
    <p style="color:${WARM_EMAIL.secondary};font-size:0.82rem;">If you think this was a mistake, please contact an administrator at ${org} directly. This message is about your access to ${org} only.</p>
  `);
}

export function memberRemovedHtml(p: {
  orgName: string;
}) {
  // org.name is admin-editable → escape before interpolating into the (different) recipient's HTML body.
  const org = escapeEmailHtml(p.orgName);
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Your access to ${org} was removed</h2>
    <p>An administrator at <strong>${org}</strong> has removed your access on <strong>FieldLogicHQ</strong>.</p>
    <p>You no longer have access to this workspace. If you think this was a mistake, please contact an administrator at ${org} directly — they can re-invite you.</p>
    <p style="color:${WARM_EMAIL.secondary};font-size:0.82rem;">This message is about your access to ${org} only. Your account and any other organizations, teams, or coaching portals you belong to are unaffected.</p>
  `);
}

export function orgDeletionRequestHtml(p: {
  orgName: string;
  orgSlug: string;
  orgId: string;
  ownerEmail: string;
  planLabel: string;
  reason: string;
  requestedAt: string;
}) {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:0.4rem 1rem 0.4rem 0;color:${WARM_EMAIL.secondary};white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:0.4rem 0;color:${WARM_EMAIL.ink};">${value}</td></tr>`;
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.4rem;margin:0 0 1rem;">Organization Deletion Request</h2>
    <div style="${warmPanelStyle('secondary', { margin: '1.25rem 0' })}">
      <table style="border-collapse:collapse;width:100%;font-size:0.88rem;line-height:1.5;">
        ${row('Organization', `<strong>${p.orgName}</strong>`)}
        ${row('Slug', p.orgSlug)}
        ${row('Org ID', `<span style="${DATA_FACE}font-size:0.8rem;">${p.orgId}</span>`)}
        ${row('Owner', p.ownerEmail)}
        ${row('Plan', p.planLabel)}
        ${row('Reason', p.reason || '<em>No reason provided</em>')}
        ${row('Requested at', p.requestedAt)}
      </table>
    </div>
  `);
}

// ── Founding Season email templates ──────────────────────────────────────────

/**
 * tournament_plus_welcome — fires ~1 day AFTER the user selects Tournament Plus on
 * the onboarding plan-select screen (not at signup). Transactional welcome — bypasses
 * the opt-out check, so the unsubscribe footer is NOT auto-injected; a courtesy
 * unsubscribe block is included inline.
 *
 * Intentionally has NO "set up your first tournament" CTA — the setup wizard already
 * runs immediately after the user picks the plan. The CTA points to the admin dashboard.
 */
export function tournamentPlusWelcomeHtml(p: {
  orgName: string;
  firstName?: string;
  dashboardUrl: string;
  unsubscribeUrl?: string;
}) {
  const greeting = p.firstName ? `Hi ${p.firstName},` : 'Hi there,';
  const unsubscribeBlock = p.unsubscribeUrl
    ? `<div style="margin-top:2rem;padding-top:1.25rem;border-top:1px solid ${WARM_EMAIL.cardEdge};">
        <p style="margin:0;color:${WARM_EMAIL.secondary};font-size:0.72rem;line-height:1.55;">
          You're receiving this because you signed up for FieldLogicHQ.&nbsp;
          <a href="${p.unsubscribeUrl}" style="color:${WARM_EMAIL.olive};text-decoration:underline;">Unsubscribe</a>
          &nbsp;·&nbsp; FieldLogicHQ · Canada
        </p>
      </div>`
    : '';

  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.35rem;font-weight:700;margin:0 0 1.25rem;letter-spacing:-0.01em;">
      You're on Tournament Plus.
    </h2>
    <p style="margin:0 0 1rem;">${greeting}</p>
    <p style="margin:0 0 1.25rem;line-height:1.7;">
      <strong>${p.orgName}</strong> is now running <strong>Tournament Plus</strong>, free as a
      founding organization through <strong>${FOUNDING_SEASON_END_LABEL}</strong>. No credit card required,
      and nothing is charged before ${FOUNDING_SEASON_FIRST_CHARGE_LABEL}.
    </p>

    <div style="${warmPanelStyle('olive')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">What's included now</p>
      <ul style="margin:0;padding-left:1.25rem;line-height:1.9;color:${WARM_EMAIL.ink};">
        <li>Public registration, fees, and payment tracking</li>
        <li>Check-in and unlimited volunteers</li>
        <li>Unlimited tournaments and the round-robin generator</li>
        <li>The playoff generator, for single and double elimination</li>
        <li>Custom registration fields and exports</li>
        <li>Full branding control — no acquisition banner, just a quiet “Built on FieldLogicHQ” footer credit</li>
        <li>Sealed archives, cloning, and targeted announcements</li>
      </ul>
    </div>

    ${warmEmailButton('Open your dashboard', p.dashboardUrl)}

    <p style="margin:1.75rem 0 0;line-height:1.7;color:${WARM_EMAIL.secondary};">
      If anything doesn't work the way you'd expect, reply to this email. We read everything.
    </p>
    <p style="margin:0.75rem 0 0;color:${WARM_EMAIL.secondary};">— The FieldLogicHQ team</p>
    ${unsubscribeBlock}
  `);
}

/**
 * tournament_plus_upsell — fires ~1 week AFTER the user chooses the free Tournament
 * plan during onboarding. Marketing email (respects opt-out); the unsubscribe footer
 * is auto-injected by email-sender.ts, so none is included inline here.
 *
 * Promotes that Tournament Plus is free through the Founding Season and lists what it adds, led by what left the
 * free plan with the invite-only build (registration, fees and payments, check-in, volunteers; R9). CTA → upgrade.
 */
export function tournamentPlusUpsellHtml(p: {
  orgName: string;
  firstName?: string;
  upgradeUrl: string;
}) {
  const greeting = p.firstName ? `Hi ${p.firstName},` : 'Hi there,';

  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.35rem;font-weight:700;margin:0 0 1.25rem;letter-spacing:-0.01em;">
      Tournament Plus is free this season.
    </h2>
    <p style="margin:0 0 1rem;">${greeting}</p>
    <p style="margin:0 0 1.25rem;line-height:1.7;">
      <strong>${p.orgName}</strong> is on the free Tournament plan — that's a great place to start.
      But as a founding organization you can run <strong>Tournament Plus free through
      ${FOUNDING_SEASON_END_LABEL}</strong> (normally ${formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/month), and it adds the tools that save the most time.
    </p>

    <div style="${warmPanelStyle('olive')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">What Tournament Plus adds</p>
      <ul style="margin:0;padding-left:1.25rem;line-height:1.9;color:${WARM_EMAIL.ink};">
        <li>Public registration — teams register on your site, and you approve, waitlist, or decline</li>
        <li>Fees and payment tracking, with payment reminders</li>
        <li>Check-in and unlimited volunteers on game day</li>
        <li>Unlimited tournaments — the free plan runs one at a time</li>
        <li>The round-robin and playoff generators</li>
        <li>Full branding control — no acquisition banner, just a quiet “Built on FieldLogicHQ” footer credit</li>
      </ul>
    </div>

    ${warmEmailButton('Switch to Tournament Plus — free', p.upgradeUrl)}

    <p style="margin:1.75rem 0 0;line-height:1.7;color:${WARM_EMAIL.secondary};">
      Staying on the free plan is totally fine too — the free season is yours if you upgrade by ${FOUNDING_SEASON_SIGNUP_CLOSE_LABEL}.
    </p>
    <p style="margin:0.75rem 0 0;color:${WARM_EMAIL.secondary};">— The FieldLogicHQ team</p>
  `);
}


export function cancellationConfirmationHtml(p: {
  orgName: string;
  planLabel: string;
  retentionUntil: string;
  retainedTournaments: number;
  resubscribeUrl: string;
}) {
  const retainedNote = p.retainedTournaments > 0
    ? `Your ${p.retainedTournaments} tournament${p.retainedTournaments === 1 ? '' : 's'} have been archived and your data is retained until <strong>${p.retentionUntil}</strong>. If you resubscribe before that date, everything will be restored.`
    : `Your account data is retained until <strong>${p.retentionUntil}</strong>. If you resubscribe before that date, everything will be restored.`;

  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.3rem;font-weight:700;margin:0 0 1rem;">Subscription cancelled</h2>
    <p style="margin:0 0 1rem;">Your <strong>${p.planLabel}</strong> subscription for <strong>${p.orgName}</strong> has been cancelled. Your organization is now inactive.</p>
    <div style="${warmPanelStyle('secondary')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">Your data</p>
      <p style="margin:0;line-height:1.75;color:${WARM_EMAIL.ink};">${retainedNote}</p>
    </div>
    ${warmEmailButton('Resubscribe', p.resubscribeUrl)}
  `);
}

/**
 * An allocation reminder to a team's money people (Club Tier Stage 3a, Ask 4). The words are
 * `reminderEmailLines` (lib/club-money-words.ts, /marketing's words, settled 2026-10-07); every line is plain text and
 * escaped here. The reply goes to the club person who sent it — the send sets `replyTo`.
 */
export function allocationReminderHtml(words: { intro: string; items: string[]; total: string; outro: string }): string {
  return wrap(`
      <p style="margin:0 0 0.75rem;">${escapeHtml(words.intro)}</p>
      <ul style="margin:0 0 0.75rem;padding-left:1.25rem;">${words.items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
      <p style="margin:0 0 0.75rem;font-weight:700;">${escapeHtml(words.total)}</p>
      <p style="margin:0;">${escapeHtml(words.outro)}</p>`);
}
