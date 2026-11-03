/**
 * league-coach-scores.ts — A HOUSE-LEAGUE COACH ENTERS THE SCORE (House League Stage 9e-3, rulings 9e·7 to 9e·9; words
 * HOUSE_LEAGUE_STAGE9E_COPY.md Part B, §5–§9, and the owner's three answers of 2026-11-03).
 *
 * ⚖ ONE WRITER PER GAME. The home team's coach enters the score once the game has started; it counts at once. The away
 * coach cannot overwrite it: they can report it, and the score stands. The entering side (every coach of the home team)
 * can change or clear it until it is reported or the club touches it — a Keep, a correction, or a score the club entered.
 * The league admin has the last word. Nobody is emailed about a score (9d2·2, 9d2·13).
 * ⚖ A COACH OF BOTH TEAMS IS THE HOME COACH: no Report door on their own score.
 * ⚖ A COACH READS TEAMS, NOT PEOPLE: the other team's coach is "{Team}’ coach" — a coach's row never carries another
 * person's name. The club reads the person ("Alex Moreau").
 *
 * The record behind it is `league_game_scores` (mig 428, service role only; the server writes it through four functions
 * that lock the game). This module is pure and client-safe: from a game, its record, the viewer and now, the row a coach
 * reads, the tag the club reads, and the "Scores to check" list. Every string lives in `SCORE_WORDS`.
 */
import { pluralize, possessive, formatTime } from './utils';
import { formatInOrgZone, orgDayKey, utcToZonedInputs } from './timezone';
import { scheduleDayLabel } from './family-schedule-format';
import type { LeagueGame } from './types';

/** One game's score record, as the server reads it (null on a game with no row: no score, or a club score from before 9e-3). */
export interface GameScoreRecord {
  gameId: string;
  enteredSide: 'coach' | 'club';
  enteredBy: string | null;
  enteredByName: string;
  enteredAt: string;
  reportedBy: string | null;
  reportedAt: string | null;
  reportNote: string | null;
  checkedByName: string | null;
  checkedAt: string | null;
  correctedByName: string | null;
  correctedAt: string | null;
}

type ScoreGame = Pick<LeagueGame, 'status' | 'scheduledAt' | 'homeScore' | 'awayScore'>;

/** The `seen` a press carries is an instant (the game's updated_at as read): refused here, not as a database error. */
export const isInstant = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

/** A note is 280 characters at most (COPY §14.3 left it open; the counter reads like the rainout's "{n} left"). */
export const REPORT_NOTE_MAX = 280;

/** "8:12 p.m." on the day it happened; "Jun 17 at 8:12 p.m." on any other (COPY §5.1). */
function atWords(iso: string, nowMs: number): { today: boolean; time: string; date: string } {
  return {
    today: orgDayKey(iso) === orgDayKey(new Date(nowMs).toISOString()),
    time: formatTime(utcToZonedInputs(iso).time),
    date: formatInOrgZone(iso, { month: 'short', day: 'numeric' }),
  };
}

/** Ends a sentence on a time without doubling the period of "p.m.". */
const stop = (s: string) => (s.endsWith('.') ? s : `${s}.`);

/** "Jun 17 at 8:12 p.m." — the club side always carries the date (COPY §13.9: a date is always true). */
const whenWords = (iso: string) => {
  const w = atWords(iso, 0);
  return `${w.date} at ${w.time}`;
};

