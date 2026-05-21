import EarlyAccessClient from './EarlyAccessClient';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getPlatformAdminContext, hasPlatformPermission } from '@/lib/platform-auth';

async function getOrganizationOptions() {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, plan_id')
    .order('name', { ascending: true })
    .limit(1000);

  if (error || !data) return [];

  return data.map(row => ({
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    planId: row.plan_id as string,
  }));
}

export default async function EarlyAccessPage() {
  const [auth, organizations] = await Promise.all([
    getPlatformAdminContext(),
    getOrganizationOptions(),
  ]);

  return (
    <EarlyAccessClient
      organizations={organizations}
      canManageGrowth={auth ? hasPlatformPermission(auth.role, 'manage_growth') : false}
    />
  );
}
