'use client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import UpcomingPayablesPanel from '@/components/accounting/UpcomingPayablesPanel';
import { fmt, type MoneySummary, type DashboardHrefs } from '@/lib/coach-money-summary';
import MoneyRail from './MoneyRail';
import styles from '../../../coaches.module.css';

/* Setup-stage Money Overview (`stage === 'plan' | 'collect'`): the anchor card that
 * names the coach's next move, the headline tiles once there is cash to report, the
 * forward look once something can fall due, and the rail.
 *
 * The 1·Plan → 4·Review card stack that used to sit at the bottom is GONE (owner
 * ruling 2026-08-12): it was a second navigation system one line under the tab bar,
 * and on a team with nothing entered every card in it read "nothing yet". The
 * season's order survives as the rail's row order.
 *
 * This is the sibling of OverviewDashboard, not a fragment of the hub page — both
 * shapes are now a component the page picks between, and both end in the same rail. */

interface Props {
  summary: MoneySummary;
  hrefs: DashboardHrefs;
  /** Roster lives outside Money, so its href can't come from the section map. */
  rosterHref: string;
  canWrite: boolean;
  /** Archived seasons: no forward-looking panel — same rule as the operate ledger. */
  showPayables: boolean;
  payablesApiUrl: string;
}

/** One "right now" card, one lime CTA max (earned-lime rule). The operate stage
 *  renders OverviewDashboard instead — its old operate sub-states (overdue →
 *  never-paid → on-track) live on as the Collections card's chip. */
function Anchor({ summary, hrefs, rosterHref, canWrite }: Pick<Props, 'summary' | 'hrefs' | 'rosterHref' | 'canWrite'>) {
  const { budget } = summary;

  if (summary.stage === 'plan') {
    return (
      <div className={`${styles.nowCard} ${styles.nowPreseason}`}>
        <p className={styles.nowEyebrow}>Money · Getting started</p>
        <p className={styles.nowHeadline}>Start with your season budget</p>
        <p className={styles.nowMeta}>
          Estimate the season&apos;s costs, turn them into player dues in one click, then track
          every dollar against the plan. Plan → Collect → Spend → Review.
        </p>
        {/* The value paragraph is desktop-only. On a phone it pushed the lime CTA — the
            one thing this card is FOR — below the fold on the screen a coach opens first;
            the same trim the Overview's One Thing card took on 2026-08-12. */}
        <p className={`${styles.nowMeta} ${styles.nowMetaWide}`}>
          Dues you set here drive the automatic payment reminders families receive, show up on your
          Overview and in Insights as &ldquo;Where&apos;s the money?&rdquo;, and are prefilled when you accept
          a player from tryouts — so you never chase a spreadsheet.
        </p>
        {canWrite ? (
          <div className={styles.nowActions}>
            {/* Deep-links into the budget starter (Chunk G) — same copy, but the coach
                lands in the questions instead of on a blank page. */}
            <Link href={hrefs.budgetStarter} className="btn btn-lime btn-sm">Build your budget <ArrowRight size={14} /></Link>
            <Link href={hrefs.dues} className={styles.nowSecondary}>Skip — set dues directly <ArrowRight size={13} /></Link>
          </div>
        ) : (
          <p className={styles.nowMeta}>
            No budget or dues have been set up for this team yet. Building the budget and setting dues
            is the head coach&apos;s job — you&apos;ll see the numbers here once they do.
          </p>
        )}
      </div>
    );
  }

  // Explicit, not by elimination. The page only mounts SetupOverview for a non-operate
  // season, so today `stage` can only be 'collect' here — but the type still admits
  // 'operate', and a future caller that passed one would get "generate installments"
  // copy shown to a team that already has them. The old renderAnchor returned null for
  // anything it did not recognise; that guarantee is kept (review, 2026-08-12).
  if (summary.stage !== 'collect') return null;

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
            ? `You've estimated ${fmt(budget.seasonTotal ?? 0)} for the season. Itemize it to unlock Budget vs. Actual tracking — or generate player dues right away.`
            : `${fmt(budget.effectiveTotal)} across ${budget.rosterCount} players${budget.perPlayer != null ? ` ≈ ${fmt(budget.perPlayer)} each` : ''}. Generate every player's installment schedule in one click.`}
      </p>
      {canWrite && (
        <div className={styles.nowActions}>
          {needsRoster ? (
            <Link href={rosterHref} className="btn btn-lime btn-sm">Open roster <ArrowRight size={14} /></Link>
          ) : needsLines ? (
            <Link href={hrefs.budget} className="btn btn-lime btn-sm">Add line items <ArrowRight size={14} /></Link>
          ) : (
            <Link href={hrefs.budgetGenerate} className="btn btn-lime btn-sm">Generate installments <ArrowRight size={14} /></Link>
          )}
          <Link href={hrefs.dues} className={styles.nowSecondary}>Set dues manually <ArrowRight size={13} /></Link>
        </div>
      )}
    </div>
  );
}

