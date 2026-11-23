-- ---------------------------------------------------------------
-- Migration 526 — Board Ready Stage 6, Part 2: a club offers a sponsorship deal, the business answers on its link, and
-- choosing a cheque or e-transfer issues the invoice at once.
-- (Build prompt docs/projects/active/BOARD_READY_STAGE6_SPONSORSHIPS_BUILD_PROMPT.md Part 2; plan BOARD_READY_PLAN.md §5
-- Stage 6, round 1 asks 4, 5, 6, 7, 13 and Part 2's four owner calls, all ruled 2026-11-22; /legal's review
-- docs/agents/legal/BOARD_READY_STAGE6_SPONSORSHIPS_DRAWING_REVIEW.md §1–2.)
--
-- WHAT CHANGES
--   club_sponsor_deals       NEW. A business + a package + where it shows + an amount. The package's name, items and logo
--                            switch are KEPT on the deal as offered (an archived or changed package never changes a deal).
--                            state follows the money (ask 4): offered → form_received → invoiced → paid, or withdrawn
--                            (Delivered = paid and every item ticked, worked out, never stored). link_version stops an old
--                            link ("Send the link again"). The business's details from its link are kept on the deal as
--                            sent (the invoice's facts) AND written to the one business record (ask 1). The invoice number
--                            is given the moment a cheque or e-transfer is chosen (owner call (a)): {year}-{seq} per club,
--                            from a counter, so a number is never reused. A deal is never deleted while its business
--                            exists (the business can't be removed once it has one: its offers and invoices stay).
--   club_sponsor_deal_items  NEW. The delivery checklist's ticks (item id, or 'logo' for the logo line), with who ticked it
--                            (a name kept as it was).
--   club_sponsor_offers      NEW. Every offer EMAIL sent: the address, the reason picked, its date, who sent it (a name
--                            snapshot), the club — what CASL makes the sender prove (/legal §1). Insert-only. Outlives the
--                            deal and the business (deal_id goes null, the row stays).
--   club_sponsor_offer_stops NEW. An address that unsubscribed from this club's sponsorship offers, or that the club marked
--                            "Do not offer again" (a stop said by reply or phone). Per club, per address, sponsorship offers
--                            only. Insert-only: no seat at the club can clear one (ask 13).
--   club_sponsor_invoice_counters NEW. The last invoice number given per club and year.
--   club_sponsor_places.deal_id   gains its foreign key (cascade: a deal's place goes with it), one place per deal.
--   club_form_files / club_form_answers / club_form_ticks / club_form_answer_clears.subject_table   WIDENED to
--                            'club_sponsor_deals': a business's answers, files and document ticks are about its deal.
--   club_sponsor_deal_gone() NEW trigger: a deal's answers, ticks, files and submission go with it (the deal's own twin of
--                            club_form_subject_gone, which reads a registration's columns), and its waiting logo is queued
--                            for removal.
--   club_sponsor_deal_receive() NEW RPC: what the business sends from its link, in one transaction — the business record,
--                            the deal's copy, its answers, files and ticks, and (cheque or e-transfer) the invoice number.
--
-- RLS on, no policies, nothing to anon/authenticated: the server reads and writes (service role), as the club money tables.
-- The offers and the stops are granted SELECT and INSERT only. Re-runnable.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. Deals ───────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_sponsor_deals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sponsor_id        uuid NOT NULL REFERENCES public.club_sponsors(id) ON DELETE RESTRICT,
  package_id        uuid NOT NULL REFERENCES public.club_sponsorship_packages(id) ON DELETE RESTRICT,
  -- The package as offered.
  package_name      text NOT NULL CHECK (char_length(btrim(package_name)) BETWEEN 1 AND 80),
  package_items     jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(package_items) = 'array' AND jsonb_array_length(package_items) <= 20),
  logo_on_site      boolean NOT NULL,
  -- Where it shows (ask 6: the package's kind; the deal picks which one). target_name is the name as picked, kept for a
  -- division or team deleted later.
  place_kind        text NOT NULL CHECK (place_kind IN ('club', 'division', 'team', 'tournament')),
  target_id         uuid,
  target_name       text CHECK (target_name IS NULL OR char_length(target_name) BETWEEN 1 AND 200),
  ends_on           date,
  amount            numeric(10,2) NOT NULL CHECK (amount >= 0 AND amount <= 1000000),
  charge_tax        boolean NOT NULL DEFAULT false,
  state             text NOT NULL DEFAULT 'offered' CHECK (state IN ('offered', 'form_received', 'invoiced', 'paid', 'withdrawn')),
  link_version      integer NOT NULL DEFAULT 0 CHECK (link_version >= 0),
  -- Offered: the club day it was offered (its fiscal year, round 1 tab 5), who offered it (a name kept as it was), and the
  -- address it went to. emailed_at null = "Make the link only" (owner call (c)): nothing was sent.
  offered_on        date NOT NULL,
  offered_at        timestamptz NOT NULL DEFAULT now(),
  offered_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  offered_by_name   text NOT NULL CHECK (char_length(btrim(offered_by_name)) BETWEEN 1 AND 120),
  offered_to        text CHECK (offered_to IS NULL OR (char_length(offered_to) BETWEEN 3 AND 254 AND offered_to = lower(offered_to))),
  emailed_at        timestamptz,
  opened_at         timestamptz,
  -- What the business sent from its link, as sent (the invoice reads these).
  form_at           timestamptz,
  business_name     text CHECK (business_name IS NULL OR char_length(btrim(business_name)) BETWEEN 1 AND 80),
  contact_name      text CHECK (contact_name IS NULL OR char_length(btrim(contact_name)) BETWEEN 1 AND 120),
  contact_email     text CHECK (contact_email IS NULL OR char_length(contact_email) BETWEEN 3 AND 254),
  phone             text CHECK (phone IS NULL OR char_length(btrim(phone)) BETWEEN 1 AND 40),
  website           text CHECK (website IS NULL OR (website ~ '^https://' AND char_length(website) <= 500)),
  invoice_street    text CHECK (invoice_street IS NULL OR char_length(btrim(invoice_street)) BETWEEN 1 AND 200),
  invoice_city      text CHECK (invoice_city IS NULL OR char_length(btrim(invoice_city)) BETWEEN 1 AND 100),
  invoice_province  text CHECK (invoice_province IS NULL OR invoice_province ~ '^[A-Z]{2}$'),
  invoice_postal    text CHECK (invoice_postal IS NULL OR char_length(btrim(invoice_postal)) BETWEEN 1 AND 20),
  -- The logo sent on the link, held PRIVATE (club-form-files) until the deal's place shows (Part 2 scope: "a public link
  -- only once the place shows").
  logo_path         text CHECK (logo_path IS NULL OR char_length(logo_path) BETWEEN 1 AND 500),
  logo_sent_at      timestamptz,
  -- The invoice (owner call (a)): its number and figures, fixed when it is issued.
  pay_method        text CHECK (pay_method IS NULL OR pay_method IN ('cheque_etransfer', 'card')),
  invoice_year      integer CHECK (invoice_year IS NULL OR invoice_year BETWEEN 2000 AND 2199),
  invoice_seq       integer CHECK (invoice_seq IS NULL OR invoice_seq > 0),
  invoiced_at       timestamptz,
  invoiced_on       date,
  due_on            date,
  tax_kind          text CHECK (tax_kind IS NULL OR tax_kind IN ('GST', 'HST')),
  tax_rate          numeric(5,3) CHECK (tax_rate IS NULL OR (tax_rate >= 0 AND tax_rate < 100)),
  tax_amount        numeric(10,2) CHECK (tax_amount IS NULL OR tax_amount >= 0),
  total             numeric(10,2) CHECK (total IS NULL OR total >= 0),
  -- Withdrawn (until paid, ask 4), with the reason and who (a name kept as it was).
  withdrawn_at      timestamptz,
  withdrawn_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  withdrawn_by_name text CHECK (withdrawn_by_name IS NULL OR char_length(btrim(withdrawn_by_name)) BETWEEN 1 AND 120),
  withdrawn_reason  text CHECK (withdrawn_reason IS NULL OR char_length(btrim(withdrawn_reason)) BETWEEN 1 AND 300),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_sponsor_deals_target CHECK ((place_kind = 'club') = (target_id IS NULL)),
  CONSTRAINT club_sponsor_deals_emailed_to CHECK (emailed_at IS NULL OR offered_to IS NOT NULL),
  CONSTRAINT club_sponsor_deals_invoice_whole CHECK (
    (invoice_seq IS NULL) = (invoice_year IS NULL) AND (invoice_seq IS NULL) = (invoiced_at IS NULL)
    AND (invoice_seq IS NULL) = (total IS NULL) AND (invoice_seq IS NULL) = (due_on IS NULL)),
  CONSTRAINT club_sponsor_deals_invoiced_numbered CHECK (state NOT IN ('invoiced', 'paid') OR invoice_seq IS NOT NULL),
  CONSTRAINT club_sponsor_deals_tax_whole CHECK ((tax_kind IS NULL) = (tax_rate IS NULL) AND (tax_kind IS NULL) = (tax_amount IS NULL)),
  CONSTRAINT club_sponsor_deals_withdrawn_whole CHECK (
    (state = 'withdrawn') = (withdrawn_at IS NOT NULL) AND (withdrawn_at IS NULL OR (withdrawn_by_name IS NOT NULL AND withdrawn_reason IS NOT NULL)))
);
CREATE INDEX IF NOT EXISTS club_sponsor_deals_org_idx ON public.club_sponsor_deals (org_id, offered_on);
CREATE INDEX IF NOT EXISTS club_sponsor_deals_sponsor_idx ON public.club_sponsor_deals (sponsor_id);
CREATE INDEX IF NOT EXISTS club_sponsor_deals_package_idx ON public.club_sponsor_deals (package_id);
CREATE INDEX IF NOT EXISTS club_sponsor_deals_target_idx ON public.club_sponsor_deals (org_id, place_kind, target_id);
CREATE UNIQUE INDEX IF NOT EXISTS club_sponsor_deals_invoice_uniq ON public.club_sponsor_deals (org_id, invoice_year, invoice_seq)
  WHERE invoice_seq IS NOT NULL;

-- ── 2. The delivery checklist ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_sponsor_deal_items (
  deal_id       uuid NOT NULL REFERENCES public.club_sponsor_deals(id) ON DELETE CASCADE,
  item_id       text NOT NULL CHECK (item_id ~ '^[\w-]{1,64}$'),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  done_at       timestamptz NOT NULL DEFAULT now(),
  done_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  done_by_name  text NOT NULL CHECK (char_length(btrim(done_by_name)) BETWEEN 1 AND 120),
  PRIMARY KEY (deal_id, item_id)
);
CREATE INDEX IF NOT EXISTS club_sponsor_deal_items_org_idx ON public.club_sponsor_deal_items (org_id);

-- ── 3. Every offer email sent (the CASL record) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_sponsor_offers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_id        uuid REFERENCES public.club_sponsor_deals(id) ON DELETE SET NULL,
  business_name  text NOT NULL CHECK (char_length(btrim(business_name)) BETWEEN 1 AND 80),
  email          text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254 AND email = lower(email)),
  -- The four reasons /legal allows (s.10(9)–(10)); referral is not offered in the first version.
  reason         text NOT NULL CHECK (reason IN ('paid_recently', 'asked_recently', 'gave_address', 'published_address')),
  reason_on      date NOT NULL,
  kind           text NOT NULL DEFAULT 'offer' CHECK (kind IN ('offer', 'again')),
  sent_at        timestamptz NOT NULL DEFAULT now(),
  sent_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_by_name   text NOT NULL CHECK (char_length(btrim(sent_by_name)) BETWEEN 1 AND 120)
);
CREATE INDEX IF NOT EXISTS club_sponsor_offers_org_idx ON public.club_sponsor_offers (org_id, email);
CREATE INDEX IF NOT EXISTS club_sponsor_offers_deal_idx ON public.club_sponsor_offers (deal_id) WHERE deal_id IS NOT NULL;

