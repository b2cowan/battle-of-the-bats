import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getActiveRepProgramYear,
  getCoachingAssignmentsForUser,
  getRepTeam,
  ensureRepTeamAwardTypesSeeded,
  getRepTeamAwardTypes,
  getRepTeamAwardTypeLibrary,
  createRepTeamAwardType,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canManageAwards } from '@/lib/coach-capabilities';

const MAX_AWARD_TYPES = 30;

// Team-scoped coach guard (no event) — mirrors the tags route's resolveTeamCoachContext.
async function resolveTeamCoachContext(orgSlug: string, teamId: string) {
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
  const resolved = await resolveTeamCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canManageAwards(assignment.capabilities), 'You do not have access to awards.');
  if (denied) return denied;

  // Seeds MVP / Best Hitter / Hustle Award on a team's very first read (editable starting
  // point, not a fixed default — see ensureRepTeamAwardTypesSeeded), as a side effect only —
  // the response always returns the full list (active + retired) so one fetch serves both the
  // give-award picker (active only, filtered client-side) and the manager modal (both).
  await ensureRepTeamAwardTypesSeeded(ctx.org.id, teamId);
  // Team's own types (incl. retired, for the manager modal) + the org's shared active types
  // (Phase 3) — the give-award picker offers both; the manager only edits the team's own.
  const awardTypes = await getRepTeamAwardTypeLibrary(teamId, ctx.org.id, { includeRetired: true });
  return NextResponse.json({ awardTypes });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/award-types' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveTeamCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canManageAwards(assignment.capabilities), 'You do not have access to awards.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > 40) {
    return NextResponse.json({ error: 'Award name must be 1–40 characters' }, { status: 400 });
  }
  const emoji = typeof body.emoji === 'string' ? body.emoji.trim().slice(0, 8) : null;

  const existing = await getRepTeamAwardTypes(teamId, { includeRetired: true });
  if (existing.filter(t => t.isActive).length >= MAX_AWARD_TYPES) {
    return NextResponse.json(
      { error: `You can keep up to ${MAX_AWARD_TYPES} award types. Retire one to add another.` },
      { status: 400 },
    );
  }

  try {
    const awardType = await createRepTeamAwardType({
      orgId: ctx.org.id,
      teamId,
      name,
      emoji: emoji || null,
      createdBy: ctx.user.id,
    });
    return NextResponse.json({ awardType });
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === '23505') {
      return NextResponse.json({ error: `An award named “${name}” already exists` }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save award type' },
      { status: 400 },
    );
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/award-types' });
