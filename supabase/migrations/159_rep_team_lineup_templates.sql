-- Migration 159: Named lineup templates (Coach Lineup Builder Phase 4)
--
-- A reusable, named "base start" lineup (e.g. "Gold medal game") a coach can save once and
-- load onto any future game as an editable starting point. NOT event-bound — distinct from
-- rep_team_lineups (which is 1:1 per event, UNIQUE(event_id), full-replace-on-save).
--
-- /dba DB_ARCHITECTURE_REVIEW.md Finding #29 (2026-06-28):
--   * NEW dedicated table, do NOT overload the event-bound rep_team_lineups.
--   * Option 2 (single table with `entries jsonb`) — templates are a convenience snapshot,
--     not an analytics surface, so the lighter footprint is fine.
--   * Scope by org_id + team_id + program_year_id (all NOT NULL, indexed — don't repeat the
--     Finding #13 missed-index miss). Program-year-scoped for V1: entries key on player_id and
--     season rollover mints new player_ids, so templates don't carry across seasons (the loader
--     maps to the current roster and silently skips players who are gone).
--   * RLS write policies mirror migration 071 (coaches on assigned teams + org admins), WITH CHECK.
--
-- DEV-ONLY at author time; ⚠ PROD-PENDING — apply to prod at release BEFORE promoting code
-- that reads this table (else prod 500s). check:migrations flags this as prod-pending (expected).

CREATE TABLE IF NOT EXISTS public.rep_team_lineup_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id         uuid        NOT NULL REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  program_year_id uuid        NOT NULL REFERENCES public.rep_program_years(id) ON DELETE CASCADE,
  name            text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  lineup_mode     text        NOT NULL DEFAULT 'everyone_bats'
                              CHECK (lineup_mode IN ('nine_player', 'everyone_bats')),
  inning_count    int         NOT NULL DEFAULT 7 CHECK (inning_count BETWEEN 1 AND 12),
  -- Convenience snapshot (NOT an analytics surface): a JSON array of
  --   { playerId, battingOrder: int|null, starter: bool, inningPositions: { "<inning>": "<pos>" } }
  -- keyed by player_id. The loader maps to the current active roster and skips missing players.
  entries         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One template name per team-season, case-insensitive (expression index → not a table constraint).
CREATE UNIQUE INDEX IF NOT EXISTS rep_team_lineup_templates_name_uniq
  ON public.rep_team_lineup_templates(team_id, program_year_id, lower(btrim(name)));

-- List query (a team-season's templates) + RLS/org scoping.
CREATE INDEX IF NOT EXISTS rep_team_lineup_templates_team_idx
  ON public.rep_team_lineup_templates(team_id, program_year_id);

CREATE INDEX IF NOT EXISTS rep_team_lineup_templates_org_idx
  ON public.rep_team_lineup_templates(org_id);

ALTER TABLE public.rep_team_lineup_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Read policies — org members + coaches assigned to the team
-- (mirrors migration 070's SELECT policies on rep_team_lineups)
-- ============================================================

CREATE POLICY "org members can read rep_team_lineup_templates"
  ON public.rep_team_lineup_templates FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read assigned team lineup templates"
  ON public.rep_team_lineup_templates FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

-- ============================================================
-- Write policies — coaches on assigned teams + org admins
-- (mirrors migration 071; INSERT=WITH CHECK, UPDATE=USING+CHECK, DELETE=USING)
-- ============================================================

-- --- Coaches ---

CREATE POLICY "coaches can insert rep_team_lineup_templates"
  ON public.rep_team_lineup_templates FOR INSERT
  WITH CHECK (
    team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  );

CREATE POLICY "coaches can update rep_team_lineup_templates"
  ON public.rep_team_lineup_templates FOR UPDATE
  USING (
    team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  )
  WITH CHECK (
    team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  );

CREATE POLICY "coaches can delete rep_team_lineup_templates"
  ON public.rep_team_lineup_templates FOR DELETE
  USING (
    team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  );

-- --- Org admins ---

CREATE POLICY "org admins can insert rep_team_lineup_templates"
  ON public.rep_team_lineup_templates FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "org admins can update rep_team_lineup_templates"
  ON public.rep_team_lineup_templates FOR UPDATE
  USING (
    org_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "org admins can delete rep_team_lineup_templates"
  ON public.rep_team_lineup_templates FOR DELETE
  USING (
    org_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
