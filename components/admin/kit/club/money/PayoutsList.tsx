'use client';
/**
 * THE PAYOUTS LIST (Club Tier Stage 12d-2 Part 2 — frame 3, words CLUB_TIER_STAGE12D_COPY.md §3; ask 5).
 *
 * The treasurer sees "STRIPE 1,284.50" on the bank statement and needs to know whose money it was. Two homes, one list:
 * the Accounting › Payouts tab (everyone who reads Accounting) and, collapsed, the owner's Payouts card for a club without
 * Accounting. Read only, newest first. One read per screen (owner ruling 1: Stripe live, held a few minutes) — every
 * payout's contents come with it, so Find (an amount, a name, a receipt) and Export cover the chosen dates and opening a
 * payout costs nothing more.
 *   toolbar — the shared date field (default: since the first of last month), Find, Export pinned right.
 *   line    — "Paid out to the bank account ending {last4}", with the Test mode chip in test mode.
 *   list    — Sent · Arrives · Status · Amount; a row opens to Date · Who · What · Receipt · Amount, its total and the note.
 * A payout that didn't arrive is info for everyone but the person who set up payouts (the fix is theirs, words §3.2); for
 * them it is an amber pill that opens Stripe. A manual payout says Stripe lists automatic ones only.
 */
import { Fragment, useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CoachListToolbar } from '@/components/coaches/kit';
import DateRangeDropdown from '@/components/coaches/DateRangeDropdown';
import SearchField from '@/components/shared/SearchField';
import ExportMenu from '@/components/admin/ExportMenu';
import LoadingState from '@/components/shared/LoadingState';
import { LoadFailed, RepChip, repKit, useDeferredLoad, useLatestRead } from '@/components/admin/kit/club/RepKit';
import { day, money } from '@/components/admin/kit/club/money/MoneyKit';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { addCalendarDays, tournamentToday } from '@/lib/timezone';
import { resolveDateRangePreset, type DateRangeSelection } from '@/lib/coach-date-range';
import { buildFilename, downloadCSVBlob, downloadXLSX, generateCSV } from '@/lib/export';
import { PAYOUTS_LIST_WORDS as W, PAYOUTS_WORDS } from '@/lib/online-payment-words';
import { payoutMatches, type PayoutLine } from '@/lib/online-payouts-map';
import type { PayoutRow, PayoutsRead } from '@/lib/online-payouts';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import s from './PayoutsList.module.css';

type Read = PayoutsRead & { answererName: string | null; isAnswerer: boolean };
type Range = { selection: DateRangeSelection; from: string; to: string };

const DATE_LABELS = { season: 'All time' } as const;

/** The default window: since the first of last month (words §3.1 `payouts.dates`, drawn "Since Sep 1" on Oct 27). */
function defaultRange(today: string): Range {
  const [y, m] = today.split('-').map(Number);
  const prev = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
  return { selection: 'custom', from: prev, to: today };
}

export function payoutsUrl(orgSlug: string, from: string, to: string): string {
  return `/api/admin/payouts/list?orgSlug=${encodeURIComponent(orgSlug)}&from=${from}&to=${to}`;
}

