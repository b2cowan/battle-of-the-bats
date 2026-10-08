/**
 * GAME DAY'S WORDS — one home (Tournament admin redesign Stage 1, 2026-09-29).
 *
 * G5 "one word per game state": the same four states used to read ten ways across the screens an
 * organizer and a scorekeeper use in the same hour (IN REVIEW · Reviewing · Review · Pending Review;
 * NEEDS SCORE · Unscored · To Score · To Be Scored). Every surface that NAMES a game's state — the
 * organizer's board, Results, the schedule's game tags, the scorekeeper — reads it from here, so a
 * sixth spelling cannot appear on one screen and not the others. The words are `/marketing`'s; the
 * placement is the owner's ruling. ⚠ "Pending Review" is the product-wide name (help, house league,
 * tryouts): never recase it.
 *
 * Plain strings and small functions only — no React — so a server route, a unit test and the help
 * content's search keywords can all read the same word.
 */
import { formatTime } from './utils.ts';
import { formatShortWeekdayDate } from './timezone.ts';

/**
 * When a game is, as a game-day row says it: the day only when it isn't today ("Fri, Jun 12 ·
 * 1:00 p.m." — F03: an overdue Friday game read "1:00 p.m." on a Sunday phone), then the clock.
 * Through the product's formatters only; '' when the game has neither.
 */
export function gameWhen(date: string | null | undefined, time: string | null | undefined, today: string): string {
  const clock = time ? formatTime(time.slice(0, 5)) : '';
  if (!date || date === today) return clock;
  const day = formatShortWeekdayDate(date);
  return clock ? `${day} · ${clock}` : day;
}

/** The five words a game's state is ever said in. */
export const GAME_STATE_WORD = {
  /** No score yet, and its time has passed. */
  needsScore: 'Needs a score',
  /** A scorekeeper's score, waiting for the organizer to finalize it. */
  pendingReview: 'Pending Review',
  final: 'Final',
  forfeit: 'Forfeit',
  /** A level score (a word on the row and in the editor, not a status of its own). */
  tie: 'Tie',
} as const;

/** The organizer's board (the dashboard on game day) and Results' bands. */
export const GAME_DAY_LIST = {
  toFinalize: 'To finalize',
  needsScore: GAME_STATE_WORD.needsScore,
  playingNow: 'Playing now',
  upNext: 'Up next',
  /** Results' "All games" only: games not yet due. */
  scheduled: 'Scheduled',
  /** Results' "All games" only: Final and Forfeit games. */
  final: GAME_STATE_WORD.final,
} as const;

/**
 * The scorekeeper's four-button bucket bar keeps SHORT forms (/marketing 2026-09-29): four equal
 * buttons on a 360px phone leave ~80px a word, so the bar keeps its shipped "To score" and "Review"
 * beside "Final" and "All". Its per-game labels say the full words above.
 */
export const SCOREKEEPER_BUCKET = {
  open: 'To score',
  pending: 'Review',
  final: GAME_STATE_WORD.final,
  all: 'All',
} as const;

/** A forfeit a scorekeeper submitted, waiting for the organizer — the two words, never a third. */
export const PENDING_FORFEIT = `${GAME_STATE_WORD.forfeit} · ${GAME_STATE_WORD.pendingReview}`;

export const GAME_DAY_WORDS = {
  /** The board's foot row when a list is longer than the rows it shows (opens Results). */
  moreRows: (n: number) => `${n} more`,
  /** The game-day board when all four lists are empty. */
  boardEmpty: 'Nothing needs you yet.',
  /** The top note while the dates have passed and not every game is final (no counts, no button):
   *  a fact, then the step, which reads bold. The rule is `isReadyToFinalize` — every game final or
   *  forfeit (a Pending Review score must be finalized); payments are not part of it. */
  datesPassedNote: { fact: 'The event’s dates have passed.', step: 'Once every score is finalized, you can mark it complete.' },
  /** The rain-delay door (G8). The window opens on the first day with games still to play — today,
   *  or a later day when today's are done — so the line does not say "today's". */
  doorEyebrow: 'Rain delay',
  doorTitle: 'Running late?',
  doorLine: 'Push or cancel the games still to play.',
  doorLockedLine: 'Move a whole day’s games at once',
  doorLockedPlan: 'Tournament Plus',
  /** The summary card. */
  summaryTitle: 'The event so far',
  gamesFinal: 'games final',
  teamsArrived: 'teams arrived',
  roundToPlay: (round: string) => `${round} to play`,
  roundOnNow: (round: string) => `${round} in progress`,
  poolGamesFinal: (done: number, total: number) => `${done} of ${total} pool games final`,
  playoffsDone: 'Playoffs complete',
  noGamesYet: 'No games yet',
  /** Schedule health as a row. The verdict words are the health panel's own (Healthy · Review · Needs work). */
  healthTitle: 'Schedule health',
  healthCaption: (tone: 'good' | 'warning' | 'danger', issues: number) =>
    `${tone === 'good' ? 'Healthy' : tone === 'warning' ? 'Review' : 'Needs work'} · ${issues === 0 ? 'no issues' : issues === 1 ? '1 issue' : `${issues} issues`}`,
  healthNotBuilt: 'No timed schedule generated yet.',
  customize: 'Customize this board',
  /** Customize's hint on the game-day board (show and hide; the order is the day's). */
  customizeHint: 'Choose what this board shows · saved to your browser',
  /** A list Customize is showing while it has nothing in it. */
  nothingHere: 'Nothing to show right now.',
  /** Results. */
  lensNeedsYou: 'Needs you',
  lensAllGames: 'All games',
  needsYouEmpty: 'Nothing needs you right now.',
  finalize: 'Finalize',
  saveScore: 'Save score',
  forfeit: 'Forfeit…',
  discard: 'Discard',
  revertScore: 'Revert score',
  /** A final result (completed, or a final forfeit) changes only in the hands of someone who can
   *  finalize (owner 2026-10-07). Results says it on a final game; the games route refuses with it. */
  finalLocked: 'This game is final. Only someone who can finalize scores can change it.',
  /** Shown in the editor while the two scores are level (owner 2026-09-29: say the true thing — a
   *  tied playoff score SAVES, and `advancePlayoffs` leaves the next round on "Winner of …"). */
  tiePool: 'Scores are level — this game will save as a tie.',
  tiePlayoff: 'Scores are level — this game will save as a tie. The bracket won’t advance until it’s re-scored or a forfeit is recorded.',
  /** Check-in. */
  checkIn: 'Check in',
  undo: 'Undo',
  /** The arrival chip's word — the chip keeps its capitals, and the time sits BESIDE it in the caption's
   *  ink, never inside (F61: in the chip's capitals "8:59 a.m." read "8:59 A.M."; Stage 6, 2026-10-07). */
  arrived: 'In',
  stillOwe: (owe: number, total: number) => `${owe} of ${total} teams still owe`,
  allPaid: 'All teams are paid.',
  /** The team sheet's head (Stage 6 V3, A29): the division and where the team is, in the buckets' words. */
  sheetContext: (division: string, where: string) => (division ? `${division} · ${where}` : where),
  checkedInAt: (time: string | null, by: string | null) =>
    `Checked in${time ? ` ${time}` : ''}${by ? ` by ${by}` : ''}`,
  /** A fee taken at the gate (or at the organizer's own Check-in — one board). */
  paidAt: (time: string | null) => (time ? `Paid at the gate · ${time}` : 'Paid'),
  noRosterYet: 'No roster yet',
  addRoster: 'Add roster',
} as const;
