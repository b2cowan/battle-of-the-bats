'use client';
/**
 * Player Dues — the "By installment" lens (owner-approved mockup, artifact d7162867, 2026-08-14).
 *
 * ⚠ THE COLLECTION SCHEDULE BAND THAT USED TO OPEN THIS FILE IS GONE (owner ruling 2026-09-03,
 * D5). It described the season's collection, which is equally true under the Season-totals lens —
 * so it moved up to the panel header as a foldable TIMELINE that renders on both views
 * (./CollectionSchedule.tsx). The same move took the season figures to a MoneySummaryBand; between
 * them they are why this file's own table foot went too.
 *
 * Two pieces, both rendered from the SAME players array the totals view already holds — this
 * file fetches nothing and computes no money of its own (the arithmetic lives in
 * lib/dues-installment-view.ts, unit-tested):
 *
 *   • the player × installment grid (desktop / tablet);
 *   • collapsible per-player cards (phone) — closed, each answers the question coaches most
 *     often come here with: what does this family owe RIGHT NOW (past due + next installment),
 *     not the whole-season balance.
 *
 * ⚠ "Due next" excludes credits ON PURPOSE — credits sit against the season balance, and this
 * figure must equal the remainder the reminder emails chase. The season Balance column beside
 * it is where credits show, exactly as in the totals view.
 */
import { useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, AlertTriangle, CheckCircle2, CircleDashed } from 'lucide-react';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import { fmt } from '@/lib/coach-money-summary';
import { tournamentToday, formatStoredDate } from '@/lib/timezone';
import { isInstallmentOverdue } from '@/lib/dues-status';
import {
  buildInstallmentColumns,
  dueNextForPlayer,
  installmentToSend,
  type InstallmentColumn,
  type DueNextSummary,
} from '@/lib/dues-installment-view';
import type { InstallmentCoverage } from '@/lib/dues-payments';
import styles from '../../../../coaches.module.css';

/** Structural subset of the panel's PlayerWithDues — declared here so the panel can import this
 *  component without a value-level cycle back into itself. */
export interface BreakdownPlayer {
  player: { id: string; playerFirstName: string | null; playerLastName: string | null };
  schedule: { totalAmount: number } | null;
  installments: {
    id: string;
    installmentNumber: number;
    amount: number;
    dueDate: string;
    paidAt: string | null;
    /** NET remainder (cash − credits applied) — the dues payload field of the same name. */
    remainingAmount?: number;
    creditApplied?: number;
  }[];
  coverage: InstallmentCoverage[];
  rollingBalance: number;
}

/** ⚠ A SETTLED BALANCE IS QUIET, NOT GREEN (Money-hub table pass 2026-08-13, approved render
 *  `14181bd3`). Zero used to be drawn in the same success green as a credit, so a roster where
 *  everyone had paid was a full column of green — the loudest thing on the screen saying nothing.
 *  Colour in these tables means "there is something here": green a credit, amber an amount still
 *  owed, muted a nil. Lives here (with the By-installment view) and is imported by the totals
 *  view so the two lenses can never colour the same balance differently. */
export function balanceColor(b: number): string {
  if (b < -0.005) return 'var(--success-light)'; // in credit (good)
  if (b > 0.005)  return 'var(--warning)'; // still owes
  return 'var(--home-dim, rgba(255,255,255,0.35))'; // fully clear — nothing to flag
}

/* No year — the column heading beside it already carries the season. Shared, because the
   completion date it prints is `completedOn` (a date) falling back to `paidAt` (a timestamp),
   and the local `s + 'T00:00:00'` turned that fallback into "paid Invalid Date". */
function fmtShort(s: string) {
  return formatStoredDate(s, { withYear: false });
}

function playerName(p: BreakdownPlayer) {
  return [p.player.playerFirstName, p.player.playerLastName].filter(Boolean).join(' ');
}

