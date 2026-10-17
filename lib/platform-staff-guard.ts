/**
 * A SUPPORT OR BILLING ACTION IS FOR CUSTOMERS' ACCOUNTS — ONLY A SUPER ADMIN ACTS ON A STAFF ACCOUNT (security fix,
 * 2026-10-16; the second sweep's second finding).
 *
 * The Customer users actions (change an email, lock, end sessions, confirm an email, send a password reset) sit behind
 * `manage_support`, which support and billing hold — and they took any account. A platform role is read from the
 * session's EMAIL (`getPlatformAdminContext`: the bootstrap list or an active `platform_users` row), so changing
 * emails was an escalation: free a super admin's email, give it to your own account, and your session is a super
 * admin. Now a support or billing caller is refused (403) when the account it targets, or an email it would set or
 * write to, is FieldLogicHQ staff. A super admin is unaffected (it manages platform users already).
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import { isPlatformAdminEmail, type PlatformRole } from './platform-auth';

export const STAFF_TARGET_REFUSAL = 'Only a super admin can act on a FieldLogicHQ staff account or email.';

/**
 * The refusal for a non-super-admin acting on staff, or null. `userId` is the account the action targets; `emails` are
 * any addresses it would set or send to. A target that can't be read fails CLOSED for a non-super-admin.
 */
export async function staffTargetRefusal(
  role: PlatformRole,
  target: { userId?: string | null; emails?: Array<string | null | undefined> },
): Promise<NextResponse | null> {
  if (role === 'super_admin') return null;
  const emails = (target.emails ?? []).filter((e): e is string => typeof e === 'string' && e.trim() !== '').map(e => e.trim().toLowerCase());
  if (target.userId) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(target.userId);
    if (error && error.status !== 404) return NextResponse.json({ error: STAFF_TARGET_REFUSAL }, { status: 403 });
    if (data?.user?.email) emails.push(data.user.email.toLowerCase());
  }
  for (const email of new Set(emails)) {
    if (await isPlatformAdminEmail(email)) return NextResponse.json({ error: STAFF_TARGET_REFUSAL }, { status: 403 });
  }
  return null;
}
