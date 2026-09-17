'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Library, NotebookPen, Plus } from 'lucide-react';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import { formatInOrgZone } from '@/lib/timezone';
import {
  emptyDrillDraft, filterTagged, sortDrillsForPicker,
  type DrillInput, type RepTeamDrillWithUsage,
} from '@/lib/rep-drills';
import { sortLibraryRows, type LibrarySortColumn } from '@/lib/library-sort';
import {
  LibraryFilterBar, LibraryTable, LibraryTableRow, drillCardLine, drillUseLabel, libraryCountCell, libraryDateCell, libraryDateLabel,
} from '@/components/coaches/LibraryRow';
import { LibrarySortHead, LibrarySortMenu, useLibrarySort } from '@/components/coaches/LibrarySort';
import { PastSeasonImportDialog, usePastSeasonImport, type PastSeasonRow } from '@/components/coaches/PastSeasonImport';
import DrillSheet from '@/components/coaches/DrillSheet';
import { useFocusTags, useEquipmentTags } from '@/components/coaches/use-focus-tags';
import { FOCUS_TAG_MANAGE, EQUIPMENT_TAG_MANAGE } from '@/components/coaches/TagSearchCombobox';
import PracticePlansTabs from './_PracticePlansTabs';
import styles from '../../../coaches.module.css';

/**
 * The drill library — the DRILLS TAB of the Practice plans room (practices re-evaluation stage 0,
 * owner ruling D5, 2026-09-14; redrawn at stage 4, owner rulings L3 · L6, 2026-09-16). A TABLE on
 * the portal's list recipe: Drill (the name, its tags beside it, the first line of *what you're
 * doing* under it — one line, cut short, absent when unwritten) · Usually (a dash when never set) ·
 * Plans (the figure — "8 plans", a dash at zero) · Last planned (the date) · a chevron (the
 * columns follow-up, owner rulings T1–T4, 2026-09-17). **The row is the door** — it opens the
 * drill's SHEET, the station modal's shape, where Retire now lives; there are no actions on a
 * row. On a phone the table reflows to a card as tall as its words.
 *
 * ⚠ A VIEW, not a page: the hub (`practice/page.tsx`) resolves the team, the season and the
 * capability gates before this mounts, and decides whether the tab exists at all (absent for a
 * coach the drills read would refuse). It renders its own page header because its header ACTION
 * ("New drill") and its help section are its own — the page-actions guard enumerates it by file.
 *
 * ⚠ **Opens in NAME order — shared club drills first, then the team's own, each A–Z — and says
 * nothing on its own; every heading sorts on a click** (T3, 2026-09-17 — this replaced "sorted by
 * name, never by use"). A sort here is the coach asking their own library a question, never the
 * library ranking their ideas unasked; the no-ranking rule proper is about children, not drills,
 * and the past-season import has ordered by plan count since it was built. Under a chosen column
 * the club drills take their place in the order rather than leading — "club first" is the resting
 * order's grouping, not a fact about the drill. Remembered per tab in this browser.
 *
 * ⚠ **"In 8 plans" is a fact about a DRILL** and is the one count this feature is allowed to show.
 * Zero is a dash in the table (the heading says "Plans") and "Not in a plan yet" in words on the
 * card, so an unused drill never reads as a failing score.
 * ⚠ **PLANS, never practices** — nothing records what was actually run (D4), so "used 8×" would be
 * a claim the data cannot support; the date column is "Last planned" for the same reason.
 *
 * ⚠ **Nothing is seeded and no tag is supplied.** Every drill and tag here is coach-typed;
 * a "Hitting / Fielding / Pitching" list would be one sport talking to a platform serving many.
 * That binds the placeholders too, not just the data.
 *
 * ⚠ **No archive door.** This room is live-season only (owner ruling 2026-08-01) — the Development
 * hub hides its door in a completed season, and the API resolves live context regardless.
 */

type LoadState = { drills: RepTeamDrillWithUsage[]; canWrite: boolean };

