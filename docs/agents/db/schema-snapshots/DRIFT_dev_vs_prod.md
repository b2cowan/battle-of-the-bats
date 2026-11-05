# Dev vs Prod — structural drift

**Generated:** 2026-11-05 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 8 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 0 | 0 | — |
| Columns | 6 | 0 | 0 |
| Indexes | 0 | 0 | 0 |
| Constraints | 1 | 0 | — |
| RLS / CHECK | 1 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

## Columns
### Only in DEV (6)
- `org_children.emergency_contact_name`
- `org_children.emergency_contact_phone`
- `org_children.medical_notes`
- `rep_document_templates.validity`
- `rep_roster_players.health_confirmed_at`
- `rep_roster_players.health_confirmed_by`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (0)
_none_

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (1)
- `rep_roster_players.rep_roster_players_health_confirmed_by_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (1)
- `rep_document_templates.rep_document_templates_validity_check`

### CHECK only in PROD (0)
_none_

