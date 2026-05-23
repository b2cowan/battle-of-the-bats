-- Tournament scorekeeper experience foundation.
--
-- Allows an individual tournament to override the organization-wide score
-- finalization setting. NULL means inherit organizations.require_score_finalization.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS require_score_finalization boolean;
