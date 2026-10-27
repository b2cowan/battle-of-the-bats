import { NextResponse } from 'next/server';
import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureError } from '@/lib/observability';
import { onlinePaymentsOn, ONLINE_PAYMENTS_OFF_ERROR } from '@/lib/online-payments-switch';
import { canConnectPayouts, canSeePayouts } from '@/lib/online-payment-access';
import { isCalendarDate } from '@/lib/timezone';
import { readPayouts } from '@/lib/online-payouts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A wide range reads many payouts from Stripe, a few at a time (/review of 12d-2).
export const maxDuration = 60;

/**
 * THE PAYOUTS LIST (Club Tier Stage 12d-2 Part 2 — frame 3, words §3; owner rulings ask 5 + 2026-10-27 ruling 1).
 * Read only, for everyone who reads Accounting and the owner (`canSeePayouts`) — the Accounting › Payouts tab and the
 * owner's card for a club without Accounting read this one route. ⚠ NOT plan-gated: a club that moved to a plan without
 * online payments keeps its account connected (ask 4) and keeps being paid out, so its payouts still read. A club that
 * never connected has no list (404; the tab is hidden, words §7 question 6).
 */
export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const ctx = await getAuthContextWithRole({ orgSlug: url.searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!onlinePaymentsOn()) return NextResponse.json({ error: ONLINE_PAYMENTS_OFF_ERROR }, { status: 404 });
  const member = { role: ctx.role, capabilities: ctx.capabilities };
  if (!canSeePayouts(member, ctx.org)) return forbidden();

  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  if (!isCalendarDate(from) || !isCalendarDate(to) || from > to) return NextResponse.json({ error: 'Choose the dates.' }, { status: 400 });

  const { data: acct } = await supabaseAdmin.from('org_payment_accounts')
    .select('stripe_account_id, livemode, connected_by').eq('org_id', ctx.org.id).maybeSingle();
  if (!acct) return NextResponse.json({ error: 'No payouts.' }, { status: 404 });

  // Who fixes a payout that didn't arrive: the person who set up payouts (only they can sign in to Stripe, words §3.2).
  const answererId = (acct.connected_by as string | null) ?? null;
  let answererName: string | null = null;
  if (answererId) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(answererId);
    answererName = (data?.user?.user_metadata?.full_name as string | undefined) ?? data?.user?.email ?? null;
  }

  try {
    const read = await readPayouts({ orgId: ctx.org.id, accountId: acct.stripe_account_id as string, livemode: !!acct.livemode, from, to });
    return NextResponse.json({
      ...read,
      answererName,
      isAnswerer: !!answererId && answererId === ctx.user.id && canConnectPayouts(member),
    });
  } catch (err) {
    await captureError(err, { route: '/api/admin/payouts/list', method: 'GET' });
    return NextResponse.json({ error: 'stripe' }, { status: 502 });
  }
}, { route: '/api/admin/payouts/list' });
