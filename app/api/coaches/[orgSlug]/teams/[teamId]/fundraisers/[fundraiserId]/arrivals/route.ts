import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepFundraiser,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { tournamentToday } from '@/lib/timezone';
import { writeSponsorArrivalRow } from '@/lib/sponsor-arrivals-server';

/**
 * POST — record one ARRIVAL against a sponsor (mig 268; owner ruling Q12): a dated cheque, with
 * a method, accruing each planned family's credit as the money actually lands. This is the only
 * door a second cheque has ever had — before arrivals, it was typed over the first.
 *
 * Body: { amount, receivedDate (YYYY-MM-DD, ≤ today), method?, notes? }
 * The credit plan is NOT in the body — arrivals earn against the sponsor's stored agreement;
 * changing who is credited is the settings PATCH's job, behind the payout floor.
 */
async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string }> },) => {
  const { orgSlug, teamId, fundraiserId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  // Season-scoped, like every fundraiser lookup since the Chunk-F archive fix.
  const fundraiser = await getRepFundraiser(fundraiserId, team.id, programYear.id);
  if (!fundraiser) return NextResponse.json({ error: 'Fundraiser not found' }, { status: 404 });
  if ((fundraiser.kind ?? 'fundraiser') !== 'sponsor') {
    return NextResponse.json({ error: 'Arrivals belong to sponsors — a drive logs per-player amounts instead.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Enter an amount greater than zero.' }, { status: 400 });
  }
  const receivedDate = typeof body.receivedDate === 'string' ? body.receivedDate : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) {
    return NextResponse.json({ error: 'Enter the date the money arrived.' }, { status: 400 });
  }
  if (receivedDate > tournamentToday()) {
    return NextResponse.json({ error: 'That hasn’t happened yet — an arrival is money that has already come in.' }, { status: 400 });
  }
  const method = typeof body.method === 'string' && body.method ? body.method : null;
  if (method && !['etransfer', 'cash', 'cheque', 'card', 'other'].includes(method)) {
    return NextResponse.json({ error: 'method must be one of etransfer, cash, cheque, card, other' }, { status: 400 });
  }
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;

  const result = await writeSponsorArrivalRow({
    team,
    programYearId: programYear.id,
    fundraiser: {
      id: fundraiser.id,
      name: fundraiser.name,
      pledged_amount: fundraiser.pledged_amount != null ? Number(fundraiser.pledged_amount) : null,
    },
    amount,
    receivedDate,
    method,
    notes,
    userId: ctx!.user.id,
  });
  if ('error' in result) return result.error;

  return NextResponse.json({ entryId: result.entryId }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/arrivals' });
