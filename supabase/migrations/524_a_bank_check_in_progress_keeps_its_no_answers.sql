-- ---------------------------------------------------------------
-- Migration 524 — Bank check through a volunteer's eyes, S7 Part 2: a "No" to "Still waiting?" is kept with the work
-- (owner ruling 2026-11-22, the Part 2 question raised from walk §491 / WD2: "yes keep the No answer").
--
--   bank_check_drafts.answered_no_keys — the KEYS of the "Still waiting on {line}?" items the person answered No on this
--   statement (the item is in the bank now), so the card doesn't ask again when they come back, on any device. Keys only,
--   never a line's figures or words (the rule marked_keys follows, plan §0 A18). A new date clears them, as it clears the
--   marks; Start over and Save this check take the whole row.
--
-- Additive: a column with a default and the same cardinality ceiling as marked_keys (500). Code from before S7 Part 2 never
-- selects it by name, so it may go on production any time before the promote that ships the S7 Part 2 cards.
-- Re-runnable.
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.bank_check_drafts
  ADD COLUMN IF NOT EXISTS answered_no_keys text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_check_drafts_answered_no_count') THEN
    ALTER TABLE public.bank_check_drafts
      ADD CONSTRAINT bank_check_drafts_answered_no_count CHECK (cardinality(answered_no_keys) <= 500);
  END IF;
END $$;

COMMENT ON COLUMN public.bank_check_drafts.answered_no_keys IS
  'The keys of the "Still waiting?" items answered No on this statement (S7 Part 2, owner 2026-11-22): the card does not ask again. Keys only, never figures. A new date clears them.';

COMMIT;
