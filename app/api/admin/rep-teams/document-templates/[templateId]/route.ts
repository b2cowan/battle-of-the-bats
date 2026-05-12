import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import {
  getRepDocumentTemplateById,
  updateRepDocumentTemplate,
  deleteRepDocumentTemplate,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

async function resolveTemplate(templateId: string, orgId: string) {
  const template = await getRepDocumentTemplateById(templateId);
  if (!template || template.orgId !== orgId) {
    return { error: NextResponse.json({ error: 'Template not found' }, { status: 404 }) };
  }
  return { template };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await params;
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const resolved = await resolveTemplate(templateId, ctx!.org.id);
  if ('error' in resolved) return resolved.error;
  const { template } = resolved;

  const { data, error } = await supabaseAdmin.storage
    .from('rep-team-documents')
    .createSignedUrl(template.storagePath, 3600);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  return NextResponse.json({ url: data.signedUrl, expiresAt });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await params;
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const resolved = await resolveTemplate(templateId, ctx!.org.id);
  if ('error' in resolved) return resolved.error;

  const body = await req.json();
  if (typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive (boolean) is required' }, { status: 400 });
  }

  const updated = await updateRepDocumentTemplate(templateId, { isActive: body.isActive });
  const { storagePath: _sp, ...rest } = updated;
  return NextResponse.json({ template: rest });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await params;
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const resolved = await resolveTemplate(templateId, ctx!.org.id);
  if ('error' in resolved) return resolved.error;
  const { template } = resolved;

  await supabaseAdmin.storage.from('rep-team-documents').remove([template.storagePath]);
  await deleteRepDocumentTemplate(templateId);

  return NextResponse.json({ ok: true });
}
