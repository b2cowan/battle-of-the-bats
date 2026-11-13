-- ---------------------------------------------------------------
-- Migration 478 — GST/HST Stage 6 step 6.4: the purchase email, the yearly reminder (build prompt
-- docs/projects/active/GST_HST_STAGE6_4_BUILD_PROMPT.md §5; plan GST_HST_STAGE6_TERMS_PLAN.md §5 6.4 RULED block, owner
-- rulings 2026-11-13 Q1–Q6 as recommended).
--
-- WHY: the Terms draft (§8 Yearly plans, §16 the details of a purchase) promises that a buyer is emailed the details of a
-- purchase, and that a yearly plan's owners hear of the next charge at least 30 days before it. The email reads its figures
-- from the invoice's own tax record (the same row the billing page and the books read), so the record learns WHY the invoice
-- was made and keeps the email's once-only stamp; the reminder keeps the charge date it last told of.
--
--   1. platform_charge_tax_records.billing_reason — Stripe's `billing_reason` (subscription_create, subscription_update,
--      subscription_cycle, manual, …), written with the record's FIRST write and frozen like the rest of it. NULL = a row
--      written before this migration, or by the backfill: such a row never gets a purchase email.
--   2. platform_charge_tax_records.purchase_email_at — the purchase email's claim-and-sent stamp: set before the send, given
--      back (NULL) only when the email definitely did not go. MOVABLE: the guard trigger (mig 451) freezes every column it
--      does not name, so it is named here; billing_reason is NOT (it is what the invoice said when it was issued).
--   3. organizations.renewal_reminded_for / team_workspaces.renewal_reminded_for — the charge date the yearly reminder last
--      told the owners of (a coach's Premium keeps its own period on team_workspaces). Claimed with a conditional update
--      (is null or != the date), so one reminder per period.
--   4. Two platform_email_templates rows (purchase_details, yearly_renewal_reminder), so each email is listed and can be
--      customised on the platform-admin Email templates page. ⚖ The purchase email's renewal, cancel and refund sentences,
--      its figures and the seller lines are rendered by CODE outside the editable body (/legal, 2026-11-13): an operator can
--      change the opening and the closing, never what the buyer is told about cancelling or refunds. ON CONFLICT DO NOTHING.
--
-- No backfill: no existing row gets a billing_reason (so nothing already paid is emailed). Re-runnable.
-- Prod order: BEFORE the promote that ships 6.4 (the webhook writes billing_reason with every new record; without the column
-- every new tax record fails to write and is caught up by the daily job only after the migration).
-- ---------------------------------------------------------------

BEGIN;

-- ── 1–2. the tax record ───────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.platform_charge_tax_records
  ADD COLUMN IF NOT EXISTS billing_reason text,
  ADD COLUMN IF NOT EXISTS purchase_email_at timestamptz;

ALTER TABLE public.platform_charge_tax_records
  DROP CONSTRAINT IF EXISTS platform_charge_tax_records_billing_reason_check,
  ADD CONSTRAINT platform_charge_tax_records_billing_reason_check CHECK (billing_reason IS NULL OR billing_reason ~ '^[a-z_]{1,64}$');

-- The daily job's catch-up looks for a paid purchase still owed its email (paid in the last 3 days).
CREATE INDEX IF NOT EXISTS platform_charge_tax_records_purchase_email_idx
  ON public.platform_charge_tax_records (paid_at)
  WHERE billing_reason IS NOT NULL AND purchase_email_at IS NULL;

-- The guard of mig 451, with purchase_email_at named movable (everything else exactly as it was).
CREATE OR REPLACE FUNCTION public.platform_charge_tax_records_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.livemode THEN
      RAISE EXCEPTION 'A live charge''s tax record is kept for six years and cannot be deleted (%).', OLD.stripe_invoice_id;
    END IF;
    RETURN OLD;
  END IF;
  IF (to_jsonb(NEW) - ARRAY['status', 'paid_at', 'voided_at', 'uncollectible_at', 'stripe_payment_intent_id', 'refunded_cents', 'updated_at',
                            'fx_rate', 'fx_rate_date', 'fx_source', 'cad_amount_before_tax_cents', 'cad_tax_total_cents', 'cad_total_cents', 'stripe_cad_total_cents',
                            'purchase_email_at'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status', 'paid_at', 'voided_at', 'uncollectible_at', 'stripe_payment_intent_id', 'refunded_cents', 'updated_at',
                            'fx_rate', 'fx_rate_date', 'fx_source', 'cad_amount_before_tax_cents', 'cad_tax_total_cents', 'cad_total_cents', 'stripe_cad_total_cents',
                            'purchase_email_at']) THEN
    RAISE EXCEPTION 'A charge''s tax record keeps what it recorded when the invoice was issued: only its payment state changes (%).', OLD.stripe_invoice_id;
  END IF;
  -- The CAD valuation (Stage 4 Ask 4) is set ONCE: a non-CAD sale whose rate could not be read is valued by a later write, never re-valued.
  IF OLD.fx_rate IS NOT NULL AND (NEW.fx_rate, NEW.fx_rate_date, NEW.fx_source, NEW.cad_amount_before_tax_cents, NEW.cad_tax_total_cents, NEW.cad_total_cents)
     IS DISTINCT FROM (OLD.fx_rate, OLD.fx_rate_date, OLD.fx_source, OLD.cad_amount_before_tax_cents, OLD.cad_tax_total_cents, OLD.cad_total_cents) THEN
    RAISE EXCEPTION 'A charge''s CAD valuation is set once (%).', OLD.stripe_invoice_id;
  END IF;
  IF OLD.stripe_cad_total_cents IS NOT NULL AND NEW.stripe_cad_total_cents IS DISTINCT FROM OLD.stripe_cad_total_cents THEN
    RAISE EXCEPTION 'Stripe''s CAD cross-check figure is set once (%).', OLD.stripe_invoice_id;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.platform_charge_tax_records_guard() FROM PUBLIC, anon, authenticated;

-- ── 3. the yearly reminder's stamp ────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS renewal_reminded_for timestamptz;
ALTER TABLE public.team_workspaces ADD COLUMN IF NOT EXISTS renewal_reminded_for timestamptz;

-- ── 4. the two templates ──────────────────────────────────────────────────────────────────────────────────────────────
insert into platform_email_templates (key, label, description, subject, heading, body, cta_label, cta_url_pattern, variables, category)
values
($k$purchase_details$k$, $k$Purchase details$k$,
  $k$Sent to every owner a minute or so after a plan's invoice is paid: a first plan, a free trial starting, an upgrade, a next-season choice, or coming back after a cancel. Never for a renewal, a fee invoice, a comp or a demo. The figures, the dates, the cancel and refund lines, the seller and the Terms line are added by the app below these words and cannot be changed here. {{opening}} is the app's opening for the case.$k$,
  $k$The details of your purchase: {{planLabel}}$k$,
  $k$The details of your purchase$k$,
  $k${{opening}}

This email is a summary of your purchase. Your invoice is the document to keep for your books, and it’s always on your billing page.$k$,
  NULL, NULL,
  '["orgName","planLabel","opening","billingUrl","invoiceUrl"]'::jsonb, 'billing'),

($k$yearly_renewal_reminder$k$, $k$Yearly renewal reminder$k$,
  $k$Sent by the daily job to every owner 30 to 37 days before a yearly plan's next charge (a renewal, a yearly trial ending, or a yearly next-season choice's first charge), once per charge date. The amount and its tax are Stripe's forecast of that charge. {{lead}} is the app's sentence with the date, the price and the tax; {{moveDownLine}} is empty unless the plan moves down on that date.$k$,
  $k${{subjectLine}}$k$,
  $k${{headingLine}}$k$,
  $k${{lead}}

{{moveDownLine}}

To keep it, there’s nothing to do. To stop it, cancel from your billing page before {{date}}; your plan stays active until then.$k$,
  $k$Your billing page$k$, $k${{billingUrl}}$k$,
  '["orgName","planLabel","date","subjectLine","headingLine","lead","moveDownLine","billingUrl"]'::jsonb, 'billing')
on conflict (key) do nothing;

COMMIT;
