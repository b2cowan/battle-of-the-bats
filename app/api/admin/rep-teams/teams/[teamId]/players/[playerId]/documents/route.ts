import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden, repGroupScopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import {
  getRepTeam,
  getRepRosterPlayer,
  getRepPlayerDocuments,
  createRepPlayerDocument,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { RepDocumentType } from '@/lib/types';
import { withObservability } from '@/lib/observability';

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE = 10 * 1024 * 1024;
const VALID_DOC_TYPES: RepDocumentType[] = ['waiver', 'medical_consent', 'code_of_conduct', 'other'];

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

function stripStoragePath<T extends { storagePath: string }>(doc: T): Omit<T, 'storagePath'> {
  const { storagePath: _sp, ...rest } = doc;
  return rest;
}

async function resolveContext(teamId: string, playerId: string) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return { error: err };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return { error: NextResponse.json({ error: 'Team not found' }, { status: 404 }) };
  }
  const groupErr = repGroupScopeGuard(ctx!, team.groupId);
  if (groupErr) return { error: groupErr };

  const player = await getRepRosterPlayer(playerId);
  if (!player || player.teamId !== teamId || player.orgId !== ctx!.org.id) {
    return { error: NextResponse.json({ error: 'Player not found' }, { status: 404 }) };
  }

  return { ctx: ctx!, team, player };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ teamId: string; playerId: string }> },) => {
  const { teamId, playerId } = await params;
  const resolved = await resolveContext(teamId, playerId);
  if ('error' in resolved) return resolved.error!;

  const docs = await getRepPlayerDocuments(playerId);
  return NextResponse.json({ documents: docs.map(stripStoragePath) });
}, { route: '/api/admin/rep-teams/teams/[teamId]/players/[playerId]/documents' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string; playerId: string }> },) => {
  const { teamId, playerId } = await params;
  const resolved = await resolveContext(teamId, playerId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, player } = resolved;
  // Uploading a player's compliance documents is an org-owned write — owner/admin only
  // (audit J4-004). gate() only checks the module cap, which other roles can hold.
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const documentType = formData.get('documentType') as string | null;
  const templateId = formData.get('templateId') as string | null;

  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });
  if (!documentType || !VALID_DOC_TYPES.includes(documentType as RepDocumentType)) {
    return NextResponse.json({ error: 'Invalid documentType' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed. Use PDF, JPG, PNG, or DOCX.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const storagePath = `${ctx.org.id}/teams/${teamId}/players/${playerId}/${crypto.randomUUID()}-${file.name}`;

  const { error: storageError } = await supabaseAdmin.storage
    .from('rep-team-documents')
    .upload(storagePath, bytes, { contentType: file.type });

  if (storageError) {
    return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 });
  }

  const doc = await createRepPlayerDocument({
    playerId: player.id,
    teamId: player.teamId,
    orgId: player.orgId,
    documentType: documentType as RepDocumentType,
    storagePath,
    fileName: file.name,
    fileSize: file.size,
    templateId: templateId || null,
    uploadedBy: ctx.user.id,
  });

  return NextResponse.json({ document: stripStoragePath(doc) }, { status: 201 });
}, { route: '/api/admin/rep-teams/teams/[teamId]/players/[playerId]/documents' });
