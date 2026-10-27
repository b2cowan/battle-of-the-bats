import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { getAuthContextWithRole, unauthorized, type AuthContextWithRole } from './api-auth';
import { canMoveClubMoney, canOpenModule } from './member-access';
import { hasModuleEntitlement } from './module-entitlements';
import { clubSchedulerOn, isScheduleBuilder } from './club-schedule-gate';
import { resolvePersonNamer } from './db';
import { liveSeasonOf } from './season-live';
import { isUuid } from './utils';
import { addCalendarDays, isCalendarDate, mondayOfDay, tournamentToday, utcToZonedInputs } from './timezone';
import { readClubPlaces, readPermitTimes, type ClubPlaces } from './permit-lookup';
import { facilityListWords } from './permit-words';
import { readClubBookings } from './venue-clash-lookup';
import { readAmount } from './club-bill-split';
import { clock, fieldPrices, overlappingBlocks, shareOf, weekdayOf, type DateOff, type TimeBlock } from './permit-time';
import {
  ageOf, cutSlots, heldSlots, isPrimeSlot, seatCounts, shareTargets, slotKeyOf, teamResults, teamTwice,
  type EngineInput, type EngineTeam, type PoolBooking, type ScheduleTime, type Slot, type TeamBooking, type TeamResult,
} from './club-schedule-engine';
import { readScheduleSettings, defaultSettings, isClock, sharingPools, slotRoom, type ScheduleSettings, type SettingsRefusal } from './club-schedule-settings';
import {
  billShares, closingRow, paymentPeriods, pricedMinutes, teamInstallments,
  type BillShares, type BillSlot, type ClosingRow, type Installment, type PaymentPeriod, type PaymentPlan,
} from './club-schedule-bill';
import { SCHEDULE_REFUSALS as R, houseLeagueUse } from './club-schedule-words';
import { clubDay, keptHandBacks, waitingAsksOfSchedule, type KeptHandBack } from './club-hand-back-reads';
import { scheduleMoney, type ScheduleMoney } from './club-money-reads';
import { HOUSE_LEAGUE, isProgramHolder, storedHolders, teamsOnly } from './club-schedule-holders';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB SCHEDULER, SERVER SIDE (Club Tier Stage 11a, part A — plan CLUB_PERMITS_AND_SCHEDULER_PLAN.md §5.3–§5.9; mig
 * 326). The gate every scheduler route asks, the reads (a schedule whole, the list, New schedule's inputs), the engine's
 * inputs from the database, the page's view, and the two writers that save a schedule (`club_schedule_save`,
 * `club_schedule_edit_slots`). The sends, Finalize, Send the changes and the coach's side are their own modules
 * (`lib/club-schedule-send.ts`, `lib/club-schedule-coach.ts`).
 *
 * ⚖ WHO (Stage 11 Ask 3): the club's OWNER or an ADMIN builds, adjusts, bills and sends — for any team (an admin is never
 * limited to groups: `GROUP_UNSCOPED_ROLES`). A head coach reads only their own team's slots, bill and replies, through
 * the coach's routes. A bill is money: adding one, and finalizing a schedule that carries one, also asks the club's one
 * money rule (`canMoveClubMoney`).
 * ⚖ HOUSE LEAGUE (Stage 11b, 9d2·15): the owner or an admin gives time to House league AS A WHOLE — one holder beside the
 * teams (`HOUSE_LEAGUE`, lib/club-schedule-holders.ts), never a division, never billed (11b·A), never sharing a slot
 * (11b·B). It is offered when the club has house league (its plan or a section), whether or not this member opens it: an
 * admin builds for any program (Ask 3). The league admin divides it from the house-league season (lib/league-time-server.ts).
 * ⚖ THE PLAN (Stage 11 Ask 6): `club_scheduler` — League Plus and both Club bands, checked HERE on the server.
 * ⚖ NOTHING TO SCHEDULE: a club with no running rep team and no house league has nothing to hand time to. The list
 * answers `nothingToSchedule` (the screens hide the door); every write refuses in words. Since 11b a League Plus club
 * schedules house league.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const MAX_SLOTS = 6000;

function refusal(status: number, code: string, error: string, extra: object = {}): Response {
  return NextResponse.json({ error, code, ...extra }, { status });
}

/** A check's refusal in words (`{ ok: false, code, error }`) — the settings reader's shape, used by every reader here. */
export type Refused = SettingsRefusal;
const no = (code: string, error: string): Refused => ({ ok: false, code, error });

export interface SchedulerCtx {
  ctx: AuthContextWithRole;
  /** Holds the club's Accounting: may add a bill and finalize one that carries it. */
  canMoney: boolean;
  /** Something to hand time to: rep teams this member can open, or house league (Stage 11b). */
  canSchedule: boolean;
  /** The club has house league (its plan, a free floor or a section): House league is offered as a holder (Stage 11b). */
  houseLeague: boolean;
}

/** THE GATE: signed in, the plan carries the scheduler, an owner or an admin. `write` also needs something to hand time
 *  to: rep teams, or house league. */
export async function resolveScheduler(req: Request, opts: { write?: boolean } = {}): Promise<{ error: Response } | SchedulerCtx> {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  // The one rule (lib/club-schedule-gate.ts), each half refused in its own words.
  if (!clubSchedulerOn(ctx.org.planId)) return { error: refusal(403, 'plan_lacks_scheduler', R.plan) };
  if (!isScheduleBuilder(ctx.role)) return { error: refusal(403, 'not_a_builder', R.who) };
  const repTeams = hasModuleEntitlement(ctx.org, 'module_rep_teams') && canOpenModule(ctx, ctx.org, 'module_rep_teams');
  const houseLeague = hasModuleEntitlement(ctx.org, 'module_house_league');
  const canSchedule = repTeams || houseLeague;
  if (opts.write && !canSchedule) return { error: refusal(409, 'nothing_to_schedule', R.nothingToSchedule) };
  return { ctx, canMoney: canMoveClubMoney(ctx, ctx.org), canSchedule, houseLeague };
}

/** A database refusal (the floor: mig 326's raises) said in words, never a 500. Null when it isn't one of ours. */
export function floorRefusal(e: unknown): Response | null {
  const msg = (e as { message?: string } | null)?.message ?? '';
  const twice = /\bteam_twice: (.+?) holds two slots at once/.exec(msg);
  if (twice) return refusal(409, 'team_twice', R.teamTwice(twice[1]));
  const full = /\bslot_full: a slot holds (\d+)/.exec(msg);
  if (full) return refusal(409, 'slot_full', R.slotFull(Number(full[1])));
  if (/\bslot_place\b|\bblock_venue\b|\bblock_facility\b/.test(msg)) return refusal(409, 'place_gone', R.placeGone);
  if (/\bslot_team\b/.test(msg)) return refusal(409, 'team_gone', R.teamGone);
  if (/\bslot_both\b/.test(msg)) return refusal(409, 'slot_both', R.slotBoth);
  if (/\bchanged:/.test(msg)) return refusal(409, 'changed', R.changed);
  const code = (e as { code?: string } | null)?.code;
  if (code === '23514' || code === '22003' || code === '22P02' || code === '23502') return refusal(400, 'schedule_value', R.scheduleValue);
  return null;
}

/** A step's coded answer (`{ ok: false, code }`) said in words. A code this doesn't know is a server fault, never "it
 *  changed" (a reload wouldn't help). */
export function stepRefusal(r: { code?: string; teamId?: string; left?: number; version?: number }, teamName: (id: string) => string): Response {
  switch (r.code) {
    case 'not_found': return refusal(404, 'not_found', R.notFound);
    case 'changed': return refusal(409, 'changed', R.changed, { version: r.version });
    case 'already_final': return refusal(409, 'already_final', R.alreadyFinal);
    case 'not_final': return refusal(409, 'not_final', R.notFinal);
    case 'just_sent': return refusal(409, 'just_sent', R.justSent);
    case 'season_closed': return refusal(409, 'season_closed', R.seasonClosed(r.teamId ? teamName(r.teamId) : 'A team'), { teamId: r.teamId });
    case 'year_closed': return refusal(409, 'year_closed', R.billYearClosed);
    case 'over_line': return refusal(409, 'over_line', R.overLine(Number(r.left ?? 0)), { left: r.left });
    case 'line_not_found': return refusal(409, 'line_not_found', R.lineGone);
    case 'not_a_cost_line': return refusal(409, 'not_a_cost_line', R.notACostLine);
    case 'slot_not_found': return refusal(409, 'changed', R.changed);
    default:
      console.error('[club-schedule] a step answered a code nothing says:', r.code);
      return refusal(500, r.code ?? 'refused', R.notSaved);
  }
}

