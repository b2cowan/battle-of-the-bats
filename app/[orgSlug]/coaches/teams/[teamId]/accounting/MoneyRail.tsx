'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { fmt, type MoneySummary, type DashboardHrefs } from '@/lib/coach-money-summary';
import styles from './overview-dashboard.module.css';

/* One line, one live stat, one chevron per Money surface — the Overview's index.
 *
 * It renders in BOTH Overview shapes, which is the point (owner ruling 2026-08-12):
 *   'more'  — operate stage. Only the surfaces the three story cards don't already
 *             own; the cards are the headline, this is the remainder.
 *   'index' — plan/collect stages, where it REPLACED the 1·Plan → 4·Review card
 *             stack. It then carries every surface, grouped under the four step
 *             markers, so a coach setting up still meets the season's order —
 *             but as row order rather than four headed sections competing with
 *             the tab bar one line above.
 *
 * Navigation itself belongs to the tab bar. A row's job is the STAT; the chevron
 * is a convenience, not a second set of doors. */

/** A row IS a destination, so the row keys are the destination keys — minus the two
 *  hrefs that are deep-links into a surface rather than the surface itself. Derived
 *  rather than re-listed, so a row can never name a tab that isn't addressable. */
type RowKey = Exclude<keyof DashboardHrefs, 'budgetStarter' | 'budgetGenerate' | 'expensesSchedule'>;

/** Journey order for the setup index; the operate rail keeps the order it shipped with.
 *
 *  ⚠ Every step here holds at least one row that `DashboardHrefs` makes REQUIRED
 *  (budget, dues, fundraisers, expenses, budgetVsActual), so all four groups always
 *  survive the href filter below — only Spend's row count varies, 3 → 1, when a team
 *  isn't org-linked. That matters to the two-column CSS: a labelled group is atomic
 *  there (`break-inside: avoid`), so if a step ever became wholly optional and only
 *  ONE group survived, the rail would put it all in column one and leave column two
 *  blank. Adding an all-optional step means revisiting that rule, not just this list. */
const INDEX_STEPS: { step: string; keys: RowKey[] }[] = [
  { step: 'Plan',    keys: ['budget'] },
  { step: 'Collect', keys: ['dues', 'fundraisers'] },
  { step: 'Spend',   keys: ['expenses', 'allocations', 'paymentRequests'] },
  { step: 'Review',  keys: ['budgetVsActual'] },
];
const MORE_KEYS: RowKey[] = ['fundraisers', 'allocations', 'paymentRequests', 'budget', 'budgetVsActual'];

const danger = (text: string) => <span className={styles.railStatDanger}>{text}</span>;

/* One entry per surface — dot, name and stat together, so adding a Money screen is
 * one map entry rather than three parallel lookups kept in step by hand. `Record<RowKey, …>`
 * makes that exhaustive: a new destination key fails the build until it has a row.
 *
 * Dot colour is a lane, not decoration: green = money in, rust = money out,
 * blue = the org's side, plum/olive = planning and review. */
