import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn, inParallel } from './supabase-paging';
import { resolveCoachUserIdentities, resolvePersonNamer } from './db';
import { listActiveStaffForTeams, resolveMembershipCapabilities } from './coach-membership';
import { canViewSchedule } from './coach-capabilities';
import { loadHeadCoaches } from './club-team-board';
import { notify } from './notify';
import { isScheduleBuilder } from './club-schedule-gate';
import { escapeHtml, sendEmail, wrap, SITE_URL } from './email';
import { joinWithAnd } from './utils';
import { addCalendarDays, isCalendarDate, mondayOfDay, tournamentToday, utcToZonedInputs } from './timezone';
import { fiscalYearOf } from './club-fiscal-year';
import { isClosedYearError, loadFiscalSetting } from './club-fiscal-year-server';
import { lineAllocated, sumMoney } from './club-money-figures';
import { previewCredit, schedulePoolInstallments } from './club-money-reads';
import { HAND_BACK_WORDS, type CreditMove } from './club-hand-back-words';
import { moneySectionHref } from './coach-money-links';
import { toCents } from './coach-register';
import { readClubPlaces, type ClubPlaces } from './permit-lookup';
import { clashesForSavedClubPractices } from './venue-clash-lookup';
import { diffAgainstSent, slotPatterns, type Slot } from './club-schedule-engine';
import {
  billCorrections, correctionInstallments, paymentPeriods, pricedMinutes, sharesAtRate, timeSplits, valuesAfterChanges,
  type BillSlot, type Installment, type TimeSplit,
} from './club-schedule-bill';
import {
  SCHEDULE_NOTICES, SCHEDULE_REFUSALS as R, SCHEDULE_WORDS as W, changeLine, changesEmail, patternLine, placeWords,
  teamEmail, unreachableSentence, type EmailWords, type ScheduleUnreachableWhy, type TeamChange,
} from './club-schedule-words';
import {
  billSlotsOf, computeBill, liveSlots, readClubTeams, readPrices, stepRefusal, teamNamer,
  type ClubTeam, type LoadedSchedule, type SchedulerCtx,
} from './club-schedule-server';
import type { NotificationEventType } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * SENDING A CLUB SCHEDULE (Club Tier Stage 11a, part A — Asks 7, 9, 14, 23, 24; build questions A and B; the reminders'
 * pattern, `lib/club-money-reminders.ts`). Three sends, one shape (Ask 9 — one send window and one log for every club
 * send):
 *
 *   · REVIEW (Ask 24) — each team's coaches see their slots and their bill and answer Looks good / Ask for a change.
 *     Nothing is booked or billed. The schedule reads In review; edits stay free; a team that never answers holds nothing.
 *   · FINAL — Finalize: every practice on each team's running season AND the bill as one allocation, in ONE database
 *     step (`club_schedule_finalize` — both happen or neither does, P11-05), then the emails and the notices.
 *   · CHANGES (Ask 14) — after it is final, edits wait; Send the changes applies the difference to the teams' schedules
 *     in one step (`club_schedule_apply_changes`: a moved slot's practice moved in place, a lost one cancelled when the
 *     coach worked on it and deleted when not, a gained one written) and tells only the teams it touched. Build question
 *     B: a team that gained time is billed a correction; a team that lost time is told what it is owed back.
 *
 * Each: a GET preview (per team its head coaches and staff with schedule access, its slots as a pattern, its bill; the
 * teams nobody can be told about, with the reminders' reasons; anything that blocks it, in words) and a POST of the confirmed teams that the server RECOMPUTES (it never trusts a list from the browser); a
 * database CLAIM against a double send before a single email goes; reply-to the sender; the sender never a recipient;
 * the send log row completed with what actually went. ⚖ THE CLUB'S COACHES ONLY — never the venue (owner 2026-10-12, walk
 * §300 W7: "this is between clubs and their coaches"; it amends Ask 7). The venue keeps its Bookings contact as a contact,
 * and a club that wants the dome to have the schedule sends it the Export. ⚠ EMAIL ONLY FROM THESE POSTS: `sendEmail` has no demo check of its
 * own — the proxy refuses a demo club's POST, and `notify()` stays silent for one.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type SendKind = 'review' | 'final' | 'changes';

export interface Person { userId: string; name: string | null; email: string; isHeadCoach: boolean }

export interface PreviewTeam {
  teamId: string;
  teamName: string;
  recipients: Person[];
  /** The team's slots (review / final), or its changes (changes). */
  slots: number;
  lines: string[];
  bill: { cents: number; installments: Installment[] } | null;
  /** Build question B, on Send the changes: a correction billed for time gained, in cents. */
  billedCents: number | null;
  /** Stage 11d, Ask 8: time the club moved off the team — taken off what it owes (latest payment first), the rest owed
   *  back by the club as an accepted request. Settled in the send's own step, under Bill the corrections. */
  lost: LostTime | null;
  /** "See 15U AAA's email" — the email this team's coaches get. */
  sample: EmailWords;
}

/** A team's lost time at Send the changes, and how it settles (Ask 8). */
export interface LostTime {
  cents: number;
  creditCents: number;
  payCents: number;
  /** What the credit does to each payment ("its Feb 1 payment drops from $864.00 to $756.00"). */
  moves: CreditMove[];
  /** The request to pay's season and filing (the bill's own word), when the team had paid some of it. */
  request: { programYearId: string; budgetItemId: string | null; budgetCategoryId: string | null };
}

export interface SendPreview {
  kind: SendKind;
  scheduleId: string;
  version: number;
  statement: string;
  teams: PreviewTeam[];
  unreachable: { teamId: string; teamName: string; why: ScheduleUnreachableWhy; sentence: string }[];
  /** What stops this send, said in words (a season not running, a closed year, a line without room, no money access). */
  blockers: { code: string; error: string; teamId?: string }[];
  /** On Send the changes: a correction the line can't hold — the send can still go without it (`billCorrections: false`). */
  correctionBlocked: { code: string; error: string } | null;
  replyBy: string | null;
  lastSent: { at: string; by: string | null; kind: SendKind } | null;
  /** ⚖ Always empty since Stage 11d (Ask 9): a hand-back is never a change waiting for a send — the team already has it,
   *  and its money settles at the answer. Kept for the shape the page and the window read (part B removes their use). */
  handedBack: { teamId: string; teamName: string; lines: string[] }[];
  /** People who'd be emailed. */
  recipientCount: number;
}

// ── Who is told ──────────────────────────────────────────────────────────────────────────────────