// ── The club's teams, as the scheduler reads them ────────────────────────────────────────────────

export interface ClubTeam extends EngineTeam {
  groupName: string | null;
  /** The team's colour (`rep_teams.color`) — its edge on the grid and its swatch in a list (R4). Null: the page's own. */
  color: string | null;
  groupOrder: number;
  /** The team's RUNNING season (Ask 15: a slot lands there; a team without one can't take one). House league's is its own
   *  id: it always runs (its league admins put the time on a season). */
  season: { id: string; name: string } | null;
  /** House league as a whole (Stage 11b) — a program, not a team. */
  program?: typeof HOUSE_LEAGUE;
}

/** House league as the scheduler reads it (Stage 11b): one holder, after every team. */
export const HOUSE_LEAGUE_HOLDER: ClubTeam = {
  id: HOUSE_LEAGUE, name: 'House league', groupId: null, groupName: null, color: null, groupOrder: Number.MAX_SAFE_INTEGER,
  age: null, many: true, season: { id: HOUSE_LEAGUE, name: 'House league' }, program: HOUSE_LEAGUE,
};

/** Every unarchived rep team of the club with its group and its running season — in the club's group order, then "Not in
 *  a group", each by name; then House league when `houseLeague` (Stage 11b). One read of each table. */
export async function readClubTeams(orgId: string, opts: { houseLeague?: boolean } = {}): Promise<ClubTeam[]> {
  const [teams, groups, seasons] = await Promise.all([
    fetchAll<{ id: string; name: string; group_id: string | null; color: string | null }>((a, b) => supabaseAdmin.from('rep_teams')
      .select('id, name, group_id, color').eq('org_id', orgId).eq('is_archived', false).order('id').range(a, b)),
    fetchAll<{ id: string; name: string; display_order: number | null }>((a, b) => supabaseAdmin.from('rep_team_groups')
      .select('id, name, display_order').eq('org_id', orgId).order('id').range(a, b)),
    fetchAll<{ id: string; team_id: string; name: string; status: string; created_at: string }>((a, b) => supabaseAdmin.from('rep_program_years')
      .select('id, team_id, name, status, created_at').eq('org_id', orgId).in('status', ['draft', 'active']).order('id').range(a, b)),
  ]);
  const group = new Map(groups.map(g => [g.id, g]));
  const out = teams.map((t): ClubTeam => {
    const live = liveSeasonOf(seasons.filter(s => s.team_id === t.id).map(s => ({ ...s, createdAt: s.created_at })));
    const g = t.group_id ? group.get(t.group_id) : undefined;
    return {
      id: t.id, name: t.name, groupId: g ? g.id : null, groupName: g?.name ?? null, color: t.color ?? null,
      groupOrder: g ? g.display_order ?? 0 : Number.MAX_SAFE_INTEGER, age: ageOf(t.name),
      season: live ? { id: live.id, name: live.name } : null,
    };
  });
  out.sort((a, b) => a.groupOrder - b.groupOrder || (a.groupName ?? '').localeCompare(b.groupName ?? '')
    || a.name.localeCompare(b.name, 'en-CA', { numeric: true }));
  return opts.houseLeague ? [...out, HOUSE_LEAGUE_HOLDER] : out;
}

// ── A schedule, read whole ───────────────────────────────────────────────────────────────────────

export interface ScheduleRow {
  id: string; org_id: string; name: string; state: 'draft' | 'in_review' | 'final'; starts_on: string; ends_on: string;
  settings: unknown; version: number; started_from_permit_id: string | null; started_from_schedule_id: string | null;
  reply_by: string | null; sent_at: string | null; sent_by: string | null; finalized_at: string | null; finalized_by: string | null;
  changed_since_sent: boolean; bill_line_id: string | null; bill_permit_id: string | null; bill_amount: number | string | null;
  bill_plan: PaymentPlan | null; bill_first_due: string | null; bill_dates: string[] | null; bill_scale: number | string | null;
  allocation_id: string | null; created_by: string | null; updated_by: string | null; created_at: string; updated_at: string;
}
const SCHEDULE_COLUMNS = 'id, org_id, name, state, starts_on, ends_on, settings, version, started_from_permit_id, started_from_schedule_id, reply_by, sent_at, sent_by, finalized_at, finalized_by, changed_since_sent, bill_line_id, bill_permit_id, bill_amount, bill_plan, bill_first_due, bill_dates, bill_scale, allocation_id, created_by, updated_by, created_at, updated_at';

export interface StoredSlot {
  id: string;
  key: string;
  venueId: string;
  facilityId: string | null;
  blockId: string | null;
  startsAt: string;
  endsAt: string;
  teamIds: string[];
  locked: boolean;
  movedByHand: boolean;
  handedBack: { at: string; by: string | null; teamId: string | null } | null;
  removed: boolean;
}

export interface LoadedSchedule {
  row: ScheduleRow;
  settings: ScheduleSettings;
  time: ScheduleTime & { blockIds: string[] };
  slots: StoredSlot[];
}

/** The schedule's own blocks (the one model of time), in its order, with their facilities. */
async function readScheduleTime(orgId: string, scheduleId: string, row: Pick<ScheduleRow, 'starts_on' | 'ends_on'>): Promise<LoadedSchedule['time']> {
  const [blocks, offs] = await Promise.all([
    fetchAll<{ id: string; org_venue_id: string; weekdays: number[]; start_time: string; end_time: string; from_date: string | null; until_date: string | null; sort_order: number; org_time_block_facilities: { facility_id: string }[] | null }>((a, b) => supabaseAdmin
      .from('org_time_blocks').select('id, org_venue_id, weekdays, start_time, end_time, from_date, until_date, sort_order, org_time_block_facilities(facility_id)')
      .eq('org_id', orgId).eq('schedule_id', scheduleId).order('sort_order').order('id').range(a, b)),
    fetchAll<{ day: string; note: string | null }>((a, b) => supabaseAdmin.from('org_time_dates_off')
      .select('day, note').eq('org_id', orgId).eq('schedule_id', scheduleId).order('day').range(a, b)),
  ]);
  return {
    startsOn: row.starts_on, endsOn: row.ends_on,
    blocks: blocks.map((b): TimeBlock => ({
      id: b.id, venueId: b.org_venue_id, facilityIds: (b.org_time_block_facilities ?? []).map(f => f.facility_id),
      weekdays: [...(b.weekdays ?? [])].map(Number).sort((x, y) => x - y), startTime: clock(b.start_time), endTime: clock(b.end_time),
      fromDate: b.from_date, untilDate: b.until_date,
    })),
    blockIds: blocks.map(b => b.id),
    datesOff: offs.map((o): DateOff => ({ day: o.day, note: o.note })),
  };
}

/** A slot's program row as PostgREST embeds it (one-to-one on the slot: an object, or an array from an older client). */
type ProgramEmbed = { program: string } | { program: string }[] | null;

/** A slot's holders as the scheduler reads them (Stage 11b): its teams in id order, then House league when a program row
 *  holds it — the floor keeps the two apart (`slot_both`), so it is one or the other. */
export function holdersOf(s: { club_schedule_slot_teams: { team_id: string }[] | null; club_schedule_slot_programs?: ProgramEmbed }): string[] {
  const teams = (s.club_schedule_slot_teams ?? []).map(t => t.team_id).sort();
  const p = s.club_schedule_slot_programs;
  const program = Array.isArray(p) ? p[0]?.program : p?.program;
  return program === HOUSE_LEAGUE ? [...teams, HOUSE_LEAGUE] : teams;
}

