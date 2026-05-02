import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getOrganizationByUserId } from './db';
import type { Organization } from './types';
import type { User } from '@supabase/supabase-js';

export interface AuthContext {
  user: User;
  org: Organization;
}

/**
 * Extracts the authenticated user and their organization from the request session cookie.
 * Returns null if the request is unauthenticated or the user has no org.
 * Use in all /api/admin/* route handlers before touching the database.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
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
  if (!user) return null;

  const org = await getOrganizationByUserId(user.id);
  if (!org) return null;

  return { user, org };
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
