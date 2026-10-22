import 'server-only';
import { cache } from 'react';
import { supabaseAdmin } from './supabase-admin';
import { getRepTeamGroups } from './db';
import { bornYearsOf, type BornYears } from './born-years';
import { liveSeasonOf, LIVE_SEASON_STATUSES } from './season-live';
import { addCalendarDays, orgDayKey, zonedWallClockToUtc } from './timezone';
import { tryoutStandingOf, TRYOUT_LISTED_DAYS, type TryoutDay, type TryoutStanding } from './tryout-season';
import type { RepProgramYear, RepTeam, RepTeamGroup } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A CLUB'S TRYOUT DAYS, READ FOR ITS PUBLIC PAGES (Club Tier Stage 4b-2b, S4-04). The tryout days a coach enters in the
 * tryout setup (`rep_tryout_sessions`) — until now read only by coach-side code — reach the club's public pages here,
 * and only here. The STATE each team is in is decided by the pure rule (lib/tryout-season.ts); this only reads.
 *
 * ⚠ The table has row-level security with no policies, so the anonymous key reads nothing: every read is the service
 * client, server-side, scoped to the team's LIVE season (`liveSeasonOf` — the same season the one public tryout rule
 * names), and selects only what a family may see: when, where, and whether it was cancelled. Never a label a coach
 * typed for staff, never an evaluator or a score.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const DAY_COLUMNS = 'program_year_id, starts_at, ends_at, status, location, location_address, field_number';
const SEASON_COLUMNS = 'id, name, year, team_id, org_id, status, created_at, tryout_open, born_from_year, born_to_year, rep_teams!team_id(name, slug, is_archived, group_id, sport)';
/** An `.in()` list is a URL: the batched reads go in slices this long. */
const IN_SLICE = 100;
/** The database hands back at most this many rows per request; a longer answer is read page by page. */
const PAGE_ROWS = 1000;

/** Every row a query answers, page by page — a batched read never stops silently at the row cap. */
async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await page(from, from + PAGE_ROWS - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data ?? []).length < PAGE_ROWS) return out;
  }
}

interface LiveSeasonRow {
  id: string;
  name: string;
  year: number | null;
  team_id: string;
  org_id: string;
  tryout_open: boolean;
  born_from_year: number | null;
  born_to_year: number | null;
  rep_teams: { name: string; slug: string; is_archived: boolean; group_id: string | null; sport: string | null } | null;
}
type DayRow = TryoutDay & { programYearId: string };

function mapDay(r: Record<string, unknown>): DayRow {
  return {
    programYearId: r.program_year_id as string,
    startsAt: r.starts_at as string,
    endsAt: (r.ends_at as string | null) ?? null,
    status: (r.status as string | null) ?? 'scheduled',
    location: (r.location as string | null) ?? null,
    locationAddress: (r.location_address as string | null) ?? null,
    fieldNumber: (r.field_number as string | null) ?? null,
  };
}

function slices<T>(list: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += IN_SLICE) out.push(list.slice(i, i + IN_SLICE));
  return out;
}

/** Each listed team's live season, from draft and active season rows (each carrying its team): the newest-created per
 *  team (`liveSeasonOf`), an archived team's dropped. */
function liveSeasonRows(rows: readonly (LiveSeasonRow & { status: string; created_at: string })[]): LiveSeasonRow[] {
  const byTeam = new Map<string, (LiveSeasonRow & { status: string; createdAt: string })[]>();
  for (const r of rows) {
    if (!r.rep_teams || r.rep_teams.is_archived) continue;
    byTeam.set(r.team_id, [...(byTeam.get(r.team_id) ?? []), { ...r, createdAt: r.created_at }]);
  }
  return [...byTeam.values()].map(list => liveSeasonOf(list)).filter((r): r is NonNullable<typeof r> => !!r);
}

/** The live seasons of these clubs' listed teams — two reads at most per slice of clubs. */
async function liveSeasonsOf(orgIds: readonly string[]): Promise<LiveSeasonRow[]> {
  const out: LiveSeasonRow[] = [];
  for (const ids of slices(orgIds)) {
    const rows = await allRows((from, to) => supabaseAdmin.from('rep_program_years').select(SEASON_COLUMNS)
      .in('org_id', ids).in('status', [...LIVE_SEASON_STATUSES]).order('id').range(from, to));
    out.push(...liveSeasonRows(rows as unknown as Parameters<typeof liveSeasonRows>[0]));
  }
  return out;
}

/** One club's live seasons, once per request: the org layout's Tryouts tab, the home and the Tryouts page share it. */
const liveClubSeasons = cache((orgId: string) => liveSeasonsOf([orgId]));

/** The club's team groups, once per request (the Tryouts page's bands and the Teams page's). */
export const getClubTeamGroups = cache(getRepTeamGroups);

/** One season's tryout days, once per request (the tryout page, its title and its card ask the same question). */
const getSeasonTryoutDays = cache(async (programYearId: string): Promise<TryoutDay[]> => {
  const { data, error } = await supabaseAdmin.from('rep_tryout_sessions').select(DAY_COLUMNS)
    .eq('program_year_id', programYearId).order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapDay);
});

/** A team's tryout, resolved: its live season (null for an archived team) and the state that season's days put it in. */
export async function readTeamTryout(
  team: Pick<RepTeam, 'isArchived'>,
  seasons: readonly RepProgramYear[],
  today: string,
): Promise<{ season: RepProgramYear | null; standing: TryoutStanding }> {
  const season = team.isArchived ? null : liveSeasonOf(seasons);
  // A failed days read leaves the page standing: no days, rather than no page (the sign-up switch still decides "open").
  const days = season ? await getSeasonTryoutDays(season.id).catch(error => {
    console.error('[club-tryouts] tryout days read failed', error);
    return [] as TryoutDay[];
  }) : [];
  return { season, standing: tryoutStandingOf({ isArchived: team.isArchived, season, days, today }) };
}

