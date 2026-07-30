import type { ActivatableFeature } from './basic-coach-teams';

/**
 * Turn a Tier-2 team-ops feature on for an org-less Basic coach team — the ONE client-side
 * activation call. Lifted out of CoachExploreCatalog so the team Overview's setup steps can
 * activate a tool without a second implementation of the same write (a divergent copy would
 * be free to drift on error handling, or to skip the cache invalidation the nav depends on).
 *
 * Always returns the full resulting feature set, so a caller mirroring state locally can assign
 * it directly. Pass `previousFeatures` for that: if the server doesn't echo the set back, the
 * result is `previousFeatures + feature` rather than the one feature alone — replacing with just
 * the activated one would blank the coach's other tools out of the nav until the next refresh.
 * Throws with a display-ready message on failure — callers surface it inline; there is nothing
 * to retry automatically.
 *
 * Callers navigating the coach into the new section should `router.refresh()` first, to drop the
 * current page's cached payload (otherwise coming back re-offers "Turn on" for a tool that's on).
 */
export async function activateCoachTeamFeature(
  basicTeamId: string,
  feature: ActivatableFeature,
  previousFeatures: string[] = [],
): Promise<string[]> {
  const res = await fetch(`/api/coaches/teams/${basicTeamId}/features`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feature, active: true }),
  });
  const body = (await res.json().catch(() => ({}))) as { activatedFeatures?: string[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? 'Could not turn this on.');
  return body.activatedFeatures ?? [...previousFeatures, feature];
}
