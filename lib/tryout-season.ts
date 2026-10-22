/**
 * lib/tryout-season.ts — A TEAM'S TRYOUT STATE, ONE RULE (Club Tier Stage 4b-2b; drawings ruled 2026-10-19, Ask 14, R-01,
 * R-06, S4-04; the edges ruled 2026-10-20 on the asks page, "all as recommended"; words through /marketing 2026-10-20).
 *
 * Every public surface asks THIS, so no two of them can disagree: the club Tryouts page and its tab, the team's tryout
 * page, the home's Open now and the team page's door. Four states, one phrase each:
 *
 *   · Tryouts open   — the team's live season has sign-ups open (the one public tryout rule, `publicTryoutSeasonOf`).
 *                      The coach's switch wins even after every tryout day has passed: the sign-up form obeys the switch,
 *                      so calling it "Finished" while the form still takes sign-ups would make the page lie.
 *   · Not open yet   — sign-ups closed, a tryout day still ahead.
 *   · Finished       — sign-ups closed, every tryout day behind us.
 *   · Tryouts closed — sign-ups closed and no day entered (or every day cancelled), an archived team, or no live season.
 *
 * A cancelled day is left out of everything. A day "has passed" from the next day in the club's zone — a parent checking
 * the address in the car on the last morning still sees where to go. Pure, so it is unit-tested
 * (tests/unit/club-stage4b2b.test.ts); the reads are lib/club-tryouts.ts.
 */
import { addCalendarDays, formatEventDateRange, formatShortWeekdayDate, orgDayKey, utcToZonedInputs } from './timezone';
import { formatTimeRange, joinWithAnd } from './utils';
import { surfaceLabel } from './sports';
import { directionsHref, scheduleDayLabel as dayLabel } from './family-schedule-format';
import { OTHER_TEAMS_BAND } from './club-site-home';

export type TryoutState = 'open' | 'notOpenYet' | 'finished' | 'closed';

/** One phrase per meaning, sentence case (design log 2026-10-19 "Status"). */
export const TRYOUT_STATE_WORD: Record<TryoutState, string> = {
  open: 'Tryouts open',
  notOpenYet: 'Not open yet',
  finished: 'Finished',
  closed: 'Tryouts closed',
};

/** A finished team stays on the Tryouts page, and keeps its tab up, this many days after its last day (Ask 14). */
export const TRYOUT_LISTED_DAYS = 28;

/** A tryout day as the coach entered it (`rep_tryout_sessions`). */
export interface TryoutDay {
  startsAt: string;
  endsAt: string | null;
  status: string;
  location: string | null;
  locationAddress: string | null;
  fieldNumber: string | null;
}

/** The season a tryout recruits for, as the words need it. */
export interface TryoutSeasonName {
  year: number | null;
  name: string;
}

export interface TryoutStanding<D extends TryoutDay = TryoutDay> {
  state: TryoutState;
  /** The days still ahead (today included), in order — what a family can still go to. */
  upcoming: D[];
  /** Every held (not cancelled) day, `YYYY-MM-DD` in the club's zone, in order — a band's or a season's date range. */
  heldDays: string[];
  /** The last held day, and its key (a finished tryout is dated and placed by it). */
  last: D | null;
  lastDay: string | null;
}

export function tryoutStandingOf<D extends TryoutDay>(input: {
  isArchived: boolean;
  /** The team's live season (`liveSeasonOf`), or null when it has none. */
  season: { tryoutOpen: boolean } | null;
  /** That season's tryout days, any order, cancelled ones included. */
  days: readonly D[];
  /** The club's today (`tournamentToday()`). */
  today: string;
}): TryoutStanding<D> {
  if (input.isArchived || !input.season) return { state: 'closed', upcoming: [], heldDays: [], last: null, lastDay: null };
  const held = input.days
    .filter(d => d.status !== 'cancelled')
    .map(d => ({ d, key: orgDayKey(d.startsAt) }))
    .sort((a, b) => Date.parse(a.d.startsAt) - Date.parse(b.d.startsAt));
  const upcoming = held.filter(h => h.key >= input.today).map(h => h.d);
  const state: TryoutState = input.season.tryoutOpen ? 'open'
    : upcoming.length > 0 ? 'notOpenYet'
    : held.length > 0 ? 'finished'
    : 'closed';
  return { state, upcoming, heldDays: held.map(h => h.key), last: held.at(-1)?.d ?? null, lastDay: held.at(-1)?.key ?? null };
}

/** On the club Tryouts page: open, not open yet, or finished within the last four weeks. */
export function isListedTryout(s: Pick<TryoutStanding, 'state' | 'lastDay'>, today: string): boolean {
  if (s.state === 'open' || s.state === 'notOpenYet') return true;
  return s.state === 'finished' && !!s.lastDay && s.lastDay >= addCalendarDays(today, -TRYOUT_LISTED_DAYS);
}

