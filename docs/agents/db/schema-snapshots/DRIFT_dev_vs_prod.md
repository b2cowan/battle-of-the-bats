# Dev vs Prod — structural drift

**Generated:** 2026-08-18 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 82 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 4 | 0 | — |
| Columns | 38 | 0 | 0 |
| Indexes | 18 | 0 | 0 |
| Constraints | 19 | 0 | — |
| RLS / CHECK | 3 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (4)
- `org_people`
- `org_person_emails`
- `org_person_match_rejections`
- `org_person_merges`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (38)
- `family_links.person_id`
- `league_registrations.org_id`
- `league_registrations.person_id`
- `league_registrations.waiver_accepted_at`
- `org_people.created_at`
- `org_people.email_normalized`
- `org_people.first_name`
- `org_people.id`
- `org_people.last_name`
- `org_people.org_id`
- `org_people.phone`
- `org_people.updated_at`
- `org_person_emails.created_at`
- `org_person_emails.email_normalized`
- `org_person_emails.first_seen_at`
- `org_person_emails.id`
- `org_person_emails.is_current`
- `org_person_emails.last_seen_at`
- `org_person_emails.org_id`
- `org_person_emails.person_id`
- `org_person_emails.updated_at`
- `org_person_match_rejections.created_at`
- `org_person_match_rejections.id`
- `org_person_match_rejections.org_id`
- `org_person_match_rejections.person_a_id`
- `org_person_match_rejections.person_b_id`
- `org_person_match_rejections.rejected_at`
- `org_person_match_rejections.rejected_by`
- `org_person_merges.created_at`
- `org_person_merges.id`
- `org_person_merges.kept_person_id`
- `org_person_merges.merged_at`
- `org_person_merges.merged_by`
- `org_person_merges.merged_person_id`
- `org_person_merges.merged_snapshot`
- `org_person_merges.org_id`
- `rep_roster_players.person_id`
- `rep_tryout_registrations.person_id`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (18)
- `family_links_person_id_idx`
- `league_registrations_org_id_idx`
- `league_registrations_person_id_idx`
- `org_people_org_email_uniq`
- `org_people_pkey`
- `org_person_emails_one_current_uniq`
- `org_person_emails_org_email_uniq`
- `org_person_emails_person_id_idx`
- `org_person_emails_pkey`
- `org_person_match_rejections_pair_uniq`
- `org_person_match_rejections_person_a_idx`
- `org_person_match_rejections_person_b_idx`
- `org_person_match_rejections_pkey`
- `org_person_merges_kept_idx`
- `org_person_merges_org_id_idx`
- `org_person_merges_pkey`
- `rep_roster_players_person_id_idx`
- `rep_tryout_registrations_person_id_idx`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (19)
- `family_links.family_links_person_id_fkey`
- `league_registrations.league_registrations_org_id_fkey`
- `league_registrations.league_registrations_person_id_fkey`
- `org_people.org_people_org_id_fkey`
- `org_people.org_people_pkey`
- `org_person_emails.org_person_emails_org_id_fkey`
- `org_person_emails.org_person_emails_person_id_fkey`
- `org_person_emails.org_person_emails_pkey`
- `org_person_match_rejections.org_person_match_rejections_org_id_fkey`
- `org_person_match_rejections.org_person_match_rejections_person_a_id_fkey`
- `org_person_match_rejections.org_person_match_rejections_person_b_id_fkey`
- `org_person_match_rejections.org_person_match_rejections_pkey`
- `org_person_match_rejections.org_person_match_rejections_rejected_by_fkey`
- `org_person_merges.org_person_merges_kept_person_id_fkey`
- `org_person_merges.org_person_merges_merged_by_fkey`
- `org_person_merges.org_person_merges_org_id_fkey`
- `org_person_merges.org_person_merges_pkey`
- `rep_roster_players.rep_roster_players_person_id_fkey`
- `rep_tryout_registrations.rep_tryout_registrations_person_id_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (3)
- `org_people.org_people_email_normalized_check`
- `org_person_emails.org_person_emails_email_normalized_check`
- `org_person_match_rejections.org_person_match_rejections_ordered`

### CHECK only in PROD (0)
_none_

