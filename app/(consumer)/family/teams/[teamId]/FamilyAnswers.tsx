'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import styles from './FamilyAnswers.module.css';
import { scheduleDayLabel, scheduleRowTitle, scheduleTimeLabel } from '@/lib/family-schedule-format';
import {
  ANSWER_STATUSES, FAMILY_ANSWER_NOTE_MAX, FAMILY_AVAILABILITY_WORDS as W, type AnswerStatus,
} from '@/lib/family-availability-words';
import type { FamilyAnswerFields, FamilyAnswerRow, FamilyAnswersView } from '@/lib/family-availability';
import type { FamilyScheduleEntry } from '@/lib/family-view';

/**
 * The parent's In / Late / Maybe / Out (Signed-in family accounts Stage 4b, Part 3; One attendance record S2, rulings 1 and 4).
 * The server decided every row (`readFamilyAnswers`: the account's OWN children only); this draws the pill on the schedule row, one
 * line per child when siblings share the team, the started and reminder states, and the sheet with who set the answer and when
 * ("Out · Coach, today · earlier: In (You, Nov 1)"). A tap saves; tapping YOUR OWN current answer again clears it (another's — the
 * coach's or the other parent's — stays: a tap on it only agrees). Nothing here can reach another family's answer: the rows hold none.
 */

const ICON: Record<AnswerStatus, string> = { attending: '✓', late: '◷', maybe: '?', absent: '⊘' };

const PILL_CLASS: Record<AnswerStatus, string> = {
  attending: styles.pillIn, late: styles.pillLate, maybe: styles.pillMaybe, absent: styles.pillOut,
};

const keyOf = (r: { eventId: string; childId: string }) => `${r.eventId}|${r.childId}`;

function Pill({ row }: { row: FamilyAnswerRow }) {
  if (!row.open) {
    return <span className={`${styles.pill} ${styles.pillClosed}`}>{row.answer ? W.answer[row.answer] : W.pill.closedNone}</span>;
  }
  if (!row.answer) return <span className={`${styles.pill} ${styles.pillAsk}`}>{W.pill.ask}</span>;
  return <span className={`${styles.pill} ${PILL_CLASS[row.answer]}`}>{W.pill[row.answer]}</span>;
}

