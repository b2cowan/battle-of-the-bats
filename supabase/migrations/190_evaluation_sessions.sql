-- Migration 190: Player Development slice 3B — Evaluation Sessions.
--
-- A session is the unit of work for measurable collection ("Jul 17 — 14 players, 3 tests"):
-- the coach picks tonight's tests, works down the roster in a batch grid, and the session
-- persists as a reviewable artifact. rep_player_measurables gains a nullable session_id
-- back-reference — entries logged as singles from the player-profile card leave it NULL, and
-- BOTH doors write the same rows (one dataset, two doors — owner decision, rev 2).
--
-- session_id is ON DELETE SET NULL: readings are the permanent record; a session is just a
-- grouping artifact, so deleting one degrades its entries to "singles" rather than erasing
-- a player's history.
--
-- RLS: head-coach-only writes at BOTH layers from birth (Player Development D1 — same
-- posture migration 189 was tightened to in the 3A adversarial review; coach_role =
-- 'head_coach', no org-admin write policies, DROP-guarded so the file is re-runnable).
--
-- DEV-ONLY at author time; ⚠ PROD-PENDING — apply to prod at release WITH mig 189 before
-- promoting code that reads these tables.

CREATE TABLE IF NOT EXISTS public.rep_team_evaluation_sessions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id          uuid        NOT NULL REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  program_year_id  uuid        NOT NULL REFERENCES public.rep_program_years(id) ON DELETE CASCADE,
  session_date     date        NOT NULL,
  note             text        CHECK (note IS NULL OR char_length(note) <= 200),
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_team_evaluation_sessions_team_idx
  ON public.rep_team_evaluation_sessions(team_id, session_date DESC);
CREATE INDEX IF NOT EXISTS rep_team_evaluation_sessions_py_idx
  ON public.rep_team_evaluation_sessions(program_year_id);
CREATE INDEX IF NOT EXISTS rep_team_evaluation_sessions_org_idx
  ON public.rep_team_evaluation_sessions(org_id);

ALTER TABLE public.rep_team_evaluation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can read rep_team_evaluation_sessions" ON public.rep_team_evaluation_sessions;
CREATE POLICY "org members can read rep_team_evaluation_sessions"
  ON public.rep_team_evaluation_sessions FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "coaches can read assigned team evaluation sessions" ON public.rep_team_evaluation_sessions;
CREATE POLICY "coaches can read assigned team evaluation sessions"
  ON public.rep_team_evaluation_sessions FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "head coaches can insert rep_team_evaluation_sessions" ON public.rep_team_evaluation_sessions;
CREATE POLICY "head coaches can insert rep_team_evaluation_sessions"
  ON public.rep_team_evaluation_sessions FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid() AND coach_role = 'head_coach'
    )
  );

DROP POLICY IF EXISTS "head coaches can update rep_team_evaluation_sessions" ON public.rep_team_evaluation_sessions;
CREATE POLICY "head coaches can update rep_team_evaluation_sessions"
  ON public.rep_team_evaluation_sessions FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid() AND coach_role = 'head_coach'
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid() AND coach_role = 'head_coach'
    )
  );

DROP POLICY IF EXISTS "head coaches can delete rep_team_evaluation_sessions" ON public.rep_team_evaluation_sessions;
CREATE POLICY "head coaches can delete rep_team_evaluation_sessions"
  ON public.rep_team_evaluation_sessions FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid() AND coach_role = 'head_coach'
    )
  );

-- ── rep_player_measurables gains the session back-reference ──
--
-- The FK is COMPOSITE (session_id, team_id) → sessions(id, team_id) so the database
-- structurally guarantees a reading can only reference ITS OWN TEAM's session — a
-- team_id-only RLS WITH CHECK can't validate a cross-table relationship, and "RLS must
-- encode the real write rule" (mig-189 lesson; caught again in the 3B adversarial review).
-- MATCH SIMPLE skips enforcement when session_id IS NULL (singles), and the SET NULL
-- action is COLUMN-SCOPED (PG15+) so deleting a session nulls only session_id, never
-- team_id. One reading per (session, player, test) — a duplicate could silently survive
-- a remove and resurrect on reload; the partial unique index forbids it (409 app-side).

ALTER TABLE public.rep_team_evaluation_sessions
  DROP CONSTRAINT IF EXISTS rep_team_evaluation_sessions_id_team_uniq;
ALTER TABLE public.rep_team_evaluation_sessions
  ADD CONSTRAINT rep_team_evaluation_sessions_id_team_uniq UNIQUE (id, team_id);

ALTER TABLE public.rep_player_measurables
  ADD COLUMN IF NOT EXISTS session_id uuid;

ALTER TABLE public.rep_player_measurables
  DROP CONSTRAINT IF EXISTS rep_player_measurables_session_id_fkey;
ALTER TABLE public.rep_player_measurables
  DROP CONSTRAINT IF EXISTS rep_player_measurables_session_team_fkey;
ALTER TABLE public.rep_player_measurables
  ADD CONSTRAINT rep_player_measurables_session_team_fkey
  FOREIGN KEY (session_id, team_id)
  REFERENCES public.rep_team_evaluation_sessions(id, team_id)
  ON DELETE SET NULL (session_id);

CREATE INDEX IF NOT EXISTS rep_player_measurables_session_idx
  ON public.rep_player_measurables(session_id);

CREATE UNIQUE INDEX IF NOT EXISTS rep_player_measurables_session_entry_uniq
  ON public.rep_player_measurables(session_id, player_id, measurable_type_id)
  WHERE session_id IS NOT NULL;
