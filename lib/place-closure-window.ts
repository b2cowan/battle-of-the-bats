import { joinWithAnd, pluralize, possessive, formatTime } from './utils';
import { formatShortWeekdayDate, utcToZonedInputs } from './timezone';
import { CLUB_EMAIL_CAP } from './families-words';
import { teamsHearing } from './league-game-changes';
import { LEAGUE_RUNNER_ROLES } from './house-league-access';
import { RAIN_LINE_MAX, shortDivision } from './league-rainout';
import { CLOSURE_MAX_EXTRA_DAYS, closedPlaceName, stripSentence, type ClosedPlace, type ClosureVerb, type PlaceMatch } from './place-closures';
import type { OrgRole } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLOSE A PLACE, THE WINDOW'S PLAN AND WORDS (Club Website Stage 2, Session 2B; rulings K1–K17, plan
 * CLUB_WEBSITE_ENHANCEMENTS_PLAN.md §7; the drawing's tabs 2, 3 and 7; the words its tab 9 lists and plan §10). Pure and
 * client-safe: the window, the routes and the tests read the same plan and the same words.
 *
 * ⚖ WHO (K1): the Rainout's people — owner, admin, house league admin (`canClosePlace`). A house league admin sees the rep
 *   games as a count with no names (`repHidden`) and each tournament by its name with no door (`door`), as drawn (tab 2).
 * ⚖ WHAT IS TICKED when the window opens: a game ON the place (its id), still to start, in a published division. A game
 *   found by its typed text (K7), a game already started (K6) and a draft division's game are listed unticked (the draft's
 *   can't be ticked at all: the press refuses it). Scored and called-off games are never listed (the server's read).
 * ⚖ THE COUNTS are the send's own (the Rainout's rule): one email per family PER DIVISION, so two seasons on one Saturday
 *   are two seasons' sends. The rep coach is one email per team, whatever its games.
 * ⚖ NO HOLD (K5): nothing here offers "Email the families now". The press sends.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** K1: owner, admin and house league admin close and reopen a place (the Rainout's people). */
export function canClosePlace(role: OrgRole | null | undefined): boolean {
  return !!role && LEAGUE_RUNNER_ROLES.includes(role);
}
/** K1: only an owner or an admin may close every place at once, or open a tournament's Rain delay from here. */
export function seesEveryProgram(role: OrgRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export const CLOSE_LINE_MAX = RAIN_LINE_MAX;

// ── What the window reads (`GET /api/admin/org/place-closures`) ────────────────────────────────────────────────────

export interface CloseVenue { id: string; name: string; facilities: { id: string; name: string }[] }

/** The window's frame: the club's places, its day, and whether this person may close every place. */
export interface CloseFrame {
  today: string;
  venues: CloseVenue[];
  /** Owner or admin (K1, K15: "All our places" stays in the Place picker for them). */
  canAll: boolean;
  /** The club runs rep teams (K14: the rep steps are absent where rep teams are absent). */
  rep: boolean;
}

export interface CloseLeagueGame {
  id: string; seasonId: string; divisionId: string; published: boolean;
  homeTeamId: string; awayTeamId: string; home: string; away: string; scheduledAt: string;
  /** Its diamond's name (a game on the place), or null. */
  field: string | null;
  typed: string | null; linkedToPlace: boolean;
  place: number; match: PlaceMatch; started: boolean; seen: string;
}
export interface CloseRepGame {
  id: string; teamId: string;
  /** Empty when the person can't see rep (K1: a count, no names). */
  teamName: string; opponent: string | null; startsAt: string;
  field: string | null; typed: string | null; linkedToPlace: boolean;
  place: number; match: PlaceMatch; started: boolean; seen: string;
}
export interface CloseTournament {
  id: string; name: string; games: number; atPlace: number; diamondIds: string[];
  /** The person may open its Rain delay (K1, K13). */
  door: boolean;
}

/** Whom the rep email reaches for a team: its head coach, its other coaches (no head coach on file), or nobody. */
export type RepReach = 'head' | 'others' | 'none';

export interface CloseSource {
  today: string;
  places: ClosedPlace[];
  seasons: { id: string; name: string; divisions: { id: string; name: string; published: boolean }[] }[];
  league: CloseLeagueGame[];
  rep: CloseRepGame[];
  /** K1: a house league admin sees rep as a count. */
  repHidden: boolean;
  tournaments: CloseTournament[];
  practices: number;
  /** One entry per family per season (a guardian email): the teams its children play on. No email leaves the server. */
  families: string[][];
  /** Per rep team listed: whom its email reaches. */
  repReach: Record<string, RepReach>;
}

/** A closure still showing, as staff read it: the Venue library's row, the Overview's line, Reopen's question. */
export interface StaffClosure {
  id: string; scope: ClosedPlace['scope']; venueId: string | null; placeName: string | null; facilityName: string | null;
  firstDay: string; lastDay: string; verb: ClosureVerb; closedAt: string; closedBy: string | null;
  /** House league games this closure called off that still read as it left them (the postponed ones wait for a date). */
  leagueCalledOff: number;
  /** Its house league seasons (the result's "Give them new dates" door). */
  seasonIds: string[];
  /** Rep marks standing now; the teams whose coach Reopen would email, and their names (empty for a house league admin, K1). */
  marks: number;
  markTeams: string[];
  markTeamNames: string[];
}

// ── The plan ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ticked when the window opens: on the place by its id, not started, and (house league) in a published division. */
export function defaultTicks(src: CloseSource): Set<string> {
  const out = new Set<string>();
  for (const g of src.league) if (g.match === 'linked' && !g.started && g.published) out.add(g.id);
  for (const g of src.rep) if (g.match === 'linked' && !g.started) out.add(g.id);
  return out;
}

/** A game in the typed-by-hand group: found by its place's name, not its id (K7). */
export const isTyped = (g: { match: PlaceMatch }) => g.match === 'maybe';
/** "Link both" can link it: it has no place at all, only typed words (a game on the place with no diamond is not typed). */
export const canLink = (g: { linkedToPlace: boolean; typed: string | null }) => !g.linkedToPlace && !!g.typed;

export interface CloseSummary {
  /** House league and rep games ticked. */
  games: number;
  league: number;
  rep: number;
  teams: number;
  /** One send per division. */
  divisions: number;
  families: number;
  emails: number;
  multi: number;
  /** Rep teams with a ticked game, and their reach. */
  repTeams: { teamId: string; name: string; reach: RepReach }[];
}

/** What the press will do with these ticks: the summary and the button's count (the Rainout's arithmetic). */
export function closeSummary(src: CloseSource, ticked: ReadonlySet<string>): CloseSummary {
  const league = src.league.filter(g => ticked.has(g.id) && g.published);
  const rep = src.rep.filter(g => ticked.has(g.id));
  const byDivision = new Map<string, CloseLeagueGame[]>();
  for (const g of league) (byDivision.get(g.divisionId) ?? byDivision.set(g.divisionId, []).get(g.divisionId)!).push(g);
  const reachedBy = new Map<number, number>();
  for (const mine of byDivision.values()) {
    const divTeams = teamsHearing(mine);
    src.families.forEach((f, i) => { if (f.some(t => divTeams.has(t))) reachedBy.set(i, (reachedBy.get(i) ?? 0) + 1); });
  }
  const counts = [...reachedBy.values()];
  const repTeams = [...new Map(rep.map(g => [g.teamId, { teamId: g.teamId, name: g.teamName, reach: src.repReach[g.teamId] ?? 'none' }])).values()];
  return {
    games: league.length + rep.length, league: league.length, rep: rep.length,
    teams: teamsHearing(league).size, divisions: byDivision.size,
    families: counts.length, emails: counts.reduce((n, c) => n + c, 0), multi: counts.filter(c => c > 1).length,
    repTeams,
  };
}

/** The typed games "Link both" links: the ticked ones when any are ticked, else every linkable one listed (K7). */
export function linkTargets(src: CloseSource, ticked: ReadonlySet<string>): { kind: 'league' | 'rep'; id: string; venueId: string }[] {
  const typed = [
    ...src.league.filter(g => isTyped(g) && canLink(g) && g.published).map(g => ({ kind: 'league' as const, g })),
    ...(src.repHidden ? [] : src.rep.filter(g => isTyped(g) && canLink(g)).map(g => ({ kind: 'rep' as const, g }))),
  ];
  const anyTicked = typed.some(t => ticked.has(t.g.id));
  return typed.filter(t => !anyTicked || ticked.has(t.g.id)).flatMap(t => {
    const venueId = src.places[t.g.place]?.venueId;
    return venueId ? [{ kind: t.kind, id: t.g.id, venueId }] : [];
  });
}

/** The Day picker: today and the next 13 days. The Until picker: the Day to 13 days after it (mig 539's limit). */
export function closeDays(today: string, addDays: (d: string, n: number) => string): string[] {
  return Array.from({ length: CLOSURE_MAX_EXTRA_DAYS + 1 }, (_, i) => addDays(today, i));
}
export function untilDays(first: string, addDays: (d: string, n: number) => string): string[] {
  return Array.from({ length: CLOSURE_MAX_EXTRA_DAYS + 1 }, (_, i) => addDays(first, i));
}

/** The strip each closed place will put up (the window's preview), in the club's day. */
export function previewSentences(places: readonly ClosedPlace[], firstDay: string, lastDay: string, today: string): string[] {
  return places.map(p => stripSentence({
    scope: p.scope, placeName: p.name, facilityName: p.scope === 'diamond' ? p.facilityName ?? null : null, firstDay, lastDay,
  }, today, formatShortWeekdayDate));
}

// ── The words ──────────────────────────────────────────────────────────────────────────────────────────────────────

const gamesWord = (n: number) => pluralize(n, 'game');
const families = (n: number) => pluralize(n, 'family', 'families');
const emailsWord = (n: number) => pluralize(n, 'email');
const teamsCoaches = (teams: number) => `The ${possessive(pluralize(teams, 'team'))} coaches`;
/** "12:30 p.m." in the club's zone. */
export const closeClock = (iso: string) => formatTime(utcToZonedInputs(iso).time);
const q = (s: string) => `“${s}”`;

/** The place's name in a sentence: "Lions Park", "Diamond 2 at Lions Park", "all our fields". */
export function placeWord(p: ClosedPlace): string {
  return closedPlaceName({ scope: p.scope, placeName: p.name, facilityName: p.facilityName ?? null }) ?? 'all our fields';
}
/** "Lions Park" · "Lions Park and Harbourview Park" · "those places" (three or more). */
export function placesWord(places: readonly ClosedPlace[]): string {
  if (places.length === 1) return placeWord(places[0]);
  return places.length === 2 ? joinWithAnd(places.map(placeWord)) : 'those places';
}
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const CLOSE_WORDS = {
  title: 'Close a place',
  door: 'Close a place',
  eyebrow: 'Venue library',
  place: 'Place',
  everyPlace: 'All our fields',
  /** K15: the Rainout button's pick. "This season’s places today (2)". */
  seasonPlaces: (n: number, isToday: boolean) => `This season’s places ${isToday ? 'today' : 'that day'} (${n})`,
  allDiamonds: 'All diamonds',
  diamonds: 'Diamonds',
  day: 'Day',
  /** "Today · Sat, Nov 28" · "Sun, Nov 29". */
  dayValue: (day: string, today: string) => `${day === today ? 'Today · ' : ''}${formatShortWeekdayDate(day)}`,
  until: 'Until',
  untilSame: 'The end of that day',
  untilDay: (day: string) => `The end of ${formatShortWeekdayDate(day)}`,
  what: 'What happens to house league games',
  postpone: 'Postpone them',
  postponeSub: 'They leave their week and wait under “Needs a new date”. You give each a new date later.',
  postponeSubPhone: 'They wait under “Needs a new date”.',
  cancel: 'Cancel them',
  cancelSub: 'They stay on the schedule, struck through. You can put one back on later.',
  cancelSubPhone: 'They stay on the schedule, struck through.',
  /** "What’s at Lions Park that day" · "What’s at those places that day". */
  whatsAt: (places: readonly ClosedPlace[]) => `What’s at ${placesWord(places)} that day`,
  whatsAtDays: (places: readonly ClosedPlace[]) => `What’s at ${placesWord(places)}`,
  colGame: 'Game',
  colWhen: 'Time and place',

  // The groups (drawing tab 2).
  league: 'House league',
  /** "2026 House League · 4 games · 8 teams". */
  leagueCount: (season: string, games: number, teams: number | null) =>
    `${season} · ${gamesWord(games)}${teams != null ? ` · ${pluralize(teams, 'team')}` : ''}`,
  rep: 'Rep',
  repCount: (games: number) => `marked for the coach · ${gamesWord(games)}`,
  /** The folded band's line, by whom the email reaches (/legal 2B: say who is really emailed). */
  repCountPhone: (games: number, reach: RepReach) =>
    `marked, not moved · ${gamesWord(games)} · ${reach === 'none' ? 'no coach to email' : reach === 'others' ? 'its coaches are emailed' : 'its head coach is emailed'}`,
  /** The row's line: the drawn words for a team with a head coach; its other coaches, or nobody, said as they are. */
  repNote: (reach: RepReach) => (reach === 'none'
    ? 'Marked, not moved. It has no coach to email, so let the team know yourself.'
    : reach === 'others'
      ? 'Marked, not moved. Its coaches are emailed (it has no head coach on file) and set the new date.'
      : 'Marked, not moved. Its head coach is emailed and sets the new date.'),
  /** K1: a house league admin's rep row. */
  repHiddenCount: (games: number) => `${gamesWord(games)} · marked for its coach`,
  repHiddenLine: (games: number, places: readonly ClosedPlace[]) =>
    `${games === 1 ? '1 rep game' : `${games} rep games`} at ${placesWord(places)} that day`,
  repHiddenSub: 'It is marked for its coach when you close.',
  repHiddenSubMany: 'They are marked for their coaches when you close.',
  typed: 'Place typed by hand',
  /** "may be Lions Park · 2 games". */
  typedCount: (places: readonly ClosedPlace[], games: number) => `may be ${placesWord(places)} · ${gamesWord(games)}`,
  typedLine: (text: string) => `Typed: ${q(text)}`,
  /** K7: "Link both to Lions Park" · "Link all 5 ticked to Lions Park" · "Link all 3 to Lions Park". */
  linkLabel: (n: number, anyTicked: boolean, places: readonly ClosedPlace[]) => {
    const to = places.length === 1 ? placeWord(places[0]) : 'their places';
    return anyTicked ? `Link all ${n} ticked to ${to}` : n === 2 ? `Link both to ${to}` : n === 1 ? `Link it to ${to}` : `Link all ${n} to ${to}`;
  },
  linkHelp: 'So they match next time. Families aren’t told: the game is where it was.',
  /** Build words: the link is chosen and happens at the press. */
  linkOn: (n: number, places: readonly ClosedPlace[]) =>
    `${n === 1 ? 'It is' : `${n} are`} linked to ${places.length === 1 ? placeWord(places[0]) : 'their places'} when you close. Families aren’t told.`,
  linkUndo: 'Don’t link',
  started: (iso: string) => `Started at ${closeClock(iso)}`,
  startedTick: 'Tick it to call it off mid-game.',
  draft: (division: string) => `${division} is a draft, so none of its games are listed.`,
  notChanged: 'Not changed here',
  tournament: 'Tournament',
  tournamentSub: 'moved in its own Rain delay',
  tournamentSubNoDoor: 'its director moves them',
  /** "4 games on Lions Park’s diamonds today". */
  tournamentAt: (n: number, places: readonly ClosedPlace[], isToday: boolean) =>
    `${gamesWord(n)} on ${places.length === 1 && places[0].scope !== 'all' ? possessive(places[0].name ?? '') : 'those places’'} diamonds ${isToday ? 'today' : 'that day'}`,
  tournamentAtAll: (n: number, isToday: boolean) => `${gamesWord(n)} ${isToday ? 'today' : 'that day'}`,
  tournamentUnlinked: (isToday: boolean) =>
    `Plays ${isToday ? 'today' : 'that day'}. Its diamonds aren’t linked to your places, so its games aren’t counted here.`,
  tournamentDoor: 'After you close',
  practices: (n: number, places: readonly ClosedPlace[], isToday: boolean) =>
    `${n === 1 ? '1 practice' : `${n} practices`} at ${placesWord(places)} ${isToday ? 'today' : 'that day'} ${n === 1 ? 'isn’t' : 'aren’t'} changed here.`,
  closing: (games: number, teams: number) => `${gamesWord(games)}, ${pluralize(teams, 'team')}.`,
  /** The phone's folded header: "Not changed here · 1 tournament (its own Rain delay) · 2 practices". */
  notChangedCount: (tournaments: number, practices: number, door: boolean) => [
    tournaments ? `${pluralize(tournaments, 'tournament')}${door ? ' (its own Rain delay)' : ''}` : null,
    practices ? pluralize(practices, 'practice') : null,
  ].filter(Boolean).join(' · '),

  // The summary (a Statement) and the site's preview.
  /** Phone: "5 games. 58 families emailed in 2 sends, and 1 rep coach." */
  sumPhone: (s: CloseSummary) => {
    const coaches = s.repTeams.filter(t => t.reach !== 'none').length;
    const mail = s.emails > 0 ? `${s.emails} ${s.emails === 1 ? 'family' : 'families'} emailed${s.divisions > 1 ? ` in ${s.divisions} sends` : ''}` : null;
    const rep = coaches > 0 ? `${coaches} rep ${coaches === 1 ? 'coach' : 'coaches'}` : null;
    if (mail && rep) return `${gamesWord(s.games)}. ${mail}, and ${rep}.`;
    if (mail) return `${gamesWord(s.games)}. ${mail}.`;
    if (rep) return `${gamesWord(s.games)}. ${cap(rep)} emailed.`;
    return `${gamesWord(s.games)}. No families to email.`;
  },
  /** Computer: the Rainout's long sentence, then the rep line. */
  sumComputer: (s: CloseSummary) => {
    const league = s.league === 0 ? ''
      : s.emails === 0 ? `No families to email. ${teamsCoaches(s.teams)} get a copy.`
      : s.divisions > 1
        ? `${emailsWord(s.emails)} to ${families(s.families)}, sent as ${s.divisions}, one per division.`
          + (s.multi > 0 ? ` ${s.multi} of those families ${s.multi === 1 ? 'has' : 'have'} children in two divisions and ${s.multi === 1 ? 'gets' : 'get'} two emails.` : '')
          + ` ${teamsCoaches(s.teams)} get a copy.`
        : `${emailsWord(s.emails)} to ${families(s.families)}. ${teamsCoaches(s.teams)} get a copy.`;
    return [league, ...repLines(s)].filter(Boolean).join(' ');
  },
  sumCap: `Doesn’t count toward today’s ${CLUB_EMAIL_CAP}.`,
  /** "Your site says “Lions Park is closed today.” at once, until the end of Sat, Nov 28." */
  site: (sentences: readonly string[], lastDay: string) => ({
    lead: 'Your site says ',
    said: joinWithAnd(sentences.map(q)),
    rest: ` at once, until the end of ${formatShortWeekdayDate(lastDay)}.`,
  }),
  lineOpen: 'Add a line for the families’ email',
  lineOpenHelp: 'It goes at the top of their email and the coaches’ copy. It isn’t shown on your site.',
  lineLabel: 'A line for the families’ email',
  lineHint: 'You can leave this empty. It goes at the top of the families’ email and the coaches’ copy. It isn’t shown on your site. 120 characters at most.',
  linePlaceholder: 'For example: the fields are flooded.',
  lineCount: (left: number) => `${Math.max(0, left)} left`,
  foot: 'Nothing changes until you press the button.',
  footPhone: 'Nothing changes until you press.',
  notNow: 'Not now',
  /** "Close Lions Park, email 58" · "Close Lions Park and email 58 families" · "Close Pinecrest Park". */
  go: (places: readonly ClosedPlace[], emails: number, phone: boolean) => {
    const what = places.length === 1 ? (places[0].scope === 'all' ? 'all our fields' : (places[0].scope === 'diamond' ? places[0].facilityName ?? placeWord(places[0]) : places[0].name ?? ''))
      : places.length === 2 ? 'both' : `${places.length} places`;
    const verb = `Close ${what}`;
    if (emails <= 0) return verb;
    return phone ? `${verb}, email ${emails}` : `${verb} and email ${families(emails)}`;
  },
  sending: 'Closing…',
  empty: (places: readonly ClosedPlace[], day: string) =>
    `Nothing is scheduled at ${placesWord(places)} on ${formatShortWeekdayDate(day)}. Closing it still tells families on your site.`,
  noPlacesTitle: 'Your club has no places yet.',
  noPlacesBody: 'Add your parks and diamonds in the Venue library, then close one here. Your schedules can keep their typed places; a closure finds them by the place’s name.',
  noPlacesDoor: 'Open the Venue library',
  loadFailed: 'The day’s games didn’t load. Close the window and try again.',

  // Refusals (build words).
  errChanged: 'Some games changed while the window was open. Nothing was changed. Look again.',
  errPast: 'That day has passed. Nothing was changed. Pick today or a later day.',
  errDraft: 'A game in a draft division can’t be called off. Nothing was changed. Look again.',
  errFinished: 'A season finished while the window was open, so nothing was changed. Look again.',
  errNotFound: 'A game or place isn’t there any more. Nothing was changed. Look again.',
  errInvalid: 'The request was not understood',
  errNetwork: 'We couldn’t tell if the closure went through. Check your connection, then press again: it closes once, however many times you press.',

  // The result (drawing tab 3).
  doneTitle: (places: readonly ClosedPlace[]) => `${cap(placesWord(places))} closed`,
  /** "4 house league games postponed. 58 emails sent (U11 31, U15 27). The 8 teams’ coaches have a copy." */
  doneLeague: (games: number, verb: ClosureVerb, emails: number, parts: readonly { name: string; emails: number }[], teams: number) =>
    `${games === 1 ? '1 house league game' : `${games} house league games`} ${verb}. `
    + (emails === 0 ? 'No families to email.' : `${emailsWord(emails)} sent${parts.length > 1 ? ` (${parts.map(p => `${shortDivision(p.name)} ${p.emails}`).join(', ')})` : ''}.`)
    + ` ${teamsCoaches(teams)} have a copy.`,
  /** Every division was already emailed (a press pressed again, or someone sent them first): the Rainout's words. */
  doneAlready: (games: number, verb: ClosureVerb) =>
    `${games === 1 ? '1 house league game' : `${games} house league games`} ${verb}. Those families were already emailed. Nothing more was sent.`,
  /** A season's send could not start: its changes wait, as a failed division's do. */
  doneUnsent: 'Some house league emails didn’t go: their changes are waiting in Changes to send.',
  /** One send or more failed: the Rainout's words. */
  doneFailed: (failed: readonly string[], verb: ClosureVerb, changes: number) =>
    (failed.length === 0 ? 'Some emails didn’t go: their ' : `The ${joinWithAnd(failed.map(shortDivision))} ${failed.length === 1 ? 'email' : 'emails'} didn’t go: ${failed.length === 1 ? 'its' : 'their'} `)
    + `${pluralize(changes, verb === 'postponed' ? 'postponement' : 'cancellation')} ${changes === 1 ? 'is' : 'are'} waiting in Changes to send.`,
  failOpen: 'Open Changes to send',
  /** "1 rep game marked. The U13 Ospreys’ head coach was emailed." */
  doneRep: (games: number, teams: readonly { name: string; reach: RepReach; sent: boolean }[]) =>
    [`${games === 1 ? '1 rep game' : `${games} rep games`} marked.`, ...teams.map(repDoneLine)].join(' '),
  doneTyped: (n: number) => `${n === 1 ? '1 game with a typed place wasn’t changed.' : `${n} games with a typed place weren’t changed.`}`,
  doneTypedRest: (places: readonly ClosedPlace[]) => ` They may be at ${placesWord(places)}, and they still show as scheduled.`,
  seeTyped: (n: number) => (n === 1 ? 'See the game' : `See the ${n} games`),
  /** "Kestrel Bay Winter Classic: its 4 games at Lions Park aren’t moved yet." */
  doneTournament: (name: string, n: number, places: readonly ClosedPlace[]) =>
    `${name}: ${n === 1 ? 'its 1 game' : `its ${n} games`} at ${placesWord(places)} ${n === 1 ? 'isn’t' : 'aren’t'} moved yet.`,
  doneTournamentRest: ' Its families hear through its Rain delay.',
  doneTournamentNoDoor: ' Its families hear through its Rain delay, which its tournament staff open.',
  doneUnlinked: (name: string, isToday: boolean) => `${name} plays ${isToday ? 'today' : 'that day'}.`,
  doneUnlinkedRest: (places: readonly ClosedPlace[]) =>
    ` Its diamonds aren’t linked to your places. If it plays at ${placesWord(places)}, open its Rain delay.`,
  openRainDelay: 'Open its Rain delay',
  /** The Rain delay's amber line, opened from a closure (K13): "Kestrel Bay Softball Association closed Lions Park today.
   *  Its diamonds are picked below." */
  rainDelayLine: (club: string, place: string, day: string, today: string) =>
    `${club} closed ${place} ${day === today ? 'today' : `on ${formatShortWeekdayDate(day)}`}. Its diamonds are picked below.`,
  /** "Your site says “Lions Park is closed today.” until the end of Sat, Nov 28. Reopen it from the Venue library." */
  doneSite: (sentences: readonly string[], lastDay: string) =>
    `Your site says ${joinWithAnd(sentences.map(q))} until the end of ${formatShortWeekdayDate(lastDay)}. Reopen it from the Venue library.`,
  doneNoUndo: (verb: ClosureVerb) => (verb === 'postponed'
    ? 'Emails can’t be taken back. To change a game, give it a new date; its families are told again.'
    : 'Emails can’t be taken back. To bring a game back, put it back on the schedule; its families are told again.'),
  done: 'Done',
  newDates: 'Give them new dates',
  replay: 'This closure was already made. Nothing more was sent.',

  // Reopen (drawing tab 3).
  reopen: 'Reopen',
  reopenTitle: (place: string) => `Reopen ${place}?`,
  reopenSite: 'Your site stops saying it’s closed, at once.',
  reopenMarks: (marks: number, oneTeam: string | null, place: string) => marks === 1
    ? `${oneTeam ? `The ${possessive(oneTeam)} game` : 'The rep game'} loses its mark, and its coach gets one line: ${place} reopened, the game wasn’t moved, keep it or move it.`
    : `${marks} rep games lose their marks, and their coaches get one line: ${place} reopened, the game wasn’t moved, keep it or move it.`,
  reopenStill: (n: number) => (n === 1 ? 'The 1 postponed game stays under “Needs a new date”.' : `The ${n} postponed games stay under “Needs a new date”.`),
  reopenStillRest: ' Their families were emailed, so give each a new date from the schedule and they’re told again.',
  reopenKeep: 'Keep it closed',
  reopenGo: (coaches: number) => (coaches === 0 ? 'Reopen' : `Reopen and email ${pluralize(coaches, 'coach', 'coaches')}`),
  reopened: (place: string) => `${place} reopened`,
  reopenedSite: (coaches: number, team: string | null) =>
    `Your site no longer says it’s closed.${coaches === 0 ? '' : team && coaches === 1 ? ` The ${possessive(team)} coach was emailed.` : ` ${pluralize(coaches, 'coach', 'coaches')} were emailed.`}`,
  reopenedStill: (n: number) => (n === 1 ? '1 game still needs a new date.' : `${n} games still need new dates.`),
  reopenedStillRest: (n: number) => (n === 1 ? ' Its families are told when you give it one.' : ' Their families are told when you give each one.'),

  // The Venue library's closed row (drawing tab 3, "Where it lives").
  closed: 'Closed',
  closedToday: 'Closed today',
  /** "Lions Park · all diamonds". */
  rowName: (c: { scope: ClosedPlace['scope']; placeName: string | null; facilityName: string | null }) =>
    c.scope === 'all' ? 'All our fields' : c.scope === 'diamond' ? `${c.placeName} · ${c.facilityName}` : `${c.placeName} · all diamonds`,
  /** "Sat, Nov 28 · closed 7:10 a.m. by Dana Reyes · 4 postponed, 1 rep game marked". */
  rowLine: (c: { firstDay: string; lastDay: string; closedAt: string; closedBy: string | null; leagueCalledOff: number; verb: ClosureVerb; marks: number }) => [
    c.firstDay === c.lastDay ? formatShortWeekdayDate(c.firstDay) : `${formatShortWeekdayDate(c.firstDay)} to ${formatShortWeekdayDate(c.lastDay)}`,
    `closed ${closeClock(c.closedAt)}${c.closedBy ? ` by ${c.closedBy}` : ''}`,
    [c.leagueCalledOff ? `${c.leagueCalledOff} ${c.verb}` : null, c.marks ? `${c.marks === 1 ? '1 rep game' : `${c.marks} rep games`} marked` : null].filter(Boolean).join(', ') || null,
  ].filter(Boolean).join(' · '),
  /** The Overview's line (build words; the drawing names it, it does not word it). */
  overviewLabel: 'Places closed',
  overviewSub: (names: readonly string[]) => `${joinWithAnd(names)} · reopen from the Venue library`,
};

function repDoneLine(t: { name: string; reach: RepReach; sent: boolean }): string {
  if (t.reach === 'none') return `The ${t.name} have no coach to email, so let the team know yourself.`;
  if (!t.sent) return `The ${possessive(t.name)} coaches weren’t emailed, so let the team know yourself.`;
  return t.reach === 'head' ? `The ${possessive(t.name)} head coach was emailed.` : `The ${possessive(t.name)} coaches were emailed (it has no head coach on file).`;
}

function repLines(s: CloseSummary): string[] {
  if (!s.repTeams.length) return [];
  const reached = s.repTeams.filter(t => t.reach !== 'none');
  const none = s.repTeams.filter(t => t.reach === 'none');
  const out: string[] = [];
  const who = (t: { reach: RepReach }) => (t.reach === 'head' ? 'head coach is' : 'coaches are');
  if (reached.length === 1) out.push(`The ${possessive(reached[0].name || 'rep team')} ${who(reached[0])} emailed about the rep game${s.rep > 1 ? 's' : ''}.`);
  else if (reached.length > 1) out.push(`${reached.length} rep teams’ coaches are emailed about their games.`);
  for (const t of none) out.push(`The ${t.name || 'rep team'} have no coach to email.`);
  return out;
}

/** "Sat, Nov 28 · 9:00 a.m. · Diamond 1 · U11" (the day only when the closure runs past one day). */
export function gameWhereLine(iso: string, field: string | null, tail: string | null, withDay: boolean, dayOf: (iso: string) => string): string {
  return [withDay ? formatShortWeekdayDate(dayOf(iso)) : null, closeClock(iso), field, tail].filter(Boolean).join(' · ');
}

export type { ClosedPlace };
