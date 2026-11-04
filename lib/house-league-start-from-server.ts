import 'server-only';
/**
 * START NEXT SEASON, the database half (House League 9f-2; rulings 9f·8–9f·13). The decisions are
 * `lib/house-league-start-from.ts` (pure, tested); this file reads the source and writes the copy.
 *
 * ⚠ SEQUENTIAL, ALL-OR-NOTHING IN EFFECT (owner, 2026-11-03, push-back 2): the season row is inserted first, then its age
 *   groups, teams, practice settings and coaches; on ANY later failure the new season is deleted (`deleteDraftLeagueSeason`,
 *   whose cascade removes everything under it) and the caller answers an error. The tournament clone and the rep rollover
 *   work the same way. A crash between two steps can leave a Getting-ready draft: visible, deletable, never emailed.
 * ⚠ THE SOURCE IS ONLY READ (9f·11). Every write below names the NEW season's id.
 * ⚠ NEVER COPIED (9f·12): registrations, payments, ratings, games, practices, slot uses, notices, email logs, invites (a coach
 *   row carries no invite state, so "Invited when you publish"), the club's time, the budget seed, the published marks.
 */
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from './supabase-admin';
import { deleteDraftLeagueSeason } from './db';
import { bornColumns, bornYearsOf, checkBornBody } from './born-years';
import { isUuid } from './utils';
import {
  bornShiftYears, datesMoved, dateShiftDays, honouredBring, isLiveSource, movedDates, moveBornYears, startPrints,
  type Bring, type StartSource, type StartedFrom,
} from './house-league-start-from';

/** What a create request asks to start from. */
export type StartFromRequest = { seasonId: string; bring: Bring; divisionIds: string[] | null };

/** The body's `startFrom`, or null when it names none, or 'bad' when it is malformed. */
export function readStartFromBody(v: unknown): StartFromRequest | null | 'bad' {
  if (v == null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) return 'bad';
  const r = v as Record<string, unknown>;
  if (!isUuid(r.seasonId)) return 'bad'; // not an id at all: a plain "not found", never a database error
  const ids = Array.isArray(r.divisionIds) ? r.divisionIds.filter((x): x is string => typeof x === 'string') : null;
  return { seasonId: r.seasonId, bring: honouredBring(r.bring as Partial<Bring>), divisionIds: ids };
}

const SEASON_COLS = 'id, org_id, name, status, description, registration_fee, how_to_pay, waiver_text, ask_email_consent, '
  + 'owing_amber_days, auto_approve_under_capacity, auto_promote_waitlist, twice_in_a_day_allowed, home_away_tolerance, '
  + 'season_start_date, season_end_date, registration_open_at, registration_close_at, early_bird_until';

type SourceRow = {
  id: string; org_id: string; name: string; status: string; description: string | null; registration_fee: number | null;
  how_to_pay: string | null; waiver_text: string | null; ask_email_consent: boolean; owing_amber_days: number;
  auto_approve_under_capacity: boolean; auto_promote_waitlist: boolean; twice_in_a_day_allowed: boolean;
  home_away_tolerance: number; season_start_date: string | null; season_end_date: string | null;
  registration_open_at: string | null; registration_close_at: string | null; early_bird_until: string | null;
};
type DivisionRow = {
  id: string; name: string; capacity: number | null; sort_order: number; born_from_year: number | null;
  born_to_year: number | null; price: number | null; early_price: number | null; note: string | null;
  show_standings: boolean; games_per_team: number | null;
};

/** The source season, only when it is this club's (a direct request can never copy another club's season). */
export async function loadStartSource(orgId: string, seasonId: string): Promise<SourceRow | null> {
  const { data, error } = await supabaseAdmin.from('league_seasons').select(SEASON_COLS)
    .eq('id', seasonId).eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  return (data as SourceRow | null) ?? null;
}

const asSource = (r: SourceRow): StartSource => ({
  id: r.id, name: r.name, status: r.status, seasonStartDate: r.season_start_date, seasonEndDate: r.season_end_date,
  registrationOpenAt: r.registration_open_at, registrationCloseAt: r.registration_close_at, earlyBirdUntil: r.early_bird_until,
});