/** The Tryouts tab shows exactly when the Tryouts page has a team to list — the tab never opens the off-season page. */
export function tryoutsTabShows(standings: readonly Pick<TryoutStanding, 'state' | 'lastDay'>[], today: string): boolean {
  return standings.some(s => isListedTryout(s, today));
}

export type OpenNowTryouts<T> = { kind: 'none' } | { kind: 'team'; team: T } | { kind: 'season'; teams: T[] };

/**
 * What the home's Open now carries for tryouts (round 2, ~L1792): when more than one team is open or not open yet, ONE
 * row for the season's tryouts, the door to the Tryouts page. Exactly one team open: that team's own row. A lone
 * not-open-yet team is not "open now", so the home says nothing (the tab still shows).
 */
export function openNowTryouts<T extends { standing: Pick<TryoutStanding, 'state'> }>(teams: readonly T[]): OpenNowTryouts<T> {
  const involved = teams.filter(t => t.standing.state === 'open' || t.standing.state === 'notOpenYet');
  if (involved.length >= 2) return { kind: 'season', teams: involved };
  if (involved.length === 1 && involved[0].standing.state === 'open') return { kind: 'team', team: involved[0] };
  return { kind: 'none' };
}

/** The year every listed team recruits for, or null when they differ (or one has none) — a title never names a year it
 *  cannot stand behind. */
export function sharedSeasonYear(teams: readonly { seasonYear: number | null }[]): number | null {
  const year = teams[0]?.seasonYear ?? null;
  return year != null && teams.every(t => t.seasonYear === year) ? year : null;
}

// ── The words ──────────────────────────────────────────────────────────────────────────────────

/** "HH:MM" in the club's zone, for `formatTimeRange`. */
function clock(iso: string): string {
  return utcToZonedInputs(iso).time;
}

export interface TryoutDayParts {
  dayLabel: string;
  time: string;
  /** "Lakeshore Dome · Diamond 2" — the venue and the sport's own surface word; either alone. */
  place: string;
  /** A maps link from the venue's address; null without one (the button is then absent). */
  directions: string | null;
  /** The button's name aloud: the visible word plus the venue, so three rows do not read "Directions" three times. */
  directionsName: string;
}

export function tryoutDayParts(d: TryoutDay, sport: string | null | undefined): TryoutDayParts {
  const venue = d.location?.trim() || '';
  return {
    dayLabel: dayLabel(d.startsAt),
    time: formatTimeRange(clock(d.startsAt), d.endsAt ? clock(d.endsAt) : null),
    place: [venue, surfaceLabel(sport, d.fieldNumber)].filter(Boolean).join(' · '),
    directions: directionsHref(d.locationAddress?.trim() || null),
    directionsName: venue ? `Directions to ${venue}` : 'Directions',
  };
}

const COUNT_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

/** The one place every remaining day shares, or null. */
function sharedPlace(days: readonly TryoutDay[]): string | null {
  const first = days[0]?.location?.trim();
  return first && days.every(d => d.location?.trim() === first) ? first : null;
}

/**
 * The days line under a tryout's door and its Open now row: "Three days from Mon, Nov 2 · Lakeshore Dome". Remaining days
 * only; one to nine spelled, then digits; the place only when every remaining day is there (naming one venue when the days
 * are split sends someone to the wrong park). Null when no day remains.
 */
export function tryoutDaysLine(upcoming: readonly TryoutDay[]): string | null {
  if (upcoming.length === 0) return null;
  const first = dayLabel(upcoming[0].startsAt);
  const n = upcoming.length;
  const when = n === 1 ? first : `${n < 10 ? COUNT_WORDS[n] : n} days from ${first}`;
  const place = sharedPlace(upcoming);
  return place ? `${when} · ${place}` : when;
}

/** "Sep 7" · "Sep 7–9" · "Aug 30 – Sep 2" — the span of a set of `YYYY-MM-DD` days, in the house range spelling
 *  (`formatEventDateRange`, the one formatter for a range); null for none. */
export function dayRangeLabel(days: readonly string[]): string | null {
  const sorted = days.filter(Boolean).slice().sort();
  return formatEventDateRange(sorted[0], sorted.at(-1), false);
}

/** "2027 tryouts", or "Tryouts" when the listed teams recruit for different seasons. */
export function tryoutsPageTitle(year: number | null): string {
  return year != null ? `${year} tryouts` : 'Tryouts';
}

/** The club's group names as a phrase, only when they are honest: every listed team sits in a named group, there are at
 *  most three, and none already ends in "teams" ("Rep Teams teams"). Otherwise null. */
function honestGroups(names: readonly (string | null)[]): string | null {
  if (names.length === 0 || names.length > 3) return null;
  if (names.some(n => !n || n === OTHER_TEAMS_BAND || /\bteams?$/i.test(n.trim()))) return null;
  return joinWithAnd(names as string[]);
}

/** "Rep and Select teams for the 2027 season" · "Teams for the 2027 season" · "Rep and Select teams" · nothing. */
export function tryoutsPageSub(year: number | null, bandNames: readonly (string | null)[]): string | null {
  const groups = honestGroups(bandNames);
  if (year != null) return groups ? `${groups} teams for the ${year} season` : `Teams for the ${year} season`;
  return groups ? `${groups} teams` : null;
}

