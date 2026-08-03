import { FOCUS_TAG_LIBRARY, coachTagCollectionRoutes } from '@/lib/coach-tag-routes';

/**
 * The 'focus' tag vocabulary (Practice Plans Phase 3, mig 221) — the ONE list behind drills, plan
 * templates, practice plans and players' focus areas.
 *
 * ⚠ Its read and write gates are deliberately different capabilities: an assistant with `notes`
 * alone must be able to SEE what a focus area is grouped under so the focus rail can explain
 * itself, but minting team vocabulary is a practice-planning act and rides `schedule`. Both are
 * declared on `FOCUS_TAG_LIBRARY` in `lib/coach-tag-routes.ts`.
 *
 * ⚠ The GET rides the season-read rail, so a past season's records still render the words they
 * were tagged with. Every WRITE resolves the LIVE season — a vocabulary is an INSTRUMENT.
 */
export const { GET, POST } = coachTagCollectionRoutes({
  ...FOCUS_TAG_LIBRARY,
  route: '/api/coaches/[orgSlug]/teams/[teamId]/focus-tags',
});
