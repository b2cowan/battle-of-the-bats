'use client';
import { useState } from 'react';
import { formatValue } from '@/lib/measurable-format';
import { describeAttempts } from '@/lib/measurable-series';
import { rowState, ROW_STATE_LABELS, type SessionRow, type SessionRowState } from '@/lib/development-session-view';
import type { RepEvaluationNotAssessed, RepPlayerMeasurable, RepPlayerObservation, RepTeamMeasurableType } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './DevelopmentSession.module.css';

export interface GridPlayer { id: string; playerFirstName: string; playerLastName: string | null; playerNumber: string | null }
export type GridRow = SessionRow<GridPlayer, RepPlayerMeasurable, RepEvaluationNotAssessed>;

/** The client's own knowledge of a row: drafts per attempt, what is in flight, what failed. */
export interface RowDraft {
  /** Index = attempt − 1. A blank draft was not run. */
  values: string[];
  /** Attempt numbers currently saving. */
  saving: Set<number>;
  error: string | null;
  /** "Edit" on a saved row: fields open, saved values pre-filled. */
  editing: boolean;
}
export const emptyDraft = (): RowDraft => ({ values: [], saving: new Set(), error: null, editing: false });

export interface ObservationDraft { descriptor: string; note: string; saving: boolean; error: string | null; editing: boolean }
export const emptyObservationDraft = (): ObservationDraft => ({ descriptor: '', note: '', saving: false, error: null, editing: false });

const authorLine = (authors: Record<string, string>, id: string | null) => (id ? (authors[id] ?? 'a coach') : null);

/**
 * The session's grid for ONE metric (development lifecycle Phase 2, mockup screen 3). ROSTER
 * ORDER ONLY (binding). A measured test: one field per attempt, as many as the definition says;
 * Enter moves to the next attempt, then the next player; the headline updates as attempts are
 * typed; a blank attempt was not run. An observed skill: a descriptor and/or what was seen.
 * Per-row state (Saved · Saving · Not saved — retry · Not recorded · Not assessed) with Edit and
 * Retry on the row; a failed value survives on screen beside its error; "Mark not assessed" on
 * BLANK rows only. "Entered by" on every saved row.
 *
 * ⚠ Pure of network: the page owns the fetches. This component draws rows from the view module
 * and the drafts it is handed, and reports what the coach did.
 */
