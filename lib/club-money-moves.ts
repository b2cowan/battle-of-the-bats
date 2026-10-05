import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { repGroupScopeGuard, type AuthContextWithRole } from './api-auth';
import { isCalendarDate } from './timezone';
import { moneyMovedMaxDate } from './money-date-guards';
import { getRepAllocationInstallment, getRepTeam, mapRepAllocationInstallment } from './db';
import { mapClubRequest, type ClubRequest } from './coach-club-money';
import {
  CLUB_LOOP_CATEGORY, CLUB_MONEY_NOTICE, TRANSFER_VOID_REFUSAL, UNLINKED_APPROVAL, UNLINKED_PAYMENT,
  clubInstallmentRefusal, clubUndoRefusal, coachInstallmentRefusal, howItCame, installmentLineWords, isClubMoneyMethod,
  methodWord, requestCategory, requestLineWords, requestRefusal, type InstallmentStateWord,
} from './club-money-words';
import { clubMoneyLinks, tellClubAccounting, tellTeamMoneyPeople } from './club-money-notify';
import { refused, type Moved, type Refused } from './club-money-route';
import type { DuesPaymentMethod, Organization, RepAllocationInstallment } from './types';

export type { Moved, Refused };

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * EVERY CLUB MONEY MOVE, ONE STEP EACH (Club Tier Stage 3a; C07, J4-013, S3A-01, Asks 1 and 3).
 *
 * Each club move is ONE database function (mig 315) that locks its row, refuses unless the state is
 * still the one the caller saw, and writes the state change and both ledger lines in a single
 * transaction — so a double submit leaves one pair of lines, and a step that fails leaves none.
 * This module decides nothing the database does not re-decide; it validates the input, composes the
 * words (lib/club-money-words.ts), maps a refusal to one coded response, and tells the other side.
 *
 * The coach's two moves (sent, take it back) write NO ledger line, so each is one conditional
 * UPDATE whose WHERE re-asserts the state (memory: check-then-act) — zero rows means somebody got
 * there first, and the answer says what changed and who can fix it.
 *
 * Who may call: the routes gate on `resolveClubMoney` (club, `canMoveClubMoney`) or on the coach's
 * live seat with money write access. Every club move here ALSO checks the member's team-group limit
 * (B11), so a route cannot forget it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const notFound = () => refused(404, { error: 'Not found' });

// ── Input ──────────────────────────────────────────────────────────────────────────────────────

/**
 * The day money moved, in the club's day. It cannot be in the future (money that has not moved is
 * not recorded — `moneyMovedMaxDate`, every money door's cap) and a missing one means today. A string
 * that is not a real calendar date refuses.
 */
export function readMoveDay(v: unknown): Moved<{ value: string }> {
  const today = moneyMovedMaxDate();
  if (v === undefined || v === null || v === '') return { ok: true, value: today };
  if (typeof v !== 'string' || !isCalendarDate(v) || v < '2000-01-01') {
    return refused(400, { error: 'Enter the day as a date.', code: 'bad_day' });
  }
  if (v > today) return refused(400, { error: 'That day hasn’t happened yet.', code: 'future_day' });
  return { ok: true, value: v };
}

/** How it was paid — one of the product's methods, or none. */
export function readMethod(v: unknown): Moved<{ value: DuesPaymentMethod | null }> {
  if (v === undefined || v === null || v === '') return { ok: true, value: null };
  if (!isClubMoneyMethod(v)) return refused(400, { error: 'Choose how it was paid.', code: 'bad_method' });
  return { ok: true, value: v };
}

export function readReference(v: unknown): Moved<{ value: string | null }> {
  if (v === undefined || v === null) return { ok: true, value: null };
  if (typeof v !== 'string') return refused(400, { error: 'The reference must be text.', code: 'bad_reference' });
  const t = v.trim();
  if (t.length > 100) return refused(400, { error: 'Keep the reference to 100 characters.', code: 'bad_reference' });
  return { ok: true, value: t || null };
}

