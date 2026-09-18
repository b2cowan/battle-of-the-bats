-- 303 — A staff tag can be a person, and a plan remembers when it was sent
-- (COACH_PRACTICE_WHO_RUNS_IT_PLAN.md — owner asks 2026-09-17: notify the staff when a plan is
-- written; link the staff tags on stations to real portal users so an assistant on a phone knows
-- which blocks and stations are theirs.)
--
-- ⚠ WHY THE LINK: "that's you" on the run screen was a NAME match — the resolved staff tag's name
-- against `organization_members.display_name`, whole string, case-insensitive. That field is
-- nullable and UI-only; "Craig" never equals "Craig Whitfield"; a blank display name never matches
-- anything. The plan route's own comment called it "a MATCH ON A LABEL, not an identity claim".
-- D12 (COACH_PRACTICE_PLANS_PLAN.md, 2026-07-31) ruled "team coaches offered automatically" and that
-- half was never built. This column is the identity the label always needed: ONE person per staff
-- tag per team. The tag's NAME stays the coach's own word ("Jen"); the id is who that is.
--
-- ⚠ A TAG IS STILL A LABEL, NEVER A GRANT (D12's rule, kept whole). Linking a tag to a person gives
-- that person nothing — every read still gates on their own capabilities. What it changes is
-- emphasis ("that's you", "You're on …") and addressing (the send's "Named in this plan" audience).
--
-- ⚠ TEAM TAGS ONLY, STAFF KIND ONLY — the CHECK says so. An org-shared tag (team_id NULL) is a club
-- word, not a person; an equipment tag is a thing. One person per tag per team (partial unique) so
-- the picker's "People on this team" resolves to exactly one tag each; a person may be linked on
-- MANY teams (a club coach on two rosters), which is why the index is (team_id, user_id) and not
-- (user_id). ON DELETE SET NULL: a deleted account leaves the word behind, unlinked.
--
-- ⚠ MERGE: `merge_rep_team_tags` does NOT learn this column. Staff merges already go through the
-- jsonb walk in `lib/rep-practice-plan-tag-repoint.ts` (mig 266's own rule); the carry — a linked
-- loser merged into an unlinked winner keeps the person (decision C) — is one UPDATE there, and a
-- merge of two DIFFERENT people is refused before anything is destroyed.
--
-- The four (five) send-stamp columns on the practice follow `family_shared_at/by` (mig 215): when the
-- plan was last SENT to the staff, by whom, to which audience ('named' — everyone whose linked tag is
-- on the plan; 'coaches' — head, assistants, helpers; 'staff' — everyone), how many, and whether the
-- coach's own email went with it. The last send only — nothing reads a history (decision I).
--
-- Additive; no backfill; no code reads these until the build lands. ORDER: apply to prod BEFORE
-- promoting the code (the migration-040 lesson); independent of 297–302.

ALTER TABLE public.rep_team_tags
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.rep_team_tags DROP CONSTRAINT IF EXISTS rep_team_tags_user_is_staff_team_tag;
ALTER TABLE public.rep_team_tags
  ADD CONSTRAINT rep_team_tags_user_is_staff_team_tag
  CHECK (user_id IS NULL OR (kind = 'staff' AND team_id IS NOT NULL));

-- One person per tag per team; a person may be linked on several teams.
CREATE UNIQUE INDEX IF NOT EXISTS rep_team_tags_team_user_uniq
  ON public.rep_team_tags (team_id, user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.rep_team_events
  ADD COLUMN IF NOT EXISTS practice_plan_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS practice_plan_sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS practice_plan_sent_audience text
    CHECK (practice_plan_sent_audience IN ('named', 'coaches', 'staff')),
  ADD COLUMN IF NOT EXISTS practice_plan_sent_count smallint,
  ADD COLUMN IF NOT EXISTS practice_plan_sent_email boolean;

COMMENT ON COLUMN public.rep_team_tags.user_id IS
  'Staff kind, team tags only: the portal user this staff word IS. A label, never a grant — emphasis and addressing only. One person per tag per team; SET NULL when the account goes.';
COMMENT ON COLUMN public.rep_team_events.practice_plan_sent_at IS
  'When the practice plan was last sent to the staff (Send to staff) — the last send only, with _by, _audience, _count and _email beside it.';
