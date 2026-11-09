-- ---------------------------------------------------------------
-- Migration 456 — a coach can hide a paused workspace from their own Home (owner ruling 2026-11-09).
--
-- WHY: a coach whose club's plan no longer carries the Coaches Portal (or whose club's subscription lapsed) still held a card
-- for it on Home that opens a wall. The card now says "Paused", and a coach who knows the club is not coming back can hide it.
-- HIDE, NOT LEAVE: this changes only what THIS person sees. The club's roster, the team's records and the coach's assignment
-- are untouched, and nobody is told. Leaving a club's staff is the club's decision and is a separate piece of work.
--
-- WHAT CHANGES
--   user_hidden_workspaces   NEW. One row per (person, organization) the person chose to hide. The hide only ever APPLIES while
--                            the workspace is paused for that person (lib/user-hidden-workspaces.ts); when the club comes back,
--                            or the person stops being a coach there, the app deletes the row.
--
-- GRANTS (dictionary rule 7): RLS on, no policies; nothing to anon / authenticated; service_role only.
-- Additive; writes no data; re-runnable. Prod apply rides the next promote (nothing reads it before the code ships).
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_hidden_workspaces (
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hidden_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id)
);

ALTER TABLE public.user_hidden_workspaces ENABLE ROW LEVEL SECURITY;
-- No policies: nothing but the service role reads or writes it (migration-table-grants-guard.test.ts).
REVOKE ALL ON TABLE public.user_hidden_workspaces FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_hidden_workspaces TO service_role;

COMMENT ON TABLE public.user_hidden_workspaces IS
  'A workspace a person chose to hide from their own Home while it is paused (mig 456). Personal and reversible; the '
  'organization is never told and nothing about the person''s role there changes. The row only applies while the workspace is paused.';

COMMIT;

-- Verify (dev):
--   SELECT count(*) FROM information_schema.tables WHERE table_name = 'user_hidden_workspaces';  -- 1
--   role_table_grants: service_role SELECT/INSERT/UPDATE/DELETE; anon/authenticated none.
