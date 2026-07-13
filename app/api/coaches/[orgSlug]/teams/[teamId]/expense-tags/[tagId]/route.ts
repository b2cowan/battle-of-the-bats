import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getActiveRepProgramYear,
  getCoachingAssignmentsForUser,
  getRepTeam,
  renameRepTeamTag,
  deleteRepTeamTag,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';

// Rename/delete a team's own money tag (kind='expense'). Money capability, not schedule. A shared
// (org-authored) tag has team_id NULL, so the team_id-scoped rename/delete is a no-op on it → 404,
// which correctly stops a coach editing a shared tag (only org admins manage those).
async function resolveTagContext(orgSlug: string, teamId: string) {
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
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances.');
  if (denied) return { error: denied };
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }
  return { ctx };
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; tagId: string }> },) => {
  const { orgSlug, teamId, tagId } = await params;
  const resolved = await resolveTagContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > 40) {
    return NextResponse.json({ error: 'Tag name must be 1–40 characters' }, { status: 400 });
  }

  try {
    const updated = await renameRepTeamTag(tagId, teamId, name);
    if (!updated) return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    return NextResponse.json({ tag: updated });
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === '23505') {
      return NextResponse.json({ error: `A tag named “${name}” already exists` }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not rename tag' },
      { status: 400 },
    );
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/expense-tags/[tagId]' });

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; tagId: string }> },) => {
  const { orgSlug, teamId, tagId } = await params;
  const resolved = await resolveTagContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const deleted = await deleteRepTeamTag(tagId, teamId);
  if (!deleted) return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/expense-tags/[tagId]' });
