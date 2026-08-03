import { EXPENSE_TAG_LIBRARY, coachTagItemRoutes } from '@/lib/coach-tag-routes';

/**
 * One money tag — PATCH to rename, DELETE to remove. Gated on MONEY, not schedule.
 *
 * A shared (org-authored) tag has `team_id` NULL, so the team-scoped write is a no-op on it and
 * answers 404 — which correctly stops a coach editing the club's shared vocabulary.
 */
export const { PATCH, DELETE } = coachTagItemRoutes({
  ...EXPENSE_TAG_LIBRARY,
  route: '/api/coaches/[orgSlug]/teams/[teamId]/expense-tags/[tagId]',
});
