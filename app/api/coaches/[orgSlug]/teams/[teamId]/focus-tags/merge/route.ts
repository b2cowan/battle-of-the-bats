import { FOCUS_TAG_LIBRARY, coachTagMergeRoute } from '@/lib/coach-tag-routes';

/**
 * Fold one focus tag into another (Practice Plans Phase 3, frame 11).
 *
 * ⚠ **This is the reason tags beat free text.** A coach who ends up with "Hitting" and "Hitting
 * mechanics" folds one into the other and every drill, plan template, tagged practice AND player
 * focus area that used it comes along — atomically, in `merge_rep_team_tags` (widened by mig 221
 * to re-point all four, where the mig-181 version knew only about events). A merge that silently
 * dropped a tag's drills would be worse than no merge at all: the coach would believe history had
 * been preserved.
 */
export const { POST } = coachTagMergeRoute({
  ...FOCUS_TAG_LIBRARY,
  route: '/api/coaches/[orgSlug]/teams/[teamId]/focus-tags/merge',
});
