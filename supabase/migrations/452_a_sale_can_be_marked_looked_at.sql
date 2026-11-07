-- ---------------------------------------------------------------
-- Migration 452 — GST/HST Stage 3 Part 3b: "Mark as looked at" (a sale that needs a look can be marked, with a why)
-- (build prompt docs/projects/active/GST_HST_STAGE3_PART3_BUILD_PROMPT.md §3b; drawing tab 5 of GST_HST_STAGE3_PART2_DRAWINGS.html;
-- owner Ask 6 = A, and the 2026-11-06 ruling that a mark holds by reason CODE plus a small fingerprint).
--
-- WHY: every "Needs a look" check is about a sale that already happened, so without a mark it stays on the list, the strip, the
-- dot and Today's count for good. A person looks, says what they found and did, and the sale leaves the list until a NEW problem
-- appears on it. The mark is kept BESIDE the tax records, never in them: platform_charge_tax_records stays exactly as Part 1
-- wrote it, and the GST/HST return counts a looked-at sale as it stands.
--
-- THE SHAPE: ONE append-only table, platform_charge_tax_looks.
--   · A MARK row (put_back_of IS NULL) names the sale (stripe_invoice_id), the reason KEYS it was made for (looked_keys: a reason
--     code, and for two codes a fingerprint — "rate_mismatch:AB", "refund_no_note:5000"), who (looked_by, an email), when and why.
--   · A PUT-BACK row (put_back_of = the mark it undoes) has no keys and its own why. Nothing is ever edited or deleted.
--   · after_id is the sale's newest row when this one was written, UNIQUE per sale: two people acting at once cannot both win
--     (the second finds the chain moved and is told so). A put-back can only undo the mark that is newest.
-- A sale is "looked at" only while every reason it has NOW is inside its newest mark's keys (lib/console-money-looks.ts).
--
-- ⚖ RETENTION: org_id is a PLAIN id with NO foreign key, on purpose (where the person was when they marked it): deleting a club
--   or a person deletes none of these rows. Nothing cascades from organizations or users.
-- ⚖ APPEND-ONLY: a guard trigger refuses every UPDATE and the DELETE of a live row (test-mode rows can be deleted, as the records can).
-- ⚖ NOT IN THE RETURN: no sum, export or report of tax reads this table (tests/unit/console-money-looks.test.ts).
-- Server-only (RLS on, no policies, service role only). Re-runnable. The migration writes no data.
-- Prod order: with the code that reads it (the Money tab's Needs a look and Today's Sales tax row read it); after 451.
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_charge_tax_looks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq                 bigint GENERATED ALWAYS AS IDENTITY,
  stripe_invoice_id   text NOT NULL CHECK (stripe_invoice_id ~ '^in_[A-Za-z0-9]+$'),
  livemode            boolean NOT NULL,
  org_id              uuid,
  looked_keys         text[] NOT NULL DEFAULT '{}'::text[],
  put_back_of         uuid REFERENCES public.platform_charge_tax_looks (id),
  after_id            uuid REFERENCES public.platform_charge_tax_looks (id),
  looked_by           text NOT NULL CHECK (length(looked_by) BETWEEN 3 AND 320),
  looked_at           timestamptz NOT NULL DEFAULT now(),
  why                 text NOT NULL CHECK (btrim(why) <> '' AND length(why) <= 500),
  -- A mark has keys; a put-back has none (and names the mark it undoes).
  CONSTRAINT platform_charge_tax_looks_shape CHECK ((put_back_of IS NULL) = (cardinality(looked_keys) > 0)),
  CONSTRAINT platform_charge_tax_looks_keys_shape CHECK (
    cardinality(looked_keys) = 0
    OR (cardinality(looked_keys) <= 8
        AND array_to_string(looked_keys, '|') ~ '^[a-z_]{1,40}(:[A-Za-z0-9_.-]{0,40})?(\|[a-z_]{1,40}(:[A-Za-z0-9_.-]{0,40})?)*$')),
  -- A put-back undoes the newest row, which is the one it was written after.
  CONSTRAINT platform_charge_tax_looks_put_back_is_newest CHECK (put_back_of IS NULL OR put_back_of = after_id),
  CONSTRAINT platform_charge_tax_looks_not_itself CHECK (after_id IS NULL OR after_id <> id)
);

