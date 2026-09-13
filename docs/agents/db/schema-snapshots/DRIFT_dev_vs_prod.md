# Dev vs Prod — structural drift

**Generated:** 2026-09-13 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 163 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 4 | 0 | — |
| Columns | 65 | 4 | 1 |
| Indexes | 29 | 2 | 0 |
| Constraints | 30 | 1 | — |
| RLS / CHECK | 25 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (4)
- `rep_development_goal_reviews`
- `rep_evaluation_not_assessed`
- `rep_player_notes`
- `rep_player_observations`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (65)
- `rep_development_goal_reviews.created_at`
- `rep_development_goal_reviews.created_by`
- `rep_development_goal_reviews.evidence_measurable_ids`
- `rep_development_goal_reviews.evidence_observation_ids`
- `rep_development_goal_reviews.goal_id`
- `rep_development_goal_reviews.id`
- `rep_development_goal_reviews.next_review_on`
- `rep_development_goal_reviews.note`
- `rep_development_goal_reviews.org_id`
- `rep_development_goal_reviews.player_id`
- `rep_development_goal_reviews.reviewed_on`
- `rep_development_goal_reviews.status`
- `rep_development_goal_reviews.team_id`
- `rep_evaluation_not_assessed.created_at`
- `rep_evaluation_not_assessed.created_by`
- `rep_evaluation_not_assessed.id`
- `rep_evaluation_not_assessed.measurable_type_id`
- `rep_evaluation_not_assessed.org_id`
- `rep_evaluation_not_assessed.player_id`
- `rep_evaluation_not_assessed.reason`
- `rep_evaluation_not_assessed.session_id`
- `rep_evaluation_not_assessed.team_id`
- `rep_player_development_goals.origin`
- `rep_player_development_goals.review_on`
- `rep_player_development_goals.success`
- `rep_player_measurables.attempt_no`
- `rep_player_measurables.corrected_at`
- `rep_player_measurables.corrected_by`
- `rep_player_measurables.corrected_from`
- `rep_player_notes.body`
- `rep_player_notes.created_at`
- `rep_player_notes.created_by`
- `rep_player_notes.event_id`
- `rep_player_notes.goal_id`
- `rep_player_notes.id`
- `rep_player_notes.noted_on`
- `rep_player_notes.org_id`
- `rep_player_notes.player_id`
- `rep_player_notes.team_id`
- `rep_player_notes.updated_at`
- `rep_player_observations.created_at`
- `rep_player_observations.created_by`
- `rep_player_observations.descriptor`
- `rep_player_observations.goal_id`
- `rep_player_observations.id`
- `rep_player_observations.measurable_type_id`
- `rep_player_observations.metric_kind`
- `rep_player_observations.note`
- `rep_player_observations.observed_on`
- `rep_player_observations.org_id`
- `rep_player_observations.player_id`
- `rep_player_observations.session_id`
- `rep_player_observations.team_id`
- `rep_player_observations.updated_at`
- `rep_team_evaluation_sessions.scope_metric_ids`
- `rep_team_evaluation_sessions.scope_player_ids`
- `rep_team_measurable_types.aim`
- `rep_team_measurable_types.attempts_per_session`
- `rep_team_measurable_types.descriptors`
- `rep_team_measurable_types.headline`
- `rep_team_measurable_types.kind`
- `rep_team_measurable_types.method`
- `rep_team_measurable_types.range_from`
- `rep_team_measurable_types.range_to`
- `rep_team_measurable_types.replaced_by_id`

### Only in PROD (4)
- `family_links.requested_player_name`
- `rep_teams.family_link_created_at`
- `rep_teams.family_link_created_by`
- `rep_teams.family_link_token_hash`

### Type/nullability/default changed (1)
- `rep_team_measurable_types.unit` — dev: `text|text|YES|` | prod: `text|text|NO|`

## Indexes
### Only in DEV (29)
- `rep_development_goal_reviews_goal_idx`
- `rep_development_goal_reviews_org_idx`
- `rep_development_goal_reviews_pkey`
- `rep_development_goal_reviews_player_idx`
- `rep_development_goal_reviews_team_idx`
- `rep_evaluation_not_assessed_org_idx`
- `rep_evaluation_not_assessed_pkey`
- `rep_evaluation_not_assessed_player_idx`
- `rep_evaluation_not_assessed_team_idx`
- `rep_evaluation_not_assessed_type_idx`
- `rep_evaluation_not_assessed_uniq`
- `rep_player_development_goals_id_team_uniq`
- `rep_player_measurables_session_attempt_uniq`
- `rep_player_notes_event_idx`
- `rep_player_notes_goal_idx`
- `rep_player_notes_org_idx`
- `rep_player_notes_pkey`
- `rep_player_notes_player_idx`
- `rep_player_notes_team_idx`
- `rep_player_observations_goal_idx`
- `rep_player_observations_org_idx`
- `rep_player_observations_pkey`
- `rep_player_observations_player_idx`
- `rep_player_observations_session_idx`
- `rep_player_observations_team_idx`
- `rep_player_observations_type_idx`
- `rep_team_measurable_types_id_team_kind_uniq`
- `rep_team_measurable_types_id_team_uniq`
- `rep_team_measurable_types_replaced_by_idx`

