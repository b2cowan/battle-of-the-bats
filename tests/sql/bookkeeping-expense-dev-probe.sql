-- Development-only, rolled-back proof of the proprietor expense revision boundary.
BEGIN;
DO $probe$
DECLARE
  v_owner uuid;
  v_expense uuid := gen_random_uuid();
  v_blocked boolean;
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE lower(email) = 'fieldlogichq@gmail.com' LIMIT 1;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Owner login missing in dev'; END IF;

  INSERT INTO public.proprietor_expense_revisions
    (expense_id, revision, expense_date, supplier, category, business_purpose,
     original_currency, original_cents, cad_cents, tax_cad_cents, tax_status,
     business_use_percent, payment_source, created_by)
  VALUES (v_expense, 1, '2026-05-01', 'Synthetic hosting', 'Software', 'Synthetic test',
    'CAD', 113, 113, 13, 'pending', 50, 'personal', v_owner);

  v_blocked := false;
  BEGIN
    UPDATE public.proprietor_expense_revisions SET cad_cents = 999 WHERE expense_id = v_expense;
  EXCEPTION WHEN OTHERS THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Immutable revision accepted UPDATE'; END IF;

  INSERT INTO public.proprietor_expense_revisions
    (expense_id, revision, expense_date, supplier, category, business_purpose,
     original_currency, original_cents, cad_cents, tax_cad_cents, tax_status,
     business_use_percent, payment_source, change_reason, created_by)
  VALUES (v_expense, 2, '2026-05-01', 'Synthetic hosting', 'Software', 'Synthetic test',
    'CAD', 213, 213, 13, 'pending', 50, 'personal', 'Corrected amount', v_owner);

  v_blocked := false;
  BEGIN
    INSERT INTO public.proprietor_expense_revisions
      (expense_id, revision, expense_date, supplier, category, business_purpose,
       original_currency, original_cents, cad_cents, tax_cad_cents, tax_status,
       business_use_percent, payment_source, change_reason, created_by)
    VALUES (v_expense, 2, '2026-05-01', 'Synthetic hosting', 'Software', 'Synthetic test',
      'CAD', 300, 300, 13, 'pending', 50, 'personal', 'Stale write', v_owner);
  EXCEPTION WHEN unique_violation THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Duplicate revision accepted'; END IF;

  IF (SELECT count(*) FROM public.proprietor_expense_revisions WHERE expense_id = v_expense) <> 2
    THEN RAISE EXCEPTION 'Revision history count incorrect'; END IF;
END;
$probe$;
ROLLBACK;
