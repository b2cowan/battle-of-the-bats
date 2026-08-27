import { EQUIPMENT_TAG_LIBRARY, coachTagCollectionRoutes } from '@/lib/coach-tag-routes';

/**
 * The 'equipment' tag vocabulary (mig 266) — what to bring, on a practice plan.
 *
 * ⚠ Merging or deleting an equipment tag also rewrites every plan that used it — see
 * `lib/rep-practice-plan-tag-repoint.ts`. Not true of the other tag kinds; see `STAFF_TAG_LIBRARY`.
 */
export const { GET, POST } = coachTagCollectionRoutes({
  ...EQUIPMENT_TAG_LIBRARY,
  route: '/api/coaches/[orgSlug]/teams/[teamId]/equipment-tags',
});
