import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepRosterPlayer,
  getRepPlayerDocumentById,
  deleteRepPlayerDocument,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewPlayerDocuments, canManagePlayerDocuments } from '@/lib/coach-capabilities';

async function resolveContext(orgSlug: string, teamId: string, playerId: string, docId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const player = await getRepRosterPlayer(playerId);
  if (!player || player.teamId !== teamId || player.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Player not found' }, { status: 404 }) };
  }

  const doc = await getRepPlayerDocumentById(docId);
  if (!doc || doc.playerId !== playerId || doc.teamId !== teamId) {
    return { error: NextResponse.json({ error: 'Document not found' }, { status: 404 }) };
  }

  return { ctx, player, doc, assignment };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; docId: string }> },) => {
  const { orgSlug, teamId, playerId, docId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, playerId, docId);
  if ('error' in resolved) return resolved.error!;
  const { doc, assignment } = resolved;
  // This route mints a 1-hour signed URL to the actual file, so it is the download itself —
  // it needs guardian-PII clearance on top of `documents`, same as the list route.
  const denied = denyUnless(canViewPlayerDocuments(assignment.capabilities), 'You do not have access to this player’s documents.');
  if (denied) return denied;

  const { data, error } = await supabaseAdmin.storage
    .from('rep-team-documents')
    .createSignedUrl(doc.storagePath, 3600);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  return NextResponse.json({ url: data.signedUrl, expiresAt });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/documents/[docId]' });

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string; docId: string }> },) => {
  const { orgSlug, teamId, playerId, docId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, playerId, docId);
  if ('error' in resolved) return resolved.error!;
  const { doc, assignment } = resolved;
  const denied = denyUnless(canManagePlayerDocuments(assignment.capabilities), 'You do not have permission to manage this player’s documents.');
  if (denied) return denied;

  await supabaseAdmin.storage.from('rep-team-documents').remove([doc.storagePath]);
  await deleteRepPlayerDocument(docId);

  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/documents/[docId]' });
