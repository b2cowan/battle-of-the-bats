/**
 * lib/birthday-cutoff.ts — the pure side of the club's "When birthdays count from" card and of the house-league
 * division window's birth-year state (Club Tier Stage 4c-2 Part A; words CLUB_TIER_STAGE4C2_COPY.md B, C, K8).
 * `lib/born-years.ts` is the ONE rule (dates, lines, held reasons); this file only decides WHICH sports a club runs, what
 * the Settings card says under each. No database, no React — the loader is
 * `lib/birthday-cutoff-server.ts`.
 */

import { bornLine, checkBornYears, cutoffWords, oneYearPlaces, unshowableHeld, type BornYears, type Cutoff } from './born-years';
import { SPORT_OPTIONS, normalizeSportId, sportLabel } from './sports';
import { CLOSED_SEASON_STATUSES, liveSeasonOf } from './season-live';

/** A place that carries birth years: a team (its live season) or a house-league division. */
export type BirthdayPlace = { name: string; from: number | null; to: number | null };

/** What the server hands the card for one sport the club runs. */
export type BirthdaySportRow = {
  /** Normalized sport id — the key of `organizations.birthday_cutoffs`. */
  id: string;
  label: string;
  /** Non-archived rep teams of this sport. */
  repTeams: number;
  /** Non-archived house-league seasons of this sport. */
  houseLeagueSeasons: number;
  /** Teams (live season) with at least one birth year, by name. */
  teams: BirthdayPlace[];
  /** Divisions of this sport's live house-league seasons with at least one birth year. */
  divisions: BirthdayPlace[];
};

export type BirthdayTeamInput = {
  name: string;
  sport: string | null | undefined;
  isArchived: boolean;
  seasons: { status: string; createdAt: string; bornFromYear: number | null; bornToYear: number | null }[];
};

export type BirthdaySeasonInput = {
  sport: string | null | undefined;
  status: string;
  divisions: { name: string; bornFromYear: number | null; bornToYear: number | null }[];
};

const byName = (a: BirthdayPlace, b: BirthdayPlace) => a.name.localeCompare(b.name, 'en', { numeric: true });

/**
 * The sports a club RUNS — a non-archived rep team or a non-archived house-league season of that sport (sport compared
 * through `normalizeSportId`) — each with its counts and the places that carry years. Known sports, in the platform's
 * own order; a sport the club does not run is not listed.
 */
export function birthdaySportRows(teams: readonly BirthdayTeamInput[], seasons: readonly BirthdaySeasonInput[]): BirthdaySportRow[] {
  const rows = new Map<string, BirthdaySportRow>();
  const row = (sport: string | null | undefined): BirthdaySportRow => {
    const id = normalizeSportId(sport);
    let r = rows.get(id);
    if (!r) {
      r = { id, label: sportLabel(id), repTeams: 0, houseLeagueSeasons: 0, teams: [], divisions: [] };
      rows.set(id, r);
    }
    return r;
  };

  for (const t of teams) {
    if (t.isArchived) continue;
    const r = row(t.sport);
    r.repTeams += 1;
    const live = liveSeasonOf(t.seasons);
    if (live && (live.bornFromYear != null || live.bornToYear != null)) {
      r.teams.push({ name: t.name, from: live.bornFromYear, to: live.bornToYear });
    }
  }
  for (const s of seasons) {
    if (s.status === 'archived') continue;
    const r = row(s.sport);
    r.houseLeagueSeasons += 1;
    // A finished season's divisions are history: only a live season's years can be left unshowable by a move.
    if (!isLiveHouseLeagueStatus(s.status)) continue;
    for (const d of s.divisions) {
      if (d.bornFromYear != null || d.bornToYear != null) r.divisions.push({ name: d.name, from: d.bornFromYear, to: d.bornToYear });
    }
  }

  for (const r of rows.values()) {
    r.teams.sort(byName);
    r.divisions.sort(byName);
  }
  const order = new Map(SPORT_OPTIONS.map((o, i) => [o.id as string, i]));
  return [...rows.values()].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
}

/** A house-league season whose divisions still show on the site: anything not finished (a house-league season finishes in the
 *  same two states a team's season does, so the shared closed list is the rule; its registration states are all still running). */
