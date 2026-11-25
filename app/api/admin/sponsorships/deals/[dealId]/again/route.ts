import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { readSettings } from '@/lib/club-sponsorships-server';
import {
  markLinkUnsent, readDeal, readDealBusiness, readDealOffers, replaceDealLink,
} from '@/lib/club-sponsorship-deals-server';
import { actorOf, dealLinkUrl } from '@/lib/club-sponsorship-deal-actions';
import { offerSendCheck, paidReasonRefusal, sendOffer } from '@/lib/club-sponsorship-offer-send';
import { offerLapsedNow } from '@/lib/club-sponsorship-offer-lapsed';
import { linkTakesForm, reasonHolds } from '@/lib/club-sponsorship-deals';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';
import { payLinkSecret } from '@/lib/sponsor-deal-link';
import { tournamentToday } from '@/lib/timezone';

/**
 * "SEND THE LINK AGAIN (THE OLD LINK STOPS WORKING)" (Board Ready Stage 6, Part 2; round 1 tab 5), and on a deal made as a
 * link only its "Make a new link" (owner 1A, 2026-11-23). The deal's link version moves on, so the old link shows no business
 * details (/legal §2). A deal that was emailed is emailed again with the reason it was first offered for (a new row in the
 * CASL record, kind 'again') — only while that reason still holds on today (owner 3A: paid more than two years ago, or asked
 * more than six months ago, and nothing is emailed), never to a stopped or family-opted-out address, and never without the
 * mailing address. The email waits on those; the new link does not. `outcome` tells the page which notice to say.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ dealId: string }> };
type Outcome = 'emailed' | 'unconfirmed' | 'link_only' | 'ran_out' | 'not_emailed';

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const { dealId } = await params;
  const deal = isUuid(dealId) ? await readDeal(org.id, dealId) : null;
  if (!deal || deal.state === 'withdrawn') return NextResponse.json({ error: SPONSORSHIPS_WORDS.say.notFound, code: 'not_found' }, { status: 404 });
  if (!payLinkSecret()) return refused(DEAL_WORDS.offer.noSecret, 503, 'no_secret');
  if (await offerLapsedNow(org.id, deal)) return refused(DEAL_WORDS.deal.errLapsed, 409, 'lapsed');

  const [offers, settings, business] = await Promise.all([
    readDealOffers(org.id, dealId), readSettings(org.id), readDealBusiness(org.id, dealId),
  ]);
  const today = tournamentToday(new Date());
  const first = offers.find(o => o.kind === 'offer') ?? offers[0] ?? null;
  const to = deal.offeredTo ?? business?.email ?? null;
  // Asked before the old link stops working, so a read that fails changes nothing.
  const check = await offerSendCheck({ orgId: org.id, settings, to, sponsorId: deal.sponsorId });
  // A first reason of "They paid us" is read against the payments as they stand today (owner 2026-11-25).
  const paidRefusal = first?.reason === 'paid_recently' ? await paidReasonRefusal(org.id, deal.sponsorId, first.reasonOn, today) : null;
  const version = await replaceDealLink(org.id, dealId);
  if (version == null) return refused(DEAL_WORDS.deal.errLinkChanged, 409, 'link_changed');
  const link = dealLinkUrl(org.slug, dealId, version);
  const unsent = async (outcome: Outcome, error?: string) => {
    await markLinkUnsent(org.id, dealId);
    return NextResponse.json({ link, emailed: false, outcome, ...(error ? { error } : {}) });
  };

  if (!first) return unsent('link_only');
  if (!reasonHolds(first.reason, first.reasonOn, today)) return unsent('ran_out');
  if (!linkTakesForm(deal)) return unsent('not_emailed');
  if (!check.ok) return unsent('not_emailed');
  if (paidRefusal) return unsent('not_emailed', paidRefusal);
  let delivery: 'sent' | 'unconfirmed';

  try {
    delivery = await sendOffer({
      orgId: org.id, orgSlug: org.slug, deal: { ...deal, linkVersion: version }, to: check.to, reason: first.reason, reasonOn: first.reasonOn,
      note: null, settings, contactEmail: check.contactEmail, province: business?.address?.province ?? null, today, kind: 'again',
      by: await actorOf(gate.ctx),    });
  } catch (e) {
    console.error('[sponsorships] offer email (again) failed:', (e as Error)?.message ?? 'no message');
    return unsent('not_emailed', DEAL_WORDS.offer.errEmailFailed);
  }
  const outcome: Outcome = delivery === 'unconfirmed' ? 'unconfirmed' : 'emailed';
  return NextResponse.json({ link, emailed: delivery === 'sent', outcome, to: check.to });
}, { route: '/api/admin/sponsorships/deals/[dealId]/again' });
