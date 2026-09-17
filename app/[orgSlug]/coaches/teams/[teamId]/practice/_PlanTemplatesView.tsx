'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookMarked, History, NotebookPen, Plus } from 'lucide-react';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import { filterTagged } from '@/lib/rep-drills';
import { totalPlannedMinutes } from '@/lib/rep-practice-plan';
import {
  templateBlocksLine, templateShapeLabel, templateUseLabel,
  type RepTeamPlanTemplateWithUsage,
} from '@/lib/rep-plan-templates';
import { sortLibraryRows, type LibrarySortColumn } from '@/lib/library-sort';
import {
  LibraryFilterBar, LibraryTable, LibraryTableRow, libraryCountCell, libraryDateCell, libraryDateLabel,
} from '@/components/coaches/LibraryRow';
import { LibrarySortHead, LibrarySortMenu, useLibrarySort } from '@/components/coaches/LibrarySort';
import { PastSeasonImportDialog, usePastSeasonImport, type PastSeasonRow } from '@/components/coaches/PastSeasonImport';
import { planTemplateHref } from '@/lib/practice-plans-address';
import PracticePlansTabs from './_PracticePlansTabs';
import styles from '../../../coaches.module.css';

/**
 * The plan-template library — the TEMPLATES TAB of the Practice plans room (practices
 * re-evaluation stage 0, owner ruling D5, 2026-09-14; redrawn at stage 4, owner rulings L3 · L4,
 * 2026-09-16; the columns follow-up, owner rulings T1–T4, 2026-09-17). A TABLE on the portal's
 * list recipe: Template (the name, its tags beside it, and the BLOCKS' TITLES as its line —
 * "Warm-up · Skills circuit · Small-sided game") · Length ("60 min · 3 blocks", because it is
 * what makes a template pickable without opening it) · Started (the figure — "8 plans", a dash
 * at zero) · Last planned (the date) · a chevron. **The row is the door** to the template's
 * editor; Rename is the editor's own Name field and Retire follows it into the editor's header —
 * there are no actions on a row. An empty template reads "Nothing in it yet" in the quiet italic
 * — words, never "0 blocks" — and is NOT offered in *Start this plan from…* (L4); "Start from
 * blank" stays.
 *
 * ⚠ A VIEW, not a page: the hub (`practice/page.tsx`) resolves the team, the season and the
 * capability gates before this mounts, and decides whether the tab exists at all. It renders its
 * own page header because its header ACTION ("New template") and its help section are its own.
 *
 * ⚠ **ONE FLAT LIST, filtered by tag chips — never category groups.** Templates carry SEVERAL tags
 * now, so a grouped list would print the same template under two headings. "No tags" is always
 * offered when it applies, so a template can never become unreachable by having none.
 *
 * ⚠ **Opens in NAME order and says nothing on its own; every heading sorts on a click** (T3,
 * 2026-09-17 — this replaced "sorted by name, never by use"). A sort here is the coach asking
 * their own library a question, never the library ranking their ideas unasked; the no-ranking
 * rule proper is about children, not templates. The choice is remembered per tab in this browser;
 * the rules of the order live in `lib/library-sort.ts`.
 *
 * ⚠ **"8 plans", never "used 8×"** — a template's count is a fact about the PLANS it produced,
 * and nothing records what was actually run (D4). Zero is a dash in the table (the heading says
 * "Started"; Length shows a dash for an empty template the same way) and "Not started a plan
 * yet" in words on the card, so an unused template never reads as a failing score.
 *
 * ⚠ **Retired, not deleted**, and a retired template dims under "Show retired" rather than
 * disappearing — plans it already started keep reading exactly as written.
 *
 * ⚠ **No archive door.** This room is live-season only (owner ruling 2026-08-01) — a template
 * library is a reusable INSTRUMENT, and the Development hub hides its door in a completed season.
 * A coach loses nothing: templates are keyed by TEAM, so they cross a rollover on their own.
 *
 * ⚠ **An assistant with read access sees no New or Save controls at all** — absent, not disabled.
 */

type ImportRow = PastSeasonRow & { name: string; plan: unknown; shapeLabel: string; planCount: number; lastPlannedAt: string | null };

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** "May 19, 2026" — the shared library date, for the Last planned column and the import dialog. */
const fmtDate = libraryDateLabel;

/**
 * The four headings and what each sorts by (T3). Length sorts on the planned minutes — the figure
 * the cell leads with — never the block count; an empty template has nothing to sort by and sits
 * at the foot with the never-started ones.
 */
