'use client';
/**
 * ONE STATEMENT (Bank reconciliation R2c; drawings C2, C3, C5's "Look again"). The server's evaluation of it (rule 6:
 * every figure the engine's, recomputed on every answer); the screen sends intent only — tick this key, keep this one
 * out — and draws the answer it gets back.
 *
 *   top      — "{account} · checking" over "Statement ending {date}" and Edit (an open statement's figures, while every
 *              later one is open too); Finish later and the one lime, Mark this statement checked, live at $0.00 only.
 *   band     — the joined band: Statement · Ticked · Difference. The Difference is shown, never edited: no colour while
 *              ticking can still help, amber once it can't (C3), green at $0.00.
 *   callout  — C3's three helpers once ticking can no longer help: Add a bank fee or interest · Find by amount ·
 *              Finish later. The direction in words, never a minus sign.
 *   strip    — Find (the Payouts tab's search, pointed at the tick list), Show, and the two quiet counts: Kept out of
 *              the bank, Left out automatically, each opening its shelf under the list.
 *   the list — ONE list in date order (Ask 4), Money out and Money in like the Ledger, the starting balance first. The
 *              whole row is the tick. A Stripe payout is one row (B2) that opens to its lines (no checkbox of their own:
 *              the payout's tick covers them) and a gap named by its reason (Ask 7, P4).
 * ⚖ A reader (Accounting without moving club money, B7) and a checked statement read the same list WITHOUT checkboxes
 *   and with no write control at all — absent, not disabled.
 * Autosave: a tick is saved as it is made. Writes go one at a time, so each answer already holds every earlier tick.
 */
import { Fragment, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, ChevronDown, ChevronRight } from 'lucide-react';
import MoneySummaryBand, { type MoneyTile } from '@/components/coaches/MoneySummaryBand';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import SearchField from '@/components/shared/SearchField';
import { CoachListToolbar } from '@/components/coaches/kit';
import ck from '../../ClubKit.module.css';
import { Callout, RepChip, repKit } from '../../RepKit';
import { day } from '../MoneyKit';
import { BANK_REFUSAL } from '@/lib/bank-check-words';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import {
  bankUrl, bankWrite, cents, centsField, dayYear, isStuck, parseCents, rowWhat, stamp, type AccountView, type BankAnswer, type Shown,
  type Summary, type TickRow,
} from './BankShared';
import s from './Bank.module.css';

type Show = 'all' | 'unticked' | 'ticked';
type Line = Extract<TickRow, { kind: 'line' }>;
type Payout = Extract<TickRow, { kind: 'payout' }>;

