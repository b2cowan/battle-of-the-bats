import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getRepDocumentTemplates, createRepDocumentTemplate } from '@/lib/db';
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

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

export async function GET(
  _req: Request,
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const templates = await getRepDocumentTemplates(ctx!.org.id);
  const withoutPaths = templates.map(({ storagePath: _sp, ...rest }) => rest);
  return NextResponse.json({ templates: withoutPaths });
}

export async function POST(
  req: Request,
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const name = (formData.get('name') as string | null)?.trim();
  const documentType = formData.get('documentType') as string | null;
  const teamId = (formData.get('teamId') as string | null) || null;

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
  const scope = teamId ? `teams/${teamId}` : 'org-wide';
  const storagePath = `${ctx!.org.id}/templates/${scope}/${crypto.randomUUID()}-${file.name}`;

  const { error: storageError } = await supabaseAdmin.storage
    .from('rep-team-documents')
    .upload(storagePath, bytes, { contentType: file.type });

  if (storageError) {
    return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 });
  }

  const template = await createRepDocumentTemplate({
    orgId: ctx!.org.id,
    teamId: teamId || null,
    name,
    documentType: documentType as RepDocumentType,
    storagePath,
    fileName: file.name,
    fileSize: file.size,
    publishedBy: ctx!.user.id,
  });

  const { storagePath: _sp, ...rest } = template;
  return NextResponse.json({ template: rest }, { status: 201 });
}
