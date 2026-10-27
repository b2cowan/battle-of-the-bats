import { NextResponse } from 'next/server';
import { getAuthContextWithScope, scopeGuard, unauthorized, forbidden, requireTournamentInOrg, type AuthContextWithScope } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { isOurTournamentTeam } from '@/lib/club-own-tournament-team';
import { teamUpdateAllowed } from '@/lib/invite-only-event';
import { INVITE_REFUSALS } from '@/lib/invite-only-words';
import { LOCKED_RESULTS } from '@/lib/tournament-status-words';
import { tournamentToday } from '@/lib/timezone';
import { PAYMENT_METHODS, draftIssue, type PaymentLabel, type PaymentMethod } from '@/lib/team-payments';
import {
  changeTeamPayment, listEntryAdjustments, listTeamPaymentsForRecord, paymentErrorResponse, paymentsPostToBook, recordTeamPayment, removeTeamPayment,
} from '@/lib/team-payments-server';
import { loadTeamPayFacts } from '@/lib/team-pay-facts';
import { canRefundOnline } from '@/lib/online-payment-access';
import { announceTeamPaid } from '@/lib/team-payment-notices';
import { TEAM_RECORD_WORDS } from '@/lib/registration-words';
import { closeTeamPayPages, openTeamPayPages } from '@/lib/online-pay-pages';
import { readDisputes } from '@/lib/online-dispute-read';
import type { DisputeRecord } from '@/lib/online-payment-dispute';
import { onlinePaymentsOn } from '@/lib/online-payments-switch';

/**
 * A TEAM'S PAYMENTS — the Teams record's Payment section (mig 345; TEAM_PAYMENTS_LIST_PLAN.md).
 *
 *   GET    ?teamId=…                      the team's posted payments, and whether they post to the tournament's book
 *   POST   { teamId, amount, paidOn, label?, method? }   record one payment (one ledger line on a plan with Accounting)
 *   PATCH  { paymentId, amount, paidOn, method? }        change one (a ledger line is voided and a corrected one posted)
 *   DELETE { paymentId }                                 remove one (its line is voided; who and when are kept)
 *
 * Same gate as the Teams screen's update: an organizer who creates tournaments, inside the event's organization and scope, on
 * a plan that tracks payments (reading what is recorded stays open, R2), and an event that is not locked. The database does
 * the rest: it refuses a future date, our own team, and a date in the club's closed fiscal year.
 */

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
const LABELS: readonly PaymentLabel[] = ['Deposit', 'Balance', 'Entry fee', 'Payment'];

async function gate(req: Request, tournamentId: string, write: boolean): Promise<{ ctx: AuthContextWithScope } | { error: Response }> {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return { error: forbidden() };
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return { error: denied };
  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return { error: wrongOrg };
  if (write) {
    // The server holds what the screens hide (the free tournament tier, B2): no payment write on a plan without payment tracking.
    if (!teamUpdateAllowed(ctx.org.planId, null, { paymentStatus: 'paid' })) return { error: json({ error: INVITE_REFUSALS.hidden }, 403) };
    const { data } = await supabaseAdmin.from('tournaments').select('status').eq('id', tournamentId).maybeSingle();
    if (data?.status === 'completed') return { error: json({ error: LOCKED_RESULTS }, 409) };
  }
  return { ctx };
}

/** A team in this tournament, or a 404. */
async function teamInTournament(teamId: unknown, tournamentId: string): Promise<boolean> {
  if (typeof teamId !== 'string' || !/^[0-9a-f-]{36}$/i.test(teamId)) return false;
  const { data } = await supabaseAdmin.from('teams').select('id, tournament_id').eq('id', teamId).maybeSingle();
  return data?.tournament_id === tournamentId;
}

/** A payment's team, when the payment is in this tournament. */
async function paymentTeam(paymentId: unknown, tournamentId: string): Promise<string | null> {
  if (typeof paymentId !== 'string' || !/^[0-9a-f-]{36}$/i.test(paymentId)) return null;
  const { data } = await supabaseAdmin.from('tournament_team_payments').select('team_id, tournament_id').eq('id', paymentId).maybeSingle();
  return data && data.tournament_id === tournamentId ? data.team_id as string : null;
}

