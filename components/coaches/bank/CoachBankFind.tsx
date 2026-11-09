'use client';
/**
 * "FIND THE $X" — under the coach's check sums (Bank balance check BC7a; drawing BANK_BALANCE_CHECK_DRAWINGS.html tab 3, plan
 * §4 "The hints", asks 2 and 3, Q1-A). Pure drawing over the server's figure for the day and the engine's hints:
 *   · while the check is OFF: "Find the $X", an amber callout naming one possibility (exact · half · 2–3 lines adding up),
 *     then this season's lines since the last match (every line of the season when none) with a search;
 *   · while it matches, or before a balance is typed: the plain hint "Lines since … : n" with its door "Show them".
 * ⚖ Q1-A, A CHEQUE ACROSS THE ROLLOVER: last season's lines after its last match (its final 60 days when none) follow
 *   under the divider "From the {2025 Season}" — the season's NAME, so the coach can tell which season they read. They are
 *   ordinary candidates (the sign is the check's own, BC6a), markable Not in the bank yet; nothing of last season opens.
 * ⚖ THE HINTS ARE THE ENGINE'S (`coachHints` → `hintsFor`): over both lists less the marked lines, on the TYPED
 *   difference. Nothing here adds or compares money.
 * ⚖ ANY LINE can be marked "Not in the bank yet" (ask 2): shown on a hinted row, and on any other under the pointer or the
 *   keyboard's focus (never hover-only). A marked line stays, greyed, with Undo.
 * ⚖ EVERY HIGHLIGHT OPENS: a row's chip brings its possibility into the callout.
 * ⚖ "RECORD THE MISSING AMOUNT" (renamed from "Add the missing line", WD2) sits with the callout's "Or the bank…" sentence
 *   (and alone when nothing can be named); it opens the Ledger's own Record money window. Nothing here writes a line. A team has no starting statement: no "Waiting at the start".
 */
import { useState, type ReactNode } from 'react';
import SearchField from '@/components/shared/SearchField';
import { CoachChip } from '@/components/coaches/kit';
import { CoachRow, CoachRowBand, CoachRowList, CoachRowListFoot } from '@/components/coaches/CoachRowList';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { signed, type BankLine, type CheckFigure, type Hint, type WaitingItem } from '@/lib/bank-check';
import { itemOfLine } from '@/lib/bank-check-draft';
import { coachHints } from '@/lib/bank-coach-map';
import { lineMatches, pickerSearch } from '@/lib/bank-club-rules';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { cents, dayShort, dayYear, moved, nameOf } from '@/lib/bank-screen';
import type { TeamFigure } from './coachBank';
import b from './CoachBank.module.css';

/** Lines shown at a time ("Show N more"): 50 at a desk, 10 on a phone (BC7b, the club's BC4b recipe: Save is the card's
 *  last thing, so the list mustn't push it a screenful away). */
const PAGE = 50;
const PAGE_PHONE = 10;

