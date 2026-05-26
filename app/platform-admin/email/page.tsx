import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getPlatformAdminContext } from '@/lib/platform-auth';
import EmailDashboardClient from './EmailDashboardClient';

export const metadata: Metadata = {
  title: 'Email Dashboard — Platform Admin',
};

const FOUNDING_SEASON_EXPIRES = '2027-01-01T00:00:00.000Z';

async function getInitialData() {
  const [batchesResult, optOutsResult, overridesResult, totalOrgsResult] = await Promise.all([
    supabaseAdmin
      .from('email_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),

    supabaseAdmin
      .from('organizations')
      .select('id, name, email_opt_out_at')
      .eq('email_marketing_opt_out', true)
      .order('email_opt_out_at', { ascending: false })
      .limit(100),

    supabaseAdmin
      .from('org_overrides')
      .select('org_id')
      .eq('type', 'comp_period')
      .eq('expires_at', FOUNDING_SEASON_EXPIRES),

    supabaseAdmin
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .eq('email_marketing_opt_out', false),
  ]);

  const foundingOrgIds = (overridesResult.data ?? []).map(o => o.org_id as string);
  const foundingCount = foundingOrgIds.length;
  const optOutCount = optOutsResult.data?.length ?? 0;

  // Enrich opt-out orgs with owner email
  const optOutOrgs = optOutsResult.data ?? [];
  const enrichedOptOuts = await Promise.all(
    optOutOrgs.map(async (org) => {
      const { data: member } = await supabaseAdmin
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', org.id)
        .eq('role', 'owner')
        .maybeSingle();

      let ownerEmail: string | null = null;
      if (member?.user_id) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
          member.user_id as string
        );
        ownerEmail = authUser?.user?.email ?? null;
      }

      return {
        orgId: org.id as string,
        orgName: org.name as string,
        ownerEmail,
        optedOutAt: org.email_opt_out_at as string | null,
      };
    })
  );

  return {
    batches: (batchesResult.data ?? []) as EmailBatch[],
    optOuts: enrichedOptOuts,
    recipientCount: foundingCount,
    optOutCount,
  };
}

// Types used by both server and client
export type EmailBatch = {
  id: string;
  email_key: string;
  subject: string;
  triggered_by: string;
  recipient_count: number;
  suppressed_count: number;
  sent_count: number;
  failed_count: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type OptOutOrg = {
  orgId: string;
  orgName: string;
  ownerEmail: string | null;
  optedOutAt: string | null;
};

export default async function EmailDashboardPage() {
  const auth = await getPlatformAdminContext();
  const { batches, optOuts, recipientCount, optOutCount } = await getInitialData();

  return (
    <EmailDashboardClient
      initialBatches={batches}
      initialOptOuts={optOuts}
      recipientCount={recipientCount}
      optOutCount={optOutCount}
      adminEmail={auth?.user.email ?? ''}
    />
  );
}
