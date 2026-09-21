// The place link on an event (Arrival & Places, mig 307), proved before it is written — the
// `rep-event-tags` idiom: a client hands the events POST/PATCH a `placeId`, and this refuses any
// id that is not one of THIS team's places (a stray, cross-team or deleted id becomes null and
// the event keeps its typed text). The import route resolves by NAME instead (`matchPlace`).
import { getRepTeamPlaceById } from '@/lib/db';

/**
 * `undefined` = the client did not speak (the PATCH leaves the link alone); `null` = clear it;
 * a string = the place, if it is this team's — otherwise null, never a 400: the text is still a
 * perfectly good location and a dead link must not refuse a save.
 */
export async function resolvePlaceId(teamId: string, raw: unknown): Promise<string | null | undefined> {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') return null;
  const place = await getRepTeamPlaceById(raw, teamId);
  return place ? place.id : null;
}
