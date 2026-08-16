-- 239: MONEY TAGS REACH MONEY COMING IN
-- (COACH_SPONSORSHIPS_PLAN §8 follow-up 2 — owner-confirmed 2026-08-15).
--
-- Money tags shipped in migration 184 for SPENDING only. The tag report, the Expenses filter and
-- the Budget vs. Actual filter therefore answer "what did this label cost us?" and have never been
-- able to answer "what did this label BRING IN?" — a team running "Winter dome" as both a cost
-- centre and a sponsorship target could tag one half of it and not the other.
--
-- The sponsorships mockup carried a Tags field on a fundraising record; the owner cut the tag
-- FILTER from that screen (five rows do not need one) and the field was read as cut with it. It
-- was not. This is the field.
--
-- ⚠ THE SAME LIBRARY, NOT A NEW ONE. `rep_team_tags.kind = 'expense'` IS the money vocabulary —
-- a coach who tags an expense "Tournament weekend" must be able to tag the sponsor that paid for
-- it with the SAME tag, or the report has two vocabularies that look like one. So this adds a
-- junction table and nothing else: no new kind, no second picker, no second manage screen.
--
-- DEV-ONLY at author time; ⚠ PROD-PENDING — apply to prod at release BEFORE promoting code that
-- reads this table (else prod 500s), per the "migration-040 incident" lesson.

-- ============================================================
-- rep_team_fundraiser_tags — a money tag applied to a fundraiser or sponsor
--   (mirrors rep_team_expense_tags, mig 184, FK'd to rep_fundraisers)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rep_team_fundraiser_tags (
  fundraiser_id uuid        NOT NULL REFERENCES public.rep_fundraisers(id) ON DELETE CASCADE,
  tag_id        uuid        NOT NULL REFERENCES public.rep_team_tags(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fundraiser_id, tag_id)
);

CREATE INDEX IF NOT EXISTS rep_team_fundraiser_tags_tag_idx
  ON public.rep_team_fundraiser_tags(tag_id);

ALTER TABLE public.rep_team_fundraiser_tags ENABLE ROW LEVEL SECURITY;

-- RLS reaches tenancy through the FUNDRAISER, not the tag — the same choice migration 184 made and
-- for the same reason: an org-shared money tag has team_id NULL, so scoping through the tag would
-- drop the link out of the coach's own reach. The fundraiser's team_id/org_id own the link.

CREATE POLICY "org members can read rep_team_fundraiser_tags"
  ON public.rep_team_fundraiser_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rep_fundraisers fr
    WHERE fr.id = rep_team_fundraiser_tags.fundraiser_id
      AND fr.org_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
  ));

CREATE POLICY "coaches can read assigned team fundraiser tags"
  ON public.rep_team_fundraiser_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rep_fundraisers fr
    WHERE fr.id = rep_team_fundraiser_tags.fundraiser_id
      AND fr.team_id IN (
        SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
      )
  ));

CREATE POLICY "coaches can insert rep_team_fundraiser_tags"
  ON public.rep_team_fundraiser_tags FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rep_fundraisers fr
    WHERE fr.id = rep_team_fundraiser_tags.fundraiser_id
      AND fr.team_id IN (
        SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
      )
  ));

CREATE POLICY "coaches can delete rep_team_fundraiser_tags"
  ON public.rep_team_fundraiser_tags FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.rep_fundraisers fr
    WHERE fr.id = rep_team_fundraiser_tags.fundraiser_id
      AND fr.team_id IN (
        SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
      )
  ));

CREATE POLICY "org admins can insert rep_team_fundraiser_tags"
  ON public.rep_team_fundraiser_tags FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rep_fundraisers fr
    WHERE fr.id = rep_team_fundraiser_tags.fundraiser_id
      AND fr.org_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND role = 'admin'
      )
  ));

CREATE POLICY "org admins can delete rep_team_fundraiser_tags"
  ON public.rep_team_fundraiser_tags FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.rep_fundraisers fr
    WHERE fr.id = rep_team_fundraiser_tags.fundraiser_id
      AND fr.org_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND role = 'admin'
      )
  ));

COMMENT ON TABLE public.rep_team_fundraiser_tags IS
  'A money tag (rep_team_tags, kind=''expense'') applied to a fundraiser or sponsor. The SAME '
  'vocabulary as expense tags on purpose: a label a coach spends against must also be a label they '
  'can raise against, or the money-tag report has two vocabularies wearing one name. Tenancy is '
  'reached through the fundraiser, because an org-shared tag has team_id NULL.';