/**
 * Each team's head coaches and staff with schedule access (`canViewSchedule`; ruled for the send, Ask 7) — never the
 * person sending — and why a team with nobody can't be reached (the reminders' three reasons).
 */
async function schedulePeople(orgId: string, teamIds: readonly string[], senderId: string): Promise<Map<string, { people: Person[]; why: ScheduleUnreachableWhy | null }>> {
  const [staff, heads] = await Promise.all([listActiveStaffForTeams(teamIds), loadHeadCoaches(orgId, teamIds)]);
  const seeing = staff.filter(m => canViewSchedule(resolveMembershipCapabilities(m)));
  const ids = await resolveCoachUserIdentities(orgId, [...new Set(seeing.map(m => m.userId))]);
  const out = new Map<string, { people: Person[]; why: ScheduleUnreachableWhy | null }>();
  for (const teamId of teamIds) {
    const mine = seeing.filter(m => m.teamId === teamId);
    const people = mine
      .filter(m => m.userId !== senderId && ids.get(m.userId)?.email)
      .map(m => ({ userId: m.userId, name: ids.get(m.userId)?.displayName ?? null, email: ids.get(m.userId)!.email!, isHeadCoach: m.coachRole === 'head_coach' }));
    const why: ScheduleUnreachableWhy | null = people.length ? null
      : mine.some(m => m.userId === senderId) ? 'only_you'
      : (heads.get(teamId)?.invited ?? []).some(i => !i.expired) ? 'invitation_unanswered' : 'no_head_coach';
    out.set(teamId, { people, why });
  }
  return out;
}

/** The ids of every staff member of a team who sees the schedule (the notice's audience — a bell needs no email). */
async function scheduleUserIds(teamIds: readonly string[]): Promise<Map<string, string[]>> {
  const staff = (await listActiveStaffForTeams(teamIds)).filter(m => canViewSchedule(resolveMembershipCapabilities(m)));
  const out = new Map<string, string[]>(teamIds.map(t => [t, []]));
  for (const m of staff) out.get(m.teamId)?.push(m.userId);
  return out;
}

// ── What the schedule says, team by team ─────────────────────────────────────────────────────────

interface Context {
  orgId: string;
  orgName: string;
  orgSlug: string;
  senderId: string;
  loaded: LoadedSchedule;
  teams: ClubTeam[];
  places: ClubPlaces;
  slots: Slot[];
  assignments: Map<string, string[]>;
  slotIdOf: Map<string, string>;
  weightOf: (f: string | null) => number;
  fullHour: number | null;
  venueAddress: Map<string, string | null>;
}

async function contextFor(sctx: SchedulerCtx, loaded: LoadedSchedule): Promise<Context> {
  const orgId = sctx.ctx.org.id;
  const permitId = loaded.row.bill_permit_id ?? loaded.row.started_from_permit_id;
  const [teams, places, prices, venues] = await Promise.all([
    readClubTeams(orgId),
    readClubPlaces(orgId),
    readPrices(orgId, permitId),
    fetchAll<{ id: string; address: string | null }>((a, b) => supabaseAdmin.from('org_venues')
      .select('id, address').eq('org_id', orgId).order('id').range(a, b)),
  ]);
  const { slots, assignments, stored } = liveSlots(loaded, prices.weightOf);
  return {
    orgId, orgName: sctx.ctx.org.name, orgSlug: sctx.ctx.org.slug, senderId: sctx.ctx.user.id, loaded, teams, places, slots, assignments,
    slotIdOf: new Map(stored.map(s => [s.key, s.id])), weightOf: prices.weightOf, fullHour: prices.fullHour,
    venueAddress: new Map(venues.map(v => [v.id, v.address])),
  };
}

const placeOf = (c: Context, venueId: string, facilityId: string | null) =>
  placeWords(c.places.venueName.get(venueId) ?? '', facilityId ? c.places.facilityName.get(facilityId) ?? null : null);

/** A team's slots as the email's pattern lines (specimen 9). */
function patternsFor(c: Context, teamId: string): string[] {
  return slotPatterns(c.slots, teamId, c.assignments).map(p => patternLine(p, placeOf(c, p.venueId, p.facilityId)));
}

/** The teams the schedule gives time to, in the club's order. */
function teamsInSlots(c: Context): ClubTeam[] {
  const used = new Set([...c.assignments.values()].flat());
  return c.teams.filter(t => used.has(t.id));
}

/** The bill's own refusals, before anything is written (Ask 23b): money access, a line's year and room, a closed year. */
async function billBlockers(c: Context, canMoney: boolean, totalCents: number, firstDue: string | null): Promise<{ code: string; error: string }[]> {
  const row = c.loaded.row;
  if (!canMoney) return [{ code: 'bill_money', error: R.billMoney }];
  if (totalCents <= 0) return [{ code: 'bill_no_time', error: R.billNoTime }];
  const setting = await loadFiscalSetting(c.orgId);
  if (row.bill_line_id) {
    const { data: line, error } = await supabaseAdmin.from('org_budget_lines')
      .select('id, total_amount, org_fiscal_years ( first_day )').eq('id', row.bill_line_id).eq('org_id', c.orgId).maybeSingle();
    if (error) throw error;
    if (!line) return [{ code: 'line_not_found', error: 'The bill’s budget line isn’t the club’s any more. Pick it again.' }];
    const firstDay = (line.org_fiscal_years as { first_day?: string } | null)?.first_day;
    if (firstDay && fiscalYearOf(firstDay, setting).locked) return [{ code: 'year_closed', error: R.billYearClosed }];
    const allocated = await lineAllocatedCents(c.orgId, row.bill_line_id);
    const left = Math.round(Number(line.total_amount) * 100) - allocated;
    if (totalCents > left + 1) return [{ code: 'over_line', error: R.overLine(Math.max(0, left) / 100) }];
  } else if (firstDue && fiscalYearOf(firstDue, setting).locked) {
    return [{ code: 'year_closed', error: R.billYearClosed }];
  }
  return [];
}

/** What a line has already allocated, in cents — the one definition (`lineAllocated`), over the line's allocations. */
async function lineAllocatedCents(orgId: string, lineId: string): Promise<number> {
  // Billed less credited (Stage 11d): a credit hands the time's cost back to the line.
  const allocs = await fetchAll<{ id: string; rep_allocation_splits: { amount: number | string; rep_allocation_installments: { credited_amount: number | string }[] | null }[] | null }>((a, b) => supabaseAdmin
    .from('rep_cost_allocations').select('id, rep_allocation_splits ( amount, rep_allocation_installments ( credited_amount ) )').eq('org_id', orgId).eq('source_budget_line_id', lineId).order('id').range(a, b));
  return toCents(lineAllocated(lineId, allocs.map(a => ({
    sourceBudgetLineId: lineId,
    splits: (a.rep_allocation_splits ?? []).map(s => ({
      amount: Number(s.amount), credited: sumMoney((s.rep_allocation_installments ?? []).map(i => ({ amount: Number(i.credited_amount) }))),
    })),
  }))));
}

