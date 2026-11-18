-- ---------------------------------------------------------------
-- Migration 497 — Club Tier Stage 12: every tick of the payments terms is kept, and the record outlives the club
-- (build prompt docs/projects/active/CLUB_TIER_STAGE12_TERMS_RECORD_AND_REFUND_POLICY_BUILD_PROMPT.md Part B; plan
-- CLUB_TIER_STAGE12_PAYMENTS_PLAN.md, the 2026-11-17 owner block; payments terms drafts/PAYMENTS_TERMS.md §15).
--
-- WHY: the payments terms §15 promise "We record who agreed, when, and to which version, and keep that record for at least six
-- years after your account closes." Until now the agreement was four columns on the club's one payouts row (mig 358:50-53):
-- agreeing again OVERWROTE the earlier agreement, and the row is deleted with the organization (ON DELETE CASCADE, mig 358:61).
-- The audit-log row (org_audit_log) cascades with the organization too (mig 012:3). This is the record the sentence promises.
--
-- WHAT CHANGES
--   payments_terms_agreements   NEW. One row per tick of "I agree to the FieldLogicHQ payments terms for <club>.": the
--                       organization's id and its NAME AS TEXT at the time; the account's id and email as text; the version
--                       shown; THE EXACT SENTENCE TICKED (box_text); which action it came with; when. NO IP address and NO
--                       device, matching the Terms of Service record (mig 455, ruling R1).
--   action: 'set_up' (the first connect), 'reconnect' (connect again after a Disconnect), 'agree_again' (a newer version, from
--     the Payouts card), 'backfill' (copied below from a payouts row written before this table; it came with a set-up or a
--     reconnect, which the row does not say). Changing who pays records no agreement: it is refused while the agreement is
--     behind (app/api/admin/payouts/route.ts PATCH), so it never ticks.
--   The payouts row KEEPS its terms columns as the club's CURRENT STANDING (the card's "Agreed by … version of …" row, the
--   terms-changed notice, the platform tab read them). This table is the EVIDENCE.
--
-- ⚖ WHY A SIBLING, NOT legal_acceptances (decided with /dba 2026-11-17): an acceptance there is a PERSON's (no org_id, by
--   design, mig 455:17) and the app reads it as "has this person accepted the current Terms" (lib/legal-acceptance.ts) — a club's
--   agreement mixed in would need a nullable privacy_version, an org column and new doors, and every reader would have to learn
--   to skip it. Same shape, same lock, its own table.
--
-- ⚖ IT OUTLIVES THE ORGANIZATION AND THE ACCOUNT: org_id and user_id are PLAIN ids with NO foreign key, on purpose (the
--   mig-451 tax-record pattern, not even ON DELETE SET NULL): deleting a club or a person deletes none of these rows and keeps
--   whose they were. The names and the email are copied as text for the same reason.
--
-- ⚖ APPEND-ONLY (trigger payments_terms_agreements_append_only, BEFORE UPDATE OR DELETE, + BEFORE TRUNCATE): every UPDATE,
--   DELETE and TRUNCATE is refused — there is no foreign key to set null, so there is no exception (stricter than mig 455).
--   ⚠ The six-year end (§15: "at least six years after your account closes") will need a NAMED exception here, built with
--   the retention step that ends the Terms and tax records (a /plan item; nothing expires before 2032). Until then nothing
--   removes a row, and no purge exists.
--
-- GRANTS (dictionary rule 7, migration-table-grants-guard.test.ts): RLS on, no policies; nothing to anon / authenticated;
--   service_role SELECT, INSERT, UPDATE, DELETE — the house shape (mig 429, 455): the trigger is the ONE place the refusal
--   lives, so the named six-year exception, when it comes, touches only the trigger.
--
-- BACKFILL: one 'backfill' row per payouts row that holds an agreement (dev: three test clubs; prod: none — online payments
--   have never been on). The sentence is rebuilt from the club's name: it has read the same since it was written (e87741f69,
--   2026-10-25). Re-runnable: a payouts row already copied (same org, version and time) is not copied twice.
--
-- Additive; re-runnable. Prod apply rides the release (MANUAL_PROD_STEPS.json).
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS public.payments_terms_agreements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL,
  org_name       text NOT NULL,
  user_id        uuid NULL,
  user_email     text NOT NULL,
  terms_version  text NOT NULL,
  box_text       text NOT NULL,
  action         text NOT NULL,
  agreed_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments_terms_agreements DROP CONSTRAINT IF EXISTS payments_terms_agreements_action_check;
ALTER TABLE public.payments_terms_agreements ADD CONSTRAINT payments_terms_agreements_action_check
  CHECK (action IN ('set_up', 'reconnect', 'agree_again', 'backfill'));

