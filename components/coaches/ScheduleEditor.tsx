'use client';

import { useState } from 'react';
import { Pencil, Trash2, Plus, X, Check, CalendarDays, Trophy, Dumbbell } from 'lucide-react';
import type { BasicCoachTeamEvent } from '@/lib/basic-coach-schedule';
import CoachEmptyState from './CoachEmptyState';
import FeedbackModal from '@/components/FeedbackModal';
import styles from './ScheduleEditor.module.css';

type Props = {
  basicTeamId: string;
  initialEvents: BasicCoachTeamEvent[];
};

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

// ISO → local "YYYY-MM-DDTHH:mm" for <input type="datetime-local">.
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Add `hours` to a local "YYYY-MM-DDTHH:mm" value, returning the same format (empty in → empty out).
function addHoursToLocalInput(local: string, hours: number): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return '';
  d.setHours(d.getHours() + hours);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Default start for a NEW event: the next top-of-the-hour. Practices/games almost always start
// on the hour, so pre-filling :00 saves the coach clearing the browser picker's current-minute
// default (it opens at "now", e.g. 10:22). They can still adjust freely.
function defaultStartLocal(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0); // next hour, :00:00.000
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatWhen(startsAt: string, endsAt: string | null): string {
  const s = new Date(startsAt);
  if (Number.isNaN(s.getTime())) return '';
  const date = s.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = s.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
  let out = `${date} · ${time}`;
  if (endsAt) {
    const e = new Date(endsAt);
    if (!Number.isNaN(e.getTime())) {
      const endTime = e.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
      // Include the end date when the event spans into another day, so an overnight range isn't misread.
      out += s.toDateString() === e.toDateString()
        ? `–${endTime}`
        : ` – ${e.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })} · ${endTime}`;
    }
  }
  return out;
}

export default function ScheduleEditor({ basicTeamId, initialEvents }: Props) {
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

  return (
    <div className={styles.editor}>
      {error && <p className={styles.error} role="alert">{error}</p>}

      {events.length === 0 && !adding ? (
        <CoachEmptyState
          icon={<CalendarDays size={22} aria-hidden />}
          eyebrow="Schedule"
          headline="Plan your season"
          description="Add your practices and games to keep your whole season in one place."
          primaryAction={{
            label: 'Add event',
            icon: <Plus size={15} aria-hidden />,
            onClick: () => { setEditingId(null); setAdding(true); },
          }}
        />
      ) : (
        <ul className={styles.list}>
          {events.map(ev =>
            editingId === ev.id ? (
              <li key={ev.id} className={styles.formRow}>
                <EventForm
                  event={ev}
                  busy={busy}
                  onCancel={() => setEditingId(null)}
                  onSubmit={input => saveEvent(ev.id, input)}
                />
              </li>
            ) : (
              <li key={ev.id} className={styles.row} data-type={ev.eventType}>
                <span className={styles.typeChip} data-type={ev.eventType} aria-label={TYPE_LABEL[ev.eventType]}>
                  {(() => { const Icon = TYPE_ICON[ev.eventType]; return <Icon size={17} aria-hidden />; })()}
                </span>
                <div className={styles.rowMain}>
                  <span className={styles.name}>
                    {ev.title}
                    {ev.eventType === 'game' && ev.opponent ? <span className={styles.vs}> vs {ev.opponent}</span> : null}
                  </span>
                  <span className={styles.meta}>
                    {formatWhen(ev.startsAt, ev.endsAt)}
                    {ev.location ? ` · ${ev.location}` : ''}
                  </span>
                </div>
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => { setAdding(false); setEditingId(ev.id); }}
                    disabled={locked}
                    aria-label={`Edit ${ev.title}`}
                  >
                    <Pencil size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtnDanger}
                    onClick={() => setConfirmEvent(ev)}
                    disabled={locked}
                    aria-label={`Remove ${ev.title}`}
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {adding ? (
        <div className={styles.formRow}>
          <EventForm busy={busy} onCancel={() => setAdding(false)} onSubmit={addEvent} />
        </div>
      ) : events.length > 0 ? (
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
}: {
  event?: BasicCoachTeamEvent;
  busy: boolean;
  onSubmit: (input: EventInput) => void;
  onCancel: () => void;
}) {
  // New events pre-fill to the next top-of-the-hour (end auto-tracks start + 2h until edited);
  // editing keeps the saved values verbatim.
  const initialStart = event ? isoToLocalInput(event.startsAt) : defaultStartLocal();
  const [form, setForm] = useState<FormState>({
    eventType: event?.eventType ?? 'practice',
    title: event?.title ?? '',
    startsLocal: initialStart,
    endsLocal: event?.endsAt ? isoToLocalInput(event.endsAt) : (event ? '' : addHoursToLocalInput(initialStart, 2)),
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
      if (!endEdited && value) next.endsLocal = addHoursToLocalInput(value, 2);
      return next;
    });
  }

  function handleEndChange(value: string) {
    setEndEdited(true);
    set({ endsLocal: value });
  }

  const titleValid = form.title.trim().length > 0;
  const startValid = form.startsLocal.trim().length > 0;
  const canSave = titleValid && startValid && !busy;

  function submit() {
    if (!canSave) return;
    onSubmit({
      eventType: form.eventType,
      title: form.title.trim(),
      startsAt: new Date(form.startsLocal).toISOString(),
      endsAt: form.endsLocal.trim() ? new Date(form.endsLocal).toISOString() : null,
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

      <p className={styles.formHint}><span className={styles.labelRequired}>*</span> Required</p>

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
        Starts <span className={styles.labelRequired}>*</span>{' '}
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
            placeholder="Location (optional)"
            maxLength={160}
            value={form.location}
            onChange={e => set({ location: e.target.value })}
            aria-label="Location"
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
