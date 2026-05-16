import { supabaseAdmin } from './supabase-admin';
import { getEffectiveTournamentLimit } from './plan-config';
import type { Organization } from './types';

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  plan_id: Organization['planId'];
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: Organization['subscriptionStatus'] | null;
  tournament_limit: number | null;
  is_public: boolean | null;
  created_at: string;
  theme_preset: string | null;
  theme_primary: string | null;
  theme_accent: string | null;
  hero_banner_url: string | null;
  theme_font: string | null;
  theme_card_style: string | null;
  require_score_finalization: boolean | null;
  onboarding_completed_at: string | null;
  enabled_addons: string[] | null;
  contact_email: string | null;
};

function mapOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url ?? undefined,
    planId: row.plan_id,
    stripeCustomerId: row.stripe_customer_id ?? undefined,
    stripeSubscriptionId: row.stripe_subscription_id ?? undefined,
    subscriptionStatus: row.subscription_status ?? 'active',
    tournamentLimit: getEffectiveTournamentLimit(row.plan_id, row.tournament_limit),
    isPublic: row.is_public ?? true,
    createdAt: row.created_at,
    themePreset: row.theme_preset ?? undefined,
    themePrimary: row.theme_primary ?? undefined,
    themeAccent: row.theme_accent ?? undefined,
    heroBannerUrl: row.hero_banner_url ?? undefined,
    themeFont: row.theme_font ?? 'system',
    themeCardStyle: row.theme_card_style ?? 'default',
    requireScoreFinalization: row.require_score_finalization ?? false,
    onboardingCompletedAt: row.onboarding_completed_at ?? null,
    enabledAddons: row.enabled_addons ?? [],
    contactEmail: row.contact_email ?? null,
  };
}

export async function getOrganizationBySlugForServer(slug: string): Promise<Organization | null> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .maybeSingle<OrganizationRow>();

  if (error || !data) return null;
  return mapOrganization(data);
}
