import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';

export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPermission('manage_support');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json() as { email?: string };

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
    email_confirm: true,
  });

  if (error) {
    console.error('[platform-admin] confirm-email error:', error);
    return NextResponse.json({ error: 'Failed to confirm email' }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'confirm_email',
    'user_id',
    'unconfirmed',
    body.email ?? id,
  );

  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/users/[id]/confirm-email' });
