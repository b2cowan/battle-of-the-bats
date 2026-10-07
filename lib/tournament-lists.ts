/**
 * THE ONE TOURNAMENTS LIST'S MODEL (Tournament admin redesign Stage 4, D7, ruled 2026-10-06 — it replaced
 * A22's two lists): every event of the club on ONE page, in exactly one band, the bands in the order of an
 * event's life — Active · Draft (what's ahead, soonest first) · Completed · Archived (what's finished, most
 * recent first) — plus the sealed records, which the page draws. What's ahead stays on top, so history only
 * ever adds rows below. Mark complete moves an event down a band on the same page. No React, so the unit
 * suite holds the bands and the order a record's Previous / Next walks (tests/unit/tournament-lists.test.ts).
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

/** The bands top to bottom, each with its own order: what's ahead soonest first, what's finished latest first. */
const BAND_ORDER: ReadonlyArray<[EventStatus, (a: ListEvent, b: ListEvent) => number]> = [
  ['active', ahead],
  ['draft', ahead],
  ['completed', behind],
  ['archived', behind],
];

/** The Tournaments list: Active, Draft, Completed, Archived (the sealed records are their own band, drawn by the page). */
export function listBands(events: ListEvent[]): ListBand[] {
  return BAND_ORDER
    .map(([key, sort]) => ({ key, events: events.filter(e => e.status === key).sort(sort) }))
    .filter(b => b.events.length > 0); // an empty band is absent
}

/** A finished event — its row says "no teams" (never "no teams yet") and Completed carries Reuse setup. */
export function isFinished(status: EventStatus): boolean {
  return status === 'completed' || status === 'archived';
}

/** The order a record's Previous / Next walks: the list's own, band by band. */
export function walkOrder(listBands: ListBand[]): ListEvent[] {
  return listBands.flatMap(b => b.events);
}
