import { NextRequest, NextResponse } from 'next/server';
import { getPlatformAuthContext, requirePlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformPermission('manage_billing');
  if (auth.response) return auth.response;

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('org_overrides')
    .select('*')
    .eq('org_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[platform-admin] overrides list error:', error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }

  return NextResponse.json({ overrides: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformPermission('manage_billing');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json() as {
    type?: string;
    value?: string;
    target?: { addons?: string[] } | null;
    expires_at?: string;
    suppress_billing?: boolean;
    reason?: string;
  };

  const { type, value, target, expires_at, suppress_billing, reason } = body;

  // plan_tier is schema-valid but not yet enforced (needs effective plan-rank) — block creation.
  if (!type || !['subscription_status', 'comp_period', 'module_addon'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }
  if (type === 'subscription_status' && !value) {
    return NextResponse.json({ error: 'value required for subscription_status' }, { status: 400 });
  }
  if (type === 'subscription_status' && !['active', 'trialing', 'past_due', 'canceled'].includes(value!)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
  }

  const ADDON_KEYS = ['module_public_site', 'module_house_league', 'module_accounting', 'module_rep_teams'];
  let normalizedTarget: Record<string, unknown> | null = null;
  if (type === 'module_addon') {
    const addons = target?.addons ?? [];
    if (!Array.isArray(addons) || addons.length === 0) {
      return NextResponse.json({ error: 'Select at least one module to grant' }, { status: 400 });
    }
    if (addons.some(a => !ADDON_KEYS.includes(a))) {
      return NextResponse.json({ error: 'Invalid module key' }, { status: 400 });
    }
    normalizedTarget = { addons };
  }

  if (!reason?.trim()) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }

  const { data: created, error } = await supabaseAdmin
    .from('org_overrides')
    .insert({
      org_id:     id,
      type,
      value:      value ?? null,
      target:     normalizedTarget,
      expires_at: expires_at ?? null,
      suppress_billing: suppress_billing ?? false,
      reason,
      created_by: auth.user.email!,
    })
    .select()
    .single();

  if (error) {
    console.error('[platform-admin] override insert error:', error);
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email!,
    id,
    'create_override',
    'type',
    null,
    { type, value, target: normalizedTarget, expires_at, suppress_billing, reason },
  );

  return NextResponse.json({ override: created });
}