-- A version is the published date, or the placeholder agreed to while the terms were unwritten (lib/online-payment-words.ts
-- PAYMENTS_TERMS_VERSION) — a club that agreed to the placeholder is asked again once a dated version exists.
ALTER TABLE public.payments_terms_agreements DROP CONSTRAINT IF EXISTS payments_terms_agreements_version_shape;
ALTER TABLE public.payments_terms_agreements ADD CONSTRAINT payments_terms_agreements_version_shape CHECK (
  terms_version = 'placeholder-counsel-pending' OR terms_version ~ '^\d{4}-\d{2}-\d{2}$'
);

ALTER TABLE public.payments_terms_agreements DROP CONSTRAINT IF EXISTS payments_terms_agreements_text_shape;
ALTER TABLE public.payments_terms_agreements ADD CONSTRAINT payments_terms_agreements_text_shape CHECK (
  -- No upper bound on the name or the sentence: an organization's name has none (a cap here would refuse a real agreement), and
  -- the sentence is the server's, built from that name (/dba 2026-11-17).
  char_length(btrim(org_name)) >= 1
  AND char_length(btrim(user_email)) BETWEEN 1 AND 320
  AND char_length(btrim(box_text)) >= 1
);

CREATE INDEX IF NOT EXISTS payments_terms_agreements_org_idx ON public.payments_terms_agreements (org_id, agreed_at DESC);

CREATE OR REPLACE FUNCTION public.payments_terms_agreements_refuse_change()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'A payments terms agreement cannot be edited. A row, once written, stays as written.'
      USING ERRCODE = 'P0001',
            HINT = 'payments_terms_agreements_append_only (migration 497) refuses every UPDATE.';
  END IF;
  RAISE EXCEPTION 'A payments terms agreement cannot be deleted. A row, once written, stays as written.'
    USING ERRCODE = 'P0001',
          HINT = 'payments_terms_agreements_append_only (migration 497) refuses DELETE and TRUNCATE.';
END
$$;
REVOKE ALL ON FUNCTION public.payments_terms_agreements_refuse_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS payments_terms_agreements_append_only ON public.payments_terms_agreements;
CREATE TRIGGER payments_terms_agreements_append_only
  BEFORE UPDATE OR DELETE ON public.payments_terms_agreements
  FOR EACH ROW EXECUTE FUNCTION public.payments_terms_agreements_refuse_change();

DROP TRIGGER IF EXISTS payments_terms_agreements_no_truncate ON public.payments_terms_agreements;
CREATE TRIGGER payments_terms_agreements_no_truncate
  BEFORE TRUNCATE ON public.payments_terms_agreements
  FOR EACH STATEMENT EXECUTE FUNCTION public.payments_terms_agreements_refuse_change();

ALTER TABLE public.payments_terms_agreements ENABLE ROW LEVEL SECURITY;
-- No policies: nothing but the service role reads or writes it (migration-table-grants-guard.test.ts).
REVOKE ALL ON TABLE public.payments_terms_agreements FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments_terms_agreements TO service_role;

COMMENT ON TABLE public.payments_terms_agreements IS
  'One row per tick of the payments terms box (Club Tier Stage 12, mig 497): the org id and its name as text, the account id '
  'and email as text, the version shown, the exact sentence ticked, which action, when. No IP, no device. No foreign keys: it '
  'outlives the organization and the account (kept six years after the account closes, payments terms §15). APPEND-ONLY.';

-- The backfill: every agreement already standing on a payouts row (one per club; the overwritten ones are gone).
INSERT INTO public.payments_terms_agreements (org_id, org_name, user_id, user_email, terms_version, box_text, action, agreed_at)
SELECT a.org_id, o.name, a.terms_agreed_by, a.terms_agreed_by_email, a.terms_version,
       'I agree to the FieldLogicHQ payments terms for ' || o.name || '.', 'backfill', a.terms_agreed_at
FROM public.org_payment_accounts a
JOIN public.organizations o ON o.id = a.org_id
WHERE a.terms_version IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.payments_terms_agreements p
    WHERE p.org_id = a.org_id AND p.terms_version = a.terms_version AND p.agreed_at = a.terms_agreed_at
  );

COMMIT;

-- Verify (dev, then prod at the release):
--   SELECT count(*) FROM pg_trigger WHERE tgname IN ('payments_terms_agreements_append_only','payments_terms_agreements_no_truncate');  -- 2
--   role_table_grants for payments_terms_agreements: service_role SELECT/INSERT/UPDATE/DELETE; anon/authenticated none.
--   SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.payments_terms_agreements'::regclass AND contype = 'f';  -- 0
-- Proved by scripts/payments-terms-agreements-lock-check.sql (PAYMENTS_TERMS_AGREEMENTS_LOCK_PASSED), rolled back.
