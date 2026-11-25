'use client';
/**
 * OFFER A DEAL (Board Ready Stage 6, Part 2; round 1 tab 3, asks 1, 6, 7, 9, 13; owner call (d)). A create window (KitDialog
 * form; a full screen on a phone): the business, the package, where it shows, the amount, its last day, the tax switch (a
 * registered club only), then "The email" (OfferReasonFields): why the club may email them, the day a reason that runs out
 * rests on (owner 3A), /legal's fixed rule sentence, and the club's optional note.
 *   · A full package is listed but can't be picked, with its reason (ask 7). A taken place can still be picked: it warns,
 *     never blocks (ask 6).
 *   · Send waits for the club's mailing address ("Add your mailing address in Setup first", the button absent) and is absent
 *     for a business that can't be emailed (its reason said once in the foot).
 *   · "Make the link only" (owner call (c), approved 1A 2026-11-23): the outline button between Cancel and Send. It makes the
 *     same deal and link and emails nothing, so no reason is asked; the same click copies the link (owner 2026-11-23) and the
 *     deal's page opens saying so, Copy the link still its callout's button (`?link=copied|made`). When Send can't
 *     go it stays, and takes the lime (in all four cases: no mailing address, unsubscribed, family opt-out, Do not offer again).
 *   · On a phone the foot holds only Make the link only and Send (owner 2A): Cancel is the head's ←, which asks first when
 *     anything is typed. The computer keeps all three.
 */
import { useMemo, useState } from 'react';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import KitDialog, { DialogCancel } from '../KitDialog';
import ck from '../ClubKit.module.css';
import SwitchRow from './SwitchRow';
import DateInput from '@/components/shared/DateInput';
import OfferReasonFields, { NO_REASON, reasonBody, reasonProblem, type ReasonValue } from './OfferReasonFields';
import SublinedChoice from '@/components/coaches/SublinedChoice';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import { useOrg } from '@/lib/org-context';
import { barSentence, DEAL_WORDS as D } from '@/lib/club-sponsorship-deal-words';
import { parsePrice } from '@/lib/club-sponsorships';
import { gstHstRateOn } from '@/lib/gst-hst-rates';
import { send, sponsorshipsApi } from './api';
import { takenWords, useDeals, type DealsRead, type OfferPrefill } from './deals-api';
import LoadingState from '@/components/shared/LoadingState';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';
import BusinessPicker, { type PickedBusiness } from './BusinessPicker';
import css from './Sponsorships.module.css';

/**
 * Copy a link that is still being made, from inside the click that asked for it. The clipboard takes a promise
 * (`ClipboardItem`), so the click's permission covers a copy that lands when the link arrives — the way Safari requires.
 * A browser without that tries a plain copy once the link is here (Chrome allows it a few seconds after a click).
 * True when the link is on the clipboard; false when there was no link or the browser refused.
 */
export function copyWhenReady(link: Promise<string | null>): Promise<boolean> {
  const plain = () => link.then(l => (l ? navigator.clipboard.writeText(l).then(() => true) : false)).catch(() => false);
  try {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return plain();
    const blob = link.then(l => { if (!l) throw new Error('no link'); return new Blob([l], { type: 'text/plain' }); });
    blob.catch(() => {}); // a failed offer rejects it; the write below reports that
    return navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]).then(() => true, () => link.then(l => (l ? plain() : false)));
  } catch {
    return plain();
  }
}

/** What the deal's page should say on arriving: the link copied, made but not copied, an email we couldn't confirm, or nothing. */
export type SentDoor = 'copied' | 'made' | 'unconfirmed' | null;

/** 12A's reason: "They paid us in the last 2 years", dated by the server's computed payment. */
const oldReason = (p: OfferPrefill): ReasonValue => ({ reason: 'paid_recently', reasonOn: p.paidOn, note: '' });

/**
 * One old deal's "Offer again…" (Part 4a ruling 12A): the ordinary Offer window, read for THIS year (its packages, places and
 * holders) and filled in from the old deal. Nothing new is drawn.
 */
export function OfferAgainOneWindow({ slug, prefill, onSent, onClose }: {
  slug: string; prefill: OfferPrefill; onSent: (dealId: string, door: SentDoor) => void; onClose: () => void;
}) {
  const { data, error } = useDeals(null);
  if (!data) {
    return (
      <KitDialog kind="form" size="medium" onClose={onClose} title={D.offer.title}>
        {error ? <p className={css.error} role="alert">{error}</p> : <LoadingState label={SPONSORSHIPS_WORDS.loading} />}
      </KitDialog>
    );
  }
  return <OfferDealWindow slug={slug} read={data} prefill={prefill} onSent={onSent} onClose={onClose} />;
}

