import { NextRequest, NextResponse } from 'next/server';
import { getPlatformAuthContext, requirePlatformPermission } from '@/lib/platform-auth';
import { getPlatformUsers, createPlatformUser } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';

export async function GET() {
  const user = await getPlatformAuthContext();
  if (!user) return new NextResponse('Forbidden', { status: 403 });

  const users = await getPlatformUsers();
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const auth = await requirePlatformPermission('manage_platform_users');
  if (auth.response) return auth.response;

  const { email, displayName, role } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  const safeRole = ['super_admin', 'support', 'billing', 'product', 'growth', 'read_only'].includes(role) ? role : 'support';

  const normalized = email.trim().toLowerCase();

  // Create Supabase auth account (email already confirmed, no org)
  const { error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: normalized,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Create platform_users record
  const platformUser = await createPlatformUser({
    email: normalized,
    displayName: displayName?.trim() || null,
    invitedBy: auth.user.email ?? null,
    role: safeRole,
  });

  await writePlatformAuditLog(
    auth.user.email ?? 'platform-admin',
    null,
    'invite_platform_user',
    'platform_users',
    null,
    { email: normalized, displayName: displayName?.trim() || null, role: safeRole },
  );

  // Generate a password setup link and return it so the admin can share it
  const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: normalized,
  });

  return NextResponse.json({
    user: platformUser,
    setupLink: linkData?.properties?.action_link ?? null,
  });
}
