'use client';
import { Archive, RotateCcw } from 'lucide-react';
import QuestionShell, { QuestionCancel, QuestionReason } from '@/components/coaches/QuestionShell';
import TagPicker, { type PickableTag } from '@/components/coaches/TagPicker';
import { FieldLabel, TeachingFields } from '@/components/coaches/PracticeFields';
import type { TagManageConfig } from '@/components/coaches/TagSearchCombobox';
import {
  MAX_DRILL_MINUTES, MAX_DRILL_NAME_LEN, MAX_DRILL_POINTS, MAX_DRILL_POINT_LEN, MAX_DRILL_TEXT_LEN,
  type DrillInput,
} from '@/lib/rep-drills';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The drill SHEET — the station modal's shape, rendered from a drill (practices re-evaluation
 * stage 4, owner ruling L6, 2026-09-16). The name in the head, typeable, as the modal's is; then
 * the library's own two facts first — Tags · Usually — because they are the two things the plan
 * never asks and the row always shows; then the SAME five teaching fields in the same order and
 * words as a station (`TeachingFields`); then *Retire this drill* (Restore on a retired one) —
 * the portal's one place for the lifecycle act, never on the row.
 *
 * ⚖ THE ONE WINDOW (One Window 2d, call B4 — it moves as a form and ASKS): 640, a tap outside does nothing, and
 * with the drill changed (`dirty`, each caller's own measure) ×, ←, Cancel, Escape and Back ask in the foot first.
 * Held while a save runs. The foot is the main act only — "what saving reaches" (`saveNote`) at its left, Cancel ·
 * Save at its right — and Retire / Restore ENDS THE BODY (the 2026-10-09 rare-door ruling: a lifecycle door never
 * takes a foot row, and a two-ended row stays only when it is one row at 390 wide, which the note beside it never
 * let this one be).
 *
 * ⚠ What the station has and a drill never does — who runs it, who's at it, just for tonight — is
 * simply not here. "Not in a plan yet · In 8 plans" is not repeated here either: the row said it.
 *
 * ⚠ Usually is ONE number. Ranges were removed at owner QA and are not coming back via the library.
 *
 * Two callers: the Drills tab (open a row; New drill) and the docked panel's "+ New drill" — one
 * sheet, so a drill written beside the plan is the drill the tab opens.
 */
export default function DrillSheet({
  draft, isActive = true, isNew, readOnly = false, tags, onCreateTag, equipmentTags, onCreateEquipmentTag,
  focusManage, onFocusTagsChanged, equipmentManage, onEquipmentTagsChanged,
  busy, error, dirty = false, onChange, onSubmit, onClose, onRetire, onRestore, saveNote,
}: {
  draft: DrillInput;
  isActive?: boolean;
  isNew: boolean;
  /** A club's shared drill opens read-only for a coach — only an org admin manages the shared set. */
  readOnly?: boolean;
  tags: PickableTag[];
  onCreateTag: (name: string) => Promise<PickableTag | null>;
  equipmentTags: PickableTag[];
  onCreateEquipmentTag?: (name: string) => Promise<PickableTag | null>;
  focusManage?: TagManageConfig;
  onFocusTagsChanged?: () => void;
  equipmentManage?: TagManageConfig;
  onEquipmentTagsChanged?: () => void;
  busy: boolean;
  error: string;
  /** The drill was changed since it opened — every way out asks first (B4). The caller's own measure. */
  dirty?: boolean;
  onChange: (next: DrillInput) => void;
  onSubmit: () => void;
  onClose: () => void;
  /** Retire (an active drill) / Restore (a retired one) — absent on a new drill. */
  onRetire?: () => void;
  onRestore?: () => void;
  /**
   * What saving reaches, said where Save is (save-over D8, 2026-10-02): an edit to a drill is
   * re-copied into the team's practices that haven't started, so the sheet says how many. Absent on
   * a new drill, a club drill, and one no upcoming practice uses.
   */
  saveNote?: string | null;
}) {
  const retired = !isActive;
  const locked = retired || readOnly;
  const lifecycle = !isNew && (retired ? onRestore : onRetire);
  return (
    <QuestionShell open onClose={onClose} dirty={dirty && !locked} busy={busy} wide
      ariaLabel={isNew ? 'New drill' : `${draft.name || 'Drill'} — drill`}
      title={(
        <input className={`${styles.input} ${styles.ppStationTitle}`} value={draft.name} disabled={locked}
          maxLength={MAX_DRILL_NAME_LEN} placeholder="What do you call it?" aria-label="Drill name"
          autoFocus={isNew}
          onChange={e => onChange({ ...draft, name: e.target.value })} />
      )}
      footerStart={saveNote && !locked ? <p className={styles.formHint}>{saveNote}</p> : undefined}
      footer={<>
        <QuestionCancel className={styles.btnGhost} />
        {!locked && (
          <button type="button" className={styles.btnPrimary} disabled={busy || !draft.name.trim()} onClick={onSubmit}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        )}
      </>}>
        <div className={styles.ppStationBody}>
          {readOnly && !retired && <p className={styles.formHint}>A club drill — your club’s administrator manages it. You can use it in any practice.</p>}
          {retired && <p className={styles.formHint}>Retired — it stays out of the picker until you restore it. Every plan that used it keeps reading.</p>}
          {/* The library's own two facts, first. Coach-typed vocabulary, offered from what they've
              already used — never a fixed list. The SAME tags a focus area can carry. */}
          <TagPicker
            label="Tags"
            all={tags}
            selected={draft.tagIds ?? []}
            onChange={next => onChange({ ...draft, tagIds: next })}
            onCreate={locked ? undefined : onCreateTag}
            manage={focusManage} onManageChanged={onFocusTagsChanged}
            disabled={locked}
            emptyHint="No tags yet — type a word to make your first one."
          />
          <div className={styles.ppField}>
            <FieldLabel>Usually</FieldLabel>
            <div className={styles.ppClockRow}>
              <input className={`${styles.input} ${styles.ppMinutes}`} type="number" min={1} max={MAX_DRILL_MINUTES}
                inputMode="numeric" value={draft.usualMinutes ?? ''} aria-label="Usual minutes" disabled={locked}
                onChange={e => onChange({ ...draft, usualMinutes: e.target.value ? Number(e.target.value) : null })} />
              <span className={styles.ppUnit}>min</span>
            </div>
          </div>

          <TeachingFields
            values={draft} readOnly={locked} noun="drill" doingPlaceholder="How it runs"
            maxText={MAX_DRILL_TEXT_LEN} maxPoints={MAX_DRILL_POINTS} maxPointLen={MAX_DRILL_POINT_LEN}
            equipmentTags={equipmentTags} onCreateEquipmentTag={onCreateEquipmentTag}
            equipmentManage={equipmentManage} onEquipmentTagsChanged={onEquipmentTagsChanged}
            onPatch={patch => onChange({ ...draft, ...patch })}
          />

          {/* Retire / Restore ENDS THE BODY (see the header) — where the goal sheet's Remove goal and the station's
              Delete would sit under the same ruling. Retired, not deleted: every plan that used it keeps reading. */}
          {lifecycle && (
            <div className={styles.ppSheetLifecycle}>
              <button type="button" className={styles.deleteRecordBtn} disabled={busy} onClick={retired ? onRestore : onRetire}>
                {retired ? <><RotateCcw size={14} aria-hidden /> Restore this drill</> : <><Archive size={14} aria-hidden /> Retire this drill</>}
              </button>
            </div>
          )}
        </div>
        {/* Why Save was refused, beside it in the foot (One Window 2b). */}
        <QuestionReason className={styles.errorText}>{error}</QuestionReason>
    </QuestionShell>
  );
}
