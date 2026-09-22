'use client';
import { useState } from 'react';
import { Check } from 'lucide-react';
import QuestionShell from '@/components/coaches/QuestionShell';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { todayLocal } from '@/lib/measurable-format';
import { MAX_NOT_ASSESSED_REASON_LEN, MAX_OBSERVATION_NOTE_LEN } from '@/lib/development-input';
import type { RepPlayerDevelopmentGoal, RepPlayerObservation, RepTeamMeasurableType } from '@/lib/types';
import SheetRemoveButton from '@/components/coaches/SheetRemoveButton';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './RecordObservationDialog.module.css';

/**
 * "Record an observation" (development lifecycle Phase 2, mockup screen 4; re-evaluation stage 2,
 * C12 — the sheet for everything, owner ruling 2026-09-15): what the coach saw against a SKILL,
 * dated, with an optional descriptor (one of the skill's own words) and optionally as evidence for
 * a goal. ONE form for one record, from every door: the Goals toolbar asks for the skill, the date
 * and the goal; a GOAL's own button (`presetGoalId`) FIXES the goal — its name is the subtitle, the
 * same place "Review the goal" and "Edit the goal" put it, and the Evidence for field is not asked
 * (owner, 2026-09-16: clicking the button inside the goal IS the choice; asking again with the same
 * goal pre-filled was a question already answered); a SESSION's grid opens the same sheet with the
 * skill and the date FIXED (`fixed`) — the skill is the chip, the date is the session's — so it
 * asks only the descriptor, the sentence and (owner ruling 2026-09-16, "The Evidence Door") Evidence
 * for. A door that answers a question does not ask it. Editing reuses the form from every door as
 * the record's own editor: the skill it names is fixed, the goal link stays changeable. Nothing
 * saves until Save. Visible to coaches with Internal notes.
 *
 * ⚠ THE SHEET TAKES REMOVE (re-evaluation stage 3, owner ruling E2, 2026-09-15). An observation's
 * home is the Notes tab; the goal's history, Player progress and the session row are its doors; and
 * it opens in THIS sheet from every one of them. The Observations view — the only place one could
 * be deleted — is gone, so `Remove observation` sits at the footer's left in edit mode (the host
 * confirms and deletes, as Delete session's host does). Delete is never a row action.
 *
 * `onSubmit` hands back every field; the caller decides what to write (the session page sends only
 * what changed, so a descriptor the skill no longer offers is never re-sent by accident — /review
 * 2026-09-15). A saved descriptor the list has since dropped still shows, marked, so the coach can
 * see it and clear it.
 *
 * ⚠⚠ **THIS IS THE SCREEN OF PHONE STAGE 4, AND IT WAS NOT IN THE PLAN'S QUESTIONS** (phone
 * re-evaluation stage 4 · E3, owner 2026-09-22 — "build as drawn, and treat this as the stage's
 * real find"). A coach opens it twelve times a session standing on a field, and every walk had
 * measured the PAGE rather than the dialog behind its rows. What was there, read from the browser at
 * 390×844: a **33px** Save and a **33px** Cancel — both under the portal's 44px floor, on a screen
 * whose siblings use 56 — sitting **mid-panel with 392px of dead space beneath them**, over a
 * **37px** descriptor select that is a tap, a wheel and a confirm. At ≤640 now:
 *
 *   · the descriptors are **56px rows** (`css.picks`), and **"Not assessed today" is the fourth
 *     answer** — it arrives from the row's edge, where a destructive control must not sit beside a
 *     row whose whole body is the tap (stage 3's Templates ruling, applied by E2). Nothing is
 *     stranded: the dialog asks what you saw, and "I didn't assess this" is one of the answers.
 *   · the foot **DOCKS** at the screen's bottom carrying **Save & next player** and **Save**, both
 *     56px. It floated because `.modalFooter` asks for `margin-top: auto` while this dialog's
 *     footer is a GRANDCHILD inside its own `<form>` — a form that is not itself stretched gives
 *     `auto` nothing to push against. ⚠ The shell's `scroll` variant was TRIED for this and
 *     ABANDONED — it never shipped, so the diff shows no removal: that variant bleeds a form's
 *     fields by a DESKTOP-sized margin, and the sweep measured the form spilling 24px at all four
 *     widths. Three declarations in this component's own module stretch the form instead, so
 *     nothing above 640 moves and eight other sheets are left alone. The stylesheet has the detail.
 *
 * ⚠ **THE DESKTOP DOES NOT MOVE.** Above 640 the Descriptor select stays — and with it
 * "No descriptor", which the answer rows have nowhere to put — and so do Cancel and today's foot.
 * At ≤640 the escape from a mis-tapped answer is a **second tap on the chosen row**, which clears
 * it; that gesture is deliberately quiet rather than a fifth row, because a row appearing under the
 * thumb the moment something is picked shifts the layout mid-tap. ⚠ Flagged for the walk.
 *
 * ⚠ Three things `/review` corrected in the first build of this screen, each with its reasoning at
 * the code: the answers are **toggle buttons**, not a `radiogroup` whose keyboard pattern was never
 * written; "which answer is chosen" is **one** piece of state, not two that could disagree; and a
 * sentence typed beside *Not assessed today* is saved as that mark's **reason** instead of being
 * dropped on the floor.
 *
 * ⚠ **"Save & next player" OPENS THE NEXT UNRECORDED ROW, NOT THE NEXT ROW** — and the host decides
 * which that is (`nextLabel` + `andNext`), because only the host knows the session's scope and who
 * is already done. It is offered only when there IS one ahead, so it is never a button that means
 * nothing; "Save" alone closes back to the list, for the coach who has finished.
 */