/** A reason is required for every move that takes money back (Ask 3), and for a decline. */
export function readReason(v: unknown): Moved<{ value: string }> {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t) return refused(400, { error: 'Give a reason. The coach reads it.', code: 'reason_required' });
  if (t.length > 500) return refused(400, { error: 'Keep the reason to 500 characters.', code: 'bad_reason' });
  return { ok: true, value: t };
}

/** The day, the method and the reference a money move records — read together, refused together. */
function readMoveInput(p: { on: unknown; method: unknown; reference: unknown }): Moved<{
  on: string; method: DuesPaymentMethod | null; reference: string | null;
}> {
  const on = readMoveDay(p.on); if (!on.ok) return on;
  const method = readMethod(p.method); if (!method.ok) return method;
  const reference = readReference(p.reference); if (!reference.ok) return reference;
  return { ok: true, on: on.value, method: method.value, reference: reference.value };
}

// ── Loading ────────────────────────────────────────────────────────────────────────────────────

interface InstallmentContext {
  installment: RepAllocationInstallment;
  splitId: string;
  allocationId: string;
  allocation: string;
  count: number;
  team: { id: string; name: string; groupId: string | null };
}

async function loadInstallmentContext(orgId: string, installmentId: string): Promise<InstallmentContext | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_allocation_installments')
    .select('*, rep_allocation_splits ( id, team_id, allocation_id, org_id, rep_cost_allocations ( description ) )')
    .eq('id', installmentId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const split = (data as Record<string, any>).rep_allocation_splits as {
    id: string; team_id: string; allocation_id: string; org_id: string;
    rep_cost_allocations: { description: string } | null;
  } | null;
  if (!split || split.org_id !== orgId) return null;
  const [team, countRes] = await Promise.all([
    getRepTeam(split.team_id),
    supabaseAdmin.from('rep_allocation_installments').select('id', { count: 'exact', head: true }).eq('split_id', split.id),
  ]);
  if (!team || team.orgId !== orgId) return null;
  return {
    installment: mapRepAllocationInstallment(data),
    splitId: split.id,
    allocationId: split.allocation_id,
    allocation: split.rep_cost_allocations?.description ?? 'Club allocation',
    count: countRes.count ?? 1,
    team: { id: team.id, name: team.name, groupId: team.groupId ?? null },
  };
}

/** A member limited to some groups acting on a team outside them (B11). */
function outsideGroups(ctx: AuthContextWithRole, groupId: string | null): Refused | null {
  return repGroupScopeGuard(ctx, groupId) ? refused(403, { error: 'Forbidden' }) : null;
}

/** The installment a club move addresses: this club's, on the bill the address names, inside the member's groups. */
async function installmentFor(ctx: AuthContextWithRole, p: {
  installmentId: string; allocationId?: string; splitId?: string;
}): Promise<Moved<{ c: InstallmentContext }>> {
  const c = await loadInstallmentContext(ctx.org.id, p.installmentId);
  if (!c) return notFound();
  if ((p.allocationId && p.allocationId !== c.allocationId) || (p.splitId && p.splitId !== c.splitId)) return notFound();
  return outsideGroups(ctx, c.team.groupId) ?? { ok: true, c };
}

interface RequestContext {
  row: Record<string, any>;
  team: { id: string; name: string; groupId: string | null };
}

/** The request a club move addresses: this club's, inside the member's groups. */
async function requestFor(ctx: AuthContextWithRole, requestId: string): Promise<Moved<{ c: RequestContext }>> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_payment_requests').select('*').eq('id', requestId).eq('org_id', ctx.org.id).maybeSingle();
  if (error) throw error;
  if (!data) return notFound();
  const team = await getRepTeam(data.team_id);
  if (!team || team.orgId !== ctx.org.id) return notFound();
  const c = { row: data, team: { id: team.id, name: team.name, groupId: team.groupId ?? null } };
  return outsideGroups(ctx, c.team.groupId) ?? { ok: true, c };
}

async function rereadRequest(id: string): Promise<ClubRequest | null> {
  const { data, error } = await supabaseAdmin.from('rep_team_payment_requests').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapClubRequest(data) : null;
}

const stateOf = (i: Pick<RepAllocationInstallment, 'paidAt' | 'sentAt'>): InstallmentStateWord =>
  i.paidAt ? 'received' : i.sentAt ? 'sent' : 'unpaid';

