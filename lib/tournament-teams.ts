/**
 * TEAMS' MODEL — the plain facts behind the Teams screen (Tournament admin redesign Stage 2): what a team
 * owes, how the list is banded, and the order the record's Previous / Next walks. No React, so the unit
 * suite holds the order the organizer steps through (tests/unit/teams-model.test.ts).
 */
import { formatPoolName } from './utils';
import { formatStoredDate } from './timezone';
import type { Division } from './types';
import { TEAMS_WORDS, TEAM_RECORD_WORDS } from './registration-words';

export type Status = 'pending' | 'accepted' | 'rejected' | 'waitlist';
export type PaymentStatus = 'paid' | 'deposit-paid' | 'pending' | 'past-due' | 'no-schedule';
export type FeeMode = 'tournament' | 'division';

export interface TeamRecord {
  id: string;
  name: string;
  coach: string;
  email: string;
  /** Optional coach contact override (teams.coach_email). When set, coach-facing
   *  organizer emails route here instead of the registration `email`. */
  coach_email?: string | null;
  division_id: string;
  division_name: string;
  status: Status;
  paymentStatus: 'pending' | 'paid';
  depositPaid: number;
  totalPaid: number;
  registered_at: string;
  poolId?: string;
  adminNotes?: string;
  slotId?: string | null;
  waitlistPosition?: number | null;
  seed?: number | null;
  customAnswers?: Array<{ fieldId: string; label: string; fieldType: string; value: string }>;
}

export interface PoolSlot {
  id: string;
  poolId: string;
  divisionId: string;
  slotNumber: number;
  displayName: string;
  teamId: string | null;
  teamName: string | null;
}

export interface FeeSchedule {
  depositAmount: number | null;
  depositDueDate: string | null;
  totalFeeAmount: number | null;
  totalFeeDueDate: string | null;
}

export type PoolInfo = { id: string; name: string; display_order?: number | null };

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value);
}

export function getEffectiveFee(team: Pick<TeamRecord, 'division_id'>, divisions: Division[], feeMode: FeeMode, feeSchedule: FeeSchedule): FeeSchedule {
  const agFee = divisions.find(g => g.id === team.division_id);
  if (feeMode === 'division' && agFee?.totalFeeAmount != null) {
    return {
      depositAmount: agFee.depositAmount ?? null,
      depositDueDate: agFee.depositDueDate ?? null,
      totalFeeAmount: agFee.totalFeeAmount ?? null,
      totalFeeDueDate: agFee.totalFeeDueDate ?? null,
    };
  }
  return feeSchedule;
}

export function hasDepositStep(fee: FeeSchedule): boolean {
  return Boolean(fee.depositAmount && fee.totalFeeAmount && fee.depositAmount < fee.totalFeeAmount);
}

export function computePaymentStatus(team: Pick<TeamRecord, 'depositPaid' | 'totalPaid'>, fee: FeeSchedule, today: string): PaymentStatus {
  const { depositAmount, depositDueDate, totalFeeAmount, totalFeeDueDate } = fee;
  if (!totalFeeAmount) return 'no-schedule';
  if (team.totalPaid >= totalFeeAmount) return 'paid';
  if (totalFeeDueDate && today > totalFeeDueDate) return 'past-due';
  if (depositAmount && depositDueDate && today > depositDueDate && team.depositPaid < depositAmount) return 'past-due';
  if (depositAmount && team.depositPaid >= depositAmount) return 'deposit-paid';
  return 'pending';
}

/** What the team still owes against its fee (0 with no schedule). */
export function owedAmount(team: Pick<TeamRecord, 'totalPaid'>, fee: FeeSchedule): number {
  return fee.totalFeeAmount ? Math.max(fee.totalFeeAmount - team.totalPaid, 0) : 0;
}

/**
 * A row's payment fact, in Check-in's words (T5): "Paid" plain, "Owes $475" in the amber of money
 * owed, "Unpaid" (amber) with no fee schedule. Only an ACCEPTED team pays; anything else says nothing.
 */
export function paymentFact(team: TeamRecord, fee: FeeSchedule): { text: string; owes: boolean } | null {
  if (team.status !== 'accepted') return null;
  if (fee.totalFeeAmount) {
    const owed = owedAmount(team, fee);
    return owed > 0 ? { text: TEAMS_WORDS.owes(formatMoney(owed)), owes: true } : { text: TEAMS_WORDS.paid, owes: false };
  }
  return team.paymentStatus === 'paid' ? { text: TEAMS_WORDS.paid, owes: false } : { text: TEAMS_WORDS.unpaid, owes: true };
}

const shortDate = (d: string) => formatStoredDate(d, { withYear: false });

/**
 * The record's payment line — facts, not narration (D10): "Owes $475 · deposit due May 28 · balance
 * due Jun 7 · past due". `lead` is the owed/paid fact (amber when owed); `rest` the dates and state.
 * Null with no fee schedule (the record then offers Mark paid / Mark unpaid on its own).
 */
