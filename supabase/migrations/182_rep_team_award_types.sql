-- Migration 182: Player Awards — per-team award-type library + player award records
-- (Coach Tags & Player Awards, Phase 2).
--
-- A "give an award" moment on the game screen (MVP, Best Hitter, Hustle Award to start,
-- fully editable) that pays off on the player's profile ("2x MVP this season") and a new
-- Insights leaderboard ("Who's earning it?"). Internal-only V1 — no public/parent-facing
-- surface (PIPEDA/consent-for-minors deferred, same posture as roster data).
--
-- rep_team_award_types: the per-team curated library. Unlike rep_team_tags (mig 181), there
-- is no merge tool — a coach picks from a short seeded list rather than free-typing per game,
-- so name drift isn't the same risk. "Delete" is never exposed app-side; retiring is a plain
-- is_active flag flip so every past award keeps resolving the type's current name/emoji at
-- render time (same as a rename does) without losing history. The unique name index is
-- PARTIAL (WHERE is_active) so a retired name can be reused by a new type later.
--
-- rep_player_awards: the actual record (player + award type + optional game + optional
-- free-text tournament/occasion + date + note). Both event_id and tournament_label are
-- nullable and mutually optional — a row can carry neither, meaning a general/season
-- recognition not tied to any single occasion. award_type_id is ON DELETE RESTRICT (not
-- CASCADE like rep_team_tags' join table) because this row IS the historical record, not a
-- disposable link — the app never hard-deletes a type (retire only), and RESTRICT backstops
-- that at the DB level in case it ever tried to.
--
-- DEV-ONLY at author time; ⚠ PROD-PENDING — apply to prod at release before promoting code
-- that reads these tables (else prod 500s), per the "migration-040 incident" lesson.

CREATE TABLE IF NOT EXISTS public.rep_team_award_types (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id     uuid        NOT NULL REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  name        text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  emoji       text        CHECK (emoji IS NULL OR char_length(emoji) <= 8),
  sort_order  int         NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One active name per team, case-insensitive (partial → a retired name can be reused).
CREATE UNIQUE INDEX IF NOT EXISTS rep_team_award_types_name_uniq
  ON public.rep_team_award_types(team_id, lower(btrim(name)))
  WHERE is_active;

CREATE INDEX IF NOT EXISTS rep_team_award_types_team_idx
  ON public.rep_team_award_types(team_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS rep_team_award_types_org_idx
  ON public.rep_team_award_types(org_id);

ALTER TABLE public.rep_team_award_types ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- rep_team_award_types policies — mirrors rep_team_tags (mig 181)
-- ============================================================

CREATE POLICY "org members can read rep_team_award_types"
  ON public.rep_team_award_types FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read assigned team award types"
  ON public.rep_team_award_types FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can insert rep_team_award_types"
  ON public.rep_team_award_types FOR INSERT
  WITH CHECK (
    team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  );

CREATE POLICY "coaches can update rep_team_award_types"
  ON public.rep_team_award_types FOR UPDATE
  USING (
    team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  )
  WITH CHECK (
    team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  );

CREATE POLICY "org admins can insert rep_team_award_types"
  ON public.rep_team_award_types FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "org admins can update rep_team_award_types"
  ON public.rep_team_award_types FOR UPDATE
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

-- No DELETE policies — types are never hard-deleted app-side (retire = UPDATE is_active).

-- ============================================================
-- rep_player_awards — the award record itself
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rep_player_awards (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id          uuid        NOT NULL REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  player_id        uuid        NOT NULL REFERENCES public.rep_roster_players(id) ON DELETE CASCADE,
  award_type_id    uuid        NOT NULL REFERENCES public.rep_team_award_types(id) ON DELETE RESTRICT,
  event_id         uuid        REFERENCES public.rep_team_events(id) ON DELETE SET NULL,
  tournament_label text        CHECK (tournament_label IS NULL OR char_length(btrim(tournament_label)) <= 80),
  awarded_at       date        NOT NULL,
  note             text        CHECK (note IS NULL OR char_length(note) <= 200),
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_player_awards_team_idx ON public.rep_player_awards(team_id, awarded_at DESC);
CREATE INDEX IF NOT EXISTS rep_player_awards_player_idx ON public.rep_player_awards(player_id);
CREATE INDEX IF NOT EXISTS rep_player_awards_type_idx ON public.rep_player_awards(award_type_id);
CREATE INDEX IF NOT EXISTS rep_player_awards_event_idx ON public.rep_player_awards(event_id);
CREATE INDEX IF NOT EXISTS rep_player_awards_org_idx ON public.rep_player_awards(org_id);

ALTER TABLE public.rep_player_awards ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- rep_player_awards policies — direct team_id column (mirrors rep_team_lineup_templates,
-- mig 159), not a join-through-parent EXISTS (this row isn't a pure link, it's a first-class
-- record with its own denormalized scope columns).
-- ============================================================

CREATE POLICY "org members can read rep_player_awards"
  ON public.rep_player_awards FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read assigned team player awards"
  ON public.rep_player_awards FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can insert rep_player_awards"
  ON public.rep_player_awards FOR INSERT
  WITH CHECK (
    team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  );

CREATE POLICY "coaches can update rep_player_awards"
  ON public.rep_player_awards FOR UPDATE
  USING (
    team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  )
  WITH CHECK (
    team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  );

CREATE POLICY "coaches can delete rep_player_awards"
  ON public.rep_player_awards FOR DELETE
  USING (
    team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  );

CREATE POLICY "org admins can insert rep_player_awards"
  ON public.rep_player_awards FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "org admins can update rep_player_awards"
  ON public.rep_player_awards FOR UPDATE
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

CREATE POLICY "org admins can delete rep_player_awards"
  ON public.rep_player_awards FOR DELETE
  USING (
    org_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
