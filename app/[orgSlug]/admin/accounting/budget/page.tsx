'use client';
/**
 * Accounting › BUDGET (Club Tier Stage 3b, session 2 — hub v38/39 specimen 1; C10, C11, C05, S3B-02,
 * S3B-03, J4-026; Asks 2, 4a, 4b, 4d, 5).
 *
 * The coach's Budget with the club's one difference, billing teams, built into the line:
 *   band    — the coach's: Total revenue · Total expenses · Closing balance (red only below zero). The
 *             old four cards go (two are columns now; "Unallocated" was one of four names for one thing).
 *             Above the toolbar, as on every coach money tab and Budget vs. Actual (/design §271, 2026-10-07).
 *   toolbar — ONE line, the same in both views (owner 2026-10-01): Year · View (List · By period) · When
 *             (List only, while a line has no date; quiet at rest) or Columns (By period) · Collapse all ·
 *             Export · Tools · the one lime Add line, in the Ledgers' order (2026-10-02). On a phone: Year,
 *             View, a 44px Tools (Collapse all and Export join it) and a 44px lime +. Tools holds Categories
 *             and the teams' own words, each a window.
 *   List    — BudgetPlanList (revenue first, the category is the shelf, Planned · Allocated · Collected).
 *   By period — the coach's OWN period grid (promoted, components/coaches/MoneyPeriodGrid), fed the coach's
 *             own period view of the club's plan, built on the server (one arithmetic, gated).
 *   a line  — opens to READ (BudgetLineWindow): its allocations a section, Allocate $X opening New allocation
 *             as a page, filled in from the line. Many allocations per line (C11).
 *   a year  — the Year pill lists every year with a plan and ALWAYS the next one; an empty year offers
 *             Start from the year before's plan (lime) and Add a line (C10). Remembered for the visit, with
 *             Budget vs. Actual and the Overview.
 *
 * WHO WRITES: 3a's one money rule (owner, treasurer, an admin with Accounting — Ask 4d), answered by the
 * server as `canMove`. Everyone who can open Accounting reads.
 *
 * ⚖ STAGE 3c — THE FISCAL YEAR (hub v46, specimens 1–4; Asks 1, 4, 5, 9):
 *   · Tools › Fiscal year, the FIRST row above Categories: the year's record (when it starts, its name, the closed
 *     years) — read by anyone who opens Accounting, edited by a money mover (`FiscalYearWindow`).
 *   · a CLOSED year reads IN PLACE (Ask 1): the pill's lock, one line under the toolbar (closed by / on, Reopen on
 *     the latest), and every write ABSENT, never greyed — the server answers `canMove` false, so Add line, Start
 *     from, the line's pencil and Allocate are not drawn, and Tools keeps only its reads; an unbilled part says the
 *     club paid it. Nothing here asks "is it closed?" a second way: `canMove` is the one answer.
 *   · the year that opens (Ask 4): once the year before is closed, the opening row wears the lock and says where
 *     it came from.
 *   · a new club (Ask 5): under its first, empty plan, one quiet line with an olive door to the window — only while
 *     the club has never set its year (it still reads January) and nothing is planned in any year.
 *
 * ⚰ THE OLD PAGE (four cards, the in-row ✎ / 🗑 / "View Allocation →" / "Allocate to Teams", the periods
 * fold, the foot panels) and its stylesheet retired with this page, and so did the old Allocate page.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { CoachListToolbar } from '@/components/coaches/kit';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import { PeriodGrid } from '@/components/coaches/MoneyPeriodGrid';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { LoadFailed, useDeferredLoad, useLatestRead } from '@/components/admin/kit/club/RepKit';
import { money, moneyFetch, jsonInit, refusalText } from '@/components/admin/kit/club/money/MoneyKit';
import YearPill, { useClubYear } from '@/components/admin/kit/club/money/YearPill';
import BudgetPlanList, { lineHasUndated, planFoldKeys, type WhenFilter } from '@/components/admin/kit/club/money/BudgetPlanList';
import {
  AddLineWindow, BudgetLineWindow, CategoriesWindow, FromTheTeamsWindow, TeamWordsWindow,
} from '@/components/admin/kit/club/money/BudgetWindows';
import { FiscalYearWindow, ReopenYearQuestion, YearLine } from '@/components/admin/kit/club/money/FiscalYearParts';
import fy from '@/components/admin/kit/club/money/FiscalYear.module.css';
import ClubMoneyExport, { useClubMoneyFile, type ClubMoneyFile } from '@/components/admin/kit/club/money/ClubMoneyExport';
import cr from '@/components/admin/kit/club/money/ClubReport.module.css';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import bud from '@/app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css';
import { fmt as fmtSigned } from '@/lib/coach-money-summary';
import { PLAN_LADDER_LABEL } from '@/lib/coach-budget-totals';
import { GRANULARITY_LABEL, PERIOD_GRANULARITIES, whenSummary, whenSummaryText, type PeriodGranularity } from '@/lib/coach-budget-periods-view';
import { budgetPeriodGridColumns, budgetPeriodGridRows, type MoneyRowKind } from '@/lib/coach-money-exports';
import {
  BUDGET_BAND_WORDS, FISCAL_YEAR_WINDOW_WORDS, FROM_THE_TEAMS_SPREAD_NOTE, FROM_THE_TEAMS_WORD, budgetOpeningNote,
  carriedOpeningNote, emptyYearWords, netForYearWord, openingBalanceRowWord, outsideTheYearNote,
} from '@/lib/club-money-words';
import { FISCAL_YEAR_WORD } from '@/lib/club-fiscal-year';
import { clubYearSpan } from '@/lib/club-money-figures';
import type { FiscalYearOption, FiscalYearRead } from '@/lib/club-fiscal-year';
import type { ClubPlan, ClubPlanWithPeriods, PlanLineRow } from '@/lib/club-budget-report';
import type { BudgetCategoryWithItems } from '@/lib/types';
import type { ExportColumnDef } from '@/lib/export';

interface PlanRead {
  /** The fiscal year read (Stage 3c). */
  year: FiscalYearRead;
  /** The Year pill — each with its plan's line count (the empty year's "Start from"). */
  years: FiscalYearOption[];
  today: string;
  canMove: boolean;
  plan: ClubPlanWithPeriods;
}

