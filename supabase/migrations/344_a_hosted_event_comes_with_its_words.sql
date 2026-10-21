-- 344: a hosted tournament comes with the words an event needs — Club Tier Stage 7a follow-up.
-- Plan: docs/projects/active/HOSTED_EVENT_FILING_SHELF_PLAN.md (mockup walked with the owner 2026-10-21).
--
-- Mig 342 gave each hosted tournament ONE private category holding ONE item, Entry fees, so registration payments file
-- themselves. Everything else an event takes in or spends (gate, concessions, sponsorship, permits, officials) had to be
-- filed on the generic Tournaments shelf — and By activity groups by category, so that money never reached the event's
-- own net. The event's shelf now carries the words the event needs. THE PICKER decides which shelf to show (it is not
-- this migration's business): the general book folds the year's events, a tournament's own book leads with its own.
--
-- Additive and idempotent: a word is added only where the shelf has no word of that name (case-insensitive) yet, so
-- re-applying changes nothing and an admin's own word with the same name is never doubled. No line is ever re-filed.
--
-- ⚠ EXISTING EVENTS ARE NOT TOUCHED BY THIS FILE. Only a hosted event created from now on is complete from its first
-- payment. The fill-in for existing events is club_hosted_event_backfill(), run by hand — dev first, prod only on the
-- owner's explicit go. club_tournament_fee_word deliberately does NOT heal an old shelf when a payment arrives: that
-- would be a silent data change on production at the next fee.
--
-- Money in:  Entry fees (342) · Gate / admission · Concession revenue · Registration revenue · Sponsorship
-- Money out: Permits & fields · Officials · Awards · Supplies
-- (The money-out list is the owner-approved draft; the plan's §6 call 1 owns any later change.)

-- ── 1. The one place the event's word list lives ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.club_hosted_event_add_words(p_category uuid, p_org uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_added integer := 0;
  v_next integer;
  w record;
BEGIN
  -- Defence in depth (only the service role can call this, and both callers pass a consistent pair): a words write
  -- never lands on a category the named club does not own, and never with a null club (a null org_id is a PLATFORM word).
  IF p_org IS NULL OR NOT EXISTS (SELECT 1 FROM budget_categories WHERE id = p_category AND org_id = p_org) THEN
    RAISE EXCEPTION 'That category does not belong to that club';
  END IF;
  SELECT coalesce(max(sort_order), 0) INTO v_next FROM budget_items WHERE category_id = p_category;
  FOR w IN
    SELECT * FROM (VALUES
      ('Entry fees',           'in'),
      ('Gate / admission',     'in'),
      ('Concession revenue',   'in'),
      ('Registration revenue', 'in'),
      ('Sponsorship',          'in'),
      ('Permits & fields',     'out'),
      ('Officials',            'out'),
      ('Awards',               'out'),
      ('Supplies',             'out')
    ) AS t(name, direction)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM budget_items WHERE category_id = p_category AND lower(name) = lower(w.name))
       -- The settings item IS the shelf's Entry fees even if an admin has since renamed it: never a decoy beside it.
       AND NOT (w.name = 'Entry fees' AND EXISTS (SELECT 1 FROM tournament_fee_book_settings WHERE category_id = p_category))
    THEN
      v_next := v_next + 1;
      INSERT INTO budget_items(category_id, org_id, name, direction, actual_source, is_default, sort_order)
      VALUES(p_category, p_org, w.name, w.direction, 'typed', false, v_next);
      v_added := v_added + 1;
    END IF;
  END LOOP;
  RETURN v_added;
END $$;
REVOKE ALL ON FUNCTION public.club_hosted_event_add_words(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_hosted_event_add_words(uuid, uuid) TO service_role;

-- ── 2. A NEW hosted event gets the whole list when its shelf is created ──────────────────────────
-- Same function as 342 (same signature, same behavior for an event that already has its shelf); only the creation branch
-- gains the call. The returned item stays Entry fees — it is what a registration payment files under.
CREATE OR REPLACE FUNCTION public.club_tournament_fee_word(p_tournament uuid, p_word text DEFAULT NULL)
RETURNS TABLE(category_id uuid, item_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t public.tournaments%ROWTYPE; v_name text;
BEGIN
  SELECT * INTO v_t FROM tournaments WHERE id = p_tournament FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  SELECT s.category_id, s.item_id INTO category_id, item_id
  FROM tournament_fee_book_settings s WHERE s.tournament_id = p_tournament;
  IF category_id IS NOT NULL THEN
    IF p_word IS NOT NULL AND length(trim(p_word)) > 0 THEN
      UPDATE budget_categories SET name = left(trim(p_word), 100) WHERE id = category_id;
    END IF;
    RETURN NEXT; RETURN;
  END IF;
  v_name := coalesce(nullif(trim(p_word), ''), 'Hosted tournament · ' || v_t.name);
  INSERT INTO budget_categories(org_id, name, scope, is_default)
  VALUES(v_t.org_id, left(v_name, 100), 'org', false) RETURNING id INTO category_id;
  INSERT INTO budget_items(category_id, org_id, name, direction, actual_source, is_default)
  VALUES(category_id, v_t.org_id, 'Entry fees', 'in', 'typed', false) RETURNING id INTO item_id;
  PERFORM public.club_hosted_event_add_words(category_id, v_t.org_id);
  INSERT INTO tournament_fee_book_settings(tournament_id, org_id, category_id, item_id)
  VALUES(p_tournament, v_t.org_id, category_id, item_id);
  RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.club_tournament_fee_word(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_tournament_fee_word(uuid,text) TO service_role;

-- ── 3. The fill-in for EXISTING hosted events — run by hand, never by a trigger or a payment ─────
-- Returns one row per hosted event with how many words it gained, so the owner sees a before-and-after count per event.
-- ⚠ ONE CLUB AT A TIME, and the club is REQUIRED: a bare call can never reach every club's shelves at once. ⚠ It is
-- idempotent by word NAME, so a default word an admin has since renamed or deleted comes back as a new word — run it
-- once per club, read the per-event `added`, and expect that only for an event the admin has already tidied.
-- (An earlier draft of this function defaulted p_org to null = every club; dropping it first is how the default goes.)
DROP FUNCTION IF EXISTS public.club_hosted_event_backfill(uuid);
CREATE FUNCTION public.club_hosted_event_backfill(p_org uuid)
RETURNS TABLE(tournament_id uuid, category_id uuid, added integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_org IS NULL THEN RAISE EXCEPTION 'Name the club to fill in'; END IF;
  RETURN QUERY
  SELECT s.tournament_id, s.category_id, public.club_hosted_event_add_words(s.category_id, s.org_id)
  FROM tournament_fee_book_settings s
  WHERE s.org_id = p_org
  ORDER BY s.tournament_id;
END $$;
REVOKE ALL ON FUNCTION public.club_hosted_event_backfill(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_hosted_event_backfill(uuid) TO service_role;