// ── Send the changes: the difference between the slots and the practices the teams were sent ──────

interface Practice { id: string; team_id: string; program_year_id: string; club_schedule_slot_id: string; status: string; starts_at: string; ends_at: string | null }

export interface ChangesPlan {
  inserts: FinalizeRow[];
  updates: { eventId: string; slotId: string; startsAt: string; endsAt: string; venueId: string; facilityId: string | null; location: string | null; locationAddress: string | null; fieldNumber: string | null }[];
  retire: string[];
  /** Per team, what changes on its schedule. */
  byTeam: Map<string, TeamChange[]>;
  /** Slots a team gained (for its correction's payments). */
  gainedSlots: Map<string, BillSlot[]>;
  /** Teams a change needs a running season for, and doesn't have one. */
  seasonless: string[];
}

export interface FinalizeRow {
  teamId: string; programYearId: string; slotId: string; startsAt: string; endsAt: string; venueId: string; facilityId: string | null;
  location: string | null; locationAddress: string | null; fieldNumber: string | null; name: string;
}

function rowFor(c: Context, slot: Slot, teamId: string, programYearId: string): FinalizeRow {
  return {
    teamId, programYearId, slotId: c.slotIdOf.get(slot.key)!, startsAt: new Date(slot.startMs).toISOString(), endsAt: new Date(slot.endMs).toISOString(),
    venueId: slot.venueId, facilityId: slot.facilityId,
    location: c.places.venueName.get(slot.venueId) ?? null, locationAddress: c.venueAddress.get(slot.venueId) ?? null,
    fieldNumber: slot.facilityId ? c.places.facilityName.get(slot.facilityId) ?? null : null, name: 'Practice',
  };
}

/** The practices the schedule's teams have now (every slot it ever had, removed ones included) — what they were sent. */
async function readPractices(orgId: string, slotIds: readonly string[]): Promise<Practice[]> {
  return fetchAllIn<Practice>(slotIds, (ch, a, b) => supabaseAdmin.from('rep_team_events')
    .select('id, team_id, program_year_id, club_schedule_slot_id, status, starts_at, ends_at').eq('org_id', orgId).in('club_schedule_slot_id', ch).order('id').range(a, b));
}

/**
 * THE DIFFERENCE (Ask 14), as rows for the one step: `diffAgainstSent` (pure, unit-tested) says what moved, what was
 * gained and what was lost; this names each change and writes each row — a move updates the practice in place, a gain
 * is written on the team's running season (a team without one is said, never written), a loss is retired.
 */
function planChanges(c: Context, practices: readonly Practice[]): ChangesPlan {
  const slotByKey = new Map(c.slots.map(s => [s.key, s]));
  const slotById = new Map([...c.slotIdOf].map(([key, id]) => [id, slotByKey.get(key)!]));
  const practiceById = new Map(practices.map(p => [p.id, p]));
  const diff = diffAgainstSent(
    [...c.slotIdOf].map(([key, id]) => ({ id, key, week: slotByKey.get(key)!.week, startMs: slotByKey.get(key)!.startMs })),
    c.assignments,
    practices.map(p => ({ id: p.id, teamId: p.team_id, slotId: p.club_schedule_slot_id, cancelled: p.status === 'cancelled', startMs: Date.parse(p.starts_at) })),
    ms => mondayOfDay(utcToZonedInputs(new Date(ms).toISOString()).date),
  );
  const plan: ChangesPlan = { inserts: [], updates: [], retire: [], byTeam: new Map(), gainedSlots: new Map(), seasonless: [] };
  const push = (t: string, ch: TeamChange) => (plan.byTeam.get(t) ?? plan.byTeam.set(t, []).get(t)!).push(ch);
  const gained = (t: string, g: Slot) => (plan.gainedSlots.get(t) ?? plan.gainedSlots.set(t, []).get(t)!)
    .push({ day: g.day, startMs: g.startMs, endMs: g.endMs, weight: g.weight, teamIds: [t] });
  const placeOfPractice = (p: Practice) => {
    const from = slotById.get(p.club_schedule_slot_id);
    return from ? placeOf(c, from.venueId, from.facilityId) : '';
  };
  for (const m of diff.moves) {
    const p = practiceById.get(m.practiceId)!, g = slotByKey.get(m.toKey)!;
    const row = rowFor(c, g, m.teamId, p.program_year_id);
    plan.updates.push({ eventId: p.id, slotId: row.slotId, startsAt: row.startsAt, endsAt: row.endsAt, venueId: row.venueId, facilityId: row.facilityId, location: row.location, locationAddress: row.locationAddress, fieldNumber: row.fieldNumber });
    push(m.teamId, { kind: 'moved', fromStartMs: Date.parse(p.starts_at), fromPlace: placeOfPractice(p), toStartMs: g.startMs, toEndMs: g.endMs, toPlace: placeOf(c, g.venueId, g.facilityId) });
    gained(m.teamId, g);
  }
  for (const gn of diff.gains) {
    const g = slotByKey.get(gn.key)!;
    const season = c.teams.find(t => t.id === gn.teamId)?.season?.id ?? null;
    if (!season) { if (!plan.seasonless.includes(gn.teamId)) plan.seasonless.push(gn.teamId); continue; }
    plan.inserts.push(rowFor(c, g, gn.teamId, season));
    push(gn.teamId, { kind: 'gains', startMs: g.startMs, endMs: g.endMs, place: placeOf(c, g.venueId, g.facilityId) });
    gained(gn.teamId, g);
  }
  for (const l of diff.losses) {
    const p = practiceById.get(l.practiceId)!;
    plan.retire.push(p.id);
    push(l.teamId, { kind: 'loses', startMs: Date.parse(p.starts_at), endMs: Date.parse(p.ends_at ?? p.starts_at), place: placeOfPractice(p) });
  }
  return plan;
}

const clockOf = (ms: number) => { const z = utcToZonedInputs(new Date(ms).toISOString()); return { day: z.date, time: z.time }; };

