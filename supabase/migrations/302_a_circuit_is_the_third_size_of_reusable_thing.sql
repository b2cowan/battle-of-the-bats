-- 302 — A circuit is the third size of reusable thing
-- (practices re-evaluation, stage 4 · The library — owner ruling L9, 2026-09-16: "we currently have
-- plan templates and drills — how can we incorporate a block of drills as something to save and
-- drag over? A coach should be able to save each individual tee station as well as the block.")
--
-- A DRILL (mig 218) is one station's worth and an IDENTITY — copied never linked, read-only on the
-- plan, detached on edit. A TEMPLATE (mig 221) is a whole practice and SCAFFOLDING — copy-on-load,
-- fully editable, provenance kept. A block WITH STATIONS — a circuit — sat between them and nothing
-- kept one: with stage 3's D13 a plain written block saves as a drill and returns as a block, but
-- the one shape the editor is best at making was the one shape the library could not hold.
--
-- ⚠ A CIRCUIT FOLLOWS THE TEMPLATE'S RULE, ONE LEVEL DOWN — not the drill's. Placed on a practice
-- it arrives fully editable with a quiet provenance line ("Started from Skills circuit · changes
-- here stay here"), counts "Started N plans" over plans whose blocks carry its id, and carries NO
-- PEOPLE (staff, players, groups, tonight's notes and any hand-arranged grid stay with the night
-- it was saved from — `blockToCircuitShape` strips them on every write AND every read). The
-- drill-backed stations INSIDE a circuit keep the drill rule (`drillId` survives, as it does in a
-- template). Rules live in `lib/rep-circuits.ts`.
--
-- ⚠ SHAPED LIKE `rep_team_plan_templates`, DELIBERATELY: team-scoped and NOT program-year-scoped
-- (a team is permanent; only its year turns over, so the library crosses a rollover with nothing
-- to import — the archive ruling), `team_id` NOT NULL (club-wide circuits were never asked for),
-- ONE block's jsonb where a template holds a plan's, retire never delete, one ACTIVE name per team
-- case-insensitively, the same head-coach-only write policies mig 222 gave templates (RLS is
-- defence in depth here — every route runs service-role and gates on `canWritePracticePlans`).
--
-- ⚠ THE PLAN JSON GAINS TWO OPTIONAL KEYS ON A BLOCK — `circuitId` and `circuitName` — read by the
-- sanitiser like `templateId`/`templateName` on the plan. No version bump; no column. A stored plan
-- written before this migration reads exactly as before.
--
-- ⚠ `merge_rep_team_tags` GAINS ITS SEVENTH LANE. The comment on mig 239's definition says it in
-- capitals: "adding a seventh surface means editing the HIGHEST-numbered definition, never an
-- older one." This body is 239's, verbatim, plus the circuit lane — the fundraiser lane is kept.
-- Without it, merging two focus tags would CASCADE-delete every circuit's link to the loser
-- instead of re-pointing it, while the merge reported success (the exact defect 239 found in its
-- own first draft).
--
-- ⚠ The function is invisible to `check:migrations` (a function is neither a table, a column nor a
-- constraint) — registered in MANUAL_PROD_STEPS.json. ORDER: apply to prod BEFORE promoting the
-- code that reads `rep_team_circuits` (the migration-040 incident lesson); independent of 297–301.

-- ════════════════════════════════════════════════════════════════════
-- 1. rep_team_circuits — a saved block with stations
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rep_team_circuits (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- NOT NULL, deliberately: club-wide circuits are not built (the template's rule, mig 221).
  team_id     uuid        NOT NULL REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  name        text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  -- ONE block's shape — the same structure as one entry of rep_team_events.practice_plan->'blocks'.
  -- Copied on placement, never joined to, so editing a circuit cannot rewrite a practice already
  -- written from it. Emptied of people on every write and every read (`blockToCircuitShape`).
  block       jsonb       NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(block) = 'object'),
  is_active   boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One ACTIVE name per team, case-insensitive (partial → a retired name can be reused). The drill
-- and template libraries' idiom, and the reason "Skills circuit"/"skills circuit" cannot both exist.
CREATE UNIQUE INDEX IF NOT EXISTS rep_team_circuits_name_uniq
  ON public.rep_team_circuits(team_id, lower(btrim(name)))
  WHERE is_active;

CREATE INDEX IF NOT EXISTS rep_team_circuits_team_idx
  ON public.rep_team_circuits(team_id, is_active);

CREATE INDEX IF NOT EXISTS rep_team_circuits_org_idx
  ON public.rep_team_circuits(org_id);

ALTER TABLE public.rep_team_circuits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read rep_team_circuits"
  ON public.rep_team_circuits FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read assigned team circuits"
  ON public.rep_team_circuits FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

-- Writes are HEAD-COACH ONLY in RLS (mig 222's correction to 221, applied from the start here).
-- The app layer gates on `canWritePracticePlans` = "Schedule: View + edit", which is WIDER; every
-- write runs service-role, so the policy is the closed direct-session door, never the gate.
CREATE POLICY "head coaches can insert rep_team_circuits"
  ON public.rep_team_circuits FOR INSERT
  WITH CHECK (team_id IN (
    SELECT team_id FROM public.rep_team_coaches
    WHERE user_id = auth.uid() AND coach_role = 'head_coach'
  ));

CREATE POLICY "head coaches can update rep_team_circuits"
  ON public.rep_team_circuits FOR UPDATE
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches
    WHERE user_id = auth.uid() AND coach_role = 'head_coach'
  ))
  WITH CHECK (team_id IN (
    SELECT team_id FROM public.rep_team_coaches
    WHERE user_id = auth.uid() AND coach_role = 'head_coach'
  ));

CREATE POLICY "org admins can update rep_team_circuits"
  ON public.rep_team_circuits FOR UPDATE
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (org_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ⚠ No DELETE policy, on purpose. A circuit is RETIRED (is_active=false), never hard-deleted —
-- "Started 8 plans" stays readable, and a plan that carries its id keeps its provenance line.

-- ════════════════════════════════════════════════════════════════════
-- 2. rep_team_circuit_tags — the several 'focus' tags a circuit carries
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rep_team_circuit_tags (
  circuit_id  uuid        NOT NULL REFERENCES public.rep_team_circuits(id) ON DELETE CASCADE,
  tag_id      uuid        NOT NULL REFERENCES public.rep_team_tags(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (circuit_id, tag_id)
);

CREATE INDEX IF NOT EXISTS rep_team_circuit_tags_tag_idx
  ON public.rep_team_circuit_tags(tag_id);

ALTER TABLE public.rep_team_circuit_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read rep_team_circuit_tags"
  ON public.rep_team_circuit_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_circuits c
    WHERE c.id = rep_team_circuit_tags.circuit_id
      AND c.org_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
  ));

CREATE POLICY "coaches can read assigned team circuit tags"
  ON public.rep_team_circuit_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_circuits c
    WHERE c.id = rep_team_circuit_tags.circuit_id
      AND c.team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  ));

