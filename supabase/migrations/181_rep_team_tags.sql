-- Migration 181: Coach Tags — per-team tag library + event-tag links (Coach Tags & Player Awards,
-- Phase 1: game tags + the Season Review "vs tag" report).
--
-- A coach's own vocabulary stuck onto games so reports can answer questions like "how do we do
-- against the top teams?" later. Per-team library for V1 (org-promote to a shared library is a
-- later phase, not built here — team_id stays NOT NULL until that phase widens it).
--
-- rep_team_tags: one name per team+kind, case-insensitive (mirrors rep_team_lineup_templates'
-- name-uniqueness convention, mig 159). kind='game' is what Phase 1 exposes; kind='expense' is
-- reserved for the Phase 3 money-tags slice (same library shape, no separate table needed then).
-- Cap (50 tags per team+kind) is enforced in-process at the create route, not a DB constraint —
-- same TOCTOU-acceptable convention as rep_team_lineup_templates.
--
-- rep_team_event_tags: many-to-many between rep_team_tags and rep_team_events. No duplicate
-- org_id/team_id columns — RLS reaches tenancy through tag_id (mirrors migration 071's
-- rep_team_lineup_entries EXISTS-subquery pattern), since a tag's team_id/org_id already pins scope
-- and a tag can only ever be linked to events on its own team (enforced app-side, not by an FK that
-- can't cross two tables).
--
-- merge_rep_team_tags: the plan's "merge must atomically re-point history" guardrail — a Postgres
-- function (not two app-layer statements) so a mid-way failure can't strand some games pointing at
-- a tag that's about to disappear. First atomic-merge precedent in this codebase (no prior "merge"
-- operation existed); modeled after accept_tryout_and_create_dues (mig 169) for the transactional
-- function-only-migration shape.
--
-- DEV-ONLY at author time; ⚠ PROD-PENDING — apply to prod at release BEFORE promoting code that
-- reads these tables (else prod 500s), per the "migration-040 incident" lesson.

CREATE TABLE IF NOT EXISTS public.rep_team_tags (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id     uuid        NOT NULL REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  kind        text        NOT NULL CHECK (kind IN ('game', 'expense')),
  name        text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One tag name per team+kind, case-insensitive (expression index → not a table constraint).
CREATE UNIQUE INDEX IF NOT EXISTS rep_team_tags_name_uniq
  ON public.rep_team_tags(team_id, kind, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS rep_team_tags_team_idx
  ON public.rep_team_tags(team_id, kind);

CREATE INDEX IF NOT EXISTS rep_team_tags_org_idx
  ON public.rep_team_tags(org_id);

ALTER TABLE public.rep_team_tags ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Read policies — org members + coaches assigned to the team
-- (mirrors migration 159's SELECT policies on rep_team_lineup_templates)
-- ============================================================

CREATE POLICY "org members can read rep_team_tags"
  ON public.rep_team_tags FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read assigned team tags"
  ON public.rep_team_tags FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

-- ============================================================
-- Write policies — coaches on assigned teams + org admins
-- (mirrors migration 159; INSERT=WITH CHECK, UPDATE=USING+CHECK, DELETE=USING)
-- ============================================================

-- --- Coaches ---

CREATE POLICY "coaches can insert rep_team_tags"
  ON public.rep_team_tags FOR INSERT
  WITH CHECK (
    team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  );

CREATE POLICY "coaches can update rep_team_tags"
  ON public.rep_team_tags FOR UPDATE
  USING (
    team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  )
  WITH CHECK (
    team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  );

CREATE POLICY "coaches can delete rep_team_tags"
  ON public.rep_team_tags FOR DELETE
  USING (
    team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  );

-- --- Org admins ---

CREATE POLICY "org admins can insert rep_team_tags"
  ON public.rep_team_tags FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "org admins can update rep_team_tags"
  ON public.rep_team_tags FOR UPDATE
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

CREATE POLICY "org admins can delete rep_team_tags"
  ON public.rep_team_tags FOR DELETE
  USING (
    org_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- rep_team_event_tags — join table (a tag applied to a game)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rep_team_event_tags (
  event_id   uuid        NOT NULL REFERENCES public.rep_team_events(id) ON DELETE CASCADE,
  tag_id     uuid        NOT NULL REFERENCES public.rep_team_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, tag_id)
);

CREATE INDEX IF NOT EXISTS rep_team_event_tags_tag_idx
  ON public.rep_team_event_tags(tag_id);

ALTER TABLE public.rep_team_event_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read rep_team_event_tags"
  ON public.rep_team_event_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_tags tag
    WHERE tag.id = rep_team_event_tags.tag_id
      AND tag.org_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
  ));

CREATE POLICY "coaches can read assigned team event tags"
  ON public.rep_team_event_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_tags tag
    WHERE tag.id = rep_team_event_tags.tag_id
      AND tag.team_id IN (
        SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
      )
  ));

