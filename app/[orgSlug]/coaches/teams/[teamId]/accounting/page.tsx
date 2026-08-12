'use client';
import { useState, useEffect, useCallback, useRef, use, type ReactNode, type ComponentType } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  DollarSign, Users, Receipt, Building2, BarChart3, TrendingUp, Gift,
  ArrowLeftRight, ArrowRight, ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import UpcomingPayablesPanel from '@/components/accounting/UpcomingPayablesPanel';
import OverviewDashboard, { fmt, type MoneySummary } from './OverviewDashboard';
import styles from '../../../coaches.module.css';

// Code-split, not just lazy-mounted: each panel is 1000+ lines and a couple pull in
// heavy export libraries (e.g. ExcelJS), so a coach who only ever opens Overview +
// one tab shouldn't pay to download all seven. Panels live in ./{tab}/panel, NOT the
// page files: a page module may only export Next's page contract, and the build's
// route-type stubs fail `tsc` on any extra export (bitten 2026-08-12).
const BudgetPlanPanel = dynamic(() => import('./budget/panel').then(m => m.BudgetPlanPanel), { ssr: false });
const PlayerDuesPanel = dynamic(() => import('./dues/panel').then(m => m.PlayerDuesPanel), { ssr: false });
const FundraisersPanel = dynamic(() => import('./fundraisers/panel').then(m => m.FundraisersPanel), { ssr: false });
const ExpensesPayablesPanel = dynamic(() => import('./expenses/panel').then(m => m.ExpensesPayablesPanel), { ssr: false });
const OrgAllocationsPanel = dynamic(() => import('./allocations/panel').then(m => m.OrgAllocationsPanel), { ssr: false });
const PaymentRequestsPanel = dynamic(() => import('./payment-requests/panel').then(m => m.PaymentRequestsPanel), { ssr: false });
const BudgetVsActualPanel = dynamic(() => import('./budget-vs-actual/panel').then(m => m.BudgetVsActualPanel), { ssr: false });

type PanelProps = {
  params: Promise<{ orgSlug: string; teamId: string }>;
  embedded?: boolean;
  /** Is THIS panel the currently-visible tab? A panel stays mounted once visited, so a
   *  dirty form left on a tab a coach has since switched away from must stop treating
   *  itself as "on screen" — otherwise its unsaved-changes guard keeps intercepting
   *  clicks on whatever tab the coach is actually looking at. */
  tabActive?: boolean;
};
const ORG_ONLY_SECTIONS = new Set<SectionId>(['allocations', 'payment-requests']);
const PANELS: { id: SectionId; Component: ComponentType<PanelProps> }[] = [
  { id: 'budget', Component: BudgetPlanPanel },
  { id: 'dues', Component: PlayerDuesPanel },
  { id: 'fundraisers', Component: FundraisersPanel },
  { id: 'expenses', Component: ExpensesPayablesPanel },
  { id: 'allocations', Component: OrgAllocationsPanel },
  { id: 'payment-requests', Component: PaymentRequestsPanel },
  { id: 'budget-vs-actual', Component: BudgetVsActualPanel },
];

// MoneySummary now lives with the operate-stage dashboard, its main consumer.