CREATE INDEX IF NOT EXISTS platform_charge_tax_looks_invoice_idx ON public.platform_charge_tax_looks (stripe_invoice_id, seq DESC);
-- One writer wins: a sale's rows form a chain, and a row follows exactly one other.
CREATE UNIQUE INDEX IF NOT EXISTS platform_charge_tax_looks_chain_idx
  ON public.platform_charge_tax_looks (stripe_invoice_id, COALESCE(after_id, '00000000-0000-0000-0000-000000000000'::uuid));
-- A mark is undone at most once.
CREATE UNIQUE INDEX IF NOT EXISTS platform_charge_tax_looks_put_back_once_idx
  ON public.platform_charge_tax_looks (put_back_of) WHERE put_back_of IS NOT NULL;

-- ── append-only ───────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.platform_charge_tax_looks_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'A look at a sale is kept as it was made: undo it with a new row (%).', OLD.stripe_invoice_id;
  END IF;
  IF OLD.livemode THEN
    RAISE EXCEPTION 'A live look at a sale is kept and cannot be deleted (%).', OLD.stripe_invoice_id;
  END IF;
  RETURN OLD;
END $$;

REVOKE ALL ON FUNCTION public.platform_charge_tax_looks_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS platform_charge_tax_looks_guard ON public.platform_charge_tax_looks;
CREATE TRIGGER platform_charge_tax_looks_guard BEFORE UPDATE OR DELETE ON public.platform_charge_tax_looks
  FOR EACH ROW EXECUTE FUNCTION public.platform_charge_tax_looks_guard();

-- ── server only ───────────────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.platform_charge_tax_looks ENABLE ROW LEVEL SECURITY;
-- No policies: nothing but the service role reads or writes it (migration-table-grants-guard.test.ts).
REVOKE ALL ON TABLE public.platform_charge_tax_looks FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_charge_tax_looks TO service_role;

COMMENT ON TABLE public.platform_charge_tax_looks IS
  'GST/HST Stage 3 Part 3b (owner 2026-11-06, Ask 6): append-only "Mark as looked at" beside platform_charge_tax_records. A mark row (put_back_of NULL) says a person looked at this sale for these reason keys and why; a put-back row undoes the newest mark with its own why. A sale is looked at only while every reason it has now is inside its newest mark''s keys. Never read by anything that sums, exports or reports tax: the return counts the sale as it stands.';
COMMENT ON COLUMN public.platform_charge_tax_looks.seq IS 'Order within a sale (and overall): the newest row of a sale is the one with the highest seq.';
COMMENT ON COLUMN public.platform_charge_tax_looks.looked_keys IS 'The reason keys the mark was made for: a Needs-a-look reason code, plus a fingerprint for rate_mismatch (the province of the address kept with the sale) and refund_no_note (the amount refunded so far). Empty on a put-back.';
COMMENT ON COLUMN public.platform_charge_tax_looks.org_id IS 'The club record the person marked it from. A plain id, no foreign key on purpose: deleting the club keeps the mark.';
COMMENT ON COLUMN public.platform_charge_tax_looks.after_id IS 'The sale''s newest row when this one was written (NULL for its first). Unique per sale: the second of two simultaneous writers is refused.';
COMMENT ON COLUMN public.platform_charge_tax_looks.put_back_of IS 'The mark this row undoes (a put-back); NULL on a mark. A mark is undone at most once.';
COMMENT ON COLUMN public.platform_charge_tax_looks.looked_by IS 'The staff email that marked it or put it back.';
COMMENT ON COLUMN public.platform_charge_tax_looks.why IS 'What the person found and did (required, at most 500 characters, never a card number: the route refuses one).';

COMMIT;