CREATE POLICY "coaches can insert rep_team_event_tags"
  ON public.rep_team_event_tags FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rep_team_tags tag
    WHERE tag.id = rep_team_event_tags.tag_id
      AND tag.team_id IN (
        SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
      )
  ));

CREATE POLICY "coaches can delete rep_team_event_tags"
  ON public.rep_team_event_tags FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_tags tag
    WHERE tag.id = rep_team_event_tags.tag_id
      AND tag.team_id IN (
        SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
      )
  ));

CREATE POLICY "org admins can insert rep_team_event_tags"
  ON public.rep_team_event_tags FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rep_team_tags tag
    WHERE tag.id = rep_team_event_tags.tag_id
      AND tag.org_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND role = 'admin'
      )
  ));

CREATE POLICY "org admins can delete rep_team_event_tags"
  ON public.rep_team_event_tags FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_tags tag
    WHERE tag.id = rep_team_event_tags.tag_id
      AND tag.org_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND role = 'admin'
      )
  ));

-- ============================================================
-- merge_rep_team_tags — atomic rename-target merge RPC
--
-- Re-points every rep_team_event_tags row from p_loser_tag_id to p_winner_tag_id, then deletes the
-- loser tag. ON CONFLICT DO NOTHING skips games already tagged with the winner (the PK would
-- otherwise raise a duplicate-key error on a game carrying both tags), then the plain DELETE mops up
-- any (event_id, loser) rows left over from that skip before the tag itself is removed — so no
-- orphaned link rows survive the loser's cascade delete by accident of ordering.
-- ============================================================

CREATE OR REPLACE FUNCTION public.merge_rep_team_tags(p_winner_tag_id uuid, p_loser_tag_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner public.rep_team_tags%rowtype;
  v_loser  public.rep_team_tags%rowtype;
BEGIN
  IF p_winner_tag_id = p_loser_tag_id THEN
    RAISE EXCEPTION 'merge_rep_team_tags_same_tag';
  END IF;

  SELECT * INTO v_winner FROM public.rep_team_tags WHERE id = p_winner_tag_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'merge_rep_team_tags_winner_not_found';
  END IF;

  SELECT * INTO v_loser FROM public.rep_team_tags WHERE id = p_loser_tag_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'merge_rep_team_tags_loser_not_found';
  END IF;

  IF v_winner.team_id <> v_loser.team_id THEN
    RAISE EXCEPTION 'merge_rep_team_tags_team_mismatch';
  END IF;

  IF v_winner.kind <> v_loser.kind THEN
    RAISE EXCEPTION 'merge_rep_team_tags_kind_mismatch';
  END IF;

  INSERT INTO public.rep_team_event_tags (event_id, tag_id)
  SELECT event_id, p_winner_tag_id
  FROM public.rep_team_event_tags
  WHERE tag_id = p_loser_tag_id
  ON CONFLICT (event_id, tag_id) DO NOTHING;

  DELETE FROM public.rep_team_event_tags WHERE tag_id = p_loser_tag_id;

  DELETE FROM public.rep_team_tags WHERE id = p_loser_tag_id;
END;
$$;

COMMENT ON FUNCTION public.merge_rep_team_tags(uuid, uuid) IS
  'Atomically re-points every rep_team_event_tags row from the loser tag to the winner, then deletes '
  'the loser. Caller (coach tags merge API route) enforces auth + resolves which tag is which; this '
  'enforces same-team, same-kind, and atomicity. Coach Tags & Player Awards Phase 1.';