// Money hub tab ids — match the sub-route folder names 1:1 so a coach's mental
// model ("I'm in the dues screen") and the URL agree.
type SectionId = 'overview' | 'budget' | 'dues' | 'fundraisers' | 'expenses' | 'allocations' | 'payment-requests' | 'budget-vs-actual';

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

  // Chunk F — which SEASON is on screen. `page.capabilities` are that season's (rule 1)
  // and `page.canWrite()` folds in read-only, so write flags go through it.
  const seasonSearchParams = useSearchParams();
  const page = useCoachSeasonPage(orgSlug, teamId, seasonSearchParams.get('year'));
  const seasonQuery = page.query;
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  // ── Tab state ───────────────────────────────────────────────────────────
  // `?section=` (not `?tab=` — the Expenses panel already owns that query key
  // for its own internal Expenses/Payables/Schedule view). Read from the URL
  // so the active tab survives refresh, back/forward and is shareable.
  // `visited` tracks every tab that's ever been opened this visit — once a
  // panel mounts it stays mounted (display:none while inactive), so switching
  // away and back never loses an in-progress form or re-fetches its data.
  const activeSection = (seasonSearchParams.get('section') as SectionId | null) ?? 'overview';
  // Seed with the section a coach actually LANDS on (a hard refresh, bookmark, or
  // external link straight into e.g. ?section=dues) as well as 'overview' — seeding
  // only 'overview' left a direct link to any other tab rendering a blank pane, since
  // the render-time guard below only fires on a CHANGE after mount, never on mount itself.
  const [visited, setVisited] = useState<Set<SectionId>>(() => new Set(['overview', activeSection]));
  // Adjusting state during render (not an effect) on a change-detection guard is the
  // React-sanctioned way to derive state from a prop/URL change without an extra
  // effect-triggered re-render — see react.dev "Adjusting state when a prop changes".
  const [trackedSection, setTrackedSection] = useState(activeSection);
  if (activeSection !== trackedSection) {
    setTrackedSection(activeSection);
    setVisited(v => new Set(v).add(activeSection));
  }

  // Is a tab hidden past either edge? The arrows appear only on the side that actually has
  // something hidden — an arrow on a row that already fits, or pointing at nothing, is a lie.
  // They are real buttons: an earlier pass made them pointer-events:none decoration, which
  // looked clickable and silently passed the click through to the tab underneath.
  // Re-measured on scroll, on resize, and whenever the tab set changes (the two org-only
  // tabs come and go with the season).
  const tabBarRef = useRef<HTMLElement>(null);
  const [tabScroll, setTabScroll] = useState({ left: false, right: false });
  useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;
    const measure = () => setTabScroll({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener('scroll', measure, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', measure); };
  }, [summary, page.isReadOnly]);

  function scrollTabs(dir: -1 | 1) {
    const el = tabBarRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.6), behavior: 'smooth' });
  }

  // One-shot deep-link triggers a panel reads to auto-open something (Budget's ?starter=1
  // / ?generate=1, Expenses's ?tab=). They mean nothing once you've left that panel's tab,
  // so every OTHER sectionHref call must drop them — otherwise they linger in the URL and
  // silently refire (or override a sub-view the coach picked by hand) on an unrelated visit.
  const ONE_SHOT_KEYS = ['starter', 'generate', 'tab'];

  function sectionHref(id: SectionId, extra?: Record<string, string>) {
    const qp = new URLSearchParams(seasonSearchParams.toString());
    if (id === 'overview') qp.delete('section'); else qp.set('section', id);
    for (const k of ONE_SHOT_KEYS) if (!extra || !(k in extra)) qp.delete(k);
    if (extra) for (const [k, v] of Object.entries(extra)) qp.set(k, v);
    const qs = qp.toString();
    return `${base}/accounting${qs ? `?${qs}` : ''}`;
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/money-summary${seasonQuery}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      setSummary(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load money summary.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId, seasonQuery]);

  useEffect(() => { load(); }, [load]);

  if (ctxLoading) return <p className={styles.muted}>Loading…</p>;
  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  const canWrite = page.canWrite(page.capabilities?.money === 'write');

  // ── Stage anchor content (plan/collect only) ─────────────────────────────
  // One "right now" card, one lime CTA max (earned-lime rule). The operate
  // stage renders the OverviewDashboard instead — its old operate sub-states
  // (overdue → never-paid → on-track) live on as the Collections card's chip.
  function renderAnchor(s: MoneySummary) {
    const { budget } = s;

    if (s.stage === 'plan') {
      return (
        <div className={`${styles.nowCard} ${styles.nowPreseason}`}>
          <p className={styles.nowEyebrow}>Money · Getting started</p>
          <p className={styles.nowHeadline}>Start with your season budget</p>
          <p className={styles.nowMeta}>
            Estimate the season&apos;s costs, turn them into player dues in one click, then track
            every dollar against the plan. Plan → Collect → Spend → Review.
          </p>
          <p className={styles.nowMeta}>
            Dues you set here drive the automatic payment reminders families receive, show up on your
            Overview and in Insights as &ldquo;Where&apos;s the money?&rdquo;, and are prefilled when you accept
            a player from tryouts — so you never chase a spreadsheet.
          </p>
          {canWrite ? (
            <div className={styles.nowActions}>
              {/* Deep-links into the budget starter (Chunk G) — same copy, but the coach
                  lands in the questions instead of on a blank page. */}
              <Link href={sectionHref('budget', { starter: '1' })} className="btn btn-lime btn-sm">Build your budget <ArrowRight size={14} /></Link>
              <Link href={sectionHref('dues')} className={styles.nowSecondary}>Skip — set dues directly <ArrowRight size={13} /></Link>
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
                <Link href={sectionHref('budget')} className="btn btn-lime btn-sm">Add line items <ArrowRight size={14} /></Link>
              ) : (
                <Link href={sectionHref('budget', { generate: '1' })} className="btn btn-lime btn-sm">Generate installments <ArrowRight size={14} /></Link>
              )}
              <Link href={sectionHref('dues')} className={styles.nowSecondary}>Set dues manually <ArrowRight size={13} /></Link>
            </div>
          )}
        </div>
      );
    }

    // operate never reaches here — the dashboard owns that stage.
    return null;
  }

  // ── Grouped drill-in cards ───────────────────────────────────────────────
  // Cards switch the active tab in place (sectionHref keeps you on this page,
  // just changes `?section=`) instead of doing a full navigation away.
  function card(
    sectionId: SectionId,
    icon: ReactNode,
    title: string,
    desc: string,
    stat: ReactNode,
  ) {
    return (
      <Link href={sectionHref(sectionId)} className={styles.moneyCard}>
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

  const showOrgTabs = !!summary?.orgLinked && !page.isReadOnly;
  // A coach can land on an org-only tab (bookmark, shared link) from a moment when it WAS
  // available — the org later unlinked, or the season since closed. Rather than a dead end
  // (tab bar shows no active tab, nothing renders below it), fall back to Overview, the same
  // way the old per-route cards simply didn't offer the link at all.
  const effectiveSection: SectionId =
    ORG_ONLY_SECTIONS.has(activeSection) && !showOrgTabs ? 'overview' : activeSection;
  const tabs: { id: SectionId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'budget', label: 'Budget Plan' },
    { id: 'dues', label: 'Player Dues' },
    { id: 'fundraisers', label: 'Fundraisers' },
    { id: 'expenses', label: 'Expenses & Payables' },
    // Trimmed from "Org Allocations"/"Payment Requests": inside Money the shorter words are
    // unambiguous, and the two longest labels were what pushed the row past the column.
    // Each panel's own page title keeps the full name.
    ...(showOrgTabs ? [
      { id: 'allocations' as const, label: 'Allocations' },
      { id: 'payment-requests' as const, label: 'Payments' },
    ] : []),
    { id: 'budget-vs-actual', label: 'Budget vs. Actual' },
  ];

  // Wide column: Money is now a tabbed hub whose panels include the densest tables in the
  // portal (Dues, Expenses and Budget vs. Actual each already opted into pageWide on their
  // own). At 960px the 8-tab row also truncated with no cue — see the tab-bar rules.
  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      {/* Page-header ruling 2026-08-11: title + archive chip + help, nothing under the title —
          the masthead above owns the season. The old in-header breadcrumb repeated the masthead's
          team name and this h1 one line away (and was display:none anyway). */}
      <CoachPageHeader
        icon={DollarSign}
        title="Money"
        season={page.season}
        teamBase={page.teamBase}
        chipExtraQuery={effectiveSection !== 'overview' ? `section=${effectiveSection}` : undefined}
        helpLabel="Money"
        help={{ module: 'coaches', sectionIds: ['premium-money'], fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
      />

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : summary && (
        <>
          <div className={styles.moneyTabBarWrap}>
            {tabScroll.left && (
              <button
                type="button"
                className={`${styles.moneyTabScrollBtn} ${styles.moneyTabScrollLeft}`}
                onClick={() => scrollTabs(-1)}
                aria-label="Scroll tabs left"
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
            )}
            <nav
              ref={tabBarRef}
              className={[
                styles.moneyTabBar,
                tabScroll.left ? styles.moneyTabFadeLeft : '',
                tabScroll.right ? styles.moneyTabFadeRight : '',
              ].filter(Boolean).join(' ')}
              aria-label="Money"
            >
              {tabs.map(t => (
                <Link
                  key={t.id}
                  href={sectionHref(t.id)}
                  className={`${styles.moneyTabBtn} ${effectiveSection === t.id ? styles.moneyTabActive : ''}`}
                  aria-current={effectiveSection === t.id ? 'page' : undefined}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
            {tabScroll.right && (
              <button
                type="button"
                className={`${styles.moneyTabScrollBtn} ${styles.moneyTabScrollRight}`}
                onClick={() => scrollTabs(1)}
                aria-label="Scroll tabs right"
              >
                <ChevronRight size={16} aria-hidden />
              </button>
            )}
          </div>

          {/* Overview forks by stage: an operating season gets the one-screen dashboard
              (each fact rendered once — see OverviewDashboard); a coach still setting up
              keeps the guided walk below (anchor, tiles, payables, journey cards). */}
          {effectiveSection === 'overview' && summary.stage === 'operate' && (
            <OverviewDashboard
              summary={summary}
              /* Live seasons only: the Next-N-days ledger is an instrument, and its API
                 resolves the ACTIVE year — in an archive it showed TODAY's payments
                 (owner ruling 2026-08-11: hide it rather than invent an archived "next
                 30 days" that never existed). */
              payablesApiUrl={page.isReadOnly ? undefined : `/api/coaches/${orgSlug}/teams/${teamId}/upcoming-payables`}
              hrefs={{
                dues: sectionHref('dues'),
                budget: sectionHref('budget'),
                budgetStarter: sectionHref('budget', { starter: '1' }),
                budgetVsActual: sectionHref('budget-vs-actual'),
                fundraisers: sectionHref('fundraisers'),
                expenses: sectionHref('expenses'),
                expensesSchedule: sectionHref('expenses', { tab: 'schedule' }),
                ...(showOrgTabs ? {
                  allocations: sectionHref('allocations'),
                  paymentRequests: sectionHref('payment-requests'),
                } : {}),
              }}
            />
          )}

          {effectiveSection === 'overview' && summary.stage !== 'operate' && (
            <>
              {renderAnchor(summary)}

              {/* Cash-honest headline numbers — same paid-only basis as Budget vs. Actual.
                  The basis is stated ONCE above the row (review f4-6). It used to be bolted onto
                  Money Out alone as "(paid only)", while Money In carried no caveat despite being
                  equally collected-only and On Hand silently inherited both — so the row read as
                  "committed revenue vs. cash spent" when it is cash on both sides. */}
              <p className={styles.moneySummaryBasis}>
                Cash actually received and actually paid — not what&apos;s still owed.{' '}
                <Link href={sectionHref('dues')} className={`${styles.linkBtn} ${styles.linkBtnAccent}`}>
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

              {/* Same archive rule as the dashboard's ledger: forward-looking preview,
                  active-year API — a read-only season doesn't offer it. */}
              {!page.isReadOnly && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <UpcomingPayablesPanel
                    apiUrl={`/api/coaches/${orgSlug}/teams/${teamId}/upcoming-payables`}
                    /* This panel is a 30/60/90-day preview; the schedule tab is every commitment (chunk H). */
                    fullScheduleUrl={sectionHref('expenses', { tab: 'schedule' })}
                  />
                </div>
              )}

              {/* Plan */}
              <div className={styles.moneyGroup}>
                <div className={styles.moneyGroupHead}>
                  <h2 className={styles.moneyGroupTitle}>1 · Plan</h2>
                  <p className={styles.moneyGroupHint}>Estimate the season</p>
                </div>
                <div className={styles.moneyCards}>
                  {card(
                    'budget',
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
                    'dues',
                    <Users size={20} style={{ color: 'var(--home-plum, #a855f7)' }} />,
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
                    'fundraisers',
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
                    'expenses',
                    <Receipt size={20} style={{ color: 'var(--home-rust, #f97316)' }} />,
                    'Expenses & Payables',
                    'Log spending by category, track what you owe and when it falls due',
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
                  {/* D-F7: instruments, not records — org allocations and payment requests MOVE money and
                      their pages are live-season only, so a finished season does not offer them. */}
                  {showOrgTabs && card(
                    'allocations',
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
                  {showOrgTabs && card(
                    'payment-requests',
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
                    'budget-vs-actual',
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

          {/* Panels: lazy-mount on first visit, then keep mounted (display:none while
              inactive) so switching tabs never loses an in-progress form or re-fetches. */}
          {PANELS.map(({ id, Component }) => {
            if (ORG_ONLY_SECTIONS.has(id) && !showOrgTabs) return null;
            if (!visited.has(id)) return null;
            return (
              <div key={id} style={{ display: effectiveSection === id ? 'block' : 'none' }}>
                <Component params={paramsPromise} embedded tabActive={effectiveSection === id} />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}