/**
 * ⚖ A HAND-BACK IS NEVER THE CLUB TAKING TIME (Stage 11d, Asks 8 and 9; S11D-03's hidden owed-back). A team's measure
 * at Send the changes adds back the priced minutes of every slot it handed back — a plain hand-back's (the team still
 * pays for that time, so it stays in what the team was billed) unless the team holds the slot again, and an accepted
 * ask's always (its money settled at the answer; a slot the club gives back to the team reads as time gained and is
 * billed). Without it, a team the club's changes touch would be measured on what it holds now, and every Sunday it handed
 * back would read as a loss and be credited a second time.
 */
async function withHandedBack(orgId: string, scheduleId: string, priced: ReadonlyMap<string, number>, c: Context): Promise<Map<string, number>> {
  const rows = await fetchAll<{ slot_id: string | null; priced_minutes: number | string; club_schedule_hand_backs: { team_id: string; state: string; asked_at: string; closed_at: string | null } | null }>((a, b) => supabaseAdmin
    .from('club_schedule_hand_back_slots').select('slot_id, priced_minutes, club_schedule_hand_backs!inner ( team_id, state, schedule_id, asked_at, closed_at )')
    .eq('org_id', orgId).eq('handed_back', true).eq('club_schedule_hand_backs.schedule_id', scheduleId).order('id').range(a, b));
  const keyOf = new Map([...c.slotIdOf].map(([key, id]) => [id, key]));
  const out = new Map(priced);
  // A Sunday handed back, given back by the club and handed back again counts ONCE — its latest hand-back (/review
  // 2026-10-13): two records of one slot would add its minutes twice and read the team as gaining time.
  const when = (r: (typeof rows)[number]) => r.club_schedule_hand_backs?.closed_at ?? r.club_schedule_hand_backs?.asked_at ?? '';
  const seen = new Set<string>();
  for (const r of [...rows].sort((x, y) => when(y).localeCompare(when(x)))) {
    const hb = r.club_schedule_hand_backs;
    if (!hb || (hb.state !== 'landed' && hb.state !== 'accepted')) continue;
    if (r.slot_id) {
      const once = `${r.slot_id}|${hb.team_id}`;
      if (seen.has(once)) continue;
      seen.add(once);
    }
    const key = r.slot_id ? keyOf.get(r.slot_id) : undefined;
    if (hb.state === 'landed' && key && (c.assignments.get(key) ?? []).includes(hb.team_id)) continue;
    out.set(hb.team_id, (out.get(hb.team_id) ?? 0) + Number(r.priced_minutes));
  }
  return out;
}

/** How a team's lost time settles (Ask 8): off what it still owes on the schedule's bills, latest payment first; the rest
 *  owed back by the club. The step writes the same application (`club_credit_apply`). */
async function lostTime(orgId: string, scheduleId: string, teamId: string, cents: number, c: Context): Promise<{ lost: LostTime; locked: string | null }> {
  const pool = await schedulePoolInstallments(orgId, scheduleId, teamId);
  // A bill the credit touches that counts in a closed fiscal year refuses it (the step raises; said here first).
  const { creditCents, payCents, moves, lockedYear: locked } = await previewCredit(orgId, pool, cents);
  const first = pool.splits.find(s => s.allocationId === c.loaded.row.allocation_id) ?? pool.splits[0];
  return {
    lost: {
      cents, creditCents, payCents, moves,
      request: {
        programYearId: c.teams.find(t => t.id === teamId)?.season?.id ?? first?.programYearId ?? '',
        budgetItemId: first?.budgetItemId ?? null, budgetCategoryId: first?.budgetCategoryId ?? null,
      },
    },
    locked,
  };
}

/** The last send that the teams were told (final or changes) — the corrections' baseline and "Last sent". Only sends whose
 *  step LANDED: a claim whose step was refused (or never ran) is no send. */
async function lastSends(orgId: string, scheduleId: string) {
  const sends = await fetchAll<{ id: string; kind: SendKind; sent_at: string; sent_by: string | null; team_values: Record<string, number> }>((a, b) => supabaseAdmin
    .from('club_schedule_sends').select('id, kind, sent_at, sent_by, team_values').eq('org_id', orgId).eq('schedule_id', scheduleId)
    .not('landed_at', 'is', null).order('sent_at', { ascending: false }).range(a, b));
  const told = sends.find(s => s.kind === 'final' || s.kind === 'changes') ?? null;
  return { last: sends[0] ?? null, told, review: sends.find(s => s.kind === 'review') ?? null };
}

// ── The preview ──────────────────────────────────────────────────────────────────────────────────

