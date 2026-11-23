'use client';
/**
 * ONE DEAL (Board Ready Stage 6, Part 2; round 1 tab 5, screens C and D; asks 4, 5, 13). A record over the Deals tab, one
 * level down: it reads first. The callout at its top names the state, then the one thing to do next (the tab 5 table's
 * words, verbatim; Part 3 adds "Record a payment"). The money band once there is an invoice. Then the deal (where it shows
 * and its last day change here, ask 1; the amount and the tax switch only while the offer is open), the delivery checklist
 * (open once invoiced; the logo line puts the logo up now, ask 5), the business as its link sent it with its answers, the
 * history, and the record's actions: Copy the link · Send the link again · Do not offer again · Withdraw (until paid).
 *   · A deal made as a link only (owner 1A, 2026-11-23): the callout says the link was made, not emailed, with Copy the link
 *     as its lime; the actions add Email the offer (the email half of Offer a deal, once the club has a reason) and say
 *     "Make a new link" for Send the link again, since nothing was ever sent.
 *   · Send the link again reads the kept reason against today (owner 3A): run out, the new link is made, nothing is emailed,
 *     and the notice at the top of the page says why (/design's open point: the shipped PageNotice, said once).
 */
import { useState } from 'react';
import Link from 'next/link';
import { Ban, ChevronLeft, Copy, Mail, Pencil, RefreshCw, X } from 'lucide-react';
import KitDialog, { DialogCancel } from '../KitDialog';
import { Callout, ClubRow, ClubRowList } from '../RepKit';
import PageNotice, { useNotice } from '../PageNotice';
import OfferReasonFields, { NO_REASON, reasonBody, reasonProblem, type ReasonValue } from './OfferReasonFields';
import { barSentence } from './BusinessPicker';
import { useOrg } from '@/lib/org-context';
import ck from '../ClubKit.module.css';
import SwitchRow from './SwitchRow';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import DateInput from '@/components/shared/DateInput';
import SublinedChoice from '@/components/coaches/SublinedChoice';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import LoadingState from '@/components/shared/LoadingState';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { formatStoredDate } from '@/lib/timezone';
import { DEAL_WORDS as D } from '@/lib/club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS as W, sponsorshipMoney as money } from '@/lib/club-sponsorships-words';
import { canWithdraw, checklistOf, checklistOpen, deliveryCount, holdersOf, isOverdue, linkTakesForm, LOGO_ITEM, reasonHasClock } from '@/lib/club-sponsorship-deals';
import { send, sponsorshipsApi } from './api';
import { placeLabel, useDeal, type DealRead } from './deals-api';
import css from './Sponsorships.module.css';

const day = (d: string) => formatStoredDate(d, { withYear: false });

