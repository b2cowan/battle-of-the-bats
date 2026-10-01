import { NextResponse } from 'next/server';
import { getRepAllocationSplit } from '@/lib/db';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { withObservability } from '@/lib/observability';
import { moveRefused } from '@/lib/club-money-route';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { coachSendInstallment, coachTakeBackInstallment } from '@/lib/club-money-moves';

type Params = { params: Promise<{ orgSlug: string; teamId: string; splitId: string; installId: string }> };

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE COACH'S SIDE OF A CLUB BILL (Club Tier Stage 3a, Ask 1, owner 2026-09-30).
 *
 * ⚖ A COACH NEVER WRITES TO THE CLUB'S BOOKS. Until 3a, "Record as paid" here posted a transfer
 * straight into the club's General ledger with nobody looking (C08, J4-014), and the Undo below took
 * back ANY recorded payment — including one the club recorded itself, voiding the club's own ledger
 * line with no question and no notice (S3A-01).
 *
 *   PATCH  — "We've sent it": the day, how and the reference. Writes NOTHING to any ledger; the club
 *            confirms it received, and that is the one moment the club's books are written. The
 *            club's accounting people are told. A body may be empty (today, no method) — the old
 *            "Record as paid" button sends none until session 2 draws the window.
 *   DELETE — "Take it back": only the team's own "sent" that the club has not confirmed. A payment
 *            the club recorded is refused in words: it is the club's to undo.
 *
 * A tap on a card whose state changed since the page loaded gets ONE coded 409
 * (`money_state_changed`) that says what changed and who can fix it.
 *
 * Writes address the LIVE season (`resolveLiveCoachTeamContext`): a finished season is a record.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
async function resolve(orgSlug: string, teamId: string, splitId: string) {
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return { error: resolved.error };
  const { ctx, team, assignment } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return { error: denied };

  // The split must be THIS team's, in THIS org — an id from another club's URL reaches nothing.
  const split = await getRepAllocationSplit(splitId);
  if (!split || split.teamId !== teamId || split.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return { ctx, team };
}

export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const { orgSlug, teamId, splitId, installId } = await params;
  const r = await resolve(orgSlug, teamId, splitId);
  if ('error' in r) return r.error!;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const moved = await coachSendInstallment({
    org: r.ctx.org, team: { id: teamId, name: r.team.name, groupId: r.team.groupId ?? null }, userId: r.ctx.user.id,
    splitId, installmentId: installId, on: body.sentOn, method: body.method, reference: body.reference,
  });
  if (!moved.ok) return moveRefused(moved);
  return NextResponse.json({ installment: moved.installment });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/allocations/[splitId]/installments/[installId]' });

export const DELETE = withObservability(async (_req: Request, { params }: Params) => {
  const { orgSlug, teamId, splitId, installId } = await params;
  const r = await resolve(orgSlug, teamId, splitId);
  if ('error' in r) return r.error!;

  const moved = await coachTakeBackInstallment({ org: r.ctx.org, splitId, installmentId: installId });
  if (!moved.ok) return moveRefused(moved);
  return NextResponse.json({ installment: moved.installment });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/allocations/[splitId]/installments/[installId]' });
