-- DEV only. Support console Stage 5 (mig 389): the delivery callback changes an email once, forward only; a reply is
-- claimed by one server and its words never change; Status's reading is claimed by one server at a time.
-- Run: node scripts/db-query.mjs --dev -f scripts/support-console-stage5-check.sql
-- The final exception rolls back every fixture row; the run passes only when it ends in SUPPORT_CONSOLE_S5_PASSED.
DO $s5$
DECLARE
  v_email uuid; v_email2 uuid; v_fb uuid; v_reply uuid := gen_random_uuid(); v_res text; v_err text; v_n integer;
  v_claimed boolean; v_second boolean;
BEGIN
  INSERT INTO platform_account_emails (kind, recipient_email) VALUES ('org_invite', 'check-s5@example.invalid') RETURNING id INTO v_email;

  -- C1 · a callback for no row keeps nothing, not even its number (T11).
  v_res := platform_account_email_event(gen_random_uuid(), 'msg_check_s5_none', 'delivered', now(), NULL);
  IF v_res <> 'no_row' OR EXISTS (SELECT 1 FROM platform_account_email_events WHERE event_id = 'msg_check_s5_none') THEN
    RAISE EXCEPTION 'FAIL C1: a callback for no row was kept (%)', v_res; END IF;

  -- C2 · the same callback twice = one change (T9).
  v_res := platform_account_email_event(v_email, 'msg_check_s5_a', 'delivered', now(), NULL);
  IF v_res <> 'applied' THEN RAISE EXCEPTION 'FAIL C2: first delivery not applied (%)', v_res; END IF;
  v_res := platform_account_email_event(v_email, 'msg_check_s5_a', 'delivered', now(), NULL);
  SELECT count(*) INTO v_n FROM platform_account_email_events WHERE email_id = v_email;
  IF v_res <> 'duplicate' OR v_n <> 1 THEN RAISE EXCEPTION 'FAIL C2: a repeat changed something (% / % rows)', v_res, v_n; END IF;

  -- C3 · forward only: a late Delayed is added to the timeline but never overwrites Delivered (T10).
  v_res := platform_account_email_event(v_email, 'msg_check_s5_b', 'delayed', now() - interval '1 minute', NULL);
  IF (SELECT state FROM platform_account_emails WHERE id = v_email) <> 'delivered'
     OR (SELECT count(*) FROM platform_account_email_events WHERE email_id = v_email) <> 2 THEN
    RAISE EXCEPTION 'FAIL C3: a late, lower state overwrote a higher one'; END IF;

  -- C4 · Delivered and Bounced at the same instant = Bounced, whichever lands first (T10).
  INSERT INTO platform_account_emails (kind, recipient_email) VALUES ('password_reset', 'check-s5b@example.invalid') RETURNING id INTO v_email2;
  v_res := platform_account_email_event(v_email2, 'msg_check_s5_c', 'bounced', now(), 'address_does_not_exist');
  v_res := platform_account_email_event(v_email2, 'msg_check_s5_d', 'delivered', now(), NULL);
  IF (SELECT state FROM platform_account_emails WHERE id = v_email2) <> 'bounced'
     OR (SELECT bounce_reason FROM platform_account_emails WHERE id = v_email2) <> 'address_does_not_exist' THEN
    RAISE EXCEPTION 'FAIL C4: a delivered after a bounce undid it'; END IF;

  -- C5 · our own outcome: unconfirmed replaces only Sent; failed never replaces a final state.
  PERFORM platform_account_email_settle(v_email2, 'unconfirmed', NULL);
  PERFORM platform_account_email_settle(v_email2, 'failed', 'abcdef12-3456');
  IF (SELECT state FROM platform_account_emails WHERE id = v_email2) <> 'bounced'
     OR (SELECT resend_id FROM platform_account_emails WHERE id = v_email2) <> 'abcdef12-3456' THEN
    RAISE EXCEPTION 'FAIL C5: the sender''s outcome overwrote the mail service''s word'; END IF;

  -- C6 · the log holds no subject, body or link column (T13).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'platform_account_emails'
             AND column_name IN ('subject', 'body', 'html', 'text', 'link', 'url')) THEN
    RAISE EXCEPTION 'FAIL C6: the log has a content column'; END IF;

  -- R1 · a reply starts as a draft; one claim wins; the words never change (T22).
  INSERT INTO feedback_submissions (type, category, title, body) VALUES ('bug', 'other', 'S5 check', 'body') RETURNING id INTO v_fb;
  INSERT INTO platform_feedback_replies (id, feedback_id, staff_user_id, staff_email, to_email, body)
  VALUES (v_reply, v_fb, gen_random_uuid(), 'staff@example.invalid', 'person@example.invalid', 'Hello');
  UPDATE platform_feedback_replies SET status = 'sending', sending_at = now() WHERE id = v_reply AND status = 'draft';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL R1: the first claim did not take it'; END IF;
  UPDATE platform_feedback_replies SET status = 'sending' WHERE id = v_reply AND status = 'draft';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN RAISE EXCEPTION 'FAIL R1: a second claim took a reply already sending'; END IF;
  v_err := NULL;
  BEGIN
    UPDATE platform_feedback_replies SET body = 'Edited' WHERE id = v_reply;
  EXCEPTION WHEN raise_exception THEN v_err := SQLERRM; END;
  IF v_err IS NULL THEN RAISE EXCEPTION 'FAIL R1: the words changed after sending started'; END IF;

  -- R2 · sent is final; failed and unknown retry; a reply never starts past draft.
  UPDATE platform_feedback_replies SET status = 'unknown' WHERE id = v_reply;
  UPDATE platform_feedback_replies SET status = 'sending' WHERE id = v_reply;
  UPDATE platform_feedback_replies SET status = 'sent' WHERE id = v_reply;
  v_err := NULL;
  BEGIN
    UPDATE platform_feedback_replies SET status = 'sending' WHERE id = v_reply;
  EXCEPTION WHEN raise_exception THEN v_err := SQLERRM; END;
  IF v_err IS NULL THEN RAISE EXCEPTION 'FAIL R2: a sent reply went back to sending'; END IF;
  v_err := NULL;
  BEGIN
    INSERT INTO platform_feedback_replies (id, feedback_id, staff_user_id, staff_email, to_email, body, status)
    VALUES (gen_random_uuid(), v_fb, gen_random_uuid(), 's@example.invalid', 'p@example.invalid', 'x', 'sent');
  EXCEPTION WHEN raise_exception THEN v_err := SQLERRM; END;
  IF v_err IS NULL THEN RAISE EXCEPTION 'FAIL R2: a reply started as sent'; END IF;

  -- S1 · Status's reading: one claim at a time, and none while the last reading is fresh (T6).
  UPDATE platform_status_reading SET read_at = now() - interval '1 hour', claimed_at = NULL WHERE id = 1;
  v_claimed := platform_status_claim(30, 15);
  v_second := platform_status_claim(30, 15);
  IF NOT v_claimed OR v_second THEN RAISE EXCEPTION 'FAIL S1: two servers claimed one reading (% / %)', v_claimed, v_second; END IF;
  UPDATE platform_status_reading SET read_at = now(), claimed_at = NULL WHERE id = 1;
  IF platform_status_claim(30, 15) THEN RAISE EXCEPTION 'FAIL S1: a fresh reading was read again'; END IF;

  -- H1 · the health function answers counts only.
  IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(platform_health_counts()) AS k) <> ARRAY['in_use', 'jobs', 'max', 'stuck'] THEN
    RAISE EXCEPTION 'FAIL H1: the health function answers more than counts'; END IF;

  RAISE EXCEPTION 'SUPPORT_CONSOLE_S5_PASSED';
END $s5$;
