# Dev vs Prod — structural drift

**Generated:** 2026-08-03 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 221 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 10 | 0 | — |
| Columns | 106 | 0 | 0 |
| Indexes | 42 | 0 | 0 |
| Constraints | 45 | 0 | — |
| RLS / CHECK | 18 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (10)
- `family_consents`
- `family_email_optouts`
- `family_links`
- `family_recap_views`
- `no_login_rate_limits`
- `rep_player_tryout_baselines`
- `rep_team_drill_tags`
- `rep_team_drills`
- `rep_team_plan_template_tags`
- `rep_team_plan_templates`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (106)
- `family_consents.basis`
- `family_consents.basis_started_at`
- `family_consents.consent_ip`
- `family_consents.consent_text`
- `family_consents.created_at`
- `family_consents.guardian_email`
- `family_consents.id`
- `family_consents.jurisdiction`
- `family_consents.org_id`
- `family_consents.scope`
- `family_consents.source_id`
- `family_consents.source_table`
- `family_consents.updated_at`
- `family_consents.user_id`
- `family_consents.withdrawn_at`
- `family_email_optouts.created_at`
- `family_email_optouts.email`
- `family_email_optouts.id`
- `family_email_optouts.opted_out_at`
- `family_email_optouts.org_id`
- `family_email_optouts.source`
- `family_links.approved_at`
- `family_links.approved_by_user_id`
- `family_links.calendar_token_hash`
- `family_links.claim_expires_at`
- `family_links.claim_token_hash`
- `family_links.claimed_email`
- `family_links.consent_ip`
- `family_links.consent_recorded_at`
- `family_links.created_at`
- `family_links.declined_at`
- `family_links.id`
- `family_links.invited_by_user_id`
- `family_links.invited_email`
- `family_links.org_id`
- `family_links.player_id`
- `family_links.relationship`
- `family_links.rep_team_id`
- `family_links.requested_player_name`
- `family_links.revoked_at`
- `family_links.role`
- `family_links.status`
- `family_links.updated_at`
- `family_links.user_id`
- `family_links.verified_via`
- `family_recap_views.first_viewed_at`
- `family_recap_views.id`
- `family_recap_views.link_id`
- `family_recap_views.org_id`
- `family_recap_views.program_year_id`
- `family_recap_views.rep_team_id`
- `no_login_rate_limits.attempts`
- `no_login_rate_limits.rail`
- `no_login_rate_limits.subject`
- `no_login_rate_limits.window_started_at`
- `rep_player_development_goals.tag_id`
- `rep_player_tryout_baselines.id`
- `rep_player_tryout_baselines.org_id`
- `rep_player_tryout_baselines.program_year_id`
- `rep_player_tryout_baselines.roster_player_id`
- `rep_player_tryout_baselines.seeded_at`
- `rep_player_tryout_baselines.seeded_by`
- `rep_player_tryout_baselines.snapshot`
- `rep_player_tryout_baselines.team_id`
- `rep_player_tryout_baselines.tryout_registration_id`
- `rep_team_drill_tags.created_at`
- `rep_team_drill_tags.drill_id`
- `rep_team_drill_tags.tag_id`
- `rep_team_drills.coaching_points`
- `rep_team_drills.created_at`
- `rep_team_drills.created_by`
- `rep_team_drills.description`
- `rep_team_drills.equipment`
- `rep_team_drills.goal`
- `rep_team_drills.id`
- `rep_team_drills.is_active`
- `rep_team_drills.name`
- `rep_team_drills.org_id`
- `rep_team_drills.setup`
- `rep_team_drills.sort_order`
- `rep_team_drills.team_id`
- `rep_team_drills.updated_at`
- `rep_team_drills.usual_minutes`
- `rep_team_evaluation_sessions.event_id`
- `rep_team_events.family_shared_at`
- `rep_team_events.family_shared_by`
- `rep_team_events.practice_plan`
- `rep_team_events.practice_recap`
- `rep_team_plan_template_tags.created_at`
- `rep_team_plan_template_tags.tag_id`
- `rep_team_plan_template_tags.template_id`
- `rep_team_plan_templates.created_at`
- `rep_team_plan_templates.created_by`
- `rep_team_plan_templates.id`
- `rep_team_plan_templates.is_active`
- `rep_team_plan_templates.name`
- `rep_team_plan_templates.org_id`
- `rep_team_plan_templates.plan`
- `rep_team_plan_templates.team_id`
- `rep_team_plan_templates.updated_at`
- `rep_teams.family_calendar_token_hash`
- `rep_teams.family_link_created_at`
- `rep_teams.family_link_created_by`
- `rep_teams.family_link_token_hash`
- `rep_teams.schedule_visibility`
- `rep_tryout_registrations.first_offered_at`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (42)
- `family_consents_live_uniq`
- `family_consents_org_email_idx`
- `family_consents_pkey`
- `family_consents_user_idx`
- `family_email_optouts_org_email_uniq`
- `family_email_optouts_pkey`
- `family_links_calendar_token_hash_key`
- `family_links_claim_token_hash_key`
- `family_links_email_idx`
- `family_links_live_uniq`
- `family_links_org_idx`
- `family_links_pkey`
- `family_links_team_status_idx`
- `family_links_user_idx`
- `family_recap_views_link_season_uniq`
- `family_recap_views_pkey`
- `family_recap_views_season_idx`
- `family_recap_views_team_idx`
- `no_login_rate_limits_pkey`
- `no_login_rate_limits_window_idx`
- `rep_player_development_goals_tag_idx`
- `rep_player_tryout_baselines_pkey`
- `rep_player_tryout_baselines_player_year_uniq`
- `rep_player_tryout_baselines_team_idx`
- `rep_player_tryout_baselines_year_idx`
- `rep_team_drill_tags_pkey`
- `rep_team_drill_tags_tag_idx`
- `rep_team_drills_org_idx`
- `rep_team_drills_org_shared_name_uniq`
- `rep_team_drills_pkey`
- `rep_team_drills_team_idx`
- `rep_team_drills_team_name_uniq`
- `rep_team_eval_sessions_event_idx`
- `rep_team_events_family_shared_idx`
- `rep_team_plan_template_tags_pkey`
- `rep_team_plan_template_tags_tag_idx`
- `rep_team_plan_templates_name_uniq`
- `rep_team_plan_templates_org_idx`
- `rep_team_plan_templates_pkey`
- `rep_team_plan_templates_team_idx`
- `rep_teams_family_calendar_token_uniq`
- `rep_teams_family_link_token_uniq`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (45)
- `family_consents.family_consents_org_id_fkey`
- `family_consents.family_consents_pkey`
- `family_consents.family_consents_user_id_fkey`
- `family_email_optouts.family_email_optouts_org_id_fkey`
- `family_email_optouts.family_email_optouts_pkey`
- `family_links.family_links_approved_by_user_id_fkey`
- `family_links.family_links_calendar_token_hash_key`
- `family_links.family_links_claim_token_hash_key`
- `family_links.family_links_invited_by_user_id_fkey`
- `family_links.family_links_org_id_fkey`
- `family_links.family_links_pkey`
- `family_links.family_links_player_id_fkey`
- `family_links.family_links_rep_team_id_fkey`
- `family_links.family_links_user_id_fkey`
- `family_recap_views.family_recap_views_link_id_fkey`
- `family_recap_views.family_recap_views_org_id_fkey`
- `family_recap_views.family_recap_views_pkey`
- `family_recap_views.family_recap_views_program_year_id_fkey`
- `family_recap_views.family_recap_views_rep_team_id_fkey`
- `no_login_rate_limits.no_login_rate_limits_pkey`
- `rep_player_development_goals.rep_player_development_goals_tag_id_fkey`
- `rep_player_tryout_baselines.rep_player_tryout_baselines_org_id_fkey`
- `rep_player_tryout_baselines.rep_player_tryout_baselines_pkey`
- `rep_player_tryout_baselines.rep_player_tryout_baselines_program_year_id_fkey`
- `rep_player_tryout_baselines.rep_player_tryout_baselines_roster_player_id_fkey`
- `rep_player_tryout_baselines.rep_player_tryout_baselines_seeded_by_fkey`
- `rep_player_tryout_baselines.rep_player_tryout_baselines_team_id_fkey`
- `rep_player_tryout_baselines.rep_player_tryout_baselines_tryout_registration_id_fkey`
- `rep_team_drill_tags.rep_team_drill_tags_drill_id_fkey`
- `rep_team_drill_tags.rep_team_drill_tags_pkey`
- `rep_team_drill_tags.rep_team_drill_tags_tag_id_fkey`
- `rep_team_drills.rep_team_drills_created_by_fkey`
- `rep_team_drills.rep_team_drills_org_id_fkey`
- `rep_team_drills.rep_team_drills_pkey`
- `rep_team_drills.rep_team_drills_team_id_fkey`
- `rep_team_evaluation_sessions.rep_team_evaluation_sessions_event_id_fkey`
- `rep_team_events.rep_team_events_family_shared_by_fkey`
- `rep_team_plan_template_tags.rep_team_plan_template_tags_pkey`
- `rep_team_plan_template_tags.rep_team_plan_template_tags_tag_id_fkey`
- `rep_team_plan_template_tags.rep_team_plan_template_tags_template_id_fkey`
- `rep_team_plan_templates.rep_team_plan_templates_created_by_fkey`
- `rep_team_plan_templates.rep_team_plan_templates_org_id_fkey`
- `rep_team_plan_templates.rep_team_plan_templates_pkey`
- `rep_team_plan_templates.rep_team_plan_templates_team_id_fkey`
- `rep_teams.rep_teams_family_link_created_by_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (18)
- `family_consents.family_consents_basis_check`
- `family_consents.family_consents_scope_check`
- `family_links.family_links_role_check`
- `family_links.family_links_role_player_ck`
- `family_links.family_links_status_check`
- `family_links.family_links_verified_via_check`
- `rep_player_tryout_baselines.rep_player_tryout_baselines_snapshot_check`
- `rep_team_drills.rep_team_drills_coaching_points_check`
- `rep_team_drills.rep_team_drills_description_check`
- `rep_team_drills.rep_team_drills_equipment_check`
- `rep_team_drills.rep_team_drills_goal_check`
- `rep_team_drills.rep_team_drills_name_check`
- `rep_team_drills.rep_team_drills_setup_check`
- `rep_team_drills.rep_team_drills_usual_minutes_check`
- `rep_team_events.rep_team_events_practice_recap_len`
- `rep_team_plan_templates.rep_team_plan_templates_name_check`
- `rep_team_plan_templates.rep_team_plan_templates_plan_check`
- `rep_teams.rep_teams_schedule_visibility_ck`

### CHECK only in PROD (0)
_none_

