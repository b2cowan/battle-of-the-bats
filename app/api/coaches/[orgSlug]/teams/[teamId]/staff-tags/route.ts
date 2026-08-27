import { STAFF_TAG_LIBRARY, coachTagCollectionRoutes } from '@/lib/coach-tag-routes';

/**
 * The 'staff' tag vocabulary (mig 266) — who's shown as running a block/station on a practice plan.
 *
 * ⚠ Merging or deleting a staff tag also rewrites every plan that used it — see
 * `lib/rep-practice-plan-tag-repoint.ts`. That is NOT true of the other tag kinds; this pair is the
 * exception, not the pattern to copy for a future one.
 */
export const { GET, POST } = coachTagCollectionRoutes({
  ...STAFF_TAG_LIBRARY,
  route: '/api/coaches/[orgSlug]/teams/[teamId]/staff-tags',
});
