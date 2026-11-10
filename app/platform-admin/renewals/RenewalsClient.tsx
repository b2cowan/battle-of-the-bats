'use client';
/**
 * Renewals on the screen (Plans & pricing Stage 2 Part 4b; the server half and the rulings are in `page.tsx`, the rules in
 * `lib/renewals.ts`). Every control writes the address; the server builds the rows. Every chip opens its explanation on a
 * click (hover alone is not enough). Nothing here changes anything.
 */
import { Fragment, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ExportMenu, { triggerDownload } from '@/components/admin/ExportMenu';
import ViewSwitch from '@/components/coaches/kit/ViewSwitch';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import DateInput from '@/components/shared/DateInput';
import { consoleDate } from '@/lib/console-dates';
import { formatCents } from '@/lib/console-money';
import {
  RW, DATES_FACE, DATES_KEYS, DATES_LABELS, WHAT_OPTIONS, SHOW_KEYS, byCurrencyWords, currencyNote, paramsQuery, priceTileNote, priceTileValue, priceWords,
  rangeFace, rangeWords,
  type ComingRow, type ComingView, type PriceCell, type RenewalsParams, type UnpaidRow, type UnpaidView,
} from '@/lib/renewals';
import kit from '../console.module.css';
import styles from './renewals.module.css';

type Tone = 'ok' | 'warn' | 'info';
const TONE: Record<Tone, string> = { ok: kit.chipOk, warn: kit.chipWarn, info: kit.chipInfo };
const KIND_TONE: Record<ComingRow['kind'], Tone> = {
  renews: 'ok', trial_ends: 'info', free_time_ends: 'info', founding_ends: 'info', plan_ends: 'info', stale_trial: 'warn',
};

/** One open explanation at a time, keyed by row and chip. */
function useExplain() {
  const [open, setOpen] = useState<string | null>(null);
  const chip = (id: string, text: string, tone: Tone) => (
    <button type="button" className={`${kit.chip} ${TONE[tone]} ${styles.chipButton}`}
      onClick={() => setOpen(x => (x === id ? null : id))} aria-expanded={open === id} aria-controls={`explain-${id}`}>
      {text}
    </button>
  );
  return { open, chip };
}

function Tile({ label, value, note, warn, on, onClick, small }: {
  label: string; value: ReactNode; note?: string; warn?: boolean; on?: boolean; onClick?: () => void; small?: boolean;
}) {
  const cls = `${kit.bandCell} ${warn ? kit.bandWarn : ''} ${on ? kit.bandOn : ''}`;
  const inner = (
    <>
      <span className={kit.bandLabel}>{label}</span>
      <strong className={`${kit.bandValue} ${small ? kit.bandValueSm : ''}`}>{value}</strong>
      {note ? <span className={kit.bandNote}>{note}</span> : null}
    </>
  );
  return onClick
    ? <button type="button" className={cls} onClick={onClick} aria-pressed={!!on}>{inner}</button>
    : <div className={cls}>{inner}</div>;
}

export default function RenewalsClient({ params, live, data }: { params: RenewalsParams; live: boolean; data: ComingView | UnpaidView }) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (next: Partial<RenewalsParams>) => {
    const qs = paramsQuery({ ...params, ...next });
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };
  const exportUrl = (format: 'xlsx' | 'csv') => {
    const qs = paramsQuery(params);
    const view = params.view === 'unpaid' ? '' : 'view=coming_up&';
    return `/api/platform-admin/renewals/export?${view}${qs ? `${qs}&` : ''}format=${format}`;
  };

  const viewSwitch = (
    <ViewSwitch label="Renewals view" value={params.view}
      views={[{ id: 'coming_up', label: RW.views.coming_up }, { id: 'unpaid', label: RW.views.unpaid }]}
      onChange={v => go({ view: v, plan: 'all', noBill: false })} />
  );
  const planSelect = (
    <select className={kit.select} aria-label={RW.toolbar.plan} value={params.plan} onChange={e => go({ plan: e.target.value })}>
      {data.plans.map(p => <option key={p.id} value={p.id}>{p.id === 'all' ? RW.toolbar.allPlans : p.label}</option>)}
    </select>
  );
  const exportMenu = (
    <ExportMenu formats={['xlsx', 'csv']} disabled={!data.read}
      onExportXLSX={() => triggerDownload(exportUrl('xlsx'))} onExportCSV={() => triggerDownload(exportUrl('csv'))} />
  );

  return (
    <div className={`${kit.page} ${styles.page}`}>
      <AdminPageHeader
        title={RW.title}
        titleChips={<span className={`${kit.chip} ${kit.chipInfo}`} title={RW.modeNote}>{live ? RW.mode.live : RW.mode.test}</span>}
      />
      <p className={`${kit.caption} ${kit.captionTight}`}>{RW.captions[params.view]}</p>
      {data.view === 'coming_up'
        ? <ComingUp data={data} params={params} go={go} viewSwitch={viewSwitch} planSelect={planSelect} exportMenu={exportMenu} />
        : <Unpaid data={data} params={params} go={go} viewSwitch={viewSwitch} planSelect={planSelect} exportMenu={exportMenu} />}
      <p className={kit.caption}>{RW.modeNote}</p>
    </div>
  );
}

