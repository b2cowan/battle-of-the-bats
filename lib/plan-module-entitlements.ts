import { supabaseAdmin } from './supabase-admin';
import { PLAN_CONFIG } from './plan-config';
import type { Capability } from './roles';
import type { OrgPlan } from './types';

export const PLAN_ORDER: OrgPlan[] = ['tournament', 'team', 'tournament_plus', 'league', 'club'];

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

export async function getEffectivePlanModuleEntitlements(): Promise<PlanModuleEntitlementMatrix> {
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