export function paymentLine(team: TeamRecord, fee: FeeSchedule, today: string): { lead: string; owes: boolean; rest: string[] } | null {
  if (!fee.totalFeeAmount) return null;
  const owed = owedAmount(team, fee);
  if (owed <= 0) return { lead: TEAM_RECORD_WORDS.paidInFull(formatMoney(fee.totalFeeAmount)), owes: false, rest: [] };
  const rest: string[] = [];
  if (hasDepositStep(fee)) {
    const depositIn = team.depositPaid >= (fee.depositAmount ?? 0);
    if (depositIn) rest.push(TEAM_RECORD_WORDS.depositPaid);
    else if (fee.depositDueDate) rest.push(TEAM_RECORD_WORDS.depositDue(shortDate(fee.depositDueDate)));
    if (fee.totalFeeDueDate) rest.push(TEAM_RECORD_WORDS.balanceDue(shortDate(fee.totalFeeDueDate)));
  } else if (fee.totalFeeDueDate) {
    rest.push(TEAM_RECORD_WORDS.due(shortDate(fee.totalFeeDueDate)));
  }
  if (computePaymentStatus(team, fee, today) === 'past-due') rest.push(TEAM_RECORD_WORDS.pastDue);
  return { lead: TEAM_RECORD_WORDS.owes(formatMoney(owed)), owes: true, rest };
}

// ─── The list's bands ──────────────────────────────────────────────────────────────────────────────

export type TeamRowItem =
  | { kind: 'team'; team: TeamRecord; slot: PoolSlot | null }
  | { kind: 'empty'; slot: PoolSlot };

export type BandKind = 'review' | 'pool' | 'waitlist' | 'unplaced' | 'accepted' | 'rejected' | 'nopool';

export interface TeamBand {
  key: string;
  kind: BandKind;
  label: string;
  /** The band's one figure: "3 of 3" for a pool of slots, a count elsewhere. */
  count: string;
  rows: TeamRowItem[];
}

const byRegistered = (a: TeamRecord, b: TeamRecord) =>
  new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime();
const byWaitlist = (a: TeamRecord, b: TeamRecord) =>
  (a.waitlistPosition ?? Number.MAX_SAFE_INTEGER) - (b.waitlistPosition ?? Number.MAX_SAFE_INTEGER) || byRegistered(a, b);
const teamRows = (teams: TeamRecord[]): TeamRowItem[] => teams.map(team => ({ kind: 'team', team, slot: null }));

export function sortedPools(pools: PoolInfo[] | null | undefined): PoolInfo[] {
  return (pools ?? []).slice().sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
}

/**
 * A division WITH pool slots (the slot board, T4): To review (a team waiting for a decision that holds
 * no spot — one that holds a spot stays on its spot's row with its chip, owner P2), a band per pool
 * with its fill and every slot (an open one is a row too: a swap can move a team into it), the
 * Waitlist, and "Accepted — needs a spot". A rejected team is not on the board (as today).
 * Bands are statuses, never computed from a stale waitlist number: a team is on the waitlist when its
 * STATUS says so.
 */
export function buildSlotBands({ divRegs, pools, poolSlots }: {
  divRegs: TeamRecord[];
  pools: PoolInfo[] | null | undefined;
  poolSlots: PoolSlot[];
}): TeamBand[] {
  const byId = new Map(divRegs.map(t => [t.id, t]));
  // Placed = on a slot the board DRAWS. A slot whose pool is missing from the read (one deleted between
  // the two reads) would otherwise hide its team from every band.
  const drawn = new Set((pools ?? []).map(p => p.id));
  const placed = new Set(poolSlots.filter(s => drawn.has(s.poolId)).map(s => s.teamId).filter((id): id is string => !!id && byId.has(id)));
  const bands: TeamBand[] = [];

  const review = divRegs.filter(t => t.status === 'pending' && !placed.has(t.id)).sort(byRegistered);
  if (review.length > 0) bands.push({ key: 'review', kind: 'review', label: TEAMS_WORDS.toReview, count: String(review.length), rows: teamRows(review) });

  for (const pool of sortedPools(pools)) {
    const slots = poolSlots.filter(s => s.poolId === pool.id).sort((a, b) => a.slotNumber - b.slotNumber);
    if (slots.length === 0) continue;
    const rows: TeamRowItem[] = slots.map(slot => {
      const team = slot.teamId ? byId.get(slot.teamId) : undefined;
      return team ? { kind: 'team', team, slot } : { kind: 'empty', slot };
    });
    const filled = rows.filter(r => r.kind === 'team').length;
    bands.push({ key: `pool-${pool.id}`, kind: 'pool', label: formatPoolName(pool.name), count: TEAMS_WORDS.poolFill(filled, slots.length), rows });
  }

  const waitlist = divRegs.filter(t => t.status === 'waitlist' && !placed.has(t.id)).sort(byWaitlist);
  if (waitlist.length > 0) bands.push({ key: 'waitlist', kind: 'waitlist', label: TEAMS_WORDS.waitlist, count: String(waitlist.length), rows: teamRows(waitlist) });

  const unplaced = divRegs.filter(t => t.status === 'accepted' && !placed.has(t.id)).sort(byRegistered);
  if (unplaced.length > 0) bands.push({ key: 'unplaced', kind: 'unplaced', label: TEAMS_WORDS.needsSpot, count: String(unplaced.length), rows: teamRows(unplaced) });

  return bands;
}

