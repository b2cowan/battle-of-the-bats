import { supabaseAdmin } from '@/lib/supabase-admin';
import { getEffectiveTournamentLimit, PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';
import OrgsClient from './OrgsClient';

async function getOrgs() {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, plan_id, tournament_limit, subscription_status, created_at, enabled_addons, internal_notes')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map(r => ({
    id:                 r.id as string,
    name:               r.name as string,
    slug:               r.slug as string,
    planId:             r.plan_id as string,
    tournamentLimit:    getEffectiveTournamentLimit(r.plan_id as OrgPlan, r.tournament_limit as number | null),
    subscriptionStatus: r.subscription_status as string,
    createdAt:          r.created_at as string,
    enabledAddons:      (r.enabled_addons as string[]) ?? [],
    internalNotes:      (r.internal_notes as string | null) ?? null,
  }));
}

export default async function OrgsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const orgs = await getOrgs();
  const planDefaults = Object.fromEntries(
    Object.entries(PLAN_CONFIG).map(([plan, cfg]) => [plan, cfg.tournamentLimit])
  );

  return <OrgsClient orgs={orgs} planDefaults={planDefaults} initialStatus={status ?? ''} />;
}
