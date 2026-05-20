import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAllStripePrices } from '@/lib/stripe-prices';
import { getAllPlanConfigOverrideRows } from '@/lib/plan-config-db';
import { PLAN_CONFIG } from '@/lib/plan-config';
import PlansPricingClient from './PlansPricingClient';

export const metadata = { title: 'Plans & Pricing — Platform Admin' };

export type PlanGatingRow = {
  plan_key: string;
  gating_status: string;
  updated_at: string | null;
  updated_by_email: string | null;
};

export default async function PlansPricingPage() {
  const [gatingResult, configRows, priceRows] = await Promise.all([
    supabaseAdmin.from('plan_gating').select('*').order('plan_key'),
    getAllPlanConfigOverrideRows(),
    getAllStripePrices(),
  ]);

  const gatingRows = (gatingResult.data ?? []) as PlanGatingRow[];

  // Pass only the numeric fields (serialisable) — not the full PlanConfig shape
  const configDefaults = Object.fromEntries(
    Object.entries(PLAN_CONFIG).map(([planId, cfg]) => [
      planId,
      {
        tournamentLimit: cfg.tournamentLimit,
        seatLimit:       cfg.seatLimit,
        trialDays:       cfg.trialDays,
      },
    ])
  );

  return (
    <PlansPricingClient
      initialGating={gatingRows}
      initialConfig={configRows}
      configDefaults={configDefaults}
      initialPrices={priceRows}
    />
  );
}