export async function previewSend(sctx: SchedulerCtx, loaded: LoadedSchedule, kind: SendKind, opts: { replyBy?: string | null } = {}): Promise<SendPreview & { plan?: ChangesPlan; finalRows?: FinalizeRow[]; splits?: TimeSplit[]; rate?: number | null; teamValues?: Record<string, number>; correction?: { gains: Map<string, number>; losses: Map<string, number> }; lost?: Map<string, LostTime> }> {
  const [c, { last, told }] = await Promise.all([contextFor(sctx, loaded), lastSends(sctx.ctx.org.id, loaded.row.id)]);
  const row = loaded.row;
  const blockers: SendPreview['blockers'] = [];
  // "Last sent … by …".
  const nameOf = await resolvePersonNamer(c.orgId, [last?.sent_by]);
  const teamName = teamNamer(c.teams);
  const scheduled = teamsInSlots(c);

  if (kind === 'final' && row.state === 'final') blockers.push({ code: 'already_final', error: R.alreadyFinal });
  if (kind === 'review' && row.state === 'final') blockers.push({ code: 'already_final', error: R.alreadyFinal });
  if (kind === 'changes' && row.state !== 'final') blockers.push({ code: 'not_final', error: R.notFinal });

  // The bill now, and the money it settles.
  const bill = kind === 'changes' ? null : computeBill(row, billSlotsOf(c.slots, c.assignments), c.fullHour, c.teams.map(t => t.id));
  let splits: TimeSplit[] | undefined, rate: number | null = null, teamValues: Record<string, number> | undefined;
  if (bill) {
    const total = bill.shares?.totalCents ?? 0;
    // A review books and bills nothing (Ask 24): it asks only who may show the teams their bill. The line's room, its year
    // and a price are Finalize's questions — a review never waits on them (/review 2026-10-11).
    if (kind === 'review') {
      if (!sctx.canMoney) blockers.push({ code: 'bill_money', error: R.billMoney });
    } else {
      blockers.push(...(await billBlockers(c, sctx.canMoney, total, row.bill_first_due ?? row.bill_dates?.[0] ?? null)));
    }
    if (bill.shares) {
      const seasons = new Map(c.teams.filter(t => t.season).map(t => [t.id, t.season!.id]));
      splits = timeSplits({ slots: bill.billSlots, shares: bill.shares, periods: bill.periods, seasons, priced: bill.priced });
      rate = bill.shares.rate;
      teamValues = Object.fromEntries(bill.shares.shares);
    } else if (kind === 'final' && !c.fullHour && row.bill_amount == null) blockers.push({ code: 'bill_no_price', error: R.billNoPrice });
  }

  // Seasons (Ask 15): a slot lands on the team's running season; a team without one can't take one.
  if (kind === 'final') {
    for (const t of scheduled) if (!t.season) blockers.push({ code: 'season_closed', error: R.seasonClosed(t.name), teamId: t.id });
  }

  // Changes, and the money they settle (build question B, amended by Stage 11d Ask 8).
  let plan: ChangesPlan | undefined;
  let correction: { gains: Map<string, number>; losses: Map<string, number> } | undefined;
  let correctionBlocked: SendPreview['correctionBlocked'] = null;
  // ⚖ Ask 9: a hand-back is never a change waiting for a send — always empty (the shape stays for the window).
  const handedBack: SendPreview['handedBack'] = [];
  const lost = new Map<string, LostTime>();
  if (kind === 'changes') {
    plan = planChanges(c, await readPractices(c.orgId, loaded.slots.map(s => s.id)));
    for (const t of plan.seasonless) blockers.push({ code: 'season_closed', error: R.seasonClosed(teamName(t)), teamId: t });
    const rateNow = row.bill_scale == null ? null : Number(row.bill_scale);
    if (rateNow && row.allocation_id) {
      // Only the teams the CLUB's changes touch are measured again (`valuesAfterChanges`) — a hand-back is the team's own
      // act — and each is measured with the time it handed back added back (`withHandedBack`), so a Sunday handed back is
      // never read as one the club took (S11D-03).
      const before = told?.team_values ?? {};
      const priced = await withHandedBack(c.orgId, row.id, pricedMinutes(billSlotsOf(c.slots, c.assignments)), c);
      const atRate = sharesAtRate(priced, rateNow, c.teams.map(t => t.id));
      const now = valuesAfterChanges(before, atRate, new Set(plan.byTeam.keys()));
      correction = billCorrections(before, now);
      // Ask 8: a team that LOST time is credited off what it owes (the rest owed back) — worded here, written in the step.
      for (const [t, cents] of correction.losses) {
        const settled = await lostTime(c.orgId, row.id, t, cents, c);
        lost.set(t, settled.lost);
        if (settled.locked && !correctionBlocked) correctionBlocked = { code: 'year_closed', error: HAND_BACK_WORDS.refuse.yearClosed(settled.locked) };
        if (settled.lost.payCents > 0 && !settled.lost.request.programYearId && !correctionBlocked) correctionBlocked = { code: 'season_closed', error: R.seasonClosed(teamName(t)) };
      }
      teamValues = Object.fromEntries(now);
      const gainTotal = [...correction.gains.values()].reduce((a, b) => a + b, 0);
      if (gainTotal > 0) {
        const today = tournamentToday();
        const blocked = await billBlockers(c, sctx.canMoney, gainTotal, today);
        correctionBlocked = blocked[0] ?? null;
        const periods = paymentPeriods(row.bill_plan ?? 'one', { firstDue: row.bill_first_due ?? today, dates: row.bill_dates, lastDay: row.ends_on });
        splits = [...correction.gains].map(([t, cents]) => {
          const installments = correctionInstallments(cents, t, plan!.gainedSlots.get(t) ?? [], periods, today);
          const gainedMinutes = (plan!.gainedSlots.get(t) ?? []).reduce((n, s) => n + ((s.endMs - s.startMs) / 60_000) * s.weight, 0);
          return {
            teamId: t, programYearId: c.teams.find(x => x.id === t)?.season?.id ?? '', amount: cents / 100,
            splitValue: Math.max(0.01, Math.round((gainedMinutes / 60) * 100) / 100),
            paymentSchedule: installments.length > 1 ? 'custom' as const : 'standard' as const, notes: null, installments,
          };
        });
        for (const s of splits) if (!s.programYearId && !correctionBlocked) correctionBlocked = { code: 'season_closed', error: R.seasonClosed(teamName(s.teamId)) };
      }
    }
  }

  // Who is told.
  const audienceIds = new Set(kind === 'changes' ? plan?.byTeam.keys() ?? [] : scheduled.map(t => t.id));
  const audience = c.teams.filter(t => audienceIds.has(t.id));
  const people = await schedulePeople(c.orgId, audience.map(t => t.id), c.senderId);
  const replyBy = kind === 'review' ? (opts.replyBy && isCalendarDate(opts.replyBy) ? opts.replyBy : row.reply_by ?? addCalendarDays(tournamentToday(), 7)) : null;
  const scheduleLink = (t: string) => `/${c.orgSlug}/coaches/teams/${t}/${kind === 'review' ? '' : 'schedule'}`.replace(/\/$/, '');
  const firstDay = c.slots[0]?.day ?? row.starts_on, lastDay = c.slots[c.slots.length - 1]?.day ?? row.ends_on;
  const venueNames = [...new Set(c.slots.map(s => c.places.venueName.get(s.venueId) ?? ''))].filter(Boolean);
  const slotCount = new Map<string, number>();
  for (const s of c.slots) for (const t of c.assignments.get(s.key) ?? []) slotCount.set(t, (slotCount.get(t) ?? 0) + 1);
  const splitOf = new Map((splits ?? []).map(s => [s.teamId, s]));
  const teams: PreviewTeam[] = [];
  const unreachable: SendPreview['unreachable'] = [];
  for (const t of audience) {
    const p = people.get(t.id)!;
    const slots = slotCount.get(t.id) ?? 0;
    const split = splitOf.get(t.id);
    const teamBill = kind !== 'changes' && split ? { cents: toCents(split.amount), installments: split.installments } : null;
    const lines = kind === 'changes' ? (plan!.byTeam.get(t.id) ?? []).map(ch => changeLine(ch, clockOf)) : patternsFor(c, t.id);
    const billedCents = kind === 'changes' ? correction?.gains.get(t.id) ?? null : null;
    const teamLost = kind === 'changes' ? lost.get(t.id) ?? null : null;
    if (!p.people.length) {
      unreachable.push({ teamId: t.id, teamName: t.name, why: p.why!, sentence: unreachableSentence(t.name, p.why!, slots, kind) });
      continue;
    }
    const recipientNames = p.people.map(x => x.name);
    const sample = kind === 'changes'
      ? changesEmail({ orgName: c.orgName, scheduleName: row.name, teamName: t.name, recipientNames, lines, billedCents, lost: teamLost, link: scheduleLink(t.id) })
      : teamEmail({ kind, orgName: c.orgName, scheduleName: row.name, teamName: t.name, venueName: joinWithAnd(venueNames), recipientNames, slotCount: slots, firstDay, lastDay, patterns: lines, bill: teamBill, replyBy, link: scheduleLink(t.id) });
    teams.push({ teamId: t.id, teamName: t.name, recipients: p.people, slots, lines, bill: teamBill, billedCents, lost: teamLost, sample });
  }

  const finalRows = kind === 'final' ? scheduled.flatMap(t => t.season ? c.slots.filter(s => (c.assignments.get(s.key) ?? []).includes(t.id)).map(s => rowFor(c, s, t.id, t.season!.id)) : []) : undefined;
  const changedTeams = plan ? plan.byTeam.size : 0;
  const statement = kind === 'review' ? W.reviewStatement(replyBy)
    : kind === 'final' ? W.finalStatement(c.slots.filter(s => (c.assignments.get(s.key) ?? []).length).length, scheduled.length)
    : W.changesStatement(changedTeams, handedBack.map(h => h.teamName));
  return {
    kind, scheduleId: row.id, version: row.version, statement, teams, unreachable, blockers, correctionBlocked, replyBy,
    lastSent: last ? { at: last.sent_at, by: nameOf(last.sent_by), kind: last.kind } : null,
    handedBack, recipientCount: teams.reduce((n, t) => n + t.recipients.length, 0),
    plan, finalRows, splits, rate, teamValues, correction, lost,
  };
}

