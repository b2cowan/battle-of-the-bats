-- ---------------------------------------------------------------
-- Migration 419 — Signed-in family accounts Stage 1 Part 1: a family's "Your sign-up" link can be replaced
-- (plan docs/projects/active/SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md, Stage 1, rulings 2026-11-01 asks 4–6; build prompt
-- docs/projects/active/SIGNED_IN_FAMILY_STAGE1_BUILD_PROMPT.md, Part 1).
--
-- WHY: the family's link (lib/league-pay-link.ts) is signed, never stored and never expiring, so a link that was
-- forwarded or shared could never be stopped. The club gains "Send a new link" (Part 6): the old link must stop at once
-- for every brother and sister on that sign-up, and the registration's history says when.
--
-- WHAT CHANGES (league_registrations, two columns):
--   (1) link_version int NOT NULL DEFAULT 0 — folded into the link's signature. Version 0 signs exactly today's message,
--       so every link already in an inbox keeps working until the club replaces it; a reset bumps it on every row of the
--       sign-up in one statement, and a link signed under an older version is refused ("This link no longer works").
--   (2) link_replaced_at timestamptz NULL — when the club last replaced the link (the history's "New link sent; the old
--       one stopped"). Null until the first reset.
--
-- ⚖ The version is folded into the HMAC rather than a hashed token stored: the product mints the link in many places
-- and "Email me my link" re-sends the same link. No new secret: a reset never rotates PAY_LINK_SECRET, so it can never
-- touch a tournament team's pay link.
--
-- Safe on a table with rows: a constant default (no rewrite of existing values), a nullable column. Re-runnable.
-- ---------------------------------------------------------------

ALTER TABLE public.league_registrations
  ADD COLUMN IF NOT EXISTS link_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_replaced_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'league_registrations_link_version_check') THEN
    ALTER TABLE public.league_registrations
      ADD CONSTRAINT league_registrations_link_version_check CHECK (link_version >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.league_registrations.link_version IS
  'The family''s "Your sign-up" link version (folded into its signature). 0 = the original link; the club''s "Send a new link" bumps it on every row of the sign-up, which stops every older link.';
COMMENT ON COLUMN public.league_registrations.link_replaced_at IS
  'When the club last replaced the family''s link ("Send a new link"); null until the first reset.';
