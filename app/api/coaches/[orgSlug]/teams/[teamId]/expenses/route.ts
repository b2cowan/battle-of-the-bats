import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamExpenses,
  createRepTeamExpense,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney, canWriteMoney } from '@/lib/coach-capabilities';

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

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(canViewMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const expenses = await getRepTeamExpenses(programYear.id);
  return NextResponse.json({ expenses });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/expenses' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const {
    expenseType,
    description,
    category = null,
    amount,
    depositAmount = null,
    depositDueDate = null,
    balanceAmount = null,
    balanceDueDate = null,
    eventId = null,
    notes = null,
    paymentMethod = null,
    payeeId = null,
    payeePayer = null,
  } = body;

  if (!expenseType || !['expense', 'tournament_payable'].includes(expenseType)) {
    return NextResponse.json({ error: 'expenseType must be "expense" or "tournament_payable"' }, { status: 400 });
  }
  if (!description?.trim()) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }

  const expense = await createRepTeamExpense({
    programYearId:  programYear.id,
    teamId:         team.id,
    orgId:          team.orgId,
    expenseType,
    description:    description.trim(),
    category:       category?.trim() || null,
    amount,
    depositAmount:  depositAmount != null ? Number(depositAmount) : null,
    depositDueDate: depositDueDate || null,
    balanceAmount:  balanceAmount != null ? Number(balanceAmount) : null,
    balanceDueDate: balanceDueDate || null,
    eventId:        eventId || null,
    notes:          notes?.trim() || null,
    paymentMethod:  paymentMethod?.trim() || null,
    payeeId:        payeeId || null,
    payeePayer:     payeePayer?.trim() || null,
    createdBy:      ctx!.user.id,
  });

  return NextResponse.json({ expense }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/expenses' });
