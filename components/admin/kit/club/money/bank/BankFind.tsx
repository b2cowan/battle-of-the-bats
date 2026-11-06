'use client';
/**
 * "FIND THE $X" — under the check's sums (Bank balance check BC3a; drawing BANK_BALANCE_CHECK_DRAWINGS.html tab 3, plan §4
 * "The hints" and §6 tab 3, asks 2 and 3). Pure drawing over the server's figure for the day and the engine's hints:
 *   · while the check is OFF: "Find the $X", an amber callout naming one possibility (exact · half · 2–3 lines adding up),
 *     then the lines since the last match (or the starting statement) with a search;
 *   · while it matches, or before a balance is typed: the plain hint "Lines since your last match ({date}): n" with its
 *     door "Show them", which opens the same lines (no callout).
 * ⚖ THE HINTS ARE THE ENGINE'S (`hintsFor`, lib/bank-check.ts): over the suspects less the lines already marked and less
 *   those counted on their way, on the TYPED difference, only in the direction that can explain the gap (BC3, said to the
 *   owner 2026-11-06). Nothing here adds or compares money.
 * ⚖ ANY LINE can be marked "Not in the bank yet" (ask 2): the button shows on a hinted row, and on any other row under the
 *   pointer or the keyboard's focus (never hover-only; a touch screen shows it always). A marked line stays in the list,
 *   greyed, with Undo, so a search still finds it.
 * ⚖ EVERY HIGHLIGHT OPENS: a row's chip brings its possibility into the callout.
 * ⚖ Online payments on their way are counted above: one greyed row, no action (drawn).
 * ⚖ "ADD THE MISSING LINE" (BC3b, drawn) sits with the callout's "Or the bank…" sentence: the bank holds money the books
 *   don't (or the reverse). With no possibility to name, that sentence and its door stand alone under the title (not drawn).
 *   It opens the Ledger's own add window (`BankCheckForm`); nothing here writes a line.
 * ⚖ "WAITING AT THE START" (Q2-A; look-back ruled 2026-11-06, BC3b): on an OFF check within six months of the start, the
 *   lines of the 60 days before the starting statement follow under their own heading. Each offers "Waiting at the start"
 *   (it corrects the start: a server write, `onAtStart`), never "Not in the bank yet" (M3). The callout names one only when
 *   it is exactly the gap (`hintsFor`'s `atStart`).
 * Only a writer reaches this (`BankCheckForm`, mounted behind `canMove`).
 */
import { useState, type ReactNode } from 'react';
import SearchField from '@/components/shared/SearchField';
import tb from '@/components/admin/tournament/AdminToolbar.module.css';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { Callout, ClubRow, ClubRowBand, ClubRowList, RepChip, RowAction, repKit } from '../../RepKit';
import { day } from '../MoneyKit';
import { hintsFor, signed, type BankLine, type CheckFigure, type Hint, type WaitingItem } from '@/lib/bank-check';
import { lineMatches, pickerSearch } from '@/lib/bank-club-rules';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { cents, dayYear, howWord, moved, nameOf, type Figure } from './BankShared';
import ck from '../../ClubKit.module.css';
import s from './Bank.module.css';

/** Lines shown at a time: "Show 50 more" at a desk, "Show 10 more" on a phone (drawn; owner 2026-11-06, BC4b). */
const PAGE = 50;
const PAGE_PHONE = 10;

type Line = Figure['suspects']['lines'][number];

/** A line as a Not-in-the-bank-yet item: its own key, date, direction, amount and words (the server re-reads them). */
export const itemOf = (l: BankLine): WaitingItem =>
  ({ key: l.key, date: l.date, direction: l.direction, amountCents: l.amountCents, ...(l.label ? { label: l.label } : {}) });