export default function SessionRecordGrid({
  type, rows, draftFor, observationDraftFor, observations, authors,
  canWrite, canWriteObservations, retired,
  onAttemptChange, onAttemptCommit, onEdit, onRetry, onMarkNotAssessed, onUnmarkNotAssessed,
  onObservationChange, onObservationCommit, onObservationEdit,
}: {
  type: RepTeamMeasurableType;
  rows: GridRow[];
  /** The page owns the drafts (keyed by player AND metric); the grid asks for a row's by player id. */
  draftFor: (playerId: string) => RowDraft;
  observationDraftFor: (playerId: string) => ObservationDraft;
  /** This session's observations (all skills) — the rows pick theirs by player + skill. */
  observations: RepPlayerObservation[];
  authors: Record<string, string>;
  canWrite: boolean;
  canWriteObservations: boolean;
  /** The chip is retired — its saved rows stay, read-only. */
  retired: boolean;
  onAttemptChange: (playerId: string, attemptNo: number, value: string) => void;
  onAttemptCommit: (playerId: string, attemptNo: number) => void;
  onEdit: (playerId: string) => void;
  onRetry: (playerId: string) => void;
  onMarkNotAssessed: (playerId: string) => void;
  onUnmarkNotAssessed: (playerId: string) => void;
  onObservationChange: (playerId: string, patch: Partial<Pick<ObservationDraft, 'descriptor' | 'note'>>) => void;
  onObservationCommit: (playerId: string) => void;
  onObservationEdit: (playerId: string) => void;
}) {
  const isSkill = type.kind === 'skill';
  // The definition says how many fields to offer; a row that already holds MORE (the count was
  // lowered after this session recorded them) keeps every saved attempt reachable — a reading
  // that cannot be seen cannot be corrected or removed.
  const attempts = isSkill ? 0 : Math.max(1, type.attemptsPerSession, ...rows.map(r => r.entries.reduce((m, e) => Math.max(m, e.attemptNo), 0)));
  const def = { aim: type.aim, headline: type.headline, rangeFrom: type.rangeFrom, rangeTo: type.rangeTo };
  // This metric's observation per player, once — not a scan of the session's list per row per render.
  const observationByPlayer = isSkill
    ? new Map(observations.filter(o => o.measurableTypeId === type.id).map(o => [o.playerId, o]))
    : new Map<string, RepPlayerObservation>();
  // Enter → the next attempt field, then the next player's first. DOM order is roster order.
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  function focusNext(current: HTMLElement) {
    if (!gridEl) return;
    const fields = [...gridEl.querySelectorAll<HTMLElement>('[data-attempt-field]')];
    const i = fields.indexOf(current);
    fields[i + 1]?.focus();
  }

  return (
    <div className={css.grid} ref={setGridEl}>
      <div className={css.labels} aria-hidden>
        <span>Player · roster order · entered by</span>
        <span>{isSkill ? 'Observation' : `Attempts · ${type.unit} · ${attempts === 1 ? 'one attempt' : `${attempts} attempts`}`}</span>
        <span>State</span>
      </div>
      {rows.map(row => {
        const p = row.player;
        const name = [p.playerFirstName, p.playerLastName].filter(Boolean).join(' ');
        const readOnly = !canWrite || retired || row.pastParticipant || (isSkill && !canWriteObservations);
        const draft = draftFor(p.id);
        const obsDraft = observationDraftFor(p.id);
        const observation = observationByPlayer.get(p.id) ?? null;
        const hasEntries = isSkill ? !!observation : row.entries.length > 0;
        const saving = isSkill ? obsDraft.saving : draft.saving.size > 0;
        const error = isSkill ? obsDraft.error : draft.error;
        const state: SessionRowState = rowState({ hasEntries, notAssessed: !!row.notAssessed, saving, error: !!error });
        const editing = isSkill ? obsDraft.editing : draft.editing;
        const enteredBy = isSkill ? authorLine(authors, observation?.createdBy ?? null) : authorLine(authors, row.entries[0]?.createdBy ?? null);
        const savedValues = row.entries.map(e => e.value);
        const typedValues = draft.values.map(v => Number(v)).filter((v, i) => draft.values[i]?.trim() !== '' && Number.isFinite(v));
        const liveValues = editing || savedValues.length === 0 ? typedValues : savedValues;

        const stateCls = state === 'saved' ? css.stateSaved : state === 'error' ? css.stateError : state === 'saving' ? '' : css.stateQuiet;
        const inScopeNote = row.inScope ? null : ' · outside the scope';

        return (
          <div key={p.id} className={`${css.row}${row.inScope ? '' : ` ${css.rowOutsideScope}`}`}>
            <div className={css.name}>
              <strong>{p.playerNumber && <span className={css.num}>#{p.playerNumber} </span>}{name}</strong>
              <span>
                {row.pastParticipant ? 'no longer on the roster' : enteredBy ? `entered by ${enteredBy}` : ''}
                {inScopeNote}
              </span>
            </div>

            {/* ── the record ── */}
            {row.notAssessed && !hasEntries ? (
              <span className={`${styles.devRowVal} ${styles.devRowDash}`}>—{row.notAssessed.reason ? ` ${row.notAssessed.reason}` : ''}</span>
            ) : isSkill ? (
              readOnly || (observation && !editing) ? (
                <span className={css.obsSaved}>
                  {observation ? <>{observation.descriptor && <em>{observation.descriptor}</em>}{observation.descriptor && observation.note ? ' — ' : ''}{observation.note}</> : <span className={styles.devRowDash}>—</span>}
                </span>
              ) : (
                <div className={css.obs}>
                  {type.descriptors.length > 0 && (
                    <select className={styles.select} value={obsDraft.descriptor} aria-label={`${name} — ${type.name} descriptor`}
                      disabled={obsDraft.saving}
                      onChange={e => onObservationChange(p.id, { descriptor: e.target.value })}
                      onBlur={() => onObservationCommit(p.id)}>
                      <option value="">Choose…</option>
                      {type.descriptors.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  )}
                  <input className={styles.input} type="text" maxLength={600} value={obsDraft.note}
                    placeholder="What you saw" aria-label={`${name} — ${type.name}, what you saw`}
                    disabled={obsDraft.saving} data-attempt-field
                    onChange={e => onObservationChange(p.id, { note: e.target.value })}
                    onBlur={() => onObservationCommit(p.id)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); focusNext(e.target as HTMLElement); } }} />
                </div>
              )
            ) : (
              <div className={css.attempts}>
                {Array.from({ length: attempts }, (_, i) => i + 1).map(k => {
                  const saved = row.entries.find(e => e.attemptNo === k) ?? null;
                  const editable = !readOnly && (editing || !saved);
                  if (!editable) {
                    return (
                      <span key={k} className={css.attemptSaved} title={saved?.correctedFrom != null ? `corrected — was ${formatValue(saved.correctedFrom)}` : undefined}>
                        {saved ? formatValue(saved.value) : <span className={styles.devRowDash}>·</span>}
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
                {liveValues.length > 0 && (
                  <span className={css.headline}>{describeAttempts(liveValues, def, attempts)}</span>
                )}
              </div>
            )}

            {/* ── the state ── */}
            <span className={`${css.state} ${stateCls}`} role="status">
              {ROW_STATE_LABELS[state]}
              {!readOnly && state === 'not_recorded' && !editing && (
                <button type="button" className={css.rowLink} onClick={() => onMarkNotAssessed(p.id)}>Mark not assessed</button>
              )}
              {!readOnly && state === 'not_assessed' && (
                <button type="button" className={css.rowLink} onClick={() => onUnmarkNotAssessed(p.id)}>Undo</button>
              )}
              {!readOnly && state === 'error' && (
                <button type="button" className={css.rowLink} onClick={() => onRetry(p.id)}>Retry</button>
              )}
              {!readOnly && state === 'saved' && !editing && (
                <button type="button" className={css.rowLink} onClick={() => (isSkill ? onObservationEdit(p.id) : onEdit(p.id))}>Edit</button>
              )}
              {!readOnly && editing && state === 'saved' && <span className={css.stateQuiet}>editing — leave a field to save</span>}
            </span>
            {error && <p className={css.rowError} role="alert">{error}</p>}
          </div>
        );
      })}
    </div>
  );
}

