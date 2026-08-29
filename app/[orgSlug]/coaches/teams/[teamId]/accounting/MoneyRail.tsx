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
type RowKey = Exclude<keyof DashboardHrefs,
  'budgetStarter' | 'budgetGenerate' | 'payablesSchedule' | 'registerFrom'>;

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
  { step: 'Collect', keys: ['dues', 'fundraisers', 'sponsorships'] },
  /* ⚠ FOUR ROWS UNDER SPEND SINCE THE MONEY SPLIT (2026-08-16), and the group is still the widest
     — see the two-column note above: it stays atomic, so a step that grows keeps growing in one
     column rather than breaking across both. */
  /* ⚠ THREE ROWS AGAIN AFTER THE CLUB MERGE (money redesign P4, 2026-08-17): the two club rows —
     "Org Allocations" and "Payment Requests" — became one, because the tabs did. The group went
     4 → 3 and is no longer the widest. */
  { step: 'Spend',   keys: ['payables', 'transactions', 'club'] },
  { step: 'Review',  keys: ['budgetVsActual'] },
];
const MORE_KEYS: RowKey[] = ['fundraisers', 'sponsorships', 'club', 'budget', 'budgetVsActual'];

const danger = (text: string) => <span className={styles.railStatDanger}>{text}</span>;

