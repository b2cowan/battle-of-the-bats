'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { EVENT_COLORS } from '@/components/coaches/eventTypeMark';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import QuestionShell from '@/components/coaches/QuestionShell';
import ArrivalSelect from '@/components/coaches/ArrivalSelect';
import PlaceSheet from '@/components/coaches/PlaceSheet';
import ManagePlacesSheet from '@/components/coaches/ManagePlacesSheet';
import WhereField, { WhereLine } from '@/components/venue/WhereField';
import { useClashCheck, readFindingsPerDate, countFindings } from '@/components/venue/useClashCheck';
import OpponentCombobox from '@/components/coaches/OpponentCombobox';
import CoachFormDisclosure from '@/components/coaches/CoachFormDisclosure';
import TagSearchCombobox, { GAME_TAG_MANAGE } from '@/components/coaches/TagSearchCombobox';
import { useDiscardGuard, snapshotEqual } from '@/components/coaches/useDiscardGuard';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { formatStoredClock as fmtClock, pluralize } from '@/lib/utils';
import { fieldNounFor } from '@/lib/sports';
import { pickPlace, whereBody, whereOf, type WhereValue } from '@/lib/where-field';
import { clashLine, seriesDateMark, seriesSummary, NOT_CHECKED_LINE } from '@/lib/venue-clash-words';
import type { SeriesScope } from '@/lib/coach-series-scope';
import { sessionTitle } from '@/lib/development-session-view';
import { isValidResourceUrl, MAX_EVENT_RESOURCES } from '@/lib/rep-event-resources';
import type { ClubPickerSpelling } from '@/lib/coach-opponent-picker';
import type { OpponentBookEntry } from '@/lib/coach-opponents';
import { arrivalAfterStartChange, arrivalClockFor } from '@/lib/coach-arrival';
import { isMirroredEvent } from '@/lib/coach-tournament-games';
import { utcToZonedInputs } from '@/lib/timezone';
import {
  EVENT_LABELS, EVENT_NAME_PREFIX, HOME_AWAY_CHOICES,
  needsOpponent, needsRecurrence, deriveGameName, isAutoShapedName, eventWord,
} from '@/lib/coach-schedule-vocab';
import { generateWeeklyOccurrences, type RecurrenceOccurrenceInput } from '@/lib/coach-recurrence';
import { DAYS_OF_WEEK, dayStr, errorMessage, fmtDate, fmtTime, shortDate } from '@/lib/coach-schedule-view';
import type { ClubVenueOption, RepEventResource, RepEventType, RepTeamEvent, RepTeamPlace, RepTeamTag } from '@/lib/types';

/**
 * THE SCHEDULE'S ADD / EDIT FORM — the QuestionShell form every "Add Event" door and every sheet's
 * "Edit details" opens. Moved out of the schedule page, unchanged, by the Schedule deep dive's split
 * (stage 1 · S6, owner ruling 2026-09-25 — "split first, a pure move"). It owns its own typing, its
 * Save and its discard question; the page opens it with a seeded form (`seedAddForm` /
 * `seedEditForm`) and hears back when it closes, so the page can return the coach to the game the
 * form was opened from.
 */