-- ============================================================
-- merge_rep_team_tags — extend to re-point FUNDRAISER links too
--
-- ⚠ WITHOUT THIS, MERGING TWO MONEY TAGS SILENTLY LOSES THE MONEY-IN SIDE. A fundraiser link on
-- the loser tag would simply vanish down the FK cascade, so "merge Sponsors into Sponsorship"
-- would keep every tagged expense and drop every tagged sponsor — the half nobody would think to
-- check, because the merge reports success.
--
-- ⚠⚠ AND THE SAME TRAP CAUGHT THIS MIGRATION ON ITS FIRST DRAFT, WHICH IS WHY THIS BLOCK IS SO
-- LOUD. `CREATE OR REPLACE FUNCTION` replaces the WHOLE body, so it is only ever correct to build
-- it from the CURRENT definition. The first draft of 239 was copied from **migration 184** — but
-- **migration 221** had already replaced this function since, adding three more lanes (drills,
-- plan templates, focus-area goals) and an org-mismatch guard. Copying 184 forward would have
-- deleted every drill link and every plan-template link on a merged tag, NULLed every player's
-- focus-area grouping, and reopened a cross-ORG merge of two shared tags — while the merge
-- reported success. Found in review before it left dev.
--
-- **THE RULE, for whoever adds the fifth link table:** `grep -n "merge_rep_team_tags"
-- supabase/migrations/*.sql`, take the HIGHEST-numbered definition, and add your lane to THAT.
-- This body is 221's, verbatim, plus the fundraiser lane.
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

  -- NULL-correct: a team tag and an org-shared tag are DISTINCT, and two shared tags in the same
  -- org are not. `<>` returned NULL here and let both cases through (mig 221).
  IF v_winner.team_id IS DISTINCT FROM v_loser.team_id THEN
    RAISE EXCEPTION 'merge_rep_team_tags_team_mismatch';
  END IF;

  -- ⚠ THE ORG GUARD IS LOAD-BEARING FOR SHARED TAGS. Two org-shared tags both have team_id NULL,
  -- so the team check above cannot tell them apart — without this, tags from two DIFFERENT
  -- organizations merge cleanly. Added by mig 221; dropped by 239's first draft; restored here.
  IF v_winner.org_id IS DISTINCT FROM v_loser.org_id THEN
    RAISE EXCEPTION 'merge_rep_team_tags_org_mismatch';
  END IF;

  IF v_winner.kind <> v_loser.kind THEN
    RAISE EXCEPTION 'merge_rep_team_tags_kind_mismatch';
  END IF;

  -- Events (game tags, and a practice plan's own tags — same table, told apart by kind).
  INSERT INTO public.rep_team_event_tags (event_id, tag_id)
  SELECT event_id, p_winner_tag_id
  FROM public.rep_team_event_tags
  WHERE tag_id = p_loser_tag_id
  ON CONFLICT (event_id, tag_id) DO NOTHING;

  DELETE FROM public.rep_team_event_tags WHERE tag_id = p_loser_tag_id;

  -- Drills.
  INSERT INTO public.rep_team_drill_tags (drill_id, tag_id)
  SELECT drill_id, p_winner_tag_id
  FROM public.rep_team_drill_tags
  WHERE tag_id = p_loser_tag_id
  ON CONFLICT (drill_id, tag_id) DO NOTHING;

  DELETE FROM public.rep_team_drill_tags WHERE tag_id = p_loser_tag_id;

  -- Plan templates.
  INSERT INTO public.rep_team_plan_template_tags (template_id, tag_id)
  SELECT template_id, p_winner_tag_id
  FROM public.rep_team_plan_template_tags
  WHERE tag_id = p_loser_tag_id
  ON CONFLICT (template_id, tag_id) DO NOTHING;

  DELETE FROM public.rep_team_plan_template_tags WHERE tag_id = p_loser_tag_id;

  -- Focus areas — a single FK, so a plain UPDATE rather than an insert/conflict pair.
  UPDATE public.rep_player_development_goals
  SET tag_id = p_winner_tag_id, updated_at = now()
  WHERE tag_id = p_loser_tag_id;

  -- Money OUT (expenses).
  INSERT INTO public.rep_team_expense_tags (expense_id, tag_id)
  SELECT expense_id, p_winner_tag_id
  FROM public.rep_team_expense_tags
  WHERE tag_id = p_loser_tag_id
  ON CONFLICT (expense_id, tag_id) DO NOTHING;

  DELETE FROM public.rep_team_expense_tags WHERE tag_id = p_loser_tag_id;

  -- Money IN (fundraisers and sponsors) — the lane this migration adds.
  INSERT INTO public.rep_team_fundraiser_tags (fundraiser_id, tag_id)
  SELECT fundraiser_id, p_winner_tag_id
  FROM public.rep_team_fundraiser_tags
  WHERE tag_id = p_loser_tag_id
  ON CONFLICT (fundraiser_id, tag_id) DO NOTHING;

  DELETE FROM public.rep_team_fundraiser_tags WHERE tag_id = p_loser_tag_id;

  DELETE FROM public.rep_team_tags WHERE id = p_loser_tag_id;
END;
$$;

-- Restated because CREATE OR REPLACE does not reset privileges but a fresh environment applying
-- these files in order must still land on the same ACL (mig 221 set this).
REVOKE ALL ON FUNCTION public.merge_rep_team_tags(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.merge_rep_team_tags(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.merge_rep_team_tags(uuid, uuid) IS
  'Atomically re-points EVERY surface a tag can be attached to — events, drills, plan templates, '
  'focus-area goals, expenses and fundraisers/sponsors — from the loser tag to the winner, then '
  'deletes the loser. Same-team, same-ORG (both IS DISTINCT FROM, so org-wide NULL=NULL merges '
  'within one org and never across two) and same-kind guarded. Coach Tags Phase 1 (mig 181) + '
  'expense links (184) + drills/templates/focus + org guard (221) + fundraising links (239). '
  '⚠ Adding a seventh surface means editing the HIGHEST-numbered definition, never an older one.';
