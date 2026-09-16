'use client';
import { use, useCallback, useEffect, useState } from 'react';
import { Archive, Repeat, RotateCcw } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachNotOnTeam from '@/components/coaches/CoachNotOnTeam';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import SaveStatusPill from '@/components/coaches/SaveStatusPill';
import { useRecordAutosave, useRetireRestore } from '@/components/coaches/useRecordAutosave';
import TagPicker from '@/components/coaches/TagPicker';
import { useFocusTags, useEquipmentTags } from '@/components/coaches/use-focus-tags';
import { FOCUS_TAG_MANAGE, EQUIPMENT_TAG_MANAGE } from '@/components/coaches/TagSearchCombobox';
import { MAX_CIRCUIT_NAME_LEN, emptyCircuitBlock } from '@/lib/rep-circuits';
import { templateUseLabel } from '@/lib/rep-plan-templates';
import { PRACTICE_PLAN_VERSION, type PracticePlan, type PracticePlanBlock } from '@/lib/rep-practice-plan';
import { circuitCardFacts } from '@/components/coaches/LibraryRow';
import PracticePlanEditor from '../../_PracticePlanEditor';
import { practicePlansHref } from '@/lib/practice-plans-address';
import type { RepTeamDrill } from '@/lib/rep-drills';
import styles from '../../../../../coaches.module.css';

/**
 * The circuit editor — the block ALONE on a sheet (practices re-evaluation stage 4, owner ruling
 * L9, 2026-09-16). No clock (a circuit has no start), no people (a circuit carries none — the
 * practice draws its own groups), no ghost row (a circuit IS one block), Retire in the header (the
 * template editor's idiom). The drill sheet's idea one size up: name and tags first, then the
 * block's own form — its minutes, its two lines, the rotation strip, the station columns and the
 * station modal — exactly as the block opens on a practice.
 *
 * ⚠ **It reuses `PracticePlanEditor` with `soloBlock`** — the third caller (the template room was
 * the second). A second editor for one block would have split the behaviour of every station,
 * rotation and picker control in two. The circuit's stored shape is a one-block plan to the
 * editor and one block to the route; this page is the seam.
 *
 * ⚠ Live-season only, like the room it sits in. A circuit library is an INSTRUMENT. The way back is
 * the Circuits tab.
 */

type LoadState = {
  circuit: {
    id: string; name: string; block: PracticePlanBlock; tags: { id: string; name: string }[];
    isActive: boolean; planCount: number; lastPlannedAt: string | null;
  };
  canWrite: boolean;
};

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);


const asPlan = (block: PracticePlanBlock): PracticePlan => ({ version: PRACTICE_PLAN_VERSION, blocks: [block] });

