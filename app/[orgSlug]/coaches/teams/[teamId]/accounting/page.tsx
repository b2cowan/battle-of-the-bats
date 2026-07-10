'use client';
import { useState, useEffect, useCallback, use, type ReactNode } from 'react';
import Link from 'next/link';
import {
  DollarSign, Users, Receipt, Building2, BarChart3, TrendingUp, Gift,
  ArrowLeftRight, ArrowRight, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import UpcomingPayablesPanel from '@/components/accounting/UpcomingPayablesPanel';
import styles from '../../../coaches.module.css';

interface MoneySummary {
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

function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-$${abs}` : `$${abs}`;
}

export default function CoachesAccountingPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();

  const [summary, setSummary] = useState<MoneySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/money-summary`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      setSummary(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load money summary.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { load(); }, [load]);

  if (ctxLoading) return <p className={styles.muted}>Loading…</p>;
  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  const canWrite = assignment.capabilities.money === 'write';

  // ── Stage anchor content ─────────────────────────────────────────────────
  // One "right now" card, one lime CTA max (earned-lime rule). Operate splits
  // into sub-states by urgency: overdue → never-paid → all-collected → on-track.
  function renderAnchor(s: MoneySummary) {
    const { budget, dues } = s;

    if (s.stage === 'plan') {
      return (
        <div className={`${styles.nowCard} ${styles.nowPreseason}`}>
          <p className={styles.nowEyebrow}>Money · Getting started</p>
          <p className={styles.nowHeadline}>Start with your season budget</p>
          <p className={styles.nowMeta}>
            Estimate the season&apos;s costs, turn them into player dues in one click, then track
            every dollar against the plan. Plan → Collect → Spend → Review.
          </p>
          {canWrite ? (
            <div className={styles.nowActions}>
              <Link href={`${base}/accounting/budget`} className="btn btn-lime btn-sm">Build your budget <ArrowRight size={14} /></Link>
              <Link href={`${base}/accounting/dues`} className={styles.nowSecondary}>Skip — set dues directly <ArrowRight size={13} /></Link>
            </div>
          ) : (
            <p className={styles.nowMeta}>No budget or dues have been set up for this team yet.</p>
          )}
        </div>
      );
    }

    if (s.stage === 'collect') {
      const needsRoster = budget.rosterCount === 0;
      const needsLines = budget.lineCount === 0;
      return (
        <div className={`${styles.nowCard} ${styles.nowPreseason}`}>
          <p className={styles.nowEyebrow}>Budget ready</p>
          <p className={styles.nowHeadline}>
            {needsRoster ? 'Add your roster to assign dues'
              : needsLines ? 'Break your budget into line items'
              : 'Turn your plan into player dues'}
          </p>
          <p className={styles.nowMeta}>
            {needsRoster
              ? `Your ${fmt(budget.effectiveTotal)} budget is set. Add players to the roster, then generate everyone's payment schedule in one click.`
              : needsLines
                ? `You've set a ${fmt(budget.seasonTotal ?? 0)} season total. Itemize it to unlock Budget vs. Actual tracking — or generate player dues right away.`
                : `${fmt(budget.effectiveTotal)} across ${budget.rosterCount} players${budget.perPlayer != null ? ` ≈ ${fmt(budget.perPlayer)} each` : ''}. Generate every player's installment schedule in one click.`}
          </p>
          {canWrite && (
            <div className={styles.nowActions}>
              {needsRoster ? (
                <Link href={`${base}/roster`} className="btn btn-lime btn-sm">Open roster <ArrowRight size={14} /></Link>
              ) : needsLines ? (
                <Link href={`${base}/accounting/budget`} className="btn btn-lime btn-sm">Add line items <ArrowRight size={14} /></Link>
              ) : (
                <Link href={`${base}/accounting/budget?generate=1`} className="btn btn-lime btn-sm">Generate installments <ArrowRight size={14} /></Link>
              )}
              <Link href={`${base}/accounting/dues`} className={styles.nowSecondary}>Set dues manually <ArrowRight size={13} /></Link>
            </div>
          )}
        </div>
      );
    }

    // operate
    const pct = dues.expected > 0 ? Math.round((dues.collected / dues.expected) * 100) : 0;
    if (dues.overdueCount > 0) {
      return (
        <div className={`${styles.nowCard} ${styles.nowGameDay}`} style={{ borderLeftColor: 'var(--danger)' }}>
          <p className={styles.nowEyebrow}>Collections</p>
          <p className={styles.nowHeadline}>
            {dues.overdueCount} {dues.overdueCount === 1 ? 'player is' : 'players are'} overdue
          </p>
          <p className={styles.nowMeta}>{fmt(dues.overdueAmount)} past due · {fmt(dues.collected)} of {fmt(dues.expected)} collected ({pct}%)</p>
          <div className={styles.nowActions}>
            {canWrite
              ? <Link href={`${base}/accounting/dues`} className="btn btn-lime btn-sm">Send reminders <ArrowRight size={14} /></Link>
              : <Link href={`${base}/accounting/dues`} className={styles.nowSecondary}>Open Player Dues <ArrowRight size={13} /></Link>}
          </div>
        </div>
      );
    }
    if (dues.neverPaidCount > 0) {
      return (
        <div className={`${styles.nowCard} ${styles.nowInSeason}`} style={{ borderLeftColor: 'var(--warning)' }}>
          <p className={styles.nowEyebrow}>Collections</p>
          <p className={styles.nowHeadline}>
            {dues.neverPaidCount} {dues.neverPaidCount === 1 ? 'player hasn’t' : 'players haven’t'} paid anything yet
          </p>
          <p className={styles.nowMeta}>{fmt(dues.collected)} of {fmt(dues.expected)} collected ({pct}%). Nudge families with one tap from Player Dues.</p>
          <div className={styles.nowActions}>
            <Link href={`${base}/accounting/dues`} className={canWrite ? 'btn btn-lime btn-sm' : styles.nowSecondary}>
              Review dues <ArrowRight size={canWrite ? 14 : 13} />
            </Link>
          </div>
        </div>
      );
    }
    const allCollected = dues.expected > 0 && dues.outstanding <= 0.005;
    return (
      <div className={`${styles.nowCard} ${styles.nowInSeason}`}>
        <p className={styles.nowEyebrow}>This season</p>
        <p className={styles.nowHeadline}>{allCollected ? 'All dues collected' : 'You’re on track'}</p>
        <p className={styles.nowMeta}>
          {allCollected
            ? `Every installment is in — ${fmt(dues.collected)} collected. Keep logging expenses to see how you land against the plan.`
            : `${fmt(dues.collected)} of ${fmt(dues.expected)} collected (${pct}%).`}
        </p>
        {(s.headroom != null || s.expenses.upcomingDueCount > 0) && (
          <>
            <div className={styles.nowDivider} />
            <div className={styles.nowStatsRow}>
              {s.headroom != null && (
                s.headroom >= 0
                  ? <span className={styles.nowStatOk}>{fmt(s.headroom)} headroom</span>
                  : <span className={styles.nowStatWarn}><AlertTriangle size={14} aria-hidden /> {fmt(Math.abs(s.headroom))} over budget</span>
              )}
              {s.expenses.upcomingDueCount > 0 && (
                <span className={styles.nowStatMuted}>{s.expenses.upcomingDueCount} payable{s.expenses.upcomingDueCount === 1 ? '' : 's'} due soon</span>
              )}
            </div>
          </>
        )}
        <div className={styles.nowActions}>
          {canWrite && <Link href={`${base}/accounting/expenses`} className="btn btn-lime btn-sm">Log an expense <ArrowRight size={14} /></Link>}
          <Link href={`${base}/accounting/budget-vs-actual`} className={styles.nowSecondary}>Budget vs. Actual <ArrowRight size={13} /></Link>
        </div>
      </div>
    );
  }

  // ── Grouped drill-in cards ───────────────────────────────────────────────
  function card(
    href: string,
    icon: ReactNode,
    title: string,
    desc: string,
    stat: ReactNode,
  ) {
    return (
      <Link href={href} className={styles.moneyCard}>
        <span className={styles.moneyCardIcon}>{icon}</span>
        <span className={styles.moneyCardBody}>
          <p className={styles.moneyCardTitle}>{title}</p>
          <p className={styles.moneyCardDesc}>{desc}</p>
        </span>
        <span className={styles.moneyCardStat}>{stat}</span>
        <ChevronRight size={16} className={styles.moneyCardChevron} aria-hidden />
      </Link>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><DollarSign size={22} /></div>
          <div>
            <nav className={styles.breadcrumb}>
              <Link href={`/${orgSlug}/coaches`}>Portal</Link>
              <span>/</span>
              <Link href={base}>{assignment.teamName}</Link>
              <span>/</span>
              <span>Money</span>
            </nav>
            <h1 className={styles.pageTitle}>Money</h1>
            <p className={styles.pageSub}>{assignment.programYearName}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : summary && (
        <>
          {renderAnchor(summary)}

          {/* Cash-honest headline numbers — same paid-only basis as Budget vs. Actual. */}
          <div className={styles.summaryGrid} style={{ marginBottom: '1.5rem' }}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Money In</span>
              <span className={styles.summaryCardValue} style={{ color: summary.moneyIn.total > 0 ? 'var(--success)' : undefined }}>
                {fmt(summary.moneyIn.total)}
              </span>
              <span className={styles.moneySummarySub}>dues + fundraising{summary.moneyIn.orgFunding > 0 ? ' + org' : ''}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Money Out</span>
              <span className={styles.summaryCardValue} style={{ color: summary.moneyOut.total > 0 ? 'var(--danger)' : undefined }}>
                {fmt(summary.moneyOut.total)}
              </span>
              <span className={styles.moneySummarySub}>expenses{summary.orgLinked ? ' + org payments' : ''} (paid only)</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>On Hand</span>
              <span className={styles.summaryCardValue} style={{ color: summary.onHand >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {fmt(summary.onHand)}
              </span>
              <span className={styles.moneySummarySub}>in − out</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Budget Headroom</span>
              {summary.headroom == null ? (
                <>
                  <span className={styles.summaryCardValue} style={{ color: 'var(--white-40)' }}>—</span>
                  <span className={styles.moneySummarySub}>no budget yet</span>
                </>
              ) : (
                <>
                  <span className={styles.summaryCardValue} style={{ color: summary.headroom >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {fmt(summary.headroom)}
                  </span>
                  <span className={styles.moneySummarySub}>vs {fmt(summary.budget.effectiveTotal)} budget</span>
                </>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <UpcomingPayablesPanel
              apiUrl={`/api/coaches/${orgSlug}/teams/${teamId}/upcoming-payables`}
            />
          </div>

          {/* Plan */}
          <div className={styles.moneyGroup}>
            <div className={styles.moneyGroupHead}>
              <h2 className={styles.moneyGroupTitle}>1 · Plan</h2>
              <p className={styles.moneyGroupHint}>Estimate the season</p>
            </div>
            <div className={styles.moneyCards}>
              {card(
                `${base}/accounting/budget`,
                <BarChart3 size={20} style={{ color: 'var(--success)' }} />,
                'Season Budget Plan',
                'Estimate costs by category, set a season total, generate player installments',
                summary.budget.effectiveTotal > 0 ? (
                  <>
                    <span className={styles.moneyCardStatValue}>{fmt(summary.budget.effectiveTotal)}</span>
                    <span className={styles.moneyCardStatSub}>
                      {summary.budget.perPlayer != null ? `${fmt(summary.budget.perPlayer)} / player` : `${summary.budget.lineCount} line item${summary.budget.lineCount === 1 ? '' : 's'}`}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={styles.moneyCardStatValue} style={{ color: 'var(--white-40)' }}>Not started</span>
                    <span className={styles.moneyCardStatSub}>Start here</span>
                  </>
                ),
              )}
            </div>
          </div>

          {/* Collect */}
          <div className={styles.moneyGroup}>
            <div className={styles.moneyGroupHead}>
              <h2 className={styles.moneyGroupTitle}>2 · Collect</h2>
              <p className={styles.moneyGroupHint}>Money coming in</p>
            </div>
            <div className={styles.moneyCards}>
              {card(
                `${base}/accounting/dues`,
                <Users size={20} style={{ color: '#a855f7' }} />,
                'Player Dues',
                'Installment schedules, payments, credits, reminders',
                summary.dues.schedulesCount > 0 ? (
                  <>
                    <span className={styles.moneyCardStatValue}>
                      <span className={styles.moneyStatGood}>{fmt(summary.dues.collected)}</span> of {fmt(summary.dues.expected)}
                    </span>
                    {summary.dues.overdueCount > 0 ? (
                      <span className={styles.moneyStatDangerChip}><AlertTriangle size={11} aria-hidden /> {summary.dues.overdueCount} overdue</span>
                    ) : summary.dues.neverPaidCount > 0 ? (
                      <span className={styles.moneyStatWarnChip}>{summary.dues.neverPaidCount} unpaid</span>
                    ) : (
                      <span className={styles.moneyCardStatSub}>collected</span>
                    )}
                  </>
                ) : (
                  <>
                    <span className={styles.moneyCardStatValue} style={{ color: 'var(--white-40)' }}>Not set</span>
                    <span className={styles.moneyCardStatSub}>Generate from your budget</span>
                  </>
                ),
              )}
              {card(
                `${base}/accounting/fundraisers`,
                <Gift size={20} style={{ color: 'var(--success)' }} />,
                'Fundraisers',
                'Per-player fundraising — rebates credit dues automatically',
                summary.fundraisers.totalRaised > 0 ? (
                  <>
                    <span className={`${styles.moneyCardStatValue} ${styles.moneyStatGood}`}>{fmt(summary.fundraisers.totalRaised)} raised</span>
                    <span className={styles.moneyCardStatSub}>{fmt(summary.fundraisers.creditsIssued)} credited to dues</span>
                  </>
                ) : (
                  <span className={styles.moneyCardStatValue} style={{ color: 'var(--white-40)' }}>
                    {summary.fundraisers.activeCount > 0 ? `${summary.fundraisers.activeCount} active` : 'None yet'}
                  </span>
                ),
              )}
            </div>
          </div>

          {/* Spend */}
          <div className={styles.moneyGroup}>
            <div className={styles.moneyGroupHead}>
              <h2 className={styles.moneyGroupTitle}>3 · Spend</h2>
              <p className={styles.moneyGroupHint}>Money going out</p>
            </div>
            <div className={styles.moneyCards}>
              {card(
                `${base}/accounting/expenses`,
                <Receipt size={20} style={{ color: '#f97316' }} />,
                'Expenses & Tournament Payables',
                'Log spending by category, track tournament deposits and balances',
                summary.expenses.loggedCount > 0 ? (
                  <>
                    <span className={styles.moneyCardStatValue}>{fmt(summary.expenses.paidTotal)} paid</span>
                    {summary.expenses.upcomingDueCount > 0 ? (
                      <span className={styles.moneyStatWarnChip}>{summary.expenses.upcomingDueCount} due soon</span>
                    ) : (
                      <span className={styles.moneyCardStatSub}>{summary.expenses.loggedCount} logged</span>
                    )}
                  </>
                ) : (
                  <span className={styles.moneyCardStatValue} style={{ color: 'var(--white-40)' }}>None logged</span>
                ),
              )}
              {summary.orgLinked && card(
                `${base}/accounting/allocations`,
                <Building2 size={20} style={{ color: 'var(--blueprint-blue)' }} />,
                'Org Allocations',
                'Costs your organization has allocated to this team',
                summary.allocations.count > 0 ? (
                  <>
                    <span className={styles.moneyCardStatValue}>{fmt(summary.allocations.outstanding)} outstanding</span>
                    {summary.allocations.overdueCount > 0
                      ? <span className={styles.moneyStatDangerChip}><AlertTriangle size={11} aria-hidden /> {summary.allocations.overdueCount} overdue</span>
                      : <span className={styles.moneyCardStatSub}>of {fmt(summary.allocations.totalAllocated)}</span>}
                  </>
                ) : (
                  <span className={styles.moneyCardStatValue} style={{ color: 'var(--white-40)' }}>None assigned</span>
                ),
              )}
              {summary.orgLinked && card(
                `${base}/accounting/payment-requests`,
                <ArrowLeftRight size={20} style={{ color: 'var(--warning)' }} />,
                'Payment Requests',
                'Pay the org or request reimbursement — admin approves',
                summary.paymentRequests.pendingCount > 0 ? (
                  <span className={styles.moneyCardStatValue}>{summary.paymentRequests.pendingCount} pending</span>
                ) : (
                  <span className={styles.moneyCardStatValue} style={{ color: 'var(--white-40)' }}>None pending</span>
                ),
              )}
            </div>
          </div>

          {/* Review */}
          <div className={styles.moneyGroup}>
            <div className={styles.moneyGroupHead}>
              <h2 className={styles.moneyGroupTitle}>4 · Review</h2>
              <p className={styles.moneyGroupHint}>How you&apos;re tracking</p>
            </div>
            <div className={styles.moneyCards}>
              {card(
                `${base}/accounting/budget-vs-actual`,
                <TrendingUp size={20} style={{ color: 'var(--blueprint-blue)' }} />,
                'Budget vs. Actual',
                'Headroom, category variance, monthly trends, export',
                summary.headroom != null ? (
                  <>
                    <span className={`${styles.moneyCardStatValue} ${summary.headroom >= 0 ? styles.moneyStatGood : styles.moneyStatBad}`}>
                      {fmt(summary.headroom)}
                    </span>
                    <span className={styles.moneyCardStatSub}>{summary.headroom >= 0 ? 'headroom' : 'over budget'}</span>
                  </>
                ) : (
                  <>
                    <span className={styles.moneyCardStatValue} style={{ color: 'var(--white-40)' }}>—</span>
                    <span className={styles.moneyCardStatSub}>Needs a budget plan</span>
                  </>
                ),
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
