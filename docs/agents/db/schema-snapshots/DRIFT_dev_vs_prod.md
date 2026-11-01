# Dev vs Prod — structural drift

**Generated:** 2026-11-01 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 76 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 3 | 0 | — |
| Columns | 28 | 0 | 0 |
| Indexes | 17 | 0 | 0 |
| Constraints | 18 | 0 | — |
| RLS / CHECK | 9 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (3)
- `league_practice_emails`
- `league_practice_tells`
- `league_team_practices_told`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (28)
- `league_practice_emails.created_at`
- `league_practice_emails.division_id`
- `league_practice_emails.guardian_email`
- `league_practice_emails.id`
- `league_practice_emails.notice_id`
- `league_practice_emails.org_id`
- `league_practice_emails.registration_ids`
- `league_practice_emails.season_id`
- `league_practice_emails.status`
- `league_practice_emails.team_ids`
- `league_practice_emails.updated_at`
- `league_practice_tells.created_at`
- `league_practice_tells.division_id`
- `league_practice_tells.id`
- `league_practice_tells.kind`
- `league_practice_tells.notice_id`
- `league_practice_tells.org_id`
- `league_practice_tells.season_id`
- `league_practice_tells.snapshot`
- `league_practice_tells.team_id`
- `league_practice_tells.told_before`
- `league_team_practices_told.notice_id`
- `league_team_practices_told.org_id`
- `league_team_practices_told.season_id`
- `league_team_practices_told.snapshot`
- `league_team_practices_told.team_id`
- `league_team_practices_told.told_at`
- `league_team_practices_told.updated_at`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (17)
- `league_practice_emails_division_idx`
- `league_practice_emails_notice_id_guardian_email_key`
- `league_practice_emails_notice_idx`
- `league_practice_emails_open_idx`
- `league_practice_emails_org_idx`
- `league_practice_emails_pkey`
- `league_practice_emails_season_idx`
- `league_practice_tells_division_idx`
- `league_practice_tells_notice_id_team_id_key`
- `league_practice_tells_org_idx`
- `league_practice_tells_pkey`
- `league_practice_tells_season_idx`
- `league_practice_tells_team_idx`
- `league_team_practices_told_notice_idx`
- `league_team_practices_told_org_idx`
- `league_team_practices_told_pkey`
- `league_team_practices_told_season_idx`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (18)
- `league_practice_emails.league_practice_emails_division_id_fkey`
- `league_practice_emails.league_practice_emails_notice_id_fkey`
- `league_practice_emails.league_practice_emails_notice_id_guardian_email_key`
- `league_practice_emails.league_practice_emails_org_id_fkey`
- `league_practice_emails.league_practice_emails_pkey`
- `league_practice_emails.league_practice_emails_season_id_fkey`
- `league_practice_tells.league_practice_tells_division_id_fkey`
- `league_practice_tells.league_practice_tells_notice_id_fkey`
- `league_practice_tells.league_practice_tells_notice_id_team_id_key`
- `league_practice_tells.league_practice_tells_org_id_fkey`
- `league_practice_tells.league_practice_tells_pkey`
- `league_practice_tells.league_practice_tells_season_id_fkey`
- `league_practice_tells.league_practice_tells_team_id_fkey`
- `league_team_practices_told.league_team_practices_told_notice_id_fkey`
- `league_team_practices_told.league_team_practices_told_org_id_fkey`
- `league_team_practices_told.league_team_practices_told_pkey`
- `league_team_practices_told.league_team_practices_told_season_id_fkey`
- `league_team_practices_told.league_team_practices_told_team_id_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (9)
- `league_practice_emails.league_practice_emails_guardian_email_check`
- `league_practice_emails.league_practice_emails_registration_ids_check`
- `league_practice_emails.league_practice_emails_status_check`
- `league_practice_emails.league_practice_emails_team_ids_check`
- `league_practice_tells.league_practice_tells_check`
- `league_practice_tells.league_practice_tells_kind_check`
- `league_practice_tells.league_practice_tells_snapshot_check`
- `league_practice_tells.league_practice_tells_told_before_check`
- `league_team_practices_told.league_team_practices_told_snapshot_check`

### CHECK only in PROD (0)
_none_

