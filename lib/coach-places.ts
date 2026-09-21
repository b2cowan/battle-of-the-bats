/**
 * The place book's pure rules (Arrival & Places, owner rulings D4–D9, 2026-09-21) — shared by the
 * picker, the import and the routes, and pinned by a unit test. Client-safe: no server imports.
 */
import type { RepTeamPlace } from './types';

/** Caps, mirrored from the CHECKs on `rep_team_places` (mig 307). */
export const PLACE_NAME_MAX = 120;
export const PLACE_ADDRESS_MAX = 200;
export const PLACE_FIELD_MAX = 40;
export const PLACE_NOTE_MAX = 160;
/** How many places one team may keep. Enough for a league's every park; a cap, not a plan. */
export const MAX_PLACES_PER_TEAM = 100;

/** The key the book is unique on: the name, trimmed, case-folded. */
export function placeKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * The place a typed or imported location IS, by name — the import's match (D9) and the picker's
 * "that's already one of yours". Exact after trim + case-fold; a prefix is a suggestion, not a match.
 */
export function matchPlace<T extends Pick<RepTeamPlace, 'name'>>(places: readonly T[], name: string | null | undefined): T | null {
  const key = name ? placeKey(name) : '';
  if (!key) return null;
  return places.find(p => placeKey(p.name) === key) ?? null;
}

/**
 * What picking a place writes onto an event (D8): its name, its address, and its usual field —
 * the field ONLY when the event has none yet, because a park has six diamonds and a tournament
 * moves you between them; a diamond the coach already typed for this game wins.
 */
export function applyPlaceToEvent<T extends { location: string; locationAddress: string; fieldNumber: string; placeId: string | null }>(
  event: T, place: Pick<RepTeamPlace, 'id' | 'name' | 'address' | 'fieldNumber'>,
): T {
  return {
    ...event,
    location: place.name,
    locationAddress: place.address ?? '',
    fieldNumber: event.fieldNumber.trim() ? event.fieldNumber : (place.fieldNumber ?? ''),
    placeId: place.id,
  };
}

/** The place picker's list: most recently used first (the server orders it so), filtered by what is typed. */
export function filterPlaces<T extends Pick<RepTeamPlace, 'name' | 'address'>>(places: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...places];
  return places.filter(p => p.name.toLowerCase().includes(q) || (p.address ?? '').toLowerCase().includes(q));
}

/** The wire shape of a place write, trimmed and capped — one reader for POST and PATCH. */
export function readPlaceFields(body: unknown): {
  fields: { name?: string; address?: string | null; fieldNumber?: string | null; note?: string | null };
  error?: string;
} {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const fields: { name?: string; address?: string | null; fieldNumber?: string | null; note?: string | null } = {};
  if ('name' in raw) {
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (name.length < 1 || name.length > PLACE_NAME_MAX) return { fields, error: `A place needs a name (up to ${PLACE_NAME_MAX} characters).` };
    fields.name = name;
  }
  const text = (key: 'address' | 'fieldNumber' | 'note', max: number, what: string): string | undefined => {
    if (!(key in raw)) return undefined;
    const v = raw[key];
    if (v === null || v === undefined) { fields[key] = null; return undefined; }
    if (typeof v !== 'string') return `${what} must be text.`;
    const t = v.trim();
    if (t.length > max) return `${what} is too long (up to ${max} characters).`;
    fields[key] = t || null;
    return undefined;
  };
  const e = text('address', PLACE_ADDRESS_MAX, 'The address') ?? text('fieldNumber', PLACE_FIELD_MAX, 'The field or diamond') ?? text('note', PLACE_NOTE_MAX, 'The note');
  if (e) return { fields, error: e };
  return { fields };
}