export async function loadSchedule(orgId: string, scheduleId: string): Promise<LoadedSchedule | null> {
  if (!isUuid(scheduleId)) return null;
  const { data, error } = await supabaseAdmin.from('club_schedules').select(SCHEDULE_COLUMNS).eq('id', scheduleId).eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as ScheduleRow;
  const [time, slotRows] = await Promise.all([
    readScheduleTime(orgId, scheduleId, row),
    fetchAll<{ id: string; org_venue_id: string; facility_id: string | null; block_id: string | null; starts_at: string; ends_at: string; locked: boolean; moved_by_hand: boolean; handed_back_at: string | null; handed_back_by: string | null; handed_back_team_id: string | null; removed_at: string | null; club_schedule_slot_teams: { team_id: string }[] | null; club_schedule_slot_programs: ProgramEmbed }>((a, b) => supabaseAdmin
      .from('club_schedule_slots').select('id, org_venue_id, facility_id, block_id, starts_at, ends_at, locked, moved_by_hand, handed_back_at, handed_back_by, handed_back_team_id, removed_at, club_schedule_slot_teams(team_id), club_schedule_slot_programs(program)')
      .eq('org_id', orgId).eq('schedule_id', scheduleId).order('starts_at').order('id').range(a, b)),
  ]);
  const read = readScheduleSettings(row.settings);
  return {
    row,
    settings: read.ok ? read.value : defaultSettings(),
    time,
    slots: slotRows.map((s): StoredSlot => ({
      id: s.id, key: slotKeyOf(s.org_venue_id, s.facility_id, Date.parse(s.starts_at)), venueId: s.org_venue_id, facilityId: s.facility_id,
      blockId: s.block_id, startsAt: s.starts_at, endsAt: s.ends_at, teamIds: holdersOf(s),
      locked: s.locked, movedByHand: s.moved_by_hand,
      handedBack: s.handed_back_at ? { at: s.handed_back_at, by: s.handed_back_by, teamId: s.handed_back_team_id } : null,
      removed: !!s.removed_at,
    })),
  };
}

/** The permit's prices for the schedule's time: each facility's share and an hour of a full field (null without one).
 *  `found`: the permit asked for is still the club's (false when none was asked for). */
export interface Prices {
  found: boolean; weightOf: (facilityId: string | null) => number; fullHour: number | null; permitCost: number | null; permitName: string | null;
  /** The permit's own budget line — what Bill the teams bills from by default (money readers only, through `pricing`). */
  lineId: string | null;
}

const NO_PRICES: Prices = { found: false, weightOf: () => 1, fullHour: null, permitCost: null, permitName: null, lineId: null };

export async function readPrices(orgId: string, permitId: string | null): Promise<Prices> {
  if (!permitId) return NO_PRICES;
  const times = await readPermitTimes(orgId, { ids: [permitId] });
  const p = times.permits[0];
  if (!p) return NO_PRICES;
  const shares = new Map(Object.entries(p.shares));
  const prices = fieldPrices(p, times.venueFacilities, shares, p.cost);
  return { found: true, weightOf: f => shareOf(shares, f), fullHour: prices.fullHour, permitCost: p.cost, permitName: p.name, lineId: p.budgetLineId };
}

/** A stored slot as the engine reads it: its club day and clock worked out from its instants, its prime and its price. */
export function engineSlotOf(s: Pick<StoredSlot, 'key' | 'venueId' | 'facilityId' | 'startsAt' | 'endsAt'>, blockIndex: number, settings: ScheduleSettings, weightOf: (f: string | null) => number): Slot {
  const start = utcToZonedInputs(s.startsAt), end = utcToZonedInputs(s.endsAt);
  const weekday = weekdayOf(start.date);
  return {
    key: s.key, venueId: s.venueId, facilityId: s.facilityId, blockIndex, day: start.date, weekday, week: mondayOfDay(start.date),
    startClock: start.time, endClock: end.time, startMs: Date.parse(s.startsAt), endMs: Date.parse(s.endsAt),
    pos: `${weekday}|${start.time}|${s.venueId}|${s.facilityId ?? ''}`,
    prime: isPrimeSlot(settings.prime, weekday, start.time, end.time), weight: weightOf(s.facilityId),
  };
}

// ── The engine's inputs, from the database ───────────────────────────────────────────────────────

/**
 * Everything the engine reads besides the time and the settings: the club's places, the bookings already on the books (the
 * clash pool, never this schedule's own practices), each ticked team's own bookings in the window (its WHOLE schedule —
 * away games on typed places included, P11-04c), and the permit's prices. A caller that already read the places or the
 * prices passes them in.
 */
export async function engineContext(orgId: string, p: {
  slotIds: readonly string[];
  teamIds: readonly string[];
  fromMs: number;
  toMs: number;
  permitId: string | null;
  places?: ClubPlaces;
  prices?: Prices;
}): Promise<{ places: ClubPlaces; pool: PoolBooking[]; teamBookings: Map<string, TeamBooking[]>; prices: Prices }> {
  const own = new Set(p.slotIds);
  // House league has no team bookings of its own here: its league admins' games and practices are in the pool.
  p = { ...p, teamIds: teamsOnly(p.teamIds) };
  const [places, pool, events, tryouts, prices] = await Promise.all([
    p.places ?? readClubPlaces(orgId),
    readClubBookings(orgId, p.fromMs, p.toMs),
    p.teamIds.length ? fetchAllIn<{ id: string; team_id: string; event_type: string; starts_at: string; ends_at: string | null; status: string; club_schedule_slot_id: string | null }>(p.teamIds, (c, a, b) => supabaseAdmin
      .from('rep_team_events').select('id, team_id, event_type, starts_at, ends_at, status, club_schedule_slot_id')
      .eq('org_id', orgId).in('team_id', c).neq('status', 'cancelled')
      .gte('starts_at', new Date(p.fromMs - 7 * 86_400_000).toISOString()).lte('starts_at', new Date(p.toMs + 86_400_000).toISOString())
      .order('id').range(a, b)) : Promise.resolve([]),
    p.teamIds.length ? fetchAllIn<{ team_id: string; starts_at: string; ends_at: string | null; status: string | null }>(p.teamIds, (c, a, b) => supabaseAdmin
      .from('rep_tryout_sessions').select('team_id, starts_at, ends_at, status').eq('org_id', orgId).in('team_id', c)
      .gte('starts_at', new Date(p.fromMs - 86_400_000).toISOString()).lte('starts_at', new Date(p.toMs + 86_400_000).toISOString())
      .order('id').range(a, b)) : Promise.resolve([]),
    p.prices ?? readPrices(orgId, p.permitId),
  ]);
  const ownEvent = (slot: string | null | undefined) => !!slot && own.has(slot);
  const poolBookings: PoolBooking[] = pool.bookings
    .filter(b => !ownEvent(b.clubSlotOf))
    .map(b => ({ key: b.key, venueId: b.venueId, facilityId: b.facilityId, startMs: b.startMs, endMs: b.endMs, ownerName: b.ownerName, kind: b.kind }));
  const teamBookings = new Map<string, TeamBooking[]>();
  const add = (teamId: string, startIso: string, endIso: string | null, isGame: boolean) => {
    const startMs = Date.parse(startIso);
    const endMs = endIso && Date.parse(endIso) > startMs ? Date.parse(endIso) : startMs + 90 * 60_000;
    const last = utcToZonedInputs(new Date(endMs - 1).toISOString()).date;
    const days: string[] = [];
    for (let d = utcToZonedInputs(startIso).date; d <= last && days.length < 40; d = addCalendarDays(d, 1)) days.push(d);
    (teamBookings.get(teamId) ?? teamBookings.set(teamId, []).get(teamId)!).push({ startMs, endMs, isGame, days });
  };
  for (const e of events) {
    if (ownEvent(e.club_schedule_slot_id)) continue;
    add(e.team_id, e.starts_at, e.ends_at, ['league_game', 'tournament_game', 'scrimmage', 'external_tournament'].includes(e.event_type));
  }
  for (const t of tryouts) if (t.status !== 'cancelled') add(t.team_id, t.starts_at, t.ends_at, false);
  return { places, pool: poolBookings, teamBookings, prices };
}