// ── The send ─────────────────────────────────────────────────────────────────────────────────────

export type SendResult =
  | { ok: true; teams: number; people: number; failed: number; allocationId: string | null; version: number;
      /** What it wrote, checked as every writer's reply is (6a): practices that clash with another booking, and outside a permit. */
      checks: { clashes: number; outsidePermit: number } }
  | { ok: false; response: Response };

const json = (status: number, body: object) => ({ ok: false as const, response: new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }) });

/**
 * SEND. The server recomputes the preview, refuses on any blocker or a version the sender didn't see, claims the send
 * (a double press is refused before a single email), does the one database step, then emails the confirmed teams'
 * people (reply-to the sender), tells them in the bell, and completes the log with what actually went.
 */
export async function sendSchedule(sctx: SchedulerCtx, loaded: LoadedSchedule, kind: SendKind, body: {
  version?: unknown; teamIds?: unknown; replyBy?: unknown; billCorrections?: unknown;
}): Promise<SendResult> {
  const row = loaded.row;
  if (Number(body.version) !== row.version) return json(409, { error: R.changed, code: 'changed', version: row.version });
  if (!Array.isArray(body.teamIds) || !body.teamIds.every(x => typeof x === 'string')) return json(400, { error: R.noTeamsMatch, code: 'teams_required' });
  const preview = await previewSend(sctx, loaded, kind, { replyBy: typeof body.replyBy === 'string' ? body.replyBy : null });
  if (preview.blockers.length) return json(409, { error: preview.blockers[0].error, code: preview.blockers[0].code, blockers: preview.blockers });
  const billCorrectionsOn = body.billCorrections !== false;
  if (kind === 'changes' && billCorrectionsOn && preview.correctionBlocked) {
    return json(409, { error: preview.correctionBlocked.error, code: preview.correctionBlocked.code, correction: true });
  }
  const confirmed = new Set(body.teamIds as string[]);
  const teams = preview.teams.filter(t => confirmed.has(t.teamId));
  const orgId = sctx.ctx.org.id, actor = sctx.ctx.user.id;
  const teamName = teamNamer(preview.teams.map(t => ({ id: t.teamId, name: t.teamName })));

  // ⚖ CLAIM BEFORE ANY EMAIL (the reminders' lesson, /review 2026-10-01).
  const claim = await supabaseAdmin.rpc('club_schedule_send_claim', { p_org: orgId, p_schedule: row.id, p_actor: actor, p_kind: kind, p_reply_by: preview.replyBy });
  if (claim.error) throw claim.error;
  const claimed = claim.data as { ok: boolean; code?: string; sendId?: string };
  if (!claimed.ok || !claimed.sendId) return { ok: false, response: stepRefusal(claimed, teamName) };
  const sendId = claimed.sendId;
  const release = async () => {
    const { error } = await supabaseAdmin.from('club_schedule_sends').delete().eq('id', sendId);
    if (error) console.error('[club-schedule-send] could not release a claim whose step was refused:', error);
  };

  // The one database step.
  let allocationId: string | null = null;
  let version = row.version;
  let written: { slotIds: string[]; teamIds: Set<string> | null } = { slotIds: [], teamIds: null };
  // Each step marks the claimed log row landed and writes its money (the next Send the changes' baseline) itself — never
  // after the emails, where a failure left `{}` and the next send billed every team its whole share again (/review).
  if (kind === 'review') {
    const { data, error } = await supabaseAdmin.rpc('club_schedule_send_review', {
      p_org: orgId, p_schedule: row.id, p_actor: actor, p_version: row.version, p_reply_by: preview.replyBy, p_send: sendId,
    });
    if (error) { await release(); throw error; }
    const r = data as { ok: boolean; code?: string; version?: number };
    if (!r.ok) { await release(); return { ok: false, response: stepRefusal(r, teamName) }; }
    version = r.version!;
  } else if (kind === 'final') {
    const bill = preview.splits?.length ? { description: row.name, lineId: row.bill_line_id, notes: null, splits: preview.splits } : null;
    const { data, error } = await supabaseAdmin.rpc('club_schedule_finalize', {
      p_org: orgId, p_schedule: row.id, p_actor: actor, p_version: row.version, p_rows: preview.finalRows ?? [], p_bill: bill, p_scale: bill ? preview.rate : null,
      p_send: sendId, p_log: { teamValues: preview.teamValues ?? {} },
    });
    if (error) { await release(); throw error; }
    const r = data as { ok: boolean; code?: string; teamId?: string; left?: number; allocationId?: string | null };
    if (!r.ok) { await release(); return { ok: false, response: stepRefusal(r, teamName) }; }
    allocationId = r.allocationId ?? null;
    version = row.version + 1;
    written = { slotIds: loaded.slots.filter(s => !s.removed).map(s => s.id), teamIds: null };
  } else {
    const plan = preview.plan!;
    const gains = billCorrectionsOn && preview.splits?.length ? preview.splits : [];
    const bill = gains.length ? { description: `${row.name} · changes ${tournamentToday()}`, lineId: row.bill_line_id, notes: null, splits: gains } : null;
    // Ask 8: under the same switch, each team that lost time is credited off what it owes (the rest an accepted request to
    // pay) — in the step, with its baseline. Off: neither the gain is billed nor the loss credited; the baseline moves on.
    const losses = billCorrectionsOn ? [...(preview.lost ?? new Map<string, LostTime>())].map(([teamId, l]) => ({
      teamId, cents: l.cents, reason: HAND_BACK_WORDS.reasonChanges,
      request: { programYearId: l.request.programYearId, description: HAND_BACK_WORDS.lostRequestName(row.name), budgetItemId: l.request.budgetItemId ?? '', budgetCategoryId: l.request.budgetCategoryId ?? '', budgetLineId: row.bill_line_id ?? '' },
    })) : [];
    const { data, error } = await supabaseAdmin.rpc('club_schedule_apply_changes', {
      p_org: orgId, p_schedule: row.id, p_actor: actor, p_version: row.version,
      p_inserts: plan.inserts, p_updates: plan.updates, p_retire: plan.retire, p_bill: bill,
      p_send: sendId, p_log: {
        teamValues: preview.teamValues ?? {},
        billed: billCorrectionsOn ? Object.fromEntries(preview.correction?.gains ?? []) : {},
        today: tournamentToday(),
      },
      p_losses: losses,
    });
    if (error && isClosedYearError(error)) { await release(); return json(409, { error: HAND_BACK_WORDS.refuse.yearClosed(null), code: 'year_closed', correction: true }); }
    // The step's own 'changed: …' refusals (a slot gone, a loss's team or season, a team paid since the preview): read the
    // send again — never a raw error (/review 2026-10-13).
    if (error && /changed:/.test(error.message ?? '')) { await release(); return { ok: false, response: stepRefusal({ code: 'changed' }, teamName) }; }
    if (error) { await release(); throw error; }
    const r = data as { ok: boolean; code?: string; teamId?: string; left?: number; allocationId?: string | null };
    if (!r.ok) { await release(); return { ok: false, response: stepRefusal(r, teamName) }; }
    allocationId = r.allocationId ?? null;
    version = row.version + 1;
    written = { slotIds: [...new Set([...plan.inserts.map(x => x.slotId), ...plan.updates.map(x => x.slotId)])], teamIds: new Set(plan.byTeam.keys()) };
  }

  // What it wrote, checked (6a): every writer of a booking's time or place answers with the one clash rule's findings.
  const checks = await checkWritten(orgId, written, preview.teams.map(t => ({ id: t.teamId, name: t.teamName })));

  // The emails: one per team's person, colleague mail, reply-to the sender (never a recipient — the preview left them out).
  const sends = teams.flatMap(t => t.recipients.map(p => ({ teamId: t.teamId, email: p.email, subject: t.sample.subject, html: emailHtml(t.sample) })));
  const results = await inParallel(sends, 5, s => sendEmail(s.email, s.subject, s.html, { replyTo: sctx.ctx.user.email ?? null }));
  const sent = results.filter(r => r.status === 'sent').length;
  const reached = [...new Set(sends.filter((s, i) => results[i].status === 'sent').map(s => s.teamId))];

  // The bells ("Your club"): every staff member who sees the schedule, whether or not they have an email.
  await tellTeams(sctx, row.name, kind, teams.map(t => t.teamId), preview);

  // The log, completed with who was actually told (its money landed with the step).
  const changesLog = kind === 'changes' ? [...(preview.plan?.byTeam ?? new Map())].map(([teamId, list]) => ({ teamId, changes: list.length })) : [];
  const { error: logError } = await supabaseAdmin.from('club_schedule_sends').update({
    team_ids: reached, people_count: sent, failed_count: results.length - sent,
    reply_by: preview.replyBy, changes: changesLog,
  }).eq('id', sendId);
  if (logError) console.error('[club-schedule-send] the send log could not be completed (the send went):', logError);

  return { ok: true, teams: reached.length, people: sent, failed: results.length - sent, allocationId, version, checks };
}

