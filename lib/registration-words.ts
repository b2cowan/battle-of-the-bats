/**
 * TEAMS' WORDS — one home (Tournament admin redesign Stage 2, 2026-09-30). The words are `/marketing`'s
 * (confirmed 2026-09-30); the placement is the owner's ruling (hub Stage 2 tab, T1–T7, A13, A16, A17;
 * P1 and P2 at the build's start). Plain strings and small functions only — no React — so a unit test
 * and the help content's search keywords can read the same word.
 *
 * ⚠ A team WAITING FOR A DECISION is never called "Pending review" on Teams: the band says "To review"
 * and the chip "Pending". "Pending review" is the GAME state's name (lib/game-day-words.ts, §245).
 */

/** The plan a Teams lock names (the Facts doc's spelling). */
export const TEAMS_LOCK_PLAN = 'Tournament Plus';

export const TEAMS_WORDS = {
  // ── Payments' slim line and the registration chip (owner 2026-10-21; the At a glance card is gone) ──
  // Registration health's own words are REGISTRATION_HEALTH_WORDS, below.
  payments: 'Payments',
  paymentsIn: (collected: string, expected: string) => `${collected} of ${expected} in`,
  pastDue: (amount: string) => `${amount} past due`,
  toCollect: (amount: string) => `${amount} to collect`,
  allCollected: 'All collected',
  registrationOpen: 'Registration open',
  registrationClosed: 'Registration closed',
  spotsFull: (accepted: number, capacity: number) => `${accepted} of ${capacity} spots · full`,
  spotsLeft: (accepted: number, capacity: number) => `${accepted} of ${capacity} spots · ${capacity - accepted} left`,
  /** The chip's count: the state is beside it, so "· 4 left" would only repeat the subtraction. */
  spotsOf: (accepted: number, capacity: number) => `${accepted} of ${capacity} spots`,
  noLimit: (accepted: number) => `${accepted} accepted · no limit`,
  closeSentence: (division: string) => `Closing stops new teams registering for ${division}. You can reopen it any time.`,
  closedSentence: (division: string) => `New teams can’t register for ${division} until you reopen it.`,
  closeRegistration: 'Close registration',
  reopenRegistration: 'Reopen registration',

  // ── The toolbar ──
  // The division picker says a division's waiting teams with the rail's amber count, not in words
  // (owner, 2026-10-01: "· 1 to review" read as part of the name and was cut off on a phone). These
  // are the words a screen reader hears for that mark and for the closed box's dot.
  division: 'Division',
  noDivisions: 'No divisions',
  toReviewCount: (n: number) => `${n} to review`,
  waitingElsewhere: 'Teams waiting in another division',
  // One line in every division (owner, 2026-10-01, the Teams toolbar ruling): the division, Search,
  // Filter and Tools. Tools holds what an event uses a few times, grouped by what it acts on.
  search: 'Search teams or coaches',
  filter: 'Filter',
  /** What a screen reader hears after "Filter" when the button counts the filters on. */
  filtersOn: (n: number) => `${n} on`,
  filterStatus: 'Status',
  filterPayment: 'Payment',
  /** The Filter line when every status is unticked: the list is empty, and the line says why. */
  noStatus: 'No status',
  groupBy: 'Group by',
  resetFilters: 'Reset filters',
  tools: 'Tools',
  toolsTeams: 'Teams',
  toolsPools: 'Pools',
  toolsSetup: 'Setup',
  registrationQuestions: 'Registration questions',
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
  /** The summary line once something is paid: "Owes $200 · paid $100 of $300". */
  paidOf: (paid: string, fee: string) => `paid ${paid} of ${fee}`,
  /** A team that paid more than its fee: "Paid $350 · $50 over the fee". */
  paidAmount: (amount: string) => `Paid ${amount}`,
  overFee: (amount: string) => `${amount} over the fee`,
  // ── The record reads first and is edited whole (owner, 2026-10-01): the Team section says each fact
  // ONCE (it replaced a read "Coach" block above a "Team details" form of the same fields).
  // "Coach’s email" is the coach-email override, shown only where it differs from the sign-in email;
  // it and "Placement" are new words, owed to /marketing. "No notes yet." is the portal's own.
  team: 'Team',
  editTeam: 'Edit this team',
  coachEmail: 'Coach’s email',
  placement: 'Placement',
  notesEmpty: 'No notes yet.',
  registered: 'Registered',
  noEmail: 'Email not provided',
  repTeam: 'Rep team',
  linkRepTeam: 'Link to a rep team',
  resendAccess: 'Resend the access link',
  resendTitle: 'Resend the access link?',
  resendBody: (team: string) => `${team} will get an email with a link to its registration dashboard.`,
  resendConfirm: 'Send the link',
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
/**
 * A team's payments, in the record's Payment section (mig 345; drawn and ruled 2026-10-21 — TEAM_PAYMENTS_LIST_PLAN.md).
 * Sentence-case headings, plain asterisks on what is required, no "optional" tags. New words, owed to /marketing.
 */
export const TEAM_PAYMENT_WORDS = {
  received: 'Received',
  stillDue: 'Still due',
  record: 'Record',
  recordOther: '+ Record a different amount',
  recordTitle: (what: string | null) => (what ? `Record the ${what.toLowerCase()}` : 'Record a payment'),
  amount: 'Amount',
  paidOn: 'Paid on',
  how: 'How it arrived',
  howNone: 'Not recorded',
  methods: { etransfer: 'E-transfer', cash: 'Cash', cheque: 'Cheque', card: 'Card', other: 'Other' },
  /** Under the Record form. The date range is the rule; the second sentence says where the money goes. */
  hintBook: 'Any date up to today. Posts one line to the tournament’s book, dated the day you pick.',
  hintTeamOnly: 'Any date up to today. Kept on the team; this club has no Accounting, so nothing posts to a ledger.',
  inLedger: 'In ledger',
  earlier: 'Earlier',
  changeTitle: 'Change this payment',
  changeAria: (amount: string, day: string) => `Change the ${amount} payment from ${day}`,
  changeHintBook: 'Saving a change voids this ledger line and posts a corrected one, so the book keeps both. That is why a change asks first instead of saving as you type.',
  saveChange: 'Save change',
  cancel: 'Cancel',
  removeLink: 'Remove this payment',
  removeAsk: (amount: string) => `Remove this ${amount} payment?`,
  removeBodyBook: 'Its ledger line is voided and stays in the book, with your name and the time.',
  removeBody: (amount: string) => `It leaves the list. The team’s total goes down by ${amount}.`,
  removeConfirm: 'Remove payment',
  keep: 'Keep it',
  dueOn: (date: string) => `due ${date}`,
  loading: 'Loading the payments…',
  loadError: 'Couldn’t load the payments.',
  retry: 'Try again',
  amountError: 'Enter an amount above $0.',
  futureError: 'A payment can’t be dated in the future.',
  dateError: 'Choose the date the payment arrived.',
} as const;

export const TEAM_STATUS_CHIP: Record<'pending' | 'accepted' | 'waitlist' | 'rejected', { label: string; tone: 'warn' | 'good' | 'neutral' }> = {
  pending: { label: 'Pending', tone: 'warn' },
  accepted: { label: 'Accepted', tone: 'good' },
  waitlist: { label: 'Waitlisted', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'neutral' },
};

/**
 * REGISTRATION HEALTH'S WORDS — the header button and the window it opens, on Teams and on the dashboard (owner
 * 2026-10-21: the Schedule health shape). One home so the two screens never say it two ways.
 */
export const REGISTRATION_HEALTH_WORDS = {
  title: 'Registration health',
  /** The window's scope in its caption — the score covers every division, whichever one Teams is showing. */
  scope: 'every division',
  /** The header button's spoken name: the score with its scale, and its issues (the window says it in words). */
  buttonLabel: (score: number, issues: number) =>
    `Registration health, ${score} out of 100, ${issues === 0 ? 'no issues' : issues === 1 ? '1 issue' : `${issues} issues`}`,
  /** An issue's one door, as Schedule's: it opens the teams behind it. */
  showThem: 'Show them',
  showIt: 'Show it',
  noIssues: 'No registration health issues found.',
  // The four figures. The words are the old panel's tiles, unchanged.
  cellTeams: 'Teams',
  cellMissingEmail: 'Missing email',
  cellPayments: 'Payments',
  cellNeedsAction: 'Needs action',
  teamsFilled: (accepted: number, capacity: number, pct: number) => `${accepted}/${capacity} · ${pct}% filled`,
  teamsPendingWaitlist: (pending: number, waitlist: number) => `${pending} pending · ${waitlist} waitlisted`,
  teamsAccepted: 'accepted',
  missingEmailBad: 'can’t be reached',
  missingEmailGood: 'all reachable',
  paymentsPastDue: (n: number) => `${n} past due`,
  paymentsUnpaid: (n: number) => `${n} unpaid`,
  paymentsAllIn: 'all collected',
  needsActionSome: 'review or placement',
  needsActionNone: 'nothing pending',
} as const;

/** The registration chip beside the division picker (owner 2026-10-21): the state, the spots, and the one switch. */
export const REGISTRATION_CHIP_WORDS = {
  /** The chip's accessible name: the state and the spots, then what it opens. */
  chipLabel: (state: string, spots: string) => `${state}, ${spots}. Change registration`,
  /** The menu's heading — the sheet's label on a phone. */
  menuTitle: (division: string) => `${division} registration`,
} as const;
