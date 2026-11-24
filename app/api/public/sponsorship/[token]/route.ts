import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withObservability } from '@/lib/observability';
import { throttlePublicForm } from '@/lib/public-form-throttle';
import { dealForLink } from '@/lib/sponsor-link-route';
import { buildSponsorPageView, targetExists } from '@/lib/sponsor-deal-view';
import { signupFormView, sponsorshipFormId } from '@/lib/club-form-server';
import { checkDealFileUses, dealLinkFormState } from '@/lib/club-form-deal';
import { handoversFrom } from '@/lib/club-form-family';
import { SPONSOR_LINK_WORDS as L } from '@/lib/sponsor-link-words';
import { answersIn, checkAnswers, type SignupQuestion } from '@/lib/club-form-signup';
import { readSettings } from '@/lib/club-sponsorships-server';
import { dealFigures, invoiceArg, linkTakesForm, parseBusinessInput } from '@/lib/club-sponsorship-deals';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { CANADIAN_PROVINCES } from '@/lib/canadian-provinces';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { tournamentToday } from '@/lib/timezone';
import { emailDealInvoice } from '@/lib/sponsor-invoice-email';
import { closeSponsorCheckout, openSponsorCheckout, sponsorCardFacts, sponsorFeeFor, unrecordedCardPayment } from '@/lib/sponsor-card-server';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';

export const dynamic = 'force-dynamic';

const PROVINCES = new Set(CANADIAN_PROVINCES.map(p => p.code));
const P = DEAL_WORDS.page;

/**
 * POST /api/public/sponsorship/[token] — the business sends its details, its answers and how it will pay (Board Ready
 * Stage 6 Part 2; round 1 tab 4, round 2 tab 1; owner call (b): the cheque or e-transfer way only until Part 3 adds card).
 * No sign-in: the link IS the authorization, and it opens ONE deal (the one door). Body:
 *   { business: { name, contactName, email, phone, website, street, city, province, postal },
 *     answers: [{ questionId, text | choiceIds | bool | date | fileId }], documents: [{ id, versionId }], formStamp }
 * Throttled first. The fixed fields (ask 8) and the club's questions are checked as the family form checks them; a PDF
 * ticked needs this browser's hand-over receipt; a document whose current version this deal already ticked isn't asked
 * again. Then, in ONE transaction (mig 526 `club_sponsor_deal_receive`): the business record, the deal's copy, the
 * answers, files and ticks, and — choosing a cheque or e-transfer issues the invoice at once (ask 4) — its number, with
 * the tax at the rate of the province typed (ask 9) when the club is registered and the deal's switch is on. Then the
 * invoice is emailed to the address the business typed (Part 3a).
 *   · `payMethod: 'card'` (Part 3b, round 2 tab 1): the details are kept (Form received, no invoice yet) and the card page
 *     opens at the figure the button showed — the invoice is issued when the payment lands, at those figures, with the fee row
 *     when the Payouts card says the sponsor pays it. Answers 200 { url } (the page goes to the card page). Absent while the
 *     club doesn't take card (`sponsorCardFacts`): 409, and the cheque button is still there.
 * Answers: 200 { view } (the page redraws as the thank-you); 400 { errors, missing }; 409 { code: 'form_changed', view }
 * or { code: 'closed', view }.
 */