/** The time and the settings, checked the way the save checks them (a refusal in words, or the slots it holds). */
export function checkTime(time: ScheduleTime, settings: ScheduleSettings, places: ClubPlaces, weightOf: (f: string | null) => number): { ok: true; slots: Slot[] } | Refused {
  if (!time.blocks.length) return no('no_time', R.noTime);
  for (const b of time.blocks) {
    if (!places.venueName.has(b.venueId)) return no('place_gone', 'A venue in this schedule isn’t in the Venue library any more.');
    if (b.facilityIds.some(f => !(places.byVenue.get(b.venueId) ?? []).includes(f))) return no('place_gone', 'A facility in this schedule isn’t at its venue any more.');
  }
  if (overlappingBlocks({ blocks: time.blocks }, places.byVenue)) return no('overlapping_blocks', R.overlappingBlocks);
  const slots = cutSlots(time, { slotMinutes: settings.slotMinutes, changeoverMinutes: settings.changeoverMinutes, prime: settings.prime, venueFacilities: places.byVenue, weightOf });
  if (slots.length > MAX_SLOTS) return no('too_many_slots', R.tooManySlots(MAX_SLOTS));
  if (!slots.length) return no('no_time', R.noTime);
  return { ok: true, slots };
}

/** The engine's whole input for a schedule's time and settings. `storedSlots`: a regenerate's, whose locked and moved
 *  slots it keeps. */
export async function buildEngineInput(orgId: string, p: {
  time: ScheduleTime;
  settings: ScheduleSettings;
  teams: readonly ClubTeam[];
  storedSlots: readonly StoredSlot[];
  permitId: string | null;
  places?: ClubPlaces;
}): Promise<{ ok: true; input: EngineInput; prices: Prices; places: ClubPlaces; pool: PoolBooking[] } | Refused> {
  const ticked = p.settings.teamIds.map(id => p.teams.find(t => t.id === id)).filter((t): t is ClubTeam => !!t);
  const fromMs = Date.parse(`${p.time.startsOn}T00:00:00Z`) - 86_400_000, toMs = Date.parse(`${p.time.endsOn}T23:59:59Z`) + 86_400_000;
  const ctx = await engineContext(orgId, {
    slotIds: p.storedSlots.map(s => s.id), teamIds: ticked.map(t => t.id), fromMs, toMs, permitId: p.permitId, places: p.places,
  });
  const checked = checkTime(p.time, p.settings, ctx.places, ctx.prices.weightOf);
  if (!checked.ok) return checked;
  // A regenerate keeps every slot locked or moved by hand (Ask 19) — by place and start, so a slot whose time the new
  // settings no longer cut is not kept (its team is said, never silently dropped: `notKept`).
  const fixed = new Map<string, string[]>();
  for (const s of p.storedSlots) if (!s.removed && (s.locked || s.movedByHand)) fixed.set(s.key, s.teamIds.filter(t => ticked.some(x => x.id === t)));
  const input: EngineInput = {
    slots: checked.slots, teams: ticked, settings: p.settings, held: heldSlots(checked.slots, ctx.pool),
    teamBookings: ctx.teamBookings, fixed,
  };
  return { ok: true, input, prices: ctx.prices, places: ctx.places, pool: ctx.pool };
}

// ── The page (specimens 6–10, 14) ────────────────────────────────────────────────────────────────

export interface SlotView {
  id: string; key: string; venueId: string; facilityId: string | null; startsAt: string; endsAt: string;
  day: string; weekday: number; week: string; startClock: string; endClock: string; prime: boolean; weight: number;
  teamIds: string[]; locked: boolean; movedByHand: boolean;
  handedBack: { at: string; teamId: string | null } | null;
  /** A booking already on the books holds it: drawn as that booking ("Tryout day · 13U AAA"). */
  heldBy: { ownerName: string; kind: string | null } | null;
  /** Given to a team while a booking holds it — the amber flag (6a's rule). */
  clash: boolean;
  /** A slot House league holds (Stage 11b): how its league admins used it ("U12 games", "U12 practice time" — null: Not
   *  given yet), and the teams with a practice on it still to come (k5 names them before the club takes it back). */
  houseLeague?: { use: string | null; practiceTeams: string[] } | null;
}

export interface BillView {
  lineId: string | null; permitId: string | null; amount: number | null; plan: PaymentPlan; firstDue: string | null; dates: string[] | null;
  /** The permit's price: a full field's hour, and the permit's cost (null without a permit). */
  fullHour: number | null; permitCost: number | null;
  totalCents: number; timePriceCents: number | null; closing: ClosingRow;
  teams: { teamId: string; cents: number; pricedHours: number; installments: Installment[] }[];
  dues: string[];
  /** After Finalize: the bill it became. */
  allocationId: string | null;
}

/** A schedule's slots as the bill reads them: each slot's time, its field's price share, its teams. */
export function billSlotsOf(slots: readonly Slot[], assignments: ReadonlyMap<string, readonly string[]>): BillSlot[] {
  return slots.map(s => ({ day: s.day, startMs: s.startMs, endMs: s.endMs, weight: s.weight, teamIds: assignments.get(s.key) ?? [] }));
}

export interface BillNow { billSlots: BillSlot[]; priced: Map<string, number>; shares: BillShares | null; periods: PaymentPeriod[] }

/**
 * THE BILL NOW (Ask 23), worked out in this one place so the schedule's page, the send and a coach's review card agree
 * to the cent: the split's rounding follows `teamOrder`, which every caller gives as the club's team order
 * (`readClubTeams`). Null when no bill rides with the schedule.
 */
export function computeBill(
  row: Pick<ScheduleRow, 'bill_plan' | 'bill_amount' | 'bill_first_due' | 'bill_dates' | 'ends_on'>,
  billSlots: BillSlot[], fullHour: number | null, teamOrder: readonly string[],
): BillNow | null {
  if (!row.bill_plan) return null;
  const priced = pricedMinutes(billSlots);
  return {
    billSlots, priced,
    shares: billShares(priced, { fullHour, amount: row.bill_amount == null ? null : Number(row.bill_amount), teamOrder }),
    periods: paymentPeriods(row.bill_plan, { firstDue: row.bill_first_due, dates: row.bill_dates, lastDay: row.ends_on }),
  };
}

/** What the teams would be billed now (Ask 23), as the page reads it — null when no bill rides with the schedule. Once
 *  `made`, it is the bill Finalize made: each team's share and payments read from the bill itself, never worked out
 *  again from the slots as they stand — a hand-back, with money or without, leaves it as it was (Stage 11d Ask 6; 3d Ask
 *  7b), and a club change is billed or credited on its own. Hours stay the time each team holds now, as Fair shares
 *  counts it. */
export function billViewOf(row: ScheduleRow, bill: BillNow | null, prices: Prices, made: ScheduleMoney['made'] | null = null): BillView | null {
  if (!bill || !row.bill_plan) return null;
  const { shares, priced, periods, billSlots } = bill;
  const hours = (teamId: string) => Math.round(((priced.get(teamId) ?? 0) / 60) * 100) / 100;
  const rank = new Map([...(shares?.shares.keys() ?? [])].map((t, i) => [t, i]));
  const teams = made
    ? [...made].sort((a, b) => (rank.get(a.teamId) ?? 1e9) - (rank.get(b.teamId) ?? 1e9)).map(m => ({ ...m, pricedHours: hours(m.teamId) }))
    : shares ? [...shares.shares].map(([teamId, cents]) => ({ teamId, cents, pricedHours: hours(teamId), installments: teamInstallments(teamId, cents, billSlots, periods) })) : [];
  const total = made ? teams.reduce((n, t) => n + t.cents, 0) : shares?.totalCents ?? 0;
  return {
    lineId: row.bill_line_id, permitId: row.bill_permit_id, amount: row.bill_amount == null ? null : Number(row.bill_amount),
    plan: row.bill_plan, firstDue: row.bill_first_due, dates: row.bill_dates,
    fullHour: prices.fullHour, permitCost: prices.permitCost,
    totalCents: total, timePriceCents: shares?.timePriceCents ?? null, closing: closingRow(total, prices.permitCost),
    teams,
    dues: made ? [...new Set(teams.flatMap(t => t.installments.map(i => i.dueDate)))].sort() : periods.map(p => p.due),
    allocationId: row.allocation_id,
  };
}

/** The live slots as the engine and the bill read them. */
export function liveSlots(loaded: LoadedSchedule, weightOf: (f: string | null) => number): { slots: Slot[]; assignments: Map<string, string[]>; stored: StoredSlot[] } {
  const blockIndex = new Map(loaded.time.blockIds.map((id, i) => [id, i]));
  const stored = loaded.slots.filter(s => !s.removed);
  return {
    stored,
    slots: stored.map(s => engineSlotOf(s, s.blockId ? blockIndex.get(s.blockId) ?? 0 : 0, loaded.settings, weightOf)),
    assignments: new Map(stored.map(s => [s.key, s.teamIds])),
  };
}

