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
import { ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import { fmt } from '@/lib/coach-money-summary';
import { tournamentToday } from '@/lib/timezone';
import { isInstallmentOverdue } from '@/lib/dues-status';
import {
  buildInstallmentColumns,
  dueNextForPlayer,
  daysUntil,
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

function fmtShort(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
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
    return { text: `Fully collected — ${col.paidCount} of ${col.playerCount} paid`, tone: 'good' };
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

  const cellFor = useCallback((p: BreakdownPlayer, col: InstallmentColumn) => {
    const inst = p.installments.find(i => i.installmentNumber === col.installmentNumber);
    if (!p.schedule || !inst) {
      return { amount: null as string | null, status: '—', tone: 'none' as const, icon: null as 'check' | 'warn' | null };
    }
    const cov = p.coverage.find(c => c.installmentId === inst.id);
    const allocated = cov?.allocated ?? 0;
    // A date shown in-cell only when it differs from the column header's — the header speaks
    // for the team's common date; a hand-edited schedule keeps its own date visible.
    const ownDate = inst.dueDate !== col.commonDueDate ? fmtShort(inst.dueDate) : null;
    if (cov?.covered) {
      const on = cov.completedOn ?? inst.paidAt;
      return { amount: fmt(inst.amount), status: on ? `paid ${fmtShort(on)}` : 'paid', tone: 'paid' as const, icon: 'check' as const };
    }
    const overdue = isInstallmentOverdue(inst.dueDate, inst.paidAt);
    if (allocated > 0.005) {
      return {
        amount: fmt(inst.amount),
        status: `${fmt(allocated)} of ${fmt(inst.amount)}`,
        tone: overdue ? ('over' as const) : ('part' as const),
        icon: overdue ? ('warn' as const) : null,
      };
    }
    if (overdue) {
      return { amount: fmt(inst.amount), status: ownDate ? `was due ${ownDate}` : 'overdue', tone: 'over' as const, icon: 'warn' as const };
    }
    return { amount: fmt(inst.amount), status: ownDate ? `due ${ownDate}` : 'upcoming', tone: 'up' as const, icon: null };
  }, []);

  const statusIcon = (icon: 'check' | 'warn' | null) =>
    icon === 'check' ? <CheckCircle2 size={11} aria-hidden style={{ verticalAlign: '-1px', marginRight: 2 }} />
    : icon === 'warn' ? <AlertTriangle size={11} aria-hidden style={{ verticalAlign: '-1px', marginRight: 2 }} />
    : null;

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
            const pct = col.assessed > 0 ? Math.min(100, Math.round((col.collected / col.assessed) * 100)) : 0;
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
              {columns.map(col => (
                <th key={col.installmentNumber} className={`${styles.th} ${styles.thNum}`}>
                  Installment {col.installmentNumber}
                  <span className={styles.duesThDue}>
                    {col.dueDateVaries ? 'dates vary' : col.commonDueDate ? `due ${fmtShort(col.commonDueDate)}` : ''}
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
                  {columns.map(col => {
                    const cell = cellFor(p, col);
                    return (
                      <td key={col.installmentNumber} className={`${styles.td} ${styles.tdNum}`}>
                        {cell.amount && <span className={styles.duesCellAmt}>{cell.amount}</span>}
                        <span className={styles.duesCellSt} data-tone={cell.tone}>
                          {statusIcon(cell.icon)}
                          {cell.status}
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
          <tfoot className={styles.tableFoot}>
            <tr>
              <td className={styles.td}><span className={styles.footLabel}>Season</span></td>
              {columns.map(col => (
                <td key={col.installmentNumber} className={`${styles.td} ${styles.tdNum}`}>
                  <span className={styles.footLabel}>Collected</span>
                  <span className={styles.footValue}>
                    {col.remaining <= 0.005
                      ? fmt(col.collected)
                      : <>{fmt(col.collected)} <span className={styles.duesTermOf}>of {fmt(col.assessed)}</span></>}
                  </span>
                </td>
              ))}
              <td className={`${styles.td} ${styles.tdNum}`}>
                <span className={styles.footLabel}>To collect now</span>
                <span className={styles.footValue} data-warn={toCollectNow > 0.005 ? 'true' : undefined}>{fmt(toCollectNow)}</span>
              </td>
              <td className={`${styles.td} ${styles.tdNum}`}>
                <span className={styles.footLabel}>Balance owing</span>
                <span className={styles.footValue} data-warn={balanceOwing > 0.005 ? 'true' : undefined}>{fmt(balanceOwing)}</span>
              </td>
              <td className={styles.td}></td>
            </tr>
          </tfoot>
        </table>
      </CoachScrollX>

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
                    <div key={inst.id} className={styles.duesCardRow}>
                      <span className={styles.duesCardRowLab}>Installment {inst.installmentNumber} · {fmtShort(inst.dueDate)}</span>
                      <span className={styles.duesCardRowVal}>
                        <span className={styles.duesCellAmt}>{fmt(inst.amount)}</span>{' '}
                        {cell && (
                          <span className={styles.duesCellSt} data-tone={cell.tone} style={{ display: 'inline' }}>
                            {statusIcon(cell.icon)}
                            {cell.status}
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
