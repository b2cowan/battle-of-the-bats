import { joinWithAnd, pluralize, possessive, formatTime } from './utils';
import { formatShortWeekdayDate, orgDayKey, utcToZonedInputs } from './timezone';
import { CLUB_EMAIL_CAP } from './families-words';
import { teamsHearing } from './league-game-changes';

/**
 * RAINOUT (House League 9e-2; rulings 9e·10 to 9e·14, plan HOUSE_LEAGUE_STAGE9_PLAN.md §0i; mig 427). One window on the
 * schedule's header calls off a day's games across divisions: postpone (the default) or cancel, email families now or
 * hold the changes in Changes to send. Pure: the window, the routes and the tests read the same plan and the same words
 * (HOUSE_LEAGUE_STAGE9E_COPY.md Part C, accepted 2026-11-01 — that file wins over a drawing).
 *
 * ⚖ WHAT IS LISTED: a game still to play (`scheduled`) in a PUBLISHED division, on the chosen org-zone day. A draft
 * division records no change and emails nobody, so its games are never in a rainout; one line names it instead.
 * ⚖ THE DAYS: today and later only. An earlier day's unscored game is a missing score, not a rainout.
 * ⚖ THE COUNTS are the send's own: one email per family PER DIVISION (a send is per division, `familiesFor`'s grouping by
 * guardian email), so a family with children in two divisions is counted, and emailed, twice.
 */

export type RainVerb = 'postponed' | 'cancelled';

export interface RainGame {
  id: string;
  divisionId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: string;
  /** The venue's name, or the typed place; null when the game has neither. */
  place: string | null;
  /** The venue's surface ("Diamond 1"). */
  field: string | null;
  /** The game's `updated_at` as read: the press is refused when a game changed since (`changed`). */
  seen: string;
}
export interface RainDivision { id: string; name: string; published: boolean }
export interface RainSource {
  /** The org-zone day the read was made on (`YYYY-MM-DD`). */
  today: string;
  /** In the season's order. */
  divisions: RainDivision[];
  /** Every game still to play from today on, draft divisions' included (the draft line counts them). */
  games: RainGame[];
  /** Practices still on from today on; `club` = on the club's time (changed only in the club's Schedules). */
  practices: { scheduledAt: string; club: boolean }[];
  /** One entry per family (a guardian email): the teams its children play on. No email leaves the server. */
  families: string[][];
}

export interface RainDay { day: string; games: number }
export interface RainListDivision { id: string; name: string; games: RainGame[]; teams: number }
export interface RainList { places: string[]; divisions: RainListDivision[]; drafts: string[] }
export interface RainSummary {
  games: number;
  teams: number;
  divisions: number;
  /** Families reached at least once. */
  families: number;
  /** One per family per division: what the send writes. */
  emails: number;
  /** Families with children in more than one of the divisions (each gets more than one email). */
  multi: number;
}

/** One division's send, as the press and the held sheet's Send answer it (`sendRainout`). */
export interface RainSendDivision {
  divisionId: string;
  name: string;
  /** told = sent now; already = someone sent these first (nothing more went); failed = refused or broke, still held. */
  outcome: 'told' | 'already' | 'failed';
  /** Families the send emailed (told only; Changes to send's "Sent to N families"). */
  emails: number;
  /** Families it was sent to that it didn't reach (told only): the season's Email families history sends them again. */
  missed: number;
  /** The rainout's games in this division (the result's "its 3 postponements"). */
  games: number;
}

/** A held rainout Put all back would still restore: the banner at the top of Changes to send. */
export interface WaitingRainout { id: string; day: string; verb: RainVerb; games: number; divisionIds: string[] }

const dayOf = (g: { scheduledAt: string }) => orgDayKey(g.scheduledAt);
const publishedIds = (src: RainSource) => new Set(src.divisions.filter(d => d.published).map(d => d.id));

/** The Day picker: today and every later day with a game still to play in a published division. */
export function rainDays(src: RainSource): RainDay[] {
  const pub = publishedIds(src);
  const counts = new Map<string, number>();
  for (const g of src.games) {
    const day = dayOf(g);
    if (!pub.has(g.divisionId) || day < src.today) continue;
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([day, games]) => ({ day, games }));
}

/** The window opens on today, or the next day with games (r1's caption); null when no day has any. */
export function rainOpenDay(src: RainSource): string | null {
  return rainDays(src)[0]?.day ?? null;
}

