-- 137_games_bracket_label.sql
-- Per-game display name of the bracket/tier this game belongs to (e.g. "Gold",
-- "Tier 1"). NULL = an ungrouped single bracket. The structural/advancement key
-- stays games.bracket_id (one id per tier); bracket_label is purely the display
-- + grouping name, so a tier's name survives saves and the public + admin bracket
-- diagrams can split and title tiers. Set per-tier by the playoff generator and
-- by the manual inline editor's "split into tiers" path.

ALTER TABLE games ADD COLUMN IF NOT EXISTS bracket_label text;
