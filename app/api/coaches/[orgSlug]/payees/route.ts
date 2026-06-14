import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, searchOrgPayees, createOrgPayee } from '@/lib/db';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { withObservability } from '@/lib/observability';

async function resolveCoachContext(orgSlug: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.length) return { error: forbidden() };
  return { ctx, assignments };
}

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string }> },) => {
  const { orgSlug } = await params;
  const resolved = await resolveCoachContext(orgSlug);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignments } = resolved;

  const q = new URL(req.url).searchParams.get('q') ?? '';
  const teamId = isTeamWorkspaceOrg(ctx.org) ? assignments[0]?.teamId : undefined;
  const payees = await searchOrgPayees(ctx.org.id, q, teamId);
  return NextResponse.json({ payees });
}, { route: '/api/coaches/[orgSlug]/payees' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string }> },) => {
  const { orgSlug } = await params;
  const resolved = await resolveCoachContext(orgSlug);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignments } = resolved;

  const body = await req.json();
  const name: string = typeof body.name === 'string' ? body.name.trim() : '';
  const notes: string | null = typeof body.notes === 'string' ? body.notes.trim() || null : null;

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (name.length > 200) return NextResponse.json({ error: 'name must be 200 characters or fewer' }, { status: 400 });

  try {
    const teamId = isTeamWorkspaceOrg(ctx.org) ? assignments[0]?.teamId : undefined;
    const payee = await createOrgPayee({ orgId: ctx.org.id, teamId, name, notes, createdBy: ctx.user.id });
    return NextResponse.json({ payee }, { status: 201 });
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === '23505') return NextResponse.json({ error: 'A payee with that name already exists' }, { status: 409 });
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/payees' });
