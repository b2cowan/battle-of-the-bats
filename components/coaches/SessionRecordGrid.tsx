'use client';
import { useEffect, useRef, useState } from 'react';
import { formatValue } from '@/lib/measurable-format';
import { describeAttempts } from '@/lib/measurable-series';
import { rowState, attemptBoxes, rowStateLabel, type SessionRow, type SessionRowState } from '@/lib/development-session-view';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import type { RepEvaluationNotAssessed, RepPlayerMeasurable, RepPlayerObservation, RepTeamMeasurableType } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './DevelopmentSession.module.css';

export interface GridPlayer { id: string; playerFirstName: string; playerLastName: string | null; playerNumber: string | null }
export type GridRow = SessionRow<GridPlayer, RepPlayerMeasurable, RepEvaluationNotAssessed, RepPlayerObservation>;

/** The client's own knowledge of a row: drafts per attempt, what is in flight, what failed. */
export interface RowDraft {
  /** Index = attempt − 1. A blank draft was not run. */
  values: string[];
  /** Attempt numbers currently saving. */
  saving: Set<number>;
  error: string | null;
  /** "Edit" on a saved row: fields open, saved values pre-filled. */
  editing: boolean;
  /** Boxes the coach added with the row's "+" — one more attempt for THIS player (C2). */
  extra: number;
}
export const emptyDraft = (): RowDraft => ({ values: [], saving: new Set(), error: null, editing: false, extra: 0 });

const authorLine = (authors: Record<string, string>, id: string | null) => (id ? (authors[id] ?? 'a coach') : null);

/**
 * The session's grid for ONE metric (development lifecycle Phase 2, mockup screen 3; re-evaluation
 * stage 2, C1 · C2 · C7, 2026-09-15). ROSTER ORDER ONLY (binding). A test: one box per attempt —
 * as many as the SESSION planned for it tonight, never fewer than a row already holds, plus a "+"
 * after the last box for one more (the plan is a floor, never a ceiling; five is the most any row
 * takes); Enter moves to the next attempt, then the next player; the headline reads under the boxes
 * as attempts are typed; a blank attempt was not run. A skill (C12, the sheet for everything — owner
 * ruling 2026-09-15): nothing on the row writes — a blank row is one door, "Record an observation ›",
 * into the observation sheet (`RecordObservationDialog` with the skill and the date fixed by the
 * session); a saved row reads the whole observation on its face, and Edit opens the same sheet.
 *
 * ONE LANGUAGE PER ROW (C7): a saved attempt sits in the same box as an empty one; the correction
 * mark stays; "entered by" is off the row (it reads on Edit and in the review). Per-row state
 * (Recorded · Saving · Not saved — retry · Not recorded · Not assessed — `rowStateLabel`, ONE word
 * per state at every width and for every kind of row)
 * with Edit and Retry on the row; a failed value survives on screen beside its error;
 * "Mark not assessed" on BLANK rows only. On a phone a TEST row is the name and the state on the
 * first line, the boxes on the second, the headline under (the module's ≤640 rule).
 *
 * ⚠⚠ **AT ≤640 A SKILL ROW IS ONE 56px ROW AND THE ROW IS THE DOOR** (phone re-evaluation stage 4 ·
 * E2, owner 2026-09-22). Measured: 117px a player, so ten filled 1,170px of a 1,949px page, with
 * the state and BOTH actions set at 12px on the one screen a coach reads standing up in daylight.
 * Now: the number, the name at 16px, the descriptor under it on a recorded row, the state as a
 * chip, a chevron — and tapping anywhere on it opens the observation dialog. Two tap targets become
 * one, which is what makes "twelve players, twelve taps" possible at all.
 *
 * ⚠⚠ **AT ≤640 A WRITABLE TEST ROW IS THE PLAYER'S NAME AND THEIR BOXES, AND NOTHING ELSE**
 * (owner ruling 2026-09-23, mockup 88FTwEYRhDBzS6sfRA2MJa). The name takes the whole first line at
 * `--type-lead` — measured, it had ~90px of a ~300px line and truncated every surname, because the
 * status column took what it wanted first and the name took the remainder. What left that line:
 *   · **"Not recorded" on a blank row** — two empty boxes sit directly beneath saying it already.
 *     The chip returns the moment it carries something the boxes cannot: Saving…, Not saved —
 *     retry, Recorded, Not assessed.
 *   · **"Mark not assessed"** — ~110px on all twelve rows, for something used once or twice a
 *     session. It moves to the REVIEW SHEET, which already lists exactly the players it applies to.
 *     ⚠ And that is cheaper than it sounds, not dearer: a mark is per player PER TEST, so an absent
 *     player needs accounting for on every test in the session — on the rows that is one trip
 *     through the test dropdown each time, while the review has every test on one screen.
 *   · **"Edit"** — the SAVED VALUE is the control now: tapping a recorded attempt opens the row for
 *     editing with the caret in the box that was tapped. Everything Edit was buying survives — it is
 *     still a deliberate act on a specific value, the row still announces "editing" and who entered
 *     it, and a changed value still carries its correction mark.
 * **Retry stays on the row**, because an errored row has no saved value to tap and no other way back.
 * ⚠ DESKTOP IS UNTOUCHED — the wide grid has room for the state word and both links, and none of the
 * reasoning above applies to it. `isPhone && !isSkill && !readOnly` is the whole gate.
 *
 * ⚠ **"Mark not assessed" LEAVES THE ROW'S EDGE ENTIRELY**, and that is stage 3's ruling rather than
 * this stage's: a destructive control does not sit on the edge of a row whose whole body is the tap.
 * It becomes the dialog's fourth answer — where it also belongs, since the dialog asks what you saw
 * and "I didn't assess this" is one of the answers. **So a row already marked not-assessed must be
 * a door too**, or a phone would have no way to undo the mark: the dialog opens with that answer
 * chosen, and picking a descriptor instead clears it.
 *
 * ⚠ **ONLY A ROW THE COACH MAY WRITE TAKES THIS SHAPE.** A read-only row (no grant, a retired chip,
 * a past participant) keeps the old composition, because that row reads the observation's NOTE on
 * its face and the 56px row deliberately shows only the descriptor — the note is behind the door,
 * and a reader with no door would lose the words altogether. `readOnly` is the one branch.
 *
 * ⚠ **EVERY ROW IS LIVE AT REST.** Nothing here waits on a prior selection. Game day's on-field
 * rows are disabled until a bench player is picked and that screen reads as dead; there is nothing
 * to pick first here, so a gated row would be worse.
 *
 * ⚠ Pure of network: the page owns the fetches. This component draws rows from the view module
 * and the drafts it is handed, and reports what the coach did.
 */
