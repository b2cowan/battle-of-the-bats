'use client';
/**
 * SPONSORSHIPS › DEALS, ONCE A PACKAGE EXISTS (Board Ready Stage 6, Part 2; round 1 tab 5, ask 4). One fiscal year's deals
 * (the Year pill is the money tabs' pill: a deal belongs to the year it was offered in, its income lands in that year's
 * books). The money band above (before GST/HST, so it matches the Sponsorship line in Budget vs. Actual), then the list:
 * a TABLE at a desk, because a column (amount, items done) answers the question; grouped by state in band rows that say
 * the state once (no state column, no chip in the row); Delivered and Withdrawn start folded. The name is the link, one
 * chevron column, no actions in cells. On a phone: the band becomes figure rows and each deal one row in one hairlined
 * frame (standard §3.8). The screen's one lime is "+ Offer a deal".
 * Part 4a (rulings 10A, 11A): on the current year, while any of last year's deals can still be offered, a callout says how
 * many businesses sponsored the club last year, with an outline "Offer again…" (OfferAgainWindow); after its press the
 * result is said in the page notice and the callout says how many are left.
 */
import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Plus } from 'lucide-react';
import { ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, ClubSection, repKit } from '../RepKit';
import { CoachListToolbar } from '@/components/coaches/kit';
import ck from '../ClubKit.module.css';
import tb from '@/components/admin/tournament/AdminToolbar.module.css';
import YearPill, { useClubYear } from '../money/YearPill';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import LoadingState from '@/components/shared/LoadingState';
import SearchField from '@/components/shared/SearchField';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { useOrg } from '@/lib/org-context';
import { DEAL_WORDS as D } from '@/lib/club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS as W, sponsorshipMoney as money } from '@/lib/club-sponsorships-words';
import { checklistOpen, DEAL_BANDS, deliveryCount, type DealBand } from '@/lib/club-sponsorship-deals';
import { placeLabel, useDeals, type ListedDeal } from './deals-api';
import OfferDealWindow from './OfferDealWindow';
import OfferAgainWindow from './OfferAgainWindow';
import PageNotice, { useNotice } from '../PageNotice';
import css from './Sponsorships.module.css';

const FOLDED: ReadonlySet<DealBand> = new Set(['delivered', 'withdrawn']);

/** The row's grey line under the business (round 1 tab 5). */
function subLine(d: ListedDeal): string {
  // A withdrawn deal still holding a payment was refunded in full, which ended it (Part 3b, ask 3).
  if (d.state === 'withdrawn' && d.withdrawn) return d.paidAmount > 0 ? D.card.listWithdrawnRefunded(d.withdrawn.at) : D.list.withdrawnOn(d.withdrawn.at);
  // Round 1 tab 5: "Paid Feb 14 · cheque" — the day it was paid in full and how the last payment came (Part 3a).
  if (d.state === 'paid' && d.paidOn && d.paidHow) return D.list.paidOn(d.paidOn, d.paidHow);
  if ((d.state === 'invoiced' || d.state === 'paid') && d.invoice) return D.list.invoiceDue(d.invoice.number, d.invoice.dueOn);
  if (d.state === 'form_received' && d.formAt) return D.list.cardNotFinished(d.formAt);
  if (!d.emailedAt) return d.openedAt ? D.list.linkOnlyOpened(d.offeredAt, d.openedAt) : D.list.linkOnly(d.offeredAt);
  return d.openedAt ? D.list.sentOpened(d.emailedAt, d.openedAt) : D.list.sentNotOpened(d.emailedAt);
}

/** "Items done": a dash until the deal is invoiced (nothing can be delivered on an open offer). */
function itemsDone(d: ListedDeal, phone = false): string | null {
  if (!checklistOpen(d) && d.state !== 'paid') return null;
  const c = deliveryCount(d);
  if (!c.of) return null;
  return phone ? D.list.itemsDonePhone(c.done, c.of) : D.list.itemsDone(c.done, c.of);
}

