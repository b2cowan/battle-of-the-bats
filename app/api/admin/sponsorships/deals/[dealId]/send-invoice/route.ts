import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { readDeal, readDealProvince } from '@/lib/club-sponsorship-deals-server';
import { readSettings } from '@/lib/club-sponsorships-server';
import { dealFigures, invoiceArg } from '@/lib/club-sponsorship-deals';
import { closeSponsorCheckout, unrecordedCardPayment } from '@/lib/sponsor-card-server';
import { emailDealInvoice } from '@/lib/sponsor-invoice-email';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { tournamentToday } from '@/lib/timezone';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { offerLapsedNow } from '@/lib/club-sponsorship-offer-lapsed';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';

/**
 * SEND THE INVOICE (Board Ready Stage 6 Part 3b; round 1 tab 5's Form received callout: "Northside Auto sent their details and
 * started to pay by card, but didn't finish" — lime "Send the invoice": "they pay by cheque or e-transfer instead. Their link
 * still lets them pay by card"). Issues the invoice of a deal its business left at Form received, as choosing a cheque or
 * e-transfer does (mig 530 `club_sponsor_deal_issue`: the number, issue and due days, the tax at the business's province),
 * then emails it. A card page still open on the deal is closed first — one paid after the invoice went out would pay it twice;
 * a page that has just completed refuses the send (its landing records the payment). Answers 200 { emailed, to }.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ dealId: string }> };
const C = DEAL_WORDS.card;

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const { dealId } = await params;
  const deal = isUuid(dealId) ? await readDeal(org.id, dealId) : null;
  if (!deal) return NextResponse.json({ error: SPONSORSHIPS_WORDS.say.notFound, code: 'not_found' }, { status: 404 });
  if (deal.state !== 'form_received') return refused(C.errNotFormReceived, 409, 'not_form_received');
  if (await offerLapsedNow(org.id, deal)) return refused(DEAL_WORDS.deal.errLapsed, 409, 'lapsed');

  // Money already taken by card and not recorded: an invoice would bill the business a second time.
  if (await unrecordedCardPayment(org.id, dealId)) return refused(C.errCardTaken, 409, 'card_paid');
  const closed = await closeSponsorCheckout(dealId);
  if (closed !== 'closed') return refused(C.errCardPaying, 409, closed === 'paid' ? 'card_paid' : 'card_open');

  const [settings, province] = await Promise.all([readSettings(org.id), readDealProvince(org.id, dealId)]);
  const issuedOn = tournamentToday();
  const fig = dealFigures({ amount: deal.amount, chargeTax: deal.chargeTax, registered: settings.registered, province, on: issuedOn });
  const { error } = await supabaseAdmin.rpc('club_sponsor_deal_issue', {
    p_org: org.id, p_deal: dealId,
    p_invoice: invoiceArg(fig, issuedOn, settings.paymentDueDays),
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === 'SP001') return refused(C.errNotFormReceived, 409, 'not_form_received');
    if (code === 'SP005') return refused(C.errCardPaying, 409, 'card_open');
    console.error('[sponsorships] the invoice could not be issued:', dealId, code ?? 'no code');
    return refused(DEAL_WORDS.page.errFailed, 500, 'failed');
  }
  const emailed = await emailDealInvoice(org.id, org.slug, dealId, 'issued');
  const { data: row } = await supabaseAdmin.from('club_sponsor_deals').select('contact_email').eq('org_id', org.id).eq('id', dealId).maybeSingle();
  return NextResponse.json({ emailed, to: (row?.contact_email as string | null) ?? null });
}, { route: '/api/admin/sponsorships/deals/[dealId]/send-invoice' });