export default function SetupOverview({ summary, hrefs, rosterHref, canWrite, showPayables, payablesApiUrl }: Props) {
  // Has any money actually moved? Until it has, the four headline tiles read
  // $0 · $0 · $0 · — , which is four cards restating what the anchor card directly
  // above them already says, and the cash-basis caveat qualifies numbers that don't
  // exist yet. They return the moment there is something to report (owner ruling
  // 2026-08-12). Deliberately NOT keyed on the budget: a plan is not cash.
  const cashHasMoved = summary.moneyIn.total > 0 || summary.moneyOut.total > 0;

  return (
    <>
      <Anchor summary={summary} hrefs={hrefs} rosterHref={rosterHref} canWrite={canWrite} />

      {/* Cash-honest headline numbers — same paid-only basis as Budget vs. Actual.
          The basis is stated ONCE above the row (review f4-6). It used to be bolted onto
          Money Out alone as "(paid only)", while Money In carried no caveat despite being
          equally collected-only and On Hand silently inherited both — so the row read as
          "committed revenue vs. cash spent" when it is cash on both sides.
          The caveat travels WITH the tiles it qualifies: no tiles, no sentence. */}
      {cashHasMoved && (
        <>
          <p className={styles.moneySummaryBasis}>
            Cash actually received and actually paid — not what&apos;s still owed.{' '}
            <Link href={hrefs.dues} className={`${styles.linkBtn} ${styles.linkBtnAccent}`}>
              See what&apos;s outstanding <ArrowRight size={12} aria-hidden />
            </Link>
          </p>
          <div className={styles.summaryGrid} style={{ marginBottom: '1.5rem' }}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Money In</span>
              <span className={styles.summaryCardValue} style={{ color: summary.moneyIn.total > 0 ? 'var(--success)' : undefined }}>
                {fmt(summary.moneyIn.total)}
              </span>
              <span className={styles.moneySummarySub}>dues + fundraising{summary.moneyIn.orgFunding > 0 ? ' + org' : ''} received</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Money Out</span>
              <span className={styles.summaryCardValue} style={{ color: summary.moneyOut.total > 0 ? 'var(--danger)' : undefined }}>
                {fmt(summary.moneyOut.total)}
              </span>
              <span className={styles.moneySummarySub}>expenses{summary.orgLinked ? ' + org payments' : ''} paid</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>On Hand</span>
              <span className={styles.summaryCardValue} style={{ color: summary.onHand >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {fmt(summary.onHand)}
              </span>
              <span className={styles.moneySummarySub}>received − paid</span>
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
        </>
      )}

      {/* Same archive rule as the dashboard's ledger: forward-looking preview,
          active-year API — a read-only season doesn't offer it.
          `hideWhenEmpty` makes it disappear on a team with nothing falling due, rather
          than spending a panel to say "Nothing due" three times. The PANEL decides that,
          from its own fetch — the caller cannot, because it does not know what the lanes
          hold (review, 2026-08-12: an org allocation left unpaid from a previous season
          is real money the summary's season-scoped counts cannot see). */}
      {showPayables && (
        /* `.payablesSlot` spaces itself only while it HAS a panel: `hideWhenEmpty` renders
            null, and a slot that kept its margin would leave 24px of dead air between the
            tiles and the rail on exactly the empty team this whole change is about. */
        <div className={styles.payablesSlot}>
          <UpcomingPayablesPanel
            apiUrl={payablesApiUrl}
            hideWhenEmpty
            /* This panel is a 30/60/90-day preview; the schedule tab is every commitment (chunk H). */
            fullScheduleUrl={hrefs.payablesSchedule}
          />
        </div>
      )}

      {/* The season's four steps survive as ROW ORDER plus three quiet markers inside
          one index — not as four headed sections of drill-in cards that repeated the
          tab bar sitting directly above them. Same component the operating-season
          dashboard ends with, so the Overview keeps one shape from a team's first day
          to its last game. */}
      <MoneyRail summary={summary} hrefs={hrefs} variant="index" />
    </>
  );
}
