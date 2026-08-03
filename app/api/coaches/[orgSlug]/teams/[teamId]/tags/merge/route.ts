import { GAME_TAG_LIBRARY, coachTagMergeRoute } from '@/lib/coach-tag-routes';

/** Fold one game tag into another, keeping every game it was on. Atomic in the database. */
export const { POST } = coachTagMergeRoute({
  ...GAME_TAG_LIBRARY,
  route: '/api/coaches/[orgSlug]/teams/[teamId]/tags/merge',
});
