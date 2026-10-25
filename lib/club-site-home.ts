/**
 * lib/club-site-home.ts — THE RULES BEHIND A CLUB'S HOME AND ITS TEAMS PAGE (Club Tier Stage 4b-2a; drawings ruled
 * 2026-10-19, End states 1–2, Asks 3A, 4A, DC-01, S4-03).
 *
 * Pure, so they are unit-tested (tests/unit/club-stage4b2a.test.ts) and the pages only render what they decide:
 *   · Open now, nearest deadline first;
 *   · a tournament's status, true to its dates — "Live now" only while they include today (today every card said Live);
 *   · the club's own team groups as bands, and when the home's two-column grid falls back to one.
 * The home's sections — the ruled order (Ask 3A) a club starts from, and since Stage 4c-1 the club's own order and
 * show/hide — are decided in lib/club-site-sections.ts (`clubHomeSectionsFor`).
 */
import { addCalendarDays, mondayOfDay } from './timezone';

/** Open now's rows, nearest deadline first; a row with no deadline (a tryout, until 4b-2b reads its days) keeps its
 *  place after them. `deadline` is a sortable date or instant string. */
export function orderOpenNow<T extends { deadline: string | null }>(rows: readonly T[]): T[] {
  const dated = rows.filter(r => r.deadline).sort((a, b) => a.deadline!.localeCompare(b.deadline!));
  return [...dated, ...rows.filter(r => !r.deadline)];
}

/** The house-league season the home names: the one running (sign-up open or closed, or playing), else none. A draft
 *  season is never public. The editor's House league row names the same one (Stage 4c-1). */
export function runningLeagueSeason<T extends { status: string }>(seasons: readonly T[]): T | null {
  return seasons.find(s => ['registration_open', 'registration_closed', 'active'].includes(s.status)) ?? null;
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

/** How long a finished tournament stays on the home: families look for its results that week. Every finished one is
 *  on the Tournaments page's Past tournaments (Stage 4f). */
export const RECENTLY_FINISHED_DAYS = 30;

/**
 * The home's Tournaments: running and coming ones, soonest first; then any that finished in the last
 * RECENTLY_FINISHED_DAYS, latest first. A draft or archived tournament is never listed.
 */
export function clubHomeTournaments<T extends DatedTournament>(
  all: readonly T[],
  today: string,
): T[] {
  const cutoff = addCalendarDays(today, -RECENTLY_FINISHED_DAYS);
  // A finished one — completed by the organizer, or still "active" after its dates — leaves after the window either way.
  const { coming, finished } = splitListed(all, today);
  return [...coming, ...finished.filter(t => lastDay(t) >= cutoff)];
}

type DatedTournament = { status: string; startDate?: string | null; endDate?: string | null };

const lastDay = (t: DatedTournament) => t.endDate ?? t.startDate ?? '';
/** Public at all: a draft is not, and an archived tournament has no public site (its sealed record speaks for it). */
const isListedTournament = (t: DatedTournament) => t.status === 'active' || t.status === 'completed';
/** Completed by the organizer, or its last day is behind the club's today. */
const isFinishedTournament = (t: DatedTournament, today: string) => t.status === 'completed' || (!!lastDay(t) && lastDay(t) < today);
/** The public tournaments in two runs: coming (running or not started), soonest first; finished, latest first. */
function splitListed<T extends DatedTournament>(all: readonly T[], today: string): { coming: T[]; finished: T[] } {
  const coming: T[] = [];
  const finished: T[] = [];
  for (const t of all) if (isListedTournament(t)) (isFinishedTournament(t, today) ? finished : coming).push(t);
  coming.sort((a, b) => (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999'));
  finished.sort((a, b) => lastDay(b).localeCompare(lastDay(a)));
  return { coming, finished };
}

/**
 * THE CLUB'S TOURNAMENTS PAGE, in its three runs (Club Tier Stage 4f; ruled 2026-10-25, Asks 1 and 4):
 *   · current — running and coming, soonest first (the home's list without its recently finished ones);
 *   · finished — every finished tournament that is listed and has no sealed record, newest end date first, opening its
 *     own site (Ask 4: until the club archives it, a finished tournament is on no list otherwise);
 *   · archives — the sealed records, newest season first, opening their archive pages.
 * One row per tournament (owner 2026-10-25): a sealed tournament is its archive row, whatever its status. An archived
 * tournament that was never sealed has no public site and no record, so it is on no list, as before 4f. The two past
 * runs are not interleaved: a sealed record keeps no event dates.
 */
export function clubTournamentParts<T extends DatedTournament & { id: string }, A extends { tournamentId: string | null; season: string }>(
  all: readonly T[],
  archives: readonly A[],
  today: string,
): { current: T[]; finished: T[]; archives: A[] } {
  const sealed = new Set(archives.map(a => a.tournamentId).filter(Boolean));
  const { coming, finished } = splitListed(all, today);
  return {
    current: coming,
    finished: finished.filter(t => !sealed.has(t.id)),
    // Stable: within a season the caller's order (the read's newest seal first) stands.
    archives: [...archives].sort((a, b) => b.season.localeCompare(a.season, 'en-CA', { numeric: true })),
  };
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
