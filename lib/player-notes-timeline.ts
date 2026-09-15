/**
 * The player's Notes timeline — ONE read over four sources (roster + player page review, hub F20,
 * owner rulings 2026-09-13).
 *
 * A coach writes about a player in four places, each where it belongs: a one-line MOMENT from the
 * bench on game day, a skill OBSERVATION and a goal REVIEW on Skills & Goals, and — new with this
 * pass — a general NOTE that fits none of the others. The Notes tab is where they are READ
 * together: newest first, grouped by month, every entry marked with its source and the staff
 * member who wrote it. Nothing is written twice; this module never writes.
 *
 * Framework-free and pure so it can be unit-tested with hand-built rows (the repo's convention for
 * anything that decides ORDER — see `sortMomentsNewestFirst`'s history).
 */
import { orgDayKey } from './timezone';
import { isStatusOnlyReview } from './development-goal-history';
import type {
  RepDevelopmentGoalReview, RepPlayerDevelopmentGoal, RepPlayerNote, RepPlayerObservation,
  RepTeamEvent, RepTeamGameMoment, RepTeamMeasurableType,
} from './types';

export type PlayerNoteSource = 'note' | 'moment' | 'observation' | 'review';

export interface PlayerNoteEntry {
  /** `${source}:${id}` — unique across the four tables. */
  key: string;
  source: PlayerNoteSource;
  id: string;
  /** YYYY-MM-DD. The date the coach attached to it (a moment: the night it happened). */
  on: string;
  /** Tiebreak within a day — the record's own creation stamp. */
  createdAt: string;
  /** The words, as written. An observation with a descriptor and no note reads the descriptor. */
  body: string;
  /** A qualifier read in italics before the body — an observation's descriptor. */
  qualifier: string | null;
  /** The chip: what this entry is about, named as the coach would ("Skill · Sets feet before throwing"). */
  about: string;
  /** Where the chip opens — a section on this player's page, or the schedule. Null = nowhere. */
  aboutHref: string | null;
  authorId: string | null;
  /**
   * A general note is edited or deleted HERE (the tab's own form); an OBSERVATION opens in its sheet
   * wherever it is read (re-evaluation stage 3, E2 — this tab is its home, the tab hosts the sheet);
   * a moment and a review are edited at their source, never here.
   */
  editable: boolean;
}

export interface PlayerNoteMonth {
  /** YYYY-MM */
  month: string;
  /** "September 2026" */
  label: string;
  entries: PlayerNoteEntry[];
}

const STATUS_WORD: Record<string, string> = { working: 'Working on it', achieved: 'Achieved', parked: 'Parked' };

/** An event's name as the chip reads it — blank when the event is gone or unnamed, so ONE rule
 *  decides whether "Game · vs Milton" or "Note · vs Milton" carries a name at all. */
const evName = (ev: RepTeamEvent | undefined): string => (ev?.name ?? '').trim();
const chip = (kind: string, name: string): string => (name ? `${kind} · ${name}` : kind);

export function buildPlayerNotesTimeline(input: {
  notes: readonly RepPlayerNote[];
  moments: readonly RepTeamGameMoment[];
  observations: readonly RepPlayerObservation[];
  reviews: readonly RepDevelopmentGoalReview[];
  goals: readonly RepPlayerDevelopmentGoal[];
  types: readonly RepTeamMeasurableType[];
  events: readonly RepTeamEvent[];
  /** This player's page, e.g. `/org/coaches/teams/T/roster/P`. */
  playerBase: string;
  /** The team's portal root, for the schedule door. */
  teamBase: string;
}): PlayerNoteEntry[] {
  const goalById = new Map(input.goals.map(g => [g.id, g]));
  const typeById = new Map(input.types.map(t => [t.id, t]));
  const eventById = new Map(input.events.map(e => [e.id, e]));
  const goalsHref = `${input.playerBase}?tab=skills&section=development&view=goals`;

  const out: PlayerNoteEntry[] = [];

  for (const n of input.notes) {
    const goal = n.goalId ? goalById.get(n.goalId) : undefined;
    const ev = n.eventId ? eventById.get(n.eventId) : undefined;
    out.push({
      key: `note:${n.id}`, source: 'note', id: n.id, on: n.notedOn, createdAt: n.createdAt,
      body: n.body, qualifier: null,
      about: goal ? chip('Note', goal.focusArea) : chip('Note', evName(ev)),
      // The schedule's own deep-link param (every other jump-to-a-game link in the portal uses
      // it) opens straight into that game/practice's detail rather than landing on the bare list.
      aboutHref: goal ? goalsHref : ev ? `${input.teamBase}/schedule?event=${ev.id}` : null,
      authorId: n.createdBy, editable: true,
    });
  }
  for (const m of input.moments) {
    out.push({
      key: `moment:${m.id}`, source: 'moment', id: m.id,
      // ⚠ A moment is an INSTANT (timestamptz); its day is the org's calendar day, never the UTC
      // slice — a 9:00 p.m. game is tomorrow in UTC (/review, 2026-09-13). `on` is also the sort
      // and month key, so the wrong day would file a bench line under the wrong night.
      on: orgDayKey(m.happenedAt), createdAt: m.createdAt,
      body: m.body, qualifier: null,
      about: chip('Game', evName(eventById.get(m.eventId))), aboutHref: `${input.teamBase}/schedule?event=${m.eventId}`,
      authorId: m.createdBy, editable: false,
    });
  }
  for (const o of input.observations) {
    const type = typeById.get(o.measurableTypeId);
    out.push({
      key: `observation:${o.id}`, source: 'observation', id: o.id,
      on: o.observedOn, createdAt: o.createdAt,
      // An observation may carry only a descriptor ("With a reminder" is itself what was seen).
      body: o.note ?? '', qualifier: o.descriptor,
      // This tab IS the observation's home (E2): the chip opens nowhere, the row opens the sheet.
      about: `Skill · ${type?.name ?? 'skill'}`, aboutHref: null,
      authorId: o.createdBy, editable: true,
    });
  }
  for (const r of input.reviews) {
    // A pill press is not a note (E4): a wordless status change is a line in the goal's history,
    // never an entry here. The reviews with words are what a coach wrote about the child.
    if (isStatusOnlyReview(r)) continue;
    const goal = goalById.get(r.goalId);
    out.push({
      key: `review:${r.id}`, source: 'review', id: r.id,
      on: r.reviewedOn, createdAt: r.createdAt,
      body: r.note ?? '', qualifier: STATUS_WORD[r.status] ?? r.status,
      about: `Goal · ${goal?.focusArea ?? 'a goal no longer on record'}`, aboutHref: goalsHref,
      authorId: r.createdBy, editable: false,
    });
  }

  // Newest first; within a day the later-created entry first; a stable key last so two page loads
  // never swap rows (the moments lesson).
  out.sort((a, b) => (b.on.localeCompare(a.on)) || (b.createdAt.localeCompare(a.createdAt)) || a.key.localeCompare(b.key));
  return out;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Group an already-sorted timeline by calendar month, newest month first (Q10: months, no filter). */
export function groupPlayerNotesByMonth(entries: readonly PlayerNoteEntry[]): PlayerNoteMonth[] {
  const months: PlayerNoteMonth[] = [];
  for (const e of entries) {
    const month = e.on.slice(0, 7);
    let m = months[months.length - 1];
    if (!m || m.month !== month) {
      const [y, mm] = month.split('-').map(Number);
      m = { month, label: `${MONTHS[(mm || 1) - 1]} ${y}`, entries: [] };
      months.push(m);
    }
    m.entries.push(e);
  }
  return months;
}
