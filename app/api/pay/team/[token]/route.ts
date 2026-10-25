import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { onlinePaymentsOn } from '@/lib/online-payments-switch';
import { createCheckout, expireCheckout, retrieveCheckout } from '@/lib/stripe-connect';
import { loadTeamPayFacts } from '@/lib/team-pay-facts';
import { refusalMessage, teamFromPayToken } from '@/lib/team-pay-view';
import { teamPayPath } from '@/lib/team-pay-link';
import { toDollars } from '@/lib/online-payment-fee';
import { PAY_WORDS as W, SCOPE_LINE } from '@/lib/online-payment-words';
import type { PayScope } from '@/lib/team-pay-options';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A Checkout Session lives 24 hours; an open one younger than this is offered again rather than a second one opened. */
const REUSE_MS = 23 * 60 * 60 * 1000;

/**
 * The team's open payment page, answered as the route's response: the same page again when it is still open, young and
 * for this amount; "already paid" when it completed; "try again" when Stripe can't be read or won't close it; null when
 * there is none (or it is now closed and recorded so) and a new one may be opened.
 */
async function openSessionFor(teamId: string, scope: PayScope, totalCents: number, teamName: string): Promise<Response | null> {
  const { data: open } = await supabaseAdmin.from('online_payments')
    .select('id, scope, total_amount, stripe_checkout_session_id, created_at, stripe_account_id')
    .eq('team_id', teamId).eq('status', 'open').maybeSingle();
  if (!open?.stripe_checkout_session_id) return null;
  const account = open.stripe_account_id as string;
  const sessionId = open.stripe_checkout_session_id as string;
  const session = await retrieveCheckout(account, sessionId).catch(() => null);
  if (!session) return NextResponse.json({ error: W.error.couldntOpen }, { status: 503 });
  if (session.status === 'complete') return NextResponse.json({ error: W.error.alreadyPaid(teamName) }, { status: 409 });
  const young = Date.now() - Date.parse(open.created_at as string) < REUSE_MS;
  if (session.status === 'open' && young && open.scope === scope && Math.round(Number(open.total_amount) * 100) === totalCents && session.url) {
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
 * THE PAY ROUTE (Club Tier Stage 12a, build prompt Part 3). Public: the signed pay link is the only key, scoped to one
 * team. It RE-READS what is owed at this moment (never trusting the page), refuses an unaccepted, ended or paid team,
 * and opens a Checkout Session on the club's own account for exactly that amount — a direct charge, the processing fee a
 * line of its own while the team pays it (A14), the application fee always the whole fee. One open session per team: a
 * second press (or a second tab) gets the same page back.
 */
export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  if (!onlinePaymentsOn()) return NextResponse.json({ error: W.error.switchOff }, { status: 404 });
  const teamId = teamFromPayToken(token);
  if (!teamId) return NextResponse.json({ error: W.error.linkInvalid }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const scope = body.scope as PayScope;
  const shownTotalCents = Number(body.totalCents);
  const email = typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ? body.email.trim() : null;

  const facts = await loadTeamPayFacts(teamId);
  if (!facts) return NextResponse.json({ error: W.error.linkInvalid }, { status: 404 });
  const refusal = refusalMessage(facts);
  if (refusal) return NextResponse.json({ error: refusal }, { status: 409 });
  const choice = facts.options?.choices.find(c => c.scope === scope);
  // The page showed one amount; the re-read must agree, or the team checks the new amount first.
  if (!choice || choice.fee.totalCents !== shownTotalCents) return NextResponse.json({ error: W.error.amountChanged, changed: true }, { status: 409 });
  // Stripe refuses an application fee that is not below the charge (only possible when the club pays on a tiny amount).
  if (choice.fee.applicationFeeCents >= choice.fee.totalCents) return NextResponse.json({ error: W.error.tooSmall }, { status: 409 });
  const account = facts.account!;

  // An open session for this team: the same amount and young enough → the same page; otherwise close it first.
  // (Review 2026-10-25, H1.) A Stripe read that fails is NOT a closed session: answer "try again", never expire on doubt.
  const reuse = await openSessionFor(teamId, scope, choice.fee.totalCents, facts.teamName);
  if (reuse) return reuse;

  // The page is asked of Stripe FIRST and recorded after, under the one-open-per-team index, so two presses can never
  // leave two payable pages: the press that loses the record closes its own page at once and hands back the winner's.
  const id = randomUUID();
  const lineName = [facts.teamName, facts.tournament.name, SCOPE_LINE[scope]].join(' · ');
  const origin = new URL(req.url).origin;
  const back = teamPayPath(facts.org.slug, facts.tournament.slug, token);
  let session: Awaited<ReturnType<typeof createCheckout>>;
  try {
    session = await createCheckout({
      accountId: account.stripeAccountId,
      currency: 'cad',
      lines: [
        { name: lineName, amountCents: choice.fee.baseCents },
        ...(choice.fee.feePayer === 'family' ? [{ name: W.receiptFee, amountCents: choice.fee.feeCents }] : []),
      ],
      applicationFeeCents: choice.fee.applicationFeeCents,
      payerEmail: email ?? facts.teamEmail,
      successUrl: `${origin}${back}?paid={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}${back}?left=1`,
      description: lineName,
      metadata: { online_payment_id: id, team_id: teamId, tournament_id: facts.tournament.id, org_id: facts.org.id },
      idempotencyKey: `checkout:${id}`,
    });
  } catch {
    return NextResponse.json({ error: W.error.couldntOpen }, { status: 502 });
  }

  const { error: insertError } = await supabaseAdmin.from('online_payments').insert({
    id,
    org_id: facts.org.id,
    stripe_account_id: account.stripeAccountId,
    flow: 'tournament_team',
    tournament_id: facts.tournament.id,
    team_id: teamId,
    scope,
    description: lineName,
    payer_email: email ?? facts.teamEmail,
    base_amount: toDollars(choice.fee.baseCents),
    fee_amount: toDollars(choice.fee.feeCents),
    total_amount: toDollars(choice.fee.totalCents),
    fee_payer: choice.fee.feePayer,
    fee_pct: choice.fee.pctBps / 100,
    fee_flat: toDollars(choice.fee.flatCents),
    rail: 'card',
    livemode: account.livemode,
    stripe_checkout_session_id: session.id,
  });
  if (insertError) {
    // Another press recorded its page first: close ours before anyone sees it, and offer theirs.
    await expireCheckout(account.stripeAccountId, session.id);
    const theirs = await openSessionFor(teamId, scope, choice.fee.totalCents, facts.teamName);
    return theirs ?? NextResponse.json({ error: W.error.couldntOpen }, { status: 409 });
  }
  return NextResponse.json({ url: session.url });
}, { route: '/api/pay/team/[token]' });
