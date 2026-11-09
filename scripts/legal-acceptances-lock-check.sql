-- DEV only. GST/HST Stage 6 step 6.3 (mig 455): a Terms acceptance cannot be edited or deleted. Every UPDATE is refused except
-- user_id going to NULL when the account is deleted; DELETE and TRUNCATE are refused; the door CHECK holds.
-- Run: node scripts/db-query.mjs --dev -f scripts/legal-acceptances-lock-check.sql
-- The final exception rolls back every change (the throwaway auth user and its rows included); the run passes only when it
-- ends in LEGAL_ACCEPTANCES_LOCK_PASSED. Never points at a real account: it makes its own.
DO $la$
DECLARE
  v_user uuid := gen_random_uuid();
  v_email text := 'la-lock-' || substr(md5(random()::text), 1, 10) || '@example.test';
  v_id uuid;
  v_refused boolean;
  v_msg text;
  v_row jsonb;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  VALUES (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email, now(), now());

  -- T1 · An INSERT works.
  INSERT INTO legal_acceptances (user_id, user_email, terms_version, privacy_version, box_text, door)
  VALUES (v_user, v_email, 'draft', 'draft', 'the box sentence', 'fixture')
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'FAIL T1: an insert wrote nothing'; END IF;

  -- T2 · Editing any column is refused (one sub-block per statement).
  v_refused := false;
  BEGIN UPDATE legal_acceptances SET terms_version = '2027-01-01' WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'A Terms acceptance cannot be edited%'; v_msg := SQLERRM; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T2a: a terms_version edit was not refused (%)', v_msg; END IF;

  v_refused := false;
  BEGIN UPDATE legal_acceptances SET box_text = 'another sentence' WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'A Terms acceptance cannot be edited%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T2b: a box_text edit was not refused'; END IF;

  v_refused := false;
  BEGIN UPDATE legal_acceptances SET accepted_at = accepted_at - interval '1 day' WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'A Terms acceptance cannot be edited%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T2c: an accepted_at edit was not refused'; END IF;

  -- T3 · Blanking user_id AND changing another column in one go is refused.
  v_refused := false;
  BEGIN UPDATE legal_acceptances SET user_id = NULL, user_email = 'x@example.test' WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'A Terms acceptance cannot be edited%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T3: user_id-to-null with another change was not refused'; END IF;

  -- T4 · DELETE is refused.
  v_refused := false;
  BEGIN DELETE FROM legal_acceptances WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'A Terms acceptance cannot be deleted%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T4: a delete was not refused'; END IF;

  -- T5 · An unknown door is refused by the CHECK.
  v_refused := false;
  BEGIN INSERT INTO legal_acceptances (user_id, user_email, terms_version, privacy_version, box_text, door)
        VALUES (v_user, v_email, 'draft', 'draft', 'the box sentence', 'back_door');
  EXCEPTION WHEN check_violation THEN v_refused := true; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T5: an unknown door was accepted'; END IF;

  -- T6 · A version that is neither 'draft' nor a date is refused.
  v_refused := false;
  BEGIN INSERT INTO legal_acceptances (user_id, user_email, terms_version, privacy_version, box_text, door)
        VALUES (v_user, v_email, 'v2', 'draft', 'the box sentence', 'fixture');
  EXCEPTION WHEN check_violation THEN v_refused := true; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T6: a malformed version was accepted'; END IF;

  -- T7 · Deleting the account keeps the row, unlinked, everything else unchanged.
  SELECT to_jsonb(a) - 'user_id' INTO v_row FROM legal_acceptances a WHERE id = v_id;
  DELETE FROM auth.users WHERE id = v_user;
  IF NOT EXISTS (SELECT 1 FROM legal_acceptances WHERE id = v_id AND user_id IS NULL) THEN
    RAISE EXCEPTION 'FAIL T7a: the row did not survive the account deletion unlinked';
  END IF;
  IF (SELECT to_jsonb(a) - 'user_id' FROM legal_acceptances a WHERE id = v_id) <> v_row THEN
    RAISE EXCEPTION 'FAIL T7b: the account deletion changed more than user_id';
  END IF;

  -- T8 · TRUNCATE is refused (the statement trigger).
  v_refused := false;
  BEGIN TRUNCATE legal_acceptances;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'A Terms acceptance cannot be deleted%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T8: a truncate was not refused'; END IF;

  -- T9 · Neither anon nor authenticated holds any privilege on the table.
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE table_schema = 'public' AND table_name = 'legal_acceptances' AND grantee IN ('anon', 'authenticated')) THEN
    RAISE EXCEPTION 'FAIL T9: anon or authenticated holds a privilege on legal_acceptances';
  END IF;

  RAISE EXCEPTION 'LEGAL_ACCEPTANCES_LOCK_PASSED (9 checks; everything rolled back)';
END
$la$;
