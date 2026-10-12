/**
 * EVENT SETTINGS, IN WORDS — what Stage 5 changed on it (Tournament admin redesign Stage 5, E3, hub v45; the words are
 * /marketing's, 2026-10-10, `.probe/s5b/words-final.md` §5). The seven cards and the rest of their words are unchanged.
 *
 *   - The status is said ONCE, in the event record's sentence (lib/tournament-status-words), and "Change" opens the
 *     record — the one home for every status change (P5, ask A49).
 *   - The Fee model's fourth choice is "Not tracked here", never "Free" (F92, owner 10 Oct): it means no fees are set up
 *     or tracked here, not that the event is free. The stored value `free` is unchanged — an identifier, not copy.
 *   - Two sentences promised gates that don't exist (J1-032): Activate needs dates, a division and a contact — never
 *     fees or game timing.
 *
 * The Stage 5 addendum (A71–A77, owner 2026-10-12; the words /marketing's, the same day) put every card in the Fees card's
 * look: the card titles in sentence case, every on/off setting a switch (Post-event results' "Enabled / Disabled" went),
 * the questions in their card, and the workspace's web address out of the event (lib/web-address-words).
 *
 * Pure, so a plain Node unit test reads it.
 */
import type { FeeScope } from './types.ts';

/** Game timing's and the tie-breakers' scope — and the Fee model's first three choices: one copy of the words. */
const SCOPE_OPTIONS = {
  tournament: 'Tournament-wide',
  allow_override: 'Allow override',
  per_division: 'Per division',
} as const;

export const EVENT_SETTINGS_WORDS = {
  title: 'Event settings',
  /** The seven cards, in their order (A71: sentence case; the cards and their order unchanged). */
  cards: {
    overview: 'Tournament overview',
    questions: 'Registration questions',
    roster: 'Roster requirements',
    fees: 'Fees & payments',
    contact: 'Contact',
    coachEmails: 'Coach emails',
    schedule: 'Schedule rules',
  },
  /** Under Public contact (A72: the control is a switch now; "the org owner" spelled as the dropdown says it). */
  publicContactLine: 'Who coaches and visitors reach with questions. Defaults to the owner. The switches set where it shows.',
  /** Under Automatic coach emails while it is off: the six dim and keep their own settings. */
  coachEmailsOff: 'None of the emails below send while this is off. Each keeps its own setting for when you turn it back on.',
  /** Post-event results' caption (was "When enabled, …"). */
  postEventLine: 'When on, accepted team contacts receive one email with public standings, schedule, and team links the first time this tournament is marked completed.',
  /** The kit's asking window for a failure (was a box titled "Error"). */
  loadFailedTitle: 'Couldn’t load the settings',
  loadFailedLine: 'Nothing was changed. Check your connection, then open Event settings again.',
  formatFailedTitle: 'Couldn’t switch the format',
  /** The event's own link (one verb with the address and the status: Change). */
  changeUrl: 'Change the URL',
  changeUrlTitle: 'Change the public URL?',
  status: 'Status',
  change: 'Change',
  /** J1-032 — after a draft's status sentence (was "Activate once your divisions, fees, and game timing are configured"). */
  activateNeeds: 'To activate it, it needs its dates, a division, and a contact.',
  /** J1-032 — Schedule Rules, per-division timing (was "must configure … before the tournament can be activated"). */
  timingPerDivision: 'Each division sets its own game timing, on Divisions.',

  feeModel: 'Fee model',
  feeModelChoose: 'Choose how fees work',
  scopeOptions: SCOPE_OPTIONS,
  feeOptions: {
    ...SCOPE_OPTIONS,
    free: 'Not tracked here',
  } satisfies Record<FeeScope, string>,
  /** Each choice keeps its one line saying what it means. */
  feeLine: {
    free: 'No fees are set up, so payments aren’t tracked here. If teams pay, they pay you directly.',
    per_division: 'Each division sets its own fee and due dates.',
    allow_override: 'These are the default fee amounts. Divisions can set their own.',
  },
  feeChoose: 'Choose how fees work for this tournament.',
  /** The card's summary for the fourth choice (was "Free"). */
  feeSummaryNotTracked: 'Not tracked here',

  /** J1-042: which divisions set their own fee, said in the card as a door to Divisions. */
  eachDivisionsFee: 'Each division’s fee',
  divisionsWithOwnFee: 'Divisions with their own fee',
  noneYet: 'None yet',
  noFeeYet: 'no fee yet',
  divisionsLoading: 'Reading the divisions…',

  feeDetails: 'Fee details on the registration form',
  feeDetailsLine: 'Show fees and due dates to coaches',
  feeDetailsHidden: 'When this is off, fee amounts and due dates stay in admin only — coaches won’t see a payment panel on the public registration form.',
  whereTheyAppear: 'Where they appear',
  appearOptions: {
    email: 'The acceptance email only',
    form: 'The registration form and the email',
  },
} as const;
