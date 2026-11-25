import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { readSettings } from '@/lib/club-sponsorships-server';
import {
  readDeal, readDealBusiness, readOfferBars, readSponsorContacts, rememberSponsorEmail,
} from '@/lib/club-sponsorship-deals-server';
import { actorOf, emailDealOffer, offerContactOf, reasonErrors, recordOfferSafely } from '@/lib/club-sponsorship-deal-actions';
import { emailBarFor, linkTakesForm, OFFER_NOTE_MAX, parseReasonInput } from '@/lib/club-sponsorship-deals';
import { offerLapsedNow } from '@/lib/club-sponsorship-offer-lapsed';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';
import { payLinkSecret } from '@/lib/sponsor-deal-link';
import { OfferEmailRefused } from '@/lib/sponsor-offer-email';
import { checkEmail } from '@/lib/site-field-checks';
import { tournamentToday } from '@/lib/timezone';

/**
 * "EMAIL THE OFFER" (Board Ready Stage 6, Part 2; the link-only drawing's tab 2, approved 1A 2026-11-23): a deal made as a link
 * only, emailed later once the club has a reason. The same rules as Offer a deal's Send — the reason (and its When?, 3A), the
 * mailing address, a contact for questions, no stopped or family-opted-out address — and the CASL record written once it
 * went. The link is the deal's current one (the business may already hold it in person), so nothing is replaced. An email
 * that fails keeps the deal: it was offered in person already.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ dealId: string }> };
const O = DEAL_WORDS.offer;

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const { dealId } = await params;
  const deal = isUuid(dealId) ? await readDeal(org.id, dealId) : null;
  if (!deal || deal.state === 'withdrawn') return NextResponse.json({ error: SPONSORSHIPS_WORDS.say.notFound, code: 'not_found' }, { status: 404 });
  if (deal.emailedAt) return refused(DEAL_WORDS.deal.errAlreadyEmailed, 409, 'already_emailed');
  if (!linkTakesForm(deal)) return refused(DEAL_WORDS.deal.errEmailClosed, 409, 'not_open');
  if (await offerLapsedNow(org.id, deal)) return refused(DEAL_WORDS.deal.errLapsed, 409, 'lapsed');

  const body = (await req.json().catch(() => null) ?? {}) as Record<string, unknown>;
  const today = tournamentToday(new Date());
  const why = parseReasonInput(body, today, reasonErrors());
  if (!why.ok) return NextResponse.json({ error: why.error, field: why.field ?? null }, { status: 400 });
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
  if (note && note.length > OFFER_NOTE_MAX) return NextResponse.json({ error: O.errNote, field: 'note' }, { status: 400 });

  const [settings, business, contacts] = await Promise.all([readSettings(org.id), readDealBusiness(org.id, dealId), readSponsorContacts(org.id)]);
  const sponsor = contacts.find(c => c.id === deal.sponsorId) ?? null;
  let to = deal.offeredTo ?? business?.email ?? sponsor?.email ?? null;
  let typed = false;
  if (!to) {
    const e = checkEmail(body.email);
    if (!e.ok || !e.value) return NextResponse.json({ error: O.errEmail, field: 'email' }, { status: 400 });
    to = e.value.toLowerCase();
    typed = true;
  }
  if (!settings.mailingAddress) return refused(O.needsAddress, 409, 'no_mailing_address');
  const contactEmail = await offerContactOf(org.id, settings);
  if (!contactEmail) return refused(O.needsContact, 409, 'no_contact');
  const bars = await readOfferBars(org.id);
  const bar = emailBarFor(to, bars.stops, bars.family);
  if (bar) return refused(bar.kind === 'do_not_offer' ? O.errBarredStop : O.errBarred, 409, bar.kind);
  if (!payLinkSecret()) return refused(O.noSecret, 503, 'no_secret');

  try {
    await emailDealOffer({
      orgId: org.id, orgSlug: org.slug, deal, to, reason: why.value.reason, note, settings, contactEmail,
      province: business?.address?.province ?? sponsor?.province ?? null, today,
    });
  } catch (e) {
    if (!(e instanceof OfferEmailRefused)) console.error('[sponsorships] offer email (link made) failed:', (e as Error)?.message ?? 'no message');
    return refused(DEAL_WORDS.deal.errEmailFailedKept, 502, 'email_failed');
  }
  if (typed && sponsor && !sponsor.email) await rememberSponsorEmail(org.id, sponsor.id, to);
  await recordOfferSafely(org.id, dealId, {
    email: to, businessName: deal.businessName, reason: why.value.reason, reasonOn: why.value.reasonOn, kind: 'offer', by: await actorOf(gate.ctx),
  });
  return NextResponse.json({ emailed: true, to });
}, { route: '/api/admin/sponsorships/deals/[dealId]/email' });