export default function BankFind({ figure, band, typed, marked, busy, onMark, onUndo, onAtStart, onAddLine }: {
  /** The server's figure for the day (a check's, with its books). */
  figure: Figure;
  /** The engine's band, figured with the marked items. */
  band: CheckFigure;
  /** A balance is typed (before one, nothing is off). */
  typed: boolean;
  marked: ReadonlyMap<string, WaitingItem>;
  /** A write is under way (Waiting at the start): its doors wait. */
  busy: boolean;
  onMark: (item: WaitingItem) => void;
  onUndo: (key: string) => void;
  /** "Waiting at the start" (Q2): correct the starting statement with this line. */
  onAtStart: (line: BankLine) => void;
  /** "Add the missing line": the Ledger's add window, filled with the gap. */
  onAddLine: () => void;
}) {
  const [open, setOpen] = useState(false); // "Show them", while the check isn't off
  const [pick, setPick] = useState<string | null>(null); // the possibility the callout names
  const [query, setQuery] = useState('');
  const [pages, setPages] = useState(1); // pages shown, so a width change keeps its page size
  const [beforePages, setBeforePages] = useState(1); // the look-back's own pages (a phone's)
  const isPhone = useIsPhone();
  const page = isPhone ? PAGE_PHONE : PAGE;

  const suspects = figure.suspects;
  const off = typed && band.result === 'off';
  if (suspects.total === 0 && !off) return null;
  const when = dayYear(suspects.since);

  // Online payments on their way are in the figure already: one greyed row, never a candidate.
  const onWay = figure.onItsWay.state === 'counted' ? figure.onItsWay.lines : [];
  const onWayKeys = new Set(onWay.map(l => l.key));
  const lines = suspects.lines.filter(l => !onWayKeys.has(l.key));
  // Q2's look-back: only while the check is off (the server sends it within six months of the start).
  const before = off && figure.beforeStart ? figure.beforeStart.lines : [];
  const { targetCents, hints } = off
    ? hintsFor(band.differenceCents, lines.filter(l => !marked.has(l.key)), before)
    : { targetCents: 0, hints: [] as Hint[] };
  const current = hints.find(h => h.key === pick) ?? hints[0] ?? null;
  const target = cents(targetCents);

  // Each line's chip: every exact, at-start and half line, and the lines of the combination the callout names.
  const chipOf = new Map<string, Hint>();
  for (const h of current ? [current, ...hints] : hints) {
    if (h.kind === 'combo' && h !== current) continue;
    for (const l of h.lines) if (!chipOf.has(l.key)) chipOf.set(l.key, h);
  }
  const chipWords = (h: Hint) => (h.kind === 'half' ? W.chipHalf : h.kind === 'combo' ? W.chipCombo : W.chipExact)(target);
  const chipFor = (key: string) => {
    const hint = chipOf.get(key);
    return hint ? (
      <button type="button" className={s.chipDoor} aria-label={W.chipOpen(chipWords(hint))} onClick={() => setPick(hint.key)}>
        <RepChip tone="warn">{chipWords(hint)}</RepChip>
      </button>
    ) : null;
  };

  const search = pickerSearch(query);
  const matches = (l: Line) => lineMatches(search, { amountCents: l.amountCents, label: l.label, how: howWord(l.method) });
  const found = lines.filter(matches);
  const shown = found.slice(0, pages * page);
  const more = Math.min(page, found.length - shown.length);
  const foundBefore = before.filter(matches);
  // On a phone the look-back pages by 10 too (its 60 days can run to dozens of cards, and Save is the card's last thing);
  // the desk lists it whole, as it always has.
  const beforeShown = isPhone ? foundBefore.slice(0, beforePages * PAGE_PHONE) : foundBefore;
  const beforeMore = Math.min(PAGE_PHONE, foundBefore.length - beforeShown.length);
  const searchedEmpty = (lines.length > 0 || before.length > 0) && found.length === 0 && foundBefore.length === 0;
  const listOpen = off || open;
  const bankMore = band.direction === 'bank_more';

  const sinceHint = (suspects.sinceMatch ? W.linesSinceMatch : W.linesSinceStart)(when, suspects.total);
  const sinceTitle = (suspects.sinceMatch ? W.findSinceMatch : W.findSinceStart)(when);
  // The phone's group head over the cards: shorter, no year (BC4b `/marketing`).
  const sinceHead = (suspects.sinceMatch ? W.findSinceMatchPhone : W.findSinceStartPhone)(day(suspects.since));
  const searchFor = (q: string) => { setQuery(q); setPages(1); setBeforePages(1); };

  // Each line once (only while the list is open), a table row at a desk and a row card on a phone, with the same action:
  // after the start "Not in the bank yet" (or Undo once marked); before it "Waiting at the start", never "Not in the bank
  // yet" (M3).
  const LineView = isPhone ? LineCard : LineRow;
  const lineRows = listOpen ? shown.map(l => (
    <LineView key={l.key} line={l} chip={chipFor(l.key)}
      action={{ label: W.notInBankYet, aria: W.markLine(nameOf(l)), onClick: () => onMark(itemOf(l)) }}
      undo={marked.has(l.key) ? () => onUndo(l.key) : undefined} />
  )) : null;
  const beforeRows = listOpen && foundBefore.length > 0 ? beforeShown.map(l => (
    <LineView key={l.key} line={l} chip={chipFor(l.key)}
      action={{ label: W.atStart, aria: W.atStartLine(nameOf(l)), onClick: () => onAtStart(l), disabled: busy }} />
  )) : null;
  // The look-back's heading and its why (BC3b), a group head over its cards on a phone, the kit's group row at a desk.
  const lookBackTitle = figure.beforeStart ? W.beforeStartTitle(dayYear(figure.beforeStart.through)) : '';

  // ON A PHONE: the kit's white row cards in one list, never the table (drawing tab 3). A card is not a button: its one
  // action is its own 44px control; the amount at the right carries the line's own sign. Each group ends "Show N more".
  const phoneList = (
    <div className={s.findCards}>
      <ClubRowList label={sinceTitle}>
        {/* The group's head only over cards (a search matching only the look-back leaves no head over nothing). */}
        {(shown.length > 0 || (search.kind === 'none' && onWay.length > 0)) && <ClubRowBand>{sinceHead}</ClubRowBand>}
        {search.kind === 'none' && onWay.length > 0 && <OnTheirWayCard figure={figure} />}
        {lineRows}
        {more > 0 && <MoreRow n={more} onClick={() => setPages(n => n + 1)} />}
        {beforeRows && (
          <>
            <ClubRowBand>{lookBackTitle}</ClubRowBand>
            <li className={s.cardQuiet}>{W.atStartWhy}</li>
            {beforeRows}
            {beforeMore > 0 && <MoreRow n={beforeMore} onClick={() => setBeforePages(n => n + 1)} />}
          </>
        )}
      </ClubRowList>
    </div>
  );
  const deskTable = (
    <div className={repKit.tableFrame}>
      <table className={`${repKit.table} ${s.findTable}`}>
        <thead>
          <tr>
            <th scope="col">{W.findCol.date}</th>
            <th scope="col">{W.findCol.what}</th>
            <th scope="col">{W.findCol.book}</th>
            <th scope="col" className={repKit.num}>{W.findCol.out}</th>
            <th scope="col" className={repKit.num}>{W.findCol.in}</th>
            <th scope="col" className={s.actCell} aria-label={W.findCol.act} />
          </tr>
        </thead>
        <tbody>
          {search.kind === 'none' && onWay.length > 0 && <OnTheirWayRow figure={figure} />}
          {lineRows}
        </tbody>
        {beforeRows && (
          <tbody>
            {/* The kit's group row (as an allocation's window heads its teams), the heading of the look-back. */}
            <tr className={repKit.band}><td colSpan={6}>{lookBackTitle}</td></tr>
            <tr><td colSpan={6} className={repKit.dim}>{W.atStartWhy}</td></tr>
            {beforeRows}
          </tbody>
        )}
      </table>
    </div>
  );

  return (
    <section className={s.find} aria-labelledby={off ? 'bank-find-title' : undefined}>
      {off ? <h3 id="bank-find-title" className={s.findTitle}>{W.findTitle(cents(band.offByCents))}</h3> : (
        <p className={`${ck.hint} ${s.hintLine}`}>
          {sinceHint}{' · '}
          <button type="button" className={s.link} aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? W.hideThem : W.showThem}</button>
        </p>
      )}

      {off && current && (
        <HintCallout hint={current} target={target} bankMore={bankMore} busy={busy}
          onMark={() => onMark(itemOf(current.lines[0]))} onAtStart={() => onAtStart(current.lines[0])} onAddLine={onAddLine}
          next={hints.length > 1 ? {
            count: W.hintCount(hints.indexOf(current) + 1, hints.length),
            go: () => setPick(hints[(hints.indexOf(current) + 1) % hints.length].key),
          } : null} />
      )}
      {/* Nothing to name: the callout drops away (drawn); the bank-side reading and its door stay (not drawn). */}
      {off && !current && (
        <p className={`${ck.hint} ${s.hintLine}`}>
          {(bankMore ? W.hintOrMore : W.hintOrLess)(target, true)}{' '}
          <button type="button" className={s.link} onClick={onAddLine} disabled={busy}>{W.addMissing}</button>
        </p>
      )}

      {listOpen && (
        <>
          {/* The search: at the toolbar's right at a desk; its own full-width row above the cards on a phone (owner, BC4b). */}
          {isPhone ? <SearchField value={query} onChange={searchFor} label={W.findSearch} layout="fill" /> : (
            <div className={s.findBar}>
              <span className={s.findSince}>{sinceTitle}</span>
              <span className={tb.toolbarSpacer} aria-hidden />
              <SearchField value={query} onChange={searchFor} label={W.findSearch} />
            </div>
          )}
          {lines.length === 0 && onWay.length === 0 && before.length === 0
            ? <p className={`${ck.hint} ${s.hintLine}`}>{W.noLinesSince}</p>
            // A search that finds nothing: on a phone the empty group head drops away, "No line matches" says it (/review).
            : isPhone ? (searchedEmpty ? null : phoneList) : deskTable}
          {searchedEmpty && <p className={`${ck.hint} ${s.hintLine}`}>{W.noLinesMatch}</p>}
          {!isPhone && more > 0 && (
            <p className={s.hintLine}>
              <button type="button" className={s.link} onClick={() => setPages(n => n + 1)}>{W.showMore(more)}</button>
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** The callout: one possibility, its sentence, and its answers (drawing tab 3): "Not in the bank yet" on an exact line,
 *  "Waiting at the start" on one before the start, "Add the missing line" with the "Or the bank…" sentence. */
function HintCallout({ hint, target, bankMore, busy, onMark, onAtStart, onAddLine, next }: {
  hint: Hint; target: string; bankMore: boolean; busy: boolean; onMark: () => void; onAtStart: () => void; onAddLine: () => void;
  next: { count: string; go: () => void } | null;
}) {
  const first = hint.lines[0];
  const named = (l: BankLine) => <><b>{nameOf(l)}</b> {W.hintDate(day(l.date))}</>;
  let words: ReactNode;
  if (hint.kind === 'exact') {
    words = <>{named(first)} {(bankMore ? W.hintExactOut : W.hintExactIn)(target)}</>;
  } else if (hint.kind === 'atStart') {
    words = <>{named(first)} {W.hintAtStart(target)}</>;
  } else if (hint.kind === 'half') {
    words = <>{named(first)} {W.hintHalf(cents(first.amountCents), target)}</>;
  } else {
    words = <>
      {W.hintCombo(hint.lines.length, target)}{' '}
      {hint.lines.map((l, i) => (
        <span key={l.key}>{i > 0 && (i === hint.lines.length - 1 ? ` ${W.and} ` : ', ')}{named(l)}</span>
      ))}
      {'. '}{bankMore ? W.hintComboOut : W.hintComboIn}
    </>;
  }
  return (
    <Callout tone="warn" role="status" action={
      <span className={s.calloutActs}>
        {hint.kind === 'exact' && <button type="button" className="btn btn-outline" onClick={onMark}>{W.notInBankYet}</button>}
        {hint.kind === 'atStart' && <button type="button" className="btn btn-outline" onClick={onAtStart} disabled={busy}>{W.atStart}</button>}
        {hint.kind !== 'half' && <button type="button" className="btn btn-outline" onClick={onAddLine} disabled={busy}>{W.addMissing}</button>}
        {next && (
          <span className={s.hintNext}>
            <span className={s.sumQuiet}>{next.count}</span>
            <button type="button" className={s.link} onClick={next.go}>{W.hintNext}</button>
          </span>
        )}
      </span>
    }>
      <span>{words}</span>
      {hint.kind !== 'half' && <span className={s.calloutSub}>{(bankMore ? W.hintOrMore : W.hintOrLess)(target)}</span>}
    </Callout>
  );
}

/** One suspect: Date · What (its quiet detail, its chip) · Book · Money out · Money in · its action (Not in the bank yet,
 *  or Waiting at the start before the start) / Undo. A line marked Not in the bank yet is the one given `undo`. */
function LineRow({ line: l, chip, action, undo }: {
  line: Line; chip: ReactNode;
  action: { label: string; aria: string; onClick: () => void; disabled?: boolean };
  undo?: () => void;
}) {
  const isMarked = undo !== undefined;
  const how = howWord(l.method);
  const name = nameOf(l);
  const rowClass = isMarked ? s.markedRow : chip ? s.hitRow : undefined;
  return (
    <tr className={rowClass}>
      <td className={s.nowrap}>{day(l.date)}</td>
      <td>
        <span className={s.findWhat}>
          <span>{name}{how && <span className={s.findDetail}> · {how}</span>}{isMarked && <span className={s.findDetail}> · {W.markedDetail}</span>}</span>
          {!isMarked && chip}
        </span>
      </td>
      <td>{l.bookName}</td>
      <td className={repKit.num}>{l.direction === 'out' ? cents(l.amountCents) : ''}</td>
      <td className={`${repKit.num} ${s.moneyIn}`}>{l.direction === 'in' ? cents(l.amountCents) : ''}</td>
      <td className={s.actCell}>
        {isMarked
          ? <button type="button" className={s.link} aria-label={W.undoLine(name)} onClick={undo}>{W.undo}</button>
          : <button type="button" className={`${s.markBtn}${chip ? ` ${s.markShown}` : ''}`} aria-label={action.aria}
              onClick={action.onClick} disabled={action.disabled}>{action.label}</button>}
      </td>
    </tr>
  );
}

/** The same line as a phone's row card (drawing tab 3, the kit's `ClubRow`): title what · sub-line date · book · how it
 *  came, with its chip · the amount at the right with the line's own sign (−$75.00 out, +$100.00 in green; the engine's
 *  `signed`, plan §6's phone rule) · its action, its own 44px button (the kit's `RowAction`, under the card on a phone).
 *  The card itself is not a button. A marked line greys and offers Undo. */
function LineCard({ line: l, chip, action, undo }: Parameters<typeof LineRow>[0]) {
  const isMarked = undo !== undefined;
  const name = nameOf(l);
  const sub = [day(l.date), l.bookName, howWord(l.method)].filter(Boolean).join(' · ');
  return (
    <ClubRow
      title={<span className={isMarked ? s.cardDim : undefined}>{name}</span>}
      caption={<span className={s.findWhat}><span>{sub}{isMarked && ` · ${W.markedDetail}`}</span>{!isMarked && chip}</span>}
      trail={<span className={`${s.cardAmt}${isMarked ? ` ${s.cardDim}` : l.direction === 'in' ? ` ${s.moneyIn}` : ''}`}>{moved(signed(l.direction, l.amountCents))}</span>}
      actions={isMarked
        ? <RowAction quiet aria-label={W.undoLine(name)} onClick={undo}>{W.undo}</RowAction>
        : <RowAction aria-label={action.aria} onClick={action.onClick} disabled={action.disabled}>{action.label}</RowAction>} />
  );
}

/** "Show N more", the last quiet row of a phone group (drawn). */
function MoreRow({ n, onClick }: { n: number; onClick: () => void }) {
  return (
    <li className={s.cardMore}>
      <button type="button" className={s.link} onClick={onClick}>{W.showMore(n)}</button>
    </li>
  );
}

/** Online payments on their way, as the row or the card says them: the days they span, their book(s). */
function onWayWords(lines: readonly { date: string; bookName?: string | null; bookId: string }[]) {
  const days = lines.map(l => l.date).sort();
  const span = days[0] === days[days.length - 1] ? day(days[0]) : `${day(days[0])} – ${day(days[days.length - 1])}`;
  const books = new Set(lines.map(l => l.bookName ?? l.bookId));
  return { span, book: books.size === 1 ? [...books][0] : W.booksCount(books.size) };
}

/** Online payments on their way: counted above in one line, so here one greyed row with no action (drawn). */
function OnTheirWayRow({ figure }: { figure: Figure }) {
  const oiw = figure.onItsWay;
  if (oiw.state !== 'counted') return null;
  const { span, book } = onWayWords(oiw.lines);
  const amount = cents(Math.abs(oiw.cents));
  return (
    <tr className={s.clearedRow}>
      <td className={s.nowrap}>{span}</td>
      <td>{W.onTheirWayRow(oiw.lines.length)}<span className={s.findDetail}> · {W.onTheirWayDetail}</span></td>
      <td>{book}</td>
      <td className={repKit.num}>{oiw.cents < 0 ? amount : ''}</td>
      <td className={repKit.num}>{oiw.cents >= 0 ? amount : ''}</td>
      <td className={s.actCell} />
    </tr>
  );
}

/** The same on a phone: one greyed card, no action, its amount signed as the figure has it (out is below zero). */
function OnTheirWayCard({ figure }: { figure: Figure }) {
  const oiw = figure.onItsWay;
  if (oiw.state !== 'counted') return null;
  const { span, book } = onWayWords(oiw.lines);
  return (
    // Greyed in its title and amount, as its table row is; never the kit's `muted` opacity, which took its caption (real
    // information) under the contrast floor (/review BC4b).
    <ClubRow title={<span className={s.cardDim}>{W.onTheirWayRow(oiw.lines.length)}</span>}
      caption={`${span} · ${book} · ${W.onTheirWayDetail}`}
      trail={<span className={`${s.cardAmt} ${s.cardDim}`}>{moved(oiw.cents)}</span>} />
  );
}