/** The day's list: each published division's games in time order (filtered to one place), and the drafts with games. */
export function rainList(src: RainSource, day: string, place: string | null): RainList {
  const onDay = src.games.filter(g => dayOf(g) === day);
  const pub = publishedIds(src);
  const listed = onDay.filter(g => pub.has(g.divisionId));
  const places = [...new Set(listed.map(g => g.place).filter((p): p is string => !!p))].sort((a, b) => a.localeCompare(b));
  const shown = place ? listed.filter(g => g.place === place) : listed;
  const divisions: RainListDivision[] = [];
  for (const d of src.divisions) {
    if (!d.published) continue;
    const games = shown.filter(g => g.divisionId === d.id)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id));
    if (!games.length) continue;
    divisions.push({ id: d.id, name: d.name, games, teams: teamsHearing(games).size });
  }
  const drafts = src.divisions.filter(d => !d.published && onDay.some(g => g.divisionId === d.id)).map(d => d.name);
  return { places, divisions, drafts };
}

/** What the press will do with these games: the counts under the list and on the button. */
export function rainSummary(src: RainSource, ticked: ReadonlySet<string>): RainSummary {
  const games = src.games.filter(g => ticked.has(g.id));
  const byDivision = new Map<string, RainGame[]>();
  for (const g of games) (byDivision.get(g.divisionId) ?? byDivision.set(g.divisionId, []).get(g.divisionId)!).push(g);
  // Each family's emails: one per division whose ticked games its children's teams play in.
  const reachedBy = new Map<number, number>();
  for (const mine of byDivision.values()) {
    const divTeams = teamsHearing(mine);
    src.families.forEach((f, i) => { if (f.some(t => divTeams.has(t))) reachedBy.set(i, (reachedBy.get(i) ?? 0) + 1); });
  }
  const counts = [...reachedBy.values()];
  return {
    games: games.length,
    teams: teamsHearing(games).size,
    divisions: byDivision.size,
    families: counts.length,
    emails: counts.reduce((n, c) => n + c, 0),
    multi: counts.filter(c => c > 1).length,
  };
}

/** The day's practices, named and never touched (9e·10): how many are on the club's time, how many booked by hand. */
export function rainPractices(src: RainSource, day: string): { club: number; hand: number } | null {
  const onDay = src.practices.filter(p => dayOf(p) === day);
  if (!onDay.length) return null;
  const club = onDay.filter(p => p.club).length;
  return { club, hand: onDay.length - club };
}

// ── The words ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const families = (n: number) => pluralize(n, 'family', 'families');
const gamesWord = (n: number) => pluralize(n, 'game');
const emailsWord = (n: number) => pluralize(n, 'email');
const verbWord = (v: RainVerb) => (v === 'postponed' ? 'Postpone' : 'Cancel');
const changesWord = (v: RainVerb, n: number) => pluralize(n, v === 'postponed' ? 'postponement' : 'cancellation');
/** "U10 Division" → "U10", for the phone and the result's per-division counts. */
export const shortDivision = (name: string) => name.replace(/\s+division$/i, '').trim() || name;
const teamsCoaches = (teams: number) => `The ${possessive(pluralize(teams, 'team'))} coaches`;
/** "5:30 p.m." in the org's zone. */
const rainClock = (iso: string) => formatTime(utcToZonedInputs(iso).time);

