# Dev vs Prod — structural drift

**Generated:** 2026-10-09 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 76 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 2 | 0 | — |
| Columns | 30 | 0 | 0 |
| Indexes | 18 | 1 | 0 |
| Constraints | 16 | 0 | — |
| RLS / CHECK | 8 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (2)
- `org_fiscal_year_reopenings`
- `org_fiscal_years`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (30)
- `accounting_entries.written_on`
- `org_budget_lines.fiscal_year_id`
- `org_fiscal_year_reopenings.fiscal_year_id`
- `org_fiscal_year_reopenings.id`
- `org_fiscal_year_reopenings.org_id`
- `org_fiscal_year_reopenings.reason`
- `org_fiscal_year_reopenings.reopened_at`
- `org_fiscal_year_reopenings.reopened_by`
- `org_fiscal_year_reopenings.was_closed_at`
- `org_fiscal_year_reopenings.was_closed_by`
- `org_fiscal_year_reopenings.was_closing_balance`
- `org_fiscal_year_reopenings.was_closing_snapshot`
- `org_fiscal_years.closed_at`
- `org_fiscal_years.closed_by`
- `org_fiscal_years.closing_balance`
- `org_fiscal_years.closing_snapshot`
- `org_fiscal_years.created_at`
- `org_fiscal_years.first_day`
- `org_fiscal_years.id`
- `org_fiscal_years.last_day`
- `org_fiscal_years.name`
- `org_fiscal_years.org_id`
- `org_fiscal_years.updated_at`
- `organizations.fiscal_first_month`
- `rep_allocation_installments.carried_by_program_year_id`
- `rep_cost_allocations.notes`
- `rep_team_events.org_venue_facility_id`
- `rep_team_events.org_venue_id`
- `rep_tryout_sessions.org_venue_facility_id`
- `rep_tryout_sessions.org_venue_id`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (18)
- `org_budget_lines_fiscal_year_idx`
- `org_budget_lines_one_word_per_fiscal_year`
- `org_fiscal_year_reopenings_by_idx`
- `org_fiscal_year_reopenings_org_idx`
- `org_fiscal_year_reopenings_pkey`
- `org_fiscal_year_reopenings_was_by_idx`
- `org_fiscal_year_reopenings_year_idx`
- `org_fiscal_years_closed_by_idx`
- `org_fiscal_years_one_name`
- `org_fiscal_years_one_start`
- `org_fiscal_years_pkey`
- `rep_allocation_installments_carried_by_idx`
- `rep_team_events_club_booking_idx`
- `rep_team_events_org_venue_facility_idx`
- `rep_team_events_org_venue_idx`
- `rep_tryout_sessions_club_booking_idx`
- `rep_tryout_sessions_org_venue_facility_idx`
- `rep_tryout_sessions_org_venue_idx`

### Only in PROD (1)
- `org_budget_lines_one_line_per_item`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (16)
- `org_budget_lines.org_budget_lines_fiscal_year_id_fkey`
- `org_fiscal_year_reopenings.org_fiscal_year_reopenings_fiscal_year_id_fkey`
- `org_fiscal_year_reopenings.org_fiscal_year_reopenings_org_id_fkey`
- `org_fiscal_year_reopenings.org_fiscal_year_reopenings_pkey`
- `org_fiscal_year_reopenings.org_fiscal_year_reopenings_reopened_by_fkey`
- `org_fiscal_year_reopenings.org_fiscal_year_reopenings_was_closed_by_fkey`
- `org_fiscal_years.org_fiscal_years_closed_by_fkey`
- `org_fiscal_years.org_fiscal_years_one_name`
- `org_fiscal_years.org_fiscal_years_one_start`
- `org_fiscal_years.org_fiscal_years_org_id_fkey`
- `org_fiscal_years.org_fiscal_years_pkey`
- `rep_allocation_installments.rep_allocation_installments_carried_by_program_year_id_fkey`
- `rep_team_events.rep_team_events_org_venue_facility_id_fkey`
- `rep_team_events.rep_team_events_org_venue_id_fkey`
- `rep_tryout_sessions.rep_tryout_sessions_org_venue_facility_id_fkey`
- `rep_tryout_sessions.rep_tryout_sessions_org_venue_id_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (8)
- `org_fiscal_year_reopenings.org_fiscal_year_reopenings_reason_check`
- `org_fiscal_years.org_fiscal_years_close_whole`
- `org_fiscal_years.org_fiscal_years_name_check`
- `org_fiscal_years.org_fiscal_years_span`
- `org_fiscal_years.org_fiscal_years_whole_months`
- `organizations.organizations_fiscal_first_month_check`
- `rep_cost_allocations.rep_cost_allocations_notes_length_check`
- `rep_team_events.rep_team_events_place_or_club_venue`

### CHECK only in PROD (0)
_none_

