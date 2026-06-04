import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAllStripePrices } from '@/lib/stripe-prices';
import { getAllPlanConfigOverrideRows } from '@/lib/plan-config-db';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { getFeatureMatrixRows, PLAN_ORDER } from '@/lib/plan-module-entitlements';
import { getPlatformAdminContext, hasPlatformPermission, requirePlatformAreaView } from '@/lib/platform-auth';
import PlansPricingClient from './PlansPricingClient';

export type { FeatureMatrixRow } from '@/lib/plan-module-entitlements';

export const metadata = { title: 'Plans & Pricing — Platform Admin' };

export type PlanGatingRow = {
  plan_key: string;
  gating_status: string;
  updated_at: string | null;
  updated_by_email: string | null;
  last_change_note: string | null;
};

export type PlanImpact = {
  planId: string;
  total: number;
  active: number;
  trialing: number;
  past_due: number;
  canceled: number;
  other: number;
};

export type ProductCatalogVersionRow = {
  id: string;
  version_key: string;
  title: string;
  description: string | null;
  status: string;
  effective_at: string | null;
  published_at: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
};

export type ProductCatalogAddonRow = {
  id: string;
  addon_key: string;
  label: string;
  description: string | null;
  module_key: string | null;
  status: string;
  default_included_plans: string[] | null;
  pricing_model: string;
  monthly_price: number | string | null;
  annual_price: number | string | null;
  effective_at: string | null;
  notes: string | null;
};

export type CatalogChangeRequestRow = {
  id: string;
  request_type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  target_plan_id: string | null;
  target_addon_key: string | null;
  effective_at: string | null;
  impact_summary: string | null;
  submitted_by_email: string | null;
  submitted_at: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  implementation_notes: string | null;
  proposal: unknown;
  created_by_email: string;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
};

export type CatalogCampaignRow = {
  id: string;
  campaign_key: string;
  title: string;
  campaign_type: string;
  status: string;
  target_plan_ids: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  coupon_code: string | null;
  discount_summary: string | null;
  trial_days: number | null;
  notes: string | null;
  created_by_email: string;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
};

type OrgPlanImpactRow = {
  plan_id: string | null;
  subscription_status: string | null;
};

function buildPlanImpacts(rows: OrgPlanImpactRow[]): PlanImpact[] {
  const byPlan = new Map<string, PlanImpact>();

  for (const planId of PLAN_ORDER) {
    byPlan.set(planId, {
      planId,
      total: 0,
      active: 0,
      trialing: 0,
      past_due: 0,
      canceled: 0,
      other: 0,
    });
  }

  for (const row of rows) {
    const planId = row.plan_id ?? 'tournament';
    const impact = byPlan.get(planId);
    if (!impact) continue;

    impact.total += 1;
    switch (row.subscription_status) {
      case 'active':
        impact.active += 1;
        break;
      case 'trialing':
        impact.trialing += 1;
        break;
      case 'past_due':
        impact.past_due += 1;
        break;
      case 'canceled':
        impact.canceled += 1;
        break;
      default:
        impact.other += 1;
        break;
    }
  }

  return PLAN_ORDER.map(planId => byPlan.get(planId)!);
}

export default async function PlansPricingPage() {
  await requirePlatformAreaView('plans_pricing');
  const auth = await getPlatformAdminContext();
  const [
    gatingResult,
    orgImpactResult,
    configRows,
    priceRows,
    catalogVersionsResult,
    addonCatalogResult,
    changeRequestsResult,
    campaignsResult,
    featureMatrix,
  ] = await Promise.all([
    supabaseAdmin.from('plan_gating').select('*').order('plan_key'),
    supabaseAdmin.from('organizations').select('plan_id, subscription_status'),
    getAllPlanConfigOverrideRows(),
    getAllStripePrices(),
    supabaseAdmin
      .from('platform_plan_versions')
      .select('id, version_key, title, description, status, effective_at, published_at, created_by_email, created_at, updated_at, notes')
      .order('created_at', { ascending: false })
      .limit(12),
    supabaseAdmin
      .from('platform_addon_catalog')
      .select('id, addon_key, label, description, module_key, status, default_included_plans, pricing_model, monthly_price, annual_price, effective_at, notes')
      .order('label', { ascending: true }),
    supabaseAdmin
      .from('platform_catalog_change_requests')
      .select('id, request_type, title, description, status, priority, target_plan_id, target_addon_key, effective_at, impact_summary, submitted_by_email, submitted_at, reviewed_by_email, reviewed_at, implementation_notes, proposal, created_by_email, updated_by_email, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('platform_catalog_campaigns')
      .select('id, campaign_key, title, campaign_type, status, target_plan_ids, starts_at, ends_at, coupon_code, discount_summary, trial_days, notes, created_by_email, updated_by_email, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(20),
    getFeatureMatrixRows(),
  ]);

  const gatingRows = (gatingResult.data ?? []) as PlanGatingRow[];
  const planImpacts = buildPlanImpacts((orgImpactResult.data ?? []) as OrgPlanImpactRow[]);
  const catalogVersions = (catalogVersionsResult.data ?? []) as ProductCatalogVersionRow[];
  const addonCatalog = (addonCatalogResult.data ?? []) as ProductCatalogAddonRow[];
  const changeRequests = (changeRequestsResult.data ?? []) as CatalogChangeRequestRow[];
  const campaigns = (campaignsResult.data ?? []) as CatalogCampaignRow[];

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
      planImpacts={planImpacts}
      catalogVersions={catalogVersions}
      addonCatalog={addonCatalog}
      featureMatrix={featureMatrix}
      changeRequests={changeRequests}
      campaigns={campaigns}
      canManageProduct={auth ? hasPlatformPermission(auth.role, 'manage_product') : false}
    />
  );
}
