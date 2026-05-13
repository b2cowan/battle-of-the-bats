import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase-admin';

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

async function isDbPlatformAdmin(email: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('platform_users')
    .select('is_active')
    .eq('email', email.toLowerCase())
    .eq('is_active', true)
    .maybeSingle();
  return !!data;
}

export async function isPlatformAdminEmail(email: string): Promise<boolean> {
  if (isBootstrapAdmin(email)) return true;
  return isDbPlatformAdmin(email);
}

export async function getPlatformAuthContext(): Promise<User | null> {
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

  return (await isPlatformAdminEmail(user.email)) ? user : null;
}

export async function requirePlatformAdmin(): Promise<
  { user: User; response: null } | { user: null; response: NextResponse }
> {
  const user = await getPlatformAuthContext();
  if (!user) return { user: null, response: new NextResponse('Forbidden', { status: 403 }) };
  return { user, response: null };
}

export async function requireDevToolPlatformAdmin(): Promise<
  { user: User; response: null } | { user: null; response: NextResponse }
> {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true') {
    return {
      user: null,
      response: NextResponse.json({ error: 'Not found' }, { status: 404 }),
    };
  }

  const auth = await requirePlatformAdmin();
  if (auth.response) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return auth;
}
