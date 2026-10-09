'use client';
/**
 * Accounting › BUDGET VS. ACTUAL (Club Tier Stage 3b, session 2 — hub v38/39 specimen 2; C05, C09,
 * J4-024, J4-025, S3B-01, S3B-05; Asks 2, 4a, 5).
 *
 * The coach's Budget vs. Actual, read like the coach's:
 *   band      — the coach's, word for word (ruled 2026-10-01, walked §256): Collected · Spent · Off-plan
 *               (hidden at zero, amber) · Cash on hand (the club's own books, today; red only below zero).
 *               Collected is Total revenue's Actual — "Collected" carries two scopes on purpose (Ask 2).
 *   toolbar   — Year · View (Statement · Months) · then Compare (Whole year · To date) on the Statement, Showing
 *               on Months, and Collapse all on both · Export. Two lines on a phone.
 *   Statement — the coach's OWN rows (promoted, components/coaches/MoneyStatementRows), fed the club's
 *               report: Revenue → categories → lines → Total revenue; Expenses → the same; Net for the year.
 *               Off-plan rows show the amber dash (no chip, no word, a screen-reader sentence); one Not filed
 *               row; every Variance coloured; From the teams' allocations are ordinary lines. A row opens
 *               nothing; its TWO FIGURES are the doors — Budgeted opens the line's own window, Actual opens
 *               what it adds up (the coach's panel's rules, the club's doors).
 *   Months    — the coach's MoneyMonthGrid, fed session 1's club figures — never a second grid: categories
 *               folded at open, today's column tinted, the year band, the balance block with The club's
 *               other books above it. Opens on Budget, as the coach's does. Scheduled is offered on the
 *               current year only (it starts from TODAY's cash, which another year has no reading of —
 *               session 1 left the call to the screens; recorded at build).
 *   Gone      — the four figure cards, Org Headroom, the Org Ledger Expenses panel, team health (S3B-05:
 *               the summary's now), the dead "Coming Soon" window and the "future update" sentence.
 *
 * ⚖ STAGE 3c (hub v46, specimens 2–5; Asks 1, 4, 8c):
 *   · a CLOSED year reads in place: the pill's lock, one line under the toolbar, and the band's Cash on hand is
 *     the year's CLOSING at its last day (a closed year reads only figures that can't move). The line here
 *     carries no Reopen — as drawn; Reopen lives on the Budget and the Overview.
 *   · last year's bills, paid this year, are their own line under From the teams with Budgeted blank — the
 *     server files them so (`plannedIn`); the shared Statement rows draw them.
 *   · COMPARE › AGAINST LAST YEAR — the SEVENTH named difference from the coach's (Ask 8c, club only): this year's
 *     Actual, last year's, and the Change (signed; coloured as a verdict — more revenue and less spending green,
 *     the reverse red: the coach's Variance rule on a year-on-year difference). Each year's heading names the span
 *     it covers (the server's spans: whole years, to the same day, or the same months against a short year). The
 *     rows fold like the Statement's; ⚠ its figures are NOT doors (departure, recorded: the comparison carries no
 *     line lists — the year's own Statement, one pick away on the same pill, keeps them).
 */
