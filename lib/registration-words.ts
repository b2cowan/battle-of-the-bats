/**
 * TEAMS' WORDS — one home (Tournament admin redesign Stage 2, 2026-09-30). The words are `/marketing`'s
 * (confirmed 2026-09-30); the placement is the owner's ruling (hub Stage 2 tab, T1–T7, A13, A16, A17;
 * P1 and P2 at the build's start). Plain strings and small functions only — no React — so a unit test
 * and the help content's search keywords can read the same word.
 *
 * ⚠ A team WAITING FOR A DECISION is never called "Pending Review" on Teams: the band says "To review"
 * and the chip "Pending". "Pending Review" is the GAME state's name (lib/game-day-words.ts, §245).
 */

/** The plan a Teams lock names (the Facts doc's spelling). */
export const TEAMS_LOCK_PLAN = 'Tournament Plus';

export const TEAMS_WORDS = {
  // ── At a glance (T1) ──
  glance: 'At a glance',
  health: 'Registration health',
  healthScope: 'Every division',
  healthNothing: 'nothing missing',
  missingEmail: (n: number) => `${n} missing an email`,
  missingInfo: (n: number) => `${n} missing info`,
  withoutSpot: (n: number) => `${n} without a spot`,
  shortOfTeams: (n: number) => `${n} division${n === 1 ? '' : 's'} short of teams`,
  payments: 'Payments',
  paymentsIn: (collected: string, expected: string) => `${collected} of ${expected} in`,
  pastDue: (amount: string) => `${amount} past due`,
  toCollect: (amount: string) => `${amount} to collect`,
  allCollected: 'All collected',
  registrationOpen: 'Registration open',
  registrationClosed: 'Registration closed',
  spotsFull: (accepted: number, capacity: number) => `${accepted} of ${capacity} spots · full`,
  spotsLeft: (accepted: number, capacity: number) => `${accepted} of ${capacity} spots · ${capacity - accepted} left`,
  noLimit: (accepted: number) => `${accepted} accepted · no limit`,
  closeSentence: (division: string) => `Closing stops new teams registering for ${division}. You can reopen it any time.`,
  closedSentence: (division: string) => `New teams can’t register for ${division} until you reopen it.`,
  closeRegistration: 'Close registration',
  reopenRegistration: 'Reopen registration',

  // ── The toolbar ──
  toReviewOption: (division: string, n: number) => (n > 0 ? `${division} · ${n} to review` : division),
  selectMany: 'Select many',
  swap: 'Swap',
  randomize: 'Randomize',

  // ── Bands (T2, T4, T6) ──
  toReview: 'To review',
  waitlist: 'Waitlist',
  needsSpot: 'Accepted — needs a spot',
  noPoolYet: 'No pool yet',
  accepted: 'Accepted',
  rejected: 'Rejected',
  poolFill: (filled: number, total: number) => `${filled} of ${total}`,

  // ── Row captions ──
  registeredOn: (date: string) => `registered ${date}`,
  waitsForSpot: 'waits for an open spot',
  spotOpen: 'a spot is open',
  openSpot: 'Open spot',
  waitlistPosition: (n: number) => `#${n}`,
  paid: 'Paid',
  unpaid: 'Unpaid',
  owes: (amount: string) => `Owes ${amount}`,

  // ── Row actions (A13) ──
  accept: 'Accept',
  promote: 'Promote',
  place: 'Place',

  // ── The attention banner (F41) ──
  attentionHere: (label: string, n: number, division: string) => `${label} · ${n} in ${division}`,
  attentionElsewhere: (n: number) => `${n} more in other divisions`,
  clear: 'Clear',
  /** A locked attention banner's door to Plan & billing (today's word, kept). */
  upgrade: 'Upgrade',

  // ── Selection and swap (A17, T4) ──
  selected: (n: number) => `${n} selected`,
  done: 'Done',
  selectVisible: 'Select visible',
  clearVisible: 'Clear visible',
  bulkWaitlist: 'Waitlist',
  bulkReject: 'Reject',
  depositPaid: 'Deposit paid',
  paidInFull: 'Paid in full',
  sendReminder: 'Send a reminder',
  moveToPool: 'Move to pool…',
  swapNote: 'Tap two teams to swap their places.',
  swapChosen: (team: string) => `${team} chosen. Tap the team to swap with.`,
  swapTitle: 'Swap their places?',
  swapMoves: (a: string, slotB: string, b: string | null, slotA: string) =>
    b ? `${a} moves to ${slotB} and ${b} moves to ${slotA}.` : `${a} moves to ${slotB}.`,
} as const;

