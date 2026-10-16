/**
 * THE INVITE-ONLY EVENT'S WORDS — every word the free Tournament plan's invite-only event adds or changes, in one home
 * (approved by `/marketing` for the build 2026-10-16: `docs/agents/brand/PRICING_PAGE_COPY.md`, the top entry; the
 * placements are the owner's rulings, FREE_TOURNAMENT_TIER_REVIEW_PLAN.md §6, §11, §12). Paid events keep today's
 * words wherever a line below says so. Typographic apostrophes, as `lib/registration-words.ts` writes them.
 *
 * ⚠ No sentence here says "free plan" or "free tier" (the naming canon): "on your plan" is the one plan-pointing
 * phrase, used only where the limit is the point (the composer).
 */
import { formatTime, pluralize } from './utils';
import { tournamentToday, utcToZonedInputs } from './timezone';

/** A lock line = padlock + these words + the plan's chip ("Tournament Plus"); no price, no sentence (R5, M9). */
export const LOCK_WORDS = {
  exportTeamList: 'Export the team list',
  excelAndCsv: 'Excel and CSV',
  reuseSetup: 'Reuse a past tournament’s setup',
  branding: 'Your logo, theme, banner and fonts on this site',
  // The composer's targeting lock is COMMS_LOCK.chooseTeams (lib/communication-words.ts), its one home.
  reopenRegistration: 'Reopen registration',
  recordPayments: 'Record payments',
  /** The Founding Season line under a lock line: quiet grey, no full stop (M9). */
  foundingLine: (date: string) => `Free for you through ${date}`,
  /** The same, said ONCE at the foot of a Tools menu that holds a locked row (M9). */
  foundingMenuFoot: (date: string) => `Tournament Plus is free for you through ${date}.`,
} as const;

/** Event settings on an invite-only event (no Coach emails card — nothing there applies; owner 2026-10-16, the walk). */
export const INVITE_SETTINGS_WORDS = {
  contactSummary: (shown: boolean) => (shown ? 'Contact public' : 'Contact hidden'),
} as const;

/** Add team, the team record and the Teams list on an invite-only event (M7, M8). Paid events keep today's words. */
export const INVITE_TEAM_WORDS = {
  addTeam: 'Add team',
  coachKnown: 'This coach is on FieldLogicHQ. They’ll find the team in their Coaches Portal once they claim it.',
  coachNew: 'When you invite them, this email becomes their sign-in and the team lands in a free Coaches Portal.',
  noEmail: 'Without an email, this team’s coach can’t claim it. You can add one later on the team’s record.',
  inviteBox: 'Email the coach an invitation to claim this team',
  added: 'Added',
  resendInvitation: 'Resend the invitation',
  invitationSent: (email: string) => `Invitation sent to ${email}.`,
  emailFirst: 'Add the coach’s email first.',
  noEmailTag: 'No email',
} as const;

/** "8 teams · 2 pools" — the board's Teams card row and a division's count on an invite-only event (no spots). */
export function teamsAndPools(teams: number, pools: number): string {
  return pools > 0 ? `${pluralize(teams, 'team')} · ${pluralize(pools, 'pool')}` : pluralize(teams, 'team');
}

/** The board's Teams card (was "Registration"), and New tournament's reuse-step sentence (M4). */
export const INVITE_BOARD_WORDS = {
  teamsCard: 'Teams',
  howTeamsJoin: 'You add each team yourself, and its coach gets an email to claim it.',
} as const;

/** R2: an invite-only event that took registrations before its organization's Tournament Plus ended. */
export function registrationClosedLine(date?: string | null): string {
  return date
    ? `Registration closed on ${date}, when this organization’s Tournament Plus ended. Teams already in stay.`
    : 'Registration closed when this organization’s Tournament Plus ended. Teams already in stay.';
}

/** The composer on an invite-only event (M11): the limit always, and before Send when a send would break it. Its
 *  "To each team’s coach" is COMPOSER_WORDS.emailTeamsHint, on every plan. */
export const INVITE_COMPOSER_WORDS = {
  everyTeam: 'every team',
  limit: 'On your plan: up to 100 people a send and 10 emails a day for this event.',
  dayUsed: (when: string) => `This event has sent its 10 emails for today. You can email the teams again after ${when}.`,
  tooMany: (n: number) => `That’s ${n} people; one email reaches up to 100 on your plan.`,
} as const;

/**
 * When a capped event's next email may go (M11): the oldest of the day's emails turns 24 hours old. "3:40 p.m.", or
 * "3:40 p.m. tomorrow" — the rolling day can cross midnight. The org's own clock, the product's one clock format.
 */
export function emailDayWhen(freesAt: string): string {
  const { date, time } = utcToZonedInputs(freesAt);
  const clock = formatTime(time);
  return date && date !== tournamentToday() ? `${clock} tomorrow` : clock;
}

/** The phone bar's tab that opens Communications on a live invite-only event (M6). */
export const MESSAGES_TAB = 'Messages';

/** The invitation email (B3): today's "team added" email on an invite-only event. Paid events keep "Team Registered". */
export const INVITATION_EMAIL_WORDS = {
  subject: (team: string, tournament: string) => `Claim ${team} for ${tournament}`,
  heading: 'Claim your team',
  body: (tournament: string, team: string, division: string) =>
    `The organizer of ${tournament} has added ${team} to the ${division} division and invited you to claim it.`,
  detailsHeading: 'Team details',
  claimHeading: 'Claim your team',
  claimBody: 'Claiming puts the team in your free FieldLogicHQ Coaches Portal, where you’ll see the schedule once it’s published, scores as they come in, and announcements from the organizer.',
  button: 'Claim your team →',
} as const;

/** The server's refusals for a write to an area an invite-only event hides (B2). Rarely seen: the screens hide the doors. */
export const INVITE_REFUSALS = {
  registration: 'This tournament isn’t taking registrations.',
  hidden: 'That isn’t part of this event on your plan.',
} as const;
