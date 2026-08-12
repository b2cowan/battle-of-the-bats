'use client';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import { BookMarked, Check } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import TagPicker from '@/components/coaches/TagPicker';
import { useFocusTags } from '@/components/coaches/use-focus-tags';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import {
  MAX_TEMPLATE_NAME_LEN, templateShapeLabel, templateUseLabel,
} from '@/lib/rep-plan-templates';
import { emptyPracticePlan, type PracticePlan } from '@/lib/rep-practice-plan';
import PracticePlanEditor from '../../../practice/_PracticePlanEditor';
import type { RepTeamDrill } from '@/lib/rep-drills';
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
 */

type LoadState = {
  template: {
    id: string; name: string; plan: PracticePlan; tags: { id: string; name: string }[];
    isActive: boolean; planCount: number; lastPlannedAt: string | null;
  };
  canWrite: boolean;
};

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** A save that hasn't landed by now is reported as a failure rather than spinning for ever. */
const SAVE_TIMEOUT_MS = 15_000;

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
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState('');

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
      setDirty(false);
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not load this template.'));
    } finally {
      setLoading(false);
    }
  }, [apiBase]);
  useEffect(() => { load(); }, [load]);

  /**
   * The team's drills, so the template's stations can be picked from the library exactly as a
   * practice's are — which is what makes a loaded template arrive with its drill-backed stations
   * still read-only and still counted.
   */
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

  // The team's whole shared vocabulary — one hook, so the four surfaces that offer a tag picker
  // cannot drift on how a tag is fetched, created or merged into local state.
  const { tags: focusTags, createTag: createFocusTag } = useFocusTags(orgSlug, teamId);

  // ⚠ The signature covers the WHOLE editable state, not just the plan: renaming a template and
  // then closing the tab must be as safe as adding a block and closing the tab.
  const sig = JSON.stringify({ plan, name, tagIds });
  const sigRef = useRef(sig);
  useEffect(() => { sigRef.current = sig; }, [sig]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!data?.canWrite) return true;
    // ⚠ An explicit submit rejects an empty name; autosave must NOT, because the coach is
    // mid-typing. So a blank name simply doesn't save yet — nothing is discarded, and the status
    // pill says why.
    if (!name.trim()) {
      setSaveError('Give the template a name to save it.');
      return false;
    }
    const sigAtSave = sigRef.current;
    setSaving(true); setSaveError('');
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), SAVE_TIMEOUT_MS);
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), tagIds, plan }),
        signal: abort.signal,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save the template.');
      await res.json().catch(() => ({}));
      if (sigRef.current === sigAtSave) setDirty(false);
      return true;
    } catch (e: unknown) {
      setSaveError(
        e instanceof DOMException && e.name === 'AbortError'
          ? 'Saving is taking too long — check your connection.'
          : errorMessage(e, 'Could not save the template.'),
      );
      return false;
    } finally {
      clearTimeout(timeout);
      setSaving(false);
    }
  }, [data?.canWrite, apiBase, name, tagIds, plan]);

  // Autosave ~0.9s after the last change, and STOP after a failure rather than retrying for ever —
  // the same posture, and the same reasoning, as the practice plan's editor.
  useEffect(() => {
    if (!dirty || saving || loading || saveError || !data?.canWrite) return;
    const t = setTimeout(() => { void handleSave(); }, 900);
    return () => clearTimeout(t);
  }, [dirty, saving, loading, saveError, data?.canWrite, sig, handleSave]);

  function touch() { setDirty(true); setSaveError(''); }

  const helpRequest = {
    module: 'coaches' as const,
    sectionIds: ['premium-plan-templates'],
    label: 'Plan templates',
    fullGuideHref: `/${orgSlug}/coaches/help#premium-plan-templates`,
  };

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
    return <div className={styles.notAssigned}><h2>Team not found</h2><p>You are not assigned to this team.</p></div>;
  }

  const canWrite = data?.canWrite ?? false;

  return (
    <div className={`${styles.page} ${styles.pageWide} ${styles.lineupDockedPage}`}>
      <CoachBackLink href={`${base}/development/templates`}>Plan templates</CoachBackLink>
      <UnsavedChangesGuard active={dirty} />

      <CoachPageHeader
        icon={BookMarked}
        title={data?.template.name || 'Template'}
        helpLabel="Plan templates"
        help={helpRequest}
      />

      {/* Page-header ruling 2026-08-11: shape and use are facts ABOUT this template, so they lead
          the body that edits it instead of sitting under the title.
          ⚠ "Started N plans", never "used N×" — and zero in words, so an unused template never
          reads as a failing score. */}
      {data && (
        <p className={styles.pageSummaryStrip}>
          {templateShapeLabel(plan)} · {templateUseLabel(data.template.planCount)}
        </p>
      )}

      {loadError && <p className={styles.errorText} role="alert">{loadError}</p>}

      {loading ? (
        <div className={styles.loadingState}>Loading this template…</div>
      ) : !data ? null : (
        <>
          <div className={styles.ppHeaderCard}>
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
            plan={plan}
            onChange={next => { setPlan(next); touch(); }}
            withoutPeople
            roster={[]}
            goals={[]}
            canViewFocus={false}
            attendance={[]}
            canViewAttendance={false}
            staffSuggestions={[]}
            equipmentSuggestions={[]}
            drills={drills}
            focusTags={focusTags}
            // A template has no date, so there is no running clock and no block start times —
            // computeBlockClocks returns nothing for an empty start, which is the honest answer.
            eventStartsAt=""
            eventEndsAt={null}
            readOnly={!canWrite}
          />
        </>
      )}

      {canWrite && !loading && !loadError && (
        <div className={`${styles.attendanceFooter} ${styles.lineupDockedFooter}`}>
          <span className={styles.saveStatus} aria-live="polite">
            {saveError
              ? <button type="button" className={styles.saveRetry} disabled={saving} onClick={handleSave}>Couldn’t save · Retry</button>
              : saving ? 'Saving…'
                : dirty ? 'Unsaved changes'
                  : <><Check size={13} /> Saved</>}
          </span>
        </div>
      )}
    </div>
  );
}