export function useFamilyAnswers({ view, teamId, teamName, focusEventId }: {
  view: FamilyAnswersView | null;
  teamId: string;
  teamName: string;
  /** Arriving from a reminder (`?event=`): that event's row is marked and the page opens at it. */
  focusEventId: string | null;
}) {
  const [rows, setRows] = useState<FamilyAnswerRow[]>(view?.rows ?? []);
  const [open, setOpen] = useState<{ key: string; entry: FamilyScheduleEntry } | null>(null);

  const byEvent = useMemo(() => {
    const map = new Map<string, FamilyAnswerRow[]>();
    for (const r of rows) map.set(r.eventId, [...(map.get(r.eventId) ?? []), r]);
    return map;
  }, [rows]);
  const focusable = !!focusEventId && rows.some(r => r.eventId === focusEventId);

  function openSheet(entry: FamilyScheduleEntry, row: FamilyAnswerRow) {
    if (!row.open) return;
    setOpen({ key: keyOf(row), entry });
  }

  // The latest CONFIRMED rows, kept where a save that runs later can read them (state alone is a render behind), and the one queue
  // every save goes through, so the order a parent acted in is the order the server hears it, even across closing and reopening.
  const latestRows = useRef(rows);
  const queue = useRef<Promise<void>>(Promise.resolve());
  // A task that ever rejected must not stop every later save (each task catches today; this keeps it so if one stops).
  const enqueue = (task: () => Promise<void>) => { queue.current = queue.current.then(task).catch(() => undefined); };

  const replaceRow = (next: FamilyAnswerFields) => {
    latestRows.current = latestRows.current.map(r => (keyOf(r) === keyOf(next) ? { ...r, ...next } : r));
    setRows(latestRows.current);
  };

  /** What one schedule entry draws for answers: the pill for its row (one child), the lines under it (two or more), and the
   *  started / reminder lines. Null when the switch doesn't cover the entry. */
  function forEntry(entry: FamilyScheduleEntry) {
    const here = byEvent.get(entry.id) ?? [];
    if (!view || here.length === 0) return null;
    const one = here.length === 1 ? here[0] : null;
    const started = !here[0].open;
    const asked = focusEventId === entry.id ? here.filter(r => r.open && !r.answer).map(r => r.child) : [];

    const hit = (row: FamilyAnswerRow) => (
      <button
        type="button"
        className={styles.hit}
        disabled={!row.open}
        aria-label={W.pillLabel(row.child, scheduleRowTitle(entry, teamName), row.answer, row.setBy)}
        onClick={() => openSheet(entry, row)}
      >
        <Pill row={row} />
      </button>
    );

    return {
      marked: focusEventId === entry.id,
      /** On the row's right, when one child. */
      pill: one ? hit(one) : null,
      /** Under the row: a line per child (siblings), then the started or the reminder line. */
      below: (
        <>
          {!one && here.map(r => (
            <div key={r.childId} className={styles.kid}><b>{r.child}</b>{hit(r)}</div>
          ))}
          {started && <p className={styles.line}>{W.started(entry.eventType !== 'practice')}</p>}
          {asked.length > 0 && <p className={styles.line}>{W.coachAsked(asked)}</p>}
        </>
      ),
    };
  }

  const openRow = open ? rows.find(r => keyOf(r) === open.key) ?? null : null;
  const sheet = open && openRow && view ? (
    <AnswerSheet
      key={open.key}
      row={openRow}
      entry={open.entry}
      teamId={teamId}
      teamName={teamName}
      otherParent={view.otherParent[openRow.childId] ?? null}
      onSaved={replaceRow}
      latest={() => latestRows.current.find(r => keyOf(r) === open.key) ?? openRow}
      enqueue={enqueue}
      onClose={() => setOpen(null)}
    />
  ) : null;

  return { forEntry, sheet, focusable };
}