/** "Rep · Sep 7–9", or the band's name alone when its teams have no days. */
export function bandHeading(name: string, days: readonly string[]): string {
  const range = dayRangeLabel(days);
  return range ? `${name} · ${range}` : name;
}

/** "For the 2027 season", or the season's own name when it has no year. Given the team's birth years in the form that
 *  follows a dot (`bornMeta`, lib/born-years.ts: "born 2012–2013"), the tryout page's meta: "For the 2027 season · born
 *  2012–2013" (Stage 4c-2, D9–D11). A share card calls it with the season alone. */
export function tryoutSeasonMeta(season: TryoutSeasonName, born?: string | null): string {
  const base = season.year != null ? `For the ${season.year} season` : season.name;
  return born ? `${base} · ${born}` : base;
}

/** A Tryouts page row's line: the next day and its place; a finished team, its last day (with its year when that was
 *  last year — the four-week window can cross New Year); none, its season. Given the team's born line (`bornLine`:
 *  "Born 2017–2018"), it leads: "Born 2017–2018 · Mon, Sep 7 · Lions Park" (D8); a team with no years starts at the day. */
export function tryoutsRowSub(s: TryoutStanding, season: TryoutSeasonName, today: string, born?: string | null): string {
  const lead = born ? `${born} · ` : '';
  const next = s.upcoming[0];
  const d = next ?? (s.state === 'finished' ? s.last : null);
  if (!d) return `${lead}${tryoutSeasonMeta(season)}`;
  const when = next || !s.lastDay ? dayLabel(d.startsAt) : pastDay(s.lastDay, today);
  const venue = d.location?.trim();
  return `${lead}${venue ? `${when} · ${venue}` : when}`;
}

/** The home's one tryouts row: "7 teams · Rep Sep 7–9 · Select Sep 11–13" when the groups are honest, else one range. */
export function homeTryoutsRowSub(count: number, bands: readonly { name: string | null; days: readonly string[] }[]): string {
  const lead = `${count} teams`;
  const groups = honestGroups(bands.map(b => b.name));
  if (groups) {
    const parts = bands.map(b => { const r = dayRangeLabel(b.days); return r ? `${b.name} ${r}` : null; }).filter(Boolean);
    return parts.length > 0 ? [lead, ...parts].join(' · ') : lead;
  }
  const range = dayRangeLabel(bands.flatMap(b => b.days));
  return range ? `${lead} · ${range}` : lead;
}

/** "Mon, Sep 7", with the year only when the day is in an earlier calendar year than today. */
function pastDay(day: string, today: string): string {
  const label = formatShortWeekdayDate(day);
  return day.slice(0, 4) < today.slice(0, 4) ? `${label}, ${day.slice(0, 4)}` : label;
}

function seasonWords(season: TryoutSeasonName): string {
  return season.year != null ? `${season.year} season` : season.name;
}

/** The sentence a not-open tryout page says (the open page says nothing: its days and its button speak). */
export function tryoutStateSentence(
  state: Exclude<TryoutState, 'open'>,
  teamName: string,
  season: TryoutSeasonName,
  lastDay: string | null,
  today: string,
): string {
  if (state === 'notOpenYet') return `Sign-ups for ${teamName} tryouts aren’t open yet.`;
  if (state === 'finished' && lastDay) return `Tryouts for the ${seasonWords(season)} finished on ${pastDay(lastDay, today)}.`;
  return `${teamName} isn’t taking tryout sign-ups right now.`;
}

/** The club Tryouts address out of season: when the club's last tryouts were, always with the year (it can be months
 *  old) — or, for a club that never posted one, plainly so. */
export function offSeasonSentence(lastDay: string | null): string {
  return lastDay
    ? `The club’s last tryouts finished on ${formatShortWeekdayDate(lastDay)}, ${lastDay.slice(0, 4)}.`
    : 'No tryouts are posted right now.';
}

/** A tryout page's link-preview description, per state. */
export function tryoutPageDescription(
  state: TryoutState,
  teamName: string,
  season: TryoutSeasonName,
  firstUpcoming: string | null,
  lastDay: string | null,
  today: string,
): string {
  const lead = `Tryouts for the ${seasonWords(season)}`;
  const from = firstUpcoming ? `, from ${formatShortWeekdayDate(firstUpcoming)}` : '';
  if (state === 'open') return `${lead}${from}. Sign-ups are open.`;
  if (state === 'notOpenYet') return `${lead}${from}. Sign-ups aren’t open yet.`;
  return tryoutStateSentence(state, teamName, season, lastDay, today);
}

/** The club Tryouts page's link-preview description. */
export function tryoutsPageDescription(year: number | null): string {
  return year != null
    ? `Every team’s tryout dates, places and sign-ups for the ${year} season.`
    : 'Every team’s tryout dates, places and sign-ups.';
}

