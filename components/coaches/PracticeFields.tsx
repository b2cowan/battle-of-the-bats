'use client';
import { X } from 'lucide-react';
import PracticeTagPicker from '@/components/coaches/PracticeTagPicker';
import type { PickableTag } from '@/components/coaches/TagPicker';
import type { TagManageConfig } from '@/components/coaches/TagSearchCombobox';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The field pieces the practice editor, the station modal and the drill library's sheet share
 * (practices re-evaluation stage 3, owner ruling D7, 2026-09-15 — stage 2's D10 finished; grown
 * to the FIVE teaching fields at stage 4, owner ruling L6, 2026-09-16): a field's small-caps
 * label, Coaching points as ONE field, and `TeachingFields` — what you're doing · what you're
 * watching for · coaching points · setup · equipment, in that order and those words, rendered from
 * a station or from a drill.
 *
 * ⚠ ONE FIELD LIST, TWO FACES — NOT one component. A station is rendered from a plan under autosave
 * (its fields follow the block's door idiom when flattened, and its foot is Delete this station
 * and a stepper); a drill from a library row under an explicit Save (every field simply shown, and
 * its foot Retire · Cancel · Save). What they share is the LIST — the same five things in the same
 * order with the same placeholders — so a coach who learns the station modal knows the drill
 * sheet. The practice half a station has and a drill never does (who runs it, who's at it, just
 * for tonight) and the library half a drill has and a station never does (tags, usually) are each
 * caller's own.
 */

export function FieldLabel({ children, onRemove, removeLabel }: {
  children: React.ReactNode;
  /** A quiet "×" beside the label, in the row instead of a line of its own (owner ask,
   *  2026-09-15) — only for a field that is itself an addition the coach opened; it closes the
   *  door, it never deletes data, so it is only ever passed while the field holds nothing. */
  onRemove?: () => void;
  removeLabel?: string;
}) {
  if (!onRemove) return <span className={styles.ppFieldLabel}>{children}</span>;
  return (
    <span className={styles.ppFieldLabelRow}>
      <span className={styles.ppFieldLabel}>{children}</span>
      <button type="button" className={styles.ppIconBtn} aria-label={removeLabel ?? 'Remove'} onClick={onRemove}>
        <X size={13} />
      </button>
    </span>
  );
}

/** One line of text → the stored list: one point per line, capped as the sanitiser caps it, so
 *  what the coach sees typing is what saves. Windows line ends are tolerated. Empty → no points. */
export function splitPoints(text: string, maxPoints: number, maxLen: number): string[] {
  if (text === '') return [];
  return text.split(/\r?\n/).slice(0, maxPoints).map(line => line.slice(0, maxLen));
}

/**
 * ⚠ The label is "Coaching points", NOT "What to watch for" (owner ruling 2026-08-01). The old
 * label collided with the field screen's "What you're watching for", which is the GOAL — two
 * different fields with near-identical names, one screen apart. One name per idea.
 *
 * ONE field, one point per line (stage 2 D10 on the block; stage 3 D7 on the station and in the
 * drill library). The numbered rows — an input, a number, a remove button and an add link per
 * point — were a form inside the form and most of what an open card's height was; the field screen
 * and the sheet already print the points as a list. Stored exactly as before (a list, capped, each
 * line capped): the split happens at patch time and the sanitiser is unchanged.
 */
export function CoachingPointsField({
  points, readOnly, autoFocus, onSet, onRemove, removeLabel, maxPoints, maxLen, noun,
}: {
  points?: string[];
  readOnly?: boolean;
  autoFocus?: boolean;
  onSet: (next: string[]) => void;
  onRemove?: () => void;
  removeLabel?: string;
  /** The caller's own caps — the plan's and the drill library's happen to agree today, and each
   *  keeps naming its own so a change to one cannot silently move the other. */
  maxPoints: number;
  maxLen: number;
  /** The noun the cap hint names — "block", "station", "drill". */
  noun: string;
}) {
  const current = points ?? [];
  return (
    /* ⚠ A `<div>`, not the usual `<label>` wrapper (owner catch, 2026-09-15): a native `<label>`
       with TWO labelable children (this field's remove button, plus the textarea) forwards a click
       ANYWHERE inside it, including one that lands on the textarea, to its first labelable
       descendant — the button — so typing a click into the textarea closed the field instead of
       focusing it. `aria-label` replaces the accessible name the implicit association gave. */
    <div className={styles.ppField}>
      <FieldLabel onRemove={onRemove} removeLabel={removeLabel}>Coaching points</FieldLabel>
      <textarea className={styles.textarea} rows={Math.max(2, current.length)} value={current.join('\n')}
        disabled={readOnly} autoFocus={autoFocus} aria-label="Coaching points"
        maxLength={maxPoints * (maxLen + 1)}
        placeholder="One per line — the two or three things you want to see"
        onChange={e => onSet(splitPoints(e.target.value, maxPoints, maxLen))} />
      {/* At the cap, Enter simply stops doing anything — `splitPoints` drops a line past the cap
          silently, and the textarea's own `maxLength` is a character ceiling, not a line one, so
          it never engages first. The row-numbered predecessor disabled its own "Add a point" at the
          same cap; a single textarea has no such button, so the explanation lives here (/review,
          2026-09-15). */}
      {!readOnly && current.length >= maxPoints && (
        <span className={styles.formHint}>
          That&apos;s the most you can keep on one {noun} ({maxPoints}) — remove a line to add another.
        </span>
      )}
    </div>
  );
}

