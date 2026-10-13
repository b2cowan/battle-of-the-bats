import 'server-only';
import { loadFiscalSetting } from './club-fiscal-year-server';
import { closedThrough, fiscalYearOf, type FiscalSetting, type FiscalYear } from './club-fiscal-year';
import { supabaseAdmin } from './supabase-admin';
import { orgDayKey, tournamentToday, daysBetweenDateStrings } from './timezone';
import { getRepProgramYear, getRepTeams, mapRepAllocationInstallment, resolvePersonNamer } from './db';
import { mapClubRequest, type ClubRequest } from './coach-club-money';
import { resolveCoachCapabilities } from './coach-capabilities';
import { loadSeasonSettlement } from './coach-season-settlement';
import { closeOutBlockers, clubRequestsHoldPayout } from './season-settlement';
import { loadHeadCoaches } from './club-team-board';
import { fetchAll, fetchAllIn, inParallel } from './supabase-paging';
import {
  clubBillChip, clubBillFigures, clubInstallmentDaysLate, clubInstallmentReceivedOn, clubInstallmentState,
  comingDueBand, sumMoney, teamAccount, type AccountBill, type AccountRequest, type ClubBillChip,
  type ClubBillFigures, type ClubInstallmentState, type ComingDueBand, type TeamAccount,
} from './club-money-figures';
import { howItCame, methodWord, teamsWord } from './club-money-words';
import type { RepAllocationInstallment } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S READS OF ITS MONEY LOOP (Club Tier Stage 3a; the reads behind Accounting's tabs).
 *
 * Every figure comes from lib/club-money-figures.ts — never computed here — so Collected,
 * Outstanding, Overdue, Next due and Sent mean one thing on every tab (the "same figure, one
 * definition" guard holds it). Every read is scoped to the member's team groups (B11): a member
 * limited to some groups sees those teams' money and no other.
 *
 * ⚠ NO 1,000-ROW CAP. A Supabase read stops at 1,000 rows silently (C14); every list here that can
 * grow with a club's years pages through lib/supabase-paging.ts.
 *
 * ⚠ Nothing here reads a team's ledger (`accounting_entries` on a team book): the team's money is the
 * coaches' (D1). The club reads its own records — allocations, installments, requests.
 *
 * Words the screens print (directions, statuses, "Filed as", a book's kind) are NOT sent: they are
 * one call into the client-safe lib/club-money-words.ts, which is their single home.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

// ── The loop's rows ────────────────────────────────────────────────────────────────────────────

export interface LoopTeam { id: string; name: string; groupId: string | null; groupName: string | null; isArchived: boolean }
export interface LoopAllocation {
  id: string; description: string; createdAt: string; totalAmount: number; sourceBudgetLineId: string | null; sourceEntryId: string | null;
  /** The club's own note (mig 318 — asked by New allocation, "for the club's own reference"; teams never see it). Read
   *  and changed on the allocation's window (Stage 3d, S3D-03). */
  notes: string | null;
}
export interface LoopSplit {
  id: string; allocationId: string; teamId: string; programYearId: string; amount: number; paymentSchedule: string;
  /** Its installments, in installment order. */
  installments: RepAllocationInstallment[];
}

export interface ClubLoop {
  teams: Map<string, LoopTeam>;
  allocations: Map<string, LoopAllocation>;
  splits: LoopSplit[];
}

/**
 * The club's allocations, splits and installments, limited to the teams the member may see.
 * `scope` null = every team. Optional narrowing to one allocation or one team. Two waves: the teams
 * and the splits together, then the allocations and the installments together.
 */
export async function loadClubLoop(
  orgId: string,
  scope: Set<string> | null,
  only: { allocationId?: string; teamId?: string } = {},
): Promise<ClubLoop> {
  const [teamRows, splitRows] = await Promise.all([
    getRepTeams(orgId),
    fetchAll<Record<string, any>>((a, b) => {
      let q = supabaseAdmin.from('rep_allocation_splits')
        .select('id, allocation_id, team_id, program_year_id, amount, payment_schedule')
        .eq('org_id', orgId).order('created_at').order('id');
      if (only.allocationId) q = q.eq('allocation_id', only.allocationId);
      if (only.teamId) q = q.eq('team_id', only.teamId);
      return q.range(a, b);
    }),
  ]);
  const teams = new Map<string, LoopTeam>();
  for (const t of teamRows) {
    if (scope && !scope.has(t.id)) continue;
    teams.set(t.id, { id: t.id, name: t.name, groupId: t.groupId ?? null, groupName: t.groupName ?? null, isArchived: t.isArchived });
  }
  const visible = splitRows.filter(s => teams.has(s.team_id));

  const [allocationRows, installmentRows] = await Promise.all([
    fetchAllIn<Record<string, any>>(visible.map(s => s.allocation_id), (c, a, b) =>
      supabaseAdmin.from('rep_cost_allocations')
        .select('id, description, created_at, total_amount, source_budget_line_id, source_entry_id, notes')
        .eq('org_id', orgId).in('id', c).order('id').range(a, b)),
    fetchAllIn<Record<string, any>>(visible.map(s => s.id), (c, a, b) =>
      supabaseAdmin.from('rep_allocation_installments').select('*')
        .in('split_id', c).order('installment_number').order('id').range(a, b)),
  ]);

  const allocations = new Map<string, LoopAllocation>(allocationRows.map(a => [a.id, {
    id: a.id, description: a.description, createdAt: a.created_at, totalAmount: Number(a.total_amount),
    sourceBudgetLineId: a.source_budget_line_id ?? null, sourceEntryId: a.source_entry_id ?? null, notes: a.notes ?? null,
  }]));
  const bySplit = new Map<string, RepAllocationInstallment[]>();
  for (const r of installmentRows) {
    const list = bySplit.get(r.split_id) ?? [];
    list.push(mapRepAllocationInstallment(r));
    bySplit.set(r.split_id, list);
  }
  for (const list of bySplit.values()) list.sort((x, y) => x.installmentNumber - y.installmentNumber);

  const splits: LoopSplit[] = visible.map(s => ({
    id: s.id, allocationId: s.allocation_id, teamId: s.team_id, programYearId: s.program_year_id,
    amount: Number(s.amount), paymentSchedule: s.payment_schedule, installments: bySplit.get(s.id) ?? [],
  }));
  return { teams, allocations, splits };
}

const splitsAllocated = (splits: readonly LoopSplit[]) => sumMoney(splits);

// ── Allocations (the list) ─────────────────────────────────────────────────────────────────────

export interface AllocationListRow {
  id: string;
  description: string;
  createdAt: string;
  teamIds: string[];
  teamNames: string[];
  /** "All 9 teams", "Boys · 6 teams", or the names when three or fewer. */
  teamsWord: string;
  allocated: number;
  figures: ClubBillFigures;
  chip: ClubBillChip;
  /** The first and last due dates — the schedule caption. */
  firstDue: string | null;
  lastDue: string | null;
  installmentsPerTeam: number;
}

export function allocationListRows(loop: ClubLoop, today: string): AllocationListRow[] {
  const activeTeams = [...loop.teams.values()].filter(t => !t.isArchived);
  const byAllocation = new Map<string, LoopSplit[]>();
  for (const s of loop.splits) byAllocation.set(s.allocationId, [...(byAllocation.get(s.allocationId) ?? []), s]);

  const rows: AllocationListRow[] = [];
  for (const [allocationId, splits] of byAllocation) {
    const a = loop.allocations.get(allocationId);
    if (!a) continue;
    const insts = splits.flatMap(s => s.installments);
    const figures = clubBillFigures(insts, today);
    const teams = splits.map(s => loop.teams.get(s.teamId)!).filter(Boolean);
    const dues = insts.map(i => i.dueDate).sort();
    rows.push({
      id: a.id,
      description: a.description,
      createdAt: a.createdAt,
      teamIds: teams.map(t => t.id),
      teamNames: teams.map(t => t.name),
      teamsWord: teamsWord(teams, activeTeams),
      allocated: splitsAllocated(splits),
      figures,
      chip: clubBillChip(figures),
      firstDue: dues[0] ?? null,
      lastDue: dues[dues.length - 1] ?? null,
      installmentsPerTeam: Math.max(0, ...splits.map(s => s.installments.length)),
    });
  }
  return rows.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
}

// ── An allocation (the page and each team's bill) ──────────────────────────────────────────────

export interface BillInstallment {
  id: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  state: ClubInstallmentState;
  daysLate: number;
  received: null | { on: string; how: string | null; method: string | null; reference: string | null; recordedBy: string | null; recordedAt: string };
  sent: null | { on: string; how: string | null; method: string | null; reference: string | null; sentBy: string | null; sentAt: string };
  /** The club's last undo of a payment on this installment, with its reason. */
  undone: null | { at: string; by: string | null; reason: string };
}

export interface TeamBill {
  splitId: string;
  teamId: string;
  teamName: string;
  groupName: string | null;
  programYearId: string;
  headCoaches: string[];
  allocated: number;
  figures: ClubBillFigures;
  chip: ClubBillChip;
  /** "Needs you" = overdue, or a payment a coach says they've sent. */
  band: 'needs_you' | 'on_track';
  installments: BillInstallment[];
}

export async function allocationDetail(
  orgId: string,
  loop: ClubLoop,
  allocationId: string,
  today: string,
): Promise<{ allocation: LoopAllocation; allocated: number; figures: ClubBillFigures; teams: TeamBill[] } | null> {
  const allocation = loop.allocations.get(allocationId);
  const splits = loop.splits.filter(s => s.allocationId === allocationId);
  if (!allocation || splits.length === 0) return null;

  const all = splits.flatMap(s => s.installments);
  const [heads, nameOf] = await Promise.all([
    loadHeadCoaches(orgId, splits.map(s => s.teamId)),
    resolvePersonNamer(orgId, all.flatMap(i => [i.paidBy, i.sentBy, i.undoneBy])),
  ]);

  const teams: TeamBill[] = splits.map(s => {
    const team = loop.teams.get(s.teamId)!;
    const figures = clubBillFigures(s.installments, today);
    return {
      splitId: s.id,
      teamId: team.id,
      teamName: team.name,
      groupName: team.groupName,
      programYearId: s.programYearId,
      headCoaches: (heads.get(team.id)?.people ?? []).map(h => h.name ?? h.email).filter((n): n is string => !!n),
      allocated: s.amount,
      figures,
      chip: clubBillChip(figures),
      band: figures.overdue.count > 0 || figures.sent.count > 0 ? 'needs_you' : 'on_track',
      installments: s.installments.map(i => billInstallment(i, today, nameOf)),
    };
  });
  // The teams that need the club first, then the rest; each band by name.
  teams.sort((x, y) => (x.band === y.band ? x.teamName.localeCompare(y.teamName) : x.band === 'needs_you' ? -1 : 1));

  return { allocation, allocated: splitsAllocated(splits), figures: clubBillFigures(all, today), teams };
}

/**
 * THE FISCAL YEAR AN ALLOCATION COUNTS IN (Stage 3c's one rule, the one the database's `club_allocation_locked` holds):
 * its line's year; without a line, the year its first installment falls due in; with neither, the day it was made. With
 * the line's name — the allocation window's eyebrow reads both ("Diamond permits — city fields · 2026–27"). ONE place,
 * read by the window's GET and checked by its edit (Stage 3d), so the lock the screen shows is the lock the edit meets.
 */
export async function allocationYear(
  orgId: string,
  allocation: Pick<LoopAllocation, 'sourceBudgetLineId' | 'createdAt'>,
  firstDue: string | null,
  setting: FiscalSetting,
): Promise<{ year: FiscalYear; budgetLineName: string | null }> {
  let budgetLineName: string | null = null;
  let lineYearKey: string | null = null;
  if (allocation.sourceBudgetLineId) {
    const { data, error } = await supabaseAdmin.from('org_budget_lines').select('description, org_fiscal_years ( first_day )')
      .eq('id', allocation.sourceBudgetLineId).eq('org_id', orgId).maybeSingle();
    if (error) throw error;
    const line = data as { description?: string | null; org_fiscal_years?: { first_day?: string } | null } | null;
    budgetLineName = line?.description ?? null;
    lineYearKey = line?.org_fiscal_years?.first_day ?? null;
  }
  return { year: fiscalYearOf(lineYearKey ?? firstDue ?? orgDayKey(allocation.createdAt), setting), budgetLineName };
}

function billInstallment(i: RepAllocationInstallment, today: string, nameOf: (id: string | null) => string | null): BillInstallment {
  const receivedOn = clubInstallmentReceivedOn(i);
  return {
    id: i.id,
    installmentNumber: i.installmentNumber,
    amount: i.amount,
    dueDate: i.dueDate,
    state: clubInstallmentState(i, today),
    daysLate: clubInstallmentDaysLate(i, today),
    received: receivedOn && i.paidAt ? {
      on: receivedOn, how: howItCame(i.paidMethod, i.paidReference),
      method: i.paidMethod, reference: i.paidReference, recordedBy: nameOf(i.paidBy), recordedAt: i.paidAt,
    } : null,
    sent: i.sentAt && i.sentOn ? {
      on: i.sentOn, how: howItCame(i.sentMethod, i.sentReference), method: i.sentMethod,
      reference: i.sentReference, sentBy: nameOf(i.sentBy), sentAt: i.sentAt,
    } : null,
    undone: i.undoneAt && i.undoneReason ? { at: i.undoneAt, by: nameOf(i.undoneBy), reason: i.undoneReason } : null,
  };
}

// ── Coming due ─────────────────────────────────────────────────────────────────────────────────

export interface ComingDueGroup {
  /** 'later' = due after the window (the `later` list only). */
  band: ComingDueBand | 'later';
  allocationId: string;
  allocationDescription: string;
  installmentNumber: number;
  installmentCount: number;
  dueDate: string;
  daysLate: number;
  /** One entry per team on this installment in this band — the screen draws one row per team, or
   *  one row for every team when they share it. */
  teams: { teamId: string; teamName: string; splitId: string; installmentId: string; amount: number; sentOn: string | null; sentHow: string | null; sentBy: string | null }[];
  amount: number;
}

export interface ComingDue {
  bands: Record<ComingDueBand, { count: number; amount: number; groups: ComingDueGroup[] }>;
  /** What falls due AFTER the window ("Later this season", the screen's Show all) — upcoming, unsent. */
  later: { count: number; amount: number; groups: ComingDueGroup[] };
}

export function comingDue(loop: ClubLoop, today: string): ComingDue {
  const groups = new Map<string, ComingDueGroup>();
  for (const s of loop.splits) {
    const team = loop.teams.get(s.teamId)!;
    const a = loop.allocations.get(s.allocationId);
    for (const i of s.installments) {
      const band = comingDueBand(i, today) ?? (clubInstallmentState(i, today) === 'upcoming' ? 'later' as const : null);
      if (!band) continue;
      const key = `${band}|${s.allocationId}|${i.installmentNumber}|${i.dueDate}`;
      const g: ComingDueGroup = groups.get(key) ?? {
        band, allocationId: s.allocationId, allocationDescription: a?.description ?? 'Club allocation',
        installmentNumber: i.installmentNumber, installmentCount: s.installments.length, dueDate: i.dueDate,
        daysLate: clubInstallmentDaysLate(i, today), teams: [], amount: 0,
      };
      g.teams.push({
        teamId: team.id, teamName: team.name, splitId: s.id, installmentId: i.id, amount: i.amount,
        sentOn: i.sentOn, sentHow: howItCame(i.sentMethod, i.sentReference), sentBy: i.sentBy,
      });
      groups.set(key, g);
    }
  }
  const empty = () => ({ count: 0, amount: 0, groups: [] as ComingDueGroup[] });
  const bands: ComingDue['bands'] = { overdue: empty(), sent: empty(), due_soon: empty() };
  const later = empty();
  for (const g of groups.values()) {
    g.teams.sort((x, y) => x.teamName.localeCompare(y.teamName));
    g.amount = sumMoney(g.teams);
    if (g.band === 'later') later.groups.push(g);
    else bands[g.band].groups.push(g);
  }
  for (const b of [...Object.values(bands), later]) {
    b.groups.sort((x, y) => x.dueDate.localeCompare(y.dueDate) || x.allocationDescription.localeCompare(y.allocationDescription));
    b.count = b.groups.reduce((n, g) => n + g.teams.length, 0);
    b.amount = sumMoney(b.groups);
  }
  return { bands, later };
}

// ── The teams' accounts (Overview's "held by the teams", Rep Teams' "With the club") ──────────

export interface TeamWithTheClub {
  teamId: string;
  teamName: string;
  isArchived: boolean;
  outstanding: number;
  nextDue: { dueDate: string; amount: number } | null;
  overdue: { count: number; amount: number };
  sent: { count: number; amount: number };
  requestsWaiting: number;
}

export async function teamsWithTheClub(
  orgId: string,
  loop: ClubLoop,
  today: string,
  /** Waiting requests per team when the caller already read them. */
  waiting?: Map<string, number>,
): Promise<TeamWithTheClub[]> {
  const counts = waiting ?? await pendingRequestCounts(orgId, [...loop.teams.keys()]);
  const byTeam = new Map<string, RepAllocationInstallment[]>();
  for (const s of loop.splits) byTeam.set(s.teamId, [...(byTeam.get(s.teamId) ?? []), ...s.installments]);
  return [...loop.teams.values()]
    .filter(t => !t.isArchived || (byTeam.get(t.id)?.length ?? 0) > 0)
    .map(t => {
      const f = clubBillFigures(byTeam.get(t.id) ?? [], today);
      return {
        teamId: t.id, teamName: t.name, isArchived: t.isArchived,
        outstanding: f.outstanding, nextDue: f.nextDue, overdue: f.overdue, sent: f.sent,
        requestsWaiting: counts.get(t.id) ?? 0,
      };
    })
    .sort((x, y) => x.teamName.localeCompare(y.teamName));
}

async function pendingRequestCounts(orgId: string, teamIds: string[]): Promise<Map<string, number>> {
  const rows = await fetchAllIn<{ team_id: string }>(teamIds, (c, a, b) =>
    supabaseAdmin.from('rep_team_payment_requests').select('team_id')
      .eq('org_id', orgId).eq('status', 'pending').in('team_id', c).order('id').range(a, b));
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.team_id, (out.get(r.team_id) ?? 0) + 1);
  return out;
}

/** One team's line on Rep Teams' team page: what it owes the club, next due, and whether a request waits. */
export async function withTheClub(orgId: string, teamId: string, today: string = tournamentToday()): Promise<TeamWithTheClub | null> {
  const loop = await loadClubLoop(orgId, new Set([teamId]), { teamId });
  const rows = await teamsWithTheClub(orgId, loop, today);
  return rows[0] ?? null;
}

/** A team's account with the club (Ask 5a): the statement, its seasons, and the header figures. */
export async function teamAccountRead(
  orgId: string,
  teamId: string,
  today: string = tournamentToday(),
): Promise<{ account: TeamAccount; seasons: { id: string; name: string; status: string }[]; withTheClub: TeamWithTheClub | null }> {
  const [loop, { data: pyRows, error: pyErr }, reqRows] = await Promise.all([
    loadClubLoop(orgId, new Set([teamId]), { teamId }),
    supabaseAdmin.from('rep_program_years').select('id, name, status, year, created_at')
      .eq('team_id', teamId).eq('org_id', orgId).order('year', { ascending: false }).order('created_at', { ascending: false }),
    fetchAll<Record<string, any>>((a, b) =>
      supabaseAdmin.from('rep_team_payment_requests').select('*')
        .eq('org_id', orgId).eq('team_id', teamId).order('created_at').order('id').range(a, b)),
  ]);
  if (pyErr) throw pyErr;
  const seasons = (pyRows ?? []).map(p => ({ id: p.id as string, name: p.name as string, status: p.status as string }));

  const bills: AccountBill[] = loop.splits.map(s => ({
    splitId: s.id,
    allocationId: s.allocationId,
    allocationDescription: loop.allocations.get(s.allocationId)?.description ?? 'Club allocation',
    programYearId: s.programYearId,
    billedOn: orgDayKey(loop.allocations.get(s.allocationId)?.createdAt ?? null),
    amount: s.amount,
    installments: s.installments,
  }));
  const requests: AccountRequest[] = reqRows.map(r => ({
    id: r.id, programYearId: r.program_year_id, requestType: r.request_type, status: r.status,
    amount: Number(r.amount), description: r.description,
    decidedOn: r.status === 'approved' ? (r.paid_on ?? (r.reviewed_at ? orgDayKey(r.reviewed_at) : null)) : null,
    paidMethod: methodWord(r.paid_method) ?? r.payment_method ?? null,
    moneyInMeaning: r.money_in_meaning ?? null,
  }));
  const computed = teamAccount(bills, requests, seasons.map(s => s.id), today);
  const waiting = new Map([[teamId, reqRows.filter(r => r.status === 'pending').length]]);
  // The statement prints WHO recorded a payment (C17): names, never ids, on the way out.
  const [rows, nameOf] = await Promise.all([
    teamsWithTheClub(orgId, loop, today, waiting),
    resolvePersonNamer(orgId, computed.seasons.flatMap(s => s.rows.map(r => r.recordedBy ?? null))),
  ]);
  const account: TeamAccount = {
    ...computed,
    seasons: computed.seasons.map(s => ({ ...s, rows: s.rows.map(r => (r.recordedBy ? { ...r, recordedBy: nameOf(r.recordedBy) } : r)) })),
  };
  return { account, seasons, withTheClub: rows[0] ?? null };
}

// ── Payment requests ───────────────────────────────────────────────────────────────────────────

export interface ClubRequestRow extends ClubRequest {
  /** The team's id — the Payment requests tab's Team filter and a request's door to the team. */
  teamId: string;
  teamName: string;
  askedBy: string | null;
  decidedBy: string | null;
  reversedByName: string | null;
  /** Whole days the request has waited (a waiting one), else null. */
  waitingDays: number | null;
  /** The club's answer is the one thing between the team and its end-of-season payout (Ask 5b). */
  holdingPayout: boolean;
  /** The fiscal year it was FILED in (Stage 3c, call 4 — the club's day): a waiting request from a closed year is
   *  listed under "From 2025–26, still open" until it is decided. */
  filedIn: { key: string; name: string };
  /** An approval whose lines sit in a CLOSED fiscal year (Stage 3c, Ask 8d): Reverse is not offered — to reverse
   *  it, reopen the year. */
  locked: boolean;
}

/**
 * The club's payment requests, waiting first. `holdingPayout` is the coach's own close-out rule
 * (`closeOutBlockers` → `clubRequestsHoldPayout`), computed from the team's settlement for the
 * request's season — shared, not re-derived. The row carries KEYS (direction, decision, Filed as);
 * the screen words them (`REQUEST_DIRECTION_WORD`, `requestStatusWord`, `clubMoneyInWord`).
 */
export async function clubRequests(
  orgId: string,
  scope: Set<string> | null,
  opts: { teamId?: string; requestId?: string } = {},
  today: string = tournamentToday(),
): Promise<ClubRequestRow[]> {
  const rows = await fetchAll<Record<string, any>>((a, b) => {
    let q = supabaseAdmin.from('rep_team_payment_requests')
      .select('*, rep_teams ( name, group_id ), budget_items ( name ), budget_categories ( name )')
      .eq('org_id', orgId).order('created_at').order('id');
    if (opts.teamId) q = q.eq('team_id', opts.teamId);
    if (opts.requestId) q = q.eq('id', opts.requestId);
    return q.range(a, b);
  });
  const visible = rows.filter(r => !scope || scope.has(r.team_id));

  const [nameOf, holding, setting] = await Promise.all([
    resolvePersonNamer(orgId, visible.flatMap(r => [r.created_by, r.reviewed_by, r.reversed_by])),
    seasonsHoldingPayout(visible.filter(r => r.status === 'pending').map(r => r.program_year_id)),
    loadFiscalSetting(orgId),
  ]);
  const through = closedThrough(setting);

  return visible.map(r => {
    const pending = r.status === 'pending';
    return {
      ...mapClubRequest(r, { item: r.budget_items?.name ?? null, category: r.budget_categories?.name ?? null }),
      teamId: r.team_id as string,
      teamName: r.rep_teams?.name ?? 'A team',
      askedBy: nameOf(r.created_by),
      decidedBy: nameOf(r.reviewed_by),
      reversedByName: nameOf(r.reversed_by),
      waitingDays: pending ? Math.max(0, daysBetweenDateStrings(orgDayKey(r.created_at), today)) : null,
      holdingPayout: pending && holding.has(r.program_year_id),
      filedIn: (y => ({ key: y.key, name: y.name }))(fiscalYearOf(orgDayKey(r.created_at), setting)),
      locked: r.status === 'approved' && through !== null && !!r.paid_on && r.paid_on <= through,
    };
  });
}

/**
 * The seasons (program-year ids) whose end-of-season payout is held ONLY by waiting club requests —
 * the coach's own `closeOutBlockers`, read through `clubRequestsHoldPayout` (shared, not re-derived).
 * One settlement read per season with a waiting request, a few at a time; a season that can't be read
 * is left out (logged), never guessed in.
 */
export async function seasonsHoldingPayout(programYearIds: readonly string[]): Promise<Set<string>> {
  const ids = [...new Set(programYearIds)];
  const held = await inParallel(ids, 4, async pyId => {
    try {
      const programYear = await getRepProgramYear(pyId);
      if (!programYear) return false;
      const sheet = await loadSeasonSettlement({ programYear, capabilities: resolveCoachCapabilities('head_coach', null) });
      return clubRequestsHoldPayout(closeOutBlockers(sheet));
    } catch (e) {
      console.error('[club-money-reads] could not read a season’s settlement for its held payout:', e);
      return false;
    }
  });
  return new Set(ids.filter((_, i) => held[i]));
}

/** The brief's installment counts, by the one definition: Coming due's overdue and due-soon bands,
 *  and the payments coaches say they've sent. Reads only the club's unreceived installments. */
export async function briefMoneyCounts(orgId: string, teamIds: string[], today: string): Promise<{
  installmentsDue: number; installmentsSent: number; installmentsOverdue: number;
}> {
  const open = await fetchAllIn<Record<string, any>>(teamIds, (c, a, b) =>
    supabaseAdmin.from('rep_allocation_installments')
      .select('id, amount, due_date, paid_at, sent_at, rep_allocation_splits!inner ( team_id )')
      .eq('org_id', orgId).is('paid_at', null).in('rep_allocation_splits.team_id', c).order('id').range(a, b));
  const f = clubBillFigures(open.map(r => ({
    amount: Number(r.amount), dueDate: r.due_date, paidAt: r.paid_at, sentAt: r.sent_at,
  })), today);
  return { installmentsDue: f.overdue.count + f.dueSoon.count, installmentsSent: f.sent.count, installmentsOverdue: f.overdue.count };
}

/**
 * What a team still owes the club in ONE season, and the requests waiting on the club — the counts
 * the club's close / roll window adds beside families' dues (Ask 5b, S3A-03). It WARNS and never
 * blocks (owner, 2026-08-17). `installments` = not yet received (a sent one included: the club does
 * not have it); `sent` = how many of those a coach says are on the way.
 */
export async function seasonOwedToClub(orgId: string, teamId: string, programYearId: string, today: string = tournamentToday()): Promise<{
  installments: number; amount: number; sent: number; requestsWaiting: number;
}> {
  const [loop, { count, error }] = await Promise.all([
    loadClubLoop(orgId, new Set([teamId]), { teamId }),
    supabaseAdmin.from('rep_team_payment_requests').select('id', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('team_id', teamId).eq('program_year_id', programYearId).eq('status', 'pending'),
  ]);
  if (error) throw error;
  const f = clubBillFigures(loop.splits.filter(s => s.programYearId === programYearId).flatMap(s => s.installments), today);
  return {
    installments: f.installmentCount - f.receivedCount,
    amount: f.outstanding,
    sent: f.sent.count,
    requestsWaiting: count ?? 0,
  };
}