export default function SessionRecordGrid({
  type, planned, rows, draftFor, authors,
  canWrite, canWriteObservations, retired,
  onAttemptChange, onAttemptCommit, onAddAttempt, onEdit, onRetry, onMarkNotAssessed, onUnmarkNotAssessed,
  onRecordObservation, onObservationEdit,
}: {
  type: RepTeamMeasurableType;
  /** The session's planned count for this test (C1); null on a session from before the count existed. */
  planned: number | null;
  rows: GridRow[];
  /** The page owns the drafts (keyed by player AND metric); the grid asks for a row's by player id. */
  draftFor: (playerId: string) => RowDraft;
  authors: Record<string, string>;
  canWrite: boolean;
  canWriteObservations: boolean;
  /** The chip is retired — its saved rows stay, read-only. */
  retired: boolean;
  onAttemptChange: (playerId: string, attemptNo: number, value: string) => void;
  onAttemptCommit: (playerId: string, attemptNo: number) => void;
  /** The row's "+": one more box for this player. */
  onAddAttempt: (playerId: string) => void;
  onEdit: (playerId: string) => void;
  onRetry: (playerId: string) => void;
  onMarkNotAssessed: (playerId: string) => void;
  onUnmarkNotAssessed: (playerId: string) => void;
  /** A blank skill row's door: opens the observation sheet for this player. */
  onRecordObservation: (playerId: string) => void;
  /** Edit on a saved skill row: the same sheet, filled. */
  onObservationEdit: (playerId: string) => void;
}) {
  const isSkill = type.kind === 'skill';
  /* ≤640, read live. The door row is different DOM from the desktop row — one element instead of
     four, a button instead of a div — so this is a decision the stylesheet cannot make (E2). */
  const isPhone = useIsPhone();
  const def = { aim: type.aim, headline: type.headline, rangeFrom: type.rangeFrom, rangeTo: type.rangeTo };
  // Enter → the next attempt field, then the next player's first. DOM order is roster order.
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  /* Tapping a saved value opens the row AND lands the caret in the box that was tapped — the whole
     point of dropping the Edit link is that the value you touched is the value you are changing.
     The input does not exist until the PAGE flips the row to editing, a render later, so the want
     is parked here and spent on the first render where the field exists.
     ⚠ A ref, not state, and the effect takes no dependency array — the draft that makes the field
     appear lives on the page and reaches this component without `rows` ever changing identity, so
     a keyed effect would never fire on the render that matters. Writing a ref is also not a
     setState, which is what keeps this out of the cascading-render rule. */
  const wantFocus = useRef<{ playerId: string; attemptNo: number } | null>(null);
  useEffect(() => {
    const want = wantFocus.current;
    if (!want || !gridEl) return;
    const row = gridEl.querySelector(`[data-player-row="${want.playerId}"]`);
    const field = row?.querySelectorAll<HTMLElement>('[data-attempt-field]')[want.attemptNo - 1];
    if (!field) return;   // the row has not opened yet — the next render will find it
    wantFocus.current = null;
    field.focus();
  });
  function focusNext(current: HTMLElement) {
    if (!gridEl) return;
    const fields = [...gridEl.querySelectorAll<HTMLElement>('[data-attempt-field]')];
    const i = fields.indexOf(current);
    fields[i + 1]?.focus();
  }
  // "Attempts · seconds · 2 planned"; a session from before plans existed has no count to say.
  const columnLabel = isSkill
    ? 'Observation'
    : `Attempts · ${type.unit}${planned === null ? '' : ` · ${planned} planned`}`;

  return (
    <div className={css.grid} ref={setGridEl}>
      <div className={css.labels} aria-hidden>
        <span>Player · roster order</span>
        <span>{columnLabel}</span>
        <span>State</span>
      </div>
      {rows.map(row => {
        const p = row.player;
        const name = [p.playerFirstName, p.playerLastName].filter(Boolean).join(' ');
        const readOnly = !canWrite || retired || row.pastParticipant || (isSkill && !canWriteObservations);
        const draft = draftFor(p.id);
        const observation = row.observation;
        const hasEntries = isSkill ? !!observation : row.entries.length > 0;
        // A skill row never saves, so it is never saving, failed or editing — the sheet holds those (C12).
        const saving = isSkill ? false : draft.saving.size > 0;
        const error = isSkill ? null : draft.error;
        const state: SessionRowState = rowState({ hasEntries, notAssessed: !!row.notAssessed, saving, error: !!error });
        const editing = isSkill ? false : draft.editing;
        const enteredBy = isSkill ? authorLine(authors, observation?.createdBy ?? null) : authorLine(authors, row.entries[0]?.createdBy ?? null);
        const savedValues = row.entries.map(e => e.value);
        const typedValues = draft.values.map(v => Number(v)).filter((v, i) => draft.values[i]?.trim() !== '' && Number.isFinite(v));
        const liveValues = editing || savedValues.length === 0 ? typedValues : savedValues;
        const savedMax = row.entries.reduce((m, e) => Math.max(m, e.attemptNo), 0);
        const { boxes, canAddMore } = attemptBoxes({ planned, savedMax, extra: draft.extra });
        // The headline under the boxes — unless it would only repeat the one box above it (a single
        // attempt with no plan to read it against says "8.75" under "8.75"; that line is noise).
        const headline = liveValues.length > 0 ? describeAttempts(liveValues, def, planned) : null;
        const showHeadline = headline !== null && !(liveValues.length === 1 && headline === formatValue(liveValues[0]));

        const stateCls = state === 'saved' ? css.stateSaved : state === 'error' ? css.stateError : state === 'saving' ? '' : css.stateQuiet;
        const rowNote = row.pastParticipant ? 'no longer on the roster' : row.inScope ? null : 'outside the scope';

        /* ── ≤640, a writable SKILL row: one 56px row, and the row is the door (E2) ──
           The chip's word comes from the same `rowStateLabel` the desktop row reads, so the two
           cannot drift; the descriptor sits under the name on a recorded row and the NOTE does not,
           because the note belongs in the record the door opens. A row already marked not-assessed
           is a door too — that is the only way back from the mark on a phone. */
        if (isPhone && isSkill && !readOnly) {
          const chipCls = state === 'saved' ? css.doorStateDone : state === 'not_assessed' ? css.doorStateNa : css.doorStateOpen;
          const chip = rowStateLabel(state);
          const under = observation?.descriptor
            ? observation.descriptor
            : row.notAssessed?.reason ? row.notAssessed.reason : rowNote;
          return (
            <button
              key={p.id}
              type="button"
              className={`${css.doorRow}${row.inScope ? '' : ` ${css.doorRowOutsideScope}`}`}
              data-player-row={p.id}
              data-observation-door
              /* The name, THE SECOND LINE, and the state — then what the tap does. A row announced
                 as just a name would say nothing about why it is a button.
                 ⚠ `under` belongs in here (/review, 2026-09-22): an aria-label REPLACES the button's
                 whole accessible name, so the saved descriptor, the not-assessed reason and the
                 "outside the scope" note — all of which a sighted coach reads while scanning — were
                 announced to nobody. A screen-reader user had to open each row to learn what the
                 list already showed. */
              aria-label={`${name}${under ? ` — ${under}` : ''} — ${chip}. ${observation ? 'Edit the observation' : 'Record an observation'}`}
              onClick={() => (observation ? onObservationEdit(p.id) : onRecordObservation(p.id))}
            >
              {p.playerNumber && <span className={css.doorNum}>#{p.playerNumber}</span>}
              {!p.playerNumber && <span />}
              <span className={css.doorName}><strong>{name}</strong></span>
              <span className={`${css.doorState} ${chipCls}`}>{chip}</span>
              <span className={css.doorGo} aria-hidden>›</span>
              {/* ⚠ THE SECOND LINE IS THE ROW'S OWN, NOT THE NAME'S (owner, 2026-09-23: the chip sits
                  "in line with the name only, so there was room under for text"). It used to live
                  inside the name cell, which meant the descriptor shared its width with the chip and
                  the chevron and truncated at about half the screen — "Independently — without a …".
                  Spanning the row from the name's column to the end gives it every pixel the name
                  itself gets. The row does not grow: this is the same two lines it always drew. */}
              {under && <small className={css.doorUnder}>{under}</small>}
            </button>
          );
        }

        /* ≤640, writable, a TEST — the row the owner redrew on 2026-09-23. A read-only row keeps the
           old composition (it has no controls to lose and its state word is all it has), and a skill
           row never reaches here: the door above returned already. */
        const phoneTest = isPhone && !isSkill && !readOnly;

        return (
          <div key={p.id} className={`${css.row}${phoneTest ? ` ${css.rowPhoneTest}` : ''}${row.inScope ? '' : ` ${css.rowOutsideScope}`}`} data-player-row={p.id}>
            <div className={css.name}>
              <strong>{p.playerNumber && <span className={css.num}>#{p.playerNumber} </span>}{name}</strong>
              {rowNote && <span>{rowNote}</span>}
            </div>

            {/* ── the record ── */}
            {row.notAssessed && !hasEntries ? (
              <span className={css.recordDash}>—{row.notAssessed.reason ? ` ${row.notAssessed.reason}` : ''}</span>
            ) : isSkill ? (
              readOnly || observation ? (
                // The whole observation on the row's face — the descriptor, then the sentence, wrapping as it needs to.
                <span className={css.obsSaved}>
                  {observation ? <>{observation.descriptor && <em>{observation.descriptor}</em>}{observation.descriptor && observation.note ? ' — ' : ''}{observation.note}</> : <span className={styles.devRowDash}>—</span>}
                </span>
              ) : (
                // A blank row is a door, and only a door (C12): the sheet asks the descriptor and the sentence.
                <span className={css.obs}>
                  <button type="button" className={css.obsDoor} aria-label={`Record an observation — ${name}, ${type.name}`}
                    data-observation-door onClick={() => onRecordObservation(p.id)}>Record an observation ›</button>
                </span>
              )
            ) : (
              <div className={css.attempts}>
                {Array.from({ length: boxes }, (_, i) => i + 1).map(k => {
                  const saved = row.entries.find(e => e.attemptNo === k) ?? null;
                  const editable = !readOnly && (editing || !saved);
                  if (!editable) {
                    /* A saved attempt in the SAME box as an empty one (C7) — a read-only face of the
                       field. ⚠ At ≤640 on a writable row that face is the row's EDIT CONTROL (owner
                       2026-09-23): the phone row carries no Edit link, so the value itself opens the
                       row and takes the caret. It stays a plain span everywhere else — desktop keeps
                       its link, and a row nobody may write has nothing to open. */
                    if (isPhone && !readOnly && saved) {
                      return (
                        <button key={k} type="button" className={`${css.attempt} ${css.attemptSaved} ${css.attemptTap}`}
                          aria-label={`Edit ${name} attempt ${k} — ${formatValue(saved.value)}${saved.correctedFrom != null ? `, corrected from ${formatValue(saved.correctedFrom)}` : ''}`}
                          onClick={() => { wantFocus.current = { playerId: p.id, attemptNo: k }; onEdit(p.id); }}>
                          {formatValue(saved.value)}
                          {saved.correctedFrom != null && <span className={styles.devRowDash}>*</span>}
                        </button>
                      );
                    }
                    return (
                      <span key={k} className={`${css.attempt} ${css.attemptSaved}`}
                        title={saved?.correctedFrom != null ? `corrected — was ${formatValue(saved.correctedFrom)}` : undefined}>
                        {saved ? formatValue(saved.value) : <span className={styles.devRowDash}>{k}</span>}
                        {saved?.correctedFrom != null && <span className={styles.devRowDash}>*</span>}
                      </span>
                    );
                  }
                  return (
                    <input key={k} className={`${styles.input} ${css.attempt}`} type="text" inputMode="decimal"
                      placeholder={String(k)} aria-label={`${name} attempt ${k} in ${type.unit}`}
                      value={draft.values[k - 1] ?? ''} disabled={draft.saving.has(k)} data-attempt-field
                      onChange={e => onAttemptChange(p.id, k, e.target.value)}
                      onBlur={() => onAttemptCommit(p.id, k)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); focusNext(e.target as HTMLElement); } }} />
                  );
                })}
                {/* "+" — one more attempt for this player alone, up to five (C2). */}
                {!readOnly && canAddMore && (
                  <button type="button" className={css.attemptPlus} aria-label={`One more attempt for ${name}`} onClick={() => onAddAttempt(p.id)}>+</button>
                )}
                {showHeadline && <span className={css.headline}>{headline}</span>}
              </div>
            )}

            {/* ── the state ──
                ⚠ `phoneTest` is the ≤640 writable TEST row (owner 2026-09-23): the word becomes a
                CHIP that sits on the name's line, and it is drawn only when it says something the
                boxes below it do not — so a blank row carries no state at all. Mark not assessed
                and Edit are both absent there; see this file's header for where each one went. */}
            <span className={`${css.state} ${stateCls}${phoneTest ? ` ${css.stateChipWrap}` : ''}`} role="status">
              {/* ⚠ …and it stands down while the row is being EDITED: the caption below already says
                  "editing — entered by …", and a chip reading "Recorded" beside it is the row saying
                  two things at once on the one line this redraw exists to keep clear. */}
              {(!phoneTest || (state !== 'not_recorded' && !editing)) && (
                phoneTest
                  ? <span className={`${css.stateChip} ${state === 'saved' ? css.stateChipDone : state === 'not_assessed' ? css.stateChipNa : ''}`}>{rowStateLabel(state)}</span>
                  : rowStateLabel(state)
              )}
              {!readOnly && !phoneTest && state === 'not_recorded' && !editing && (
                <button type="button" className={css.rowLink} onClick={() => onMarkNotAssessed(p.id)}>Mark not assessed</button>
              )}
              {/* ⚠ UNDO COMES BACK WHEN THE REVIEW CANNOT REACH THE MARK (/review 2026-09-23). The
                  review sheet is the phone's door to a mark, and it lists only players who are IN
                  the session's plan — so a player marked while in the plan and then dropped from it
                  keeps a "Not assessed" chip that no screen could remove: absent from the review's
                  lists, and stripped of this link. Narrow (it needs a plan edited after a mark) and
                  permanent, which is the bad combination. An out-of-scope row keeps its own way out. */}
              {!readOnly && (!phoneTest || !row.inScope) && state === 'not_assessed' && (
                <button type="button" className={css.rowLink} onClick={() => onUnmarkNotAssessed(p.id)}>Undo</button>
              )}
              {/* Retry stays at BOTH widths: an errored row holds no saved value to tap, so without
                  it a failed save on a phone would have no way back. */}
              {!readOnly && state === 'error' && (
                <button type="button" className={css.rowLink} onClick={() => onRetry(p.id)}>Retry</button>
              )}
              {!readOnly && !phoneTest && state === 'saved' && !editing && (
                <button type="button" className={css.rowLink} onClick={() => (isSkill ? onObservationEdit(p.id) : onEdit(p.id))}>Edit</button>
              )}
              {/* Who typed it is Edit's fact (C7) — said here, where a correction is being made. */}
              {!readOnly && editing && state === 'saved' && (
                <span className={css.stateQuiet}>editing{enteredBy ? ` — entered by ${enteredBy}` : ''} · leave a field to save</span>
              )}
            </span>
            {error && <p className={css.rowError} role="alert">{error}</p>}
          </div>
        );
      })}
    </div>
  );
}