### Only in PROD (2)
- `rep_player_measurables_session_entry_uniq`
- `rep_teams_family_link_token_uniq`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (30)
- `rep_development_goal_reviews.rep_development_goal_reviews_created_by_fkey`
- `rep_development_goal_reviews.rep_development_goal_reviews_goal_team_fkey`
- `rep_development_goal_reviews.rep_development_goal_reviews_org_id_fkey`
- `rep_development_goal_reviews.rep_development_goal_reviews_pkey`
- `rep_development_goal_reviews.rep_development_goal_reviews_player_team_fkey`
- `rep_development_goal_reviews.rep_development_goal_reviews_team_id_fkey`
- `rep_evaluation_not_assessed.rep_evaluation_not_assessed_created_by_fkey`
- `rep_evaluation_not_assessed.rep_evaluation_not_assessed_org_id_fkey`
- `rep_evaluation_not_assessed.rep_evaluation_not_assessed_pkey`
- `rep_evaluation_not_assessed.rep_evaluation_not_assessed_player_team_fkey`
- `rep_evaluation_not_assessed.rep_evaluation_not_assessed_session_team_fkey`
- `rep_evaluation_not_assessed.rep_evaluation_not_assessed_team_id_fkey`
- `rep_evaluation_not_assessed.rep_evaluation_not_assessed_type_team_fkey`
- `rep_player_measurables.rep_player_measurables_corrected_by_fkey`
- `rep_player_notes.rep_player_notes_created_by_fkey`
- `rep_player_notes.rep_player_notes_event_id_fkey`
- `rep_player_notes.rep_player_notes_goal_team_fkey`
- `rep_player_notes.rep_player_notes_org_id_fkey`
- `rep_player_notes.rep_player_notes_pkey`
- `rep_player_notes.rep_player_notes_player_team_fkey`
- `rep_player_notes.rep_player_notes_team_id_fkey`
- `rep_player_observations.rep_player_observations_created_by_fkey`
- `rep_player_observations.rep_player_observations_goal_team_fkey`
- `rep_player_observations.rep_player_observations_org_id_fkey`
- `rep_player_observations.rep_player_observations_pkey`
- `rep_player_observations.rep_player_observations_player_team_fkey`
- `rep_player_observations.rep_player_observations_session_team_fkey`
- `rep_player_observations.rep_player_observations_skill_fkey`
- `rep_player_observations.rep_player_observations_team_id_fkey`
- `rep_team_measurable_types.rep_team_measurable_types_replaced_by_id_fkey`

### Only in PROD (1)
- `rep_teams.rep_teams_family_link_created_by_fkey`

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (25)
- `rep_development_goal_reviews.rep_development_goal_reviews_note_check`
- `rep_development_goal_reviews.rep_development_goal_reviews_status_check`
- `rep_evaluation_not_assessed.rep_evaluation_not_assessed_reason_check`
- `rep_player_development_goals.rep_player_development_goals_origin_check`
- `rep_player_development_goals.rep_player_development_goals_success_check`
- `rep_player_measurables.rep_player_measurables_attempt_no_check`
- `rep_player_measurables.rep_player_measurables_correction_whole_check`
- `rep_player_notes.rep_player_notes_body_check`
- `rep_player_observations.rep_player_observations_descriptor_check`
- `rep_player_observations.rep_player_observations_has_content_check`
- `rep_player_observations.rep_player_observations_metric_kind_check`
- `rep_player_observations.rep_player_observations_note_check`
- `rep_team_evaluation_sessions.rep_team_evaluation_sessions_scope_whole_check`
- `rep_team_measurable_types.rep_team_measurable_types_aim_check`
- `rep_team_measurable_types.rep_team_measurable_types_attempts_check`
- `rep_team_measurable_types.rep_team_measurable_types_descriptors_check`
- `rep_team_measurable_types.rep_team_measurable_types_headline_by_aim_check`
- `rep_team_measurable_types.rep_team_measurable_types_headline_check`
- `rep_team_measurable_types.rep_team_measurable_types_kind_check`
- `rep_team_measurable_types.rep_team_measurable_types_method_check`
- `rep_team_measurable_types.rep_team_measurable_types_range_check`
- `rep_team_measurable_types.rep_team_measurable_types_record_has_no_best_check`
- `rep_team_measurable_types.rep_team_measurable_types_replaced_is_retired_check`
- `rep_team_measurable_types.rep_team_measurable_types_skill_shape_check`
- `rep_team_measurable_types.rep_team_measurable_types_unit_by_kind_check`

### CHECK only in PROD (0)
_none_

