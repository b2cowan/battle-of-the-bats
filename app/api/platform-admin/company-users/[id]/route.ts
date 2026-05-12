import { NextRequest, NextResponse } from 'next/server';
import { getPlatformAuthContext } from '@/lib/platform-auth';
import { getPlatformUsers, updatePlatformUser, deletePlatformUser, getPlatformUserByEmail } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getPlatformAuthContext();
  if (!user) return new NextResponse('Forbidden', { status: 403 });

  const { id } = await params;
  const { isActive, displayName } = await req.json();

  const updated = await updatePlatformUser(id, {
    ...(isActive    !== undefined && { isActive }),
    ...(displayName !== undefined && { displayName }),
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getPlatformAuthContext();
  if (!user) return new NextResponse('Forbidden', { status: 403 });

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
  return NextResponse.json({ ok: true });
}