const whatInstallment = (c: InstallmentContext) =>
  `${c.allocation}${c.count > 1 ? `, ${c.installment.installmentNumber} of ${c.count}` : ''}`;

type RpcResult = { ok: boolean; code?: string; state?: string; entryId?: string; voided?: string[] };

async function rpc(fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  const { data, error } = await supabaseAdmin.rpc(fn, args);
  if (error) throw error;
  return data as RpcResult;
}

// ── The club's moves ───────────────────────────────────────────────────────────────────────────

/**
 * Record an installment received (`expect: 'unpaid'`) or confirm a coach's "sent" (`expect: 'sent'`).
 * The one moment the club's ledger is written for an installment (Ask 1).
 */
export async function clubReceiveInstallment(ctx: AuthContextWithRole, p: {
  installmentId: string;
  expect: 'unpaid' | 'sent';
  on: unknown;
  method: unknown;
  reference: unknown;
  /** When the route's address names them, they must match (an id from another bill is a 404). */
  allocationId?: string;
  splitId?: string;
}): Promise<Moved<{ installment: RepAllocationInstallment }>> {
  const input = readMoveInput(p); if (!input.ok) return input;
  const found = await installmentFor(ctx, p); if (!found.ok) return found;
  const { c } = found;

  const words = installmentLineWords({
    teamName: c.team.name, orgName: ctx.org.name, allocation: c.allocation,
    number: c.installment.installmentNumber, of: c.count,
  });
  const r = await rpc('club_installment_receive', {
    p_installment: c.installment.id, p_org: ctx.org.id, p_actor: ctx.user.id, p_expect: p.expect,
    p_on: input.on, p_method: input.method, p_method_word: methodWord(input.method), p_reference: input.reference,
    p_club_words: words.club, p_team_words: words.team, p_category: CLUB_LOOP_CATEGORY.allocation,
  });
  if (!r.ok) {
    return r.code === 'state_changed'
      ? refused(409, clubInstallmentRefusal(r.state as InstallmentStateWord, c.team.name))
      : notFound();
  }

  const [, installment] = await Promise.all([
    tellTeamMoneyPeople({
      org: ctx.org, teamId: c.team.id, actorUserId: ctx.user.id, event: 'club_money_received',
      ...CLUB_MONEY_NOTICE.received({ orgName: ctx.org.name, teamName: c.team.name, amount: c.installment.amount, what: whatInstallment(c) }),
      metadata: { installmentId: c.installment.id, splitId: c.splitId },
    }),
    getRepAllocationInstallment(c.installment.id),
  ]);
  return { ok: true, installment: installment! };
}

/** Undo a recorded payment: both lines voided with the reason; the installment is unpaid again. */
export async function clubUndoInstallment(ctx: AuthContextWithRole, p: {
  installmentId: string; reason: unknown; allocationId?: string; splitId?: string;
}): Promise<Moved<{ installment: RepAllocationInstallment }>> {
  const reason = readReason(p.reason); if (!reason.ok) return reason;
  const found = await installmentFor(ctx, p); if (!found.ok) return found;
  const { c } = found;

  const r = await rpc('club_installment_undo', {
    p_installment: c.installment.id, p_org: ctx.org.id, p_actor: ctx.user.id, p_reason: reason.value,
  });
  if (!r.ok) {
    if (r.code === 'unlinked') return refused(409, { error: UNLINKED_PAYMENT, code: 'unlinked' });
    if (r.code === 'state_changed') return refused(409, clubUndoRefusal(r.state ?? 'unpaid'));
    return notFound();
  }

  const [, installment] = await Promise.all([
    tellTeamMoneyPeople({
      org: ctx.org, teamId: c.team.id, actorUserId: ctx.user.id, event: 'club_money_undone',
      ...CLUB_MONEY_NOTICE.undone({ orgName: ctx.org.name, teamName: c.team.name, amount: c.installment.amount, what: whatInstallment(c), reason: reason.value }),
      metadata: { installmentId: c.installment.id, splitId: c.splitId },
    }),
    getRepAllocationInstallment(c.installment.id),
  ]);
  return { ok: true, installment: installment! };
}

