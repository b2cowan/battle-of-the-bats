-- 309 — A call-up is in the game, not on the team
-- (owner rulings R1–R6 on the Call-ups hub, 2026-09-22 — "I agree with your recommendations";
--  plan: docs/projects/active/COACH_CALL_UPS_PLAN.md)
--
-- A team runs short and borrows a player for one game. Today the only way to get that player into a
-- lineup is to add them to the roster, which puts them in dues, skills & goals, awards, the season
-- playing-time report, family emails and next season's rollover. So coaches keep the real lineup on
-- paper, and the printed card, the bench console, the game notes and the season report all quietly
-- stop matching the game that was played.
--
-- THE MODEL, chosen from the evidence rather than from taste (plan §3): a call-up is a roster entry
-- of a different KIND — `status = 'callup'` — NOT a flag on an otherwise-active player and NOT a
-- separate table.
--   · ~59 roster reads in the portal already filter `status = 'active'` (lineups, attendance, the
--     console, awards, development, dues, the installment generator, practice sends, templates,
--     tryouts, insights, the recap, Wrapped, the settlement, the rollover). A non-active KIND is
--     excluded by every one of them the day this lands, and by anything built next year. It FAILS
--     SAFE: a surface we forget hides a call-up.
--   · A flag would have been INCLUDED by all ~59 and fails open.
--   · A separate table breaks the 24 foreign keys that point at rep_roster_players, plus every
--     lineup reader (grid, generator, analysis, caps, printed card, console) that keys on one
--     player id.
--
-- ⚠ THE LESSON THIS MIGRATION EXISTS TO NOT REPEAT. `RepRosterStatus` in lib/types.ts has carried
-- 'released' since it was written, and the check constraint has never allowed it — so 'released'
-- could be RENDERED (season-end/page.tsx prints "Left during the season") and never WRITTEN. A
-- status value added to the type without the constraint is a value the product shows and the
-- database refuses. That value is retired in lib/types.ts in the same unit of work as this file,
-- and a unit guard now asserts the type and this constraint agree.
--
-- Two parts, both additive. No data is rewritten and no existing row changes.
--   1. rep_roster_players.status gains 'callup', plus a structural guarantee that a call-up can
--      never carry a guardian email (owner ruling R6).
--   2. rep_team_call_up_appearances — the per-game link (owner ruling R3). A call-up is offered in
--      a game's lineup builder ONLY if a row here ties them to that game; the saved pool lives
--      behind the "Call up a player" button and nowhere else on the page.
--
-- ORDER: independent of 306/307/308. Safe to apply before its code promote (both parts are purely
-- additive — nothing reads the new value or the new table until the code ships).

-- ⚠⚠ **WRAPPED, AND THAT IS NOT DECORATION.** This file DROPs the status CHECK before re-adding it
-- widened. Unwrapped, an abort anywhere after that drop — a policy clash on a retry, a lock or
-- statement timeout on the prod apply — leaves `rep_roster_players.status` with NO constraint at
-- all, accepting any string; and the guard that would notice reads the DEV snapshot, so it stays
-- green while prod is open. Twelve migrations in this repo wrap explicitly for the same reason:
-- atomicity here is stated, never assumed. Found by `/review`.
BEGIN;


-- ════════════════════════════════════════════════════════════════════
-- 1. The new kind of roster entry
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.rep_roster_players
  DROP CONSTRAINT IF EXISTS rep_roster_players_status_check;

ALTER TABLE public.rep_roster_players
  ADD CONSTRAINT rep_roster_players_status_check
  CHECK (status IN ('active', 'inactive', 'callup'));

-- Owner ruling R6: a call-up may carry a phone (you may need to reach someone at the field) and
-- must NEVER carry an email. This is enforced in the DATABASE rather than in a route because the
-- consequence of getting it wrong is emailing a family that is not yours — every family audience in
-- the product is built by collecting guardian_email, so a call-up with no email cannot enter one
-- even if a future audience query forgets to filter on status.
ALTER TABLE public.rep_roster_players
  DROP CONSTRAINT IF EXISTS rep_roster_players_callup_no_email_check;

ALTER TABLE public.rep_roster_players
  ADD CONSTRAINT rep_roster_players_callup_no_email_check
  CHECK (status <> 'callup' OR guardian_email IS NULL);

-- The pool read ("everyone called up this season") and every active-roster read both filter on
-- status within one program year.
CREATE INDEX IF NOT EXISTS rep_roster_players_year_status_idx
  ON public.rep_roster_players(program_year_id, status);

COMMENT ON COLUMN public.rep_roster_players.status IS
  'active = on the roster. inactive = taken off it (keeps their record). callup = borrowed for one '
  'or more individual games (mig 309) — NOT on the roster, never in dues, skills & goals, awards, '
  'documents, tryouts, family audiences, the roster count, any season-long playing-time figure, '
  'Season Wrapped, the closed-season roster shelf, or next season''s rollover. A call-up reaches a '
  'game only through rep_team_call_up_appearances.';

-- ════════════════════════════════════════════════════════════════════
-- 2. The per-game link (owner ruling R3)
-- ════════════════════════════════════════════════════════════════════
--
-- Why this table exists at all (plan §4 / finding F2): without it a call-up sits in the available
-- list of EVERY game for the rest of the season. Four call-ups across a year means four extra names
-- in every lineup builder forever, and the coach has to remember which one is actually coming on
-- Saturday — the exact clutter this feature was asked for to remove.
--
-- Shaped like rep_team_lineup_entries (mig 070): the event owns the link, both sides cascade, and
-- org/team/program_year ride along so every read can scope without a join.

