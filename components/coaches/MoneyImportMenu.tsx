'use client';
import { useCallback, useRef, useState } from 'react';
import { Upload, History } from 'lucide-react';
import { useBumpMoneyRevision } from '@/lib/coach-money-refresh';
import type { BudgetCategoryWithItems, RepBudgetPlan, RepTeamExpense, RepTeamImportEvent } from '@/lib/types';
import type { MonthKey } from '@/lib/coach-budget-months';
import BudgetImportSheet from '@/components/coaches/BudgetImportSheet';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import {
  CoachToolbarMenu, CoachToolbarMenuHeading, CoachToolbarMenuItem, CoachToolbarMenuSeparator,
} from '@/components/coaches/CoachToolbarMenu';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './MoneyImportMenu.module.css';

/**
 * Something the coach must READ after a menu pick — an import result, or a failure. Declared
 * once and imported by the hub that renders it, so the two ends of `onNotice` cannot drift.
 */
export type MoneyDataNotice = { text: string; tone: 'ok' | 'bad' } | null;

/**
 * The Money hub's ONE hub-wide door: `Import ▾`, constant on every tab.
 *
 * ⚠ EXPORT USED TO LIVE HERE AND NO LONGER DOES (owner ruling 2026-08-13, mockup artifact
 * 96675523). The two are not the same kind of door, and one screen made that undeniable: Budget
 * vs. Actual grew a second Export button, because the hub menu could only offer a generic file
 * while the page could offer the grid the coach had actually arranged.
 *
 *   **Import has one right answer per dataset, wherever you are standing.** Bringing in budget
 *   lines does not depend on which tab is open or how anything is filtered. Hub-wide, honestly.
 *
 *   **Export never does.** Every tab carries view state the header cannot see — two shapes and
 *   four readings on Budget vs. Actual, List/By period on the plan, three sub-tabs and a tag
 *   filter on Expenses. So Export moved into each tab's own control row, beside the switches that
 *   decide what it contains (`MoneyExportButton`).
 *
 * **The test for any future door: if the answer changes with what the coach is looking at, it
 * belongs beside what they are looking at.**
 *
 * ⚠ THIS MENU DISAPPEARS AT PHONE WIDTH (rule 11 / decision 4). Importing needs a file picker a
 * phone does not have — and the paste-a-block mode that exists *because* of that survives through
 * the EMPTY STATES, which keep offering an import at every width (the empty budget's first-run
 * card, the empty payables list). That mitigation is not optional; hiding this menu without it
 * would make a shipped feature unreachable on a phone.
 *
 * ⚠ WRITE-GATED. A read-only money assistant never sees it, and it is absent in an archived
 * season, where nothing may be written. (Export is not gated — reading is not writing — which is
 * another reason the two stopped sharing a control.)
 */
