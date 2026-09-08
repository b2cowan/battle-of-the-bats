import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  FOUNDING_SEASON_COMP_EXPIRIES,
  isFoundingSeasonCurrentExpiry,
} from '@/lib/plan-config';
// One plan→label rule for the whole console (it already backs the Overview and Organizations
// screens) — a second copy here would drift the next time a plan is renamed.
import { planLabel } from '@/lib/platform-metrics';
import { pluralize } from '@/lib/utils';
// The card and the next-season choice live in their own service-role-only table (mig 283) — NOT on
// `organizations`, which is anon-readable for every public org.
import { getOrgBillingFactsBulk } from '@/lib/billing-setup';

/**
 * THE FOUNDING SEASON DESK — every free account, in one list.
 *
 * ⚠ ONE QUERY, BOTH ACCOUNT KINDS, AND THAT IS NOT A SHORTCUT. A comped Premium Coaches Portal is
 * provisioned as a shadow ORGANIZATION (`account_kind='team_workspace'`) that carries the same
 * `comp_period` override an ordinary organization does — `provisionCompTeamWorkspaceFromCheckout`
 * writes both, and has since the coach comp path was built. So "organizations AND coach workspaces
 * in one list" is one read over `organizations`, with the workspace row supplying only the
 * coach-specific figures. Two lists stitched together would have been two chances to disagree.
 *
 * ⚠ RECOGNITION IS THE SHARED RULE, NEVER A HAND-TYPED DATE. `FOUNDING_SEASON_COMP_EXPIRIES` (the
 * current instant OR the legacy pre-2026-09-07 one) is the whole test, and a revoked comp is not a
 * comp. The Organizations page used to match `expires_at >= '2026-12-31'` and therefore badged any
 * support comp granted into 2028 as "Founding"; that is fixed in the same change as this file.
 *
 * The desk READS. It has no writes and no write role: every action it implies (change a plan,
 * cancel, send) already lives in Bulk Operations, the org page and Email Campaigns, and a read-only
 * desk cannot convert the wrong account by accident.
 */

export type FoundingAccountKind = 'organization' | 'coaches_portal';

export type FoundingAccountRow = {
  orgId: string;
  name: string;
  slug: string;
  kind: FoundingAccountKind;
  planId: string;
  planLabel: string;
  /** The comp's expiry — what "free through" means for this account. */
  freeThrough: string;
  /** True when the comp still sits on the pre-2026-09-07 instant (migration 279 has not reached it). */
  isLegacyExpiry: boolean;
  cardOnFileAt: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  nextSeasonPlanId: string | null;
  nextSeasonPlanLabel: string | null;
  nextSeasonBillingCycle: string | null;
  nextSeasonChosenAt: string | null;
  /** Most recent sign-in across the account's owners. NOT a page-view metric — the product has none. */
  ownerLastSeenAt: string | null;
  billingContact: string | null;
  /** Orgs: non-archived tournaments. Coaches Portals: roster size on the active season. */
  usageCount: number;
  usageLabel: string;
  createdAt: string;
};

export type FoundingDeskData = {
  rows: FoundingAccountRow[];
  totals: { accounts: number; organizations: number; coachesPortals: number; noCard: number; noChoice: number };
};

/** Every org id holding a live Founding Season comp, with the expiry that proves it. */
async function foundingCompExpiryByOrg(): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin
    .from('org_overrides')
    .select('org_id, expires_at')
    .eq('type', 'comp_period')
    .in('expires_at', [...FOUNDING_SEASON_COMP_EXPIRIES])
    .is('revoked_at', null);

  const byOrg = new Map<string, string>();
  for (const row of data ?? []) {
    const orgId = row.org_id as string;
    const expiresAt = row.expires_at as string;
    // An account with both a legacy and a healed row is one account: keep the later expiry, which is
    // the one that actually governs.
    const held = byOrg.get(orgId);
    if (!held || expiresAt > held) byOrg.set(orgId, expiresAt);
  }
  return byOrg;
}

