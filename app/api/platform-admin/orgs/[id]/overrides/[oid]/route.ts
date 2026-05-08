import { NextRequest, NextResponse } from 'next/server';
import { getPlatformAuthContext } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; oid: string }> }
) {
  const user = await getPlatformAuthContext();
  if (!user) return new NextResponse('Forbidden', { status: 403 });

  const { id, oid } = await params;

  const { error } = await supabaseAdmin
    .from('org_overrides')
    .update({ revoked_at: new Date().toISOString(), revoked_by: user.email! })
    .eq('id', oid)
    .eq('org_id', id);

  if (error) {
    console.error('[platform-admin] override revoke error:', error);
    return NextResponse.json({ error: 'Revoke failed' }, { status: 500 });
  }

  await writePlatformAuditLog(
    user.email!,
    id,
    'revoke_override',
    'id',
    oid,
    null,
  );

  return NextResponse.json({ ok: true });
}