/* One entry per surface — dot, name and stat together, so adding a Money screen is
 * one map entry rather than three parallel lookups kept in step by hand. `Record<RowKey, …>`
 * makes that exhaustive: a new destination key fails the build until it has a row.
 *
 * ⚠ A DOT IS THE COLOUR OF THE CHIP YOU'LL SEE WHEN YOU ARRIVE (owner ruling 2026-08-15). This
 * comment used to say the dot was a money-direction LANE — green in, rust out, blue the org's
 * side — and mostly it still reads that way. But Sponsorships is money IN and is deliberately
 * BLUE, because that is the chip the Fundraising tab shows it under; a lane scheme would have
 * made it green and identical to the Fundraisers row one line above, which is the whole thing
 * the two rows exist to separate. The chip-match is the rule; the lane reading is a coincidence
 * that mostly holds.
 *
 * So Sponsorships and Allocations share blue, adjacent in the `more` variant, and that is
 * accepted: the row NAME carries the information and the dot only reinforces it — the same
 * reason the deutan ruling forbids colour from ever being the sole carrier. */
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
  /**
   * ⚠ TWO ROWS, NOT ONE (owner ruling 2026-08-15, revising the single combined row first
   * proposed). A drive and a sponsor answer different questions and are budgeted against separate
   * lines, so one merged figure could not tell a treasurer how much of the season families sold
   * for versus how much was given. What earns the second ROW specifically — rather than one row
   * with two figures in it — is that each opens the tab ALREADY FILTERED to its kind: a rail row
   * is a door, and two doors onto an identical view would be a second navigation system.
   *
   * The dots match the tab's own chips: green for drives, blue for sponsors.
   *
   * ⚠ "Fundraisers" here is CORRECT and is not the stale tab name. The TAB is "Fundraising"
   * because it holds both kinds; this row names one kind and opens the tab filtered to it. The
   * label that WAS stale — a single row called "Fundraisers" standing for the whole tab — is what
   * this split removed.
   */
  fundraisers: {
    dot: styles.railDotGood,
    name: 'Fundraisers',
    stat: s => s.fundraisers.driveRaised > 0
      ? <><b>{fmt(s.fundraisers.driveRaised)}</b> raised</>
      : s.fundraisers.activeCount > 0
        ? <>{s.fundraisers.activeCount} active</>
        : <>None yet · <b>start one</b></>,
  },
  sponsorships: {
    dot: styles.railDotBlue,
    name: 'Sponsorships',
    // ⚠ A PLEDGE RIDES ALONGSIDE THE MONEY, NEVER INSIDE IT — the same rule the tab's own summary
    // keeps. "$500 · $2,000 pledged" is honest; "$2,500" would be a season flattering itself with
    // a cheque nobody has received.
    stat: s => {
      const { sponsorReceived, sponsorPledged, sponsorCount, sponsorPledgesPastDue } = s.fundraisers;
      // Shows at ZERO, the way the drives row above introduces itself — a coach who has never
      // recorded a sponsor is exactly the coach who does not know they can.
      if (sponsorCount === 0) return <>None yet · <b>add one</b></>;
      return (
        <>
          {sponsorReceived > 0 ? <><b>{fmt(sponsorReceived)}</b> in</> : <>{sponsorCount} recorded</>}
          {sponsorPledged > 0.005 && <> · {fmt(sponsorPledged)} pledged</>}
          {/* Q13's one quiet clause: only once a promise's expected-by has actually passed. */}
          {(sponsorPledgesPastDue ?? 0) > 0 && (
            <> · {sponsorPledgesPastDue === 1 ? '1 past its expected date' : `${sponsorPledgesPastDue} past their expected dates`}</>
          )}
        </>
      );
    },
  },
  /**
   * ⚠ ONE ROW BECAME TWO (Money split P1, 2026-08-16), and the old row is why. "Expenses &
   * Payables" had to say "<b>$4,120</b> paid · 3 due" — two unrelated facts about two different
   * questions, sharing one line because they shared one screen. The dues row's rule ("the alert
   * rides ALONGSIDE the money, never instead of it") was being used to cram a whole second surface
   * into a qualifier. Now each row answers its own question and neither has to compete.
   */
  /* ⚖ TWO ROWS, ONE TAB since the fold (2026-08-28) — the Fundraisers/Sponsorships precedent:
     each row answers its own question and lands on its own VIEW of the one Ledger. */
  transactions: {
    dot: styles.railDotRust,
    name: 'Ledger',
    /**
     * ⚠ THE ROW SPEAKS IN THE REGISTER'S OWN TWO COLUMNS (money redesign P3), and that is NOT the
     * two-unrelated-facts problem the note above describes. "$4,120 paid · 3 due" crammed two
     * questions about two different screens onto one line; out-and-in is ONE question — what has
     * moved this season — answered the way the book itself answers it.
     *
     * ⚠ It also stopped being true as "paid". `expenses.paidTotal` is the season's SPEND, which
     * includes costs a family paid the vendor directly, so it never was what the register's Money
     * out column adds to. And the tab now holds arrivals as well, which that figure cannot see.
     */
    stat: s => (s.moneyIn.total === 0 && s.moneyOut.total === 0
      ? 'Nothing yet'
      : <><b>{fmt(s.moneyOut.total)}</b> out · <b>{fmt(s.moneyIn.total)}</b> in</>),
  },
  payables: {
    dot: styles.railDotRust,
    name: 'Bills',
    /* ⚠ THE COUNT IS THE FACT HERE, not a qualifier on someone else's figure — this row exists to
       answer "is anything coming due?", so an empty answer is good news and says so plainly rather
       than reading as missing data. */
    stat: s => (s.expenses.upcomingDueCount > 0
      ? danger(`${s.expenses.upcomingDueCount} coming due`)
      : 'Nothing due'),
  },
  /* ⚠ ONE ROW WHERE TWO WERE (P4). The stat has to carry both halves of the relationship now, so it
     leads with the money OWED — the only figure with a due date attached — and appends what is still
     with the club when there is any. A pending request is deliberately a COUNT, never a dollar sum
     in this position: the rail's other money figures are all cash the team actually holds or owes,
     and a dollar amount here would read as a fourth one. */
  club: {
    dot: styles.railDotBlue,
    name: 'Club',
    stat: s => {
      const pending = s.paymentRequests.pendingCount;
      const awaiting = pending > 0
        ? <> · <b>{pending}</b> awaiting</>
        : null;
      if (s.allocations.count === 0) {
        return pending > 0 ? <><b>{pending}</b> awaiting the club</> : 'Nothing owed or asked';
      }
      return (
        <>
          <b>{fmt(s.allocations.outstanding)}</b> outstanding
          {s.allocations.overdueCount > 0 && <> · {danger(`${s.allocations.overdueCount} overdue`)}</>}
          {awaiting}
        </>
      );
    },
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
