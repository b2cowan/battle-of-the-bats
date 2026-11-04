-- ---------------------------------------------------------------
-- Migration 433 — GST/HST Stage 1: every buyer has a billing address on our own records
-- (build prompt docs/projects/active/GST_HST_STAGE1_BUILD_PROMPT.md; plan GST_HST_COLLECTION_PLAN.md §4 Stage 1;
-- owner rulings 2026-11-03, asks 1–6 and drawing asks 1–6, all as recommended).
--
-- WHY: Stage 2 turns tax on, and a missing address silently becomes the wrong tax. No organization or coach has a
-- country, province or address on file today; every Checkout lets Stripe guess. This stage makes the address a required
-- fact before a buyer's first paid checkout, saved here (not only on the Stripe customer).
--
-- WHO THE BUYER IS (owner ruling 6, 2026-11-03): a club buys as its organization; a coach buys Premium as a PERSON (a
-- first-time coach has no organization row until the webhook provisions one after payment, and one home address covers
-- every portal they pay for). So one row per buyer, keyed by exactly one of org_id or user_id — not columns on
-- organizations.
--
-- WHAT CHANGES: one new table, billing_locations. RLS on, no policies, grants revoked from anon and authenticated: the
-- service role reads and writes it from the server (the Billing address route, the billing webhook, the platform-admin
-- record). No existing table, function or row changes. No backfill: production had 0 live subscriptions on 2026-11-03
-- (read-only count of live Stripe + prod rows, owner-approved), so every buyer meets the step at their first paid checkout.
--
-- Re-runnable. Prod order: any time before the promote that ships Stage 1 Part 2 (the checkout check reads this table).
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS public.billing_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The buyer: exactly one.
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The address, upper-case ISO country and region codes, as validated by lib/billing-location.ts.
  country char(2) NOT NULL,
  region_code text NOT NULL,
  line1 text NOT NULL,
  line2 text,
  city text NOT NULL,
  postal_code text NOT NULL,
  -- When the buyer last confirmed it (the Billing address window, or a valid edit on Stripe's billing page).
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  -- A US buyer's declaration (T7): the day it was ticked and which wording they saw.
  us_declaration_at timestamptz,
  us_declaration_version text,
  -- The country of the card on file for this buyer's subscription, from the Stripe payment method (Part 3).
  card_country char(2),
  -- Needs review: a short reason code (lib/billing-location.ts REVIEW_REASONS) and a staff-readable sentence. Never
  -- blocks a purchase; Stage 2 taxes a flagged buyer as Canadian until it clears.
  review_reason text,
  review_note text,
  review_set_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT billing_locations_one_buyer CHECK ((org_id IS NULL) <> (user_id IS NULL)),
  CONSTRAINT billing_locations_country_check CHECK (country IN ('CA', 'US')),
  CONSTRAINT billing_locations_region_code_check CHECK (region_code ~ '^[A-Z]{2}$'),
  CONSTRAINT billing_locations_line1_check CHECK (length(btrim(line1)) BETWEEN 1 AND 200),
  CONSTRAINT billing_locations_line2_check CHECK (line2 IS NULL OR length(btrim(line2)) BETWEEN 1 AND 200),
  CONSTRAINT billing_locations_city_check CHECK (length(btrim(city)) BETWEEN 1 AND 100),
  CONSTRAINT billing_locations_postal_code_check CHECK (
    (country = 'CA' AND postal_code ~ '^[A-Z][0-9][A-Z] [0-9][A-Z][0-9]$')
    OR (country = 'US' AND postal_code ~ '^[0-9]{5}(-[0-9]{4})?$')
  ),
  -- A US address always carries its declaration; the two declaration fields come together.
  CONSTRAINT billing_locations_us_declaration_check CHECK (
    (us_declaration_at IS NULL) = (us_declaration_version IS NULL)
    AND (country <> 'US' OR us_declaration_at IS NOT NULL)
  ),
  CONSTRAINT billing_locations_card_country_check CHECK (card_country IS NULL OR card_country ~ '^[A-Z]{2}$'),
  CONSTRAINT billing_locations_review_reason_check CHECK (
    review_reason IS NULL OR review_reason IN (
      'country_changed_after_paying', 'stripe_edit_invalid', 'card_country_mismatch', 'payout_country_mismatch'
    )
  ),
  CONSTRAINT billing_locations_review_set_check CHECK ((review_reason IS NULL) = (review_set_at IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_locations_one_per_org
  ON public.billing_locations (org_id) WHERE org_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS billing_locations_one_per_user
  ON public.billing_locations (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.billing_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_locations FROM anon, authenticated;
-- The server's own access (Supabase stopped auto-granting new tables 2026-10-30; tests/unit/migration-table-grants-guard.test.ts).
-- Added in Part 2 before any commit: dev already held it through migration 025's default (read live 2026-11-03), production
-- would not have.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_locations TO service_role;

COMMENT ON TABLE public.billing_locations IS
  'GST/HST Stage 1 (mig 433): where each buyer is billed. One row per buyer: a club (org_id) or a coach buying as a person (user_id). Written by the Billing address route and the billing webhook; read by the checkout check, Plan & billing and the platform-admin record. Service role only.';

COMMIT;
