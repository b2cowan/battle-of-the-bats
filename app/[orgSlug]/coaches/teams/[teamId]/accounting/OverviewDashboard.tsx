'use client';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import MoneyNextThirtyDays from './MoneyNextThirtyDays';
import MoneyRail from './MoneyRail';
import { fmt, type MoneySummary, type DashboardHrefs } from '@/lib/coach-money-summary';
import styles from './overview-dashboard.module.css';

/* Operate-stage Money Overview: three story cards (Collections / Cash / Budget),
 * the merged Next-N-days ledger, and the "More in Money" rail. A story card is
 * a fact's one home; the rail's Budget rows repeat two headline figures by
 * design — the rail is a complete tab index with a live stat per line, and a
 * gap there would read as "no data". The Budget card's plan-vs-actual rows
 * (approved mockup 64d49b0e, 2026-08-14) restate dues-collected and
 * fundraising-raised in BUDGET context for the same reason: the card's job is
 * "how is the plan tracking", and two of the plan's three funding streams live
 * elsewhere as their own facts. Deliberately no lime CTA and no write action
 * anywhere here (owner call 2026-08-11): the dashboard reports; acting happens
 * one click deeper — the dues row's "Generate installments" door is the same
 * kind of empty-state door the card already keeps for "no budget yet". */

interface Props {
  summary: MoneySummary;
  /** Absent on archived (read-only) seasons — the Next-N-days ledger is a
   *  forward-looking INSTRUMENT (owner ruling 2026-08-11): a finished season
   *  has no "next 30 days", and the API behind it only knows the active year,
   *  so rendering it in an archive showed TODAY's payments. No URL, no panel. */
  payablesApiUrl?: string;
  /** Org-only rows (Allocations, Payment Requests) render iff their href is
   *  present — one signal, owned by the caller that owns the gating rule. */
  hrefs: DashboardHrefs;
}

/* A slice a coach should SEE stays visible even when it rounds to a sliver. */
function segWidth(value: number, total: number): number {
  if (total <= 0 || value <= 0) return 0;
  return Math.max((value / total) * 100, 2);
}

/* ── Budget card: plan-vs-actual bars ──────────────────────────────────────
 * All three rows share ONE dollar scale (widths are % of the card, off the
 * same scaleMax), so "dues + fundraising together cover the plan" reads as
 * geometry rather than arithmetic the coach has to do. Track = the planned
 * amount; fill = the actual, capped at the track; anything past the plan is a
 * separate overrun segment beyond the track's end with a 2px gap. A BAD
 * overrun is striped, chipped and worded, never colour alone — the olive fill
 * and the danger red are near-identical to red-green colour-blind viewers
 * (measured ΔE 1.0 deutan), so colour cannot be asked to carry that verdict. */
function planBarWidths(actual: number, target: number, scaleMax: number) {
  const tw = target > 0 ? Math.max((target / scaleMax) * 100, 4) : 0;
  // No target at all (fundraising money raised with no goal budgeted): a plain
  // fill sized on the shared scale — NOT the overrun segment, whose "past the
  // plan" grammar needs a plan to be past (review finding).
  if (tw <= 0) {
    return { tw: 0, fillW: actual > 0 ? Math.max((actual / scaleMax) * 100, 2) : 0, overW: 0 };
  }
  const fillW = Math.min(actual / target, 1) * tw;
  const overRaw = actual > target + 0.005 ? Math.max(((actual - target) / scaleMax) * 100, 2) : 0;
  const overW = Math.min(overRaw, Math.max(100 - tw - 2, 0));
  return { tw, fillW, overW };
}