export default function CoachCircuitEditorPage({
  params,
}: { params: Promise<{ orgSlug: string; teamId: string; circuitId: string }> }) {
  const { orgSlug, teamId, circuitId } = use(params);
  const { assignments, loading: ctxLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/development/circuits/${circuitId}`;

  const [data, setData] = useState<LoadState | null>(null);
  const [plan, setPlan] = useState<PracticePlan>(asPlan(emptyCircuitBlock()));
  const [name, setName] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // ⚠ The signature covers the WHOLE editable state, not just the block: renaming and then closing
  // the tab must be as safe as adding a station and closing the tab.
  const sig = JSON.stringify({ plan, name, tagIds });
  const write = useCallback(async (signal: AbortSignal) => {
    const res = await fetch(apiBase, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), tagIds, block: plan.blocks[0] ?? emptyCircuitBlock() }),
      signal,
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save the circuit.');
    await res.json().catch(() => ({}));
  }, [apiBase, name, tagIds, plan]);
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: !!data?.canWrite, loading, sig, write,
    // An explicit submit rejects an empty name; autosave must NOT, because the coach is mid-typing —
    // a blank name simply doesn't save yet, nothing is discarded, and the status pill says why.
    blocked: name.trim() ? null : 'Give the circuit a name to save it.',
    failText: 'Could not save the circuit.',
  });

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const res = await fetch(apiBase);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not load this circuit.');
      const body: LoadState = await res.json();
      setData(body);
      setPlan(asPlan(body.circuit.block ?? emptyCircuitBlock()));
      setName(body.circuit.name);
      setTagIds(body.circuit.tags.map(t => t.id));
      settle();
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not load this circuit.'));
    } finally {
      setLoading(false);
    }
  }, [apiBase, settle]);
  useEffect(() => { load(); }, [load]);

  /** The team's drills, so a circuit's stations can be picked from the library as a practice's are. */
  const [drills, setDrills] = useState<RepTeamDrill[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/development/drills`).catch(() => null);
      if (cancelled || !res?.ok) return;
      setDrills((await res.json()).drills ?? []);
    })();
    return () => { cancelled = true; };
  }, [orgSlug, teamId]);

  const { tags: focusTags, createTag: createFocusTag, reload: reloadFocusTags } = useFocusTags(orgSlug, teamId);
  const { tags: equipmentTags, createTag: createEquipmentTag, reload: reloadEquipmentTags } = useEquipmentTags(orgSlug, teamId);

  /** Retire / restore from the header — one tap; the page re-reads and the editor locks or unlocks. */
  const { busy: retireBusy, setActive } = useRetireRestore(apiBase, load, setLoadError, { dirty, saving, handleSave });

  const helpRequest = {
    module: 'coaches' as const,
    sectionIds: ['premium-circuit-library'],
    label: 'Circuits',
    fullGuideHref: `/${orgSlug}/coaches/help#premium-circuit-library`,
  };

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
    return <CoachNotOnTeam />;
  }

  const isRetired = data ? !data.circuit.isActive : false;
  const canWrite = (data?.canWrite ?? false) && !isRetired;
  const retireAction = data?.canWrite ? (
    <button type="button" className={styles.btnSecondary} disabled={retireBusy} onClick={() => setActive(isRetired)}>
      {isRetired ? <><RotateCcw size={14} aria-hidden /> Restore this circuit</> : <><Archive size={14} aria-hidden /> Retire this circuit</>}
    </button>
  ) : undefined;
  const block = plan.blocks[0] ?? emptyCircuitBlock();

  return (
    <div className={`${styles.page} ${styles.savePillPage}`}>
      <UnsavedChangesGuard active={dirty} />

      <CoachPageHeader
        icon={Repeat}
        // The LIVE name — a rename autosaves, and the title above it must not wait for a reload.
        title={name.trim() || data?.circuit.name || 'Circuit'}
        helpLabel="Circuits"
        help={helpRequest}
        backTo={{ href: practicePlansHref(base, 'circuits'), label: 'Circuits' }}
        actions={retireAction}
        actionsPhoneHidden={!data?.canWrite}
      />

      {loadError && <p className={styles.errorText} role="alert">{loadError}</p>}

      {loading ? (
        <div className={styles.loadingState}>Loading this circuit…</div>
      ) : !data ? null : (
        <div className={styles.ppSheetCol}>
          <div className={styles.ppDoc} data-room="circuit" data-room-state="loaded">
            <div className={styles.ppDocHead}>
              <span className={styles.ppDocHeadFacts}>
                {circuitCardFacts({ block }) || 'Nothing in it yet'} · {templateUseLabel(data.circuit.planCount)}{isRetired ? ' · Retired' : ''}
              </span>
            </div>

            <div className={styles.ppDocFields}>
              <label className={styles.ppField}>
                <span className={styles.ppFieldLabel}>Name</span>
                <input className={styles.input} value={name} disabled={!canWrite} maxLength={MAX_CIRCUIT_NAME_LEN}
                  placeholder="What would you call this circuit?"
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
              {/* Says what a circuit is NOT, which is the thing coaches ask about first. */}
              <p className={styles.formHint}>
                A circuit is the stations and the teaching. Who runs each station, who&rsquo;s at it and
                the groups belong to a practice — a placed circuit draws its own groups on the night.
              </p>
            </div>

            {/* ⚠ The SAME editor the practice uses, on ONE block: `withoutPeople` removes the roster,
                staff and group controls; `soloBlock` keeps the block open on its own with no goal, no
                folds and no ghost row. The block's title is edited in its own head, as on a practice;
                the circuit's NAME above is what the row and the panel show. */}
            <PracticePlanEditor
              key={circuitId}
              plan={plan}
              onChange={next => { setPlan(next); touch(); }}
              withoutPeople
              soloBlock
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
              focusTags={focusTags}
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
