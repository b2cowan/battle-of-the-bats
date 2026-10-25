-- ---------------------------------------------------------------
-- Migration 372 — Club Tier Stage 9b-2 Part 5, a /review fix to mig 371: a season's word takes no row lock.
--
-- WHY: mig 371's club_league_fee_word took the season row FOR UPDATE, and it runs inside the trigger on every
-- house-league line. Mark received holds the REGISTRATION (club_league_money) and then — through the trigger — wanted the
-- SEASON; an ending holds the SEASON (league_registration_close, FOR NO KEY UPDATE, which conflicts with FOR UPDATE) and
-- then wants the REGISTRATION. Two staff on one child at once could deadlock.
-- NOW: the word is read with no lock (the common case: it exists). Only creating it takes locks, and they are ADVISORY
-- (per season, then per club for the one category) — they conflict with no row lock, so the lock orders above can't meet.
-- A second creator waits on the advisory lock and then finds the word (re-read under it). Also from the same review: the
-- word reuses a same-named club category, takes a free item name on a collision, never fails the money write from the
-- trigger, and the starting budget reads registration_open_at's date as typed (it is stored as the club's wall clock).
-- Functions only.
-- ---------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.club_league_fee_word(p_season uuid)
RETURNS TABLE(category_id uuid, item_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_name text; v_try integer;
BEGIN
  SELECT w.category_id, w.item_id INTO category_id, item_id FROM league_season_fee_words w WHERE w.season_id = p_season;
  IF item_id IS NOT NULL THEN RETURN NEXT; RETURN; END IF;

  SELECT s.org_id, s.name INTO v_org, v_name FROM league_seasons s WHERE s.id = p_season;
  IF v_org IS NULL THEN RAISE EXCEPTION 'House league season not found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('club_league_fee_word:' || p_season::text, 0));
  SELECT w.category_id, w.item_id INTO category_id, item_id FROM league_season_fee_words w WHERE w.season_id = p_season;
  IF item_id IS NOT NULL THEN RETURN NEXT; RETURN; END IF;

  -- The club's one category for every season (serialised per club, so two seasons can't make two). A club category the
  -- treasurer already made with exactly this name is that category (review: never two rows of one name on the Statement).
  PERFORM pg_advisory_xact_lock(hashtextextended('club_league_fee_category:' || v_org::text, 0));
  SELECT w.category_id INTO category_id FROM league_season_fee_words w WHERE w.org_id = v_org LIMIT 1;
  IF category_id IS NULL THEN
    SELECT c.id INTO category_id FROM budget_categories c
     WHERE c.org_id = v_org AND c.scope = 'org' AND c.team_id IS NULL AND lower(c.name) = 'house league registration fees'
     ORDER BY c.created_at LIMIT 1;
  END IF;
  IF category_id IS NULL THEN
    INSERT INTO budget_categories(org_id, name, scope, is_default)
    VALUES (v_org, 'House league registration fees', 'org', false) RETURNING id INTO category_id;
  END IF;
  -- The item is the season's name; two seasons whose names meet as one word (a cut at 100 characters, a rename, a word
  -- the treasurer typed) take the next free "· 2", "· 3" — mig 248's unique name per category and direction.
  FOR v_try IN 1..20 LOOP
    BEGIN
      INSERT INTO budget_items(category_id, org_id, name, direction, actual_source, is_default)
      VALUES (category_id, v_org, CASE WHEN v_try = 1 THEN left(v_name, 100) ELSE left(v_name, 94) || ' · ' || v_try END,
              'in', 'typed', false)
      RETURNING id INTO item_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      item_id := NULL;
    END;
  END LOOP;
  IF item_id IS NULL THEN RAISE EXCEPTION 'club_league_fee_word: no free name for season %', p_season; END IF;
  INSERT INTO league_season_fee_words(season_id, org_id, category_id, item_id)
  VALUES (p_season, v_org, category_id, item_id);
  RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.club_league_fee_word(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_league_fee_word(uuid) TO service_role;

-- The line trigger never fails the money write: a word that can't be made leaves the line unstamped (it then reads "Not
-- filed" on the Statement, where the treasurer sees it) — a family's payment is never refused for a budget word.
CREATE OR REPLACE FUNCTION public.accounting_entries_league_fee_word()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_season uuid; v_cat uuid; v_item uuid;
BEGIN
  IF NEW.source_module IS DISTINCT FROM 'league_registration' OR NEW.budget_item_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT l.entity_id INTO v_season FROM accounting_ledgers l WHERE l.id = NEW.ledger_id AND l.entity_type = 'league_season';
  IF v_season IS NULL THEN RETURN NEW; END IF;
  BEGIN
    SELECT w.category_id, w.item_id INTO v_cat, v_item FROM club_league_fee_word(v_season) w;
    NEW.budget_category_id := v_cat;
    NEW.budget_item_id := v_item;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'house-league line left unfiled (season %): %', v_season, SQLERRM;
  END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.accounting_entries_league_fee_word() FROM PUBLIC, anon, authenticated;

-- The starting budget's day (review): registration_open_at is stored AS TYPED, the club's wall clock with a literal Z
-- (lib/league-registration-state.ts — never re-zoned), so its date is read as written; created_at is a real instant.
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
  v_day := coalesce((v_s.registration_open_at AT TIME ZONE 'UTC')::date, v_s.season_start_date,
    (v_s.created_at AT TIME ZONE 'America/Toronto')::date);
  PERFORM club_fiscal_year_ensure(v_s.org_id, v_day);
  SELECT * INTO v_year FROM club_fiscal_year_row(v_s.org_id, v_day);
  RETURN club_budget_line_add(v_s.org_id, v_year.first_day, v_item, left(v_s.name || ' registration fees', 200), v_total,
    'Each division''s size × its price, set when registration opened.', 0, NULL);
END $$;
REVOKE ALL ON FUNCTION public.club_league_fee_budget_seed(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_league_fee_budget_seed(uuid) TO service_role;

COMMIT;
