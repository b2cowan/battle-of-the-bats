import { FOCUS_TAG_LIBRARY, coachTagItemRoutes } from '@/lib/coach-tag-routes';

/**
 * One focus tag — PATCH to rename, DELETE to remove (Practice Plans Phase 3, frame 11).
 *
 * ⚠ Renaming is safe by construction: drills, templates and focus areas link to the tag by ID, so
 * a rename re-labels every one of them at once. That is the whole reason the vocabulary became
 * tags rather than staying free text.
 *
 * ⚠ DELETE re-points nothing — a deleted tag simply leaves the things it was on. Merge is the
 * history-preserving path and is what the manager offers first.
 *
 * The club's SHARED tags have `team_id` NULL, so the team-scoped write is a no-op on them and
 * answers 404: a coach may use the club's words but never rename or retire them.
 */
export const { PATCH, DELETE } = coachTagItemRoutes({
  ...FOCUS_TAG_LIBRARY,
  route: '/api/coaches/[orgSlug]/teams/[teamId]/focus-tags/[tagId]',
});
