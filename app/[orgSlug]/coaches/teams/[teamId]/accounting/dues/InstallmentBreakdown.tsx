'use client';
/**
 * Player Dues — the "By installment" lens (owner-approved mockup, artifact d7162867, 2026-08-14).
 *
 * Three pieces, all rendered from the SAME players array the totals view already holds — this
 * file fetches nothing and computes no money of its own (the arithmetic lives in
 * lib/dues-installment-view.ts, unit-tested):
 *
 *   • the Collection schedule band — one term per installment, in the Budget tab's plan-card
 *     visual language;
 *   • the player × installment grid (desktop / tablet);
 *   • collapsible per-player cards (phone) — closed, each answers the question coaches most
 *     often come here with: what does this family owe RIGHT NOW (past due + next installment),
 *     not the whole-season balance.
 *
 * ⚠ "Due next" excludes credits ON PURPOSE — credits sit against the season balance, and this
 * figure must equal the remainder the reminder emails chase. The season Balance column beside
 * it is where credits show, exactly as in the totals view.
 */
import { useMemo, useCallback } from 'react';
import { ChevronRight, AlertTriangle, CheckCircle2, CircleDashed } from 'lucide-react';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import { fmt } from '@/lib/coach-money-summary';
import { tournamentToday, formatStoredDate } from '@/lib/timezone';
import { isInstallmentOverdue } from '@/lib/dues-status';
import {
  buildInstallmentColumns,
  dueNextForPlayer,
  daysUntil,
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

/** The one line under each band term. Warn only when someone is actually behind — a future
 *  installment nobody has paid yet is a plan, not a problem (the chase-card ruling, 2026-08-03). */
function columnNote(col: InstallmentColumn, today: string): { text: string; tone: 'good' | 'warn' | 'dim' } {
  if (col.assessed > 0.005 && col.remaining <= 0.005) {
    // "Covered" when fundraising did part of the work — collected stays a cash word.
    return {
      text: col.creditApplied > 0.005
        ? `Fully covered — ${col.paidCount} of ${col.playerCount} paid, rest by fundraising`
        : `Fully collected — ${col.paidCount} of ${col.playerCount} paid`,
      tone: 'good',
    };
  }
  if (col.behindCount > 0) {
    return {
      text: `${fmt(col.remaining)} still to collect · ${col.behindCount} behind`,
      tone: 'warn',
    };
  }
  const parts: string[] = [];
  if (col.paidCount > 0) parts.push(`${col.paidCount} of ${col.playerCount} paid early`);
  if (col.commonDueDate && col.commonDueDate >= today) {
    const days = daysUntil(col.commonDueDate, today);
    parts.push(days === 0 ? 'due today' : days === 1 ? 'due tomorrow' : `due in ${days} days`);
  } else if (col.remaining > 0.005) {
    parts.push(`${fmt(col.remaining)} still to collect`);
  }
  if (col.dueDateVaries) parts.push('dates vary');
  return { text: parts.join(' · ') || '—', tone: 'dim' };
}

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

  // The same positive-rolling-balance sum the totals footer labels "Balance owing".
  const balanceOwing = players.reduce((s, p) => s + (p.rollingBalance > 0.005 ? p.rollingBalance : 0), 0);
  const toCollectNow = players.reduce((s, p) => s + (dueNextById.get(p.player.id)?.amount ?? 0), 0);

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
      {/* ── Collection schedule band — the Budget plan card's language, one term per installment ── */}
      <div className={styles.duesBand}>
        <div className={styles.duesBandCap}>Collection schedule</div>
        <div className={styles.duesBandRow}>
          {columns.map(col => {
            const note = columnNote(col, today);
            // Progress = how much of the term no longer needs to arrive (cash collected +
            // credits applied) — a term fully covered by fundraising reads 100%, not stuck
            // where the cash stopped.
            const pct = col.assessed > 0 ? Math.min(100, Math.round(((col.assessed - col.remaining) / col.assessed) * 100)) : 0;
            return (
              <div key={col.installmentNumber} className={styles.duesTerm}>
                <span className={styles.duesTermKey}>
                  Installment {col.installmentNumber}
                  <span className={styles.duesTermDue}>
                    {' '}· {col.dueDateVaries ? 'dates vary' : col.commonDueDate ? `due ${fmtShort(col.commonDueDate)}` : ''}
                  </span>
                </span>
                <span className={styles.duesTermVal}>
                  {col.remaining > 0.005
                    ? <>{fmt(col.collected)} <span className={styles.duesTermOf}>of {fmt(col.assessed)}</span></>
                    : fmt(col.assessed)}
                </span>
                <span className={styles.duesTermNote} data-tone={note.tone}>
                  {note.tone === 'warn' && <AlertTriangle size={11} aria-hidden style={{ verticalAlign: '-1px', marginRight: 3 }} />}
                  {note.tone === 'good' && <CheckCircle2 size={11} aria-hidden style={{ verticalAlign: '-1px', marginRight: 3 }} />}
                  {note.text}
                </span>
                <span className={styles.duesMeter} aria-hidden>
                  <span className={styles.duesMeterFill} data-tone={note.tone === 'warn' ? 'warn' : undefined} style={{ width: `${pct}%` }} />
                </span>
              </div>
            );
          })}
        </div>
      </div>

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
        scrollerClassName={styles.duesMatrixScroller}
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Player</th>
              {/* ⚠ THE HEADING NOW CARRIES THE AMOUNT. It is the same for the whole team in every
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
              <th className={`${styles.th} ${styles.thNum}`}>Due next</th>
              <th className={`${styles.th} ${styles.thNum}`}>Balance</th>
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
                  <td className={styles.td}>
                    <ChevronRight size={14} style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))' }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* ⚠ THE PER-INSTALMENT TOTALS ARE DELETED, NOT RESTYLED (owner ruling 2026-08-14).
              The Collection schedule band a few inches above already states each instalment's
              collected-of-assessed WITH a progress meter and a sentence — this footer was the same
              four figures in a weaker form, under four cells all labelled "COLLECTED". A number
              printed twice on one screen only invites the question of why the two might disagree.

              ⚠ AND THE LABELS GO WITH THEM. "To collect now" is simply the total of the `Due next`
              column and "Balance owing" the total of `Balance` — the headings above already name
              both, and a totals row on the footer line reads as a total without being told. Only
              the word "Season" survives, because that IS the thing the columns do not say.

              ⚠ Safe to strip here in a way it would NOT be on the settlement table below: this
              grid is `display: none` under 640 and the phone gets `.duesCards` instead, so it
              never becomes the label-less card stack that `.tableAsCards` has to re-caption. */}
          <tfoot className={styles.tableFoot}>
            <tr>
              <td className={`${styles.td} ${styles.footLeadCell}`}>
                <span className={styles.footValue}>Season</span>
                <span className={styles.footNote}>{players.length} player{players.length !== 1 ? 's' : ''}</span>
              </td>
              <td className={styles.td} colSpan={columns.length}></td>
              <td className={`${styles.td} ${styles.tdNum}`}>
                <span className={styles.footValue} data-warn={toCollectNow > 0.005 ? 'true' : undefined}>{fmt(toCollectNow)}</span>
              </td>
              <td className={`${styles.td} ${styles.tdNum}`}>
                <span className={styles.footValue} data-warn={balanceOwing > 0.005 ? 'true' : undefined}>{fmt(balanceOwing)}</span>
              </td>
              <td className={styles.td}></td>
            </tr>
          </tfoot>
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
