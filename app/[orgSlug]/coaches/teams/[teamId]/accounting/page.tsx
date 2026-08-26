'use client';
import { useState, useEffect, useCallback, useMemo, useRef, use, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { DollarSign, Plus } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachTabBar from '@/components/coaches/CoachTabBar';
import MoneyImportMenu, { type MoneyDataNotice } from '@/components/coaches/MoneyImportMenu';
import { MoneyRefreshProvider, useOnMoneyRevisionBump } from '@/lib/coach-money-refresh';
import {
  RecordMoneyProvider, type RecordMoneyIntent, type ConversationBranch,
} from '@/lib/coach-record-money';
import { type MoneySummary, type DashboardHrefs } from '@/lib/coach-money-summary';
import { legacyMoneyAddress, type CoachMoneySection } from '@/lib/coach-money-links';
import OverviewDashboard from './OverviewDashboard';
import SetupOverview from './SetupOverview';
import CoachLoadError from '@/components/coaches/CoachLoadError';
import CoachLoading from '@/components/coaches/CoachLoading';
import styles from '../../../coaches.module.css';

// Code-split, not just lazy-mounted: each panel is 1000+ lines and a couple pull in
// heavy export libraries (e.g. ExcelJS), so a coach who only ever opens Overview +
// one tab shouldn't pay to download all seven. Panels live in ./{tab}/panel, NOT the
// page files: a page module may only export Next's page contract, and the build's
// route-type stubs fail `tsc` on any extra export (bitten 2026-08-12).
const BudgetPlanPanel = dynamic(() => import('./budget/panel').then(m => m.BudgetPlanPanel), { ssr: false });
const PlayerDuesPanel = dynamic(() => import('./dues/panel').then(m => m.PlayerDuesPanel), { ssr: false });
const FundraisersPanel = dynamic(() => import('./fundraisers/panel').then(m => m.FundraisersPanel), { ssr: false });
/* ⚠ TWO TABS, ONE MODULE (Money split P1, 2026-08-16). Transactions and Payables are two faces of
   the same panel rather than two files: they share the record form, the money-tag library, the
   taxonomy picker, the importer and every fetch, and copying ~1,500 lines to separate them would
   put the one form the whole release turns on in two places at once. The hub mounts each face
   independently, exactly as it mounts Allocations and Payments. P3 replaces the Transactions face
   wholesale with the register, at which point the shared body shrinks to Payables' own. */
const TransactionsPanel = dynamic(() => import('./expenses/panel').then(m => m.TransactionsPanel), { ssr: false });
const PayablesPanel = dynamic(() => import('./expenses/panel').then(m => m.PayablesPanel), { ssr: false });
/* ⚠ ONE TAB WHERE TWO WERE (money redesign P4, 2026-08-17). Allocations and Payments were two
   halves of one relationship — money the club bills the team, money the team asks of the club — and
   a coach had to hold both to answer the only question either existed for. Merged into `./club`,
   which pays back the tab P1 added: 8 org-linked, 7 standalone, exactly today's count. */
const ClubPanel = dynamic(() => import('./club/panel').then(m => m.ClubPanel), { ssr: false });
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
const ORG_ONLY_SECTIONS = new Set<SectionId>(['club']);
const PANELS: { id: SectionId; Component: ComponentType<PanelProps> }[] = [
  { id: 'budget', Component: BudgetPlanPanel },
  { id: 'dues', Component: PlayerDuesPanel },
  { id: 'fundraisers', Component: FundraisersPanel },
  { id: 'transactions', Component: TransactionsPanel },
  { id: 'payables', Component: PayablesPanel },
  { id: 'club', Component: ClubPanel },
  { id: 'budget-vs-actual', Component: BudgetVsActualPanel },
];

// Money hub tab ids — 'overview' plus the shared tab list every outside caller links with
// (lib/coach-money-links.ts). Derived, not restated: two hand-copied unions is how a renamed
// tab compiles clean in one file and 404s from the other.
type SectionId = 'overview' | CoachMoneySection;

/**
 * ⚠⚠ WHAT **Record** ARRIVES ANSWERED WITH, PER TAB (owner ruling, 2026-08-23).
 *
 * The button is the same button everywhere; what changes is whether the screen behind it makes an
 * honest guess. Standing on Player Dues, "a family paid their dues" is what a coach reaching for
 * Record almost always means — so the form opens there and they can change it, because **a tab is
 * a guess, not a record** (the other half of ruling A: a door that names one RECORD locks; a door
 * that names a SCREEN only suggests).
 *
 * ⚠ THREE TABS DELIBERATELY GUESS NOTHING. Overview is the season, Budget Plan is a plan and
 * Budget vs. Actual is a report — none of them is about one kind of event, so Record opens on the
 * question, exactly as it always has from Overview.
 *
 * ⚠ Payables answers "we paid for something" — NOT "add a commitment". Record is for money that
 * moved (owner ruling B2); the bills the team owes are the first group in that branch's own picker,
 * so pressing Record on Payables lands one field away from paying one down. Creating a commitment
 * is what that tab's own "Add a commitment" button is for, and it keeps it.
 */
const RECORD_BRANCH_BY_SECTION: Partial<Record<SectionId, ConversationBranch>> = {
  dues:         'dues',
  fundraisers:  'drive',
  club:         'club',
  transactions: 'spend',
  payables:     'spend',
};

/**
 * Re-reads the summary when any money write bumps the shared revision (/review, 2026-08-23 —
 * Medium). The summary feeds the Record chooser's LIVE HINTS ("1 family in credit", "$500
 * owed"), and without this a coach emptying the Sunday-night pile from the one door — the exact
 * workflow the button exists for — read pre-write figures on every hint after the first save.
 * A child component because the page renders the provider and so cannot consume it itself;
 * skips the mount-time value (the page's own mount load covers it), and the re-read is QUIET —
 * a background refresh must never evict what a coach is doing (this page's own rule).
 */
function MoneySummaryRevisionBridge({ onBump }: { onBump: () => void }) {
  /* The shared hook owns the mount-skip and its StrictMode reasoning — see
     `useOnMoneyRevisionBump`. This component exists only because the page RENDERS the provider
     and so cannot consume it itself. */
  useOnMoneyRevisionBump(onBump);
  return null;
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
  // What the header's Import menu needs the coach to READ — an import result, or a failure.
  // It lives here rather than in the menu because the menu sits in the header's action row and
  // closes on every pick: a message rendered inside it would be squeezed into the button row or
  // dismissed before it could be read. (Export reports its own failures inside its dialog, which
  // covers the page — a different surface, so a different answer.)
  const [dataNotice, setDataNotice] = useState<MoneyDataNotice>(null);

  // Which SEASON is on screen — the team's LIVE one, always. `page.capabilities` are that
  // season's. ⚠ `page.canWrite()` is GONE (2026-08-18): it folded read-only into every write
  // flag, and a closed season no longer renders this screen at all.
  const seasonSearchParams = useSearchParams();
  const page = useCoachSeasonPage(orgSlug, teamId);
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  // ── Tab state ───────────────────────────────────────────────────────────
  // `?section=` (not `?tab=` — the Expenses panel already owns that query key
  // for its own internal Expenses/Payables/Schedule view). Read from the URL
  // so the active tab survives refresh, back/forward and is shareable.
  // `visited` tracks every tab that's ever been opened this visit — once a
  // panel mounts it stays mounted (display:none while inactive), so switching
  // away and back never loses an in-progress form or re-fetches its data.
  /* ── Saved addresses from before the split (Money split P1, 2026-08-16) ──────────────────────
     `?section=expenses` names a tab that no longer exists. Every such address still works, and
     WHICH tab it resolves to depends on the sub-view it carried — the rule lives in
     `legacyMoneyAddress`, shared with the standalone route's redirect so the two cannot disagree.

     ⚠ THE ADDRESS IS THEN REWRITTEN, not merely interpreted. A coach who arrives from a bookmark
     and copies the URL out of the bar to send to their treasurer must hand over a link to the tab
     they are actually looking at — leaving `section=expenses` in the bar would keep minting new
     copies of a dead address indefinitely. `replace`, not `push`: the old address is not a place
     worth having a Back button return to. */
  const router = useRouter();
  const rawSection = seasonSearchParams.get('section');
  const legacyAddress = legacyMoneyAddress(rawSection, seasonSearchParams.get('tab'));
  const legacySection = legacyAddress?.section;
  const legacyTab = legacyAddress?.tab;
  useEffect(() => {
    if (!legacySection) return;
    const qp = new URLSearchParams(seasonSearchParams.toString());
    qp.set('section', legacySection);
    if (legacyTab) qp.set('tab', legacyTab); else qp.delete('tab');
    router.replace(`${base}/accounting?${qp.toString()}`, { scroll: false });
  }, [legacySection, legacyTab, seasonSearchParams, router, base]);

  const activeSection = (legacySection ?? (rawSection as SectionId | null)) ?? 'overview';
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
  // `fundraiser` is the Fundraisers tab's SUB-VIEW (one drive open, 2026-08-14). Same rule, and
  // the consequence of missing it is louder than a stale lens: the id would ride to Expenses and
  // then back into Fundraisers, silently reopening a drive the coach had left.
  // `kind` is the Fundraising tab's own filter, which moved into the address on 2026-08-15 so the
  // Overview's two rows could each be a real destination. ⚠ It MUST be on this list: left off, a
  // coach who arrived through the Sponsorships row carries `kind=sponsor` to Expenses and back,
  // and every later visit to Fundraising silently hides their drives.
  const ONE_SHOT_KEYS = ['starter', 'generate', 'tab', 'line', 'periods', 'duesView', 'fundraiser', 'kind'];

  function sectionHref(id: SectionId, extra?: Record<string, string>) {
    const qp = new URLSearchParams(seasonSearchParams.toString());
    if (id === 'overview') qp.delete('section'); else qp.set('section', id);
    for (const k of ONE_SHOT_KEYS) if (!extra || !(k in extra)) qp.delete(k);
    if (extra) for (const [k, v] of Object.entries(extra)) qp.set(k, v);
    const qs = qp.toString();
    return `${base}/accounting${qs ? `?${qs}` : ''}`;
  }

  /* ── The one Record door (money centralization P1, approved 2026-08-22) ─────────────────────
     The conversation itself lives in the shared money form (expenses/panel.tsx) — grown, not
     forked. This button is its hub-level door: pressing it mounts the Transactions panel if it
     has never been visited (hidden — the tab does NOT change under the coach) and bumps the
     nonce the panel's transactions face listens for. The summary rides the same context so the
     chooser's live hints read data this page already loaded — never a fresh per-open probe.
     ⚠ Above the loading/access early returns with the rest of the hooks (rules-of-hooks). */
  const [recordNonce, setRecordNonce] = useState(0);
  const [recordIntent, setRecordIntent] = useState<RecordMoneyIntent | null>(null);
  /**
   * The one way in, for every door (P2). The header button calls it with a tab-shaped guess; the
   * doors on other panels — a family's row, a drive's row — call it with the record they name.
   * ⚠ ONE CHANNEL, NOT TWO. The dues and fundraiser panels cannot reach the money form's own
   * functions, and a second wire for them is how two ways to open one form start to drift.
   */
  const requestRecord = useCallback((intent?: RecordMoneyIntent) => {
    setVisited(v => v.has('transactions') ? v : new Set(v).add('transactions'));
    // Set BEFORE the nonce so the panel, reading both at the same render, can never see a new
    // nonce beside the previous request's intent.
    setRecordIntent(intent ?? null);
    setRecordNonce(n => n + 1);
  }, []);
  const recordSignal = useMemo(
    () => ({ summary, openNonce: recordNonce, intent: recordIntent, request: requestRecord }),
    [summary, recordNonce, recordIntent, requestRecord],
  );

  /**
   * ⚠⚠ THE LAST RESPONSE TO ARRIVE MUST NOT WIN (/review, 2026-08-23 — the same defect the Dues
   * panel and the register each carry their own guard against).
   *
   * This read now has THREE triggers: mount, coming back to Overview, and — new in P2 — the
   * revision bridge, which fires on every money write anywhere in the hub. And P2 is what made
   * writes common here: a coach emptying a Sunday-night pile records from one door, over and over.
   * Two overlapping reads mean a slow earlier one can land last and replace fresh figures with
   * stale ones — the Record chooser's live hints and Overview's tiles silently reverting to
   * pre-write numbers, with nothing on screen to say so.
   *
   * ⚠ A ref, not state: bumping a counter must never itself cause a render.
   */
  const summarySeq = useRef(0);
  const load = useCallback(async (quiet = false) => {
    if (!quiet) { setLoading(true); setError(''); }
    const seq = ++summarySeq.current;
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/money-summary`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      // Every await is behind us; a superseded read stops here rather than writing stale figures.
      if (seq !== summarySeq.current) return;
      setSummary(data);
    } catch (e: unknown) {
      if (seq !== summarySeq.current) return;
      // A QUIET refresh must never take the page down. Both `loading` and `error` replace the
      // whole tab area — panels included — so a failed background refresh would evict a coach's
      // half-filled form on another tab. It leaves the last good summary on screen instead.
      if (!quiet) setError(e instanceof Error ? e.message : 'Failed to load money summary.');
    } finally {
      // The newest read owns the spinner — an older one must not switch it off underneath it.
      if (!quiet && seq === summarySeq.current) setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { load(); }, [load]);

  // The revision bridge's callback — after `load` so the closure never reads a TDZ binding.
  const quietReload = useCallback(() => { void load(true); }, [load]);

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

  if (ctxLoading) return <CoachLoading label="Loading your team's money…" />;
  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  const canWrite = (page.capabilities?.money === 'write');
  // The hub's data doors are money-scoped: no money access, no menus at all. Export survives
  // for a read-only money assistant; Import (a write) does not — that split lives in the menus.
  const canViewMoney = !!page.capabilities && page.capabilities.money !== 'off';

  /* ⚠⚠ NO LONGER GATED ON A LIVE SEASON (owner ruling 5, money redesign P4, 2026-08-17). This read
     `!!summary?.orgLinked && !page.isReadOnly` — so both club tabs VANISHED the moment a season
     finished, and a coach between seasons could see the club's money on the register but could not
     open the workspace to read what those instalments were or how a request was decided. The record
     did not go read-only; it disappeared.

     That predates the history-in-place ruling, and it fails its test: club money is a RECORD, not an
     instrument — nothing here recomputes, nothing runs live — so it renders in place with every
     write control withdrawn. The panel takes `isReadOnly` from the SERVER (which resolves the
     working season) rather than guessing, and the two write routes still refuse a finished season
     outright. ⚠ Not a cross-season view: the working season between seasons IS the finished one. */
  const showOrgTabs = !!summary?.orgLinked;
  // A coach can still land on the club tab from a moment when it WAS available — the org later
  // unlinked. Rather than a dead end (tab bar shows no active tab, nothing renders below it), fall
  // back to Overview, the same way the old per-route cards simply didn't offer the link at all.
  const effectiveSection: SectionId =
    ORG_ONLY_SECTIONS.has(activeSection) && !showOrgTabs ? 'overview' : activeSection;
  const tabs: { id: SectionId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'budget', label: 'Budget Plan' },
    { id: 'dues', label: 'Player Dues' },
    { id: 'fundraisers', label: 'Fundraising' },
    /* ⚠ TWO TABS WHERE ONE SCREEN WAS (Money split P1, 2026-08-16). "Expenses & Payables" named a
       screen doing two jobs — recording what happened, and managing what is owed — and the
       ampersand in its own label was the tell. They sit adjacent and in that order because the
       money flows that way: a commitment on Payables settles INTO Transactions. */
    { id: 'transactions', label: 'Transactions' },
    { id: 'payables', label: 'Payables' },
    /* ⚠ ONE WORD, AND IT IS THE ONE COACHES USE (owner ruling 1, 2026-08-17). "Allocations" and
       "Payments" named two lists; "Club" names the relationship both lists are about — and the
       register's own chip and filter on these exact rows have read `Club` / `from Club` since P3,
       so naming the tab anything else would leave the book and the workspace calling one thing two
       things. This is also the tab the split promised back: 8 org-linked, 7 standalone. */
    ...(showOrgTabs ? [{ id: 'club' as const, label: 'Club' }] : []),
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
    // ⚠ Each fundraising row states its OWN kind rather than one leaving the filter off: the two
    // rows exist precisely because they land on different views, and "no kind" means "show
    // everything", which would make the Fundraisers row and a hypothetical unfiltered row the
    // same door wearing two names.
    fundraisers: sectionHref('fundraisers', { kind: 'fundraiser' }),
    sponsorships: sectionHref('fundraisers', { kind: 'sponsor' }),
    transactions: sectionHref('transactions'),
    payables: sectionHref('payables'),
    budgetStarter: sectionHref('budget', { starter: '1' }),
    budgetGenerate: sectionHref('budget', { generate: '1' }),
    // Payables already opens on the schedule; naming it anyway keeps the caller's INTENT in the
    // link, so a change of default view can never silently redirect "see the full schedule".
    payablesSchedule: sectionHref('payables', { tab: 'schedule' }),
    /* ⚠ `scheduled=1` IS NOT REDUNDANT even though the overlay defaults to on. A coach who turned
       it off would otherwise follow a link about money that has not moved yet and land on a book
       that deliberately excludes it — the link would appear broken, and the row they clicked would
       be the one thing missing. The address states the intent. */
    registerFrom: {
      dues:    sectionHref('transactions', { filter: 'dues', scheduled: '1' }),
      expense: sectionHref('transactions', { filter: 'expense', scheduled: '1' }),
      club:    sectionHref('transactions', { filter: 'club', scheduled: '1' }),
    },
    // One destination where two were (P4). Both rail rows collapse into it — see MoneyRail.
    ...(showOrgTabs ? { club: sectionHref('club') } : {}),
  };

  // Wide column: Money is now a tabbed hub whose panels include the densest tables in the
  // portal (Dues, Expenses and Budget vs. Actual each already opted into pageWide on their
  // own). At 960px the 8-tab row also truncated with no cue — see the tab-bar rules.
  return (
    <MoneyRefreshProvider>
    {/* ⚠⚠ THE BRIDGE HAD TO BE RENDERED, AND WAS NOT (found while wiring P2's doors, 2026-08-23).
        `MoneySummaryRevisionBridge` was written with a full header explaining the defect it closes
        — the Record chooser's live hints going stale after the first save — and then never placed
        in the tree, leaving its callback unused and the defect open. P2 makes it matter more, not
        less: money is now recorded from Player Dues, a drive's leaderboard and a bill's row, and
        every one of those writes has to reach the hints the next open reads. */}
    <MoneySummaryRevisionBridge onBump={quietReload} />
    <RecordMoneyProvider value={recordSignal}>
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
        /* ⚠ Record moved HERE from the tab row (owner ruling 2026-08-23, resolving §80's
           deviation ④): a hub-wide door belongs with the hub's other doors, and in the tab row
           it crowded a phone's strip to two visible tabs. On phones it collapses to a bare "+"
           (the aria-label carries the words) and the row now RENDERS at phone width for it —
           Import alone keeps rule 11's wide-only hiding, per-action. `actionsPhoneHidden` still
           applies when there is no Record to show (read-only money), so that coach keeps the
           empty-row-free phone header. */
        actions={canViewMoney ? (
          <>
            {canWrite && (
              <button
                type="button"
                className={`${styles.btnPrimary} ${styles.recordMoneyBtn}`}
                aria-label="Record money"
                /* Tab-aware (P2): the tab the coach is standing on pre-answers the first question
                   where it honestly can, and the answer stays changeable — see the map's header. */
                onClick={() => {
                  const branch = RECORD_BRANCH_BY_SECTION[effectiveSection];
                  requestRecord(branch ? { branch } : undefined);
                }}
              >
                <Plus size={15} aria-hidden />
                <span className={styles.headerBtnLabel}>Record</span>
              </button>
            )}
            <span className={styles.headerActionWideOnly}>
              <MoneyImportMenu
                orgSlug={orgSlug}
                teamId={teamId}
                canWriteMoney={canWrite}
                onNotice={setDataNotice}
                onImported={() => { void load(true); }}
              />
            </span>
          </>
        ) : undefined}
        actionsPhoneHidden={!canWrite}
        actionsPhoneInTitleRow
        helpLabel="Money"
        help={{ module: 'coaches', sectionIds: ['premium-money'], subtopicId: 'premium-money-cards', fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
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
        <CoachLoading label="Loading your team's money…" />
      ) : error ? (
        <CoachLoadError message={error} onRetry={() => { void load(); }} />
      ) : summary && (
        <>
          <CoachTabBar
            tabs={tabs.map(t => ({ ...t, href: sectionHref(t.id) }))}
            activeId={effectiveSection}
            ariaLabel="Money"
            remeasureKey={summary}
            /* ⚠ NEVER STICKY (reversed 2026-08-19, reading-order ruling follow-up) — this bar is
               shared chrome across all seven Money tabs, and pinning it only on Transactions made
               the ONE piece of navigation that's supposed to behave identically everywhere freeze
               on exactly one tab and nowhere else — a bigger, more visible inconsistency than the
               register's own toolbar earning a pin for being the one long, scrollable tab. The
               register keeps its own sticky filter row and column headers; this bar no longer
               opts in for any tab. See CoachTabBar's own `sticky` prop doc. */
          />

          {/* Overview forks by stage, but no longer by SHAPE: an operating season gets the
              three story cards and the merged ledger above the rail; a season still being
              set up gets the anchor card above the same rail. Both end in one index; the
              1·Plan → 4·Review card stack that used to sit under the setup view is gone
              (owner ruling 2026-08-12 — it was a second navigation system one line under
              the tab bar, and on an empty team every card in it said "nothing yet"). */}
          {effectiveSection === 'overview' && summary.stage === 'operate' && (
            <OverviewDashboard
              summary={summary}
              /* ⚠ The finished-season suppression here is DELETED (2026-08-18). The Next-N-days
                 ledger is an instrument whose API resolves the ACTIVE year, and in an archive it
                 showed TODAY's payments — but this screen is no longer rendered for a season that
                 has ended, so there is no archive left to hide it from. */
              payablesApiUrl={`/api/coaches/${orgSlug}/teams/${teamId}/upcoming-payables`}
              hrefs={moneyHrefs}
            />
          )}

          {effectiveSection === 'overview' && summary.stage !== 'operate' && (
            <SetupOverview
              summary={summary}
              hrefs={moneyHrefs}
              rosterHref={`${base}/roster`}
              canWrite={canWrite}
              showPayables
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
    </RecordMoneyProvider>
    </MoneyRefreshProvider>
  );
}