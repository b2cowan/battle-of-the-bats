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
    expires_at?: string;
    reason?: string;
  };

  const { type, value, expires_at, reason } = body;

  if (!type || !['subscription_status', 'comp_period'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }
  if (type === 'subscription_status' && !value) {
    return NextResponse.json({ error: 'value required for subscription_status' }, { status: 400 });
  }
  if (type === 'subscription_status' && !['active', 'trialing', 'past_due', 'canceled'].includes(value!)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
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
      expires_at: expires_at ?? null,
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
    { type, value, expires_at, reason },
  );

  return NextResponse.json({ override: created });
}
