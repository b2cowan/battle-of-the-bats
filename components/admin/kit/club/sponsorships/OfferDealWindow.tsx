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
 *     same deal and link and emails nothing, so no reason is asked; the deal's page opens with Copy the link. When Send can't
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
import { DEAL_WORDS as D } from '@/lib/club-sponsorship-deal-words';
import { holdersOf } from '@/lib/club-sponsorship-deals';
import { parsePrice } from '@/lib/club-sponsorships';
import { gstHstRateOn } from '@/lib/gst-hst-rates';
import { send, sponsorshipsApi } from './api';
import type { DealsRead } from './deals-api';
import BusinessPicker, { barSentence, type PickedBusiness } from './BusinessPicker';
import css from './Sponsorships.module.css';

const STATE_WORD = { offered: 'offered', form_received: 'offered', invoiced: 'invoiced', paid: '', withdrawn: '' } as const;

export default function OfferDealWindow({ slug, read, onSent, onClose }: {
  slug: string;
  read: DealsRead;
  onSent: (dealId: string) => void;
  onClose: () => void;
}) {
  const club = useOrg().currentOrg?.name ?? '';
  const isPhone = useIsPhone();
  const firstPkg = read.packages.find(p => !p.full) ?? null;
  const [business, setBusiness] = useState<PickedBusiness>(null);
  const [email, setEmail] = useState('');
  const [packageId, setPackageId] = useState(firstPkg?.id ?? '');
  const [targetId, setTargetId] = useState('');
  const [amount, setAmount] = useState(firstPkg ? firstPkg.price.toFixed(2) : '');
  const [endsOn, setEndsOn] = useState(firstPkg?.showsUntil ?? '');
  const [chargeTax, setChargeTax] = useState(false);
  const [why, setWhy] = useState<ReasonValue>(NO_REASON);
  const [busy, setBusy] = useState<'link' | 'send' | null>(null);
  const [error, setError] = useState<{ text: string; field: string | null } | null>(null);

  const pkg = read.packages.find(p => p.id === packageId) ?? null;
  const sponsor = business?.kind === 'existing' ? read.sponsors.find(s => s.id === business.id) ?? null : null;
  const needsEmail = business?.kind === 'new' || (!!sponsor && !sponsor.email);
  const to = needsEmail ? email.trim() : sponsor?.email ?? '';
  const bar = sponsor?.bar ?? null;
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
  const holders = (id: string | null) => holdersOf(read.holds, kind, id);
  const takenWords = (id: string) => {
    const h = holders(id)[0];
    if (!h) return '';
    return h.state === 'offered' || h.state === 'form_received' ? D.offer.offeredTo(h.name) : D.offer.taken(h.name, STATE_WORD[h.state]);
  };
  const takenOthers = places.filter(p => p.id !== targetId && holders(p.id).length).map(p => p.label.replace(/ division$/, ''));
  const groups = [...new Set(places.map(p => p.group))];
  // Group headings only where they say something: several seasons or divisions, or a team's division.
  const grouped = groups.length > 1 || (kind === 'team' && !!groups[0]);

  function pickPackage(id: string) {
    const p = read.packages.find(x => x.id === id);
    setPackageId(id);
    setTargetId('');
    if (p) { setAmount(p.price.toFixed(2)); setEndsOn(p.showsUntil ?? ''); }
  }

  const canSend = read.hasMailingAddress && read.hasContact && read.linksOn && !bar;
  // Nothing is sent, so none of the four email rules is about it; only a missing link secret stops it.
  const canLink = read.linksOn;
  const footReason = !read.hasMailingAddress ? D.offer.needsAddress : !read.hasContact ? D.offer.needsContact : bar ? barSentence(bar, club) : !read.linksOn ? D.offer.noSecret : null;

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
    const r = await send<{ id: string }>(sponsorshipsApi(slug, '/deals'), 'POST', {
      sponsorId: business.kind === 'existing' ? business.id : null, newName: business.kind === 'new' ? business.name : null,
      email: needsEmail && email.trim() ? email : null, packageId, targetId: kind === 'club' ? null : targetId, amount, endsOn: endsOn || null,
      chargeTax, ...(emailIt ? reasonBody(why) : {}), send: emailIt,
    });
    setBusy(null);
    if (!r.ok) { setError({ text: r.error, field: null }); return; }
    onSent(r.data.id);
    onClose();
  }

  const fieldError = (field: string) => (error?.field === field ? <p className={css.error} role="alert">{error.text}</p> : null);
  const required = <span className={ck.required} aria-hidden>*</span>;

  return (
    <KitDialog kind="form" size="medium" onClose={onClose} busy={!!busy}
      dirty={!!business || !!email.trim() || !!why.reason || !!why.reasonOn || !!why.note.trim()}
      eyebrow={D.offer.eyebrow} title={D.offer.title}
      footerStart={footReason ? <span className={css.footLine}>{footReason}</span> : to ? <span className={css.footLine}>{D.offer.emails(to)}</span> : undefined}
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
            onChange={v => { setBusiness(v); setError(null); }} />
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
                options={places.map(p => ({ value: p.id, name: p.label, sub: takenWords(p.id), group: grouped ? p.group : undefined }))} />
              {targetId && takenWords(targetId) && <p className={ck.hint}>{takenWords(targetId)}. {D.offer.takenRule}</p>}
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
              today={read.today} error={error} />
          </>
        )}
        {error && (!error.field || !['business', 'email', 'package', 'target', 'amount', 'reason', 'reasonOn', 'note'].includes(error.field)) && <p className={css.error} role="alert">{error.text}</p>}
      </div>
    </KitDialog>
  );
}