function readMethod(v: unknown): PaymentMethod | null {
  return typeof v === 'string' && (PAYMENT_METHODS as readonly string[]).includes(v) ? v as PaymentMethod : null;
}

/** The amount and day of a body, checked the way the form checks them (the database checks again). */
function readDraft(body: Record<string, unknown>): { amount: number; paidOn: string } | { error: Response } {
  const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount);
  const paidOn = typeof body.paidOn === 'string' ? body.paidOn : '';
  const issue = draftIssue(amount, paidOn, tournamentToday());
  if (issue === 'amount') return { error: json({ error: 'Enter an amount above $0.' }, 400) };
  if (issue === 'date') return { error: json({ error: 'Choose the date the payment arrived.' }, 400) };
  if (issue === 'future') return { error: json({ error: 'A payment can’t be dated in the future.' }, 400) };
  return { amount, paidOn };
}

export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ tournamentId: string }> }) => {
  const { tournamentId } = await params;
  const g = await gate(req, tournamentId, false);
  if ('error' in g) return g.error;
  const teamId = new URL(req.url).searchParams.get('teamId');
  if (!(await teamInTournament(teamId, tournamentId))) return json({ error: 'That team couldn’t be found.' }, 404);
  const [payments, postsToBook, facts, { data: team }, adjustments, openPages] = await Promise.all([
    listTeamPaymentsForRecord(teamId as string),
    paymentsPostToBook(tournamentId),
    loadTeamPayFacts(teamId as string),
    supabaseAdmin.from('teams').select('pay_link_sent_at, status').eq('id', teamId as string).maybeSingle(),
    listEntryAdjustments(teamId as string),
    // 12d-1 (ask 12): a pay page open while the desk records by hand — the notice says who opened it, for what, and when.
    openTeamPayPages(teamId as string),
  ]);
  // Online payments on this record (Club Tier Stage 12a): the pay link goes out only while the team can pay online now;
  // a refund to the card only while the club's account is still connected (after Disconnect, refunds are made in Stripe).
  const member = { role: g.ctx.role, capabilities: g.ctx.capabilities };
  // 12d-1 Part 3: a card dispute on a row (words §1.1–§1.2), read for THIS reader (amber and the Stripe door are the
  // answerer's; Copy the facts whoever refunds here and the owner).
  const disputes = await readDisputes({
    orgId: g.ctx.org.id, onlinePaymentIds: payments.map(p => p.online?.id).filter((x): x is string => !!x),
    viewer: { userId: g.ctx.user.id, canCopy: canRefundOnline(member, g.ctx.org) },
  }).catch(e => {
    // An extra never takes the record down (/review 2026-10-27).
    console.error('[team payments] couldn’t read card disputes:', e instanceof Error ? e.message : String(e));
    return new Map<string, DisputeRecord>();
  });
  for (const p of payments) if (p.online) p.online.dispute = disputes.get(p.online.id) ?? null;
  const online = {
    payLink: facts?.refusal === null && canRefundOnline(member, g.ctx.org),
    payLinkSentAt: (team?.pay_link_sent_at as string | null) ?? null,
    // 12d-2 (ask 4): refunds keep working after a downgrade — the launch switch alone stops them, never the plan.
    refunds: onlinePaymentsOn() && !!facts?.account && !facts.account.disconnectedAt && canRefundOnline(member, g.ctx.org),
  };
  // 12c Part 6 (words §3.7): the team's bank debit — clearing, returned, or reversed — and, for one ended while it clears,
  // what happens when it clears.
  const debit = facts?.debit ?? null;
  const { data: decision } = debit?.state === 'clearing'
    ? await supabaseAdmin.from('online_payment_clear_decisions').select('choice, fee_back, reason')
      .eq('online_payment_id', debit.id).is('online_payment_item_id', null).is('outcome', null).maybeSingle()
    : { data: null };
  return json({
    payments, postsToBook, online, adjustments, debit, teamStatus: (team?.status as string | null) ?? null, openPages,
    today: tournamentToday(),
    decision: decision ? { choice: decision.choice as 'send_back' | 'keep', feeBack: !!decision.fee_back, reason: (decision.reason as string | null) ?? null } : null,
    payoutsOn: !!facts?.account && !facts.account.disconnectedAt,
    // Who may answer it: whoever runs tournaments (sending it back is a refund; never the treasurer, §0f).
    canDecide: canRefundOnline(member, g.ctx.org),
  });
}, { route: '/api/admin/tournaments/[tournamentId]/registrations/payments' });

