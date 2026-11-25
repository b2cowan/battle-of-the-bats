'use client';
/**
 * A BUSINESS'S SPONSORSHIP PAGE (Board Ready Stage 6 Part 2; round 1 tab 4; round 2 tab 1's pay block). One page, no
 * account, on the club's frame: the package, About your business (the fixed fields the club can't remove, ask 8), Your
 * logo (with /legal's permission sentence), Questions from {club} (the Stage 4 form, the family form's own fields), and How
 * you'll pay. The card button shows only when the page view carries card facts (payouts connected, a refund policy, the
 * launch switch on); the other button sends the details and asks for the invoice ("Send and get my invoice"), which is
 * issued at once (ask 4).
 * The tax row shows only when the club is registered AND the deal's switch is on, at the rate of the province typed
 * (ask 9). After sending: the thank-you with the invoice and how to pay. A withdrawn offer shows only "This offer was
 * withdrawn. Contact {club}."; a replaced link its own sentence (owner call (f)); neither shows any business details. The Stage 4 error box: the count, the first named, focus to it, Go to it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import { sponsorCardFee } from '@/lib/online-payment-fee';
import { formatStoredDate, orgDayKey } from '@/lib/timezone';
import { clockOf } from '@/lib/league-card-refunds';
import formKit from '@/components/public/ClubForm.module.css';
import pay from '@/components/public/TeamPay.module.css';
import reg from '@/components/league/register.module.css';
import { ClubPrivacyLink, DocumentBlock, QuestionField, anyUploading, errorAttrs, toAnswerIn, type AnswerDraft } from '@/components/league/SignupFormFields';
import { answerName, sizeLine, type AnswerIn } from '@/lib/club-form-signup';
import { FAMILY_FORM_WORDS as QW } from '@/lib/club-form-family-words';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { SPONSOR_LINK_WORDS as L } from '@/lib/sponsor-link-words';
import { dealFigures, type BusinessField } from '@/lib/club-sponsorship-deals';
import { addressLines } from '@/lib/coach-sponsor-invoice';
import { CANADIAN_PROVINCES } from '@/lib/canadian-provinces';
import { ORG_IMAGE_TYPES, ORG_LOGO_MAX_BYTES } from '@/lib/org-image-limits';
import { money, ONLINE_EMAIL_WORDS, PAY_WORDS } from '@/lib/online-payment-words';
import { openCheckout, usePaymentConfirming } from '@/components/public/PayBlock';
import type { SponsorPageView, SponsorBusinessPrefill } from '@/lib/sponsor-deal-view';
import css from './SponsorDeal.module.css';

const P = DEAL_WORDS.page;
const C = DEAL_WORDS.card;

/** The club's refund policy, said outright under the card button (owner 2026-11-24: a "Refund policy" link that opened one short
 *  sentence was a label repeating its own content; the policy is ≤300 characters, so it simply shows, which also meets /legal's
 *  "refund policy beside the card button" more strongly than a link did). */
