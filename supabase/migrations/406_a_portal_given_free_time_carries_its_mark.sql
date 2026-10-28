-- ---------------------------------------------------------------
-- Migration 406 — Support console Stage 4b: a Coaches Portal staff gave as free time carries its own mark.
-- Plan: docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md ("Stage 4b build gate", "Build progress");
-- owner rulings 2026-10-27 (Q4 a second give needs a Super admin, Q5 more time is measured from the first give and a
-- later give reuses the same portal; T21/T26/T32 two gives at once).
--
-- WHAT CHANGES:
--   1. team_workspaces.free_time_given_at (new, nullable): when staff FIRST gave this portal free time. Set once, by the
--      give, in the workspace's own insert; never cleared (Keep Premium leaves it, so the history stays). It is the
--      portal's mark ("a portal staff gave", T35: never a customer while it is billed by nobody) and the day every
--      limit is measured from (Q5: 90 days for Support and Billing, 6 months for a Super admin, from the first give).
--      ⚠ Not `source = 'platform_admin'`: comped and Founding portals already carry that source on dev (3 rows), and
--      they are customers. The gate's first draft of this rule keyed on `source` and would have marked them.
--   2. One staff-given portal per coach: a unique rule on the owner where the mark is set. A second give reuses the
--      first portal (Q5), so the rule only ever refuses the loser of two gives racing for one coach (T26/T32), which the
--      application's read-then-write check cannot. It does NOT cover a give racing a paid checkout: "in force" changes
--      with the clock and no index can hold it; that race stays the application check's.
--   3. One staff-given portal per free team: the same, keyed on the free team (the claim is already atomic; this makes
--      the second portal fail at its own insert instead of being made empty beside the first, T20).
--   No back-fill: nothing has been given yet (Stage 4b's give ships with this migration). Re-runnable.
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.team_workspaces
  ADD COLUMN IF NOT EXISTS free_time_given_at timestamptz;

COMMENT ON COLUMN public.team_workspaces.free_time_given_at IS
  'When platform staff first gave this Coaches Portal free time (Support console Stage 4b, owner 2026-10-27). Set once by the give, never cleared. The mark of a staff-given portal (not a customer while billing_mode is platform_override) and the day every free-time limit is measured from. Null = never given free time.';

CREATE UNIQUE INDEX IF NOT EXISTS team_workspaces_one_free_time_portal_per_coach
  ON public.team_workspaces (primary_owner_user_id)
  WHERE free_time_given_at IS NOT NULL AND primary_owner_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS team_workspaces_one_free_time_portal_per_free_team
  ON public.team_workspaces (basic_coach_team_id)
  WHERE free_time_given_at IS NOT NULL AND basic_coach_team_id IS NOT NULL;

COMMIT;
