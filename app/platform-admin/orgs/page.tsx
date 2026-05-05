import { supabaseAdmin } from '@/lib/supabase-admin';
import { PLAN_CONFIG } from '@/lib/plan-config';
import OrgsClient from './OrgsClient';

async function getOrgs() {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, plan_id, tournament_limit, subscription_status, created_at')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map(r => ({
    id:                 r.id as string,
    name:               r.name as string,
    slug:               r.slug as string,
    planId:             r.plan_id as string,
    tournamentLimit:    r.tournament_limit as number,
    subscriptionStatus: r.subscription_status as string,
    createdAt:          r.created_at as string,
  }));
}

export default async function OrgsPage() {
  const orgs = await getOrgs();
  const planDefaults = Object.fromEntries(
    Object.entries(PLAN_CONFIG).map(([plan, cfg]) => [plan, cfg.tournamentLimit])
  );

  return <OrgsClient orgs={orgs} planDefaults={planDefaults} />;
}
