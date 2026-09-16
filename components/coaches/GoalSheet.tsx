'use client';
import { useState } from 'react';
import QuestionShell from '@/components/coaches/QuestionShell';
import CoachFormDisclosure from '@/components/coaches/CoachFormDisclosure';
import TagPicker, { type PickableTag } from '@/components/coaches/TagPicker';
import { FOCUS_TAG_MANAGE } from '@/components/coaches/TagSearchCombobox';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import SheetRemoveButton from '@/components/coaches/SheetRemoveButton';
import type { RepPlayerDevelopmentGoal } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

export interface GoalSheetValues {
  focusArea: string;
  note: string | null;
  success: string | null;
  tagId: string | null;
}

/**
 * "Add goal" / "Edit wording" — the goal's fields in a sheet over the Goals view (development
 * lifecycle re-evaluation stage 3, 2026-09-15: the sheet/page test — a new goal is a sheet, the
 * record is the page; the fields are unchanged, E5). The record is the focus and the status; the
 * note, what success looks like and the focus tag stay optional behind "More" (F08, F11, F17). A
 * goal can still be one line of text.
 *
 * The review date does NOT live here (owner, 2026-09-16): it's the "Review goal" sheet's field —
 * one door sets it, so a later review can never disagree with what this sheet last saved.
 *
 * F11 (Phase 1): the focus TAG is the same picker the tryout hand-off uses, the same 'focus'
 * vocabulary the drills and the focus rail read — one tag, optional, never inferred from the text.
 * Remove (edit mode) sits at the footer's left; the host confirms and deletes.
 */
export default function GoalSheet({
  editing, orgSlug, teamId, focusTags, onCreateTag, onTagsChanged, busy, error, onSubmit, onClose, onRemove,
}: {
  editing: RepPlayerDevelopmentGoal | null;
  orgSlug: string;
  teamId: string;
  focusTags: PickableTag[];
  onCreateTag: (name: string) => Promise<PickableTag | null>;
  onTagsChanged: () => void;
  busy: boolean;
  error: string;
  onSubmit: (v: GoalSheetValues) => void;
  onClose: () => void;
  onRemove?: () => void;
}) {
  const initial = {
    focus: editing?.focusArea ?? '', note: editing?.note ?? '', success: editing?.success ?? '',
    tagId: editing?.tagId ?? null,
  };
  const [focus, setFocus] = useState(initial.focus);
  const [note, setNote] = useState(initial.note);
  const [success, setSuccess] = useState(initial.success);
  const [tagId, setTagId] = useState<string | null>(initial.tagId);
  const [localErr, setLocalErr] = useState('');

  const dirty = focus !== initial.focus || note !== initial.note || success !== initial.success || tagId !== initial.tagId;
  const close = useDiscardGuard({ dirty, close: onClose, noun: 'goal', detail: focus.trim() ? 'a focus area' : undefined });
  const title = editing ? 'Edit the goal' : 'Add a goal';

  return (
    <QuestionShell open onClose={close} ariaLabel={title} title={title} subtitle={editing?.focusArea} busy={busy}>
      <form className={`${styles.formBody} ${styles.formBodyTight}`} onSubmit={e => {
        e.preventDefault();
        const f = focus.trim();
        if (!f) { setLocalErr('Type the focus area first.'); return; }
        setLocalErr('');
        onSubmit({ focusArea: f, note: note.trim() || null, success: success.trim() || null, tagId });
      }}>
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.formGridFull}`}>
            <span className={styles.label}>Focus area</span>
            <input className={styles.input} type="text" value={focus} maxLength={80} placeholder="e.g. First-step quickness off the bag"
              autoFocus onChange={e => setFocus(e.target.value)} />
          </label>
          <label className={`${styles.field} ${styles.formGridFull}`}>
            <span className={styles.label}>Note (optional)</span>
            <input className={styles.input} type="text" value={note} maxLength={280} placeholder="One short note the player would be happy to read"
              onChange={e => setNote(e.target.value)} />
          </label>
          <div className={styles.formGridFull}>
            <CoachFormDisclosure
              label="More — success, tag"
              title="More"
              meta={(initial.success || initial.tagId) ? 'Set' : undefined}
              defaultOpen={!!(initial.success || initial.tagId)}
            >
              <label className={styles.field}>
                <span className={styles.label}>What would success look like? (optional)</span>
                <input className={styles.input} type="text" value={success} maxLength={280} placeholder="e.g. sets feet without a cue in the partner drill"
                  onChange={e => setSuccess(e.target.value)} />
              </label>
              <div className={styles.field}>
                <TagPicker
                  all={focusTags}
                  selected={tagId ? [tagId] : []}
                  onChange={next => setTagId(next[0] ?? null)}
                  onCreate={onCreateTag}
                  single
                  label="Focus tag (optional)"
                  placeholder="Group it with a focus word…"
                  emptyHint="No focus words yet — type one to make your team’s first."
                  manage={{ ...FOCUS_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/focus-tags` }}
                  onManageChanged={onTagsChanged}
                />
              </div>
            </CoachFormDisclosure>
          </div>
        </div>
        {(localErr || error) && <p className={styles.errorText} role="alert">{localErr || error}</p>}
        <div className={styles.modalFooter}>
          {editing && onRemove && <SheetRemoveButton label="Remove goal" busy={busy} onRemove={onRemove} />}
          <button type="button" className={styles.btnSecondary} disabled={busy} onClick={() => void close()}>Cancel</button>
          <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? 'Saving…' : editing ? 'Save' : 'Add it'}</button>
        </div>
      </form>
    </QuestionShell>
  );
}