-- ── 4. Addresses that are never offered again ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_sponsor_offer_stops (
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email            text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254 AND email = lower(email)),
  source           text NOT NULL CHECK (source IN ('unsubscribe', 'club')),
  stopped_at       timestamptz NOT NULL DEFAULT now(),
  stopped_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stopped_by_name  text CHECK (stopped_by_name IS NULL OR char_length(btrim(stopped_by_name)) BETWEEN 1 AND 120),
  PRIMARY KEY (org_id, email),
  CONSTRAINT club_sponsor_offer_stops_who CHECK ((source = 'club') = (stopped_by_name IS NOT NULL))
);

-- ── 5. Invoice numbers ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_sponsor_invoice_counters (
  org_id    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year      integer NOT NULL CHECK (year BETWEEN 2000 AND 2199),
  last_seq  integer NOT NULL CHECK (last_seq > 0),
  PRIMARY KEY (org_id, year)
);

-- ── 6. A deal's place is the deal's ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'club_sponsor_places_deal_fk') THEN
    ALTER TABLE public.club_sponsor_places
      ADD CONSTRAINT club_sponsor_places_deal_fk FOREIGN KEY (deal_id) REFERENCES public.club_sponsor_deals(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS club_sponsor_places_one_per_deal ON public.club_sponsor_places (deal_id) WHERE deal_id IS NOT NULL;

-- ── 7. A business's answers are about its deal ─────────────────────────────────────────────────────
-- The four inline subject_table CHECKs (513, 518) are found by what they say, not by a guessed name.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, c.conname
      FROM pg_constraint c
     WHERE c.contype = 'c'
       AND c.conrelid IN ('public.club_form_files'::regclass, 'public.club_form_answers'::regclass,
                          'public.club_form_ticks'::regclass, 'public.club_form_answer_clears'::regclass)
       AND pg_get_constraintdef(c.oid) LIKE '%league_registrations%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;
ALTER TABLE public.club_form_files ADD CONSTRAINT club_form_files_subject_table_check
  CHECK (subject_table IS NULL OR subject_table IN ('league_registrations', 'club_sponsor_deals'));
ALTER TABLE public.club_form_answers ADD CONSTRAINT club_form_answers_subject_table_check
  CHECK (subject_table IS NULL OR subject_table IN ('league_registrations', 'club_sponsor_deals'));
ALTER TABLE public.club_form_ticks ADD CONSTRAINT club_form_ticks_subject_table_check
  CHECK (subject_table IN ('league_registrations', 'club_sponsor_deals'));
ALTER TABLE public.club_form_answer_clears ADD CONSTRAINT club_form_answer_clears_subject_table_check
  CHECK (subject_table IS NULL OR subject_table IN ('league_registrations', 'club_sponsor_deals'));

-- ── 8. A deal's answers go with it ─────────────────────────────────────────────────────────────────
-- Only a club's deletion removes a deal (its business can't be removed while it has one), but the answers must never
-- outlive their subject. The stored files' rows going queue the files themselves (club_form_file_row_gone, mig 518).
CREATE OR REPLACE FUNCTION public.club_sponsor_deal_gone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM club_form_answers WHERE subject_table = 'club_sponsor_deals' AND subject_id = OLD.id;
  DELETE FROM club_form_answer_clears WHERE subject_table = 'club_sponsor_deals' AND subject_id = OLD.id;
  DELETE FROM club_form_ticks WHERE subject_table = 'club_sponsor_deals' AND subject_id = OLD.id;
  DELETE FROM club_form_files WHERE subject_table = 'club_sponsor_deals' AND subject_id = OLD.id;
  DELETE FROM club_form_submissions s
   WHERE s.ref = OLD.id::text
     AND s.form_id IN (SELECT f.id FROM club_forms f WHERE f.owner_table = 'organizations' AND f.owner_id = OLD.org_id);
  IF OLD.logo_path IS NOT NULL THEN
    INSERT INTO club_form_storage_removals (path, org_id) VALUES (OLD.logo_path, OLD.org_id) ON CONFLICT (path) DO NOTHING;
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_deal_gone() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS club_sponsor_deal_gone ON public.club_sponsor_deals;
CREATE TRIGGER club_sponsor_deal_gone AFTER DELETE ON public.club_sponsor_deals
  FOR EACH ROW EXECUTE FUNCTION public.club_sponsor_deal_gone();