export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ tournamentId: string }> }) => {
  const { tournamentId } = await params;
  const g = await gate(req, tournamentId, true);
  if ('error' in g) return g.error;
  const { ctx } = g;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (!(await teamInTournament(body.teamId, tournamentId))) return json({ error: 'That team couldn’t be found.' }, 404);
  const teamId = body.teamId as string;
  const draft = readDraft(body);
  if ('error' in draft) return draft.error;
  // The club's own team owes no fee (Stage 7a). The database refuses too; this says it before a line could be considered.
  if (await isOurTournamentTeam(ctx.org.id, teamId)) return json({ error: 'Our team has no entry fee' }, 409);
  // 12c Part 6 (words §3.2): while a bank debit clears, a second payment can't be recorded (a stale window).
  const { count: clearing } = await supabaseAdmin.from('online_payments').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('status', 'clearing');
  if ((clearing ?? 0) > 0) {
    const { data: t } = await supabaseAdmin.from('teams').select('name').eq('id', teamId).maybeSingle();
    return json({ error: TEAM_RECORD_WORDS.clearingMarkPaid(String(t?.name ?? 'this team')) }, 409);
  }
  const label = (LABELS as readonly string[]).includes(String(body.label)) ? body.label as PaymentLabel : 'Payment';
  const result = await recordTeamPayment({ teamId, amount: draft.amount, paidOn: draft.paidOn, label, method: readMethod(body.method), actorId: ctx.user.id });
  if ('error' in result) return paymentErrorResponse(result.error, ctx.org.id, [draft.paidOn]);
  if (result.outcome.becamePaid) await announceTeamPaid(ctx, teamId, result.outcome.total);
  // 12d-1 (ask 12): recorded by hand, so any pay page still open closes (the team can't pay twice).
  const pagesClosed = await closeTeamPayPages([teamId], 'Record a payment');
  return json({ ok: true, total: result.outcome.total, status: result.outcome.status, paymentId: result.outcome.paymentId, pagesClosed });
}, { route: '/api/admin/tournaments/[tournamentId]/registrations/payments' });

export const PATCH = withObservability(async (req: Request, { params }: { params: Promise<{ tournamentId: string }> }) => {
  const { tournamentId } = await params;
  const g = await gate(req, tournamentId, true);
  if ('error' in g) return g.error;
  const { ctx } = g;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const teamId = await paymentTeam(body.paymentId, tournamentId);
  if (!teamId) return json({ error: 'That payment is no longer recorded.' }, 404);
  const draft = readDraft(body);
  if ('error' in draft) return draft.error;
  const result = await changeTeamPayment({ paymentId: body.paymentId as string, amount: draft.amount, paidOn: draft.paidOn, method: readMethod(body.method), actorId: ctx.user.id });
  if ('error' in result) return paymentErrorResponse(result.error, ctx.org.id, [draft.paidOn]);
  // A change that brings the team up to its fee completes it, like recording the last payment does.
  if (result.outcome.becamePaid) await announceTeamPaid(ctx, teamId, result.outcome.total);
  return json({ ok: true, total: result.outcome.total, status: result.outcome.status });
}, { route: '/api/admin/tournaments/[tournamentId]/registrations/payments' });

export const DELETE = withObservability(async (req: Request, { params }: { params: Promise<{ tournamentId: string }> }) => {
  const { tournamentId } = await params;
  const g = await gate(req, tournamentId, true);
  if ('error' in g) return g.error;
  const { ctx } = g;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (!(await paymentTeam(body.paymentId, tournamentId))) return json({ error: 'That payment is no longer recorded.' }, 404);
  const result = await removeTeamPayment({ paymentId: body.paymentId as string, actorId: ctx.user.id });
  if ('error' in result) return paymentErrorResponse(result.error, ctx.org.id);
  return json({ ok: true, total: result.outcome.total, status: result.outcome.status });
}, { route: '/api/admin/tournaments/[tournamentId]/registrations/payments' });
