-- Migration 221: Practice Plans Phase 3 — plan templates, the shared TAG vocabulary, and the
-- after-practice recap.
--
-- Owner rulings taken at mockup sign-off 2026-08-01; full record in
-- docs/projects/active/COACH_PRACTICE_PLANS_PLAN.md §10.8. Read that before changing anything here.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 1. CATEGORIES BECAME TAGS — and this migration RETIRES what mig 218 shipped three hours ago
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Phase 2 gave a drill a coach-typed free-text `category`, and a focus area a matching one, so the
-- focus rail could tell that a hitting drill relates to a hitting focus area. The owner has ruled
-- that vocabulary becomes REAL TAGS, drawn from ONE shared list across drills, plan templates,
-- practice plans and players' focus areas.
--
-- ⚠ WHY THIS IS NOT CHURN. Free text had a live defect: `collectDrillCategories` de-duplicated
-- case-insensitively while `filterDrills` compared exactly, so a coach who typed "Hitting" once and
-- "hitting" later got ONE chip, an UNDER-COUNT on it, and a set of drills reachable by NO CHIP AT
-- ALL. Tags fix that by CONSTRUCTION — `rep_team_tags` has carried a case-insensitive unique index
-- per (team, kind) since mig 181 — rather than by patching one comparison and hoping the next
-- surface remembers. They also bring rename and, above all, `merge_rep_team_tags`, which atomically
-- re-points history when a coach ends up with "Hitting" and "Hitting mechanics".
--
-- ⚠ ZERO CUSTOMER IMPACT, AND THAT IS WHY IT IS NOW OR NEVER. Mig 218 is DEV-ONLY and the drill
-- library has never been on prod, so there is no real coach's data to convert. The dev-data
-- conversion is at the bottom of this file and is best-effort by design.
--
-- REUSE, NOT A SECOND SYSTEM. This adds ONE new `kind` to the tag library the product already runs
-- for game tags (mig 181) and money tags, including its org-shared rows (mig 184). It does NOT add
-- a parallel tagging mechanism.
--
-- ⚠ A PRACTICE PLAN'S TAGS NEED NO NEW TABLE: they are rows in the existing `rep_team_event_tags`,
-- told apart by the tag's `kind`. A practice event carrying a 'focus' tag IS a tagged plan. This is
-- what makes "show me every hitting practice I have run" a query we already have the joins for.
--
-- ⚠ THE FOCUS-AREA ASYMMETRY IS DELIBERATE (owner, explicitly). A drill / template / plan carries
-- SEVERAL tags — a join table. A FOCUS AREA carries ONE, as a nullable FK, because a focus area is
-- FREE TEXT FIRST: "loading their back hip", "changeup accuracy". The coach's specific words stay
-- the record and the tag is only a grouping handle so the rail can match it to tonight's practice.
-- Flattening the two would lose the coaching. Do not "make them consistent".
--
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 2. PLAN TEMPLATES — team-scoped, and deliberately NOT year-scoped
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠ `rep_team_lineup_templates` (mig 159) is keyed (team_id, program_year_id). This table is NOT,
-- and the difference is the whole archive ruling: a TEAM IS PERMANENT and only its program year
-- turns over, so a team-scoped template library crosses a season rollover with nothing to import —
-- the same discovery that made the drill library's archive ruling cheap. Copying mig 159's shape
-- would strand every coach's templates each autumn. §7's "the V1 shape lifts in unchanged" is
-- overridden on this one point.
--
-- A template is an INSTRUMENT, so it is live-season only and its door is hidden in a completed
-- season. It stores the plan's SHAPE as jsonb — the same structure `rep_team_events.practice_plan`
-- holds — so loading one is a copy, not a join, exactly as a drill is.
--
-- ⚠ team_id is NOT NULL. Club-wide TEMPLATES were never asked for and are not built. If that is
-- ever ruled in, mig 184's nullable-team_id widening is the cheap, precedented path — but it is an
-- owner decision, not a build-time one.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 3. THE RECAP — one free-text note per practice (D17)
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- Lives on the event beside `practice_plan` (mig 213), so it is season-keyed for free and a 2025
-- recap is permanently attached to 2025.
--
-- ⚠ ABOUT THE PRACTICE, NEVER ABOUT A CHILD (D17's hard guardrail). "Tees were too crowded, run
-- four next time" is the whole value. There is deliberately no per-player recap column and none may
-- be added — per-child commentary would drift into behavioural profiling on minors.
--
-- ⚠ THIS DOES NOT REOPEN D4. Nothing at the field records anything. An unhurried note written at
-- home is a different act from an abandoned tick-box mid-drill, which is why there are still no
-- per-block "ran it" ticks anywhere in this schema.
--
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- DEV-ONLY at author time; ⚠ PROD-PENDING. Apply to prod WITH 213 and 218 BEFORE promoting code
-- that reads these tables, per the migration-040 incident lesson.
-- ────────────────────────────────────────────────────────────────────────────────────────────

-- ════════════════════════════════════════════════════════════════════
-- 1. The 'focus' tag kind
-- ════════════════════════════════════════════════════════════════════

-- Widen the kind CHECK. 'focus' is the ONE vocabulary shared by drills, templates, plans and focus
-- areas — named for what it describes (what the work is about), not for any one surface that uses it.
ALTER TABLE public.rep_team_tags DROP CONSTRAINT IF EXISTS rep_team_tags_kind_check;
ALTER TABLE public.rep_team_tags
  ADD CONSTRAINT rep_team_tags_kind_check CHECK (kind IN ('game', 'expense', 'focus'));

-- ════════════════════════════════════════════════════════════════════
-- 2. rep_team_drill_tags — several tags per drill
--
-- Tenancy is reached through the DRILL, not the tag: a drill already carries org_id + team_id and
-- is policed on them, and an org-shared drill must be taggable by an org admin while a team's own
-- drill is taggable by its coaches. Reaching through the tag would get the shared case wrong.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rep_team_drill_tags (
  drill_id   uuid        NOT NULL REFERENCES public.rep_team_drills(id) ON DELETE CASCADE,
  tag_id     uuid        NOT NULL REFERENCES public.rep_team_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (drill_id, tag_id)
);

CREATE INDEX IF NOT EXISTS rep_team_drill_tags_tag_idx
  ON public.rep_team_drill_tags(tag_id);

ALTER TABLE public.rep_team_drill_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read rep_team_drill_tags"
  ON public.rep_team_drill_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_drills d
    WHERE d.id = rep_team_drill_tags.drill_id
      AND d.org_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
  ));

