'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Trash2, Plus, X, Check, CalendarDays, Trophy, Dumbbell, Lock, ExternalLink } from 'lucide-react';
import type { BasicCoachTeamEvent } from '@/lib/basic-coach-schedule';
import type { CoachScheduleTournamentGame } from '@/lib/basic-coach-teams';
import {
  addHoursToWallInput, basicEventWhen, basicScheduleSortKey, instantToWallInput, nextHourWallInput, wallInputToInstant,
} from '@/lib/basic-coach-schedule-view';
import CoachEmptyState from './CoachEmptyState';
import FeedbackModal from '@/components/FeedbackModal';
import editorRow from './EditorRow.module.css';
import styles from './ScheduleEditor.module.css';

type Props = {
  basicTeamId: string;
  initialEvents: BasicCoachTeamEvent[];
  /** WI-2B: the team's real tournament games, folded in READ-ONLY alongside self-entered events. */
  tournamentGames?: CoachScheduleTournamentGame[];
};

/** A row in the merged Schedule list: a coach's own (editable) event, or a read-only tournament game. */
type ScheduleItem =
  | { kind: 'event'; sortKey: number; event: BasicCoachTeamEvent }
  | { kind: 'tournament'; sortKey: number; game: CoachScheduleTournamentGame };

type EventType = 'practice' | 'game' | 'event';

type EventInput = {
  eventType: EventType;
  title: string;
  startsAt: string; // ISO
  endsAt: string | null;
  location: string | null;
  opponent: string | null;
  notes: string | null;
};

const TYPE_LABEL: Record<EventType, string> = { practice: 'Practice', game: 'Game', event: 'Event' };
// Per-type icon so games / practices / events read differently at a glance (paired with the
// per-type chip colour in CSS): game = Trophy (lime, the marquee event), practice = Dumbbell
// (blue/--info, routine training), event = CalendarDays (neutral catch-all).
const TYPE_ICON: Record<EventType, typeof Trophy> = { practice: Dumbbell, game: Trophy, event: CalendarDays };
const TYPES: EventType[] = ['practice', 'game', 'event'];

