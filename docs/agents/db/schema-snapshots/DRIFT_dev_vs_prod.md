# Dev vs Prod — structural drift

**Generated:** 2026-08-16 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 90 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 3 | 0 | — |
| Columns | 40 | 0 | 1 |
| Indexes | 14 | 1 | 0 |
| Constraints | 22 | 0 | — |
| RLS / CHECK | 9 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (3)
- `rep_team_fundraiser_tags`
- `rep_team_money_in`
- `rep_team_staff_memberships`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (40)
- `budget_categories.sports`
- `budget_items.direction`
- `budget_items.sports`
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
- `rep_team_money_in.accounting_entry_id`
- `rep_team_money_in.amount`
- `rep_team_money_in.budget_category_id`
- `rep_team_money_in.budget_item_id`
- `rep_team_money_in.created_at`
- `rep_team_money_in.created_by`
- `rep_team_money_in.description`
- `rep_team_money_in.entry_kind`
- `rep_team_money_in.id`
- `rep_team_money_in.notes`
- `rep_team_money_in.org_id`
- `rep_team_money_in.program_year_id`
- `rep_team_money_in.received_date`
- `rep_team_money_in.received_from`
- `rep_team_money_in.team_id`
- `rep_team_money_in.updated_at`
- `rep_team_staff_memberships.capabilities`
- `rep_team_staff_memberships.coach_role`
- `rep_team_staff_memberships.created_at`
- `rep_team_staff_memberships.id`
- `rep_team_staff_memberships.org_id`
- `rep_team_staff_memberships.revoked_at`
- `rep_team_staff_memberships.revoked_by`
- `rep_team_staff_memberships.status`
- `rep_team_staff_memberships.team_id`
- `rep_team_staff_memberships.user_id`

### Only in PROD (0)
_none_

### Type/nullability/default changed (1)
- `rep_fundraiser_entries.player_id` — dev: `uuid|uuid|YES|` | prod: `uuid|uuid|NO|`

## Indexes
### Only in DEV (14)
- `budget_items_team_idx`
- `budget_items_unique_scope_name`
- `idx_rep_team_expenses_balance_entry`
- `idx_rep_team_expenses_budget_item`
- `idx_rep_team_expenses_deposit_entry`
- `idx_rep_team_money_in_item`
- `idx_rep_team_money_in_year`
- `rep_team_fundraiser_tags_pkey`
- `rep_team_fundraiser_tags_tag_idx`
- `rep_team_money_in_pkey`
- `rep_team_staff_memberships_org_user_idx`
- `rep_team_staff_memberships_pkey`
- `rep_team_staff_memberships_team_idx`
- `rep_team_staff_memberships_team_user_key`

### Only in PROD (1)
- `budget_items_unique_org_name`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (22)
- `budget_items.budget_items_team_id_fkey`
- `rep_team_expenses.rep_team_expenses_balance_entry_id_fkey`
- `rep_team_expenses.rep_team_expenses_budget_category_id_fkey`
- `rep_team_expenses.rep_team_expenses_budget_item_id_fkey`
- `rep_team_expenses.rep_team_expenses_deposit_entry_id_fkey`
- `rep_team_fundraiser_tags.rep_team_fundraiser_tags_fundraiser_id_fkey`
- `rep_team_fundraiser_tags.rep_team_fundraiser_tags_pkey`
- `rep_team_fundraiser_tags.rep_team_fundraiser_tags_tag_id_fkey`
- `rep_team_money_in.rep_team_money_in_accounting_entry_id_fkey`
- `rep_team_money_in.rep_team_money_in_budget_category_id_fkey`
- `rep_team_money_in.rep_team_money_in_budget_item_id_fkey`
- `rep_team_money_in.rep_team_money_in_created_by_fkey`
- `rep_team_money_in.rep_team_money_in_org_id_fkey`
- `rep_team_money_in.rep_team_money_in_pkey`
- `rep_team_money_in.rep_team_money_in_program_year_id_fkey`
- `rep_team_money_in.rep_team_money_in_team_id_fkey`
- `rep_team_staff_memberships.rep_team_staff_memberships_org_id_fkey`
- `rep_team_staff_memberships.rep_team_staff_memberships_pkey`
- `rep_team_staff_memberships.rep_team_staff_memberships_revoked_by_fkey`
- `rep_team_staff_memberships.rep_team_staff_memberships_team_id_fkey`
- `rep_team_staff_memberships.rep_team_staff_memberships_team_user_key`
- `rep_team_staff_memberships.rep_team_staff_memberships_user_id_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (9)
- `budget_items.budget_items_direction_check`
- `rep_fundraisers.rep_fundraisers_kind_check`
- `rep_fundraisers.rep_fundraisers_sponsor_status_check`
- `rep_program_years.rep_program_years_default_credit_check`
- `rep_team_money_in.rep_team_money_in_amount_check`
- `rep_team_money_in.rep_team_money_in_entry_kind_check`
- `rep_team_money_in.rep_team_money_in_received_from_check`
- `rep_team_staff_memberships.rep_team_staff_memberships_coach_role_check`
- `rep_team_staff_memberships.rep_team_staff_memberships_status_check`

### CHECK only in PROD (0)
_none_

