import { EQUIPMENT_TAG_LIBRARY, coachTagMergeRoute } from '@/lib/coach-tag-routes';

/**
 * Fold one equipment tag into another. `merge_rep_team_tags` merges the tag rows;
 * `EQUIPMENT_TAG_LIBRARY.afterMerge` then re-points every plan that used the loser to the winner.
 */
export const { POST } = coachTagMergeRoute({
  ...EQUIPMENT_TAG_LIBRARY,
  route: '/api/coaches/[orgSlug]/teams/[teamId]/equipment-tags/merge',
});
