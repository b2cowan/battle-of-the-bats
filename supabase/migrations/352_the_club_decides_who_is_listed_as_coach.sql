-- ---------------------------------------------------------------
-- Migration 352 — Coach names: the club decides who is listed on team pages (Club Tier; drawings ruled 2026-10-23,
-- build prompt docs/projects/active/COACH_NAMES_CLUB_POLICY_BUILD_PROMPT.md, plan COACH_NAMES_CLUB_POLICY_PLAN.md)
--
-- WHY: since Stage 4c-2 Part B each coach decides alone whether their name shows under Coaches on a team's public page.
-- A club has no say, so a club that wants every head coach listed (or none) must ask each coach.
--
-- WHAT CHANGES: organizations.coach_names_policy — one choice for the whole club, text, one of:
--   coaches_choose               (default; today's behavior — each coach's own switch decides)
--   heads_always                 (head coaches are listed; everyone else keeps their own switch)
--   heads_and_assistants_always  (head and assistant coaches are listed; managers, treasurers, helpers keep their switch)
--   none                         (no coach is listed)
-- The policy never writes a coach's own switch (rep_team_staff_memberships.show_name_public) — it is read beside it.
--
-- A text CHECK needs no function, so this is schema-visible to the drift check: no MANUAL_PROD_STEPS entry.
-- Safe to run twice. Prod: at or before the promote that carries this code (the code reads the column).
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS coach_names_policy text NOT NULL DEFAULT 'coaches_choose';

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_coach_names_policy_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_coach_names_policy_check
  CHECK (coach_names_policy IN ('coaches_choose', 'heads_always', 'heads_and_assistants_always', 'none'));

COMMIT;
