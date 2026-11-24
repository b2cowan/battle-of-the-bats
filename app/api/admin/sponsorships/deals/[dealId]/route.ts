import { NextResponse } from 'next/server';
import { onlinePaymentsOn } from '@/lib/online-payments-switch';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { readPlaceTargets, readSettings } from '@/lib/club-sponsorships-server';
import {
  changeDealPlace, changeDealTerms, readDeal, readDealBusiness, readDealOffers, readDealProvince, readDeals, readOfferBars,
  reviseDealInvoice,
} from '@/lib/club-sponsorship-deals-server';
import { emailDealInvoice } from '@/lib/sponsor-invoice-email';
import { readDealAnswers } from '@/lib/club-form-staff';
import { dealLinkUrl, findTarget, offerContactOf } from '@/lib/club-sponsorship-deal-actions';
import { bandOf, canRevise, dealFigures, emailBarFor, linkTakesForm } from '@/lib/club-sponsorship-deals';
import { parsePrice } from '@/lib/club-sponsorships';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';
import { gstHstRateOn } from '@/lib/gst-hst-rates';
import { isCalendarDate, tournamentToday } from '@/lib/timezone';
import { closeSponsorCheckout, unrecordedCardPayment } from '@/lib/sponsor-card-server';

/**
 * ONE DEAL (Board Ready Stage 6, Part 2; round 1 tab 5). GET reads the deal's page whole: the deal as offered, the business
 * as its link sent it, its answers (`readDealAnswers`, the Stage 4 staff reader — this route is its one caller, behind
 * Sponsorships), the offer emails sent, whether its address may still be emailed, the copyable link at its current version.
 * PATCH changes where it shows and its last day (any state but withdrawn: "A deal's place changes on the deal", ask 1), or
 * its amount and tax switch: while the offer is open, the offer's; once invoiced (and nothing paid), the REVISED invoice
 * (Part 3a) — the number kept, the figures worked out again at the rate of the business's invoice province today, the
 * revision's day stamped, and the revised invoice emailed. Money on the invoice refuses it (void the payment first).
 * GET also carries the deal's payments (Record a payment's money band, the void).
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ dealId: string }> };
const notFound = () => NextResponse.json({ error: SPONSORSHIPS_WORDS.say.notFound, code: 'not_found' }, { status: 404 });

export const GET = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const { dealId } = await params;
  if (!isUuid(dealId)) return notFound();
  const deal = await readDeal(org.id, dealId);
  if (!deal) return notFound();
  const today = tournamentToday(new Date());
  const [business, offers, answers, bars, settings, targets, all] = await Promise.all([
    readDealBusiness(org.id, dealId), readDealOffers(org.id, dealId), readDealAnswers(org.id, dealId), readOfferBars(org.id),
    readSettings(org.id), readPlaceTargets(org.id), readDeals(org.id),
  ]);
  const address = deal.offeredTo ?? business?.email ?? null;
  const { linkVersion, payments, refunds, ...shown } = deal;
  const rate = settings.registered ? gstHstRateOn(business?.address?.province ?? null, today) : null;
  return NextResponse.json({
    deal: { ...shown, band: bandOf(deal) },
    business,
    offers,
    payments,
    refunds,
    // Part 3b: whether refunds to the card can be asked now (the launch switch: the Refund button is absent, not broken, while it is off).
    cardRefundsOn: onlinePaymentsOn(),
    // A card payment Stripe took that never landed on this deal: the callout says so instead of "didn't finish".
    unrecordedCard: deal.state === 'withdrawn' ? null : await unrecordedCardPayment(org.id, dealId).catch(() => null),
    answers,
    address,
    bar: emailBarFor(address, bars.stops, bars.family),
    link: deal.state === 'withdrawn' ? null : dealLinkUrl(org.slug, deal.id, linkVersion),
    registered: settings.registered,
    hasMailingAddress: !!settings.mailingAddress,
    hasContact: !!(await offerContactOf(org.id, settings)),
    rate,
    targets,
    holds: all.filter(d => d.state !== 'withdrawn' && d.id !== deal.id)
      .map(d => ({ id: d.id, state: d.state, placeKind: d.placeKind, targetId: d.targetId, businessName: d.businessName })),
    today,
  });
}, { route: '/api/admin/sponsorships/deals/[dealId]' });

export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const { dealId } = await params;
  if (!isUuid(dealId)) return notFound();
  const deal = await readDeal(org.id, dealId);
  if (!deal || deal.state === 'withdrawn') return notFound();
  const b = (await req.json().catch(() => null) ?? {}) as Record<string, unknown>;

  // Everything is checked before anything is written, so a refused change never half-applies.
  let place: { targetId: string | null; targetName: string | null; endsOn: string | null } | null = null;
  if ('targetId' in b || 'endsOn' in b) {
    const endsRaw = 'endsOn' in b ? (typeof b.endsOn === 'string' ? b.endsOn.trim() : '') : deal.endsOn ?? '';
    if (endsRaw && !isCalendarDate(endsRaw)) return refused(DEAL_WORDS.offer.errLastDay);
    let targetId = deal.targetId;
    let targetName = deal.targetName;
    if ('targetId' in b && deal.placeKind !== 'club') {
      const id = typeof b.targetId === 'string' && isUuid(b.targetId) ? b.targetId : null;
      const t = await readPlaceTargets(org.id);
      const hit = findTarget(t, deal.placeKind, id);
      if (!hit) return refused(DEAL_WORDS.offer.errTarget);
      targetId = hit.id;
      targetName = hit.name;
    }
    place = { targetId, targetName, endsOn: endsRaw || null };
  }

  let terms: { amount: number; chargeTax: boolean; registered: boolean } | null = null;
  if ('amount' in b || 'chargeTax' in b) {
    const amount = 'amount' in b ? parsePrice(b.amount) : deal.amount;
    if (amount == null) return refused(DEAL_WORDS.offer.errAmount);
    const settings = await readSettings(org.id);
    // "Changed" is what the coach asked for against what the deal says — not against the registration mask, so a deal
    // invoiced with tax is not silently re-issued untaxed because the club's registration was switched off since.
    const asked = 'chargeTax' in b ? b.chargeTax === true : deal.chargeTax;
    const chargeTax = settings.registered && asked;
    const changed = Math.round(amount * 100) !== Math.round(deal.amount * 100) || asked !== deal.chargeTax;
    if (changed) {
      if (!linkTakesForm(deal) && !canRevise(deal)) return refused(DEAL_WORDS.deal.errPaidChange, 409, 'has_payment');
      terms = { amount, chargeTax, registered: settings.registered };
    }
  }

  // A card page open on the deal shows the OLD figures, and a card payment lands at the figures its page showed: change the
  // terms under it and the edit is silently reverted (or the payment fails to record). Close it first, as Send the invoice does.
  if (terms) {
    const closed = await closeSponsorCheckout(dealId);
    if (closed !== 'closed') return refused(DEAL_WORDS.card.errCardPaying, 409, closed === 'paid' ? 'card_paid' : 'card_open');
  }

  let revised: 'emailed' | 'not_emailed' | null = null;
  if (terms && linkTakesForm(deal)) {
    if (!(await changeDealTerms(org.id, dealId, terms))) return refused(DEAL_WORDS.deal.errPaidChange, 409, 'has_payment');
  } else if (terms) {
    // The revised invoice: its figures at the rate of the invoice province on the revision's day, the number kept.
    const today = tournamentToday();
    const province = await readDealProvince(org.id, dealId);
    // No address, no tax (owner 2026-11-23): the rate is the address's province, and an untaxed deal's business may have
    // left it blank. Charging "tax" at no rate would invoice a total with nothing on it.
    if (terms.chargeTax && !province) return refused(DEAL_WORDS.deal.taxNeedsAddress, 409, 'no_address');
    const fig = dealFigures({ ...terms, province, on: today });
    const r = await reviseDealInvoice(org.id, dealId, {
      amount: terms.amount, chargeTax: terms.chargeTax, taxKind: fig.rate?.kind ?? null, taxRate: fig.rate?.rate ?? null,
      tax: fig.rate ? fig.tax : null, total: fig.total, on: today,
    });
    if (!r.ok) {
      return r.why === 'has_payment' ? refused(DEAL_WORDS.deal.errPaidChange, 409, 'has_payment') : refused(DEAL_WORDS.deal.errNotOwing, 409, 'not_owing');
    }
    revised = (await emailDealInvoice(org.id, org.slug, dealId, 'revised')) ? 'emailed' : 'not_emailed';
  }
  if (place) await changeDealPlace(org.id, dealId, place);
  return NextResponse.json({ ok: true, revised });
}, { route: '/api/admin/sponsorships/deals/[dealId]' });
