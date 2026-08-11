'use client';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import MoneyNextThirtyDays from './MoneyNextThirtyDays';
import styles from './overview-dashboard.module.css';

/* Operate-stage Money Overview: three story cards (Collections / Cash / Budget),
 * the merged Next-N-days ledger, and the "More in Money" rail. A story card is
 * a fact's one home; the rail's Budget rows repeat two headline figures by
 * design — the rail is a complete tab index with a live stat per line, and a
 * gap there would read as "no data". Deliberately no lime CTA and no write
 * action anywhere here (owner call 2026-08-11): the dashboard reports; acting
 * happens one click deeper. */

export interface MoneySummary {
  stage: 'plan' | 'collect' | 'operate';
  orgLinked: boolean;
  moneyIn: { duesCollected: number; fundraisingRaised: number; orgFunding: number; total: number };
  moneyOut: { expensesPaid: number; allocationsPaid: number; orgPayments: number; total: number };
  onHand: number;
  headroom: number | null;
  budget: {
    seasonTotal: number | null;
    itemizedTotal: number;
    effectiveTotal: number;
    buffer: number;
    overItemized: boolean;
    lineCount: number;
    hasInstallments: boolean;
    rosterCount: number;
    perPlayer: number | null;
  };
  dues: {
    expected: number;
    collected: number;
    outstanding: number;
    overdueCount: number;
    overdueAmount: number;
    neverPaidCount: number;
    schedulesCount: number;
  };
  fundraisers: { activeCount: number; totalRaised: number; creditsIssued: number };
  expenses: { paidTotal: number; loggedCount: number; unpaidCount: number; upcomingDueCount: number };
  allocations: { count: number; totalAllocated: number; outstanding: number; overdueCount: number };
  paymentRequests: { pendingCount: number };
}

export interface DashboardHrefs {
  dues: string;
  budget: string;
  budgetStarter: string;
  budgetVsActual: string;
  fundraisers: string;
  expenses: string;
  expensesSchedule: string;
  allocations?: string;
  paymentRequests?: string;
}

interface Props {
  summary: MoneySummary;
  payablesApiUrl: string;
  /** Org-only rows (Allocations, Payment Requests) render iff their href is
   *  present — one signal, owned by the caller that owns the gating rule. */
  hrefs: DashboardHrefs;
}