export default function RecordObservationDialog({
  skills, goals, editing, presetGoalId, fixed, notAssessed, nextLabel, busy, error, onSubmit, onClose, onRemove,
}: {
  /** Active skills. In `fixed` mode, the one the session's chip is on. */
  skills: RepTeamMeasurableType[];
  goals: Pick<RepPlayerDevelopmentGoal, 'id' | 'focusArea'>[];
  editing?: RepPlayerObservation | null;
  presetGoalId?: string | null;
  /**
   * Opened from a session's grid (or the goal's history, for an observation a session dates): the
   * skill and the date come from the record, not the coach. The title names the player; the
   * subtitle says which session dates it.
   */
  fixed?: { skill: RepTeamMeasurableType; observedOn: string; playerName: string; subtitle: string; enteredBy?: string | null } | null;
  /**
   * ⚠ Only a SESSION can answer "not assessed today" — the mark belongs to a session and a player,
   * so only a session's door offers the fourth answer (E3). `marked` is the row's state on open, so
   * a row already marked opens with that answer chosen and can be changed out of it, and `reason`
   * is what the coach last wrote beside it, so the sentence ROUND-TRIPS instead of coming back
   * blank and unfixable (found by re-driving the fix, 2026-09-22). Absent, the answer is not
   * offered and nothing else changes — the Goals toolbar, a goal's own button and the Notes tab all
   * pass nothing.
   */
  notAssessed?: { marked: boolean; reason?: string | null } | null;
  /** The next unrecorded player's name, when the host has one ahead — the "& next player" offer. */
  nextLabel?: string | null;
  busy: boolean;
  error: string;
  onSubmit: (v: {
    measurableTypeId: string; observedOn: string; note: string; descriptor: string; goalId: string | null;
    /** The fourth answer: mark this player not assessed for this skill today, instead of recording. */
    notAssessedToday: boolean;
    /** The coach pressed "Save & next player" — save, then open the next unrecorded row. */
    andNext: boolean;
  }) => void;
  onClose: () => void;
  /** Edit mode: the footer's Remove observation (the host confirms and deletes). */
  onRemove?: () => void;
}) {
  const initialSkillId = fixed?.skill.id ?? editing?.measurableTypeId ?? skills[0]?.id ?? '';
  const initialObservedOn = fixed?.observedOn ?? editing?.observedOn ?? todayLocal();
  /* When the mark is the answer, the field IS the mark's reason, so it seeds from there. Ordered
     this way because the two can never both apply: the mark is only offered on a row with no
     observation (see `offerNa`). */
  const initialNote = (notAssessed?.marked && !editing ? notAssessed.reason : null) ?? editing?.note ?? '';
  const initialGoalId = editing?.goalId ?? presetGoalId ?? '';
  /**
   * ── ONE PIECE OF STATE FOR "WHICH ANSWER IS CHOSEN" (/review, 2026-09-22) ──
   * The first build held this as TWO independent values — a `descriptor` string and a `naToday`
   * boolean — and derived each row's selected look from both (`descriptor === d && !naToday`). That
   * let the visible selection and the real selection DISAGREE, and a reviewer found the exact case:
   * a row carrying both a saved descriptor and a session mark showed NOTHING selected (the mark
   * suppressed the descriptor's tick) while `descriptor` still held the saved word — so the coach's
   * first tap on the word they could see unselected ran the "tap again to clear" branch and cleared
   * it. Two taps to select, and a validation error in between.
   *
   * One value cannot disagree with itself. Everything else is derived from it.
   *
   * ⚠ And the fourth answer is offered ONLY WHERE THE DESKTOP OFFERS ITS LINK — on a row with no
   * observation (`!editing`). That is not a tidy-up either: the desktop's "Mark not assessed" has
   * always rendered on BLANK rows only, and the whole product resolves the pair the same way — a
   * RECORD WINS OVER A MARK in `rowState` (`hasEntries` is checked first) and in the counts
   * (`notAssessed` counts only `!r.recorded && r.notAssessed`, so nothing is ever double-counted).
   * Offering the mark over an existing record would have been the one surface claiming otherwise.
   */
  type Answer = { kind: 'descriptor'; value: string } | { kind: 'not-assessed' };
  const offerNa = !!notAssessed && !editing;
  const initialAnswer: Answer | null = offerNa && notAssessed?.marked
    ? { kind: 'not-assessed' }
    : editing?.descriptor ? { kind: 'descriptor', value: editing.descriptor } : null;
  const [skillId, setSkillId] = useState(initialSkillId);
  const [observedOn, setObservedOn] = useState(initialObservedOn);
  const [note, setNote] = useState(initialNote);
  const [answer, setAnswer] = useState<Answer | null>(initialAnswer);
  const [goalId, setGoalId] = useState(initialGoalId);
  const [localErr, setLocalErr] = useState('');
  const isPhone = useIsPhone();
  const descriptor = answer?.kind === 'descriptor' ? answer.value : '';
  const naToday = answer?.kind === 'not-assessed';
  const skill = fixed?.skill ?? skills.find(s => s.id === skillId) ?? null;
  // A descriptor saved under a word the skill's list has since dropped: offered once, marked, so
  // the select shows what is stored rather than silently reading "No descriptor" over it.
  const staleDescriptor = descriptor && skill && !skill.descriptors.includes(descriptor) ? descriptor : null;
  const presetGoal = !editing && presetGoalId ? goals.find(g => g.id === presetGoalId) ?? null : null;
  const verb = editing ? 'Edit the observation' : 'Record an observation';
  const title = fixed ? `${fixed.playerName} — ${fixed.skill.name}` : verb;
  const subtitle = fixed?.subtitle ?? presetGoal?.focusArea;
  /* The answers as rows (E3) — ≤640 only, and only where the skill has words to offer or a mark can
     be set. A stale descriptor joins the list so a record is never re-read as something it does not
     say. */
  const asRows = isPhone && !!skill && (skill.descriptors.length > 0 || !!staleDescriptor || offerNa);
  /**
   * ⚠ WHEN THE MARK IS THE ANSWER, THE SENTENCE IS THE MARK'S **REASON** (/review, 2026-09-22).
   * The first build dropped it on the floor: the mark writes a different record and its branch
   * returned without ever reading `note`, so a coach who typed "left early, couldn't assess" and
   * chose *Not assessed today* watched the dialog close as though it had saved, with the words gone.
   * Deterministic data loss, on a sentence a coach stood on a field to write. The mark's record has
   * carried a `reason` since it was built — the row already reads it back ("— left early") — so the
   * sentence has somewhere true to go, and the field says so as soon as the answer changes.
   * ⚠ A reason is capped FIVE TIMES shorter than an observation's note (120 against 600), so the
   * limit follows the answer and `submit` REFUSES an over-long one rather than truncating it. Never
   * silently shorten what a coach typed.
   */
  const noteLimit = naToday ? MAX_NOT_ASSESSED_REASON_LEN : MAX_OBSERVATION_NOTE_LEN;
  const noteLabel = naToday ? 'Why not?' : asRows ? 'Anything to add?' : 'What did you see?';
  // Typed work a Cancel, an X or Escape would throw away — asked once, never on Save.
  const dirty = note !== initialNote || answer?.kind !== initialAnswer?.kind || descriptor !== (initialAnswer?.kind === 'descriptor' ? initialAnswer.value : '')
    || skillId !== initialSkillId || observedOn !== initialObservedOn || goalId !== initialGoalId;
  const close = useDiscardGuard({
    dirty, close: onClose, noun: 'observation',
    detail: note.trim() ? 'what you saw' : descriptor ? 'a descriptor' : undefined,
  });

  /** One answer at a time; activating the chosen one again clears it (see the header's note). */
  const choose = (next: Answer) => {
    setAnswer(a => (a && a.kind === next.kind && (next.kind !== 'descriptor' || (a.kind === 'descriptor' && a.value === next.value)) ? null : next));
    setLocalErr('');
  };
  const chosen = (a: Answer) => (a.kind === 'descriptor'
    ? answer?.kind === 'descriptor' && answer.value === a.value
    : answer?.kind === 'not-assessed');

  function submit(andNext: boolean) {
    if (!skillId) { setLocalErr('Choose the skill you observed.'); return; }
    // The fourth answer IS an answer — it needs neither a descriptor nor a sentence.
    if (!naToday && !note.trim() && !descriptor) {
      setLocalErr(asRows ? 'Pick what you saw, or write a note.' : 'Say what you saw, or choose a descriptor.');
      return;
    }
    if (note.trim().length > noteLimit) {
      setLocalErr(`A reason can be ${noteLimit} characters — this is ${note.trim().length}. Shorten it, or pick what you saw instead.`);
      return;
    }
    setLocalErr('');
    onSubmit({
      measurableTypeId: skillId, observedOn, note: note.trim(), descriptor,
      goalId: goalId || null, notAssessedToday: naToday, andNext,
    });
  }

  return (
    <QuestionShell open onClose={close} ariaLabel={fixed ? `${verb} — ${title}` : title} title={title} subtitle={subtitle} busy={busy}>
        {/* ⚠ `css.phoneForm` + `css.phoneScroll` are what dock the foot at ≤640 — three declarations
            in this component's own module, deliberately NOT the shell's `scroll` variant (see the
            E3 note above and the stylesheet for the 24px spill that route measured). Above 640 both
            classes declare nothing, so the desktop form is exactly what it was. */}
        <form className={`${styles.formBody} ${styles.formBodyTight} ${css.phoneForm}`} onSubmit={e => { e.preventDefault(); submit(false); }}>
          <div className={`${styles.formGrid} ${css.phoneScroll}`}>
            {!fixed && (
              <label className={`${styles.field} ${styles.formGridFull}`}>
                <span className={styles.label}>Skill</span>
                {editing ? (
                  <span className={styles.input} aria-readonly>{skills.find(s => s.id === editing.measurableTypeId)?.name ?? 'Skill'}</span>
                ) : (
                  <select className={styles.select} value={skillId} onChange={e => { setSkillId(e.target.value); setAnswer(null); }} required>
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
            {asRows ? (
              /* ⚠⚠ TOGGLE BUTTONS IN A GROUP, **NOT** A `radiogroup` (/review, 2026-09-22). The
                 first build declared `role="radiogroup"` with `role="radio"` rows and owed that
                 word a keyboard pattern it did not implement: arrow-key roving with ONE tab stop.
                 These were plain buttons — N tab stops, and arrows did nothing — which is exactly
                 the failure this repo already documents one file over, where `CoachToolbarMenu`'s
                 own comment says a `role="menu"` "OWES THE KEYBOARD PATTERN THAT WORD PROMISES".
                 A reviewer caught the same promise being broken here.
                 ⚠ And radio semantics were the WRONG description anyway: a radio cannot be
                 unchecked by re-activating it, while this control is "pick AT MOST ONE" — the
                 descriptor has always been optional, and tapping the chosen answer again clears it.
                 `aria-pressed` toggles say precisely that, they make Tab-per-button correct rather
                 than a broken promise, and the clear gesture stops contradicting the role. */
              <div className={`${styles.field} ${styles.formGridFull}`} role="group" aria-labelledby="obs-answer-label">
                <span className={styles.label} id="obs-answer-label">What did you see?</span>
                <div className={css.picks}>
                  {skill?.descriptors.map(d => (
                    <button key={d} type="button" aria-pressed={chosen({ kind: 'descriptor', value: d })}
                      className={css.pick} onClick={() => choose({ kind: 'descriptor', value: d })}>
                      <span className={css.pickText}>{d}</span>
                      {/* A tick, not just a tint — the selected answer must survive daylight and a
                          colour-vision deficiency on the one screen read standing up outdoors. The
                          menu's own checked row already carries one; this matches it. */}
                      <Check size={18} className={css.pickTick} aria-hidden />
                    </button>
                  ))}
                  {staleDescriptor && (
                    <button type="button" aria-pressed={chosen({ kind: 'descriptor', value: staleDescriptor })}
                      className={`${css.pick} ${css.pickStale}`} onClick={() => choose({ kind: 'descriptor', value: staleDescriptor })}>
                      <span className={css.pickText}>{staleDescriptor} — no longer on this skill</span>
                      <Check size={18} className={css.pickTick} aria-hidden />
                    </button>
                  )}
                  {offerNa && (
                    <button type="button" aria-pressed={chosen({ kind: 'not-assessed' })}
                      className={`${css.pick} ${css.pickQuiet}`} onClick={() => choose({ kind: 'not-assessed' })}>
                      <span className={css.pickText}>Not assessed today</span>
                      <Check size={18} className={css.pickTick} aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              skill && (skill.descriptors.length > 0 || staleDescriptor) && (
                <label className={`${styles.field} ${fixed ? styles.formGridFull : ''}`}>
                  <span className={styles.label}>Descriptor</span>
                  <select className={styles.select} value={descriptor}
                    /* The same ONE answer the phone's rows set — "No descriptor" is the empty answer.
                       Two controls, one model, so neither can disagree with the other. */
                    onChange={e => setAnswer(e.target.value ? { kind: 'descriptor', value: e.target.value } : null)}>
                    <option value="">No descriptor</option>
                    {skill.descriptors.map(d => <option key={d} value={d}>{d}</option>)}
                    {staleDescriptor && <option value={staleDescriptor}>{staleDescriptor} — no longer on this skill</option>}
                  </select>
                </label>
              )
            )}
            <label className={`${styles.field} ${styles.formGridFull}`}>
              {/* The rows above have taken the question, so the sentence becomes the addition it
                  actually is. One label per field at each width — never two questions at once. */}
              {/* The label, the limit and the counter all follow the ANSWER — see `noteLimit`'s note
                  above for why the sentence becomes the mark's REASON when the mark is chosen, and
                  why it is refused rather than truncated when it will not fit. */}
              <span className={styles.label}>{noteLabel}</span>
              <textarea className={styles.textarea} rows={asRows ? 3 : 5} maxLength={noteLimit} value={note}
                placeholder={naToday ? 'Absent, hurt, ran out of time…' : 'The action, the setting and any cue you gave'}
                onChange={e => setNote(e.target.value)} />
              <span className={styles.formHint} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {note.length} / {noteLimit}
              </span>
            </label>
            {goals.length > 0 && !presetGoal && (
              <label className={`${styles.field} ${styles.formGridFull}`}>
                <span className={styles.label}>Evidence for</span>
                <select className={styles.select} value={goalId} onChange={e => setGoalId(e.target.value)}>
                  <option value="">No goal</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.focusArea}</option>)}
                </select>
              </label>
            )}
          </div>
          {/* The one line that answers "whose record is it?" (E8): the record is the coach's, read behind
              Internal notes; the paper is chosen line by line on the handout page. */}
          <p className={styles.formHint}>
            {fixed?.enteredBy && editing ? `Entered by ${fixed.enteredBy} · ` : ''}
            One observation, not an overall grade. Visible to coaches with Internal notes · on a handout only if you choose it.
          </p>
          {(localErr || error) && <p className={styles.errorText} role="alert">{localErr || error}</p>}
          <div className={styles.modalFooter}>
            {editing && onRemove && <SheetRemoveButton label="Remove observation" busy={busy} onRemove={onRemove} />}
            {/* ⚠ Cancel is a DESKTOP control. At ≤640 the header's own back arrow is the way out and
                it runs the same guarded closer, so a second dismiss would spend a 56px slot the two
                saves need — and the only reason the foot is reachable at all now is that it docks. */}
            {!isPhone && (
              <button type="button" className={styles.btnSecondary} disabled={busy} onClick={() => void close()}>Cancel</button>
            )}
            {isPhone && nextLabel && (
              <button type="button" className={`${styles.btnPrimary} ${css.footBtn}`} disabled={busy || !skillId}
                onClick={() => submit(true)}>
                {busy ? 'Saving…' : 'Save & next player'}
              </button>
            )}
            <button type="submit" className={`${isPhone && nextLabel ? styles.btnSecondary : styles.btnPrimary}${isPhone ? ` ${css.footBtn}${nextLabel ? ` ${css.footBtnNarrow}` : ''}` : ''}`} disabled={busy || !skillId}>
              {busy ? 'Saving…' : isPhone && nextLabel ? 'Save' : editing ? 'Save' : 'Save observation'}
            </button>
          </div>
        </form>
    </QuestionShell>
  );
}
