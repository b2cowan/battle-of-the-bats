# Dev vs Prod — structural drift

**Generated:** 2026-08-15 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 13 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 0 | 0 | — |
| Columns | 5 | 0 | 1 |
| Indexes | 2 | 0 | 0 |
| Constraints | 2 | 0 | — |
| RLS / CHECK | 3 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

## Columns
### Only in DEV (5)
- `rep_fundraisers.kind`
- `rep_fundraisers.sponsor_status`
- `rep_program_years.default_player_credit_percent`
- `rep_team_expenses.balance_entry_id`
- `rep_team_expenses.deposit_entry_id`

### Only in PROD (0)
_none_

### Type/nullability/default changed (1)
- `rep_fundraiser_entries.player_id` — dev: `uuid|uuid|YES|` | prod: `uuid|uuid|NO|`

## Indexes
### Only in DEV (2)
- `idx_rep_team_expenses_balance_entry`
- `idx_rep_team_expenses_deposit_entry`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (2)
- `rep_team_expenses.rep_team_expenses_balance_entry_id_fkey`
- `rep_team_expenses.rep_team_expenses_deposit_entry_id_fkey`

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

