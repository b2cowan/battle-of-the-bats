import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { readSettings } from '@/lib/club-sponsorships-server';
import {
  markLinkUnsent, readDeal, readDealBusiness, readDealOffers, replaceDealLink,
} from '@/lib/club-sponsorship-deals-server';
import { actorOf, dealLinkUrl } from '@/lib/club-sponsorship-deal-actions';
import { againPlan, sendOffer } from '@/lib/club-sponsorship-offer-send';
import { offerLapsedNow } from '@/lib/club-sponsorship-offer-lapsed';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';
import { payLinkSecret } from '@/lib/sponsor-deal-link';
import { tournamentToday } from '@/lib/timezone';

/**
 * "SEND THE LINK AGAIN (THE OLD LINK STOPS WORKING)" (Board Ready Stage 6, Part 2; round 1 tab 5), and on a deal made as a
 * link only its "Make a new link" (owner 1A, 2026-11-23). The deal's link version moves on, so the old link shows no business
 * details (/legal §2). A deal that was emailed, and still takes the business's details, is emailed again with the reason it
 * was first offered for (a new row in the CASL record, kind 'again') — only while that reason still holds on today (owner 3A:
 * paid more than two years ago, or asked more than six months ago, and nothing is emailed), never to a stopped or
 * family-opted-out address, and never without the mailing address. The email waits on those; the new link does not.
 * `againPlan` decides it, the same read the deal's page names its button and confirm from; `outcome` says which notice.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ dealId: string }> };
type Outcome = 'emailed' | 'unconfirmed' | 'link_only' | 'not_due' | 'ran_out' | 'not_emailed';

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
  // Asked before the old link stops working, so a read that fails changes nothing.
  const plan = await againPlan({ orgId: org.id, settings, deal, offers, businessEmail: business?.email ?? null, today });
  const version = await replaceDealLink(org.id, dealId);
  if (version == null) return refused(DEAL_WORDS.deal.errLinkChanged, 409, 'link_changed');
  const link = dealLinkUrl(org.slug, dealId, version);
  const unsent = async (outcome: Outcome, error?: string) => {
    await markLinkUnsent(org.id, dealId);
    return NextResponse.json({ link, emailed: false, outcome, ...(error ? { error } : {}) });
  };

  // The confirm the club pressed said nothing would be emailed (the page read the deal a moment earlier): that holds even if
  // a rule has cleared since (the press only ever sends less than it was asked to, never more: /review 2026-11-26), and the
  // notice then says nothing was emailed, never "couldn't" (/marketing 2026-11-26).
  const quiet = ((await req.json().catch(() => null)) as { expectsEmail?: unknown } | null)?.expectsEmail === false;
  if (!plan.emails) return unsent(quiet && plan.outcome === 'not_emailed' ? 'not_due' : plan.outcome, plan.error);
  if (quiet) return unsent('not_due');
  const { first, to, contactEmail } = plan;
  let delivery: 'sent' | 'unconfirmed';

  try {
    delivery = await sendOffer({
      orgId: org.id, orgSlug: org.slug, deal: { ...deal, linkVersion: version }, to, reason: first.reason, reasonOn: first.reasonOn,
      note: null, settings, contactEmail, province: business?.address?.province ?? null, today, kind: 'again',
      by: await actorOf(gate.ctx),
    });
  } catch (e) {
    console.error('[sponsorships] offer email (again) failed:', (e as Error)?.message ?? 'no message');
    return unsent('not_emailed', DEAL_WORDS.offer.errEmailFailed);
  }
  const outcome: Outcome = delivery === 'unconfirmed' ? 'unconfirmed' : 'emailed';
  return NextResponse.json({ link, emailed: delivery === 'sent', outcome, to });
}, { route: '/api/admin/sponsorships/deals/[dealId]/again' });
