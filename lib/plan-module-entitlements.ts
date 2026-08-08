import { cache } from 'react';
import { supabaseAdmin } from './supabase-admin';
import { PLAN_CONFIG } from './plan-config';
import type { Capability } from './roles';
import type { OrgPlan } from './types';

export const PLAN_ORDER: OrgPlan[] = ['tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large'];

export const MODULE_CATALOG: { key: Capability; label: string; description: string }[] = [
  {
    key: 'module_tournaments',
    label: 'Tournaments',
    description: 'Tournament creation, registration, scheduling, scoring, communications, and public tournament pages.',
  },
  {
    key: 'module_communications',
    label: 'Communications',
    description: 'Operational email and announcement workflows for tournament and organization staff.',
  },
  {
    key: 'module_members',
    label: 'Members',
    description: 'Organization member management, roles, permissions, and staff access.',
  },
  {
    key: 'module_public_site',
    label: 'Public Site',
    description: 'Hosted organization website with public-facing schedules, standings, news, and registration paths.',
  },
  {
    key: 'module_house_league',
    label: 'House League',
    description: 'House league seasons, registration, placement, schedules, standings, and league communications.',
  },
  {
    key: 'module_accounting',
    label: 'Accounting',
    description: 'Financial ledgers, budgets, expenses, dues, and reconciliation workflows.',
  },
  {
    key: 'module_rep_teams',
    label: 'Rep Teams',
    description: 'Tryouts, team programs, rosters, coach portal, player documents, and team accounting.',
  },
];

export type PlanModuleEntitlementMatrix = Record<OrgPlan, Capability[]>;

export type FeatureMatrixRow = {
  key: Capability;
  label: string;
  description: string;
  includedPlans: Record<string, boolean>;
};

type EntitlementOverrideRow = {
  plan_id: string;
  module_key: string;
  included: boolean;
};

function defaultMatrix(): PlanModuleEntitlementMatrix {
  return Object.fromEntries(
    PLAN_ORDER.map(planId => [planId, [...PLAN_CONFIG[planId].moduleEntitlements]]),
  ) as PlanModuleEntitlementMatrix;
}

export function isValidPlanModuleEntitlementMatrix(value: unknown): value is PlanModuleEntitlementMatrix {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const validModules = new Set(MODULE_CATALOG.map(item => item.key));

  return PLAN_ORDER.every(planId => {
    const modules = record[planId];
    return Array.isArray(modules) && modules.every(item => typeof item === 'string' && validModules.has(item as Capability));
  });
}

/**
 * Request-memoized (React `cache()`, the repo's idiom for this — same as `getAuthUserCached` in
 * lib/supabase-server.ts and the coach-portal resolvers). The plans-pricing page asks for both the
 * feature matrix AND the drift in one `Promise.all`, and both need this table; without the cache
 * that is two identical round trips per page load.
 */
export const getEffectivePlanModuleEntitlements = cache(async (): Promise<PlanModuleEntitlementMatrix> => {
  const matrix = defaultMatrix();
  const { data, error } = await supabaseAdmin
    .from('platform_plan_module_entitlements')
    .select('plan_id, module_key, included');

  if (error) {
    console.error('[plan-module-entitlements] read error:', error);
    return matrix;
  }

  const overrideMap = new Map(
    ((data ?? []) as EntitlementOverrideRow[]).map(row => [`${row.plan_id}:${row.module_key}`, row.included]),
  );

  for (const planId of PLAN_ORDER) {
    matrix[planId] = MODULE_CATALOG
      .filter(module => {
        const key = `${planId}:${module.key}`;
        return overrideMap.has(key)
          ? overrideMap.get(key)
          : PLAN_CONFIG[planId].moduleEntitlements.includes(module.key);
      })
      .map(module => module.key);
  }

  return matrix;
});

/**
 * Where the PUBLISHED matrix and the LIVE product disagree.
 *
 * ── Read this before "fixing" the publish flow (audit 2026-08-06) ────────────────────────────
 * Publishing writes `platform_plan_module_entitlements`. The runtime gate — `hasModuleEntitlement`
 * — does NOT read that table: it reads the `PLAN_CONFIG[planId].moduleEntitlements` constant in
 * lib/plan-config.ts. The published matrix was therefore read by exactly one thing, the
 * platform-admin screen that wrote it: a mirror reflecting itself. An operator could take a
 * packaging change through a change request, a second person's approval and a publish, see
 * "Feature matrix published", and not one customer's access would change.
 *
 * Why it is not simply wired up: `hasModuleEntitlement` is SYNCHRONOUS, sits on the hot path of
 * every request, and is called from client components (AdminSidebar among ~85 call sites). Making
 * the plan→module mapping dynamic means an async, cached lookup threaded through all of them, with
 * a cache-invalidation design where being wrong means wrong entitlements platform-wide. That is a
 * project with its own plan, not a line in an audit fix.
 *
 * So the screen tells the truth instead: this function is what lets it say "published, and NOT yet
 * live" and name the exact rows that differ. A non-empty result means a code change to
 * `lib/plan-config.ts` plus a deploy is still owed. Empty means published and live agree.
 */
export async function getPlanModuleEntitlementDrift(): Promise<{
  planId: string;
  moduleKey: string;
  publishedIncluded: boolean;
  liveIncluded: boolean;
}[]> {
  const published = await getEffectivePlanModuleEntitlements();
  return PLAN_ORDER.flatMap(planId =>
    MODULE_CATALOG
      .map(module => ({
        planId,
        moduleKey: module.key,
        publishedIncluded: published[planId].includes(module.key),
        liveIncluded: PLAN_CONFIG[planId].moduleEntitlements.includes(module.key),
      }))
      .filter(row => row.publishedIncluded !== row.liveIncluded),
  );
}

export async function getFeatureMatrixRows(): Promise<FeatureMatrixRow[]> {
  const entitlements = await getEffectivePlanModuleEntitlements();

  return MODULE_CATALOG.map(module => ({
    ...module,
    includedPlans: Object.fromEntries(
      PLAN_ORDER.map(planId => [
        planId,
        entitlements[planId].includes(module.key),
      ]),
    ),
  }));
}

export async function publishPlanModuleEntitlements(
  moduleEntitlements: PlanModuleEntitlementMatrix,
  byEmail: string,
): Promise<void> {
  const now = new Date().toISOString();
  const rows = PLAN_ORDER.flatMap(planId =>
    MODULE_CATALOG.map(module => ({
      plan_id: planId,
      module_key: module.key,
      included: moduleEntitlements[planId].includes(module.key),
      updated_by_email: byEmail,
      updated_at: now,
    })),
  );

  const { error } = await supabaseAdmin
    .from('platform_plan_module_entitlements')
    .upsert(rows, { onConflict: 'plan_id,module_key' });

  if (error) throw error;
}
