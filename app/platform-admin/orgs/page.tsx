import { supabaseAdmin } from '@/lib/supabase-admin';
import OrgsClient from './OrgsClient';

async function getFoundingSeasonOrgIds(): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from('org_overrides')
    .select('org_id')
    .eq('type', 'comp_period')
    .is('revoked_at', null)
    .gte('expires_at', '2026-12-31');
  return new Set((data ?? []).map(r => r.org_id as string));
}

async function getOrgs() {
  // Attention-filter windows mirror lib/platform-metrics.ts getCommandCenterStats
  // so this list's drill-through filters match the dashboard Action Queue counts.
  const now = new Date().toISOString();
  const trialWindowEnd = new Date(Date.now() + 14 * 86_400_000).toISOString();
  const inactiveOwnerCutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [orgsResult, foundingSeasonOrgIds, ownersResult, authUsersResult, overridesResult] = await Promise.all([
    supabaseAdmin
      .from('organizations')
      .select('id, name, slug, plan_id, subscription_status, current_period_end, created_at, enabled_addons, internal_notes')
      .order('created_at', { ascending: false }),
    getFoundingSeasonOrgIds(),
    supabaseAdmin
      .from('organization_members')
      .select('organization_id, user_id, status')
      .eq('role', 'owner')
      .limit(5000),
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabaseAdmin
      .from('org_overrides')
      .select('org_id, expires_at')
      .is('revoked_at', null)
      .not('expires_at', 'is', null)
      .limit(5000),
  ]);

  const { data, error } = orgsResult;
  if (error || !data) return [];

  const orgIds = data.map(row => row.id as string);
  const { data: noteRows } = orgIds.length > 0
    ? await supabaseAdmin
      .from('org_internal_notes')
      .select('org_id')
      .in('org_id', orgIds)
      .is('deleted_at', null)
    : { data: [] };
  const noteCounts = new Map<string, number>();
  for (const row of noteRows ?? []) {
    const orgId = row.org_id as string;
    noteCounts.set(orgId, (noteCounts.get(orgId) ?? 0) + 1);
  }

  // ── Attention sets (match the dashboard Action Queue definitions) ─────────
  const ownerRows = (ownersResult.data ?? []) as Array<{ organization_id: string; user_id: string; status: string | null }>;
  const ownerOrgIds = new Set(
    ownerRows.filter(m => (m.status ?? 'active') !== 'suspended').map(m => m.organization_id),
  );
  const ownersByOrg = new Map<string, string[]>();
  for (const m of ownerRows) {
    const list = ownersByOrg.get(m.organization_id) ?? [];
    list.push(m.user_id);
    ownersByOrg.set(m.organization_id, list);
  }
  const lastSignInByUser = new Map(
    (authUsersResult.data?.users ?? []).map(u => [u.id, u.last_sign_in_at ?? null]),
  );
  const expiredOverrideOrgIds = new Set(
    ((overridesResult.data ?? []) as Array<{ org_id: string; expires_at: string | null }>)
      .filter(o => o.expires_at && o.expires_at < now)
      .map(o => o.org_id),
  );

  return data.map(r => {
    const id = r.id as string;
    const ownerIds = ownersByOrg.get(id) ?? [];
    const mostRecentOwnerSignIn = ownerIds
      .map(uid => lastSignInByUser.get(uid) ?? null)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
    const status = r.subscription_status as string;
    const currentPeriodEnd = r.current_period_end as string | null;
    const noteCount = noteCounts.get(id) ?? 0;
    return {
      id,
      name:               r.name as string,
      slug:               r.slug as string,
      planId:             r.plan_id as string,
      subscriptionStatus: status,
      createdAt:          r.created_at as string,
      enabledAddons:      (r.enabled_addons as string[]) ?? [],
      internalNotes:      noteCount > 0
        ? `${noteCount} internal note${noteCount === 1 ? '' : 's'}`
        : ((r.internal_notes as string | null) ?? null),
      isFoundingSeason:   foundingSeasonOrgIds.has(id),
      missingOwner:       !ownerOrgIds.has(id),
      ownerInactive:      ownerIds.length > 0 && (!mostRecentOwnerSignIn || mostRecentOwnerSignIn < inactiveOwnerCutoff),
      expiredOverride:    expiredOverrideOrgIds.has(id),
      trialEndingSoon:    status === 'trialing' && Boolean(currentPeriodEnd) && (currentPeriodEnd as string) <= trialWindowEnd,
    };
  });
}

export default async function OrgsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; filter?: string }>;
}) {
  const { status, filter } = await searchParams;
  const orgs = await getOrgs();

  return <OrgsClient orgs={orgs} initialStatus={status ?? ''} initialFilter={filter ?? ''} />;
}
