'use client';
/**
 * TOOLS (⋯) → ANSWER COLUMNS (Board Ready Stage 4 Part 3; drawing tab 6 · A, ruling 11): the club's non-health questions
 * with tick boxes, up to three. Each tick saves at once (the way the form page's reorder saves each move) and is remembered
 * for this person, on any computer. A health question is never offered (the list never carries its answers).
 */
import { useState } from 'react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { repKit } from '../../RepKit';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import { ANSWER_COLUMNS_MAX as MAX, STAFF_FORM_WORDS as W } from '@/lib/club-form-staff-words';
import css from './Registrations.module.css';

export default function AnswerColumnsWindow({ questions, chosen, onSave, onClose }: {
  questions: readonly { id: string; label: string }[];
  chosen: readonly string[];
  /** Saves the new choice; resolves false when it was not saved. */
  onSave: (ids: string[]) => Promise<boolean>;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([...chosen]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const full = picked.length >= MAX;

  const toggle = async (id: string) => {
    if (saving) return;
    const before = picked;
    const next = before.includes(id) ? before.filter(x => x !== id) : [...before, id];
    setPicked(next);
    setFailed(false);
    setSaving(true);
    const ok = await onSave(next);
    setSaving(false);
    if (!ok) { setPicked(before); setFailed(true); }
  };

  return (
    <KitDialog
      kind="form"
      title={W.answerColumnsTitle}
      onClose={onClose}
      footer={<DialogCancel className="btn btn-lime">{'Done'}</DialogCancel>}
    >
      <p className={ck.hint}>{W.answerColumnsHint}</p>
      <ul className={css.answerColumnList}>
        {questions.map(q => {
          const on = picked.includes(q.id);
          return (
            <li key={q.id}>
              <label className={css.answerColumnRow}>
                <input type="checkbox" className={screenParts.check22} checked={on} disabled={saving || (!on && full)} onChange={() => void toggle(q.id)} />
                <span>{q.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {full && <p className={ck.hint} role="status">{W.answerColumnsFull}</p>}
      {failed && <p className={repKit.formError} role="alert">{W.answerColumnsSaveFailed}</p>}
    </KitDialog>
  );
}
