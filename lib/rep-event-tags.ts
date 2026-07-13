// Tag-id validation shared by the tag-applying routes (events POST/PATCH for game tags; expenses
// POST/PATCH for money tags) — each accepts an optional `tagIds` array and must reject anything
// that isn't a real id from this team's tag LIBRARY (its own tags + the org's shared tags of the
// same kind) before it can be linked.
import { getRepTeamTagLibrary } from '@/lib/db';
import type { RepTagKind } from '@/lib/types';

/** Validates a client-supplied tagIds array against this team's tag library for a kind (team's own
 *  + org-shared, Phase 3), so a stray, cross-team, or wrong-kind id can't get linked. Returns null
 *  (caller should 400) on any invalid entry or wrong shape; returns a deduped array otherwise. */
export async function resolveValidTagIds(
  teamId: string, orgId: string, kind: RepTagKind, raw: unknown,
): Promise<string[] | null> {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0) return [];
  if (!raw.every((id): id is string => typeof id === 'string')) return null;
  const library = await getRepTeamTagLibrary(teamId, kind, orgId);
  const validIds = new Set(library.map(t => t.id));
  const deduped = Array.from(new Set(raw));
  return deduped.every(id => validIds.has(id)) ? deduped : null;
}