export const RAIN_WORDS = {
  button: 'Rainout',
  title: 'Rainout',
  day: 'Day',
  /** "Today · Thu, Jun 17 · 12 games still to play" · "Fri, Jun 18 · 4 games still to play". */
  dayValue: (day: string, today: string, n: number) =>
    `${day === today ? 'Today · ' : ''}${formatShortWeekdayDate(day)} · ${gamesWord(n)} still to play`,
  /** The phone's shorter pick: "Today · Thu, Jun 17". */
  dayValuePhone: (day: string, today: string) => `${day === today ? 'Today · ' : ''}${formatShortWeekdayDate(day)}`,
  what: 'What happens to them',
  postpone: 'Postpone them',
  postponeSub: 'They leave their week and wait under “Needs a new date”. You give each a new date later.',
  postponeSubPhone: 'They wait under “Needs a new date”.',
  cancel: 'Cancel them',
  cancelSub: 'They stay on the schedule, struck through. You can put one back on later.',
  cancelSubPhone: 'They stay on the schedule, struck through.',
  which: 'Which games',
  allPlaces: 'All places',
  /** "U10 Division · 4 games · 8 teams" (the counts after the name). */
  divCounts: (games: number, teams: number) => `${gamesWord(games)} · ${pluralize(teams, 'team')}`,
  /** The phone's row: "4 of 4". */
  divOf: (ticked: number, all: number) => `${ticked} of ${all}`,
  game: (home: string, away: string) => `${home} vs ${away}`,
  /** "5:30 p.m. · Maple Grove Park · Diamond 1". */
  gameWhere: (iso: string, place: string | null, field: string | null) =>
    [rainClock(iso), place, field].filter(Boolean).join(' · '),
  /** The list's column headings and the division box's name (build words: the table's own). */
  colGame: 'Game',
  colWhen: 'Time and place',
  everyGame: (division: string) => `Every ${division} game`,
  draft: (division: string) => `${division} is a draft, so none of its games are listed.`,
  none: 'No games are left to play on this day.',
  noneAtAll: 'No games are left to play.',
  tickOne: 'Tick at least one game.',

  /** 10.1: what the press will do, always under the list. */
  sum: (games: number, teams: number, divisions: number) =>
    `${gamesWord(games)}, ${pluralize(teams, 'team')}, ${pluralize(divisions, 'division')}.`,
  sumMail: (emails: number, fam: number, sends: number, multi: number, teams: number) =>
    `${emailsWord(emails)} to ${families(fam)}, sent as ${sends}, one per division.`
    + (multi > 0
      ? ` ${multi} of those families ${multi === 1 ? 'has' : 'have'} children in two divisions and ${multi === 1 ? 'gets' : 'get'} two emails.`
      : '')
    + ` ${teamsCoaches(teams)} get a copy.`,
  sumOne: (emails: number, fam: number, teams: number) =>
    `One division: ${emailsWord(emails)} to ${families(fam)}. ${teamsCoaches(teams)} get a copy.`,
  sumCap: `Doesn’t count toward today’s ${CLUB_EMAIL_CAP}.`,
  sumNone: (teams: number) => `No families to email. The coaches of the ${pluralize(teams, 'team')} get a copy.`,
  sumHold: 'Nobody is emailed now. The changes wait in Changes to send.',
  sumPhone: (games: number, emails: number, fam: number, sends: number, multi: number) =>
    `${gamesWord(games)}. ${emailsWord(emails)} to ${families(fam)}${sends > 1 ? ` in ${sends} sends` : ''}.`
    + (multi > 0 ? ` ${multi} ${multi === 1 ? 'gets' : 'get'} two.` : ''),

  /** 10.2: the day's practices are named, not touched. */
  pracToday: 'Tonight’s practices aren’t changed here.',
  pracDay: (day: string) => `Practices on ${formatShortWeekdayDate(day)} aren’t changed here.`,
  /** "{3} use the club’s time: change them in the club’s Schedules." — `link` is the linked word. */
  pracClub: (n: number) => ({
    lead: `${n} ${n === 1 ? 'uses' : 'use'} the club’s time: change ${n === 1 ? 'it' : 'them'} in the club’s `,
    link: 'Schedules', tail: '.',
  }),
  pracHand: (n: number) => ({
    lead: `${n} ${n === 1 ? 'was' : 'were'} booked by hand: change ${n === 1 ? 'it' : 'them'} in `,
    link: 'Practices',
    tail: `. Cancelling ${n === 1 ? 'it' : 'them'} doesn’t email families.`,
  }),
  pracPhone: (club: number, hand: number) => {
    const parts = [
      club > 0 ? `${club} ${club === 1 ? 'uses' : 'use'} the club’s time (Schedules)` : null,
      hand > 0 ? `${hand} ${hand === 1 ? 'was' : 'were'} booked by hand (Practices; cancelling ${hand === 1 ? 'it' : 'them'} emails no one)` : null,
    ].filter(Boolean);
    return `Practices aren’t changed here: ${parts.join(', ')}.`;
  },

  /** 10.3: email, the line, the buttons. */
  email: 'Email the families now',
  emailHelp: 'Untick to hold them in Changes to send and review first.',
  lineLabel: 'A line for the email',
  lineHint: 'You can leave this empty. It goes at the top of the family email and the coaches’ copy, in your words. 120 characters at most.',
  linePlaceholder: 'For example: the fields are closed tonight.',
  lineCount: (left: number) => `${Math.max(0, left)} left`,
  lineHeld: 'It goes out with the changes when you send them.',
  foot: 'Nothing changes until you press the button.',
  footPhone: 'Nothing changes until you press.',
  close: 'Close',
  /** "Postpone 12 games and email 214 families" · "Postpone 12 games" (the tick off, or nobody to email). */
  go: (verb: RainVerb, games: number, fam: number | null) =>
    `${verbWord(verb)} ${gamesWord(games)}${fam ? ` and email ${families(fam)}` : ''}`,
  goPhone: (verb: RainVerb, games: number, fam: number | null) =>
    `${verbWord(verb)} ${gamesWord(games)}${fam ? `, email ${fam}` : ''}`,
  sending: 'Sending…',
  errChanged: 'These games changed while the window was open. Nothing was changed. Look again.',
  errFinished: (season: string) => `${season} has finished, so games can’t be called off.`,
  /** A build word: the window's read failed. */
  loadFailed: 'The day’s games didn’t load. Close the window and try again.',

  /** 11.1: told now. */
  doneTitle: (verb: RainVerb, n: number) => `${gamesWord(n)} ${verb}`,
  /** "214 emails sent (U10 74, U12 88, U14 52). The 24 teams’ coaches have a copy." */
  doneSent: (emails: number, parts: readonly { name: string; emails: number }[], teams: number) =>
    (emails === 0
      ? 'No families to email.'
      : `${emailsWord(emails)} sent${parts.length > 1 ? ` (${parts.map(p => `${shortDivision(p.name)} ${p.emails}`).join(', ')})` : ''}.`)
    + ` ${teamsCoaches(teams)} have a copy.`,
  doneNoUndo: (verb: RainVerb) => (verb === 'postponed'
    ? 'Emails can’t be taken back. To change a game, give it a new date; its families are told again.'
    : 'Emails can’t be taken back. To bring a game back, put it back on the schedule; its families are told again.'),
  done: 'Done',
  doneDates: 'Give them new dates',

  /** 11.2: one send failed, or all. */
  failSome: (told: readonly string[], toldFamilies: number, failed: readonly string[], verb: RainVerb, changes: number) =>
    `${joinWithAnd(told.map(shortDivision))} families were emailed (${toldFamilies}). The ${joinWithAnd(failed.map(shortDivision))} `
    + `${failed.length === 1 ? 'email' : 'emails'} didn’t go: ${failed.length === 1 ? 'its' : 'their'} ${changesWord(verb, changes)} `
    + `${changes === 1 ? 'is' : 'are'} waiting in Changes to send.`,
  failAll: (verb: RainVerb, changes: number) =>
    `No emails went. The ${changesWord(verb, changes)} ${changes === 1 ? 'is' : 'are'} waiting in Changes to send.`,
  failOpen: 'Open Changes to send',
  failAgain: 'Those families were already emailed. Nothing more was sent.',

  /** 11.3: held, and Put all back. */
  heldBody: (n: number) =>
    `Nobody has been told. The ${pluralize(n, 'change')} ${n === 1 ? 'is' : 'are'} waiting in Changes to send.`,
  heldUndo: (n: number) =>
    `You can put all ${n} back until the changes are sent. If any game has changed since, nothing is put back and you can undo them one at a time in Changes to send.`,
  back: (n: number) => `Put all ${n} back`,
  heldSend: 'Send the changes',
  /** The banner at the top of Changes to send, while Put all back still works. */
  banner: (day: string, n: number, verb: RainVerb) =>
    `Rainout on ${formatShortWeekdayDate(day)}: ${gamesWord(n)} ${verb}, waiting to be sent.`,
  backTitle: (n: number) => `Put all ${gamesWord(n)} back?`,
  backBody: 'They return to the schedule at their old times. Nobody was told, so nobody is told now.',
  backKeep: (verb: RainVerb) => `Keep them ${verb}`,
  backDone: (n: number) => `${gamesWord(n)} put back. Nothing was sent.`,
  backRefused: 'A game changed since, so nothing was put back. You can undo them one at a time in Changes to send.',
  backGone: 'These changes were already sent, so they can’t be put back.',
};

/** The line's limit (9e·14), the press's and the database's. */
export const RAIN_LINE_MAX = 120;

/** One line, as typed: runs of spaces and line breaks become one space; the ends are trimmed. Null when empty. */
export function rainLine(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const line = raw.replace(/\s+/g, ' ').trim();
  return line || null;
}