type ViewProps<D> = {
  data: D; params: RenewalsParams; go: (next: Partial<RenewalsParams>) => void;
  viewSwitch: ReactNode; planSelect: ReactNode; exportMenu: ReactNode;
};

function CouldNotRead() {
  return <p className={`${kit.callout} ${kit.calloutBad}`} role="alert">{RW.couldNotRead}</p>;
}

function PriceCellView({ id, price, chip }: { id: string; price: PriceCell; chip: ReturnType<typeof useExplain>['chip'] }) {
  if (price.kind === 'no_price') return <span className={styles.priceCell}>{chip(`${id}:price`, RW.coming.noPriceOnFile, 'warn')}</span>;
  if (price.kind !== 'price') return <span className={kit.muted}>{priceWords(price)}</span>;
  return (
    <span className={styles.priceCell}>
      {priceWords(price)}
      {!price.per && chip(`${id}:cycle`, RW.coming.cycleNotOnFile, 'info')}
    </span>
  );
}

function ComingUp({ data, params, go, viewSwitch, planSelect, exportMenu }: ViewProps<ComingView>) {
  const { open, chip } = useExplain();
  const b = data.band;
  const dash = RW.dash;
  const pick = (what: RenewalsParams['what']) => go({ what: params.what === what ? 'all' : what });
  const dateOptions = DATES_KEYS.map(k => ({
    id: k, label: DATES_LABELS[k],
    faceLabel: k === params.dates ? `${DATES_FACE[k]} · ${rangeFace(data.range)}` : undefined,
  }));
  const anyInDates = !!b && (b.renewals + b.trials + b.freeTime + b.stale) > 0;

  return (
    <>
      <div className={styles.bar}>
        {viewSwitch}
        <SingleSelectDropdown lead label={RW.toolbar.dates} options={dateOptions} value={params.dates}
          onChange={next => go({ dates: next as RenewalsParams['dates'], from: null, to: null })} />
        {params.dates === 'custom' && (
          <span className={styles.dates}>
            <label>From<DateInput className={kit.field} value={data.range.from} onChange={v => go({ from: v || null })} /></label>
            <label>To<DateInput className={kit.field} value={data.range.to} rangeStart={data.range.from} onChange={v => go({ to: v || null })} /></label>
          </span>
        )}
        <select className={kit.select} aria-label={RW.toolbar.what} value={params.what} onChange={e => go({ what: e.target.value as RenewalsParams['what'] })}>
          {WHAT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        {planSelect}
        <span className={styles.barEnd}>{exportMenu}</span>
      </div>

      <section className={kit.band} aria-label="Coming up at a glance">
        <Tile label={RW.bandComing.renewals} value={b ? b.renewals : dash} note={RW.bandComing.renewalsNote}
          on={params.what === 'renews'} onClick={b ? () => pick('renews') : undefined} />
        <Tile label={RW.bandComing.trials} value={b ? b.trials : dash} note={RW.bandComing.trialsNote}
          on={params.what === 'trial_ends'} onClick={b ? () => pick('trial_ends') : undefined} />
        <Tile label={RW.bandComing.freeTime} value={b ? b.freeTime : dash} note={RW.bandComing.freeTimeNote}
          on={params.what === 'free_or_founding'} onClick={b ? () => pick('free_or_founding') : undefined} />
        <Tile label={RW.bandComing.price} value={b ? priceTileValue(b) : dash} note={b ? priceTileNote(b) : undefined} />
        <Tile label={RW.bandComing.stale} value={b ? b.stale : dash} note={RW.bandComing.staleNote} warn={!!b && b.stale > 0}
          on={params.what === 'stale_trial'} onClick={b ? () => pick('stale_trial') : undefined} />
      </section>

      <div className={kit.card}>
        {!data.read ? <div className={kit.cardPad}><CouldNotRead /></div> : (
          <div className={`${kit.tableWrap} table-cards`}>
            <table className={kit.comfortable}>
              <thead>
                <tr>
                  <th className={kit.nowrap}>{RW.coming.col.date}</th><th className={kit.nowrap}>{RW.coming.col.what}</th><th>{RW.coming.col.club}</th><th className={kit.nowrap}>{RW.coming.col.plan}</th>
                  <th className={`${kit.num} ${kit.nowrap}`}>{RW.coming.col.price}</th><th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className={kit.empty}>
                      {anyInDates ? 'Nothing matches this pick in these dates.' : RW.coming.empty(rangeWords(data.range))}
                      {!anyInDates && params.dates !== 'next_30' && (
                        <> <button type="button" className={`${kit.door} ${styles.chipButton}`} onClick={() => go({ dates: 'next_30', from: null, to: null })}>{RW.coming.emptyDoor}</button></>
                      )}
                    </td>
                  </tr>
                )}
                {data.rows.map(r => {
                  const kindId = `${r.key}:kind`;
                  const explainId = open?.startsWith(`${r.key}:`) ? open : null;
                  const explainText = explainId === kindId ? RW.explain[r.kind]
                    : explainId?.endsWith(':cycle') ? RW.explain.cycle
                    : explainId?.endsWith(':price') ? RW.explain.noPrice : null;
                  return (
                    <Fragment key={r.key}>
                      <tr className={r.kind === 'stale_trial' ? styles.rowWarn : undefined}>
                        <td data-label={RW.coming.col.date} className={kit.nowrap}>{consoleDate(r.date)}</td>
                        <td data-label={RW.coming.col.what}>{chip(kindId, RW.kinds[r.kind], KIND_TONE[r.kind])}</td>
                        <td className="table-cards-title">
                          <Link href={r.door.href} className={kit.nameLink}>{r.name}</Link>
                          {r.isPortal && <span className={kit.sub}>{RW.coming.portalSub}</span>}
                        </td>
                        <td data-label={RW.coming.col.plan} className={kit.nowrap}>{r.plan}</td>
                        <td data-label={RW.coming.col.price} className={`${kit.num} ${kit.nowrap}`}><PriceCellView id={r.key} price={r.price} chip={chip} /></td>
                        <td className={`${kit.rowDoor} ${styles.doorCell}`}><Link href={r.door.href} className={kit.door}>{r.door.label}</Link></td>
                      </tr>
                      {explainText && (
                        <tr id={`explain-${explainId}`} className={styles.explainRow}><td colSpan={6}>{explainText}</td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className={kit.foot}><span className={kit.countQuiet}>{RW.coming.foot}</span></div>
      </div>
    </>
  );
}

function Money({ cents, currency }: { cents: number; currency: string }) {
  return <>{formatCents(cents, currency)}</>;
}

function Unpaid({ data, params, go, viewSwitch, planSelect, exportMenu }: ViewProps<UnpaidView>) {
  const { open, chip } = useExplain();
  const b = data.band;
  const dash = RW.dash;
  const showOptions = SHOW_KEYS.map(k => ({ id: k, label: RW.unpaid.show[k], sub: RW.unpaid.showDetail[k] }));

  return (
    <>
      <div className={styles.bar}>
        {viewSwitch}
        <SingleSelectDropdown lead label={RW.toolbar.show} options={showOptions} value={params.show}
          onChange={next => go({ show: next as RenewalsParams['show'], noBill: false })} />
        {planSelect}
        <span className={styles.barEnd}>{exportMenu}</span>
      </div>

      <section className={kit.band} aria-label="Unpaid bills at a glance">
        <Tile label={RW.bandUnpaid.bills} value={b ? b.bills : dash} note={b ? `${b.clubs} ${b.clubs === 1 ? 'club' : 'clubs'}` : undefined} />
        <Tile label={RW.bandUnpaid.owed} value={b ? byCurrencyWords(b.owed) : dash} note={b ? currencyNote(b.owed) : undefined} />
        <Tile label={RW.bandUnpaid.tax} value={b ? byCurrencyWords(b.tax) : dash} note={RW.bandUnpaid.taxNote} />
        <Tile label={RW.bandUnpaid.noBill} value={b ? b.noBill : dash} note={RW.bandUnpaid.noBillNote} warn={!!b && b.noBill > 0}
          on={params.noBill} onClick={b ? () => go({ noBill: !params.noBill, show: 'open' }) : undefined} />
        <Tile small label={RW.bandUnpaid.writtenOff} value={b ? byCurrencyWords(b.writtenOffYear) : dash}
          note={b ? `${b.writtenOffYearCount} ${b.writtenOffYearCount === 1 ? 'bill' : 'bills'} · before tax` : undefined} />
      </section>

      <div className={kit.card}>
        {!data.read ? <div className={kit.cardPad}><CouldNotRead /></div> : (
          <div className={`${kit.tableWrap} table-cards`}>
            <table className={kit.comfortable}>
              <thead>
                <tr>
                  <th className={kit.nowrap}>{RW.unpaid.col.issued}</th><th>{RW.unpaid.col.club}</th><th className={kit.nowrap}>{RW.unpaid.col.bill}</th>
                  <th className={`${kit.num} ${kit.nowrap}`}>{RW.unpaid.col.beforeTax}</th><th className={`${kit.num} ${kit.nowrap}`}>{RW.unpaid.col.tax}</th>
                  <th className={`${kit.num} ${kit.nowrap}`}>{RW.unpaid.col.total}</th><th className={kit.nowrap}>{RW.unpaid.col.plan}</th><th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr><td colSpan={8} className={kit.empty}>{params.show === 'uncollectible' ? RW.unpaid.emptyWrittenOff : RW.unpaid.empty}</td></tr>
                )}
                {data.rows.map((r: UnpaidRow) => {
                  const billId = `${r.key}:bill`;
                  const planId = `${r.key}:plan`;
                  const explainText = open === billId ? RW.explain.noBill : open === planId ? r.chip?.explain ?? null : null;
                  return (
                    <Fragment key={r.key}>
                      <tr className={r.bill ? undefined : styles.rowWarn}>
                        <td data-label={RW.unpaid.col.issued} className={kit.nowrap}>{r.bill ? consoleDate(r.bill.issued) : dash}</td>
                        <td className="table-cards-title">
                          {r.door ? <Link href={r.door.href} className={kit.nameLink}>{r.name}</Link> : r.name}
                          {r.isPortal && <span className={kit.sub}>{RW.coming.portalSub}</span>}
                        </td>
                        <td data-label={RW.unpaid.col.bill} className={kit.nowrap}>
                          {r.bill
                            ? <>{r.bill.words}{r.bill.number ? <span className={kit.muted}> · {r.bill.number}</span> : null}</>
                            : chip(billId, RW.unpaid.noBill, 'warn')}
                        </td>
                        <td data-label={RW.unpaid.col.beforeTax} className={`${kit.num} ${kit.nowrap}`}>{r.bill ? <Money cents={r.bill.beforeTax} currency={r.bill.currency} /> : dash}</td>
                        <td data-label={RW.unpaid.col.tax} className={`${kit.num} ${kit.nowrap}`}>{r.bill ? <Money cents={r.bill.tax} currency={r.bill.currency} /> : dash}</td>
                        <td data-label={RW.unpaid.col.total} className={`${kit.num} ${kit.nowrap}`}>{r.bill ? <Money cents={r.bill.total} currency={r.bill.currency} /> : dash}</td>
                        <td data-label={RW.unpaid.col.plan} className={kit.nowrap}>
                          <span className={styles.notes}>
                            <span>{r.plan}</span>
                            {r.chip && <span>{chip(planId, r.chip.text, r.chip.tone)}</span>}
                          </span>
                        </td>
                        <td className={`${kit.rowDoor} ${styles.doorCell}`}>{r.door ?<Link href={r.door.href} className={kit.door}>{r.door.label}</Link> : null}</td>
                      </tr>
                      {explainText && (
                        <tr id={`explain-${open}`} className={styles.explainRow}><td colSpan={8}>{explainText}</td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className={kit.foot}><span className={kit.countQuiet}>{RW.unpaid.foot}</span></div>
      </div>
    </>
  );
}
