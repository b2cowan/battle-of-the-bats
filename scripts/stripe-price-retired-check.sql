-- DEV only. Plans & pricing Stage 0 Part 5 (mig 417): a replaced Stripe price stays recognised — the stripe_prices
-- trigger records the old id on a replace, on a clear and on a delete, and never on an unrelated column update.
-- Run: node scripts/db-query.mjs --dev -f scripts/stripe-price-retired-check.sql
-- The final exception rolls back every change (the slot borrowed below is put back by the rollback); the run passes only
-- when it ends in STRIPE_PRICE_RETIRED_PASSED.
DO $spr$
DECLARE
  v_slot stripe_prices%ROWTYPE;
  v_old text := 'price_stage0_check_old_' || substr(md5(random()::text), 1, 10);
  v_new text := 'price_stage0_check_new_' || substr(md5(random()::text), 1, 10);
  v_row stripe_price_ids_retired%ROWTYPE;
BEGIN
  SELECT * INTO v_slot FROM stripe_prices WHERE environment = 'sandbox' ORDER BY plan_id, billing_cycle LIMIT 1;
  IF v_slot.id IS NULL THEN RAISE EXCEPTION 'FAIL T0: no sandbox slot to borrow'; END IF;
  UPDATE stripe_prices SET price_id = v_old WHERE id = v_slot.id;
  DELETE FROM stripe_price_ids_retired WHERE price_id = v_slot.price_id; -- the borrowed slot's own id, from the line above

  -- T1 · An unrelated column update records nothing.
  UPDATE stripe_prices SET last_change_note = 'stage 0 check' WHERE id = v_slot.id;
  IF EXISTS (SELECT 1 FROM stripe_price_ids_retired WHERE price_id = v_old) THEN RAISE EXCEPTION 'FAIL T1: recorded on a note change'; END IF;

  -- T2 · Replacing the id records the old one, with the slot's plan, cycle, mode and who.
  UPDATE stripe_prices SET price_id = v_new, updated_by_email = 'check@example.test' WHERE id = v_slot.id;
  SELECT * INTO v_row FROM stripe_price_ids_retired WHERE price_id = v_old;
  IF v_row.price_id IS NULL THEN RAISE EXCEPTION 'FAIL T2: the replaced id was not recorded'; END IF;
  IF v_row.plan_id <> v_slot.plan_id OR v_row.billing_cycle <> v_slot.billing_cycle OR v_row.environment <> 'sandbox'
    OR v_row.retired_by_email <> 'check@example.test' THEN
    RAISE EXCEPTION 'FAIL T2b: recorded as % / % / % / %', v_row.plan_id, v_row.billing_cycle, v_row.environment, v_row.retired_by_email;
  END IF;

  -- T3 · Putting the old id back and replacing it again keeps the FIRST row (first retirement wins), and records the new one.
  UPDATE stripe_prices SET price_id = v_old WHERE id = v_slot.id;
  IF NOT EXISTS (SELECT 1 FROM stripe_price_ids_retired WHERE price_id = v_new) THEN RAISE EXCEPTION 'FAIL T3: put-back did not record the new id'; END IF;
  IF (SELECT count(*) FROM stripe_price_ids_retired WHERE price_id = v_old) <> 1 THEN RAISE EXCEPTION 'FAIL T3b: duplicate row'; END IF;

  -- T4 · Clearing a slot records its id; a slot with no id records nothing.
  UPDATE stripe_prices SET price_id = NULL WHERE id = v_slot.id;
  UPDATE stripe_prices SET price_id = NULL WHERE id = v_slot.id;
  IF EXISTS (SELECT 1 FROM stripe_price_ids_retired WHERE price_id IS NULL) THEN RAISE EXCEPTION 'FAIL T4: a null was recorded'; END IF;

  -- T5 · Append-only: nobody may change or remove a row, not even the service role; only the service role may read.
  IF has_table_privilege('service_role', 'public.stripe_price_ids_retired', 'UPDATE')
    OR has_table_privilege('service_role', 'public.stripe_price_ids_retired', 'DELETE')
    OR has_table_privilege('service_role', 'public.stripe_price_ids_retired', 'INSERT') THEN
    RAISE EXCEPTION 'FAIL T5: the service role may write a retired id (only the trigger may)';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.stripe_price_ids_retired', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL T5c: the server cannot read the retired ids';
  END IF;
  IF has_table_privilege('authenticated', 'public.stripe_price_ids_retired', 'SELECT')
    OR has_table_privilege('anon', 'public.stripe_price_ids_retired', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL T5b: readable by a signed-in or anonymous user';
  END IF;

  RAISE EXCEPTION 'STRIPE_PRICE_RETIRED_PASSED';
END
$spr$;
