-- ---------------------------------------------------------------
-- Migration 429 — Plans & pricing Stage 0, O11: the change log cannot be edited or deleted
-- (build prompt docs/projects/active/PLANS_PRICING_STAGE0_O11_AUDIT_LOCK_BUILD_PROMPT.md; owner ruling O11, 2026-11-02).
--
-- WHY: Stage 0 made platform_audit_log the record for every money action (Part 9: the line is written first, or the
-- change is not made). A record that can be quietly rewritten is worth less than one that cannot, and later stages
-- (refunds, invoices, price moves) lean on it. Until now RLS kept the Data API out, but the service role, the table
-- owner and anyone holding either could still rewrite a reason, change who made a change, or remove a line.
--
-- WHAT IT REFUSES (trigger platform_audit_log_append_only, BEFORE UPDATE OR DELETE, FOR EACH ROW):
--   * every UPDATE, with ONE exception: only org_id, only to NULL. That is the ON DELETE SET NULL of
--     platform_audit_log_org_id_fkey: deleting a club keeps its lines but they stop pointing at it (unchanged from
--     before). The exception is tested as org_id going from a club to NULL AND every other column unchanged
--     ((to_jsonb(NEW) - 'org_id') = (to_jsonb(OLD) - 'org_id')), so a line cannot be blanked AND edited in one go, and
--     cannot be moved to another club.
--   * every DELETE.
--   * TRUNCATE (trigger platform_audit_log_no_truncate, BEFORE TRUNCATE, FOR EACH STATEMENT: row triggers do not fire
--     on TRUNCATE). TRUNCATE is a delete of every line, so it is read as inside the ruling's "refuse deletes". Also
--     revoked from anon and authenticated (Supabase default grants, never reachable through the Data API).
-- INSERT is untouched: writers keep writing exactly what they wrote. Who can read the log is untouched.
--
-- The refusal lives in ONE place, the trigger. service_role keeps UPDATE and DELETE on purpose, so a future erasure
-- lifts one thing and nothing else changes. Refusals raise SQLSTATE P0001 with the message
-- 'The platform audit log cannot be …' and a HINT naming this migration (scripts/platform-audit-log-lock-check.sql
-- tells the refusal apart from any other error by that message).
--
-- ⚠ HOW TO LIFT IT ON PURPOSE (a privacy erasure like mig 405 was): a later migration, in ONE transaction,
--     BEGIN;
--     ALTER TABLE public.platform_audit_log DISABLE TRIGGER platform_audit_log_append_only;
--     UPDATE public.platform_audit_log ...;   -- the deliberate change
--     ALTER TABLE public.platform_audit_log ENABLE TRIGGER platform_audit_log_append_only;
--     COMMIT;
--   Triggers fire for the table owner and the postgres role too (only session_replication_role = replica skips them),
--   so a migration that forgets this fails loudly. That is the point: the lift is itself recorded in the repository.
--
-- No row changed; re-runnable; no code depends on it (nothing updates or deletes a line: guarded by
-- tests/unit/platform-audit-log-lock.test.ts). INVISIBLE to the drift check: both triggers and the function, so the
-- MANUAL_PROD_STEPS.json entry is the only promote gate.
-- ---------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.platform_audit_log_refuse_change()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- The one exception: a deleted club's lines lose the club (ON DELETE SET NULL), and nothing else changes.
    IF OLD.org_id IS NOT NULL AND NEW.org_id IS NULL
       AND (to_jsonb(NEW) - 'org_id') = (to_jsonb(OLD) - 'org_id') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'The platform audit log cannot be edited. A line, once written, stays as written.'
      USING ERRCODE = 'P0001',
            HINT = 'platform_audit_log_append_only (migration 429): only org_id, only to NULL, when a club is deleted. Lifting it on purpose is described in that migration''s header.';
  END IF;
  RAISE EXCEPTION 'The platform audit log cannot be deleted from. A line, once written, stays as written.'
    USING ERRCODE = 'P0001',
          HINT = 'platform_audit_log_append_only (migration 429) refuses DELETE and TRUNCATE. Lifting it on purpose is described in that migration''s header.';
END
$$;
REVOKE ALL ON FUNCTION public.platform_audit_log_refuse_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS platform_audit_log_append_only ON public.platform_audit_log;
CREATE TRIGGER platform_audit_log_append_only
  BEFORE UPDATE OR DELETE ON public.platform_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.platform_audit_log_refuse_change();

DROP TRIGGER IF EXISTS platform_audit_log_no_truncate ON public.platform_audit_log;
CREATE TRIGGER platform_audit_log_no_truncate
  BEFORE TRUNCATE ON public.platform_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.platform_audit_log_refuse_change();

REVOKE TRUNCATE ON public.platform_audit_log FROM anon, authenticated;

COMMENT ON TABLE public.platform_audit_log IS
  'The platform-admin change log: one line per staff or system change (who, which club, what, before, after, why). '
  'APPEND-ONLY since migration 429: every UPDATE is refused except org_id going to NULL when its club is deleted; '
  'DELETE and TRUNCATE are refused. Lifting it on purpose is described in migration 429''s header.';

COMMIT;

-- Verify (dev, then prod):
--   SELECT count(*) FROM pg_trigger WHERE tgname = 'platform_audit_log_append_only';   -- 1
--   SELECT count(*) FROM pg_trigger WHERE tgname = 'platform_audit_log_no_truncate';   -- 1
-- Proved by scripts/platform-audit-log-lock-check.sql (PLATFORM_AUDIT_LOG_LOCK_PASSED).