-- A coach reads their own team's drill tags AND the org-shared ones (team_id IS NULL), mirroring
-- how the drill list itself is assembled.
CREATE POLICY "coaches can read assigned team drill tags"
  ON public.rep_team_drill_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_drills d
    WHERE d.id = rep_team_drill_tags.drill_id
      AND (
        d.team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
        OR (d.team_id IS NULL AND d.org_id IN (
          SELECT r.org_id FROM public.rep_teams r
          JOIN public.rep_team_coaches c ON c.team_id = r.id
          WHERE c.user_id = auth.uid()
        ))
      )
  ));

CREATE POLICY "coaches can insert rep_team_drill_tags"
  ON public.rep_team_drill_tags FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rep_team_drills d
    WHERE d.id = rep_team_drill_tags.drill_id
      AND d.team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  ));

CREATE POLICY "coaches can delete rep_team_drill_tags"
  ON public.rep_team_drill_tags FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_drills d
    WHERE d.id = rep_team_drill_tags.drill_id
      AND d.team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  ));

CREATE POLICY "org admins can insert rep_team_drill_tags"
  ON public.rep_team_drill_tags FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rep_team_drills d
    WHERE d.id = rep_team_drill_tags.drill_id
      AND d.org_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND role = 'admin'
      )
  ));

CREATE POLICY "org admins can delete rep_team_drill_tags"
  ON public.rep_team_drill_tags FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_drills d
    WHERE d.id = rep_team_drill_tags.drill_id
      AND d.org_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND role = 'admin'
      )
  ));

-- ════════════════════════════════════════════════════════════════════
-- 3. rep_team_plan_templates — a saved practice shape
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rep_team_plan_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- NOT NULL, deliberately: club-wide templates are not built. See the header.
  team_id     uuid        NOT NULL REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  name        text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  -- The plan SHAPE — the same structure rep_team_events.practice_plan holds. Copied on load, never
  -- joined to, so editing a template cannot rewrite a practice already written from it.
  plan        jsonb       NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(plan) = 'object'),
  is_active   boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One ACTIVE name per team, case-insensitive (partial → a retired name can be reused). Same idiom