export default function OfferDealWindow({ slug, read, prefill, onSent, onClose }: {
  slug: string;
  read: DealsRead;
  /** Offer again on one old deal (12A): the window opens filled in, and the press names the old deal (`againOf`). */
  prefill?: OfferPrefill;
  /** `copied`: null when the offer was emailed; true/false when Make the link only did / could not copy the link. */
  onSent: (dealId: string, door: SentDoor) => void;
  onClose: () => void;
}) {
  const club = useOrg().currentOrg?.name ?? '';
  const isPhone = useIsPhone();
  const firstPkg = read.packages.find(p => !p.full) ?? null;
  const [business, setBusiness] = useState<PickedBusiness>(prefill ? { kind: 'existing', id: prefill.sponsorId } : null);
  const [email, setEmail] = useState('');
  const [packageId, setPackageId] = useState(prefill?.packageId ?? firstPkg?.id ?? '');
  const [targetId, setTargetId] = useState(prefill?.targetId ?? '');
  const [amount, setAmount] = useState(prefill ? prefill.amount.toFixed(2) : firstPkg ? firstPkg.price.toFixed(2) : '');
  const [endsOn, setEndsOn] = useState(prefill ? prefill.endsOn ?? '' : firstPkg?.showsUntil ?? '');
  const [chargeTax, setChargeTax] = useState(prefill?.chargeTax ?? false);
  // 12A: "They paid us in the last 2 years", dated by the business's latest payment that still stands (the server's).
  const [why, setWhy] = useState<ReasonValue>(prefill ? oldReason(prefill) : NO_REASON);
  const [busy, setBusy] = useState<'link' | 'send' | null>(null);
  const [error, setError] = useState<{ text: string; field: string | null } | null>(null);

  const pkg = read.packages.find(p => p.id === packageId) ?? null;
  const sponsor = business?.kind === 'existing' ? read.sponsors.find(s => s.id === business.id) ?? null : null;
  const needsEmail = business?.kind === 'new' || (!!sponsor && !sponsor.email);
  const bar = sponsor?.bar ?? null;
  // The old deal's reason and "Last year" belong to ITS business: pick another and this is an ordinary offer.
  const fromOld = !!prefill && business?.kind === 'existing' && business.id === prefill.sponsorId;
  const rate = sponsor?.province ? gstHstRateOn(sponsor.province, read.today) : null;

  // Where it shows: the package's kind; a team picks among teams, grouped by division (round 1 tab 3, screen B).
  const kind = pkg?.placeKind ?? 'club';
  const places = useMemo(() => {
    const t = read.targets;
    if (kind === 'division') return t.divisions.filter(x => x.live).map(x => ({ id: x.id, label: `${x.name} division`, group: x.seasonName }));
    if (kind === 'team') return t.teams.filter(x => x.live).map(x => ({ id: x.id, label: x.name, group: x.divisionName }));
    if (kind === 'tournament') return t.tournaments.filter(x => x.live).map(x => ({ id: x.id, label: x.name, group: '' }));
    return [];
  }, [read.targets, kind]);
  const taken = (id: string) => takenWords(read.holds, kind, id);
  const takenOthers = places.filter(p => p.id !== targetId && taken(p.id)).map(p => p.label.replace(/ division$/, ''));
  const groups = [...new Set(places.map(p => p.group))];
  // Group headings only where they say something: several seasons or divisions, or a team's division.
  const grouped = groups.length > 1 || (kind === 'team' && !!groups[0]);

  function pickPackage(id: string) {
    const p = read.packages.find(x => x.id === id);
    setPackageId(id);
    setTargetId('');
    if (p) { setAmount(p.price.toFixed(2)); setEndsOn(p.showsUntil ?? ''); }
  }

  // A full package can't be picked, but an old deal's window can open on one: neither button until another is picked.
  const full = !!pkg?.full;
  const canSend = read.hasMailingAddress && read.hasContact && read.linksOn && !bar && !full;
  // Nothing is sent, so none of the four email rules is about it; only a missing link secret (or a full package) stops it.
  const canLink = read.linksOn && !full;
  const footReason = full ? D.offer.fullReason : !read.hasMailingAddress ? D.offer.needsAddress : !read.hasContact ? D.offer.needsContact : bar ? barSentence(bar, club) : !read.linksOn ? D.offer.noSecret : null;

  /** Send the offer, or (`emailIt` false) make the deal and its link only: the reason is asked only to email. */
  async function offer(emailIt: boolean) {
    setError(null);
    if (!business) { setError({ text: D.offer.errBusiness, field: 'business' }); return; }
    if (!pkg) { setError({ text: D.offer.errPkg, field: 'package' }); return; }
    if (kind !== 'club' && !targetId) { setError({ text: D.offer.errTarget, field: 'target' }); return; }
    if (parsePrice(amount) == null) { setError({ text: D.offer.errAmount, field: 'amount' }); return; }
    if (emailIt) {
      const problem = reasonProblem(why, read.today);
      if (problem) { setError(problem); return; }
    }
    setBusy(emailIt ? 'send' : 'link');
    // Make the link only copies the link in this same click (owner 2026-11-23). The copy starts NOW, inside the click,
    // with the link still on its way: a browser only lets a click copy, and the request below outlasts that permission.
    let linkArrived: (link: string | null) => void = () => {};
    const copying = emailIt ? null : copyWhenReady(new Promise<string | null>(res => { linkArrived = res; }));
    const r = await send<{ id: string; link?: string; unconfirmed?: boolean }>(sponsorshipsApi(slug, '/deals'), 'POST', {
      sponsorId: business.kind === 'existing' ? business.id : null, newName: business.kind === 'new' ? business.name : null,
      email: needsEmail && email.trim() ? email : null, packageId, targetId: kind === 'club' ? null : targetId, amount, endsOn: endsOn || null,
      chargeTax, ...(emailIt ? reasonBody(why) : {}), send: emailIt,
    });
    linkArrived(r.ok ? r.data.link ?? null : null);
    const copied = copying ? await copying : null;
    if (!r.ok) { setBusy(null); setError({ text: r.error, field: null }); return; }
    // ⚠ DO NOT CLOSE THE WINDOW HERE (owner walk 2026-11-24: Make the link only closed the window and the deal's page never
    // opened). The window stands one history entry deep (`useBackStep`); closing it runs `history.back()` to consume that
    // entry, and a `router.push` is not seen as leaving the page, so the back lands on the push while it is still loading
    // and cancels it. The push below is what takes the window away: the route change unmounts it once the deal's page is
    // ready. It stays "busy" until then, so the button keeps saying it is working and nothing is made twice.
    onSent(r.data.id, r.data.unconfirmed ? 'unconfirmed' : copied === null ? null : copied ? 'copied' : 'made');
    // If the page never comes (offline, a failed load), hand the window back rather than leave it frozen.
    window.setTimeout(() => setBusy(null), 30000);
  }

  const fieldError = (field: string) => (error?.field === field ? <p className={css.error} role="alert">{error.text}</p> : null);
  const required = <span className={ck.required} aria-hidden>*</span>;

  return (
    <KitDialog kind="form" size="medium" onClose={onClose} busy={!!busy}
      dirty={prefill ? !!why.note.trim() : !!business || !!email.trim() || !!why.reason || !!why.reasonOn || !!why.note.trim()}
      eyebrow={D.offer.eyebrow} title={D.offer.title}
      footerStart={footReason ? <span className={css.footLine}>{footReason}</span> : undefined}
      footer={(
        <>
          {!isPhone && <DialogCancel>{D.offer.cancel}</DialogCancel>}
          {canLink && (
            <button type="button" className={canSend ? 'btn btn-outline' : 'btn btn-lime'} disabled={!!busy} onClick={() => void offer(false)}>
              {busy === 'link' ? D.offer.making : D.offer.linkOnly}
            </button>
          )}
          {canSend && (
            <button type="button" className="btn btn-lime" disabled={!!busy} onClick={() => void offer(true)}>{busy === 'send' ? D.offer.sending : D.offer.send}</button>
          )}
        </>
      )}>
      <div className={css.form}>
        <div className={ck.field}>
          <label className={ck.label} htmlFor="offer-business">{D.offer.business} {required}</label>
          <BusinessPicker id="offer-business" sponsors={read.sponsors} value={business} club={club} invalid={error?.field === 'business'}
            onChange={v => {
              const wasOld = fromOld;
              const isOld = !!prefill && v?.kind === 'existing' && v.id === prefill.sponsorId;
              if (prefill && wasOld !== isOld) setWhy(isOld ? oldReason(prefill) : NO_REASON);
              setBusiness(v);
              setError(null);
            }} />
          {sponsor && (sponsor.contactName || sponsor.email) && <p className={`${ck.hint} ${css.deskOnly}`}>{D.offer.businessHint(sponsor.contactName, sponsor.email)}</p>}
          {fieldError('business')}
        </div>
        {needsEmail && (
          <div className={ck.field}>
            <label className={ck.label} htmlFor="offer-email">{D.offer.email} {required}</label>
            <input id="offer-email" className={ck.input} type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} />
            <p className={ck.hint}>{D.offer.emailHint}</p>
            {fieldError('email')}
          </div>
        )}
        <div className={css.twoCol}>
          <div className={ck.field}>
            <label className={ck.label} htmlFor="offer-package">{D.offer.pkg} {required}</label>
            <SublinedChoice id="offer-package" label={D.offer.pkg} variant="toolbar"
              triggerClassName={`${ck.select} ${shared.convChoiceToolbarField}`}
              placeholder={D.offer.pkg} value={packageId || null} onChange={pickPackage}
              options={read.packages.map(p => {
                const left = p.howMany != null ? p.howMany - (p.taken.paid + p.taken.invoiced + p.taken.offered) : null;
                return { value: p.id, name: p.name, sub: p.full ? 'Full' : left != null ? D.offer.left(Math.max(0, left)) : '', disabled: p.full };
              })} />
            {read.packages.some(p => p.full) && <p className={ck.hint}>{D.offer.fullReason}</p>}
            {fieldError('package')}
          </div>
          {kind !== 'club' ? (
            <div className={ck.field}>
              <label className={ck.label} htmlFor="offer-target">{D.offer.showsOn} {required}</label>
              <SublinedChoice id="offer-target" label={D.offer.showsOn} variant="toolbar"
                triggerClassName={`${ck.select} ${shared.convChoiceToolbarField}`}
                placeholder={D.offer.showsOn} value={targetId || null} onChange={setTargetId}
                options={places.map(p => ({ value: p.id, name: p.label, sub: taken(p.id), group: grouped ? p.group : undefined }))} />
              {targetId && taken(targetId) && <p className={ck.hint}>{taken(targetId)}. {D.offer.takenRule}</p>}
              {fromOld && prefill?.lastYearPlace && <p className={ck.hint}>{D.again.lastYearPlace(prefill.lastYearPlace)}</p>}
              {!targetId && takenOthers.length > 0 && kind === 'division' && (
                <p className={`${ck.hint} ${css.deskOnly}`}>{D.offer.takenHint(takenOthers.length > 1 ? `${takenOthers.slice(0, -1).join(', ')} and ${takenOthers.at(-1)}` : takenOthers[0])}</p>
              )}
              {fieldError('target')}
            </div>
          ) : (
            <div className={ck.field}>
              <span className={ck.label}>{D.offer.showsOn}</span>
              <p className={css.placeFixed}>{D.list.theClub}</p>
              <p className={ck.hint}>{D.offer.showsOnClubHint}</p>
            </div>
          )}
        </div>
        <div className={css.twoCol}>
          <div className={ck.field}>
            <label className={ck.label} htmlFor="offer-amount">{D.offer.amount} {required}</label>
            <input id="offer-amount" className={ck.input} inputMode="decimal" value={amount} placeholder="1,000.00" onChange={e => setAmount(e.target.value)} />
            <p className={`${ck.hint} ${css.deskOnly}`}>{D.offer.amountHint}</p>
            {fieldError('amount')}
          </div>
          <div className={ck.field}>
            <label className={ck.label} htmlFor="offer-until">{D.offer.showsUntil}</label>
            <DateInput id="offer-until" className={ck.input} value={endsOn} onChange={setEndsOn} />
          </div>
        </div>
        {read.registered && (
          <SwitchRow id="offer-tax" name={rate ? D.offer.chargeTaxKind(rate.kind) : D.offer.chargeTax}
            hint={rate ? D.offer.taxHint(rate.rate, sponsor?.province ?? null) : D.offer.taxHintNoAddress}
            on={chargeTax} disabled={!!busy} onChange={setChargeTax} />
        )}

        {/* A business that can't be emailed: no reason to give (Send is absent), and an unsubscribe or a Do not offer
            again says the way forward (the drawing's tab 3). A family opt-out's foot already says it. */}
        {bar ? (bar.kind !== 'family_opt_out' && (
          <>
            <h3 className={css.sectionHeading}>{D.offer.theEmail}</h3>
            <p className={ck.hint}>{D.offer.barredEmail}</p>
          </>
        )) : (
          <>
            <h3 className={css.sectionHeading}>{D.offer.theEmail}</h3>
            <OfferReasonFields idPrefix="offer" value={why} onChange={v => { setWhy(v); if (error?.field === 'reason' || error?.field === 'reasonOn') setError(null); }}
              today={read.today} error={error} paidHint={fromOld ? D.again.theirLastPayment(prefill!.paidOn) : undefined} />
          </>
        )}
        {error && (!error.field || !['business', 'email', 'package', 'target', 'amount', 'reason', 'reasonOn', 'note'].includes(error.field)) && <p className={css.error} role="alert">{error.text}</p>}
      </div>
    </KitDialog>
  );
}