/** The words under a due-next figure — shared by the desktop column and the phone card caption. */
function dueNextCaption(d: DueNextSummary): { text: string; tone: 'warn' | 'dim' | 'good' } {
  if (d.allSettled) return { text: 'All caught up', tone: 'good' };
  if (d.pastDue > 0.005) {
    return {
      text: d.nextAmount > 0.005
        ? `${fmt(d.pastDue)} past due + ${fmt(d.nextAmount)} due ${fmtShort(d.nextDueDate!)}`
        : `${fmt(d.pastDue)} past due`,
      tone: 'warn',
    };
  }
  return { text: d.nextDueDate ? `due ${fmtShort(d.nextDueDate)}` : 'nothing scheduled', tone: 'dim' };
}

/* ⚰ `columnNote()` went with the band it captioned (2026-09-03). It wrote one sentence per
   instalment — "Fully collected — 5 of 7 paid", "$970.80 still to collect · 3 behind" — and on the
   owner's ten-instalment schedule that was ten sentences before the table began. The timeline says
   the same thing with a bar's fill and one shut summary line. Its one rule survives in the new
   shelf: warn ONLY when someone is actually behind, because an unpaid future instalment is a plan,
   not a problem (the chase-card ruling, 2026-08-03). */

export default function InstallmentBreakdown({
  players,
  onOpenPlayer,
  desktopActive = true,
}: {
  players: BreakdownPlayer[];
  /** Opens the same player drawer a row-tap opens in the totals view. */
  onOpenPlayer: (playerId: string) => void;
  /** False when the DESKTOP lens is Season totals. Phones have no lens toggle (owner call
   *  2026-08-14) — the collapsible cards ARE the phone view, so this component renders in
   *  both lenses and, when the desktop shows the totals table, everything here is
   *  phone-only (`.duesPhoneLens`). */
  desktopActive?: boolean;
}) {
  /**
   * THE PIN'S OFFSETS ARE MEASURED, NOT DECLARED — and this is the second attempt, because the
   * first one was wrong in a way only a browser could show.
   *
   * Three columns pin above 1024 (Player · Due next · Balance). `position: sticky` measures `left`
   * from the SCROLLER's edge, so the second column's offset must equal the first's RENDERED width
   * and the third's the sum of the first two. The first cut declared those widths in CSS and reused
   * the same custom properties for the offsets — which reads as airtight and is not: `width` on a
   * table cell is a SUGGESTION to auto table layout, not a rule. Measured live, an 11rem/9rem/6.5rem
   * declaration rendered 129/120/120px, so each pinned column sat short of the offset holding the
   * next one and the scrolled instalment cells showed through a 47px and a 24px window BETWEEN two
   * pinned columns. `table-layout: fixed` would make the widths authoritative but also makes the
   * table exactly its container's width, which removes the overflow the pin exists for.
   *
   * So the browser picks the widths and we read them back. Until that read happens the table carries
   * no `data-pin-ready`, and the stylesheet pins only Player — the behaviour this grid had before,
   * which is the right thing to degrade to.
   */
  const tableRef = useRef<HTMLTableElement | null>(null);
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const measure = () => {
      const head = table.querySelector('thead tr');
      const cells = head ? [...head.children] : [];
      if (cells.length < 3) return;
      const w1 = (cells[0] as HTMLElement).getBoundingClientRect().width;
      const w2 = (cells[1] as HTMLElement).getBoundingClientRect().width;
      // Sub-pixel column widths are ordinary; rounding down would re-open a hairline gap, so the
      // offsets keep their fractions and the browser composites them.
      table.style.setProperty('--dues-pin-1', `${w1}px`);
      table.style.setProperty('--dues-pin-2', `${w2}px`);
      table.dataset.pinReady = 'true';
    };
    measure();
    // Column widths move with the viewport, with the roster, and with a name long enough to widen
    // the Player column — all three would silently un-true a one-shot measurement.
    const ro = new ResizeObserver(measure);
    ro.observe(table);
    return () => ro.disconnect();
  });

  const today = tournamentToday();
  const columns = useMemo(
    () => buildInstallmentColumns(players, today),
    [players, today],
  );
  const dueNextById = useMemo(() => {
    const m = new Map<string, DueNextSummary | null>();
    for (const p of players) m.set(p.player.id, dueNextForPlayer(p.installments, p.coverage, today));
    return m;
  }, [players, today]);

  /* ⚰ `balanceOwing` and `toCollectNow` went with this grid's table foot (2026-09-03). Balance
     owing is now the panel band's own tile, summed there from the same positive rolling balances —
     one derivation for both lenses instead of one per lens, which is the whole point of moving the
     summary above the view switch. "To collect now" had no seat in a four-tile band and no second
     home: the Collection schedule's shut line answers the same question against the instalment a
     coach can actually act on, rather than as a season aggregate nobody sends. */

  /**
   * ONE CELL OF THE GRID — a mark, and a figure only when money is owed (owner ruling 2026-08-14).
   *
   * This used to print the instalment amount plus a sentence underneath ("paid May 12", "covered
   * by fundraising", "$150.00 to send"). On a 7×4 roster that is 28 amounts — the same "$200.00"
   * over and over — and 28 sentences, and the owner's read was that the eye has to decode the
   * caption before the figure means anything.
   *
   * Two changes make the cell answer one question:
   *
   *  • **The amount moved to the column heading.** It is the same for the whole team in every
   *    ordinary schedule, so it is stated once. A player whose own instalment differs still
   *    prints their own figure — the same exception rule the DATES already use.
   *
   *  • **The cell shows what is STILL TO SEND, not what was assessed** — and nothing at all when
   *    that is zero. A settled row goes almost blank, so every figure left on the grid is money
   *    to chase.
   *
   * ⚠ SOURCE IS OUT (owner ruling 2026-08-14). Cash and fundraising both mean "nothing left to
   * send" and both draw the same tick. The grid used to distinguish them, which made a coach read
   * two facts to answer one question; WHERE the money came from is still on the player's record,
   * which is where anyone actually asks it.
   *
   * ⚠ Part-paid is the one state that keeps a figure whatever happens: a tick would say settled
   * and a blank would say untouched, and both are wrong. A mark cannot carry it.
   *
   * ⚠ It returns a STATE, not a rendering. Two surfaces draw it — the terse desktop grid and the
   * wordier phone card, which has room and no column heading to inherit from — and they must never
   * be able to disagree about WHICH state an instalment is in, only about how loudly to say it.
   */
  const cellFor = useCallback((p: BreakdownPlayer, col: InstallmentColumn) => {
    const inst = p.installments.find(i => i.installmentNumber === col.installmentNumber);
    if (!p.schedule || !inst) {
      return { tone: 'none' as const, started: false, amount: null as string | null, ownDate: null as string | null };
    }
    const cov = p.coverage.find(c => c.installmentId === inst.id);
    const toSend = installmentToSend(inst, cov);
    // Shown in-cell only when they differ from the column heading's — the heading speaks for the
    // team's common amount and date; a hand-edited schedule keeps its own visible.
    const ownDate = inst.dueDate !== col.commonDueDate ? fmtShort(inst.dueDate) : null;
    const ownAmount = Math.abs(inst.amount - col.commonAmount) > 0.005 ? fmt(inst.amount) : null;

    // Nothing left to send — by cash, by fundraising, or both.
    if (toSend <= 0.005) return { tone: 'paid' as const, started: true, amount: null, ownDate };

    const overdue = isInstallmentOverdue(inst.dueDate, inst.paidAt);
    // Anything already applied (cash allocated OR credits) makes this a PART-paid instalment.
    const started = Math.abs(inst.amount - toSend) > 0.005;

    if (overdue) return { tone: 'over' as const, started, amount: fmt(toSend), ownDate };
    if (started) return { tone: 'part' as const, started, amount: fmt(toSend), ownDate };
    // Untouched and not yet due — the quietest state, and the commonest early in a season. A
    // figure only when this player's own amount is not the column's.
    return { tone: 'up' as const, started, amount: ownAmount, ownDate };
  }, []);

  type CellState = ReturnType<typeof cellFor>;

  /** The grid's mark for a state. */
  const iconFor = (c: CellState): 'check' | 'warn' | 'part' | 'dot' | null =>
    c.tone === 'paid' ? 'check'
    : c.tone === 'over' ? 'warn'
    : c.tone === 'part' ? 'part'
    : c.tone === 'up' && !c.amount && !c.ownDate ? 'dot'
    : null;

  /**
   * The phone card's words for the same state — the card keeps its wording where the grid does not.
   *
   * ⚠ SHORT ON PURPOSE. The first cut said "$625.00 overdue — was due Jul 23" beside a row that
   * ALREADY prints the instalment amount and whose label already reads "Installment 1 · Jul 23";
   * both nowrap, so the rendered sweep caught it spilling 60px off a 361px phone. The date and the
   * face amount are the row's job. This says only what they cannot: is it late, and if the family
   * is part-way, how much is left.
   */
  const cardWords = (c: CellState): string =>
    c.tone === 'none' ? 'Not set'
    : c.tone === 'paid' ? 'settled'
    // `amount` is already `fmt(toSend)` for both of these — formatting it a second time here is
    // what kept `toSend` on the state at all.
    : c.tone === 'over' ? (c.started ? `${c.amount} overdue` : 'overdue')
    : c.tone === 'part' ? `${c.amount} to send`
    : 'upcoming';

  /** ⚠ THE MARK CARRIES THE MEANING, never the colour on its own — the warm palette's amber and
   *  danger sit at ΔE ~1.0 for deutan vision, so a grid that said "late" in red alone would say
   *  nothing to some coaches. Four distinct shapes, one per state. */
  const statusIcon = (icon: 'check' | 'warn' | 'part' | 'dot' | null) =>
    icon === 'check' ? <CheckCircle2 size={13} aria-hidden style={{ verticalAlign: '-2px' }} />
    : icon === 'warn' ? <AlertTriangle size={13} aria-hidden style={{ verticalAlign: '-2px', marginRight: 3 }} />
    : icon === 'part' ? <CircleDashed size={13} aria-hidden style={{ verticalAlign: '-2px', marginRight: 3 }} />
    : icon === 'dot' ? <span aria-hidden>·</span>
    : null;

  /** The one-line key under the grid. It exists BECAUSE the captions went: four marks a coach has
   *  not seen before need naming once, and once is cheaper than 28 sentences. */
  const legend = (
    <p className={styles.duesLegend}>
      <span data-tone="paid"><CheckCircle2 size={12} aria-hidden /> settled</span>
      <span data-tone="part"><CircleDashed size={12} aria-hidden /> part paid</span>
      <span data-tone="over"><AlertTriangle size={12} aria-hidden /> overdue</span>
      <span data-tone="up">· upcoming</span>
      {/* A footnote about the whole grid, not a fifth tone — no `data-tone`, so a future rule
          targeting one cannot silently start styling it. */}
      <span>a figure is what is still to send</span>
    </p>
  );

  /** Desktop "Due next" cell / phone card summary — one renderer so they cannot drift. */
  const dueNextFigure = (p: BreakdownPlayer) => {
    const d = dueNextById.get(p.player.id) ?? null;
    if (!p.schedule || !d) {
      return { value: '—', valueColor: 'var(--home-dim, rgba(255,255,255,0.3))', caption: 'Not set', tone: 'dim' as const };
    }
    if (d.allSettled && p.rollingBalance < -0.005) {
      return { value: fmt(p.rollingBalance), valueColor: 'var(--success-light)', caption: 'In credit', tone: 'good' as const };
    }
    const cap = dueNextCaption(d);
    return {
      value: fmt(d.amount),
      // The settled-is-quiet ruling: a $0 due-next is muted, only real amounts carry colour.
      valueColor: d.amount > 0.005
        ? (d.pastDue > 0.005 ? 'var(--warning)' : 'var(--home-ink, rgba(255,255,255,0.85))')
        : 'var(--home-dim, rgba(255,255,255,0.35))',
      caption: cap.text,
      tone: cap.tone,
    };
  };

  return (
    <div className={desktopActive ? undefined : styles.duesPhoneLens}>
      {/* ── Desktop / tablet: the player × installment grid ───────────────────────────────────
          Wrapped in CoachScrollX so the "too many installments" question answers itself: while
          the columns fit, nothing changes; the moment they genuinely overflow (the scroller
          MEASURES rather than counting columns) the grid scrolls sideways WITH the swipe hint
          and the Player column pinned (the Budget-vs-Actual month-grid pattern) — no manual
          format switch, no silent sideways scroll, at any installment count. */}
      <CoachScrollX
        sticky
        hint="Swipe to see later installments"
        className={styles.duesMatrixWrap}
        scrollerClassName={`${styles.duesMatrixScroller} ${styles.duesMatrixPin}`}
      >
        <table className={styles.table} ref={tableRef}>
          <thead>
            <tr>
              {/* ⚠⚠ DUE NEXT AND BALANCE LEAD THE GRID NOW (owner ruling 2026-09-03, D5). They used
                  to close it, past every instalment column — so on a schedule long enough to scroll,
                  the two figures a coach came for were the two the swipe took away first, while
                  eight cells of ticks stayed. Leading, they are what the pin holds (`.duesMatrixPin`,
                  ≥1024) and the last thing to leave at any width. The instalments read left to right
                  after them, which is also the order a season happens in. */}
              <th className={styles.th}>Player</th>
              <th className={`${styles.th} ${styles.thNum}`}>Due next</th>
              <th className={`${styles.th} ${styles.thNum}`}>Balance</th>
              {/* ⚠ THE HEADING CARRIES THE AMOUNT. It is the same for the whole team in every
                  ordinary schedule, so the grid states it once here instead of 28 times in the
                  cells — and a player whose own instalment differs still prints their own figure
                  in-cell, exactly as their own date does. */}
              {columns.map(col => (
                <th key={col.installmentNumber} className={`${styles.th} ${styles.thNum}`}>
                  Installment {col.installmentNumber}
                  <span className={styles.duesThDue}>
                    {[
                      col.amountVaries ? 'amounts vary' : col.commonAmount > 0.005 ? fmt(col.commonAmount) : '',
                      col.dueDateVaries ? 'dates vary' : col.commonDueDate ? `due ${fmtShort(col.commonDueDate)}` : '',
                    ].filter(Boolean).join(' · ')}
                  </span>
                </th>
              ))}
              <th className={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => {
              const due = dueNextFigure(p);
              return (
                <tr
                  key={p.player.id}
                  className={styles.tr}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onOpenPlayer(p.player.id)}
                >
                  <td className={styles.td}>{playerName(p)}</td>
                  <td className={`${styles.td} ${styles.tdNum}`}>
                    <span className={styles.duesCellAmt} style={{ color: due.valueColor, fontWeight: 700 }}>{due.value}</span>
                    <span className={styles.duesCellSt} data-tone={due.tone === 'warn' ? 'over' : due.tone === 'good' ? 'paid' : 'up'}>
                      {due.tone === 'warn' && <AlertTriangle size={11} aria-hidden style={{ verticalAlign: '-1px', marginRight: 2 }} />}
                      {due.caption}
                    </span>
                  </td>
                  <td className={`${styles.td} ${styles.tdNum}`} style={{ color: balanceColor(p.rollingBalance), fontWeight: 600 }}>
                    {p.schedule ? fmt(p.rollingBalance) : '—'}
                  </td>
                  {/* One line, not two: the mark, then a figure ONLY where money is still owed.
                      A player with no schedule at all keeps an em dash — a blank cell and a
                      "nothing due yet" cell are different facts. */}
                  {columns.map(col => {
                    const cell = cellFor(p, col);
                    return (
                      <td key={col.installmentNumber} className={`${styles.td} ${styles.tdNum}`}>
                        <span className={styles.duesCell} data-tone={cell.tone}>
                          {cell.tone === 'none' ? '—' : statusIcon(iconFor(cell))}
                          {cell.amount && <span className={styles.duesCellAmt}>{cell.amount}</span>}
                          {cell.ownDate && cell.tone !== 'paid' && <span className={styles.duesCellWhen}>{cell.ownDate}</span>}
                        </span>
                      </td>
                    );
                  })}
                  <td className={styles.td}>
                    <ChevronRight size={14} style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))' }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* ⚰ THIS GRID'S TABLE FOOT IS RETIRED (owner ruling 2026-09-03, D4) — the season figures
              open the tab as a MoneySummaryBand above the view switch, so both lenses summarise the
              list with the same four words instead of one row each.

              It was already half a headstone, and both halves still hold:

              ⚠ THE PER-INSTALMENT TOTALS WERE DELETED FIRST (2026-08-14) because the Collection
              schedule stated each instalment's collected-of-assessed a few inches above, and a
              number printed twice on one screen only invites the question of why the two might
              disagree. That schedule is now the header's timeline — same argument, further up.

              ⚠ AND THE LABELS WENT WITH THEM: "To collect now" was simply the total of `Due next`
              and "Balance owing" the total of `Balance`, both named by the headings above. Balance
              owing kept a home in the band; to-collect-now did not, deliberately (see the sums'
              own headstone near the top of this component). */}
        </table>
      </CoachScrollX>
      {legend}

      {/* ── Phone: collapsible per-player cards, closed on the "due next" figure ─────────────── */}
      <div className={styles.duesCards}>
        {players.map(p => {
          const due = dueNextFigure(p);
          const d = dueNextById.get(p.player.id);
          if (!p.schedule || !d) {
            // No schedule ⇒ nothing to expand — the whole card is the door to setting one,
            // exactly what a row-tap does in the totals view.
            return (
              <button key={p.player.id} type="button" className={styles.duesCardStatic} onClick={() => onOpenPlayer(p.player.id)}>
                <span className={styles.duesCardName}>{playerName(p)}</span>
                <span className={styles.duesCardSum}>
                  <span className={styles.duesCardDue} style={{ color: due.valueColor }}>{due.value}</span>
                  <span className={styles.duesCardCap}>{due.caption}</span>
                </span>
              </button>
            );
          }
          return (
            <details key={p.player.id} className={styles.duesCard}>
              <summary className={styles.duesCardHead}>
                <ChevronRight size={14} className={styles.duesCardTwist} aria-hidden />
                <span className={styles.duesCardName}>{playerName(p)}</span>
                <span className={styles.duesCardSum}>
                  <span className={styles.duesCardDue} style={{ color: due.valueColor }}>{due.value}</span>
                  <span className={styles.duesCardCap} data-tone={due.tone}>
                    {due.tone === 'warn' && <AlertTriangle size={10} aria-hidden style={{ verticalAlign: '-1px', marginRight: 2 }} />}
                    {due.caption}
                  </span>
                </span>
              </summary>
              <div className={styles.duesCardBody}>
                {p.installments.map(inst => {
                  const col = columns.find(c => c.installmentNumber === inst.installmentNumber);
                  const cell = col ? cellFor(p, col) : null;
                  return (
                    /* ⚠ The CARD keeps its words. It has room, it has no column heading above it
                       to inherit the amount and date from, and it is the whole story for a phone
                       user — so it prints the instalment amount and a sentence, both derived from
                       the same state the terse grid cell uses. */
                    <div key={inst.id} className={styles.duesCardRow}>
                      <span className={styles.duesCardRowLab}>Installment {inst.installmentNumber} · {fmtShort(inst.dueDate)}</span>
                      <span className={styles.duesCardRowVal}>
                        <span className={styles.duesCellAmt}>{fmt(inst.amount)}</span>{' '}
                        {cell && (
                          <span className={styles.duesCellSt} data-tone={cell.tone} style={{ display: 'inline' }}>
                            {statusIcon(iconFor(cell))}
                            {cardWords(cell)}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
                <div className={styles.duesCardFoot}>
                  <span>
                    Season balance{' '}
                    <strong style={{ color: balanceColor(p.rollingBalance), fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(p.rollingBalance)}
                    </strong>
                  </span>
                  {/* The header tap toggles the card, so the drawer needs its own door here. */}
                  <button type="button" className={styles.duesCardFootLink} onClick={() => onOpenPlayer(p.player.id)}>
                    Full record ›
                  </button>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
