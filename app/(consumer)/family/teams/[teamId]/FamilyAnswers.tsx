'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import styles from './FamilyAnswers.module.css';
import { scheduleDayLabel, scheduleRowTitle, scheduleTimeLabel } from '@/lib/family-schedule-format';
import {
  FAMILY_ANSWER_NOTE_MAX, FAMILY_AVAILABILITY_WORDS as W, type FamilyAnswer,
} from '@/lib/family-availability-words';
import type { FamilyAnswerFields, FamilyAnswerRow, FamilyAnswersView } from '@/lib/family-availability';
import type { FamilyScheduleEntry } from '@/lib/family-view';

/**
 * The parent's In / Out / Maybe (Signed-in family accounts Stage 4b, Part 3; drawing tab 7). The server decided every row
 * (`readFamilyAnswers`: the account's OWN children only); this draws the pill on the schedule row, one line per child when
 * siblings share the team, the started and reminder states, and the sheet. A tap saves; tapping the current answer again clears
 * it. Nothing here can reach another family's answer: the rows hold none.
 */

const CHOICES: { answer: FamilyAnswer; icon: string }[] = [
  { answer: 'in', icon: '✓' },
  { answer: 'out', icon: '⊘' },
  { answer: 'maybe', icon: '?' },
];

const PILL_CLASS: Record<FamilyAnswer, string> = { in: styles.pillIn, out: styles.pillOut, maybe: styles.pillMaybe };

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
        aria-label={W.pillLabel(row.child, scheduleRowTitle(entry, teamName), row.answer)}
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
  const [note, setNote] = useState(row.mine ? row.note ?? '' : '');
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
  function choose(answer: FamilyAnswer) {
    if (choosing.current) return;
    choosing.current = true;
    enqueue(async () => {
      try {
        // Tapping the current answer again clears it (and its note).
        await send(latest().answer === answer ? null : answer, noteNow.current);
      } finally {
        choosing.current = false;
      }
    });
  }

  function saveNote() {
    enqueue(async () => {
      const cur = latest();
      // The note rides with an answer: with none yet it waits in the box for the tap that gives it one.
      if (!cur.answer || noteNow.current.trim() === (cur.mine ? cur.note ?? '' : '').trim()) return;
      await send(cur.answer, noteNow.current);
    });
  }

  async function send(answer: FamilyAnswer | null, withNote: string): Promise<void> {
    setError(null); setStatus(W.sheet.saving);
    try {
      const res = await fetch(`/api/family/teams/${encodeURIComponent(teamId)}/events/${encodeURIComponent(row.eventId)}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: row.childId, answer, note: answer ? withNote : null }),
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

  const otherLine = row.answer && !row.mine && row.dayWords
    ? W.sheet.otherAnswered(row.byFirstName, row.answer, row.dayWords, row.otherHasNote)
    : null;

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
          <button type="button" className={styles.close} onClick={() => ref.current?.close()}>{W.sheet.close}</button>
        </div>

        {otherLine && <p className={styles.soft}>{otherLine}</p>}

        {CHOICES.map(c => {
          const on = row.answer === c.answer;
          return (
            <button
              key={c.answer}
              type="button"
              className={`${styles.choice} ${on ? styles.choiceOn : ''}`}
              aria-pressed={on}
              disabled={!row.open}
              onClick={() => choose(c.answer)}
            >
              <span className={styles.choiceIcon} aria-hidden>{c.icon}</span>
              {W.answer[c.answer]}
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