/** Approve a waiting request: the transfer and the decision in one step, the entry link kept. */
export async function clubApproveRequest(ctx: AuthContextWithRole, p: {
  requestId: string; on: unknown; method: unknown; reference: unknown;
}): Promise<Moved<{ request: ClubRequest }>> {
  const input = readMoveInput(p); if (!input.ok) return input;
  const found = await requestFor(ctx, p.requestId); if (!found.ok) return found;
  const { c } = found;

  const words = requestLineWords({
    teamName: c.team.name, orgName: ctx.org.name, description: c.row.description, requestType: c.row.request_type,
  });
  const r = await rpc('club_request_approve', {
    p_request: c.row.id, p_org: ctx.org.id, p_actor: ctx.user.id, p_on: input.on, p_method: input.method,
    p_method_word: methodWord(input.method), p_reference: input.reference, p_club_words: words.club,
    p_team_words: words.team, p_category: requestCategory(c.row.request_type),
  });
  // Gone between our read and the lock means the coach withdrew it (a withdrawal deletes the request).
  if (!r.ok) return refused(409, requestRefusal(r.code === 'state_changed' ? r.state ?? 'approved' : 'withdrawn', 'club'));

  const [, request] = await Promise.all([
    tellTeamMoneyPeople({
      org: ctx.org, teamId: c.team.id, actorUserId: ctx.user.id, event: 'club_request_approved',
      ...CLUB_MONEY_NOTICE.approved({
        orgName: ctx.org.name, amount: Number(c.row.amount), what: c.row.description,
        toTeam: c.row.request_type === 'charge_to_org',
      }),
      metadata: { requestId: c.row.id },
    }),
    rereadRequest(c.row.id),
  ]);
  return { ok: true, request: request! };
}

/** Decline a waiting request, with the reason the coach reads. Writes no ledger line. */
export async function clubDeclineRequest(ctx: AuthContextWithRole, p: {
  requestId: string; reason: unknown;
}): Promise<Moved<{ request: ClubRequest }>> {
  const reason = readReason(p.reason); if (!reason.ok) return reason;
  const found = await requestFor(ctx, p.requestId); if (!found.ok) return found;
  const { c } = found;

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .update({ status: 'denied', denial_reason: reason.value, reviewed_by: ctx.user.id, reviewed_at: now, updated_at: now })
    .eq('id', c.row.id)
    .eq('org_id', ctx.org.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const current = await rereadRequest(c.row.id);
    return refused(409, requestRefusal(current ? current.status : 'withdrawn', 'club'));
  }

  await tellTeamMoneyPeople({
    org: ctx.org, teamId: c.team.id, actorUserId: ctx.user.id, event: 'club_request_declined',
    ...CLUB_MONEY_NOTICE.declined({ orgName: ctx.org.name, amount: Number(c.row.amount), what: c.row.description, reason: reason.value }),
    metadata: { requestId: c.row.id },
  });
  return { ok: true, request: mapClubRequest(data) };
}

/** Reverse an approval: both lines voided with the reason; the request closes as Reversed. */
export async function clubReverseRequest(ctx: AuthContextWithRole, p: {
  requestId: string; reason: unknown;
}): Promise<Moved<{ request: ClubRequest }>> {
  const reason = readReason(p.reason); if (!reason.ok) return reason;
  const found = await requestFor(ctx, p.requestId); if (!found.ok) return found;
  const { c } = found;

  const r = await rpc('club_request_reverse', {
    p_request: c.row.id, p_org: ctx.org.id, p_actor: ctx.user.id, p_reason: reason.value,
  });
  if (!r.ok) {
    if (r.code === 'unlinked') return refused(409, { error: UNLINKED_APPROVAL, code: 'unlinked' });
    if (r.code === 'state_changed') return refused(409, requestRefusal(r.state ?? 'pending', 'club'));
    return notFound();
  }

  const [, request] = await Promise.all([
    tellTeamMoneyPeople({
      org: ctx.org, teamId: c.team.id, actorUserId: ctx.user.id, event: 'club_request_reversed',
      ...CLUB_MONEY_NOTICE.reversed({ orgName: ctx.org.name, amount: Number(c.row.amount), what: c.row.description, reason: reason.value }),
      metadata: { requestId: c.row.id },
    }),
    rereadRequest(c.row.id),
  ]);
  return { ok: true, request: request! };
}

