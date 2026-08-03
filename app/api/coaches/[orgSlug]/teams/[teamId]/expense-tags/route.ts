import { EXPENSE_TAG_LIBRARY, coachTagCollectionRoutes } from '@/lib/coach-tag-routes';

/**
 * Money tags — GET the library, POST to mint one.
 *
 * ⚠ Gated on MONEY, not schedule — the one deliberate capability difference between the tag
 * libraries, declared on the descriptor in `lib/coach-tag-routes.ts`.
 */
export const { GET, POST } = coachTagCollectionRoutes({
  ...EXPENSE_TAG_LIBRARY,
  route: '/api/coaches/[orgSlug]/teams/[teamId]/expense-tags',
});
