import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase-admin';

function isBootstrapAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
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

  if (isBootstrapAdmin(user.email)) return user;

  const isDb = await isDbPlatformAdmin(user.email);
  return isDb ? user : null;
}

export function isPlatformAdmin(user: User | null | undefined): boolean {
  return isBootstrapAdmin(user?.email);
}