export const SCORE_WORDS = {
  // §5 · the coach's Scores section
  /** Owner 2026-11-03 (phone review): a small tag by the field, not a sentence on every row. */
  homeTag: 'Home',
  enter: 'Enter the score',
  change: 'Change the score',
  /** The row's quiet door (its accessible name stays `change`): an entered score is not a to-do. */
  changeShort: 'Change',
  final: (home: number, away: number) => `Final ${home}–${away}`,
  away: (home: string) => `${possessive(home)} coach enters the score.`,
  foot: (standings: boolean) => standings
    ? 'Scores count in the standings as soon as they are entered. The league admin can correct them. Families aren’t emailed.'
    : 'Scores show on the schedule as soon as they are entered. The league admin can correct them. Families aren’t emailed.',
  // §5.1 · who entered it, as a coach reads it
  /** One short line: the "change it until…" rule lives in the Change window (`winHint`), said once, where it is acted on. */
  byMe: (iso: string, nowMs: number) => {
    const w = atWords(iso, nowMs);
    return w.today ? `Entered by you at ${w.time}` : `Entered by you, ${w.date} at ${w.time}`;
  },
  byOther: (home: string, iso: string, nowMs: number) => {
    const w = atWords(iso, nowMs);
    return w.today ? `Entered by ${possessive(home)} coach at ${w.time}` : `Entered by ${possessive(home)} coach, ${w.date} at ${w.time}`;
  },
  byClubCorrected: 'The league admin corrected this score.',
  /** Owner answer 2026-11-03 (Q2): a score the league admin entered; Report is not offered. */
  byClubEntered: 'The league admin entered this score.',
  /** Owner answer 2026-11-03 (Q1): after Keep both coaches' doors close. */
  byClubChecked: 'The league admin checked this score.',
  reportedMe: 'You told the league admin this isn’t right. The score stands until they look.',
  reportedThem: (away: string) => `${possessive(away)} coach says this isn’t right. The league admin is checking it.`,
  // §6 · entering the score
  winSub: (home: string, away: string, iso: string) =>
    `${home} vs ${away} · ${scheduleDayLabel(iso)} · ${formatTime(utcToZonedInputs(iso).time)}`,
  winHome: (home: string) => `${home} · Home · you`,
  winAway: (away: string) => `${away} · Away`,
  box: (team: string) => `${team} score`,
  winHint: (standings: boolean) => standings
    ? 'It counts in the standings right away. You can change it until the other coach reports it or the league admin corrects it. Families aren’t emailed.'
    : 'It shows on the schedule right away. You can change it until the other coach reports it or the league admin corrects it. Families aren’t emailed.',
  winBy: (name: string) => `Entered as ${name}`,
  cancel: 'Cancel',
  save: 'Save the score',
  saving: 'Saving…',
  bothScores: 'Enter both scores, or neither.',
  clear: 'Both boxes are empty. Saving puts this game back to scheduled.',
  saved: (standings: boolean) => (standings ? 'Score saved. It counts in the standings now.' : 'Score saved.'),
  // §7 · the other coach: Report this score
  report: 'Report this score',
  repSub: (home: string, homeScore: number, away: string, awayScore: number, iso: string) =>
    `${home} ${homeScore}, ${away} ${awayScore} · ${scheduleDayLabel(iso)}`,
  repLabel: 'What should it be?',
  repPlaceholder: 'For example: we had it 6–4.',
  repHint: 'You can leave this empty. The score stays as entered until the league admin looks. Families aren’t emailed.',
  repFoot: 'Sent to the league admin',
  repSend: 'Report to the league admin',
  repSending: 'Sending…',
  repToast: 'Reported. The league admin will look at it.',
  /** The rainout's counter word (COPY §14.3), spelled the same — that window's own word lives with its module. */
  left: (n: number) => `${n} left`,
  // §8 · the league admin's side
  tagCoach: 'Coach entered',
  tagReported: 'Reported',
  clubByCoach: (name: string, team: string, iso: string) => `Entered by ${name}, ${possessive(team)} coach, ${whenWords(iso)}`,
  clubReportedBy: (name: string, iso: string) => stop(`Entered by ${name}, ${whenWords(iso)}`),
  clubReportSays: (away: string, note: string) => `${possessive(away)} coach says: “${note}”`,
  clubReportEmpty: (away: string) => `${possessive(away)} coach reported this score and didn’t say what it should be.`,
  clubReportedNote: 'This score counts until you change it.',
  keep: (home: number, away: number) => `Keep ${home}–${away}`,
  correct: 'Correct the score',
  kept: (name: string, iso: string) => `Checked by ${name}, ${whenWords(iso)}`,
  corrected: (name: string, iso: string) => `${stop(`Corrected by ${name}, ${whenWords(iso)}`)} Coaches can’t change this score now.`,
  clubEntered: (name: string, iso: string) => `Entered by ${name}, ${whenWords(iso)}`,
  keptToast: 'Marked as checked.',
  // §8.2 · "Scores to check"
  checkTitle: 'Scores to check',
  checkHelp: 'Scores coaches entered that you haven’t looked at. They already count in the standings.',
  checkCount: (n: number) => pluralize(n, 'score'),
  checkEnteredBy: (name: string) => `entered by ${name}`,
  // §9 · refusals
  err: {
    notHome: (home: string) => `Only ${possessive(home)} coach enters the score.`,
    notStarted: 'This game hasn’t started yet.',
    calledOff: 'A cancelled or postponed game can’t be scored.',
    closed: 'This score can’t be changed now. Ask the league admin.',
    changed: 'This score changed while the window was open. Close it and look again.',
    finished: (season: string) => `${season} has finished, so scores can’t be changed.`,
    gone: (team: string) => `You’re no longer a coach of ${team}.`,
    noSignal: 'Couldn’t save. Check your connection and try again.',
  },
} as const;

