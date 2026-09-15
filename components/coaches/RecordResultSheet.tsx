'use client';
import { useState } from 'react';
import QuestionShell from '@/components/coaches/QuestionShell';
import MetricDefinitionSheet from '@/components/coaches/MetricDefinitionSheet';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import SheetRemoveButton from '@/components/coaches/SheetRemoveButton';
import { describeHeadline, type SessionResult } from '@/lib/measurable-series';
import { formatValue, todayLocal } from '@/lib/measurable-format';
import { MAX_ATTEMPTS, MAX_READING_NOTE_LEN } from '@/lib/development-input';
import type { RepPlayerMeasurable, RepTeamMeasurableType } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
// The attempt boxes are the session grid's own (one box, the "+", the read-back under them) — one
// idiom, one module, so a change to the box changes it on the grid and in this sheet together.
import grid from './DevelopmentSession.module.css';
import css from './PlayerDevelopment.module.css';

/** What the sheet hands back: one value per attempt box, in attempt order; a blank box is null. */
export interface ResultSheetValues {
  measurableTypeId: string;
  recordedOn: string;
  /** Index 0 is attempt 1. A null is a box left (or made) blank. */
  attempts: (number | null)[];
  note: string;
}

/**
 * "Record a result" — a result taken from the BENCH, outside any session (development lifecycle
 * re-evaluation stage 3, owner ruling E7, 2026-09-15). It replaced an inline form that took ONE
 * number, so three sprints timed on one morning were three results and three points on the trend
 * line where a session's three are one. This sheet records what a session row records: a test, a
 * date, up to five attempts with the row's "+" (the grid's own boxes, C2), a note — and the reader
 * groups the attempts of one day into one result with a headline.
 *
 * The sheet/page test (stage 1): a result is a sheet over the Results table; the record is the page.
 * "+ New test…" defines a whole test in the definition sheet, stacked over this one (B8). Opened on a
 * saved bench-side result it is filled — the test and the date are the record's identity and read
 * as facts; the attempts and the note are edited — and the footer's left carries Remove result (the
 * host confirms; delete is never a row action). A session's attempts are edited on the session.
 */
