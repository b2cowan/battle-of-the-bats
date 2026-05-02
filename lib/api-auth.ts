import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabase-admin';
import type { Organization, OrgPlan } from './types';
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

  // Use admin client — anon client can't read organization_members under RLS
  const { data: memberData } = await supabaseAdmin
    .from('organization_members')
    .select('organizations(*)')
    .eq('user_id', user.id)
    .single();

  const orgRow = (memberData as any)?.organizations;
  if (!orgRow) return null;

  const org: Organization = {
    id: orgRow.id,
    name: orgRow.name,
    slug: orgRow.slug,
    logoUrl: orgRow.logo_url ?? null,
    planId: orgRow.plan_id as OrgPlan,
    tournamentLimit: orgRow.tournament_limit,
    subscriptionStatus: orgRow.subscription_status,
    isPublic: orgRow.is_public,
    createdAt: orgRow.created_at,
  };

  return { user, org };
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