/** Void a transfer between the club's OWN books: both halves, one reason (C13). */
export async function clubVoidTransfer(ctx: AuthContextWithRole, p: {
  entryId: string; reason: unknown;
}): Promise<Moved<{ voided: string[] }>> {
  const reason = readReason(p.reason); if (!reason.ok) return reason;
  const r = await rpc('club_transfer_void', {
    p_entry: p.entryId, p_org: ctx.org.id, p_actor: ctx.user.id, p_reason: reason.value,
  });
  if (!r.ok) {
    if (r.code === 'not_found') return notFound();
    return refused(r.code === 'already_void' ? 409 : 400, {
      error: TRANSFER_VOID_REFUSAL[r.code ?? ''] ?? 'This transfer can’t be voided.', code: r.code,
    });
  }
  return { ok: true, voided: r.voided ?? [] };
}

// ── The coach's moves (no ledger line) ─────────────────────────────────────────────────────────

type CoachTeam = { id: string; name: string; groupId: string | null };

/** After a coach's update matched nothing: what the installment is now, as one coded refusal. */
async function coachRefusal(org: Organization, installmentId: string, splitId: string): Promise<Refused> {
  const current = await getRepAllocationInstallment(installmentId);
  if (!current || current.splitId !== splitId) return notFound();
  return refused(409, coachInstallmentRefusal(stateOf(current), org.name));
}

/**
 * The coach says the team SENT an installment (Ask 1). It writes nothing to any ledger: the club
 * confirms it received, and that is the one moment the club's books are written. The club's
 * accounting people are told.
 *
 * The caller (the coach's route) has established: a live seat on the team, money WRITE access, and
 * that the split is this team's in this org.
 */
export async function coachSendInstallment(p: {
  org: Organization; team: CoachTeam; userId: string;
  splitId: string; installmentId: string; on: unknown; method: unknown; reference: unknown;
}): Promise<Moved<{ installment: RepAllocationInstallment }>> {
  const input = readMoveInput(p); if (!input.ok) return input;

  const { data, error } = await supabaseAdmin
    .from('rep_allocation_installments')
    .update({
      sent_on: input.on, sent_method: input.method, sent_reference: input.reference,
      sent_by: p.userId, sent_at: new Date().toISOString(),
    })
    .eq('id', p.installmentId)
    .eq('split_id', p.splitId)
    .eq('org_id', p.org.id)
    .is('paid_at', null)
    .is('sent_at', null)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) return coachRefusal(p.org, p.installmentId, p.splitId);
  const installment = mapRepAllocationInstallment(data);

  const c = await loadInstallmentContext(p.org.id, installment.id);
  if (c) {
    await tellClubAccounting({
      org: p.org, teamId: p.team.id, teamGroupId: p.team.groupId, actorUserId: p.userId, event: 'team_money_sent',
      ...CLUB_MONEY_NOTICE.sent({
        teamName: p.team.name, amount: installment.amount, what: whatInstallment(c), sentOn: input.on,
        how: howItCame(input.method, input.reference),
      }),
      link: clubMoneyLinks.allocation(p.org.slug, c.allocationId, p.splitId),
      metadata: { installmentId: installment.id, splitId: p.splitId },
    });
  }
  return { ok: true, installment };
}

/**
 * The coach takes back the team's own "sent" before the club confirms it. A payment the CLUB
 * recorded is refused in words — it is the club's to undo (S3A-01: the old coach Undo voided the
 * club's own ledger line with no question and no notice).
 */