-- as the drill library, and the reason the "Hitting"/"hitting" class of defect cannot occur here.
CREATE UNIQUE INDEX IF NOT EXISTS rep_team_plan_templates_name_uniq
  ON public.rep_team_plan_templates(team_id, lower(btrim(name)))
  WHERE is_active;

CREATE INDEX IF NOT EXISTS rep_team_plan_templates_team_idx
  ON public.rep_team_plan_templates(team_id, is_active);

CREATE INDEX IF NOT EXISTS rep_team_plan_templates_org_idx
  ON public.rep_team_plan_templates(org_id);

ALTER TABLE public.rep_team_plan_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read rep_team_plan_templates"
  ON public.rep_team_plan_templates FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read assigned team plan templates"
  ON public.rep_team_plan_templates FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can insert rep_team_plan_templates"
  ON public.rep_team_plan_templates FOR INSERT
  WITH CHECK (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can update rep_team_plan_templates"
  ON public.rep_team_plan_templates FOR UPDATE
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ))
  WITH CHECK (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "org admins can update rep_team_plan_templates"
  ON public.rep_team_plan_templates FOR UPDATE
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (org_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ⚠ No DELETE policy, on purpose. A template is RETIRED (is_active=false), never hard-deleted —
-- the mig-182/189 library idiom. Plans already started from it are unaffected either way, since a
-- plan copies the shape rather than referencing it, but retire keeps the usage history readable.

-- ════════════════════════════════════════════════════════════════════
-- 4. rep_team_plan_template_tags — several tags per template
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rep_team_plan_template_tags (
  template_id uuid        NOT NULL REFERENCES public.rep_team_plan_templates(id) ON DELETE CASCADE,
  tag_id      uuid        NOT NULL REFERENCES public.rep_team_tags(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, tag_id)
);

CREATE INDEX IF NOT EXISTS rep_team_plan_template_tags_tag_idx
  ON public.rep_team_plan_template_tags(tag_id);

ALTER TABLE public.rep_team_plan_template_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read rep_team_plan_template_tags"
  ON public.rep_team_plan_template_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_plan_templates t
    WHERE t.id = rep_team_plan_template_tags.template_id
      AND t.org_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
  ));

CREATE POLICY "coaches can read assigned team template tags"
  ON public.rep_team_plan_template_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_plan_templates t
    WHERE t.id = rep_team_plan_template_tags.template_id
      AND t.team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  ));

CREATE POLICY "coaches can insert rep_team_plan_template_tags"
  ON public.rep_team_plan_template_tags FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rep_team_plan_templates t
    WHERE t.id = rep_team_plan_template_tags.template_id
      AND t.team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  ));

CREATE POLICY "coaches can delete rep_team_plan_template_tags"
  ON public.rep_team_plan_template_tags FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_plan_templates t
    WHERE t.id = rep_team_plan_template_tags.template_id
      AND t.team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  ));

-- ════════════════════════════════════════════════════════════════════
-- 5. A focus area's ONE optional tag — replacing mig 218's free-text category
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.rep_player_development_goals
  ADD COLUMN IF NOT EXISTS tag_id uuid REFERENCES public.rep_team_tags(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rep_player_development_goals_tag_idx
  ON public.rep_player_development_goals(tag_id);

COMMENT ON COLUMN public.rep_player_development_goals.tag_id IS
  'Optional grouping tag from the shared ''focus'' vocabulary (Phase 3, owner ruling 2026-08-01). '
  '⚠ The focus area itself stays FREE TEXT in focus_area — "loading their back hip" — and the tag '
  'never replaces it. NULL means the coach has not said, and renders at FULL strength in the focus '
  'rail: never dimmed, never hidden. Nothing is back-filled and nothing is inferred from keywords, '
  'because free text does not cluster and guessing would be a confident lie (§4). ON DELETE SET NULL '
  'so retiring a tag degrades the grouping, never the coach''s words.';

-- ════════════════════════════════════════════════════════════════════
-- 6. The after-practice recap
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.rep_team_events
  ADD COLUMN IF NOT EXISTS practice_recap text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rep_team_events_practice_recap_len'
  ) THEN
    ALTER TABLE public.rep_team_events
      ADD CONSTRAINT rep_team_events_practice_recap_len
      CHECK (practice_recap IS NULL OR char_length(practice_recap) <= 2000);
  END IF;
END $$;

