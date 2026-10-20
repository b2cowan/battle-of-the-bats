/**
 * lib/club-site-home.ts — THE RULES BEHIND A CLUB'S HOME AND ITS TEAMS PAGE (Club Tier Stage 4b-2a; drawings ruled
 * 2026-10-19, End states 1–2, Asks 3A, 4A, DC-01, S4-03).
 *
 * Pure, so they are unit-tested (tests/unit/club-stage4b2a.test.ts) and the pages only render what they decide:
 *   · the home's sections, in ONE fixed order, a program the club does not run absent (never "check back soon");
 *   · Open now, nearest deadline first;
 *   · a tournament's status, true to its dates — "Live now" only while they include today (today every card said Live);
 *   · the club's own team groups as bands, and when the home's two-column grid falls back to one.
 * The editor's show/hide and reorder of the middle sections is Stage 4c; until then the order is the ruled one, fixed.
 */
import { addCalendarDays, mondayOfDay } from './timezone';

export type ClubHomeSection = 'openNow' | 'teams' | 'league' | 'tournaments' | 'about';

/** Bar → Open now → Teams → House league → Tournaments → About the club → footer (Ask 3A). Each present only when it has
 *  something to show: Open now first because it is the only content with a deadline, and it leaves by itself. */
export function clubHomeSections(has: {
  openNow: number;
  teams: number;
  league: boolean;
  tournaments: number;
  about: boolean;
}): ClubHomeSection[] {
  const out: ClubHomeSection[] = [];
  if (has.openNow > 0) out.push('openNow');
  if (has.teams > 0) out.push('teams');
  if (has.league) out.push('league');
  if (has.tournaments > 0) out.push('tournaments');
  if (has.about) out.push('about');
  return out;
}

/** Open now's rows, nearest deadline first; a row with no deadline (a tryout, until 4b-2b reads its days) keeps its
 *  place after them. `deadline` is a sortable date or instant string. */
export function orderOpenNow<T extends { deadline: string | null }>(rows: readonly T[]): T[] {
  const dated = rows.filter(r => r.deadline).sort((a, b) => a.deadline!.localeCompare(b.deadline!));
  return [...dated, ...rows.filter(r => !r.deadline)];
}

// ── A tournament's status (S4-03) ──────────────────────────────────────────────────────────────

export type TournamentHomeStatus = 'live' | 'thisWeekend' | 'registrationOpen' | 'finished';

/** One phrase per meaning, sentence case (design log 2026-10-19 "Status"; /marketing 2026-10-20). */
export const TOURNAMENT_STATUS_WORD: Record<TournamentHomeStatus, string> = {
  live: 'Live now',
  thisWeekend: 'This weekend',
  registrationOpen: 'Registration open',
  finished: 'Finished',
};

/**
 * What a tournament's row says. `today` is the club's today (`tournamentToday()`); `registrationOpen` is the
 * tournament's own sign-up rule (`getRegistrationState`), which the page asks only for an event that has not started.
 *   · Finished — the organizer completed it, or its last day is behind today.
 *   · Live now — today falls inside its dates. Never otherwise.
 *   · This weekend — it starts on the coming Friday, Saturday or Sunday (a family's "this weekend", said from Monday on).
 *   · Registration open — before it starts, while its sign-up is open.
 *   · null — nothing true to add; the row shows its dates alone.
 */
export function tournamentHomeStatus(
  t: { status: string; startDate?: string | null; endDate?: string | null },
  today: string,
  registrationOpen: boolean,
): TournamentHomeStatus | null {
  const start = t.startDate ?? null;
  const end = t.endDate ?? start;
  if (t.status === 'completed' || t.status === 'archived' || (end && today > end)) return 'finished';
  if (start && today >= start) return 'live';
  if (start) {
    // This week's Friday to Sunday (days are YYYY-MM-DD in the club's zone; the week starts Monday).
    const monday = mondayOfDay(today);
    if (start >= addCalendarDays(monday, 4) && start <= addCalendarDays(monday, 6)) return 'thisWeekend';
  }
  return registrationOpen ? 'registrationOpen' : null;
}

