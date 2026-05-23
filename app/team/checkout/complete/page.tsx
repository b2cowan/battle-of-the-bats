import Link from 'next/link';
import { redirect } from 'next/navigation';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

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

export default async function TeamCheckoutCompletePage({ searchParams }: PageProps) {
  const { session_id: sessionId } = await searchParams;

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
          .maybeSingle();

        const orgSlug = getOrgSlug(data as WorkspaceLookup | null);
        if (orgSlug) redirect(`/${orgSlug}/coaches?success=1`);
      }
    } catch (error) {
      console.error('[team checkout complete] lookup error:', error);
    }
  }

  return (
    <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: 520 }}>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 800 }}>
          Team checkout
        </p>
        <h1 style={{ fontSize: '2rem', margin: '0.35rem 0 0.75rem' }}>Your Team workspace is almost ready</h1>
        <p style={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 }}>
          Payment succeeded and FieldLogicHQ is finishing the workspace setup. Refresh this page in a moment.
        </p>
        <Link href="/pricing" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Back to pricing
        </Link>
      </div>
    </main>
  );
}
