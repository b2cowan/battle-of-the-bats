import { warmEmailDocument, warmEmailHeading, warmEmailParagraph, warmEmailSmall } from './email-envelope-warm';
import { FIELDLOGICHQ_CONTACT_EMAIL } from './fieldlogichq-contact';
import { formatInOrgZone } from './timezone';
import { formatTime, possessive } from './utils';

/**
 * THE TWO-STEP EMAILS' WORDS (Board Ready · two-step sign-in, Parts 3 and 4): the shared "no link" sentence, the date
 * words, and Part 4's five builders. Words only (no sending, no database), so tests read them directly; sending is
 * lib/two-step-emails.ts. Every one is a security / account fact (CASL: non-commercial): no offer, and no link.
 */

export const NO_LINK = 'This email has no link on purpose. If an email about two-step sign-in asks you to click a link to fix something, it isn’t from us.';

export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** "November 19 at 3:10 p.m." in the club's zone (the house clock, lib/utils.ts formatTime). */
export function whenWords(iso: string): string {
  const day = formatInOrgZone(iso, { month: 'long', day: 'numeric' });
  const clock = formatInOrgZone(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${day} at ${formatTime(clock)}`;
}

// ── Part 4: the two grace emails (drawings tab 8; ask 7) ──────────────────────────────────────────────────────────
//
//   two_step_grace_started   a person whose 14 days just began: a switch turned on, or a covered seat begun in a club
//                            that already requires it (lib/two-step-grace.ts, the switch route)
//   two_step_grace_reminder  the same person, 3 days before the deadline, if it is still off (the hourly job)
//
// Neither has a link (/legal): "sign in and open Account, then Sign-in & security".

/** A club name on one line, for a subject (/review: a typed name can carry a line break). */
function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** "November 24", the deadline's day in the club's zone (a date, not a clock: the reminder screen counts days). */
function deadlineDay(iso: string): string {
  return formatInOrgZone(iso, { month: 'long', day: 'numeric' });
}

function graceWhy(orgName: string, which: 'board' | 'coaches', roleWord: string): string {
  const org = esc(orgName);
  return which === 'board'
    ? `${org} now requires the people who run the club, including you as ${esc(roleWord)}, to use two-step sign-in. That way it’s much harder for someone with only a stolen password to open the club’s books or its families’ details.`
    : `${org} now requires its coaches to use two-step sign-in. That way it’s much harder for someone with only a stolen password to open the details of the families on your team.`;
}

const HOW_TO_SET_UP = 'Sign in to FieldLogicHQ and open Account, then Sign-in &amp; security. It takes about two minutes. You’ll need an authenticator app on your phone, such as Google Authenticator or Microsoft Authenticator.';

export function twoStepGraceStartedEmail(p: {
  orgName: string;
  which: 'board' | 'coaches';
  /** The person's seat, as the club names it ("Treasurer"). */
  roleWord: string;
  deadlineIso: string;
}): { subject: string; html: string } {
  const day = esc(deadlineDay(p.deadlineIso));
  return {
    subject: `${oneLine(p.orgName)} now requires two-step sign-in`,
    html: warmEmailDocument([
      warmEmailHeading(`${esc(p.orgName)} now requires two-step sign-in`),
      warmEmailParagraph(graceWhy(p.orgName, p.which, p.roleWord)),
      warmEmailParagraph(`Set it up by ${day}. ${HOW_TO_SET_UP}`),
      warmEmailParagraph(`Until then, signing in shows a reminder you can skip. After ${day}, you’ll set it up before you can open ${esc(possessive(p.orgName))} screens. Your other places on FieldLogicHQ that don’t need it stay open.`),
      warmEmailSmall(NO_LINK),
    ].join('')),
  };
}

export function twoStepGraceReminderEmail(p: {
  orgName: string;
  which: 'board' | 'coaches';
  roleWord: string;
  deadlineIso: string;
  daysLeft: number;
}): { subject: string; html: string } {
  const day = esc(deadlineDay(p.deadlineIso));
  const left = `${p.daysLeft} ${p.daysLeft === 1 ? 'day' : 'days'}`;
  return {
    subject: `${left} left to set up two-step sign-in for ${oneLine(p.orgName)}`,
    html: warmEmailDocument([
      warmEmailHeading(`${left} left to set up two-step sign-in`),
      warmEmailParagraph(`${esc(p.orgName)} requires two-step sign-in for your role (${esc(p.roleWord)}), and you haven’t set it up yet. Your deadline is ${day}.`),
      warmEmailParagraph(HOW_TO_SET_UP),
      warmEmailParagraph(`After ${day}, you’ll set it up before you can open ${esc(possessive(p.orgName))} screens. Your other places on FieldLogicHQ that don’t need it stay open.`),
      warmEmailSmall(NO_LINK),
    ].join('')),
  };
}

// ── Part 4: the account alarms (Part 1 call 2; Part 2's list; owner ruling 2026-11-12) ────────────────────────────
//
//   two_step_turned_on       to the account: two-step was turned on, or moved to a new phone. Someone holding only the
//                            password could turn it on and lock the real person out (Part 1 call 2): this is the warning.
//   two_step_turned_off      to the account: two-step was turned off.
//   password_changed         to the account: the password was changed from Account (or saved after a backup code).
//
// Each says what to do if it wasn't you. No link (the inbox may be the thing that was taken).

const IF_NOT_YOU = `If this wasn’t you, someone else may have your password. Reset your password from the sign-in page (“Forgot your password?”), then write to ${esc(FIELDLOGICHQ_CONTACT_EMAIL)} from the address you sign in with, and we’ll help you get your account back.`;

/** `oldRemoved`: false when a new phone was added but the old app could not be removed yet (it may still give working codes). */
export function twoStepTurnedOnEmail(p: { atIso: string; newPhone: boolean; oldRemoved?: boolean }): { subject: string; html: string } {
  const when = esc(whenWords(p.atIso));
  return p.newPhone
    ? {
      subject: 'Two-step sign-in moved to a new phone',
      html: warmEmailDocument([
        warmEmailHeading('Two-step sign-in moved to a new phone'),
        warmEmailParagraph(`A new authenticator app was set up for your FieldLogicHQ account on ${when} ${p.oldRemoved === false ? 'We couldn’t remove the old app yet, so it may still give working codes. Open Account, then Sign-in &amp; security, and set up your new phone again to remove it.' : 'Codes from the old app no longer work.'} You were given new backup codes, and the old ones stopped working too.`),
        warmEmailParagraph(IF_NOT_YOU),
        warmEmailSmall(NO_LINK),
      ].join('')),
    }
    : {
      subject: 'Two-step sign-in is now on',
      html: warmEmailDocument([
        warmEmailHeading('Two-step sign-in is now on'),
        warmEmailParagraph(`Two-step sign-in was turned on for your FieldLogicHQ account on ${when} From now on, signing in asks for a code from your authenticator app after your password.`),
        warmEmailParagraph('Keep your backup codes somewhere safe. They get you in if you lose your phone.'),
        warmEmailParagraph(IF_NOT_YOU),
        warmEmailSmall(NO_LINK),
      ].join('')),
    };
}

export function twoStepTurnedOffEmail(p: { atIso: string }): { subject: string; html: string } {
  return {
    subject: 'Two-step sign-in is now off',
    html: warmEmailDocument([
      warmEmailHeading('Two-step sign-in is now off'),
      warmEmailParagraph(`Two-step sign-in was turned off for your FieldLogicHQ account on ${esc(whenWords(p.atIso))} Signing in now asks only for your password, and your backup codes no longer work.`),
      warmEmailParagraph(IF_NOT_YOU),
      warmEmailSmall(NO_LINK),
    ].join('')),
  };
}

/** `othersSignedOut`: false when signing the other devices out did not finish (the email never claims it did). */
export function passwordChangedEmail(p: { atIso: string; othersSignedOut: boolean }): { subject: string; html: string } {
  return {
    subject: 'Your FieldLogicHQ password was changed',
    html: warmEmailDocument([
      warmEmailHeading('Your password was changed'),
      warmEmailParagraph(`The password for your FieldLogicHQ account was changed on ${esc(whenWords(p.atIso))} ${p.othersSignedOut ? 'Your other devices were signed out.' : 'We couldn’t sign out your other devices, so if you’re signed in somewhere else, sign out there too.'}`),
      warmEmailParagraph(IF_NOT_YOU),
      warmEmailSmall(NO_LINK),
    ].join('')),
  };
}