/** The five teaching fields' values — a station's or a drill's, read through one shape. */
export interface TeachingValues {
  description?: string | null;
  goal?: string | null;
  coachingPoints?: string[] | null;
  setup?: string | null;
  /** Legacy free-text kit names (shown as adopt rows by the picker; never written back). */
  equipment?: string[] | null;
  /** Real 'equipment' tag ids — the live storage. */
  equipmentTagIds?: string[] | null;
}

/** An optional field's door state where the caller folds fields behind doors (the flattened
 *  station); `{ show: true }` everywhere else. */
export interface TeachingDoor {
  show: boolean;
  onRemove?: () => void;
  removeLabel?: string;
  autoFocus?: boolean;
}
/** The door state of a field that is simply shown — every field of the station modal and the drill sheet. */
export const OPEN_DOOR: TeachingDoor = { show: true };

/**
 * What you're doing · what you're watching for · coaching points · setup · equipment — the one list.
 *
 * `doors` lets the flattened station keep its door idiom (an empty optional field waits at the
 * block's foot); absent, every field shows. The caps are the CALLER's — the plan's and the
 * library's happen to agree today, and each keeps naming its own so a change to one cannot
 * silently move the other.
 */
export function TeachingFields({
  values, readOnly, noun, doingPlaceholder, doors, maxText, maxPoints, maxPointLen,
  equipmentTags, onCreateEquipmentTag, equipmentManage, onEquipmentTagsChanged, onPatch,
}: {
  values: TeachingValues;
  readOnly?: boolean;
  /** The noun the points cap names — "station", "drill". */
  noun: string;
  /** What you're doing asks in the caller's own words ("What happens at this station"). */
  doingPlaceholder: string;
  doors?: (door: 'points' | 'setup' | 'equipment') => TeachingDoor;
  maxText: number;
  maxPoints: number;
  maxPointLen: number;
  equipmentTags: PickableTag[];
  onCreateEquipmentTag?: (name: string) => Promise<PickableTag | null>;
  equipmentManage?: TagManageConfig;
  onEquipmentTagsChanged?: () => void;
  onPatch: (patch: Partial<TeachingValues>) => void;
}) {
  const door = (id: 'points' | 'setup' | 'equipment'): TeachingDoor => (doors ? doors(id) : OPEN_DOOR);
  const points = door('points'), setup = door('setup'), equipment = door('equipment');
  return (
    <>
      <label className={styles.ppField}>
        <FieldLabel>What you&apos;re doing</FieldLabel>
        <textarea className={styles.textarea} rows={2} value={values.description ?? ''} disabled={readOnly}
          maxLength={maxText} placeholder={doingPlaceholder}
          onChange={e => onPatch({ description: e.target.value })} />
      </label>
      <label className={styles.ppField}>
        <FieldLabel>What you&apos;re watching for</FieldLabel>
        <input className={styles.input} value={values.goal ?? ''} disabled={readOnly}
          maxLength={maxText} placeholder="What good looks like here"
          onChange={e => onPatch({ goal: e.target.value })} />
      </label>
      {points.show && (
        <CoachingPointsField points={values.coachingPoints ?? undefined} readOnly={readOnly}
          maxPoints={maxPoints} maxLen={maxPointLen} noun={noun}
          onSet={next => onPatch({ coachingPoints: next })}
          onRemove={points.onRemove} removeLabel={points.removeLabel} autoFocus={points.autoFocus} />
      )}
      {setup.show && (
        <div className={styles.ppField}>
          <FieldLabel onRemove={setup.onRemove} removeLabel={setup.removeLabel}>Setup</FieldLabel>
          <textarea className={styles.textarea} rows={2} value={values.setup ?? ''} disabled={readOnly}
            maxLength={maxText} aria-label="Setup" autoFocus={setup.autoFocus}
            placeholder="How it's laid out — where things go, and how far apart"
            onChange={e => onPatch({ setup: e.target.value })} />
        </div>
      )}
      {equipment.show && (
        <div className={styles.ppField}>
          <FieldLabel onRemove={equipment.onRemove} removeLabel={equipment.removeLabel}>Equipment</FieldLabel>
          {/* One Tag Idiom P3 (mig 272): the kit is the real 'equipment' library — the SAME field a
              station and a drill use, so "L-screen" is one word wherever it appears. Old free-text
              names render as one-press adopt rows in the dropdown; never a silent import. */}
          <PracticeTagPicker all={equipmentTags} ids={values.equipmentTagIds ?? []}
            legacyNames={values.equipment ?? undefined} disabled={readOnly} onCreate={onCreateEquipmentTag}
            manage={equipmentManage} onManageChanged={onEquipmentTagsChanged}
            onChange={next => onPatch({ equipmentTagIds: next })}
            emptyHint="No equipment yet — type an item to add your first one."
            autoFocus={equipment.autoFocus} />
        </div>
      )}
    </>
  );
}
