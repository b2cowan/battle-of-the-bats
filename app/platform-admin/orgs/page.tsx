import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import { FOUNDING_SEASON_COMP_EXPIRIES } from '@/lib/plan-config';
import OrgsClient from './OrgsClient';
import { clubDomainStore } from '@/lib/club-domain-store';
import { peopleByIds } from '@/lib/platform-people-lookup';
import { fetchAll } from '@/lib/supabase-paging';
import { freeTimePortalOrgIds } from '@/lib/portal-free-time-server';

/**
 * ⚠ RECOGNITION IS THE SHARED RULE, NEVER A HAND-TYPED DATE (fixed 2026-09-07).
 *
 * This used to match `expires_at >= '2026-12-31'`, which is not what a Founding Season comp is —
 * it is what a comp expiring at ANY point after 2026 is. A support comp granted into 2028, or a
 * platform-admin extension, was badged "Founding" here and dropped into the Founding filter, while
 * every other surface in the product (the status endpoint, the email audiences, the desk) used
 * `FOUNDING_SEASON_COMP_EXPIRIES` and disagreed. Same rule everywhere now: the current instant OR
 * the legacy pre-2026-09-07 one, and never a revoked comp.
 */
async function getFoundingSeasonOrgIds(): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from('org_overrides')
    .select('org_id')
    .eq('type', 'comp_period')
    .is('revoked_at', null)
    .in('expires_at', [...FOUNDING_SEASON_COMP_EXPIRIES]);
  return new Set((data ?? []).map(r => r.org_id as string));
}

/**
 * Every organization, a page at a time through the shared paging rule (Support console Stage 2). The unbounded select
 * this replaced stopped at the database's default row cap without saying so — the same silent-cap bug the 1,000-account
 * page was.
 */
