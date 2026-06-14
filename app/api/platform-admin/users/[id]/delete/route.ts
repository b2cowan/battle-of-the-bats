import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';

export const DELETE = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  // Permanent, irreversible account deletion → super_admin only (matches org delete).
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const url   = new URL(req.url);
  const email = url.searchParams.get('email') ?? id;

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

  if (error) {
    console.error('[platform-admin] delete-user error:', error);
    return NextResponse.json({ error: error.message ?? 'Failed to delete user' }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'delete_user',
    'user_id',
    email,
    null,
  );

  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/users/[id]/delete' });
