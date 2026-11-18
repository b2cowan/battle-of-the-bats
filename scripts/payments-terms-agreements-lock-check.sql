-- DEV only. Club Tier Stage 12 (mig 497): a payments terms agreement cannot be edited or deleted, by anyone; the action and
-- version CHECKs hold; and deleting the organization (and the account) leaves the record in place, as written.
-- Run: node scripts/db-query.mjs --dev -f scripts/payments-terms-agreements-lock-check.sql
-- The final exception rolls back every change (the throwaway organization, auth user and rows included); the run passes only
-- when it ends in PAYMENTS_TERMS_AGREEMENTS_LOCK_PASSED. Never points at a real club: it makes its own.
DO $pta$
DECLARE
  v_org uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_tag text := substr(md5(random()::text), 1, 10);
  v_email text := 'pta-lock-' || v_tag || '@example.test';
  v_id uuid;
  v_refused boolean;
  v_msg text;
  v_row jsonb;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  VALUES (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email, now(), now());
  INSERT INTO organizations (id, name, slug) VALUES (v_org, 'Lock Check Club ' || v_tag, 'pta-lock-' || v_tag);

  -- T1 · An INSERT works.
  INSERT INTO payments_terms_agreements (org_id, org_name, user_id, user_email, terms_version, box_text, action)
  VALUES (v_org, 'Lock Check Club', v_user, v_email, 'placeholder-counsel-pending',
          'I agree to the FieldLogicHQ payments terms for Lock Check Club.', 'set_up')
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'FAIL T1: an insert wrote nothing'; END IF;

  -- T2 · Editing any column is refused — user_id to NULL included (there is no exception: no FK to set null).
  v_refused := false;
  BEGIN UPDATE payments_terms_agreements SET terms_version = '2027-01-01' WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'A payments terms agreement cannot be edited%'; v_msg := SQLERRM; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T2a: a terms_version edit was not refused (%)', v_msg; END IF;

  v_refused := false;
  BEGIN UPDATE payments_terms_agreements SET box_text = 'another sentence' WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'A payments terms agreement cannot be edited%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T2b: a box_text edit was not refused'; END IF;

  v_refused := false;
  BEGIN UPDATE payments_terms_agreements SET agreed_at = agreed_at - interval '1 day' WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'A payments terms agreement cannot be edited%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T2c: an agreed_at edit was not refused'; END IF;

  v_refused := false;
  BEGIN UPDATE payments_terms_agreements SET user_id = NULL WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'A payments terms agreement cannot be edited%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T2d: user_id to NULL was not refused'; END IF;

  -- T3 · DELETE is refused.
  v_refused := false;
  BEGIN DELETE FROM payments_terms_agreements WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'A payments terms agreement cannot be deleted%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T3: a delete was not refused'; END IF;

  -- T4 · An unknown action is refused by the CHECK.
  v_refused := false;
  BEGIN INSERT INTO payments_terms_agreements (org_id, org_name, user_id, user_email, terms_version, box_text, action)
        VALUES (v_org, 'Lock Check Club', v_user, v_email, 'placeholder-counsel-pending', 'the sentence', 'fee_payer');
  EXCEPTION WHEN check_violation THEN v_refused := true; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T4: an unknown action was accepted'; END IF;

  -- T5 · A version that is neither the placeholder nor a date is refused.
  v_refused := false;
  BEGIN INSERT INTO payments_terms_agreements (org_id, org_name, user_id, user_email, terms_version, box_text, action)
        VALUES (v_org, 'Lock Check Club', v_user, v_email, 'v2', 'the sentence', 'set_up');
  EXCEPTION WHEN check_violation THEN v_refused := true; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T5: a malformed version was accepted'; END IF;

  -- T6 · Deleting the organization and the account leaves the row, every column as written (no FK, no cascade).
  SELECT to_jsonb(a) INTO v_row FROM payments_terms_agreements a WHERE id = v_id;
  DELETE FROM organizations WHERE id = v_org;
  DELETE FROM auth.users WHERE id = v_user;
  IF (SELECT to_jsonb(a) FROM payments_terms_agreements a WHERE id = v_id) IS DISTINCT FROM v_row THEN
    RAISE EXCEPTION 'FAIL T6: the organization or account deletion removed or changed the record';
  END IF;

  -- T7 · TRUNCATE is refused (the statement trigger).
  v_refused := false;
  BEGIN TRUNCATE payments_terms_agreements;
  EXCEPTION WHEN raise_exception THEN v_refused := SQLERRM LIKE 'A payments terms agreement cannot be deleted%'; END;
  IF NOT v_refused THEN RAISE EXCEPTION 'FAIL T7: a truncate was not refused'; END IF;

  RAISE EXCEPTION 'PAYMENTS_TERMS_AGREEMENTS_LOCK_PASSED (rolled back)';
END
$pta$;