/** The callout (round 1 tab 5's table, ask 4): the state, then what the club does next. */
function callout(r: DealRead): { title?: string; text: string; tone: 'olive' | 'warn' } {
  const d = r.deal;
  if (d.band === 'withdrawn' && d.withdrawn) return { text: D.callout.withdrawn(d.withdrawn.at, d.withdrawn.byName, d.withdrawn.reason), tone: 'olive' };
  if (d.band === 'delivered') return { text: D.callout.delivered, tone: 'olive' };
  if (d.state === 'paid') { const c = deliveryCount(d); return { text: D.callout.paid(d.invoice?.issuedOn ?? d.offeredOn, c.done, c.of), tone: 'olive' }; }
  if (d.state === 'invoiced' && d.invoice) {
    const text = D.callout.invoiced(d.invoice.number, d.invoice.total, d.invoice.issuedOn, d.invoice.dueOn);
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
  const [asking, setAsking] = useState<'again' | 'stop' | 'withdraw' | 'edit' | 'email' | null>(null);
  const [notice, setNotice] = useNotice();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  if (error) return <p className={css.error} role="alert">{error}</p>;
  if (!data) return <LoadingState label={W.loading} />;

  const d = data.deal;
  const b = data.business;
  const base = `/${slug}/admin/sponsorships`;
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
    const r = await send<{ emailed?: boolean; error?: string; outcome?: 'emailed' | 'link_only' | 'ran_out' | 'not_emailed'; to?: string }>(api(path), 'POST', body ?? {});
    setBusy(false);
    if (!r.ok) { setSaid(r.error); void reload(); return false; }
    if (r.data.error) setSaid(r.data.error);
    // A new link (Send the link again / Make a new link): said once at the top, fading on its own.
    const o = r.data.outcome;
    if (o) {
      setNotice({
        tone: 'good',
        text: o === 'emailed' && r.data.to ? D.deal.sentNewLink(r.data.to) : o === 'ran_out' ? D.deal.ranOut : o === 'link_only' ? D.deal.madeNewLink : D.deal.notEmailedNewLink,
      });
    }
    setAsking(null);
    await reload();
    return true;
  }
  async function copy() {
    if (!data?.link) return;
    try { await navigator.clipboard.writeText(data.link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setSaid(W.say.failed); }
  }

  const band = d.invoice && (isPhone ? (
    <ClubRowList inset label={D.deal.figInvoiced}>
      <ClubRow title={D.deal.figInvoiced} caption={d.invoice.taxKind ? D.deal.figInclTax(d.invoice.taxKind, d.invoice.tax) : undefined} trail={<span className={css.money}>{money(d.invoice.total)}</span>} />
      <ClubRow title={D.deal.figPaid} trail={<span className={css.money}>{money(0)}</span>} />
      <ClubRow title={D.deal.figOwing} caption={D.deal.figDue(d.invoice.dueOn)} trail={<span className={css.money}>{money(d.invoice.total)}</span>} />
    </ClubRowList>
  ) : (
    <MoneySummaryBand ariaLabel={d.businessName} tiles={[
      { key: 'invoiced', label: D.deal.figInvoiced, figure: money(d.invoice.total), caption: d.invoice.taxKind ? D.deal.figInclTax(d.invoice.taxKind, d.invoice.tax) : undefined },
      { key: 'paid', label: D.deal.figPaid, figure: money(0) },
      { key: 'owing', label: D.deal.figOwing, figure: money(d.invoice.total), caption: D.deal.figDue(d.invoice.dueOn) },
    ]} />
  ));

  const firstOffer = data.offers.find(o => o.kind === 'offer') ?? null;
  const reasonOnBit = (o: { reason: DealRead['offers'][number]['reason']; reasonOn: string } | null) =>
    o && reasonHasClock(o.reason) ? ` ${D.deal.hReasonOn(o.reason as 'paid_recently' | 'asked_recently', o.reasonOn)}` : '';
  const historyBits = [
    d.emailedAt ? `${D.deal.hOffered(firstOffer?.sentAt ?? d.offeredAt, firstOffer?.sentByName ?? d.offeredByName)}${reasonOnBit(firstOffer)}` : D.deal.hLinkMade(d.offeredAt, d.offeredByName),
    d.linkUnsentAt ? D.deal.hRelinked(d.linkUnsentAt) : null,
    d.openedAt ? D.deal.hOpened(d.openedAt) : null,
    d.formAt ? D.deal.hForm(d.formAt) : null,
    d.invoice ? D.deal.hInvoice(d.invoice.issuedOn) : null,
    d.withdrawn ? D.deal.hWithdrawn(d.withdrawn.at, d.withdrawn.byName) : null,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <Link className={css.backLink} href={base}><ChevronLeft size={14} aria-hidden />{D.deal.back}</Link>
      <div className={css.dealHead}>
        <h2 className={css.dealTitle}>{d.businessName}</h2>
        <span className={ck.chip}>{D.list.band[d.band]}</span>
        {d.state !== 'withdrawn' && (
          <button type="button" className={css.iconBtn} aria-label={D.deal.edit} aria-haspopup="dialog" onClick={() => setAsking('edit')}><Pencil size={16} aria-hidden /></button>
        )}
      </div>
      <p className={css.dealSub}>{[d.packageName, placeLabel(d), d.offeredOn.slice(0, 4)].join(' · ')}</p>
      {notice && <PageNotice notice={notice} />}

      <div className={css.dealGrid}>
        <Callout tone={c.tone} role="status" flush
          action={linkMade && d.state === 'offered' && data.link
            ? <button type="button" className="btn btn-lime" onClick={() => void copy()}>{copied ? D.deal.copied : D.deal.copy}</button>
            : undefined}>
          {c.title && <strong>{c.title} </strong>}{isPhone && d.state === 'invoiced' && d.invoice ? D.callout.invoicedPhone(d.invoice.number, d.invoice.total, d.invoice.dueOn) : c.text}
        </Callout>
        {band}

        <section className={css.card} aria-label={D.deal.cardDeal}>
          <div className={css.cardHead}><h3 className={css.cardTitle}>{D.deal.cardDeal}</h3></div>
          <dl className={css.facts}>
            <dt>{D.deal.package}</dt><dd>{d.packageName}</dd>
            <dt>{D.deal.showsOn}</dt>
            <dd>{placeLabel(d)}<span className={css.factSub}>{d.placeKind !== 'club' && !d.targetId ? D.deal.targetGone : D.deal.showsOnSub[d.placeKind](d.endsOn)}</span></dd>
            <dt>{D.deal.amount}</dt><dd>{money(d.amount)}</dd>
            {data.registered && (
              <>
                <dt>{D.deal.chargeTax}</dt>
                <dd>
                  {d.chargeTax ? (d.invoice?.taxRate != null ? D.deal.taxYes(d.invoice.taxKind ?? 'HST', d.invoice.taxRate) : data.rate ? D.deal.taxYes(data.rate.kind, data.rate.rate) : 'Yes') : D.deal.taxNo}
                  {/* D.deal.taxLater ("Changing it now sends a revised invoice") returns with Part 3's revised invoice. */}
                </dd>
              </>
            )}
            {d.invoice && (<><dt>{D.deal.invoice}</dt><dd>{d.invoice.number}</dd></>)}
          </dl>
        </section>

        {lines.length > 0 && (
          <section className={css.card} aria-label={D.deal.cardDelivery}>
            <div className={css.cardHead}>
              <h3 className={css.cardTitle}>{D.deal.cardDelivery}</h3>
              <span className={css.cardMeta}>{D.deal.delivered(delivery.done, delivery.of)}</span>
            </div>
            {!checklistOpen(d) && d.state !== 'withdrawn' && <p className={ck.hint}>{D.deal.checklistClosed}</p>}
            {lines.map(l => {
              const done = d.done[l.id];
              return (
                <label key={l.id} className={css.checkRow}>
                  <input type="checkbox" checked={!!done} disabled={busy || !checklistOpen(d)}
                    onChange={e => void act('/items', { itemId: l.id, on: e.target.checked })} />
                  <span className={css.checkMain}>
                    <span>{l.logo ? D.deal.logoLine : l.text}</span>
                    {l.id === LOGO_ITEM && !done && !isPhone && <span className={ck.hint}>{D.deal.logoHintUp(D.deal.logoWhere[d.placeKind])}</span>}
                    {done && !isPhone && <span className={ck.hint}>{D.deal.tickedBy(done.byName)}</span>}
                  </span>
                  {done && <span className={css.checkWhen}>{day(done.at)}</span>}
                </label>
              );
            })}
          </section>
        )}

        <section className={css.card} aria-label={D.deal.cardBusiness}>
          <div className={css.cardHead}>
            <h3 className={css.cardTitle}>{D.deal.cardBusiness}</h3>
            {d.formAt && <span className={css.cardMeta}>{D.deal.fromLink(d.formAt)}</span>}
          </div>
          {!d.formAt || !b ? <p className={ck.hint}>{D.deal.notYet}</p> : (
            <>
              <dl className={css.facts}>
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
                  <h4 className={css.sectionHeading}>{D.deal.answers}</h4>
                  <dl className={css.facts}>
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
        </section>

        <details className={css.card}>
          <summary className={css.historyLine}><strong>{D.deal.history}</strong> · {historyBits}</summary>
          <ul className={css.historyLine}>
            {data.offers.map(o => <li key={o.sentAt}>{`${day(o.sentAt)} · ${o.email} · ${D.offer.reasons[o.reason]}${reasonOnBit(o)} · ${o.sentByName}`}</li>)}
          </ul>
        </details>

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
      {asking === 'withdraw' && <WithdrawQuestion name={d.businessName} busy={busy} error={said} onClose={() => setAsking(null)} onWithdraw={reason => void act('/withdraw', { reason })} />}
      {asking === 'edit' && (
        <DealEditWindow read={data} busy={busy} onClose={() => setAsking(null)} onSave={async body => {
          setBusy(true);
          const r = await send(api(''), 'PATCH', body);
          setBusy(false);
          if (!r.ok) return r.error;
          setAsking(null);
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
  const to = read.address ?? email.trim();
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
      footerStart={to ? <span className={css.footLine}>{D.offer.emails(to)}</span> : undefined}
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

/** "Change this deal": where it shows and its last day (any state), the amount and the tax switch (while the offer is open). */
function DealEditWindow({ read, busy, onClose, onSave }: {
  read: DealRead; busy: boolean; onClose: () => void; onSave: (body: Record<string, unknown>) => Promise<string | null>;
}) {
  const d = read.deal;
  const [targetId, setTargetId] = useState(d.targetId ?? '');
  const [endsOn, setEndsOn] = useState(d.endsOn ?? '');
  const [amount, setAmount] = useState(d.amount.toFixed(2));
  const [chargeTax, setChargeTax] = useState(d.chargeTax);
  const [error, setError] = useState<string | null>(null);
  const open = linkTakesForm(d);
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
                hint={read.rate ? D.offer.taxHint(read.rate.rate, read.business?.address?.province ?? null) : D.offer.taxHintNoAddress}
                on={chargeTax} disabled={busy} onChange={setChargeTax} />
            )}
          </>
        ) : <p className={ck.hint}>{D.deal.errInvoicedChange}</p>}
        {error && <p className={css.error} role="alert">{error}</p>}
      </div>
    </KitDialog>
  );
}