function RefundPolicy({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className={css.payNote}>{text}</p>;
}

type Open = Extract<SponsorPageView, { state: 'form' | 'done' }>;

const draftsFrom = (saved: Open['saved']): Record<string, AnswerDraft> => {
  const out: Record<string, AnswerDraft> = {};
  for (const a of saved.answers) {
    if (a.file) out[a.questionId] = { file: { state: 'done', name: a.file.name, size: a.file.size, type: a.file.type, id: a.file.id } };
    else if (a.text !== undefined) out[a.questionId] = { text: a.text };
    else if (a.choiceIds) out[a.questionId] = { choiceIds: a.choiceIds };
    else if (a.bool !== undefined) out[a.questionId] = { bool: a.bool };
    else if (a.date) out[a.questionId] = { date: a.date };
  }
  return out;
};

export default function SponsorDealContent({ initial }: { initial: SponsorPageView }) {
  const [view, setView] = useState<SponsorPageView>(initial);
  if (view.state === 'notFound') return <div className={css.closed}><p>{P.notFound}</p></div>;
  if (view.state === 'closed') {
    return (
      <div className={css.closed}>
        {/* The club's address is in the frame's own foot below: one place, not two. */}
        <p>{view.replaced ? P.replaced(view.club.name) : view.ended ? P.ended(view.club.name) : P.withdrawn(view.club.name)}</p>
      </div>
    );
  }
  return <OpenDeal key={`${view.state}:${view.invoice?.number ?? ''}`} view={view} onView={setView} />;
}

function OpenDeal({ view, onView }: { view: Open; onView: (v: SponsorPageView) => void }) {
  const { club, deal, token } = view;
  const search = useSearchParams();
  const { confirming, slow } = usePaymentConfirming(session => `/api/public/sponsorship/${token}/pay?session=${encodeURIComponent(session)}`, search.get('paid'));
  const left = search.get('left') === '1';
  const base = `/api/public/sponsorship/${token}`;
  const title = DEAL_WORDS.email.title(deal.packageName, deal.placeName);
  const [province, setProvince] = useState(view.business.province);
  const fig = dealFigures({ amount: deal.amount, chargeTax: deal.taxed, registered: true, province: province || null, on: view.today });
  const until = deal.endsOn ? P.until(deal.endsOn) : null;
  const priceNote = [deal.taxed && fig.rate ? P.plusTax(fig.rate.kind) : null, until].filter(Boolean).join(' · ');

  return (
    <div>
      <div className={css.head}>
        <p className={pay.eyebrow}>{P.eyebrow}</p>
        <h1 className={`${pay.title} ${pay.titleFocused}`}>{view.state === 'done' ? (view.refundedAway ? P.refundedTitle : P.thanksTitle(view.business.name || deal.offeredTo)) : title}</h1>
        <p className={css.sub}>{view.state === 'done' ? (view.refundedAway ? P.refundedSub(club.name) : view.logoUrl ? P.thanksSub(club.name) : P.thanksSubNoLogo(club.name)) : P.offeredTo(deal.offeredTo)}</p>
      </div>

      {confirming ? (
        <div className={css.invoice} role="status" aria-live="polite">
          <p className={css.invoiceTitle}>{C.confirmingTitle}</p>
          {/* The pay block's own words from the first second ("…Don’t pay again.", /ux 390 decision 6), then after 20 seconds its slow
              line: nothing to redo, the receipt comes. No Reload control: a reload lands in the same wait, and the poll already retries. */}
          <p className={css.invoiceMeta}>{slow ? PAY_WORDS.confirmingSlow(view.business.email || null) : PAY_WORDS.confirmingBody}</p>
        </div>
      ) : left && !view.received && (
        <div className={css.invoice} role="status">
          <p className={css.invoiceTitle}>{C.notFinishedTitle}</p>
          <p className={css.invoiceMeta}>{C.notFinishedBody}</p>
        </div>
      )}
      {!confirming && view.received && (
        // A card payment was taken and could not be recorded: said first, and never the plain form again (it would take the money twice).
        <div className={css.invoice} role="status">
          <p className={css.invoiceTitle}>{C.receivedTitle}</p>
          <p className={css.invoiceMeta}>{C.receivedBody(club.name)}</p>
        </div>
      )}
      {confirming || (view.received && view.state === 'form') ? null : view.state === 'form' ? (
        <>
          <div className={css.package}>
            <h2 className={formKit.sectionTitle}>{P.packageTitle}</h2>
            <p className={css.price}>{money(deal.amount)}{priceNote && <span className={css.priceNote}>{priceNote}</span>}</p>
            {deal.bullets.length > 0 && <ul className={css.bullets}>{deal.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
            {deal.hasDocument && (
              <a className={css.pdf} href={`${base}/package-document`} target="_blank" rel="noopener">
                <span className={css.tag}>PDF</span>{P.pdf(sizeLine(deal.documentSize ?? 0))} <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
          <SponsorForm view={view} onView={onView} province={province} setProvince={setProvince} total={fig.total} taxRow={deal.taxed && fig.rate ? { kind: fig.rate.kind, rate: fig.rate.rate, tax: fig.tax } : null} />
        </>
      ) : (
        <Thanks view={view} />
      )}

      <Foot club={club} />
    </div>
  );
}

// ── The form ──────────────────────────────────────────────────────────────────────────────────────

function SponsorForm({ view, onView, province, setProvince, total, taxRow }: {
  view: Open; onView: (v: SponsorPageView) => void; province: string; setProvince: (p: string) => void; total: number;
  taxRow: { kind: 'GST' | 'HST'; rate: number; tax: number } | null;
}) {
  const { club, deal, token } = view;
  const base = `/api/public/sponsorship/${token}`;
  const form = view.form;
  const [biz, setBiz] = useState<SponsorBusinessPrefill>(view.business);
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>(() => draftsFrom(view.saved));
  const tickedBefore = useMemo(() => new Set(view.saved.tickedVersions), [view.saved.tickedVersions]);
  const [ticked, setTicked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((form?.documents ?? []).map(d => [d.id, tickedBefore.has(d.versionId)])));
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [firstError, setFirstError] = useState<{ name: string; target: string } | null>(null);
  const [refusals, setRefusals] = useState(0);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const leaving = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const uploading = anyUploading(answers);

  useEffect(() => {
    if (Object.keys(errors).length === 0) { setFirstError(null); return; }
    const el = formRef.current?.querySelector<HTMLElement>('[data-field-error]');
    setFirstError(el ? { name: el.dataset.fieldName ?? '', target: el.dataset.fieldTarget ?? '' } : null);
  }, [errors]);
  useEffect(() => { if (refusals > 0) errorBox.current?.focus(); }, [refusals]);

  const setField = (k: BusinessField, v: string) => {
    setBiz(b => ({ ...b, [k]: v }));
    if (k === 'province') setProvince(v);
    if (errors[`business.${k}`]) setErrors(e => { const n = { ...e }; delete n[`business.${k}`]; return n; });
  };

  const card = view.card;
  const cardFee = card ? sponsorCardFee(Math.round(total * 100), card.sponsorPays ? 'sponsor' : 'club', taxRow?.rate ?? null, false) : null;
  const cardTotal = cardFee ? cardFee.totalCents / 100 : total;
  const [how, setHow] = useState<'card' | 'cheque'>('cheque');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (uploading || submitting) return;
    // The button pressed says how they pay (both are this form's submit buttons).
    const pressed = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-pay') === 'card' && card ? 'card' : 'cheque';
    setHow(pressed);
    setSubmitting(true);
    leaving.current = false;
    setGlobalError(null);
    try {
      const sent = (form?.questions ?? []).map(q => toAnswerIn(q.id, answers[q.id])).filter((x): x is AnswerIn => !!x);
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business: { ...biz, province },
          answers: sent,
          documents: (form?.documents ?? []).filter(d => ticked[d.id] && (d.source === 'text' || opened[d.id] || tickedBefore.has(d.versionId)))
            .map(d => ({ id: d.id, versionId: d.versionId })),
          formStamp: form?.stamp ?? null,
          payMethod: pressed,
          expectedTotal: pressed === 'card' ? cardTotal : total,
        }),
      });
      const data = await res.json().catch(() => ({})) as { view?: SponsorPageView; url?: string; errors?: Record<string, string>; missing?: string[]; error?: string };
      // By card: the details are kept and the secure card page opens (the invoice is issued when the payment lands).
      // The page is leaving for the card page: the button stays disabled until it has (a second tap would open a second checkout).
      if (res.ok && data.url) { leaving.current = true; window.location.assign(data.url); return; }
      if (res.ok && data.view) { onView(data.view); return; }
      if (res.status === 400 && data.errors) { setErrors(data.errors); setMissing(data.missing ?? []); setRefusals(n => n + 1); return; }
      if (res.status === 409 && data.view) {
        // A document the club changed is read and ticked again: a tick never carries over to a version the business has not seen.
        const now = data.view.state === 'form' ? (data.view.form?.documents ?? []) : [];
        const was = new Map((form?.documents ?? []).map(d => [d.id, d.versionId]));
        const same = (id: string) => now.some(d => d.id === id && was.get(id) === d.versionId);
        const keep = (m: Record<string, boolean>) => Object.fromEntries(Object.entries(m).map(([id, v]) => [id, v && same(id)]));
        setTicked(keep); setOpened(keep);
        onView(data.view); setGlobalError(data.error ?? P.errClosed); return;
      }
      setGlobalError(data.error ?? P.errFailed);
    } catch {
      setGlobalError(P.errFailed);
    } finally {
      if (!leaving.current) setSubmitting(false);
    }
  }

  const errorCount = Object.keys(errors).length;
  const allMissing = errorCount > 0 && Object.keys(errors).every(k => missing.includes(k));
  const goTo = () => {
    if (!firstError) return;
    const el = document.getElementById(firstError.target);
    el?.scrollIntoView({ block: 'center' });
    el?.focus();
  };

  const field = (k: BusinessField, label: string, opts: { required?: boolean; hint?: string; type?: string; autoComplete?: string } = {}) => {
    const id = `biz-${k}`;
    const err = errors[`business.${k}`];
    return (
      <div className={formKit.field} {...errorAttrs(err, L.fieldName[k], id)}>
        <label className={formKit.label} htmlFor={id}>{label}{opts.required && <> <span className={formKit.required}>*</span></>}</label>
        <input id={id} className={`${formKit.input}${err ? ` ${formKit.inputError}` : ''}`} type={opts.type ?? 'text'} value={biz[k]}
          autoComplete={opts.autoComplete} aria-invalid={!!err} aria-describedby={[opts.hint ? `${id}-hint` : null, err ? `${id}-err` : null].filter(Boolean).join(' ') || undefined}
          onChange={e => setField(k, e.target.value)} />
        {opts.hint && <p id={`${id}-hint`} className={formKit.hint}>{opts.hint}</p>}
        {err && <p id={`${id}-err`} className={formKit.errorMsg}>{err}</p>}
      </div>
    );
  };
  const provinceErr = errors['business.province'];
  const fieldProps = { club: club.name, orgSlug: '', seasonSlug: '', filesUrl: `${base}/files` };

  return (
    <form ref={formRef} className={formKit.form} onSubmit={submit} noValidate>
      <section className={formKit.section}>
        <h2 className={formKit.sectionTitle}>{P.about}</h2>
        {field('name', P.name, { required: true, hint: P.nameHint, autoComplete: 'organization' })}
        <div className={formKit.fieldRow}>
          {field('contactName', P.contactName, { required: true, autoComplete: 'name' })}
          {field('phone', P.phone, { type: 'tel', autoComplete: 'tel' })}
        </div>
        {field('email', P.email, { required: true, hint: P.emailHint, type: 'email', autoComplete: 'email' })}
        <fieldset className={`${formKit.field} ${reg.choiceSet}`}>
          <legend className={formKit.label}>{P.address}{view.deal.taxed && <> <span className={formKit.required}>*</span></>}</legend>
          {view.deal.taxed && <p className={`${formKit.hint} ${css.addressHint}`}>{P.addressHintTaxed}</p>}
          <div className={css.address}>
            {field('street', P.street, { autoComplete: 'street-address' })}
            {field('city', P.city, { autoComplete: 'address-level2' })}
            <div className={css.addressRow}>
              <div className={formKit.field} {...errorAttrs(provinceErr, L.fieldName.province, 'biz-province')}>
                <label className={formKit.label} htmlFor="biz-province">{P.province}</label>
                <select id="biz-province" className={`${formKit.input}${provinceErr ? ` ${formKit.inputError}` : ''}`} value={province}
                  aria-invalid={!!provinceErr} onChange={e => setField('province', e.target.value)}>
                  <option value="">{L.pickProvince}</option>
                  {CANADIAN_PROVINCES.map(p => <option key={p.code} value={p.code}>{p.code}</option>)}
                </select>
                {provinceErr && <p className={formKit.errorMsg}>{provinceErr}</p>}
              </div>
              {field('postal', P.postal, { autoComplete: 'postal-code' })}
            </div>
          </div>
        </fieldset>
        {field('website', P.website, { hint: P.websiteHint, type: 'url', autoComplete: 'url' })}
      </section>

      <section className={formKit.section}>
        <h2 className={formKit.sectionTitle}>{P.logo}</h2>
        <LogoControl token={token} club={club.name} initialUrl={view.logoUrl} />
      </section>

      {form && (form.questions.length > 0 || form.documents.length > 0) && (
        <section className={formKit.section}>
          <h2 className={formKit.sectionTitle}>{QW.questionsFrom(club.name)}</h2>
          {form.questions.map(q => (
            <QuestionField key={q.id} q={q} idBase="biz-q" value={answers[q.id]} onChange={next => {
              setAnswers(a => ({ ...a, [q.id]: next }));
              if (errors[`q.${q.id}`]) setErrors(e => { const n = { ...e }; delete n[`q.${q.id}`]; return n; });
            }} error={errors[`q.${q.id}`]} who="" errorName={answerName(q, null)} {...fieldProps} />
          ))}
          {errors.files && <p className={formKit.errorMsg} role="alert">{errors.files}</p>}
          {form.documents.map(d => (
            <DocumentBlock key={d.id} d={d} idBase="biz" ticked={!!ticked[d.id]} opened={!!opened[d.id] || tickedBefore.has(d.versionId)}
              onTick={on => setTicked(t => ({ ...t, [d.id]: on }))} onOpened={() => setOpened(o => ({ ...o, [d.id]: true }))}
              error={errors[`documents.${d.id}`]} orgSlug="" seasonSlug="" club={club.name} contact={club.contactEmail}
              docHref={(doc, download) => `${base}/documents/${doc.id}/open?v=${doc.versionId}${download ? '&download=1' : ''}`} />
          ))}
        </section>
      )}

      <section className={formKit.section}>
        <h2 className={formKit.sectionTitle}>{P.howYoullPay}</h2>
        <table className={css.payTable}>
          <tbody>
            {/* The breakdown (package, tax, total) only when there IS a tax to explain. With no tax the
                package row and the total are the same figure, so it is one line (owner, 2026-11-23). */}
            {taxRow && <tr><td>{DEAL_WORDS.email.title(deal.packageName, deal.placeName)}</td><td>{money(deal.amount)}</td></tr>}
            {taxRow && <tr><td>{P.taxLine(taxRow.kind, taxRow.rate)}</td><td>{money(taxRow.tax)}</td></tr>}
            <tr><td>{P.yourInvoice}</td><td>{money(total)}</td></tr>
          </tbody>
        </table>
        {!card && <p className={css.payLine}>{view.clubCanEmail ? P.cardOffLine(view.club.name) : P.cardOffLineNoEmail}</p>}
        {errorCount > 0 && (
          <div ref={errorBox} tabIndex={-1} className={`${formKit.globalError} ${reg.errorBox}`} role="group" aria-labelledby="sponsor-errors-text">
            <span id="sponsor-errors-text">{(allMissing ? QW.errorsMissing : QW.errorsMixed)(errorCount, firstError?.name ?? 'above')}</span>
            {firstError && <button type="button" className={reg.linkButton} onClick={goTo}>{QW.goToIt}</button>}
          </div>
        )}
        {globalError && <div className={formKit.globalError} role="alert">{globalError}</div>}
        {card && cardFee && (
          <div className={css.payRow}>
            <button type="submit" data-pay="card" className={formKit.submitBtn} disabled={submitting || uploading}>
              <CreditCard size={18} aria-hidden /> {uploading ? QW.uploadingButton : submitting && how === 'card' ? C.opening : C.sendCard(cardTotal)}
            </button>
            {card.sponsorPays && <p className={css.payNote}>{C.feeNote(cardFee.feeCents / 100, cardFee.feeTaxCents / 100, taxRow?.kind ?? null)}</p>}
            <RefundPolicy text={card.refundPolicy} />
          </div>
        )}
        <div className={css.payRow}>
          <button type="submit" data-pay="cheque" className={card ? css.secondPay : formKit.submitBtn} disabled={submitting || uploading}>
            {uploading ? QW.uploadingButton : submitting && how === 'cheque' ? P.sending : card ? C.sendCheque : P.send}
          </button>
          <p className={css.payNote}>
            <span className={css.payNoteDesk}>{view.clubCanEmail ? P.sendChequeNote : P.sendChequeNoteNoEmail}</span>
            <span className={css.payNotePhone}>{view.clubCanEmail ? P.sendChequeNotePhone : P.sendChequeNoteNoEmailPhone}</span>
          </p>
        </div>
      </section>
    </form>
  );
}

