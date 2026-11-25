import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { readSettings } from '@/lib/club-sponsorships-server';
import {
  markLinkUnsent, readDeal, readDealBusiness, readDealOffers, readOfferBars, replaceDealLink,
} from '@/lib/club-sponsorship-deals-server';
import { actorOf, dealLinkUrl, emailDealOffer, offerContactOf, recordOfferSafely } from '@/lib/club-sponsorship-deal-actions';
import { emailBarFor, linkTakesForm, reasonHolds } from '@/lib/club-sponsorship-deals';
import { offerLapsedNow } from '@/lib/club-sponsorship-offer-lapsed';
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
type Outcome = 'emailed' | 'link_only' | 'ran_out' | 'not_emailed';

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const { dealId } = await params;
  const deal = isUuid(dealId) ? await readDeal(org.id, dealId) : null;
  if (!deal || deal.state === 'withdrawn') return NextResponse.json({ error: SPONSORSHIPS_WORDS.say.notFound, code: 'not_found' }, { status: 404 });
  if (!payLinkSecret()) return refused(DEAL_WORDS.offer.noSecret, 503, 'no_secret');
  if (await offerLapsedNow(org.id, deal)) return refused(DEAL_WORDS.deal.errLapsed, 409, 'lapsed');

  const [offers, settings, bars, business] = await Promise.all([
    readDealOffers(org.id, dealId), readSettings(org.id), readOfferBars(org.id), readDealBusiness(org.id, dealId),
  ]);
  const today = tournamentToday(new Date());
  const first = offers.find(o => o.kind === 'offer') ?? offers[0] ?? null;
  const to = deal.offeredTo ?? business?.email ?? null;
  const version = await replaceDealLink(org.id, dealId);
  if (version == null) return refused(DEAL_WORDS.deal.errLinkChanged, 409, 'link_changed');
  const link = dealLinkUrl(org.slug, dealId, version);
  const unsent = async (outcome: Outcome, error?: string) => {
    await markLinkUnsent(org.id, dealId);
    return NextResponse.json({ link, emailed: false, outcome, ...(error ? { error } : {}) });
  };

  if (!first) return unsent('link_only');
  if (!reasonHolds(first.reason, first.reasonOn, today)) return unsent('ran_out');
  const contactEmail = await offerContactOf(org.id, settings);
  const emailable = !!to && !!contactEmail && linkTakesForm(deal) && !!settings.mailingAddress && !emailBarFor(to, bars.stops, bars.family);
  if (!emailable) return unsent('not_emailed');

  const by = await actorOf(gate.ctx);
  try {
    await emailDealOffer({
      orgId: org.id, orgSlug: org.slug, deal: { ...deal, linkVersion: version }, to: to!, reason: first.reason, note: null, settings, contactEmail: contactEmail!,
      province: business?.address?.province ?? null, today,
    });
  } catch (e) {
    console.error('[sponsorships] offer email (again) failed:', (e as Error)?.message ?? 'no message');
    return unsent('not_emailed', DEAL_WORDS.offer.errEmailFailed);
  }
  await recordOfferSafely(org.id, dealId, { email: to!, businessName: deal.businessName, reason: first.reason, reasonOn: first.reasonOn, kind: 'again', by });
  return NextResponse.json({ link, emailed: true, outcome: 'emailed' satisfies Outcome, to });
}, { route: '/api/admin/sponsorships/deals/[dealId]/again' });
