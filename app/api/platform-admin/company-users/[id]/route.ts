import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { getPlatformUsers, updatePlatformUser, deletePlatformUser } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { requireFreshCode } from '@/lib/two-step-fresh';
import { findAuthUserIdByEmail } from '@/lib/auth-account-lookup';
import { readAccountKeepFacts } from '@/lib/member-account-keep-server';

type Params = { params: Promise<{ id: string }> };

export const PATCH = withObservability(async (req: NextRequest, { params }: Params) => {
  const auth = await requirePlatformPower('staff');
  if (auth.response) return auth.response;

  const { id } = await params;
  const { isActive, displayName, role } = await req.json();
  const safeRole = role && ['super_admin', 'support', 'billing', 'product', 'growth', 'read_only'].includes(role) ? role : undefined;
  const before = (await getPlatformUsers()).find(platformUser => platformUser.id === id) ?? null;

  // Raising an account to super admin, or bringing a removed one back, asks for a code (Board Ready two-step, Part 2;
  // owner 2026-11-11). A rename or a lowered role does not.
  const raising = safeRole === 'super_admin' && before?.role !== safeRole;
  const restoring = isActive === true && before !== null && !before.isActive;
  if (raising || restoring) {
    const stale = await requireFreshCode();
    if (stale) return stale;
  }

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
  const auth = await requirePlatformPower('staff');
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

  // Safety net: never leave the platform with nobody who can administer it. The configured
  // bootstrap admin(s) always count as a fallback (they can't be removed via UI), so a stored
  // teammate can be removed whenever a bootstrap admin exists or another active user remains.
  // (Previously this counted only DB-stored users and ignored the bootstrap admin, so removing
  // the last stored teammate — even a Support user — was wrongly blocked as "the last admin".)
  if (active.length === 0 && envList.length === 0) {
    return NextResponse.json({ error: 'Cannot remove the last platform user — configure a bootstrap admin first.' }, { status: 400 });
  }

  // ⚖ Leftover call 4 (owner 2026-11-19). Everything is READ before anything is removed, and a read that can't answer
  // refuses with nothing removed (the old code read one unpaged, case-sensitive page of accounts and skipped silently, so
  // a staff member past the first page lost their row but kept their sign-in, and the reverse was possible too).
  //   · the sign-in is found by the platform's one paged, case-insensitive lookup (fails closed);
  //   · staff access always ends (the platform_users row goes);
  //   · the sign-in is deleted only when nothing else uses the account: the member removal's own keep test
  //     (readAccountKeepFacts, with no club: any club seat, an active free Coaches Portal team or a live family link
  //     keeps it). Not a second test.
  let authUserId: string | null;
  let keptReason: string | null = null;
  try {
    authUserId = await findAuthUserIdByEmail(target.email);
    if (authUserId) keptReason = (await readAccountKeepFacts(authUserId, null)).reason;
  } catch (e) {
    console.error('[company-users] removal refused: the account lookup failed', e);
    return NextResponse.json(
      { error: 'We couldn’t check this person’s sign-in just now, so nothing was removed. Try again.', code: 'lookup_failed' },
      { status: 503 },
    );
  }

  // The sign-in goes FIRST (when nothing else uses it), so a failed delete refuses with the staff row still there and a
  // retry still possible; the staff row goes after it. (A row delete that fails after a deleted sign-in throws; a retry
  // then finds no sign-in and removes the row.)
  let signIn: 'deleted' | 'kept' | 'none' = 'none';
  if (authUserId && keptReason) signIn = 'kept';
  else if (authUserId) {
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
    if (delErr) {
      console.error('[company-users] removal refused: the sign-in could not be deleted', delErr);
      return NextResponse.json(
        { error: 'We couldn’t remove this person’s sign-in just now, so nothing was removed. Try again.', code: 'delete_failed' },
        { status: 503 },
      );
    }
    signIn = 'deleted';
  }

  await deletePlatformUser(id);

  await writePlatformAuditLog(
    auth.user.email ?? 'platform-admin',
    null,
    'remove_platform_user',
    'platform_users',
    target,
    { signIn, keptReason },
  );
  return NextResponse.json({ ok: true, signIn, keptReason });
}, { route: '/api/platform-admin/company-users/[id]' });
