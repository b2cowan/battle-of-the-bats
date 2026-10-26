import { supabaseAdmin } from './supabase-admin';
import {
  DOOR_COLUMNS,
  foldGrants,
  ownPlanOf,
  isGrantRunning,
  ownFactsOf,
  customerFreeTime,
  type CustomerFreeTime,
  type DoorRow,
  type EffectiveFacts,
  type GrantRow,
  type GrantTarget,
} from './free-time';
import type { Organization } from './types';

/**
 * THE DOOR: what plan, limits, status and sections a club has right now (Support console Stage 4, owner ruling Q1).
 *
 * Every access decision reads a club through here: the three org builders (`getAuthContext`, `getOrganizationBySlug`,
 * `getOrganizationBySlugForServer`) call `applyEntitlementGrants`, and a reader that starts from raw columns calls
 * `effectiveOrgFacts`. `tests/unit/plan-reader-door-guard.test.ts` fails the build when new code reads the stored plan,
 * limits, status or sections around it. The rules themselves are in `lib/free-time.ts`.
 *
 * Grants live in `org_overrides`: a whole plan (`plan_tier`), sections (`module_addon`), a billing status
 * (`subscription_status`). Each ends by itself: nothing is scheduled, the end is compared with the moment of reading.
 * `comp_period` (Founding Season's cohort mark) gives no access.
 *
 * ⚠ Two things deliberately keep reading what the club HOLDS (its own plan), never this door's answer: every billing
 * action (checkout, move, downgrade, cancel, the next-season choice: `ownPlanOf(org)`), and revenue and customer counts
 * (`lib/platform-metrics.ts`). A grant is never revenue, and never something a club can be billed out of.
 *
 * The database has one copy of this rule, for the fee book only: `org_effective_plan` (migration 373), which the
 * tournament fee-book checks call. Keep the two in step.
 *
 * Enforcement is gated by ENTITLEMENT_GRANTS_ENABLED ("the switch"; on in dev and production). With it off every club
 * reads exactly what it holds, and the console refuses to give free time (owner ruling Q9).
 */

export function grantsEnabled(): boolean {
  return process.env.ENTITLEMENT_GRANTS_ENABLED === 'true';
}

export type OverrideTarget = GrantTarget;
export type ActiveOverrideRow = GrantRow;

/** An override is active when it is not revoked, has started, and has not reached its end. */
export const isOverrideActive = isGrantRunning;

const GRANT_COLUMNS = 'org_id, type, value, target, starts_at, expires_at, revoked_at';

type GrantRowWithOrg = GrantRow & { org_id: string };

/** The club's own plan (lib/free-time.ts, so a browser screen can read it too). */
export { ownPlanOf };

async function runningGrantsFor(orgIds: string[]): Promise<Map<string, GrantRow[]>> {
  const byOrg = new Map<string, GrantRow[]>();
  if (orgIds.length === 0) return byOrg;
  const { data } = await supabaseAdmin
    .from('org_overrides')
    .select(GRANT_COLUMNS)
    .in('org_id', orgIds)
    .is('revoked_at', null)
    .neq('type', 'comp_period')
    .order('created_at', { ascending: false });
  for (const row of (data ?? []) as GrantRowWithOrg[]) {
    const list = byOrg.get(row.org_id) ?? [];
    list.push(row);
    byOrg.set(row.org_id, list);
  }
  return byOrg;
}

/**
 * The org with its running grants folded in. `stored` is the raw limit columns (the builders have them; the org's
 * own `tournamentLimit`/`teamLimit` are already computed from the stored plan and cannot be un-computed).
 * Sets `ownPlanId` always, so billing actions can read the plan the club holds.
 */
