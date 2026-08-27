import { STAFF_TAG_LIBRARY, coachTagItemRoutes } from '@/lib/coach-tag-routes';

/**
 * One staff tag — PATCH to rename, DELETE to remove.
 *
 * ⚠ Rename is safe by construction (every plan pick is the tag's id). DELETE strips the id from
 * every plan that had it (`repointForDelete` on `STAFF_TAG_LIBRARY`) rather than leaving it dangling —
 * the relational tag kinds get this for free from `ON DELETE CASCADE`; this one does it by hand.
 */
export const { PATCH, DELETE } = coachTagItemRoutes({
  ...STAFF_TAG_LIBRARY,
  route: '/api/coaches/[orgSlug]/teams/[teamId]/staff-tags/[tagId]',
});
