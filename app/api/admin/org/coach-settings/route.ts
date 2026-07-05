import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getOrgCoachSettings, type OrgCoachSettings } from '@/lib/assistant-invites';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

// GET — the org's coach_settings (Assistant Coaches). Rep-teams members may read; writes owner/admin.
export const GET = withObservability(async (req: NextRequest) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;
  return NextResponse.json(await getOrgCoachSettings(ctx!.org.id));
}, { route: '/api/admin/org/coach-settings' });

// POST — set the "require admin approval before an assistant coach gets access" lever.
export const POST = withObservability(async (req: NextRequest) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;
  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const body = await req.json().catch(() => ({}));
  // Merge onto existing settings so we never clobber future keys.
  const current = await getOrgCoachSettings(ctx!.org.id);
  const next: OrgCoachSettings = { ...current };
  if (typeof body.require_assistant_approval === 'boolean') {
    next.require_assistant_approval = body.require_assistant_approval;
  }

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ coach_settings: next })
    .eq('id', ctx!.org.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, coachSettings: next });
}, { route: '/api/admin/org/coach-settings' });
