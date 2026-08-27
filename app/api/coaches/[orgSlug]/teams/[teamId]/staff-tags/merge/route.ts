import { STAFF_TAG_LIBRARY, coachTagMergeRoute } from '@/lib/coach-tag-routes';

/**
 * Fold one staff tag into another. `merge_rep_team_tags` proves same-team/same-org/same-kind and
 * merges the tag rows; `STAFF_TAG_LIBRARY.repointForMerge` re-points every plan and template that used the loser
 * to the winner — the step this kind needs that the relational kinds don't (no FK to re-point).
 */
export const { POST } = coachTagMergeRoute({
  ...STAFF_TAG_LIBRARY,
  route: '/api/coaches/[orgSlug]/teams/[teamId]/staff-tags/merge',
});