export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const throttled = throttlePublicForm(req);
  if (throttled) return throttled;
  const { token } = await params;
  const at = await dealForLink(token);
  if ('failure' in at) return at.failure;
  const { org, deal } = at;
  const fresh = () => buildSponsorPageView(org.slug, token);
  if (!linkTakesForm(deal) || !(await targetExists(deal.placeKind, deal.targetId))) return NextResponse.json({ error: P.errClosed, code: 'closed', view: await fresh() }, { status: 409 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: P.errFailed }, { status: 400 }); }

  const errors: Record<string, string> = {};
  const missing: string[] = [];
  const raw = (body.business ?? {}) as Record<string, unknown>;
  // The address is required only when this deal charges GST/HST: its province sets the rate (owner 2026-11-23).
  const settings = await readSettings(org.id);
  const business = parseBusinessInput(raw, PROVINCES, P.err, { addressRequired: settings.registered && deal.chargeTax });
  if (!business.ok) {
    for (const [k, v] of Object.entries(business.errors)) {
      errors[`business.${k}`] = v;
      const blank = typeof raw[k] !== 'string' || !(raw[k] as string).trim();
      if (blank && k !== 'phone' && k !== 'website') missing.push(`business.${k}`);
    }
  }

  const formId = await sponsorshipFormId(org.id);
  const view = formId ? await signupFormView(formId) : null;
  if (view && (view.questions.length || view.documents.length) && body.formStamp !== view.stamp) {
    return NextResponse.json({ error: L.changed(org.name), code: 'form_changed', view: await fresh() }, { status: 409 });
  }
  const questions = view?.questions ?? [];
  const documents = view?.documents ?? [];
  const checked = checkAnswers(questions, answersIn(body.answers), null, qid => `q.${qid}`);
  Object.assign(errors, checked.errors);
  missing.push(...checked.missing);
  if (formId) {
    Object.assign(errors, await checkDealFileUses(formId, deal.id, checked.answers, new Map<string, SignupQuestion>(questions.map(q => [q.id, q])), qid => `q.${qid}`));
  }

  // Documents: each live one ticked on its current version (or ticked before, on that version); a PDF only once OUR
  // SERVER handed it over to this browser.
  const sentTicks = new Map<string, string>();
  if (Array.isArray(body.documents)) {
    for (const t of body.documents as unknown[]) {
      const r = (t ?? {}) as Record<string, unknown>;
      if (typeof r.id === 'string' && typeof r.versionId === 'string') sentTicks.set(r.id, r.versionId);
    }
  }
  const saved = formId ? await dealLinkFormState(formId, deal.id) : { answers: [], tickedVersions: [] };
  const already = new Set(saved.tickedVersions);
  const jar = await cookies();
  const handedOver = handoversFrom(name => jar.get(name)?.value, documents);
  const ticks: { documentId: string; versionId: string; sentence: string; handedOverAt: string | null }[] = [];
  for (const d of documents) {
    if (already.has(d.versionId)) continue;
    if (sentTicks.get(d.id) !== d.versionId) { errors[`documents.${d.id}`] = L.docMissing(d.name, d.source === 'pdf'); missing.push(`documents.${d.id}`); }
    else if (d.source === 'pdf' && !handedOver.has(d.id)) errors[`documents.${d.id}`] = L.docNotOpened(d.name);
    else ticks.push({ documentId: d.id, versionId: d.versionId, sentence: d.sentence, handedOverAt: handedOver.get(d.id)?.toISOString() ?? null });
  }
  if (Object.keys(errors).length > 0 || !business.ok) return NextResponse.json({ errors, missing }, { status: 400 });

  // Money already taken by card and not recorded (a second tab or device still showing the form): an invoice on top of it would
  // bill the business twice, so the page is refreshed to say the payment was received. Fails closed: a read that fails is a 500.
  if (await unrecordedCardPayment(org.id, deal.id)) {
    return NextResponse.json({ error: DEAL_WORDS.card.errReceived, code: 'received', view: await fresh() }, { status: 409 });
  }
  // The invoice, issued now (ask 4; owner call (a)): its year, due day and figures, fixed here.
  const issuedOn = tournamentToday();
  const fig = dealFigures({ amount: deal.amount, chargeTax: deal.chargeTax, registered: settings.registered, province: business.value.province, on: issuedOn });
  const byCard = body.payMethod === 'card';
  const card = byCard ? await sponsorCardFacts(org.id) : null;
  if (byCard && !card) return NextResponse.json({ error: DEAL_WORDS.card.errOff, code: 'card_off', view: await fresh() }, { status: 409 });
  const cardFee = card ? sponsorFeeFor(fig.total, card, fig.rate?.rate ?? null, false) : null;
  // The business is invoiced the figure its page showed (a club edit while the page sat open refreshes the page instead).
  // By card that is the button's total, the fee and its tax included when the sponsor pays it.
  const shown = cardFee ? cardFee.totalCents : Math.round(fig.total * 100);
  if (typeof body.expectedTotal !== 'number' || Math.round(body.expectedTotal * 100) !== shown) {
    return NextResponse.json({ error: P.errPriceChanged, code: 'terms_changed', view: await fresh() }, { status: 409 });
  }
  // Choosing cheque or e-transfer (a second tab, or Back after starting the card page) issues the invoice, so a card page left
  // open must go first: paid on afterwards it would land "not recorded" and the business would be charged AND invoiced.
  if (!byCard) {
    const closed = await closeSponsorCheckout(deal.id);
    if (closed === 'paid') return NextResponse.json({ error: DEAL_WORDS.card.errReceived, code: 'card_paid', view: await fresh() }, { status: 409 });
    if (closed === 'busy') return NextResponse.json({ error: P.errFailed, code: 'card_busy' }, { status: 503 });
  }
  const invoice = { ...invoiceArg(fig, issuedOn, settings.paymentDueDays), payMethod: 'cheque_etransfer' };
  const writesForm = !!formId && (checked.answers.length > 0 || ticks.length > 0 || saved.answers.length > 0);
  const { error } = await supabaseAdmin.rpc('club_sponsor_deal_receive', {
    p_org: org.id, p_deal: deal.id, p_version: deal.linkVersion, p_form: writesForm ? formId : null,
    p_business: business.value, p_answers: checked.answers, p_ticks: ticks, p_invoice: byCard ? null : invoice,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === 'SP001') return NextResponse.json({ error: P.errClosed, code: 'closed', view: await fresh() }, { status: 409 });
    if (code === 'CF001' || code === 'CF002' || code === 'CF003') {
      return NextResponse.json({ error: L.changed(org.name), code: 'form_changed', view: await fresh() }, { status: 409 });
    }
    // Never the error object: it can echo what the business typed.
    console.error('[sponsorship-link] receiving a business failed:', code ?? 'no code');
    return NextResponse.json({ error: P.errFailed }, { status: 500 });
  }
  if (card && cardFee) {
    // Form received is kept whatever the card page does next: the club sees "started to pay by card, but didn't finish"
    // until it lands, and can send the invoice instead (round 1 tab 5).
    const opened = await openSponsorCheckout({
      origin: resolveTrustedAppOrigin(req), orgId: org.id, orgSlug: org.slug, token, dealId: deal.id, facts: card, fee: cardFee,
      plan: { amount: deal.amount, taxKind: fig.rate?.kind ?? null, taxRate: fig.rate?.rate ?? null, tax: fig.tax, total: fig.total, dueDays: settings.paymentDueDays },
      taxKind: fig.rate?.kind ?? null, lineName: DEAL_WORDS.email.title(deal.packageName, deal.placeKind === 'club' ? null : deal.targetName),
      email: business.value.email,
    });
    if (!opened.ok) return NextResponse.json({ error: opened.error, code: 'card_failed', view: await fresh() }, { status: opened.status });
    return NextResponse.json({ url: opened.url });
  }
  // The invoice goes by email at once (Part 3a; owner call (2): a link, no attachment). Awaited, never `after()` (it is
  // dropped on the host); a failed send never fails the step — the page shows the invoice either way.
  await emailDealInvoice(org.id, org.slug, deal.id, 'issued');
  return NextResponse.json({ view: await fresh() });
}, { route: '/api/public/sponsorship/[token]' });