-- ── 9. What the business sends from its link ───────────────────────────────────────────────────────
-- p_business: { name, contactName, email, phone, website, street, city, province, postal } (checked by the route).
-- p_answers:  [{ questionId, text | choiceIds | bool | date | fileId }] — the WHOLE set: a question left out is cleared.
-- p_ticks:    [{ documentId, versionId, sentence, handedOverAt? }] — a version already ticked for this deal isn't ticked twice.
-- p_invoice:  null (an unfinished card payment, Part 3: Form received) or
--             { year, issuedOn, dueOn, taxKind?, taxRate?, taxAmount?, total, payMethod } — the number is given here.
-- Refuses (SP001) a deal that is no longer open to its link, or an old link (p_version). Returns the deal's state and
-- its invoice number.
CREATE OR REPLACE FUNCTION public.club_sponsor_deal_receive(
  p_org uuid, p_deal uuid, p_version integer, p_form uuid, p_business jsonb, p_answers jsonb, p_ticks jsonb, p_invoice jsonb
)
RETURNS TABLE (state text, invoice_year integer, invoice_seq integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_deal public.club_sponsor_deals%ROWTYPE;
  v_email text := lower(btrim(p_business->>'email'));
  v_sub uuid; v_a jsonb; v_q record; v_file uuid; v_n integer; v_want integer;
  v_keep uuid[] := '{}';
  v_year integer; v_seq integer;
BEGIN
  SELECT * INTO v_deal FROM club_sponsor_deals d WHERE d.id = p_deal AND d.org_id = p_org FOR UPDATE;
  IF NOT FOUND OR v_deal.state NOT IN ('offered', 'form_received') OR v_deal.link_version <> p_version THEN
    RAISE EXCEPTION USING ERRCODE = 'SP001', MESSAGE = 'club_sponsor_deal_closed';
  END IF;

  IF p_form IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM club_forms f WHERE f.id = p_form AND f.org_id = p_org
                     AND f.owner_table = 'organizations' AND f.owner_id = p_org AND f.subject_kind = 'business') THEN
      RAISE EXCEPTION 'club_sponsor_deal_receive: form not this club''s sponsorship form';
    END IF;
    INSERT INTO club_form_submissions (org_id, form_id, ref, guardian_email)
    VALUES (p_org, p_form, p_deal::text, v_email)
    ON CONFLICT (form_id, ref) DO UPDATE SET guardian_email = EXCLUDED.guardian_email
    RETURNING club_form_submissions.id INTO v_sub;

    FOR v_a IN SELECT x FROM jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) x LOOP
      SELECT q.id INTO v_q FROM club_form_questions q
       WHERE q.id = (v_a->>'questionId')::uuid AND q.form_id = p_form AND q.archived_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'CF001', MESSAGE = 'club_form_question_gone'; END IF;
      v_keep := v_keep || v_q.id;
      v_file := nullif(v_a->>'fileId', '')::uuid;
      IF v_file IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM club_form_files f WHERE f.id = v_file AND f.subject_table = 'club_sponsor_deals'
              AND f.subject_id = p_deal AND f.question_id = v_q.id AND f.status = 'attached') THEN
        UPDATE club_form_files f SET status = 'attached', attached_at = now(), submission_id = v_sub,
               subject_table = 'club_sponsor_deals', subject_id = p_deal
         WHERE f.id = v_file AND f.form_id = p_form AND f.question_id = v_q.id AND f.status = 'pending';
        GET DIAGNOSTICS v_n = ROW_COUNT;
        IF v_n <> 1 THEN RAISE EXCEPTION USING ERRCODE = 'CF003', MESSAGE = 'club_form_file_gone'; END IF;
      END IF;
      -- A file this answer no longer names is removed (its row stays, marked; the stored file is queued, mig 518).
      UPDATE club_form_files f SET status = 'removed', removed_at = now()
       WHERE f.subject_table = 'club_sponsor_deals' AND f.subject_id = p_deal AND f.question_id = v_q.id
         AND f.status = 'attached' AND f.id IS DISTINCT FROM v_file;
      INSERT INTO club_form_answers (org_id, form_id, question_id, submission_id, subject_table, subject_id,
                                     value_text, value_choice_ids, value_bool, value_date, file_id)
      SELECT p_org, p_form, v_q.id, v_sub, 'club_sponsor_deals', p_deal,
             v.value_text, v.value_choice_ids, v.value_bool, v.value_date, v.file_id
        FROM club_form_answer_value(v_a) v
      ON CONFLICT (question_id, subject_table, subject_id) WHERE subject_id IS NOT NULL DO UPDATE
        SET value_text = EXCLUDED.value_text, value_choice_ids = EXCLUDED.value_choice_ids, value_bool = EXCLUDED.value_bool,
            value_date = EXCLUDED.value_date, file_id = EXCLUDED.file_id, submission_id = EXCLUDED.submission_id,
            removed_at = NULL, updated_at = now();
    END LOOP;

    -- A question answered before and left out now is cleared, with its file.
    UPDATE club_form_files f SET status = 'removed', removed_at = now()
     WHERE f.subject_table = 'club_sponsor_deals' AND f.subject_id = p_deal AND f.status = 'attached'
       AND NOT (f.question_id = ANY (v_keep));
    DELETE FROM club_form_answers a
     WHERE a.subject_table = 'club_sponsor_deals' AND a.subject_id = p_deal AND NOT (a.question_id = ANY (v_keep));

    -- One tick per document, on the version the page showed (the route checked it is the current one).
    v_want := jsonb_array_length(coalesce(p_ticks, '[]'::jsonb));
    IF v_want > 0 THEN
      SELECT count(*) INTO v_n
        FROM jsonb_array_elements(p_ticks) t
        JOIN club_form_documents d ON d.id = (t->>'documentId')::uuid AND d.form_id = p_form AND d.archived_at IS NULL
        JOIN club_form_document_versions v ON v.id = (t->>'versionId')::uuid AND v.document_id = d.id;
      IF v_n <> v_want THEN RAISE EXCEPTION USING ERRCODE = 'CF002', MESSAGE = 'club_form_document_gone'; END IF;
      INSERT INTO club_form_ticks (org_id, form_id, document_id, version_id, submission_id, subject_table, subject_id,
                                   guardian_email, sentence, fingerprint, handed_over_at)
      SELECT p_org, p_form, d.id, v.id, v_sub, 'club_sponsor_deals', p_deal, v_email,
             t->>'sentence', v.fingerprint, nullif(t->>'handedOverAt', '')::timestamptz
        FROM jsonb_array_elements(p_ticks) t
        JOIN club_form_documents d ON d.id = (t->>'documentId')::uuid AND d.form_id = p_form
        JOIN club_form_document_versions v ON v.id = (t->>'versionId')::uuid AND v.document_id = d.id
       WHERE NOT EXISTS (SELECT 1 FROM club_form_ticks x WHERE x.subject_table = 'club_sponsor_deals'
                            AND x.subject_id = p_deal AND x.version_id = v.id);
    END IF;
  END IF;

  -- The one business record (ask 1): name and details change from the link until the deal is paid.
  UPDATE club_sponsors s SET
    name = btrim(p_business->>'name'), contact_name = nullif(btrim(p_business->>'contactName'), ''), contact_email = v_email,
    phone = nullif(btrim(p_business->>'phone'), ''), link = nullif(btrim(p_business->>'website'), ''),
    invoice_street = nullif(btrim(p_business->>'street'), ''), invoice_city = nullif(btrim(p_business->>'city'), ''),
    invoice_province = nullif(btrim(p_business->>'province'), ''), invoice_postal = nullif(btrim(p_business->>'postal'), ''),
    updated_at = now()
   WHERE s.id = v_deal.sponsor_id AND s.org_id = p_org;

  UPDATE club_sponsor_deals d SET
    form_at = now(), business_name = btrim(p_business->>'name'), contact_name = nullif(btrim(p_business->>'contactName'), ''),
    contact_email = v_email, phone = nullif(btrim(p_business->>'phone'), ''), website = nullif(btrim(p_business->>'website'), ''),
    invoice_street = nullif(btrim(p_business->>'street'), ''), invoice_city = nullif(btrim(p_business->>'city'), ''),
    invoice_province = nullif(btrim(p_business->>'province'), ''), invoice_postal = nullif(btrim(p_business->>'postal'), ''),
    state = CASE WHEN p_invoice IS NULL THEN 'form_received' ELSE d.state END, updated_at = now()
   WHERE d.id = p_deal;

  IF p_invoice IS NOT NULL THEN
    v_year := (p_invoice->>'year')::integer;
    INSERT INTO club_sponsor_invoice_counters AS c (org_id, year, last_seq) VALUES (p_org, v_year, 1)
    ON CONFLICT (org_id, year) DO UPDATE SET last_seq = c.last_seq + 1
    RETURNING c.last_seq INTO v_seq;
    UPDATE club_sponsor_deals d SET
      state = 'invoiced', pay_method = p_invoice->>'payMethod', invoice_year = v_year, invoice_seq = v_seq,
      invoiced_at = now(), invoiced_on = (p_invoice->>'issuedOn')::date, due_on = (p_invoice->>'dueOn')::date,
      tax_kind = nullif(p_invoice->>'taxKind', ''), tax_rate = nullif(p_invoice->>'taxRate', '')::numeric,
      tax_amount = nullif(p_invoice->>'taxAmount', '')::numeric, total = (p_invoice->>'total')::numeric, updated_at = now()
     WHERE d.id = p_deal;
  END IF;

  RETURN QUERY SELECT d.state, d.invoice_year, d.invoice_seq FROM club_sponsor_deals d WHERE d.id = p_deal;
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_deal_receive(uuid, uuid, integer, uuid, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_deal_receive(uuid, uuid, integer, uuid, jsonb, jsonb, jsonb, jsonb) TO service_role;

-- ── 10. Grants ─────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.club_sponsor_deals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_sponsor_deal_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_sponsor_offers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_sponsor_offer_stops      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_sponsor_invoice_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_sponsor_deals, public.club_sponsor_deal_items, public.club_sponsor_offers,
  public.club_sponsor_offer_stops, public.club_sponsor_invoice_counters FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_sponsor_deals, public.club_sponsor_deal_items TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.club_sponsor_invoice_counters TO service_role;
-- no-service-role-grant: club_sponsor_invoice_counters — only club_sponsor_deal_receive (SECURITY DEFINER) touches it; mig 527 takes this grant away
-- The CASL record and the stops are never changed or cleared from the product (ask 13; /legal §1). A club's deletion
-- still removes them (the foreign key's own action), and an offer's deal going leaves the offer (SET NULL).
-- Narrower than the grants guard's four on purpose; the server reads and adds, which is all it does:
-- no-service-role-grant: club_sponsor_offers — granted SELECT and INSERT only, the CASL record is insert-only (ask 13)
-- no-service-role-grant: club_sponsor_offer_stops — granted SELECT and INSERT only, a stop can't be cleared (ask 13)
REVOKE UPDATE, DELETE ON public.club_sponsor_offers, public.club_sponsor_offer_stops FROM service_role;
GRANT SELECT, INSERT ON public.club_sponsor_offers, public.club_sponsor_offer_stops TO service_role;

COMMENT ON TABLE public.club_sponsor_deals IS
  'A club sponsorship deal (mig 526, Board Ready Stage 6 Part 2): a business + a package (kept as offered) + where it shows + an amount. state offered|form_received|invoiced|paid|withdrawn (ask 4; Delivered = paid + every item ticked, worked out). link_version stops an old link. The business''s details from its link are kept here as sent (the invoice''s facts). Invoice {invoice_year}-{invoice_seq} given when a cheque or e-transfer is chosen (owner call 2026-11-22 (a)). emailed_at null = made as a link only.';
COMMENT ON TABLE public.club_sponsor_deal_items IS
  'A deal''s delivery checklist ticks (mig 526): item_id = the package item''s id, or ''logo'' for the logo line (ticking it puts the logo up before payment, ask 5). done_by_name kept as it was.';
COMMENT ON TABLE public.club_sponsor_offers IS
  'Every sponsorship offer email sent (mig 526; CASL s.10(9)-(10), /legal review §1): the address, the reason picked (paid_recently | asked_recently | gave_address | published_address), its date, who sent it (a name snapshot), the club. Insert-only; outlives the deal (deal_id SET NULL) and the business.';
COMMENT ON TABLE public.club_sponsor_offer_stops IS
  'An address never offered a sponsorship again by this club (mig 526, ask 13): source unsubscribe (the email foot''s link) or club ("Do not offer again", a stop said by reply or phone, with who). Per club, per address, sponsorship offers only. Insert-only: no club seat can clear one.';
COMMENT ON TABLE public.club_sponsor_invoice_counters IS
  'The last sponsorship invoice number given per club and calendar year (mig 526): a number is never reused, even when a deal holding it is withdrawn.';

COMMIT;
