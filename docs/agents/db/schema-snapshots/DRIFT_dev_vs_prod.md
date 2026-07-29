# Dev vs Prod — structural drift

**Generated:** 2026-07-29 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 33 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 1 | 0 | — |
| Columns | 20 | 0 | 0 |
| Indexes | 5 | 0 | 0 |
| Constraints | 6 | 0 | — |
| RLS / CHECK | 1 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (1)
- `game_change_notices`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (20)
- `chat_room_members.history_visible_from`
- `game_change_notices.created_at`
- `game_change_notices.game_id`
- `game_change_notices.hold_until`
- `game_change_notices.id`
- `game_change_notices.kind`
- `game_change_notices.org_id`
- `game_change_notices.sent_at`
- `game_change_notices.superseded_at`
- `game_change_notices.team_id`
- `game_change_notices.tournament_id`
- `game_change_notices.was_date`
- `game_change_notices.was_location`
- `game_change_notices.was_time`
- `rep_team_events.source_tournament_game_id`
- `tournaments.chat_reminder_last_sent_at`
- `tournaments.chat_reminder_last_sent_by`
- `tournaments.chat_reminder_last_sent_count`
- `user_preferences.coach_setup_hints_off`
- `user_preferences.coach_tour_dismissed_at`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (5)
- `game_change_notices_game_idx`
- `game_change_notices_pending_idx`
- `game_change_notices_pkey`
- `game_change_notices_recent_sent_idx`
- `rep_team_events_src_tournament_game_uq`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (6)
- `game_change_notices.game_change_notices_game_id_fkey`
- `game_change_notices.game_change_notices_org_id_fkey`
- `game_change_notices.game_change_notices_pkey`
- `game_change_notices.game_change_notices_team_id_fkey`
- `game_change_notices.game_change_notices_tournament_id_fkey`
- `tournaments.tournaments_chat_reminder_last_sent_by_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (1)
- `game_change_notices.game_change_notices_kind_check`

### CHECK only in PROD (0)
_none_

