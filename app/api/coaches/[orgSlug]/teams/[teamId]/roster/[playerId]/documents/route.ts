import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepRosterPlayer,
  getRepPlayerDocuments,
  createRepPlayerDocument,
} from '@/lib/db';
import {
  getEntitledTeamMembership,
  resolveMembershipCapabilities,
  resolveWorkingProgramYear,
} from '@/lib/coach-membership';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { RepDocumentType } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewPlayerDocuments, canManagePlayerDocuments } from '@/lib/coach-capabilities';

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE = 10 * 1024 * 1024;
const VALID_DOC_TYPES: RepDocumentType[] = ['waiver', 'medical_consent', 'code_of_conduct', 'other'];

async function resolveContext(orgSlug: string, teamId: string, playerId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  // M1 (2026-08-16): membership-gated, current capabilities. The three lookups are independent
  // — one round trip, checks in order after they land.
  const [membership, player, workingYear] = await Promise.all([
    getEntitledTeamMembership(ctx.org, teamId, ctx.user.id),
    getRepRosterPlayer(playerId),
    resolveWorkingProgramYear(teamId),
  ]);
  if (!membership) return { error: forbidden() };
  const assignment = { capabilities: resolveMembershipCapabilities(membership) };

  if (!player || player.teamId !== teamId || player.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Player not found' }, { status: 404 }) };
  }

  /**
   * ⚠ WORKING-SEASON ROSTER ONLY — this closes a dormant gap, deliberately (Design A, v1:
   * documents have NO historical surface). `rep_player_documents` carries no season column and
   * this resolver used to accept ANY roster row on the team, any year — nothing in the archive
   * linked here, but the route was reachable by id. Signed forms are a live instrument
   * ("collect fresh ones for the new season" is the rollover's own rule), so a past season's
   * roster row answers 404 — the same as a row that never existed, never a hint.
   */
  if (!workingYear || player.programYearId !== workingYear.id) {
    return { error: NextResponse.json({ error: 'Player not found' }, { status: 404 }) };
  }

  return { ctx, player, assignment };
}

function stripStoragePath<T extends { storagePath: string }>(doc: T): Omit<T, 'storagePath'> {
  const { storagePath: _sp, ...rest } = doc;
  return rest;
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, playerId);
  if ('error' in resolved) return resolved.error!;
  // Per-player forms need guardian-PII clearance too — the file itself may hold exactly the
  // details `redactRosterPlayer` nulls on this same player. Team templates gate on `documents` alone.
  const denied = denyUnless(canViewPlayerDocuments(resolved.assignment.capabilities), 'You do not have access to this player’s documents.');
  if (denied) return denied;

  const docs = await getRepPlayerDocuments(playerId);
  return NextResponse.json({ documents: docs.map(stripStoragePath) });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/documents' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, playerId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, player, assignment } = resolved;
  const denied = denyUnless(canManagePlayerDocuments(assignment.capabilities), 'You do not have permission to manage this player’s documents.');
  if (denied) return denied;

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
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/documents' });
