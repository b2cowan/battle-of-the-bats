import { GAME_TAG_LIBRARY, coachTagCollectionRoutes } from '@/lib/coach-tag-routes';

/** Game tags — GET the library, POST to mint one. Every rule lives in `lib/coach-tag-routes.ts`. */
export const { GET, POST } = coachTagCollectionRoutes({
  ...GAME_TAG_LIBRARY,
  route: '/api/coaches/[orgSlug]/teams/[teamId]/tags',
});
