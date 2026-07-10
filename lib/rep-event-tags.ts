// Game-tag validation shared by the events POST (create) and events/[eventId] PATCH (update)
// routes — both accept an optional `tagIds` array and must reject anything that isn't a real id
// from this team's own game-tag library before it can be linked to an event.
import { getRepTeamTags } from '@/lib/db';

/** Validates a client-supplied tagIds array against this team's game-tag library, so a stray or
 *  cross-team id can't get linked to an event. Returns null (caller should 400) on any invalid
 *  entry or wrong shape; returns a deduped array otherwise. */
export async function resolveValidTagIds(teamId: string, raw: unknown): Promise<string[] | null> {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0) return [];
  if (!raw.every((id): id is string => typeof id === 'string')) return null;
  const library = await getRepTeamTags(teamId, 'game');
  const validIds = new Set(library.map(t => t.id));
  const deduped = Array.from(new Set(raw));
  return deduped.every(id => validIds.has(id)) ? deduped : null;
}
