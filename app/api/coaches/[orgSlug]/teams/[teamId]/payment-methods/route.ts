import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  listPaymentMethodUsage,
} from '@/lib/db';
import { mergePaymentMethods } from '@/lib/payment-methods';
import { withObservability } from '@/lib/observability';
import { canViewMoney, denyUnless } from '@/lib/coach-capabilities';

/**
 * The payment methods a coach can pick from: what this CLUB already uses, most-used first, then the
 * common ones it hasn't touched yet.
 *
 * ⚠ SCOPED TO THE TEAMS THIS COACH ACTUALLY COACHES — never the whole club. `payment_method` is
 * free text, so an org-wide read would show a coach on one team the strings coaches on every other
 * team typed, with no opt-in and no sanitising. The shared-vocabulary goal is met by the SEED list
 * (lib/payment-methods.ts), which every club starts from; a coach's own history personalises on top.
 * A coach who holds two teams still gets both, which was the case that argued for widening at all.
 *
 * READ-ONLY BY DESIGN — there is no POST. The list is derived from recorded expenses, so a method
 * enters the club's vocabulary by being used on a saved record and no other way. That also means
 * this endpoint can never be the thing that writes a typo into the library.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return forbidden();

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return NextResponse.json({ error: 'No active program year for this team' }, { status: 404 });
  }

  const denied = denyUnless(
    canViewMoney(assignment.capabilities),
    'You do not have access to team finances. Ask the head coach to grant it.',
  );
  if (denied) return denied;

  // Best-effort: if usage can't be read the coach still gets the seeded methods, because a form
  // with an empty picker is worse than a form with the common answers and no history.
  let usage: { name: string; count: number }[] = [];
  try {
    usage = await listPaymentMethodUsage(ctx.org.id, assignments.map(a => a.teamId));
  } catch {
    usage = [];
  }

  return NextResponse.json({ methods: mergePaymentMethods(usage) });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/payment-methods' });
