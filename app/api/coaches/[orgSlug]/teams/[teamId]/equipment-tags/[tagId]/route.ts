import { EQUIPMENT_TAG_LIBRARY, coachTagItemRoutes } from '@/lib/coach-tag-routes';

/**
 * One equipment tag — PATCH to rename, DELETE to remove.
 *
 * ⚠ DELETE strips the id from every plan that had it (`repointForDelete` on `EQUIPMENT_TAG_LIBRARY`)
 * rather than leaving it dangling. See `staff-tags/[tagId]/route.ts` for the parallel case.
 */
export const { PATCH, DELETE } = coachTagItemRoutes({
  ...EQUIPMENT_TAG_LIBRARY,
  route: '/api/coaches/[orgSlug]/teams/[teamId]/equipment-tags/[tagId]',
});