CREATE TABLE IF NOT EXISTS public.rep_team_call_up_appearances (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid        NOT NULL REFERENCES public.rep_team_events(id)   ON DELETE CASCADE,
  player_id       uuid        NOT NULL REFERENCES public.rep_roster_players(id) ON DELETE CASCADE,
  program_year_id uuid        NOT NULL REFERENCES public.rep_program_years(id) ON DELETE CASCADE,
  team_id         uuid        NOT NULL REFERENCES public.rep_teams(id)         ON DELETE CASCADE,
  org_id          uuid        NOT NULL REFERENCES public.organizations(id)     ON DELETE CASCADE,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- A player is called up to a game once. The sheet shows a tick rather than an Add for anyone
-- already linked, and this is what makes that honest.
CREATE UNIQUE INDEX IF NOT EXISTS rep_team_call_up_appearances_event_player_uniq
  ON public.rep_team_call_up_appearances(event_id, player_id);

-- ⚰ No separate `(event_id)` index. The lineup builder's question — "who is called up to THIS
-- game?" — is served by the unique index above, of which `event_id` is the leading column. A second
-- b-tree on the same prefix is pure write amplification on a table that is written every time a
-- coach calls someone up or takes them off.

-- The pool's question: "how many games has this call-up played?" (several leagues cap it).
CREATE INDEX IF NOT EXISTS rep_team_call_up_appearances_player_idx
  ON public.rep_team_call_up_appearances(player_id);

CREATE INDEX IF NOT EXISTS rep_team_call_up_appearances_year_idx
  ON public.rep_team_call_up_appearances(program_year_id);

-- org_id is the RLS tenancy anchor: every SELECT policy on this table filters by it, so without
-- this index the policy is a sequential scan on every read. Required by `check:index-coverage`,
-- which is the gate that stops a new tenant-scoped table shipping without one.
CREATE INDEX IF NOT EXISTS rep_team_call_up_appearances_org_id_idx
  ON public.rep_team_call_up_appearances(org_id);

ALTER TABLE public.rep_team_call_up_appearances ENABLE ROW LEVEL SECURITY;

-- Policies mirror rep_team_lineup_entries: every route runs service-role and gates on the lineups
-- capability (owner ruling R5 — anyone who can build a lineup can call someone up, assistants
-- included, because it is a decision made at a field and it creates no money and no record). These
-- policies are the closed direct door.

DROP POLICY IF EXISTS "org members can read rep_team_call_up_appearances" ON public.rep_team_call_up_appearances;
CREATE POLICY "org members can read rep_team_call_up_appearances"
  ON public.rep_team_call_up_appearances FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "coaches can read assigned team call-up appearances" ON public.rep_team_call_up_appearances;
CREATE POLICY "coaches can read assigned team call-up appearances"
  ON public.rep_team_call_up_appearances FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

-- ⚠⚠ **THE INSERT POLICY CONSTRAINS THE ROW'S SHAPE, NOT JUST THE COACH'S TEAM.**
-- `team_id IN (...)` alone is what the sibling tables appear to do, but they get away with it
-- because they have no forgeable tenancy column — `rep_team_lineup_entries` reaches tenancy through
-- an EXISTS on its parent lineup, so a forged row must point at a lineup the coach already owns.
-- Here `org_id`, `program_year_id`, `event_id` and `player_id` are all plain writable columns, and
-- a coach can reach PostgREST directly with the browser's anon client. With only the team check, a
-- coach of team A could insert a row carrying team A's id but ANOTHER org's `org_id` and another
-- team's `program_year_id` and `player_id` — a row attributed to a tenant they are not in, which
-- every org-scoped read, export and purge would then pick up, and which would inflate the victim's
-- games-played count (the figure leagues cap on) and make their call-up undeletable.
-- So every column is tied back to the event, and the event back to the coach. Found by `/review`.
DROP POLICY IF EXISTS "coaches can insert rep_team_call_up_appearances" ON public.rep_team_call_up_appearances;
CREATE POLICY "coaches can insert rep_team_call_up_appearances"
  ON public.rep_team_call_up_appearances FOR INSERT
  WITH CHECK (
    team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.rep_team_events e
       WHERE e.id = rep_team_call_up_appearances.event_id
         AND e.team_id         = rep_team_call_up_appearances.team_id
         AND e.org_id          = rep_team_call_up_appearances.org_id
         AND e.program_year_id = rep_team_call_up_appearances.program_year_id
    )
    AND EXISTS (
      SELECT 1 FROM public.rep_roster_players p
       WHERE p.id = rep_team_call_up_appearances.player_id
         AND p.team_id         = rep_team_call_up_appearances.team_id
         AND p.program_year_id = rep_team_call_up_appearances.program_year_id
         AND p.status          = 'callup'
    )
  );

DROP POLICY IF EXISTS "coaches can delete rep_team_call_up_appearances" ON public.rep_team_call_up_appearances;
CREATE POLICY "coaches can delete rep_team_call_up_appearances"
  ON public.rep_team_call_up_appearances FOR DELETE
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "org admins can manage rep_team_call_up_appearances" ON public.rep_team_call_up_appearances;
CREATE POLICY "org admins can manage rep_team_call_up_appearances"
  ON public.rep_team_call_up_appearances FOR ALL
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (org_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

COMMENT ON TABLE public.rep_team_call_up_appearances IS
  'Ties a call-up (rep_roster_players.status = ''callup'') to ONE game. A call-up is offered in a '
  'game''s lineup builder only if a row here links them to that game — the saved pool lives behind '
  'the "Call up a player" button, never on the page (owner ruling R3, 2026-09-22). Also the '
  'games-played count the pool shows, which several leagues cap.';

COMMIT;