export default function MoneyImportMenu({
  orgSlug,
  teamId,
  seasonQuery,
  canWriteMoney,
  onNotice,
  onImported,
}: {
  orgSlug: string;
  teamId: string;
  /** `?year=…` on an archived season, '' on the live one — every dataset read follows it. */
  seasonQuery: string;
  /** Money write capability, already folded through the season's read-only state by the caller. */
  canWriteMoney: boolean;
  /**
   * Anything the coach must READ — an import result, or a failure.
   *
   * ⚠ It cannot be rendered here. This component lives in the page header's actions slot, which
   * is a right-pinned flex row, and picking any item closes the menu — so a message shown inside
   * either would be squeezed into the button row or never seen at all. The hub renders it in the
   * body, under the header, where the coach's eyes already are.
   */
  onNotice: (notice: MoneyDataNotice) => void;
  /**
   * Rows landed — the hub should re-read its own summary.
   *
   * ⚠ SEPARATE FROM the panel refresh signal on purpose. This menu bumps a React context that the
   * mounted TAB PANELS consume, but the hub page RENDERS that provider and therefore cannot
   * consume it — a component never sees a context it supplies. The Import menu works from any
   * tab, Overview included, so without this callback importing while sitting on Overview left
   * every tile and rail row describing the season as it was a moment ago (/review, 2026-08-13).
   */
  onImported: () => void;
}) {
  const bumpMoneyRevision = useBumpMoneyRevision();

  // ── Import ────────────────────────────────────────────────────────────────
  // The sheet needs the team's taxonomy, its existing lines and payable descriptions, and the
  // months its money already spans. The hub does not hold any of that — the panels do, and a
  // panel may never have been opened — so it is fetched at the moment the coach picks a target.
  // One extra request, on a deliberate click, buys a menu that works from any tab.
  type ImportTarget = 'budget' | 'payables';
  const [importTarget, setImportTarget] = useState<ImportTarget | null>(null);
  const [importPrep, setImportPrep] = useState<{
    categories: BudgetCategoryWithItems[];
    plan: RepBudgetPlan | null;
    seasonYear: number;
    payableDescriptions: string[];
    planMonths: MonthKey[];
  } | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  const openImport = useCallback(async (target: ImportTarget) => {
    setImportLoading(true);
    onNotice(null);
    try {
      // ⚠ ALL THREE ARE FETCHED WHICHEVER TARGET WAS PICKED. The sheet lets the coach change
      // shape after it opens, so an import started as "Budget lines" can end up on the payables
      // shape — and that shape's look-alike detection needs the existing descriptions. Skipping
      // the third call to save a request would quietly downgrade the preview's verdicts.
      const [catRes, planRes, expRes] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/budget-items`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan${seasonQuery}`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses${seasonQuery}`),
      ]);
      const catData = await catRes.json().catch(() => ({}));
      const planData = await planRes.json().catch(() => ({}));
      if (!planRes.ok) throw new Error(planData.error ?? 'Your budget could not be loaded.');
      const expData = expRes.ok ? await expRes.json().catch(() => ({})) : { expenses: [] };

      const plan: RepBudgetPlan | null = planData.plan ?? null;
      const months = new Set<string>();
      for (const line of plan?.lines ?? []) {
        for (const period of line.periods) {
          const m = period.periodDate?.slice(0, 7);
          if (m && /^\d{4}-\d{2}$/.test(m)) months.add(m);
        }
      }

      setImportPrep({
        categories: catData.categories ?? [],
        plan,
        seasonYear: typeof planData.seasonYear === 'number' ? planData.seasonYear : new Date().getFullYear(),
        payableDescriptions: ((expData.expenses ?? []) as RepTeamExpense[]).map(e => e.description),
        planMonths: [...months].sort() as MonthKey[],
      });
      setImportTarget(target);
    } catch (e: unknown) {
      onNotice({ text: e instanceof Error ? e.message : 'That importer could not be opened.', tone: 'bad' });
    } finally {
      setImportLoading(false);
    }
  }, [orgSlug, teamId, seasonQuery, onNotice]);

  // ── Recent imports ────────────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<RepTeamImportEvent[] | null>(null);
  const [historyError, setHistoryError] = useState('');

  // ⚠ Only the NEWEST request may write. This sheet can be closed and reopened immediately (the
  // menu item is never disabled), so two fetches can overlap — and without this guard a slower
  // first response landing last would overwrite the fresher list, most visibly right after an
  // import, which is exactly when a coach opens it (/review finding, 2026-08-13).
  const historyRequest = useRef(0);

  const loadHistory = useCallback(async () => {
    const ticket = ++historyRequest.current;
    setHistoryError('');
    // Back to "Loading…" rather than showing the last visit's list while the new one arrives —
    // a coach who has just imported would otherwise watch a list that does not include it.
    setHistory(null);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/money-imports`);
      const data = await res.json().catch(() => ({}));
      if (ticket !== historyRequest.current) return;
      if (!res.ok) throw new Error(data.error ?? 'That history could not be loaded.');
      setHistory((data.imports ?? []) as RepTeamImportEvent[]);
    } catch (e: unknown) {
      if (ticket !== historyRequest.current) return;
      setHistory([]);
      setHistoryError(e instanceof Error ? e.message : 'That history could not be loaded.');
    }
  }, [orgSlug, teamId]);

  return (
    <>
      {/* Keeps its WORD: it only ever renders at widths where there is room (the phone rule drops
          the whole header row — see the stylesheet), so the icon-only collapse other header
          secondaries use would never fire here anyway. */}
      {canWriteMoney && (
        <span className={styles.menus}>
          <CoachToolbarMenu
            label="Import"
            icon={<Upload size={15} aria-hidden />}
            disabled={importLoading}
          >
            <CoachToolbarMenuHeading>Bring into Money</CoachToolbarMenuHeading>
            <CoachToolbarMenuItem
              label="Budget lines"
              hint="A month grid or a simple list, from a file or pasted"
              onSelect={() => { void openImport('budget'); }}
            />
            <CoachToolbarMenuItem
              label="Expenses & payables"
              hint="What you owe and when"
              onSelect={() => { void openImport('payables'); }}
            />
            <CoachToolbarMenuSeparator />
            <CoachToolbarMenuItem
              icon={<History size={15} aria-hidden />}
              label="Recent imports"
              onSelect={() => { setHistoryOpen(true); void loadHistory(); }}
            />
          </CoachToolbarMenu>
        </span>
      )}

      {importTarget && importPrep && canWriteMoney && (
        <BudgetImportSheet
          orgSlug={orgSlug}
          teamId={teamId}
          categories={importPrep.categories.map(c => ({
            id: c.id, name: c.name, items: c.items.map(i => ({ id: i.id, name: i.name })),
          }))}
          // COST lines only, matching what the import's write path enforces: a sheet row has no
          // kind, so offering a funding line as a match target would let "Fundraising" in a
          // spreadsheet overwrite the money the team plans to RAISE.
          existingLines={importTarget === 'budget'
            ? (importPrep.plan?.lines ?? [])
                .filter(l => l.lineKind !== 'funding')
                .map(l => ({ id: l.id, description: l.description, categoryName: l.categoryName, totalAmount: l.totalAmount }))
            : []}
          existingPayableDescriptions={importTarget === 'payables' ? importPrep.payableDescriptions : []}
          seasonYear={importPrep.seasonYear}
          gridMonths={importTarget === 'budget' ? importPrep.planMonths : []}
          todayMonth={new Date().toISOString().slice(0, 7) as MonthKey}
          initialShape={importTarget === 'payables' ? 'payables' : undefined}
          onClose={() => setImportTarget(null)}
          onImported={message => {
            setImportTarget(null);
            onNotice({ text: message, tone: 'ok' });
            // Tell whichever panels are mounted to re-read themselves. Nothing remounts, so a
            // half-filled form on another tab survives the import that just happened.
            bumpMoneyRevision();
            // And the hub's own Overview, which cannot hear that signal (see the prop's note).
            onImported();
          }}
        />
      )}

      {historyOpen && (
        <RecentImportsSheet
          imports={history}
          error={historyError}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </>
  );
}

const DATASET_WORDS: Record<RepTeamImportEvent['dataset'], string> = {
  budget_lines: 'Budget lines',
  payables: 'Expenses & payables',
};

const SHAPE_WORDS: Record<RepTeamImportEvent['shape'], string> = {
  'month-grid': 'month grid',
  list: 'simple list',
  payables: 'payables schedule',
};

/**
 * "Recent imports" — what was brought in, when, and by whom.
 *
 * This is the useful half of the coach Data Tools PAGE that the ruling declined: a volunteer
 * between innings is not in a back-office frame of mind, and a destination moves the button away
 * from the moment of need. The history is worth having; the page it would have lived on is not.
 */
function RecentImportsSheet({
  imports,
  error,
  onClose,
}: {
  imports: RepTeamImportEvent[] | null;
  error: string;
  onClose: () => void;
}) {
  useOverlayOpen(true);
  return (
    <div className={shared.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={shared.modal}>
        <CoachModalHeader title="Recent imports" onClose={onClose} titleTag="h2" closeIconSize={18} closeAriaLabel="Close recent imports" />
        {error ? (
          <p className={shared.errorText}>{error}</p>
        ) : imports === null ? (
          <p className={shared.muted}>Loading…</p>
        ) : imports.length === 0 ? (
          <p className={shared.muted}>
            Nothing has been imported into this season yet. When you bring in a budget or a
            payables schedule, it will be listed here.
          </p>
        ) : (
          <ul className={styles.historyList}>
            {imports.map(ev => (
              <li key={ev.id} className={styles.historyItem}>
                <span className={styles.historyWhat}>
                  {DATASET_WORDS[ev.dataset]} <span className={styles.historyShape}>· {SHAPE_WORDS[ev.shape]}</span>
                </span>
                <span className={styles.historyCounts}>
                  {[
                    ev.rowsCreated ? `${ev.rowsCreated} added` : '',
                    ev.rowsUpdated ? `${ev.rowsUpdated} updated` : '',
                    ev.rowsSkipped ? `${ev.rowsSkipped} skipped` : '',
                    ev.rowsFailed ? `${ev.rowsFailed} failed` : '',
                  ].filter(Boolean).join(' · ')}
                </span>
                <span className={styles.historyWho}>
                  {new Date(ev.createdAt).toLocaleString('en-CA', {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                  {ev.createdByName ? ` · ${ev.createdByName}` : ''}
                  {ev.sourceFilename ? ` · ${ev.sourceFilename}` : ev.source === 'paste' ? ' · pasted' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
