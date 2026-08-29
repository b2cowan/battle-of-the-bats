# Dev vs Prod — structural drift

**Generated:** 2026-08-29 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 40 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 1 | 0 | — |
| Columns | 12 | 9 | 0 |
| Indexes | 5 | 2 | 0 |
| Constraints | 6 | 2 | — |
| RLS / CHECK | 3 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (1)
- `rep_fundraiser_credit_plan`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (12)
- `rep_fundraiser_credit_plan.created_at`
- `rep_fundraiser_credit_plan.fundraiser_id`
- `rep_fundraiser_credit_plan.id`
- `rep_fundraiser_credit_plan.org_id`
- `rep_fundraiser_credit_plan.player_id`
- `rep_fundraiser_credit_plan.share_unit`
- `rep_fundraiser_credit_plan.share_value`
- `rep_fundraiser_credit_plan.team_id`
- `rep_fundraiser_credit_plan.updated_at`
- `rep_fundraiser_entries.method`
- `rep_fundraisers.expected_by`
- `rep_fundraisers.pledged_amount`

### Only in PROD (9)
- `rep_team_expenses.balance_amount`
- `rep_team_expenses.balance_due_date`
- `rep_team_expenses.balance_entry_id`
- `rep_team_expenses.balance_paid_at`
- `rep_team_expenses.deposit_amount`
- `rep_team_expenses.deposit_due_date`
- `rep_team_expenses.deposit_entry_id`
- `rep_team_expenses.deposit_paid_at`
- `rep_team_expenses.expense_paid_at`

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (5)
- `rep_fundraiser_credit_plan_fundraiser_id_player_id_key`
- `rep_fundraiser_credit_plan_fundraiser_idx`
- `rep_fundraiser_credit_plan_org_idx`
- `rep_fundraiser_credit_plan_pkey`
- `rep_fundraiser_credit_plan_player_idx`

### Only in PROD (2)
- `idx_rep_team_expenses_balance_entry`
- `idx_rep_team_expenses_deposit_entry`

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (6)
- `rep_fundraiser_credit_plan.rep_fundraiser_credit_plan_fundraiser_id_fkey`
- `rep_fundraiser_credit_plan.rep_fundraiser_credit_plan_fundraiser_id_player_id_key`
- `rep_fundraiser_credit_plan.rep_fundraiser_credit_plan_org_id_fkey`
- `rep_fundraiser_credit_plan.rep_fundraiser_credit_plan_pkey`
- `rep_fundraiser_credit_plan.rep_fundraiser_credit_plan_player_id_fkey`
- `rep_fundraiser_credit_plan.rep_fundraiser_credit_plan_team_id_fkey`

### Only in PROD (2)
- `rep_team_expenses.rep_team_expenses_balance_entry_id_fkey`
- `rep_team_expenses.rep_team_expenses_deposit_entry_id_fkey`

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (3)
- `rep_fundraiser_credit_plan.rep_fundraiser_credit_plan_share_unit_check`
- `rep_fundraiser_credit_plan.rep_fundraiser_credit_plan_share_value_check`
- `rep_fundraiser_entries.rep_fundraiser_entries_method_check`

### CHECK only in PROD (0)
_none_