export default function CoachBankFind({ figure, band, typed, marked, onMark, onUndo, onAddLine }: {
  figure: TeamFigure;
  /** The engine's band, figured with the marked items and the cash. */
  band: CheckFigure;
  typed: boolean;
  marked: ReadonlyMap<string, WaitingItem>;
  onMark: (item: WaitingItem) => void;
  onUndo: (key: string) => void;
  /** "Record the missing amount" (money write). */
  onAddLine?: () => void;
}) {
  const [open, setOpen] = useState(false); // "Show them", while the check isn't off
  const [pick, setPick] = useState<string | null>(null); // the possibility the callout names
  const [query, setQuery] = useState('');
  const [pages, setPages] = useState(1);
  const [lastPages, setLastPages] = useState(1);
  const isPhone = useIsPhone();
  const page = isPhone ? PAGE_PHONE : PAGE; // pages are counted, not lines, so a width change keeps its place

  const suspects = figure.suspects;
  const last = figure.lastSeason;
  const off = typed && band.result === 'off';
  const lastCount = last?.lines.length ?? 0;
  if (suspects.total === 0 && lastCount === 0 && !off) return null;

  const markedKeys = new Set(marked.keys());
  const { targetCents, hints } = off
    ? coachHints(band.differenceCents, { since: suspects.since, sinceMatch: suspects.sinceMatch, lines: suspects.lines, lastSeason: last }, markedKeys)
    : { targetCents: 0, hints: [] as Hint[] };
  const current = hints.find(h => h.key === pick) ?? hints[0] ?? null;
  const target = cents(targetCents);
  const bankMore = band.direction === 'bank_more';

  // Each line's chip: every exact and half line, and the lines of the combination the callout names.
  const chipOf = new Map<string, Hint>();
  for (const h of current ? [current, ...hints] : hints) {
    if (h.kind === 'combo' && h !== current) continue;
    for (const l of h.lines) if (!chipOf.has(l.key)) chipOf.set(l.key, h);
  }
  const chipWords = (h: Hint) => (h.kind === 'half' ? W.chipHalf : h.kind === 'combo' ? W.chipCombo : W.chipExact)(target);
  const chipFor = (key: string) => {
    const hint = chipOf.get(key);
    return hint ? (
      <button type="button" className={b.chipDoor} aria-label={W.chipOpen(chipWords(hint))} onClick={() => setPick(hint.key)}>
        <CoachChip tone="warn">{chipWords(hint)}</CoachChip>
      </button>
    ) : null;
  };

  const search = pickerSearch(query);
  const matches = (l: BankLine) => lineMatches(search, { amountCents: l.amountCents, label: l.label });
  const found = suspects.lines.filter(matches);
  const shown = found.slice(0, pages * page);
  const more = Math.min(page, found.length - shown.length);
  const foundLast = (last?.lines ?? []).filter(matches);
  // Last season's lines page too, once this season's are all shown (/review: up to the reader's cap of 1,000).
  const lastShown = more > 0 ? [] : foundLast.slice(0, lastPages * page);
  const lastMore = more > 0 ? 0 : Math.min(page, foundLast.length - lastShown.length);
  const searchedEmpty = (suspects.lines.length > 0 || lastCount > 0) && found.length === 0 && foundLast.length === 0;
  const listOpen = off || open;
  const when = dayYear(suspects.since);
  const sinceHint = suspects.sinceMatch ? W.linesSinceMatch(when, suspects.total) : W.coachLinesSinceSeason(when, suspects.total);
  const sinceTitle = suspects.sinceMatch ? W.findSinceMatch(when) : W.coachFindSinceSeason(when);

  const searchFor = (q: string) => { setQuery(q); setPages(1); setLastPages(1); };
  // Each line once: a table row at a desk, a row of the portal's one framed list on a phone, with the same action.
  const LineView = isPhone ? LineCard : LineRow;
  const row = (l: BankLine) => (
    <LineView key={l.key} line={l} chip={chipFor(l.key)} onMark={() => onMark(itemOfLine(l))}
      undo={marked.has(l.key) ? () => onUndo(l.key) : undefined} />
  );
  const showMore = (more > 0 || lastMore > 0) && (
    <button type="button" className={b.link}
      onClick={() => (more > 0 ? setPages(n => n + 1) : setLastPages(n => n + 1))}>{W.showMore(more > 0 ? more : lastMore)}</button>
  );
  // ON A PHONE (drawing tab 3's recipe, BC4b's for the club, in the portal's own list): one frame, this season's lines
  // under their head (shorter, no year), last season's under its name; the amount at the right with the line's own
  // sign; "Show N more" under the frame (the portal's foot, §3.5). Built only when it is the one drawn.
  const phoneList = () => (
    <>
      <CoachRowList label={sinceTitle} className={b.findCards}>
        {/* Under "Find the $X" (an h3) while off; the section's first heading when opened by "Show them". */}
        {shown.length > 0 && <CoachRowBand level={off ? 4 : 3}>
          {(suspects.sinceMatch ? W.findSinceMatchPhone : W.coachFindSinceSeasonPhone)(dayShort(suspects.since))}
        </CoachRowBand>}
        {shown.map(row)}
        {last && lastShown.length > 0 && <CoachRowBand level={off ? 4 : 3}>{W.coachLastSeason(last.name)}</CoachRowBand>}
        {lastShown.map(row)}
      </CoachRowList>
      {showMore && <CoachRowListFoot>{showMore}</CoachRowListFoot>}
    </>
  );

  return (
    <section className={b.find} aria-labelledby={off ? 'coach-bank-find-title' : undefined}>
      {off ? <h3 id="coach-bank-find-title" className={b.findTitle}>{W.findTitle(cents(band.offByCents))}</h3> : (
        <p className={`${styles.formHint} ${b.hint}`}>
          {sinceHint}{' '}
          {/* `lead`: a phone drops the dot (the door wraps to its own 44px line there; /design BC7b). */}
          <DotPart lead>
            <button type="button" className={b.link} aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? W.hideThem : W.showThem}</button>
          </DotPart>
        </p>
      )}

      {off && current && (
        <HintCallout hint={current} target={target} bankMore={bankMore}
          onMark={() => onMark(itemOfLine(current.lines[0]))} onAddLine={onAddLine}
          next={hints.length > 1 ? {
            count: W.hintCount(hints.indexOf(current) + 1, hints.length),
            go: () => setPick(hints[(hints.indexOf(current) + 1) % hints.length].key),
          } : null} />
      )}
      {/* Nothing to name: the callout drops away (drawn); the bank-side reading and its door stay. */}
      {off && !current && (
        <p className={`${styles.formHint} ${b.hint}`}>
          {(bankMore ? W.coachHintOrMore : W.coachHintOrLess)(target, true)}{' '}
          {onAddLine && <button type="button" className={b.link} onClick={onAddLine}>{W.recordMissingAmount}</button>}
        </p>
      )}

      {listOpen && (
        <>
          {/* The search: at the bar's right at a desk; its own full-width row above the list on a phone (the list's head
              carries the "since" words there). */}
          {isPhone ? <SearchField room="coach" value={query} onChange={searchFor} label={W.findSearch} layout="fill" /> : (
            <div className={b.findBar}>
              <span className={b.findSince}>{sinceTitle}</span>
              <SearchField room="coach" value={query} onChange={searchFor} label={W.findSearch} />
            </div>
          )}
          {suspects.lines.length === 0 && lastCount === 0 ? <p className={`${styles.formHint} ${b.hint}`}>{W.coachNoLinesSince}</p>
            : searchedEmpty ? <p className={`${styles.formHint} ${b.hint}`}>{W.noLinesMatch}</p>
            : isPhone ? phoneList() : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>{W.findCol.date}</th>
                    <th className={styles.th}>{W.findCol.what}</th>
                    <th className={`${styles.th} ${styles.thNum}`}>{W.findCol.out}</th>
                    <th className={`${styles.th} ${styles.thNum}`}>{W.findCol.in}</th>
                    <th className={`${styles.th} ${b.actCell}`}><span className={styles.srOnly}>{W.findCol.act}</span></th>
                  </tr>
                </thead>
                <tbody>{shown.map(row)}</tbody>
                {last && lastShown.length > 0 && (
                  <tbody>
                    {/* Q1-A: last season's lines under its own name (the coach can tell which season they read). */}
                    <tr className={b.divider}><td className={styles.td} colSpan={5}>{W.coachLastSeason(last.name)}</td></tr>
                    {lastShown.map(row)}
                  </tbody>
                )}
              </table>
            </div>
          )}
          {!isPhone && showMore && <p className={b.hint}>{showMore}</p>}
        </>
      )}
    </section>
  );
}

