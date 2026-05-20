import 'server-only';
import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabase-admin';
import { PLAN_CONFIG } from './plan-config';
import type { OrgPlan } from './types';

export type PlanGatingMap = Record<OrgPlan, boolean>; // true = gated (early_access)

const ALL_PLANS: OrgPlan[] = ['tournament', 'tournament_plus', 'league', 'club'];

function fromPlanConfig(): PlanGatingMap {
  return Object.fromEntries(
    ALL_PLANS.map(k => [k, PLAN_CONFIG[k].gatingStatus === 'early_access'])
  ) as PlanGatingMap;
}

function allLive(): PlanGatingMap {
  return Object.fromEntries(ALL_PLANS.map(k => [k, false])) as PlanGatingMap;
}

/**
 * Resolves which plans are gated (early_access) for the current request.
 * Priority:
 *   1. dev_plan_gates cookie — forces all-live when set to 'live' (dev only)
 *   2. NEXT_PUBLIC_PLAN_GATES env var — forces all-live when set to 'live'
 *   3. plan_gating DB table — per-plan status managed by platform admin
 *   4. PLAN_CONFIG.gatingStatus — fallback if DB is unavailable
 */
export async function getPlanGatingMap(): Promise<PlanGatingMap> {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true') {
    const cookieStore = await cookies();
    if (cookieStore.get('dev_plan_gates')?.value === 'live') return allLive();
  }

  if (process.env.NEXT_PUBLIC_PLAN_GATES === 'live') return allLive();

  const { data, error } = await supabaseAdmin
    .from('plan_gating')
    .select('plan_key, gating_status');

  if (error || !data?.length) return fromPlanConfig();

  const map = fromPlanConfig();
  for (const row of data) {
    if (row.plan_key in map) {
      map[row.plan_key as OrgPlan] = row.gating_status === 'early_access';
    }
  }
  return map;
}
