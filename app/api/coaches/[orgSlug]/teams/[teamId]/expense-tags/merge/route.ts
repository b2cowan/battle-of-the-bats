import { EXPENSE_TAG_LIBRARY, coachTagMergeRoute } from '@/lib/coach-tag-routes';

/** Fold one money tag into another, keeping every expense it was on. Atomic in the database. */
export const { POST } = coachTagMergeRoute({
  ...EXPENSE_TAG_LIBRARY,
  route: '/api/coaches/[orgSlug]/teams/[teamId]/expense-tags/merge',
});