function bySoonest(a: BasicCoachTeamEvent, b: BasicCoachTeamEvent) {
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

// ⚠ Every date and time here is the CLUB's clock, never the device's (C6-03, Club Tier Stage 6c, 2026-10-10): the row's
// words, the form's datetime-local values and what a save stores all go through `lib/basic-coach-schedule-view`.

export default function ScheduleEditor({ basicTeamId, initialEvents, tournamentGames = [] }: Props) {
  const [events, setEvents] = useState<BasicCoachTeamEvent[]>([...initialEvents].sort(bySoonest));
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEvent, setConfirmEvent] = useState<BasicCoachTeamEvent | null>(null);

  const base = `/api/coaches/teams/${basicTeamId}/events`;

  async function addEvent(input: EventInput) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not add the event.');
      setEvents(prev => [...prev, data.event as BasicCoachTeamEvent].sort(bySoonest));
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the event.');
    } finally {
      setBusy(false);
    }
  }

  async function saveEvent(eventId: string, input: EventInput) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not update the event.');
      setEvents(prev => prev.map(ev => (ev.id === eventId ? (data.event as BasicCoachTeamEvent) : ev)).sort(bySoonest));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the event.');
    } finally {
      setBusy(false);
    }
  }

  async function removeEvent(eventId: string) {
    setBusy(true);
    setError(null);
    const prev = events;
    setEvents(curr => curr.filter(ev => ev.id !== eventId)); // optimistic
    try {
      const res = await fetch(`${base}/${eventId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not remove the event.');
      }
      if (editingId === eventId) setEditingId(null);
    } catch (e) {
      setEvents(prev); // revert
      setError(e instanceof Error ? e.message : 'Could not remove the event.');
    } finally {
      setBusy(false);
    }
  }

  const locked = adding || editingId !== null;

  // WI-2B: interleave the coach's own (editable) events with the read-only tournament games,
  // time-ordered, so a coach sees one true schedule. Tournament games are never editable.
  const mergedItems: ScheduleItem[] = [
    ...events.map(event => ({ kind: 'event' as const, sortKey: basicScheduleSortKey(event.startsAt), event })),
    ...tournamentGames.map(game => ({ kind: 'tournament' as const, sortKey: basicScheduleSortKey(game.startsAt), game })),
  ].sort((a, b) => a.sortKey - b.sortKey);
  const hasContent = mergedItems.length > 0;

  return (
    <div className={styles.editor}>
      {error && <p className={styles.error} role="alert">{error}</p>}

      {!hasContent && !adding ? (
        <CoachEmptyState
          icon={<CalendarDays size={22} aria-hidden />}
          eyebrow="Schedule"
          headline="Plan your season"
          description="Add your practices and games to keep your whole season in one place. Your tournament games show up here automatically."
          primaryAction={{
            label: 'Add event',
            icon: <Plus size={15} aria-hidden />,
            onClick: () => { setEditingId(null); setAdding(true); },
          }}
        />
      ) : (
        <ul className={styles.list}>
          {mergedItems.map(item => {
            if (item.kind === 'tournament') {
              const game = item.game;
              const inner = (
                <>
                  <span className={styles.typeChip} data-type="tournament" aria-label="Tournament game">
                    <Trophy size={17} aria-hidden />
                  </span>
                  <div className={styles.rowMain}>
                    <span className={styles.tourNameLine}>
                      <span className={styles.tourOpp}>vs {game.opponentName}</span>
                      <span className={styles.tournamentTag}>Tournament</span>
                    </span>
                    <span className={styles.meta}>
                      {[game.dateLabel, game.timeLabel, game.location, game.tournamentName].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    {game.phase === 'live' ? (
                      <span className={styles.liveScore}>
                        <span className={styles.liveDot} aria-hidden />{game.myScore ?? 0}–{game.oppScore ?? 0}
                      </span>
                    ) : game.phase === 'final' ? (
                      <span className={styles.finalScore}>
                        {game.myScore}–{game.oppScore}
                        {game.result && (
                          <span className={`${styles.result} ${styles[`result_${game.result}`]}`}>{game.result[0].toUpperCase()}</span>
                        )}
                      </span>
                    ) : game.href ? (
                      <ExternalLink size={14} className={styles.readonlyIcon} aria-hidden />
                    ) : (
                      <Lock size={13} className={styles.readonlyIcon} aria-label="Read-only — set by the organizer" />
                    )}
                  </div>
                </>
              );
              return (
                <li key={`t-${game.id}`}>
                  {game.href ? (
                    <Link href={game.href} className={`${styles.row} ${styles.tournamentRow} ${styles.tournamentLink}`} title="Open the live game page">
                      {inner}
                    </Link>
                  ) : (
                    <div className={`${styles.row} ${styles.tournamentRow}`}>{inner}</div>
                  )}
                </li>
              );
            }
            const ev = item.event;
            return editingId === ev.id ? (
              <li key={ev.id} className={styles.formRow}>
                <EventForm
                  event={ev}
                  busy={busy}
                  onCancel={() => setEditingId(null)}
                  onSubmit={input => saveEvent(ev.id, input)}
                  onRemove={() => setConfirmEvent(ev)}
                />
              </li>
            ) : (
              // The row is the door (Free coach tap targets Q1 = C, 2026-10-19): one button that opens
              // the event's in-place form; Remove ends that form's body.
              <li key={ev.id} className={`${styles.row} ${styles.doorRow}`} data-type={ev.eventType}>
                <button
                  type="button"
                  className={`${editorRow.rowDoor} ${styles.rowDoor}`}
                  onClick={() => { setAdding(false); setEditingId(ev.id); }}
                  disabled={locked}
                >
                  {/* The row's own words are the door's name (a label would hide the when and where from
                      a screen reader); the type chip is a picture, so the name says the type. */}
                  <span className="sr-only">Edit {TYPE_LABEL[ev.eventType].toLowerCase()}: </span>
                  <span className={styles.typeChip} data-type={ev.eventType} aria-hidden>
                    {(() => { const Icon = TYPE_ICON[ev.eventType]; return <Icon size={17} aria-hidden />; })()}
                  </span>
                  <span className={styles.rowMain}>
                    <span className={styles.name}>
                      {ev.title}
                      {ev.eventType === 'game' && ev.opponent ? <span className={styles.vs}> vs {ev.opponent}</span> : null}
                    </span>
                    <span className={styles.meta}>
                      {basicEventWhen(ev.startsAt, ev.endsAt)}
                      {ev.location ? ` · ${ev.location}` : ''}
                    </span>
                  </span>
                  <ChevronRight size={16} className={editorRow.rowChevron} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <div className={styles.formRow}>
          <EventForm busy={busy} onCancel={() => setAdding(false)} onSubmit={addEvent} />
        </div>
      ) : hasContent ? (
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => { setEditingId(null); setAdding(true); }}
          disabled={editingId !== null}
        >
          <Plus size={15} aria-hidden /> Add event
        </button>
      ) : null}

      <FeedbackModal
        isOpen={confirmEvent !== null}
        onClose={() => setConfirmEvent(null)}
        onConfirm={() => { if (confirmEvent) removeEvent(confirmEvent.id); }}
        title="Remove this event?"
        message={confirmEvent
          ? `"${confirmEvent.title}" will be removed from your schedule. This can't be undone.`
          : ''}
        confirmText="Remove event"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}

type FormState = {
  eventType: EventType;
  title: string;
  startsLocal: string;
  endsLocal: string;
  location: string;
  opponent: string;
  notes: string;
};

function EventForm({
  event,
  busy,
  onSubmit,
  onCancel,
  onRemove,
}: {
  event?: BasicCoachTeamEvent;
  busy: boolean;
  onSubmit: (input: EventInput) => void;
  onCancel: () => void;
  /** An existing event's way off the schedule — it ends the form's body, above Cancel · Save. */
  onRemove?: () => void;
}) {
  // New events pre-fill to the next top-of-the-hour (end auto-tracks start + 2h until edited);
  // editing keeps the saved values verbatim.
  const initialStart = event ? instantToWallInput(event.startsAt) : nextHourWallInput();
  const [form, setForm] = useState<FormState>({
    eventType: event?.eventType ?? 'practice',
    title: event?.title ?? '',
    startsLocal: initialStart,
    endsLocal: event?.endsAt ? instantToWallInput(event.endsAt) : (event ? '' : addHoursToWallInput(initialStart, 2)),
    location: event?.location ?? '',
    opponent: event?.opponent ?? '',
    notes: event?.notes ?? '',
  });
  const [showDetails, setShowDetails] = useState(
    !!(event?.location || event?.opponent || event?.notes),
  );
  // Whether the user has hand-edited the end time. Until they do, the end auto-tracks start + 2h
  // (a sensible default duration). Existing events are treated as user-owned so changing the start
  // never clobbers a saved end.
  const [endEdited, setEndEdited] = useState<boolean>(!!event);

  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  function handleStartChange(value: string) {
    setForm(f => {
      const next = { ...f, startsLocal: value };
      if (!endEdited && value) next.endsLocal = addHoursToWallInput(value, 2);
      return next;
    });
  }

  function handleEndChange(value: string) {
    setEndEdited(true);
    set({ endsLocal: value });
  }

  const titleValid = form.title.trim().length > 0;
  // What the coach typed is the CLUB's wall clock (C6-03); a value that isn't one can't be saved. A time the coach
  // left as it opened saves back the STORED instant, not a re-read of the wall clock: on the night the clocks fall
  // back, 1:30 a.m. happens twice, and re-reading it would move an event an hour when only its title changed.
  const startsAt = event && form.startsLocal === initialStart ? event.startsAt : wallInputToInstant(form.startsLocal);
  const endTyped = form.endsLocal.trim() !== '';
  const endsAt = !endTyped ? null
    : event?.endsAt && form.endsLocal === instantToWallInput(event.endsAt) ? event.endsAt
      : wallInputToInstant(form.endsLocal);
  const canSave = titleValid && startsAt !== null && (!endTyped || endsAt !== null) && !busy;

  function submit() {
    if (!canSave || !startsAt) return;
    onSubmit({
      eventType: form.eventType,
      title: form.title.trim(),
      startsAt,
      endsAt,
      location: form.location.trim() || null,
      opponent: form.eventType === 'game' ? form.opponent.trim() || null : null,
      notes: form.notes.trim() || null,
    });
  }

  return (
    <div className={styles.form}>
      <div className={styles.segmented} role="group" aria-label="Event type">
        {TYPES.map(t => (
          <button
            key={t}
            type="button"
            className={styles.segmentBtn}
            data-active={form.eventType === t}
            aria-pressed={form.eventType === t}
            onClick={() => set({ eventType: t })}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <input
        className={styles.input}
        placeholder={form.eventType === 'game' ? 'Game title (e.g. League game)' : 'Title (e.g. Practice)'}
        maxLength={120}
        autoFocus
        value={form.title}
        onChange={e => set({ title: e.target.value })}
        aria-label="Event title"
      />

      <label className={styles.fieldLabel}>
        Starts *{' '}
        <input
          className={styles.input}
          type="datetime-local"
          value={form.startsLocal}
          onChange={e => handleStartChange(e.target.value)}
          aria-label="Start date and time"
        />
      </label>

      <label className={styles.fieldLabel}>
        Ends{' '}
        <input
          className={styles.input}
          type="datetime-local"
          value={form.endsLocal}
          min={form.startsLocal || undefined}
          onChange={e => handleEndChange(e.target.value)}
          aria-label="End date and time"
        />
      </label>

      {showDetails ? (
        <div className={styles.panel}>
          <input
            className={styles.input}
            placeholder="Venue (optional)"
            maxLength={160}
            value={form.location}
            onChange={e => set({ location: e.target.value })}
            aria-label="Venue"
          />
          {form.eventType === 'game' && (
            <input
              className={styles.input}
              placeholder="Opponent (optional)"
              maxLength={120}
              value={form.opponent}
              onChange={e => set({ opponent: e.target.value })}
              aria-label="Opponent"
            />
          )}
          <textarea
            className={styles.textarea}
            placeholder="Note for the team (optional)"
            maxLength={500}
            rows={2}
            value={form.notes}
            onChange={e => set({ notes: e.target.value })}
            aria-label="Note"
          />
        </div>
      ) : (
        <button type="button" className={styles.panelToggle} onClick={() => setShowDetails(true)}>
          <Plus size={13} aria-hidden /> Add location / details (optional)
        </button>
      )}

      {onRemove && (
        <button type="button" className={editorRow.recordLink} onClick={onRemove} disabled={busy}>
          <Trash2 size={13} aria-hidden /> Remove event
        </button>
      )}

      <div className={styles.formActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={busy}>
          <X size={14} aria-hidden /> Cancel
        </button>
        <button type="button" className={styles.saveBtn} onClick={submit} disabled={!canSave}>
          <Check size={14} aria-hidden /> {busy ? 'Saving…' : event ? 'Save' : 'Add event'}
        </button>
      </div>
    </div>
  );
}
