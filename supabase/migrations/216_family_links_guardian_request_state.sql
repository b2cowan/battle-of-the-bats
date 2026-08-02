-- ---------------------------------------------------------------
-- Migration 216 — let a guardian REQUEST exist before it has a player
--
-- Migration 215 wrote the tier-boundary CHECK as:
--     (role = 'guardian' AND player_id IS NOT NULL)
--  OR (role = 'follower' AND player_id IS NULL)
--
-- The follower half is the security-critical one and is UNCHANGED here: a follower is
-- team-level and must never carry a child reference. That is the invariant the whole
-- two-tier model rests on and it must not be loosened by accident.
--
-- The guardian half was too strict for the flow the owner ruled on. Parent-initiated,
-- coach-approved (ruling #3) means a parent types their child's FIRST NAME into a form
-- that deliberately shows them nothing from the roster, and the COACH attaches the actual
-- roster row when they approve. So a guardian request genuinely has no `player_id` while
-- it waits — and must not, because a request that selected a roster row would mean the
-- requester had picked a child from a list they are never allowed to see.
--
-- The honest invariant is therefore: a VERIFIED guardian has a player; a waiting one need
-- not. That is what this encodes.
--
-- Belt and braces on the sequencing: `player_id` is still NOT NULL-able only in the sense
-- the app enforces — `approveGuardianLink` sets `player_id` in the SAME statement that sets
-- `status='verified'`, so there is no window in which a verified guardian lacks a player.
-- ---------------------------------------------------------------

ALTER TABLE family_links DROP CONSTRAINT IF EXISTS family_links_role_player_ck;

ALTER TABLE family_links ADD CONSTRAINT family_links_role_player_ck CHECK (
  -- UNCHANGED, and the reason this table exists in this shape: a follower is tied to the
  -- team and to no child, ever.
  (role = 'follower' AND player_id IS NULL)
  -- A guardian must be attached to a player BY THE TIME THEY ARE VERIFIED. Before that
  -- (requested / invited / pending_approval) the coach has not yet said which child this is,
  -- and `declined` / `revoked` rows keep whatever they had.
  OR (role = 'guardian' AND (status <> 'verified' OR player_id IS NOT NULL))
);

COMMENT ON COLUMN family_links.player_id IS
  'The roster row a GUARDIAN is the accountable adult for. NULL for a follower, always '
  '(enforced). NULL for a guardian only while their request waits — the coach attaches the '
  'player at approval, because the request form never shows the requester a roster to pick '
  'from. A verified guardian always has one.';
