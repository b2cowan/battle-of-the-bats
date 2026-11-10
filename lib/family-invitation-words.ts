import { possessive } from './utils';

/**
 * The words of the Stage 4a invitation (Signed-in family accounts; plan SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md Stage 4). ONE home:
 * the routes, screens and email builders read them from here. DRAFT words for the /marketing pass in the Stage 4a closeout:
 * change them here and only here. (The consent and privacy words of the accept page are /legal's draft (a) and live in
 * lib/family-guardian-consent.ts; the email fine print below is /legal's draft (c), noted where it differs.)
 */

/** "Leo", "Leo and Ava", "Leo, Ava and Maya". */
function names(list: readonly string[]): string {
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** "Aarav’s team", "Leo and Ava’s team", "Leo and Maya’s teams" (two teams). */
const teamOf = (children: readonly string[], teams = 1) => `${possessive(names(children))} ${teams > 1 ? 'teams' : 'team'}`;

export const FAMILY_INVITATION_WORDS = {
  /** A rep coach's Send invitation, refused (Part 3.3) or not sent (Part 5.3). */
  rep: {
    invalidEmail: 'Enter a valid email address.',
    notOnTeam: 'That player is not on this team.',
    inviteStopped: 'That address has asked not to get invitations from this club.',
    adult: 'This player is 18 or older, so there’s no parent invitation for them.',
    alreadyConnected: 'That address is already connected to this player.',
    cap: 'This player already has two connected guardians. Remove one before inviting another.',
    cancelled: 'That invitation no longer works.',
    /** O1 = A + O3 (2026-11-08): a club team's invitation names the club's contact and mailing address. */
    noClubContact: 'Before invitations can go out, the club needs a contact email and a mailing address on its public site (About us). Ask a club admin to add them.',
    sendFailed: 'The invitation didn’t send. Try again in a moment.',
  },

  /** O1 = A + O3: Publish refuses (tier on only) until each family's invitation can name the club's contact and address. */
  publishNeedsContact:
    'Before the teams go out, add the club’s contact email and mailing address on the public site, under About us. The invitation in each family’s email names them.',

  /** The accept page (drawing tab 2). */
  accept: {
    pageTitleOne: (child: string) => `Join ${teamOf([child])}`,
    pageTitleSeveral: 'Join your children’s teams',
    emailLabel: 'Type the email this invitation was sent to',
    emailHint: (masked: string) => `This invitation is for ${masked}.`,
    emailNext: 'Continue',
    emailNoMatch: (masked: string) => `That isn’t the email this invitation was sent to. It was sent to ${masked}.`,
    newPasswordLabel: 'Choose a password',
    newPasswordHint: 'At least 8 characters',
    passwordTooShort: 'Choose a password of at least 8 characters.',
    existingPasswordLabel: 'Your password',
    existingPasswordHint: 'You already have a FieldLogicHQ account with this email.',
    forgotPassword: 'Forgot your password?',
    otherEmail: 'Use a different email',
    accountExists: 'There’s already an account for this email. Enter its password to sign in.',
    signedInAs: (name: string | null, masked: string) => (name ? `You’re signed in as ${name} (${masked}).` : `You’re signed in as ${masked}.`),
    boxesRequired: 'Tick both boxes to join.',
    required: 'Required',
    joining: 'Joining…',
    failed: 'That didn’t go through. Try again in a moment.',
    tooMany: 'Too many tries. Wait a few minutes, then try again.',
    /** C: signed in as someone else (ruling 5). On a rep team the line names the coach, not the club. */
    another: {
      title: 'This invitation is for another email',
      body: (invited: string, self: string, from: 'club' | 'coach') =>
        `It was sent to ${invited}, and you’re signed in as ${self}. Sign out and use that email, or ask the ${from} to send it to the address you use.`,
      signOut: 'Sign out',
    },
    /** D: expired, or replaced by a newer one. One answer whether or not anything was sent (ask 9). */
    expired: {
      title: 'This invitation has expired',
      body: 'We can send a new one to the address it was for.',
      button: 'Email me a new invitation',
      sending: 'Sending…',
      sent: 'If that address can still join, a new invitation is on its way. It works for 30 days.',
    },
    /** E: this account already joined. */
    joined: {
      title: 'You’ve already joined',
      buttonOne: (child: string) => `Open ${teamOf([child])}`,
      buttonSeveral: 'Open your family',
    },
    /** F: every other case. Never says why (a stranger must not learn it). No sign-in button. */
    gone: {
      title: 'This invitation no longer works',
      body: (club: string | null, contact: string | null) =>
        club && contact ? `If you think that’s wrong, contact ${club} at ${contact}.` : 'If you think that’s wrong, contact the club or coach who sent it.',
    },
  },

  /** The emails (drawing tab 1; /legal draft (c)). Plain text: the builders escape it. */
  mail: {
    panelTitle: (children: readonly string[], teams: number) => `See ${teamOf(children, teams)} in the app`,
    panelBody: 'Practices, games and your sign-up in one place, and the schedule in your phone’s calendar.',
    panelButton: (children: readonly string[], teams: number) => `Join ${teamOf(children, teams)}`,
    /** /legal (c), first parent, verbatim. */
    firstFinePrint: (email: string, children: readonly string[], club: string, contact: string, teams: number) =>
      `This invitation is for ${email} and works for 30 days. If you aren’t ${possessive(names(children))} parent or guardian, ignore it and tell ${club} at ${contact}. Joining is your choice. You’ll get emails about ${teamOf(children, teams)} either way, and joining doesn’t add you to any newsletter.`,
    /** Drawing tab 1d: the who-added line under the greeting of the second parent's copy. */
    secondAddedYou: (firstParent: string, children: readonly string[]) =>
      `${firstParent} added your email to ${possessive(names(children))} sign-up so you get the same updates.`,
    /** /legal (c), second parent, WITHOUT its first sentence ("{first parent} added your email to {child}'s sign-up."): the
     *  who-added line above already says it. /legal re-reads this in the Stage 4a closeout. */
    secondFinePrint: (email: string, children: readonly string[], stopLabel: string) =>
      `This invitation is for ${email} and works for 30 days. If you aren’t ${possessive(names(children))} parent or guardian, ignore it. Don’t want these emails? Use “${stopLabel}” below.`,
    /** /legal (c): the commercial-message sender line on the second parent's copy (O3: the club's mailing address). */
    secondSender: (club: string, address: string, contact: string) => `Sent by ${club}, ${address}, ${contact}, through FieldLogicHQ.`,
    /** Drawing tab 1e: already in the app. */
    connected: (children: readonly string[], teams: number) => `${teamOf(children, teams)} ${teams > 1 ? 'are' : 'is'} in your app.`,
    connectedLink: 'Open it',
  },

  /** The rep coach's invitation email (drawing tab 1f; /legal draft (c), built to the commercial-message standard). */
  repMail: {
    subject: (child: string, team: string) => `Join ${teamOf([child])}, the ${team}`,
    heading: (child: string) => `Join ${teamOf([child])}`,
    greeting: 'Hi,',
    lead: (coach: string, team: string, child: string) =>
      `${coach}, coach of the ${team}, invited this address to see ${teamOf([child])} in the app: practices, games and the coach’s updates.`,
    button: (child: string) => `Join ${teamOf([child])}`,
    finePrint: (email: string, child: string) =>
      `This invitation is for ${email} and works for 30 days. If you aren’t ${possessive(child)} parent or guardian, ignore it.`,
    stopLead: 'Don’t want invitations like this?',
    stopLink: 'Don’t send me invitations',
    /** A club team (O3: the mailing address) / a coach team with no club (O4: the coach's own email; no address to print). */
    senderClub: (coach: string, club: string, address: string, contact: string) =>
      `Sent by ${coach} for ${club}, ${address}, through FieldLogicHQ. Contact: ${contact}.`,
    senderCoachTeam: (coach: string, contact: string) => `Sent by ${coach} for a FieldLogicHQ coach team, through FieldLogicHQ. Contact: ${contact}.`,
  },

  /** The "Don't send me invitations" confirm page (/family/invitation-stop). A POST behind one button; never a GET that writes. */
  inviteStop: {
    title: 'Stop invitations?',
    body: (club: string, masked: string) => `Press the button and ${club} won’t send invitations to ${masked} again.`,
    note: 'Emails about a sign-up of your own still come. Nobody is told you pressed this.',
    button: 'Don’t send me invitations',
    doneTitle: 'Invitations stopped',
    doneBody: (club: string, masked: string) => `${club} won’t send invitations to ${masked} again.`,
    invalidTitle: 'We can’t use that link',
    invalidBody: 'This link isn’t valid. To stop invitations, reply to the email and ask the sender.',
    dbTitle: 'That didn’t go through',
    dbBody: 'Something went wrong on our side, so invitations haven’t stopped yet. Open the link in your email again in a few minutes.',
  },
} as const;
