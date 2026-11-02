/**
 * WHICH EMAILS A COACH GETS FOR A TOURNAMENT REGISTRATION (Signed-in family accounts Stage 2, Part 4; ask 1 = A).
 *
 * A new coach used to get two emails seconds apart: "Registration Received" (which said their portal account "is ready"
 * while it waited for its email) and "Confirm your FieldLogicHQ email". Now `/api/register` makes the waiting account
 * itself, after the organizer has the entry, and the coach gets ONE email: the registration, with the confirm button in
 * it. Pure, so every case is tested (tests/unit/registration-one-email.test.ts); the route only carries it out.
 *
 * The invariant this file exists for: a confirm link that was made is never dropped. Without it the coach's portal
 * cannot open, so whatever the organizer's switch or a customised template says, the link goes out in some email.
 *
 * The email's panel and subject live here too, not in lib/email.ts, so the tests render them (the node test runner
 * cannot load lib/email.ts); its two registration builders call them.
 */
import { WARM_EMAIL, WARM_EMAIL_STYLE, warmPanelStyle, warmEmailButton, warmEmailSmall } from './email-envelope-warm';

/** What `/api/register`'s account step found. `none`: nobody asked it (signed in, or verification is off). */
export type RegistrationAccountOutcome = 'none' | 'created' | 'exists' | 'failed';

/** One email to the coach: the registration (with the confirm panel, or the signed-in "Open your Coaches Portal" one),
 *  or the plain confirm email the other sign-up doors send. */
export type CoachRegistrationEmail = 'registration' | 'registration_with_confirm' | 'confirm_only';

export function planCoachRegistrationEmails(p: {
  /** The organizer's "confirmation" coach email is on (Settings → Notifications & Contact). */
  confirmationOn: boolean;
  /** A platform admin customised the registration email's words: they have no place for the confirm panel. */
  customised: boolean;
  /** The account step made a confirm link (a new waiting account, or a fresh one for an account still waiting). */
  confirmLink: boolean;
}): CoachRegistrationEmail[] {
  if (!p.confirmationOn) return p.confirmLink ? ['confirm_only'] : [];
  if (p.customised) return p.confirmLink ? ['registration', 'confirm_only'] : ['registration'];
  return [p.confirmLink ? 'registration_with_confirm' : 'registration'];
}

/** The registration emails' subject. "We’ve got your registration" is the journeys page's end-state wording (drawing
 *  tab 1); the waitlist email keeps its own. */
export function registrationEmailSubject(teamName: string, waitlist: boolean): string {
  return waitlist ? `Waitlist Confirmation - ${teamName}` : `We’ve got your registration · ${teamName}`;
}

/**
 * The registration emails' portal panel (drawing tabs 1–2). With `confirmUrl` (a new coach registering signed out on the
 * live site, whose account waits for its email) it is the one thing left to do: confirm the email, which opens the
 * portal. That is the old second email folded in. Without it, "Open your Coaches Portal" at `joinUrl`. Neither says the
 * account "is ready": for a new coach it is not until they confirm, and a coach with an account already knows.
 * ⚠ "1 hour" is Supabase's email-link expiry, as in signupVerificationHtml: change both together.
 */
export function registrationPortalPanelHtml(p: { confirmUrl?: string; joinUrl: string }): string {
  if (p.confirmUrl) {
    return `
    <div style="${warmPanelStyle('olive')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">Confirm your email to open your Coaches Portal</p>
      <p style="margin:0 0 1rem;color:${WARM_EMAIL.ink};line-height:1.6;">Your free Coaches Portal tracks this registration, shows your game schedule once it’s published, and brings you the organizer’s announcements.</p>
      ${warmEmailButton('Confirm my email', p.confirmUrl)}
      <p style="${WARM_EMAIL_STYLE.small}margin-bottom:0;">The button works for 1 hour. After that it opens sign-in, where you can send yourself a new link.</p>
    </div>
    ${warmEmailSmall('If you didn’t register this team, you can ignore this email.')}`;
  }
  return `
    <div style="${warmPanelStyle('olive')}">
      <p style="${WARM_EMAIL_STYLE.panelLabel}">Track your registration</p>
      <p style="margin:0 0 1rem;color:${WARM_EMAIL.ink};line-height:1.6;">Open your Coaches Portal to track your registration status, see your game schedule once it's published, and receive announcements from the organizer.</p>
      ${warmEmailButton('Open your Coaches Portal', p.joinUrl)}
    </div>`;
}
