import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getPlatformAdminContext, requirePlatformAreaView } from '@/lib/platform-auth';
import { getMarketingAudienceCounts, MARKETING_EMAIL_AUDIENCE } from '@/lib/email-sender';
import EmailDashboardClient from './EmailDashboardClient';

export const metadata: Metadata = {
  title: 'Email Dashboard — Platform Admin',
};

const FOUNDING_SEASON_EXPIRES = '2027-01-01T00:00:00.000Z';

async function getInitialData() {
  const [batchesResult, optOutsResult, overridesResult] = await Promise.all([
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
  ]);

  const foundingOrgIdSet = new Set((overridesResult.data ?? []).map(o => o.org_id as string));
  const foundingCount = foundingOrgIdSet.size;

  // Only count opt-outs that belong to founding season orgs
  const foundingOptOutOrgs = (optOutsResult.data ?? []).filter(o => foundingOrgIdSet.has(o.id as string));
  const optOutCount = foundingOptOutOrgs.length;
  // Active recipients = founding orgs that haven't opted out
  const recipientCount = foundingCount - optOutCount;

  // Enrich opt-out orgs with owner email
  const enrichedOptOuts = await Promise.all(
    foundingOptOutOrgs.map(async (org) => {
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

  // Per-audience recipient counts (founding / not-on-club / coaches), then flatten
  // to a per-email-key map so the client shows each email's true audience size
  // without importing the server-only audience logic.
  const audienceCounts = await getMarketingAudienceCounts();
  const recipientCounts: Record<string, number> = {};
  for (const [emailKey, audience] of Object.entries(MARKETING_EMAIL_AUDIENCE)) {
    recipientCounts[emailKey] = audienceCounts[audience];
  }

  return {
    batches: (batchesResult.data ?? []) as EmailBatch[],
    optOuts: enrichedOptOuts,
    recipientCount,
    optOutCount,
    recipientCounts,
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
  await requirePlatformAreaView('email');
  const auth = await getPlatformAdminContext();
  const { batches, optOuts, recipientCount, optOutCount, recipientCounts } = await getInitialData();

  return (
    <EmailDashboardClient
      initialBatches={batches}
      initialOptOuts={optOuts}
      recipientCount={recipientCount}
      optOutCount={optOutCount}
      recipientCounts={recipientCounts}
      adminEmail={auth?.user.email ?? ''}
    />
  );
}
