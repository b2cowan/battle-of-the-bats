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
import { withObservability } from '@/lib/observability';
import { refuseTeamOutsideClub, teamIdsInScope } from '@/lib/club-team-route';
import type { AuthContextWithRole } from '@/lib/api-auth';

/** A group-limited member reaches a club-wide template or one of their groups' teams' — no other. */
async function refuseOutOfScope(ctx: AuthContextWithRole, teamId: string | null): Promise<Response | null> {
  const inScope = await teamIdsInScope(ctx);
  if (!inScope) return null;
  return !teamId || inScope.has(teamId) ? null : forbidden();
}

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

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ templateId: string }> },) => {
  const { templateId } = await params;
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const resolved = await resolveTemplate(templateId, ctx!.org.id);
  if ('error' in resolved) return resolved.error!;
  const { template } = resolved;
  const outOfScope = await refuseOutOfScope(ctx!, template.teamId);
  if (outOfScope) return outOfScope;

  const { data, error } = await supabaseAdmin.storage
    .from('rep-team-documents')
    .createSignedUrl(template.storagePath, 3600);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  return NextResponse.json({ url: data.signedUrl, expiresAt });
}, { route: '/api/admin/rep-teams/document-templates/[templateId]' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ templateId: string }> },) => {
  const { templateId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const resolved = await resolveTemplate(templateId, ctx!.org.id);
  if ('error' in resolved) return resolved.error!;

  const outOfScope = await refuseOutOfScope(ctx!, resolved.template.teamId);
  if (outOfScope) return outOfScope;

  const body = await req.json();
  const fields: { isActive?: boolean; teamId?: string | null } = {};
  if (typeof body.isActive === 'boolean') fields.isActive = body.isActive;
  // "Applies to" (Club Tier Stage 2, specimen 8's team picker): a team of THIS club, or null for
  // every team — checked exactly as the create checks it (B11 / J4-009).
  if ('teamId' in body) {
    const teamId = body.teamId === null || body.teamId === '' ? null
      : typeof body.teamId === 'string' ? body.teamId : undefined;
    if (teamId === undefined) return NextResponse.json({ error: 'Choose a team, or every team.' }, { status: 400 });
    if (teamId) {
      const refused = await refuseTeamOutsideClub(ctx!, teamId);
      if (refused) return refused;
    } else if (ctx!.repGroupIds) {
      return forbidden();
    }
    fields.teamId = teamId;
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'isActive (boolean) or teamId is required' }, { status: 400 });
  }

  const updated = await updateRepDocumentTemplate(templateId, fields);
  const { storagePath: _sp, ...rest } = updated;
  return NextResponse.json({ template: rest });
}, { route: '/api/admin/rep-teams/document-templates/[templateId]' });

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ templateId: string }> },) => {
  const { templateId } = await params;
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const resolved = await resolveTemplate(templateId, ctx!.org.id);
  if ('error' in resolved) return resolved.error!;
  const { template } = resolved;
  const outOfScope = await refuseOutOfScope(ctx!, template.teamId);
  if (outOfScope) return outOfScope;

  await supabaseAdmin.storage.from('rep-team-documents').remove([template.storagePath]);
  await deleteRepDocumentTemplate(templateId);

  return NextResponse.json({ ok: true });
}, { route: '/api/admin/rep-teams/document-templates/[templateId]' });
