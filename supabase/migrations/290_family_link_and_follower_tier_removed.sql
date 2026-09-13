-- Migration 290: the team family link and the follower tier are removed.
--
-- Owner, 2026-09-12: "remove any family link functionality." Since mig 215 a coach could mint
-- ONE shareable link for their team (`rep_teams.family_link_token_hash`); anyone holding it
-- could sign in and ask to FOLLOW the team — a team-level connection tied to no child — and the
-- coach approved each request from a card on the Roster page. The link, the join page, the
-- follower role, the approval queue and the follower ceiling were all deleted in the same unit
-- of work as this file. What survives: the GUARDIAN tier (a parent tied to one player, still
-- switched off behind `GUARDIAN_TIER_ENABLED`), `rep_teams.schedule_visibility` (moved to Team
-- settings), the team-wide calendar token, sharing a single game, and the family recap.
--
-- Four things, in dependency order:
--
-- 1. DATA-ONLY, invisible to every schema gate: delete any follower rows. ⚠⚠ CHECKED BOTH
--    DATABASES BEFORE WRITING THIS FILE (2026-09-12): dev holds 13 family links and prod 12,
--    ALL role='guardian', ALL status='verified', ALL with a player_id, NONE with a
--    requested_player_name. Not one follower row exists anywhere, and no team on either
--    database has ever minted a link (family_link_token_hash IS NULL on every row). The DELETE
--    is therefore defensive — it must run before the CHECK below is tightened, and it is what
--    lets the tightening be safe against a row minted between the check and the apply.
--
-- 2. `family_links.role` narrows to guardian only. The follower half of the tier-boundary
--    CHECK (`family_links_role_player_ck`, mig 215, amended mig 216) goes with it, and the
--    guardian half returns to mig 215's STRICT form — every guardian row carries a player from
--    the moment it is written. Mig 216 relaxed that for exactly one producer, the parent's
--    ask-via-link request (a row created with a typed child's name and no player, attached by
--    the coach at approval); that producer was the family link, so the relaxation goes with it.
--    A mismatched claim of a coach-sent invite (mig 220) still lands in the coach's queue as
--    `pending_approval`, and that row was born from the invite, which already carried the
--    player — so nothing that can still be written violates the strict form.
--
-- 3. `family_links.requested_player_name` is dropped: the typed child's name only ever came
--    from the ask-via-link request.
--
-- 4. The three link columns on `rep_teams` are dropped. Their partial unique index
--    (`rep_teams_family_link_token_uniq`) and the FK to auth.users go with the columns.
--    `family_calendar_token_hash` STAYS — it is the team-wide calendar feed handed out at
--    public_link, not the family link.
--
-- ⚠ This migration is a DELETE + DROP COLUMN + a rewritten CHECK — every one of those is
-- "schema-invisible" to `check:migrations` (prod having MORE than dev never fails a "prod is
-- missing" check), so it is registered in MANUAL_PROD_STEPS.json and its prod state is
-- knowable only by asking production: `SELECT count(*) FROM family_links WHERE role <> 'guardian'`
-- must be a hard error (the value is no longer admitted) or 0, and
-- `information_schema.columns` must have no `family_link_token_hash`. It IS visible to the
-- schema-parity gate on the master build, which is what makes it order-critical: apply to prod
-- BEFORE or WITH the promote, never after.
-- ---------------------------------------------------------------

-- 1. Followers, if any exist, go first — the tightened CHECK below would refuse to install over them.
DELETE FROM family_links WHERE role = 'follower';

-- 2. One role. The inline CHECK from mig 215 was auto-named `family_links_role_check`.
ALTER TABLE family_links DROP CONSTRAINT IF EXISTS family_links_role_check;
ALTER TABLE family_links ADD CONSTRAINT family_links_role_check CHECK (role = 'guardian');

ALTER TABLE family_links DROP CONSTRAINT IF EXISTS family_links_role_player_ck;
ALTER TABLE family_links ADD CONSTRAINT family_links_role_player_ck CHECK (
  -- Mig 215's strict form, restored: a guardian is tied to a child from the first write.
  role = 'guardian' AND player_id IS NOT NULL
);

COMMENT ON COLUMN family_links.role IS
  'guardian, and only guardian since mig 290 — the follower tier (a team-level connection with '
  'no child) was removed with the team family link on 2026-09-12.';

COMMENT ON COLUMN family_links.player_id IS
  'The roster row this guardian is the accountable adult for. NOT NULL for every row since mig '
  '290 restored the strict CHECK — the only producer of a player-less request was the '
  'ask-via-link path, which went with the link.';

-- 3. The typed child's name existed only for the ask-via-link request.
ALTER TABLE family_links DROP COLUMN IF EXISTS requested_player_name;

-- 4. The link itself. The partial unique index and the FK are dropped with their columns.
ALTER TABLE rep_teams
  DROP COLUMN IF EXISTS family_link_token_hash,
  DROP COLUMN IF EXISTS family_link_created_at,
  DROP COLUMN IF EXISTS family_link_created_by;
