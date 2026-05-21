import { supabaseAdmin } from '@/lib/supabase-admin';
import OrgsClient from './OrgsClient';

async function getOrgs() {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, plan_id, subscription_status, created_at, enabled_addons, internal_notes')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const orgIds = data.map(row => row.id as string);
  const { data: noteRows } = orgIds.length > 0
    ? await supabaseAdmin
      .from('org_internal_notes')
      .select('org_id')
      .in('org_id', orgIds)
      .is('deleted_at', null)
    : { data: [] };
  const noteCounts = new Map<string, number>();
  for (const row of noteRows ?? []) {
    const orgId = row.org_id as string;
    noteCounts.set(orgId, (noteCounts.get(orgId) ?? 0) + 1);
  }

  return data.map(r => ({
    id:                 r.id as string,
    name:               r.name as string,
    slug:               r.slug as string,
    planId:             r.plan_id as string,
    subscriptionStatus: r.subscription_status as string,
    createdAt:          r.created_at as string,
    enabledAddons:      (r.enabled_addons as string[]) ?? [],
    internalNotes:      (noteCounts.get(r.id as string) ?? 0) > 0
      ? `${noteCounts.get(r.id as string)} internal note${noteCounts.get(r.id as string) === 1 ? '' : 's'}`
      : ((r.internal_notes as string | null) ?? null),
  }));
}

export default async function OrgsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const orgs = await getOrgs();

  return <OrgsClient orgs={orgs} initialStatus={status ?? ''} />;
}