const ROWS: Record<RowKey, { dot: string; name: string; stat: (s: MoneySummary) => ReactNode }> = {
  budget: {
    dot: styles.railDotPlum,
    name: 'Season Budget Plan',
    stat: s => (s.budget.effectiveTotal > 0 ? <><b>{fmt(s.budget.effectiveTotal)}</b> set</> : 'Not started'),
  },
  dues: {
    dot: styles.railDotGood,
    name: 'Player Dues',
    // The alert rides ALONGSIDE the money, never instead of it — the drill-in cards this
    // replaced showed the amount and the overdue chip together, and a row that swaps
    // "$400 of $900" for a bare "2 overdue" answers a question nobody asked while
    // dropping the one they did (review, 2026-08-12).
    stat: s => {
      if (s.dues.schedulesCount === 0) return 'Not set';
      // Schedules exist but carry no installments yet — "$0.00 of $0.00" would read as
      // a collection failure rather than an unfinished setup. Same distinction the
      // Collections card makes with its footnote.
      if (s.dues.expected <= 0) return 'No installments yet';
      return (
        <>
          <b>{fmt(s.dues.collected)}</b> of {fmt(s.dues.expected)}
          {s.dues.overdueCount > 0 && <> · {danger(`${s.dues.overdueCount} overdue`)}</>}
        </>
      );
    },
  },
  fundraisers: {
    dot: styles.railDotGood,
    name: 'Fundraisers',
    stat: s => s.fundraisers.totalRaised > 0
      ? <><b>{fmt(s.fundraisers.totalRaised)}</b> raised</>
      : s.fundraisers.activeCount > 0
        ? <>{s.fundraisers.activeCount} active</>
        : <>None yet · <b>start one</b></>,
  },
  expenses: {
    dot: styles.railDotRust,
    name: 'Expenses & Payables',
    // Same rule as the dues row: what's been spent stays visible when something is due.
    stat: s => {
      if (s.expenses.loggedCount === 0) return 'None logged';
      return (
        <>
          <b>{fmt(s.expenses.paidTotal)}</b> paid
          {s.expenses.upcomingDueCount > 0 && <> · {danger(`${s.expenses.upcomingDueCount} due`)}</>}
        </>
      );
    },
  },
  allocations: {
    dot: styles.railDotBlue,
    name: 'Org Allocations',
    // Same rule again: the amount owed is the fact, the overdue count qualifies it.
    stat: s => {
      if (s.allocations.count === 0) return 'None assigned';
      return (
        <>
          <b>{fmt(s.allocations.outstanding)}</b> outstanding
          {s.allocations.overdueCount > 0 && <> · {danger(`${s.allocations.overdueCount} overdue`)}</>}
        </>
      );
    },
  },
  paymentRequests: {
    dot: styles.railDotRust,
    name: 'Payment Requests',
    stat: s => s.paymentRequests.pendingCount > 0
      ? <><b>{s.paymentRequests.pendingCount}</b> pending</>
      : 'None pending',
  },
  budgetVsActual: {
    dot: styles.railDotOlive,
    name: 'Budget vs. Actual',
    // "Needs a budget" rather than an em-dash: a dash reads as missing data, and
    // this is the one row whose emptiness has a cause the coach can act on.
    stat: s => s.headroom == null
      ? 'Needs a budget'
      : s.headroom < 0
        ? danger(`${fmt(Math.abs(s.headroom))} over`)
        : <><b>{fmt(s.headroom)}</b> headroom</>,
  },
};

interface Props {
  summary: MoneySummary;
  hrefs: DashboardHrefs;
  variant: 'index' | 'more';
}

export default function MoneyRail({ summary, hrefs, variant }: Props) {
  // Org-only rows follow their href: absent means the caller's gate said no.
  const groups = variant === 'index'
    ? INDEX_STEPS
      .map(g => ({ step: g.step as string | null, keys: g.keys.filter(k => hrefs[k]) }))
      .filter(g => g.keys.length > 0)
    : [{ step: null, keys: MORE_KEYS.filter(k => hrefs[k]) }];

  return (
    /* `railCard` makes this card the thing the two-column rule measures, not the
       viewport — the live operating dashboard hands this same component a ~362px
       slot beside the ledger, where one column is correct, while the setup and
       archived shapes hand it the full page column, where it is not. */
    <div className={`${styles.card} ${styles.railCard}`}>
      <div className={styles.eyeRow}>
        <span className={styles.eye}>{variant === 'index' ? 'Everything in Money' : 'More in Money'}</span>
      </div>
      <div className={styles.railCols}>
        {groups.map(g => (
          /* A labelled GROUP, not a heading: the owner ruling that removed the four headed
             sections was about visual weight, but the rows really are grouped, and a screen
             reader lost that when the <h2>s went. `role="group"` restores the structure
             without restoring the headings. */
          <div
            key={g.step ?? 'all'}
            className={styles.railGroup}
            {...(g.step ? { role: 'group', 'aria-labelledby': `money-rail-step-${g.step.toLowerCase()}` } : {})}
          >
            {g.step && <p className={styles.railStep} id={`money-rail-step-${g.step.toLowerCase()}`}>{g.step}</p>}
            {g.keys.map(key => (
              <Link key={key} href={hrefs[key]!} className={styles.railRow}>
                <span className={`${styles.railDot} ${ROWS[key].dot}`} />
                <span className={styles.railName}>{ROWS[key].name}</span>
                <span className={styles.railStat}>{ROWS[key].stat(summary)}</span>
                <span className={styles.railChev} aria-hidden>›</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
