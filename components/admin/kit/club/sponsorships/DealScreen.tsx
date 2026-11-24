'use client';
/**
 * ONE DEAL (Board Ready Stage 6, Part 2; round 1 tab 5, screens C and D; asks 4, 5, 13). A record over the Deals tab, one
 * level down: it reads first. The callout at its top names the state, then the one thing to do next (the tab 5 table's
 * words, verbatim; Part 3a adds "Record a payment" as the invoiced callout's lime). The money band once there is an invoice
 * (Paid and Still owing from the payments recorded), the payments with Void (Part 3a). Then the deal (where it shows and its
 * last day change here, ask 1; the amount and the tax switch while the offer is open, then as a revised invoice while
 * nothing is paid; the invoice number opens its PDF), the delivery checklist
 * (open once invoiced; the logo line puts the logo up now, ask 5), the business as its link sent it with its answers, the
 * history, and the record's actions: Copy the link · Send the link again · Do not offer again · Withdraw (until paid).
 *   · A deal made as a link only (owner 1A, 2026-11-23): the callout says the link was made, not emailed, with Copy the link
 *     as its lime; the actions add Email the offer (the email half of Offer a deal, once the club has a reason) and say
 *     "Make a new link" for Send the link again, since nothing was ever sent.
 *   · Send the link again reads the kept reason against today (owner 3A): run out, the new link is made, nothing is emailed,
 *     and the notice at the top of the page says why (/design's open point: the shipped PageNotice, said once).
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Ban, Copy, Mail, Pencil, RefreshCw, X } from 'lucide-react';
import KitDialog, { DialogCancel } from '../KitDialog';
import { Callout, ClubRow, ClubRowList, ClubSection } from '../RepKit';
import { useHandNamedPlace } from '@/components/admin/AdminBarPlace';
import { usePageTitle } from '@/lib/usePageTitle';
import PageNotice, { useNotice } from '../PageNotice';
import OfferReasonFields, { NO_REASON, reasonBody, reasonProblem, type ReasonValue } from './OfferReasonFields';
import { barSentence } from './BusinessPicker';
import { useOrg } from '@/lib/org-context';
import ck from '../ClubKit.module.css';
import SwitchRow from './SwitchRow';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import DateInput from '@/components/shared/DateInput';
import SublinedChoice from '@/components/coaches/SublinedChoice';
import { copyWhenReady } from './OfferDealWindow';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import LoadingState from '@/components/shared/LoadingState';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { formatStoredDate, orgDayKey } from '@/lib/timezone';
import { DEAL_WORDS as D } from '@/lib/club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS as W, sponsorshipMoney as money } from '@/lib/club-sponsorships-words';
import { canRecordPayment, canRevise, canWithdraw, checklistOf, checklistOpen, deliveryCount, holdersOf, isOverdue, linkTakesForm, LOGO_ITEM, reasonHasClock } from '@/lib/club-sponsorship-deals';
import { refundsEndedDeal, invoiceStanding, paymentHow, refundCounts, refundDay, refundedTotal, refundEndsDeal, type DealPayment } from '@/lib/club-sponsor-invoice';
import { DealPayments, PaymentWindow, RecordPaymentWindow, RefundWindow, VoidPaymentQuestion } from './DealPaymentWindows';
import { send, sponsorshipsApi } from './api';
import { placeLabel, useDeal, type DealRead } from './deals-api';
import css from './Sponsorships.module.css';

const day = (d: string) => formatStoredDate(d, { withYear: false });

/** The callout (round 1 tab 5's table, ask 4): the state, then what the club does next. */
function callout(r: DealRead): { title?: string; text: string; tone: 'olive' | 'warn' } {
  const d = r.deal;
  if (d.band === 'withdrawn' && d.withdrawn) {
    return { text: refundsEndedDeal(r.refunds) ? D.card.calloutRefundedWithdrawn(d.withdrawn.at, d.withdrawn.byName, d.withdrawn.reason) : D.callout.withdrawn(d.withdrawn.at, d.withdrawn.byName, d.withdrawn.reason), tone: 'olive' };
  }
  if (r.unrecordedCard && d.state !== 'paid') return { title: D.card.unrecordedTitle, text: D.card.calloutUnrecorded(d.businessName, r.unrecordedCard.amount, r.unrecordedCard.reason), tone: 'warn' };
  if (d.band === 'delivered') return { text: D.callout.delivered, tone: 'olive' };
  if (d.state === 'paid') { const c = deliveryCount(d); return { text: D.callout.paid(d.paidOn ?? d.invoice?.issuedOn ?? d.offeredOn, c.done, c.of), tone: 'olive' }; }
  if (d.state === 'invoiced' && d.invoice) {
    const text = D.callout.invoiced(d.invoice.number, d.invoice.total, d.invoice.issuedOn, d.invoice.dueOn, !!d.invoiceEmailedAt);
    return isOverdue(d.invoice, r.today)
      ? { title: D.callout.invoicedTitle, text: `${text} ${D.callout.overdue(d.invoice.dueOn)}`, tone: 'warn' }
      : { title: D.callout.invoicedTitle, text, tone: 'olive' };
  }
  if (d.state === 'form_received') return { text: D.callout.formReceived(d.businessName), tone: 'warn' };
  if (!d.emailedAt && !d.openedAt) return { title: D.callout.waitingFor(d.businessName), text: D.callout.linkOnly, tone: 'olive' };
  return { text: d.openedAt ? D.callout.offeredOpened(d.businessName, d.openedAt) : D.callout.offeredNotOpened(d.businessName), tone: 'olive' };
}

