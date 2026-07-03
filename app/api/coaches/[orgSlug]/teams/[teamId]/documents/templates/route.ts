import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getRepDocumentTemplates,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewDocuments } from '@/lib/coach-capabilities';

async function resolveContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Team not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  return { ctx, team, assignment };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canViewDocuments(assignment.capabilities), 'You do not have access to documents.');
  if (denied) return denied;

  const templates = await getRepDocumentTemplates(ctx.org.id, teamId);
  const active = templates.filter(t => t.isActive);

  const withUrls = await Promise.all(
    active.map(async t => {
      const { data } = await supabaseAdmin.storage
        .from('rep-team-documents')
        .createSignedUrl(t.storagePath, 3600);
      const { storagePath: _sp, ...rest } = t;
      return { ...rest, downloadUrl: data?.signedUrl ?? null };
    }),
  );

  return NextResponse.json({ templates: withUrls });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/documents/templates' });

