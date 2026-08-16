# Dev vs Prod — structural drift

**Generated:** 2026-08-16 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 32 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 1 | 0 | — |
| Columns | 11 | 0 | 1 |
| Indexes | 7 | 1 | 0 |
| Constraints | 8 | 0 | — |
| RLS / CHECK | 3 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (1)
- `rep_team_fundraiser_tags`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (11)
- `budget_items.team_id`
- `rep_fundraisers.kind`
- `rep_fundraisers.sponsor_status`
- `rep_program_years.default_player_credit_percent`
- `rep_team_expenses.balance_entry_id`
- `rep_team_expenses.budget_category_id`
- `rep_team_expenses.budget_item_id`
- `rep_team_expenses.deposit_entry_id`
- `rep_team_fundraiser_tags.created_at`
- `rep_team_fundraiser_tags.fundraiser_id`
- `rep_team_fundraiser_tags.tag_id`

### Only in PROD (0)
_none_

### Type/nullability/default changed (1)
- `rep_fundraiser_entries.player_id` — dev: `uuid|uuid|YES|` | prod: `uuid|uuid|NO|`

## Indexes
### Only in DEV (7)
- `budget_items_team_idx`
- `budget_items_unique_scope_name`
- `idx_rep_team_expenses_balance_entry`
- `idx_rep_team_expenses_budget_item`
- `idx_rep_team_expenses_deposit_entry`
- `rep_team_fundraiser_tags_pkey`
- `rep_team_fundraiser_tags_tag_idx`

### Only in PROD (1)
- `budget_items_unique_org_name`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (8)
- `budget_items.budget_items_team_id_fkey`
- `rep_team_expenses.rep_team_expenses_balance_entry_id_fkey`
- `rep_team_expenses.rep_team_expenses_budget_category_id_fkey`
- `rep_team_expenses.rep_team_expenses_budget_item_id_fkey`
- `rep_team_expenses.rep_team_expenses_deposit_entry_id_fkey`
- `rep_team_fundraiser_tags.rep_team_fundraiser_tags_fundraiser_id_fkey`
- `rep_team_fundraiser_tags.rep_team_fundraiser_tags_pkey`
- `rep_team_fundraiser_tags.rep_team_fundraiser_tags_tag_id_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (3)
- `rep_fundraisers.rep_fundraisers_kind_check`
- `rep_fundraisers.rep_fundraisers_sponsor_status_check`
- `rep_program_years.rep_program_years_default_credit_check`

### CHECK only in PROD (0)
_none_

