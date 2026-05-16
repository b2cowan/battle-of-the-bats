import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabase-admin';
import type { Organization, OrgPlan, OrgRole } from './types';
import type { User } from '@supabase/supabase-js';
import { hasCapability } from './roles';
import type { Capability } from './roles';
import { assertSafeSupabaseServerEnvironment } from './supabase-safety';
import { getEffectiveTournamentLimit } from './plan-config';

export interface AuthContext {
  user: User;
  org: Organization;
}

export interface AuthContextWithScope extends AuthContext {
  role: OrgRole;
  capabilities: Record<string, boolean> | null;
  /** null = unrestricted (owner, or user with zero assignment rows) */
  assignedTournamentIds: string[] | null;
}

type AuthOrgRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  plan_id: OrgPlan;
  tournament_limit: number | null;
  subscription_status: Organization['subscriptionStatus'] | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  is_public: boolean | null;
  created_at: string;
  require_score_finalization: boolean | null;
  onboarding_completed_at: string | null;
  enabled_addons: string[] | null;
  contact_email: string | null;
};

/**
 * Extracts the authenticated user and their organization from the request session cookie.
 * Returns null if the request is unauthenticated or the user has no org.
 * Use in all /api/admin/* route handlers before touching the database.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  assertSafeSupabaseServerEnvironment('API auth Supabase client');

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
  // Suspended members are treated as unauthenticated — all routes return 401.
  const { data: memberData } = await supabaseAdmin
    .from('organization_members')
    .select('organizations(*)')
    .eq('user_id', user.id)
    .neq('status', 'suspended')
    .single<{ organizations: AuthOrgRow | null }>();

  const orgRow = memberData?.organizations;
  if (!orgRow) return null;

  const org: Organization = {
    id: orgRow.id,
    name: orgRow.name,
    slug: orgRow.slug,
    logoUrl: orgRow.logo_url ?? undefined,
    planId: orgRow.plan_id as OrgPlan,
    tournamentLimit: getEffectiveTournamentLimit(orgRow.plan_id as OrgPlan, orgRow.tournament_limit),
    subscriptionStatus: orgRow.subscription_status ?? 'active',
    stripeCustomerId: orgRow.stripe_customer_id ?? undefined,
    stripeSubscriptionId: orgRow.stripe_subscription_id ?? undefined,
    isPublic: orgRow.is_public ?? true,
    createdAt: orgRow.created_at,
    requireScoreFinalization: orgRow.require_score_finalization ?? false,
    onboardingCompletedAt: orgRow.onboarding_completed_at ?? null,
    enabledAddons: orgRow.enabled_addons ?? [],
    contactEmail: orgRow.contact_email ?? null,
  };

  return { user, org };
}

export interface AuthContextWithRole extends AuthContext {
  role: OrgRole;
  capabilities: Record<string, boolean> | null;
  /** null = unrestricted (no scope rows); array = restricted to those group IDs */
  repGroupIds: string[] | null;
}

export async function getAuthContextWithRole(): Promise<AuthContextWithRole | null> {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('id, role, capabilities')
    .eq('organization_id', ctx.org.id)
    .eq('user_id', ctx.user.id)
    .single();

  if (!member) return null;

  const role = member.role as OrgRole;
  const capabilities = (member.capabilities as Record<string, boolean> | null) ?? null;

  // Owners, admins, and treasurers are always unrestricted
  if (role === 'owner' || role === 'admin' || role === 'treasurer') {
    return { ...ctx, role, capabilities, repGroupIds: null };
  }

  const { data: scopes } = await supabaseAdmin
    .from('org_member_rep_group_scopes')
    .select('group_id')
    .eq('member_id', member.id);

  const repGroupIds = scopes?.length ? scopes.map(s => s.group_id as string) : null;

  return { ...ctx, role, capabilities, repGroupIds };
}

/**
 * Returns a 403 if the caller has a rep group scope that excludes this team.
 * Pass the team's groupId (may be null for ungrouped teams).
 * Scoped members cannot access ungrouped teams.
 */
export function repGroupScopeGuard(ctx: AuthContextWithRole, teamGroupId: string | null): Response | null {
  if (!ctx.repGroupIds) return null;
  if (!teamGroupId || !ctx.repGroupIds.includes(teamGroupId)) return forbidden();
  return null;
}

/**
 * Full scope context: role + capabilities + tournament assignment list.
 * assignedTournamentIds === null means the user is unrestricted (owner, or no assignment rows).
 * Routes that filter by tournament must use this instead of getAuthContext().
 */
export async function getAuthContextWithScope(): Promise<AuthContextWithScope | null> {
  const ctx = await getAuthContext();
  if (!ctx) return null;

  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('id, role, capabilities')
    .eq('organization_id', ctx.org.id)
    .eq('user_id', ctx.user.id)
    .single();

  if (!member) return null;

  const role = member.role as OrgRole;
  const capabilities = (member.capabilities as Record<string, boolean> | null) ?? null;

  // Owners are always unrestricted — skip the assignments query
  if (role === 'owner') {
    return { ...ctx, role, capabilities, assignedTournamentIds: null };
  }

  const { data: assignments } = await supabaseAdmin
    .from('org_member_tournament_assignments')
    .select('tournament_id')
    .eq('org_member_id', member.id);

  // No assignment rows = unrestricted (absence-means-unrestricted semantics)
  const assignedTournamentIds = assignments?.length
    ? assignments.map(a => a.tournament_id as string)
    : null;

  return { ...ctx, role, capabilities, assignedTournamentIds };
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function forbidden() {
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Returns a 403 if the calling user does not have the required capability.
 * Now reads capabilities column (Phase 1+).
 */
export async function requireCapability(ctx: AuthContext, cap: Capability): Promise<Response | null> {
  const { data } = await supabaseAdmin
    .from('organization_members')
    .select('role, capabilities')
    .eq('organization_id', ctx.org.id)
    .eq('user_id', ctx.user.id)
    .single();

  if (!data || !hasCapability(data.role as OrgRole, (data.capabilities as Record<string, boolean> | null) ?? null, cap)) {
    return forbidden();
  }
  return null;
}

/**
 * Returns a 403 if the user has a non-null assignment list that does not include tournamentId.
 * null assignedTournamentIds = unrestricted; always passes.
 */
export function scopeGuard(ctx: AuthContextWithScope, tournamentId: string): Response | null {
  if (ctx.assignedTournamentIds !== null && !ctx.assignedTournamentIds.includes(tournamentId)) {
    return forbidden();
  }
  return null;
}
