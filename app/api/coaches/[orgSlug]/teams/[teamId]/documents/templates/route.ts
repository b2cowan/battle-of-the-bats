import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getRepDocumentTemplates,
  createRepDocumentTemplate,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { RepDocumentType } from '@/lib/types';

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE = 10 * 1024 * 1024;
const VALID_DOC_TYPES: RepDocumentType[] = ['waiver', 'medical_consent', 'code_of_conduct', 'other'];

async function resolveContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext();
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Team not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.find(a => a.teamId === teamId)) return { error: forbidden() };

  return { ctx, team };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },
) {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx } = resolved;

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
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },
) {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, team } = resolved;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const name = (formData.get('name') as string | null)?.trim();
  const documentType = formData.get('documentType') as string | null;

  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
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
  const storagePath = `${ctx.org.id}/teams/${teamId}/templates/${crypto.randomUUID()}-${file.name}`;

  const { error: storageError } = await supabaseAdmin.storage
    .from('rep-team-documents')
    .upload(storagePath, bytes, { contentType: file.type });

  if (storageError) {
    return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 });
  }

  const template = await createRepDocumentTemplate({
    orgId: ctx.org.id,
    teamId: team.id,
    name,
    documentType: documentType as RepDocumentType,
    storagePath,
    fileName: file.name,
    fileSize: file.size,
    publishedBy: ctx.user.id,
  });

  const { storagePath: _sp, ...rest } = template;
  return NextResponse.json({ template: rest }, { status: 201 });
}
