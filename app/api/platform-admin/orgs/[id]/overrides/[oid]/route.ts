import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';

export const DELETE = withObservability(async (_req: NextRequest,
  { params }: { params: Promise<{ id: string; oid: string }> }) => {
  const auth = await requirePlatformPermission('manage_billing');
  if (auth.response) return auth.response;

  const { id, oid } = await params;

  // Only flip a row that is still live (revoked_at IS NULL). Returning the affected rows lets us
  // detect a no-op — a wrong id, wrong org, or an already-revoked row — instead of reporting a
  // false success and writing a misleading audit entry (H5: revoke silent no-op).
  const { data: updated, error } = await supabaseAdmin
    .from('org_overrides')
    .update({ revoked_at: new Date().toISOString(), revoked_by: auth.user.email! })
    .eq('id', oid)
    .eq('org_id', id)
    .is('revoked_at', null)
    .select('id, revoked_at, revoked_by');

  if (error) {
    console.error('[platform-admin] override revoke error:', error);
    return NextResponse.json({ error: 'Revoke failed' }, { status: 500 });
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: 'Override not found or already revoked' },
      { status: 404 },
    );
  }

  await writePlatformAuditLog(
    auth.user.email!,
    id,
    'revoke_override',
    'id',
    oid,
    null,
  );

  return NextResponse.json({ ok: true, override: updated[0] });
}, { route: '/api/platform-admin/orgs/[id]/overrides/[oid]' });