export default function DealScreen({ dealId }: { dealId: string }) {
  const isPhone = useIsPhone();
  const { slug, data, error, reload } = useDeal(dealId);
  const club = useOrg().currentOrg?.name ?? '';
  const [asking, setAsking] = useState<'again' | 'stop' | 'withdraw' | 'edit' | 'email' | 'record' | 'sendInvoice' | null>(null);
  const [voiding, setVoiding] = useState<DealPayment | null>(null);
  // Part 3b: the payment's own window, and the refund window over it.
  const [opened, setOpened] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [notice, setNotice] = useNotice();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Make the link only says what it did in a window that stays until it is closed (owner 2026-11-23).
  const [linkSaid, setLinkSaid] = useState<{ title: string; text: string; copy?: boolean } | null>(null);
  // ⚖ A RECORD PAGE (A8; owner 2026-11-23): the bar names the deal — "← Deals │ business", its line (package · where it
  // shows · year) and its pill — the way a schedule and a child are named. The address gave "Deal" and the way back.
  const dl = data?.deal;
  useHandNamedPlace(dl ? {
    title: dl.businessName,
    detail: [dl.packageName, placeLabel(dl), dl.offeredOn.slice(0, 4)].join(' · '),
    chip: <span className={ck.chip}>{D.list.band[dl.band]}</span>,
  } : null);
  usePageTitle(dl ? `${dl.businessName} · ${W.place}` : null);
  // Make the link only opens this page as `?link=copied` (the click copied it) or `?link=made` (the browser refused): said
  // in a window the club closes, then dropped from the address so a reload doesn't say it again (owner 2026-11-23).
  const search = useSearchParams();
  const linkDoor = useRef(search.get('link'));
  useEffect(() => {
    const door = linkDoor.current;
    if (!dl || !door) return;
    linkDoor.current = null;
    setLinkSaid(door === 'copied' ? { title: D.deal.linkCopiedTitle, text: D.deal.linkCopied(dl.businessName), copy: false } : { title: D.deal.linkMadeTitle, text: D.deal.linkMadeNotCopied });
    // The browser's own replaceState, not router.replace: a router navigation to the same page with a different query
    // string can remount the page, which throws the notice away the instant it is set (owner walk 2026-11-23: the page
    // opened and said nothing). replaceState only rewrites the address.
    window.history.replaceState(window.history.state, '', `/${slug}/admin/sponsorships/${dealId}`);
  }, [dl, slug, dealId]);
  if (error) return <p className={css.error} role="alert">{error}</p>;
  if (!data) return <LoadingState label={W.loading} />;

  const d = data.deal;
  const b = data.business;
  const api = (path: string) => sponsorshipsApi(slug, `/deals/${d.id}${path}`);
  const c = callout(data);
  const stopped = data.bar && (data.bar.kind === 'do_not_offer' || data.bar.kind === 'unsubscribed') ? data.bar.on : null;
  const delivery = deliveryCount(d);
  const lines = checklistOf(d);
  /** Made as a link only: nothing was ever emailed (call (c)). */
  const linkMade = !d.emailedAt && d.state !== 'withdrawn';
  // Email the offer: only on a link made only, while the offer is open; absent with its reason where it would be.
  const emailBlock = !linkMade || !linkTakesForm(d) || !data.link ? null
    : !data.hasMailingAddress ? D.offer.needsAddress : !data.hasContact ? D.offer.needsContact
      : data.bar?.kind === 'family_opt_out' ? barSentence(data.bar, club) : null;
  const canEmail = linkMade && linkTakesForm(d) && !!data.link && !emailBlock && !stopped;

  async function act(path: string, body?: unknown) {
    setBusy(true); setSaid(null);
    // Make a new link (a deal never emailed) copies the new link in this same click, the way Make the link only does: the
    // copy starts NOW with the link still on its way, because a browser only lets a click copy.
    let linkArrived: (link: string | null) => void = () => {};
    const copying = path === '/again' && linkMade ? copyWhenReady(new Promise<string | null>(res => { linkArrived = res; })) : null;
    const r = await send<{ emailed?: boolean; error?: string; link?: string; outcome?: 'emailed' | 'link_only' | 'ran_out' | 'not_emailed'; to?: string }>(api(path), 'POST', body ?? {});
    linkArrived(r.ok ? r.data.link ?? null : null);
    const copiedNow = copying ? await copying : null;
    setBusy(false);
    if (!r.ok) { setSaid(r.error); void reload(); return false; }
    if (r.data.error) setSaid(r.data.error);
    // A new link (Send the link again / Make a new link). Emailed: said once at the top, fading on its own. Not emailed: the
    // club has to give it to them, so it is a window that stays until closed, with Copy the link (owner 2026-11-23).
    const o = r.data.outcome;
    let linkWindow: { title: string; text: string; copy?: boolean } | null = null;
    if (o === 'emailed' && r.data.to) setNotice({ tone: 'good', text: D.deal.sentNewLink(r.data.to) });
    else if (o === 'link_only') linkWindow = copiedNow ? { title: D.deal.newLinkCopiedTitle, text: D.deal.newLinkCopied(d.businessName), copy: false } : { title: D.deal.newLinkMadeTitle, text: D.deal.newLinkMadeNotCopied };
    else if (o === 'ran_out') linkWindow = { title: D.deal.newLinkMadeTitle, text: D.deal.ranOut };
    else if (o) linkWindow = { title: D.deal.newLinkMadeTitle, text: D.deal.notEmailedNewLink };
    setAsking(null);
    await reload();
    if (linkWindow) setLinkSaid(linkWindow);
    return true;
  }
  /** True when the link is on the clipboard. */
  async function copy(): Promise<boolean> {
    if (!data?.link) return false;
    try { await navigator.clipboard.writeText(data.link); setCopied(true); setTimeout(() => setCopied(false), 2000); return true; } catch { setSaid(W.say.failed); return false; }
  }

  // The money band (round 1 tabs 5 and 7): Paid and Still owing from the payments recorded; Paid names how the last came.
  const standing = d.invoice ? invoiceStanding(d.invoice.total, data.payments) : null;
  const lastIn = standing?.live.at(-1);
  const paidSub = lastIn ? paymentHow(lastIn).toLowerCase() : undefined;
  const owingSub = d.invoice && standing && standing.owing > 0 ? D.deal.figDue(d.invoice.dueOn) : undefined;
  const back = refundedTotal(data.refunds);
  const lastBack = data.refunds.filter(refundCounts).at(-1);
  const backSub = !lastBack ? undefined : lastBack.status === 'pending' ? D.card.figRefundedSubPending
    : D.card.figRefundedSub(back, refundDay(lastBack));
  const band = d.invoice && standing && (isPhone ? (
    <ClubRowList inset label={D.deal.figInvoiced}>
      <ClubRow title={D.deal.figInvoiced} caption={d.invoice.taxKind ? D.deal.figInclTax(d.invoice.taxKind, d.invoice.tax) : undefined} trail={<span className={css.money}>{money(d.invoice.total)}</span>} />
      <ClubRow title={D.deal.figPaid} caption={paidSub} trail={<span className={css.money}>{money(standing.paid)}</span>} />
      {back > 0 && <ClubRow title={D.card.figRefunded} caption={backSub} trail={<span className={css.money}>{money(back)}</span>} />}
      <ClubRow title={D.deal.figOwing} caption={owingSub} trail={<span className={css.money}>{money(standing.owing)}</span>} />
    </ClubRowList>
  ) : (
    <MoneySummaryBand ariaLabel={d.businessName} tiles={[
      { key: 'invoiced', label: D.deal.figInvoiced, figure: money(d.invoice.total), caption: d.invoice.taxKind ? D.deal.figInclTax(d.invoice.taxKind, d.invoice.tax) : undefined },
      { key: 'paid', label: D.deal.figPaid, figure: money(standing.paid), caption: paidSub },
      ...(back > 0 ? [{ key: 'refunded', label: D.card.figRefunded, figure: money(back), caption: backSub }] : []),
      { key: 'owing', label: D.deal.figOwing, figure: money(standing.owing), caption: owingSub },
    ]} />
  ));
  const recordable = canRecordPayment(d) && !!standing && standing.owing > 0;

  const firstOffer = data.offers.find(o => o.kind === 'offer') ?? null;
  const reasonOnBit = (o: { reason: DealRead['offers'][number]['reason']; reasonOn: string } | null) =>
    o && reasonHasClock(o.reason) ? ` ${D.deal.hReasonOn(o.reason as 'paid_recently' | 'asked_recently', o.reasonOn)}` : '';
  const historyBits = [
    d.emailedAt ? `${D.deal.hOffered(firstOffer?.sentAt ?? d.offeredAt, firstOffer?.sentByName ?? d.offeredByName)}${reasonOnBit(firstOffer)}` : D.deal.hLinkMade(d.offeredAt, d.offeredByName),
    d.linkUnsentAt ? D.deal.hRelinked(d.linkUnsentAt) : null,
    d.openedAt ? D.deal.hOpened(d.openedAt) : null,
    d.formAt ? D.deal.hForm(d.formAt) : null,
    d.invoice ? (d.invoiceEmailedAt && !d.revisedOn ? D.deal.hInvoiceEmailed(d.invoice.issuedOn) : D.deal.hInvoice(d.invoice.issuedOn)) : null,
    d.revisedOn ? D.deal.hRevised(d.revisedOn) : null,
    d.paidOn ? D.deal.hPaid(d.paidOn) : null,
    ...data.refunds.filter(x => x.status === 'succeeded' && !x.endsDeal).map(x => D.card.hRefunded(x.amount, refundDay(x), x.createdByName)),
    d.withdrawn ? (refundsEndedDeal(data.refunds) ? D.card.hRefundedWhole(d.withdrawn.at, d.withdrawn.byName) : D.deal.hWithdrawn(d.withdrawn.at, d.withdrawn.byName)) : null,
  ].filter(Boolean).join(' · ');
  const endedByRefund = d.state === 'withdrawn' && refundsEndedDeal(data.refunds) ? d.withdrawn?.at ?? null : null;
  const openedPayment = opened ? data.payments.find(x => x.id === opened) ?? null : null;
  // Send the invoice (round 1 tab 5): a deal its business left at Form received — an unfinished card payment.
  const sendsInvoice = d.state === 'form_received' && !data.unrecordedCard;

  return (
    <>
      {notice && <PageNotice notice={notice} />}

      <div className={css.dealGrid}>
        <Callout tone={c.tone} role="status" flush
          action={linkMade && d.state === 'offered' && data.link
            ? <button type="button" className="btn btn-lime" onClick={() => void copy()}>{copied ? D.deal.copied : D.deal.copy}</button>
            : recordable
              ? <button type="button" className="btn btn-lime" aria-haspopup="dialog" onClick={() => setAsking('record')}>{D.deal.record}</button>
              : sendsInvoice
                ? <button type="button" className="btn btn-lime" aria-haspopup="dialog" onClick={() => setAsking('sendInvoice')}>{D.card.sendInvoice}</button>
                : undefined}>
          {c.title && <strong>{c.title} </strong>}{isPhone && d.state === 'invoiced' && d.invoice ? D.callout.invoicedPhone(d.invoice.number, d.invoice.total, d.invoice.dueOn) : c.text}
        </Callout>
        {band}
        <DealPayments payments={data.payments} refunds={data.refunds} onOpen={x => setOpened(x.id)} />

        {/* The pencil edits what this block lists: it sits in the block's head, as a season's Registration block's does. */}
        <ClubSection id="deal-block" className={css.flushSection} title={D.deal.cardDeal}
          actions={d.state !== 'withdrawn' ? (
            <button type="button" className={css.iconBtn} aria-label={D.deal.edit} aria-haspopup="dialog" onClick={() => setAsking('edit')}><Pencil size={16} aria-hidden /></button>
          ) : undefined}>
          <dl className={css.pageFacts}>
            <dt>{D.deal.package}</dt><dd>{d.packageName}</dd>
            <dt>{D.deal.showsOn}</dt>
            <dd>{placeLabel(d)}<span className={css.factSub}>{d.placeKind !== 'club' && !d.targetId ? D.deal.targetGone : D.deal.showsOnSub[d.placeKind](d.endsOn)}</span></dd>
            <dt>{D.deal.amount}</dt><dd>{money(d.amount)}</dd>
            {data.registered && (
              <>
                <dt>{D.deal.chargeTax}</dt>
                <dd>
                  {d.chargeTax ? (d.invoice?.taxRate != null ? D.deal.taxYes(d.invoice.taxKind ?? 'HST', d.invoice.taxRate) : data.rate ? D.deal.taxYes(data.rate.kind, data.rate.rate) : 'Yes') : D.deal.taxNo}
                  {canRevise(d) && <span className={css.factSub}>{D.deal.taxLater}</span>}
                </dd>
              </>
            )}
            {d.invoice && (<><dt>{D.deal.invoice}</dt><dd><a className={css.inlineLink} href={api('/invoice')} download>{D.deal.invoicePdf(d.invoice.number)}</a></dd></>)}
          </dl>
        </ClubSection>

        {lines.length > 0 && (
          <ClubSection id="delivery-block" className={css.flushSection} title={D.deal.cardDelivery} meta={D.deal.delivered(delivery.done, delivery.of)}>
            {!checklistOpen(d) && d.state !== 'withdrawn' && <p className={ck.hint}>{D.deal.checklistClosed}</p>}
            {lines.map(l => {
              const done = d.done[l.id];
              return (
                <label key={l.id} className={css.checkRow}>
                  <input type="checkbox" checked={!!done} disabled={busy || !checklistOpen(d)}
                    onChange={e => void act('/items', { itemId: l.id, on: e.target.checked })} />
                  <span className={css.checkMain}>
                    <span>{l.logo ? D.deal.logoLine : l.text}</span>
                    {l.id === LOGO_ITEM && !done && !isPhone && d.state !== 'withdrawn' && <span className={ck.hint}>{D.deal.logoHintUp(D.deal.logoWhere[d.placeKind])}</span>}
                    {l.id === LOGO_ITEM && endedByRefund && <span className={ck.hint}>{D.card.logoCameDown(orgDayKey(endedByRefund))}</span>}
                    {done && !isPhone && <span className={ck.hint}>{D.deal.tickedBy(done.byName)}</span>}
                  </span>
                  {done && <span className={css.checkWhen}>{day(done.at)}</span>}
                </label>
              );
            })}
          </ClubSection>
        )}

        <ClubSection id="business-block" className={css.flushSection} title={D.deal.cardBusiness} meta={d.formAt ? D.deal.fromLink(d.formAt) : undefined}>
          {!d.formAt || !b ? <p className={ck.hint}>{D.deal.notYet}</p> : (
            <>
              <dl className={css.pageFacts}>
                <dt>{D.deal.showsAs}</dt>
                <dd>{b.logoUrl && <span className={css.thumb}><img src={b.logoUrl} alt="" /></span>} {b.name}</dd>
                <dt>{D.deal.contact}</dt>
                <dd>{b.contactName ?? '—'}<span className={css.factSub}>{[b.email, b.phone].filter(Boolean).join(' · ')}</span></dd>
                <dt>{D.deal.invoiceTo}</dt>
                <dd>{b.address ? `${b.address.street}, ${b.address.city} ${b.address.province} ${b.address.postal}` : '—'}</dd>
                <dt>{D.deal.website}</dt>
                <dd>{b.website ? b.website.replace(/^https:\/\//, '') : '—'}</dd>
              </dl>
              {data.answers.length > 0 && (
                <>
                  <h3 className={`${css.sectionHeading} ${css.readHeading}`}>{D.deal.answers}</h3>
                  <dl className={css.pageFacts}>
                    {data.answers.map(a => (
                      <span key={a.questionId} style={{ display: 'contents' }}>
                        <dt>{a.label}</dt>
                        <dd className={a.display ? undefined : css.factSub}>{a.display ?? D.deal.notAnswered}</dd>
                      </span>
                    ))}
                  </dl>
                </>
              )}
            </>
          )}
        </ClubSection>

        {/* The fold opens onto the emailed offers only; a deal never emailed has none, so its History is the plain line —
            an arrow that turns onto nothing is a control promising what it doesn't have (owner 2026-11-23). */}
        {data.offers.length > 0 ? (
          <details className={css.card}>
            <summary className={css.historyLine}><strong>{D.deal.history}</strong> · {historyBits}</summary>
            <ul className={css.historyLine}>
              {data.offers.map(o => <li key={o.sentAt}>{`${day(o.sentAt)} · ${o.email} · ${D.offer.reasons[o.reason]}${reasonOnBit(o)} · ${o.sentByName}`}</li>)}
            </ul>
          </details>
        ) : (
          <div className={`${css.card} ${css.historyLine}`}><strong>{D.deal.history}</strong> · {historyBits}</div>
        )}

        <div className={css.recordActions}>
          {data.link && (
            <button type="button" className={css.linkButton} onClick={() => void copy()}><Copy size={14} aria-hidden />{copied ? D.deal.copied : D.deal.copy}</button>
          )}
          {canEmail && (
            <button type="button" className={css.linkButton} aria-haspopup="dialog" disabled={busy} onClick={() => setAsking('email')}><Mail size={14} aria-hidden />{D.deal.emailOffer}</button>
          )}
          {emailBlock && <span className={ck.hint}>{emailBlock}</span>}
          {d.state !== 'withdrawn' && data.link && (
            <button type="button" className={css.linkButton} aria-haspopup="dialog" disabled={busy} onClick={() => setAsking('again')}>
              <RefreshCw size={14} aria-hidden />{linkMade ? D.deal.newLink : D.deal.again}
            </button>
          )}
          {stopped
            ? <span className={ck.hint}>{D.deal.stopped(stopped)}</span>
            : data.address && <button type="button" className={css.linkButton} aria-haspopup="dialog" disabled={busy} onClick={() => setAsking('stop')}><Ban size={14} aria-hidden />{D.deal.doNotOffer}</button>}
          {canWithdraw(d) && (
            <button type="button" className={css.dangerLink} aria-haspopup="dialog" disabled={busy} onClick={() => setAsking('withdraw')}>
              <X size={14} aria-hidden />{d.invoice ? D.deal.withdrawVoids(d.invoice.number) : D.deal.withdraw}
            </button>
          )}
          {said && <p className={css.error} role="alert">{said}</p>}
        </div>
      </div>

      {linkSaid && (
        <KitDialog kind="question" onClose={() => setLinkSaid(null)}
          title={linkSaid.title}
          footer={<>
            <DialogCancel>{D.deal.linkWindowClose}</DialogCancel>
            {linkSaid.copy !== false && data.link && <button type="button" className="btn btn-lime" onClick={() => void copy().then(ok => { if (ok) setLinkSaid(null); })}>{copied ? D.deal.copied : D.deal.copy}</button>}
          </>}>
          <p className={ck.hint}>{linkSaid.text}</p>
        </KitDialog>
      )}
      {asking === 'again' && (
        <KitDialog kind="question" busy={busy} onClose={() => setAsking(null)} title={linkMade ? D.deal.newLinkAsk : D.deal.againAsk}
          footer={<><DialogCancel /><button type="button" className="btn btn-lime" disabled={busy} onClick={() => void act('/again')}>{linkMade ? D.deal.newLinkButton : D.deal.againButton}</button></>}>
          <p className={ck.hint}>{linkMade ? D.deal.newLinkBody : D.deal.againBody}</p>
        </KitDialog>
      )}
      {asking === 'email' && (
        <EmailOfferWindow read={data} onClose={() => setAsking(null)} onSend={async body => {
          const r = await send<{ to: string }>(api('/email'), 'POST', body);
          if (!r.ok) return r.error;
          setAsking(null);
          setNotice({ tone: 'good', text: D.deal.emailSent(r.data.to) });
          await reload();
          return null;
        }} />
      )}
      {asking === 'stop' && data.address && (
        <KitDialog kind="question" busy={busy} onClose={() => setAsking(null)} title={D.deal.doNotOfferAsk(data.address)}
          footer={<><DialogCancel /><button type="button" className="btn btn-danger" disabled={busy} onClick={() => void act('/stop')}>{D.deal.doNotOfferButton}</button></>}>
          <p className={ck.hint}>{D.deal.doNotOfferBody}</p>
        </KitDialog>
      )}
      {asking === 'record' && d.invoice && standing && (
        <RecordPaymentWindow url={api('/payments')} business={d.businessName} number={d.invoice.number} owing={standing.owing} today={data.today}
          onClose={() => setAsking(null)}
          onRecorded={async r => {
            setAsking(null);
            if (r.state === 'paid') setNotice({ tone: 'good', text: r.receipt === 'emailed' && b?.email ? D.deal.receiptSent(b.email) : D.deal.receiptNotSent });
            else setNotice({ tone: 'good', text: D.deal.recorded });
            await reload();
          }}
          onStale={async text => { setAsking(null); setNotice({ tone: 'bad', text }); await reload(); }} />
      )}
      {openedPayment && d.invoice && (
        <PaymentWindow payment={openedPayment} refunds={data.refunds} deal={{ number: d.invoice.number, taxKind: d.invoice.taxKind }}
          business={d.businessName} businessEmail={b?.email ?? null} refundsOn={data.cardRefundsOn}
          canVoid={d.state === 'invoiced' || d.state === 'paid'}
          creditHref={id => api(`/refunds/${id}/credit-note`)}
          onClose={() => setOpened(null)} onRefund={() => setRefunding(true)} onVoid={() => { setVoiding(openedPayment); setOpened(null); }} />
      )}
      {openedPayment?.card && refunding && d.invoice && (
        <RefundWindow url={api(`/payments/${openedPayment.id}/refund`)} payment={openedPayment} refunds={data.refunds}
          endsDeal={refundEndsDeal(data.payments, data.refunds, openedPayment.id)} number={d.invoice.number} taxKind={d.invoice.taxKind}
          business={d.businessName} businessEmail={b?.email ?? null} place={d.placeKind === 'club' ? null : placeLabel(d)}
          onClose={() => setRefunding(false)}
          onStale={async text => { setRefunding(false); setNotice({ tone: 'bad', text }); await reload(); }}
          onDone={async r => {
            setRefunding(false); setOpened(null);
            // Money went to a business: said in a window the club closes, not a strip that fades.
            setLinkSaid(r.state === 'pending'
              ? { title: D.card.doneTitle, text: D.card.pendingBody(r.amount), copy: false }
              : { title: D.card.doneTitle, text: `${D.card.doneBody(r.amount, r.emailedTo)}${r.endsDeal ? ` ${D.card.doneEnded}` : ''}`, copy: false });
            await reload();
          }} />
      )}
      {asking === 'sendInvoice' && (
        <KitDialog kind="question" busy={busy} onClose={() => setAsking(null)} title={D.card.sendInvoiceAsk(d.businessName)}
          footer={<><DialogCancel /><button type="button" className="btn btn-lime" disabled={busy} onClick={async () => {
            setBusy(true); setSaid(null);
            const r = await send<{ emailed: boolean; to: string | null }>(api('/send-invoice'), 'POST', {});
            setBusy(false);
            // A refusal is said at the top, beside the callout the club pressed it from (the line at the page's foot was out of sight).
            if (!r.ok) { setNotice({ tone: 'bad', text: r.error }); setAsking(null); await reload(); return; }
            setAsking(null);
            setLinkSaid({ title: D.card.sendInvoice, text: r.data.emailed && r.data.to ? D.card.sentInvoice(r.data.to) : D.card.sentInvoiceNotEmailed, copy: false });
            await reload();
          }}>{D.card.sendInvoiceButton}</button></>}>
          <p className={ck.hint}>{D.card.sendInvoiceBody}</p>
        </KitDialog>
      )}
      {voiding && (
        <VoidPaymentQuestion url={api(`/payments/${voiding.id}/void`)} payment={voiding} onClose={() => setVoiding(null)}
          onVoided={async keepOpen => { if (!keepOpen) setVoiding(null); await reload(); }} />
      )}
      {asking === 'withdraw' && <WithdrawQuestion name={d.businessName} busy={busy} error={said} onClose={() => setAsking(null)} onWithdraw={reason => void act('/withdraw', { reason })} />}
      {asking === 'edit' && (
        <DealEditWindow read={data} busy={busy} onClose={() => setAsking(null)} onSave={async body => {
          setBusy(true);
          const r = await send<{ revised: 'emailed' | 'not_emailed' | null }>(api(''), 'PATCH', body);
          setBusy(false);
          if (!r.ok) return r.error;
          setAsking(null);
          // A revised invoice goes to a business, so it is said in a window the club closes, not a strip that fades (owner 2026-11-23).
          if (r.data.revised) setLinkSaid(r.data.revised === 'emailed' && b?.email ? { title: D.deal.revisedTitle, text: D.deal.revisedSent(b.email), copy: false } : { title: D.deal.revisedNotSentTitle, text: D.deal.revisedNotSent, copy: false });
          await reload();
          return null;
        }} />
      )}
    </>
  );
}

/**
 * EMAIL THE OFFER (the link-only drawing's tab 2): the email half of Offer a deal for a deal made as a link only — why the club
 * may email them (and its When?), the rule sentence, the note, and Send the offer. The address is the deal's; a business typed
 * with no email is asked for one here.
 */
function EmailOfferWindow({ read, onClose, onSend }: {
  read: DealRead; onClose: () => void; onSend: (body: Record<string, unknown>) => Promise<string | null>;
}) {
  const [why, setWhy] = useState<ReasonValue>(NO_REASON);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; field: string | null } | null>(null);
  async function sendIt() {
    setError(null);
    if (!read.address && !email.trim()) { setError({ text: D.offer.errEmail, field: 'email' }); return; }
    const problem = reasonProblem(why, read.today);
    if (problem) { setError(problem); return; }
    setBusy(true);
    const e = await onSend({ ...reasonBody(why), ...(read.address ? {} : { email }) });
    setBusy(false);
    if (e) setError({ text: e, field: null });
  }
  return (
    <KitDialog kind="form" size="medium" busy={busy} onClose={onClose} eyebrow={read.deal.businessName} title={D.deal.emailTitle}
      dirty={!!why.reason || !!why.reasonOn || !!why.note.trim() || !!email.trim()}
      footer={<><DialogCancel /><button type="button" className="btn btn-lime" disabled={busy} onClick={() => void sendIt()}>{busy ? D.offer.sending : D.offer.send}</button></>}>
      <div className={css.form}>
        {!read.address && (
          <div className={ck.field}>
            <label className={ck.label} htmlFor="deal-email-to">{D.offer.email} <span className={ck.required} aria-hidden>*</span></label>
            <input id="deal-email-to" className={ck.input} type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} />
            {error?.field === 'email' && <p className={css.error} role="alert">{error.text}</p>}
          </div>
        )}
        <OfferReasonFields idPrefix="deal-email" value={why} onChange={setWhy} today={read.today} error={error} />
        {error && !error.field && <p className={css.error} role="alert">{error.text}</p>}
      </div>
    </KitDialog>
  );
}