COMMENT ON COLUMN public.rep_team_events.practice_recap IS
  '"How it went" — one free-text note a coach writes AFTER a practice, at home (D17, Phase 3). '
  '⚠ ABOUT THE PRACTICE, NEVER ABOUT A CHILD: per-child commentary would drift into behavioural '
  'profiling on minors, so there is deliberately no per-player equivalent and none may be added. '
  '⚠ This does NOT reopen D4 — nothing at the field records anything, and there are still no '
  'per-block "ran it" ticks. NULL means nothing was written, which the UI states honestly rather '
  'than rendering blank. Coach-facing only: families never see it.';

-- ════════════════════════════════════════════════════════════════════
-- 7. merge_rep_team_tags — REPLACED so a merge re-points EVERY surface
--
-- ⚠ The mig-181 version only re-pointed rep_team_event_tags, which was complete then and is not
-- now. A merge that silently dropped a tag's drills, templates and focus areas would be worse than
-- no merge at all — the coach would believe history had been preserved.
--
-- ⚠ Also fixes a latent scope hole: the original compared `v_winner.team_id <> v_loser.team_id`,
-- which is NULL (not TRUE) whenever either side is an ORG-SHARED tag — so after mig 184 widened
-- team_id, that guard silently stopped rejecting a cross-scope merge. IS DISTINCT FROM is
-- NULL-correct and restores the intent.
-- ════════════════════════════════════════════════════════════════════

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
  -- org are not. `<>` returned NULL here and let both cases through.
  IF v_winner.team_id IS DISTINCT FROM v_loser.team_id THEN
    RAISE EXCEPTION 'merge_rep_team_tags_team_mismatch';
  END IF;

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

  DELETE FROM public.rep_team_tags WHERE id = p_loser_tag_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_rep_team_tags(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.merge_rep_team_tags(uuid, uuid) TO authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════
-- 8. Convert the dev-only free-text categories into tags, then drop them
--
-- ⚠ Best-effort BY DESIGN, and safe precisely because this data does not exist on prod. Every
-- distinct category on a TEAM-OWNED drill becomes a 'focus' tag for that team; the drill and any
-- focus area carrying the same word are linked to it.
--
-- ORG-SHARED drills (team_id IS NULL) are deliberately SKIPPED: a shared drill belongs to no team,
-- and rep_team_tags rows are keyed per team+kind, so there is no correct team to mint the tag under.
-- The org-shared tag shape (team_id NULL) exists, but auto-creating shared vocabulary from one
-- team's typing would put words in a club's mouth. A club admin re-tags the shared set by hand —
-- there are at most a handful, and the library ships empty anyway.
-- ════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
  v_tag_id uuid;
BEGIN
  -- Only run if mig 218's columns are still present (idempotent re-runs).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rep_team_drills' AND column_name = 'category'
  ) THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT DISTINCT d.org_id, d.team_id, btrim(d.category) AS cat
    FROM public.rep_team_drills d
    WHERE d.team_id IS NOT NULL
      AND d.category IS NOT NULL
      AND btrim(d.category) <> ''
  LOOP
    INSERT INTO public.rep_team_tags (org_id, team_id, kind, name)
    VALUES (r.org_id, r.team_id, 'focus', r.cat)
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_tag_id
    FROM public.rep_team_tags
    WHERE team_id = r.team_id AND kind = 'focus' AND lower(btrim(name)) = lower(r.cat);

    IF v_tag_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.rep_team_drill_tags (drill_id, tag_id)
    SELECT d.id, v_tag_id
    FROM public.rep_team_drills d
    WHERE d.team_id = r.team_id
      AND lower(btrim(d.category)) = lower(r.cat)
    ON CONFLICT DO NOTHING;

    -- A focus area that used the same word joins the same tag — which is the whole point of the
    -- shared vocabulary, and was already the intent of mig 218's paired columns.
    UPDATE public.rep_player_development_goals g
    SET tag_id = v_tag_id
    WHERE g.team_id = r.team_id
      AND g.tag_id IS NULL
      AND g.category IS NOT NULL
      AND lower(btrim(g.category)) = lower(r.cat);
  END LOOP;
END $$;

-- Drop the retired columns. Their meaning now lives in the tag tables above.
ALTER TABLE public.rep_player_development_goals
  DROP CONSTRAINT IF EXISTS rep_player_development_goals_category_len;
ALTER TABLE public.rep_player_development_goals DROP COLUMN IF EXISTS category;
ALTER TABLE public.rep_team_drills DROP COLUMN IF EXISTS category;
