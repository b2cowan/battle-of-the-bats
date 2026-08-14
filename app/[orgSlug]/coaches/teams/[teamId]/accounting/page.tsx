'use client';
import { useState, useEffect, useCallback, useRef, use, type ComponentType } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { DollarSign, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import MoneyImportMenu, { type MoneyDataNotice } from '@/components/coaches/MoneyImportMenu';
import { MoneyRefreshProvider } from '@/lib/coach-money-refresh';
import { type MoneySummary, type DashboardHrefs } from '@/lib/coach-money-summary';
import { type CoachMoneySection } from '@/lib/coach-money-links';
import OverviewDashboard from './OverviewDashboard';
import SetupOverview from './SetupOverview';
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

// Money hub tab ids — 'overview' plus the shared tab list every outside caller links with
// (lib/coach-money-links.ts). Derived, not restated: two hand-copied unions is how a renamed
// tab compiles clean in one file and 404s from the other.
type SectionId = 'overview' | CoachMoneySection;

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
  // What the header's Import menu needs the coach to READ — an import result, or a failure.
  // It lives here rather than in the menu because the menu sits in the header's action row and
  // closes on every pick: a message rendered inside it would be squeezed into the button row or
  // dismissed before it could be read. (Export reports its own failures inside its dialog, which
  // covers the page — a different surface, so a different answer.)
  const [dataNotice, setDataNotice] = useState<MoneyDataNotice>(null);

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
  // / ?generate=1 / ?line=&periods= edit deep-link, Expenses's ?tab=). They mean nothing once
  // you've left that panel's tab, so every OTHER sectionHref call must drop them — otherwise
  // they linger in the URL and silently refire (or override a sub-view the coach picked by
  // hand) on an unrelated visit. `line`/`periods` joined the list when the month grid's
  // drill-down started addressing the hub (?section=budget&line=…) instead of the retired
  // standalone budget page.
  // `duesView` is the Dues tab's lens, not a one-shot trigger — but the SAME rule applies:
  // it means nothing off its own tab, so other tabs' hrefs must not carry it (/review
  // 2026-08-14: it was riding every subsequent tab URL and bookmark in the session).
  const ONE_SHOT_KEYS = ['starter', 'generate', 'tab', 'line', 'periods', 'duesView'];

  function sectionHref(id: SectionId, extra?: Record<string, string>) {
    const qp = new URLSearchParams(seasonSearchParams.toString());
    if (id === 'overview') qp.delete('section'); else qp.set('section', id);
    for (const k of ONE_SHOT_KEYS) if (!extra || !(k in extra)) qp.delete(k);
    if (extra) for (const [k, v] of Object.entries(extra)) qp.set(k, v);
    const qs = qp.toString();
    return `${base}/accounting${qs ? `?${qs}` : ''}`;
  }

  const load = useCallback(async (quiet = false) => {
    if (!quiet) { setLoading(true); setError(''); }
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/money-summary${seasonQuery}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      setSummary(await res.json());
    } catch (e: unknown) {
      // A QUIET refresh must never take the page down. Both `loading` and `error` replace the
      // whole tab area — panels included — so a failed background refresh would evict a coach's
      // half-filled form on another tab. It leaves the last good summary on screen instead.
      if (!quiet) setError(e instanceof Error ? e.message : 'Failed to load money summary.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [orgSlug, teamId, seasonQuery]);

  useEffect(() => { load(); }, [load]);

  // Coming BACK to Overview re-reads the summary — quietly, without unmounting anything.
  // Every fact on that screen comes from this one payload: which anchor the coach sees, the
  // headline tiles, every rail row. The hub keeps visited panels mounted and never remounts
  // the page on a tab switch, and the fetch is keyed on the SEASON, so a coach who generated
  // installments on the Budget tab used to come back to an Overview still telling them to
  // generate installments — for the rest of the session (found in review, 2026-08-12).
  const onOverview = activeSection === 'overview';
  const wasOnOverview = useRef(true);
  useEffect(() => {
    if (onOverview && !wasOnOverview.current) load(true);
    wasOnOverview.current = onOverview;
  }, [onOverview, load]);

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
  // The hub's data doors are money-scoped: no money access, no menus at all. Export survives
  // for a read-only money assistant; Import (a write) does not — that split lives in the menus.
  const canViewMoney = !!page.capabilities && page.capabilities.money !== 'off';

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

  // ONE set of destinations for both Overview shapes — the operate dashboard and the
  // setup layout address the same surfaces, so a divergence here would be a bug in one
  // of them. Every Money link either shape renders comes from this object and nowhere
  // else; a second hand-built `sectionHref(...)` beside a consumer is how the two fall
  // out of step. Org-only entries follow their href: absent means the gate said no.
  const moneyHrefs: DashboardHrefs = {
    dues: sectionHref('dues'),
    budget: sectionHref('budget'),
    budgetVsActual: sectionHref('budget-vs-actual'),
    fundraisers: sectionHref('fundraisers'),
    expenses: sectionHref('expenses'),
    budgetStarter: sectionHref('budget', { starter: '1' }),
    budgetGenerate: sectionHref('budget', { generate: '1' }),
    expensesSchedule: sectionHref('expenses', { tab: 'schedule' }),
    ...(showOrgTabs ? {
      allocations: sectionHref('allocations'),
      paymentRequests: sectionHref('payment-requests'),
    } : {}),
  };

  // Wide column: Money is now a tabbed hub whose panels include the densest tables in the
  // portal (Dues, Expenses and Budget vs. Actual each already opted into pageWide on their
  // own). At 960px the 8-tab row also truncated with no cue — see the tab-bar rules.
  return (
    <MoneyRefreshProvider>
    <div className={`${styles.page} ${styles.pageWide}`}>
      {/* Page-header ruling 2026-08-11: title + archive chip + help, nothing under the title —
          the masthead above owns the season. The old in-header breadcrumb repeated the masthead's
          team name and this h1 one line away (and was display:none anyway).

          Page-level ACTION ruling 2026-08-13: a hub header names the CONTAINER, so it carries
          only hub-wide doors, and after the export placement pass there is exactly ONE — Import ▾.
          Every tab-scoped action lives in that tab's own toolbar beside the thing it names, and
          EXPORT WENT DOWN THERE TOO: what a tab exports depends on the view, the sub-tab and the
          filters the coach has set, none of which a header above the tab bar can see. Budget vs.
          Actual proved it by growing a second Export button.

          `actionsPhoneHidden` is rule 11: importing needs a file picker a phone does not have,
          so the whole row leaves the phone header rather than collapsing to an icon. The import
          stays reachable at 390px through every Money empty state that can accept one — that
          mitigation is mandatory. */}
      <CoachPageHeader
        icon={DollarSign}
        title="Money"
        season={page.season}
        teamBase={page.teamBase}
        chipExtraQuery={effectiveSection !== 'overview' ? `section=${effectiveSection}` : undefined}
        actions={canViewMoney ? (
          <MoneyImportMenu
            orgSlug={orgSlug}
            teamId={teamId}
            seasonQuery={seasonQuery}
            canWriteMoney={canWrite}
            onNotice={setDataNotice}
            onImported={() => { void load(true); }}
          />
        ) : undefined}
        actionsPhoneHidden
        helpLabel="Money"
        help={{ module: 'coaches', sectionIds: ['premium-money'], fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
      />

      {/* What the header's data menus have to say — an import result, or why an export couldn't be
          built. Announced, because the act that produced it (a menu pick) leaves nothing on screen
          for a screen-reader user to notice. */}
      {dataNotice && (
        <p
          className={dataNotice.tone === 'bad' ? styles.errorText : styles.successText}
          style={{ margin: '-1rem 0 1.25rem' }}
          role="status"
        >
          {dataNotice.text}
        </p>
      )}

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

          {/* Overview forks by stage, but no longer by SHAPE: an operating season gets the
              three story cards and the merged ledger above the rail; a season still being
              set up gets the anchor card above the same rail. Both end in one index; the
              1·Plan → 4·Review card stack that used to sit under the setup view is gone
              (owner ruling 2026-08-12 — it was a second navigation system one line under
              the tab bar, and on an empty team every card in it said "nothing yet"). */}
          {effectiveSection === 'overview' && summary.stage === 'operate' && (
            <OverviewDashboard
              summary={summary}
              /* Live seasons only: the Next-N-days ledger is an instrument, and its API
                 resolves the ACTIVE year — in an archive it showed TODAY's payments
                 (owner ruling 2026-08-11: hide it rather than invent an archived "next
                 30 days" that never existed). */
              payablesApiUrl={page.isReadOnly ? undefined : `/api/coaches/${orgSlug}/teams/${teamId}/upcoming-payables`}
              hrefs={moneyHrefs}
            />
          )}

          {effectiveSection === 'overview' && summary.stage !== 'operate' && (
            <SetupOverview
              summary={summary}
              hrefs={moneyHrefs}
              rosterHref={`${base}/roster`}
              canWrite={canWrite}
              showPayables={!page.isReadOnly}
              payablesApiUrl={`/api/coaches/${orgSlug}/teams/${teamId}/upcoming-payables`}
            />
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
    </MoneyRefreshProvider>
  );
}