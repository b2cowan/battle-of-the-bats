-- Migration 184: Money tags + org-authored shared library (Coach Tags & Player Awards, Phase 3).
--
-- Two related pieces:
--
--  1. MONEY TAGS. Phase 1 (mig 181) reserved kind='expense' on rep_team_tags for this slice and
--     said "same library shape, no separate table needed." That's true for the TAG rows themselves,
--     but the join table rep_team_event_tags is FK'd specifically to rep_team_events, so expenses
--     need their own junction — rep_team_expense_tags (below), mirroring the event-tags shape.
--
--  2. ORG-AUTHORED SHARED LIBRARY. The originally-scoped "org admin promotes a team's tag" model was
--     dropped (owner decision 2026-07-13): at 15+ teams, bottom-up promotion reintroduces exactly the
--     drift/duplication the feature fights, and buries the admin in promotions to referee. Instead the
--     org owner/admin AUTHORS a small shared library from one screen. A shared tag / award type is
--     stored with team_id NULL (org_id set) and surfaces in every team's picker alongside that team's
--     own private items. This migration widens team_id to NULLABLE on rep_team_tags and
--     rep_team_award_types and adds partial unique indexes for the org-wide rows. The org-admin RLS
--     write policies already added in migs 181/182 (org_id-membership + role='admin') already cover the
--     team_id-NULL rows, so no new policies are needed — only coaches (whose write policies require
--     team_id ∈ their teams) are correctly excluded from editing shared items.
--
-- DEV-ONLY at author time; ⚠ PROD-PENDING — apply to prod at release BEFORE promoting code that reads
-- these tables/columns (else prod 500s), per the "migration-040 incident" lesson.

-- ============================================================
-- 1. Widen team_id to nullable (org-wide = team_id NULL, org_id set)
-- ============================================================

ALTER TABLE public.rep_team_tags        ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE public.rep_team_award_types ALTER COLUMN team_id DROP NOT NULL;

-- Org-wide uniqueness. The existing per-team unique indexes are ON (team_id, ...) and Postgres treats
-- NULL team_id values as DISTINCT, so they do NOT constrain org-wide rows — these partial indexes do.
-- One shared name per (org, kind), case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS rep_team_tags_org_name_uniq
  ON public.rep_team_tags(org_id, kind, lower(btrim(name)))
  WHERE team_id IS NULL;

-- One active shared award-type name per org (partial on is_active → a retired shared name can be reused).
CREATE UNIQUE INDEX IF NOT EXISTS rep_team_award_types_org_name_uniq
  ON public.rep_team_award_types(org_id, lower(btrim(name)))
  WHERE is_active AND team_id IS NULL;

-- Helps the "list this org's shared items" admin queries (team_id IS NULL scans).
CREATE INDEX IF NOT EXISTS rep_team_tags_org_shared_idx
  ON public.rep_team_tags(org_id, kind) WHERE team_id IS NULL;
CREATE INDEX IF NOT EXISTS rep_team_award_types_org_shared_idx
  ON public.rep_team_award_types(org_id) WHERE team_id IS NULL;

-- ============================================================
-- 2. rep_team_expense_tags — a money tag applied to an expense
--    (mirrors rep_team_event_tags, mig 181, but FK'd to rep_team_expenses)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rep_team_expense_tags (
  expense_id uuid        NOT NULL REFERENCES public.rep_team_expenses(id) ON DELETE CASCADE,
  tag_id     uuid        NOT NULL REFERENCES public.rep_team_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (expense_id, tag_id)
);

CREATE INDEX IF NOT EXISTS rep_team_expense_tags_tag_idx
  ON public.rep_team_expense_tags(tag_id);

ALTER TABLE public.rep_team_expense_tags ENABLE ROW LEVEL SECURITY;

-- RLS reaches tenancy through the EXPENSE (not the tag): an org-wide tag has team_id NULL, so scoping
-- through the tag would drop the link out of a coach's own reach — the expense's team_id/org_id are the
-- true owners of the link. (rep_team_event_tags reaches through the tag because a game tag is always
-- team-owned; a money tag may be shared, so we pin scope to the expense instead.)