export default function DealsList() {
  const isPhone = useIsPhone();
  const router = useRouter();
  // The Year pill remembers one choice per visit across the club's money tabs; Deals shares it (round 1 tab 5's note).
  const { currentOrg } = useOrg();
  const [picked, pick] = useClubYear(currentOrg?.slug ?? '');
  const { slug, data, error, reload } = useDeals(picked);
  const [query, setQuery] = useState('');
  const [offering, setOffering] = useState(false);
  const [again, setAgain] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [notice, setNotice] = useNotice();
  const [unfolded, setUnfolded] = useState<ReadonlySet<DealBand>>(new Set());

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data?.deals ?? []).filter(d => !q || d.businessName.toLowerCase().includes(q));
    return DEAL_BANDS.map(band => ({ band, deals: list.filter(d => d.band === band) })).filter(g => g.deals.length);
  }, [data, query]);

  if (error) return <p className={css.error} role="alert">{error}</p>;
  if (!data) return <LoadingState label={W.loading} />;

  const base = `/${slug}/admin/sponsorships`;
  const f = data.figures;
  const toggle = (band: DealBand) => setUnfolded(s => { const n = new Set(s); if (n.has(band)) n.delete(band); else n.add(band); return n; });
  const open = (band: DealBand) => !FOLDED.has(band) || unfolded.has(band);
  const bandLabel = (band: DealBand, n: number, folded: boolean) => (folded
    ? <button type="button" className={`${css.linkButton} ${css.bandToggle}`} aria-expanded={open(band)} onClick={() => toggle(band)}>
      {open(band) ? '▾' : '▸'} {D.list.band[band]} <span className={css.foldCount}>{n}</span>
    </button>
    : <>{D.list.band[band]}</>);

  const figuresDesk = (
    <MoneySummaryBand ariaLabel={`${D.list.figDeals} · ${data.year.name}`} tiles={[
      { key: 'deals', label: D.list.figDeals, figure: money(f.deals.amount), caption: D.list.dealsCount(f.deals.count) },
      { key: 'paid', label: D.list.figPaid, figure: money(f.paid.amount), caption: D.list.dealsCount(f.paid.count) },
      { key: 'invoiced', label: D.list.figInvoiced, figure: money(f.invoiced.amount), caption: D.list.dealsCount(f.invoiced.count) },
      { key: 'waiting', label: D.list.figWaiting, figure: money(f.waiting.amount), caption: D.list.dealsCount(f.waiting.count) },
    ]} />
  );
  // Phone figures are ROWS (owner ruling) in their OWN white frame — not `inset`, which paints no ground outside a
  // ClubRowFrame — and the phone draws no "Deals" total row (round 1 tab 5, screen B).
  const figuresPhone = (
    <div className={css.figureRows}>
    <ClubRowList label={data.year.name}>
      {([['paid', D.list.figPaid, f.paid], ['invoiced', D.list.figInvoiced, f.invoiced], ['waiting', D.list.figWaiting, f.waiting]] as const).map(([k, label, fig]) => (
        <ClubRow key={k} title={label} caption={D.list.dealsCount(fig.count)} trail={<span className={css.money}>{money(fig.amount)}</span>} />
      ))}
    </ClubRowList>
    </div>
  );

  const desk = (
    <div className={repKit.tableFrame}>
      <table className={repKit.table}>
        <thead>
          <tr>
            <th scope="col">{D.list.colBusiness}</th>
            <th scope="col">{D.list.colPackage}</th>
            <th scope="col">{D.list.colShowsOn}</th>
            <th scope="col" className={repKit.num}>{D.list.colAmount}</th>
            <th scope="col">{D.list.colItems}</th>
            <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
          </tr>
        </thead>
        <tbody>
          {groups.map(g => (
            <Fragment key={g.band}>
              <tr className={repKit.band}><td colSpan={6}>{bandLabel(g.band, g.deals.length, FOLDED.has(g.band))}{!FOLDED.has(g.band) && <span className={css.foldCount}> {g.deals.length}</span>}</td></tr>
              {open(g.band) && g.deals.map(d => {
                const href = `${base}/${d.id}`;
                return (
                  <tr key={d.id} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; router.push(href); }}>
                    <td>
                      <Link href={href} className={repKit.nameLink} onClick={e => e.stopPropagation()}>{d.businessName}</Link>
                      <span className={css.rowCaption}>{subLine(d)}</span>
                    </td>
                    <td>{d.packageName}</td>
                    <td>{placeLabel(d)}</td>
                    <td className={repKit.num}>{money(d.amount)}</td>
                    <td>{itemsDone(d) ?? '—'}</td>
                    <td className={repKit.go}><ChevronRight size={16} aria-hidden /></td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );

  const phone = (
    <ClubRowFrame>
      {groups.map(g => (
        <ClubRowList key={g.band} inset label={D.list.band[g.band]}>
          <ClubRowBand count={FOLDED.has(g.band) ? undefined : g.deals.length}>{bandLabel(g.band, g.deals.length, FOLDED.has(g.band))}</ClubRowBand>
          {open(g.band) && g.deals.map(d => (
            <ClubRow key={d.id} as="link" href={`${base}/${d.id}`} chevron title={d.businessName}
              caption={[d.packageName, placeLabel(d), money(d.amount), itemsDone(d, true)].filter(Boolean).join(' · ')} />
          ))}
        </ClubRowList>
      ))}
    </ClubRowFrame>
  );

  return (
    <>
      {/* The money tabs' toolbar (Toolbar Rules): the Year pill leads at the left; search, then the one lime action, right.
          On a phone the line keeps the pill and the lime "+", and Search takes its own full-width row under it (as Families). */}
      <CoachListToolbar
        filters={isPhone ? undefined : <SearchField value={query} onChange={setQuery} label={D.list.search} />}
        actions={(
          <button type="button" className={`btn btn-lime ${ck.iconOnlyPhone}`} aria-haspopup="dialog" onClick={() => setOffering(true)} aria-label={D.list.offer}>
            <Plus size={14} aria-hidden /><span className={ck.btnWord}>{D.list.offer}</span>
          </button>
        )}>
        <YearPill year={data.year.key} years={data.years} onChange={pick} />
      </CoachListToolbar>
      {isPhone && (
        <div className={tb.phoneSearchRow}>
          <SearchField value={query} onChange={setQuery} label={D.list.search} layout="fill" />
        </div>
      )}
      {notice && <PageNotice notice={notice} />}
      {data.again && (
        <div className={`${css.callout} ${css.againCallout}`}>
          <div className={css.calloutBody}>
            <strong>{D.again.calloutTitle(data.again.sponsored, data.again.lastYear)}</strong>
            <span>{pressed ? D.again.calloutLeft(data.again.left) : D.again.calloutSub}</span>
          </div>
          <button type="button" className="btn btn-outline" aria-haspopup="dialog" onClick={() => setAgain(true)}>{D.again.button}</button>
        </div>
      )}
      {data.deals.length > 0 && (isPhone ? figuresPhone : figuresDesk)}
      {data.deals.length === 0 ? (
        <ClubSection even><p className={ck.hint}>{data.again ? D.again.emptyYear(data.year.name) : D.list.empty}</p></ClubSection>
      ) : groups.length === 0 ? (
        <ClubSection><p className={ck.hint}>{D.list.noMatch}</p></ClubSection>
      ) : isPhone ? phone : desk}
      {data.deals.length > 0 && !isPhone && <p className={css.note}>{D.list.foot}</p>}
      {offering && (
        <OfferDealWindow slug={slug} read={data} onSent={(id, door) => { void reload(); router.push(`${base}/${id}${door ? `?link=${door}` : ''}`); }} onClose={() => setOffering(false)} />
      )}
      {again && (
        <OfferAgainWindow slug={slug} onClose={() => setAgain(false)}
          onDone={result => { setAgain(false); setPressed(true); setNotice(result); void reload(); }} />
      )}
    </>
  );
}