export async function getFoundingSeasonDeskData(): Promise<FoundingDeskData> {
  const compByOrg = await foundingCompExpiryByOrg();
  const orgIds = [...compByOrg.keys()];
  if (orgIds.length === 0) {
    return { rows: [], totals: { accounts: 0, organizations: 0, coachesPortals: 0, noCard: 0, noChoice: 0 } };
  }

  const [orgsRes, workspacesRes, ownersRes, authUsersRes, tournamentsRes, factsByOrg] = await Promise.all([
    supabaseAdmin
      .from('organizations')
      .select('id, name, slug, plan_id, account_kind, created_at')
      .in('id', orgIds),
    supabaseAdmin
      .from('team_workspaces')
      .select('workspace_org_id, rep_team_id, active_program_year_id')
      .in('workspace_org_id', orgIds),
    supabaseAdmin
      .from('organization_members')
      .select('organization_id, user_id')
      .in('organization_id', orgIds)
      .eq('role', 'owner'),
    // The same source the Organizations page reads for owner freshness. One page is ample: the
    // cohort is tens of accounts, and Phase 3 revisits this if it ever isn't.
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabaseAdmin
      .from('tournaments')
      .select('org_id, status')
      .in('org_id', orgIds)
      .neq('status', 'archived'),
    getOrgBillingFactsBulk(orgIds),
  ]);

  const workspaceByOrg = new Map<string, { repTeamId: string; programYearId: string | null }>();
  for (const w of workspacesRes.data ?? []) {
    workspaceByOrg.set(w.workspace_org_id as string, {
      repTeamId: w.rep_team_id as string,
      programYearId: (w.active_program_year_id as string | null) ?? null,
    });
  }

  // Roster sizes, one batched read over every founding workspace's active season.
  const programYearIds = [...workspaceByOrg.values()]
    .map(w => w.programYearId)
    .filter((id): id is string => Boolean(id));
  const rosterCountByYear = new Map<string, number>();
  if (programYearIds.length > 0) {
    const { data: rosterRows } = await supabaseAdmin
      .from('rep_roster_players')
      .select('program_year_id')
      .in('program_year_id', programYearIds);
    for (const r of rosterRows ?? []) {
      const key = r.program_year_id as string;
      rosterCountByYear.set(key, (rosterCountByYear.get(key) ?? 0) + 1);
    }
  }

  const tournamentCountByOrg = new Map<string, number>();
  for (const t of tournamentsRes.data ?? []) {
    const key = t.org_id as string;
    tournamentCountByOrg.set(key, (tournamentCountByOrg.get(key) ?? 0) + 1);
  }

  const ownerIdsByOrg = new Map<string, string[]>();
  for (const m of ownersRes.data ?? []) {
    const key = m.organization_id as string;
    const list = ownerIdsByOrg.get(key) ?? [];
    list.push(m.user_id as string);
    ownerIdsByOrg.set(key, list);
  }
  const authUserById = new Map(
    (authUsersRes.data?.users ?? []).map(u => [u.id, { email: u.email ?? null, lastSignInAt: u.last_sign_in_at ?? null }]),
  );

  const rows: FoundingAccountRow[] = (orgsRes.data ?? []).map(org => {
    const orgId = org.id as string;
    const owners = (ownerIdsByOrg.get(orgId) ?? []).map(id => authUserById.get(id)).filter(Boolean) as
      Array<{ email: string | null; lastSignInAt: string | null }>;
    const ownerLastSeenAt = owners
      .map(o => o.lastSignInAt)
      .filter((v): v is string => Boolean(v))
      .sort()
      .at(-1) ?? null;
    const billingContact = owners.find(o => o.email)?.email ?? null;

    const workspace = workspaceByOrg.get(orgId);
    const kind: FoundingAccountKind =
      (org.account_kind as string) === 'team_workspace' || (org.plan_id as string) === 'team'
        ? 'coaches_portal'
        : 'organization';

    const usageCount = kind === 'coaches_portal'
      ? (workspace?.programYearId ? rosterCountByYear.get(workspace.programYearId) ?? 0 : 0)
      : tournamentCountByOrg.get(orgId) ?? 0;
    // Zero gets a sentence rather than "0 players" — on this desk a nought is the thing the reader
    // is looking for (an account that has not started), so it says so in words.
    const usageLabel = kind === 'coaches_portal'
      ? usageCount === 0 ? 'No players yet' : pluralize(usageCount, 'player')
      : usageCount === 0 ? 'No tournaments yet' : pluralize(usageCount, 'tournament');

    const freeThrough = compByOrg.get(orgId) as string;
    const facts = factsByOrg.get(orgId) ?? null;
    const nextPlan = facts?.nextSeasonPlanId ?? null;

    return {
      orgId,
      name: org.name as string,
      slug: org.slug as string,
      kind,
      planId: org.plan_id as string,
      planLabel: org.plan_id ? planLabel(org.plan_id as string) : '—',
      freeThrough,
      isLegacyExpiry: !isFoundingSeasonCurrentExpiry(freeThrough),
      cardOnFileAt: facts?.cardOnFileAt ?? null,
      cardBrand: facts?.cardBrand ?? null,
      cardLast4: facts?.cardLast4 ?? null,
      nextSeasonPlanId: nextPlan,
      nextSeasonPlanLabel: nextPlan ? planLabel(nextPlan) : null,
      nextSeasonBillingCycle: facts?.nextSeasonBillingCycle ?? null,
      nextSeasonChosenAt: facts?.nextSeasonChosenAt ?? null,
      ownerLastSeenAt,
      billingContact,
      usageCount,
      usageLabel,
      createdAt: org.created_at as string,
    };
  });

  // Newest free-season records first, then by name — the operator reads this looking for who has
  // NOT acted, so a stable alphabetical secondary beats an arbitrary database order.
  rows.sort((a, b) => a.name.localeCompare(b.name));

  return {
    rows,
    totals: {
      accounts: rows.length,
      organizations: rows.filter(r => r.kind === 'organization').length,
      coachesPortals: rows.filter(r => r.kind === 'coaches_portal').length,
      noCard: rows.filter(r => !r.cardOnFileAt).length,
      noChoice: rows.filter(r => !r.nextSeasonPlanId).length,
    },
  };
}
