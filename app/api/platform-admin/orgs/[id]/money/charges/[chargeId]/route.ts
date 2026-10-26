import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { getStripe } from '@/lib/stripe';
import { consoleClock } from '@/lib/console-dates';
import { inFlightWords, readClubCharge, recoverRefunds } from '@/lib/console-money-stripe';
import { stripeKeyIsLive } from '@/lib/online-payments-switch';
import { clubRefunds, clubStripeFacts, priceMap, refundStore } from '@/lib/console-money-store';

/**
 * One charge, for the charge window (Support console Stage 3; drawing C). Ownership is checked on EVERY read, not only on
 * refund (T6): a charge number from Find or typed into the address shows nothing unless it belongs to exactly this
 * club's Stripe customer, in this site's mode. Opening the charge is also recovery's moment: an unfinished refund old
 * enough to have finished is decided by listing the charge's refunds in Stripe — never by sending another (G 6).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const noStore = { 'Cache-Control': 'no-store' };

export const GET = withObservability(async (_req: Request, { params }: { params: Promise<{ id: string; chargeId: string }> }) => {
  const auth = await requirePlatformPower('find_stripe');
  if (auth.response) return auth.response;
  const { id, chargeId } = await params;
  const nothing = NextResponse.json({ error: 'Nothing matches that charge on this club.' }, { status: 404, headers: noStore });

  const [club, prices] = await Promise.all([clubStripeFacts(id), priceMap()]);
  if (!club?.customerId || club.customerShared || !/^(ch|py)_[A-Za-z0-9]+$/.test(chargeId)) return nothing;

  const stripe = getStripe();
  let charge;
  try {
    charge = (await readClubCharge(stripe, chargeId, club, stripeKeyIsLive(), prices))?.charge ?? null;
  } catch {
    return NextResponse.json({ error: 'Stripe could not be read. Try again in a moment.' }, { status: 503, headers: noStore });
  }
  if (!charge) return nothing;

  let inFlight: string | null = null;
  try {
    const stillOpen = await recoverRefunds(stripe, refundStore, { orgId: id, chargeId, now: new Date() });
    if (stillOpen[0]) inFlight = inFlightWords(stillOpen[0], consoleClock);
  } catch {
    // Recovery could not ask Stripe: the charge stays held, and the window says so rather than offering a refund.
    inFlight = 'A refund of this charge is waiting for Stripe’s answer, and Stripe could not be asked just now. Open the charge again in a moment.';
  }
  // The charge's remainder is Stripe's own (read above), whatever our record said; our refunds name who made them.
  const refunds = await clubRefunds(id, chargeId);

  return NextResponse.json({ charge, ourRefunds: refunds, inFlight }, { headers: noStore });
}, { route: '/api/platform-admin/orgs/[id]/money/charges/[chargeId]' });