CREATE POLICY "org members can read rep_team_expense_tags"
  ON public.rep_team_expense_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_expenses ex
    WHERE ex.id = rep_team_expense_tags.expense_id
      AND ex.org_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
  ));

CREATE POLICY "coaches can read assigned team expense tags"
  ON public.rep_team_expense_tags FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_expenses ex
    WHERE ex.id = rep_team_expense_tags.expense_id
      AND ex.team_id IN (
        SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
      )
  ));

CREATE POLICY "coaches can insert rep_team_expense_tags"
  ON public.rep_team_expense_tags FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rep_team_expenses ex
    WHERE ex.id = rep_team_expense_tags.expense_id
      AND ex.team_id IN (
        SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
      )
  ));

CREATE POLICY "coaches can delete rep_team_expense_tags"
  ON public.rep_team_expense_tags FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_expenses ex
    WHERE ex.id = rep_team_expense_tags.expense_id
      AND ex.team_id IN (
        SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
      )
  ));

CREATE POLICY "org admins can insert rep_team_expense_tags"
  ON public.rep_team_expense_tags FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.rep_team_expenses ex
    WHERE ex.id = rep_team_expense_tags.expense_id
      AND ex.org_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND role = 'admin'
      )
  ));

CREATE POLICY "org admins can delete rep_team_expense_tags"
  ON public.rep_team_expense_tags FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.rep_team_expenses ex
    WHERE ex.id = rep_team_expense_tags.expense_id
      AND ex.org_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND role = 'admin'
      )
  ));

-- ============================================================
-- 3. merge_rep_team_tags — extend to re-point EXPENSE links too
--
-- The mig-181 version only re-pointed rep_team_event_tags. A money-tag merge must re-point
-- rep_team_expense_tags as well, or the loser's expense links would be lost to the FK cascade instead
-- of preserved on the winner. Same ON CONFLICT skip + mop-up pattern as the event side. The same-team
-- guard uses IS DISTINCT FROM so two org-wide tags (both team_id NULL) are treated as same-scope and
-- merge cleanly, rather than NULL <> NULL evaluating to NULL and silently passing an unequal check.
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

  -- IS DISTINCT FROM so NULL (org-wide) = NULL is treated as same-scope, not an un-checkable NULL.
  IF v_winner.team_id IS DISTINCT FROM v_loser.team_id THEN
    RAISE EXCEPTION 'merge_rep_team_tags_team_mismatch';
  END IF;

  IF v_winner.kind <> v_loser.kind THEN
    RAISE EXCEPTION 'merge_rep_team_tags_kind_mismatch';
  END IF;

  -- Re-point game (event) links.
  INSERT INTO public.rep_team_event_tags (event_id, tag_id)
  SELECT event_id, p_winner_tag_id
  FROM public.rep_team_event_tags
  WHERE tag_id = p_loser_tag_id
  ON CONFLICT (event_id, tag_id) DO NOTHING;

  DELETE FROM public.rep_team_event_tags WHERE tag_id = p_loser_tag_id;

  -- Re-point money (expense) links.
  INSERT INTO public.rep_team_expense_tags (expense_id, tag_id)
  SELECT expense_id, p_winner_tag_id
  FROM public.rep_team_expense_tags
  WHERE tag_id = p_loser_tag_id
  ON CONFLICT (expense_id, tag_id) DO NOTHING;

  DELETE FROM public.rep_team_expense_tags WHERE tag_id = p_loser_tag_id;

  DELETE FROM public.rep_team_tags WHERE id = p_loser_tag_id;
END;
$$;

COMMENT ON FUNCTION public.merge_rep_team_tags(uuid, uuid) IS
  'Atomically re-points every rep_team_event_tags AND rep_team_expense_tags row from the loser tag to '
  'the winner, then deletes the loser. Same-team (IS DISTINCT FROM, so org-wide NULL=NULL merges) and '
  'same-kind guarded. Coach Tags & Player Awards Phase 1 (mig 181) + Phase 3 expense-link support (mig 184).';