/** The record's words (T3). */
export const TEAM_RECORD_WORDS = {
  nameLabel: 'Team name',
  nameHeld: 'Give the team a name to save it.',
  // The email is the team's sign-in key: half an address is held, never saved (/review 2026-09-30).
  // New word, on the name's pattern — owed to /marketing for confirmation.
  emailHeld: 'Enter a full email address to save it.',
  payment: 'Payment',
  owes: (amount: string) => `Owes ${amount}`,
  depositDue: (date: string) => `deposit due ${date}`,
  depositPaid: 'deposit paid',
  balanceDue: (date: string) => `balance due ${date}`,
  due: (date: string) => `due ${date}`,
  pastDue: 'past due',
  paidInFull: (amount: string) => `Paid in full · ${amount}`,
  markPaid: (amount: string | null) => (amount ? `Mark paid · ${amount}` : 'Mark paid'),
  markUnpaid: 'Mark unpaid',
  depositPaidField: 'Deposit paid',
  totalPaidField: 'Total paid',
  coach: 'Coach',
  headCoach: 'Head coach',
  registeredBy: 'Registered by',
  registered: 'Registered',
  noEmail: 'Email not provided',
  repTeam: 'Rep team',
  linkRepTeam: 'Link to a rep team',
  resendAccess: 'Resend the access link',
  resendTitle: 'Resend the access link?',
  resendBody: (team: string) => `${team} will get an email with a link to its registration dashboard.`,
  resendConfirm: 'Send the link',
  details: 'Team details',
  coachField: 'Coach',
  emailField: 'Email',
  seedField: 'Seed',
  seedPlaceholder: 'Unseeded',
  seedHint: '1 is the top seed. Used by the playoff bracket’s “By seed number”.',
  poolField: 'Pool',
  notes: 'Admin notes',
  notesPlaceholder: 'Private notes…',
  answers: 'Registration answers',
  decision: 'Decision',
  registration: 'Registration',
  fullNeedsSpot: (division: string, accepted: number, capacity: number, team: string) =>
    `${division} is full (${accepted} of ${capacity}). Accepting puts ${team} on the list of teams that need a spot.`,
  holdsSpot: (team: string, slot: string) => `${team} holds ${slot} while it waits.`,
  placesInNext: (team: string) => `Accepting places ${team} in the next open spot.`,
  acceptedFrees: (slot: string) => `Accepted. Rejecting it frees ${slot}.`,
  accepted: 'Accepted.',
  acceptedNeedsSpot: 'Accepted, waiting for a spot.',
  onWaitlist: (n: number | null) => (n != null ? `On the waitlist, #${n}.` : 'On the waitlist.'),
  rejected: 'Rejected.',
  spotOpenNow: 'A spot is open.',
  lockPromote: 'Promote from the waitlist',
  lockPlace: 'Place it in an open spot',
  reject: 'Reject',
  deleteTeam: 'Delete this team…',
  deleteTitle: 'Delete this team?',
  deleteBody: (team: string) => `Permanently delete “${team}”? This can’t be undone.`,
  deleteConfirm: 'Delete',
  yourTeam: 'Your team',
  noun: 'team',
  positionWide: (position: string, division: string) => `${position} in ${division}`,
} as const;

/** One status, one word, one tone — the club tryouts' map (T5: pending warn · accepted good ·
 *  waitlisted and rejected neutral). No new tone. */
export const TEAM_STATUS_CHIP: Record<'pending' | 'accepted' | 'waitlist' | 'rejected', { label: string; tone: 'warn' | 'good' | 'neutral' }> = {
  pending: { label: 'Pending', tone: 'warn' },
  accepted: { label: 'Accepted', tone: 'good' },
  waitlist: { label: 'Waitlisted', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'neutral' },
};
