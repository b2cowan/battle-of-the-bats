-- 227_club_shared_book_opt_in.sql
-- Club Shared Book P1 (docs/projects/active/COACH_CLUB_SHARED_BOOK_PLAN.md, owner-approved
-- 2026-08-04). TWO opt-in flags and nothing else — the book's three tables (mig 225) are
-- untouched, because the club layer is a READ-TIME overlay over books that already exist:
-- no cross-team FK, no entity, no backfill.
--
-- ⚠ Placement decided at build against the LIVE schema (never migration files), as the plan
-- required. `organizations.coach_settings` (jsonb, mig 174) was the alternative home for the
-- org flag and was REJECTED: every write to it is a read-modify-write of one shared bag, and
-- the sibling query wants a column it can filter on. Two booleans, both defaulting FALSE, so
-- the feature is absent until someone turns it on twice — which is the ruling (§8 Q1: the
-- club admin enables, each head coach opts their own team in).
--
-- Nothing here joins the season rail: sharing is a property of the TEAM, permanent across
-- program years, exactly like the book it shares.

-- The club admin's switch: does this organization allow its teams to share books at all?
-- Off = the per-team switch does not appear and no club layer is assembled anywhere.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS club_book_sharing_enabled boolean NOT NULL DEFAULT false;

-- The head coach's switch, per team. Also the RECIPROCITY key (§8 Q2, server-enforced):
-- a team reads its siblings' books only while this is true for itself.
ALTER TABLE rep_teams
  ADD COLUMN IF NOT EXISTS share_club_book boolean NOT NULL DEFAULT false;

-- The sibling lookup is "the sharing teams in this org" on every club-layer read.
CREATE INDEX IF NOT EXISTS idx_rep_teams_org_share_club_book
  ON rep_teams(org_id) WHERE share_club_book;