export default function PayoutsList({ orgSlug }: { orgSlug: string }) {
  const isPhone = useIsPhone();
  const today = tournamentToday();
  const bounds = useMemo(() => ({ from: '2020-01-01', to: addCalendarDays(today, 1) }), [today]);
  const [range, setRange] = useState<Range>(() => defaultRange(today));
  const [read, setRead] = useState<Read | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [exportFailed, setExportFailed] = useState(false);

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    setFailed(false);
    setRead(null);
    const res = await fetch(payoutsUrl(orgSlug, range.from, range.to), { credentials: 'same-origin' }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (!current()) return;
    if (!data) { setFailed(true); return; }
    setRead(data as Read);
  }, [orgSlug, range.from, range.to, beginRead]);
  useDeferredLoad(!!orgSlug, load);

  const shown = useMemo(() => (read?.payouts ?? []).filter(p => payoutMatches(p, query)), [read, query]);
  const toggle = (id: string) => setOpen(o => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function exportAs(ext: 'xlsx' | 'csv') {
    if (!read) return;
    setExportFailed(false);
    try {
      const rows = exportRows(shown);
      const name = buildFilename({ org: orgSlug, dataset: read.testMode ? 'payouts-test' : 'payouts', scope: `${range.from}-to-${range.to}` }, ext);
      if (ext === 'xlsx') await downloadXLSX(name, [...W.exportCols], rows, 'Payouts');
      else downloadCSVBlob(name, generateCSV([...W.exportCols], rows));
    } catch {
      setExportFailed(true);
    }
  }

  const toolbar = (
    <CoachListToolbar
      actions={<ExportMenu formats={['xlsx', 'csv']} disabled={!read || shown.length === 0}
        onExportXLSX={() => exportAs('xlsx')} onExportCSV={() => exportAs('csv')} />}
      filters={<SearchField value={query} onChange={setQuery} label={W.find} />}
    >
      <DateRangeDropdown
        selection={range.selection}
        from={range.from} to={range.to}
        todayKey={today}
        seasonBounds={bounds}
        labels={DATE_LABELS}
        onChange={next => {
          if (next.selection === 'custom') setRange(next);
          else { const r = resolveDateRangePreset(next.selection, today, bounds); setRange({ selection: next.selection, from: r.from, to: r.to }); }
        }}
      />
    </CoachListToolbar>
  );

  if (failed) return <>{toolbar}<LoadFailed title={W.error} onRetry={() => void load()} /></>;
  if (!read) return <>{toolbar}<LoadingState label={W.loading} /></>;

  return (
    <>
      {toolbar}
      {exportFailed && <p className={`${ck.notice} ${ck.noticeBad}`} role="alert">{W.exportFailed}</p>}
      {(read.last4 || read.testMode) && (
        <p className={s.dest}>
          {read.last4 && <span>{W.dest(read.last4)}</span>}
          {read.testMode && <RepChip tone="info">{PAYOUTS_WORDS.testChip}</RepChip>}
        </p>
      )}
      {read.payouts.length === 0 ? (
        <p className={ck.hint}>{range.selection === 'custom' && range.from === defaultRange(today).from ? W.empty : W.emptyDates}</p>
      ) : shown.length === 0 ? (
        <p className={ck.hint}>{W.emptyFind}</p>
      ) : isPhone ? (
        <ul className={s.phoneList}>
          {shown.map(p => (
            <li key={p.id} className={s.phoneItem}>
              <button type="button" className={s.phoneRow} aria-expanded={open.has(p.id)} onClick={() => toggle(p.id)}>
                <span className={s.phoneAmount}>
                  {W.phoneRow(money(p.amount), p.status === 'on_its_way' ? W.phoneArrives(day(p.arrives)) : p.status === 'failed' ? day(p.sent) : day(p.arrives ?? p.sent))}
                </span>
                <StatusCell p={p} read={read} orgSlug={orgSlug} />
              </button>
              {open.has(p.id) && <Contents p={p} read={read} phone />}
            </li>
          ))}
        </ul>
      ) : (
        <div className={repKit.tableFrame}>
          <table className={repKit.table}>
            <thead>
              <tr>
                <th scope="col">{W.col.sent}</th>
                <th scope="col">{W.col.arrives}</th>
                <th scope="col">{W.col.status}</th>
                <th scope="col" className={repKit.num}>{W.col.amount}</th>
                <th scope="col" className={repKit.go}><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map(p => (
                <Fragment key={p.id}>
                  <tr className={s.row} onClick={() => toggle(p.id)}>
                    <td>{day(p.sent)}</td>
                    <td>{p.status === 'failed' ? '—' : day(p.arrives)}</td>
                    <td><StatusCell p={p} read={read} orgSlug={orgSlug} /></td>
                    <td className={repKit.num}>{money(p.amount)}</td>
                    <td className={repKit.go}>
                      <button type="button" className={s.opener} aria-expanded={open.has(p.id)}
                        aria-label={`${open.has(p.id) ? 'Close' : 'Open'} the payout of ${money(p.amount)}`} onClick={e => { e.stopPropagation(); toggle(p.id); }}>
                        {open.has(p.id) ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
                      </button>
                    </td>
                  </tr>
                  {open.has(p.id) && (
                    <tr className={s.openRow}><td colSpan={5}><Contents p={p} read={read} /></td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** The status: a chip, the quiet count beside Paid, and a payout that didn't arrive (words §3.2). */
function StatusCell({ p, read, orgSlug }: { p: PayoutRow; read: Read; orgSlug: string }) {
  const [opening, setOpening] = useState(false);
  if (p.status === 'on_its_way') return <RepChip tone="info">{W.status.on_its_way}</RepChip>;
  if (p.status === 'paid') {
    return (
      <span className={s.paid}>
        <span>{W.status.paid}</span>
        {p.contents === 'listed' && p.lines.length > 0 && <span className={ck.hint}>{W.counts(p.counts.payments, p.counts.refunds)}</span>}
      </span>
    );
  }
  const reason = p.failReason ? W.fail.reason[p.failReason] ?? '' : '';
  if (!read.isAnswerer) return <span className={s.failInfo} title={W.fail.tip}>{W.fail.info(reason, read.answererName)}</span>;
  async function openStripe(e: React.MouseEvent) {
    e.stopPropagation();
    setOpening(true);
    // org-slug-ok: sent in the body
    const res = await fetch('/api/admin/payouts', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgSlug, action: 'dashboard' }),
    }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (data?.url) window.location.assign(data.url as string);
    else setOpening(false);
  }
  return (
    <button type="button" className={s.failPill} aria-label={W.fail.ownerAria} title={W.fail.tip} onClick={e => void openStripe(e)} disabled={opening}>
      {opening ? PAYOUTS_WORDS.opening : W.fail.owner(reason)}
    </button>
  );
}

/** An opened payout: its lines, the closing total and the note — or why Stripe lists nothing. */
function Contents({ p, read, phone = false }: { p: PayoutRow; read: Read; phone?: boolean }) {
  if (p.contents === 'manual') return <p className={`${ck.hint} ${s.contentsNote}`}>{W.noManual}</p>;
  if (p.contents === 'matching') return <p className={`${ck.hint} ${s.contentsNote}`}>{W.matching}</p>;
  if (p.contents === 'none') return <p className={`${ck.hint} ${s.contentsNote}`}>{W.failedNone}</p>;
  const total = W.total(p.last4 ?? read.last4, day(p.arrives ?? p.sent));
  if (phone) {
    return (
      <div className={s.phoneContents}>
        <ul className={s.phoneLines}>
          {p.lines.map(l => (
            <li key={l.id}><span className={s.dim}>{day(l.at)}</span> {phoneLine(l)}</li>
          ))}
        </ul>
        <p className={s.total}><span>{total}</span><b>{money(p.amount)}</b></p>
        <p className={ck.hint}>{W.note}</p>
      </div>
    );
  }
  return (
    <div className={s.contents}>
      <table className={`${repKit.table} ${s.inner}`}>
        <thead>
          <tr>
            <th scope="col">{W.col.date}</th>
            <th scope="col">{W.col.who}</th>
            <th scope="col">{W.col.what}</th>
            <th scope="col">{W.col.receipt}</th>
            <th scope="col" className={repKit.num}>{W.col.amount}</th>
          </tr>
        </thead>
        <tbody>
          {p.lines.map(l => (
            <tr key={l.id}>
              <td>{day(l.at)}</td>
              <td>{l.who ?? ''}</td>
              <td>{l.what}</td>
              <td>{l.receiptNo ?? ''}</td>
              <td className={repKit.num}>{signed(l.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className={s.totalRow}>
            <td colSpan={4}>{total}</td>
            <td className={repKit.num}>{money(p.amount)}</td>
          </tr>
        </tfoot>
      </table>
      <p className={ck.hint}>{W.note}</p>
    </div>
  );
}

/** "−$150.00": a minus sign, never a hyphen (the drawn rows). */
function signed(n: number): string {
  return n < 0 ? `−${money(-n)}` : money(n);
}

/** Phone (words §3.1): "{who} · {receiptNo} · {amount}"; a line with no receipt names what it is. */
function phoneLine(l: PayoutLine): string {
  const parts = [l.who ?? l.what];
  if (l.kind !== 'payment' && l.who) parts.push(l.what.toLowerCase());
  else if (l.receiptNo != null) parts.push(String(l.receiptNo));
  parts.push(signed(l.amount));
  return parts.join(' · ');
}

/** One row per line, with its payout's dates, status and amount beside it (words §3.1 `payouts.export`). */
export function exportRows(payouts: readonly PayoutRow[]): (string | number | null)[][] {
  const rows: (string | number | null)[][] = [];
  for (const p of payouts) {
    const head = [day(p.sent), p.status === 'failed' ? '' : day(p.arrives), W.status[p.status], p.amount];
    if (!p.lines.length) {
      const why = p.contents === 'manual' ? W.noManual : p.contents === 'matching' ? W.matching : p.contents === 'none' ? W.failedNone : '';
      rows.push([...head, '', '', why, '', null]);
      continue;
    }
    for (const l of p.lines) rows.push([...head, day(l.at), l.who ?? '', l.what, l.receiptNo ?? '', l.amount]);
  }
  return rows;
}
