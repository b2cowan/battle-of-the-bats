import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  setAutoRemindersEnabled,
  setCreditApplicationMode,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { canViewMoney, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { CREDIT_APPLICATION_MODES, type CreditApplicationMode } from '@/lib/dues-credits';

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
    return { error: NextResponse.json({ error: 'No active program year' }, { status: 404 }) };
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

  return NextResponse.json({
    autoRemindersEnabled: programYear.autoRemindersEnabled,
    creditApplication: programYear.creditApplication,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/accounting-settings' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));

  const hasReminders = typeof body.autoRemindersEnabled === 'boolean';
  const hasCreditMode = typeof body.creditApplication === 'string';
  if (!hasReminders && !hasCreditMode) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (hasReminders) {
    await setAutoRemindersEnabled(programYear.id, body.autoRemindersEnabled);
  }
  if (hasCreditMode) {
    // Strict, not normalized: a typo from a future client must be a 400, not a silent
    // fall-back to last_first that changes every family's reminder amounts.
    if (!CREDIT_APPLICATION_MODES.includes(body.creditApplication as CreditApplicationMode)) {
      return NextResponse.json({ error: 'Invalid credit application mode' }, { status: 400 });
    }
    await setCreditApplicationMode(programYear.id, body.creditApplication as CreditApplicationMode);
  }

  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/accounting-settings' });