/**
 * A division WITHOUT pool slots (T6), from the teams the view lets through. By status — To review ·
 * Accepted · Waitlist · Rejected (only when chosen in the view) — or, where the division has pools and
 * the Pools grouping is chosen, To review then "No pool yet" and a band per pool.
 */
export function buildListBands({ teams, grouping, pools }: {
  teams: TeamRecord[];
  grouping: 'status' | 'pools';
  pools: PoolInfo[] | null | undefined;
}): TeamBand[] {
  const bands: TeamBand[] = [];
  const review = teams.filter(t => t.status === 'pending').sort(byRegistered);
  if (review.length > 0) bands.push({ key: 'review', kind: 'review', label: TEAMS_WORDS.toReview, count: String(review.length), rows: teamRows(review) });
  const decided = teams.filter(t => t.status !== 'pending');

  const poolList = sortedPools(pools);
  if (grouping === 'pools' && poolList.length > 0) {
    const poolIds = new Set(poolList.map(p => p.id));
    const noPool = decided.filter(t => !t.poolId || !poolIds.has(t.poolId)).sort(byRegistered);
    if (noPool.length > 0) bands.push({ key: 'nopool', kind: 'nopool', label: TEAMS_WORDS.noPoolYet, count: String(noPool.length), rows: teamRows(noPool) });
    for (const pool of poolList) {
      const inPool = decided.filter(t => t.poolId === pool.id).sort(byRegistered);
      bands.push({ key: `pool-${pool.id}`, kind: 'pool', label: formatPoolName(pool.name), count: String(inPool.length), rows: teamRows(inPool) });
    }
    return bands;
  }

  const accepted = decided.filter(t => t.status === 'accepted').sort(byRegistered);
  if (accepted.length > 0) bands.push({ key: 'accepted', kind: 'accepted', label: TEAMS_WORDS.accepted, count: String(accepted.length), rows: teamRows(accepted) });
  const waitlist = decided.filter(t => t.status === 'waitlist').sort(byWaitlist);
  if (waitlist.length > 0) bands.push({ key: 'waitlist', kind: 'waitlist', label: TEAMS_WORDS.waitlist, count: String(waitlist.length), rows: teamRows(waitlist) });
  const rejected = decided.filter(t => t.status === 'rejected').sort(byRegistered);
  if (rejected.length > 0) bands.push({ key: 'rejected', kind: 'rejected', label: TEAMS_WORDS.rejected, count: String(rejected.length), rows: teamRows(rejected) });
  return bands;
}

/**
 * A slot board narrowed by a search, a filter or a dashboard bucket (the Teams toolbar ruling, owner
 * 2026-10-01: a board offers search and filters like every division). The matches keep the board's
 * own bands — a team on a spot stays under its pool, with the band counting its matches — and the open
 * spots go, since an open spot matches nothing. A rejected team is never on the board, so one the
 * Status filter asks for gets its own band at the end.
 */
export function narrowSlotBands(board: TeamBand[], matches: TeamRecord[]): TeamBand[] {
  const ids = new Set(matches.map(t => t.id));
  const bands: TeamBand[] = [];
  const shown = new Set<string>();
  for (const band of board) {
    const rows = band.rows.filter(r => r.kind === 'team' && ids.has(r.team.id));
    if (rows.length === 0) continue;
    for (const r of rows) if (r.kind === 'team') shown.add(r.team.id);
    bands.push({ ...band, count: String(rows.length), rows });
  }
  const rejected = matches.filter(t => t.status === 'rejected' && !shown.has(t.id)).sort(byRegistered);
  if (rejected.length > 0) bands.push({ key: 'rejected', kind: 'rejected', label: TEAMS_WORDS.rejected, count: String(rejected.length), rows: teamRows(rejected) });
  return bands;
}

/** The order the record's Previous / Next walks: the list's own, band by band (the review band, then
 *  the pools, then the waitlist) — the teams only, never an open spot. */
export function recordOrder(bands: TeamBand[]): TeamRecord[] {
  return bands.flatMap(b => b.rows.flatMap(r => (r.kind === 'team' ? [r.team] : [])));
}

/** The first spot a team accepted now would take (claimNextOpenSlot's order: pool, then slot number). */
export function nextOpenSlot(pools: PoolInfo[] | null | undefined, poolSlots: PoolSlot[]): PoolSlot | null {
  for (const pool of sortedPools(pools)) {
    const open = poolSlots.filter(s => s.poolId === pool.id && !s.teamId).sort((a, b) => a.slotNumber - b.slotNumber);
    if (open[0]) return open[0];
  }
  return null;
}
