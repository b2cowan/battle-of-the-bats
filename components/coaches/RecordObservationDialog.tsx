'use client';
import { useState } from 'react';
import QuestionShell from '@/components/coaches/QuestionShell';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import { todayLocal } from '@/lib/measurable-format';
import { MAX_OBSERVATION_NOTE_LEN } from '@/lib/development-input';
import type { RepPlayerDevelopmentGoal, RepPlayerObservation, RepTeamMeasurableType } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * "Record an observation" (development lifecycle Phase 2, mockup screen 4; re-evaluation stage 2,
 * C12 — the sheet for everything, owner ruling 2026-09-15): what the coach saw against a SKILL,
 * dated, with an optional descriptor (one of the skill's own words) and optionally as evidence for
 * a goal. ONE form for one record, from every door: the player's Observations view and a goal
 * (which pre-selects itself as the evidence link) ask for the skill and the date; a SESSION's grid
 * opens the same sheet with both FIXED (`fixed`) — the skill is the chip, the date is the
 * session's — so it asks only the descriptor and the sentence. Editing reuses the form; the skill
 * it names is fixed. Nothing saves until Save. Visible to coaches with Internal notes.
 *
 * `onSubmit` hands back every field; the caller decides what to write (the session page sends only
 * what changed, so a descriptor the skill no longer offers is never re-sent by accident — /review
 * 2026-09-15). A saved descriptor the list has since dropped still shows, marked, so the coach can
 * see it and clear it.
 */
export default function RecordObservationDialog({
  skills, goals, editing, presetGoalId, fixed, busy, error, onSubmit, onClose,
}: {
  /** Active skills. In `fixed` mode, the one the session's chip is on. */
  skills: RepTeamMeasurableType[];
  goals: RepPlayerDevelopmentGoal[];
  editing?: RepPlayerObservation | null;
  presetGoalId?: string | null;
  /**
   * Opened from a session's grid: the skill and the date come from the row, not the coach. The title
   * names the player; the subtitle says which session dates it.
   */
  fixed?: { skill: RepTeamMeasurableType; observedOn: string; playerName: string; subtitle: string; enteredBy?: string | null } | null;
  busy: boolean;
  error: string;
  onSubmit: (v: { measurableTypeId: string; observedOn: string; note: string; descriptor: string; goalId: string | null }) => void;
  onClose: () => void;
}) {
  const initialSkillId = fixed?.skill.id ?? editing?.measurableTypeId ?? skills[0]?.id ?? '';
  const initialObservedOn = fixed?.observedOn ?? editing?.observedOn ?? todayLocal();
  const initialNote = editing?.note ?? '';
  const initialDescriptor = editing?.descriptor ?? '';
  const initialGoalId = editing?.goalId ?? presetGoalId ?? '';
  const [skillId, setSkillId] = useState(initialSkillId);
  const [observedOn, setObservedOn] = useState(initialObservedOn);
  const [note, setNote] = useState(initialNote);
  const [descriptor, setDescriptor] = useState(initialDescriptor);
  const [goalId, setGoalId] = useState(initialGoalId);
  const [localErr, setLocalErr] = useState('');
  const skill = fixed?.skill ?? skills.find(s => s.id === skillId) ?? null;
  // A descriptor saved under a word the skill's list has since dropped: offered once, marked, so
  // the select shows what is stored rather than silently reading "No descriptor" over it.
  const staleDescriptor = descriptor && skill && !skill.descriptors.includes(descriptor) ? descriptor : null;
  const verb = editing ? 'Edit the observation' : 'Record an observation';
  const title = fixed ? `${fixed.playerName} — ${fixed.skill.name}` : verb;
  // Typed work a Cancel, an X or Escape would throw away — asked once, never on Save.
  const dirty = note !== initialNote || descriptor !== initialDescriptor
    || skillId !== initialSkillId || observedOn !== initialObservedOn || goalId !== initialGoalId;
  const close = useDiscardGuard({
    dirty, close: onClose, noun: 'observation',
    detail: note.trim() ? 'what you saw' : descriptor ? 'a descriptor' : undefined,
  });

  return (
    <QuestionShell open onClose={close} ariaLabel={fixed ? `${verb} — ${title}` : title} title={title} subtitle={fixed?.subtitle} busy={busy}>
        <form className={styles.formBody} onSubmit={e => {
          e.preventDefault();
          if (!skillId) { setLocalErr('Choose the skill you observed.'); return; }
          if (!note.trim() && !descriptor) { setLocalErr('Say what you saw, or choose a descriptor.'); return; }
          setLocalErr('');
          onSubmit({ measurableTypeId: skillId, observedOn, note: note.trim(), descriptor, goalId: goalId || null });
        }}>
          <div className={styles.formGrid}>
            {!fixed && (
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
            )}
            {!fixed && (
              <label className={styles.field}>
                <span className={styles.label}>Observed on</span>
                <input className={styles.input} type="date" value={observedOn} onChange={e => setObservedOn(e.target.value)} required />
              </label>
            )}
            {skill && (skill.descriptors.length > 0 || staleDescriptor) && (
              <label className={`${styles.field} ${fixed ? styles.formGridFull : ''}`}>
                <span className={styles.label}>Descriptor</span>
                <select className={styles.select} value={descriptor} onChange={e => setDescriptor(e.target.value)}>
                  <option value="">No descriptor</option>
                  {skill.descriptors.map(d => <option key={d} value={d}>{d}</option>)}
                  {staleDescriptor && <option value={staleDescriptor}>{staleDescriptor} — no longer on this skill</option>}
                </select>
              </label>
            )}
            <label className={`${styles.field} ${styles.formGridFull}`}>
              <span className={styles.label}>What did you see?</span>
              <textarea className={styles.textarea} rows={5} maxLength={MAX_OBSERVATION_NOTE_LEN} value={note}
                placeholder="The action, the setting and any cue you gave" onChange={e => setNote(e.target.value)} />
              <span className={styles.formHint} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {note.length} / {MAX_OBSERVATION_NOTE_LEN}
              </span>
            </label>
            {goals.length > 0 && (
              <label className={`${styles.field} ${styles.formGridFull}`}>
                <span className={styles.label}>Evidence for</span>
                <select className={styles.select} value={goalId} onChange={e => setGoalId(e.target.value)}>
                  <option value="">No goal</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.focusArea}</option>)}
                </select>
              </label>
            )}
          </div>
          <p className={styles.formHint}>
            {fixed?.enteredBy && editing ? `Entered by ${fixed.enteredBy} · ` : ''}
            One observation, not an overall grade. Visible to coaches with Internal notes.
          </p>
          {(localErr || error) && <p className={styles.errorText} role="alert">{localErr || error}</p>}
          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnSecondary} disabled={busy} onClick={() => void close()}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={busy || !skillId}>{busy ? 'Saving…' : editing ? 'Save' : 'Save observation'}</button>
          </div>
        </form>
    </QuestionShell>
  );
}
