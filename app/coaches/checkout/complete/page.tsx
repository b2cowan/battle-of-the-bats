import { redirect } from 'next/navigation';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import CheckoutProvisioning from './CheckoutProvisioning';

type PageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

type WorkspaceLookup = {
  workspace_org_id: string;
  organizations?: { slug?: string | null } | { slug?: string | null }[] | null;
};

function getOrgSlug(row: WorkspaceLookup | null): string | null {
  const org = Array.isArray(row?.organizations) ? row?.organizations[0] : row?.organizations;
  return org?.slug ?? null;
}

export default async function CoachesPortalCheckoutCompletePage({ searchParams }: PageProps) {
  const { session_id: sessionId } = await searchParams;

  // Resolve the provisioned workspace's org slug, if the webhook has finished. Two guards matter:
  //  1. redirect() MUST run OUTSIDE the try/catch below — it works by throwing, so catching here
  //     would swallow it and the buyer would never advance (a real bug this page used to have).
  //  2. limit(1) keeps the lookup resilient if a duplicate workspace row exists for one
  //     subscription, so we still land the buyer in a portal instead of erroring out.
  let orgSlug: string | null = null;
  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id ?? null;

      if (subscriptionId) {
        const { data } = await supabaseAdmin
          .from('team_workspaces')
          .select('workspace_org_id, organizations!workspace_org_id(slug)')
          .eq('stripe_subscription_id', subscriptionId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        orgSlug = getOrgSlug(data as WorkspaceLookup | null);
      }
    } catch (error) {
      console.error('[coaches checkout complete] lookup error:', error);
    }
  }

  if (orgSlug) redirect(`/${orgSlug}/coaches?success=1`);

  // Not provisioned yet → a self-polling screen that advances into the portal automatically.
  return <CheckoutProvisioning />;
}