import { Fragment, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { toggleAllKeys, toggleKey } from '@/lib/toggle-key';
import { CoachListToolbar } from '@/components/coaches/kit';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import ReportNotes from '@/components/coaches/ReportNotes';
import MoneyMonthGrid, { monthGridFoldKeys, type MonthGridClubReading } from '@/components/coaches/MoneyMonthGrid';
import {
  CatFoldRow, CategoryGroup, SectionBand, SubtotalRow, catFoldable, catKeyOf, fmtCell, fmtVariance, rebaseReport, varianceColor, varianceText,
  type BehindSide, type CategoryResult, type ItemResult, type MoneyReport,
} from '@/components/coaches/MoneyStatementRows';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { LoadFailed, useDeferredLoad, useLatestRead } from '@/components/admin/kit/club/RepKit';
import { money, moneyFetch } from '@/components/admin/kit/club/money/MoneyKit';
import YearPill, { useClubYear } from '@/components/admin/kit/club/money/YearPill';
import StatementBehindWindow from '@/components/admin/kit/club/money/StatementBehindWindow';
import AllocationRecordWindow from '@/components/admin/kit/club/money/AllocationRecordWindow';
import { BudgetLineWindow } from '@/components/admin/kit/club/money/BudgetWindows';
import ClubMoneyExport, { useClubMoneyFile, type ClubMoneyFile } from '@/components/admin/kit/club/money/ClubMoneyExport';
import cr from '@/components/admin/kit/club/money/ClubReport.module.css';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import bvaStyles from '@/app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/bva.module.css';
import { fmt as fmtSigned } from '@/lib/coach-money-summary';
import { MONEY_LENSES, formatMonthLong, type MoneyLens } from '@/lib/coach-budget-months';
import { planColumnLabel, normalizeBasis, type CompareBasis } from '@/lib/coach-budget-basis';
import { PLAN_LADDER_LABEL } from '@/lib/coach-budget-totals';
import type { MoneyExportFormat } from '@/lib/coach-money-exports';
import {
  CLUB_COMPARE_BASES, clubAgainstLastYearFile, clubMonthsFile, clubMonthsNotes, clubNetRowLabel, clubStatementFile, clubStatementNotes,
} from '@/lib/club-money-reports';
import { NOT_FILED_ID } from '@/lib/club-ledger';
import { AGAINST_LAST_YEAR_WORDS, OTHER_BOOKS_WORD, cashAtCloseCaption, fiscalYearSpanWords } from '@/lib/club-money-words';
import { YearLine } from '@/components/admin/kit/club/money/FiscalYearParts';
import type { CompareSection } from '@/lib/club-year-compare';
import { clubYearSpan, sumMoney } from '@/lib/club-money-figures';
import { formatStoredDate } from '@/lib/timezone';
import type { ClubPlan, ClubReport } from '@/lib/club-budget-report';
import type { FiscalYearOption, FiscalYearRead } from '@/lib/club-fiscal-year';
import type { AgainstLastYear } from '@/lib/club-year-compare';
import type { BudgetCategoryWithItems } from '@/lib/types';

interface Read {
  /** The fiscal year read (Stage 3c): its name, span, close, `current` (today falls in it) and `canWrite`. */
  year: FiscalYearRead;
  years: FiscalYearOption[];
  canMove: boolean;
  report: ClubReport;
  plan: ClubPlan;
  /** Compare › Against last year (Ask 8c) — session 2 draws it; null when the year before has no books. */
  againstLastYear: AgainstLastYear | null;
}

type View = 'statement' | 'months';
type ClubLens = Exclude<MoneyLens, 'spending'>;

export default function BudgetVsActualTab() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const router = useRouter();
  const isPhone = useIsPhone();
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const base = `/${slug}/admin/accounting`;

  const [year, setYear] = useClubYear(slug);
  const [read, setRead] = useState<Read | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>('statement');
  const [lens, setLens] = useState<ClubLens>('budget');
  const [basis, setBasis] = useState<CompareBasis>('season');
  /** Compare › Against last year (Ask 8c) — a third choice on the same pill, offered when the year before has books. */
  const [againstLast, setAgainstLast] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  /* Months' open categories, their own set (the grid keys a category its own way); held here so Collapse all reaches
     them — the coach's Months gained it the same day (owner, 2026-10-07; see `monthGridFoldKeys`). */
  const [monthOpen, setMonthOpen] = useState<Set<string>>(() => new Set());
  const [behind, setBehind] = useState<{ item: ItemResult; categoryName: string } | null>(null);
  /** A "from the teams" Budgeted figure's allocation, open over the page (Stage 3d). */
  const [allocationId, setAllocationId] = useState<string | null>(null);
  const [lineId, setLineId] = useState<string | null>(null);
  const [categories, setCategories] = useState<BudgetCategoryWithItems[] | null>(null);
  const [notice, setNotice] = useNotice();

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug) return;
    const current = beginRead();
    const r = await moneyFetch<Read>(`/api/admin/accounting/budget-vs-actual?${q}${year ? `&year=${year}` : ''}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
    setRead(r.data);
  }, [slug, q, year, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  const canMove = read?.canMove ?? false;
  const loadCategories = useCallback(async () => {
    const r = await moneyFetch<{ categories?: BudgetCategoryWithItems[] }>(`/api/admin/accounting/budget-categories?scope=org&forPlanning=1&${q}`).catch(() => null);
    if (r?.ok) setCategories(r.data.categories ?? []);
  }, [q]);
  useDeferredLoad(canMove && lineId != null && categories === null, loadCategories);

  const report = read?.report ?? null;
  // The server says whether the year read is the one today falls in (Stage 3c: the one definition, S3C-01).
  const isThisYear = !!read?.year.current;
  const effectiveLens: ClubLens = lens === 'scheduled' && !isThisYear ? 'budget' : lens;

  /* The statement at the basis chosen — the coach's own re-cut (`rebaseReport`), one pass, every figure off
     the same arithmetic. The club's report has no By activity shape (Stage 7's), so its blocks are empty. */
  const statement: MoneyReport | null = useMemo(() => (report
    ? rebaseReport({ ...report.statement, activities: [] } as MoneyReport, basis, report.today)
    : null), [report, basis]);

  const compare = againstLast ? read?.againstLastYear ?? null : null;
  // The folds Collapse all reaches: the Statement's (or the comparison's), or on Months the grid's own under the lens.
  const foldable = view === 'months'
    ? (report ? monthGridFoldKeys(report.months, effectiveLens) : [])
    : compare ? [...compare.revenue.categories.filter(c => c.items.length > 0).map(c => compareKey('in', c)),
      ...compare.expenses.categories.filter(c => c.items.length > 0).map(c => compareKey('out', c))]
    : statement ? [...statement.revenue.categories, ...statement.expenses.categories].filter(catFoldable).map(catKeyOf) : [];
  // The set those keys live in, picked once: the label and the toggle can never read two different sets.
  const [openSet, setOpenSet] = view === 'months' ? [monthOpen, setMonthOpen] as const : [expanded, setExpanded] as const;
  const allOpen = foldable.length > 0 && foldable.every(k => openSet.has(k));
  const toggleCat = (k: string) => setExpanded(s => toggleKey(s, k));
  const toggleAll = () => setOpenSet(prev => toggleAllKeys(prev, foldable));

  /* The two figure doors. Budgeted → the line's own window (or, for From the teams' rows, whose "line" is the
     allocation, the allocation's window over this page — Stage 3d, its Compare and period kept); Actual → what it
     adds up. */
  const openBehind = useCallback((item: ItemResult, side: BehindSide, categoryName: string) => {
    if (side === 'actual') { setBehind({ item, categoryName }); return; }
    const id = item.lines?.[0]?.id;
    if (!id) return;
    if (id.startsWith('allocation:')) { setAllocationId(id.slice('allocation:'.length)); return; }
    setLineId(id);
  }, []);

  // ── The notes and the files ─────────────────────────────────────────────────────────────────
  const statementNoteStack = useMemo(() => {
    if (!report || !statement || !read) return [];
    const under = statement.revenue.variance < -0.005 ? money(Math.abs(statement.revenue.variance)) : null;
    const owed = sumMoney(read.plan.expenses.categories.flatMap(c => c.lines).map(l => ({ amount: l.outstanding ?? 0 })));
    return clubStatementNotes({
      basis,
      revenueUnder: under,
      owedByTheTeams: under && owed > 0.005 ? money(Math.min(owed, Math.abs(statement.revenue.variance))) : null,
      pending: report.pending.count > 0
        ? { count: report.pending.count, moneyOut: report.pending.moneyOut > 0.005 ? money(report.pending.moneyOut) : null, moneyIn: report.pending.moneyIn > 0.005 ? money(report.pending.moneyIn) : null }
        : null,
      notFiled: statement.expenses.categories.some(c => c.categoryId === NOT_FILED_ID),
    });
  }, [report, statement, read, basis]);

  const monthBalance = useCallback((l: MoneyLens) => (report && (l === 'budget' || l === 'scheduled' || l === 'actual')
    ? report.months.balances[l] : null), [report]);
  const monthNotes = useMemo(() => {
    if (!report) return [];
    const thisMonth = isThisYear && effectiveLens === 'actual' ? formatMonthLong(report.months.todayMonth).split(' ')[0] : null;
    const other = effectiveLens === 'difference' ? null : report.months.otherBooks[effectiveLens];
    return clubMonthsNotes({
      lens: effectiveLens, year: report.year.name,
      opening: fmtSigned(report.months.openingBalance), firstDay: formatStoredDate(clubYearSpan(report.year).first, { withYear: false }),
      cashOnHand: fmtSigned(report.months.cashOnHand),
      pendingOut: report.pending.moneyOut > 0.005 ? money(report.pending.moneyOut) : null,
      otherBooks: !!other && other.some(m => Math.abs(m.net) > 0.005),
      thisMonth,
    });
  }, [report, effectiveLens, isThisYear]);

  const buildExport = useCallback((format: MoneyExportFormat): ClubMoneyFile => {
    if (!report || !statement) throw new Error('The report is still loading.');
    // The PDF is always the year's statement — a month grid on paper can only leave months off (the coach's ruling).
    const asMonths = view === 'months' && format !== 'pdf';
    const built = asMonths
      ? clubMonthsFile(report.months, effectiveLens, monthBalance(effectiveLens))
      : compare ? clubAgainstLastYearFile(compare, report.year.name)
      : clubStatementFile(statement, basis, report.year.name);
    const lensWord = MONEY_LENSES.find(l => l.id === effectiveLens)?.label ?? '';
    return {
      dataset: asMonths ? `budget-by-month-${effectiveLens}` : 'budget-vs-actual',
      title: asMonths ? `Budget by month — ${lensWord}` : 'Budget vs. Actual',
      columns: built.columns,
      rows: built.rows,
      rowKinds: built.kinds,
      currencyNotation: 'brackets',
      scopeLabel: report.year.name,
      teamName: currentOrg?.name ?? '',
      notes: asMonths ? monthNotes : compare ? [] : statementNoteStack,
      masthead: {
        title: `${currentOrg?.name ?? ''} · ${report.year.name}`,
        subtitle: `Budget vs. Actual — ${asMonths ? `Months · Showing: ${lensWord}` : `Statement · Compare: ${compare ? AGAINST_LAST_YEAR_WORDS.option(compare.lastYear.name) : CLUB_COMPARE_BASES.find(b => b.id === basis)?.label ?? ''}`}`,
        // The year’s name and, because a name alone can’t say when a September year starts, its two days (specimen 2).
        meta: `${fiscalYearSpanWords(report.year)} · as at ${formatStoredDate(report.today, { withYear: true, longMonth: true })}`,
      },
      emptyMessage: `Budget vs. Actual has nothing to report for ${report.year.name} yet.`,
    };
  }, [report, statement, view, effectiveLens, basis, compare, monthBalance, monthNotes, statementNoteStack, currentOrg?.name]);
  const exportFailed = useCallback((text: string) => setNotice({ tone: 'bad', text }), [setNotice]);
  const runExport = useClubMoneyFile(q, slug, buildExport, exportFailed);

  if (failed) return <LoadFailed title="We couldn’t load Budget vs. Actual." onRetry={() => void load()} />;
  if (!read || !report || !statement) return <p className={ck.loading}>Loading…</p>;

  const { band } = report;
  const empty = statement.revenue.categories.length === 0 && statement.expenses.categories.length === 0;
  const plan = read.plan;
  const openLine = lineId ? [...plan.revenue.categories, ...plan.expenses.categories].flatMap(c => c.lines).find(l => l.id === lineId) ?? null : null;
  const lensOptions = MONEY_LENSES.filter(l => l.id !== 'spending' && (l.id !== 'scheduled' || isThisYear));

  const club: MonthGridClubReading = {
    balance: monthBalance,
    otherBooks: { label: OTHER_BOOKS_WORD, byLens: l => (l === 'budget' || l === 'scheduled' || l === 'actual' ? report.months.otherBooks[l] : null) },
    notes: monthNotes,
    planLineHref: id => `${base}/budget?line=${id}`,
    planDoor: { label: 'Open the Budget', href: `${base}/budget` },
    door: (d, categoryKey) => (d.section === 'ledger'
      ? (categoryKey.includes('club:from-the-teams') && d.extra?.view === 'due'
        ? { label: 'Open Coming due', href: `${base}/allocations?view=coming-due` }
        : { label: 'Open the Ledger', href: `${base}/ledger?from=${report.year.firstDay}&to=${report.year.lastDay}` })
      : null),
  };

  const groupFor = (cat: CategoryResult) => (
    <CategoryGroup
      key={catKeyOf(cat)}
      cat={cat}
      expandedCats={expanded}
      toggleCat={toggleCat}
      openBehind={(item, side) => openBehind(item, side, cat.categoryName)}
      spanWord="year"
    />
  );

  return (
    <>
      {notice && <PageNotice notice={notice} />}
      <div className={cr.report}>
        {/* The coach's band, word for word (ruled 2026-10-01): in, out, unplanned, held. */}
        <MoneySummaryBand
          ariaLabel="Budget vs. actual summary"
          tiles={[
            {
              key: 'collected', label: 'Collected', figure: fmtSigned(band.collected.amount),
              caption: band.collected.planned > 0.005 ? `of ${money(band.collected.planned)} planned` : undefined,
            },
            { key: 'spent', label: 'Spent', figure: money(band.spent.amount), caption: `of ${money(band.spent.planned)} planned` },
            { key: 'offplan', label: 'Off-plan', figure: money(band.offPlan), tone: 'warn', caption: 'nobody budgeted this', hidden: !(band.offPlan > 0.005) },
            {
              key: 'cash', label: 'Cash on hand', figure: fmtSigned(band.cashOnHand),
              tone: band.cashOnHand < -0.005 ? 'danger' : 'plain',
              caption: band.atClose ? cashAtCloseCaption(report.year.lastDay) : 'the club’s books · as of today',
            },
          ]}
        />

        <CoachListToolbar
          actions={(
            <ClubMoneyExport
              run={runExport}
              formats={['xlsx', 'csv', 'pdf']}
              disabled={empty}
              pdfHint={view === 'months' ? 'The whole-year statement — month-by-month detail is in Excel and CSV' : undefined}
            />
          )}
        >
          <YearPill year={report.year.key} years={read.years}
            onChange={y => { setYear(y); setBehind(null); setLineId(null); setAllocationId(null); setAgainstLast(false); }} />
          <SingleSelectDropdown label="View" lead value={view}
            options={[{ id: 'statement', label: 'Statement' }, { id: 'months', label: 'Months' }]}
            onChange={next => setView(next as View)} />
          {view === 'statement' && (
            <SingleSelectDropdown label="Compare" value={compare ? 'lastyear' : basis}
              options={read.againstLastYear
                ? [...CLUB_COMPARE_BASES, { id: 'lastyear', label: AGAINST_LAST_YEAR_WORDS.option(read.againstLastYear.lastYear.name) }]
                : CLUB_COMPARE_BASES}
              onChange={next => {
                if (next === 'lastyear') { setAgainstLast(true); return; }
                setAgainstLast(false);
                setBasis(normalizeBasis(next));
              }} />
          )}
          {view === 'months' && (
            <SingleSelectDropdown label="Showing" value={effectiveLens}
              options={lensOptions.map(l => ({ id: l.id, label: l.label }))}
              onChange={next => setLens(next as ClubLens)} />
          )}
          {/* Only over a grid on screen: an empty year draws a sentence, never the Statement or Months (/review). */}
          {!empty && foldable.length > 0 && !isPhone && (
            <button type="button" className={`${shared.btnGhost} ${bvaStyles.collapseAllBtn}`} onClick={toggleAll}>
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </CoachListToolbar>
        <YearLine year={read.year} />

        {empty ? (
          <div className={cr.emptyYear}>
            <p className={cr.emptyYearTitle}>Nothing to compare for {report.year.name} yet</p>
            <p className={cr.emptyYearBody}>Budget vs. Actual reads the year’s plan against what the club’s books moved. Plan the year on the Budget tab; every line an entry is filed under shows here.</p>
            <div className={cr.emptyYearActions}>
              <button type="button" className="btn btn-outline" onClick={() => router.push(`${base}/budget`)}>Open the Budget</button>
            </div>
          </div>
        ) : view === 'statement' && compare ? (
          <CompareTable compare={compare} thisYear={report.year.name} open={expanded} onToggle={toggleCat}
            note={(() => {
              const lastClosed = !!read.years.find(y => y.key === compare.lastYear.key)?.locked;
              return read.year.closed && lastClosed ? AGAINST_LAST_YEAR_WORDS.bothClosed : lastClosed ? AGAINST_LAST_YEAR_WORDS.frozen : AGAINST_LAST_YEAR_WORDS.open;
            })()} />
        ) : view === 'months' ? (
          <MoneyMonthGrid data={report.months} lens={effectiveLens} base={base} canWrite={canMove} monthStart={0} club={club}
            expanded={monthOpen} onToggle={k => setMonthOpen(prev => toggleKey(prev, k))} />
        ) : (
          <div className={bvaStyles.section}>
            <CoachScrollX sticky hint="Swipe the table to see Actual and Variance">
              <table className={`${shared.moneyGrid} ${bvaStyles.reportTable}`}>
                <colgroup>
                  <col />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 170 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className={bvaStyles.lead}>Category / Line Item</th>
                    <th scope="col">{planColumnLabel(basis)}</th>
                    <th scope="col">Actual</th>
                    <th scope="col">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.revenue.categories.length > 0 && (
                    <>
                      <SectionBand label={PLAN_LADDER_LABEL.revenueBand} />
                      {statement.revenue.categories.map(groupFor)}
                      <SubtotalRow label={PLAN_LADDER_LABEL.totalRevenue} budgeted={statement.revenue.budgeted}
                        actual={statement.revenue.actual} variance={statement.revenue.variance} direction="in" />
                    </>
                  )}
                  <SectionBand label={PLAN_LADDER_LABEL.expensesBand} />
                  {statement.expenses.categories.map(groupFor)}
                  <SubtotalRow label={PLAN_LADDER_LABEL.totalExpenses} budgeted={statement.expenses.budgeted}
                    actual={statement.expenses.actual} variance={statement.expenses.variance} direction="out" />
                  <tr className={bvaStyles.netRow}>
                    <th scope="row" className={bvaStyles.lead}>{clubNetRowLabel(basis, report.year.name)}</th>
                    <td>{fmtCell(statement.net.budgeted)}</td>
                    <td>{fmtCell(statement.net.actual)}</td>
                    <td style={{ color: varianceColor(statement.net.variance) }}>{varianceText(statement.net.variance, 'in')}</td>
                  </tr>
                </tbody>
              </table>
            </CoachScrollX>
            {/* The disclaimer stack (owner ruling 2026-09-13): one recipe for every money report's notes. */}
            <div className={shared.reportNotes}>
              <ReportNotes
                notes={statementNoteStack}
                noteClassName={n => (n.id === 'variance-key' ? bvaStyles.varianceKey : bvaStyles.undatedNote)}
                controls={{
                  'compare-to-date': text => (
                    <button type="button" className={bvaStyles.bridgeLink} onClick={() => setBasis('todate')}>{text}</button>
                  ),
                }}
              />
            </div>
          </div>
        )}
      </div>

      {behind && (
        <StatementBehindWindow item={behind.item} categoryName={behind.categoryName} report={report} q={q} orgSlug={slug} accountingBase={base}
          onChanged={() => void load()} onClose={() => setBehind(null)} />
      )}
      {allocationId && (
        <AllocationRecordWindow q={q} orgSlug={slug} allocationId={allocationId}
          onChanged={() => void load()} onClose={() => setAllocationId(null)} />
      )}
      {openLine && (
        <BudgetLineWindow
          key={openLine.id}
          line={openLine}
          year={plan.year}
          q={q}
          orgSlug={slug}
          canMove={canMove}
          categories={categories ?? []}
          onChanged={text => { if (text) setNotice({ tone: 'good', text }); void load(); }}
          onClose={() => setLineId(null)}
        />
      )}
    </>
  );
}

/** A comparison category's fold key — the Statement's own shape (direction | id), so the one open set serves both. */
const compareKey = (dir: 'in' | 'out', c: CompareSection['categories'][number]) => `${dir}|${c.categoryId ?? `name:${c.categoryName}`}`;

/** The Change, signed, coloured as a verdict: more revenue / less spending green, the reverse red (the coach's rule). */
function ChangeCell({ change, dir }: { change: number; dir: 'in' | 'out' }) {
  return <td style={{ color: varianceColor(dir === 'in' ? change : -change) }}>{Math.abs(change) <= 0.005 ? '—' : fmtVariance(change)}</td>;
}

/**
 * COMPARE › AGAINST LAST YEAR (Ask 8c): the Statement's rows and folds, its three figure columns this year's Actual,
 * last year's, and the Change. Each year's heading names the span it covers.
 */
function CompareTable({ compare, thisYear, open, onToggle, note }: {
  compare: NonNullable<Read['againstLastYear']>; thisYear: string; open: Set<string>; onToggle: (k: string) => void;
  /** Whether either column can still move, in words. */
  note: string;
}) {
  const W = AGAINST_LAST_YEAR_WORDS;
  const head = (name: string, span: { from: string; to: string }) => (
    <th scope="col">
      <span className={cr.compareHead}>{name}<span className={cr.compareSpan}>{W.columnSpan(span.from, span.to)}</span></span>
    </th>
  );
  const section = (label: string, total: string, sec: CompareSection, dir: 'in' | 'out') => (
    <>
      <SectionBand label={label} />
      {sec.categories.map(c => {
        const k = compareKey(dir, c);
        const isOpen = open.has(k);
        return (
          <Fragment key={k}>
            <CatFoldRow name={c.categoryName} open={isOpen} onToggle={() => onToggle(k)} foldable={c.items.length > 0}>
              <td>{fmtCell(c.thisYear)}</td>
              <td>{fmtCell(c.lastYear)}</td>
              <ChangeCell change={c.change} dir={dir} />
            </CatFoldRow>
            {isOpen && c.items.map(i => (
              <tr key={`${k}|${i.itemId ?? i.itemName}`}>
                <th scope="row" className={`${bvaStyles.lead} ${shared.moneyGridLead}`}>
                  <span className={shared.moneyGridExpandSpacer} />
                  <span className={bvaStyles.lineName}>{i.itemName}</span>
                </th>
                <td>{fmtCell(i.thisYear)}</td>
                <td>{fmtCell(i.lastYear)}</td>
                <ChangeCell change={i.change} dir={dir} />
              </tr>
            ))}
          </Fragment>
        );
      })}
      <tr className={shared.moneyGridTotal}>
        <th scope="row" className={bvaStyles.lead}>{total}</th>
        <td>{fmtCell(sec.thisYear)}</td>
        <td>{fmtCell(sec.lastYear)}</td>
        <ChangeCell change={sec.change} dir={dir} />
      </tr>
    </>
  );
  return (
    <div className={bvaStyles.section}>
      <CoachScrollX sticky hint="Swipe the table to see last year and the change">
        <table className={`${shared.moneyGrid} ${bvaStyles.reportTable}`}>
          <colgroup>
            <col />
            <col style={{ width: 150 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 150 }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className={bvaStyles.lead}>Category / Line Item</th>
              {head(thisYear, compare.thisSpan)}
              {head(compare.lastYear.name, compare.lastSpan)}
              <th scope="col">{W.change}</th>
            </tr>
          </thead>
          <tbody>
            {section(PLAN_LADDER_LABEL.revenueBand, PLAN_LADDER_LABEL.totalRevenue, compare.revenue, 'in')}
            {section(PLAN_LADDER_LABEL.expensesBand, PLAN_LADDER_LABEL.totalExpenses, compare.expenses, 'out')}
            <tr className={bvaStyles.netRow}>
              <th scope="row" className={bvaStyles.lead}>Net for the year</th>
              <td>{fmtCell(compare.net.thisYear)}</td>
              <td>{fmtCell(compare.net.lastYear)}</td>
              <ChangeCell change={compare.net.change} dir="in" />
            </tr>
          </tbody>
        </table>
      </CoachScrollX>
      <div className={shared.reportNotes}>
        <p className={bvaStyles.undatedNote}>{W.key}</p>
        <p className={bvaStyles.undatedNote}>{note}</p>
      </div>
    </div>
  );
}
