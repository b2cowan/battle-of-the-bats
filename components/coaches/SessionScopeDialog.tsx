'use client';
import { useMemo, useState } from 'react';
import QuestionShell from '@/components/coaches/QuestionShell';
import { KIND_LABELS, aimSentence } from '@/lib/measurable-definition';
import { formatShortDate, todayLocal } from '@/lib/measurable-format';
import { orderEventsByAnchor } from '@/lib/development-session-view';
import type { RepTeamMeasurableType } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './DevelopmentSession.module.css';

export interface ScopeRosterRow { id: string; playerFirstName: string; playerLastName: string | null; playerNumber: string | null }
export interface ScopeEventOption { id: string; name: string; eventType: string; startsAt: string }

/**
 * The session's SCOPE step (development lifecycle Phase 2, mockup screen 3): what the session is
 * FOR — which metrics (tests AND observed skills) and who is here — so the counts on the Record
 * screen mean something. Two doors, one dialog:
 *   · `mode: 'start'` — "+ Start session" on Skills & Goals asks for the date, "Taken at", a note
 *     and the scope FIRST (was: create instantly, land on an empty grid), then creates the session.
 *   · `mode: 'change'` — "Change scope" on the session; date / event / note stay on the session's
 *     own UNCHANGED controls, so only the two lists are here.
 * Everyone active is pre-ticked (untick the absent); every active metric is pre-ticked. A scope
 * needs at least one of each — the readers and the route say the same.
 */
export default function SessionScopeDialog({
  mode, types, roster, events, initial, busy, error, onSubmit, onClose,
}: {
  mode: 'start' | 'change';
  /** Active definitions only — a retired one cannot be in a new scope. */
  types: RepTeamMeasurableType[];
  roster: ScopeRosterRow[];
  /** The season's events for "Taken at" (start mode only; may be empty). */
  events: ScopeEventOption[];
  initial?: { metricIds: string[]; playerIds: string[] } | null;
  busy: boolean;
  error: string;
  onSubmit: (v: { sessionDate: string; eventId: string | null; note: string; scope: { metricIds: string[]; playerIds: string[] } }) => void;
  onClose: () => void;
}) {
  const activeTypes = useMemo(() => types.filter(t => t.isActive), [types]);
  const [sessionDate, setSessionDate] = useState(todayLocal());
  const [eventId, setEventId] = useState('');
  const [note, setNote] = useState('');
  const [metricIds, setMetricIds] = useState<Set<string>>(() => new Set(initial?.metricIds ?? activeTypes.map(t => t.id)));
  const [playerIds, setPlayerIds] = useState<Set<string>>(() => new Set(initial?.playerIds ?? roster.map(p => p.id)));
  const [localErr, setLocalErr] = useState('');

  const toggle = (set: Set<string>, id: string) => { const next = new Set(set); if (next.has(id)) next.delete(id); else next.add(id); return next; };

  /* The event PRE-FILLS the date and never owns it (§10.2 ruling 1) — the same rule the session's
     own picker follows, applied at the start. Ordered by the ONE rule (§10.2 ruling 2) around the
     chosen date, not the clock, so a re-render never reorders. */
  const eventOptions = useMemo(() => orderEventsByAnchor(events, sessionDate), [events, sessionDate]);
  function chooseEvent(id: string) {
    setEventId(id);
    const ev = events.find(e => e.id === id);
    if (ev) setSessionDate(ev.startsAt.slice(0, 10));
  }

  function submit() {
    if (metricIds.size === 0) { setLocalErr('Choose at least one metric to record.'); return; }
    if (playerIds.size === 0) { setLocalErr('Choose at least one player who is here.'); return; }
    if (mode === 'start' && !sessionDate) { setLocalErr('Pick the session’s date.'); return; }
    setLocalErr('');
    onSubmit({
      sessionDate, eventId: eventId || null, note: note.trim(),
      // In the order they are listed — roster order for players, library order for metrics.
      scope: { metricIds: activeTypes.filter(t => metricIds.has(t.id)).map(t => t.id), playerIds: roster.filter(p => playerIds.has(p.id)).map(p => p.id) },
    });
  }

  const title = mode === 'start' ? 'Choose this session’s scope' : 'Change the session’s scope';
  return (
    <QuestionShell open onClose={onClose} ariaLabel={title} title={title} busy={busy} scroll>
        <div className={`${styles.formBody} ${styles.scrollPane}`}>
          {mode === 'start' && (
            <>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span className={styles.label}>Date</span>
                  <input className={styles.input} type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Taken at (optional)</span>
                  <select className={styles.select} value={eventId} onChange={e => chooseEvent(e.target.value)}>
                    <option value="">Not linked to an event</option>
                    {eventOptions.map(ev => (
                      <option key={ev.id} value={ev.id}>{formatShortDate(ev.startsAt.slice(0, 10))} — {ev.name}</option>
                    ))}
                  </select>
                </label>
                <label className={`${styles.field} ${styles.formGridFull}`}>
                  <span className={styles.label}>Session note (optional)</span>
                  <input className={styles.input} type="text" maxLength={200} value={note} placeholder='e.g. "post-break testing"'
                    onChange={e => setNote(e.target.value)} />
                </label>
              </div>
              <p className={styles.formHint}>As always: the event pre-fills the date and never owns it.</p>
            </>
          )}

          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>What will you record?</h4>
            <ul className={css.pickList}>
              {activeTypes.map(t => (
                <li key={t.id}>
                  <label className={css.pickRow}>
                    <input type="checkbox" checked={metricIds.has(t.id)} onChange={() => setMetricIds(s => toggle(s, t.id))} />
                    <span>{t.name} <small>· {KIND_LABELS[t.kind]}{t.kind === 'test' ? ` · ${aimSentence(t)}` : ''}</small></span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Who is here?</h4>
            <p className={styles.formHint}>Everyone active is selected — untick anyone absent so the counts stay true.</p>
            <div className={css.pickAll}>
              <button type="button" className={css.rowLink} onClick={() => setPlayerIds(new Set(roster.map(p => p.id)))}>Everyone</button>
              <button type="button" className={css.rowLink} onClick={() => setPlayerIds(new Set())}>No one</button>
            </div>
            <ul className={css.pickList}>
              {roster.map(p => (
                <li key={p.id}>
                  <label className={css.pickRow}>
                    <input type="checkbox" checked={playerIds.has(p.id)} onChange={() => setPlayerIds(s => toggle(s, p.id))} />
                    <span>{p.playerNumber && <small>#{p.playerNumber} </small>}{[p.playerFirstName, p.playerLastName].filter(Boolean).join(' ')}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          {(localErr || error) && <p className={styles.errorText} role="alert">{localErr || error}</p>}
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnSecondary} disabled={busy} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.btnPrimary} disabled={busy} onClick={submit}>
            {busy ? 'Saving…' : mode === 'start' ? 'Start recording' : 'Save scope'}
          </button>
        </div>
    </QuestionShell>
  );
}
