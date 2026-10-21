import type { Metadata } from 'next';
import Link from 'next/link';
import { CoachWelcomeCard, PremiumWelcome } from '@/components/consumer/CoachWelcomeCard';
import { accountForm } from '@/components/auth/AccountForm';
import { workspaceHoldsFoundingComp } from '@/lib/founding-season';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseTeamCheckoutMetadata } from '@/lib/team-checkout';
import CheckoutProvisioning from './CheckoutProvisioning';

export const metadata: Metadata = {
  // One title for every state (setting up, ready, no payment): the card says which.
  title: 'Premium Coaches Portal — FieldLogicHQ',
  robots: { index: false },
};

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

/** What the page can say about this checkout: no such payment, paid but not provisioned yet, or the portal is ready. */
type CheckoutState =
  | { kind: 'no_payment' }
  | { kind: 'setting_up' }
  | { kind: 'ready'; orgSlug: string; team: string; foundingComp: boolean };

/**
 * Where Stripe returns a paid Coach Premium checkout (`success_url` in create-team-checkout). The Stripe webhook
 * creates the portal, so it may not exist the instant the coach lands here (The first look, Stage 3b — F06, G2,
 * 2026-10-20). The page says one of four things, on the one welcome card:
 *   · no payment — no `session_id`, one Stripe refuses, not a Coach Premium checkout, or a checkout not completed:
 *     "We can't find that payment", AT ONCE (it used to wait ~50 s and then claim the payment went through);
 *   · setting up / still setting up — paid, no portal yet: the client polls (`CheckoutProvisioning`);
 *   · ready — the card IS the paid welcome ("Premium is on for {team}", G1), and "Open your team" hands the portal its
 *     `?success=1`. It no longer redirects past the welcome.
 * A read that fails for any other reason (Stripe or the database briefly unreachable) keeps polling rather than
 * telling a paying coach their payment is missing.
 */
async function readCheckout(sessionId: string | undefined): Promise<CheckoutState> {
  // A Checkout session id is always `cs_…`; anything else is no payment, without asking Stripe.
  if (!sessionId?.startsWith('cs_')) return { kind: 'no_payment' };

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    // Stripe refusing the id itself (not found, malformed, another account's) is no payment; only a failure to reach
    // Stripe keeps polling.
    if ((error as { type?: string })?.type === 'StripeInvalidRequestError') return { kind: 'no_payment' };
    console.error('[coaches checkout complete] session read error:', error);
    return { kind: 'setting_up' };
  }

  // A COMPLETED checkout is a payment made, whether the money has settled or not: a bank debit can still be clearing
  // (payment_status 'unpaid'), and a trial owes nothing yet. The webhook makes the portal either way, so those wait.
  const checkout = parseTeamCheckoutMetadata(session.metadata);
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;
  if (!checkout || session.status !== 'complete' || !subscriptionId) return { kind: 'no_payment' };

  try {
    // limit(1) keeps the lookup resilient if a duplicate workspace row exists for one subscription, so the coach
    // still lands in a portal instead of an error.
    const { data, error } = await supabaseAdmin
      .from('team_workspaces')
      .select('workspace_org_id, organizations!workspace_org_id(slug)')
      .eq('stripe_subscription_id', subscriptionId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const row = data as WorkspaceLookup | null;
    const orgSlug = getOrgSlug(row);
    if (!row || !orgSlug) return { kind: 'setting_up' };
    return { kind: 'ready', orgSlug, team: checkout.teamName, foundingComp: await workspaceHoldsFoundingComp(row.workspace_org_id) };
  } catch (error) {
    console.error('[coaches checkout complete] workspace lookup error:', error);
    return { kind: 'setting_up' };
  }
}

export default async function CoachesPortalCheckoutCompletePage({ searchParams }: PageProps) {
  const { session_id: sessionId } = await searchParams;
  const state = await readCheckout(sessionId);

  if (state.kind === 'ready') {
    return <PremiumWelcome team={state.team} href={`/${state.orgSlug}/coaches?success=1`} foundingComp={state.foundingComp} />;
  }
  if (state.kind === 'no_payment') {
    return (
      <CoachWelcomeCard icon="search" quiet title="We can't find that payment" sub="If you've just paid, your portal link is on its way to your email.">
        <Link href="/discover" className={accountForm.primary}>Go to Home</Link>
      </CoachWelcomeCard>
    );
  }
  // Paid, no portal yet: a self-polling card that turns into the welcome the moment the portal exists.
  return <CheckoutProvisioning />;
}