export type StartFromBase = {
  orgId: string; userId: string; name: string; slug: string; sport: string;
  seasonStartDate: string | null; seasonEndDate: string | null;
};

/**
 * Make the new season from `source`: one insert of the season row, then everything under it. Returns the new season's row,
 * or throws — after deleting what it made — with `.code === '23505'` passed through for a taken name.
 */
export async function startSeasonFrom(base: StartFromBase, sourceRow: SourceRow, req: StartFromRequest) {
  const source = asSource(sourceRow);
  const live = isLiveSource(source);
  const bring = req.bring;

  // The dates: the two the window shows arrive as typed; the other three follow the first day's gap (9f·13). A live source
  // gives none of the three (9f·10), and the two the window shows are whatever the person set.
  const shift = dateShiftDays(source, base.seasonStartDate);
  const moved = movedDates(source, shift);
  const born = bornShiftYears(source, { seasonStartDate: base.seasonStartDate, seasonEndDate: base.seasonEndDate });

  // The age groups that come across: all of them from a finished source; the chosen ones from a live one (chips, all on).
  // Only what is brought is read (`honouredBring` already ties teams and practice to the age groups; coaches to the teams).
  const none = Promise.resolve({ data: [], error: null });
  const [{ data: divData, error: divErr }, { data: teamData, error: teamErr }, { data: practiceData, error: practiceErr }, { data: coachData, error: coachErr }] = await Promise.all([
    supabaseAdmin.from('league_divisions')
      .select('id, name, capacity, sort_order, born_from_year, born_to_year, price, early_price, note, show_standings, games_per_team')
      .eq('season_id', source.id).order('sort_order').order('created_at'),
    bring.teams ? supabaseAdmin.from('league_teams').select('id, division_id, name, color, sort_order').eq('season_id', source.id)
      .order('sort_order').order('created_at') : none,
    bring.practice ? supabaseAdmin.from('league_practice_time').select('division_id, practice_minutes, teams_at_once').eq('season_id', source.id) : none,
    bring.coaches ? supabaseAdmin.from('league_team_coaches')
      .select('team_id, name, first_name, last_name, email').eq('season_id', source.id).is('removed_at', null)
      .order('created_at').order('id') : none,
  ]);
  if (divErr) throw divErr;
  if (teamErr) throw teamErr;
  if (practiceErr) throw practiceErr;
  if (coachErr) throw coachErr;
  const chosen = new Set(live && req.divisionIds ? req.divisionIds : (divData ?? []).map(d => d.id));
  const divisions = bring.ageGroups ? ((divData ?? []) as DivisionRow[]).filter(d => chosen.has(d.id)) : [];

  // New ids up front, so every child row knows its parent without reading anything back.
  const divisionIdMap = new Map(divisions.map(d => [d.id, randomUUID()]));
  const thisYear = Math.max(new Date().getFullYear(), Number((base.seasonStartDate ?? '').slice(0, 4)) || 0);
  const divisionRows = divisions.map(d => {
    // The birth years move up, and must still pass the server's one check for a stored pair; a pair that would not is left
    // empty (the checklist then asks for it) rather than stored wrong.
    const years = moveBornYears(bornYearsOf(d), born);
    const ok = checkBornBody(years.from, years.to, thisYear);
    return {
      id: divisionIdMap.get(d.id)!, name: d.name, capacity: d.capacity, sort_order: d.sort_order,
      ...bornColumns(ok.ok ? ok.years : { from: null, to: null }),
      price: d.price, early_price: d.early_price, note: d.note, show_standings: d.show_standings, games_per_team: d.games_per_team,
    };
  });

  const teams = bring.teams ? (teamData ?? []).filter(t => divisionIdMap.has(t.division_id)) : [];
  const teamIdMap = new Map(teams.map(t => [t.id, randomUUID()]));
  const teamRows = teams.map(t => ({
    id: teamIdMap.get(t.id)!, division_id: divisionIdMap.get(t.division_id)!, name: t.name, color: t.color, sort_order: t.sort_order,
  }));

  const practiceRows = bring.practice
    ? (practiceData ?? []).filter(p => divisionIdMap.has(p.division_id)).map(p => ({
      org_id: base.orgId, division_id: divisionIdMap.get(p.division_id)!, practice_minutes: p.practice_minutes,
      teams_at_once: p.teams_at_once, updated_by: base.userId,
    }))
    : [];

  // The add-coach route's insert shape, with no invite state: "Invited when you publish" (9c·10).
  const coachRows = (coachData ?? []).filter(c => teamIdMap.has(c.team_id)).map(c => ({
    team_id: teamIdMap.get(c.team_id)!, org_id: base.orgId, name: c.name, first_name: c.first_name,
    last_name: c.last_name, email: c.email, created_by: base.userId,
  }));

  const s = bring.settings ? sourceRow : null;
  const seasonRow = {
    org_id: base.orgId,
    name: base.name,
    slug: base.slug,
    sport: base.sport,
    season_start_date: base.seasonStartDate,
    season_end_date: base.seasonEndDate,
    registration_open_at: moved.registrationOpenAt,
    registration_close_at: moved.registrationCloseAt,
    early_bird_until: moved.earlyBirdUntil,
    ...(s ? {
      description: s.description, registration_fee: s.registration_fee, how_to_pay: s.how_to_pay, waiver_text: s.waiver_text,
      ask_email_consent: s.ask_email_consent, owing_amber_days: s.owing_amber_days,
      auto_approve_under_capacity: s.auto_approve_under_capacity, auto_promote_waitlist: s.auto_promote_waitlist,
      twice_in_a_day_allowed: s.twice_in_a_day_allowed, home_away_tolerance: s.home_away_tolerance,
    } : {}),
  };

  const brought: StartedFrom['brought'] = {
    settings: bring.settings, ageGroups: divisionRows.length, teams: teamRows.length,
    practice: practiceRows.length > 0, coaches: coachRows.length,
  };
  // "Moved N weeks" only when the SOURCE had dates to move: a source with none gives empty dates and no mark, whatever first
  // and last day the person typed.
  const shiftDays = datesMoved(source, shift) ? shift : null;
  const startedFrom: StartedFrom = {
    sourceId: source.id, sourceName: source.name, live, shiftDays, bornShift: born, brought,
    prints: startPrints(
      {
        registrationFee: seasonRow.registration_fee ?? null, registrationOpenAt: seasonRow.registration_open_at,
        registrationCloseAt: seasonRow.registration_close_at, earlyBirdUntil: seasonRow.early_bird_until,
        howToPay: seasonRow.how_to_pay ?? null, waiverText: seasonRow.waiver_text ?? null,
      },
      divisionRows.map(d => ({ name: d.name, capacity: d.capacity, bornFromYear: d.born_from_year, bornToYear: d.born_to_year, price: d.price, earlyPrice: d.early_price })),
      brought, shiftDays,
    ),
  };

  const { data: made, error: madeErr } = await supabaseAdmin.from('league_seasons')
    .insert({ ...seasonRow, started_from: startedFrom }).select().single();
  if (madeErr || !made) throw madeErr ?? new Error('season insert returned nothing');

  try {
    const step = async (table: string, rows: Record<string, unknown>[]) => {
      if (rows.length === 0) return;
      const { error } = await supabaseAdmin.from(table).insert(rows.map(r => ({ ...r, season_id: made.id })));
      if (error) throw error;
    };
    await step('league_divisions', divisionRows);
    await step('league_teams', teamRows);
    await step('league_practice_time', practiceRows);
    await step('league_team_coaches', coachRows);
  } catch (err) {
    // All or nothing: the season goes, and its cascade takes whatever landed under it.
    await deleteDraftLeagueSeason(made.id, base.orgId).then(gone => {
      if (!gone) console.error('[house-league start-from] the half-made season', made.id, 'was not deleted (not a draft any more?)');
    }).catch(cleanupErr =>
      console.error('[house-league start-from] cleanup after a failed copy did not finish:', cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)));
    throw err;
  }
  return made;
}
