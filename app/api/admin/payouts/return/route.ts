import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { onlinePaymentsOn } from '@/lib/online-payments-switch';
import { canConnectPayouts } from '@/lib/online-payment-access';
import { onboardingLink } from '@/lib/stripe-connect';
import { resolveSameHostOrigin } from '@/lib/app-origin';
import { payoutsHref, syncPayoutsAccount } from '@/lib/online-payment-landing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Where Stripe's onboarding sends the owner back (Club Tier Stage 12a). Stripe's return never says whether setup
 * finished, so the account is re-read from Stripe here; a `refresh` return (the link expired or was used) mints a fresh
 * link. Either way the owner lands back on the Payouts card.
 */
export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug');
  const ctx = await getAuthContextWithRole({ orgSlug: orgSlug ?? undefined, requireOrgSlug: true });
  // Not `url.origin`: a redirect must never be built on a host the caller chose. `resolveSameHostOrigin` is the resolver for a
  // redirect the visitor follows at once: it keeps them on the host they arrived at (our own hosts only, the same predicate the
  // emailed links use; anything else falls back to the canonical address), so the admin's sign-in cookie still travels.
  const origin = resolveSameHostOrigin(req);
  if (!ctx) return NextResponse.redirect(new URL(`/auth/login?next=${encodeURIComponent(url.pathname + url.search)}`, origin));
  const home = new URL(payoutsHref(ctx.org), origin);
  // 12d-2 (ask 4): not plan-gated — an account still connected after a downgrade can still finish what Stripe asks for
  // (the needs-attention fix-up returns here). It only re-reads an account that exists and isn't disconnected (below).
  if (!onlinePaymentsOn() || !canConnectPayouts({ role: ctx.role })) {
    return NextResponse.redirect(home);
  }
  const { data: row } = await supabaseAdmin.from('org_payment_accounts').select('stripe_account_id, disconnected_at').eq('org_id', ctx.org.id).maybeSingle();
  if (!row || row.disconnected_at) return NextResponse.redirect(home);
  if (url.searchParams.get('refresh')) {
    const back = (refresh: boolean) => `${origin}/api/admin/payouts/return?orgSlug=${encodeURIComponent(ctx.org.slug)}${refresh ? '&refresh=1' : ''}`;
    return NextResponse.redirect(await onboardingLink(row.stripe_account_id as string, back(true), back(false)));
  }
  await syncPayoutsAccount(row.stripe_account_id as string);
  home.searchParams.set('payouts', 'back');
  return NextResponse.redirect(home);
}, { route: '/api/admin/payouts/return' });
