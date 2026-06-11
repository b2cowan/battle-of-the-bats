import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { getPlatformUsers, updatePlatformUser, deletePlatformUser } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';

type Params = { params: Promise<{ id: string }> };

export const PATCH = withObservability(async (req: NextRequest, { params }: Params) => {
  const auth = await requirePlatformPermission('manage_platform_users');
  if (auth.response) return auth.response;

  const { id } = await params;
  const { isActive, displayName, role } = await req.json();
  const safeRole = role && ['super_admin', 'support', 'billing', 'product', 'growth', 'read_only'].includes(role) ? role : undefined;
  const before = (await getPlatformUsers()).find(platformUser => platformUser.id === id) ?? null;

  const updated = await updatePlatformUser(id, {
    ...(isActive    !== undefined && { isActive }),
    ...(displayName !== undefined && { displayName }),
    ...(safeRole    !== undefined && { role: safeRole }),
  });

  await writePlatformAuditLog(
    auth.user.email ?? 'platform-admin',
    null,
    'update_platform_user',
    'platform_users',
    before,
    updated,
  );

  return NextResponse.json(updated);
}, { route: '/api/platform-admin/company-users/[id]' });

export const DELETE = withObservability(async (_req: NextRequest, { params }: Params) => {
  const auth = await requirePlatformPermission('manage_platform_users');
  if (auth.response) return auth.response;

  const { id } = await params;

  // Prevent removing the last active platform user
  const all = await getPlatformUsers();
  const active = all.filter(u => u.isActive && u.id !== id);
  const target = all.find(u => u.id === id);

  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  // Bootstrap env-var users cannot be removed via UI
  const envList = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (envList.includes(target.email.toLowerCase())) {
    return NextResponse.json({ error: 'Bootstrap admin cannot be removed.' }, { status: 400 });
  }

  if (active.length === 0) {
    return NextResponse.json({ error: 'Cannot remove the last active platform admin.' }, { status: 400 });
  }

  // Delete auth user
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
  const authUser = authUsers?.users.find(u => u.email === target.email);
  if (authUser) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.id);
  }

  await deletePlatformUser(id);
  await writePlatformAuditLog(
    auth.user.email ?? 'platform-admin',
    null,
    'remove_platform_user',
    'platform_users',
    target,
    null,
  );
  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/company-users/[id]' });
