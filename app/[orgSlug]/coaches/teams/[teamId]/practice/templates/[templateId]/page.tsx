'use client';
import { use, useCallback, useEffect, useState } from 'react';
import { Archive, BookMarked, RotateCcw } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachNotOnTeam from '@/components/coaches/CoachNotOnTeam';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import SaveStatusPill from '@/components/coaches/SaveStatusPill';
import { useRecordAutosave, useRetireRestore } from '@/components/coaches/useRecordAutosave';
import TagPicker from '@/components/coaches/TagPicker';
import { useFocusTags, useEquipmentTags } from '@/components/coaches/use-focus-tags';
import { FOCUS_TAG_MANAGE, EQUIPMENT_TAG_MANAGE } from '@/components/coaches/TagSearchCombobox';
import {
  MAX_TEMPLATE_NAME_LEN, templateShapeLabel, templateUseLabel,
} from '@/lib/rep-plan-templates';
import { emptyPracticePlan, type PracticePlan } from '@/lib/rep-practice-plan';
import PracticePlanEditor from '../../_PracticePlanEditor';
import { practicePlansHref } from '@/lib/practice-plans-address';
import type { RepTeamDrill } from '@/lib/rep-drills';
import type { RepTeamCircuit } from '@/lib/rep-circuits';
import styles from '../../../../../coaches.module.css';

/**
 * The plan-template editor (Practice Plans Phase 3 — frame 03's accepted cost).
 *
 * ⚠ **Why this page exists at all.** "New template" is offered at ZERO as well as at one (owner
 * ruling), and a template built from scratch has no practice to inherit a shape from — so the room
 * owns a full block-and-station editor rather than a rename box.
 *
 * ⚠ **It reuses `PracticePlanEditor`, deliberately, and that was the single biggest reuse decision
 * in this phase.** A second editor would have split the behaviour of every block, station,
 * rotation and drill-picker control in two, and the two copies would have drifted within a season.
 * `withoutPeople` is the whole difference: a template carries the shape and the teaching, and the
 * practice supplies the people.
 *
 * ⚠ **Live-season only**, like the room it sits in. A template library is an INSTRUMENT.
 *
 * ⚠ Re-homed under Practice plans with its library (practices re-evaluation stage 0, D5,
 * 2026-09-14): `/practice/templates/{id}`, the way back is the Templates tab. The old address redirects.
 *
 * ⚠ **"Retire this template" lives in this header** (stage 4, owner ruling L3, 2026-09-16): the tab's
 * row lost its actions — the row is the door, Rename is the Name field here, and Retire follows Edit
 * into the thing itself. A retired template opens READ-ONLY with Restore in its place; retired, never
 * deleted, so plans it started keep reading.
 */

type LoadState = {
  template: {
    id: string; name: string; plan: PracticePlan; tags: { id: string; name: string }[];
    isActive: boolean; planCount: number; lastPlannedAt: string | null;
  };
  canWrite: boolean;
};

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);


