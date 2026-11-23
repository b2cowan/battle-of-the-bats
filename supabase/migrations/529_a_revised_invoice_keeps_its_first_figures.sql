-- 529 — A revised invoice keeps its first figures; the club's word for passing its GST/HST on (Board Ready Stage 6 Part 3a,
-- owner calls 6 and 8 at walk §562, 2026-11-23, each as recommended). Plan: docs/projects/active/BOARD_READY_PLAN.md §5 Stage 6.
--
-- What it adds:
--   1. On a deal: the invoice's FIRST figures (amount, tax and total as first issued), stamped by club_sponsor_deal_revise
--      the first time an invoice is revised and never again (call 6: "keep the original figures, so an invoice that was sent
--      and later changed can be traced"). NULL on an invoice never revised. The guard (mig 528) keeps them the function's alone.
--   2. The library's word "GST/HST remitted" (call 8: "so a remittance isn't counted as spending"), a money-out item under the
--      standard Admin category with a FIXED id the code names (lib/club-money-figures.ts GST_HST_REMITTED_ITEM_ID). Off every team's
--      picker (lib/coach-budget-item-tiers.ts CLUB_ONLY_ITEM_IDS); left out of every Budget vs. Actual figure and kept in Cash
--      on hand (lib/club-money-figures.ts countsAsActual), as the GST/HST collected is.
--
-- Re-runnable. ORDER: after 528 (it replaces 528's revise and guard functions).

BEGIN;

-- ── 1. The first figures ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.club_sponsor_deals
  ADD COLUMN IF NOT EXISTS original_amount     numeric(10,2),
  ADD COLUMN IF NOT EXISTS original_charge_tax boolean,
  ADD COLUMN IF NOT EXISTS original_tax_kind   text,
  ADD COLUMN IF NOT EXISTS original_tax_rate   numeric,
  ADD COLUMN IF NOT EXISTS original_tax_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS original_total      numeric(10,2);
ALTER TABLE public.club_sponsor_deals
  DROP CONSTRAINT IF EXISTS club_sponsor_deals_original_whole;
ALTER TABLE public.club_sponsor_deals
  -- Stamped together, and only on a revised invoice.
  ADD CONSTRAINT club_sponsor_deals_original_whole CHECK (
    (original_total IS NULL) = (original_amount IS NULL)
    AND (original_total IS NULL) = (original_charge_tax IS NULL)
    AND (original_total IS NULL OR revised_on IS NOT NULL));

COMMENT ON COLUMN public.club_sponsor_deals.original_amount IS
  'The invoice''s amount before tax as FIRST issued, kept when it was first revised (mig 529, owner call 6 at walk §562). NULL: never revised. Set only by club_sponsor_deal_revise.';
COMMENT ON COLUMN public.club_sponsor_deals.original_total IS
  'The invoice''s total as FIRST issued (with original_charge_tax, original_tax_kind, original_tax_rate, original_tax_amount). NULL: never revised. Set only by club_sponsor_deal_revise.';

-- ── The guard: 528's, with the first figures added to the columns only the functions write ────────────
CREATE OR REPLACE FUNCTION public.club_sponsor_deal_money_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_open boolean := coalesce(current_setting('flhq.sponsor_deal_money', true), '') = 'on';
BEGIN
  IF v_open THEN RETURN NEW; END IF;
  -- Paid, and the day it was paid, are the payment functions' alone.
  IF NEW.state = 'paid' AND OLD.state <> 'paid' THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_paid_by_a_payment_only';
  END IF;
  IF NEW.paid_on IS DISTINCT FROM OLD.paid_on OR NEW.revised_on IS DISTINCT FROM OLD.revised_on
     OR NEW.original_amount IS DISTINCT FROM OLD.original_amount OR NEW.original_charge_tax IS DISTINCT FROM OLD.original_charge_tax
     OR NEW.original_tax_kind IS DISTINCT FROM OLD.original_tax_kind OR NEW.original_tax_rate IS DISTINCT FROM OLD.original_tax_rate
     OR NEW.original_tax_amount IS DISTINCT FROM OLD.original_tax_amount OR NEW.original_total IS DISTINCT FROM OLD.original_total THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_money_columns';
  END IF;
  -- An issued invoice's figures change only as a revision.
  IF OLD.state IN ('invoiced', 'paid') AND (
       NEW.amount IS DISTINCT FROM OLD.amount OR NEW.charge_tax IS DISTINCT FROM OLD.charge_tax
    OR NEW.total IS DISTINCT FROM OLD.total OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
    OR NEW.tax_rate IS DISTINCT FROM OLD.tax_rate OR NEW.tax_kind IS DISTINCT FROM OLD.tax_kind) THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_invoice_figures';
  END IF;
  -- A paid deal leaves Paid only through a void; a deal with money on it is never withdrawn.
  IF OLD.state = 'paid' AND NEW.state <> 'paid' THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_unpaid_by_a_void_only';
  END IF;
  IF NEW.state = 'withdrawn' AND OLD.state <> 'withdrawn' AND EXISTS (
       SELECT 1 FROM club_sponsor_deal_payments p WHERE p.deal_id = OLD.id AND p.voided_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_has_a_payment';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_deal_money_guard() FROM PUBLIC, anon, authenticated;

-- ── The revised invoice: 528's, stamping the first figures the first time ─────────────────────────────
CREATE OR REPLACE FUNCTION public.club_sponsor_deal_revise(
  p_org uuid, p_deal uuid, p_amount numeric, p_charge_tax boolean, p_tax_kind text, p_tax_rate numeric,
  p_tax_amount numeric, p_total numeric, p_on date
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d club_sponsor_deals%ROWTYPE;
BEGIN
  SELECT * INTO d FROM club_sponsor_deals WHERE id = p_deal AND org_id = p_org FOR UPDATE;
  IF NOT FOUND OR d.state <> 'invoiced' THEN
    RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_deal_not_invoiced';
  END IF;
  IF EXISTS (SELECT 1 FROM club_sponsor_deal_payments WHERE deal_id = p_deal AND voided_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_has_a_payment';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 OR p_total IS NULL OR p_on IS NULL
     OR round(p_amount + coalesce(p_tax_amount, 0), 2) <> p_total THEN
    RAISE EXCEPTION USING ERRCODE = 'SP003', MESSAGE = 'club_sponsor_revision_refused';
  END IF;
  PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
  UPDATE club_sponsor_deals SET
    -- The first figures, kept the first time only: while the invoice was never revised, its figures ARE the first issue's.
    -- A second revision keeps them. An invoice revised before this migration has no first figures to keep (they were
    -- overwritten then), so it stays NULL rather than stamping its earlier revision as "first" (/review 2026-11-23).
    original_amount     = CASE WHEN d.revised_on IS NULL THEN d.amount     ELSE d.original_amount     END,
    original_charge_tax = CASE WHEN d.revised_on IS NULL THEN d.charge_tax ELSE d.original_charge_tax END,
    original_tax_kind   = CASE WHEN d.revised_on IS NULL THEN d.tax_kind   ELSE d.original_tax_kind   END,
    original_tax_rate   = CASE WHEN d.revised_on IS NULL THEN d.tax_rate   ELSE d.original_tax_rate   END,
    original_tax_amount = CASE WHEN d.revised_on IS NULL THEN d.tax_amount ELSE d.original_tax_amount END,
    original_total      = CASE WHEN d.revised_on IS NULL THEN d.total      ELSE d.original_total      END,
    amount = p_amount, charge_tax = p_charge_tax, tax_kind = p_tax_kind, tax_rate = p_tax_rate,
    tax_amount = p_tax_amount, total = p_total, revised_on = p_on, invoice_emailed_at = NULL, updated_at = now()
   WHERE id = p_deal;
  PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_deal_revise(uuid, uuid, numeric, boolean, text, numeric, numeric, numeric, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_deal_revise(uuid, uuid, numeric, boolean, text, numeric, numeric, numeric, date) TO service_role;

-- ── 2. The library word "GST/HST remitted" (a fixed id: lib/club-money-figures.ts names it)───────────────────
INSERT INTO public.budget_items (id, category_id, org_id, name, sort_order, is_default, is_misc, sports, direction, actual_source)
SELECT '5b0d0529-0529-4c1b-8a50-7ea0507c0001'::uuid, c.id, NULL, 'GST/HST remitted', 90, true, false, NULL, 'out', 'typed'
  FROM public.budget_categories c
 WHERE c.org_id IS NULL AND c.name = 'Admin'
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.budget_items WHERE id = '5b0d0529-0529-4c1b-8a50-7ea0507c0001') THEN
    RAISE EXCEPTION 'mig 529: the platform Admin category was not found, so GST/HST remitted was not added';
  END IF;
END $$;

COMMIT;