type Win = 'add' | 'teams' | 'categories' | 'words' | 'year' | 'reopen' | null;

/** The List's file: the plan as it reads, revenue first, each line with its word, When and the plan's three money
 *  columns; the plan's close under it (session 1's call list: "its rows gain Allocated and Collected, and Revenue"). */
const LIST_COLUMNS: ExportColumnDef[] = [
  { label: 'Category / line', key: 'item', format: 'text' },
  { label: 'Filed under', key: 'word', format: 'text' },
  { label: 'When', key: 'when', format: 'text' },
  { label: 'Planned', key: 'planned', format: 'currency' },
  { label: 'Allocated', key: 'allocated', format: 'currency' },
  { label: 'Collected', key: 'collected', format: 'currency' },
  { label: 'Notes', key: 'notes', format: 'text' },
];

function listRows(plan: ClubPlan): { rows: Record<string, string | number>[]; kinds: (MoneyRowKind | undefined)[] } {
  const rows: Record<string, string | number>[] = [];
  const kinds: (MoneyRowKind | undefined)[] = [];
  const push = (r: Record<string, string | number>, k?: MoneyRowKind) => { rows.push(r); kinds.push(k); };
  const when = (l: { periods: PlanLineRow['periods']; planned: number }) =>
    whenSummaryText(whenSummary(l.periods.map(p => ({ periodDate: p.date, amount: p.amount })), l.planned), money);
  const L = PLAN_LADDER_LABEL;
  push({ item: L.revenueBand.toUpperCase() }, 'section');
  const t = plan.revenue.fromTheTeams;
  if (t.planned > 0.005 || t.allocations.length > 0) {
    push({ item: FROM_THE_TEAMS_WORD, when: when({ periods: t.periods, planned: t.planned }), planned: t.planned }, 'category');
    for (const a of t.allocations) push({ item: `  — ${a.description}`, planned: a.allocated }, 'item');
  }
  const line = (l: PlanLineRow) => push({
    item: `  — ${l.description}`, word: l.itemName ? `${l.categoryName ?? ''} › ${l.itemName}` : '', when: when(l),
    planned: l.planned, allocated: l.allocations.length > 0 ? l.allocated ?? '' : '', collected: l.allocations.length > 0 ? l.collected ?? '' : '',
    notes: l.notes ?? '',
  }, 'item');
  for (const c of plan.revenue.categories) { push({ item: c.categoryName, planned: c.planned }, 'category'); c.lines.forEach(line); }
  push({ item: L.totalRevenue, planned: plan.revenue.total }, 'total');
  push({ item: L.expensesBand.toUpperCase() }, 'section');
  for (const c of plan.expenses.categories) {
    push({ item: c.categoryName, planned: c.planned, allocated: c.allocated ?? '', collected: c.collected ?? '' }, 'category');
    c.lines.forEach(line);
  }
  push({ item: L.totalExpenses, planned: plan.expenses.total, allocated: plan.expenses.allocated, collected: plan.expenses.collected }, 'total');
  const firstDay = clubYearSpan(plan.year).first;
  push({ item: openingBalanceRowWord(firstDay), planned: plan.openingBalance }, 'total');
  push({ item: netForYearWord(plan.year.name), planned: plan.net }, 'total');
  push({ item: L.closingBalance, planned: plan.closingBalance }, 'total');
  return { rows, kinds };
}

