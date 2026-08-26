-- 263: a tryout remembers that names were shown (owner ruling 2026-08-25).
--
-- Blind evaluation used to be a ONE-WAY door: `is_anonymous` started true and the only permitted
-- change was true -> false, guarded by a 409 in the sessions route. That guard is being removed —
-- coaches who do not want blind scoring at all were having to hunt three stages forward to switch
-- it off, and many simply want names and bib numbers together.
--
-- But the one-way rule was carrying a second job nobody wrote down: it made `is_anonymous` a piece
-- of EVIDENCE. The tryout report's fairness section says "blind: on", and a parent reading it is
-- being told the scoring was done without names. The instant the flag can be flipped back, that
-- sentence stops being a fact about the tryout and becomes a fact about the moment of export — a
-- tryout scored with every name visible could be re-hidden and printed as blind.
--
-- `names_shown_at` is the fact the switch cannot erase: stamped the FIRST time names are shown and
-- never cleared, never re-stamped. The report reads it, not the live flag, to decide whether it may
-- claim the tryout was blind throughout. NULL therefore means exactly one thing — nobody has ever
-- seen a name against a score on this tryout.
--
-- Deliberately a timestamp rather than a boolean: "when" answers the only follow-up question a
-- coach or a parent actually asks ("was that before or after the scores went in?"), and a boolean
-- could not be widened later without a second migration.

ALTER TABLE rep_tryouts
  ADD COLUMN names_shown_at timestamptz;

-- BACKFILL, and it is not optional. Every tryout that was already revealed under the old one-way
-- rule has is_anonymous = false and, without this, a NULL stamp — which the report reads as "names
-- were never shown". A brand-new column would therefore have made the report LIE about every
-- historical tryout the moment it started trusting it, and in the safest-sounding direction.
-- `updated_at` is the closest honest timestamp available (the reveal was the last write for most of
-- these rows); it is an approximation, and the report says "names were shown" rather than dating
-- the claim precisely when it is working from one.
UPDATE rep_tryouts SET names_shown_at = updated_at WHERE is_anonymous = false AND names_shown_at IS NULL;

COMMENT ON COLUMN rep_tryouts.names_shown_at IS
  'The first moment player names were shown against scores on this tryout. Stamped once and never cleared, even when the coach switches back to bib-only, because it is the tryout report''s evidence for the "blind throughout" claim. NULL = names have never been shown. Distinct from is_anonymous, which is the CURRENT view state and is freely switchable.';