// ── The logo ──────────────────────────────────────────────────────────────────────────────────────

function LogoControl({ token, club, initialUrl }: { token: string; club: string; initialUrl: string | null }) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [name, setName] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'uploading' | 'failed' | 'refused'>('idle');
  const input = useRef<HTMLInputElement>(null);
  const pick = async (file: File) => {
    if (file.size > ORG_LOGO_MAX_BYTES || !(ORG_IMAGE_TYPES as readonly string[]).includes(file.type)) { setState('refused'); return; }
    setState('uploading');
    const body = new FormData();
    body.set('file', file);
    try {
      const res = await fetch(`/api/public/sponsorship/${token}/logo`, { method: 'POST', body });
      const data = await res.json().catch(() => ({})) as { url?: string | null };
      if (res.status === 201) { setUrl(data.url ?? null); setName(file.name); setState('idle'); }
      else setState(res.status === 413 || res.status === 415 ? 'refused' : 'failed');
    } catch {
      setState('failed');
    } finally {
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className={formKit.field}>
      <div className={css.logoRow}>
        {/* A one-hour signed link or the club's public logo: next/image would cache a link that expires. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <span className={css.logoBox}><img src={url} alt="" /></span>}
        {name && <span>{name}</span>}
        <label className={css.logoButton}>
          {state === 'uploading' ? P.logoUploading : url ? P.logoReplace : P.logoAdd}
          <input ref={input} type="file" className={css.logoInput} accept="image/jpeg,image/png,image/webp" disabled={state === 'uploading'}
            onChange={e => { const f = e.target.files?.[0]; if (f) void pick(f); }} />
        </label>
      </div>
      <div className={css.logoNotes}>
        <p className={formKit.hint}>{P.logoHint}</p>
        <p className={formKit.hint}>{P.logoPermission(club)}</p>
      </div>
      {state === 'failed' && <p className={formKit.errorMsg} role="alert">{P.logoFailed}</p>}
      {state === 'refused' && <p className={formKit.errorMsg} role="alert">{P.logoRefused}</p>}
    </div>
  );
}

// ── After sending ─────────────────────────────────────────────────────────────────────────────────

function Thanks({ view }: { view: Open }) {
  // The confirmation replaces a long form: start it at the top rather than wherever Send was. Done once the new page is
  // on screen, and instantly — the scroll that used to run at the click was a smooth one the page swap cut short.
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, []);
  const inv = view.invoice;
  const how = view.howToPay;
  const pdf = `/api/public/sponsorship/${view.token}/invoice`;
  // The credit notes the business was sent (and any that were cancelled): on the receipt, and on an invoice that is owing again, since the
  // refund email says "your credit note is on your sponsorship page" whichever state the deal is in.
  const noteLinks = (
    <>
      {view.refunds.filter(r => r.creditNumber).map(r => (
        <a key={r.id} className={css.download} href={`/api/public/sponsorship/${view.token}/credit-note/${r.id}`} download>{C.creditNote(r.creditNumber!)}</a>
      ))}
      {view.cancelledNotes.map(n => (
        <a key={n.id} className={css.download} href={`/api/public/sponsorship/${view.token}/credit-note/${n.id}`} download>{C.creditNoteCancelled(n.creditNumber)}</a>
      ))}
    </>
  );
  return (
    <>
      {inv && view.paid && (
        // Paid in full (round 2 tab 1's receipt card: plain lines, one rule above Paid, then the receipt download).
        <div className={css.invoice}>
          <p className={css.invoiceTitle}>{view.refundedAway ? P.refundedReceiptTitle : P.paidTitle}</p>
          {/* A fee the sponsor paid never comes back (Payments Terms §4): said here, as the refund email says it (/legal 2026-11-24). */}
          {/* The fee with its tax, the figure the refund email gave (sponsor-invoice-email: feeCharged + feeTax). */}
          {view.refundedAway && !!inv.cardFee && <p className={css.invoiceMeta}>{ONLINE_EMAIL_WORDS.refundFeeKept(money(Math.round((inv.cardFee + (inv.cardFeeTax ?? 0)) * 100) / 100))}</p>}
          <p className={css.invoiceTo}>{P.paidLine(inv.total, view.club.name)}</p>
          {view.paidCard?.at
            ? <p className={css.invoiceMeta}>{C.paidWith(view.paidCard.label, `${formatStoredDate(orgDayKey(view.paidCard.at))}, ${clockOf(view.paidCard.at)}`, inv.number)}</p>
            : view.paidOn && <p className={css.invoiceMeta}>{P.paidOnLine(view.paidOn, inv.number)}</p>}
          <dl className={css.receiptLines}>
            <div><dt>{view.deal.packageName}{view.deal.placeName ? `, ${view.deal.placeName}` : ''}</dt><dd>{money(inv.total - inv.tax - (inv.cardFee ?? 0))}</dd></div>
            {!!inv.cardFee && <div><dt>{C.feeRow}</dt><dd>{money(inv.cardFee)}</dd></div>}
            {inv.taxKind && inv.tax > 0 && <div><dt>{P.taxLine(inv.taxKind, inv.taxRate ?? 0)}</dt><dd>{money(inv.tax)}</dd></div>}
            <div className={css.receiptTotal}><dt>{DEAL_WORDS.deal.figPaid}</dt><dd>{money(inv.total)}</dd></div>
            {view.refunds.map(r => (
              <div key={r.id}><dt>{r.pending || !r.on ? C.refundedOnWay : C.refundedRow(r.on)}</dt><dd>−{money(r.amount)}</dd></div>
            ))}
          </dl>
          <div className={css.downloads}>
            <a className={css.download} href={pdf} download>{P.downloadReceipt}</a>
            {noteLinks}
          </div>
        </div>
      )}
      {inv && !view.paid && (
        <div className={css.invoice}>
          <p className={css.invoiceTitle}>{P.invoiceLine(inv.number, inv.total)}</p>
          <dl className={css.invoiceFacts}>
            <div><dt>{P.issuedLabel}</dt><dd>{P.invoiceDay(inv.issuedOn)}</dd></div>
            <div><dt>{P.dueLabel}</dt><dd>{P.invoiceDay(inv.dueOn)}</dd></div>
            {inv.email && inv.emailed && <div className={css.invoiceFactWide}><dt>{P.emailedToLabel}</dt><dd>{inv.email}</dd></div>}
          </dl>
          {view.owing < inv.total && <p className={css.invoiceMeta}>{P.partPaid(inv.total - view.owing, view.owing)}</p>}
          {view.refunds.length > 0 && (
            <dl className={css.receiptLines}>
              {view.refunds.map(r => (
                <div key={r.id}><dt>{r.pending || !r.on ? C.refundedOnWay : C.refundedRow(r.on)}</dt><dd>−{money(r.amount)}</dd></div>
              ))}
            </dl>
          )}
          <a className={css.download} href={pdf} download>{P.downloadInvoice}</a>
          {(view.refunds.some(r => r.creditNumber) || view.cancelledNotes.length > 0) && <div className={css.downloads}>{noteLinks}</div>}
          {view.card && view.owing > 0 && <PayInvoiceByCard token={view.token} owing={view.owing} policy={view.card.refundPolicy} />}
          <div className={css.how}>
            <p className={css.howTitle}>{P.howToPay}</p>
            <dl className={css.howList}>
              {how.etransferTo && (
                <div><dt>{P.payEtransfer}</dt><dd>{how.etransferTo}</dd></div>
              )}
              {how.chequesPayableTo && (
                <div>
                  <dt>{P.payCheque}</dt>
                  <dd>{P.payChequePayable(how.chequesPayableTo)}</dd>
                  {how.mailingAddress && (
                    <dd className={css.howMail}>
                      <span className={css.howMailLabel}>{P.payChequeMailLabel}</span>
                      {addressLines(how.mailingAddress).map((line, i) => <span key={i} className={css.howMailLine}>{line}</span>)}
                    </dd>
                  )}
                </div>
              )}
            </dl>
            <p className={css.howQuote}>{P.quote(inv.number)}</p>
          </div>
        </div>
      )}
      {/* On the receipt page too (owner call 7, walk §562): a business that paid before sending its logo adds it here, once. */}
      {view.takesLogo && (
        <section className={formKit.section}>
          <h2 className={formKit.sectionTitle}>{L.logoLaterTitle}</h2>
          <LogoControl token={view.token} club={view.club.name} initialUrl={view.logoUrl} />
        </section>
      )}
      <p className={css.revisit}>{P.revisit}</p>
    </>
  );
}