export default function BankCheck({ orgSlug, view, shown, summary, canMove, onAnswer, onRefused, onFinishLater, onEdit, onFee, onMarked }: {
  orgSlug: string;
  view: AccountView;
  shown: Shown;
  summary: Summary;
  canMove: boolean;
  /** The account read again after a write (the server's numbers). */
  onAnswer: (view: AccountView) => void;
  /** A refused write: its words; the tab re-reads the account. */
  onRefused: (text: string) => void;
  onFinishLater: () => void;
  onEdit: () => void;
  onFee: () => void;
  /** Marked checked (or checked again): the account read again. */
  onMarked: (view: AccountView, again: boolean) => void;
}) {
  const open = shown.status === 'open';
  const writes = canMove && open;
  const changed = !open && shown.changedSince.length > 0;
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<Show>('all');
  const [openPayouts, setOpenPayouts] = useState<Set<string>>(() => new Set());
  const [shelf, setShelf] = useState<'kept' | 'auto' | null>(null);
  const [pending, setPending] = useState<Map<string, boolean>>(() => new Map());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const findRef = useRef<HTMLDivElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const accountPath = `/accounts/${view.account.id}/checks/${shown.checkId}`;

  /** One write at a time, in the order they were made; each answer replaces the view. */
  function enqueue(run: () => Promise<BankAnswer>, done?: () => void, answered?: (view: AccountView) => void) {
    queue.current = queue.current.then(async () => {
      const r = await run();
      if (r.ok) (answered ?? onAnswer)(r.view); else onRefused(r.error);
      done?.();
    });
  }

  function tick(key: string, ticked: boolean) {
    if (!writes || pending.has(key)) return;
    if (marking) return; // a tick queued behind Mark would be refused on a checked statement and bury "marked" in a red notice
    setPending(p => new Map(p).set(key, ticked));
    enqueue(
      () => bankWrite(bankUrl(orgSlug, `${accountPath}/ticks`), 'POST', { key, ticked }, W.tickFailed),
      () => setPending(p => { const n = new Map(p); n.delete(key); return n; }),
    );
  }

  function keepOut(key: string, keptOut: boolean) {
    if (!writes || busyKey) return;
    setBusyKey(key);
    enqueue(
      () => bankWrite(bankUrl(orgSlug, `${accountPath}/kept-out`), 'POST', { key, keptOut }, W.keepOutFailed),
      () => setBusyKey(null),
    );
  }

  function addProcessing(payoutKey: string) {
    if (!writes || busyKey) return;
    setBusyKey(payoutKey);
    enqueue(
      () => bankWrite(bankUrl(orgSlug, `${accountPath}/lines`), 'POST', { kind: 'payment_processing', payoutKey }, W.processingFailed),
      () => setBusyKey(null),
    );
  }

  function mark(again: boolean) {
    if (!canMove || marking) return;
    setMarking(true);
    enqueue(
      () => bankWrite(bankUrl(orgSlug, `${accountPath}/mark`), 'POST', again ? { again: true } : {}, W.markFailed),
      () => setMarking(false),
      v => onMarked(v, again),
    );
  }

  const tickedKeys = useMemo(() => new Set(shown.ticked.map(r => r.key)), [shown.ticked]);
  const isTicked = (key: string) => pending.get(key) ?? tickedKeys.has(key);
  const rows = useMemo(() => [...shown.ticked, ...shown.outstanding]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.key < b.key ? -1 : 1)), [shown.ticked, shown.outstanding]);
  const matches = useMemo(() => matcher(query), [query]);
  const listed = rows.filter(r => {
    const t = isTicked(r.key);
    if (show === 'ticked' && !t) return false;
    if (show === 'unticked' && t) return false;
    return matches(r);
  });
  const total = shown.ticked.length + shown.outstanding.length;
  const stuck = open && isStuck(shown);
  const d = shown.differenceCents;
  const isFirstCheck = view.checks.at(-1)?.id === shown.checkId;
  const bookOf = (key: string) => shown.books[key] ?? '';

  // ── the band ──
  const sides = (inC: number, outC: number) => [inC ? W.inSide(cents(inC)) : '', outC ? W.outSide(cents(outC)) : ''].filter(Boolean).join(' · ');
  const tiles: MoneyTile[] = [
    { key: 'statement', label: W.band.statement, figure: cents(shown.statementEndingBalanceCents), caption: W.band.statementCap(dayYear(shown.statementEndDate)) },
    changed
      ? { key: 'ticked', label: W.band.tickedNow, figure: cents(shown.tickedBalanceCents), caption: W.band.tickedWhenChecked(cents(shown.statementEndingBalanceCents)) }
      : { key: 'ticked', label: W.band.ticked, figure: cents(shown.tickedBalanceCents), caption: W.band.tickedCap(cents(shown.startingBalanceCents), shown.ticked.length, total) },
    {
      key: 'difference', label: W.band.difference, figure: cents(Math.abs(d)),
      tone: d === 0 ? 'good' : stuck || changed ? 'warn' : 'plain',
      caption: d === 0
        ? open
          ? shown.outstanding.length
            ? W.band.readyOutstanding(shown.outstanding.length, sides(shown.outstandingInCents, shown.outstandingOutCents))
            : W.band.ready
          : W.band.balanced
        : d < 0 ? W.band.over(cents(-d)) : W.band.under(cents(d)),
    },
  ];

  function findByAmount() {
    setShow('all');
    setQuery(centsField(Math.abs(d)));
    window.setTimeout(() => findRef.current?.querySelector('input')?.focus(), 0);
  }

  const keptLine = shown.keptOut.length
    ? W.keptOutLine(shown.keptOut.length, sides(shown.keptOutInCents, shown.keptOutOutCents)) : null;

  return (
    <>
      <div className={s.top}>
        <div className={s.topLeft}>
          <span className={s.topEyebrow}>{open ? W.checking(view.account.name) : W.reading(view.account.name)}</span>
          <span className={s.topTitle}>
            {W.statementEnding(dayYear(shown.statementEndDate))}
            {canMove && summary.can.refigure && (
              <button type="button" className={s.link} onClick={onEdit} aria-label={W.editAria}>{W.edit}</button>
            )}
          </span>
        </div>
        <div className={s.topRight}>
          {!writes && <button type="button" className="btn btn-outline" onClick={onFinishLater}>{W.backToList}</button>}
          {writes && stuck && <span className={s.topHint}>{W.mustBeZero}</span>}
          {writes && !stuck && <button type="button" className="btn btn-outline" onClick={onFinishLater}>{W.finishLater}</button>}
          {writes && (
            <button type="button" className="btn btn-lime" onClick={() => mark(false)} disabled={!summary.can.markChecked || marking || pending.size > 0 || !!busyKey}>
              {marking ? W.marking : W.markChecked}
            </button>
          )}
        </div>
      </div>

      <MoneySummaryBand tiles={tiles} ariaLabel={W.band.aria} />

      {view.payoutsUnavailable && (
        <Callout tone="warn" role="status" icon={<AlertTriangle size={16} aria-hidden />}>{W.payoutsUnavailable}</Callout>
      )}

      {writes && stuck && (
        <Callout tone="warn" role="status" icon={<AlertTriangle size={16} aria-hidden />}
          action={
            <>
              <button type="button" className="btn btn-outline" onClick={onFee}>{W.addFee}</button>
              <button type="button" className="btn btn-outline" onClick={findByAmount}>{W.findByAmount}</button>
              <button type="button" className="btn btn-ghost" onClick={onFinishLater}>{W.finishLater}</button>
            </>
          }>
          <b>{d < 0 ? W.stuckLess(cents(-d)) : W.stuckMore(cents(d))}</b>
          <span className={repKit.calloutSub}>{W.stuckWhy}</span>
        </Callout>
      )}

      {changed && <LookAgain orgSlug={orgSlug} shown={shown} />}

      <CoachListToolbar
        className={s.strip}
        filters={
        <span className={s.stripNotes}>
          {keptLine && (
            <>
              <span>{keptLine}</span>
              <button type="button" className={s.link} onClick={() => setShelf(shelf === 'kept' ? null : 'kept')}>{shelf === 'kept' ? W.hide : W.show}</button>
            </>
          )}
          {keptLine && shown.autoExcluded.length > 0 && <span className={s.dot} aria-hidden>·</span>}
          {shown.autoExcluded.length > 0 && (
            <>
              <span>{W.autoOut(shown.autoExcluded.length)}</span>
              <button type="button" className={s.link} onClick={() => setShelf(shelf === 'auto' ? null : 'auto')}>{shelf === 'auto' ? W.hide : W.show}</button>
            </>
          )}
        </span>
        }
      >
        <div ref={findRef}>
          <SearchField value={query} onChange={setQuery} label={W.find} />
        </div>
        <SingleSelectDropdown label={W.show} value={show} onChange={v => setShow(v as Show)}
          options={[{ id: 'all', label: W.showAll }, { id: 'unticked', label: W.showUnticked }, { id: 'ticked', label: W.showTicked }]} />
      </CoachListToolbar>

      <div className={repKit.tableFrame}>
        <table className={repKit.table}>
          <thead>
            <tr>
              <th scope="col" className={s.tick}>
                {writes && listed.length > 0 ? (
                  <TickAll rows={listed} isTicked={isTicked} onTick={tick} />
                ) : <span className="sr-only">{W.col.ticked}</span>}
              </th>
              <th scope="col">{W.col.date}</th>
              <th scope="col">{W.col.what}</th>
              <th scope="col">{W.col.book}</th>
              <th scope="col" className={repKit.num}>{W.col.out}</th>
              <th scope="col" className={repKit.num}>{W.col.in}</th>
              <th scope="col" className={s.actionCell}><span className="sr-only">{W.listActions}</span></th>
            </tr>
          </thead>
          <tbody>
            {!query && show === 'all' && (
              <tr className={s.balanceRow}>
                <td className={s.tick} />
                <td colSpan={3}>
                  {W.startingRow(dayYear(shown.startDate))}{' '}
                  <span className={s.why}>({isFirstCheck ? W.startingRowFirst : W.startingRowWhy})</span>
                </td>
                <td className={repKit.num}>{shown.startingBalanceCents < 0 ? cents(-shown.startingBalanceCents) : ''}</td>
                <td className={repKit.num}>{shown.startingBalanceCents >= 0 ? cents(shown.startingBalanceCents) : ''}</td>
                <td />
              </tr>
            )}
            {listed.length === 0 && (
              <tr><td colSpan={7} className={s.empty}>{rows.length ? W.noMatch : W.noLines}</td></tr>
            )}
            {listed.map(r => r.kind === 'payout' ? (
              <PayoutRows key={r.key} row={r} shown={shown} ticked={isTicked(r.key)} writes={writes} busy={pending.has(r.key) || busyKey === r.key}
                opened={openPayouts.has(r.key)} bookOf={bookOf}
                onToggle={() => setOpenPayouts(o => { const n = new Set(o); if (n.has(r.key)) n.delete(r.key); else n.add(r.key); return n; })}
                onTick={t => tick(r.key, t)} onProcessing={() => addProcessing(r.key)} />
            ) : (
              <LineRow key={r.key} row={r} book={bookOf(r.key)} ticked={isTicked(r.key)} writes={writes}
                busy={pending.has(r.key) || busyKey === r.key} onTick={t => tick(r.key, t)} onKeepOut={() => keepOut(r.key, true)} />
            ))}
          </tbody>
        </table>
      </div>
      <p className={`${ck.hint} ${s.listHint}`}>
        {open ? W.savesAsYouGo(dayYear(shown.statementEndDate)) : shown.waitingCount ? W.waiting(shown.waitingCount, dayYear(shown.statementEndDate)) : null}
      </p>

      {shelf === 'kept' && shown.keptOut.length > 0 && (
        <section className={s.shelf} aria-label={W.keptOutTitle(shown.keptOut.length)}>
          <div className={s.shelfHead}>
            <span>{W.keptOutTitle(shown.keptOut.length)}</span>
            <button type="button" className={s.link} onClick={() => setShelf(null)}>{W.hide}</button>
          </div>
          <ul className={s.shelfList}>
            {shown.keptOut.map(r => (
              <li key={r.key} className={s.shelfRow}>
                <span>{day(r.date)}</span>
                <span className={s.whatName}>{rowWhat(r)}{bookOf(r.key) && <span className={s.whatDim}> · {bookOf(r.key)}</span>}</span>
                <span className={`${s.shelfAmount}${r.direction === 'in' ? ` ${s.moneyIn}` : ''}`}>{r.direction === 'out' ? W.outSide(cents(r.amountCents)) : W.inSide(cents(r.amountCents))}</span>
                <span>
                  {writes && (
                    <button type="button" className={s.link} onClick={() => keepOut(r.key, false)} disabled={busyKey === r.key}
                      aria-label={W.putBackAria(rowWhat(r))}>{W.putBack}</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {shelf === 'auto' && shown.autoExcluded.length > 0 && (
        <section className={s.shelf} aria-label={W.autoOutTitle(shown.autoExcluded.length)}>
          <div className={s.shelfHead}>
            <span>{W.autoOutTitle(shown.autoExcluded.length)}</span>
            <button type="button" className={s.link} onClick={() => setShelf(null)}>{W.hide}</button>
          </div>
          <ul className={s.shelfList}>
            {shown.autoExcluded.map(({ row: r, reason }) => (
              <li key={r.key} className={s.shelfRow}>
                <span>{day(r.date)}</span>
                <span className={s.whatName}>{rowWhat(r)}<span className={s.whatDim}> · {W.autoReason[reason]}</span></span>
                <span className={s.shelfAmount}>{r.direction === 'out' ? W.outSide(cents(r.amountCents)) : W.inSide(cents(r.amountCents))}</span>
                <span />
              </li>
            ))}
          </ul>
        </section>
      )}

      {changed && canMove && (
        <div className={s.againFoot}>
          <button type="button" className="btn btn-ghost" onClick={onFinishLater}>{W.close}</button>
          <button type="button" className="btn btn-lime" onClick={() => mark(true)} disabled={!summary.can.markCheckedAgain || marking}>
            {marking ? W.marking : W.markAgain}
          </button>
        </div>
      )}
    </>
  );
}

/** Find: an amount ("12.40", "$1,284.50") matches a row's or a payout line's amount; words match its name or book. */
function matcher(query: string): (r: TickRow) => boolean {
  const q = query.trim().toLowerCase();
  if (!q) return () => true;
  const amount = /^\$?[\d,]+(\.\d{0,2})?$/.test(q) ? parseCents(q, { positive: true }) : null;
  const hit = (label: string | undefined, c: number) => (amount !== null && c === amount) || (!!label && label.toLowerCase().includes(q));
  return r => hit(r.label, r.amountCents) || (r.kind === 'payout' && (hit(W.payout, r.amountCents) || r.members.some(m => hit(m.label, m.amountCents))));
}

/** The header checkbox: ticks (or unticks) every row shown, one write at a time. */
function TickAll({ rows, isTicked, onTick }: { rows: TickRow[]; isTicked: (key: string) => boolean; onTick: (key: string, t: boolean) => void }) {
  const ticked = rows.filter(r => isTicked(r.key)).length;
  const all = ticked === rows.length && rows.length > 0;
  return (
    <input type="checkbox" aria-label={W.tickAll} checked={all}
      ref={el => { if (el) el.indeterminate = ticked > 0 && !all; }}
      onChange={() => { for (const r of rows) if (isTicked(r.key) === all) onTick(r.key, !all); }} />
  );
}

/** A line's tick cell: a checkbox while it can be ticked; a quiet mark on a statement read only. */
function TickCell({ ticked, writes, busy, label, onTick }: { ticked: boolean; writes: boolean; busy: boolean; label: string; onTick: (t: boolean) => void }) {
  if (!writes) return <td className={s.tick}>{ticked && <Check size={16} aria-label={W.tickedMark} className={s.tickedMark} />}</td>;
  return (
    <td className={s.tick}>
      <input type="checkbox" checked={ticked} disabled={busy} aria-label={label}
        onClick={e => e.stopPropagation()} onChange={() => onTick(!ticked)} />
    </td>
  );
}

function LineRow({ row, book, ticked, writes, busy, onTick, onKeepOut }: {
  row: Line; book: string; ticked: boolean; writes: boolean; busy: boolean; onTick: (t: boolean) => void; onKeepOut: () => void;
}) {
  const what = rowWhat(row);
  return (
    <tr className={`${writes ? s.rowTicks : ''}${ticked ? ` ${s.rowTicked}` : ''}`} onClick={writes && !busy ? () => onTick(!ticked) : undefined}>
      <TickCell ticked={ticked} writes={writes} busy={busy} label={W.tickAria(what, cents(row.amountCents))} onTick={onTick} />
      <td className={s.dateCell}>{day(row.date)}</td>
      <td className={s.whatName}>
        {what}
        {row.voidedSinceTick && <> <RepChip tone="warn">{W.voidedSinceTick}</RepChip></>}
      </td>
      <td>{book}</td>
      <td className={repKit.num}>{row.direction === 'out' ? cents(row.amountCents) : ''}</td>
      <td className={`${repKit.num} ${s.moneyIn}`}>{row.direction === 'in' ? cents(row.amountCents) : ''}</td>
      <td className={s.actionCell}>
        {/* Ask 6: "Didn't go through the bank" on an unticked line, shown under the pointer or with focus. */}
        {writes && !ticked && (
          <button type="button" className={`${s.link} ${s.rowAction}`} disabled={busy} aria-label={W.didntGoAria(what)}
            onClick={e => { e.stopPropagation(); onKeepOut(); }}>
            {W.didntGo}
          </button>
        )}
      </td>
    </tr>
  );
}

/** A Stripe payout: one row with one tick (B2), opening to its lines and its gap, named by reason (Ask 7, P4). */
function PayoutRows({ row, shown, ticked, writes, busy, opened, bookOf, onToggle, onTick, onProcessing }: {
  row: Payout; shown: Shown; ticked: boolean; writes: boolean; busy: boolean; opened: boolean;
  bookOf: (key: string) => string; onToggle: () => void; onTick: (t: boolean) => void; onProcessing: () => void;
}) {
  const books = [...new Set(row.members.map(m => bookOf(m.key)).filter(Boolean))];
  const members = [...row.members].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const gap = shown.payoutGaps[row.key];
  const amount = cents(row.amountCents);
  return (
    <>
      <tr className={`${writes ? s.rowTicks : ''}${ticked ? ` ${s.rowTicked}` : ''}`} onClick={writes && !busy ? () => onTick(!ticked) : undefined}>
        <TickCell ticked={ticked} writes={writes} busy={busy} label={W.tickAria(W.payout, amount)} onTick={onTick} />
        <td className={s.dateCell}>{day(row.date)}</td>
        <td>
          <button type="button" className={s.opener} aria-expanded={opened} aria-label={opened ? W.payoutClose(amount) : W.payoutOpen(amount)}
            onClick={e => { e.stopPropagation(); onToggle(); }}>
            <b className={s.whatName}>{W.payout}</b>
            <span className={s.whatDim}> · {W.payoutInside(row.members.length, day(row.date))}</span>
            <span className={s.chev} aria-hidden>{opened ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
          </button>
        </td>
        <td>{books.length === 1 ? books[0] : books.length > 1 ? W.payoutBooks(books.length) : ''}</td>
        <td className={repKit.num}>{row.direction === 'out' ? amount : ''}</td>
        <td className={`${repKit.num} ${s.moneyIn}`}>{row.direction === 'in' ? amount : ''}</td>
        <td className={s.actionCell} />
      </tr>
      {opened && (
        <>
          {members.map(m => (
            <tr key={m.key} className={s.subRow}>
              <td />
              <td className={s.dateCell}>{day(m.date)}</td>
              <td className={s.subWhat}>{rowWhat(m)}</td>
              <td>{bookOf(m.key)}</td>
              <td className={repKit.num}>{m.direction === 'out' ? cents(m.amountCents) : ''}</td>
              <td className={repKit.num}>{m.direction === 'in' ? cents(m.amountCents) : ''}</td>
              <td />
            </tr>
          ))}
          <tr className={s.subTotal}>
            <td />
            <td colSpan={3}>
              {row.gapCents === 0
                ? <>{W.payoutAddsUp(members.length, amount)}<Check size={14} aria-hidden className={s.okMark} /></>
                : W.payoutTotal(members.length, cents(Math.abs(row.bookCents)))}
            </td>
            <td className={repKit.num}>{row.gapCents === 0 && row.direction === 'out' ? amount : row.gapCents !== 0 && row.bookCents < 0 ? cents(-row.bookCents) : ''}</td>
            <td className={repKit.num}>{row.gapCents === 0 && row.direction === 'in' ? amount : row.gapCents !== 0 && row.bookCents >= 0 ? cents(row.bookCents) : ''}</td>
            <td />
          </tr>
          {row.gapCents !== 0 && (
            <tr className={s.gapRow}>
              <td />
              <td colSpan={3}>
                <div className={s.gapReasons}>
                  <span>{row.gapCents < 0 ? W.gapLess(cents(-row.gapCents)) : W.gapMore(cents(row.gapCents))}</span>
                  {gap && <GapReasons gap={gap} />}
                  {gap?.offerPaymentProcessing && writes ? (
                    <span>
                      <button type="button" className={`${s.link} ${s.linkWarn}`} disabled={busy} onClick={onProcessing}>
                        {busy ? W.addingProcessing : W.addProcessing(cents(gap.processingCents))}
                      </button>
                    </span>
                  ) : gap?.withheld && gap.withheld !== 'no_processing_gap' ? (
                    <span className={s.gapReason}>{BANK_REFUSAL[gap.withheld]}</span>
                  ) : null}
                </div>
              </td>
              <td className={repKit.num}>{row.gapCents < 0 ? cents(-row.gapCents) : ''}</td>
              <td className={repKit.num}>{row.gapCents > 0 ? cents(row.gapCents) : ''}</td>
              <td />
            </tr>
          )}
        </>
      )}
    </>
  );
}

/** The gap's reasons, each only when it is there (P4: a held dispute is never "payment processing"). */
function GapReasons({ gap }: { gap: Shown['payoutGaps'][string] }) {
  const parts: string[] = [];
  if (gap.disputeHeldCents) parts.push(W.disputeHeld(cents(Math.abs(gap.disputeHeldCents))));
  if (gap.disputeReturnedCents) parts.push(W.disputeReturned(cents(Math.abs(gap.disputeReturnedCents))));
  if (gap.notOursCents) parts.push(W.notOurs(cents(Math.abs(gap.notOursCents))));
  if (gap.stripeFeeCents) parts.push(W.stripeFee(cents(Math.abs(gap.stripeFeeCents))));
  if (!parts.length) return null;
  return (
    <>
      {parts.map(p => <span key={p} className={s.gapReason}>{p}</span>)}
      {gap.disputeHeldCents !== 0 && <span className={s.gapReason}>{W.disputeHeldWhy}</span>}
    </>
  );
}

/** C5 · Look again: each line that changed since the statement was checked, as checked and as now (Ask 11). */
function LookAgain({ orgSlug, shown }: { orgSlug: string; shown: Shown }) {
  const ledger = `/${orgSlug}/admin/accounting/ledger`;
  return (
    <Callout tone="warn" role="status" icon={<AlertTriangle size={16} aria-hidden />}
      action={<Link className="btn btn-outline" href={ledger}>{W.openLedger}</Link>}>
      {shown.changedSince.map(c => {
        const what = rowWhat(c.was);
        return (
          <Fragment key={c.key}>
            <b>
              {!c.now ? W.changedVoided(what, cents(c.was.amountCents))
                : c.now.amountCents !== c.was.amountCents || c.now.direction !== c.was.direction
                  ? W.changedWent(what, cents(c.was.amountCents), cents(c.now.amountCents))
                  : c.now.date !== c.was.date
                    ? W.changedWentDate(what, dayYear(c.was.date), dayYear(c.now.date))
                    : W.changedEdited(what)}
            </b>
            <span className={repKit.calloutSub}>
              {W.changedWhy(cents(c.was.amountCents))}
              {c.changedAt && ` ${W.changedBy(c.changedBy, stamp(c.changedAt))}.`}
            </span>
          </Fragment>
        );
      })}
    </Callout>
  );
}
