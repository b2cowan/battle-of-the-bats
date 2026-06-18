-- 134: custom playoff round (column) names.
--
-- Bracket display columns are named automatically from structure (Semifinals,
-- Finals, Round N — see lib/playoff-bracket.ts computeBracketColumns). This adds
-- an OPTIONAL per-game override so an organizer can name a round in the bracket
-- builder ("Championship", "Gold Final", "Bronze") and have it persist to the
-- saved view, the public fan bracket, and the PDF.
--
-- Stored per game (every game in a column carries the same label, written together
-- by the save-bracket diff) so the label travels with the games and survives
-- structural recompute. Null = use the auto-derived round name. Additive,
-- nullable, no backfill — safe + reversible (drop the column to restore).

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS round_label text;