/** Add hours to a `datetime-local` string ("YYYY-MM-DDThh:mm"), returning the same format. */
export function addHoursLocal(dtLocal: string, hours: number): string {
  const d = new Date(dtLocal);
  if (Number.isNaN(d.getTime())) return '';
  d.setHours(d.getHours() + hours);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Default start time for a brand-new event: the viewed day at 6:00 PM (round, :00 minutes). */
export const DEFAULT_EVENT_HOUR = '18:00';

/**
 * A one-off event asks the date ONCE — Date · Start time · End time — the same shape the repeating
 * branch always had (owner ruling 2026-09-21, the event-form consistency pass). `startsAt` /
 * `endsAt` stay canonical: the save, the guards, the tournament prefill and the mirrored facts all
 * read them unchanged. The three visible pieces are the form's EXISTING `startDate` / `startTime`
 * / `endTime` (the repeat branch's own), seeded from the datetimes here wherever the form is built,
 * and recomposed by `setWhen` on every edit — so a native input's clear button empties one piece
 * and Save greys, without the other pieces vanishing from the screen.
 * ⚠ Known limit, accepted: an end on the NEXT day (23:00–01:00) is recomposed same-day when edited.
 * Youth-team events do not cross midnight; the repeat branch already assumed same-day.
 */
function withWhenPieces(f: EventForm): EventForm {
  return { ...f, startDate: f.startsAt.slice(0, 10), startTime: f.startsAt.slice(11, 16), endTime: f.endsAt.slice(11, 16) };
}
function composeWhen(f: EventForm): EventForm {
  return {
    ...f,
    startsAt: f.startDate && f.startTime ? `${f.startDate}T${f.startTime}` : '',
    endsAt: f.startDate && f.endTime ? `${f.startDate}T${f.endTime}` : '',
  };
}

export interface EventForm {
  eventType: RepEventType;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  locationAddress: string;
  /** The place the location was picked from (mig 307); null for free text. */
  placeId: string | null;
  /** The club's venue and facility (mig 319, Club Tier Stage 6a); never set with placeId. */
  orgVenueId: string | null;
  orgVenueFacilityId: string | null;
  arrivalTime: string;
  fieldNumber: string;
  uniform: string;
  resources: RepEventResource[];
  opponent: string;
  homeAway: string;
  /** "This is a scrimmage" — a Game only; cleared when the kind changes away from Game. */
  isScrimmage: boolean;
  tagIds: string[];
  parentEventId: string;
  isRecurring: boolean;
  dayOfWeek: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

const BLANK_FORM: EventForm = {
  eventType: 'practice',
  name: '',
  description: '',
  startsAt: '',
  endsAt: '',
  location: '',
  locationAddress: '',
  placeId: null,
  orgVenueId: null,
  orgVenueFacilityId: null,
  arrivalTime: '',
  fieldNumber: '',
  uniform: '',
  resources: [],
  opponent: '',
  homeAway: '',
  isScrimmage: false,
  tagIds: [],
  parentEventId: '',
  isRecurring: false,
  dayOfWeek: '1',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
};

// Per-type placeholder hints for the resource-link rows.
function resourceHint(type: RepEventType): { label: string; url: string } {
  switch (type) {
    case 'external_tournament': return { label: 'e.g. Tournament rules', url: 'https://… rules or schedule' };
    case 'practice':            return { label: 'e.g. Drill video', url: 'https://youtube.com/…' };
    case 'team_event':          return { label: 'e.g. Event flyer', url: 'https://…' };
    default:                    return needsOpponent(type)
      ? { label: 'e.g. Field map', url: 'https://maps.google.com/…' }
      : { label: 'e.g. Rules', url: 'https://…' };
  }
}

/** Form inputs → the wall-clock string the API takes. The server resolves it to a real instant in
 *  the ORG'S zone (C0), so the client never has to know the offset. */
function isoFromInputs(date: string, time: string) {
  return `${date}T${time}`;
}

/**
 * A stored instant → a `datetime-local` input value, IN THE ORG'S ZONE.
 *
 * The exact inverse of the write path, and that pairing is what makes the round trip stable: open
 * an event, change nothing, save, and the time is identical. Before C0 this converted to the
 * DEVICE'S zone while the write treated the same string as the org's — so every re-save shifted
 * the event by another offset, compounding each time.
 */
function toLocalInput(iso: string | null | undefined): string {
  const { date, time } = utcToZonedInputs(iso);
  return date ? `${date}T${time}` : '';
}

function eventToForm(e: RepTeamEvent): EventForm {
  return {
    ...BLANK_FORM,
    eventType: e.eventType,
    name: e.name ?? '',
    description: e.description ?? '',
    startsAt: toLocalInput(e.startsAt),
    endsAt: toLocalInput(e.endsAt),
    location: e.location ?? '',
    locationAddress: e.locationAddress ?? '',
    placeId: e.placeId ?? null,
    orgVenueId: e.orgVenueId ?? null,
    orgVenueFacilityId: e.orgVenueFacilityId ?? null,
    arrivalTime: e.arrivalTime ?? '',
    fieldNumber: e.fieldNumber ?? '',
    uniform: e.uniform ?? '',
    resources: (e.resources ?? []).map(r => ({ ...r })),
    opponent: e.opponent ?? '',
    homeAway: e.homeAway ?? '',
    isScrimmage: e.isScrimmage,
    parentEventId: e.parentEventId ?? '',
    isRecurring: false, // edit a single occurrence's details; recurrence isn't re-editable here
  };
}

/**
 * The Add form for a kind, seeded. Pre-seeds a sensible start (the viewed day at 6:00 PM, :00
 * minutes) and a 2-hour end, so the native time picker never defaults to the current minute and
 * "Ends" starts populated. Games default to "Home" so the printout "@/vs" and the win/loss side are
 * never left blank. `overrides` (e.g. a tournament game-slot's parent + name) are folded into the
 * seed, so a pre-seeded form doesn't read as "unsaved" before the coach touches anything.
 */
export function seedAddForm(
  type: RepEventType,
  { cursorDate, arrivalDefaults, overrides }: {
    cursorDate: string;
    arrivalDefaults: { game: number | null; practice: number | null };
    overrides?: Partial<EventForm>;
  },
): EventForm {
  const defaultStart = `${cursorDate}T${DEFAULT_EVENT_HOUR}`;
  const seeded = withWhenPieces({
    ...BLANK_FORM,
    eventType: type,
    homeAway: needsOpponent(type) ? 'home' : '',
    startsAt: defaultStart,
    endsAt: addHoursLocal(defaultStart, 2),
    ...overrides,
  });
  // The team's arrival habit (mig 307, D2): a new game or practice STARTS at the team default,
  // measured from the seeded start. The event's own arrivalTime is the record from here on —
  // changing the default later moves nothing already on the calendar.
  const lead = needsOpponent(type) ? arrivalDefaults.game : type === 'practice' ? arrivalDefaults.practice : null;
  return seeded.arrivalTime || !lead
    ? seeded
    : { ...seeded, arrivalTime: arrivalClockFor(seeded.startTime, lead) ?? '' };
}

/** The Edit form for an event, seeded from what it holds. */
export function seedEditForm(event: RepTeamEvent, tagIds: string[]): EventForm {
  const f = { ...eventToForm(event), tagIds };
  // A name the PRODUCT wrote ("vs Brampton Gold", or a pre-306 "Scrimmage vs …") opens as the
  // blank-with-placeholder it was born as, so changing the opponent or the side re-derives it on
  // save (D2). A name the coach typed is loaded as typed and never touched. Not on a mirrored
  // game — the organizer owns that name and the form never sends it.
  if (!isMirroredEvent(event) && isAutoShapedName(event.name, event.eventType, event.opponent, event.homeAway)) f.name = '';
  // A practice needs an end (stage 1, D9). A practice from before that rule opens with its end
  // pre-filled two hours on — the same seed the Add form gives — so a coach changing the
  // location is not held at a greyed Save for a field they never touched; the seed is on
  // screen, editable, and part of what they save (/review, 2026-09-14).
  if (event.eventType === 'practice' && !f.endsAt && f.startsAt) f.endsAt = addHoursLocal(f.startsAt, 2);
  return withWhenPieces(f);
}

/** What the page opens the form with. `editing` is null on an Add. */
export interface ScheduleFormInit {
  form: EventForm;
  editing: {
    eventId: string;
    /** Batch 4: an organizer-owned mirrored tournament game — the restricted form. */
    mirrored: boolean;
    /**
     * Which dates of a repeating event the edit reaches — chosen at the pencil, BEFORE the form opens (owner ruling
     * 2026-10-09). 'one' on a one-off. It replaced the "Apply your changes to:" chooser Save used to open, which came
     * after the coach had edited a form that checked one date for clashes and offered a Date box a series edit ignores.
     */
    scope: SeriesScope;
    /** The days (YYYY-MM-DD, in order) a This & future / All edit changes; empty for 'one'. */
    scopeDates: string[];
  } | null;
}

export default function ScheduleEventForm({
  orgSlug, teamId, sport, init, events, places, clubVenues, usualFacilityByVenue, teamTags, onTagCreated,
  bookEntries, clubSpellings, loadBook, refresh, onCancel, onCreated, onUpdated,
}: {
  orgSlug: string;
  teamId: string;
  /** The team's sport id — the facility's word (Diamond, Court, Field). */
  sport: string;
  init: ScheduleFormInit;
  events: RepTeamEvent[];
  places: RepTeamPlace[];
  /** The club's venues (Club Tier Stage 6a, Ask 1): read-only, above the team's places — only in a club with a library. */
  clubVenues: { inClub: boolean; venues: ClubVenueOption[] };
  /** The facility this team used last at each club venue (the dropdown's opening pick). */
  usualFacilityByVenue: Record<string, string>;
  teamTags: RepTeamTag[];
  onTagCreated: (tag: RepTeamTag) => void;
  bookEntries: OpponentBookEntry[];
  clubSpellings: ClubPickerSpelling[];
  loadBook: () => void;
  /** The page's refetch — resolves with the refreshed events. */
  refresh: () => Promise<RepTeamEvent[] | undefined>;
  /** Cancel, Escape or Back on an untouched (or discarded) form. */
  onCancel: () => void;
  /** An Add saved. */
  onCreated: () => Promise<void>;
  /** An Edit saved — handed the refreshed events, so the page reopens the game from the new record. */
  onUpdated: (refreshed: RepTeamEvent[]) => void;
}) {
  const confirm = useConfirm();
  const editingEventId = init.editing?.eventId ?? null;
  // A This & future / All edit of a repeating event: the dates it changes are a list (each keeps its own day), every
  // one is checked for clashes, and Save names how many it saves. Chosen at the pencil (owner ruling 2026-10-09).
  const editScope: SeriesScope = init.editing?.scope ?? 'one';
  const scopeDates = init.editing?.scopeDates ?? [];
  const seriesEdit = scopeDates.length > 0;
  /** Batch 4: the event being edited is an organizer-owned mirrored tournament game. */
  const editingMirrored = init.editing?.mirrored ?? false;
  const [form, setForm] = useState<EventForm>(init.form);
  /** ONE structured baseline for the whole event form — the fields AND the recurrence preview's
   *  per-date edits. One mapping per form, per the Chunk A discard-guard contract. */
  const [formBaseline] = useState<unknown>(() => ({ form: init.form, occurrenceOpponents: {}, removed: [] }));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [tagError, setTagError] = useState('');

  // Tag ids on the open form that still exist in the library — recomputed on every render (not
  // synced into state) so a Tag Manager delete/merge while the form is open can never leave a
  // selected chip silently pointing at a vanished tag, without a setState-in-effect anti-pattern.
  const validFormTagIds = form.tagIds.filter(id => teamTags.some(t => t.id === id));

  // Change the event type inside the form without losing shared fields: reset only the
  // type-specific bits (opponent/home-away, recurrence). The name is left alone (it auto-names
  // from the opponent at save time if the coach left it blank).
  function changeEventType(next: RepEventType) {
    setForm(f => {
      const out: EventForm = { ...f, eventType: next };
      if (!needsOpponent(next)) { out.opponent = ''; out.homeAway = ''; out.uniform = ''; out.tagIds = []; }
      else if (!out.homeAway) { out.homeAway = 'home'; }
      // The box belongs to a Game only (D3) — a tournament game is scored by its organizer.
      if (next !== 'league_game') { out.isScrimmage = false; }
      if (!needsRecurrence(next)) { out.isRecurring = false; }
      if (next !== 'tournament_game') { out.parentEventId = ''; }
      return out;
    });
  }

  // Attach a new tournament game to a parent tournament. Pre-fills the game's date to the
  // tournament's start day (keeping any time the coach already set) so a game-slot lands inside
  // its tournament's span instead of on today's date.
  function selectParentTournament(id: string) {
    setForm(f => {
      if (!id) return { ...f, parentEventId: '' };
      const t = events.find(e => e.id === id);
      const next: EventForm = { ...f, parentEventId: id };
      // Re-seed the Date · Start · End pieces only when the date actually moved — a tournament
      // with no start date leaves whatever the coach has typed alone (/review 2026-09-21: a
      // cleared piece empties the datetime, and re-seeding from it would blank the other piece).
      if (t?.startsAt) {
        const time = f.startsAt.slice(11, 16) || DEFAULT_EVENT_HOUR;
        next.startsAt = `${dayStr(t.startsAt)}T${time}`;
        next.endsAt = addHoursLocal(next.startsAt, 2);
        return withWhenPieces(next);
      }
      return next;
    });
  }

  // Resource-link row editing.
  function addResource() {
    setForm(f => f.resources.length >= MAX_EVENT_RESOURCES ? f : { ...f, resources: [...f.resources, { type: 'link', label: '', url: '' }] });
  }
  function updateResource(index: number, patch: Partial<RepEventResource>) {
    setForm(f => ({ ...f, resources: f.resources.map((r, i) => i === index ? { ...r, ...patch } : r) }));
  }
  function removeResource(index: number) {
    setForm(f => ({ ...f, resources: f.resources.filter((_, i) => i !== index) }));
  }

  // ── Game tags (autocomplete-or-create) ───────────────────────────────────────

  /** POST a new game tag into the library — the combobox applies it to the form itself. */
  async function createGameTag(name: string): Promise<RepTeamTag | null> {
    setTagError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not create tag');
      }
      const { tag } = await res.json();
      onTagCreated(tag);
      return tag as RepTeamTag;
    } catch (e: unknown) {
      setTagError(errorMessage(e, 'Could not create tag'));
      return null;
    }
  }

  /** Name to persist: the coach's text, or a friendly default so a blank name never blocks a save. */
  function eventNameForSave(f: EventForm): string {
    return f.name.trim() || deriveGameName(f.eventType, f.opponent, f.homeAway) || EVENT_NAME_PREFIX[f.eventType];
  }

  // A piece changes, both datetimes recompose — from BOTH branches. The repeat branch's First date /
  // Start time / End time are the same three fields, so they write through here too; a coach who
  // ticks Repeat weekly, edits, and unticks it must see and save the same time (/review 2026-09-21
  // — the branch used to write the pieces directly and the one-off save read the stale datetime).
  // One-off only: changing the start keeps the end 2 hours later, unless the coach has set a custom
  // end (the rule the old Starts picker carried). A series never auto-fills its end.
  function setWhen(patch: Partial<Pick<EventForm, 'startDate' | 'startTime' | 'endTime'>>) {
    setForm(f => {
      const next = composeWhen({ ...f, ...patch });
      // Arrival as a lead time (D1): a PRESET arrival moves with the start; a specific time stays.
      if ('startTime' in patch) next.arrivalTime = arrivalAfterStartChange(f.startTime, next.startTime, f.arrivalTime);
      const series = needsRecurrence(f.eventType) && f.isRecurring;
      if (!series && !('endTime' in patch) && next.startsAt) {
        const prevAutoEnd = f.startsAt ? addHoursLocal(f.startsAt, 2) : '';
        const endIsAuto = f.endsAt === '' || f.endsAt === prevAutoEnd;
        if (endIsAuto) {
          const auto = addHoursLocal(next.startsAt, 2);
          return { ...next, endsAt: auto, endTime: auto.slice(11, 16) };
        }
      }
      return next;
    });
  }

  // Event-form view helpers (drive the per-type sections + the Save guard).
  const recurringSeries = needsRecurrence(form.eventType) && form.isRecurring;

  // ── Recurrence preview (Chunk C, P1 #6) ─────────────────────────────────────
  // "Repeat weekly" used to take ONE opponent and stamp it onto every game it created, so a
  // 12-game round robin was MORE work through the feature than without it. The fix is not a
  // twelfth opponent field — it is showing the occurrences before any of them exist. The dates
  // come from the shared generator the commit route also runs, so the two can never disagree.
  const recurrenceDates = useMemo(
    () => (recurringSeries
      ? generateWeeklyOccurrences({
          dayOfWeek: Number(form.dayOfWeek),
          startDate: form.startDate,
          endDate: form.endDate,
        })
      : []),
    [recurringSeries, form.dayOfWeek, form.startDate, form.endDate],
  );
  /** Per-date opponent, keyed by date. A date absent from `removedDates` is committed. */
  const [occurrenceOpponents, setOccurrenceOpponents] = useState<Record<string, string>>({});
  const [removedDates, setRemovedDates] = useState<Set<string>>(new Set());
  const keptDates = recurrenceDates.filter(d => !removedDates.has(d));
  const recurrenceIsGame = needsOpponent(form.eventType);

  // The dirty baseline covers the occurrence edits too — nine typed opponents and a deleted bye
  // week are exactly the work the discard guard exists to protect (Chunk A rule 4).
  const formSnapshot = { form, occurrenceOpponents, removed: [...removedDates].sort() };
  const formDirty = !snapshotEqual(formSnapshot, formBaseline);
  // Tournament-game attachment: the active (non-cancelled) tournaments a new game can hang under.
  const tournamentOptions = events
    .filter(e => e.eventType === 'external_tournament' && e.status !== 'cancelled')
    .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
  // ⚰ `recentLocations` (→ 2026-09-21): the Recent chips under Location, derived from past events.
  // They carried the address of the MOST RECENT event with that name — usually nothing — and never
  // the diamond. The place book (mig 307) is the list now, most recently used first, in the picker.
  // ⚰ `formPlace` and the "Diamond 2 is Lions Park's usual" hint under More (→ 2026-10-08, Club Tier Stage 6a): the
  // facility sits beside Venue now, and a place's usual diamond fills that box when it is picked.
  const addingTournamentGame = form.eventType === 'tournament_game' && !editingEventId;
  // Block saving an orphaned game slot: a new tournament game must have a parent. (A parent set
  // via the in-detail "+ Add game" shortcut counts even if its tournament is cancelled and so
  // absent from the picker, so this keys off the actual parent, not the options list.)
  const tournamentParentMissing = addingTournamentGame && !form.parentEventId;
  // A series with every date removed has nothing to write — the button must not offer to add 0.
  const formHasStart = recurringSeries
    ? Boolean(form.startTime && form.startDate && form.endDate && keptDates.length)
    : Boolean(form.startsAt);
  /**
   * A PRACTICE needs an end time (practices re-evaluation stage 1, owner ruling D9, 2026-09-14):
   * the plan page's first line, its unplanned-time figure and the hub's "60 of 90 min" are all
   * built on it. Games are untouched. An end at or before the start is not an end — the plan page
   * would read "no end set" on a practice that has one — so it is refused here, in words, rather
   * than saved and discovered on the sheet.
   */
  // Both branches show the same End time field, so "missing" reads that piece; "before the start"
  // compares the composed datetimes on a one-off (an end can sit on the next day) and only when
  // both exist — a cleared Date empties both and must not read as an end before its start.
  const practiceEndMissing = form.eventType === 'practice' && !form.endTime;
  const practiceEndBeforeStart = form.eventType === 'practice' && !practiceEndMissing
    && (recurringSeries
      ? form.endTime <= form.startTime
      : Boolean(form.startsAt && form.endsAt) && form.endsAt <= form.startsAt);
  const practiceEndInvalid = practiceEndMissing || practiceEndBeforeStart;
  // A resource row blocks save only if it has content but is incomplete/has a bad URL; fully-empty
  // rows are fine (dropped on save).
  const resourcesInvalid = form.resources.some(r => {
    const has = r.label.trim() || r.url.trim();
    return has && (!r.label.trim() || !isValidResourceUrl(r.url));
  });
  const recurrenceNoun = EVENT_LABELS[form.eventType].toLowerCase();

  // ── WHERE (Club Tier Stage 6a, Ask 13 with Asks 1, 2 and 5) ─────────────────────────────────────────────
  // Venue, then the facility under the sport's word: the club's venues above the team's own places (in a club),
  // typed words below. The form keeps its flat fields (the save, the guards and the seeds read them); the field
  // reads and writes them as one value.
  const where = whereOf(form);
  const setWhere = (next: WhereValue) => setForm(f => ({
    ...f,
    location: next.location, locationAddress: next.locationAddress, fieldNumber: next.fieldNumber,
    placeId: next.placeId, orgVenueId: next.orgVenueId, orgVenueFacilityId: next.orgVenueFacilityId,
  }));
  // The place book's doors (mig 307, D4–D7) — the field offers them; the form opens the sheets. The book is re-read
  // when the list opens (the picker's rule), so a place added in another tab is there.
  const placesPath = `/api/coaches/${orgSlug}/teams/${teamId}/places`;
  const [freshPlaces, setFreshPlaces] = useState<RepTeamPlace[] | null>(null);
  const [addingPlace, setAddingPlace] = useState<string | null>(null);
  const [managingPlaces, setManagingPlaces] = useState(false);
  const placeBook = freshPlaces ?? places;
  async function refreshPlaces() {
    try {
      const res = await fetch(placesPath);
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.places)) setFreshPlaces(data.places as RepTeamPlace[]);
    } catch { /* offline — the host copy keeps the picker usable */ }
  }

  // The dates a list shows under the times: Add's kept repeat-weekly dates, or the dates a series EDIT changes.
  const listDates = recurringSeries ? keptDates : seriesEdit ? scopeDates : null;
  // The live check (Ask 5): as soon as the dates, the times and one of the club's venues are set — one date, or
  // every kept date of a series, or every date a series EDIT changes — and again on any change. A coach's own place or
  // typed words are never compared.
  const checkOccurrences: { startsAt: string; endsAt: string }[] =
    editingMirrored || form.eventType === 'external_tournament' || where.source !== 'club'
      ? []
      : listDates
        ? (form.startTime ? listDates.map(d => ({ startsAt: `${d}T${form.startTime}`, endsAt: form.endTime ? `${d}T${form.endTime}` : '' })) : [])
        : (form.startsAt ? [{ startsAt: form.startsAt, endsAt: form.endsAt }] : []);
  // Save asks again first (`lineIsCurrent`, the hook's one rule): a booking made since the line was read shows as the
  // line and the form stays open on it; a second press saves anyway. (The server checks a third time after the write.)
  const { result: clashResults, lineIsCurrent } = useClashCheck(
    checkOccurrences.length ? {
      path: `/api/coaches/${orgSlug}/teams/${teamId}/venue-clashes`,
      body: { orgVenueId: where.orgVenueId, orgVenueFacilityId: where.orgVenueFacilityId, occurrences: checkOccurrences },
    } : null,
    readFindingsPerDate,
    countFindings,
  );
  const lineCtx = { sport, venueName: where.location, facilityName: where.orgVenueFacilityId ? where.fieldNumber : null };
  let whereLine: ReactNode = null;
  const said = clashResults && countFindings(clashResults)
    ? (recurringSeries
        ? seriesSummary(clashResults, lineCtx)
        : scopeDates.length > 1
          ? seriesSummary(clashResults, lineCtx, scopeDates)
          : clashLine(clashResults[0] ?? [], lineCtx))
    : null;
  if (said) {
    whereLine = <WhereLine tone={said.tone} lead={said.lead} rest={said.rest} />;
  } else if (clubVenues.inClub && where.source === 'place') {
    // The third state, the one a coach could miss (Ask 3): said in place, never silence.
    whereLine = <WhereLine tone="quiet" rest={NOT_CHECKED_LINE} />;
  }
  // A series marks each clashing date in the list the coach already reviews ("Diamond 2 · 14U AA practice, …") — the
  // list Add shows, and the one a series edit shows of the dates it changes.
  const markByDate = new Map<string, string>();
  if (listDates && clashResults) {
    listDates.forEach((d, i) => { const f = clashResults[i]; if (f?.length) markByDate.set(d, seriesDateMark(f, lineCtx)); });
  }

  // Drives the "More — …" disclosure (Batch 2, P0 #8; relabelled 2026-09-21). `hasEventDetails` is read on
  // mount only, so editing an event that already carries any of these opens the group; the summary
  // keeps a collapsed group honest about what's inside — especially a link error that blocks Save.
  // The legacy Address box (D8): only on an older event that holds an address and neither a place nor a club venue.
  const legacyAddress = !editingMirrored && !form.placeId && !form.orgVenueId && form.locationAddress.trim() !== '';
  const eventDetailCount = [
    // The facility sits beside Venue now (Ask 13) — More keeps it only on a mirrored game, whose venue is the organizer's.
    editingMirrored ? form.fieldNumber.trim() : '', legacyAddress ? form.locationAddress.trim() : '', form.uniform.trim(),
    form.name.trim(), form.description.trim(),
  ].filter(Boolean).length + (form.tagIds.length ? 1 : 0) + (form.resources.length ? 1 : 0);
  const hasEventDetails = eventDetailCount > 0;
  const eventDetailsSummary = resourcesInvalid
    ? 'Links need fixing'
    : eventDetailCount > 0 ? `${eventDetailCount} set` : undefined;

  // Chunk C (C5): the guard was hand-rolled with the one phrase the discard-guard contract bans
  // ("You have unsaved changes to this event"). It now runs on the shared primitive with copy that
  // NAMES what is at stake — "9 opponents and a removed date" is judgeable in a second, one-handed,
  // which "unsaved changes" never is.
  const typedOpponentCount = keptDates.filter(d => (occurrenceOpponents[d] ?? '').trim()).length;
  const discardDetail = recurringSeries && recurrenceDates.length
    ? [
        `${keptDates.length} ${EVENT_LABELS[form.eventType].toLowerCase()}${keptDates.length === 1 ? '' : 's'}`,
        typedOpponentCount ? `${typedOpponentCount} opponent${typedOpponentCount === 1 ? '' : 's'}` : '',
        removedDates.size ? `${removedDates.size} removed date${removedDates.size === 1 ? '' : 's'}` : '',
      ].filter(Boolean).join(', ')
    : undefined;

  const requestDiscardForm = useDiscardGuard({
    dirty: formDirty,
    close: onCancel,
    noun: editingEventId ? 'change' : EVENT_LABELS[form.eventType].toLowerCase(),
    detail: discardDetail,
  });

  // scope 'one' = just this occurrence; 'remaining' = this + future; 'all' = the whole series.
  async function handleUpdate(scope: SeriesScope) {
    if (!editingEventId) return;
    setSaveError('');
    setSaving(true);
    try {
      if (!(await lineIsCurrent())) return;
      // Batch 4: on a MIRRORED tournament game only the coach-owned fields are sent. The route
      // rejects an organizer-owned field with a 409 (and the next sync would overwrite it anyway),
      // so sending the whole form would fail a save whose visible fields were all legitimate.
      const coachOwned = {
        description: form.description.trim() || null,
        arrivalTime: form.arrivalTime || null,
        fieldNumber: form.fieldNumber.trim() || null,
        uniform: form.uniform.trim() || null,
        resources: form.resources,
        tagIds: needsOpponent(form.eventType) ? validFormTagIds : undefined,
      };
      const payload = editingMirrored ? coachOwned : {
        ...coachOwned,
        name: eventNameForSave(form),
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        // Where: a club venue (its links — the server copies the club's own words), a place, or typed words.
        ...whereBody(where),
        opponent: form.opponent.trim() || null,
        homeAway: form.homeAway || null,
        isScrimmage: form.eventType === 'league_game' && form.isScrimmage,
      };
      const send = (extra: Record<string, unknown> = {}) => fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${editingEventId}?scope=${scope}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, ...extra }),
      });
      let res = await send();
      if (res.status === 409) {
        // A session was recorded at this practice (development re-evaluation stage 2, C10): moving the
        // practice's day moves the session and every attempt in it — the route says so with the
        // count, the coach confirms with it in front of them, and the save goes again with the answer.
        const d = await res.json().catch(() => null) as { error?: string; linkedSessions?: { note: string | null; sessionDate: string; attemptCount: number }[] } | null;
        if (!d?.linkedSessions?.length) throw new Error(d?.error ?? 'Save failed');
        const lines = d.linkedSessions.map(s => `${sessionTitle(s)} (${s.attemptCount} attempt${s.attemptCount === 1 ? '' : 's'})`);
        const ok = await confirm({
          title: d.linkedSessions.length === 1 ? 'Move the session too?' : 'Move the sessions too?',
          message: `${d.linkedSessions.length === 1 ? 'A session was recorded at this practice' : `${d.linkedSessions.length} sessions were recorded at this practice`}: ${lines.join(' · ')}. Moving the practice moves ${d.linkedSessions.length === 1 ? 'it' : 'them'} to the new day, and every attempt with ${d.linkedSessions.length === 1 ? 'it' : 'them'}.`,
          confirmText: 'Move the practice and the session',
          cancelText: 'Keep the date',
          tone: 'warning',
        });
        if (!ok) return;
        res = await send({ moveSessions: true });
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Save failed');
      }
      // Back on the game, showing what was just saved — the refreshed record, never the stale one.
      // ⚠ The refetch comes FIRST, so the form's close and the sheet's reopen land in ONE commit
      // (the same hand-off Cancel makes): the sheet takes the form's history entry over. Closing
      // before the await left the form's entry standing with nothing on screen for the length of
      // the refetch, and its deferred consumption then popped it under the coach (/review,
      // 2026-09-21). The form stays up, busy, until the calendar is back.
      const refreshed = (await refresh()) ?? [];
      onUpdated(refreshed);
    } catch (e: unknown) {
      setSaveError(errorMessage(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (editingEventId) {
      // The dates were chosen at the pencil (owner ruling 2026-10-09): one press saves exactly those.
      return handleUpdate(editScope);
    }
    setSaveError('');
    setSaving(true);
    try {
      if (!(await lineIsCurrent())) return;
      const body: Record<string, unknown> = {
        eventType: form.eventType,
        name: eventNameForSave(form),
        description: form.description.trim() || null,
        // Where (Club Tier Stage 6a): a club venue's links, a place, or typed words — never both a place and a venue.
        ...whereBody(where),
        arrivalTime: form.arrivalTime || null,
        uniform: form.uniform.trim() || null,
        resources: form.resources,
        opponent: form.opponent.trim() || null,
        homeAway: form.homeAway || null,
        isScrimmage: form.eventType === 'league_game' && form.isScrimmage,
        parentEventId: form.parentEventId || null,
      };
      // Tags apply to a specific one-off game only — never sent on a recurring series create
      // (a coach tags an occurrence later, from its own edit form).
      if (needsOpponent(form.eventType) && !(needsRecurrence(form.eventType) && form.isRecurring)) {
        body.tagIds = validFormTagIds;
      }

      if (needsRecurrence(form.eventType) && form.isRecurring) {
        body.isRecurring = true;
        body.recurrenceRule = {
          dayOfWeek: Number(form.dayOfWeek),
          startDate: form.startDate,
          endDate: form.endDate,
          startTime: form.startTime,
          endTime: form.endTime || null,
        };
        // Chunk C (P1 #6): send the rows the coach actually reviewed — each with its own opponent,
        // and without any date they removed. The route regenerates from the same rule and refuses
        // a date it can't produce, so a stale client can never write an unreviewed occurrence.
        body.occurrences = keptDates.map<RecurrenceOccurrenceInput>(date => ({
          date,
          opponent: recurrenceIsGame ? (occurrenceOpponents[date]?.trim() || null) : null,
          homeAway: recurrenceIsGame ? (form.homeAway || null) : null,
        }));
      } else {
        if (!form.startsAt || (!form.isRecurring && form.eventType === 'practice' && !form.startTime)) {
          const d = form.startDate || form.startsAt?.slice(0, 10);
          const t = form.startTime || form.startsAt?.slice(11, 16);
          body.startsAt = d && t ? isoFromInputs(d, t) : form.startsAt;
        } else {
          body.startsAt = form.startsAt;
        }
        body.endsAt = form.endsAt || null;
      }

      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Save failed');
      }
      await onCreated();
    } catch (e: unknown) {
      setSaveError(errorMessage(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  // The dates under the times, as rows (Chunk C, P1 #6) — Add's repeat-weekly preview, BEFORE any of them exist (a date
  // can be removed; a game takes its opponent per date: a recurring series and an imported file are the same shape, a
  // set of events reviewed before commit), and a series EDIT's dates (owner ruling 2026-10-09: read-only, since an
  // edit never removes a date — Delete does). Each date is marked when the place is taken that night (Club Tier
  // Stage 6a, Ask 5).
  const listRows = recurringSeries ? recurrenceDates : scopeDates;
  const dateList = listRows.length > 0 ? (
    <div className={styles.occList}>
      <div className={styles.occHead}>
        <p className={styles.occCount}>
          {recurringSeries
            ? pluralize(keptDates.length, recurrenceNoun)
            : `${pluralize(scopeDates.length, eventWord(form))} · ${editScope === 'all' ? 'All' : 'This & future'}`}
        </p>
        <p className={styles.formHint}>
          {seriesEdit
            ? 'Each keeps its own date. Nothing is saved until you tap Save.'
            : recurrenceIsGame
              ? 'Add an opponent to each. Nothing is saved until you tap Add.'
              : 'Nothing is saved until you tap Add.'}
        </p>
      </div>
      {listRows.map(date => {
        const removed = removedDates.has(date);
        const mark = removed ? undefined : markByDate.get(date);
        return (
          <div key={date} className={styles.occRow} data-removed={removed || undefined}>
            <span className={styles.occDate}>{shortDate(date)}</span>
            {removed ? (
              <span className={styles.occRemoved}>Removed</span>
            ) : recurringSeries && recurrenceIsGame ? (
              <span className={styles.occCol}>
                <input
                  className={styles.input}
                  placeholder="Opponent"
                  aria-label={`Opponent on ${shortDate(date)}`}
                  value={occurrenceOpponents[date] ?? ''}
                  onChange={e => setOccurrenceOpponents(o => ({ ...o, [date]: e.target.value }))}
                />
                {mark && <span className={styles.occMark}>{mark}</span>}
              </span>
            ) : mark ? (
              <span className={`${styles.occPlain} ${styles.occMark}`}>{mark}</span>
            ) : (
              <span className={styles.occPlain}>{fmtClock(form.startTime) || '—'}</span>
            )}
            {recurringSeries && (
              <button
                type="button"
                className={styles.occAction}
                aria-label={removed ? `Put ${shortDate(date)} back` : `Remove ${shortDate(date)}`}
                onClick={() => setRemovedDates(prev => {
                  const next = new Set(prev);
                  if (removed) next.delete(date); else next.add(date);
                  return next;
                })}
              >
                {removed ? '↩' : '✕'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <>
      {/* Warn before leaving with an unsaved event. */}
      <UnsavedChangesGuard active={formDirty} />
      {/* Stands in QuestionShell since the consistency pass (owner ruling 2026-09-21): the dialog
          floor (role, label, Escape, the Tab trap, focus restore), the shared overlay (a full-screen
          sheet ≤640 with no opt-in) and the busy-gated close all come from the shell — this form was
          the last hand-built modal on the portal, which is how it drifted a private width and a pill
          radius nothing else wore. ⚠ NO EVENT-TYPE PICKER IN HERE. Every door already chose the type
          (the Add Event menu, the practice hub's ?add=practice, a tournament's game slot); the title
          carries it with the type's colour dot, and a wrong pick is Cancel + pick again. `changeEventType`
          survives for the one in-form hop that remains ("Create a tournament first"). */}
      <QuestionShell
        open
        wide
        busy={saving}
        onClose={() => { void requestDiscardForm(); }}
        ariaLabel={`${editingEventId ? 'Edit' : 'Add'} ${EVENT_LABELS[form.eventType]}`}
        title={
          <span className={styles.modalTitleMark}>
            {editingEventId ? 'Edit' : 'Add'} {EVENT_LABELS[form.eventType]}
            <span className={styles.eventTypeDot} style={{ background: EVENT_COLORS[form.eventType] }} aria-hidden />
          </span>
        }
      >
          <div className={`${styles.formBody} ${styles.formBodyTight}`}>

            {/* TOURNAMENT — a tournament game must belong to a tournament, so a coach can't
                create an orphaned, parent-less game slot. */}
            {addingTournamentGame && (
              <section className={styles.formSection}>
                {/* WI-2B: real FieldLogicHQ tournament games now appear on the schedule on their own,
                    so this hand-entered slot is for a tournament run somewhere else. */}
                <p className={styles.formHint} style={{ marginTop: 0 }}>
                  Games from a FieldLogicHQ tournament show up on your schedule automatically — add one
                  here only for a tournament run somewhere else.
                </p>
                {tournamentOptions.length === 0 ? (
                  <div className={styles.field}>
                    <p className={styles.formHint}>
                      A tournament game belongs to a tournament, and you haven&apos;t added one yet.
                    </p>
                    <button type="button" className={styles.btnSecondary} onClick={() => changeEventType('external_tournament')}>
                      Create a tournament first
                    </button>
                  </div>
                ) : (
                  <div className={styles.field}>
                    <label className={styles.label}>Which tournament? *</label>
                    <select className={styles.select} value={form.parentEventId} onChange={e => selectParentTournament(e.target.value)}>
                      <option value="">Select a tournament…</option>
                      {tournamentOptions.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name}{t.startsAt ? ` (${shortDate(dayStr(t.startsAt))})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className={styles.formHint}>The game shows under this tournament&apos;s days — never as a loose slot.</p>
                  </div>
                )}
              </section>
            )}

            {/* Editing an existing tournament game: show which tournament it belongs to. */}
            {form.eventType === 'tournament_game' && editingEventId && !editingMirrored && (
              <section className={styles.formSection}>
                <p className={styles.formHint}>
                  Part of {events.find(e => e.id === form.parentEventId)?.name ?? 'a tournament'}.
                </p>
              </section>
            )}

            {/* Batch 4 — RESTRICTED MODE for a mirrored tournament game. The organizer's facts
                render as context, never as fields: a coach must not be able to make their own
                calendar disagree with the tournament they're playing in, and the next sync would
                overwrite an edit anyway. Arrival time sits here (not in the details fold) because
                it is THE thing a coach sets on a tournament game. */}
            {editingMirrored ? (
              <>
                <section className={styles.formSection}>
                  <h4 className={styles.formSectionTitle}>From the organizer</h4>
                  <p className={styles.formHint} style={{ marginTop: 0 }}>
                    Time, opponent and venue come from {form.name || 'the tournament'} and update themselves.
                  </p>
                  <dl className={styles.sourceFacts}>
                    <div><dt>When</dt><dd>{form.startsAt ? `${fmtDate(form.startsAt)} · ${fmtTime(form.startsAt)}` : 'To be scheduled'}</dd></div>
                    {form.opponent && (
                      <div><dt>Opponent</dt><dd>{form.opponent}{form.homeAway ? ` (${form.homeAway})` : ''}</dd></div>
                    )}
                    {form.location && <div><dt>Where</dt><dd>{form.location}</dd></div>}
                  </dl>
                </section>
                <section className={styles.formSection}>
                  <h4 className={styles.formSectionTitle}>Your game-day plan</h4>
                  <ArrivalSelect startTime={form.startTime} value={form.arrivalTime} onChange={v => setForm(f => ({ ...f, arrivalTime: v }))} />
                </section>
              </>
            ) : (
            <>
            {/* WHEN — no heading: the labels beneath say it (the consistency pass flattened the
                When / Where / Who boxes and dropped the words that repeated their own fields). */}
            <section className={styles.formSection}>
              {/* Repeat-weekly lives here (above the date layout), NOT inside a branch — toggling it
                  flips `recurringSeries`, which swaps the date layout below; keeping the checkbox in
                  one stable slot means it never remounts (no lost focus) as that swap happens. */}
              {needsRecurrence(form.eventType) && !editingEventId && (
                <label className={styles.formCheck}>
                  <input type="checkbox" checked={form.isRecurring} onChange={e => setForm(f => ({ ...f, isRecurring: e.target.checked }))} />
                  <span>Repeat weekly</span>
                </label>
              )}
              {form.eventType === 'external_tournament' ? (
                <div className={styles.formSectionGrid}>
                  <div className={styles.field}>
                    <label className={styles.label}>Start date *</label>
                    <input className={styles.input} type="date" value={form.startsAt.slice(0, 10)} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value ? `${e.target.value}T00:00` : '' }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>End date</label>
                    <input className={styles.input} type="date" value={form.endsAt.slice(0, 10)} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value ? `${e.target.value}T00:00` : '' }))} />
                  </div>
                </div>
              ) : recurringSeries ? (
                <>
                  <div className={styles.formSectionGrid}>
                    <div className={styles.field}>
                      <label className={styles.label}>Day of week</label>
                      <select className={styles.select} value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))}>
                        {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Start time *</label>
                      <input className={styles.input} type="time" value={form.startTime} onChange={e => setWhen({ startTime: e.target.value })} />
                    </div>
                    <div className={styles.field}>
                      {/* A practice needs an end (stage 1, D9) — every occurrence carries this one. */}
                      <label className={styles.label}>End time{form.eventType === 'practice' ? ' *' : ''}</label>
                      <input className={styles.input} type="time" value={form.endTime} onChange={e => setWhen({ endTime: e.target.value })} />
                      {/* Say why Save is grey, both ways — a bare asterisk is not a reason. */}
                      {practiceEndMissing && (
                        <p className={styles.formHint} role="alert">A practice needs an end time.</p>
                      )}
                      {practiceEndBeforeStart && (
                        <p className={styles.formHint} role="alert">The end needs to be after the start.</p>
                      )}
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>First date *</label>
                      <input className={styles.input} type="date" value={form.startDate} onChange={e => setWhen({ startDate: e.target.value })} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Last date *</label>
                      <input className={styles.input} type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                    </div>
                  </div>
                  <ArrivalSelect startTime={form.startTime} value={form.arrivalTime} onChange={v => setForm(f => ({ ...f, arrivalTime: v }))} />
                  {dateList}
                </>
              ) : (
                <>
                  {/* The date ONCE (owner, 2026-09-21) — Date · Start time · End time, the shape the
                      repeat branch above already asks in. Two datetime pickers had the coach type
                      the same date twice. See `withWhenPieces` / `setWhen` for how the pieces and
                      the canonical datetimes stay in step.
                      A SERIES edit has no Date box (owner ruling 2026-10-09): each date keeps its own day — the series
                      write takes only the time — so the box could never move them. Its dates are the list below. */}
                  <div className={seriesEdit ? styles.formTimesGrid : styles.formSectionGrid3}>
                    {!seriesEdit && (
                      <div className={styles.field}>
                        <label className={styles.label}>Date *</label>
                        <input className={styles.input} type="date" value={form.startDate} onChange={e => setWhen({ startDate: e.target.value })} />
                      </div>
                    )}
                    <div className={styles.field}>
                      <label className={styles.label}>Start time *</label>
                      <input className={styles.input} type="time" value={form.startTime} onChange={e => setWhen({ startTime: e.target.value })} />
                    </div>
                    <div className={styles.field}>
                      {/* A practice needs an end (stage 1, D9) — the plan is built against it. */}
                      <label className={styles.label}>End time{form.eventType === 'practice' ? ' *' : ''}</label>
                      <input className={styles.input} type="time" value={form.endTime} onChange={e => setWhen({ endTime: e.target.value })} />
                      {/* Say why Save is grey, both ways — a bare asterisk is not a reason. */}
                      {practiceEndMissing && (
                        <p className={styles.formHint} role="alert">A practice needs an end time.</p>
                      )}
                      {practiceEndBeforeStart && (
                        <p className={styles.formHint} role="alert">The end needs to be after the start.</p>
                      )}
                    </div>
                  </div>
                  <ArrivalSelect startTime={form.startTime} value={form.arrivalTime} onChange={v => setForm(f => ({ ...f, arrivalTime: v }))} />
                  {dateList}
                </>
              )}
            </section>

            {/* WHERE — one way to say where, on every form (Club Tier Stage 6a, Ask 13): Venue, then the facility
                under the sport's word, on one row; the clash line under them, before Save. The place book's door
                (mig 307, D4) lives in the Venue list's foot. ⚰ "Location" and the "Field / Diamond #" box under
                More (→ 2026-10-08): one word, Venue, and the facility beside it. */}
            <section className={styles.formSection}>
              <WhereField
                idPrefix="event"
                sport={sport}
                value={where}
                onChange={setWhere}
                clubVenues={clubVenues.venues}
                inClub={clubVenues.inClub}
                places={placeBook}
                usualFacilityByVenue={usualFacilityByVenue}
                onOpen={() => { void refreshPlaces(); }}
                onAddPlace={name => setAddingPlace(name)}
                onManagePlaces={() => setManagingPlaces(true)}
                classes={{ field: styles.field, label: styles.label, input: styles.input, select: styles.select, hint: styles.formHint }}
                line={whereLine}
              />
              {addingPlace !== null && (
                <PlaceSheet
                  basePath={placesPath}
                  sport={sport}
                  initialName={addingPlace}
                  onClose={() => setAddingPlace(null)}
                  onSaved={place => {
                    setAddingPlace(null);
                    setFreshPlaces(prev => (prev && !prev.some(p => p.id === place.id) ? [...prev, place] : prev));
                    setWhere(pickPlace(where, place));
                    void refresh();
                  }}
                />
              )}
              {managingPlaces && (
                <ManagePlacesSheet
                  basePath={placesPath}
                  sport={sport}
                  places={placeBook}
                  onClose={() => setManagingPlaces(false)}
                  onChanged={moved => { void refreshPlaces(); void refresh(); if (moved) setSaveError(''); }}
                />
              )}
            </section>

            {/* WHO — games only */}
            {needsOpponent(form.eventType) && (
              <section className={styles.formSection}>
                <div className={styles.formSectionGrid}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="event-opponent">Opponent</label>
                    {/* The book's door (Opponent Picker D1–D5, 2026-09-21): type to find an opponent the team has
                        met, pick to take the book's SPELLING — the game still holds a name and nothing else. */}
                    <OpponentCombobox
                      value={form.opponent}
                      onChange={text => setForm(f => ({ ...f, opponent: text }))}
                      entries={bookEntries}
                      clubSpellings={clubSpellings}
                      onOpen={loadBook}
                    />
                  </div>
                  <div className={styles.field}>
                    {/* A one-value form field is a dropdown (owner convention 2026-08-22) — this was
                        the portal's last segmented row inside a form. */}
                    <label className={styles.label} htmlFor="event-home-away">Home / Away</label>
                    <select id="event-home-away" className={styles.select} value={form.homeAway} onChange={e => setForm(f => ({ ...f, homeAway: e.target.value }))}>
                      {/* An imported game can hold no side (a blank Home/Away cell). Without this row the
                          browser paints "Home" over an empty value — the old segmented control showed
                          nothing selected, and so does this (/review 2026-09-21). */}
                      {!form.homeAway && <option value="">—</option>}
                      {HOME_AWAY_CHOICES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <p className={styles.formHint}>Sets your dugout printout (&ldquo;@&rdquo; vs &ldquo;vs&rdquo;) and which side your win/loss counts on.</p>
                {/* "This is a scrimmage" — ONE line, the same shape as Repeat weekly, no hint under it
                    (owner, 2026-09-20: "this is a scrimmage is enough"). A Game only (D3); on add and
                    on edit, before or after a result; what it means lives in the help article. */}
                {form.eventType === 'league_game' && (
                  <label className={styles.formCheck}>
                    <input type="checkbox" checked={form.isScrimmage} onChange={e => setForm(f => ({ ...f, isScrimmage: e.target.checked }))} />
                    <span>This is a scrimmage</span>
                  </label>
                )}
              </section>
            )}
            </>
            )}

            {/* EVERYTHING OPTIONAL — one disclosure instead of four always-open sections
                (Batch 2, P0 #8). Children stay mounted while collapsed, so link validation still
                runs and `resourcesInvalid` still blocks Save; the toggle's summary says so, since
                a disabled Save with no visible reason is worse than a longer form. `defaultOpen`
                is mount-only, so editing an event that already carries any of these opens the
                group once and never fights the coach's own toggle afterwards. */}
            <CoachFormDisclosure
              label={editingMirrored
                ? `More — ${fieldNounFor(sport).toLowerCase()}, uniform, tags, links, notes`
                : needsOpponent(form.eventType) ? 'More — uniform, tags, links, notes' : 'More — links, notes'}
              title="More"
              meta={eventDetailsSummary}
              defaultOpen={hasEventDetails}
            >
              {(editingMirrored || needsOpponent(form.eventType)) && (
                <div className={styles.formSectionGrid}>
                  {/* A mirrored game's venue is the organizer's, so its WHERE row isn't on this form; the coach can
                      still note which facility the team is on, under the sport's own word. */}
                  {editingMirrored && (
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="event-facility-note">{fieldNounFor(sport)}</label>
                      <input
                        id="event-facility-note"
                        className={styles.input}
                        value={form.fieldNumber}
                        maxLength={40}
                        onChange={e => setForm(f => ({ ...f, fieldNumber: e.target.value }))}
                        placeholder={`e.g. ${fieldNounFor(sport)} 2`}
                      />
                    </div>
                  )}
                  {needsOpponent(form.eventType) && (
                    <div className={styles.field}>
                      <label className={styles.label}>Uniform</label>
                      <input
                        className={styles.input}
                        value={form.uniform}
                        onChange={e => setForm(f => ({ ...f, uniform: e.target.value }))}
                        placeholder="e.g. Home whites"
                      />
                    </div>
                  )}
                </div>
              )}
              {/* Address LEFT this form (D8): a place or a club venue carries it. The one case it still shows is
                  an event from before the book that holds an address and neither — read it, edit it, or pick a
                  venue or place and let it carry the address from now on. Never on a mirrored game. */}
              {legacyAddress && (
                <div className={styles.field}>
                  <label className={styles.label}>Address</label>
                  <input
                    className={styles.input}
                    value={form.locationAddress}
                    onChange={e => setForm(f => ({ ...f, locationAddress: e.target.value }))}
                  />
                  <p className={styles.formHint}>From before places — pick a venue or add a place above and it carries the address from now on.</p>
                </div>
              )}
              {/* TAGS — a coach's own vocabulary ("Rivalry", "Top in the province"); games only.
                  One Tag Idiom P2 (2026-09-01): the hand-rolled toggle-chip picker became the
                  shared combobox every money form uses — one picker, one grammar — and the text
                  link retired for the door INSIDE the picker (owner ruling: doors live where
                  minting lives). That also ends the door-gating defect (a link shown for
                  org-only teams, opening an empty manager) and this screen's use of the
                  colliding `.tagChip` toggle pill. Pays off later in Season Review's "vs tag"
                  report. */}
              {needsOpponent(form.eventType) && (
                <section className={styles.formSubGroup}>
                  <h4 className={styles.formSectionTitle}>Tags</h4>
                  <TagSearchCombobox
                    library={teamTags}
                    selectedIds={validFormTagIds}
                    onChange={ids => setForm(f => ({ ...f, tagIds: ids }))}
                    onCreate={createGameTag}
                    manage={{
                      teamId,
                      basePath: `/api/coaches/${orgSlug}/teams/${teamId}/tags`,
                      ...GAME_TAG_MANAGE,
                      countNoun: n => `on ${n} game${n === 1 ? '' : 's'}`,
                    }}
                    onManageChanged={() => { void refresh(); }}
                  />
                  {tagError && <p className={styles.errorText}>{tagError}</p>}
                </section>
              )}

              {/* LINKS / RESOURCES — labelled URLs (drill video, rules, field map, flyer). */}
              <section className={styles.formSubGroup}>
                <h4 className={styles.formSectionTitle}>Links</h4>
                {form.resources.length === 0 && (
                  <p className={styles.formHint}>Attach labelled links — a drill video, rules page, field map, or doc. They open in a new tab.</p>
                )}
                {form.resources.map((r, i) => {
                  const hint = resourceHint(form.eventType);
                  const badUrl = r.url.trim() !== '' && !isValidResourceUrl(r.url);
                  return (
                    <div key={i} className={styles.resourceRow}>
                      <input
                        className={styles.input}
                        value={r.label}
                        onChange={e => updateResource(i, { label: e.target.value })}
                        placeholder={hint.label}
                        maxLength={120}
                        aria-label="Link label"
                      />
                      <input
                        className={styles.input}
                        style={badUrl ? { borderColor: 'var(--danger)' } : undefined}
                        value={r.url}
                        onChange={e => updateResource(i, { url: e.target.value })}
                        placeholder={hint.url}
                        inputMode="url"
                        aria-label="Link URL"
                      />
                      <button type="button" className={styles.resourceRemove} onClick={() => removeResource(i)} aria-label="Remove link">
                        <X size={15} />
                      </button>
                    </div>
                  );
                })}
                {resourcesInvalid && <p className={styles.errorText}>Each link needs a label and a valid web address (http/https).</p>}
                {form.resources.length < MAX_EVENT_RESOURCES ? (
                  <button type="button" className={styles.btnSecondary} onClick={addResource}>+ Add link</button>
                ) : (
                  <p className={styles.formHint}>Up to {MAX_EVENT_RESOURCES} links per event.</p>
                )}
              </section>

              {/* NAME — demoted from the headline: games (and the rest) auto-name from their
                  type + opponent, so a custom label is an optional override, not a title field.
                  A mirrored game is named for its tournament and keeps that name. */}
              {!editingMirrored && (
                <div className={styles.field}>
                  <label className={styles.label}>Name</label>
                  <input
                    className={styles.input}
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={needsOpponent(form.eventType)
                      ? `Auto: ${deriveGameName(form.eventType, form.opponent || 'opponent', form.homeAway)}`
                      : `Auto: ${EVENT_NAME_PREFIX[form.eventType]}`}
                  />
                  <p className={styles.formHint}>
                    {needsOpponent(form.eventType)
                      ? 'Leave blank to name it from the opponent (e.g. “vs Lady Jays”, or “@ Lady Jays” away).'
                      : 'Leave blank to use the default name.'}
                  </p>
                </div>
              )}

              {/* NOTES */}
              <div className={styles.field}>
                <label className={styles.label}>Notes</label>
                <textarea className={styles.textarea} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Anything the team should know" />
              </div>
            </CoachFormDisclosure>
          </div>

          {saveError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{saveError}</p>}

          {/* ⚰ "Apply your changes to: This event only · This & future · All events" (→ 2026-10-09): the question moved to the
              pencil, before the form opens, so the form knows the dates it checks. Save saves them in one press. */}
          <div className={styles.modalFooter}>
            <button className={styles.btnGhost} onClick={requestDiscardForm}>Cancel</button>
            <button
              className={styles.btnPrimary}
              disabled={saving || !formHasStart || tournamentParentMissing || resourcesInvalid || practiceEndInvalid}
              onClick={handleSave}
            >
              {saving
                ? 'Saving…'
                : editingEventId
                  // A series edit names how many it saves, as Add does ("Save 2 practices").
                  ? seriesEdit ? `Save ${pluralize(scopeDates.length, eventWord(form))}` : 'Save changes'
                  // Name the real count: a removed bye week means eleven, not twelve.
                  : recurringSeries && keptDates.length
                    ? `Add ${keptDates.length} ${recurrenceNoun}${keptDates.length === 1 ? '' : 's'}`
                    // The title's verb, in the portal's sentence case: "Add game", "Add practice".
                    : `Add ${recurrenceNoun}`}
            </button>
          </div>
      </QuestionShell>
    </>
  );
}