function PlanBar({ actual, target, scaleMax, overGood }: {
  actual: number; target: number; scaleMax: number;
  /** Past-the-plan is GOOD here (a beaten fundraising goal): plain fill colour,
   *  no stripe — beating a goal must never wear the over-budget clothes. */
  overGood?: boolean;
}) {
  const { tw, fillW, overW } = planBarWidths(actual, target, scaleMax);
  return (
    <div className={styles.planBar} aria-hidden>
      {tw > 0 && <span className={styles.planTrack} style={{ width: `${tw}%` }} />}
      {fillW > 0 && <span className={styles.planFill} style={{ width: `${fillW}%` }} />}
      {overW > 0 && (
        <span
          className={`${styles.planOver} ${overGood ? styles.planOverGood : ''}`}
          style={{ left: `calc(${tw}% + 2px)`, width: `${overW}%` }}
        />
      )}
    </div>
  );
}

export default function OverviewDashboard({ summary, payablesApiUrl, hrefs }: Props) {
  const { dues, budget } = summary;
  const pct = dues.expected > 0 ? Math.round((dues.collected / dues.expected) * 100) : 0;
  const toCome = Math.max(dues.expected - dues.collected - dues.overdueAmount, 0);
  const allCollected = dues.expected > 0 && dues.outstanding <= 0.005;
  const spent = summary.expenses.paidTotal;
  const overBudget = summary.headroom != null && summary.headroom < 0;
  const flowMax = Math.max(summary.moneyIn.total, summary.moneyOut.total, 1);
  // The Budget card's shared dollar scale — every planned AND actual figure it
  // draws, so no bar can escape the card however the plan and reality diverge.
  const raised = summary.fundraisers.totalRaised;
  const fundGoal = budget.expectedFunding;
  const duesScheduled = dues.expected > 0.005;
  const scaleMax = Math.max(
    budget.effectiveTotal, spent, dues.expected, dues.collected, fundGoal, raised, 1,
  );

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
          {/* ⚠ THE REGISTER, NOT PLAYER DUES (2026-08-26). This foot read 'See what's outstanding'
              and opened the dues tab — the SAME door the Collections card beside it already owns, and
              only half of what its own words promised: money the team still owes OUT was nowhere on
              that journey. Cash on hand IS the register's running balance at today, and the register
              prints this exact figure in its own toolbar, so the number's one true door is the book
              that produces it. What is still owed keeps its answers — the Collections card for money
              in, the Next-N-days ledger below for everything dated — and the caveat sentence above
              already points at them without spending this link on it. */}
          <div className={styles.foot}>
            <Link href={hrefs.transactions} className={styles.footLink}>Ledger →</Link>
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
              <div className={styles.planLegend} aria-hidden>
                <span><span className={`${styles.planSwatch} ${styles.planSwatchActual}`} />actual</span>
                <span><span className={`${styles.planSwatch} ${styles.planSwatchPlanned}`} />planned</span>
              </div>
              <div className={styles.planRows}>
                {/* Spending: two numbers only. The remaining-headroom dollars are the
                    card's own headline three lines up — restating them here made the
                    row's longest phrase the one thing already answered. The over-plan
                    case keeps a WORD (never the amount, also in the headline) because
                    the striped segment must not carry that verdict on colour alone. */}
                <div>
                  <div className={styles.planRowHead}>
                    <span className={styles.planRowLabel}>Spending</span>
                    <span className={styles.planRowNums}>
                      <b>{fmt(spent)}</b> of {fmt(budget.effectiveTotal)}
                      {overBudget && <> · <span className={styles.planDeltaBad}>▲ over plan</span></>}
                    </span>
                  </div>
                  <PlanBar actual={spent} target={budget.effectiveTotal} scaleMax={scaleMax} />
                </div>

                {/* Player dues: collected climbs TO what is actually SCHEDULED — the real
                    figure, never a computed even split of the plan (the retired $/player
                    projection went stale the moment real installments existed). The word
                    "scheduled" is dropped from the row: "$2,700 of $6,400" needs no help,
                    and the empty state below says outright when nothing is scheduled. */}
                <div>
                  <div className={styles.planRowHead}>
                    <span className={styles.planRowLabel}>Player dues</span>
                    <span className={styles.planRowNums}>
                      {duesScheduled ? (
                        <>
                          <b>{fmt(dues.collected)}</b> of {fmt(dues.expected)}
                          {dues.outstanding <= 0.005 && <> · <span className={styles.planDeltaGood}>✓ all in</span></>}
                        </>
                      ) : (
                        <span className={styles.planDelta}>nothing scheduled</span>
                      )}
                    </span>
                  </div>
                  {duesScheduled ? (
                    <PlanBar actual={dues.collected} target={dues.expected} scaleMax={scaleMax} />
                  ) : (
                    <>
                      {/* A dashed ghost of what dues WOULD cover — never a projected bar
                          pretending to be real money, and no ghost at all when funding
                          already covers the whole plan (review finding: a floored-width
                          ghost over $0 suggested dues were owed). */}
                      {budget.fundedByPlayers > 0.005 && (
                        <div className={styles.planBar} aria-hidden>
                          <span
                            className={`${styles.planTrack} ${styles.planTrackEmpty}`}
                            style={{ width: `${Math.max((budget.fundedByPlayers / scaleMax) * 100, 20)}%` }}
                          />
                        </div>
                      )}
                      <p className={styles.planEmptyNote}>
                        <span>No installments yet{payablesApiUrl && ' —'}</span>
                        {/* Live seasons only: an archived season must not grow a door into a
                            write flow (payablesApiUrl is absent exactly there). */}
                        {payablesApiUrl && (
                          <Link href={hrefs.budgetGenerate} className={styles.planGenLink}>Generate installments →</Link>
                        )}
                      </p>
                    </>
                  )}
                </div>

                {/* Fundraising: raised climbs to expected; beating the goal is GOOD overflow.
                    Hidden entirely when nothing is planned and nothing raised. */}
                {(fundGoal > 0.005 || raised > 0.005) && (
                  <div>
                    <div className={styles.planRowHead}>
                      <span className={styles.planRowLabel}>Fundraising</span>
                      <span className={styles.planRowNums}>
                        {fundGoal > 0.005 ? (
                          <>
                            <b>{fmt(raised)}</b> of {fmt(fundGoal)}
                            {raised > fundGoal - 0.005 && (
                              <> · <span className={styles.planDeltaGood}>
                                ✓ {raised > fundGoal + 0.005 ? 'past goal' : 'goal met'}
                              </span></>
                            )}
                          </>
                        ) : (
                          /* No goal to count against, so the second number would be
                             missing rather than derivable — say why it is absent. */
                          <><b>{fmt(raised)}</b> raised · <span className={styles.planDelta}>no goal set</span></>
                        )}
                      </span>
                    </div>
                    <PlanBar actual={raised} target={fundGoal} scaleMax={scaleMax} overGood />
                  </div>
                )}
              </div>
              <div className={styles.foot}>
                <Link href={hrefs.budget} className={styles.footLink}>Budget plan →</Link>
                <Link href={hrefs.budgetVsActual} className={styles.footLink}>Budget vs. Actual →</Link>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={payablesApiUrl ? styles.row2 : styles.rowSolo}>
        {payablesApiUrl && (
          <MoneyNextThirtyDays
            apiUrl={payablesApiUrl}
            hrefs={{
              dues: hrefs.dues,
              registerFrom: hrefs.registerFrom,
              /* Unfiltered so the Balance column survives the hop — a filtered book hides it, and
                 "see the whole book" landing on one without a balance would answer a different
                 question than the one the link asks. */
              fullBook: hrefs.transactions,
            }}
          />
        )}

        {/* The remainder: every Money surface the three story cards above don't
            already own, one line and one live stat each. Same component the setup
            Overview uses — there it carries all seven and groups them by step. */}
        <MoneyRail summary={summary} hrefs={hrefs} variant="more" />
      </div>
    </>
  );
}