type ImportRow = PastSeasonRow & { drill: DrillInput; planCount: number; lastPlannedAt: string | null };

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** The four headings and what each sorts by (T3); a drill with no minutes or no plan sits at the foot under that column. */
const DRILL_COLUMNS: readonly LibrarySortColumn<RepTeamDrillWithUsage>[] = [
  { key: 'name', label: 'Drill', menuLabel: 'Name', kind: 'text', get: d => d.name },
  { key: 'usually', label: 'Usually', kind: 'minutes', get: d => d.usualMinutes },
  { key: 'plans', label: 'Plans', kind: 'count', get: d => d.planCount },
  { key: 'planned', label: 'Last planned', kind: 'date', get: d => d.lastPlannedAt },
];

const draftOf = (drill: RepTeamDrillWithUsage): DrillInput => ({
  name: drill.name, tagIds: drill.tags.map(t => t.id), usualMinutes: drill.usualMinutes,
  description: drill.description ?? '', goal: drill.goal ?? '',
  coachingPoints: drill.coachingPoints, setup: drill.setup ?? '', equipment: drill.equipment,
  equipmentTagIds: drill.equipmentTagIds,
});

export default function DrillsView({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/development/drills`;

  const [data, setData] = useState<LoadState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<Set<string>>(() => new Set());
  const [showRetired, setShowRetired] = useState(false);

  /** The sheet: a new drill (`id: null`), or one row's — with whether it is retired, for the foot. */
  const [editing, setEditing] = useState<{ id: string | null; draft: DrillInput; isActive: boolean; shared: boolean } | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');


  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const res = await fetch(`${apiBase}?all=1`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not load your drills.');
      const json = await res.json();
      setData({ drills: json.drills ?? [], canWrite: !!json.canWrite });
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not load your drills.'));
    } finally {
      setLoading(false);
    }
  }, [apiBase]);
  useEffect(() => { load(); }, [load]);
  /* "Bring one forward from a past season" — the shared dialog; since stage 4 (L1) the read offers
     last year's bare written BLOCKS beside its written stations, each with its minutes. */
  const importer = usePastSeasonImport<ImportRow>({
    readUrl: `${apiBase}/past-seasons`, rowsKey: 'drills', createUrl: apiBase, bodyOf: row => row.drill, onAdded: load, noun: 'drill',
  });
  useOverlayOpen(!!editing || importer.open);

  // Memoised because `?? []` mints a NEW array on every render, which would make every memo below
  // it recompute on every keystroke in the search box.
  const drills = useMemo(() => data?.drills ?? [], [data]);
  const canWrite = !!data?.canWrite;

  /**
   * The team's whole 'focus' vocabulary — NOT just the tags currently in use.
   *
   * ⚠ Deliberately a separate fetch from the drills. The picker must offer every tag the team has,
   * including ones only a focus area or a template uses; deriving the list from the drills on screen
   * would quietly hide vocabulary the coach has already created and invite them to mint a duplicate.
   * The filter CHIPS are derived from what is on screen, which is a different question.
   */
  const { tags, createTag, reload: reloadFocusTags } = useFocusTags(orgSlug, teamId);
  const { tags: equipmentTags, createTag: createEquipmentTag, reload: reloadEquipmentTags } = useEquipmentTags(orgSlug, teamId);

  const active = useMemo(() => drills.filter(d => d.isActive), [drills]);
  const retired = useMemo(() => drills.filter(d => !d.isActive), [drills]);

  // The chosen order over the resting one (club first, then A–Z — the picker's and the panel's,
  // which never sort); applied to the live list and the retired one alike.
  const { sort, choose } = useLibrarySort('drills', DRILL_COLUMNS);
  // The SAME predicate the in-plan picker and the docked panel use — one rule, so the lists can't drift.
  const shown = useMemo(
    () => filterTagged(sortLibraryRows(sortDrillsForPicker(active), sort, DRILL_COLUMNS), query, tagFilter),
    [active, sort, query, tagFilter],
  );
  const retiredShown = useMemo(() => sortLibraryRows(sortDrillsForPicker(retired), sort, DRILL_COLUMNS), [retired, sort]);

  async function saveDrill() {
    if (!editing) return;
    setFormBusy(true); setFormError('');
    try {
      const res = await fetch(editing.id ? `${apiBase}/${editing.id}` : apiBase, {
        method: editing.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing.draft),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save that drill.');
      setEditing(null);
      await load();
    } catch (e) {
      setFormError(errorMessage(e, 'Could not save that drill.'));
    } finally {
      setFormBusy(false);
    }
  }

  /** Retire / restore from the sheet's foot (L6) — one-tap, then the sheet closes on the answer. */
  async function setActive(id: string, isActive: boolean) {
    setFormBusy(true); setFormError('');
    try {
      const res = await fetch(`${apiBase}/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'That didn’t work.');
      setEditing(null);
      await load();
    } catch (e) {
      setFormError(errorMessage(e, 'That didn’t work.'));
    } finally {
      setFormBusy(false);
    }
  }


  const helpRequest = {
    module: 'coaches' as const,
    sectionIds: ['premium-drill-library'],
    label: 'Drills',
    fullGuideHref: `/${orgSlug}/coaches/help#premium-drill-library`,
  };

  /* ⚠ A club drill opens READ-ONLY for a coach — it is the club's answer; only an org admin
     manages the shared set. The sheet shows it as a retired one shows (no Save, no Retire). */
  const openRow = (drill: RepTeamDrillWithUsage) => {
    setFormError('');
    setEditing({ id: drill.id, draft: draftOf(drill), isActive: drill.isActive, shared: drill.teamId === null });
  };

  const row = (drill: RepTeamDrillWithUsage) => {
    // "20 min" in the data face (a dash when never given a length); the one count as a figure in
    // the table and in words on the card — never a bare 0, never "used"; the date in its own
    // column (T2). Each read ONCE, for the desktop cells and the phone card's one line alike.
    const usually = drill.usualMinutes ? `${drill.usualMinutes} min` : null;
    const plans = drillUseLabel(drill.planCount);
    const last = drill.lastPlannedAt ? `last ${libraryDateLabel(drill.lastPlannedAt)}` : null;
    return (
      <LibraryTableRow
        key={drill.id}
        name={drill.name}
        tags={drill.tags}
        shared={drill.teamId === null}
        retired={!drill.isActive}
        line={drillCardLine(drill)}
        facts={[usually, plans, last].filter(Boolean).join(' · ')}
        cells={[
          { label: 'Usually', value: usually ?? <span className={styles.devRowDash}>—</span>, shrink: true, data: true },
          { label: 'Plans', value: libraryCountCell(drill.planCount), shrink: true, data: true },
          { label: 'Last planned', value: libraryDateCell(drill.lastPlannedAt), shrink: true, data: true },
        ]}
        onOpen={() => openRow(drill)}
        openLabel={`Open ${drill.name}`}
      />
    );
  };
  const head = <LibrarySortHead columns={DRILL_COLUMNS} sort={sort} onSort={choose} />;

  const header = (
    <>
      {/* ⚠ THE CREATE MOVED TO THE HEADER AND THE TWO CREATES BECAME ONE (Phase 3, 2026-08-25) —
          the same fold as Plan templates, for the same reason: "New drill" and "Add from a past
          season" make the same thing two ways. House rule 6 folds them into one; house rule 4 puts
          it in the header, where a phone collapses it to the bare "+" in the title-line corner. */}
      <CoachPageHeader
        icon={NotebookPen}
        title="Practice plans"
        actions={canWrite ? (
          <CoachToolbarMenu
            label="New drill"
            icon={<Plus size={15} aria-hidden />}
            variant="primary"
            collapseOnPhone
          >
            <CoachToolbarMenuItem
              icon={<Plus size={15} aria-hidden />}
              label="Start from blank"
              hint="Write a new drill yourself"
              onSelect={() => { setFormError(''); setEditing({ id: null, draft: emptyDrillDraft(), isActive: true, shared: false }); }}
            />
            <CoachToolbarMenuItem
              icon={<History size={15} aria-hidden />}
              label="Bring one forward from a past season"
              hint="Copy a drill you already use"
              onSelect={importer.openImport}
            />
          </CoachToolbarMenu>
        ) : undefined}
        actionsPhoneInTitleRow
        actionsPhoneHidden={!canWrite}
        helpLabel="Drills"
        help={helpRequest}
      />
      <PracticePlansTabs base={base} active="drills" showLibrary />
    </>
  );

  return (
    <div className={styles.page}>
      {header}

      {loadError && <p className={styles.errorText} role="alert">{loadError}</p>}

      {loading ? (
        <div className={styles.loadingState}>Loading your drills…</div>
      ) : drills.length === 0 ? (
        /* The empty state keeps its shape and loses "four taps" (stage 4 — the promise was the
           problem; the shape that made it untrue is the fix). */
        <CoachEmptyState
          icon={<Library size={22} />}
          headline="No drills yet"
          description="Write one here, or save a block you like from a plan — it's there next time."
          blocker={canWrite ? undefined : 'Managing drills comes with Schedule: View + edit — ask your head coach.'}
          secondaryAction={canWrite ? { label: 'Add from a past season', onClick: importer.openImport } : undefined}
        >
          {canWrite && (
            <button type="button" className={styles.btnPrimary}
              onClick={() => { setFormError(''); setEditing({ id: null, draft: emptyDrillDraft(), isActive: true, shared: false }); }}>
              <Plus size={14} aria-hidden /> New drill
            </button>
          )}
        </CoachEmptyState>
      ) : (
        <>
          <LibraryFilterBar items={active} noun="drills" query={query} tagFilter={tagFilter} onQuery={setQuery} onTagFilter={setTagFilter}
            sort={<LibrarySortMenu columns={DRILL_COLUMNS} sort={sort} onSort={choose} />} />

          {shown.length === 0 ? (
            <p className={styles.formHint}>No drills match that.</p>
          ) : (
            <LibraryTable label="Drills" head={head}>{shown.map(row)}</LibraryTable>
          )}

          {/* Retired rows read dim, under the table; opening one shows the same sheet with Restore. */}
          {retired.length > 0 && (
            <div className={styles.ppRetiredWrap}>
              <button type="button" className={styles.ppAddInline} onClick={() => setShowRetired(s => !s)}>
                {showRetired ? 'Hide' : 'Show'} retired ({retired.length})
              </button>
              {showRetired && (
                <LibraryTable label="Retired drills" head={head}>{retiredShown.map(row)}</LibraryTable>
              )}
            </div>
          )}
        </>
      )}

      {/* ── The drill sheet (L6) — new, or a row's; Retire / Restore in its foot ── */}
      {editing && (
        <DrillSheet
          draft={editing.draft}
          isNew={editing.id === null}
          isActive={editing.isActive}
          readOnly={editing.shared || !canWrite}
          tags={tags}
          onCreateTag={createTag}
          equipmentTags={equipmentTags}
          onCreateEquipmentTag={createEquipmentTag}
          focusManage={{ ...FOCUS_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/focus-tags` }}
          onFocusTagsChanged={reloadFocusTags}
          equipmentManage={{ ...EQUIPMENT_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/equipment-tags` }}
          onEquipmentTagsChanged={reloadEquipmentTags}
          busy={formBusy}
          error={formError}
          onChange={draft => setEditing(e => (e ? { ...e, draft } : e))}
          onSubmit={saveDrill}
          onClose={() => setEditing(null)}
          onRetire={canWrite && editing.id && !editing.shared ? () => setActive(editing.id!, false) : undefined}
          onRestore={canWrite && editing.id && !editing.shared ? () => setActive(editing.id!, true) : undefined}
        />
      )}

      <PastSeasonImportDialog
        state={importer}
        hint="What you ran before, ready to become a drill. Adding one copies it into your library — nothing in the old practice changes."
        emptyText="Nothing to bring forward — this team has no practice plans from a past season yet."
        describe={row => ({
          name: row.drill.name,
          // ⚠ "planned", never "ran" — see the module header.
          facts: [
            row.drill.usualMinutes ? `${row.drill.usualMinutes} min` : null,
            drillUseLabel(row.planCount),
            row.lastPlannedAt ? `last planned ${formatInOrgZone(row.lastPlannedAt, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}` : null,
          ].filter(Boolean).join(' · '),
          line: row.drill.description?.trim() || null,
        })}
      />
    </div>
  );
}
