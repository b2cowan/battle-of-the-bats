# Dev vs Prod — structural drift

**Generated:** 2026-09-07 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 30 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 1 | 0 | — |
| Columns | 11 | 0 | 0 |
| Indexes | 6 | 0 | 0 |
| Constraints | 7 | 0 | — |
| RLS / CHECK | 4 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (1)
- `rep_dues_payout_credits`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (11)
- `budget_categories.team_id`
- `budget_items.actual_source`
- `notifications.cleared_at`
- `rep_budget_lines.split_mode`
- `rep_dues_payout_credits.amount`
- `rep_dues_payout_credits.created_at`
- `rep_dues_payout_credits.credit_id`
- `rep_dues_payout_credits.id`
- `rep_dues_payout_credits.org_id`
- `rep_dues_payout_credits.payout_id`
- `rep_dues_payout_credits.team_id`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (6)
- `budget_categories_team_idx`
- `idx_dues_payout_credits_credit`
- `idx_dues_payout_credits_org_team`
- `idx_dues_payout_credits_payout`
- `rep_dues_payout_credits_payout_id_credit_id_key`
- `rep_dues_payout_credits_pkey`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (7)
- `budget_categories.budget_categories_team_id_fkey`
- `rep_dues_payout_credits.rep_dues_payout_credits_credit_id_fkey`
- `rep_dues_payout_credits.rep_dues_payout_credits_org_id_fkey`
- `rep_dues_payout_credits.rep_dues_payout_credits_payout_id_credit_id_key`
- `rep_dues_payout_credits.rep_dues_payout_credits_payout_id_fkey`
- `rep_dues_payout_credits.rep_dues_payout_credits_pkey`
- `rep_dues_payout_credits.rep_dues_payout_credits_team_id_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (4)
- `budget_items.budget_items_actual_source_check`
- `budget_items.budget_items_out_is_typed_check`
- `rep_budget_lines.rep_budget_lines_split_mode_check`
- `rep_dues_payout_credits.rep_dues_payout_credits_amount_check`

### CHECK only in PROD (0)
_none_

