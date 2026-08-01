import { NextResponse } from 'next/server';
import {
  getRepTeamStaffForYear,
} from '@/lib/db';
import { resolveCoachCapabilities, denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';
import { resolveCoachSeasonRead } from '@/lib/coach-season-read';

// GET /api/coaches/[orgSlug]/teams/[teamId]/staff — the coaching staff + each assistant's effective
// capabilities, for the head coach's "Coaching staff" manage panel. Head coach only.
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachSeasonRead(orgSlug, teamId, req);
  if ('error' in resolved) return resolved.error;
  const { ctx, capabilities, programYear } = resolved;
  const denied = denyUnless(capabilities.isHeadCoach, 'Only the head coach manages the coaching staff.');
  if (denied) return denied;

  const staff = await getRepTeamStaffForYear(programYear.id, ctx.org.id);
  return NextResponse.json({
    staff: staff.map(s => ({
      coachId: s.coachId,
      userId: s.userId,
      coachRole: s.coachRole,
      displayName: s.displayName,
      email: s.email,
      // The current effective grant per area (head coach = full), so the grid renders live state.
      capabilities: resolveCoachCapabilities(s.coachRole, s.capabilities),
      isSelf: s.userId === ctx.user.id,
    })),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/staff' });
