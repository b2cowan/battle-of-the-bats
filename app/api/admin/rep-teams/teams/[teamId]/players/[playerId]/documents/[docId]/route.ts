import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import {
  getRepTeam,
  getRepRosterPlayer,
  getRepPlayerDocumentById,
  deleteRepPlayerDocument,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

async function resolveContext(teamId: string, playerId: string, docId: string) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return { error: err };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return { error: NextResponse.json({ error: 'Team not found' }, { status: 404 }) };
  }

  const player = await getRepRosterPlayer(playerId);
  if (!player || player.teamId !== teamId || player.orgId !== ctx!.org.id) {
    return { error: NextResponse.json({ error: 'Player not found' }, { status: 404 }) };
  }

  const doc = await getRepPlayerDocumentById(docId);
  if (!doc || doc.playerId !== playerId || doc.orgId !== ctx!.org.id) {
    return { error: NextResponse.json({ error: 'Document not found' }, { status: 404 }) };
  }

  return { ctx: ctx!, doc };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string; playerId: string; docId: string }> },
) {
  const { teamId, playerId, docId } = await params;
  const resolved = await resolveContext(teamId, playerId, docId);
  if ('error' in resolved) return resolved.error;
  const { doc } = resolved;

  const { data, error } = await supabaseAdmin.storage
    .from('rep-team-documents')
    .createSignedUrl(doc.storagePath, 3600);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  return NextResponse.json({ url: data.signedUrl, expiresAt });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ teamId: string; playerId: string; docId: string }> },
) {
  const { teamId, playerId, docId } = await params;
  const resolved = await resolveContext(teamId, playerId, docId);
  if ('error' in resolved) return resolved.error;
  const { doc } = resolved;

  await supabaseAdmin.storage.from('rep-team-documents').remove([doc.storagePath]);
  await deleteRepPlayerDocument(docId);

  return NextResponse.json({ ok: true });
}
