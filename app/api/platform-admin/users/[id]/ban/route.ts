import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformPermission('manage_support');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json() as { action?: string; email?: string };
  const { action, email } = body;

  if (action !== 'ban' && action !== 'unban') {
    return NextResponse.json({ error: 'action must be "ban" or "unban"' }, { status: 400 });
  }

  const updatePayload = action === 'ban'
    ? { ban_duration: '87600h' }
    : { ban_duration: 'none' };

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, updatePayload);

  if (error) {
    console.error(`[platform-admin] ${action} user error:`, error);
    return NextResponse.json({ error: `Failed to ${action} user` }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email!,
    null,
    action === 'ban' ? 'ban_user' : 'unban_user',
    'user_id',
    action === 'ban' ? 'active' : 'banned',
    email ?? id,
  );

  return NextResponse.json({ ok: true });
}