export function isLiveHouseLeagueStatus(status: string): boolean {
  return !(CLOSED_SEASON_STATUSES as readonly string[]).includes(status);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** C4: "{n} rep team(s)[, {n} house-league season(s)]. Families see “{example}”." — or "No birth years entered yet.". The
 *  example is the first team (by name) with years that the saved cut-off can show as a line. */
export function cutoffRowSentence(row: BirthdaySportRow, cutoff: Cutoff): string {
  const parts: string[] = [];
  if (row.repTeams > 0) parts.push(plural(row.repTeams, 'rep team', 'rep teams'));
  if (row.houseLeagueSeasons > 0) parts.push(plural(row.houseLeagueSeasons, 'house-league season', 'house-league seasons'));
  const counts = parts.join(', ');
  if (row.teams.length === 0 && row.divisions.length === 0) return `${counts}. No birth years entered yet.`;
  const ex = firstShowable(row.teams, cutoff);
  return ex ? `${counts}. Families see “${ex.line}”.` : `${counts}.`;
}

/** The first team (by name) whose years read as a family line under this cut-off — a team with BOTH years first, since a
 *  range shows what the date does ("Born Sep 1, 2012 – Aug 31, 2013"); an open-sided one only when no range shows (/design
 *  2026-10-22: "9U AA will read 'Born on or after Sep 1, 2018'" was the club's weakest example). */
export function firstShowable(teams: readonly BirthdayPlace[], cutoff: Cutoff): { name: string; line: string } | null {
  let open: { name: string; line: string } | null = null;
  for (const t of teams) {
    const line = bornLine({ from: t.from, to: t.to }, cutoff);
    if (!line) continue;
    if (t.from != null && t.to != null) return { name: t.name, line };
    open ??= { name: t.name, line };
  }
  return open;
}

/** C6: the ask-once window's title. The sport is lower-cased inside the sentence; "Other" has no natural noun. */
export function cutoffAskTitle(row: Pick<BirthdaySportRow, 'id' | 'label'>, next: Cutoff): string {
  return row.id === 'other'
    ? `Count birthdays from ${cutoffWords(next)}?`
    : `Count ${row.label.toLowerCase()} birthdays from ${cutoffWords(next)}?`;
}

/** C12(a): the sentence the ask-once window adds when a move would leave one-year places with no born line. Null when none. */
export function oneYearSentence(row: BirthdaySportRow, next: Cutoff): string | null {
  const teams = row.teams.filter(t => oneYearPlaces([t], next) > 0);
  const divisions = row.divisions.filter(d => oneYearPlaces([d], next) > 0);
  const total = teams.length + divisions.length;
  if (total === 0) return null;
  const date = cutoffWords(next);
  if (total === 1) return `${(teams[0] ?? divisions[0]).name} has one birth year and will show none from ${date} until you set it again.`;
  const what = teams.length > 0 && divisions.length > 0
    ? `${plural(teams.length, 'team', 'teams')} and ${plural(divisions.length, 'division', 'divisions')} have`
    : teams.length > 0 ? `${teams.length} teams have` : `${divisions.length} divisions have`;
  return `${what} one birth year and will show none from ${date} until you set them again.`;
}

/** C7: the ask-once window's body — the example sentence is dropped when no team of this sport can be shown under the new date. */
export function cutoffAskBody(row: BirthdaySportRow, next: Cutoff): string {
  const what = row.id === 'other' ? 'Every team and house-league division' : `Every ${row.label.toLowerCase()} team and house-league division`;
  const ex = firstShowable(row.teams, next);
  const head = `${what} shows its birth years from ${cutoffWords(next)}, on your site.`;
  const read = ex ? ` ${ex.name} will read “${ex.line}”.` : '';
  return `${head}${read} Nothing is sent to families.`;
}

/**
 * What a house-league division window says under its birth-year boxes, and whether it lets Add division / Save go
 * (copy B3, B4, C12(b)). `touched` is whether the admin has changed a box since the window opened.
 *  - a pair that checks out: no reason, the real hint, nothing blocks;
 *  - a typed pair that does not (A15–A18): its reason, and the button refuses until it is fixed;
 *  - a STORED pair a cut-off change made unshowable, untouched (the same year twice off January 1 — C12(b)): the reason
 *    at rest, but it does NOT block — the window is also for the name and the capacity, and the old years are left exactly as
 *    they are (the window then does not send them).
 */
export function divisionBornState(
  rawFrom: string,
  rawTo: string,
  touched: boolean,
  cutoff: Cutoff,
  thisYear: number,
): { held: string | null; blocks: boolean; years: BornYears | null } {
  const check = checkBornYears(rawFrom, rawTo, cutoff, thisYear);
  if (check.ok) return { held: null, blocks: false, years: check.years };
  if (!touched) return { held: unshowableHeld(cutoff, 'division'), blocks: false, years: null };
  return { held: check.held, blocks: true, years: null };
}
