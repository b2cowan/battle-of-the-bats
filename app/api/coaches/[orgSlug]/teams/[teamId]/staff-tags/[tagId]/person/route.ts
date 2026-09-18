import { STAFF_TAG_LIBRARY, coachTagPersonRoute } from '@/lib/coach-tag-routes';

/**
 * This staff word IS this person — PUT `{ userId }` to link, `{ userId: null }` to unlink (mig 303).
 * Its own verb beside rename (PATCH on the parent), because the manager's row does one or the other.
 */
export const { PUT } = coachTagPersonRoute({
  ...STAFF_TAG_LIBRARY,
  route: '/api/coaches/[orgSlug]/teams/[teamId]/staff-tags/[tagId]/person',
});
