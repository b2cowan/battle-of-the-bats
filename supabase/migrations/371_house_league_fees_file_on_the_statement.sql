-- ---------------------------------------------------------------
-- Migration 371 — Club Tier Stage 9b-2 Part 5: house-league fees file on the club's Budget vs. Actual Statement.
-- Plan: docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md §0 Q10, Q15, §0b 9b·11, §0e; drawing 9b-2 §5.
--
-- WHY: a house-league fee filed nowhere (F15). Ruled (Q10): ONE "House league registration fees" row with the seasons under
-- it; a fee files in the fiscal year it is received; the budget is each division's size × price, in the fiscal year the
-- season's sign-ups open (9b·11), and the treasurer can change or split it.
--
-- HOW (the hosted-tournament precedent, migs 342/344 — real budget words, not a synthetic row):
--   1. league_season_fee_words — each season's word: the club's ONE category "House league registration fees" (created on
--      first need, shared by every season) and an 'in' item named for the season.
--   2. club_league_fee_word(season) — get-or-create, race-safe under the season's lock.
--   3. A trigger stamps that word on every house-league book line as it is written (money in AND a refund out), whatever
--      writes it, so the Statement, the Budget, By period and Months file it by the line's own word (lib/club-ledger.ts).
--   4. club_league_fee_budget_seed(season) — the starting budget: Σ capacity × (division price ?? season fee) over the
--      divisions with a size, in the fiscal year containing the season's registration opening, through club_budget_line_add
--      (its year lock and closed-year refusal). Only when the season's word has no plan line in ANY year — after that the
--      line is the treasurer's to change or split (a line in another year under the same word) on the Budget page.
--      Called by the season route when registration opens; a division with no size adds nothing (an open division can't
--      be budgeted by size).
--   5. Backfill: every season with house-league lines gets its word and its lines are stamped (a relabel — the closed-year
--      lock exempts it, mig 318); every season already past opening gets its starting budget (a closed year is skipped).
-- The figures that READ this (refunds netting the fees row, the band's Collected) are lib/club-money-figures.ts and
-- lib/club-budget-report.ts. Functions and the trigger are invisible to check:migrations; MANUAL_PROD_STEPS.json carries it.
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS public.league_season_fee_words (
  season_id   uuid PRIMARY KEY REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.budget_categories(id),
  item_id     uuid NOT NULL REFERENCES public.budget_items(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS league_season_fee_words_org_idx ON public.league_season_fee_words(org_id);
CREATE INDEX IF NOT EXISTS league_season_fee_words_category_idx ON public.league_season_fee_words(category_id);
CREATE UNIQUE INDEX IF NOT EXISTS league_season_fee_words_item_uniq ON public.league_season_fee_words(item_id);
ALTER TABLE public.league_season_fee_words ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.league_season_fee_words FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_season_fee_words TO service_role;

CREATE OR REPLACE FUNCTION public.club_league_fee_word(p_season uuid)
RETURNS TABLE(category_id uuid, item_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_s league_seasons%ROWTYPE;
BEGIN
  SELECT * INTO v_s FROM league_seasons WHERE id = p_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'House league season not found'; END IF;
  SELECT w.category_id, w.item_id INTO category_id, item_id FROM league_season_fee_words w WHERE w.season_id = p_season;
  IF item_id IS NOT NULL THEN RETURN NEXT; RETURN; END IF;
  -- The club's one category for every season (serialised per club, so two seasons can't make two).
  PERFORM pg_advisory_xact_lock(hashtextextended('club_league_fee_category:' || v_s.org_id::text, 0));
  SELECT w.category_id INTO category_id FROM league_season_fee_words w WHERE w.org_id = v_s.org_id LIMIT 1;
  IF category_id IS NULL THEN
    INSERT INTO budget_categories(org_id, name, scope, is_default)
    VALUES (v_s.org_id, 'House league registration fees', 'org', false) RETURNING id INTO category_id;
  END IF;
  INSERT INTO budget_items(category_id, org_id, name, direction, actual_source, is_default)
  VALUES (category_id, v_s.org_id, left(v_s.name, 100), 'in', 'typed', false) RETURNING id INTO item_id;
  INSERT INTO league_season_fee_words(season_id, org_id, category_id, item_id)
  VALUES (p_season, v_s.org_id, category_id, item_id);
  RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.club_league_fee_word(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_league_fee_word(uuid) TO service_role;

-- Every house-league line carries its season's word from the moment it is written.
CREATE OR REPLACE FUNCTION public.accounting_entries_league_fee_word()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_season uuid; v_cat uuid; v_item uuid;
BEGIN
  IF NEW.source_module IS DISTINCT FROM 'league_registration' OR NEW.budget_item_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT l.entity_id INTO v_season FROM accounting_ledgers l WHERE l.id = NEW.ledger_id AND l.entity_type = 'league_season';
  IF v_season IS NULL THEN RETURN NEW; END IF;
  SELECT w.category_id, w.item_id INTO v_cat, v_item FROM club_league_fee_word(v_season) w;
  NEW.budget_category_id := v_cat;
  NEW.budget_item_id := v_item;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.accounting_entries_league_fee_word() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS accounting_entries_league_fee_word ON public.accounting_entries;
CREATE TRIGGER accounting_entries_league_fee_word
  BEFORE INSERT ON public.accounting_entries
  FOR EACH ROW WHEN (NEW.source_module = 'league_registration')
  EXECUTE FUNCTION public.accounting_entries_league_fee_word();

-- The starting budget (9b·11). Returns club_budget_line_add's answer, or {ok:false, code:'already_planned'|'nothing'}.
CREATE OR REPLACE FUNCTION public.club_league_fee_budget_seed(p_season uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_s league_seasons%ROWTYPE; v_item uuid; v_total numeric; v_day date; v_year org_fiscal_years%ROWTYPE;
BEGIN
  SELECT * INTO v_s FROM league_seasons WHERE id = p_season;
  IF NOT FOUND THEN RAISE EXCEPTION 'House league season not found'; END IF;
  SELECT w.item_id INTO v_item FROM club_league_fee_word(p_season) w;
  IF EXISTS (SELECT 1 FROM org_budget_lines b WHERE b.item_id = v_item) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_planned');
  END IF;
  SELECT coalesce(sum(d.capacity * coalesce(d.price, v_s.registration_fee, 0)), 0) INTO v_total
    FROM league_divisions d WHERE d.season_id = p_season AND d.capacity IS NOT NULL AND d.capacity > 0;
  IF v_total <= 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'nothing'); END IF;
  -- The day sign-ups open; a season saved without one falls back to its start, then the day it was made.
  v_day := coalesce((v_s.registration_open_at AT TIME ZONE 'America/Toronto')::date, v_s.season_start_date,
    (v_s.created_at AT TIME ZONE 'America/Toronto')::date);
  PERFORM club_fiscal_year_ensure(v_s.org_id, v_day);
  SELECT * INTO v_year FROM club_fiscal_year_row(v_s.org_id, v_day);
  RETURN club_budget_line_add(v_s.org_id, v_year.first_day, v_item, left(v_s.name || ' registration fees', 200), v_total,
    'Each division''s size × its price, set when registration opened.', 0, NULL);
END $$;
REVOKE ALL ON FUNCTION public.club_league_fee_budget_seed(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_league_fee_budget_seed(uuid) TO service_role;

-- Backfill: words and stamps for every season with lines; starting budgets for every season past opening.
DO $$
DECLARE r record; v_cat uuid; v_item uuid; v_res jsonb;
BEGIN
  FOR r IN SELECT DISTINCT l.entity_id AS season_id
             FROM accounting_entries e JOIN accounting_ledgers l ON l.id = e.ledger_id
            WHERE e.source_module = 'league_registration' AND l.entity_type = 'league_season' AND e.budget_item_id IS NULL
  LOOP
    SELECT w.category_id, w.item_id INTO v_cat, v_item FROM club_league_fee_word(r.season_id) w;
    UPDATE accounting_entries e SET budget_category_id = v_cat, budget_item_id = v_item
      FROM accounting_ledgers l
     WHERE l.id = e.ledger_id AND l.entity_type = 'league_season' AND l.entity_id = r.season_id
       AND e.source_module = 'league_registration' AND e.budget_item_id IS NULL;
  END LOOP;
  FOR r IN SELECT s.id FROM league_seasons s
            WHERE s.status IN ('registration_open','registration_closed','active','completed')
  LOOP
    BEGIN
      v_res := club_league_fee_budget_seed(r.id);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'starting budget skipped for season %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;

COMMIT;
