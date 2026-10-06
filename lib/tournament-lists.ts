/**
 * THE TWO LISTS' MODEL (Tournament admin redesign Stage 4, D4 · D5 · A22, ruled 2026-10-06): EACH EVENT
 * LIVES IN ONE LIST, by where it is in its life. The Tournaments list holds what's ahead (Active · Draft);
 * Past tournaments holds every finished event (Completed · Archived), plus the sealed records. Mark
 * complete moves an event from the first to the second; Reopen moves it back. No React, so the unit suite
 * holds the bands and the order a record's Previous / Next walks (tests/unit/tournament-lists.test.ts).
 */
export type EventStatus = 'draft' | 'active' | 'completed' | 'archived';

/** One event as the lists read it (GET /api/admin/tournaments?counts=1, mapped). */
export interface ListEvent {
  id: string;
  name: string;
  slug: string;
  year: number | null;
  status: EventStatus;
  startDate: string | null;
  endDate: string | null;
  contactEmail: string | null;
  defaultContactMemberId: string | null;
  acceptedTeams: number;
  divisionCount: number;
  teamsPlayed: number;
  gamesPlayed: number;
}

export interface ListBand { key: EventStatus; events: ListEvent[] }

/** Soonest first; an event with no dates after the dated ones; then by name. */
const ahead = (a: ListEvent, b: ListEvent) =>
  (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999') || a.name.localeCompare(b.name);
/** Most recently finished first; then by year, then by name. */
const behind = (a: ListEvent, b: ListEvent) =>
  (b.endDate ?? b.startDate ?? '').localeCompare(a.endDate ?? a.startDate ?? '')
  || (b.year ?? 0) - (a.year ?? 0)
  || a.name.localeCompare(b.name);

function bands(events: ListEvent[], order: EventStatus[], sort: (a: ListEvent, b: ListEvent) => number): ListBand[] {
  return order
    .map(key => ({ key, events: events.filter(e => e.status === key).sort(sort) }))
    .filter(b => b.events.length > 0); // an empty band is absent
}

/** The Tournaments list: Active, then Draft. */
export function aheadBands(events: ListEvent[]): ListBand[] {
  return bands(events, ['active', 'draft'], ahead);
}

/** Past tournaments: Completed, then Archived (the sealed records are their own band, drawn by the page). */
export function pastBands(events: ListEvent[]): ListBand[] {
  return bands(events, ['completed', 'archived'], behind);
}

/** The order a record's Previous / Next walks: the list's own, band by band. */
export function walkOrder(listBands: ListBand[]): ListEvent[] {
  return listBands.flatMap(b => b.events);
}

/** Which list an event belongs in now — a record opened from one list closes when its event leaves it. */
export function listOf(status: EventStatus): 'ahead' | 'past' {
  return status === 'active' || status === 'draft' ? 'ahead' : 'past';
}
