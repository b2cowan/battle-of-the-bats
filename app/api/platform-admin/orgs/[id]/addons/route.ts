import { NextRequest, NextResponse } from 'next/server';
import { getPlatformAuthContext } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getPlatformAuthContext();
  if (!user) return new NextResponse('Forbidden', { status: 403 });

  const { id } = await params;
  const body = await req.json() as { enabledAddons?: string[] };
  const { enabledAddons } = body;

  if (!Array.isArray(enabledAddons)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data: current } = await supabaseAdmin
    .from('organizations')
    .select('enabled_addons')
    .eq('id', id)
    .single();

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ enabled_addons: enabledAddons })
    .eq('id', id);

  if (error) {
    console.error('[platform-admin] addons update error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  await writePlatformAuditLog(
    user.email!,
    id,
    'update_addons',
    'enabled_addons',
    (current as any)?.enabled_addons ?? [],
    enabledAddons,
  );

  return NextResponse.json({ ok: true });
}
