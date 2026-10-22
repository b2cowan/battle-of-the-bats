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
  changeTeamPayment, listTeamPayments, paymentErrorResponse, paymentsPostToBook, recordTeamPayment, removeTeamPayment,
} from '@/lib/team-payments-server';
import { announceTeamPaid } from '@/lib/team-payment-notices';

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
  const [payments, postsToBook] = await Promise.all([listTeamPayments(teamId as string), paymentsPostToBook(tournamentId)]);
  return json({ payments, postsToBook });
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
  const label = (LABELS as readonly string[]).includes(String(body.label)) ? body.label as PaymentLabel : 'Payment';
  const result = await recordTeamPayment({ teamId, amount: draft.amount, paidOn: draft.paidOn, label, method: readMethod(body.method), actorId: ctx.user.id });
  if ('error' in result) return paymentErrorResponse(result.error, ctx.org.id, [draft.paidOn]);
  if (result.outcome.becamePaid) await announceTeamPaid(ctx, teamId, result.outcome.total);
  return json({ ok: true, total: result.outcome.total, status: result.outcome.status, paymentId: result.outcome.paymentId });
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