async function readEveryOrganization(): Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }> {
  try {
    const data = await fetchAll<Record<string, unknown>>((from, to) => supabaseAdmin
      .from('organizations')
      .select('id, name, slug, plan_id, subscription_status, current_period_end, created_at, enabled_addons, internal_notes, free_floor')
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to));
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

async function getOrgs() {
  // Attention-filter windows mirror lib/platform-metrics.ts getCommandCenterStats
  // so this list's drill-through filters match the dashboard Action Queue counts.
  const now = new Date().toISOString();
  const trialWindowEnd = new Date(Date.now() + 14 * 86_400_000).toISOString();
  const inactiveOwnerCutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [orgsResult, foundingSeasonOrgIds, freeTimePortals, ownersResult, overridesResult, ownAddressRows] = await Promise.all([
    readEveryOrganization(),
    getFoundingSeasonOrgIds(),
    // Stage 4b (T35): a portal staff gave free time is stored cancelled; it is not a cancelled customer.
    freeTimePortalOrgIds().catch(() => new Set<string>()),
    supabaseAdmin
      .from('organization_members')
      .select('organization_id, user_id, status')
      .eq('role', 'owner')
      .limit(5000),
    supabaseAdmin
      .from('org_overrides')
      .select('org_id, expires_at')
      .is('revoked_at', null)
      .not('expires_at', 'is', null)
      .limit(5000),
    // Who holds which own web address (Club Tier Stage 4e); a table that is not there yet reads as none.
    clubDomainStore.listAll().catch(() => []),
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
  // Who holds which own web address (Club Tier Stage 4e), so support can search an address to find its club. A table that is not
  // there yet reads as none.
  const ownAddresses = new Map(ownAddressRows.map(r => [r.org_id, r.full_name]));
  const noteCounts = new Map<string, number>();
  for (const row of noteRows ?? []) {
    const orgId = row.org_id as string;
    noteCounts.set(orgId, (noteCounts.get(orgId) ?? 0) + 1);
  }

  // ── Empty-org detection ───────────────────────────────────────────────────
  // An "empty org" has no real work in it: no tournaments, no league seasons, no rep
  // teams, and no members beyond the single owner. These are the junk-org residue left
  // by an owner who created an account/org but never populated it (the signup flow keeps
  // org-create pre-verify by decision, so unverified/abandoned owners keep producing
  // them). Support surfaces + manually cleans these — we never auto-delete.
  // Batched .in() lookups (one query per content table) — no per-org N+1.
  // CRITICAL: these select one row PER content row (not per org), so without an explicit
  // limit they hit PostgREST's default 1000-row cap. A truncated result would drop a real
  // org from `orgsWithContent`/`memberCounts` and FALSELY label it "Empty" — a
  // delete-the-wrong-thing hazard for support. We cap high (50k, matching the .limit(5000)
  // idiom on the owner/override queries above, sized up for row-per-content) so truncation
  // can't happen at realistic platform scale. If a single table ever exceeds 50k rows,
  // revisit with a per-org aggregate; until then this is the safe, simple bound.
  const CONTENT_ROW_CAP = 50000;
  const [tournamentRows, leagueSeasonRows, repTeamRows, memberRows] = orgIds.length > 0
    ? await Promise.all([
        supabaseAdmin.from('tournaments').select('org_id').in('org_id', orgIds).limit(CONTENT_ROW_CAP),
        supabaseAdmin.from('league_seasons').select('org_id').in('org_id', orgIds).limit(CONTENT_ROW_CAP),
        supabaseAdmin.from('rep_teams').select('org_id').in('org_id', orgIds).limit(CONTENT_ROW_CAP),
        supabaseAdmin.from('organization_members').select('organization_id').in('organization_id', orgIds).limit(CONTENT_ROW_CAP),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const orgsWithContent = new Set<string>();
  for (const r of (tournamentRows.data ?? []) as Array<{ org_id: string }>) orgsWithContent.add(r.org_id);
  for (const r of (leagueSeasonRows.data ?? []) as Array<{ org_id: string }>) orgsWithContent.add(r.org_id);
  for (const r of (repTeamRows.data ?? []) as Array<{ org_id: string }>) orgsWithContent.add(r.org_id);

  const memberCounts = new Map<string, number>();
  for (const r of (memberRows.data ?? []) as Array<{ organization_id: string }>) {
    memberCounts.set(r.organization_id, (memberCounts.get(r.organization_id) ?? 0) + 1);
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
  // The owners' last sign-in, by account id with no cap (Support console Stage 2): it was the first page of 1,000
  // accounts, so an owner past that page always read as inactive.
  const owners = await peopleByIds(ownerRows.map(m => m.user_id)).catch(() => new Map<string, { lastSignInAt: string | null }>());
  const lastSignInByUser = new Map([...owners].map(([id, p]) => [id, p.lastSignInAt]));
  // Orgs with an active override expiring within the next 14 days (and not yet lapsed). Expired
  // overrides auto-drop and stop granting access on their own, so we flag UPCOMING lapses to action.
  const expiringSoonOverrideOrgIds = new Set(
    ((overridesResult.data ?? []) as Array<{ org_id: string; expires_at: string | null }>)
      .filter(o => o.expires_at && o.expires_at >= now && o.expires_at <= trialWindowEnd)
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
      isFreeTimePortal:   freeTimePortals.has(id),
      isFreeFloor:        (r.free_floor as string | null) === 'league_starter',
      missingOwner:       !ownerOrgIds.has(id),
      ownerInactive:      ownerIds.length > 0 && (!mostRecentOwnerSignIn || mostRecentOwnerSignIn < inactiveOwnerCutoff),
      expiringSoonOverride: expiringSoonOverrideOrgIds.has(id),
      trialEndingSoon:    status === 'trialing' && Boolean(currentPeriodEnd) && (currentPeriodEnd as string) <= trialWindowEnd,
      // Empty = no content of any kind AND at most the single owner as a member.
      emptyOrg:           !orgsWithContent.has(id) && (memberCounts.get(id) ?? 0) <= 1,
      ownAddress:         ownAddresses.get(id) ?? null,
    };
  });
}

export default async function OrgsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; filter?: string }>;
}) {
  // Defensive area guard — `organizations` is currently visible to every platform role
  // (the layout already enforces "is a platform admin"), so this is a no-op today. It
  // future-proofs the page: tightening the access matrix later can't silently leave it ungated.
  await requirePlatformAreaView('organizations');
  const { status, filter } = await searchParams;
  const orgs = await getOrgs();

  return <OrgsClient orgs={orgs} initialStatus={status ?? ''} initialFilter={filter ?? ''} />;
}
