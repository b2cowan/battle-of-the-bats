-- 265: a tryout candidate remembers where they played last season.
--
-- The coach's Add player dialog on tryout check-in is being widened from three fields to the full
-- set the record already holds (COACH_ADD_PLAYER_FORM_BUILD_PROMPT.md, owner-approved 2026-08-26).
-- Every field on that form already exists on this table — date of birth, guardian name, phone,
-- notes — EXCEPT this one, which nothing in the product has ever stored.
--
-- ⚠ FREE TEXT, and that is the decision, not an omission. The obvious shape is a dropdown of levels
-- (A / AA / AAA / Rep / House), and it is wrong: those letters mean different things in different
-- sports and different associations, and this product is deliberately sport-neutral (the Sport Pack
-- in lib/sports.ts exists precisely so vocabulary is never hard-coded). A fixed list would be wrong
-- for somebody on day one, and a player arriving from another club — the exact case this field is
-- FOR — would have nowhere to put the truth. One line of the family's own words travels anywhere:
-- "Oakville Rangers 11U", "first year", "house league".
--
-- ⚠ IT IS A CLAIM, NOT A VERIFIED FACT, and nothing downstream may treat it as one. For a returning
-- player the coach's form pre-fills it from the prior season and says so, but it stays editable —
-- and the pre-fill fires ONLY for a player who was on the team's ROSTER last season. A candidate
-- who tried out and did not make it is not someone who "played for" the team, and filling the team's
-- name in for them would put a false sentence in front of the coach about a kid who was cut.
--
-- Nullable forever, and NULL is not "" — NULL means nobody was asked (every row that predates this,
-- plus the public form and the club-admin form, neither of which collects it). An empty string would
-- mean the coach was asked and left it blank. Only the coach's form writes this today.

ALTER TABLE rep_tryout_registrations
  ADD COLUMN last_season_team text;

COMMENT ON COLUMN rep_tryout_registrations.last_season_team IS
  'Where this player played last season, in the family''s own words — free text, deliberately NOT a dropdown of levels (A/AA/AAA/Rep/House mean different things per sport and association, and this product is sport-neutral). A CLAIM, never a verified fact: the coach''s Add player form pre-fills it for a player who was on this team''s roster last season and labels it as such, but never locks it. NULL = nobody was asked (pre-mig rows, the public form, the club-admin form); an empty string = asked and left blank.';
