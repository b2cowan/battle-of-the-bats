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
import { addCalendarDays, isCalendarDate, tournamentToday, utcToZonedInputs } from './timezone';
import { readClubPlaces, readPermitTimes, type ClubPlaces } from './permit-lookup';
import { facilityListWords } from './permit-words';
import { readClubBookings } from './venue-clash-lookup';
import { readAmount } from './club-bill-split';
import { clock, fieldPrices, overlappingBlocks, shareOf, type DateOff } from './permit-time';
import {
  ageOf, cutSlots, heldSlots, seatCounts, shareTargets, slotKeyOf, teamResults, teamTwice,
  type EngineInput, type EngineTeam, type PoolBooking, type ScheduleBlock, type ScheduleTime, type Slot, type TeamBooking, type TeamResult,
  type WeightOf,
} from './club-schedule-engine';
import { readScheduleSettings, defaultSettings, isClock, sharingPools, slotRoom, type ScheduleSettings, type SettingsRefusal } from './club-schedule-settings';
import {
  closingRow, DEFAULT_PRICE_MODE, hourOfScale, paymentPeriods, PRICE_MODES, priceTheBill, pricedMinutes, pricedMinutesByPermit, teamInstallments,
  type BillSlot, type ClosingRow, type Installment, type PaymentPeriod, type KeptRates, type PaymentPlan, type PriceMode, type PricedBill,
} from './club-schedule-bill';
import { PART_WORDS, SCHEDULE_REFUSALS as R, houseLeagueUse } from './club-schedule-words';
import { familyClashes, partLabelFor, type FamilyMember, type FamilySlot, type PartRead } from './club-schedule-family';
import { partIsGone } from './club-schedule-family-send';
import { clubDay, keptHandBacks, waitingAsksOfSchedule, type KeptHandBack } from './club-hand-back-reads';
import { scheduleMoney, type ScheduleMoney } from './club-money-reads';
import { HOUSE_LEAGUE, isProgramHolder, storedHolders, teamsOnly } from './club-schedule-holders';
import { engineSlotOf, pinnedSlots, slotsWithPinned, timeKeeping, type KeepChange, type Keeping } from './club-schedule-keep';

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
  /** The club runs house league (its plan or a section, and a season not finished): House league is offered
   *  as a holder (Stage 11b). */
  houseLeague: boolean;
  /** This member opens Rep Teams: the rep teams are offered, and a schedule that hands them time is theirs to change
   *  (/review 2026-10-27 — house league opening the door must not open the rep teams to a member the owner kept out). */
  repTeams: boolean;
}

/** A house-league season that isn't finished: something of house league's to hand time to (the rep teams' "running
 *  season", Ask 15). One read. */
