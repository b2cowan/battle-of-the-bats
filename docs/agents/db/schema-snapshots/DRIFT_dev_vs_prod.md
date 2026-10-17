# Dev vs Prod — structural drift

**Generated:** 2026-10-17 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 49 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 3 | 0 | — |
| Columns | 19 | 0 | 0 |
| Indexes | 12 | 0 | 0 |
| Constraints | 11 | 0 | — |
| RLS / CHECK | 4 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (3)
- `family_coach_asks`
- `family_messages`
- `org_person_reattachments`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (19)
- `family_coach_asks.id`
- `family_coach_asks.org_id`
- `family_coach_asks.player_count`
- `family_coach_asks.recipient_count`
- `family_coach_asks.sent_at`
- `family_coach_asks.sent_by`
- `family_coach_asks.team_ids`
- `family_messages.id`
- `family_messages.org_id`
- `family_messages.person_id`
- `family_messages.sent_at`
- `family_messages.sent_by`
- `org_person_reattachments.at`
- `org_person_reattachments.from_person_id`
- `org_person_reattachments.id`
- `org_person_reattachments.org_id`
- `org_person_reattachments.source_id`
- `org_person_reattachments.source_table`
- `org_person_reattachments.to_person_id`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (12)
- `family_coach_asks_org_sent_idx`
- `family_coach_asks_pkey`
- `family_messages_org_idx`
- `family_messages_person_sent_idx`
- `family_messages_pkey`
- `notifications_org_needs_attention_idx`
- `notifications_user_needs_attention_idx`
- `org_person_reattachments_from_idx`
- `org_person_reattachments_move_uniq`
- `org_person_reattachments_org_idx`
- `org_person_reattachments_pkey`
- `org_person_reattachments_to_idx`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (11)
- `family_coach_asks.family_coach_asks_org_id_fkey`
- `family_coach_asks.family_coach_asks_pkey`
- `family_coach_asks.family_coach_asks_sent_by_fkey`
- `family_messages.family_messages_org_id_fkey`
- `family_messages.family_messages_person_id_fkey`
- `family_messages.family_messages_pkey`
- `family_messages.family_messages_sent_by_fkey`
- `org_person_reattachments.org_person_reattachments_from_person_id_fkey`
- `org_person_reattachments.org_person_reattachments_org_id_fkey`
- `org_person_reattachments.org_person_reattachments_pkey`
- `org_person_reattachments.org_person_reattachments_to_person_id_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (4)
- `family_coach_asks.family_coach_asks_player_count_check`
- `family_coach_asks.family_coach_asks_recipient_count_check`
- `org_person_reattachments.org_person_reattachments_check`
- `org_person_reattachments.org_person_reattachments_source_table_check`

### CHECK only in PROD (0)
_none_

