import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { onlinePaymentsOn } from '@/lib/online-payments-switch';
import { createCheckout, expireCheckout, retrieveCheckout } from '@/lib/stripe-connect';
import { leagueRefusalMessage, loadLeaguePayFacts } from '@/lib/league-pay-facts';
import { leaguePayPath, registrationFromPayToken } from '@/lib/league-pay-link';
import { getClubSiteContent } from '@/lib/club-page-meta';
import { throttlePublicForm } from '@/lib/public-form-throttle';
import { toDollars } from '@/lib/online-payment-fee';
import { PAY_WORDS as W } from '@/lib/online-payment-words';
import { LEAGUE_PAY_WORDS as LW } from '@/lib/league-pay-words';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A Checkout Session lives 24 hours; an open one younger than this is offered again rather than a second one opened. */
const REUSE_MS = 23 * 60 * 60 * 1000;

/**
 * The sign-up's open payment page, answered as the route's response: the same page again when it is still open, young and
 * for this amount; "already paid" when it completed; "try again" when Stripe can't be read or won't close it; null when
 * there is none (or it is now closed and recorded so) and a new one may be opened. An open page older than the reuse
 * window is closed here too, so a missed "expired" event never holds the sign-up's one open slot (/review 2026-10-25).
 */
async function openSessionFor(seasonId: string, signupKey: string, totalCents: number): Promise<Response | null> {
  const { data: open } = await supabaseAdmin.from('online_payments')
    .select('id, total_amount, stripe_checkout_session_id, created_at, stripe_account_id')
    .eq('flow', 'league_signup').eq('season_id', seasonId).eq('signup_key', signupKey).eq('status', 'open').maybeSingle();
  if (!open?.stripe_checkout_session_id) return null;
  const account = open.stripe_account_id as string;
  const sessionId = open.stripe_checkout_session_id as string;
  const session = await retrieveCheckout(account, sessionId).catch(() => null);
  if (!session) return NextResponse.json({ error: W.error.couldntOpen }, { status: 503 });
  if (session.status === 'complete') return NextResponse.json({ error: LW.error.nothingOwed }, { status: 409 });
  const young = Date.now() - Date.parse(open.created_at as string) < REUSE_MS;
  if (session.status === 'open' && young && Math.round(Number(open.total_amount) * 100) === totalCents && session.url) {
    return NextResponse.json({ url: session.url });
  }
  if (session.status === 'open') {
    await expireCheckout(account, sessionId);
    const still = await retrieveCheckout(account, sessionId).catch(() => null);
    if (still?.status !== 'expired') return NextResponse.json({ error: W.error.couldntOpen }, { status: 503 });
  }
  await supabaseAdmin.from('online_payments').update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', open.id as string).eq('status', 'open');
  return null;
}

/**
 * THE HOUSE-LEAGUE PAY ROUTE (Club Tier Stage 12b, build prompt Part 2). Public: the signed pay link is the only key,
 * scoped to one sign-up. It RE-READS what is owed at this moment (never trusting the page), refuses a sign-up with
 * nothing to pay (ended, not accepted yet, already paid) or a payment still being checked, and opens ONE Checkout
 * Session on the club's own account for every child still owing — a line per child, the processing fee a line of its
 * own while families pay it (A14), the application fee always the whole fee. One open session per sign-up: a second
 * press (or a second tab) gets the same page back. The children and their split are recorded with the payment
 * (`online_payment_league_open`), so the landing books one line per child.
 */
export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  if (!onlinePaymentsOn()) return NextResponse.json({ error: W.error.switchOff }, { status: 404 });
  // Public: throttled like every family form (/review: each press asks Stripe).
  const throttled = throttlePublicForm(req);
  if (throttled) return throttled;
  const regId = registrationFromPayToken(token);
  if (!regId) return NextResponse.json({ error: LW.error.linkInvalid(null) }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const shownTotalCents = Number(body.totalCents);
  const email = typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ? body.email.trim() : null;

  const facts = await loadLeaguePayFacts(regId);
  if (!facts) return NextResponse.json({ error: LW.error.linkInvalid(null) }, { status: 404 });
  if (facts.refusal) {
    const contact = (await getClubSiteContent(facts.org.id).catch(() => null))?.contactEmail ?? null;
    return NextResponse.json({ error: leagueRefusalMessage(facts, contact) }, { status: 409 });
  }
  const fee = facts.fee!;
  // The page showed one amount; the re-read must agree, or the family checks the new amount first.
  if (fee.totalCents !== shownTotalCents) return NextResponse.json({ error: W.error.amountChanged, changed: true }, { status: 409 });
  // Stripe refuses an application fee that is not below the charge (only possible when the club pays on a tiny amount).
  if (fee.applicationFeeCents >= fee.totalCents) return NextResponse.json({ error: W.error.tooSmall }, { status: 409 });
  const account = facts.account!;

  const reuse = await openSessionFor(facts.season.id, facts.signupKey, fee.totalCents);
  if (reuse) return reuse;

  // Asked of Stripe FIRST and recorded after, under the one-open-per-sign-up index (the team route's order, review H1).
  const id = randomUUID();
  const description = [facts.shares.map(s => s.description.split(' · ')[0]).join(', '), facts.season.name].join(' · ');
  const origin = new URL(req.url).origin;
  const back = leaguePayPath(facts.org.slug, facts.season.slug, token);
  let session: Awaited<ReturnType<typeof createCheckout>>;
  try {
    session = await createCheckout({
      accountId: account.stripeAccountId,
      currency: 'cad',
      lines: [
        ...facts.shares.map(s => ({ name: `${s.description} · ${facts.season.name}`, amountCents: s.amountCents })),
        ...(fee.feePayer === 'family' ? [{ name: W.receiptFee, amountCents: fee.feeCents }] : []),
      ],
      applicationFeeCents: fee.applicationFeeCents,
      payerEmail: email ?? facts.guardianEmail,
      successUrl: `${origin}${back}?paid={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}${back}?left=1`,
      description,
      metadata: { online_payment_id: id, season_id: facts.season.id, org_id: facts.org.id, signup_key: facts.signupKey },
      idempotencyKey: `checkout:${id}`,
    });
  } catch {
    return NextResponse.json({ error: W.error.couldntOpen }, { status: 502 });
  }

  const { error: openError } = await supabaseAdmin.rpc('online_payment_league_open', {
    p_id: id,
    p_org: facts.org.id,
    p_stripe_account: account.stripeAccountId,
    p_season: facts.season.id,
    p_signup_key: facts.signupKey,
    p_description: description,
    p_payer_email: email ?? facts.guardianEmail,
    p_fee_amount: toDollars(fee.feeCents),
    p_fee_payer: fee.feePayer,
    p_fee_pct: fee.pctBps / 100,
    p_fee_flat: toDollars(fee.flatCents),
    p_livemode: account.livemode,
    p_session: session.id,
    p_items: facts.shares.map(s => ({
      registrationId: s.registrationId, description: s.description,
      amount: toDollars(s.amountCents), feeShare: toDollars(s.feeShareCents),
    })),
  });
  if (openError) {
    // Another press recorded its page first (or a child changed in between): close ours before anyone sees it.
    await expireCheckout(account.stripeAccountId, session.id);
    const theirs = await openSessionFor(facts.season.id, facts.signupKey, fee.totalCents);
    return theirs ?? NextResponse.json({ error: W.error.couldntOpen }, { status: 409 });
  }
  return NextResponse.json({ url: session.url });
}, { route: '/api/pay/league/[token]' });