/** The practices a send wrote, checked by the one clash rule (and the permit's answer) in one read — never fatal. */
async function checkWritten(orgId: string, written: { slotIds: string[]; teamIds: Set<string> | null }, names: { id: string; name: string }[]): Promise<{ clashes: number; outsidePermit: number }> {
  if (!written.slotIds.length) return { clashes: 0, outsidePermit: 0 };
  try {
    const rows = await fetchAllIn<{ id: string; team_id: string; starts_at: string; ends_at: string | null; org_venue_id: string | null; org_venue_facility_id: string | null; location: string | null; field_number: string | null; club_schedule_slot_id: string | null }>(written.slotIds, (ch, a, b) => supabaseAdmin
      .from('rep_team_events').select('id, team_id, starts_at, ends_at, org_venue_id, org_venue_facility_id, location, field_number, club_schedule_slot_id')
      .eq('org_id', orgId).in('club_schedule_slot_id', ch).eq('status', 'scheduled').order('id').range(a, b));
    const teamName = teamNamer(names);
    const saved = rows.filter(r => !written.teamIds || written.teamIds.has(r.team_id)).map(r => ({ ...r, teamName: teamName(r.team_id) }));
    const found = await clashesForSavedClubPractices(orgId, saved);
    return { clashes: Object.keys(found.clashes).length, outsidePermit: Object.keys(found.permits).length };
  } catch (e) {
    console.error('[club-schedule-send] the written practices could not be checked (the send went):', e);
    return { clashes: 0, outsidePermit: 0 };
  }
}

/** The email, wrapped in the house mail (`wrap`): every word escaped. */
export function emailHtml(w: EmailWords): string {
  const p = (t: string) => `<p style="margin:0 0 0.75rem;">${escapeHtml(t)}</p>`;
  const lists = w.lists.map(l => `${l.title ? `<p style="margin:0 0 0.35rem;font-weight:700;">${escapeHtml(l.title)}</p>` : ''}<ul style="margin:0 0 0.75rem;padding-left:1.25rem;">${l.items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`).join('');
  const link = w.link ? `<p style="margin:1rem 0;"><a href="${escapeHtml(`${SITE_URL}${w.link.path}`)}" style="color:#D9F99D;font-weight:700;">${escapeHtml(w.link.label)}</a></p>` : '';
  return wrap(`${p(w.greeting)}${w.paragraphs.map(p).join('')}${lists}${link}${w.outro ? p(w.outro) : ''}`);
}