export function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-$${abs}` : `$${abs}`;
}

/* A slice a coach should SEE stays visible even when it rounds to a sliver. */
function segWidth(value: number, total: number): number {
  if (total <= 0 || value <= 0) return 0;
  return Math.max((value / total) * 100, 2);
}

export default function OverviewDashboard({ summary, payablesApiUrl, hrefs }: Props) {
  const { dues, budget } = summary;
  const pct = dues.expected > 0 ? Math.round((dues.collected / dues.expected) * 100) : 0;
  const toCome = Math.max(dues.expected - dues.collected - dues.overdueAmount, 0);
  const allCollected = dues.expected > 0 && dues.outstanding <= 0.005;
  const spent = summary.expenses.paidTotal;
  const overBudget = summary.headroom != null && summary.headroom < 0;
  const flowMax = Math.max(summary.moneyIn.total, summary.moneyOut.total, 1);

  return (
    <>
      <div className={styles.row3}>
        {/* ── Collections ── */}
        <div className={`${styles.card} ${dues.overdueCount > 0 ? styles.cardAlert : ''}`}>
          <div className={styles.eyeRow}>
            <span className={styles.eye}>Collections</span>
            {/* No chip at all when nothing is scheduled — a green "on track"
                beside "no installments are set yet" would be a lie. */}
            {dues.expected > 0 && (
              dues.overdueCount > 0 ? (
                <span className={`${styles.chip} ${styles.chipDanger}`}>
                  <AlertTriangle size={11} aria-hidden /> {dues.overdueCount} overdue
                </span>
              ) : dues.neverPaidCount > 0 ? (
                <span className={`${styles.chip} ${styles.chipWarn}`}>{dues.neverPaidCount} unpaid</span>
              ) : (
                <span className={`${styles.chip} ${styles.chipGood}`}>{allCollected ? 'all in' : 'on track'}</span>
              )
            )}
          </div>
          {dues.expected > 0 ? (
            <>
              <div className={styles.big}>
                {fmt(dues.collected)} <small>of {fmt(dues.expected)} · {pct}%</small>
              </div>
              <div className={styles.bar}>
                {dues.collected > 0 && (
                  <div className={`${styles.seg} ${styles.segCollected}`} style={{ width: `${Math.min(segWidth(dues.collected, dues.expected), 100)}%` }} />
                )}
                {dues.overdueAmount > 0 && (
                  <div className={`${styles.seg} ${styles.segOverdue}`} style={{ width: `${segWidth(dues.overdueAmount, dues.expected)}%` }} />
                )}
              </div>
              <div className={styles.legend}>
                <span><span className={`${styles.legendDot} ${styles.dotCollected}`} /><b>{fmt(dues.collected)}</b> in</span>
                {dues.overdueAmount > 0 && (
                  <span><span className={`${styles.legendDot} ${styles.dotOverdue}`} /><b>{fmt(dues.overdueAmount)}</b> overdue</span>
                )}
                {toCome > 0 && (
                  <span><span className={`${styles.legendDot} ${styles.dotTrack}`} /><b>{fmt(toCome)}</b> to come</span>
                )}
              </div>
            </>
          ) : (
            <p className={styles.footNote}>Dues schedules exist but no installments are set yet. Set them up in Player Dues.</p>
          )}
          <div className={styles.foot}>
            <Link href={hrefs.dues} className={styles.footLink}>Player Dues →</Link>
          </div>
        </div>

        {/* ── Cash on hand ── */}
        <div className={styles.card}>
          <div className={styles.eyeRow}>
            <span className={styles.eye}>Cash on hand</span>
          </div>
          <div className={`${styles.big} ${summary.onHand >= 0 ? styles.vGood : styles.vBad}`}>
            {fmt(summary.onHand)}
          </div>
          <div className={styles.flow}>
            <div className={styles.flowRow}>
              <span className={styles.flowLabel}>IN</span>
              <span className={styles.flowTrack}>
                <span className={`${styles.flowFill} ${styles.flowIn}`} style={{ width: `${segWidth(summary.moneyIn.total, flowMax)}%` }} />
              </span>
              <span className={`${styles.flowAmt} ${summary.moneyIn.total > 0 ? styles.amtIn : ''}`}>{fmt(summary.moneyIn.total)}</span>
            </div>
            <div className={styles.flowRow}>
              <span className={styles.flowLabel}>OUT</span>
              <span className={styles.flowTrack}>
                <span className={`${styles.flowFill} ${styles.flowOut}`} style={{ width: `${segWidth(summary.moneyOut.total, flowMax)}%` }} />
              </span>
              <span className={styles.flowAmt}>{fmt(summary.moneyOut.total)}</span>
            </div>
          </div>
          {/* The cash-basis caveat qualifies THESE numbers, so it lives with them —
              not as a page-level sentence bolted above a tile row. */}
          <p className={styles.footNote}>Cash actually received and actually paid — not what&apos;s still owed.</p>
          <div className={styles.foot}>
            <Link href={hrefs.dues} className={styles.footLink}>See what&apos;s outstanding →</Link>
          </div>
        </div>

        {/* ── Budget ── */}
        <div className={styles.card}>
          <div className={styles.eyeRow}>
            <span className={styles.eye}>Budget</span>
            {summary.headroom != null && (
              overBudget
                ? <span className={`${styles.chip} ${styles.chipDanger}`}>over budget</span>
                : <span className={`${styles.chip} ${styles.chipGood}`}>on plan</span>
            )}
          </div>
          {summary.headroom == null ? (
            <>
              <div className={`${styles.big} ${styles.vMuted}`}>—</div>
              <p className={styles.footNote}>
                No budget yet. Set a season plan to see headroom and track spending against it.
              </p>
              <div className={styles.foot}>
                <Link href={hrefs.budgetStarter} className={styles.footLink}>Set up your budget →</Link>
              </div>
            </>
          ) : (
            <>
              <div className={`${styles.big} ${overBudget ? styles.vBad : styles.vGood}`}>
                {fmt(Math.abs(summary.headroom))} <small>{overBudget ? 'over budget' : 'headroom'}</small>
              </div>
              <div className={styles.bar}>
                <div
                  className={`${styles.seg} ${overBudget ? styles.segSpentOver : styles.segSpent}`}
                  style={{ width: `${Math.min(segWidth(spent, budget.effectiveTotal), 100)}%` }}
                />
              </div>
              <div className={styles.legend}>
                <span><span className={`${styles.legendDot} ${styles.dotSpent}`} /><b>{fmt(spent)}</b> spent</span>
                <span>
                  <span className={`${styles.legendDot} ${styles.dotTrack}`} /><b>{fmt(budget.effectiveTotal)}</b> planned
                  {budget.perPlayer != null && <> · <b>{fmt(budget.perPlayer)}</b>/player</>}
                </span>
              </div>
              <div className={styles.foot}>
                <Link href={hrefs.budget} className={styles.footLink}>Budget plan →</Link>
                <Link href={hrefs.budgetVsActual} className={styles.footLink}>Budget vs. Actual →</Link>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.row2}>
        <MoneyNextThirtyDays
          apiUrl={payablesApiUrl}
          hrefs={{
            dues: hrefs.dues,
            expenses: hrefs.expenses,
            allocations: hrefs.allocations,
            fullSchedule: hrefs.expensesSchedule,
          }}
        />

        {/* ── More in Money: one line + one live stat per surface the story
            cards don't already own; navigation itself belongs to the tab bar. ── */}
        <div className={styles.card}>
          <div className={styles.eyeRow}>
            <span className={styles.eye}>More in Money</span>
          </div>
          <div>
            <Link href={hrefs.fundraisers} className={styles.railRow}>
              <span className={`${styles.railDot} ${styles.railDotGood}`} />
              <span className={styles.railName}>Fundraisers</span>
              <span className={styles.railStat}>
                {summary.fundraisers.totalRaised > 0
                  ? <><b>{fmt(summary.fundraisers.totalRaised)}</b> raised</>
                  : summary.fundraisers.activeCount > 0
                    ? <>{summary.fundraisers.activeCount} active</>
                    : <>None yet · <b>start one</b></>}
              </span>
              <span className={styles.railChev} aria-hidden>›</span>
            </Link>
            {hrefs.allocations && (
              <Link href={hrefs.allocations} className={styles.railRow}>
                <span className={`${styles.railDot} ${styles.railDotBlue}`} />
                <span className={styles.railName}>Org Allocations</span>
                <span className={styles.railStat}>
                  {summary.allocations.count > 0 ? (
                    summary.allocations.overdueCount > 0
                      ? <span className={styles.railStatDanger}>{summary.allocations.overdueCount} overdue</span>
                      : <><b>{fmt(summary.allocations.outstanding)}</b> outstanding</>
                  ) : 'None assigned'}
                </span>
                <span className={styles.railChev} aria-hidden>›</span>
              </Link>
            )}
            {hrefs.paymentRequests && (
              <Link href={hrefs.paymentRequests} className={styles.railRow}>
                <span className={`${styles.railDot} ${styles.railDotRust}`} />
                <span className={styles.railName}>Payment Requests</span>
                <span className={styles.railStat}>
                  {summary.paymentRequests.pendingCount > 0
                    ? <><b>{summary.paymentRequests.pendingCount}</b> pending</>
                    : 'None pending'}
                </span>
                <span className={styles.railChev} aria-hidden>›</span>
              </Link>
            )}
            <Link href={hrefs.budget} className={styles.railRow}>
              <span className={`${styles.railDot} ${styles.railDotPlum}`} />
              <span className={styles.railName}>Season Budget Plan</span>
              <span className={styles.railStat}>
                {budget.effectiveTotal > 0 ? <><b>{fmt(budget.effectiveTotal)}</b> set</> : 'Not started'}
              </span>
              <span className={styles.railChev} aria-hidden>›</span>
            </Link>
            <Link href={hrefs.budgetVsActual} className={styles.railRow}>
              <span className={`${styles.railDot} ${styles.railDotOlive}`} />
              <span className={styles.railName}>Budget vs. Actual</span>
              <span className={styles.railStat}>
                {summary.headroom == null
                  ? '—'
                  : overBudget
                    ? <span className={styles.railStatDanger}>{fmt(Math.abs(summary.headroom))} over</span>
                    : <><b>{fmt(summary.headroom)}</b> headroom</>}
              </span>
              <span className={styles.railChev} aria-hidden>›</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}