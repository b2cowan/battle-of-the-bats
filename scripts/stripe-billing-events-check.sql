-- DEV only. Plans & pricing Stage 0 Part 2 (mig 416): the billing webhook's event claim — a replay is a duplicate, a
-- delivery that overlaps another is busy, a failed one is claimed again — proved on the database.
-- Run: node scripts/db-query.mjs --dev -f scripts/stripe-billing-events-check.sql
-- The final exception rolls back every fixture row; the run passes only when it ends in STRIPE_BILLING_EVENTS_PASSED.
-- (The webhook's order around the claim — mode, claim, run, outcome — is proved in tests/unit/stripe-billing-events.test.ts.)
DO $sbe$
DECLARE
  v_id text := 'evt_stage0_check_' || substr(md5(random()::text), 1, 12);
  v_answer text;
  v_attempts integer;
BEGIN
  -- T1 · The first delivery claims it.
  v_answer := stripe_billing_event_claim(v_id, 'invoice.payment_succeeded', false, 'cus_check', 'sub_check', 'in_check');
  IF v_answer <> 'new' THEN RAISE EXCEPTION 'FAIL T1: first claim got %', v_answer; END IF;

  -- T2 · A second delivery while the first is running is refused (busy), and changes nothing.
  v_answer := stripe_billing_event_claim(v_id, 'invoice.payment_succeeded', false, 'cus_check', 'sub_check', 'in_check');
  IF v_answer <> 'busy' THEN RAISE EXCEPTION 'FAIL T2: overlapping claim got %', v_answer; END IF;
  SELECT attempts INTO v_attempts FROM stripe_billing_events WHERE id = v_id;
  IF v_attempts <> 1 THEN RAISE EXCEPTION 'FAIL T2b: attempts %', v_attempts; END IF;

  -- T3 · The run fails (claim cleared, error kept); the retry claims it again and counts the attempt.
  UPDATE stripe_billing_events SET error = 'Stripe could not be read', claimed_at = NULL WHERE id = v_id;
  v_answer := stripe_billing_event_claim(v_id, 'invoice.payment_succeeded', false, 'cus_check', 'sub_check', 'in_check');
  IF v_answer <> 'retry' THEN RAISE EXCEPTION 'FAIL T3: retry got %', v_answer; END IF;
  IF (SELECT error FROM stripe_billing_events WHERE id = v_id) IS NOT NULL THEN RAISE EXCEPTION 'FAIL T3b: error not cleared'; END IF;
  IF (SELECT attempts FROM stripe_billing_events WHERE id = v_id) <> 2 THEN RAISE EXCEPTION 'FAIL T3c: attempts'; END IF;

  -- T4 · A delivery that died mid-run (claim older than five minutes, no outcome) can be claimed again.
  UPDATE stripe_billing_events SET claimed_at = now() - interval '6 minutes' WHERE id = v_id;
  v_answer := stripe_billing_event_claim(v_id, 'invoice.payment_succeeded', false, 'cus_check', 'sub_check', 'in_check');
  IF v_answer <> 'retry' THEN RAISE EXCEPTION 'FAIL T4: stale claim got %', v_answer; END IF;

  -- T5 · Once processed, every later delivery is a duplicate.
  UPDATE stripe_billing_events SET processed_at = now(), claimed_at = NULL WHERE id = v_id;
  v_answer := stripe_billing_event_claim(v_id, 'invoice.payment_succeeded', false, 'cus_check', 'sub_check', 'in_check');
  IF v_answer <> 'duplicate' THEN RAISE EXCEPTION 'FAIL T5: replay got %', v_answer; END IF;

  -- T6 · An ignored event (the other mode) is a duplicate too, never claimed to run.
  INSERT INTO stripe_billing_events (id, type, livemode, ignored_reason) VALUES (v_id || '_mode', 'invoice.paid', true, 'wrong_mode');
  v_answer := stripe_billing_event_claim(v_id || '_mode', 'invoice.paid', true, NULL, NULL, NULL);
  IF v_answer <> 'duplicate' THEN RAISE EXCEPTION 'FAIL T6: ignored event got %', v_answer; END IF;

  -- T7 · Only the service role may claim.
  IF has_function_privilege('authenticated', 'public.stripe_billing_event_claim(text, text, boolean, text, text, text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.stripe_billing_event_claim(text, text, boolean, text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL T7: the claim is callable by a signed-in or anonymous user';
  END IF;
  IF has_table_privilege('authenticated', 'public.stripe_billing_events', 'SELECT') THEN RAISE EXCEPTION 'FAIL T7b: table readable'; END IF;

  RAISE EXCEPTION 'STRIPE_BILLING_EVENTS_PASSED';
END
$sbe$;