/** The notices: a review, the final schedule (and its bill), the changes — to each team's people who see the schedule. */
async function tellTeams(sctx: SchedulerCtx, scheduleName: string, kind: SendKind, teamIds: readonly string[], preview: SendPreview): Promise<void> {
  try {
    const audience = await scheduleUserIds(teamIds);
    const org = sctx.ctx.org;
    for (const t of preview.teams.filter(x => teamIds.includes(x.teamId))) {
      const userIds = audience.get(t.teamId) ?? [];
      if (!userIds.length) continue;
      const base = { orgId: org.id, userIds, excludeUserIds: [sctx.ctx.user.id], metadata: { teamId: t.teamId, scheduleId: preview.scheduleId } };
      const link = `/${org.slug}/coaches/teams/${t.teamId}${kind === 'review' ? '' : '/schedule'}`;
      const send = (eventType: NotificationEventType, words: { title: string; body: string }, href = link) =>
        notify({ ...base, eventType, title: words.title, body: words.body, link: href });
      if (kind === 'review') {
        await send('club_schedule_review', SCHEDULE_NOTICES.review({ orgName: org.name, scheduleName, teamName: t.teamName, slots: t.slots, billCents: t.bill?.cents ?? null, replyBy: preview.replyBy }));
      } else if (kind === 'final') {
        await send('club_schedule_final', SCHEDULE_NOTICES.final({ scheduleName, teamName: t.teamName, slots: t.slots }));
        if (t.bill) {
          await send('club_bill_arrived', SCHEDULE_NOTICES.bill({ orgName: org.name, teamName: t.teamName, cents: t.bill.cents, scheduleName, first: t.bill.installments[0] ?? null, payments: t.bill.installments.length }),
            moneySectionHref(`/${org.slug}/coaches/teams/${t.teamId}`, 'club'));
        }
      } else {
        await send('club_schedule_changes', SCHEDULE_NOTICES.changes({ scheduleName, teamName: t.teamName, changes: t.lines.length }));
        if (t.billedCents) {
          await send('club_bill_arrived', SCHEDULE_NOTICES.bill({ orgName: org.name, teamName: t.teamName, cents: t.billedCents, scheduleName, first: null, payments: 1 }),
            moneySectionHref(`/${org.slug}/coaches/teams/${t.teamId}`, 'club'));
        }
      }
    }
  } catch (e) {
    // Best-effort, as every club notice: the send has landed; a failed bell must not turn it into an error.
    console.error('[club-schedule-send] a notice failed (the send went):', e);
  }
}

/** Tell the people who built the schedule (its maker and its last sender) — a reply or a hand-back. */
export async function tellBuilders(p: {
  orgId: string; orgSlug: string; scheduleId: string; actorUserId: string | null;
  eventType: 'club_schedule_reply' | 'club_schedule_handed_back'; title: string; body: string;
}): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin.from('club_schedules').select('created_by, sent_by, finalized_by').eq('id', p.scheduleId).maybeSingle();
    if (error) throw error;
    const named = [...new Set([data?.created_by, data?.sent_by, data?.finalized_by].filter((x): x is string => !!x))];
    if (!named.length) return;
    // Only someone who still builds the club's schedules — an admin removed or demoted since is told nothing (/review).
    const { data: members, error: mErr } = await supabaseAdmin.from('organization_members').select('user_id, role')
      .eq('organization_id', p.orgId).eq('status', 'active').in('user_id', named);
    if (mErr) throw mErr;
    const userIds = (members ?? []).filter(m => isScheduleBuilder(m.role as string)).map(m => m.user_id as string);
    if (!userIds.length) return;
    await notify({
      orgId: p.orgId, eventType: p.eventType, title: p.title, body: p.body, userIds,
      excludeUserIds: p.actorUserId ? [p.actorUserId] : [], link: `/${p.orgSlug}/admin/schedules/${p.scheduleId}`,
      metadata: { scheduleId: p.scheduleId },
    });
  } catch (e) {
    console.error('[club-schedule-send] the builders\' notice failed (the act landed):', e);
  }
}

/** The send log (specimen 9): every send, newest first. */
export async function sendLog(orgId: string, scheduleId: string) {
  const rows = await fetchAll<{ id: string; kind: SendKind; sent_at: string; sent_by: string | null; team_ids: string[]; people_count: number; failed_count: number; billed: Record<string, number>; owed_back: Record<string, number>; settled: Record<string, { credited: number; toPay: number }> | null; allocation_id: string | null }>((a, b) => supabaseAdmin
    .from('club_schedule_sends').select('id, kind, sent_at, sent_by, team_ids, people_count, failed_count, billed, owed_back, settled, allocation_id')
    .eq('org_id', orgId).eq('schedule_id', scheduleId).not('landed_at', 'is', null).order('sent_at', { ascending: false }).range(a, b));
  const nameOf = await resolvePersonNamer(orgId, rows.map(r => r.sent_by));
  return rows.map(r => ({
    id: r.id, kind: r.kind, at: r.sent_at, by: nameOf(r.sent_by), teamIds: r.team_ids, people: r.people_count, failed: r.failed_count,
    // `owedBack` is an old send's (build question B's, retired by Stage 11d); `settled` is what a send credited or owes
    // back since (Ask 8). Money — the route strips both for a reader without the club's Accounting.
    billed: r.billed, owedBack: r.owed_back, settled: r.settled ?? {}, allocationId: r.allocation_id,
  }));
}

/**
 * CHANGED SINCE SENT (specimen 10): what the teams would get at Send the changes, team by team — the callout's lines.
 * Read only; nothing is sent. ⚖ Stage 11d Ask 9: a hand-back is never a change waiting for a send, so `handedBack` is
 * always empty (its shape stays for the page — part B removes what the page does with it).
 */
export async function changesSummary(sctx: SchedulerCtx, loaded: LoadedSchedule): Promise<{ teams: { teamId: string; teamName: string; lines: string[] }[]; handedBack: { teamId: string; teamName: string; lines: string[] }[] }> {
  if (loaded.row.state !== 'final') return { teams: [], handedBack: [] };
  const orgId = sctx.ctx.org.id;
  const [c, practices] = await Promise.all([contextFor(sctx, loaded), readPractices(orgId, loaded.slots.map(s => s.id))]);
  const plan = planChanges(c, practices);
  const name = teamNamer(c.teams);
  return {
    teams: [...plan.byTeam].map(([teamId, list]) => ({ teamId, teamName: name(teamId), lines: list.map(ch => changeLine(ch, clockOf)) })),
    handedBack: [],
  };
}