export interface ScheduleView {
  schedule: {
    id: string; name: string; state: ScheduleRow['state']; startsOn: string; endsOn: string; version: number;
    settings: ScheduleSettings; startedFromPermitId: string | null; startedFromScheduleId: string | null;
    replyBy: string | null; changedSinceSent: boolean;
    sent: { at: string; by: string | null } | null; finalized: { at: string; by: string | null } | null;
  };
  time: { blocks: TimeBlock[]; datesOff: DateOff[] };
  places: { venueId: string; venueName: string; facilities: { id: string; name: string }[] }[];
  teams: { id: string; name: string; groupId: string | null; groupName: string | null; color: string | null; season: ClubTeam['season'] }[];
  slots: SlotView[];
  fairness: {
    totals: { slots: number; seats: number; handedOut: number; open: number; held: number; short: number; clashes: number };
    teams: TeamResult[];
  };
  bill: BillView | null;
  /**
   * What the schedule's permit prices the time at (Ask 23 — Fair shares counts the bill beside the slots once a permit
   * stands behind it, and Bill the teams opens filled in from it): an hour of a full field, the permit's cost, its name
   * and its budget line. MONEY: null unless `canMoney` (as `bill` is), and null without a permit.
   */
  pricing: { permitId: string; permitName: string | null; fullHour: number | null; permitCost: number | null; lineId: string | null } | null;
  /** The club's team order — the order every bill shares its rounding cents in (`computeBill`, the send); a screen that
   *  works a bill out passes it, so its table and what Finalize bills agree to the cent. */
  teamOrder: string[];
  canMoney: boolean;
  /** The club has house league: a slot's Give it to offers House league under Programs (Stage 11b, h3). */
  houseLeague: boolean;
  /** The asks waiting on this schedule, oldest first (Stage 11d part B — the callout, the ringed Sundays, the slot window). */
  asks: ScheduleAsk[];
  /** MONEY — null unless `canMoney` and the schedule has made its bill: what each team pays for its time, in cents (its
   *  bills from the schedule less their credits, less the money given back on it — `scheduleTeamPays`), so Fair shares'
   *  Bill reads what Money › Club reads (Stage 11d, Not drawn: Fair shares). */
  pays: Record<string, number> | null;
  /** MONEY — empty unless `pays` is read: the Sundays each team handed back with no money settled (Fair shares' note, D4),
   *  and whether money already came off the team's bill some other way (its note can't say "its bill stays" then). */
  kept: (KeptHandBack & { billMoved: boolean })[];
}

/** A waiting ask on the schedule (Stage 11d part B, specimen 3 — Asks 3, 4; part C's late ask). */
export interface ScheduleAsk {
  id: string; teamId: string; teamName: string;
  /** A LATE ask (part C, Ask 12): money for Sundays the team already handed back — their time is open, so none is ringed. */
  late: boolean;
  /** Club days: when it was asked; for a late ask, when the team handed the Sundays back. */
  askedOn: string; handedBackOn: string | null;
  askedBy: string | null;
  /** MONEY: the figure, null for a reader without the club's Accounting (part A's bell leaves it out the same way). */
  cents: number | null;
  count: number; weekday: number | null;
  /** The Sundays it counts, as they stand (a waiting ask: those still to come the team still holds — Ask 7), in order. */
  sundays: { slotId: string | null; startsAt: string; venueId: string | null; facilityId: string | null }[];
}

/** House league's slots as the club's schedule reads them (Stage 11b): each one's use ("U12 games"), and the teams with a
 *  live practice on it still to come. The club never divides house league's time; it only reads how it was divided. */
async function houseLeagueSlots(orgId: string, slotIds: readonly string[]): Promise<Map<string, { use: string | null; practiceTeams: string[] }>> {
  const out = new Map<string, { use: string | null; practiceTeams: string[] }>();
  if (!slotIds.length) return out;
  const now = new Date().toISOString();
  const [uses, practices] = await Promise.all([
    fetchAllIn<{ slot_id: string; kind: 'games' | 'practices'; league_divisions: { name: string } | null }>(slotIds, (c, a, b) => supabaseAdmin
      .from('league_slot_uses').select('slot_id, kind, league_divisions ( name )').eq('org_id', orgId).in('slot_id', c).order('slot_id').range(a, b)),
    fetchAllIn<{ club_schedule_slot_id: string; league_teams: { name: string } | null }>(slotIds, (c, a, b) => supabaseAdmin
      .from('league_practices').select('club_schedule_slot_id, league_teams ( name )').eq('org_id', orgId).in('club_schedule_slot_id', c)
      .eq('status', 'scheduled').gt('scheduled_at', now).order('id').range(a, b)),
  ]);
  for (const id of slotIds) out.set(id, { use: null, practiceTeams: [] });
  for (const u of uses) out.get(u.slot_id)!.use = u.league_divisions ? houseLeagueUse(u.league_divisions.name, u.kind) : null;
  for (const p of practices) if (p.league_teams) out.get(p.club_schedule_slot_id)!.practiceTeams.push(p.league_teams.name);
  for (const v of out.values()) v.practiceTeams = [...new Set(v.practiceTeams)].sort((x, y) => x.localeCompare(y, 'en-CA', { numeric: true }));
  return out;
}