function AnswerSheet({ row, entry, teamId, teamName, otherParent, onSaved, latest, enqueue, onClose }: {
  row: FamilyAnswerRow;
  entry: FamilyScheduleEntry;
  teamId: string;
  teamName: string;
  otherParent: string | null;
  onSaved: (row: FamilyAnswerFields) => void;
  /** The latest CONFIRMED row for this child and event (the hook's, so it is current even a render behind). */
  latest: () => FamilyAnswerRow;
  /** The hook's one queue: saves reach the server in the order the parent acted. */
  enqueue: (task: () => Promise<void>) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const noteId = useId();
  // The account's OWN note (the row never holds another's), whoever set the answer.
  const [note, setNote] = useState(row.note ?? '');
  // What is in the box right now, readable by a save that runs later.
  const noteNow = useRef(note);
  const choosing = useRef(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  function typeNote(value: string) { noteNow.current = value; setNote(value); }

  // A TAP IS NEVER DROPPED. The note box saves when it loses focus, and a tap on a choice is what takes the focus away: that blur
  // starts a save while the tap is still landing. So nothing is locked; both go on the hook's queue, and each one decides what to
  // send WHEN IT RUNS, from the latest confirmed row (not from a guess made at tap time), so a failed save leaves nothing to
  // roll back and the tap carries whatever the box holds by then. A second choice tap is ignored until the first has answered.
  function choose(answer: AnswerStatus) {
    if (choosing.current) return;
    choosing.current = true;
    enqueue(async () => {
      try {
        // Tapping YOUR current answer again clears it (and its note). The same answer set by the coach or the other parent is
        // agreed with, not cleared: it is sent as it is, so only the note can change (the record keeps who set it).
        const cur = latest();
        // An "agree" with a blank box sends NO note, so it never wipes the note the other parent left (a typed note is sent).
        const agreeing = cur.answer === answer && !cur.mine;
        await send(cur.answer === answer && cur.mine ? null : answer, agreeing && !noteNow.current.trim() ? undefined : noteNow.current);
      } finally {
        choosing.current = false;
      }
    });
  }

  function saveNote() {
    enqueue(async () => {
      const cur = latest();
      // The note rides with an answer: with none yet it waits in the box for the tap that gives it one.
      if (!cur.answer || noteNow.current.trim() === (cur.note ?? '').trim()) return;
      await send(cur.answer, noteNow.current);
    });
  }

  /** `withNote` undefined = leave the family's note as it is (an agree with a blank box); null/'' with an answer clears it. */
  async function send(answer: AnswerStatus | null, withNote: string | undefined): Promise<void> {
    setError(null); setStatus(W.sheet.saving);
    try {
      const res = await fetch(`/api/family/teams/${encodeURIComponent(teamId)}/events/${encodeURIComponent(row.eventId)}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: row.childId, answer, ...(answer === null ? { note: null } : withNote !== undefined ? { note: withNote } : {}) }),
      });
      const data = await res.json().catch(() => ({})) as { row?: FamilyAnswerFields; error?: string };
      if (!res.ok || !data.row) {
        if (data.error === 'closed') onSaved({ ...latest(), open: false });
        throw new Error(data.error ?? 'failed');
      }
      onSaved(data.row);
      if (!answer) typeNote('');
      setStatus(W.sheet.saved);
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error && e.message === 'closed' ? W.sheet.closed : W.sheet.failed);
    }
  }

  // Ruling 4: who set the answer and when, the coach's change included ("Out · Coach, today · earlier: In (You, Nov 1)").
  const setLine = row.answer && row.setBy ? W.setLine(row.answer, row.setBy) : null;

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={e => { if (e.target === ref.current) ref.current?.close(); }}
    >
      <div className={styles.sheetBody}>
        <div className={styles.grab} aria-hidden />
        <div className={styles.sheetHead}>
          <div>
            <h2 id={titleId} className={styles.sheetTitle}>{row.child}</h2>
            <p className={styles.sheetSub}>
              {[scheduleRowTitle(entry, teamName), scheduleDayLabel(entry.startsAt), scheduleTimeLabel(entry.startsAt)].join(' · ')}
            </p>
          </div>
          {/* The portal's × is a plain glyph — no outline, no box (owner ruling 2026-10-07); the word stays as the accessible name. */}
          <button type="button" className={styles.close} aria-label={W.sheet.close} onClick={() => ref.current?.close()}>
            <X size={18} aria-hidden />
          </button>
        </div>

        {setLine && <p className={styles.soft}>{setLine}</p>}
        {row.otherHasNote && <p className={styles.soft}>{W.sheet.otherNote}</p>}

        {ANSWER_STATUSES.map(answer => {
          const on = row.answer === answer;
          return (
            <button
              key={answer}
              type="button"
              className={`${styles.choice} ${on ? styles.choiceOn : ''}`}
              aria-pressed={on}
              disabled={!row.open}
              onClick={() => choose(answer)}
            >
              <span className={styles.choiceIcon} aria-hidden>{ICON[answer]}</span>
              {W.answer[answer]}
              {on && <span className={styles.tick} aria-hidden>✓</span>}
            </button>
          );
        })}

        <label htmlFor={noteId} className={styles.noteLabel}>{W.sheet.noteLabel}</label>
        <input
          id={noteId}
          className={styles.note}
          type="text"
          maxLength={FAMILY_ANSWER_NOTE_MAX}
          placeholder={W.sheet.notePlaceholder}
          value={note}
          disabled={!row.open}
          onChange={e => typeNote(e.target.value)}
          onBlur={saveNote}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
        />

        <p className={styles.hint}>{W.sheet.privacy(row.child, otherParent)}</p>
        <p className={styles.hint}>{W.sheet.tapHint}</p>
        <p className={styles.status} role="status" aria-live="polite">{status}</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
    </dialog>
  );
}

