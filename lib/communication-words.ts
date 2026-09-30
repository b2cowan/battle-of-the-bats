/**
 * COMMUNICATIONS' WORDS — one home (Tournament admin redesign Stage 2, 2026-09-30). The words are
 * `/marketing`'s (confirmed 2026-09-30); the placement is the owner's ruling (hub Stage 2 tab, C1 · C2).
 * Plain strings and small functions only — no React — so a route, a unit test and the help content
 * can read the same word.
 */

/** The plan a Communications lock names (the Facts doc's spelling). */
export const COMMS_LOCK_PLAN = 'Tournament Plus';

/** The Tournament plan's lock lines (padlock · words · the plan's chip; opening Plan & billing). */
export const COMMS_LOCK = {
  /** A site post can show under several divisions on Tournament Plus (F43). */
  showUnder: 'Show under chosen divisions',
  /** The email picker (A14). */
  chooseTeams: 'Choose teams by division, status or payment',
  /** Push to fans' phones (`fan_score_alerts`). */
  pushFans: 'Buzz fans who turned on alerts',
} as const;

/** An email's record, when the send did not keep its list (sent before mig 314). */
export const RECIPIENTS_NOT_KEPT = 'The list of who it reached wasn’t kept for this email.';