/** How long a finished tournament stays on the home: families look for its results that week. Older ones belong to
 *  Past tournaments once the club archives them. */
export const RECENTLY_FINISHED_DAYS = 30;

/**
 * The home's Tournaments: running and coming ones, soonest first; then any that finished in the last
 * RECENTLY_FINISHED_DAYS, latest first. A draft or archived tournament is never listed.
 */
export function clubHomeTournaments<T extends { status: string; startDate?: string | null; endDate?: string | null }>(
  all: readonly T[],
  today: string,
): T[] {
  const cutoff = addCalendarDays(today, -RECENTLY_FINISHED_DAYS);
  const last = (t: T) => t.endDate ?? t.startDate ?? '';
  const finished = (t: T) => t.status === 'completed' || (!!last(t) && last(t) < today);
  // A finished one — completed by the organizer, or still "active" after its dates — leaves after the window either way.
  const shown = all.filter(t => (t.status === 'active' || t.status === 'completed') && (!finished(t) || last(t) >= cutoff));
  const coming = shown.filter(t => !finished(t)).sort((a, b) => (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999'));
  const done = shown.filter(finished).sort((a, b) => last(b).localeCompare(last(a)));
  return [...coming, ...done];
}

// ── The club's teams (Ask 4A, DC-01) ────────────────────────────────────────────────────────────

/** About 14 characters fill half the grid's width at 360 px (End state 1, "Long team names at 360"). */
const HALF_WIDTH_CHARS = 14;

/** One column for a group when any of its names will not fit half the width — names never truncate (DC-01). */
export function teamGridOneColumn(names: readonly string[]): boolean {
  return names.some(n => n.length > HALF_WIDTH_CHARS);
}

/** The band for teams outside every group, beside grouped ones (/marketing 2026-10-20). */
export const OTHER_TEAMS_BAND = 'Other teams';

export interface TeamBand<T> {
  /** The group's name; null when the club set no groups at all (one list, no band). */
  name: string | null;
  teams: T[];
}

/**
 * The club's teams under the club's own groups (the admin's group on each team, `rep_team_groups`), in the club's group
 * order; each band's teams by name with numbers read as numbers ("9U" before "11U") — the order the club's other team
 * lists use (`readClubTeams`). Teams in no group come last, under "Other teams"; a club with no groups gets one list.
 */
export function clubTeamBands<T extends { name: string; groupId: string | null }>(
  teams: readonly T[],
  groups: readonly { id: string; name: string; displayOrder: number }[],
): TeamBand<T>[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, 'en-CA', { numeric: true });
  const known = new Set(groups.map(g => g.id));
  const ordered = [...groups].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  const bands: TeamBand<T>[] = ordered
    .map(g => ({ name: g.name, teams: teams.filter(t => t.groupId === g.id).sort(byName) }))
    .filter(b => b.teams.length > 0);
  const loose = teams.filter(t => !t.groupId || !known.has(t.groupId)).sort(byName);
  if (loose.length > 0) bands.push({ name: bands.length > 0 ? OTHER_TEAMS_BAND : null, teams: loose });
  return bands;
}

/**
 * The division under a team's name on the Teams page — only when nothing on the row already says it (End state 2: "on
 * the drawn club it repeats the group band, so it is said once, by the band"). Word by word, so "Provincial AAA" under
 * the AAA band, or "15U" on "15U AAA", is not said twice, while a group "A" does not swallow a division "AA".
 */
export function teamRowDivision(division: string | null | undefined, groupName: string | null | undefined, teamName: string): string | null {
  const d = division?.trim();
  if (!d) return null;
  const words = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean);
  const within = (part: string[], whole: string[]) => part.length > 0 && part.every(w => whole.includes(w));
  const says = (other: string | null | undefined) => !!other && (within(words(other), words(d)) || within(words(d), words(other)));
  return says(groupName) || says(teamName) ? null : d;
}
