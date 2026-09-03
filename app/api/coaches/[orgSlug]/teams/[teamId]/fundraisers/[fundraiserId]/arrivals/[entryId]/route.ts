import { NextResponse } from 'next/server';
import { getRepFundraiser } from '@/lib/db';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { futureReceivedDateRefusal } from '@/lib/money-date-guards';
import { tournamentToday } from '@/lib/timezone';
import { DUES_PAYMENT_METHOD_LABEL } from '@/lib/types';
import { editSponsorArrival, undoSponsorArrival } from '@/lib/sponsor-arrivals-server';

/**
 * PATCH — edit one arrival (List · Room · Question Phase B, 2026-09-02): amount, the day it
 * arrived, how it came, a note. Body: { amount?, receivedDate? (YYYY-MM-DD, ≤ today), method?
 * (one of the shared list, or null to clear), notes? }. The credits are REPLAYED through the
 * stored plan and the payout floor asked per family before a row moves — see
 * `editSponsorArrival`.
 *
 * DELETE — undo one arrival (mig 268): its family credits, its dated income row and the entry
 * itself are removed together, and undoing the LAST arrival returns the sponsor to a pledge.
 * The payout floor is asked per family BEFORE anything is touched (lib/sponsor-arrivals-server) —
 * cash already handed back against an accrued credit refuses the undo with the shared sentence.
 *
 * Both verbs resolve the LIVE season through the shared context resolver (the one the drive's
 * entry route uses) — this file carried its own copy of that chain until `/simplify` on Phase B.
 * Season-scoped, like every fundraiser lookup since the Chunk-F archive fix.
 */

/** The one shared method list — the same keys the client offers, never a third hand copy. */
const METHODS = Object.keys(DUES_PAYMENT_METHOD_LABEL);

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string; entryId: string }> },) => {
  const { orgSlug, teamId, fundraiserId, entryId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const fundraiser = await getRepFundraiser(fundraiserId, team.id, programYear.id);
  if (!fundraiser) return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 });
  if ((fundraiser.kind ?? 'fundraiser') !== 'sponsor') {
    return NextResponse.json({ error: 'Arrivals belong to sponsors — a drive entry is edited on the drive.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const edit: { amount?: number; receivedDate?: string; method?: string | null; notes?: string | null } = {};
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter an amount greater than zero.' }, { status: 400 });
    }
    edit.amount = amount;
  }
  if (body.receivedDate !== undefined) {
    const receivedDate = typeof body.receivedDate === 'string' ? body.receivedDate : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) {
      return NextResponse.json({ error: 'Enter the date the money arrived.' }, { status: 400 });
    }
    // The same sentence, from the same map, as the POST — a cheque cannot arrive tomorrow.
    if (receivedDate > tournamentToday()) {
      return NextResponse.json({ error: futureReceivedDateRefusal(receivedDate, 'sponsor cheque')! }, { status: 400 });
    }
    edit.receivedDate = receivedDate;
  }
  if (body.method !== undefined) {
    const method = typeof body.method === 'string' && body.method ? body.method : null;
    if (method && !METHODS.includes(method)) {
      return NextResponse.json({ error: `method must be one of ${METHODS.join(', ')}` }, { status: 400 });
    }
    edit.method = method;
  }
  if (body.notes !== undefined) {
    edit.notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
  }
  if (Object.keys(edit).length === 0) {
    return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  }

  const result = await editSponsorArrival({
    programYearId: programYear.id,
    fundraiser: {
      id: fundraiser.id,
      name: fundraiser.name,
      pledged_amount: fundraiser.pledged_amount != null ? Number(fundraiser.pledged_amount) : null,
    },
    entryId,
    ...edit,
    userId: ctx!.user.id,
  });
  if ('error' in result) return result.error;

  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/arrivals/[entryId]' });

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string; entryId: string }> },) => {
  const { orgSlug, teamId, fundraiserId, entryId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const fundraiser = await getRepFundraiser(fundraiserId, team.id, programYear.id);
  if (!fundraiser) return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 });
  if ((fundraiser.kind ?? 'fundraiser') !== 'sponsor') {
    return NextResponse.json({ error: 'Arrivals belong to sponsors.' }, { status: 400 });
  }

  const result = await undoSponsorArrival({
    programYearId: programYear.id,
    fundraiser: { id: fundraiser.id, name: fundraiser.name },
    entryId,
  });
  if ('error' in result) return result.error;

  return NextResponse.json({ ok: true, nowPledged: result.nowPledged });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/arrivals/[entryId]' });