/** What the database functions answer (mig 428), as the route maps them. */
export type ScoreRefusal = 'notFound' | 'finished' | 'notHome' | 'notAway' | 'gone' | 'own' | 'calledOff' | 'notStarted' | 'changed' | 'closed' | 'nothing';

/** The refusal's sentence and status (COPY §9). `notFound` and a hidden door's refusals read as not found. */
export function refusalOf(r: ScoreRefusal, names: { home: string; team: string; season: string }): { status: number; error: string; code: ScoreRefusal } {
  const E = SCORE_WORDS.err;
  const said: Partial<Record<ScoreRefusal, [number, string]>> = {
    finished: [409, E.finished(names.season)],
    notHome: [403, E.notHome(names.home)],
    gone: [403, E.gone(names.team)],
    calledOff: [409, E.calledOff],
    notStarted: [409, E.notStarted],
    changed: [409, E.changed],
    closed: [409, E.closed],
    own: [409, E.closed],
    nothing: [409, E.closed],
  };
  const [status, error] = said[r] ?? [404, 'Not found'];
  return { status, error, code: r };
}

// ── The coach's row ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The row's state. `notStarted` and `calledOff` are not listed (the Schedule shows them; a held rainout is not yet on the
 * coach's Schedule, so its game simply leaves the list until it is sent, never offering Enter). `waiting`: no score yet,
 * read by the away coach.
 */
export type CoachScoreState =
  | 'notStarted' | 'calledOff' | 'enter' | 'waiting'
  | 'enteredMine' | 'enteredHome' | 'enteredTheirs'
  | 'reportedMine' | 'reportedTheirs' | 'reportedAway'
  | 'checked' | 'corrected' | 'clubEntered';

export interface CoachScoreViewer {
  userId: string;
  /** They coach the home team (a coach of both teams is the home coach). */
  home: boolean;
}

export interface CoachScoreView {
  state: CoachScoreState;
  door: 'enter' | 'change' | 'report' | null;
  line: string | null;
}

/** One row of the coach's Scores section, as the server hands it to the page: names of teams, never of people. */
export interface CoachScoreRow {
  gameId: string;
  startsAt: string;
  homeName: string;
  awayName: string;
  /** "Maple Grove Park · Diamond 2", or the typed place. */
  place: string | null;
  /** The viewer coaches the home team ("you are the home team"). */
  home: boolean;
  homeScore: number | null;
  awayScore: number | null;
  view: CoachScoreView;
  /** The game's updated_at as read: what the window saw (the stale press). */
  seen: string;
  /** "Entered as {name}": the viewer's own seat name on the home team; null for the away coach. */
  enteredAs: string | null;
}

/** A game the Scores section lists: started, and on (scheduled or played). */
export const scoreListed = (g: ScoreGame, nowMs: number) =>
  (g.status === 'scheduled' || g.status === 'completed') && !!g.scheduledAt && Date.parse(g.scheduledAt) <= nowMs;