export default function CoachPlanTemplateEditorPage({
  params,
}: { params: Promise<{ orgSlug: string; teamId: string; templateId: string }> }) {
  const { orgSlug, teamId, templateId } = use(params);
  const { assignments, loading: ctxLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/development/plan-templates/${templateId}`;

  const [data, setData] = useState<LoadState | null>(null);
  const [plan, setPlan] = useState<PracticePlan>(emptyPracticePlan());
  const [name, setName] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // ⚠ The signature covers the WHOLE editable state, not just the plan: renaming and then closing
  // the tab must be as safe as adding a block and closing the tab.
  const sig = JSON.stringify({ plan, name, tagIds });
  const write = useCallback(async (signal: AbortSignal) => {
    const res = await fetch(apiBase, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), tagIds, plan }),
      signal,
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save the template.');
    await res.json().catch(() => ({}));
  }, [apiBase, name, tagIds, plan]);
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: !!data?.canWrite, loading, sig, write,
    // An explicit submit rejects an empty name; autosave must NOT, because the coach is mid-typing —
    // a blank name simply doesn't save yet, nothing is discarded, and the status pill says why.
    blocked: name.trim() ? null : 'Give the template a name to save it.',
    failText: 'Could not save the template.',
  });

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const res = await fetch(apiBase);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not load this template.');
      const body: LoadState = await res.json();
      setData(body);
      setPlan(body.template.plan ?? emptyPracticePlan());
      setName(body.template.name);
      setTagIds(body.template.tags.map(t => t.id));
      settle();
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not load this template.'));
    } finally {
      setLoading(false);
    }
  }, [apiBase, settle]);
  useEffect(() => { load(); }, [load]);

  /**
   * The team's drills, so the template's stations can be picked from the library exactly as a
   * practice's are — which is what makes a loaded template arrive with its drill-backed stations
   * still read-only and still counted.
   */
  const [drills, setDrills] = useState<RepTeamDrill[]>([]);
  // …and its circuits (stage 4, L9), so a template can hold a whole circuit as one block.
  const [circuits, setCircuits] = useState<RepTeamCircuit[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [d, c] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/development/drills`).catch(() => null),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/development/circuits`).catch(() => null),
      ]);
      if (cancelled) return;
      if (d?.ok) setDrills((await d.json()).drills ?? []);
      if (c?.ok) setCircuits((await c.json()).circuits ?? []);
    })();
    return () => { cancelled = true; };
  }, [orgSlug, teamId]);

  // The team's whole shared vocabulary — one hook, so the four surfaces that offer a tag picker
  // cannot drift on how a tag is fetched, created or merged into local state.
  const { tags: focusTags, createTag: createFocusTag, reload: reloadFocusTags } = useFocusTags(orgSlug, teamId);
  // Equipment (mig 266) — NOT staff: `withoutPeople` below excludes staff entirely, but a
  // template still carries its own kit list ("the shape and the teaching" includes what to bring).
  const { tags: equipmentTags, createTag: createEquipmentTag, reload: reloadEquipmentTags } = useEquipmentTags(orgSlug, teamId);

  /** Retire / restore from the header — one tap; the page re-reads and the editor locks or unlocks. */
  const { busy: retireBusy, setActive } = useRetireRestore(apiBase, load, setLoadError, { dirty, saving, handleSave });

  const helpRequest = {
    module: 'coaches' as const,
    sectionIds: ['premium-plan-templates'],
    label: 'Plan templates',
    fullGuideHref: `/${orgSlug}/coaches/help#premium-plan-templates`,
  };

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
    return <CoachNotOnTeam />;
  }

  // A retired template opens read-only: the row said "Retired", and Restore is the header's one door back.
  const isRetired = data ? !data.template.isActive : false;
  const canWrite = (data?.canWrite ?? false) && !isRetired;
  const retireAction = data?.canWrite ? (
    <button type="button" className={styles.btnSecondary} disabled={retireBusy} onClick={() => setActive(isRetired)}>
      {isRetired ? <><RotateCcw size={14} aria-hidden /> Restore this template</> : <><Archive size={14} aria-hidden /> Retire this template</>}
    </button>
  ) : undefined;

  return (
    <div className={`${styles.page} ${styles.savePillPage}`}>
      <UnsavedChangesGuard active={dirty} />

      <CoachPageHeader
        icon={BookMarked}
        // The LIVE name — a rename autosaves, and the title above it must not wait for a reload.
        title={name.trim() || data?.template.name || 'Template'}
        helpLabel="Plan templates"
        help={helpRequest}
        backTo={{ href: practicePlansHref(base, 'templates'), label: 'Templates' }}
        actions={retireAction}
        actionsPhoneHidden={!data?.canWrite}
      />

      {loadError && <p className={styles.errorText} role="alert">{loadError}</p>}

      {loading ? (
        <div className={styles.loadingState}>Loading this template…</div>
      ) : !data ? null : (
        <div className={styles.ppSheetCol}>
          {/* ── The SAME sheet the practice page is (stage 1, D2 — "a template becomes a sheet with
              no people"). Its head is the template's facts: shape and use lead the body that edits
              it (page-header ruling 2026-08-11 — never under the title).
              ⚠ "Started N plans", never "used N×" — and zero in words, so an unused template never
              reads as a failing score. */}
          <div className={styles.ppDoc} data-room="plan-template" data-room-state="loaded">
            <div className={styles.ppDocHead}>
              <span className={styles.ppDocHeadFacts}>
                {templateShapeLabel(plan)} · {templateUseLabel(data.template.planCount)}{isRetired ? ' · Retired' : ''}
              </span>
            </div>

            <div className={styles.ppDocFields}>
              <label className={styles.ppField}>
                <span className={styles.ppFieldLabel}>Name</span>
                <input className={styles.input} value={name} disabled={!canWrite} maxLength={MAX_TEMPLATE_NAME_LEN}
                  placeholder="What would you call this practice?"
                  onChange={e => { setName(e.target.value); touch(); }} />
              </label>
              <TagPicker
                label="Tags"
                all={focusTags}
                selected={tagIds}
                onChange={next => { setTagIds(next); touch(); }}
                onCreate={canWrite ? createFocusTag : undefined}
                manage={{ ...FOCUS_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/focus-tags` }}
                onManageChanged={reloadFocusTags}
                disabled={!canWrite}
                emptyHint="No tags yet — type a word to make your first one."
              />
              {/* Says what a template is NOT, which is the thing coaches ask about first. */}
              <p className={styles.formHint}>
                A template is the shape and the teaching. Players, staff and &ldquo;just for
                tonight&rdquo; notes belong to a practice — so the same template works in April with
                twelve and July with nine.
              </p>
            </div>

            {/* ⚠ The SAME editor the practice uses. `withoutPeople` removes the roster, staff and
                group controls — it never disables them, because a control that exists only to refuse
                should not exist. Drill-backed stations stay read-only in here too, so a template's
                stations keep their identity all the way onto the practice. */}
            <PracticePlanEditor
              key={templateId}
              plan={plan}
              onChange={next => { setPlan(next); touch(); }}
              withoutPeople
              roster={[]}
              goals={[]}
              canViewFocus={false}
              attendance={[]}
              canViewAttendance={false}
              equipmentTags={equipmentTags}
              onCreateEquipmentTag={canWrite ? createEquipmentTag : undefined}
              equipmentManage={{ ...EQUIPMENT_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/equipment-tags` }}
              onEquipmentTagsChanged={reloadEquipmentTags}
              focusManage={{ ...FOCUS_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/focus-tags` }}
              onFocusTagsChanged={reloadFocusTags}
              drills={drills}
              circuits={circuits}
              focusTags={focusTags}
              // A template has no date, so there is no running clock and no block start times —
              // computeBlockClocks returns nothing for an empty start, which is the honest answer:
              // the gutter carries each block's length alone.
              eventStartsAt=""
              eventEndsAt={null}
              readOnly={!canWrite}
            />
          </div>
        </div>
      )}

      {canWrite && !loading && !loadError && (
        <SaveStatusPill saving={saving} dirty={dirty} error={saveError} onRetry={handleSave} />
      )}
    </div>
  );
}
