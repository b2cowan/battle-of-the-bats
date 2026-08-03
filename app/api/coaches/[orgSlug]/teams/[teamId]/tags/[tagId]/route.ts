import { GAME_TAG_LIBRARY, coachTagItemRoutes } from '@/lib/coach-tag-routes';

/** One game tag — PATCH to rename, DELETE to remove. Merge lives at the sibling /tags/merge. */
export const { PATCH, DELETE } = coachTagItemRoutes({
  ...GAME_TAG_LIBRARY,
  route: '/api/coaches/[orgSlug]/teams/[teamId]/tags/[tagId]',
});
