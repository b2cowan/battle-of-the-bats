import { getPlatformAdminContext, hasPlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import BulkOperationsClient from './BulkOperationsClient';

export const metadata = { title: 'Bulk Operations - Platform Admin' };

export type BulkOrgRow = {
  id: string;
  name: string;
  slug: string;
  planId: string;
  subscriptionStatus: string;
  tournamentLimit: number | null;
  enabledAddons: string[];
  createdAt: string;
};

export type BulkOperationRow = {
  id: string;
  action_type: string;
  status: string;
  target_count: number;
  success_count: number;
  failure_count: number;
  reason: string;
  parameters: Record<string, unknown>;
  created_by_email: string;
  created_at: string;
  completed_at: string | null;
};

async function getOrgs(): Promise<BulkOrgRow[]> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, plan_id, subscription_status, tournament_limit, enabled_addons, created_at')
    .order('name', { ascending: true });

  if (error || !data) return [];

  return data.map(row => ({
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    planId: row.plan_id as string,
    subscriptionStatus: (row.subscription_status as string | null) ?? 'active',
    tournamentLimit: row.tournament_limit as number | null,
    enabledAddons: Array.isArray(row.enabled_addons) ? row.enabled_addons as string[] : [],
    createdAt: row.created_at as string,
  }));
}

async function getRecentOperations(): Promise<BulkOperationRow[]> {
  const { data, error } = await supabaseAdmin
    .from('platform_bulk_operations')
    .select('id, action_type, status, target_count, success_count, failure_count, reason, parameters, created_by_email, created_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(8);

  if (error || !data) return [];
  return data as BulkOperationRow[];
}

export default async function BulkOperationsPage() {
  const [auth, orgs, recentOperations] = await Promise.all([
    getPlatformAdminContext(),
    getOrgs(),
    getRecentOperations(),
  ]);

  return (
    <BulkOperationsClient
      orgs={orgs}
      recentOperations={recentOperations}
      canManageBilling={auth ? hasPlatformPermission(auth.role, 'manage_billing') : false}
      canManageProduct={auth ? hasPlatformPermission(auth.role, 'manage_product') : false}
    />
  );
}
