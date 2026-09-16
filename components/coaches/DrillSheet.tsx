'use client';
import { useRef } from 'react';
import { Archive, RotateCcw } from 'lucide-react';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import TagPicker, { type PickableTag } from '@/components/coaches/TagPicker';
import { FieldLabel, TeachingFields } from '@/components/coaches/PracticeFields';
import type { TagManageConfig } from '@/components/coaches/TagSearchCombobox';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
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
 * words as a station (`TeachingFields`); then the foot: *Retire this drill* (Restore on a retired
 * one) where the station modal keeps *Delete this station* — the portal's one place for the
 * destructive act, never on the row — beside Cancel · Save.
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
  busy, error, onChange, onSubmit, onClose, onRetire, onRestore,
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
  onChange: (next: DrillInput) => void;
  onSubmit: () => void;
  onClose: () => void;
  /** Retire (an active drill) / Restore (a retired one) — absent on a new drill. */
  onRetire?: () => void;
  onRestore?: () => void;
}) {
  /* The dialog floor (stage 2, D9), busy-gated: Escape closes, Tab stays inside, focus returns to
     the row that opened it; while a save is in flight the sheet holds. */
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFloor(true, panelRef, { onClose, busy });
  const retired = !isActive;
  const locked = retired || readOnly;
  return (
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={isNew ? 'New drill' : `${draft.name || 'Drill'} — drill`}
        aria-busy={busy || undefined}
        className={`${styles.modal} ${styles.modalWide} ${styles.modalScrollBody} ${styles.ppStationModal}`}>
        <CoachModalHeader
          onClose={onClose}
          closeAriaLabel="Close"
          title={(
            <input className={`${styles.input} ${styles.ppStationTitle}`} value={draft.name} disabled={locked}
              maxLength={MAX_DRILL_NAME_LEN} placeholder="What do you call it?" aria-label="Drill name"
              autoFocus={isNew}
              onChange={e => onChange({ ...draft, name: e.target.value })} />
          )}
        />

        <div className={`${styles.scrollPane} ${styles.ppStationBody}`}>
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

          {error && <p className={styles.errorText} role="alert">{error}</p>}
        </div>

        <div className={styles.modalFooter}>
          {/* Retire lives here now — where the station modal keeps "Delete this station" and the
              goal sheet "Remove goal". Retired, not deleted: every plan that used it keeps reading. */}
          {!isNew && (retired ? onRestore : onRetire) && (
            <button type="button" className={styles.deleteRecordBtn} disabled={busy} onClick={retired ? onRestore : onRetire}>
              {retired ? <><RotateCcw size={14} aria-hidden /> Restore this drill</> : <><Archive size={14} aria-hidden /> Retire this drill</>}
            </button>
          )}
          <button type="button" className={styles.btnGhost} onClick={onClose}>Cancel</button>
          {!locked && (
            <button type="button" className={styles.btnPrimary} disabled={busy || !draft.name.trim()} onClick={onSubmit}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
