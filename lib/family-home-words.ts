import { possessive } from './utils';

/**
 * The words of the signed-in family pages (Signed-in family accounts Stage 4a, Parts 6–8; drawing tabs 3–7). ONE home: the
 * family pages, the calendar row, the registration record window's statuses and the join window read them from here. DRAFT
 * words for the /marketing pass in the Stage 4a closeout: change them here and only here. /legal's drafts are verbatim where
 * marked: (b) the privacy line, (d) the stop page's added sentence, (e) the two Leave confirms
 * (docs/agents/legal/drafts/GUARDIAN_CONSENT_STAGE4.md v0.1).
 */

/** "Leo", "Leo and Ava", "Leo, Ava and Maya". */
export function nameList(list: readonly string[]): string {
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** "the Otters", "the Otters and the Falcons" — a team as /legal (e) names it. */
const theTeams = (teams: readonly string[]) => nameList(teams.map(t => `the ${t}`));

export const FAMILY_HOME_WORDS = {
  family: {
    title: 'Your family',
    /** Drawing 3.4: a joined child with no team right now. */
    noTeam: 'Not on a team right now. The club will email you when teams are set.',
    open: 'Open →',
    upNext: 'Up next',
    /** Drawing 5.3: removed by the club, on their next visit. Words that take no side; no email. */
    removed: (child: string, club: string, contact: string | null) =>
      contact
        ? `You’re no longer connected to ${child}. If you think that’s wrong, contact ${club} at ${contact}.`
        : `You’re no longer connected to ${child}. If you think that’s wrong, contact ${club}.`,
    /** Nothing at all to show (no live connection and nothing removed): the page still answers, quietly. */
    emptyTitle: 'Nothing here yet',
    emptyBody: 'When you join your child’s team from an invitation, it appears here.',
    signInTitle: 'Sign in to see your family',
    signInBody: 'Your children’s teams are here once you’re signed in.',
    signIn: 'Sign in',
  },

  team: {
    /** Drawing 3.2: the one-time joined note. */
    joinedTitle: (children: readonly string[]) => `You’ve joined ${possessive(nameList(children))} team`,
    joinedBody: (children: readonly string[]) => `This page is where ${possessive(nameList(children))} practices and games appear.`,
    yourPlayer: 'Your player',
    yourPlayers: 'Your players',
    schedule: 'Schedule',
    emptySchedule: 'Nothing on the schedule yet. This is where games and practices will appear.',
    directions: 'Directions →',
    cancelled: 'Cancelled',
    /** A rained-out house-league game, kept on its old day until it has a new one (Prospect Demo P2b, owner 2026-11-10). */
    postponed: 'Postponed · new date to come',
    practice: 'Practice',
    backToFamily: '← Your family',
    /** /legal draft (b), verbatim, with the club's name for {club} (the drawing's specimen wrote "the club"; the /legal words ship,
     *  ruling 13). */
    privacy: (children: readonly string[], club: string) =>
      `Other families can’t see you or ${nameList(children)} here. ${possessive(nameList(children))} coaches and ${club} see the name, email and phone on the sign-up.`,
    privacyLink: 'How your information is used',
    /** Drawing 3.2: "Connected to Aarav: you, and dev.shah@example.com (invited)". */
    connected: (child: string, others: readonly string[]) =>
      others.length ? `Connected to ${child}: you, and ${nameList(others)}` : `Connected to ${child}: you`,
    invitedSuffix: '(invited)',
    manage: 'Manage →',
    notConnectedTitle: 'This team isn’t on your account',
    notConnectedBody: 'Open your family to see the teams you’re connected to.',
    notConnectedButton: 'Your family',
    hiddenTitle: 'Schedule not available',
    hiddenBody: 'This team’s schedule isn’t being shared with families right now. Your connection is still active — check back, or ask the coach.',
  },

  signupRow: {
    title: 'Your sign-up',
    /** "House League 2027 · reference HL-4Q7M2K" (one child) / "House League 2027 · 3 children". */
    sub: (season: string, ref: string | null, children: number) =>
      children > 1 ? `${season} · ${children} children` : ref ? `${season} · reference ${ref}` : season,
    withdrawn: (season: string) => `${season} · Withdrawn`,
    paid: 'Paid',
    /** "$40.00 to pay". */
    toPay: (cents: number) =>
      `${new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', currencyDisplay: 'narrowSymbol' }).format(cents / 100)} to pay`,
  },

  /** Part 6.5: the in-app "Your sign-up" (drawing 4.2). Replaces "Anyone with this link…". */
  inApp: {
    seeing: (children: readonly string[]) => `You’re seeing this because you’re signed in as ${possessive(nameList(children))} parent.`,
    back: (to: string) => `← ${to}`,
  },

  /** Part 6.6: the way back on the EMAILED sign-up page (drawing 4.1), once a child on it is on a team. */
  wayBack: {
    joinedLead: (children: readonly string[]) => `Joined ${possessive(nameList(children))} team? `,
    signIn: 'Sign in to see it',
    notYetLead: 'Not yet? ',
    emailMe: 'Email me an invitation',
    sending: 'Sending…',
    /** One answer whatever happened (an address that can't join learns nothing). */
    sent: 'If that address can still join, an invitation is on its way. It works for 30 days.',
    failed: 'That didn’t go through. Try again in a moment.',
    tooMany: 'Too many tries. Wait a few minutes, then try again.',
  },

  /** Drawing 5.1: the Connected-to page under Manage. */
  manage: {
    title: (child: string) => `Connected to ${child}`,
    you: (name: string) => `${name} (you)`,
    joined: (date: string) => `Joined ${date}`,
    invited: (date: string) => `Invited ${date} · hasn’t joined yet`,
    change: (club: string, contact: string | null) =>
      contact ? `To change who’s connected, contact ${club} at ${contact}.` : `To change who’s connected, contact ${club}.`,
    leave: (child: string) => `Leave ${possessive(child)} team`,
    back: '← Back',
    leaving: 'Leaving…',
    leaveFailed: 'That didn’t go through. Try again in a moment.',
  },

  /** /legal draft (e), verbatim: the two Leave confirms. The title is its first sentence (the drawing's window title). */
  leave: {
    title: (child: string) => `Leave ${possessive(child)} team?`,
    first: (teams: readonly string[], child: string, club: string) =>
      `You’ll stop seeing ${teams.length ? theTeams(teams) : `${possessive(child)} team`} here, and your calendar link stops showing its games. ${club} will still email you about ${possessive(child)} sign-up. You can join again only if ${club} sends you a new invitation.`,
    second: (teams: readonly string[], child: string, club: string, stopLabel: string) =>
      `You’ll stop seeing ${teams.length ? theTeams(teams) : `${possessive(child)} team`} here, and your calendar link stops showing its games. ${club} may still email you about ${possessive(child)} sign-up. To stop those too, use ${stopLabel} at the bottom of one. You can join again only if ${club} sends you a new invitation.`,
    cancel: 'Cancel',
    confirm: 'Leave',
  },

  /** Part 7 · drawing 6.2: one address per parent. */
  calendar: {
    title: 'Your calendar',
    lead: 'One address for every team your children are on. It updates itself.',
    leadMade: 'One address for every team your children are on. It updates itself as teams change.',
    make: 'Make my link',
    making: 'Making…',
    howTo: 'Copy this address into your calendar app’s “subscribe to calendar” option.',
    copy: 'Copy',
    copied: 'Copied',
    stop: 'Stop this calendar',
    stopping: 'Stopping…',
    /** Not drawn: asked once before the address ends. */
    stopAsk: 'Stop this calendar? Your calendar app will show none of these events after its next refresh. Making a link later gives a new address.',
    stopConfirm: 'Stop it',
    keepPrivate: 'Keep it private. Anyone with it can see your teams’ practice and game times.',
    failed: 'That didn’t go through. Try again in a moment.',
    notSetUp: 'Calendar links aren’t set up yet. Try again later.',
    /** The feed's own name in the parent's calendar app. Names no child. */
    feedName: 'Your family’s teams',
  },

  /** Part 8.1 · drawing 7.2: one status under each address on the registration record window. */
  club: {
    inApp: (date: string) => `In the app since ${date}`,
    invited: (date: string) => `Invited ${date}`,
    notInvited: 'Not invited yet',
    /** Not drawn (the drawing's four states are joined / invited / not invited / stopped): an address that left or was removed,
     *  whose way back is the club's Send again. /marketing re-reads in the closeout. */
    left: (date: string) => `Left the app ${date}`,
    removed: (date: string) => `Removed from the app ${date}`,
    sendAgain: 'Send again',
    sending: 'Sending…',
    sent: (email: string) => `Sent to ${email}.`,
    notSent: 'Nothing was sent. That address can’t be invited to this child right now.',
    removeAction: (child: string) => `Remove a parent from ${possessive(child)} team`,
    removeHint: (child: string) => `Removing someone stops them seeing ${possessive(child)} team. It doesn’t change the sign-up or who gets emails.`,
    /** Not drawn: asks once. */
    removeTitle: (child: string) => `Remove a parent from ${possessive(child)} team?`,
    removeBody: (who: string, child: string) =>
      `${who} stops seeing ${possessive(child)} team in the app. They aren’t emailed. Only Send again can invite them back.`,
    removeConfirm: 'Remove',
    removeNone: 'Nobody is connected to this child in the app.',
    removed_: (who: string) => `${who} is no longer connected.`,
  },

  /** Part 8.3: the join window names the connected parents of both records (drawing tab 8, words only). */
  join: {
    parents: (sides: readonly { child: string; parents: readonly string[] }[]) => {
      const named = sides.filter(s => s.parents.length);
      if (!named.length) return null;
      const each = named.map(s => `${nameList(s.parents)} to ${possessive(s.child)} record`).join('; ');
      return `Connected in the app: ${each}. After the join, each is connected to the one child and sees every team it’s on.`;
    },
  },

  /** Part 8.4: /legal draft (d), verbatim, on the second-parent stop page — only when the address joined as the second parent. */
  stopJoined: (children: readonly string[], club: string) =>
    `You’ve joined ${possessive(nameList(children))} team in the app. Stopping removes you from it, and your calendar link stops showing its games. ${club} won’t email this address about a sign-up someone else added it to, and can’t add it again.`,
} as const;
