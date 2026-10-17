import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { staffTargetRefusal } from '@/lib/platform-staff-guard';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';

export const PATCH = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPermission('manage_support');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json() as { email?: string; displayName?: string; currentEmail?: string };
  const { email, displayName, currentEmail } = body;
  // Support and billing act on customers' accounts: not a staff account, and never to a staff email (2026-10-16).
  const staffRefused = await staffTargetRefusal(auth.role, { userId: id, emails: [email] });
  if (staffRefused) return staffRefused;

  if (!email && displayName === undefined) {
    return NextResponse.json({ error: 'Provide email and/or displayName.' }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {};
  if (email) {
    updatePayload.email = email.trim().toLowerCase();
    updatePayload.email_confirm = true;
  }
  if (displayName !== undefined) {
    updatePayload.user_metadata = { display_name: displayName.trim() };
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, updatePayload);

  if (error) {
    console.error('[platform-admin] update-user error:', error);
    return NextResponse.json({ error: error.message ?? 'Failed to update user' }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'update_user',
    'user_id',
    currentEmail ?? id,
    email ?? displayName ?? '(display name)',
  );

  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/users/[id]/update' });