async function houseLeagueRuns(orgId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin.from('league_seasons').select('id', { count: 'exact', head: true })
    .eq('org_id', orgId).not('status', 'in', '("completed","archived")');
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** A schedule that hands time to rep teams (its ticked teams or its slots), refused to a member who can't open Rep Teams
 *  (the plan dropped them, or the owner kept this member out) — in words, never a 500. Null when theirs to change. */
export function repTeamsRefusal(s: SchedulerCtx, loaded: LoadedSchedule): Response | null {
  if (s.repTeams) return null;
  return touchesRepTeams(loaded) ? refusal(403, 'rep_teams_closed', R.repTeamsClosed) : null;
}

/** Whether a schedule hands time to rep teams (its ticked teams or its slots) — an added part is its own schedule with its own
 *  teams, so the family's reads and sends ask it of each part, not only of the schedule they started from. */
export const touchesRepTeams = (loaded: LoadedSchedule) =>
  teamsOnly(loaded.settings.teamIds).length > 0 || loaded.slots.some(x => teamsOnly(x.teamIds).length > 0);

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
  const houseLeague = hasModuleEntitlement(ctx.org, 'module_house_league') && await houseLeagueRuns(ctx.org.id);
  const canSchedule = repTeams || houseLeague;
  if (opts.write && !canSchedule) {
    return { error: refusal(409, 'nothing_to_schedule', hasModuleEntitlement(ctx.org, 'module_house_league') ? R.nothingToScheduleLeague : R.nothingToSchedule) };
  }
  return { ctx, canMoney: canMoveClubMoney(ctx, ctx.org), canSchedule, houseLeague, repTeams };
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
  // Two saves racing on one family (mig 491's uniques): the same part label the same day, or one place held at one start.
  // Someone else's save got there first — the schedule "changed since you opened it" (a reload shows it), never a 500.
  if (code === '23505' && /club_schedules_part_label_once|club_schedule_slots_family_place_start/.test(msg)) return refusal(409, 'changed', R.changed);
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
    // A final schedule's first bill, made later (mig 481): what its one step refuses.
    case 'already_billed': return refusal(409, 'already_billed', R.billAlready);
    case 'changes_waiting': return refusal(409, 'changes_waiting', R.billChangesWaiting);
    case 'asks_waiting': return refusal(409, 'asks_waiting', R.billAsksWaiting);
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
export async function readClubTeams(orgId: string, opts: { houseLeague?: boolean; repTeams?: boolean } = {}): Promise<ClubTeam[]> {
  // A member who can't open Rep Teams is offered none (/review 2026-10-27); house league alone, when it runs.
  if (opts.repTeams === false) return opts.houseLeague ? [{ ...HOUSE_LEAGUE_HOLDER }] : [];
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
  return opts.houseLeague ? [...out, { ...HOUSE_LEAGUE_HOLDER }] : out;
}

// ── A schedule, read whole ───────────────────────────────────────────────────────────────────────

export interface ScheduleRow {
  id: string; org_id: string; name: string; state: 'draft' | 'in_review' | 'final'; starts_on: string; ends_on: string;
  settings: unknown; version: number; started_from_permit_id: string | null; started_from_schedule_id: string | null;
  reply_by: string | null; sent_at: string | null; sent_by: string | null; finalized_at: string | null; finalized_by: string | null;
  changed_since_sent: boolean; bill_line_id: string | null; bill_permit_id: string | null; bill_amount: number | string | null;
  bill_plan: PaymentPlan | null; bill_first_due: string | null; bill_dates: string[] | null; bill_scale: number | string | null;
  /** How the bill prices time on more than one price (mig 489). */
  bill_price_mode: PriceMode;
  allocation_id: string | null; created_by: string | null; updated_by: string | null; created_at: string; updated_at: string;
  /** Set = an added PART of that schedule (mig 491, Phase 8): its own time, teams and bill, shown on the parent's page. */
  part_of_schedule_id: string | null;
  /** A part's name on the page, "Time added Nov 16" (the row's `name` is "{parent} · {label}", kept by trigger). */
  part_label: string | null;
  /** A part sent without a bill that the club marked "It's free" (mig 496): Needs attention's row stops showing for it. */
  bill_dismissed_at: string | null;
}
const SCHEDULE_COLUMNS = 'id, org_id, name, state, starts_on, ends_on, settings, version, started_from_permit_id, started_from_schedule_id, reply_by, sent_at, sent_by, finalized_at, finalized_by, changed_since_sent, bill_line_id, bill_permit_id, bill_amount, bill_plan, bill_first_due, bill_dates, bill_scale, bill_price_mode, allocation_id, created_by, updated_by, created_at, updated_at, part_of_schedule_id, part_label, bill_dismissed_at';

export interface StoredSlot {
  id: string;
  key: string;
  venueId: string;
  facilityId: string | null;
  blockId: string | null;
  /** Its row's permit (`org_time_blocks.from_permit_id`, mig 487) — what prices it; null for a typed row. */
  permitId: string | null;
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
  time: ScheduleTime & { blocks: readonly ScheduleBlock[]; blockIds: string[] };
  slots: StoredSlot[];
}

/** The schedule's own blocks (the one model of time), in its order, with their facilities. */
async function readScheduleTime(orgId: string, scheduleId: string, row: Pick<ScheduleRow, 'starts_on' | 'ends_on'>): Promise<LoadedSchedule['time']> {
  const [blocks, offs] = await Promise.all([
    fetchAll<{ id: string; org_venue_id: string; from_permit_id: string | null; weekdays: number[]; start_time: string; end_time: string; from_date: string | null; until_date: string | null; sort_order: number; org_time_block_facilities: { facility_id: string }[] | null }>((a, b) => supabaseAdmin
      .from('org_time_blocks').select('id, org_venue_id, from_permit_id, weekdays, start_time, end_time, from_date, until_date, sort_order, org_time_block_facilities(facility_id)')
      .eq('org_id', orgId).eq('schedule_id', scheduleId).order('sort_order').order('id').range(a, b)),
    // Each date off's parks (mig 488): none = All venues.
    fetchAll<{ day: string; note: string | null; org_time_date_off_venues: { org_venue_id: string }[] | null }>((a, b) => supabaseAdmin.from('org_time_dates_off')
      .select('day, note, org_time_date_off_venues(org_venue_id)').eq('org_id', orgId).eq('schedule_id', scheduleId).order('day').range(a, b)),
  ]);
  return {
    startsOn: row.starts_on, endsOn: row.ends_on,
    blocks: blocks.map((b): ScheduleBlock => ({
      id: b.id, venueId: b.org_venue_id, permitId: b.from_permit_id, facilityIds: (b.org_time_block_facilities ?? []).map(f => f.facility_id),
      weekdays: [...(b.weekdays ?? [])].map(Number).sort((x, y) => x - y), startTime: clock(b.start_time), endTime: clock(b.end_time),
      fromDate: b.from_date, untilDate: b.until_date,
    })),
    blockIds: blocks.map(b => b.id),
    datesOff: offs.map((o): DateOff => ({ day: o.day, note: o.note, venueIds: (o.org_time_date_off_venues ?? []).map(v => v.org_venue_id).sort() })),
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
  const permitOfBlock = new Map(time.blocks.map(b => [b.id, b.permitId ?? null]));
  return {
    row,
    settings: read.ok ? read.value : defaultSettings(),
    time,
    slots: slotRows.map((s): StoredSlot => ({
      id: s.id, key: slotKeyOf(s.org_venue_id, s.facility_id, Date.parse(s.starts_at)), venueId: s.org_venue_id, facilityId: s.facility_id,
      blockId: s.block_id, permitId: s.block_id ? permitOfBlock.get(s.block_id) ?? null : null,
      startsAt: s.starts_at, endsAt: s.ends_at, teamIds: holdersOf(s),
      locked: s.locked, movedByHand: s.moved_by_hand,
      handedBack: s.handed_back_at ? { at: s.handed_back_at, by: s.handed_back_by, teamId: s.handed_back_team_id } : null,
      removed: !!s.removed_at,
    })),
  };
}

/** The prices of a schedule's time: each facility's share and an hour of a full field (null without one).
 *  `found`: the PRICE permit asked for is still the club's (false when none was asked for). */
export interface Prices {
  found: boolean;
  /** A facility's share on its ROW's permit (a schedule on several permits, mig 487) — the price permit's for a row with
   *  none; 1 with neither. */
  weightOf: WeightOf;
  fullHour: number | null; permitCost: number | null; permitName: string | null;
  /** The permit's own budget line — what Bill the teams bills from by default (money readers only, through `pricing`). */
  lineId: string | null;
  /** Every permit read that is still the club's (the price permit and the rows'): its name, by id. */
  names: ReadonlyMap<string, string>;
  /** THE PERMIT THAT PRICES A ROW (Session C): the row's own, else the price permit (else the first permit behind the
   *  rows) — exactly the permit `weightOf` weighs it by, so a slot's weight and its price never come from two permits. */
  priceKeyOf: (rowPermit: string | null) => string | null;
  /** A permit's full field's hour (dollars), null without a price or for a permit that is gone. */
  hourOf: (permitId: string) => number | null;
  /** The permits that price the schedule's rows, in the rows' order: each one's hour, cost and budget line (money readers
   *  only, through `pricing`). */
  permits: readonly PricePermit[];
}

export interface PricePermit { id: string; name: string; fullHour: number | null; cost: number | null; lineId: string | null }

const NO_PRICES: Prices = {
  found: false, weightOf: () => 1, fullHour: null, permitCost: null, permitName: null, lineId: null, names: new Map(),
  priceKeyOf: () => null, hourOf: () => null, permits: [],
};

/**
 * THE PRICES (Ask 23; a schedule on several permits, Session A). `permitId` is the PRICE permit — `pricePermitOf`, the
 * bill's else the one the schedule started from: it gives the hour, the cost, the name and the line (one rate until
 * Session C prices each permit's time at its own). `rowPermits` are the schedule's rows' permits: each slot's WEIGHT is
 * its own row's permit's share of its facility (the drawing's P4 A: "the row's own permit prices it", never a lookup),
 * the price permit's for a row with none. ⚠ A price permit NONE of the rows came from (a schedule billed from another
 * permit, before mig 487) still weighs every row, so no figure a sent schedule already shows moves.
 */
export async function readPrices(orgId: string, permitId: string | null, rowPermits: readonly (string | null | undefined)[] = []): Promise<Prices> {
  const rows = [...new Set(rowPermits.filter((x): x is string => !!x))];
  const ids = [...new Set([...(permitId ? [permitId] : []), ...rows])];
  if (!ids.length) return NO_PRICES;
  const times = await readPermitTimes(orgId, { ids });
  const shares = new Map(times.permits.map(x => [x.id, new Map(Object.entries(x.shares))]));
  const names = new Map(times.permits.map(x => [x.id, x.name]));
  const byRow = !permitId || !rows.length || rows.includes(permitId);
  const fallback = permitId ?? rows[0] ?? null;
  const priceKeyOf = (row: string | null): string | null => {
    const key = byRow && row ? row : fallback;
    return key && shares.has(key) ? key : null;
  };
  const weightOf: WeightOf = (f, row) => {
    const own = byRow && row ? shares.get(row) : undefined;
    const set = own ?? (permitId ? shares.get(permitId) : undefined);
    return set ? shareOf(set, f) : 1;
  };
  const hours = new Map(times.permits.map(x => [x.id, fieldPrices(x, times.venueFacilities, shares.get(x.id)!, x.cost).fullHour]));
  const hourOf = (id: string) => hours.get(id) ?? null;
  const keys = [...new Set((rowPermits.length ? rowPermits : [null]).map(r => priceKeyOf(r ?? null)).filter((x): x is string => !!x))];
  const permits: PricePermit[] = keys.map(id => {
    const x = times.permits.find(y => y.id === id)!;
    return { id, name: x.name, fullHour: hourOf(id), cost: x.cost, lineId: x.budgetLineId };
  });
  const p = permitId ? times.permits.find(x => x.id === permitId) : undefined;
  if (!p) return { ...NO_PRICES, weightOf, names, priceKeyOf, hourOf, permits };
  return { found: true, weightOf, fullHour: hourOf(p.id), permitCost: p.cost, permitName: p.name, lineId: p.budgetLineId, names, priceKeyOf, hourOf, permits };
}

/** The permit that prices a schedule's hour (until Session C): the bill's, else the one it started from (mig 487 keeps
 *  `started_from_permit_id` for one release as this fallback). */
export const pricePermitOf = (row: Pick<ScheduleRow, 'bill_permit_id' | 'started_from_permit_id'>): string | null =>
  row.bill_permit_id ?? row.started_from_permit_id;

/** A saved schedule's prices: its price permit, and each of its rows' permits. */
export function schedulePrices(orgId: string, loaded: Pick<LoadedSchedule, 'row' | 'time'>): Promise<Prices> {
  return readPrices(orgId, pricePermitOf(loaded.row), loaded.time.blocks.map(b => b.permitId));
}

/**
 * THE SCHEDULE'S PERMITS: the distinct permits behind its rows, in the order their time starts (the top line's order;
 * the drawing, tab 6) — and, for one release (mig 487), the permit it started from when no row names one. Every reader of
 * "a schedule's permit" asks this, never one column (`tests/unit/club-schedule-several-permits-guard.test.ts`).
 */
export function schedulePermitIds(row: Pick<ScheduleRow, 'starts_on' | 'started_from_permit_id'>, blocks: readonly ScheduleBlock[]): string[] {
  const starts = new Map<string, string>();
  for (const b of blocks) {
    if (!b.permitId) continue;
    const from = b.fromDate ?? row.starts_on;
    const was = starts.get(b.permitId);
    if (was === undefined || from < was) starts.set(b.permitId, from);
  }
  const ids = [...starts].sort((a, z) => a[1].localeCompare(z[1])).map(([id]) => id);
  return ids.length ? ids : row.started_from_permit_id ? [row.started_from_permit_id] : [];
}

/** A request's rows naming a permit the club doesn't have (deleted under the form, or another club's): a refusal, or null. */
export function permitGone(prices: Pick<Prices, 'names'>, blocks: readonly ScheduleBlock[]): Response | null {
  return blocks.some(b => b.permitId && !prices.names.has(b.permitId)) ? refusal(409, 'permit_gone', R.permitGone) : null;
}

/** A request's prices — the price permit and each sent row's own permit — with the refusal when a row names a permit
 *  that is gone, so a route cannot read the one and forget the other. */
export async function readRequestPrices(orgId: string, permitId: string | null, blocks: readonly ScheduleBlock[]): Promise<{ prices: Prices; gone: Response | null }> {
  const prices = await readPrices(orgId, permitId, blocks.map(b => b.permitId));
  return { prices, gone: permitGone(prices, blocks) };
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
  /** The rows' permits: each slot is weighed by its own (a schedule on several permits). */
  rowPermits?: readonly (string | null | undefined)[];
  places?: ClubPlaces;
  prices?: Prices;
  /** The rest of the schedule's family (Phase 8, `familyOthers`): each of their slots is the team's own booking, so a team
   *  is never given two practices at once across a schedule and its added parts — sent or not. */
  family?: readonly FamilyMember[];
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
    p.prices ?? readPrices(orgId, p.permitId, p.rowPermits),
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
  const asked = new Set(p.teamIds);
  for (const m of p.family ?? []) {
    for (const s of m.slots) for (const t of s.teamIds) if (asked.has(t)) add(t, new Date(s.startMs).toISOString(), new Date(s.endMs).toISOString(), false);
  }
  return { places, pool: poolBookings, teamBookings, prices };
}

/** The time and the settings, checked the way the save checks them (a refusal in words, or the slots it holds). */
export function checkTime(time: ScheduleTime, settings: ScheduleSettings, places: ClubPlaces, weightOf: WeightOf): { ok: true; slots: Slot[] } | Refused {
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

/** What a change keeps exactly as it is, with the stored slots behind it (their teams and flags go to the save). */
export type ServerKeeping = Keeping & { stored: readonly StoredSlot[] };

/** The time cut into slots, with what the change keeps put in exactly as it is (`slotsWithPinned`), and — Phase 8 — none
 *  of the places the rest of its family already holds at that time (a part's practice is never cut over its parent's, nor
 *  the parent's over a part's). The draft and the save cut the same way, so their slot keys always agree. */
function cutKeeping(time: ScheduleTime, settings: ScheduleSettings, places: ClubPlaces, weightOf: WeightOf, keep: Keeping | null, family: readonly FamilyMember[] = []): { ok: true; slots: Slot[] } | Refused {
  const checked = checkTime(time, settings, places, weightOf);
  if (!checked.ok) return checked;
  const slots = keep
    ? slotsWithPinned(checked.slots, { ...keep, pinned: keep.pinned.map(s => ({ ...s, weight: weightOf(s.facilityId, s.permitId ?? null) })) }, places.byVenue)
    : checked.slots;
  if (!family.length) return { ok: true, slots };
  const pinned = new Set(keep?.pinned.map(s => s.key) ?? []);
  const held = familyClashes(slots.map(s => ({ id: s.key, venueId: s.venueId, facilityId: s.facilityId, startMs: s.startMs, endMs: s.endMs, teamIds: [] })), family);
  const free = slots.filter(s => pinned.has(s.key) || !held.get(s.key)?.placeWith);
  // The time was given; the family holds all of it. Say that, not "give the schedule its time first".
  return free.length ? { ok: true, slots: free } : no('part_time_all_held', R.partTimeAllHeld);
}

/**
 * THE REST OF THE FAMILY (Phase 8, mig 491): every other member's live slots — for a schedule, its added parts; for a
 * part, the schedule it was added to and its other parts — each named as the page names it (the schedule's name, a part's
 * label). One read, by the slots' family. A schedule with no parts reads nothing more than that one empty answer.
 */
export async function familyOthers(orgId: string, row: Pick<ScheduleRow, 'id' | 'part_of_schedule_id'>): Promise<FamilyMember[]> {
  return familyMembers(orgId, row.part_of_schedule_id ?? row.id, row.id);
}

/** The WHOLE family of a schedule — it and every part of it: what a part being made (Add time, Session 2) treats as taken. */
export const wholeFamily = (orgId: string, rootId: string): Promise<FamilyMember[]> => familyMembers(orgId, rootId, null);

async function familyMembers(orgId: string, root: string, except: string | null): Promise<FamilyMember[]> {
  // A slot taken off but not yet sent (`removed_at` set) still holds its PLACE until Send the changes lands: the database's
  // place-and-start uniqueness (mig 491) counts it, so the cut must not offer it. It holds no TEAM (its teams go with it).
  const slots = await fetchAll<{ id: string; schedule_id: string; org_venue_id: string; facility_id: string | null; starts_at: string; ends_at: string; removed_at: string | null; club_schedule_slot_teams: { team_id: string }[] | null; club_schedule_slot_programs: ProgramEmbed; club_schedules: { name: string; part_label: string | null } | null }>((a, b) => {
    const read = supabaseAdmin
      .from('club_schedule_slots')
      .select('id, schedule_id, org_venue_id, facility_id, starts_at, ends_at, removed_at, club_schedule_slot_teams(team_id), club_schedule_slot_programs(program), club_schedules(name, part_label)')
      .eq('org_id', orgId).eq('family_id', root);
    return (except ? read.neq('schedule_id', except) : read).order('id').range(a, b);
  });
  const members = new Map<string, FamilyMember & { slots: FamilySlot[] }>();
  for (const s of slots) {
    const m = members.get(s.schedule_id) ?? members.set(s.schedule_id, { id: s.schedule_id, name: s.club_schedules?.part_label ?? s.club_schedules?.name ?? '', slots: [] }).get(s.schedule_id)!;
    m.slots.push({ id: s.id, venueId: s.org_venue_id, facilityId: s.facility_id, startMs: Date.parse(s.starts_at), endMs: Date.parse(s.ends_at), teamIds: s.removed_at ? [] : holdersOf(s) });
  }
  return [...members.values()];
}

/** A team the rest of the family already gives that time to, among the slots and the teams a change asks for: its words
 *  ("14U AA already has a practice then, in Time added Nov 16."), or null. */
export function familyTeamTwice(slots: readonly Pick<Slot, 'key' | 'venueId' | 'facilityId' | 'startMs' | 'endMs'>[], teamsOf: (key: string) => readonly string[], family: readonly FamilyMember[], nameOf: (teamId: string) => string): string | null {
  if (!family.length) return null;
  const clash = familyClashes(slots.map(s => ({ id: s.key, venueId: s.venueId, facilityId: s.facilityId, startMs: s.startMs, endMs: s.endMs, teamIds: teamsOf(s.key) })), family);
  for (const c of clash.values()) if (c.teams.length) return PART_WORDS.teamTwiceInFamily(nameOf(c.teams[0].teamId), c.teams[0].with);
  return null;
}

/**
 * WHAT A CHANGE TO A SCHEDULE THAT EXISTS KEEPS (Session E; `club-schedule-keep.ts` holds the rule). Null when it keeps
 * nothing by this rule (a regenerate of a draft or a schedule in review: exactly as before). `asked` is the time the
 * change asks for.
 */
export function keepingFor(loaded: LoadedSchedule, asked: ScheduleTime & { blockIds: (string | null)[] }, change: KeepChange, places: ClubPlaces, today = tournamentToday()): ServerKeeping | null {
  const final = loaded.row.state === 'final';
  if (change.kind === 'regenerate' && !final) return null;
  const pastFrom = final ? today : null;
  const stored = pinnedSlots(loaded.slots, change, { final, today });
  const k = timeKeeping(asked, loaded.time, stored, {
    settings: loaded.settings, weightOf: () => 1, venueFacilities: places.byVenue, pastFrom,
    freshBlocks: change.kind === 'take_off' ? 'none' : 'all',
  });
  return { ...k, stored };
}

/**
 * ADD TIME MAKES A PART (Phase 8, Session 2; owner rulings 1, 2 and 6–7): the schedule the time is added to, checked —
 * this club's, FINAL (a draft is simply edited in Settings…), not itself a part (one level) — and its whole family, which
 * the part's drafts and its save treat as taken (the same place at the same time, the same team at the same time). The
 * part is a schedule of its own, built from New schedule's request; nothing on the schedule it is added to is read into
 * it or written. The database refuses all three again (mig 491's trigger); this says them in words first.
 */
export async function partParent(orgId: string, s: SchedulerCtx, parentId: unknown): Promise<{ ok: true; parent: LoadedSchedule; family: FamilyMember[] } | { ok: false; response: Response }> {
  if (!isUuid(parentId)) return { ok: false, response: refusal(404, 'not_found', R.notFound) };
  // Two independent reads, one round trip: the schedule, and the family it heads (read by its own id).
  const [parent, family] = await Promise.all([loadSchedule(orgId, parentId), wholeFamily(orgId, parentId)]);
  if (!parent) return { ok: false, response: refusal(404, 'not_found', R.notFound) };
  const closed = repTeamsRefusal(s, parent);
  if (closed) return { ok: false, response: closed };
  if (parent.row.part_of_schedule_id) return { ok: false, response: refusal(409, 'part_of_part', PART_WORDS.addToPart) };
  if (parent.row.state !== 'final') return { ok: false, response: refusal(409, 'not_final', PART_WORDS.addToDraft) };
  return { ok: true, parent, family };
}

/** Does a request body name a schedule to add time to? (Add time makes a part; the preview and the save read it alike.) */
export const hasPartOf = (body: Record<string, unknown>): boolean => body.partOf != null && body.partOf !== '';

/** A part's time starts no earlier than today: the schedule it is added to has been sent (the shipped Add time's guard,
 *  P10 A, for a part's own From). */
export function partTimeRefusal(parent: LoadedSchedule, time: Pick<ScheduleTime, 'startsOn'>, today = tournamentToday()): Response | null {
  return time.startsOn < today ? refusal(400, 'bad_time', PART_WORDS.fromBeforeToday(parent.row.name)) : null;
}

/** The new part's label — "Time added Nov 17", or "… (2)" for a second the same day (owner ruling 1). Every part's label
 *  counts, a part taken off too: its row stays (11-17 ruling), and the label is unique per schedule (mig 491). */
export async function nextPartLabel(orgId: string, parentId: string, today = tournamentToday()): Promise<string> {
  // parts-ok: by the schedule it was added to — the labels its parts already use.
  const { data, error } = await supabaseAdmin.from('club_schedules').select('part_label').eq('org_id', orgId).eq('part_of_schedule_id', parentId);
  if (error) throw error;
  return partLabelFor(today, (data ?? []).map(x => x.part_label as string | null).filter((x): x is string => !!x));
}

/** TAKE A PERMIT OFF's request (P11 A): the schedule's time without that permit's rows (the rest by id, untouched), its
 *  settings as stored. Null when no row of the schedule is on that permit. */
export function timeWithoutPermit(loaded: LoadedSchedule, permitId: string): (ScheduleTime & { blockIds: (string | null)[] }) | null {
  const keep = loaded.time.blocks.map((b, i) => ({ b, id: loaded.time.blockIds[i] })).filter(x => x.b.permitId !== permitId);
  if (keep.length === loaded.time.blocks.length) return null;
  return { startsOn: loaded.row.starts_on, endsOn: loaded.row.ends_on, datesOff: loaded.time.datesOff, blocks: keep.map(x => x.b), blockIds: keep.map(x => x.id) };
}

/**
 * A request made from what is STORED (Take a permit off): the settings are the schedule's own — never the
 * body's — with only the teams whose season is running ticked (as Settings… opens them), the club's teams and places
 * read as every request reads them.
 */
export async function requestOnStored(orgId: string, loaded: LoadedSchedule, time: ScheduleTime & { blockIds: (string | null)[] }, opts: { houseLeague?: boolean; repTeams?: boolean } = {}): Promise<{ ok: true; value: ScheduleRequest } | { ok: false; response: Response }> {
  const [teams, places] = await Promise.all([readClubTeams(orgId, opts), readClubPlaces(orgId)]);
  const running = teams.filter(x => x.season);
  if (!running.length) return { ok: false, response: refusal(409, 'nothing_to_schedule', R.nothingToSchedule) };
  const live = new Set(running.map(x => x.id));
  const settings: ScheduleSettings = { ...loaded.settings, teamIds: loaded.settings.teamIds.filter(t => live.has(t)) };
  if (time.blocks.length > 40) return { ok: false, response: refusal(400, 'no_time', 'A schedule holds at most 40 rows of time.') };
  if (time.datesOff.some(d => d.venueIds?.some(v => !places.venueName.has(v)))) return { ok: false, response: refusal(400, 'bad_time', 'Pick the date off’s parks again.') };
  return { ok: true, value: { time, teams, running, places, settings } };
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
  prices?: Prices;
  /** What the change keeps exactly as it is (`keepingFor`): `time` is then `keep.time`. */
  keep?: Keeping | null;
  /** The rest of the schedule's family (Phase 8, `familyOthers`): its places at that time are not cut, its teams then are taken. */
  family?: readonly FamilyMember[];
}): Promise<{ ok: true; input: EngineInput; prices: Prices; places: ClubPlaces; pool: PoolBooking[] } | Refused> {
  const ticked = p.settings.teamIds.map(id => p.teams.find(t => t.id === id)).filter((t): t is ClubTeam => !!t);
  const fromMs = Date.parse(`${p.time.startsOn}T00:00:00Z`) - 86_400_000, toMs = Date.parse(`${p.time.endsOn}T23:59:59Z`) + 86_400_000;
  const ctx = await engineContext(orgId, {
    slotIds: p.storedSlots.map(s => s.id), teamIds: ticked.map(t => t.id), fromMs, toMs, permitId: p.permitId, places: p.places,
    rowPermits: p.time.blocks.map(b => b.permitId), prices: p.prices, family: p.family,
  });
  const checked = cutKeeping(p.time, p.settings, ctx.places, ctx.prices.weightOf, p.keep ?? null, p.family);
  if (!checked.ok) return checked;
  // A regenerate keeps every slot locked or moved by hand (Ask 19) — by place and start, so a slot whose time the new
  // settings no longer cut is not kept (its team is said, never silently dropped: `notKept`). What the change keeps
  // EXACTLY (a sent schedule's past, P10 A) is always in the cut, so always kept.
  const fixed = new Map<string, string[]>();
  const pinnedKeys = new Set(p.keep?.pinned.map(s => s.key) ?? []);
  for (const s of p.storedSlots) {
    if (pinnedKeys.has(s.key) || (!s.removed && (s.locked || s.movedByHand))) fixed.set(s.key, s.teamIds.filter(t => ticked.some(x => x.id === t)));
  }
  const input: EngineInput = {
    slots: checked.slots, teams: ticked, settings: p.settings, held: heldSlots(checked.slots, ctx.pool),
    teamBookings: ctx.teamBookings, fixed,
  };
  return { ok: true, input, prices: ctx.prices, places: ctx.places, pool: ctx.pool };
}

// ── The page (specimens 6–10, 14) ────────────────────────────────────────────────────────────────

export interface SchedulePricing {
  permitId: string; permitName: string | null; fullHour: number | null; permitCost: number | null; lineId: string | null;
  mode: PriceMode;
  permits: readonly PricePermit[];
  lineFrom: string | null;
}

/** THE PRICING A MONEY READER SEES (Session C): the permits that price the rows, their cost together, and "Bill from"'s
 *  default — the line of the permit with the most priced time (N6 A). Null without a permit that prices any of it. */
export function schedulePricing(row: Pick<ScheduleRow, 'bill_price_mode'>, prices: Prices, billSlots: readonly BillSlot[], permitId: string | null): SchedulePricing | null {
  if (!prices.permits.length) return null;
  const minutes = new Map<string, number>();
  for (const by of pricedMinutesByPermit(billSlots).values()) for (const [k, m] of by) if (k) minutes.set(k, (minutes.get(k) ?? 0) + m);
  const most = [...prices.permits].sort((a, b) => (minutes.get(b.id) ?? 0) - (minutes.get(a.id) ?? 0))[0];
  const lines = new Set(prices.permits.map(x => x.lineId));
  const one = prices.permits.length === 1 && prices.found ? prices : null;
  return {
    permitId: permitId && prices.found ? permitId : prices.permits[0].id,
    permitName: one ? prices.permitName : null,
    fullHour: one ? prices.fullHour : prices.permits.length === 1 ? prices.permits[0].fullHour : null,
    permitCost: prices.permits.some(x => x.cost == null) ? null : prices.permits.reduce((n, x) => n + Number(x.cost), 0),
    lineId: most.lineId,
    mode: row.bill_price_mode ?? DEFAULT_PRICE_MODE,
    permits: prices.permits,
    lineFrom: lines.size > 1 ? most.name : null,
  };
}

export interface SlotView {
  id: string; key: string; venueId: string; facilityId: string | null; startsAt: string; endsAt: string;
  day: string; weekday: number; week: string; startClock: string; endClock: string; prime: boolean; weight: number;
  teamIds: string[]; locked: boolean; movedByHand: boolean;
  /** The permit that prices it (its row's, else the price permit; Session C) — the bill's key, never a price. */
  pricePermitId: string | null;
  /** The permit its ROW came from (null: a typed row) — what "Take {permit} off" counts (P11 A). Never a price. */
  rowPermitId?: string | null;
  handedBack: { at: string; teamId: string | null } | null;
  /** A booking already on the books holds it: drawn as that booking ("Tryout day · 13U AAA"). */
  heldBy: { ownerName: string; kind: string | null } | null;
  /** Given to a team while a booking holds it — the amber flag (6a's rule). */
  clash: boolean;
  /** A slot House league holds (Stage 11b): how its league admins used it ("U12 games", "U12 practice time" — null: Not
   *  given yet), and the teams with a practice on it still to come (k5 names them before the club takes it back). `games`:
   *  the division's games on it still to come and on (House League 9d-2b Part 5; k5's games half) — null when none. */
  houseLeague?: HouseLeagueSlot | null;
  /** On the family's page (Phase 8, `familyShown`): the added part it belongs to (null: the schedule itself), and whether
   *  that part is still to be sent (the grid's soft olive). Never set on a schedule's own view. */
  partId?: string | null;
  unsent?: boolean;
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
  /** How it prices time on more than one price (Session C). */
  mode: PriceMode;
  /** Once made: the rate each permit was billed at (a full field's hour, dollars), in the order kept — `later` for a
   *  permit added after the bill, billed at its own price (P9 B). Empty before the bill is made. */
  kept: KeptPermitRate[];
}

export interface KeptPermitRate { permitId: string | null; permitName: string; fullHour: number; later: boolean }

/** A made bill's kept rates (`club_schedule_bill_rates`, mig 489), in the order kept. Money readers only. */
export async function readKeptRates(orgId: string, scheduleId: string): Promise<KeptPermitRate[]> {
  const { data, error } = await supabaseAdmin.from('club_schedule_bill_rates')
    .select('permit_id, permit_name, scale, first_billed_send_id, created_at').eq('org_id', orgId).eq('schedule_id', scheduleId)
    .order('created_at').order('permit_name');
  if (error) throw error;
  return (data ?? []).map(r => ({ permitId: r.permit_id, permitName: r.permit_name, fullHour: hourOfScale(Number(r.scale)), later: !!r.first_billed_send_id }));
}

/** A made bill's terms as the corrections read them: its rate and each permit's kept rate (cents per full-field minute). */
export async function readBillTerms(orgId: string, row: Pick<ScheduleRow, 'id' | 'bill_scale'>): Promise<KeptRates | null> {
  if (row.bill_scale == null) return null;
  const { data, error } = await supabaseAdmin.from('club_schedule_bill_rates').select('permit_id, scale').eq('org_id', orgId).eq('schedule_id', row.id);
  if (error) throw error;
  return { scale: Number(row.bill_scale), byPermit: new Map((data ?? []).filter(r => r.permit_id).map(r => [r.permit_id as string, Number(r.scale)])) };
}

/** A schedule's slots as the bill reads them: each slot's time, its field's price share, its teams, and the permit that
 *  prices it (`Prices.priceKeyOf` — its row's, else the price permit; Session C). */
export function billSlotsOf(slots: readonly Slot[], assignments: ReadonlyMap<string, readonly string[]>, priceKeyOf: Prices['priceKeyOf']): BillSlot[] {
  return slots.map(s => ({ day: s.day, startMs: s.startMs, endMs: s.endMs, weight: s.weight, teamIds: assignments.get(s.key) ?? [], permitId: priceKeyOf(s.permitId ?? null) }));
}

export interface BillNow { billSlots: BillSlot[]; priced: Map<string, number>; shares: PricedBill | null; periods: PaymentPeriod[] }

/**
 * THE BILL NOW (Ask 23), worked out in this one place so the schedule's page, the send and a coach's review card agree
 * to the cent: the split's rounding follows `teamOrder`, which every caller gives as the club's team order
 * (`readClubTeams`). Null when no bill rides with the schedule.
 */
export function computeBill(
  row: Pick<ScheduleRow, 'bill_plan' | 'bill_amount' | 'bill_first_due' | 'bill_dates' | 'ends_on' | 'bill_price_mode'>,
  billSlots: BillSlot[], hourOf: Prices['hourOf'], teamOrder: readonly string[],
): BillNow | null {
  if (!row.bill_plan) return null;
  const priced = pricedMinutes(billSlots);
  return {
    billSlots, priced,
    // Each slot at its own permit's price, or one rate for all (Session C); one price behind the time bills as before.
    shares: priceTheBill(billSlots, { hourOf, mode: row.bill_price_mode ?? DEFAULT_PRICE_MODE, amount: row.bill_amount == null ? null : Number(row.bill_amount), teamOrder }),
    periods: paymentPeriods(row.bill_plan, { firstDue: row.bill_first_due, dates: row.bill_dates, lastDay: row.ends_on }),
  };
}

/** What the teams would be billed now (Ask 23), as the page reads it — null when no bill rides with the schedule. Once
 *  `made`, it is the bill Finalize made: each team's share and payments read from the bill itself, never worked out
 *  again from the slots as they stand — a hand-back, with money or without, leaves it as it was (Stage 11d Ask 6; 3d Ask
 *  7b), and a club change is billed or credited on its own. Hours stay the time each team holds now, as Fair shares
 *  counts it. */
export function billViewOf(row: ScheduleRow, bill: BillNow | null, pricing: SchedulePricing | null, made: ScheduleMoney['made'] | null = null, kept: KeptPermitRate[] = []): BillView | null {
  if (!bill || !row.bill_plan) return null;
  const { shares, priced, periods, billSlots } = bill;
  const hours = (teamId: string) => Math.round(((priced.get(teamId) ?? 0) / 60) * 100) / 100;
  const rank = new Map([...(shares?.shares.keys() ?? [])].map((t, i) => [t, i]));
  const teams = made
    ? [...made].sort((a, b) => (rank.get(a.teamId) ?? 1e9) - (rank.get(b.teamId) ?? 1e9)).map(m => ({ ...m, pricedHours: hours(m.teamId) }))
    : shares ? [...shares.shares].map(([teamId, cents]) => ({ teamId, cents, pricedHours: hours(teamId), installments: teamInstallments(teamId, cents, billSlots, periods, shares.paymentWeight) })) : [];
  const total = made ? teams.reduce((n, t) => n + t.cents, 0) : shares?.totalCents ?? 0;
  return {
    lineId: row.bill_line_id, permitId: row.bill_permit_id, amount: row.bill_amount == null ? null : Number(row.bill_amount),
    plan: row.bill_plan, firstDue: row.bill_first_due, dates: row.bill_dates,
    fullHour: pricing?.fullHour ?? null, permitCost: pricing?.permitCost ?? null,
    totalCents: total, timePriceCents: shares?.timePriceCents ?? null, closing: closingRow(total, pricing?.permitCost ?? null),
    teams,
    dues: made ? [...new Set(teams.flatMap(t => t.installments.map(i => i.dueDate)))].sort() : periods.map(p => p.due),
    allocationId: row.allocation_id,
    mode: row.bill_price_mode ?? DEFAULT_PRICE_MODE,
    kept,
  };
}

/** The live slots as the engine and the bill read them. */
export function liveSlots(loaded: LoadedSchedule, weightOf: WeightOf): { slots: Slot[]; assignments: Map<string, string[]>; stored: StoredSlot[] } {
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
  /** Each block with the permit it came from (`permitId`), so Settings… keeps every row's permit through a regenerate. */
  time: { blocks: ScheduleBlock[]; datesOff: DateOff[] };
  /** Names of the parks a date off names that no row uses (not in `places`), so a printed note can still say them. */
  offParkNames: Record<string, string>;
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
   * A schedule on several permits (Session C): `permits` are the permits that price its rows, each with its own hour;
   * `permitCost` is what they cost together (null when one has no cost); `lineId` is the line of the permit with the
   * most priced time (N6 A), named by `lineFrom` when the permits sit on more than one line.
   */
  pricing: SchedulePricing | null;
  /** The permits behind the schedule's rows, still the club's, in the order their time starts — the top line's doors (13c
   *  C4; a schedule on several permits, the drawing's tab 6: "From the permits A › and B ›"). Names only, never money;
   *  empty for a schedule with no permit. */
  fromPermits: { id: string; name: string }[];
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

/** A slot house league holds, as the club's schedule reads it. */
export interface HouseLeagueSlot {
  use: string | null; division: string | null; practiceTeams: string[];
  games: { count: number; published: boolean } | null;
}

/** House league's slots as the club's schedule reads them (Stage 11b): each one's use ("U12 games"), and the teams with a
 *  live practice on it still to come — and, 9d-2b Part 5, the games on it still to come and on (a slot is one division's
 *  game time, so they are all published or all draft). The club never divides house league's time; it only reads how. */
async function houseLeagueSlots(orgId: string, slotIds: readonly string[]): Promise<Map<string, HouseLeagueSlot>> {
  const out = new Map<string, HouseLeagueSlot>();
  if (!slotIds.length) return out;
  const now = new Date().toISOString();
  const [uses, practices, games] = await Promise.all([
    fetchAllIn<{ slot_id: string; kind: 'games' | 'practices'; league_divisions: { name: string } | null }>(slotIds, (c, a, b) => supabaseAdmin
      .from('league_slot_uses').select('slot_id, kind, league_divisions ( name )').eq('org_id', orgId).in('slot_id', c).order('slot_id').range(a, b)),
    fetchAllIn<{ club_schedule_slot_id: string; league_teams: { name: string } | null }>(slotIds, (c, a, b) => supabaseAdmin
      .from('league_practices').select('club_schedule_slot_id, league_teams ( name )').eq('org_id', orgId).in('club_schedule_slot_id', c)
      .eq('status', 'scheduled').gt('scheduled_at', now).order('id').range(a, b)),
    fetchAllIn<{ slot_use_id: string; league_divisions: { schedule_published_at: string | null } | null }>(slotIds, (c, a, b) => supabaseAdmin
      .from('league_games').select('slot_use_id, league_divisions ( schedule_published_at )').eq('org_id', orgId).in('slot_use_id', c)
      .eq('status', 'scheduled').gt('scheduled_at', now).order('id').range(a, b)),
  ]);
  for (const id of slotIds) out.set(id, { use: null, division: null, practiceTeams: [], games: null });
  for (const g of games) {
    const slot = out.get(g.slot_use_id)!;
    slot.games = { count: (slot.games?.count ?? 0) + 1, published: !!g.league_divisions?.schedule_published_at };
  }
  for (const u of uses) {
    const slot = out.get(u.slot_id)!;
    slot.use = u.league_divisions ? houseLeagueUse(u.league_divisions.name, u.kind) : null;
    slot.division = u.league_divisions?.name ?? null;
  }
  for (const p of practices) if (p.league_teams) out.get(p.club_schedule_slot_id)!.practiceTeams.push(p.league_teams.name);
  for (const v of out.values()) v.practiceTeams = [...new Set(v.practiceTeams)].sort((x, y) => x.localeCompare(y, 'en-CA', { numeric: true }));
  return out;
}

/** THE SCHEDULE'S PAGE: the schedule, its time, every slot (held and clashing marked), fairness, the bill. */
export async function scheduleView(orgId: string, loaded: LoadedSchedule, canMoney: boolean, opts: { houseLeague?: boolean; familySlotIds?: readonly string[] } = {}): Promise<ScheduleView> {
  const row = loaded.row;
  const permitId = pricePermitOf(row);
  const live = loaded.slots.filter(s => !s.removed);
  const fromMs = Math.min(...live.map(s => Date.parse(s.startsAt)), Date.parse(`${row.starts_on}T00:00:00Z`));
  const toMs = Math.max(...live.map(s => Date.parse(s.endsAt)), Date.parse(`${row.ends_on}T23:59:59Z`));
  // Once the schedule made its bill, a money reader reads the money side — what each team pays and the bill as Finalize
  // made it, in one read — and the plain hand-backs that leave a bill as it was (Stage 11d part B — S11D-05's two numbers).
  const billed = canMoney && row.state === 'final' && !!row.allocation_id;
  // The permits behind its rows (the top line's doors): the prices read their names.
  const fromIds = schedulePermitIds(row, loaded.time.blocks);
  const [teams, ctx, nameOf, waiting, money, plainBacks, keptRates] = await Promise.all([
    // House league is always named when a slot holds it, whether or not the club still has house league.
    readClubTeams(orgId, { houseLeague: true }),
    // The family's practices are never "a booking already on the books" here: `familyShown` names them by part (Phase 8).
    engineContext(orgId, { slotIds: [...loaded.slots.map(s => s.id), ...(opts.familySlotIds ?? [])], teamIds: [], fromMs, toMs, permitId, rowPermits: loaded.time.blocks.map(b => b.permitId) }),
    resolvePersonNamer(orgId, [row.sent_by, row.finalized_by]),
    row.state === 'final' ? waitingAsksOfSchedule(orgId, row.id) : Promise.resolve([]),
    billed ? scheduleMoney(orgId, row.id, row.allocation_id!) : Promise.resolve(null),
    billed ? keptHandBacks(orgId, row.id, new Map(live.map(s => [s.id, s.teamIds]))) : Promise.resolve([]),
    billed ? readKeptRates(orgId, row.id) : Promise.resolve([]),
  ]);
  // A permit only the fallback names (no row came from it, and it doesn't price the time): its name, read alone.
  const unread = fromIds.filter(id => !ctx.prices.names.has(id));
  const names = unread.length ? new Map([...ctx.prices.names, ...(await readPrices(orgId, null, unread)).names]) : ctx.prices.names;
  const { slots, assignments, stored } = liveSlots(loaded, ctx.prices.weightOf);
  const billSlots = billSlotsOf(slots, assignments, ctx.prices.priceKeyOf);
  const pricing = canMoney ? schedulePricing(row, ctx.prices, billSlots, permitId) : null;
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
    offParkNames: Object.fromEntries([...new Set(loaded.time.datesOff.flatMap(d => d.venueIds ?? []))]
      .filter(v => !placeIds.includes(v) && ctx.places.venueName.has(v)).map(v => [v, ctx.places.venueName.get(v)!])),
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
        teamIds: s.teamIds, locked: s.locked, movedByHand: s.movedByHand, pricePermitId: billSlots[i].permitId ?? null, rowPermitId: s.permitId,
        handedBack: s.handedBack ? { at: s.handedBack.at, teamId: s.handedBack.teamId } : null,
        heldBy: h ? { ownerName: h.ownerName, kind: h.kind ?? null } : null,
        clash: !!h && s.teamIds.length > 0,
        houseLeague: s.teamIds.some(isProgramHolder) ? houseLeagueOf.get(s.id) ?? { use: null, division: null, practiceTeams: [], games: null } : null,
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
    bill: canMoney ? billViewOf(row, computeBill(row, billSlots, ctx.prices.hourOf, teams.map(t => t.id)), pricing, money?.made.length ? money.made : null, keptRates) : null,
    pricing,
    fromPermits: fromIds.filter(id => names.has(id)).map(id => ({ id, name: names.get(id)! })),
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

/**
 * A SCHEDULE'S ADDED PARTS, read for its page (Phase 8): each part's row facts and its own view — read beside the
 * schedule's, with the family's slot ids, so neither reads the other's practices as bookings. The page lays them in with
 * `familyShown`. Oldest part first. A part's bill reads as the schedule's does — to a money reader only (`canMoney`): its Bill
 * the teams window ("Bill it…" / "Change…", Session 3) opens on it. A sent part TAKEN OFF (no practices left, nothing waiting
 * to send — `partIsGone`) leaves the page; its row, bill and send record stay (11-17 ruling). `changesOf`: a sent part's own
 * changes waiting for Send the changes, as Needs attention lists them.
 */
export async function readParts(orgId: string, parent: LoadedSchedule, opts: {
  houseLeague?: boolean; canMoney?: boolean;
  /** False: a reader who can't open Rep Teams is not shown a part that holds rep teams (the parent's own gate, for each part). */
  repTeams?: boolean;
  changesOf?: (part: LoadedSchedule) => Promise<{ teams: PartRead['changes'] }>;
} = {}): Promise<{ parts: PartRead[]; familySlotIds: string[] }> {
  const ids = await fetchAll<{ id: string }>((a, b) => supabaseAdmin.from('club_schedules').select('id')
    .eq('org_id', orgId).eq('part_of_schedule_id', parent.row.id).order('created_at').order('id').range(a, b));
  if (!ids.length) return { parts: [], familySlotIds: [] };
  const loaded = (await Promise.all(ids.map(x => loadSchedule(orgId, x.id)))).filter((x): x is LoadedSchedule => !!x)
    .filter(l => opts.repTeams !== false || !touchesRepTeams(l))
    .filter(l => !partIsGone({ state: l.row.state, changedSinceSent: l.row.changed_since_sent, liveSlots: l.slots.filter(s => !s.removed).length }));
  if (!loaded.length) return { parts: [], familySlotIds: [] };
  const familySlotIds = [parent, ...loaded].flatMap(l => l.slots.map(s => s.id));
  const [views, changes] = await Promise.all([
    Promise.all(loaded.map(l => scheduleView(orgId, l, !!opts.canMoney, { houseLeague: opts.houseLeague, familySlotIds }))),
    Promise.all(loaded.map(l => (opts.changesOf && l.row.state === 'final' && l.row.changed_since_sent ? opts.changesOf(l) : Promise.resolve(null)))),
  ]);
  return {
    familySlotIds,
    parts: loaded.map((l, i) => ({
      id: l.row.id, label: l.row.part_label ?? l.row.name, state: l.row.state, version: l.row.version,
      startsOn: l.row.starts_on, endsOn: l.row.ends_on, sent: l.row.sent_at ? { at: l.row.sent_at } : null,
      billed: !!l.row.bill_plan || !!l.row.allocation_id, billDismissed: !!l.row.bill_dismissed_at, changedSinceSent: l.row.changed_since_sent,
      changes: changes[i]?.teams ?? [], view: views[i],
    })),
  };
}

// ── The list (specimen 4) ────────────────────────────────────────────────────────────────────────

export interface ScheduleListRow {
  id: string; name: string; state: ScheduleRow['state']; changedSinceSent: boolean; startsOn: string; endsOn: string;
  band: 'in_use' | 'coming_up' | 'ended';
  places: string[]; teams: number; handedOut: number; open: number;
  /** It hands time to rep teams (its ticks or its slots) — a member who can't open Rep Teams isn't shown it (11b review). */
  repTeams: boolean;
  lastSent: { at: string; by: string | null } | null;
}

/**
 * THE SCHEDULES LIST. An added part (Phase 8) is never a row of its own: it is read here only to be ROLLED INTO the schedule
 * it was added to — its slots in the counts, its places and teams with the schedule's, its dates widening the band, and
 * "Changed since sent" while it waits to be sent.
 */
export async function scheduleList(orgId: string): Promise<ScheduleListRow[]> {
  // parts-ok: every row is read, and a part is folded into its parent below — never listed.
  const all = await fetchAll<Pick<ScheduleRow, 'id' | 'name' | 'state' | 'starts_on' | 'ends_on' | 'settings' | 'changed_since_sent' | 'sent_at' | 'sent_by' | 'part_of_schedule_id'>>((a, b) => supabaseAdmin
    .from('club_schedules').select('id, name, state, starts_on, ends_on, settings, changed_since_sent, sent_at, sent_by, part_of_schedule_id').eq('org_id', orgId).order('id').range(a, b));
  const rows = all.filter(r => !r.part_of_schedule_id);
  if (!rows.length) return [];
  const partsOf = new Map<string, typeof all>();
  for (const x of all) if (x.part_of_schedule_id) (partsOf.get(x.part_of_schedule_id) ?? partsOf.set(x.part_of_schedule_id, []).get(x.part_of_schedule_id)!).push(x);
  const ids = all.map(r => r.id);
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
    const parts = partsOf.get(r.id) ?? [];
    const family = new Set([r.id, ...parts.map(x => x.id)]);
    const teamIds = [...new Set([r, ...parts].flatMap(x => { const s = readScheduleSettings(x.settings); return s.ok ? s.value.teamIds : []; }))];
    const startsOn = [r, ...parts].reduce((d, x) => (x.starts_on < d ? x.starts_on : d), r.starts_on);
    const endsOn = [r, ...parts].reduce((d, x) => (x.ends_on > d ? x.ends_on : d), r.ends_on);
    const mine = slots.filter(s => family.has(s.schedule_id));
    // A slot handed out is one a team has, however many share it (Stage 11c); an open one has nobody.
    const handedOut = mine.filter(s => holdersOf(s).length > 0).length;
    const placeWords = blocks.filter(b => family.has(b.schedule_id)).map(b => {
      const venue = places.venueName.get(b.org_venue_id) ?? '';
      // In the venue's order and said as the page says it: "Lakeshore Dome · Fields 1–6" (/design, 2026-10-11).
      const facilities = (b.org_time_block_facilities ?? []).map(f => places.facilityName.get(f.facility_id)).filter((x): x is string => !!x)
        .sort((x, y) => x.localeCompare(y, 'en-CA', { numeric: true }));
      return facilities.length ? `${venue} · ${facilities.length >= 3 ? facilityListWords(facilities) : facilities.join(', ')}` : venue;
    });
    return {
      id: r.id, name: r.name, state: r.state, changedSinceSent: r.changed_since_sent || parts.some(x => x.state !== 'final' || x.changed_since_sent), startsOn, endsOn,
      band: endsOn < today ? 'ended' as const : startsOn > today ? 'coming_up' as const : 'in_use' as const,
      places: [...new Set(placeWords)], teams: teamIds.length,
      handedOut, open: Math.max(0, mine.length - handedOut),
      repTeams: teamsOnly(teamIds).length > 0 || mine.some(s => (s.club_schedule_slot_teams ?? []).length > 0),
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
      // Absent (a request that never said) keeps the row's permit in the save; null (a typed row) clears it.
      ...(b.permitId === undefined ? {} : { permitId: b.permitId }),
    })),
    // Absent parks (a request that never said: a tab from before mig 488) keeps what the day names in the save; a list is
    // its parks, and an empty one All venues.
    datesOff: time.datesOff.map(d => ({ day: d.day, note: d.note, ...(d.venueIds === undefined ? {} : { venueIds: [...d.venueIds] }) })),
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
  const blocks: ScheduleBlock[] = [], blockIds: (string | null)[] = [];
  for (const raw of body.blocks as Record<string, unknown>[]) {
    const venueId = raw?.venueId, facilityIds = raw?.facilityIds, weekdays = raw?.weekdays;
    if (!isUuid(venueId)) return bad('Each row of hours needs its venue.');
    if (!Array.isArray(facilityIds) || !facilityIds.every(isUuid)) return bad('Pick the facilities again.');
    if (!Array.isArray(weekdays) || !weekdays.length || !weekdays.every(d => Number.isInteger(d) && d >= 1 && d <= 7)) return bad('Each row of hours needs its days.');
    if (!isClock(raw.startTime) || !isClock(raw.endTime) || raw.endTime <= raw.startTime) return bad('Each row of hours needs a start and a later end.');
    const fromDate = typeof raw.fromDate === 'string' && isCalendarDate(raw.fromDate) ? raw.fromDate : null;
    const untilDate = typeof raw.untilDate === 'string' && isCalendarDate(raw.untilDate) ? raw.untilDate : null;
    const id = isUuid(raw.id) ? raw.id : null;
    // The permit the row came from (mig 487): none for a typed row; the route checks it is still the club's (`permitGone`).
    if (raw.permitId != null && raw.permitId !== '' && !isUuid(raw.permitId)) return bad('Pick the permits again.');
    // A request that leaves `permitId` out (a browser tab from before mig 487) stays undefined, so the save keeps what is stored.
    const permitId = raw.permitId === undefined ? undefined : isUuid(raw.permitId) ? raw.permitId : null;
    blocks.push({ id: id ?? `new-${blocks.length}`, venueId, permitId, facilityIds: [...new Set(facilityIds as string[])], weekdays: [...new Set(weekdays as number[])].sort((a, b) => a - b), startTime: raw.startTime, endTime: raw.endTime, fromDate, untilDate });
    blockIds.push(id);
  }
  const datesOff: DateOff[] = [];
  if (body.datesOff !== undefined) {
    if (!Array.isArray(body.datesOff) || body.datesOff.length > 200) return bad('Pick the dates off again.');
    for (const d of body.datesOff as Record<string, unknown>[]) {
      if (typeof d?.day !== 'string' || !isCalendarDate(d.day)) return bad('A date off needs its date.');
      // The parks it closes (mig 488): a list of the club's venues, [] = All venues. Left out (or null) stays undefined, so
      // the save keeps what the day names today — a stale tab can't widen a named date off to All.
      const raw = d.venueIds;
      if (raw != null && (!Array.isArray(raw) || raw.length > 40 || !raw.every(isUuid))) return bad('Pick the date off’s parks again.');
      const venueIds = raw == null ? undefined : [...new Set(raw as string[])];
      datesOff.push({ day: d.day, note: typeof d.note === 'string' ? d.note.trim().slice(0, 120) || null : null, ...(venueIds ? { venueIds } : {}) });
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
export async function readScheduleRequest(orgId: string, body: Record<string, unknown>, opts: { houseLeague?: boolean; repTeams?: boolean } = {}): Promise<{ ok: true; value: ScheduleRequest } | { ok: false; response: Response }> {
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
  // A date off names the club's own parks (the save's trigger would refuse another's as a 500).
  if (t.time.datesOff.some(d => d.venueIds?.some(v => !places.venueName.has(v)))) return { ok: false, response: refusal(400, 'bad_time', 'Pick the date off’s parks again.') };
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
export function draftToSave(req: ScheduleRequest, prices: Prices, rawAssignments: unknown, kept: ReadonlyMap<string, StoredSlot> = new Map(), keep: ServerKeeping | null = null, family: readonly FamilyMember[] = []):
  { ok: true; slots: ReturnType<typeof slotsPayload> } | { ok: false; response: Response } {
  const checked = cutKeeping(req.time, req.settings, req.places, prices.weightOf, keep, family);
  if (!checked.ok) return { ok: false, response: refusal(400, checked.code, checked.error) };
  const room = roomChecker(req.settings, req.teams);
  // A kept slot is the stored one, whatever the draft says of it: its teams are never asked again (a team whose season has
  // since ended stays on a practice it already played).
  const pinned = new Set(keep?.pinned.map(s => s.key) ?? []);
  const asked = pinned.size && Array.isArray(rawAssignments)
    ? rawAssignments.filter(x => !pinned.has((x as { slotKey?: unknown })?.slotKey as string)) : rawAssignments;
  const a = readAssignments(asked, checked.slots, new Set(req.running.map(x => x.id)), (ids, slot) => room(ids, slot.weight));
  if (!a.ok) return { ok: false, response: refusal(400, a.code, a.error) };
  const keptAll = new Map<string, StoredSlot>([...kept, ...(keep?.stored ?? []).map(s => [s.key, s] as const)]);
  for (const [key, s] of keptAll) a.value.set(key, s.teamIds);
  // House league holds many slots at once (its league admins divide them): the one refusal is a TEAM's.
  const twice = teamTwice(checked.slots, new Map([...a.value].map(([k, ids]) => [k, teamsOnly(ids)])));
  if (twice) return { ok: false, response: refusal(409, 'team_twice', R.teamTwice(teamNamer(req.teams)(twice.teamId))) };
  // Across the family (Phase 8): a team the schedule it was added to, or another part, already has then.
  const elsewhere = familyTeamTwice(checked.slots, key => teamsOnly(a.value.get(key) ?? []), family, teamNamer(req.teams));
  if (elsewhere) return { ok: false, response: refusal(409, 'team_twice', elsewhere) };
  return { ok: true, slots: slotsPayload(checked.slots, a.value, keptAll) };
}

export interface BillTerms { lineId: string | null; permitId: string | null; amount: number | null; plan: PaymentPlan; firstDue: string | null; dates: string[] | null; mode: PriceMode }


const PLANS: readonly PaymentPlan[] = ['one', 'monthly', 'two_months', 'dates'];

/** Bill the teams (Ask 23): the line (a COST line of the club's, or none — an off-plan bill), the permit that prices the
 *  time (or none — then the amount is required), the part the teams pay (or the whole time's price), the payments. */
export async function readBill(orgId: string, raw: unknown): Promise<{ ok: true; value: BillTerms | null } | Refused> {
  if (raw === null) return { ok: true, value: null };
  if (!raw || typeof raw !== 'object') return no('bad_bill', R.billAgain);
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
  if ((b.lineId && !lineId) || (b.permitId && !permitId)) return no('bad_bill', R.billAgain);
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
  // How time on more than one price is priced (Session C, P2 A): Each permit's price unless the window says One rate.
  if (b.mode !== undefined && !(PRICE_MODES as readonly string[]).includes(b.mode as string)) return no('bad_bill', R.billAgain);
  const mode = (b.mode as PriceMode | undefined) ?? DEFAULT_PRICE_MODE;
  return { ok: true, value: { lineId, permitId, amount, plan, firstDue, dates, mode } };
}