export interface ClubTryoutTeam {
  name: string;
  slug: string;
  groupId: string | null;
  season: { id: string; name: string; year: number | null };
  /** The season's birth years and the team's sport — read with the club's cut-off through lib/club-born-public.ts
   *  (Stage 4c-2), never formatted here. */
  bornYears: BornYears;
  sport: string | null;
  standing: TryoutStanding;
}

/** These clubs' listed teams with their tryouts, by club (two batched reads: the live seasons, then their days). */
async function tryoutTeamsOf(seasons: readonly LiveSeasonRow[], today: string): Promise<Map<string, ClubTryoutTeam[]>> {
  const byClub = new Map<string, ClubTryoutTeam[]>();
  if (seasons.length === 0) return byClub;
  const daysBySeason = new Map<string, TryoutDay[]>();
  for (const ids of slices(seasons.map(s => s.id))) {
    const rows = await allRows((from, to) => supabaseAdmin.from('rep_tryout_sessions').select(DAY_COLUMNS)
      .in('program_year_id', ids).order('starts_at', { ascending: true }).order('id').range(from, to));
    for (const d of rows.map(mapDay)) daysBySeason.set(d.programYearId, [...(daysBySeason.get(d.programYearId) ?? []), d]);
  }
  for (const r of seasons) {
    const days = daysBySeason.get(r.id) ?? [];
    byClub.set(r.org_id, [...(byClub.get(r.org_id) ?? []), {
      name: r.rep_teams?.name ?? '',
      slug: r.rep_teams?.slug ?? '',
      groupId: r.rep_teams?.group_id ?? null,
      season: { id: r.id, name: r.name, year: r.year ?? null },
      bornYears: bornYearsOf(r),
      sport: r.rep_teams?.sport ?? null,
      standing: tryoutStandingOf({ isArchived: false, season: { tryoutOpen: !!r.tryout_open }, days, today }),
    }]);
  }
  return byClub;
}

/**
 * Every listed team's tryout this season, with the club's groups for the bands. A team that is archived, or has no live
 * season, is not here — it has nothing to announce. Once per request: the Tryouts page, its title, the home and the
 * Teams page ask it together.
 */
export const readClubTryouts = cache(async (orgId: string, today: string): Promise<{ teams: ClubTryoutTeam[]; groups: RepTeamGroup[] }> => {
  const [seasons, groups] = await Promise.all([liveClubSeasons(orgId), getClubTeamGroups(orgId)]);
  return { teams: (await tryoutTeamsOf(seasons, today)).get(orgId) ?? [], groups };
});

/** Many clubs' listed teams with their tryouts, for the sitemap: four reads for all of them, never one set per club. */
export async function readTryoutsForClubs(orgIds: readonly string[], today: string): Promise<Map<string, ClubTryoutTeam[]>> {
  return tryoutTeamsOf(await liveSeasonsOf(orgIds), today);
}

/** The club's today at midnight, as an instant — where "a day before today" ends. */
function startOfClubDay(day: string): string {
  return zonedWallClockToUtc(day, '00:00') ?? `${day}T00:00:00.000Z`;
}

/**
 * The last tryout day the club ever held (any season, a team not archived), for the Tryouts address out of season: "The
 * club's last tryouts finished on …". Null when it never held one.
 */
export async function lastClubTryoutDay(orgId: string, today: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_sessions')
    .select('starts_at, rep_teams!team_id!inner(is_archived)')
    .eq('org_id', orgId)
    .neq('status', 'cancelled')
    .eq('rep_teams.is_archived', false)
    .lt('starts_at', startOfClubDay(today))
    .order('starts_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const at = (data?.[0] as { starts_at?: string } | undefined)?.starts_at;
  return at ? orgDayKey(at) : null;
}

/**
 * The Tryouts tab's own question, asked yes/no (it runs in the org layout on every club route, so it must be cheap):
 * does any listed team's live season have sign-ups open, or a held day on or after four weeks ago? That is exactly
 * `tryoutsTabShows` — a day still ahead makes the team Not open yet; a day behind but inside the window makes its last
 * day inside it. The live seasons are the request's shared read (the page beneath asks it too); then at most one
 * one-row probe. Fails QUIET and closed: a hiccup costs a tab, never the page.
 */
export async function anyListedTryout(orgId: string, today: string): Promise<boolean> {
  try {
    // Side by side: the club's live seasons (shared with the page beneath) and the seasons holding a day in the window.
    // Most clubs hold a handful of days in any four weeks; the cap only bounds a probe that is then matched to live seasons.
    const [live, windowed] = await Promise.all([
      liveClubSeasons(orgId),
      supabaseAdmin
        .from('rep_tryout_sessions')
        .select('program_year_id')
        .eq('org_id', orgId)
        .neq('status', 'cancelled')
        .gte('starts_at', startOfClubDay(addCalendarDays(today, -TRYOUT_LISTED_DAYS)))
        .limit(500),
    ]);
    if (windowed.error) throw windowed.error;
    if (live.some(r => r.tryout_open)) return true;
    const inWindow = new Set((windowed.data ?? []).map(r => r.program_year_id as string));
    return live.some(r => inWindow.has(r.id));
  } catch (error) {
    console.error('[org-sections] tryouts availability check failed', error);
    return false;
  }
}
