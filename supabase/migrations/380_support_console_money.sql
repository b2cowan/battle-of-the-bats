-- ---------------------------------------------------------------
-- Migration 380 — Support console Stage 3 (Money): the audit log's Reason column, a record of every console refund,
-- and one running plan grant per club.
-- Plan: docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md ("Owner rulings 2026-10-26", Q6, Q1-Q3, Q8);
-- build prompt PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE3_BUILD_PROMPT.md §6-6.
--
-- WHAT CHANGES:
--   1. platform_audit_log.reason (R4 "the reason in its own column", Q6). A staff change to a customer's club, person,
--      plan, money or retention writes it (the server refuses a blank one); the product's own jobs and the console's
--      own work tools (notes, decks, triage) write none. Old rows: the reason they kept inside new_value (`reason`, or a
--      catalog approval's `change_note` / `changeNote`) is copied in once. new_value is left as it was (history).
--   2. platform_refunds: the console's record of a refund, written BEFORE Stripe is asked (threat T10) and completed
--      with Stripe's answer. Its id is the refund's idempotency key and rides in the refund's Stripe metadata, which is
--      how recovery finds a refund whose answer was lost (it lists the charge's refunds; it never re-sends). One
--      unfinished refund per charge, by a partial unique index (T9). Server-only. Never card data, never Stripe's raw
--      reply (only its error code and request id).
--   3. org_overrides: two un-ended plan grants of one club may not overlap in time (Q8; the Stage 4 finish review's
--      "two staff giving a plan at the same instant can both pass"). An exclusion rule, not a unique index: a grant that
--      ran out by itself keeps revoked_at NULL, and a plain unique index would block every later grant for that club.
--      Checked 2026-10-26, read-only, on dev and prod: no club holds overlapping plan grants.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. The audit log's Reason column ────────────────────────────────────────────────────────────
ALTER TABLE public.platform_audit_log ADD COLUMN IF NOT EXISTS reason text;

UPDATE public.platform_audit_log
   SET reason = nullif(btrim(coalesce(new_value->>'reason', new_value->>'change_note', new_value->>'changeNote')), '')
 WHERE reason IS NULL
   AND jsonb_typeof(new_value) = 'object'
   AND (new_value ? 'reason' OR new_value ? 'change_note' OR new_value ? 'changeNote');

COMMENT ON COLUMN public.platform_audit_log.reason IS
  'Why a staff member made this change (R4, owner Q6 2026-10-26). Required on every staff change to a customer''s club, person, plan, money or retention, and on refunds; NULL for the product''s own jobs and the console''s work tools. Rows before mig 380 had it copied from new_value (reason / change_note / changeNote); a staff row with none reads "Not recorded".';

-- ── 2. The console's refunds ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_refunds (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  stripe_customer_id   text NOT NULL,
  stripe_charge_id     text NOT NULL CHECK (stripe_charge_id ~ '^(ch|py)_[A-Za-z0-9]+$'),
  stripe_refund_id     text UNIQUE CHECK (stripe_refund_id IS NULL OR stripe_refund_id ~ '^(re|pyr)_[A-Za-z0-9]+$'),
  amount_cents         integer NOT NULL CHECK (amount_cents > 0),
  currency             text NOT NULL CHECK (currency ~ '^[a-z]{3}$'),
  remaining_seen_cents integer NOT NULL CHECK (remaining_seen_cents >= amount_cents),
  stripe_reason        text NOT NULL CHECK (stripe_reason IN ('duplicate', 'requested_by_customer')),
  status               text NOT NULL DEFAULT 'started'
                         CHECK (status IN ('started', 'done', 'refused', 'unknown', 'not_made')),
  stripe_error_code    text CHECK (stripe_error_code IS NULL OR stripe_error_code ~ '^[a-z_]{1,80}$'),
  stripe_request_id    text CHECK (stripe_request_id IS NULL OR stripe_request_id ~ '^req_[A-Za-z0-9]{1,64}$'),
  reason               text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  actor_email          text NOT NULL,
  actor_role           text NOT NULL,
  livemode             boolean NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  completed_at         timestamptz
);

-- One unfinished refund per charge (T9): a second start for the same charge is refused by the database, not by a read.
-- A refund closed as not_made (recovery found nothing in Stripe) releases the charge.
CREATE UNIQUE INDEX IF NOT EXISTS platform_refunds_one_open_per_charge
  ON public.platform_refunds (stripe_charge_id) WHERE status IN ('started', 'unknown');
-- Billing's daily brake (a sixth refund by one person in 24 hours) and the club's Story.
CREATE INDEX IF NOT EXISTS platform_refunds_actor_idx ON public.platform_refunds (actor_email, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_refunds_org_idx ON public.platform_refunds (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_refunds_charge_idx ON public.platform_refunds (stripe_charge_id);

-- What a refund was asked for never changes after the start; only Stripe's answer completes it, forwards only.
CREATE OR REPLACE FUNCTION public.platform_refunds_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'started' OR NEW.stripe_refund_id IS NOT NULL OR NEW.completed_at IS NOT NULL THEN
      RAISE EXCEPTION 'A refund starts as started; Stripe''s answer records the rest.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.org_id IS DISTINCT FROM OLD.org_id AND NEW.org_id IS NOT NULL THEN
    RAISE EXCEPTION 'A refund''s club never changes.';
  END IF;
  IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id OR NEW.stripe_charge_id IS DISTINCT FROM OLD.stripe_charge_id
     OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.remaining_seen_cents IS DISTINCT FROM OLD.remaining_seen_cents OR NEW.stripe_reason IS DISTINCT FROM OLD.stripe_reason
     OR NEW.reason IS DISTINCT FROM OLD.reason OR NEW.actor_email IS DISTINCT FROM OLD.actor_email
     OR NEW.actor_role IS DISTINCT FROM OLD.actor_role OR NEW.livemode IS DISTINCT FROM OLD.livemode
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (OLD.stripe_refund_id IS NOT NULL AND NEW.stripe_refund_id IS DISTINCT FROM OLD.stripe_refund_id) THEN
    RAISE EXCEPTION 'A refund''s request never changes after it starts.';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'started' AND NEW.status IN ('done', 'refused', 'unknown', 'not_made'))
    OR (OLD.status = 'unknown' AND NEW.status IN ('done', 'not_made'))
  ) THEN
    RAISE EXCEPTION 'A refund moves forward only: started, then done, refused, unknown or not made.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.platform_refunds_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS platform_refunds_guard ON public.platform_refunds;
CREATE TRIGGER platform_refunds_guard BEFORE INSERT OR UPDATE ON public.platform_refunds
  FOR EACH ROW EXECUTE FUNCTION public.platform_refunds_guard();

ALTER TABLE public.platform_refunds ENABLE ROW LEVEL SECURITY;
-- No policies: nothing but the service role reads or writes it (migration-table-grants-guard.test.ts).
REVOKE ALL ON TABLE public.platform_refunds FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_refunds TO service_role;

COMMENT ON TABLE public.platform_refunds IS
  'Support console Stage 3 (owner Q1-Q3 2026-10-26): one row per refund a staff member makes from a club''s Money tab, written as started BEFORE Stripe is asked and completed with Stripe''s answer. The id is the idempotency key and the refund''s metadata.platform_refund_id. Server-only. Never card data or Stripe''s raw reply.';
COMMENT ON COLUMN public.platform_refunds.status IS
  'started = written, Stripe not yet answered; done = Stripe made the refund (stripe_refund_id set); refused = Stripe''s definite no (4xx; stripe_error_code + stripe_request_id kept); unknown = timeout or Stripe fault, until recovery lists the charge''s refunds; not_made = recovery found no refund with this id (releases the charge). Forward-only (platform_refunds_guard).';
COMMENT ON COLUMN public.platform_refunds.remaining_seen_cents IS
  'What the staff member saw still refundable when they pressed Refund; the server refuses when Stripe''s remainder differs.';
COMMENT ON COLUMN public.platform_refunds.stripe_reason IS
  'Stripe''s reason: duplicate when the Money tab flagged the charge as a double charge, else requested_by_customer. Never fraudulent.';
COMMENT ON COLUMN public.platform_refunds.reason IS
  'The staff member''s typed reason. Kept here and in the audit log''s reason column only; never sent to Stripe. A Luhn-valid card-length digit run is refused on the server.';
COMMENT ON COLUMN public.platform_refunds.livemode IS 'The mode of the key that made it (sk_live_ = true). A charge in the other mode is refused.';

-- ── 3. One running plan grant per club (Q8) ─────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

ALTER TABLE public.org_overrides DROP CONSTRAINT IF EXISTS org_overrides_one_plan_grant_at_a_time;
ALTER TABLE public.org_overrides ADD CONSTRAINT org_overrides_one_plan_grant_at_a_time
  EXCLUDE USING gist (org_id WITH =, tstzrange(starts_at, expires_at, '[)') WITH &&)
  WHERE (type = 'plan_tier' AND revoked_at IS NULL);

COMMENT ON CONSTRAINT org_overrides_one_plan_grant_at_a_time ON public.org_overrides IS
  'Support console Stage 3 Q8: two un-ended plan grants of one club cannot overlap in time. A grant that ran out by itself (expires_at passed, revoked_at NULL) does not block a new one; an ended one (revoked_at set) is ignored.';

COMMIT;