export default function RecordResultSheet({
  orgSlug, teamId, playerName, tests, editing, presetTypeId, enteredBy, busy, error, onSubmit, onClose, onRemove, onTypeDefined,
}: {
  orgSlug: string;
  teamId: string;
  playerName: string;
  /** The active measured tests — the Test select. */
  tests: RepTeamMeasurableType[];
  /** A bench-side result to edit (its attempts in attempt order), or null to record one. */
  editing?: { row: SessionResult<RepPlayerMeasurable>; type: RepTeamMeasurableType } | null;
  presetTypeId?: string | null;
  enteredBy?: string | null;
  busy: boolean;
  error: string;
  onSubmit: (v: ResultSheetValues) => void;
  onClose: () => void;
  /** Edit mode: the footer's Remove result (the host confirms and removes every attempt). */
  onRemove?: () => void;
  /** A test defined from "+ New test…" — the host adds it to the library it holds. */
  onTypeDefined?: (type: RepTeamMeasurableType) => void;
}) {
  // One box per saved attempt, in the order the result lists them (never by attempt number — a
  // legacy day can hold two "attempt 1" rows, and both are boxes); one empty box on a new result.
  const initialTypeId = editing?.type.id ?? presetTypeId ?? tests[0]?.id ?? '';
  const initialValues: string[] = editing && editing.row.attempts.length > 0 ? editing.row.attempts.map(a => formatValue(a.value)) : [''];
  const initialNote = editing?.row.attempts[0]?.note ?? '';
  const [typeId, setTypeId] = useState(initialTypeId);
  const [recordedOn, setRecordedOn] = useState(editing?.row.recordedOn ?? todayLocal());
  const [values, setValues] = useState<string[]>(initialValues);
  const [note, setNote] = useState(initialNote);
  const [localErr, setLocalErr] = useState('');
  const [defineOpen, setDefineOpen] = useState(false);

  const type = editing?.type ?? tests.find(t => t.id === typeId) ?? null;
  const typed = values.map(v => Number(v)).filter((n, i) => values[i].trim() !== '' && Number.isFinite(n));
  // The live read-back under the boxes — the definition's own headline once there are two attempts.
  const headline = !type ? null
    : typed.length === 0 ? null
    : typed.length === 1 ? `${formatValue(typed[0])} · 1 attempt`
    : describeHeadline(typed, type);

  const dirty = typeId !== initialTypeId || recordedOn !== (editing?.row.recordedOn ?? todayLocal())
    || note !== initialNote || values.join('|') !== initialValues.join('|');
  const close = useDiscardGuard({ dirty, close: onClose, noun: 'result', detail: typed.length > 0 ? `${typed.length} attempt${typed.length === 1 ? '' : 's'}` : undefined });

  // The host adds the new test to the library it holds; it comes back down as `tests` on the render
  // the select reads it in.
  function typeDefined(t: RepTeamMeasurableType) {
    setDefineOpen(false);
    setTypeId(t.id);
    onTypeDefined?.(t);
  }

  function submit() {
    if (!type) { setLocalErr('Pick a test first.'); return; }
    if (!recordedOn) { setLocalErr('Pick the date.'); return; }
    const attempts: (number | null)[] = [];
    for (const raw of values) {
      const v = raw.trim();
      if (v === '') { attempts.push(null); continue; }
      const n = Number(v);
      if (!Number.isFinite(n)) { setLocalErr('Each attempt needs to be a number (like 8.42).'); return; }
      if (n < 0 || n > 99999) { setLocalErr('A value must be between 0 and 99,999.'); return; }
      attempts.push(n);
    }
    if (attempts.every(a => a === null)) {
      setLocalErr(editing ? 'To take the whole result off the record, use Remove result.' : 'Enter at least one attempt.');
      return;
    }
    setLocalErr('');
    onSubmit({ measurableTypeId: type.id, recordedOn, attempts, note: note.trim() });
  }

  const title = editing ? 'Edit the result' : 'Record a result';
  return (
    <>
      <QuestionShell open onClose={close} ariaLabel={`${title} — ${playerName}`} title={title} subtitle={`${playerName} · outside a session`} busy={busy}>
        <form className={styles.formBody} onSubmit={e => { e.preventDefault(); submit(); }}>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.label}>Test</span>
              {editing ? (
                <span className={styles.input} aria-readonly>{editing.type.name}{editing.type.unit ? ` · ${editing.type.unit}` : ''}</span>
              ) : (
                <>
                  <select className={styles.select} value={typeId} onChange={e => { setTypeId(e.target.value); setLocalErr(''); }} required>
                    {tests.length === 0 && <option value="">No active test yet</option>}
                    {tests.map(t => <option key={t.id} value={t.id}>{t.name}{t.unit ? ` · ${t.unit}` : ''}</option>)}
                  </select>
                  <span className={styles.formHint}>
                    <button type="button" className={css.defineLink} onClick={() => setDefineOpen(true)}>+ New test…</button> defines a whole test, as everywhere.
                  </span>
                </>
              )}
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Date</span>
              {editing ? (
                <span className={styles.input} aria-readonly>{recordedOn}</span>
              ) : (
                <input className={styles.input} type="date" value={recordedOn} onChange={e => setRecordedOn(e.target.value)} required />
              )}
            </label>
            <div className={`${styles.field} ${styles.formGridFull}`}>
              <span className={styles.label}>Attempts{type?.unit ? ` · ${type.unit}` : ''}</span>
              {/* The grid's own boxes: one per attempt, the "+" for the next, up to five (C2). */}
              <div className={grid.attempts}>
                {values.map((v, i) => (
                  <input key={i} className={`${styles.input} ${grid.attempt}`} type="text" inputMode="decimal" placeholder={String(i + 1)}
                    aria-label={`Attempt ${i + 1}${type?.unit ? ` in ${type.unit}` : ''}`} value={v} disabled={!type}
                    onChange={e => { const next = [...values]; next[i] = e.target.value; setValues(next); }} />
                ))}
                {values.length < MAX_ATTEMPTS && (
                  <button type="button" className={grid.attemptPlus} aria-label="One more attempt" disabled={!type} onClick={() => setValues(v => [...v, ''])}>+</button>
                )}
                {headline && <span className={grid.headline}>{headline}</span>}
              </div>
            </div>
            <label className={`${styles.field} ${styles.formGridFull}`}>
              <span className={styles.label}>Note (optional)</span>
              <input className={styles.input} type="text" value={note} maxLength={MAX_READING_NOTE_LEN} placeholder='e.g. "after warm-up, turf"'
                onChange={e => setNote(e.target.value)} />
            </label>
          </div>
          {/* The sentence the Results heading used to carry, beside the fields it describes (E6). */}
          <p className={styles.formHint}>
            {enteredBy && editing ? `Entered by ${enteredBy} · ` : ''}
            Outside a session — it reads exactly as a session’s result would: the best attempt leads, every attempt is kept.
          </p>
          {(localErr || error) && <p className={styles.errorText} role="alert">{localErr || error}</p>}
          <div className={styles.modalFooter}>
            {editing && onRemove && <SheetRemoveButton label="Remove result" busy={busy} onRemove={onRemove} />}
            <button type="button" className={styles.btnSecondary} disabled={busy} onClick={() => void close()}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={busy || !type}>{busy ? 'Saving…' : editing ? 'Save' : 'Save result'}</button>
          </div>
        </form>
      </QuestionShell>
      {/* "+ New test…" — the whole definition, stacked over the sheet (stage 1's precedent). */}
      {defineOpen && (
        <MetricDefinitionSheet orgSlug={orgSlug} teamId={teamId} typeId={null} onClose={() => setDefineOpen(false)} onSaved={typeDefined} />
      )}
    </>
  );
}
