import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase-admin';
import { getAuthenticatedUser } from './api-auth';

export type PlatformRole = 'super_admin' | 'support' | 'billing' | 'product' | 'growth' | 'read_only';

export type PlatformPermission =
  | 'manage_platform_users'
  | 'manage_billing'
  | 'manage_growth'
  | 'manage_product'
  | 'manage_support'
  | 'view_platform_admin';

export type PlatformAuthContext = {
  user: User;
  role: PlatformRole;
  isBootstrapAdmin: boolean;
};

const ROLE_PERMISSIONS: Record<PlatformRole, PlatformPermission[]> = {
  super_admin: ['manage_platform_users', 'manage_billing', 'manage_growth', 'manage_product', 'manage_support', 'view_platform_admin'],
  support: ['manage_support', 'view_platform_admin'],
  billing: ['manage_billing', 'manage_support', 'view_platform_admin'],
  product: ['manage_growth', 'manage_product', 'view_platform_admin'],
  growth: ['manage_growth', 'view_platform_admin'],
  read_only: ['view_platform_admin'],
};

export function getBootstrapAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isBootstrapAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return getBootstrapAdminEmails().includes(email.toLowerCase());
}

function normalizePlatformRole(role: string | null | undefined): PlatformRole {
  if (role === 'admin') return 'super_admin';
  if (role === 'super_admin' || role === 'support' || role === 'billing' || role === 'product' || role === 'growth' || role === 'read_only') {
    return role;
  }
  return 'read_only';
}

async function getDbPlatformRole(email: string): Promise<PlatformRole | null> {
  const { data } = await supabaseAdmin
    .from('platform_users')
    .select('role, is_active')
    .eq('email', email.toLowerCase())
    .eq('is_active', true)
    .maybeSingle();
  return data ? normalizePlatformRole(data.role) : null;
}

export async function isPlatformAdminEmail(email: string): Promise<boolean> {
  if (isBootstrapAdmin(email)) return true;
  return (await getDbPlatformRole(email)) !== null;
}

export function hasPlatformPermission(role: PlatformRole, permission: PlatformPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export async function getPlatformAdminContext(): Promise<PlatformAuthContext | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  if (isBootstrapAdmin(user.email)) {
    return { user, role: 'super_admin', isBootstrapAdmin: true };
  }

  const role = await getDbPlatformRole(user.email);
  return role ? { user, role, isBootstrapAdmin: false } : null;
}

export async function getPlatformAuthContext(): Promise<User | null> {
  const auth = await getPlatformAdminContext();
  return auth?.user ?? null;
}

export async function requirePlatformAdmin(): Promise<
  { user: User; role: PlatformRole; response: null } | { user: null; role: null; response: NextResponse }
> {
  const auth = await getPlatformAdminContext();
  if (!auth) return { user: null, role: null, response: new NextResponse('Forbidden', { status: 403 }) };
  return { user: auth.user, role: auth.role, response: null };
}

export async function requirePlatformPermission(permission: PlatformPermission): Promise<
  { user: User; role: PlatformRole; response: null } | { user: null; role: null; response: NextResponse }
> {
  const auth = await requirePlatformAdmin();
  if (auth.response) return auth;
  if (!hasPlatformPermission(auth.role, permission)) {
    return { user: null, role: null, response: NextResponse.json({ error: 'Insufficient platform role' }, { status: 403 }) };
  }
  return auth;
}

export async function requireAnyPlatformPermission(permissions: PlatformPermission[]): Promise<
  { user: User; role: PlatformRole; response: null } | { user: null; role: null; response: NextResponse }
> {
  const auth = await requirePlatformAdmin();
  if (auth.response) return auth;
  if (!permissions.some(permission => hasPlatformPermission(auth.role, permission))) {
    return { user: null, role: null, response: NextResponse.json({ error: 'Insufficient platform role' }, { status: 403 }) };
  }
  return auth;
}

export async function requireDevToolPlatformAdmin(): Promise<
  { user: User; role: PlatformRole; response: null } | { user: null; role: null; response: NextResponse }
> {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true') {
    return {
      user: null,
      role: null,
      response: NextResponse.json({ error: 'Not found' }, { status: 404 }),
    };
  }

  const auth = await requirePlatformAdmin();
  if (auth.response) {
    return {
      user: null,
      role: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return auth;
}

/**
 * Dev-tool access that requires NEXT_PUBLIC_ENABLE_DEV_TOOLS=true + any authenticated
 * Supabase user. Use for seed/wipe/status/memberships — routes you need after testing
 * the signup flow (which replaces the platform-admin session cookie with the new org
 * user's session). More sensitive operations (platform user seeding, plan gates) keep
 * requireDevToolPlatformAdmin.
 *
 * Never set NEXT_PUBLIC_ENABLE_DEV_TOOLS=true in production. The production guard here
 * is a belt-and-suspenders fallback only.
 */
export async function requireDevToolUserAuth(): Promise<
  { user: User; role: PlatformRole; response: null } | { user: null; role: null; response: NextResponse }
> {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true') {
    return {
      user: null,
      role: null,
      response: NextResponse.json({ error: 'Not found' }, { status: 404 }),
    };
  }
  if (process.env.NODE_ENV === 'production') {
    return {
      user: null,
      role: null,
      response: NextResponse.json({ error: 'Not found' }, { status: 404 }),
    };
  }
  const user = await getAuthenticatedUser();
  if (!user) {
    return {
      user: null,
      role: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { user, role: 'super_admin', response: null };
}
