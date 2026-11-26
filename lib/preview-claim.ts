/**
 * lib/preview-claim.ts — the room and the claim of a preview club (Club Website Track P, Session P3; owner rulings T5,
 * T7–T10, T14–T16, 2026-11-25; drawing Tx3So1rUqL6shn7CzM93Zr tabs 4, 6 and 8).
 *
 * Pure and client-safe: the words, the claim code's shape, the masked claimant. The database holds the rules that
 * matter (mig 540: the code, the wrong tries, the claim in one step, the undo); the server half is
 * `lib/preview-claim-server.ts`. What a preview IS lives in `lib/preview-org.ts`.
 */

/** T7 + tab 4: no 0, O, 1 or I, so it reads aloud without mistakes. Mig 540's CHECK is the same set. */
export const CLAIM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CLAIM_CODE_LENGTH = 6;
/** T7: five wrong codes in an hour rest the door for an hour (counted in the database, per club and per visitor). */
export const CLAIM_TRIES_PER_HOUR = 5;
/** How long the pass from a right code carries the claim (the account step and its email in between). */
export const CLAIM_PASS_HOURS = 24;

const CODE_RE = new RegExp(`^[${CLAIM_CODE_ALPHABET}]{${CLAIM_CODE_LENGTH}}$`);

/** What a person typed, as the database compares it: capitals, no spaces or dashes. */
export function normaliseClaimCode(typed: string): string {
  return typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isClaimCodeShape(code: string): boolean {
  return CODE_RE.test(code);
}

/** "7K4PQ2" → "7K4 PQ2", as the card and the window print it. */
export function formatClaimCode(code: string): string {
  const c = normaliseClaimCode(code);
  return c.length === CLAIM_CODE_LENGTH ? `${c.slice(0, 3)} ${c.slice(3)}` : c;
}

/** "sam@westvale.ca" → "s•••@w•••.ca" (tab 2: the owner checks it against the person met; /legal rec. 3). */
export function maskClaimantEmail(email: string | null | undefined): string | null {
  const e = (email ?? '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1 || at === e.length - 1) return null;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : '';
  return `${local[0]}•••@${host[0]}•••${tld}`;
}

/** The public address a preview is shown at, as the card and the window print it (no scheme). */
export function previewAddress(slug: string): string {
  return `fieldlogichq.ca/${slug}`;
}

/** Where "Claim it" goes: our own door page, not the club's (tab 6.1). */
export function claimPath(slug: string): string {
  return `/start/claim/${encodeURIComponent(slug)}`;
}

/** Support, as every claim failure names it. */
export const CLAIM_SUPPORT = 'support@fieldlogichq.ca';

// ── The claim's words (tab 6; /legal's paragraph and tick, CLUB_WEBSITE_TRACK_P_REVIEW.md rec. 1) ───────────────────────
export const CLAIM_WORDS = {
  bandAction: 'Claim it',
  codeTitle: 'Claim your club',
  codeLine: 'For the club’s board. Enter the code from the card we left with your club. Then make your account and choose a plan.',
  codeLabel: 'Claim code',
  codeContinue: 'Continue',
  codeChecking: 'Checking…',
  lostCard: `Lost the card from the meeting? Ask whoever met with us, or write to ${CLAIM_SUPPORT}.`,
  backTo: (club: string) => `← Back to ${club}`,
  accountTitle: (club: string) => `Claim ${club}`,
  accountLine: 'Make your account, claim the club, then choose Club or Club · Association.',
  claimTitle: (club: string) => `Claim ${club}`,
  emailConfirmed: 'Your email is confirmed.',
  stays: 'Stays',
  staysItems: ['The name and web address', 'The logo and colours', 'The sport', 'The line about the club'],
  cleared: 'Cleared',
  clearedItems: ['Sample teams and seasons', 'Sample games and the tournament', 'Sample sponsors and places', 'The preview marking'],
  owner: 'You’ll be the club’s owner. Only you can start its plan and invite your board. Its site stays off until you start a plan.',
  /** /legal rec. 1, word for word. It is the claim's own line until the next Terms version carries it (T16). */
  publisher: 'FieldLogicHQ made and published this preview, using the club’s name, logo and colours from its own site. The club did not make it and is not responsible for it. From here the club is yours, and so is what you put on it. The name, logo and colours stay until you change them.',
  /** The authority tick, kept word for word with the paragraph above it in the claim record (`claimRecordText`). */
  authority: (club: string) => `I’m allowed to claim this club for ${club} and to agree to the Terms on its behalf.`,
  authorityMissing: 'Tick the box to say you’re allowed to claim the club.',
  claimButton: 'Claim the club and clear the sample',
  claiming: 'Claiming the club…',
  notNow: 'Not now. The link in your email brings you back here for the next 24 hours. After that, enter the code again.',
  err: {
    wrong: (club: string) => `That code doesn’t match ${club}. Check the card, or write to ${CLAIM_SUPPORT}.`,
    shape: 'Enter the six letters and numbers from the card.',
    resting: `Too many tries. Try again in an hour, or write to ${CLAIM_SUPPORT}.`,
    otherClub: (own: string, club: string) =>
      `Your account already runs ${own}, and one account runs one club. Claim ${club} with a different email, or write to ${CLAIM_SUPPORT}.`,
    otherClubUnnamed: (club: string) =>
      `Your account already runs a club, and one account runs one club. Claim ${club} with a different email, or write to ${CLAIM_SUPPORT}.`,
    useDifferentEmail: 'Use a different email',
    didNotFinish: `The claim didn’t finish, and nothing changed: the preview is as it was. Try again. If it happens twice, write to ${CLAIM_SUPPORT}.`,
    tryAgain: 'Try again',
    endedTitle: 'This preview has ended',
    ended: (removedOn: string | null) => removedOn
      ? `It was removed on ${removedOn}. Write to ${CLAIM_SUPPORT} and we can make a new one.`
      : `It was removed. Write to ${CLAIM_SUPPORT} and we can make a new one.`,
    claimedTitle: (club: string) => `${club} is claimed`,
    claimed: `This club has already been claimed. If you’re with the club and didn’t claim it, write to ${CLAIM_SUPPORT}.`,
    openSite: 'Open the club’s site',
    notOnSale: 'Club plans aren’t on sale right now, so the club can’t be claimed yet. Write to support@fieldlogichq.ca.',
    staff: 'A FieldLogicHQ staff account can’t claim a club. Sign in with the club’s own email.',
    passGone: 'Enter the code again to carry on.',
  },
  /** 6.5: the one line at the top of Set up your club, for a club that came from a preview. */
  landed: (club: string) =>
    `${club} is yours. Its name, logo and colours stayed; the sample teams, games and sponsors are gone, so your site shows only what you add.`,
} as const;

// ── The room window's words (tab 4) ───────────────────────────────────────────────────────────────────────────────────
export const ROOM_WORDS = {
  code: 'Claim code',
  copyLink: 'Copy link',
  copied: 'Link copied',
  fullScreen: 'Show the QR code full screen',
  fullClose: 'Tap anywhere to close',
  card: 'Room card (PDF)',
  newCode: 'New code',
  newCodeTitle: 'Make a new code?',
  newCodeAsk: 'The code on the printed card stops working. Print a new card for the club.',
  newCodeDone: 'New code made. The old one no longer works.',
  resting: 'The claim door is resting after five wrong codes.',
  letTry: 'Let them try again',
  liveGroup: (tournament: string) => `The live game · ${tournament}`,
  liveGroupBare: 'The live game',
  liveNow: 'Live now',
  final: 'Final',
  notStarted: 'Starts at the meeting',
  markFinal: 'Mark final',
  finalAsk: (home: string, away: string) => `Mark the game final at ${home}–${away}?`,
  finalBody: 'The score can’t be changed in the room after this. Phones in the room show it as final.',
  saveScore: 'Save score',
  saving: 'Saving…',
  saved: 'Saved',
  scoreHelp: 'Phones in the room show it within 30 seconds. If a save fails you’ll see “Not saved. Check your signal and save again”, and your numbers stay.',
  notSaved: 'Not saved. Check your signal and save again',
  notStartedErr: 'The game hasn’t started yet. It starts at the meeting time.',
  finalErr: 'This game is marked final.',
  noGame: 'The live game isn’t on this preview any more. Change the meeting to make it again.',
  emailLabel: 'Email the link',
  emailTick: 'They gave me this address at the meeting and asked for the link. Their role:',
  /** /legal P3 review item 3: P3 keeps nothing; Session P4 says what its consent record keeps. */
  emailHelp: 'One email, to the person you met. It never carries the code. Nothing is kept yet.',
  send: 'Send',
  /** T13: the send is refused until FieldLogicHQ has a mailing address (the owner's 2026-11-17 ruling). */
  sendRefused: 'This email can’t go yet. Every email like it must carry our mailing address, and ours isn’t set.',
  /** The mailing address is set but the email itself is Session P4's. */
  sendNotYet: 'This email isn’t built yet, so nothing was sent.',
  roles: ['President', 'Vice-president', 'Secretary', 'Treasurer', 'Registrar', 'Board member', 'Other'],
  meeting: 'Meeting',
  change: 'Change',
  changeTitle: 'Change the meeting',
  changeHelp: 'The live game and the removal date move with it.',
  changeSave: 'Move the meeting',
  removal: (date: string) => `Removed on ${date}, 30 days after the meeting, unless the club claims it.`,
  removeNow: 'Remove now',
  removeTitle: (club: string) => `Remove ${club}?`,
  removeBody: 'Its pages, logo and sample are deleted, and its link no longer opens the site. The preview’s record stays in the list as Removed.',
  removeConfirm: 'Remove the preview',
  removeReason: 'Removed from Prospect clubs',
  failed: 'That didn’t save. Try again.',
} as const;

// ── The room card (tab 4B) ────────────────────────────────────────────────────────────────────────────────────────────
export const CARD_WORDS = {
  /** /legal P3 review item 5: the card's foot says "Not their site yet", so the headline doesn't call it theirs. */
  headline: 'A site for your club, already built',
  scan: 'Scan to open it on your phone.',
  claimWith: 'To claim it, tap Claim it and enter',
  foot: (club: string, removalDate: string) =>
    `Prepared by FieldLogicHQ for ${club}. Not their site yet. Removed on ${removalDate} unless the club claims it.`,
} as const;

// ── After the claim (tab 2; T10, T15) ─────────────────────────────────────────────────────────────────────────────────
export const CLAIMED_WORDS = {
  title: (club: string) => club,
  claimedOn: (day: string) => `Claimed ${day}`,
  by: (masked: string) => `by ${masked}`,
  noPlan: 'No plan yet',
  onTrial: (plan: string) => `${plan}, on trial`,
  openRecord: 'Open in Clubs & portals',
  deleted: 'This club was claimed and has since been deleted.',
  undo: 'Undo the claim',
  undoAsk: (club: string) => `Undo the claim on ${club}?`,
  undoBody: 'The claimant loses the club, and the preview comes back as it was, with the sample and a new claim code. Print a new card.',
  undoConfirm: 'Undo the claim',
  undoDone: 'The claim is undone. The preview is back, with a new code.',
  undoGone: 'Undo isn’t possible now: the club has started using FieldLogicHQ (a plan, checkout, other people or something added). Use Delete in Clubs & portals if it must go.',
} as const;

/** The plan's name as the row's second line says it ("Club, on trial"); the plan's own label, never a price. */
export function claimedPlanLine(planLabel: string | null, status: string | null): string {
  if (!planLabel) return CLAIMED_WORDS.noPlan;
  return status === 'trialing' ? CLAIMED_WORDS.onTrial(planLabel) : planLabel;
}

/** What the claim record keeps as "the sentence shown": /legal's paragraph, then the authority tick, as the step reads. */
export function claimRecordText(club: string): string {
  return `${CLAIM_WORDS.publisher} ${CLAIM_WORDS.authority(club)}`;
}

/** The claim step's states, as the door pages switch on them. */
export type ClaimDoorState = 'open' | 'claimed' | 'removed' | 'resting' | 'missing';