export function coachScoreView(
  g: ScoreGame, record: GameScoreRecord | null, viewer: CoachScoreViewer, names: { home: string; away: string }, nowMs: number,
): CoachScoreView {
  if (g.status === 'cancelled' || g.status === 'postponed') return { state: 'calledOff', door: null, line: null };
  if (!scoreListed(g, nowMs)) return { state: 'notStarted', door: null, line: null };
  const W = SCORE_WORDS;
  const scored = g.homeScore != null && g.awayScore != null;
  if (!scored) {
    return viewer.home ? { state: 'enter', door: 'enter', line: null } : { state: 'waiting', door: null, line: W.away(names.home) };
  }
  if (!record || record.enteredSide === 'club') return { state: 'clubEntered', door: null, line: W.byClubEntered };
  if (record.correctedAt) return { state: 'corrected', door: null, line: W.byClubCorrected };
  if (record.checkedAt) return { state: 'checked', door: null, line: W.byClubChecked };
  if (record.reportedAt) {
    if (viewer.home) return { state: 'reportedTheirs', door: null, line: W.reportedThem(names.away) };
    return record.reportedBy === viewer.userId
      ? { state: 'reportedMine', door: null, line: W.reportedMe }
      : { state: 'reportedAway', door: null, line: W.reportedThem(names.away) };
  }
  if (viewer.home) {
    return record.enteredBy === viewer.userId
      ? { state: 'enteredMine', door: 'change', line: W.byMe(record.enteredAt, nowMs) }
      : { state: 'enteredHome', door: 'change', line: W.byOther(names.home, record.enteredAt, nowMs) };
  }
  return { state: 'enteredTheirs', door: 'report', line: W.byOther(names.home, record.enteredAt, nowMs) };
}

// ── The club's side ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A coach's score the league admin hasn't looked at: listed in "Scores to check", tagged in the window. */
export function clubScoreTag(g: ScoreGame, record: GameScoreRecord | null): 'reported' | 'coach' | null {
  if (!record || record.enteredSide !== 'coach' || record.checkedAt || record.correctedAt) return null;
  if (g.status !== 'completed' || g.homeScore == null || g.awayScore == null) return null;
  return record.reportedAt ? 'reported' : 'coach';
}

/** The chip a tagged score wears, in the game window and in "Scores to check": reported is the one that asks for a look. */
export const scoreTagChip = (tag: 'reported' | 'coach') =>
  tag === 'reported' ? { tone: 'warn' as const, label: SCORE_WORDS.tagReported } : { tone: 'info' as const, label: SCORE_WORDS.tagCoach };

/** The lines the club's game window reads under the score (COPY §8.1), and whether Keep / Correct are offered. */
export function clubScoreLines(
  g: ScoreGame, record: GameScoreRecord | null, names: { home: string; away: string },
): { tag: 'reported' | 'coach' | null; lines: string[]; note: string | null; keep: string | null } {
  const W = SCORE_WORDS;
  if (!record || g.homeScore == null || g.awayScore == null) return { tag: null, lines: [], note: null, keep: null };
  const tag = clubScoreTag(g, record);
  const keep = tag ? W.keep(g.homeScore, g.awayScore) : null;
  if (record.enteredSide === 'club') return { tag, lines: [W.clubEntered(record.enteredByName, record.enteredAt)], note: null, keep };
  // A report stays readable after the league admin has kept or corrected the score.
  const lines = [record.reportedAt
    ? `${W.clubReportedBy(record.enteredByName, record.enteredAt)} ${record.reportNote ? W.clubReportSays(names.away, record.reportNote) : W.clubReportEmpty(names.away)}`
    : W.clubByCoach(record.enteredByName, names.home, record.enteredAt)];
  if (tag === 'reported') return { tag, lines, note: W.clubReportedNote, keep };
  if (record.correctedAt && record.correctedByName) lines.push(W.corrected(record.correctedByName, record.correctedAt));
  else if (record.checkedAt && record.checkedByName) lines.push(W.kept(record.checkedByName, record.checkedAt));
  return { tag, lines, note: null, keep };
}

/** "Scores to check": reported first, then coach entered; oldest first within each (by when it joined the list). */
export function scoresToCheck<G extends ScoreGame & { id: string }>(
  games: readonly G[], records: ReadonlyMap<string, GameScoreRecord>,
): { game: G; record: GameScoreRecord; tag: 'reported' | 'coach' }[] {
  const out: { game: G; record: GameScoreRecord; tag: 'reported' | 'coach' }[] = [];
  for (const game of games) {
    const record = records.get(game.id) ?? null;
    const tag = clubScoreTag(game, record);
    if (record && tag) out.push({ game, record, tag });
  }
  const since = (x: (typeof out)[number]) => Date.parse(x.tag === 'reported' ? x.record.reportedAt! : x.record.enteredAt);
  return out.sort((a, b) => (a.tag === b.tag ? since(a) - since(b) || a.game.id.localeCompare(b.game.id) : a.tag === 'reported' ? -1 : 1));
}