export async function applyEntitlementGrants(
  org: Organization,
  stored: { tournamentLimit: number | null; teamLimit: number | null },
): Promise<Organization> {
  const withOwn: Organization = { ...org, ownPlanId: org.planId };
  if (!grantsEnabled()) return withOwn;

  const rows = (await runningGrantsFor([org.id])).get(org.id) ?? [];
  if (rows.length === 0) return withOwn;

  const effective = foldGrants(
    {
      planId: org.planId,
      subscriptionStatus: org.subscriptionStatus,
      enabledAddons: org.enabledAddons,
      storedTournamentLimit: stored.tournamentLimit,
      storedTeamLimit: stored.teamLimit,
    },
    rows,
  );
  return {
    ...withOwn,
    planId: effective.planId,
    tournamentLimit: effective.planId === org.planId ? org.tournamentLimit : effective.tournamentLimit,
    teamLimit: effective.planId === org.planId ? org.teamLimit : effective.teamLimit,
    subscriptionStatus: effective.subscriptionStatus,
    enabledAddons: effective.enabledAddons,
  };
}

/**
 * The door for a reader that starts from raw columns (select `DOOR_COLUMNS`). One grants query for any number of
 * clubs. Returns a map by org id; a row whose id is missing from it was not passed in.
 */
export async function effectiveOrgFacts(rows: DoorRow[]): Promise<Map<string, EffectiveFacts>> {
  const out = new Map<string, EffectiveFacts>();
  if (rows.length === 0) return out;
  const enabled = grantsEnabled();
  const grants = enabled ? await runningGrantsFor([...new Set(rows.map(r => r.id))]) : new Map<string, GrantRow[]>();
  const now = new Date();
  for (const row of rows) out.set(row.id, foldGrants(ownFactsOf(row), grants.get(row.id) ?? [], now, enabled));
  return out;
}

/** One club's door answer from its raw columns. */
export async function effectiveOrgFactsOf(row: DoorRow): Promise<EffectiveFacts> {
  return (await effectiveOrgFacts([row])).get(row.id)!;
}

/**
 * The door by club id, for a reader that holds only the id. Reads the clubs and their grants (two queries for any
 * number). A club that does not exist is absent from the map. Throws on a read error, so a gate fails closed.
 */
export async function effectiveOrgFactsById(orgIds: string[]): Promise<Map<string, EffectiveFacts>> {
  const ids = [...new Set(orgIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabaseAdmin.from('organizations').select(DOOR_COLUMNS).in('id', ids);
  if (error) throw error;
  return effectiveOrgFacts((data ?? []) as DoorRow[]);
}

/**
 * The billing status the door reads right now, for readers that hold only `id` + `subscription_status` (the
 * "is this club cancelled?" filters). A billing-status grant keeps a club open while unpaid. One grants read.
 */
export async function effectiveStatuses(
  rows: { id: string; subscription_status: string | null }[],
): Promise<Map<string, EffectiveFacts['subscriptionStatus']>> {
  const facts = await effectiveOrgFacts(
    rows.map(r => ({ id: r.id, plan_id: null, subscription_status: r.subscription_status, enabled_addons: null })),
  );
  return new Map([...facts].map(([id, f]) => [id, f.subscriptionStatus]));
}

/** One club's door answer by id, or null when there is no such club. */
export async function effectiveOrgFactsForId(orgId: string): Promise<EffectiveFacts | null> {
  return (await effectiveOrgFactsById([orgId])).get(orgId) ?? null;
}

/**
 * The customer's billing-page free time (running, ending, or ended within 30 days), or null. Reads ended grants too,
 * so it is its own query. Never returns the reason, the giver or the grant (T15).
 */
export async function getCustomerFreeTime(row: DoorRow): Promise<CustomerFreeTime | null> {
  if (!grantsEnabled()) return null;
  const { data } = await supabaseAdmin
    .from('org_overrides')
    .select('type, value, target, starts_at, expires_at, revoked_at')
    .eq('org_id', row.id)
    .eq('type', 'plan_tier')
    .order('created_at', { ascending: false })
    .limit(20);
  return customerFreeTime(ownFactsOf(row), (data ?? []) as GrantRow[]);
}
