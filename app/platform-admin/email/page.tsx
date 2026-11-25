import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import EmailDashboardClient from './EmailDashboardClient';

export const metadata: Metadata = {
  title: 'Campaigns — Support console',
};

async function getInitialData() {
  const [batchesResult, optOutsResult] = await Promise.all([
    supabaseAdmin
      .from('email_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),

    // Every organization that unsubscribed from marketing email, whatever plan it is on. No limit: the
    // count line above the list is this list's length, so a cut-off list would make it a wrong number.
    supabaseAdmin
      .from('organizations')
      .select('id, name, email_opt_out_at')
      .eq('email_marketing_opt_out', true)
      // A preview club (Track P, T1) is not a customer and is never mailed.
      .eq('is_preview', false)
      .order('email_opt_out_at', { ascending: false }),
  ]);

  // Enrich opt-out orgs with owner email
  const enrichedOptOuts = await Promise.all(
    (optOutsResult.data ?? []).map(async (org) => {
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
  const { batches, optOuts } = await getInitialData();

  return <EmailDashboardClient initialBatches={batches} initialOptOuts={optOuts} />;
}