CREATE POLICY "head coaches can insert rep_team_circuit_tags"
  ON public.rep_team_circuit_tags FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rep_team_circuits c
    WHERE c.id = rep_team_circuit_tags.circuit_id
      AND c.team_id IN (
        SELECT team_id FROM public.rep_team_coaches
        WHERE user_id = auth.uid() AND coach_role = 'head_coach'
      )
  ));

CREATE POLICY "head coaches can delete rep_team_circuit_tags"
  ON public.rep_team_circuit_tags FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_circuits c
    WHERE c.id = rep_team_circuit_tags.circuit_id
      AND c.team_id IN (
        SELECT team_id FROM public.rep_team_coaches
        WHERE user_id = auth.uid() AND coach_role = 'head_coach'
      )
  ));

-- ════════════════════════════════════════════════════════════════════
-- 3. merge_rep_team_tags — the seventh lane
--
-- ⚠ Take the HIGHEST-numbered definition (239) and add the lane to THAT. This is 239's body,
-- verbatim, plus the circuit lane after plan templates. A future eighth lane edits THIS one.
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
  -- org are not. `<>` returned NULL here and let both cases through (mig 221).
  IF v_winner.team_id IS DISTINCT FROM v_loser.team_id THEN
    RAISE EXCEPTION 'merge_rep_team_tags_team_mismatch';
  END IF;

  -- ⚠ THE ORG GUARD IS LOAD-BEARING FOR SHARED TAGS. Two org-shared tags both have team_id NULL,
  -- so the team check above cannot tell them apart — without this, tags from two DIFFERENT
  -- organizations merge cleanly. Added by mig 221; dropped by 239's first draft; restored there.
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

  -- Circuits — the lane this migration adds.
  INSERT INTO public.rep_team_circuit_tags (circuit_id, tag_id)
  SELECT circuit_id, p_winner_tag_id
  FROM public.rep_team_circuit_tags
  WHERE tag_id = p_loser_tag_id
  ON CONFLICT (circuit_id, tag_id) DO NOTHING;

  DELETE FROM public.rep_team_circuit_tags WHERE tag_id = p_loser_tag_id;

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

  -- Money IN (fundraisers and sponsors).
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
  'circuits, focus-area goals, expenses and fundraisers/sponsors — from the loser tag to the winner, '
  'then deletes the loser. Same-team, same-ORG (both IS DISTINCT FROM, so org-wide NULL=NULL merges '
  'within one org and never across two) and same-kind guarded. Coach Tags Phase 1 (mig 181) + '
  'expense links (184) + drills/templates/focus + org guard (221) + fundraising links (239) + '
  'circuits (302). ⚠ Adding an eighth surface means editing the HIGHEST-numbered definition, never '
  'an older one.';

-- Verify (dev and, later, prod):
--   select policyname, cmd from pg_policies where tablename in ('rep_team_circuits', 'rep_team_circuit_tags') order by tablename, cmd;
--   select prosrc like '%rep_team_circuit_tags%' from pg_proc where proname = 'merge_rep_team_tags';