/** "Pay {owing} by card" on an invoice already out: what is owing, to the cent (the club pays the fee, owner call (3)). */
function PayInvoiceByCard({ token, owing, policy }: { token: string; owing: number; policy: string | null }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function pay() {
    setOpening(true); setError(null);
    const out = await openCheckout(`/api/public/sponsorship/${token}/pay`, { expectedTotal: owing });
    if ('url' in out) { window.location.assign(out.url); return; }
    if ('changed' in out) { window.location.reload(); return; }
    setError(out.error);
    setOpening(false);
  }
  return (
    <div className={css.payRow}>
      <button type="button" className={formKit.submitBtn} disabled={opening} onClick={() => void pay()}>
        <CreditCard size={18} aria-hidden /> {opening ? C.opening : C.payInvoice(owing)}
      </button>
      <p className={css.payNote}>{C.payInvoiceNote}</p>
      <RefundPolicy text={policy} />
      {error && <p className={formKit.errorMsg} role="alert">{error}</p>}
    </div>
  );
}

// ── The foot ──────────────────────────────────────────────────────────────────────────────────────

function Foot({ club }: { club: Open['club'] }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!club.contactEmail) return;
    try { await navigator.clipboard.writeText(club.contactEmail); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* the address is on screen */ }
  };
  return (
    <div className={css.foot}>
      <ClubPrivacyLink club={club.name} privacyUrl={club.privacyUrl} />
      <p className={css.footRow}>
        <span>{P.footQuestions}</span>
        {club.contactEmail ? (
          <>
            <a className={css.footMail} href={`mailto:${club.contactEmail}`}>{club.contactEmail}</a>
            <button type="button" className={`${reg.linkButton} ${css.copyBtn}`} onClick={() => void copy()}>{copied ? P.copied : P.copy}</button>
          </>
        ) : <span>{L.footNoContact(club.name)}</span>}
      </p>
    </div>
  );
}

