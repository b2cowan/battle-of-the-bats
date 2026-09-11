import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getActiveRepProgramYear,
  getCoachingAssignmentsForUser,
  getRepTeam,
  updateRepTeamAwardType,
  deleteRepTeamAwardType,
  getRepTeamAwardTypeUsageCounts,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canManageAwards } from '@/lib/coach-capabilities';

async function resolveAwardTypeContext(orgSlug: string, teamId: string) {
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
  const denied = denyUnless(canManageAwards(assignment.capabilities), 'You do not have access to awards.');
  if (denied) return { error: denied };
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }
  return { ctx };
}

// Covers the "Edit" action (name + icon together), plus retire/restore via isActive — one
// PATCH, not separate endpoints per action.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; typeId: string }> },) => {
  const { orgSlug, teamId, typeId } = await params;
  const resolved = await resolveAwardTypeContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;

  const body = await req.json().catch(() => ({}));
  const fields: { name?: string; emoji?: string | null; isActive?: boolean } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 1 || name.length > 40) {
      return NextResponse.json({ error: 'Award name must be 1–40 characters' }, { status: 400 });
    }
    fields.name = name;
  }
  if (body.emoji !== undefined) {
    fields.emoji = typeof body.emoji === 'string' ? body.emoji.trim().slice(0, 8) || null : null;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });
    }
    fields.isActive = body.isActive;
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  try {
    const updated = await updateRepTeamAwardType(typeId, teamId, fields);
    if (!updated) return NextResponse.json({ error: 'Award type not found' }, { status: 404 });
    return NextResponse.json({ awardType: updated });
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === '23505') {
      return NextResponse.json({ error: `An award named “${fields.name}” already exists` }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not update award type' },
      { status: 400 },
    );
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/award-types/[typeId]' });

// R2 (owner ruling): an unused type deletes outright; a used one refuses (409) with the count —
// the RESTRICT FK on rep_player_awards.award_type_id (migration 182) is what actually enforces
// this at the DB level, so this handler never has to count usage itself before attempting the
// delete. A shared, org-authored type (team_id NULL) is scoped out by deleteRepTeamAwardType's
// own team_id match and comes back 404 — honest, since it was never this team's to delete.
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; typeId: string }> },) => {
  const { orgSlug, teamId, typeId } = await params;
  const resolved = await resolveAwardTypeContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;

  try {
    const deleted = await deleteRepTeamAwardType(typeId, teamId);
    if (!deleted) return NextResponse.json({ error: 'Award type not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === '23503') {
      const counts = await getRepTeamAwardTypeUsageCounts(teamId, [typeId]);
      const n = counts[typeId] ?? 0;
      return NextResponse.json(
        { error: `It's been given ${n} time${n === 1 ? '' : 's'} — merge it into another award or retire it instead.` },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not delete award type' },
      { status: 400 },
    );
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/award-types/[typeId]' });
