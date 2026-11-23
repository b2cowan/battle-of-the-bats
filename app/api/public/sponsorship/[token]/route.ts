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
import { dealFigures, dueOnFrom, invoiceYearOf, linkTakesForm, parseBusinessInput } from '@/lib/club-sponsorship-deals';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { CANADIAN_PROVINCES } from '@/lib/canadian-provinces';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { tournamentToday } from '@/lib/timezone';

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
 * the tax at the rate of the province typed (ask 9) when the club is registered and the deal's switch is on.
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
  const business = parseBusinessInput(raw, PROVINCES, P.err);
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

  // The invoice, issued now (ask 4; owner call (a)): its year, due day and figures, fixed here.
  const settings = await readSettings(org.id);
  const issuedOn = tournamentToday();
  const fig = dealFigures({ amount: deal.amount, chargeTax: deal.chargeTax, registered: settings.registered, province: business.value.province, on: issuedOn });
  // The business is invoiced the figure its page showed (a club edit while the page sat open refreshes the page instead).
  if (typeof body.expectedTotal !== 'number' || Math.round(body.expectedTotal * 100) !== Math.round(fig.total * 100)) {
    return NextResponse.json({ error: P.errPriceChanged, code: 'terms_changed', view: await fresh() }, { status: 409 });
  }
  const invoice = {
    year: invoiceYearOf(issuedOn), issuedOn, dueOn: dueOnFrom(issuedOn, settings.paymentDueDays),
    taxKind: fig.rate?.kind ?? '', taxRate: fig.rate ? String(fig.rate.rate) : '', taxAmount: fig.rate ? String(fig.tax) : '',
    total: String(fig.total), payMethod: 'cheque_etransfer',
  };
  const writesForm = !!formId && (checked.answers.length > 0 || ticks.length > 0 || saved.answers.length > 0);
  const { error } = await supabaseAdmin.rpc('club_sponsor_deal_receive', {
    p_org: org.id, p_deal: deal.id, p_version: deal.linkVersion, p_form: writesForm ? formId : null,
    p_business: business.value, p_answers: checked.answers, p_ticks: ticks, p_invoice: invoice,
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
  return NextResponse.json({ view: await fresh() });
}, { route: '/api/public/sponsorship/[token]' });
