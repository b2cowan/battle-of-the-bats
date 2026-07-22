import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser } from '@/lib/db';
import { countActiveBasicCoachTeamMembershipsForUser } from '@/lib/basic-coach-teams';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string }> },) => {
  const { orgSlug } = await params;
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.org.slug !== orgSlug) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // `assignments` = rep (paid) coaching in THIS org; `hasBasicCoachTeam` = the user coaches a
  // free (Basic) team anywhere — powers the admin shell's coach-view door for a free-tier owner
  // who also coaches (P3-2), whose coach home is the global launchpad, not this org's portal.
  const [assignments, basicMemberships] = await Promise.all([
    getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id),
    countActiveBasicCoachTeamMembershipsForUser(ctx.user.id),
  ]);
  return NextResponse.json({ assignments, hasBasicCoachTeam: basicMemberships > 0 });
}, { route: '/api/coaches/[orgSlug]/assignments' });