/** THE SCHEDULE'S PAGE: the schedule, its time, every slot (held and clashing marked), fairness, the bill. */
export async function scheduleView(orgId: string, loaded: LoadedSchedule, canMoney: boolean, opts: { houseLeague?: boolean } = {}): Promise<ScheduleView> {
  const row = loaded.row;
  const permitId = row.bill_permit_id ?? row.started_from_permit_id;
  const live = loaded.slots.filter(s => !s.removed);
  const fromMs = Math.min(...live.map(s => Date.parse(s.startsAt)), Date.parse(`${row.starts_on}T00:00:00Z`));
  const toMs = Math.max(...live.map(s => Date.parse(s.endsAt)), Date.parse(`${row.ends_on}T23:59:59Z`));
  // Once the schedule made its bill, a money reader reads the money side — what each team pays and the bill as Finalize
  // made it, in one read — and the plain hand-backs that leave a bill as it was (Stage 11d part B — S11D-05's two numbers).
  const billed = canMoney && row.state === 'final' && !!row.allocation_id;
  const [teams, ctx, nameOf, waiting, money, plainBacks] = await Promise.all([
    // House league is always named when a slot holds it, whether or not the club still has house league.
    readClubTeams(orgId, { houseLeague: true }),
    engineContext(orgId, { slotIds: loaded.slots.map(s => s.id), teamIds: [], fromMs, toMs, permitId }),
    resolvePersonNamer(orgId, [row.sent_by, row.finalized_by]),
    row.state === 'final' ? waitingAsksOfSchedule(orgId, row.id) : Promise.resolve([]),
    billed ? scheduleMoney(orgId, row.id, row.allocation_id!) : Promise.resolve(null),
    billed ? keptHandBacks(orgId, row.id, new Map(live.map(s => [s.id, s.teamIds]))) : Promise.resolve([]),
  ]);
  const { slots, assignments, stored } = liveSlots(loaded, ctx.prices.weightOf);
  const held = heldSlots(slots, ctx.pool);
  const houseLeagueOf = await houseLeagueSlots(orgId, stored.filter(s => s.teamIds.some(isProgramHolder)).map(s => s.id));
  const teamById = new Map(teams.map(t => [t.id, t]));
  const ticked = loaded.settings.teamIds.map(id => teamById.get(id)).filter((t): t is ClubTeam => !!t);
  const tickedIds = new Set(ticked.map(t => t.id));
  const inSlots = [...new Set(stored.flatMap(s => s.teamIds))].filter(id => !tickedIds.has(id)).map(id => teamById.get(id)).filter((t): t is ClubTeam => !!t);
  const allTeams = [...ticked, ...inSlots];
  const avoid = loaded.settings.rules.avoidBookings;
  // A slot locked or moved by hand is kept whatever holds it: it counts as a seat, never as left out.
  const kept = new Set(stored.filter(s => s.locked || s.movedByHand).map(s => s.key));
  const counts = seatCounts(slots, loaded.settings, held, kept);
  const seats = counts.capacity;
  const targets = shareTargets(ticked, loaded.settings, counts);
  const results = teamResults(slots, assignments, allTeams, targets);
  // Slots given to a team — a shared slot once (Stage 11c: "Handed out 250 of 300").
  const handedOut = stored.filter(s => s.teamIds.length > 0).length;
  const clashes = slots.filter(s => held.has(s.key) && (assignments.get(s.key) ?? []).length).length;
  const placeIds = [...new Set(loaded.time.blocks.map(b => b.venueId))];
  return {
    schedule: {
      id: row.id, name: row.name, state: row.state, startsOn: row.starts_on, endsOn: row.ends_on, version: row.version,
      settings: loaded.settings, startedFromPermitId: row.started_from_permit_id, startedFromScheduleId: row.started_from_schedule_id,
      replyBy: row.reply_by, changedSinceSent: row.changed_since_sent,
      sent: row.sent_at ? { at: row.sent_at, by: nameOf(row.sent_by) } : null,
      finalized: row.finalized_at ? { at: row.finalized_at, by: nameOf(row.finalized_by) } : null,
    },
    time: { blocks: [...loaded.time.blocks], datesOff: [...loaded.time.datesOff] },
    places: placeIds.map(v => ({
      venueId: v, venueName: ctx.places.venueName.get(v) ?? '',
      facilities: (ctx.places.byVenue.get(v) ?? []).map(f => ({ id: f, name: ctx.places.facilityName.get(f) ?? '' })),
    })),
    teams: allTeams.map(t => ({ id: t.id, name: t.name, groupId: t.groupId, groupName: t.groupName, color: t.color, season: t.season })),
    teamOrder: teams.map(t => t.id),
    slots: stored.map((s, i) => {
      const e = slots[i];
      const h = held.get(s.key);
      return {
        id: s.id, key: s.key, venueId: s.venueId, facilityId: s.facilityId, startsAt: s.startsAt, endsAt: s.endsAt,
        day: e.day, weekday: e.weekday, week: e.week, startClock: e.startClock, endClock: e.endClock, prime: e.prime, weight: e.weight,
        teamIds: s.teamIds, locked: s.locked, movedByHand: s.movedByHand,
        handedBack: s.handedBack ? { at: s.handedBack.at, teamId: s.handedBack.teamId } : null,
        heldBy: h ? { ownerName: h.ownerName, kind: h.kind ?? null } : null,
        clash: !!h && s.teamIds.length > 0,
        houseLeague: s.teamIds.some(isProgramHolder) ? houseLeagueOf.get(s.id) ?? { use: null, practiceTeams: [] } : null,
      };
    }),
    fairness: {
      totals: {
        slots: slots.length, seats, handedOut, open: Math.max(0, seats - handedOut), held: avoid ? slots.filter(s => held.has(s.key) && !kept.has(s.key)).length : 0,
        short: results.reduce((n, r) => n + r.short, 0), clashes,
      },
      teams: results,
    },
    // The bill and its money read only to a money reader (stripped on the server, as a permit's money is); once made, the
    // bill Finalize made.
    // A bill whose rows can't be read (none came back) falls back to the time priced now, never an empty bill (/review).
    bill: canMoney ? billViewOf(row, computeBill(row, billSlotsOf(slots, assignments), ctx.prices.fullHour, teams.map(t => t.id)), ctx.prices, money?.made.length ? money.made : null) : null,
    pricing: canMoney && permitId && ctx.prices.found
      ? { permitId, permitName: ctx.prices.permitName, fullHour: ctx.prices.fullHour, permitCost: ctx.prices.permitCost, lineId: ctx.prices.lineId }
      : null,
    canMoney,
    houseLeague: !!opts.houseLeague,
    // An ask with no Sunday left to count (every one started, or came back to the team) lapses at the next sweep, and
    // Accept refuses it: a callout whose Answer can only refuse is a dead end, so it isn't shown (Payment requests keeps it).
    asks: waiting.filter(a => a.count > 0).map(a => ({
      id: a.id, teamId: a.teamId, teamName: a.teamName, late: !!a.lateFor,
      askedOn: clubDay(a.askedAt), handedBackOn: a.handedBackAt ? clubDay(a.handedBackAt) : null, askedBy: a.askedByName,
      cents: canMoney ? a.cents : null, count: a.count, weekday: a.weekday,
      sundays: a.sundays.map(s => ({ slotId: s.slotId, startsAt: s.startsAt, venueId: s.venueId, facilityId: s.facilityId })),
    })),
    pays: money ? Object.fromEntries([...money.teams].map(([t, p]) => [t, p.pays])) : null,
    kept: plainBacks.map(k => {
      const p = money?.teams.get(k.teamId);
      return { ...k, billMoved: !!p && p.pays !== p.billed };
    }),
  };
}

// ── The list (specimen 4) ────────────────────────────────────────────────────────────────────────

export interface ScheduleListRow {
  id: string; name: string; state: ScheduleRow['state']; changedSinceSent: boolean; startsOn: string; endsOn: string;
  band: 'in_use' | 'coming_up' | 'ended';
  places: string[]; teams: number; handedOut: number; open: number;
  lastSent: { at: string; by: string | null } | null;
}

export async function scheduleList(orgId: string): Promise<ScheduleListRow[]> {
  const rows = await fetchAll<Pick<ScheduleRow, 'id' | 'name' | 'state' | 'starts_on' | 'ends_on' | 'settings' | 'changed_since_sent' | 'sent_at' | 'sent_by'>>((a, b) => supabaseAdmin
    .from('club_schedules').select('id, name, state, starts_on, ends_on, settings, changed_since_sent, sent_at, sent_by').eq('org_id', orgId).order('id').range(a, b));
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const [blocks, slots, places] = await Promise.all([
    fetchAllIn<{ schedule_id: string; org_venue_id: string; org_time_block_facilities: { facility_id: string }[] | null }>(ids, (c, a, b) => supabaseAdmin
      .from('org_time_blocks').select('schedule_id, org_venue_id, org_time_block_facilities(facility_id)').eq('org_id', orgId).in('schedule_id', c).order('id').range(a, b)),
    fetchAllIn<{ schedule_id: string; club_schedule_slot_teams: { team_id: string }[] | null; club_schedule_slot_programs: ProgramEmbed }>(ids, (c, a, b) => supabaseAdmin
      .from('club_schedule_slots').select('schedule_id, club_schedule_slot_teams(team_id), club_schedule_slot_programs(program)').eq('org_id', orgId).in('schedule_id', c).is('removed_at', null).order('id').range(a, b)),
    readClubPlaces(orgId),
  ]);
  const nameOf = await resolvePersonNamer(orgId, rows.map(r => r.sent_by));
  const today = tournamentToday();
  return rows.map(r => {
    const read = readScheduleSettings(r.settings);
    const mine = slots.filter(s => s.schedule_id === r.id);
    // A slot handed out is one a team has, however many share it (Stage 11c); an open one has nobody.
    const handedOut = mine.filter(s => holdersOf(s).length > 0).length;
    const placeWords = blocks.filter(b => b.schedule_id === r.id).map(b => {
      const venue = places.venueName.get(b.org_venue_id) ?? '';
      // In the venue's order and said as the page says it: "Lakeshore Dome · Fields 1–6" (/design, 2026-10-11).
      const facilities = (b.org_time_block_facilities ?? []).map(f => places.facilityName.get(f.facility_id)).filter((x): x is string => !!x)
        .sort((x, y) => x.localeCompare(y, 'en-CA', { numeric: true }));
      return facilities.length ? `${venue} · ${facilities.length >= 3 ? facilityListWords(facilities) : facilities.join(', ')}` : venue;
    });
    return {
      id: r.id, name: r.name, state: r.state, changedSinceSent: r.changed_since_sent, startsOn: r.starts_on, endsOn: r.ends_on,
      band: r.ends_on < today ? 'ended' as const : r.starts_on > today ? 'coming_up' as const : 'in_use' as const,
      places: [...new Set(placeWords)], teams: read.ok ? read.value.teamIds.length : 0,
      handedOut, open: Math.max(0, mine.length - handedOut),
      lastSent: r.sent_at ? { at: r.sent_at, by: nameOf(r.sent_by) } : null,
    };
  }).sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.name.localeCompare(b.name));
}

