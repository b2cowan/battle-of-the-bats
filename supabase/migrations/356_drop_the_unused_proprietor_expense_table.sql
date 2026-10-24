-- 356 · Remove the unused proprietor expense table and its guard function (owner ruling 2026-10-24: do the planned cleanup).
--
-- Mig 354 put the owner's private expense book in Supabase on DEV only. On 2026-10-23 the owner chose separate AWS storage
-- for it, so 354 was held from prod and nothing in the app reads or writes this table any more. It was also the source of
-- three of Supabase's security-advisor findings on dev (two kinds: a function with no fixed search path, a table with row
-- level security on and no policy). Dropping the unused pieces clears the function warning and the table's notice.
--
-- SAFE ON PROD: prod never received 354, so every statement here is IF EXISTS and does nothing there.
-- GUARDED: the table must be empty. If anything was ever written to it, this stops instead of destroying it.
-- The private storage bucket 'proprietor-receipts' is NOT dropped here: Supabase blocks deleting a bucket from SQL, so it is
-- removed through the Storage API (an empty bucket) in the same unit of work.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.proprietor_expense_revisions') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.proprietor_expense_revisions) THEN
    RAISE EXCEPTION 'proprietor_expense_revisions has rows; refusing to drop it. Export them first.';
  END IF;
END
$$;

DROP TABLE IF EXISTS public.proprietor_expense_revisions;
DROP FUNCTION IF EXISTS public.proprietor_expense_immutable();

COMMIT;
