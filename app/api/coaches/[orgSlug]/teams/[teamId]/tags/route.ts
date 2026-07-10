import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getActiveRepProgramYear,
  getCoachingAssignmentsForUser,
  getRepTeam,
  getRepTeamTags,
  createRepTeamTag,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless } from '@/lib/coach-capabilities';

const MAX_TAGS_PER_KIND = 50;

// Team-scoped coach guard (no event) — mirrors the lineup-templates route's resolveTeamCoachContext.
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
  const { assignment } = resolved;
  const denied = denyUnless(assignment.capabilities.schedule, 'You do not have access to the schedule.');
  if (denied) return denied;

  // Phase 1 only exposes game tags — 'expense' (Phase 3) isn't read here yet.
  const tags = await getRepTeamTags(teamId, 'game');
  return NextResponse.json({ tags });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tags' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveTeamCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(assignment.capabilities.schedule, 'You do not have access to the schedule.');
  if (denied) return denied;

  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > 40) {
    return NextResponse.json({ error: 'Tag name must be 1–40 characters' }, { status: 400 });
  }

  const existing = await getRepTeamTags(teamId, 'game');
  if (existing.length >= MAX_TAGS_PER_KIND) {
    return NextResponse.json(
      { error: `You can keep up to ${MAX_TAGS_PER_KIND} game tags. Delete or merge one to add another.` },
      { status: 400 },
    );
  }

  try {
    const tag = await createRepTeamTag({
      orgId: ctx.org.id,
      teamId,
      kind: 'game',
      name,
      createdBy: ctx.user.id,
    });
    return NextResponse.json({ tag });
  } catch (error: unknown) {
    // Unique (team, kind, lower(name)) violation → friendly 409.
    const code = (error as { code?: string })?.code;
    if (code === '23505') {
      return NextResponse.json({ error: `A tag named “${name}” already exists` }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save tag' },
      { status: 400 },
    );
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tags' });
