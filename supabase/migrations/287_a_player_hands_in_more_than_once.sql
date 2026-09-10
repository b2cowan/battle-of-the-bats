-- 287 — A player hands in to a drive as many times as it takes
-- (COACH_FUNDRAISER_MORE_THAN_ONCE_PLAN §5.1 — raised by the owner on the §157 walk and approved
-- on mockup `94c27428`, both 2026-09-10.)
--
-- THE RULING: a drive's board row is a PARTICIPANT carrying their total, not a single amount. A
-- player who sells six boxes in August and three more in September has handed in TWICE, and the
-- drive should hold both dated facts rather than one number the coach re-adds in their head over a
-- date that is then wrong for most of the money.
--
-- ⚠⚠ NOBODY EVER DECIDED THE RULE THIS DROPS, which is the whole argument for dropping it.
-- `UNIQUE (fundraiser_id, player_id)` comes from migration 030 — the ORIGINAL fundraisers table,
-- roughly a year before whole-team entries existed. Migration 237 made `player_id` nullable, and
-- the whole-team entry (2026-09-08) then landed in the gap the constraint leaves, because SQL NULLs
-- do not collide for uniqueness. So one tab already carried three shapes for one idea:
--   · a SPONSOR's cheques    — many, each its own dated arrival (mig 268, deliberate)
--   · the WHOLE TEAM's money — many, each its own dated entry (2026-09-08, deliberate)
--   · a PLAYER's money       — one number, overwritten (mig 030, never revisited)
-- Only the third made the coach do the arithmetic. This makes the player side match the two halves
-- that were actually designed.
--
-- ⚠ NOTHING TO BACK-FILL AND NOTHING TO CONVERT. Every existing row is already valid under the
-- looser rule — one entry per player satisfies "any number of entries per player" — so no figure on
-- any screen moves. Verified against BOTH databases' `information_schema` immediately before
-- writing this (never from a migration file, which misleads in a drifted DB): the constraint exists
-- on dev and on prod, over exactly (`fundraiser_id`, `player_id`), on both.
--
-- ⚠ THE INDEX IT TAKES WITH IT IS NOT NEEDED. Dropping a UNIQUE constraint drops its backing index,
-- but mig 030 also created `rep_fundraiser_entries_fundraiser_idx` (fundraiser_id) and
-- `rep_fundraiser_entries_player_idx` (player_id) as plain indexes, and those are what every read
-- path actually uses — the board and the register both filter on `fundraiser_id` alone. Nothing
-- looks the pair up together.
--
-- ⚠ THE APPLICATION KEEPS THE ONE RULE THE DATABASE NEVER HELD: a DRIVE's entry always names a
-- player or explicitly names nobody, and a SPONSOR's arrival always carries `player_id` NULL. That
-- split has never been DB-enforced (mig 237's own header says why — the check would have to reach
-- across to the parent's kind on every insert) and is not enforced here either. Read the PARENT'S
-- `kind`, never the null.
--
-- ⚠ NOT TOUCHED, DELIBERATELY: `rep_fundraiser_entries` is in `BUDGET_ITEM_REFERENCES`, and its
-- budget-item link, its `rebate_percent` snapshot and its circular FK to `rep_dues_credits` are all
-- exactly as they were. This migration changes one constraint and two comments.

begin;

-- ── 1. The rule goes ────────────────────────────────────────────────────────────────────────
alter table rep_fundraiser_entries
  drop constraint if exists rep_fundraiser_entries_fundraiser_id_player_id_key;

-- ── 2. The comments catch up with the model ─────────────────────────────────────────────────
-- ⚠ Mig 268's comment ON THE CONSTRAINT dies with the constraint — a comment cannot outlive the
-- object it is attached to — so the fact it carried (a sponsor's several arrivals are legal, and
-- they are legal because of the parent's kind rather than because of a NULL trick) moves onto the
-- column, where it is now the only home for it.
comment on column rep_fundraiser_entries.player_id is
  'The roster player this amount belongs to. On a DRIVE entry: a real player, or NULL meaning THE '
  'WHOLE TEAM raised it (hoodies sold at a table with nobody counting who sold what) — no family '
  'share, no dues credit. On a SPONSOR entry (an ARRIVAL, mig 268) always NULL: the credited '
  'families live on rep_fundraiser_credit_plan, and one arrival can fund several families'' credits '
  'via rep_dues_credits.fundraiser_entry_id. ⚠ TELL THE TWO APART BY THE PARENT''S kind, NEVER BY '
  'THE NULL. ⚠ NOT UNIQUE PER DRIVE ANY MORE (mig 287): a player hands money in as many times as it '
  'takes, each hand-in its own dated row, exactly as a sponsor''s cheques and the whole team''s '
  'entries always have. Anything counting PLAYERS must count DISTINCT player_id, not rows.';

comment on table rep_fundraiser_entries is
  'One dated arrival of money against a fundraising record. A DRIVE''s entries are what each '
  'participant handed in — several per player are legal since mig 287, several per whole-team row '
  'since 2026-09-08 — and a SPONSOR''s are its cheques (mig 268). Each row triple-writes: an '
  'accounting_entries income row, this row, and (drives with a rate, real player only) a '
  'rep_dues_credits row. ⚠ rebate_percent is a SNAPSHOT: a share changed mid-drive never rewrites a '
  'hand-in already recorded, which is why a participant''s credit is SUMMED from its rows and never '
  're-multiplied from the drive''s current rate.';

commit;