/** The callout (drawing tab 3): one possibility, its sentence, its answers — "Not in the bank yet" on an exact line,
 *  "Record the missing amount" with the "Or the bank…" sentence, and "1 of 3 · Next possibility". */
function HintCallout({ hint, target, bankMore, onMark, onAddLine, next }: {
  hint: Hint; target: string; bankMore: boolean; onMark: () => void; onAddLine?: () => void;
  next: { count: string; go: () => void } | null;
}) {
  const first = hint.lines[0];
  const named = (l: BankLine) => <><b>{nameOf(l)}</b> {W.hintDate(dayShort(l.date))}</>;
  let words: ReactNode;
  if (hint.kind === 'half') {
    words = <>{named(first)} {W.coachHintHalf(cents(first.amountCents), target)}</>;
  } else if (hint.kind === 'combo') {
    words = <>
      {W.hintCombo(hint.lines.length, target)}{' '}
      {hint.lines.map((l, i) => (
        <span key={l.key}>{i > 0 && (i === hint.lines.length - 1 ? ` ${W.and} ` : ', ')}{named(l)}</span>
      ))}
      {'. '}{bankMore ? W.hintComboOut : W.hintComboIn}
    </>;
  } else {
    words = <>{named(first)} {(bankMore ? W.hintExactOut : W.hintExactIn)(target)}</>;
  }
  return (
    <div className={b.callout} role="status">
      <span className={b.calloutWords}>
        {words}
        {hint.kind !== 'half' && <span className={b.calloutSub}>{(bankMore ? W.coachHintOrMore : W.coachHintOrLess)(target)}</span>}
      </span>
      <span className={b.calloutActs}>
        {hint.kind === 'exact' && <button type="button" className={styles.btnSecondary} onClick={onMark}>{W.notInBankYet}</button>}
        {hint.kind !== 'half' && onAddLine && <button type="button" className={styles.btnSecondary} onClick={onAddLine}>{W.recordMissingAmount}</button>}
        {next && (
          <span className={b.hintNext}>
            <span>{next.count}</span>
            <button type="button" className={b.link} onClick={next.go}>{W.hintNext}</button>
          </span>
        )}
      </span>
    </div>
  );
}