function WithdrawQuestion({ name, busy, error, onClose, onWithdraw }: {
  name: string; busy: boolean; error: string | null; onClose: () => void; onWithdraw: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState(false);
  return (
    <KitDialog kind="question" busy={busy} onClose={onClose} title={D.deal.withdrawAsk(name)}
      footer={<><DialogCancel /><button type="button" className="btn btn-danger" disabled={busy}
        onClick={() => { if (!reason.trim()) { setMissing(true); return; } onWithdraw(reason.trim()); }}>{D.deal.withdrawButton}</button></>}>
      <p className={ck.hint}>{D.deal.withdrawBody}</p>
      <div className={ck.field}>
        <label className={ck.label} htmlFor="deal-withdraw-reason">{D.deal.withdrawReason} <span className={ck.required} aria-hidden>*</span></label>
        <input id="deal-withdraw-reason" className={ck.input} maxLength={300} value={reason} onChange={e => { setReason(e.target.value); setMissing(false); }} />
        {(missing || error) && <p className={css.error} role="alert">{missing ? D.deal.errReason : error}</p>}
      </div>
    </KitDialog>
  );
}

/** "Change this deal": where it shows and its last day (any state); the amount and the tax switch while the offer is open, and
 *  on an invoice nothing has been paid on, as a revised invoice (Part 3a: "Changing it now sends a revised invoice"). */
function DealEditWindow({ read, busy, onClose, onSave }: {
  read: DealRead; busy: boolean; onClose: () => void; onSave: (body: Record<string, unknown>) => Promise<string | null>;
}) {
  const d = read.deal;
  const [targetId, setTargetId] = useState(d.targetId ?? '');
  const [endsOn, setEndsOn] = useState(d.endsOn ?? '');
  const [amount, setAmount] = useState(d.amount.toFixed(2));
  const [chargeTax, setChargeTax] = useState(d.chargeTax);
  const [error, setError] = useState<string | null>(null);
  const revising = canRevise(d);
  const open = linkTakesForm(d) || revising;
  // A revised invoice can't turn tax on when the business left its address blank: the rate is its province (owner 2026-11-23).
  const taxBlocked = revising && !d.chargeTax && !read.business?.address;
  const t = read.targets;
  // A name and the line beneath it: a team's division, a division's season (the portal's two-line dropdown).
  const list = d.placeKind === 'division' ? t.divisions.map(x => ({ id: x.id, label: `${x.name} division`, sub: x.seasonName, live: x.live }))
    : d.placeKind === 'team' ? t.teams.map(x => ({ id: x.id, label: x.name, sub: x.divisionName, live: x.live }))
      : d.placeKind === 'tournament' ? t.tournaments.map(x => ({ id: x.id, label: x.name, sub: '', live: x.live })) : [];
  const taken = (id: string) => holdersOf(read.holds, d.placeKind, id)[0];

  async function save() {
    setError(null);
    const body: Record<string, unknown> = { endsOn: endsOn || null };
    if (d.placeKind !== 'club') body.targetId = targetId;
    if (open) { body.amount = amount; body.chargeTax = chargeTax; }
    const e = await onSave(body);
    if (e) setError(e);
  }

  return (
    <KitDialog kind="form" size="medium" busy={busy} onClose={onClose} eyebrow={d.businessName} title={D.deal.edit}
      footer={<><DialogCancel /><button type="button" className="btn btn-lime" disabled={busy} onClick={() => void save()}>{W.pkg.done}</button></>}>
      <div className={css.form}>
        {d.placeKind !== 'club' && (
          <div className={ck.field}>
            <label className={ck.label} htmlFor="deal-target">{D.offer.showsOn}</label>
            <SublinedChoice id="deal-target" label={D.offer.showsOn} variant="toolbar"
              triggerClassName={`${ck.select} ${shared.convChoiceToolbarField}`}
              value={targetId} onChange={setTargetId}
              options={[
                ...(list.some(x => x.id === targetId) ? [] : [{ value: targetId, name: placeLabel(d), sub: '', disabled: true }]),
                ...list.filter(x => x.live || x.id === targetId).map(x => {
                  const h = taken(x.id);
                  return { value: x.id, name: x.label, sub: [x.sub, h ? D.offer.taken(h.name, '') : ''].filter(Boolean).join(' · ') };
                }),
              ]} />
            {targetId && taken(targetId) && <p className={ck.hint}>{D.offer.takenRule}</p>}
          </div>
        )}
        <div className={ck.field}>
          <label className={ck.label} htmlFor="deal-until">{D.offer.showsUntil}</label>
          <DateInput id="deal-until" className={ck.input} value={endsOn} onChange={setEndsOn} />
        </div>
        {open ? (
          <>
            <div className={ck.field}>
              <label className={ck.label} htmlFor="deal-amount">{D.offer.amount}</label>
              <input id="deal-amount" className={ck.input} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            {read.registered && (
              <SwitchRow id="deal-tax" name={read.rate ? D.offer.chargeTaxKind(read.rate.kind) : D.offer.chargeTax}
                hint={taxBlocked ? D.deal.taxNeedsAddress : read.rate ? D.offer.taxHint(read.rate.rate, read.business?.address?.province ?? null) : D.offer.taxHintNoAddress}
                on={chargeTax} disabled={busy || taxBlocked} onChange={setChargeTax} />
            )}
            {revising && <p className={ck.hint}>{D.deal.taxLater}.</p>}
          </>
        ) : d.state === 'invoiced' || d.state === 'paid' ? <p className={ck.hint}>{D.deal.errPaidChange}</p> : null}
        {error && <p className={css.error} role="alert">{error}</p>}
      </div>
    </KitDialog>
  );
}