// ── The writers ──────────────────────────────────────────────────────────────────────────────────

/** A schedule's time as `club_schedule_save` takes it. */
export function timePayload(time: ScheduleTime & { blockIds?: (string | null)[] }) {
  return {
    startsOn: time.startsOn, endsOn: time.endsOn,
    blocks: time.blocks.map((b, i) => ({
      id: time.blockIds?.[i] ?? null, venueId: b.venueId, facilityIds: b.facilityIds, weekdays: b.weekdays,
      startTime: clock(b.startTime), endTime: clock(b.endTime), fromDate: b.fromDate, untilDate: b.untilDate,
    })),
    datesOff: time.datesOff.map(d => ({ day: d.day, note: d.note })),
  };
}

/** Every slot of the time, with the teams a draft (or a kept slot) gives it — what `club_schedule_save` stores. */
export function slotsPayload(slots: readonly Slot[], assignments: ReadonlyMap<string, readonly string[]>, kept: ReadonlyMap<string, StoredSlot>) {
  return slots.map(s => {
    const k = kept.get(s.key);
    // House league goes as the slot's program, never as a team (Stage 11b; the floor refuses both, `slot_both`).
    const held = storedHolders(k && (k.locked || k.movedByHand) ? k.teamIds : [...(assignments.get(s.key) ?? [])]);
    return {
      venueId: s.venueId, facilityId: s.facilityId, startsAt: new Date(s.startMs).toISOString(), endsAt: new Date(s.endMs).toISOString(),
      blockIndex: s.blockIndex,
      teamIds: held.teamIds, program: held.program,
      locked: k?.locked ?? false, movedByHand: k?.movedByHand ?? false,
    };
  });
}

/** A writer's answer: the step's own, or a refusal in words (the floor's raise, or the step's code). */
async function runStep<T extends { ok: boolean; code?: string }>(call: PromiseLike<{ data: unknown; error: unknown }>): Promise<{ ok: true; out: T } | { ok: false; response: Response }> {
  const { data, error } = await call;
  if (error) {
    const said = floorRefusal(error);
    if (said) return { ok: false, response: said };
    throw error;
  }
  const r = data as T;
  return r.ok ? { ok: true, out: r } : { ok: false, response: stepRefusal(r, () => 'A team') };
}

/** One save through the one step. Answers the new version, or a refusal in words. */
export async function saveScheduleStep(orgId: string, scheduleId: string | null, actor: string, version: number, data: Record<string, unknown>): Promise<{ ok: true; id: string; version: number } | { ok: false; response: Response }> {
  const r = await runStep<{ ok: boolean; id: string; version: number }>(
    supabaseAdmin.rpc('club_schedule_save', { p_org: orgId, p_schedule: scheduleId, p_actor: actor, p_version: version, p_data: data }));
  return r.ok ? { ok: true, id: r.out.id, version: r.out.version } : r;
}

/** Hand edits on the grid through the one step (Ask 13). */
export async function editSlotsStep(orgId: string, scheduleId: string, actor: string, version: number, edits: { slotId: string; teamIds?: string[]; locked?: boolean; movedByHand?: boolean }[]): Promise<{ ok: true; version: number } | { ok: false; response: Response }> {
  // An edit that names the slot's holders names them whole: its teams, and House league as its program (Stage 11b).
  const stored = edits.map(e => (e.teamIds ? { ...e, ...storedHolders(e.teamIds) } : e));
  const r = await runStep<{ ok: boolean; version: number }>(
    supabaseAdmin.rpc('club_schedule_edit_slots', { p_org: orgId, p_schedule: scheduleId, p_actor: actor, p_version: version, p_edits: stored }));
  return r.ok ? { ok: true, version: r.out.version } : r;
}

/** The schedule's name for the coach's refusal (a club practice names where it came from). */
export async function scheduleNameOfSlot(slotId: string): Promise<string> {
  const { data, error } = await supabaseAdmin.from('club_schedule_slots').select('club_schedules ( name )').eq('id', slotId).maybeSingle();
  if (error) throw error;
  return ((data as { club_schedules?: { name?: string } | null } | null)?.club_schedules?.name) || 'the club’s schedule';
}

/** The club's teams by id, for words. */
export const teamNamer = (teams: readonly { id: string; name: string }[]) => (id: string) => teams.find(t => t.id === id)?.name ?? 'A team';

export { refusal as schedulerRefusal };

// ── A schedule's time, off a request ─────────────────────────────────────────────────────────────

/**
 * The time New schedule (or Settings…) sends: its dates, its rows of days and hours (blocks), its dates off. Every field
 * checked and every refusal a sentence. The facilities are checked against the club's places by `checkTime`.
 */
export function readTimeBody(body: Record<string, unknown>): { ok: true; time: ScheduleTime & { blockIds: (string | null)[] } } | Refused {
  const bad = (error: string) => no('bad_time', error);
  const startsOn = body.startsOn, endsOn = body.endsOn;
  if (typeof startsOn !== 'string' || !isCalendarDate(startsOn) || typeof endsOn !== 'string' || !isCalendarDate(endsOn)) return bad('Give the schedule its first and last day.');
  if (endsOn < startsOn) return bad('The last day is before the first.');
  if ((Date.parse(endsOn) - Date.parse(startsOn)) / 86_400_000 > 400) return bad('A schedule runs at most 400 days.');
  if (!Array.isArray(body.blocks) || !body.blocks.length || body.blocks.length > 40) return no('no_time', R.noTime);
  const blocks: TimeBlock[] = [], blockIds: (string | null)[] = [];
  for (const raw of body.blocks as Record<string, unknown>[]) {
    const venueId = raw?.venueId, facilityIds = raw?.facilityIds, weekdays = raw?.weekdays;
    if (!isUuid(venueId)) return bad('Each row of hours needs its venue.');
    if (!Array.isArray(facilityIds) || !facilityIds.every(isUuid)) return bad('Pick the facilities again.');
    if (!Array.isArray(weekdays) || !weekdays.length || !weekdays.every(d => Number.isInteger(d) && d >= 1 && d <= 7)) return bad('Each row of hours needs its days.');
    if (!isClock(raw.startTime) || !isClock(raw.endTime) || raw.endTime <= raw.startTime) return bad('Each row of hours needs a start and a later end.');
    const fromDate = typeof raw.fromDate === 'string' && isCalendarDate(raw.fromDate) ? raw.fromDate : null;
    const untilDate = typeof raw.untilDate === 'string' && isCalendarDate(raw.untilDate) ? raw.untilDate : null;
    const id = isUuid(raw.id) ? raw.id : null;
    blocks.push({ id: id ?? `new-${blocks.length}`, venueId, facilityIds: [...new Set(facilityIds as string[])], weekdays: [...new Set(weekdays as number[])].sort((a, b) => a - b), startTime: raw.startTime, endTime: raw.endTime, fromDate, untilDate });
    blockIds.push(id);
  }
  const datesOff: DateOff[] = [];
  if (body.datesOff !== undefined) {
    if (!Array.isArray(body.datesOff) || body.datesOff.length > 200) return bad('Pick the dates off again.');
    for (const d of body.datesOff as Record<string, unknown>[]) {
      if (typeof d?.day !== 'string' || !isCalendarDate(d.day)) return bad('A date off needs its date.');
      datesOff.push({ day: d.day, note: typeof d.note === 'string' ? d.note.trim().slice(0, 120) || null : null });
    }
  }
  return { ok: true, time: { startsOn, endsOn, blocks, datesOff, blockIds } };
}

/** The names a schedule is given, checked: 1–120 characters. */
export function readName(raw: unknown): string | null {
  const name = typeof raw === 'string' ? raw.trim() : '';
  return name.length >= 1 && name.length <= 120 ? name : null;
}

/** A draft's assignments `[{ slotKey, teamIds }]` — each key one of the time's slots, each team one with a running
 *  season, and each slot holding only the teams it has room for (`room` — a sharing rule's teams up to its number, one
 *  team otherwise, Stage 11c). `room` answers the refusal's words, or null when the slot holds them. */
