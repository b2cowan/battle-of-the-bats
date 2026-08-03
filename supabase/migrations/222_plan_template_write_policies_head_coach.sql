-- Migration 222: plan-template writes are HEAD-COACH ONLY in RLS, matching the app layer.
--
-- ⚠ WHY THIS EXISTS — a backstop that was CLAIMED but not built.
--
-- The plan-templates route says, in as many words: "RLS mirrors both, so a direct PostgREST call
-- from an assistant's session can't bypass this — the mig-141 chat-engine lesson." The app layer
-- does gate every template write on `canWriteDevelopment` (= `isHeadCoach`), which is a role, not
-- a grantable capability. But migration 221's write policies checked only
--
--     team_id IN (SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid())
--
-- i.e. "is this caller a coach of this team at all" — with **no `coach_role` clause anywhere in the
-- file**. So any assigned assistant, including one granted `notes` alone, could INSERT, UPDATE or
-- retire a team's plan templates straight from their own browser session, and could write an
-- unstripped `plan` containing PEOPLE — bypassing `planToTemplateShape`, which is the only thing
-- that keeps players and staff out of a template.
--
-- ⚠ The sibling table already does this correctly. `rep_team_drills` (mig 218) gates its INSERT and
-- UPDATE policies on `... AND coach_role = 'head_coach'`. Migration 221 modelled everything else on
-- 218 and dropped that clause. This restores the parity 218 established.
--
-- ⚠ Nothing in the app changes. Every write path in `lib/db.ts` runs as the service role and so has
-- always bypassed RLS; this closes the direct-session door the comment already promised was shut.
-- The failure was silent by construction — normal use never exercises it, and the code asserted it
-- was covered, so nobody had a reason to look.
--
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- DEV-ONLY at author time; ⚠ PROD-PENDING. Apply WITH 213, 218 and 221 before promoting.
-- ⚠ This migration changes POLICIES ONLY — no table, column or index changes. `check:migrations`
-- compares schema objects and is a KNOWN FALSE GREEN for policy- and function-only migrations
-- (the same trap migration 211 recorded), so its passing says nothing about whether this is live.
-- Verify from `pg_policies` directly.
-- ────────────────────────────────────────────────────────────────────────────────────────────

-- ════════════════════════════════════════════════════════════════════
-- 1. rep_team_plan_templates — creating and editing a template
-- ════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "coaches can insert rep_team_plan_templates" ON public.rep_team_plan_templates;
DROP POLICY IF EXISTS "head coaches can insert rep_team_plan_templates" ON public.rep_team_plan_templates;
CREATE POLICY "head coaches can insert rep_team_plan_templates"
  ON public.rep_team_plan_templates FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid() AND coach_role = 'head_coach'
    )
  );

DROP POLICY IF EXISTS "coaches can update rep_team_plan_templates" ON public.rep_team_plan_templates;
DROP POLICY IF EXISTS "head coaches can update rep_team_plan_templates" ON public.rep_team_plan_templates;
CREATE POLICY "head coaches can update rep_team_plan_templates"
  ON public.rep_team_plan_templates FOR UPDATE
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

-- ⚠ The org-admin UPDATE policy from mig 221 is deliberately LEFT ALONE. An org owner/admin
-- managing their club's teams is a different actor from an assistant coach, and mig 218 grants
-- admins the same reach over drills. Templates remain team-scoped (team_id NOT NULL), so this
-- gives an admin no cross-club reach.
--
-- ⚠ There is still NO DELETE policy, and that is deliberate: a template is RETIRED
-- (is_active = false), never hard-deleted, so "Started 8 plans" stays readable.

-- ════════════════════════════════════════════════════════════════════
-- 2. rep_team_plan_template_tags — what a template is about
--
-- Same rule: tagging a template is part of managing the library, so it is a head-coach act. The
-- read policies from mig 221 are untouched — any assigned coach may SEE a template's tags, which
-- is what lets an assistant browse the room and start a plan from one.
-- ════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "coaches can insert rep_team_plan_template_tags" ON public.rep_team_plan_template_tags;
DROP POLICY IF EXISTS "head coaches can insert rep_team_plan_template_tags" ON public.rep_team_plan_template_tags;
CREATE POLICY "head coaches can insert rep_team_plan_template_tags"
  ON public.rep_team_plan_template_tags FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rep_team_plan_templates t
    WHERE t.id = rep_team_plan_template_tags.template_id
      AND t.team_id IN (
        SELECT team_id FROM public.rep_team_coaches
        WHERE user_id = auth.uid() AND coach_role = 'head_coach'
      )
  ));

DROP POLICY IF EXISTS "coaches can delete rep_team_plan_template_tags" ON public.rep_team_plan_template_tags;
DROP POLICY IF EXISTS "head coaches can delete rep_team_plan_template_tags" ON public.rep_team_plan_template_tags;
CREATE POLICY "head coaches can delete rep_team_plan_template_tags"
  ON public.rep_team_plan_template_tags FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_plan_templates t
    WHERE t.id = rep_team_plan_template_tags.template_id
      AND t.team_id IN (
        SELECT team_id FROM public.rep_team_coaches
        WHERE user_id = auth.uid() AND coach_role = 'head_coach'
      )
  ));
