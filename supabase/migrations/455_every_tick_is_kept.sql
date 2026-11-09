-- ---------------------------------------------------------------
-- Migration 455 — GST/HST Stage 6 step 6.3, Chunk A: every tick of the Terms box is kept
-- (build prompt docs/projects/active/GST_HST_STAGE6_3_BUILD_PROMPT.md A1; plan GST_HST_STAGE6_TERMS_PLAN.md §5, ruling R1
-- of 2026-11-09).
--
-- WHY: from step 6.7 every door that makes an account carries one required box ("I'm 18 or older … I agree to the Terms of
-- Service and have read the Privacy Policy."), existing accounts meet one screen before their portal opens, and nobody starts an
-- organization or a paid plan without having accepted the current Terms. Terms §20 promises "We keep a record of which version
-- you accepted and when, for six years after your account closes." This is that record.
--
-- WHAT CHANGES
--   legal_acceptances   NEW. One row per tick: who (user_id, cleared if the account is deleted; user_email kept as text so the
--                       row outlives the account — the payouts terms shape), the Terms version and the Privacy Policy version
--                       shown, THE EXACT SENTENCE TICKED (box_text, like the family consent record), which door, and when.
--                       NO IP address and NO device, by design (R1). The age promise is recorded by the sentence itself.
--                       A version is 'draft' (recorded in the dev preview — never satisfies a dated version) or YYYY-MM-DD.
--   No org_id: an acceptance is a person's, not an organization's.
--   The door CHECK lists the doors of lib/legal-acceptance-rules.ts ACCEPTANCE_DOORS (tests/unit/legal-acceptance.test.ts
--   reads this file and fails when the two differ).
--
-- ⚖ APPEND-ONLY (trigger legal_acceptances_append_only, BEFORE UPDATE OR DELETE, + BEFORE TRUNCATE): every UPDATE is refused
--   except ONE — user_id going to NULL with every other column unchanged (the FK's ON DELETE SET NULL when the account is
--   deleted). Every DELETE and TRUNCATE is refused. The migration-429 pattern; the refusal raises P0001 with a HINT naming this
--   migration.
--   ⚠ The six-year end (Terms §20, /legal §20 (5f)) will need a NAMED exception here, built with the tax-record step (a /plan
--   item; the first expiry is after 2032). Until then nothing removes a row.
--
-- GRANTS (dictionary rule 7): RLS on, no policies; nothing to anon / authenticated; service_role SELECT, INSERT, UPDATE, DELETE
--   (UPDATE and DELETE stay granted so the FK's set-null runs and a future lift touches only the trigger).
--
-- The app's mirror of the accepted Terms version lives on the auth user's app_metadata (key `legal_terms_accepted`, service
-- role only) — a cache that can only ever say "not yet"; this table is the truth.
--
-- Additive; writes no data; re-runnable. Prod apply rides the 6.7 release (nothing reads it while the legal pages are off).
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email      text NOT NULL,
  terms_version   text NOT NULL,
  privacy_version text NOT NULL,
  box_text        text NOT NULL,
  door            text NOT NULL,
  accepted_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_acceptances DROP CONSTRAINT IF EXISTS legal_acceptances_door_check;
ALTER TABLE public.legal_acceptances ADD CONSTRAINT legal_acceptances_door_check CHECK (door IN (
  'signup', 'follow', 'coach_signup', 'registration', 'team_signup',
  'assistant_invite', 'league_coach_invite', 'staff_invite', 'family_accept',
  'sign_in_screen', 'purchase_window', 'fixture'
));

ALTER TABLE public.legal_acceptances DROP CONSTRAINT IF EXISTS legal_acceptances_version_shape;
ALTER TABLE public.legal_acceptances ADD CONSTRAINT legal_acceptances_version_shape CHECK (
  (terms_version = 'draft' OR terms_version ~ '^\d{4}-\d{2}-\d{2}$')
  AND (privacy_version = 'draft' OR privacy_version ~ '^\d{4}-\d{2}-\d{2}$')
);

ALTER TABLE public.legal_acceptances DROP CONSTRAINT IF EXISTS legal_acceptances_text_shape;
ALTER TABLE public.legal_acceptances ADD CONSTRAINT legal_acceptances_text_shape CHECK (
  char_length(btrim(user_email)) BETWEEN 1 AND 320 AND char_length(btrim(box_text)) BETWEEN 1 AND 1000
);

CREATE INDEX IF NOT EXISTS legal_acceptances_user_idx ON public.legal_acceptances (user_id, accepted_at DESC);

CREATE OR REPLACE FUNCTION public.legal_acceptances_refuse_change()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- The one exception: a deleted account's rows lose the link (ON DELETE SET NULL), and nothing else changes.
    IF OLD.user_id IS NOT NULL AND NEW.user_id IS NULL
       AND (to_jsonb(NEW) - 'user_id') = (to_jsonb(OLD) - 'user_id') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'A Terms acceptance cannot be edited. A row, once written, stays as written.'
      USING ERRCODE = 'P0001',
            HINT = 'legal_acceptances_append_only (migration 455): only user_id, only to NULL, when the account is deleted.';
  END IF;
  RAISE EXCEPTION 'A Terms acceptance cannot be deleted. A row, once written, stays as written.'
    USING ERRCODE = 'P0001',
          HINT = 'legal_acceptances_append_only (migration 455) refuses DELETE and TRUNCATE.';
END
$$;
REVOKE ALL ON FUNCTION public.legal_acceptances_refuse_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS legal_acceptances_append_only ON public.legal_acceptances;
CREATE TRIGGER legal_acceptances_append_only
  BEFORE UPDATE OR DELETE ON public.legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.legal_acceptances_refuse_change();

DROP TRIGGER IF EXISTS legal_acceptances_no_truncate ON public.legal_acceptances;
CREATE TRIGGER legal_acceptances_no_truncate
  BEFORE TRUNCATE ON public.legal_acceptances
  FOR EACH STATEMENT EXECUTE FUNCTION public.legal_acceptances_refuse_change();

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
-- No policies: nothing but the service role reads or writes it (migration-table-grants-guard.test.ts).
REVOKE ALL ON TABLE public.legal_acceptances FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_acceptances TO service_role;

COMMENT ON TABLE public.legal_acceptances IS
  'One row per tick of the Terms box (GST/HST Stage 6 step 6.3, mig 455): who, the email as text, both versions shown, the exact '
  'sentence ticked, which door, when. No IP, no device (R1). APPEND-ONLY: only user_id to NULL on account deletion.';

COMMIT;

-- Verify (dev, then prod at 6.7):
--   SELECT count(*) FROM pg_trigger WHERE tgname IN ('legal_acceptances_append_only','legal_acceptances_no_truncate');  -- 2
--   role_table_grants for legal_acceptances: service_role SELECT/INSERT/UPDATE/DELETE; anon/authenticated none.
-- Proved by scripts/legal-acceptances-lock-check.sql (LEGAL_ACCEPTANCES_LOCK_PASSED), rolled back.