/** One line: Date · What (its chip) · Money out · Money in · Not in the bank yet / Undo. A marked line is the one given
 *  `undo`, greyed. */
function LineRow({ line: l, chip, onMark, undo }: { line: BankLine; chip: ReactNode; onMark: () => void; undo?: () => void }) {
  const isMarked = undo !== undefined;
  const name = nameOf(l);
  const rowClass = isMarked ? b.markedRow : chip ? b.hitRow : undefined;
  return (
    <tr className={`${styles.tr}${rowClass ? ` ${rowClass}` : ''}`}>
      <td className={`${styles.td} ${b.nowrap}`}>{dayShort(l.date)}</td>
      <td className={styles.td} data-label={W.findCol.what}>
        <span className={b.findWhat}>
          <span>{name}{isMarked && <span className={b.findDetail}> · {W.markedDetail}</span>}</span>
          {!isMarked && chip}
        </span>
      </td>
      <td className={`${styles.td} ${styles.tdNum}`} data-label={W.findCol.out}>{l.direction === 'out' ? cents(l.amountCents) : ''}</td>
      <td className={`${styles.td} ${styles.tdNum} ${b.moneyIn}`} data-label={W.findCol.in}>{l.direction === 'in' ? cents(l.amountCents) : ''}</td>
      <td className={`${styles.td} ${b.actCell}`}>
        <LineAction name={name} onMark={onMark} undo={undo} shown={!!chip} />
      </td>
    </tr>
  );
}

/** A line's one action, at a desk and on a phone: "Not in the bank yet", or Undo once marked. `shown`: the bordered button
 *  always visible (a hinted row), where an unhinted desk row shows it under the pointer or the keyboard's focus. `quiet`:
 *  an unhinted PHONE row says it as the underlined link (still a full tap), so ten rows don't each carry a bordered button
 *  and the hinted one stands out (owner 2026-11-06, from /design BC7b). */
function LineAction({ name, onMark, undo, shown, quiet = false }: {
  name: string; onMark: () => void; undo?: () => void; shown: boolean; quiet?: boolean;
}) {
  if (undo) return <button type="button" className={b.link} aria-label={W.undoLine(name)} onClick={undo}>{W.undo}</button>;
  const cls = quiet ? b.link : `${b.markBtn}${shown ? ` ${b.markShown}` : ''}`;
  return <button type="button" className={cls} aria-label={W.markLine(name)} onClick={onMark}>{W.notInBankYet}</button>;
}

/** "· {part}": a part of a line that keeps its dot, so a narrow screen wraps before both and never starts or ends a line
 *  on a lone "·" (the head line, "Lines since …: n · Show them"; /design BC7b). `lead`: a part whose dot a phone drops,
 *  because it starts its own line there (after the account name; the "Show them" door). */
export function DotPart({ children, lead = false, help = false }: { children: ReactNode; lead?: boolean; help?: boolean }) {
  return (
    <span className={`${b.headPart}${lead ? ` ${b.headLead}` : ''}${help ? ` ${b.headHelp}` : ''}`}>
      <span aria-hidden className={b.dot}>·</span>
      {children}
    </span>
  );
}

/** The same line on a phone (BC7b): a row of the portal's framed list — title what · caption its date, with its chip ·
 *  the amount at the right with the line's own sign (−$40.00 out, +$60.00 in green: the engine's `signed`, plan §6's
 *  phone rule) · its action on its own line under the row, a full tap (owner 2026-11-06). The row itself is not a
 *  button. A hinted line tints amber-soft; a marked one greys and offers Undo. */
function LineCard({ line: l, chip, onMark, undo }: Parameters<typeof LineRow>[0]) {
  const isMarked = undo !== undefined;
  const name = nameOf(l);
  return (
    // One row class says the line's state (as the desk's row does): a marked line greys its title and amount in CSS.
    <CoachRow className={isMarked ? b.markedCard : chip ? b.hitCard : undefined}
      title={name}
      caption={<span className={b.findWhat}><span>{dayShort(l.date)}{isMarked && ` · ${W.markedDetail}`}</span>{!isMarked && chip}</span>}
      trail={<span className={`${b.cardAmt}${l.direction === 'in' ? ` ${b.moneyIn}` : ''}`}>{moved(signed(l.direction, l.amountCents))}</span>}
      actions={<LineAction name={name} onMark={onMark} undo={undo} shown quiet={!chip} />} />
  );
}
