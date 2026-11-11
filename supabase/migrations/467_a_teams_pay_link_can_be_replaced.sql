-- ---------------------------------------------------------------
-- Migration 467 — Board Ready W2 fix D, item 2: a tournament team's pay link can be replaced
-- (third access sweep, "Small": docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md; build prompt
-- docs/projects/active/BOARD_READY_W2_FIX_D_DEMO_LINKS_THROTTLES_PROMPT.md, item 2).
--
-- WHY: a team's pay link (lib/team-pay-link.ts) is signed, never stored and never expires, so a link that was forwarded
-- showed that team's receipts (card brand and last four) and could start a payment for it, and nothing could stop it. The
-- house-league family link has been replaceable since migration 419; this gives the team link the same version.
--
-- WHAT CHANGES (teams, two columns):
--   (1) link_version int NOT NULL DEFAULT 0 — folded into the link's signature. Version 0 signs exactly today's message,
--       so every link already in an inbox keeps working until the club replaces it; a replacement bumps the version and a
--       link signed under an older one is refused ("This link no longer works").
--   (2) link_replaced_at timestamptz NULL — when the link was last replaced. Null until the first replacement.
--
-- ⚖ The version is folded into the HMAC rather than a hashed token stored (the migration 419 reasoning, unchanged): the
-- product mints the link in several places and "Email the pay link" re-sends the same link. No new secret: a replacement
-- never rotates PAY_LINK_SECRET, so it can never touch another team's link or a family's.
--
-- Safe on a table with rows: a constant default (no rewrite of existing values), a nullable column. Re-runnable.
-- ---------------------------------------------------------------

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS link_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_replaced_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_link_version_check') THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_link_version_check CHECK (link_version >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.teams.link_version IS
  'The team''s pay link version (folded into its signature). 0 = the original link; a replacement bumps it, which stops every older link.';
COMMENT ON COLUMN public.teams.link_replaced_at IS
  'When the team''s pay link was last replaced; null until the first replacement.';
