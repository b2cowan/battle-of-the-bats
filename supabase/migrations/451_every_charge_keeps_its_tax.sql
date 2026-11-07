-- ---------------------------------------------------------------
-- Migration 451 — GST/HST Stage 3 Part 1: every invoice we issue keeps its tax, its reason and the buyer's evidence
-- (build prompt docs/projects/active/GST_HST_STAGE3_BUILD_PROMPT.md; plan GST_HST_COLLECTION_PLAN.md §4 Stage 3;
-- owner rulings 2026-11-06, Asks 1–5 as recommended; accounting topic RECORDS_RETENTION_AND_LOCATION.md).
--
-- WHY: until now a charge's tax lived only on Stripe's invoice and was re-read live; nothing kept WHY it was taxed or the
-- evidence used (the buyer's address, province, US declaration, card and payout country) at the moment of sale. The buyer's
-- `billing_locations` row is CURRENT (overwritten on a change) and deletes with the club or person (ON DELETE CASCADE), but
-- CRA needs six years of records. These two tables are written by us at the time and are kept.
--
-- THE SHAPE:
--   · platform_charge_tax_records — ONE row per Stripe INVOICE on our own account (Ask 1: tax is owed when the invoice is
--     ISSUED, paid or not, so the row is written at `invoice.finalized` and only its payment state moves after, each change
--     with its own date: a write-off's tax relief lands in the write-off's period). A club plan, a coach's own Premium, a
--     club's Stripe-fees invoice and a one-off invoice made in Stripe's dashboard all land here (Ask 4: `kind`).
--   · platform_credit_note_tax_records — ONE row per Stripe CREDIT NOTE (Ask 3): its own date, because a reduction counts in
--     the period the note is issued, not the invoice's. Positive amounts; Stage 4 subtracts.
--
-- ⚖ RETENTION: org_id and user_id are PLAIN ids with NO foreign key, on purpose (not even ON DELETE SET NULL): deleting a club
--   or a person deletes none of these rows and keeps whose they were. The buyer's name and address are COPIED onto the row.
-- ⚖ AS IT STOOD: a guard trigger refuses any change except the payment state (status, its dates, the payment, the refunded
--   figure). The evidence is never re-read later: a record whose evidence could not be read keeps `evidence_missing`.
-- ⚖ A LIVE record cannot be deleted (test-mode rows can, for fixtures and walks).
-- ⚖ Reason (Ask 2, revised after the Part 0 probe): Stripe never says "zero-rated" for a US buyer; it names the US state it is
--   not collecting in. So `gst_hst_position` is OUR answer for Canadian GST/HST (taxed / zero_rated / missing, with why), and
--   `tax_lines` keeps every Stripe tax line verbatim (with its own taxability_reason), plus our 0% Canadian line on a
--   zero-rated sale (source 'ours') so Stage 4 can total zero-rated sales on their own line.
--
-- ⚖ BACKFILL (owner 2026-11-06, Stage 4 Ask 11 = A, replacing Stage 3 Ask 5's "none"): the daily online-payments job copies every
--   invoice and credit note Stripe holds from 2026-05-01 (the registration date with CRA's pending backdate) up to the first record the
--   webhook wrote, through the same builder; such a row says `evidence_captured = 'backfill'` (its evidence was read then, not at sale).
-- ⚖ CURRENCY (owner 2026-11-06, Stage 4 Ask 4 = A): a non-CAD sale is valued at the Bank of Canada daily rate on its issue date
--   (prior business day when none; CRA Memo 3-6 / ETA s.159); the CAD figures sit beside the original ones and are set ONCE. Stripe's
--   own CAD figure is a cross-check only. A CAD sale carries itself (rate 1, `same_currency`), so Stage 4 always sums the cad_* columns.
-- Server-only (RLS on, no policies, service role only). Re-runnable. The migration itself writes no data.
-- Prod order: before the promote that ships Stage 3 Part 1's code (the billing webhook writes these tables).
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. one row per invoice ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_charge_tax_records (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_invoice_id         text NOT NULL UNIQUE CHECK (stripe_invoice_id ~ '^in_[A-Za-z0-9]+$'),
  livemode                  boolean NOT NULL,
  kind                      text NOT NULL CHECK (kind IN ('subscription', 'premium', 'fee', 'one_off')),
  org_id                    uuid,
  user_id                   uuid,
  buyer_kind                text NOT NULL CHECK (buyer_kind IN ('club', 'person', 'unknown')),
  buyer_name                text CHECK (buyer_name IS NULL OR length(buyer_name) <= 300),
  stripe_customer_id        text NOT NULL CHECK (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  stripe_subscription_id    text CHECK (stripe_subscription_id IS NULL OR stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  stripe_payment_intent_id  text CHECK (stripe_payment_intent_id IS NULL OR stripe_payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
  invoice_number            text CHECK (invoice_number IS NULL OR length(invoice_number) BETWEEN 1 AND 64),
  issued_at                 timestamptz NOT NULL,
  currency                  text NOT NULL CHECK (currency ~ '^[a-z]{3}$'),
  amount_before_tax_cents   integer NOT NULL,
  tax_total_cents           integer NOT NULL,
  total_cents               integer NOT NULL,
  tax_lines                 jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tax_lines) = 'array'),
  stripe_tax_status         text CHECK (stripe_tax_status IS NULL OR stripe_tax_status IN ('complete', 'requires_location_inputs', 'failed')),
  gst_hst_position          text NOT NULL CHECK (gst_hst_position IN ('taxed', 'zero_rated', 'missing')),
  gst_hst_position_why      text CHECK (gst_hst_position_why IS NULL OR gst_hst_position_why IN (
                              'stripe_did_not_work_out', 'canadian_buyer_not_charged', 'no_evidence_for_zero_rating', 'unexpected_reason')),
  taxed_country             text CHECK (taxed_country IS NULL OR taxed_country ~ '^[A-Z]{2}$'),
  taxed_region              text CHECK (taxed_region IS NULL OR length(taxed_region) <= 100),
  taxed_postal_code         text CHECK (taxed_postal_code IS NULL OR length(taxed_postal_code) <= 20),
  evidence_missing          boolean NOT NULL,
  evidence_country          text CHECK (evidence_country IS NULL OR evidence_country ~ '^[A-Z]{2}$'),
  evidence_region           text CHECK (evidence_region IS NULL OR length(evidence_region) <= 10),
  evidence_line1            text,
  evidence_line2            text,
  evidence_city             text,
  evidence_postal_code      text,
  evidence_confirmed_at     timestamptz,
  us_declaration_version    text,
  us_declaration_at         timestamptz,
  card_country              text CHECK (card_country IS NULL OR card_country ~ '^[A-Z]{2}$'),
  payout_country            text CHECK (payout_country IS NULL OR payout_country ~ '^[A-Z]{2}$'),
  review_reason             text,
  review_note               text,
  evidence_read_at          timestamptz NOT NULL,
  evidence_captured         text NOT NULL CHECK (evidence_captured IN ('event', 'catch_up', 'backfill')),
  fx_rate                   numeric(14,8) CHECK (fx_rate IS NULL OR fx_rate > 0),
  fx_rate_date              date,
  fx_source                 text CHECK (fx_source IS NULL OR fx_source IN ('same_currency', 'bank_of_canada')),
  cad_amount_before_tax_cents integer,
  cad_tax_total_cents       integer,
  cad_total_cents           integer,
  stripe_cad_total_cents    integer,
  status                    text NOT NULL CHECK (status IN ('open', 'paid', 'void', 'uncollectible')),
  paid_at                   timestamptz,
  voided_at                 timestamptz,
  uncollectible_at          timestamptz,
  refunded_cents            integer NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_charge_tax_records_why_shape CHECK ((gst_hst_position = 'missing') = (gst_hst_position_why IS NOT NULL)),
  CONSTRAINT platform_charge_tax_records_evidence_shape CHECK (evidence_missing OR evidence_country IS NOT NULL),
  CONSTRAINT platform_charge_tax_records_buyer_shape CHECK (
    (buyer_kind = 'club' AND org_id IS NOT NULL) OR (buyer_kind = 'person' AND user_id IS NOT NULL) OR buyer_kind = 'unknown'),
  -- The CAD valuation is all there or all absent (absent = a non-CAD sale whose rate could not be read yet); a CAD sale is itself.
  CONSTRAINT platform_charge_tax_records_fx_shape CHECK (
    (fx_rate IS NULL) = (fx_rate_date IS NULL) AND (fx_rate IS NULL) = (fx_source IS NULL)
    AND (fx_rate IS NULL) = (cad_total_cents IS NULL) AND (fx_rate IS NULL) = (cad_amount_before_tax_cents IS NULL)
    AND (fx_rate IS NULL) = (cad_tax_total_cents IS NULL)),
  CONSTRAINT platform_charge_tax_records_cad_is_itself CHECK (currency <> 'cad' OR (fx_source IS NOT DISTINCT FROM 'same_currency' AND fx_rate IS NOT DISTINCT FROM 1))
);

CREATE INDEX IF NOT EXISTS platform_charge_tax_records_org_idx ON public.platform_charge_tax_records (org_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS platform_charge_tax_records_user_idx ON public.platform_charge_tax_records (user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS platform_charge_tax_records_period_idx ON public.platform_charge_tax_records (livemode, issued_at);
CREATE INDEX IF NOT EXISTS platform_charge_tax_records_customer_idx ON public.platform_charge_tax_records (stripe_customer_id);

-- ── 2. one row per credit note ────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_credit_note_tax_records (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_credit_note_id     text NOT NULL UNIQUE CHECK (stripe_credit_note_id ~ '^cn_[A-Za-z0-9]+$'),
  stripe_invoice_id         text NOT NULL CHECK (stripe_invoice_id ~ '^in_[A-Za-z0-9]+$'),
  livemode                  boolean NOT NULL,
  kind                      text CHECK (kind IS NULL OR kind IN ('subscription', 'premium', 'fee', 'one_off')),
  org_id                    uuid,
  user_id                   uuid,
  stripe_customer_id        text NOT NULL CHECK (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  note_number               text CHECK (note_number IS NULL OR length(note_number) BETWEEN 1 AND 64),
  note_type                 text NOT NULL CHECK (note_type IN ('pre_payment', 'post_payment', 'mixed')),
  stripe_reason             text CHECK (stripe_reason IS NULL OR stripe_reason ~ '^[a-z_]{1,64}$'),
  issued_at                 timestamptz NOT NULL,
  currency                  text NOT NULL CHECK (currency ~ '^[a-z]{3}$'),
  amount_before_tax_cents   integer NOT NULL,
  tax_total_cents           integer NOT NULL,
  total_cents               integer NOT NULL,
  tax_lines                 jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tax_lines) = 'array'),
  refund_cents              integer NOT NULL DEFAULT 0 CHECK (refund_cents >= 0),
  out_of_band_cents         integer NOT NULL DEFAULT 0 CHECK (out_of_band_cents >= 0),
  evidence_captured         text NOT NULL CHECK (evidence_captured IN ('event', 'catch_up', 'backfill')),
  fx_rate                   numeric(14,8) CHECK (fx_rate IS NULL OR fx_rate > 0),
  fx_rate_date              date,
  fx_source                 text CHECK (fx_source IS NULL OR fx_source IN ('same_currency', 'bank_of_canada')),
  cad_amount_before_tax_cents integer,
  cad_tax_total_cents       integer,
  cad_total_cents           integer,
  status                    text NOT NULL CHECK (status IN ('issued', 'void')),
  voided_at                 timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_credit_note_tax_records_void_shape CHECK ((status = 'void') = (voided_at IS NOT NULL)),
  CONSTRAINT platform_credit_note_tax_records_fx_shape CHECK (
    (fx_rate IS NULL) = (fx_rate_date IS NULL) AND (fx_rate IS NULL) = (fx_source IS NULL)
    AND (fx_rate IS NULL) = (cad_total_cents IS NULL) AND (fx_rate IS NULL) = (cad_amount_before_tax_cents IS NULL)
    AND (fx_rate IS NULL) = (cad_tax_total_cents IS NULL)),
  CONSTRAINT platform_credit_note_tax_records_cad_is_itself CHECK (currency <> 'cad' OR (fx_source IS NOT DISTINCT FROM 'same_currency' AND fx_rate IS NOT DISTINCT FROM 1))
);

CREATE INDEX IF NOT EXISTS platform_credit_note_tax_records_invoice_idx ON public.platform_credit_note_tax_records (stripe_invoice_id);
CREATE INDEX IF NOT EXISTS platform_credit_note_tax_records_org_idx ON public.platform_credit_note_tax_records (org_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS platform_credit_note_tax_records_user_idx ON public.platform_credit_note_tax_records (user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS platform_credit_note_tax_records_period_idx ON public.platform_credit_note_tax_records (livemode, issued_at);

-- ── 2b. what Stripe's dashboard can type never refuses a record (/review 2026-11-06) ─────────────────────────────────────
-- A one-off invoice made by hand can carry a custom number and a province spelled out ("British Columbia"); a CHECK that
-- refused either would leave that sale with no tax record at all. Re-stated here so a table made by an earlier run of this
-- migration (dev) takes the same shape as a fresh one.
ALTER TABLE public.platform_charge_tax_records
  DROP CONSTRAINT IF EXISTS platform_charge_tax_records_invoice_number_check,
  DROP CONSTRAINT IF EXISTS platform_charge_tax_records_taxed_region_check,
  ADD CONSTRAINT platform_charge_tax_records_invoice_number_check CHECK (invoice_number IS NULL OR length(invoice_number) BETWEEN 1 AND 64),
  ADD CONSTRAINT platform_charge_tax_records_taxed_region_check CHECK (taxed_region IS NULL OR length(taxed_region) <= 100);
ALTER TABLE public.platform_credit_note_tax_records
  DROP CONSTRAINT IF EXISTS platform_credit_note_tax_records_note_number_check,
  ADD CONSTRAINT platform_credit_note_tax_records_note_number_check CHECK (note_number IS NULL OR length(note_number) BETWEEN 1 AND 64);

-- ── 3. what was recorded stays recorded ───────────────────────────────────────────────────────────────────────────────
-- Only the payment state moves. Compared as jsonb with the movable columns taken out, so a column added later is frozen by
-- default (it must be named here to become movable).
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
                            'fx_rate', 'fx_rate_date', 'fx_source', 'cad_amount_before_tax_cents', 'cad_tax_total_cents', 'cad_total_cents', 'stripe_cad_total_cents'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status', 'paid_at', 'voided_at', 'uncollectible_at', 'stripe_payment_intent_id', 'refunded_cents', 'updated_at',
                            'fx_rate', 'fx_rate_date', 'fx_source', 'cad_amount_before_tax_cents', 'cad_tax_total_cents', 'cad_total_cents', 'stripe_cad_total_cents']) THEN
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

CREATE OR REPLACE FUNCTION public.platform_credit_note_tax_records_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.livemode THEN
      RAISE EXCEPTION 'A live credit note''s tax record is kept for six years and cannot be deleted (%).', OLD.stripe_credit_note_id;
    END IF;
    RETURN OLD;
  END IF;
  IF (to_jsonb(NEW) - ARRAY['status', 'voided_at', 'updated_at', 'fx_rate', 'fx_rate_date', 'fx_source', 'cad_amount_before_tax_cents', 'cad_tax_total_cents', 'cad_total_cents'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status', 'voided_at', 'updated_at', 'fx_rate', 'fx_rate_date', 'fx_source', 'cad_amount_before_tax_cents', 'cad_tax_total_cents', 'cad_total_cents']) THEN
    RAISE EXCEPTION 'A credit note''s tax record keeps what it recorded when the note was issued: only a void changes it (%).', OLD.stripe_credit_note_id;
  END IF;
  IF OLD.fx_rate IS NOT NULL AND (NEW.fx_rate, NEW.fx_rate_date, NEW.fx_source, NEW.cad_amount_before_tax_cents, NEW.cad_tax_total_cents, NEW.cad_total_cents)
     IS DISTINCT FROM (OLD.fx_rate, OLD.fx_rate_date, OLD.fx_source, OLD.cad_amount_before_tax_cents, OLD.cad_tax_total_cents, OLD.cad_total_cents) THEN
    RAISE EXCEPTION 'A credit note''s CAD valuation is set once (%).', OLD.stripe_credit_note_id;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.platform_charge_tax_records_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_credit_note_tax_records_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS platform_charge_tax_records_guard ON public.platform_charge_tax_records;
CREATE TRIGGER platform_charge_tax_records_guard BEFORE UPDATE OR DELETE ON public.platform_charge_tax_records
  FOR EACH ROW EXECUTE FUNCTION public.platform_charge_tax_records_guard();
DROP TRIGGER IF EXISTS platform_credit_note_tax_records_guard ON public.platform_credit_note_tax_records;
CREATE TRIGGER platform_credit_note_tax_records_guard BEFORE UPDATE OR DELETE ON public.platform_credit_note_tax_records
  FOR EACH ROW EXECUTE FUNCTION public.platform_credit_note_tax_records_guard();

-- ── 4. server only ────────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.platform_charge_tax_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_credit_note_tax_records ENABLE ROW LEVEL SECURITY;
-- No policies: nothing but the service role reads or writes them (migration-table-grants-guard.test.ts).
REVOKE ALL ON TABLE public.platform_charge_tax_records FROM anon, authenticated;
REVOKE ALL ON TABLE public.platform_credit_note_tax_records FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_charge_tax_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_credit_note_tax_records TO service_role;

-- ── 5. what each column means ─────────────────────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE public.platform_charge_tax_records IS
  'GST/HST Stage 3 (owner 2026-11-06): one row per Stripe invoice FieldLogicHQ issues on its own account (club plan, coach Premium, a club''s Stripe-fees invoice, a one-off), written by the billing webhook from invoice.finalized (and any later invoice event, idempotent), with the tax, OUR GST/HST reason and the buyer''s evidence AS IT STOOD. Kept six years: no FK to the club or person, a live row cannot be deleted, only the payment state changes (platform_charge_tax_records_guard). Stage 4 sums it by issued_at.';
COMMENT ON COLUMN public.platform_charge_tax_records.kind IS
  'subscription = a club''s (or any organization''s) plan; premium = a coach''s own Premium (the buyer is a PERSON); fee = a club''s own Stripe-fees invoice (metadata fieldlogichq_fee_invoice_id); one_off = an invoice with no subscription and no fee marker (made in Stripe''s dashboard).';
COMMENT ON COLUMN public.platform_charge_tax_records.org_id IS
  'The organization the invoice belongs to (a club, or a coach''s portal for Premium), as a PLAIN id: no foreign key on purpose, so deleting the club keeps the record and whose it was. NULL when no single organization matched.';
COMMENT ON COLUMN public.platform_charge_tax_records.user_id IS
  'For Premium, the coach who pays as a person (team_workspaces.billing_owner_user_id). Plain id, no foreign key on purpose.';
COMMENT ON COLUMN public.platform_charge_tax_records.buyer_name IS 'The name printed on the invoice (Stripe''s customer_name at issue), as it stood.';
COMMENT ON COLUMN public.platform_charge_tax_records.issued_at IS 'When Stripe finalized the invoice (status_transitions.finalized_at): the date GST/HST becomes owed (ETA s.168, s.152).';
COMMENT ON COLUMN public.platform_charge_tax_records.amount_before_tax_cents IS 'Stripe''s total_excluding_tax (after discounts): the consideration the tax sits on, and what revenue counts. May be negative (a proration credit).';
COMMENT ON COLUMN public.platform_charge_tax_records.tax_total_cents IS 'The sum of the invoice''s total_taxes amounts.';
COMMENT ON COLUMN public.platform_charge_tax_records.tax_lines IS
  'Every tax Stripe looked at, from total_taxes with each rate read: [{source: stripe|ours, name, tax_type, jurisdiction, jurisdiction_level, country, region, rate, effective_rate, taxable_cents, cents, taxability_reason, tax_rate_id, tax_behavior}]. A Stripe HST line names "Canada", never the province: the place is taxed_region. source ours = our 0% Canadian line on a zero-rated sale (Stripe shows no Canadian line for a US buyer).';
COMMENT ON COLUMN public.platform_charge_tax_records.stripe_tax_status IS 'Stripe''s automatic_tax.status on the invoice; NULL = automatic tax was off.';
COMMENT ON COLUMN public.platform_charge_tax_records.gst_hst_position IS
  'OUR answer for Canadian GST/HST: taxed (a Canadian GST or HST line Stripe rated), zero_rated (Stripe''s own zero rate, or a buyer placed outside Canada whose evidence is a US address with the US declaration: our call, ETA Sch. VI Part V), missing (see gst_hst_position_why). Worked out in lib/charge-tax-record.ts.';
COMMENT ON COLUMN public.platform_charge_tax_records.gst_hst_position_why IS
  'Only when missing: stripe_did_not_work_out (automatic tax off or not complete), canadian_buyer_not_charged (placed in Canada, no rated GST/HST line: e.g. a live account with no registration), no_evidence_for_zero_rating (placed outside Canada without a US address + declaration on our records), unexpected_reason (a Canadian line with a reason we do not map).';
COMMENT ON COLUMN public.platform_charge_tax_records.taxed_country IS 'Where Stripe placed the buyer: the invoice''s own customer_address (with taxed_region, taxed_postal_code), as Stripe taxed it.';
COMMENT ON COLUMN public.platform_charge_tax_records.evidence_missing IS 'True when no billing address of ours could be read for the buyer when the record was written (no row, or the buyer could not be matched). Never filled in later.';
COMMENT ON COLUMN public.platform_charge_tax_records.evidence_country IS 'A COPY of the buyer''s billing_locations row when the record was written (with the other evidence_* columns, us_declaration_*), never a link to it.';
COMMENT ON COLUMN public.platform_charge_tax_records.card_country IS 'The card country on the buyer''s row when the record was written (billing_locations.card_country).';
COMMENT ON COLUMN public.platform_charge_tax_records.payout_country IS 'A club''s verified payout country when the record was written (org_payment_accounts.country, a connected account only).';
COMMENT ON COLUMN public.platform_charge_tax_records.review_reason IS 'The "needs review" answer worked out when the record was written (currentReview: the stored flag, or the card/payout evidence), with review_note its sentence. NULL = nothing to review.';
COMMENT ON COLUMN public.platform_charge_tax_records.status IS 'Stripe''s invoice status: open, paid, void, uncollectible. The only column (with its dates, the payment and refunded_cents) that changes after the row is written.';
COMMENT ON COLUMN public.platform_charge_tax_records.uncollectible_at IS 'When it was written off: a write-off''s tax relief belongs to that period (UNPAID_SUBSCRIPTION_INVOICES.md step 3), not the issue period.';
COMMENT ON COLUMN public.platform_charge_tax_records.refunded_cents IS 'What has been refunded on the payment so far (charge.amount_refunded, from charge.refunded). Compared with the credit notes, it finds a refund made with no credit note (tax not reduced).';

COMMENT ON COLUMN public.platform_charge_tax_records.evidence_captured IS
  'How the record (and so its evidence) was captured: event = the billing webhook (or a note maker) at the time; catch_up = the daily job, for a missed event within 35 days; backfill = the one-time copy of invoices issued from 2026-05-01 before the writer existed (owner, Stage 4 Ask 11). Only event is evidence as at the sale.';
COMMENT ON COLUMN public.platform_charge_tax_records.fx_rate IS
  'CAD per unit of the invoice currency (Stage 4 Ask 4): 1 for a CAD sale (fx_source same_currency); else the Bank of Canada daily rate (fx_source bank_of_canada) for fx_rate_date = the issue date, or the prior business day. NULL with every cad_* column = a non-CAD sale not yet valued. Set once.';
COMMENT ON COLUMN public.platform_charge_tax_records.cad_amount_before_tax_cents IS 'The CAD valuation of amount_before_tax_cents (with cad_tax_total_cents, cad_total_cents): the figures the GST/HST return worksheet sums. Rounded half away from zero, per figure.';
COMMENT ON COLUMN public.platform_charge_tax_records.stripe_cad_total_cents IS 'Stripe''s own CAD figure for a non-CAD paid invoice (the settlement balance transaction), a CROSS-CHECK only, never the return figure (its filing amounts can be blank on zero-rated rows). Set once.';

COMMENT ON TABLE public.platform_credit_note_tax_records IS
  'GST/HST Stage 3 (owner 2026-11-06, Ask 3): one row per Stripe credit note on our own invoices, with its tax by line and its own issue date (a reduction counts in the period the note is issued). Written from credit_note.* events and directly by the two places that make notes (the console refund, the fee credit), keyed by the note id so neither double-writes. Kept six years like platform_charge_tax_records; amounts are POSITIVE (Stage 4 subtracts).';
COMMENT ON COLUMN public.platform_credit_note_tax_records.note_type IS 'Stripe''s type: pre_payment (reduces what is owed), post_payment (after payment: refunded, credited or out of band), mixed.';
COMMENT ON COLUMN public.platform_credit_note_tax_records.refund_cents IS 'The part paid back to the card (the sum of the note''s refunds).';
COMMENT ON COLUMN public.platform_credit_note_tax_records.out_of_band_cents IS 'The part settled outside Stripe.';
COMMENT ON COLUMN public.platform_credit_note_tax_records.org_id IS 'Copied from the invoice''s record (or matched from the customer). Plain id, no foreign key on purpose.';
COMMENT ON COLUMN public.platform_credit_note_tax_records.fx_rate IS 'As on platform_charge_tax_records, valued on the NOTE''s issue date (the day the reduction is made; /accounting to confirm vs the invoice''s rate). Set once.';
COMMENT ON COLUMN public.platform_credit_note_tax_records.evidence_captured IS 'event = written at the time (the webhook or a note maker); catch_up = the daily job; backfill = the one-time copy from 2026-05-01.';

COMMIT;
