import { supabaseAdmin } from './supabase-admin';
import { PLAN_CONFIG } from './plan-config';
import type { OrgPlan } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanConfigOverrideRow = {
  id: string;
  plan_id: string;
  tournament_limit: number | null;
  seat_limit: number | null;
  trial_days: number | null;
  updated_at: string;
  updated_by_email: string | null;
  last_change_note: string | null;
};

export type MergedPlanLimits = {
  tournamentLimit: number;
  seatLimit: number;
  trialDays: number;
};

const PLAN_ORDER: OrgPlan[] = ['tournament', 'team', 'tournament_plus', 'league', 'club'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Raw DB rows for the admin UI. Only returns plans that have a row in the table.
 * Null fields indicate the PLAN_CONFIG default is in effect for that field.
 */
export async function getAllPlanConfigOverrideRows(): Promise<PlanConfigOverrideRow[]> {
  const { data } = await supabaseAdmin
    .from('plan_config_overrides')
    .select('*')
    .order('plan_id');
  return (data ?? []) as PlanConfigOverrideRow[];
}

/**
 * Returns merged config for all plans: DB non-null values win over PLAN_CONFIG defaults.
 * Always returns all known plans regardless of how many DB rows exist.
 */
export async function getPlanConfigOverrides(): Promise<Record<OrgPlan, MergedPlanLimits>> {
  const rows = await getAllPlanConfigOverrideRows();
  const byPlan = Object.fromEntries(rows.map(r => [r.plan_id, r]));

  return Object.fromEntries(
    PLAN_ORDER.map(planId => {
      const base     = PLAN_CONFIG[planId];
      const override = byPlan[planId] as PlanConfigOverrideRow | undefined;
      return [planId, {
        tournamentLimit: override?.tournament_limit ?? base.tournamentLimit,
        seatLimit:       override?.seat_limit       ?? base.seatLimit,
        trialDays:       override?.trial_days       ?? base.trialDays,
      }];
    })
  ) as Record<OrgPlan, MergedPlanLimits>;
}

/**
 * Merged config for a single plan. DB non-null value wins; falls back to PLAN_CONFIG.
 */
export async function getPlanConfigOverride(planId: OrgPlan): Promise<MergedPlanLimits> {
  const all = await getPlanConfigOverrides();
  return all[planId] ?? {
    tournamentLimit: PLAN_CONFIG[planId]?.tournamentLimit ?? 1,
    seatLimit:       PLAN_CONFIG[planId]?.seatLimit       ?? 1,
    trialDays:       PLAN_CONFIG[planId]?.trialDays       ?? 0,
  };
}

/**
 * Upserts override values for a single plan.
 * Pass null for a field to clear its override and fall back to the PLAN_CONFIG default.
 */
export async function upsertPlanConfigOverride(
  planId: string,
  fields: {
    tournament_limit?: number | null;
    seat_limit?: number | null;
    trial_days?: number | null;
  },
  byEmail?: string | null,
  changeNote?: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('plan_config_overrides')
    .upsert(
      {
        plan_id: planId,
        ...fields,
        updated_at: new Date().toISOString(),
        updated_by_email: byEmail ?? null,
        last_change_note: changeNote ?? null,
      },
      { onConflict: 'plan_id' }
    );
  if (error) throw error;
}
