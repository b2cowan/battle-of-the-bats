-- 142: rep_roster_players.display_order — manual roster ordering (Coach Premium Upgrade — Phase 3d).
--
-- Parity with the free Basic roster, which has basic_coach_team_players.display_order and lets a coach
-- drag players into a custom order (jersey/lineup order). The Premium roster had no manual order and
-- always sorted by player_last_name. This adds the same ordering column so a Premium coach can
-- drag-reorder their roster; the order persists, carries on free->Premium upgrade, and carries into
-- the next season (both copy paths create players in source order, which append() preserves).
--
-- Additive + reversible. NOT NULL DEFAULT 0: existing rows get 0 and keep sorting by player_last_name
-- via the app-layer tiebreak until a coach reorders, at which point every shown row is written an
-- explicit 0..n order. New players append at the end (max(display_order)+1), mirroring the Basic roster.

alter table public.rep_roster_players
  add column if not exists display_order integer not null default 0;
