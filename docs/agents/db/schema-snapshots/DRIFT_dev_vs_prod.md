# Dev vs Prod — structural drift

**Generated:** 2026-09-28 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 6 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 0 | 0 | — |
| Columns | 2 | 0 | 1 |
| Indexes | 0 | 0 | 0 |
| Constraints | 0 | 0 | — |
| RLS / CHECK | 3 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

## Columns
### Only in DEV (2)
- `assistant_invite_tokens.coach_role`
- `assistant_invite_tokens.sent_by`

### Only in PROD (0)
_none_

### Type/nullability/default changed (1)
- `assistant_invite_tokens.program_year_id` — dev: `uuid|uuid|YES|` | prod: `uuid|uuid|NO|`

## Indexes
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (3)
- `assistant_invite_tokens.assistant_invite_tokens_coach_role_check`
- `assistant_invite_tokens.assistant_invite_tokens_head_coach_has_no_kind`
- `assistant_invite_tokens.assistant_invite_tokens_sent_by_check`

### CHECK only in PROD (0)
_none_

