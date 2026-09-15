'use client';
import { useState } from 'react';
import QuestionShell from '@/components/coaches/QuestionShell';
import { todayLocal } from '@/lib/measurable-format';
import type { RepPlayerDevelopmentGoal, RepPlayerObservation, RepTeamMeasurableType } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * "Record an observation" (development lifecycle Phase 2, mockup screen 4): what the coach saw
 * against an observed SKILL, dated, with an optional descriptor (one of the skill's own words) and
 * optionally as evidence for a goal. Opened from the Observations view and from a goal (which
 * pre-selects itself as the evidence link). Editing an observation reuses the form — the skill it
 * names is fixed. Visible to coaches with Internal notes.
 */
export default function RecordObservationDialog({
  skills, goals, editing, presetGoalId, busy, error, onSubmit, onClose,
}: {
  /** Active observed skills. */
  skills: RepTeamMeasurableType[];
  goals: RepPlayerDevelopmentGoal[];
  editing?: RepPlayerObservation | null;
  presetGoalId?: string | null;
  busy: boolean;
  error: string;
  onSubmit: (v: { measurableTypeId: string; observedOn: string; note: string; descriptor: string; goalId: string | null }) => void;
  onClose: () => void;
}) {
  const [skillId, setSkillId] = useState(editing?.measurableTypeId ?? skills[0]?.id ?? '');
  const [observedOn, setObservedOn] = useState(editing?.observedOn ?? todayLocal());
  const [note, setNote] = useState(editing?.note ?? '');
  const [descriptor, setDescriptor] = useState(editing?.descriptor ?? '');
  const [goalId, setGoalId] = useState(editing?.goalId ?? presetGoalId ?? '');
  const [localErr, setLocalErr] = useState('');
  const skill = skills.find(s => s.id === skillId) ?? null;
  const title = editing ? 'Edit the observation' : 'Record an observation';

  return (
    <QuestionShell open onClose={onClose} ariaLabel={title} title={title} busy={busy}>
        <form className={styles.formBody} onSubmit={e => {
          e.preventDefault();
          if (!skillId) { setLocalErr('Choose the skill you observed.'); return; }
          if (!note.trim() && !descriptor) { setLocalErr('Say what you saw, or choose a descriptor.'); return; }
          setLocalErr('');
          onSubmit({ measurableTypeId: skillId, observedOn, note: note.trim(), descriptor, goalId: goalId || null });
        }}>
          <div className={styles.formGrid}>
            <label className={`${styles.field} ${styles.formGridFull}`}>
              <span className={styles.label}>Skill</span>
              {editing ? (
                <span className={styles.input} aria-readonly>{skills.find(s => s.id === editing.measurableTypeId)?.name ?? 'Skill'}</span>
              ) : (
                <select className={styles.select} value={skillId} onChange={e => { setSkillId(e.target.value); setDescriptor(''); }} required>
                  {skills.length === 0 && <option value="">No skill defined yet</option>}
                  {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Observed on</span>
              <input className={styles.input} type="date" value={observedOn} onChange={e => setObservedOn(e.target.value)} required />
            </label>
            {skill && skill.descriptors.length > 0 && (
              <label className={styles.field}>
                <span className={styles.label}>Descriptor (optional)</span>
                <select className={styles.select} value={descriptor} onChange={e => setDescriptor(e.target.value)}>
                  <option value="">No descriptor</option>
                  {skill.descriptors.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
            )}
            <label className={`${styles.field} ${styles.formGridFull}`}>
              <span className={styles.label}>What did you see?</span>
              <textarea className={styles.textarea} rows={3} maxLength={600} value={note}
                placeholder="The action, the setting and any cue you gave" onChange={e => setNote(e.target.value)} />
            </label>
            {goals.length > 0 && (
              <label className={`${styles.field} ${styles.formGridFull}`}>
                <span className={styles.label}>Evidence for (optional)</span>
                <select className={styles.select} value={goalId} onChange={e => setGoalId(e.target.value)}>
                  <option value="">No goal</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.focusArea}</option>)}
                </select>
              </label>
            )}
          </div>
          <p className={styles.formHint}>A description of one observation, not an overall grade. Visible to coaches with Internal notes.</p>
          {(localErr || error) && <p className={styles.errorText} role="alert">{localErr || error}</p>}
          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnSecondary} disabled={busy} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={busy || skills.length === 0}>{busy ? 'Saving…' : editing ? 'Save' : 'Save observation'}</button>
          </div>
        </form>
    </QuestionShell>
  );
}
