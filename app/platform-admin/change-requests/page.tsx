import { supabaseAdmin } from '@/lib/supabase-admin';
import { getPlatformAdminContext, hasPlatformPermission } from '@/lib/platform-auth';
import ChangeRequestsClient from './ChangeRequestsClient';
import type { PlatformChangeApplicationRow, PlatformChangeRequestRow } from './types';

export const metadata = { title: 'Change Requests - Platform Admin' };

export default async function ChangeRequestsPage() {
  const auth = await getPlatformAdminContext();
  const [requestsResult, applicationsResult] = await Promise.all([
    supabaseAdmin
      .from('platform_catalog_change_requests')
      .select('id, request_type, title, description, status, priority, target_plan_id, target_addon_key, effective_at, impact_summary, submitted_by_email, submitted_at, reviewed_by_email, reviewed_at, implementation_notes, proposal, created_by_email, updated_by_email, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('platform_catalog_change_applications')
      .select('id, change_request_id, surface, target_key, actor_email, applied_payload, applied_at')
      .order('applied_at', { ascending: false })
      .limit(200),
  ]);

  const requests = (requestsResult.data ?? []) as PlatformChangeRequestRow[];
  const applications = (applicationsResult.data ?? []) as PlatformChangeApplicationRow[];

  return (
    <ChangeRequestsClient
      initialRequests={requests}
      applications={applications}
      canManageProduct={auth ? hasPlatformPermission(auth.role, 'manage_product') : false}
      currentUserEmail={auth?.user.email ?? ''}
    />
  );
}