export async function coachTakeBackInstallment(p: {
  org: Organization; splitId: string; installmentId: string;
}): Promise<Moved<{ installment: RepAllocationInstallment }>> {
  const { data, error } = await supabaseAdmin
    .from('rep_allocation_installments')
    .update({ sent_on: null, sent_method: null, sent_reference: null, sent_by: null, sent_at: null })
    .eq('id', p.installmentId)
    .eq('split_id', p.splitId)
    .eq('org_id', p.org.id)
    .is('paid_at', null)
    .not('sent_at', 'is', null)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) return coachRefusal(p.org, p.installmentId, p.splitId);
  return { ok: true, installment: mapRepAllocationInstallment(data) };
}

/** Tell the club a coach filed a request (Ask 5c). Best-effort; the request has landed. */
export async function tellClubOfNewRequest(p: {
  org: Organization; team: CoachTeam; userId: string;
  request: { id: string; amount: number; description: string; requestType: 'payment_to_org' | 'charge_to_org' };
}): Promise<void> {
  await tellClubAccounting({
    org: p.org, teamId: p.team.id, teamGroupId: p.team.groupId, actorUserId: p.userId, event: 'team_request_filed',
    ...CLUB_MONEY_NOTICE.newRequest({
      teamName: p.team.name, amount: p.request.amount, what: p.request.description,
      toClub: p.request.requestType === 'payment_to_org',
    }),
    link: clubMoneyLinks.requests(p.org.slug, p.request.id),
    metadata: { requestId: p.request.id },
  });
}

/**
 * ⚖ A WAITING REQUEST HOLDING UP THE PAYOUT IS TOLD TO THE CLUB (Ask 5b, S3A-03). The owner's ruling of
 * 2026-08-17 stands — the end-of-season payout to families waits while a request to the club is
 * unanswered — and what was missing was the club's half: the club was never told.
 *
 * Called when a coach who can pay out opens the payout sheet (that is "reaching the payout": the
 * sheet is fetched only when it opens). True only when the club's answer is the ONE thing left
 * (`clubRequestsHoldPayout`, read off the coach's own `closeOutBlockers`). Each waiting request is
 * told ONCE — a conditional stamp, so two coaches opening the sheet together send one notice.
 *
 * Returns when the club was first told about the requests still waiting (null when never), so the
 * sheet can say "the club has been told" and when.
 */
export async function tellClubIfRequestsHoldPayout(p: {
  org: Organization;
  team: CoachTeam;
  programYearId: string;
  holdsPayout: boolean;
  userId: string;
}): Promise<string | null> {
  const pending = await supabaseAdmin
    .from('rep_team_payment_requests')
    .select('id, payout_hold_told_at')
    .eq('team_id', p.team.id)
    .eq('program_year_id', p.programYearId)
    .eq('status', 'pending');
  if (pending.error) throw pending.error;
  const rows = (pending.data ?? []) as { id: string; payout_hold_told_at: string | null }[];
  const earliest = (list: (string | null)[]) => list.filter((v): v is string => !!v).sort()[0] ?? null;

  // Nothing held, nothing waiting, or every waiting request already told: no write.
  if (!p.holdsPayout || rows.every(r => r.payout_hold_told_at)) return earliest(rows.map(r => r.payout_hold_told_at));

  const now = new Date().toISOString();
  const { data: stamped, error } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .update({ payout_hold_told_at: now })
    .eq('team_id', p.team.id)
    .eq('program_year_id', p.programYearId)
    .eq('status', 'pending')
    .is('payout_hold_told_at', null)
    .select('id');
  if (error) throw error;
  if ((stamped ?? []).length > 0) {
    await tellClubAccounting({
      org: p.org, teamId: p.team.id, teamGroupId: p.team.groupId, actorUserId: p.userId,
      event: 'team_request_holding_payout',
      ...CLUB_MONEY_NOTICE.holdingPayout({ teamName: p.team.name, count: rows.length }),
      // ONE request holding it → the notice opens that request, as a new request's notice does; the
      // list only when several are (owner ruling 2026-10-05, D4 — "lands on the record").
      link: clubMoneyLinks.requests(p.org.slug, rows.length === 1 ? rows[0].id : undefined),
      metadata: { requestIds: (stamped ?? []).map((r: { id: string }) => r.id) },
    });
  }
  return earliest([...rows.map(r => r.payout_hold_told_at), ...((stamped ?? []).length ? [now] : [])]);
}