export function readAssignments(raw: unknown, slots: readonly Slot[], teams: ReadonlySet<string>, room: (teamIds: string[], slot: Slot) => string | null):
  { ok: true; value: Map<string, string[]> } | Refused {
  const out = new Map<string, string[]>();
  if (raw === undefined || raw === null) return { ok: true, value: out };
  if (!Array.isArray(raw)) return no('bad_draft', 'Pick a draft again.');
  const byKey = new Map(slots.map(s => [s.key, s]));
  for (const a of raw as Record<string, unknown>[]) {
    const slot = typeof a?.slotKey === 'string' ? byKey.get(a.slotKey) : undefined;
    if (!slot) return no('bad_draft', 'The draft names a slot the time doesn’t hold. Generate the drafts again.');
    const ids = Array.isArray(a.teamIds) ? [...new Set(a.teamIds.filter((x): x is string => typeof x === 'string'))] : [];
    if (ids.some(x => !teams.has(x))) return no('team_not_running', 'The draft names a team with no season running. Generate the drafts again.');
    const full = room(ids, slot);
    if (full) return no('slot_full', full);
    out.set(slot.key, ids);
  }
  return { ok: true, value: out };
}

/**
 * A SLOT'S ROOM, as the routes ask it before the database's floor (Stage 11c): the teams a slot may hold together, by the
 * schedule's sharing rules — one team, or one rule's teams up to its number, never two on a half facility. Answers the
 * refusal in words ("A slot holds 2 teams at once: …"), or null.
 */
export function roomChecker(settings: Pick<ScheduleSettings, 'rules'>, teams: readonly Pick<ClubTeam, 'id' | 'groupId' | 'name'>[]) {
  const pools = sharingPools(settings.rules.sharing, teams);
  return (teamIds: readonly string[], weight: number): string | null => {
    const room = slotRoom(teamIds, weight, pools);
    return teamIds.length <= room ? null : R.slotFull(room);
  };
}

export interface ScheduleRequest {
  time: ScheduleTime & { blockIds: (string | null)[] };
  teams: ClubTeam[];
  running: ClubTeam[];
  places: ClubPlaces;
  settings: ScheduleSettings;
}

/** A schedule's time and settings off a request, checked against the club's teams, places and groups — what Generate,
 *  Save as a draft and a regenerate all read first. */
export async function readScheduleRequest(orgId: string, body: Record<string, unknown>, opts: { houseLeague?: boolean } = {}): Promise<{ ok: true; value: ScheduleRequest } | { ok: false; response: Response }> {
  const t = readTimeBody(body);
  if (!t.ok) return { ok: false, response: refusal(400, t.code, t.error) };
  const [teams, places] = await Promise.all([readClubTeams(orgId, opts), readClubPlaces(orgId)]);
  const running = teams.filter(x => x.season);
  if (!running.length) return { ok: false, response: refusal(409, 'nothing_to_schedule', R.nothingToSchedule) };
  const settings = readScheduleSettings(body.settings, {
    teamIds: new Set(running.map(x => x.id)),
    facilityIds: new Set(t.time.blocks.flatMap(b => places.byVenue.get(b.venueId) ?? [])),
    groupIds: new Set(teams.map(x => x.groupId).filter((g): g is string => !!g)),
    // Each running team's group: a sharing rule is checked through its groups ("a team in two sharing rules").
    groupOf: new Map(running.map(x => [x.id, x.groupId])),
  });
  if (!settings.ok) return { ok: false, response: refusal(400, settings.code, settings.error) };
  // No team rule reaches house league (Stage 11b): its league admins divide its time, and it shares a slot with nobody.
  const r = settings.value.rules;
  if ([...r.windows.flatMap(w => w.teamIds), ...r.daysOff.map(d => d.teamId), ...r.fieldsBy.flatMap(f => f.teamIds), ...r.sharing.flatMap(s => s.teamIds)].some(isProgramHolder)) {
    return { ok: false, response: refusal(400, 'bad_rule', R.ruleNamesHouseLeague) };
  }
  return { ok: true, value: { time: t.time, teams, running, places, settings: settings.value } };
}

/**
 * The draft the club keeps (Save as a draft, a regenerate): the slots cut again from the time — never a slot the time
 * doesn't hold — the chosen draft's assignments on them, the slots a regenerate keeps exactly as they are (`kept`, Ask
 * 19: whatever the draft says of them), and the schedule's one refusal asked: a team twice at once.
 */
export function draftToSave(req: ScheduleRequest, prices: Prices, rawAssignments: unknown, kept: ReadonlyMap<string, StoredSlot> = new Map()):
  { ok: true; slots: ReturnType<typeof slotsPayload> } | { ok: false; response: Response } {
  const checked = checkTime(req.time, req.settings, req.places, prices.weightOf);
  if (!checked.ok) return { ok: false, response: refusal(400, checked.code, checked.error) };
  const room = roomChecker(req.settings, req.teams);
  const a = readAssignments(rawAssignments, checked.slots, new Set(req.running.map(x => x.id)), (ids, slot) => room(ids, slot.weight));
  if (!a.ok) return { ok: false, response: refusal(400, a.code, a.error) };
  for (const [key, s] of kept) a.value.set(key, s.teamIds);
  // House league holds many slots at once (its league admins divide them): the one refusal is a TEAM's.
  const twice = teamTwice(checked.slots, new Map([...a.value].map(([k, ids]) => [k, teamsOnly(ids)])));
  if (twice) return { ok: false, response: refusal(409, 'team_twice', R.teamTwice(teamNamer(req.teams)(twice.teamId))) };
  return { ok: true, slots: slotsPayload(checked.slots, a.value, kept) };
}

export interface BillTerms { lineId: string | null; permitId: string | null; amount: number | null; plan: PaymentPlan; firstDue: string | null; dates: string[] | null }

const PLANS: readonly PaymentPlan[] = ['one', 'monthly', 'two_months', 'dates'];

/** Bill the teams (Ask 23): the line (a COST line of the club's, or none — an off-plan bill), the permit that prices the
 *  time (or none — then the amount is required), the part the teams pay (or the whole time's price), the payments. */
export async function readBill(orgId: string, raw: unknown): Promise<{ ok: true; value: BillTerms | null } | Refused> {
  if (raw === null) return { ok: true, value: null };
  if (!raw || typeof raw !== 'object') return no('bad_bill', 'Fill in the bill again.');
  const b = raw as Record<string, unknown>;
  const plan = b.plan as PaymentPlan;
  if (!PLANS.includes(plan)) return no('bad_plan', 'Choose how the teams pay.');
  let firstDue: string | null = null, dates: string[] | null = null;
  if (plan === 'dates') {
    if (!Array.isArray(b.dates) || !b.dates.length || b.dates.length > 24 || !b.dates.every(d => typeof d === 'string' && isCalendarDate(d))) {
      return no('bad_dates', 'Pick the payment dates.');
    }
    dates = [...new Set(b.dates as string[])].sort();
  } else {
    if (typeof b.firstDue !== 'string' || !isCalendarDate(b.firstDue)) return no('bad_first_due', 'Pick the first payment’s date.');
    firstDue = b.firstDue;
  }
  const given = b.amount !== null && b.amount !== undefined && b.amount !== '';
  const amount = given ? readAmount(b.amount) : null;
  if (given && amount === null) return no('bad_amount', 'The amount must be above zero.');
  const lineId = isUuid(b.lineId) ? b.lineId : null;
  const permitId = isUuid(b.permitId) ? b.permitId : null;
  if ((b.lineId && !lineId) || (b.permitId && !permitId)) return no('bad_bill', 'Fill in the bill again.');
  const [line, permit] = await Promise.all([
    lineId ? supabaseAdmin.from('org_budget_lines').select('id, budget_items ( direction )').eq('id', lineId).eq('org_id', orgId).maybeSingle() : null,
    permitId ? readPermitTimes(orgId, { ids: [permitId] }) : null,
  ]);
  if (line) {
    if (line.error) throw line.error;
    if (!line.data) return no('line_not_found', R.lineGone);
    if ((line.data.budget_items as { direction?: string } | null)?.direction === 'in') return no('not_a_cost_line', R.notACostLine);
  }
  if (permit && !permit.permits.length) return no('permit_gone', R.permitGone);
  if (!permitId && amount === null) return no('bill_no_price', R.billNoPrice);
  return { ok: true, value: { lineId, permitId, amount, plan, firstDue, dates } };
}