export default function BudgetTab() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const router = useRouter();
  const search = useSearchParams();
  const isPhone = useIsPhone();
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const base = `/${slug}/admin/accounting`;

  const [year, setYear] = useClubYear(slug);
  const [read, setRead] = useState<PlanRead | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<'list' | 'period'>(() => (search.get('view') === 'period' ? 'period' : 'list'));
  const [granularity, setGranularity] = useState<PeriodGranularity>('months');
  const [when, setWhen] = useState<WhenFilter>('all');
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const [gridClosed, setGridClosed] = useState<Set<string>>(() => new Set());
  const [monthStart, setMonthStart] = useState<number | null>(null);
  const [lineId, setLineId] = useState<string | null>(() => search.get('line'));
  const [win, setWin] = useState<Win>(null);
  const [categories, setCategories] = useState<BudgetCategoryWithItems[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useNotice();

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug) return;
    const current = beginRead();
    const r = await moneyFetch<PlanRead>(`/api/admin/accounting/budget-plan?${q}${year ? `&year=${year}` : ''}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
    setRead(r.data);
  }, [slug, q, year, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  // The word picker's list: planning-eligible words only (the club's own plan never files under a team's word).
  const loadCategories = useCallback(async () => {
    const r = await moneyFetch<{ categories?: BudgetCategoryWithItems[] }>(`/api/admin/accounting/budget-categories?scope=org&forPlanning=1&${q}`).catch(() => null);
    if (r?.ok) setCategories(r.data.categories ?? []);
  }, [q]);
  const canMove = read?.canMove ?? false;
  useDeferredLoad(canMove && categories === null, loadCategories);

  // A line opened from another tab (Budget vs. Actual's plan panel, Months): `?line=` — once, then the address is clean.
  useEffect(() => {
    if (!search.get('line') && !search.get('view')) return;
    router.replace(`${base}/budget`);
  }, [search, router, base]);

  const plan = read?.plan ?? null;
  const allLines = useMemo(() => (plan ? [...plan.revenue.categories, ...plan.expenses.categories].flatMap(c => c.lines) : []), [plan]);
  const openLine = allLines.find(l => l.id === lineId) ?? null;
  const hasUndated = allLines.some(lineHasUndated);
  const changed = useCallback((text: string | null) => { if (text) setNotice({ tone: 'good', text }); void load(); }, [load, setNotice]);

  /* The file is the shape on screen: the List, or the period grid at the granularity chosen. */
  const buildExport = useCallback((): ClubMoneyFile => {
    if (!read) throw new Error('The budget is still loading.');
    const p = read.plan;
    const asGrid = view === 'period';
    const pv = granularity === 'quarters' ? p.periodView.quarters : p.periodView.months;
    const built = asGrid ? budgetPeriodGridRows(pv, { leadRowName: FROM_THE_TEAMS_WORD }) : listRows(p);
    return {
      dataset: asGrid ? `budget-by-${granularity}` : 'budget',
      title: asGrid ? `Budget by ${granularity === 'months' ? 'month' : 'quarter'}` : 'Budget',
      columns: asGrid ? budgetPeriodGridColumns(pv) : LIST_COLUMNS,
      rows: built.rows,
      rowKinds: built.kinds,
      scopeLabel: p.year.name,
      teamName: currentOrg?.name ?? '',
      // No masthead: the plan is a DATASET, as the coach's is (its file starts on its column row, the round-trip
      // rule — `export-masthead-guard`). Budget vs. Actual and the board report are the club's documents.
      emptyMessage: `The ${p.year.name} plan has nothing in it yet.`,
    };
  }, [read, view, granularity, currentOrg?.name]);
  const exportFailed = useCallback((text: string) => setNotice({ tone: 'bad', text }), [setNotice]);
  const runExport = useClubMoneyFile(q, slug, buildExport, exportFailed);

  if (failed) return <LoadFailed title="We couldn’t load the budget." onRetry={() => void load()} />;
  if (!read || !plan) return <p className={ck.loading}>Loading…</p>;

  const isEmpty = allLines.length === 0 && plan.revenue.fromTheTeams.allocations.length === 0;
  // The newest earlier fiscal year that has lines (keys are first days, so they sort as dates).
  const fromYear = read.years.filter(y => y.key < plan.year.key && y.lines > 0).sort((a, b) => b.key.localeCompare(a.key))[0] ?? null;
  const words = emptyYearWords(plan.year.name, fromYear?.name ?? null);
  /* A new club meets the year on its first, empty plan (Ask 5): only while it still reads January (it has never set
     a first month), nothing is planned in any year and nothing is closed — so nothing has to move. */
  const newClub = isEmpty && canMove && read.years.every(y => y.lines === 0 && !y.locked)
    && plan.year.firstDay.slice(5, 7) === '01' && plan.year.months === 12;
  const nextYearName = read.years.filter(y => y.key > plan.year.key).sort((a, b) => a.key.localeCompare(b.key))[0]?.name ?? '';
  const firstDay = clubYearSpan(plan.year).first;
  const toggle = (set: (fn: (s: Set<string>) => Set<string>) => void) => (key: string) =>
    set(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const otherRevenueLines = plan.revenue.categories.reduce((n, c) => n + c.lines.length, 0);
  const periodView = granularity === 'quarters' ? plan.periodView.quarters : plan.periodView.months;
  /* Collapse all / Expand all — the coach's section-level fold, on whichever view is on screen, and only where there is
     something to fold (§271, 2026-10-07: the 3b drawing left it off the Budget while drawing it on Budget vs. Actual,
     and it is not one of the six named differences). A computer: a quiet button after the pills; a phone: a row in Tools. */
  const foldKeys = isEmpty ? [] : view === 'period' ? periodView.groups.map(g => g.key) : planFoldKeys(plan, hasUndated ? when : 'all');
  const foldSet = view === 'period' ? gridClosed : closed;
  const allFolded = foldKeys.length > 0 && foldKeys.every(k => foldSet.has(k));
  const foldWord = allFolded ? 'Expand all' : 'Collapse all';
  const foldAll = () => (view === 'period' ? setGridClosed : setClosed)(allFolded ? new Set() : new Set(foldKeys));

  async function startFrom() {
    if (starting || fromYear == null || !plan) return;
    setStarting(true);
    try {
      const r = await moneyFetch<{ lines: number }>(`/api/admin/accounting/budget-plan/start-from?${q}`, jsonInit('POST', { fromYear: fromYear.key, toYear: plan.year.key }));
      if (!r.ok) { setNotice({ tone: 'bad', text: refusalText(r.data, 'The plan couldn’t be started. Please try again.') }); return; }
      changed(`${plan.year.name} starts from ${fromYear.name}’s plan: ${r.data.lines} ${r.data.lines === 1 ? 'line' : 'lines'}, moved a year on. Nothing is billed until you allocate.`);
    } catch {
      setNotice({ tone: 'bad', text: 'The plan couldn’t be started. Check your connection and try again.' });
    } finally {
      setStarting(false);
    }
  }

  const exportButton = <ClubMoneyExport run={runExport} formats={['xlsx', 'csv']} disabled={isEmpty} />;

  return (
    <>
      {notice && <PageNotice notice={notice} />}
      {/* THE FIGURES FIRST, THEN THE TOOLBAR (/design §271, 2026-10-07) — the order on Budget vs. Actual one tab over
          and on every coach money tab (the Dues ruling, 2026-09-03: the band answers for the whole year under either
          lens, so switching View or When changes only what is beneath the toolbar). The 3b build spec listed this
          tab toolbar-first with no reason given. An empty year has no band, and the toolbar leads. */}
      {!isEmpty && (
        <MoneySummaryBand
          ariaLabel="Budget summary"
          tiles={[
            {
              key: 'revenue', label: PLAN_LADDER_LABEL.totalRevenue, figure: money(plan.revenue.total), tone: 'good',
              caption: BUDGET_BAND_WORDS.revenue(plan.revenue.fromTheTeams.planned, otherRevenueLines),
            },
            {
              key: 'expenses', label: PLAN_LADDER_LABEL.totalExpenses, figure: money(plan.expenses.total),
              caption: BUDGET_BAND_WORDS.expenses(plan.expenses.allocated),
            },
            {
              key: 'closing', label: PLAN_LADDER_LABEL.closingBalance, figure: fmtSigned(plan.closingBalance),
              tone: plan.closingBalance < -0.005 ? 'danger' : 'plain',
              caption: BUDGET_BAND_WORDS.closing(plan.net),
            },
          ]}
        />
      )}
      <CoachListToolbar
        actions={(
          <>
            {!isPhone && exportButton}
            <CoachToolbarMenu label="Tools" icon={<MoreHorizontal size={15} aria-hidden />} collapseOnPhone bareOnPhone drawerOnPhone drawerTitle="Tools">
              {isPhone && foldKeys.length > 0 && <CoachToolbarMenuItem label={foldWord} onSelect={foldAll} />}
              <CoachToolbarMenuItem label={FISCAL_YEAR_WORD} hint={FISCAL_YEAR_WINDOW_WORDS.toolsHint} onSelect={() => setWin('year')} />
              <CoachToolbarMenuItem label="Categories" hint="Rename the club’s shared headings" onSelect={() => setWin('categories')} />
              <CoachToolbarMenuItem label="Words your teams use" hint="Publish a team’s word to every team" onSelect={() => setWin('words')} />
              {isPhone && !isEmpty && (
                <>
                  <CoachToolbarMenuItem label="Export to Excel" hint="The plan as it reads on screen" onSelect={() => void runExport('xlsx')} />
                  <CoachToolbarMenuItem label="Export to CSV" onSelect={() => void runExport('csv')} />
                </>
              )}
            </CoachToolbarMenu>
            {canMove && (
              <button type="button" className={`btn btn-lime${isPhone ? ` ${ck.iconOnlyPhone}` : ''}`} onClick={() => setWin('add')} aria-label="Add line">
                <Plus size={15} aria-hidden /><span className={ck.btnWord}>Add line</span>
              </button>
            )}
          </>
        )}
      >
        <YearPill year={plan.year.key} years={read.years}
          onChange={y => { setYear(y); setLineId(null); setWhen('all'); }} />
        <SingleSelectDropdown label="View" lead value={view}
          options={[{ id: 'list', label: 'List' }, { id: 'period', label: 'By period' }]}
          onChange={next => setView(next as 'list' | 'period')} />
        {view === 'list' && hasUndated && (
          /* A narrowing, so quiet at rest and olive once it hides rows — the coach's When (§271, 2026-10-07). */
          <SingleSelectDropdown label="When" restQuiet restValue="all" value={when}
            options={[{ id: 'all', label: 'All' }, { id: 'undated', label: 'No date yet' }, { id: 'dated', label: 'Dated' }]}
            onChange={next => setWhen(next as WhenFilter)} />
        )}
        {view === 'period' && (
          <SingleSelectDropdown label="Columns" value={granularity}
            options={PERIOD_GRANULARITIES.map(g => ({ id: g, label: GRANULARITY_LABEL[g] }))}
            onChange={next => setGranularity(next as PeriodGranularity)} />
        )}
        {!isPhone && foldKeys.length > 0 && (
          <button type="button" className={`${shared.btnGhost} ${bud.collapseAllBtn}`} onClick={foldAll}>{foldWord}</button>
        )}
      </CoachListToolbar>
      <YearLine year={read.year} onReopen={() => setWin('reopen')} />

      {isEmpty ? (
        /* C10: an empty year — the compact tier: one sentence, the fact, the one lime action. */
        <div className={cr.emptyYear}>
          <p className={cr.emptyYearTitle}>{words.title}</p>
          <p className={cr.emptyYearBody}>{words.body}</p>
          {canMove && (
            <div className={cr.emptyYearActions}>
              {words.start && (
                <button type="button" className="btn btn-lime" onClick={() => void startFrom()} disabled={starting}>
                  {starting ? 'Starting…' : words.start}
                </button>
              )}
              <button type="button" className={words.start ? 'btn btn-outline' : 'btn btn-lime'} onClick={() => setWin('add')}>Add a line</button>
            </div>
          )}
          {newClub && (
            <p className={cr.emptyYearBody}>
              {FISCAL_YEAR_WINDOW_WORDS.newClub}{' '}
              <button type="button" className={fy.inlineDoor} onClick={() => setWin('year')}>{FISCAL_YEAR_WINDOW_WORDS.newClubDoor}</button>
            </p>
          )}
        </div>
      ) : (
        <div className={cr.report}>
          {view === 'list' ? (
            <BudgetPlanList
              plan={plan}
              locked={plan.year.locked}
              carriedFrom={read.year.carriedFrom}
              when={hasUndated ? when : 'all'}
              closed={closed}
              onToggle={toggle(setClosed)}
              onOpenLine={setLineId}
              onOpenTeams={() => setWin('teams')}
            />
          ) : (
            <PeriodGrid
              view={periodView}
              granularity={granularity}
              monthStart={monthStart}
              onMonthStart={setMonthStart}
              closed={gridClosed}
              onToggle={toggle(setGridClosed)}
              onEditLine={id => setLineId(id)}
              duesHref={`${base}/allocations`}
              leadRow={{ name: FROM_THE_TEAMS_WORD, title: 'See the allocations it adds up', onOpen: () => setWin('teams') }}
              spanWord="year"
              openingNote={read.year.carriedFrom
                ? carriedOpeningNote(fmtSigned(plan.openingBalance), read.year.carriedFrom.name)
                : budgetOpeningNote(plan.openingBalance, firstDay)}
              beyondNote={outsideTheYearNote(plan.year.name)}
              closingNote={plan.revenue.fromTheTeams.allocations.length > 0 ? FROM_THE_TEAMS_SPREAD_NOTE : undefined}
            />
          )}
        </div>
      )}

      {openLine && (
        <BudgetLineWindow
          key={openLine.id}
          line={openLine}
          year={plan.year}
          q={q}
          orgSlug={slug}
          canMove={canMove}
          locked={plan.year.locked}
          categories={categories ?? []}
          onChanged={changed}
          onClose={() => setLineId(null)}
        />
      )}
      {win === 'year' && <FiscalYearWindow q={q} onChanged={changed} onClose={() => setWin(null)} />}
      {win === 'reopen' && (
        <ReopenYearQuestion q={q} year={read.year} nextName={nextYearName}
          onDone={text => { setWin(null); changed(text); }} onClose={() => setWin(null)} />
      )}
      {win === 'add' && (
        <AddLineWindow
          year={plan.year}
          q={q}
          orgSlug={slug}
          categories={categories ?? []}
          onWord={itemId => {
            const l = allLines.find(x => x.itemId === itemId);
            return l ? { description: l.description, planned: l.planned } : null;
          }}
          onAdded={text => { setWin(null); changed(text); }}
          onClose={() => setWin(null)}
        />
      )}
      {win === 'teams' && (
        <FromTheTeamsWindow
          year={plan.year}
          rows={plan.revenue.fromTheTeams.allocations}
          planned={plan.revenue.fromTheTeams.planned}
          periods={plan.revenue.fromTheTeams.periods}
          q={q}
          orgSlug={slug}
          accountingBase={base}
          onChanged={() => changed(null)}
          onClose={() => setWin(null)}
        />
      )}
      {win === 'categories' && (
        <CategoriesWindow q={q} canMove={canMove} onRenamed={() => { void load(); void loadCategories(); }} onClose={() => setWin(null)} />
      )}
      {win === 'words' && <TeamWordsWindow orgSlug={slug} canMove={canMove} onClose={() => setWin(null)} />}
    </>
  );
}