const TEMPLATE_COLUMNS: readonly LibrarySortColumn<RepTeamPlanTemplateWithUsage>[] = [
  { key: 'name', label: 'Template', menuLabel: 'Name', kind: 'text', get: t => t.name },
  { key: 'length', label: 'Length', kind: 'minutes', get: t => totalPlannedMinutes(t.plan) },
  { key: 'started', label: 'Started', kind: 'count', get: t => t.planCount },
  { key: 'planned', label: 'Last planned', kind: 'date', get: t => t.lastPlannedAt },
];

export default function PlanTemplatesView({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const router = useRouter();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/development/plan-templates`;

  const [data, setData] = useState<{ templates: RepTeamPlanTemplateWithUsage[]; canWrite: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<Set<string>>(() => new Set());
  const [showRetired, setShowRetired] = useState(false);
  const [creating, setCreating] = useState(false);


  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const res = await fetch(`${apiBase}?all=1`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not load your templates.');
      const json = await res.json();
      setData({ templates: json.templates ?? [], canWrite: !!json.canWrite });
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not load your templates.'));
    } finally {
      setLoading(false);
    }
  }, [apiBase]);
  useEffect(() => { load(); }, [load]);
  const importer = usePastSeasonImport<ImportRow>({
    readUrl: `${apiBase}/past-seasons`, rowsKey: 'templates', createUrl: apiBase,
    bodyOf: row => ({ name: row.name, plan: row.plan, tagIds: [] }), onAdded: load, noun: 'template',
  });
  useOverlayOpen(importer.open);

  // Memoised because `?? []` mints a NEW array on every render, which would make every memo below
  // recompute on every keystroke in the search box.
  const templates = useMemo(() => data?.templates ?? [], [data]);
  const canWrite = !!data?.canWrite;

  const active = useMemo(() => templates.filter(t => t.isActive), [templates]);
  const retired = useMemo(() => templates.filter(t => !t.isActive), [templates]);

  // The chosen order (none = the API's name order), applied to the live list and the retired one
  // alike — "Show retired" is the same table one fold down.
  const { sort, choose } = useLibrarySort('templates', TEMPLATE_COLUMNS);
  // The SAME predicate the drill library and the in-plan picker use — one rule, three lists.
  const shown = useMemo(
    () => filterTagged(sortLibraryRows(active, sort, TEMPLATE_COLUMNS), query, tagFilter),
    [active, sort, query, tagFilter],
  );
  const retiredShown = useMemo(() => sortLibraryRows(retired, sort, TEMPLATE_COLUMNS), [retired, sort]);

  /**
   * "New template" is offered at ZERO as well as at one (owner ruling, frame 03; L4 keeps it).
   *
   * ⚠ The cost, accepted: the room owns a full block-and-station editor rather than a rename box,
   * because a template built from scratch has no practice to inherit a shape from. It creates the
   * row here and hands off to that editor — so a coach never faces a modal that asks them to
   * design a practice inside a dialog.
   */
  async function newTemplate() {
    if (creating) return;
    setCreating(true); setLoadError('');
    try {
      // A working name they will replace, so the editor opens on the shape rather than on a form.
      // The unique index is on ACTIVE names, so a second untitled one is numbered rather than
      // refused — a coach making two in a row must not meet a 409 for a name they never chose.
      const taken = new Set(active.map(t => t.name.toLowerCase()));
      let name = 'New template';
      for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `New template ${n}`;
      const res = await fetch(apiBase, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Could not start a template.');
      router.push(planTemplateHref(base, json.template.id));
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not start a template.'));
      setCreating(false);
    }
  }


  const helpRequest = {
    module: 'coaches' as const,
    sectionIds: ['premium-plan-templates'],
    label: 'Plan templates',
    fullGuideHref: `/${orgSlug}/coaches/help#premium-plan-templates`,
  };

  /**
   * ⚠ THE CREATE MOVED TO THE HEADER AND THE TWO CREATES BECAME ONE (Phase 3, 2026-08-25).
   * House rule 6 — one verb, one button, with the choice inside it; house rule 4 — the create sits
   * in the page header. On a phone it collapses to the bare "+" in the title-line corner.
   */
  const headerCreate = canWrite && (
    <CoachToolbarMenu
      /* ⚠ A STATIC NAME (/review, 2026-08-25 — Low): the busy state belongs to the item doing the
         work, one line down, not to the door that opens onto both routes. */
      label="New template"
      icon={<Plus size={15} aria-hidden />}
      variant="primary"
      collapseOnPhone
    >
      <CoachToolbarMenuItem
        icon={<Plus size={15} aria-hidden />}
        label={creating ? 'Starting…' : 'Start from blank'}
        hint="An empty plan you build up yourself"
        disabled={creating}
        onSelect={newTemplate}
      />
      <CoachToolbarMenuItem
        icon={<History size={15} aria-hidden />}
        label="Bring one forward from a past season"
        hint="Copy a plan you already ran"
        onSelect={importer.openImport}
      />
    </CoachToolbarMenu>
  );

  const row = (template: RepTeamPlanTemplateWithUsage) => {
    // The blocks' titles are the browsable fact (L3); an empty one says so in words (L4). Length
    // is read ONCE for the desktop cell and the phone card's one line alike; the count is a figure
    // in the table (the heading says "Started") and words on the card — ⚠ PLANS, never practices
    // (D4), never a bare 0 either way — and the date has its own column (T2).
    const blocks = templateBlocksLine(template.plan);
    const length = blocks ? templateShapeLabel(template.plan) : null;
    const started = templateUseLabel(template.planCount);
    const last = template.lastPlannedAt ? `last ${fmtDate(template.lastPlannedAt)}` : null;
    return (
      <LibraryTableRow
        key={template.id}
        name={template.name}
        tags={template.tags}
        retired={!template.isActive}
        line={blocks || 'Nothing in it yet'}
        quietLine={!blocks}
        facts={[length, started, last].filter(Boolean).join(' · ')}
        cells={[
          { label: 'Length', value: length ?? <span className={styles.devRowDash}>—</span>, shrink: true, data: true },
          { label: 'Started', value: libraryCountCell(template.planCount), shrink: true, data: true },
          { label: 'Last planned', value: libraryDateCell(template.lastPlannedAt), shrink: true, data: true },
        ]}
        onOpen={() => router.push(planTemplateHref(base, template.id))}
        openLabel={`Open ${template.name}`}
      />
    );
  };
  const head = <LibrarySortHead columns={TEMPLATE_COLUMNS} sort={sort} onSort={choose} />;

  return (
    <div className={styles.page}>
      <CoachPageHeader
        icon={NotebookPen}
        title="Practice plans"
        actions={headerCreate || undefined}
        /* House rule 4: one compact create keeps the title line's corner on a phone rather than
           taking a row of its own. A read-only assistant has no create, so the row drops. */
        actionsPhoneInTitleRow
        actionsPhoneHidden={!canWrite}
        helpLabel="Plan templates"
        help={helpRequest}
      />
      <PracticePlansTabs base={base} active="templates" showLibrary />

      {loadError && <p className={styles.errorText} role="alert">{loadError}</p>}

      {loading ? (
        <div className={styles.loadingState}>Loading your templates…</div>
      ) : templates.length === 0 ? (
        /* ⚠ The empty state offers all THREE routes (owner ruling, frame 03): build one, pull one
           forward from a past season, or save one from a practice. */
        <CoachEmptyState
          icon={<BookMarked size={22} />}
          headline="No templates yet"
          description="Build one here, or save a practice that went well as a template from the plan itself — then next Tuesday starts from it instead of an empty page."
          blocker={canWrite ? undefined : 'Managing templates comes with Schedule: View + edit — ask your head coach.'}
          secondaryAction={canWrite ? { label: 'Add from a past season', onClick: importer.openImport } : undefined}
        >
          {canWrite && (
            <button type="button" className={styles.btnPrimary} disabled={creating} onClick={newTemplate}>
              <Plus size={14} aria-hidden /> {creating ? 'Starting…' : 'New template'}
            </button>
          )}
        </CoachEmptyState>
      ) : (
        <>
          <LibraryFilterBar items={active} noun="templates" query={query} tagFilter={tagFilter} onQuery={setQuery} onTagFilter={setTagFilter}
            sort={<LibrarySortMenu columns={TEMPLATE_COLUMNS} sort={sort} onSort={choose} />} />

          {shown.length === 0 ? (
            <p className={styles.formHint}>No templates match that.</p>
          ) : (
            <LibraryTable label="Templates" head={head}>{shown.map(row)}</LibraryTable>
          )}

          {retired.length > 0 && (
            <div className={styles.ppRetiredWrap}>
              <button type="button" className={styles.ppAddInline} onClick={() => setShowRetired(s => !s)}>
                {showRetired ? 'Hide' : 'Show'} retired ({retired.length})
              </button>
              {showRetired && <LibraryTable label="Retired templates" head={head}>{retiredShown.map(row)}</LibraryTable>}
            </div>
          )}
        </>
      )}

      <PastSeasonImportDialog
        state={importer}
        hint="Practices you ran before, ready to become templates. Adding one copies its shape into your library — nothing in the old practice changes, and no players come with it."
        emptyText="Nothing to bring forward — this team has no practice plans from a past season yet."
        describe={row => ({
          name: row.name,
          // ⚠ "planned", never "ran" — nothing records what actually happened.
          facts: [row.shapeLabel, `In ${row.planCount} plan${row.planCount === 1 ? '' : 's'}`, row.lastPlannedAt ? `last planned ${fmtDate(row.lastPlannedAt)}` : null].filter(Boolean).join(' · '),
        })}
      />
    </div>
  );
}
