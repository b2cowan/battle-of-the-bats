-- Migration 315: a club money move is one step.
-- (Club Tier Stage 3a, session 1 — the server half. Owner rulings 2026-09-30, Asks 1, 3, 4, 5b:
--  "I agree with your recommendations". Plan: docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md
--  §4C C07 C08 C12 C13 C14 C16, §6 Stage 3; build prompt CLUB_TIER_STAGE3A_SERVER_PROMPT.md.)
--
-- THE CASE. Every club money move was two writes from the app with a network round trip between them:
-- the ledger transfer first, the stamp second. A lost race left an orphaned pair of ledger lines; an
-- approval threw its entry id away, had no "still waiting" guard (a double approval posted two
-- transfers) and dated by UTC; nothing could be undone by the club, and a coach's "Record as paid"
-- wrote straight into the club's General ledger with nobody looking.
--
-- WHAT THIS ADDS
--   1. An installment can be SENT (the coach says the money left the team: day, how, reference, who).
--      Sent writes NOTHING to any ledger. The club confirming it RECEIVED is the one moment the
--      club's ledger is written (Ask 1).
--   2. A received installment and an approved request remember how the money moved (day, method,
--      reference) — today's click recorded none of it.
--   3. Taking money back keeps a record: the last undo on an installment, the reversal on a request
--      (new status `reversed`), and on every voided ledger line the reason, who, and when (Ask 3).
--      Nothing is deleted; both halves of a transfer are voided together.
--   4. `payout_hold_told_at` — when the club was told a waiting request is holding up a team's
--      end-of-season payout (Ask 5b), so the coach's sheet can say the club has been told, and when.
--   5. `rep_allocation_reminder_waves` — who sent an allocation reminder, when, and to which teams,
--      so "last sent" is true (Ask 4). A wave is CLAIMED before any email goes
--      (`club_reminder_wave_claim`), so two sends a breath apart send one wave, not two.
--   6. ONE DATABASE FUNCTION PER MONEY MOVE (receive · undo · approve · reverse · void a transfer ·
--      merge a payee),
--      each a single transaction that locks its row, refuses unless the state is still the one the
--      caller saw, writes the state change and both ledger lines together, and keeps the entry link.
--      The words on a line are passed in by the app (lib/club-money-words.ts, /marketing's drafts);
--      the function only decides WHETHER and writes atomically.
--   7. The General ledger is made once: one get-or-create that respects mig 127's partial unique
--      index under a race (`club_general_ledger`), and the same for a team's ledger.
--
-- ⚠ NO BACKFILL (the standing rule). Every new column is NULL on every existing row, which means
-- "recorded before 3a". An installment a coach already recorded paid stays received; a request
-- approved before this keeps `accounting_entry_id` NULL, and the reversal refuses it in words
-- rather than guessing which two lines to void.
--
-- ⚠ STATUS WORDS ARE NOT RENAMED. `denied` stays the stored value; the product's word is "Declined"
-- (lib/club-money-words.ts). Renaming a stored value is a migration of its own, not a spelling fix.
--
-- ⚠ PROD-OWED, and ORDER-CRITICAL: the code that ships with this calls the functions below on every
-- club money move and reads the new columns on every club and coach money read. Apply to prod
-- BEFORE promoting that code. The functions are invisible to `check:migrations`, so
-- MANUAL_PROD_STEPS.json carries this file as `pending`.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, guarded constraints, CREATE OR REPLACE, CREATE ... IF NOT EXISTS.

BEGIN;

-- ── 1–3. The installment ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.rep_allocation_installments
  ADD COLUMN IF NOT EXISTS sent_on        date,
  ADD COLUMN IF NOT EXISTS sent_method    text,
  ADD COLUMN IF NOT EXISTS sent_reference text,
  ADD COLUMN IF NOT EXISTS sent_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_at        timestamptz,
  ADD COLUMN IF NOT EXISTS paid_on        date,
  ADD COLUMN IF NOT EXISTS paid_method    text,
  ADD COLUMN IF NOT EXISTS paid_reference text,
  ADD COLUMN IF NOT EXISTS undone_at      timestamptz,
  ADD COLUMN IF NOT EXISTS undone_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS undone_reason  text;

DO $$
BEGIN
  -- The product's ONE method list (money centralization P1, mig 260): stored as the dues tokens.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rep_allocation_installments_sent_method_check') THEN
    ALTER TABLE public.rep_allocation_installments
      ADD CONSTRAINT rep_allocation_installments_sent_method_check
      CHECK (sent_method IS NULL OR sent_method IN ('etransfer', 'cash', 'cheque', 'card', 'other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rep_allocation_installments_paid_method_check') THEN
    ALTER TABLE public.rep_allocation_installments
      ADD CONSTRAINT rep_allocation_installments_paid_method_check
      CHECK (paid_method IS NULL OR paid_method IN ('etransfer', 'cash', 'cheque', 'card', 'other'));
  END IF;
  -- A "sent" is a day and a moment together, or neither.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rep_allocation_installments_sent_is_whole_check') THEN
    ALTER TABLE public.rep_allocation_installments
      ADD CONSTRAINT rep_allocation_installments_sent_is_whole_check
      CHECK ((sent_at IS NULL) = (sent_on IS NULL));
  END IF;
  -- An undo always carries its reason.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rep_allocation_installments_undo_has_reason_check') THEN
    ALTER TABLE public.rep_allocation_installments
      ADD CONSTRAINT rep_allocation_installments_undo_has_reason_check
      CHECK ((undone_at IS NULL) = (undone_reason IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rep_allocation_installments_words_length_check') THEN
    ALTER TABLE public.rep_allocation_installments
      ADD CONSTRAINT rep_allocation_installments_words_length_check
      CHECK (
        (sent_reference IS NULL OR char_length(sent_reference) <= 100)
        AND (paid_reference IS NULL OR char_length(paid_reference) <= 100)
        AND (undone_reason IS NULL OR char_length(undone_reason) <= 500)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.rep_allocation_installments.sent_on IS
  'The day the COACH says the team sent this installment to the club (mig 315, Ask 1). Sent writes nothing to any ledger: the club confirming it received is the one moment the club''s books are written. NULL = never said sent, or recorded before 3a. Cleared when the coach takes it back or the club undoes a payment.';
COMMENT ON COLUMN public.rep_allocation_installments.sent_method IS
  'How the coach says it was sent: etransfer | cash | cheque | card | other (the product''s one method list, DUES_PAYMENT_METHODS). Mig 315.';
COMMENT ON COLUMN public.rep_allocation_installments.sent_reference IS
  'The reference the coach gave the club to match the payment (an e-Transfer number, a cheque number). Mig 315.';
COMMENT ON COLUMN public.rep_allocation_installments.sent_by IS
  'Who on the team said it was sent. Mig 315.';
COMMENT ON COLUMN public.rep_allocation_installments.sent_at IS
  'When "sent" was recorded (the moment, not the day it was sent — that is sent_on). Mig 315.';
COMMENT ON COLUMN public.rep_allocation_installments.paid_on IS
  'The day the money reached the club, in the club''s day, as the club recorded it (mig 315). paid_at stays the moment it was recorded. NULL on an installment received before 3a: readers fall back to the org day of paid_at.';
COMMENT ON COLUMN public.rep_allocation_installments.paid_method IS
  'How the money reached the club (the one method list). Mig 315; NULL before 3a.';
COMMENT ON COLUMN public.rep_allocation_installments.paid_reference IS
  'The reference the club recorded with the payment. Mig 315; NULL before 3a.';
COMMENT ON COLUMN public.rep_allocation_installments.undone_at IS
  'The LAST time the club undid a recorded payment on this installment (mig 315, Ask 3). Both ledger lines were voided with the same reason; the installment is unpaid again. Cleared when it is received again (the voided lines keep the history).';
COMMENT ON COLUMN public.rep_allocation_installments.undone_by IS 'Who undid it (mig 315).';
COMMENT ON COLUMN public.rep_allocation_installments.undone_reason IS
  'Why the club undid the payment — the coach reads it on the bill. Required with undone_at (CHECK). Mig 315.';

-- ── The payment request ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.rep_team_payment_requests
  ADD COLUMN IF NOT EXISTS paid_on             date,
  ADD COLUMN IF NOT EXISTS paid_method         text,
  ADD COLUMN IF NOT EXISTS paid_reference      text,
  ADD COLUMN IF NOT EXISTS reversed_at         timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reversed_reason     text,
  ADD COLUMN IF NOT EXISTS payout_hold_told_at timestamptz;

ALTER TABLE public.rep_team_payment_requests
  DROP CONSTRAINT IF EXISTS rep_team_payment_requests_status_check;
ALTER TABLE public.rep_team_payment_requests
  ADD CONSTRAINT rep_team_payment_requests_status_check
  CHECK (status IN ('pending', 'approved', 'denied', 'reversed'));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rep_team_payment_requests_paid_method_check') THEN
    ALTER TABLE public.rep_team_payment_requests
      ADD CONSTRAINT rep_team_payment_requests_paid_method_check
      CHECK (paid_method IS NULL OR paid_method IN ('etransfer', 'cash', 'cheque', 'card', 'other'));
  END IF;
  -- A reversal is a record, never a bare status: reversed ⇔ its moment (and its reason, below).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rep_team_payment_requests_reversal_is_whole_check') THEN
    ALTER TABLE public.rep_team_payment_requests
      ADD CONSTRAINT rep_team_payment_requests_reversal_is_whole_check
      CHECK ((status = 'reversed') = (reversed_at IS NOT NULL) AND (reversed_at IS NULL) = (reversed_reason IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rep_team_payment_requests_words_length_check') THEN
    ALTER TABLE public.rep_team_payment_requests
      ADD CONSTRAINT rep_team_payment_requests_words_length_check
      CHECK (
        (paid_reference IS NULL OR char_length(paid_reference) <= 100)
        AND (reversed_reason IS NULL OR char_length(reversed_reason) <= 500)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.rep_team_payment_requests.paid_on IS
  'The day the money moved when the club approved (the club''s day, mig 315). NULL on a request decided before 3a.';
COMMENT ON COLUMN public.rep_team_payment_requests.paid_method IS
  'How the money moved on approval (the one method list). Mig 315.';
COMMENT ON COLUMN public.rep_team_payment_requests.paid_reference IS
  'The reference the club recorded on approval. Mig 315.';
COMMENT ON COLUMN public.rep_team_payment_requests.reversed_at IS
  'When the club reversed an approval (status = reversed; mig 315, Ask 3). Both ledger lines were voided with the reason. The reversed request stays in the list and is closed; the coach may file a new one.';
COMMENT ON COLUMN public.rep_team_payment_requests.reversed_by IS 'Who reversed it (mig 315).';
COMMENT ON COLUMN public.rep_team_payment_requests.reversed_reason IS
  'Why the club reversed the approval — the coach reads it. Required with reversed_at (CHECK). Mig 315.';
COMMENT ON COLUMN public.rep_team_payment_requests.payout_hold_told_at IS
  'When the club was told this WAITING request is holding up the team''s end-of-season payout to families (mig 315, Ask 5b). Written once, the first time the coach opens the payout sheet while it waits; the coach''s sheet says "the club has been told" with this date. NULL = never told (or never held anything up).';

-- ── The ledger line ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.accounting_entries
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS voided_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voided_at   timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_entries_void_reason_length_check') THEN
    ALTER TABLE public.accounting_entries
      ADD CONSTRAINT accounting_entries_void_reason_length_check
      CHECK (void_reason IS NULL OR char_length(void_reason) <= 500);
  END IF;
END $$;

COMMENT ON COLUMN public.accounting_entries.void_reason IS
  'Why the line was voided, printed under it (mig 315, Ask 3). Written by every club void from 3a on (an undone payment, a reversed approval, a voided transfer: both halves carry the same reason). NULL on a void made before 3a, or by a path that records no reason.';
COMMENT ON COLUMN public.accounting_entries.voided_by IS 'Who voided the line (mig 315).';
COMMENT ON COLUMN public.accounting_entries.voided_at IS 'When the line was voided (mig 315).';

-- ── 5. Reminder waves ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rep_allocation_reminder_waves (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sent_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at           timestamptz NOT NULL DEFAULT now(),
  team_id           uuid REFERENCES public.rep_teams(id) ON DELETE SET NULL,
  team_ids          uuid[] NOT NULL DEFAULT '{}',
  recipient_count   integer NOT NULL CHECK (recipient_count >= 0),
  installment_count integer NOT NULL CHECK (installment_count >= 0),
  amount            numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS rep_allocation_reminder_waves_org_sent_idx
  ON public.rep_allocation_reminder_waves (org_id, sent_at DESC);

ALTER TABLE public.rep_allocation_reminder_waves ENABLE ROW LEVEL SECURITY;
-- Server-only (mig 311's rule): no policies, nothing to anon/authenticated; the service role is granted
-- explicitly, because Supabase stops granting new tables to it on 2026-10-30.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_allocation_reminder_waves TO service_role;

COMMENT ON TABLE public.rep_allocation_reminder_waves IS
  'One row per allocation reminder send (mig 315, Ask 4): who sent it, when, and which teams it reached. "Last sent" reads the newest row. team_id is set on the single-team variant ("Remind 16U Girls"); team_ids lists every team the wave emailed.';
COMMENT ON COLUMN public.rep_allocation_reminder_waves.team_id IS
  'Set only on a single-team wave (sent from inside a team''s bill). NULL on the club-wide wave.';
COMMENT ON COLUMN public.rep_allocation_reminder_waves.team_ids IS
  'Every team the wave emailed (the reachable ones the preview named). Not FK-checked: a record of a send, kept when a team is later archived.';
COMMENT ON COLUMN public.rep_allocation_reminder_waves.recipient_count IS 'How many people were emailed.';
COMMENT ON COLUMN public.rep_allocation_reminder_waves.installment_count IS 'How many installments the wave listed, overdue included.';
COMMENT ON COLUMN public.rep_allocation_reminder_waves.amount IS 'The total the wave asked for, across every team it reached.';

-- ── 7. The ledgers, made once ───────────────────────────────────────────────────────────────────

-- The club's General ledger. Mig 127's partial unique index is the rule; this is the one writer that
-- respects it when two first-ever requests race (C14). Before it, the loser's insert failed and the
-- caller crashed on a null.
CREATE OR REPLACE FUNCTION public.club_general_ledger(p_org uuid)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id   uuid;
  v_name text;
BEGIN
  SELECT id INTO v_id FROM accounting_ledgers
   WHERE org_id = p_org AND entity_type = 'org' AND entity_id IS NULL
   ORDER BY created_at LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT name INTO v_name FROM organizations WHERE id = p_org;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'club_general_ledger: organization % not found', p_org;
  END IF;

  INSERT INTO accounting_ledgers (org_id, entity_type, entity_id, name)
  VALUES (p_org, 'org', NULL, v_name || ' — General')
  ON CONFLICT (org_id) WHERE entity_type = 'org' AND entity_id IS NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    -- Somebody else made it in the same instant; theirs is the one.
    SELECT id INTO v_id FROM accounting_ledgers
     WHERE org_id = p_org AND entity_type = 'org' AND entity_id IS NULL
     ORDER BY created_at LIMIT 1;
  END IF;
  RETURN v_id;
END;
$$;

-- A team's ledger (the projection D1 says the club never writes by hand; the loop's transfers post
-- their team half here). UNIQUE (org_id, entity_type, entity_id) is the rule.
CREATE OR REPLACE FUNCTION public.club_team_ledger(p_org uuid, p_team uuid)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id   uuid;
  v_name text;
BEGIN
  SELECT id INTO v_id FROM accounting_ledgers
   WHERE org_id = p_org AND entity_type = 'team' AND entity_id = p_team;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT name INTO v_name FROM rep_teams WHERE id = p_team AND org_id = p_org;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'club_team_ledger: team % is not in organization %', p_team, p_org;
  END IF;

  INSERT INTO accounting_ledgers (org_id, entity_type, entity_id, name)
  VALUES (p_org, 'team', p_team, v_name)
  ON CONFLICT (org_id, entity_type, entity_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM accounting_ledgers
     WHERE org_id = p_org AND entity_type = 'team' AND entity_id = p_team;
  END IF;
  RETURN v_id;
END;
$$;

-- Both halves of a transfer, voided together with one reason (mig 275's two-sided void, now with
-- its record). Locks both lines in id order so two voids of one pair can never deadlock. Voiding a
-- void is a no-op. Internal: called only by the move functions below.
CREATE OR REPLACE FUNCTION public.club_void_entry_pair(p_entry uuid, p_reason text, p_actor uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_partner uuid;
  v_ids     uuid[];
BEGIN
  SELECT linked_entry_id INTO v_partner FROM accounting_entries WHERE id = p_entry;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'club_void_entry_pair: entry % not found', p_entry;
  END IF;
  v_ids := array_remove(ARRAY[p_entry, v_partner], NULL);

  PERFORM 1 FROM accounting_entries WHERE id = ANY (v_ids) ORDER BY id FOR UPDATE;

  UPDATE accounting_entries
     SET status = 'void', void_reason = p_reason, voided_by = p_actor, voided_at = now(), updated_at = now()
   WHERE id = ANY (v_ids) AND status <> 'void';
  RETURN v_ids;
END;
$$;

-- ── 6. The moves ────────────────────────────────────────────────────────────────────────────────
-- Every function returns {ok:true,…} or {ok:false, code, state?} BEFORE it writes anything; any
-- failure after the first write raises, so the whole move rolls back and no orphaned pair is left.
-- `code` values: not_found · state_changed (with `state`, the state it is in now) · unlinked.

-- Club: record received (p_expect = 'unpaid') or confirm a coach's "sent" (p_expect = 'sent').
-- The one moment the club's ledger is written for an installment (Ask 1).
CREATE OR REPLACE FUNCTION public.club_installment_receive(
  p_installment uuid,
  p_org         uuid,
  p_actor       uuid,
  p_expect      text,
  p_on          date,
  p_method      text,
  p_method_word text,
  p_reference   text,
  p_club_words  text,
  p_team_words  text,
  p_category    text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_inst        rep_allocation_installments%ROWTYPE;
  v_team        uuid;
  v_general     uuid;
  v_team_ledger uuid;
  v_out         uuid := gen_random_uuid();
  v_in          uuid := gen_random_uuid();
BEGIN
  IF p_expect NOT IN ('unpaid', 'sent') THEN
    RAISE EXCEPTION 'club_installment_receive: p_expect must be unpaid or sent';
  END IF;

  SELECT * INTO v_inst FROM rep_allocation_installments
   WHERE id = p_installment AND org_id = p_org
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;

  IF v_inst.paid_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'state_changed', 'state', 'received');
  END IF;
  IF p_expect = 'unpaid' AND v_inst.sent_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'state_changed', 'state', 'sent');
  END IF;
  IF p_expect = 'sent' AND v_inst.sent_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'state_changed', 'state', 'unpaid');
  END IF;

  SELECT team_id INTO v_team FROM rep_allocation_splits WHERE id = v_inst.split_id AND org_id = p_org;
  IF v_team IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;

  v_general     := club_general_ledger(p_org);
  v_team_ledger := club_team_ledger(p_org, v_team);

  -- The team pays, the club receives. The payer's half is the one the installment keeps.
  INSERT INTO accounting_entries
    (id, ledger_id, entry_date, description, amount, entry_type, status, category, linked_entry_id,
     source_module, source_entity_id, payment_method, created_by)
  VALUES
    (v_out, v_team_ledger, p_on, p_team_words, v_inst.amount, 'transfer_out', 'posted', p_category, v_in,
     'rep_allocation_installment', p_installment, p_method_word, p_actor),
    (v_in,  v_general,     p_on, p_club_words, v_inst.amount, 'transfer_in',  'posted', p_category, v_out,
     'rep_allocation_installment', p_installment, p_method_word, p_actor);

  UPDATE rep_allocation_installments
     SET paid_at = now(), paid_by = p_actor, paid_on = p_on, paid_method = p_method,
         paid_reference = p_reference, accounting_entry_id = v_out,
         undone_at = NULL, undone_by = NULL, undone_reason = NULL
   WHERE id = p_installment;

  RETURN jsonb_build_object('ok', true, 'entryId', v_out, 'teamId', v_team);
END;
$$;

-- Club: undo a recorded payment. Both lines voided with the reason; the installment is unpaid again
-- (overdue by its own date). The coach's "sent" note goes too — the money did not arrive.
CREATE OR REPLACE FUNCTION public.club_installment_undo(
  p_installment uuid,
  p_org         uuid,
  p_actor       uuid,
  p_reason      text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_inst rep_allocation_installments%ROWTYPE;
  v_team uuid;
  v_ids  uuid[];
BEGIN
  SELECT * INTO v_inst FROM rep_allocation_installments
   WHERE id = p_installment AND org_id = p_org
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;

  IF v_inst.paid_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'state_changed',
      'state', CASE WHEN v_inst.sent_at IS NOT NULL THEN 'sent' ELSE 'unpaid' END);
  END IF;
  -- Recorded before mig 275 with no unambiguous link: refuse rather than clear a stamp over money
  -- that stays moved (the coach's undo learned the same rule).
  IF v_inst.accounting_entry_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unlinked');
  END IF;

  SELECT team_id INTO v_team FROM rep_allocation_splits WHERE id = v_inst.split_id;

  v_ids := club_void_entry_pair(v_inst.accounting_entry_id, p_reason, p_actor);

  UPDATE rep_allocation_installments
     SET paid_at = NULL, paid_by = NULL, paid_on = NULL, paid_method = NULL, paid_reference = NULL,
         accounting_entry_id = NULL,
         sent_on = NULL, sent_method = NULL, sent_reference = NULL, sent_by = NULL, sent_at = NULL,
         undone_at = now(), undone_by = p_actor, undone_reason = p_reason
   WHERE id = p_installment;

  RETURN jsonb_build_object('ok', true, 'voided', to_jsonb(v_ids), 'teamId', v_team);
END;
$$;

-- Club: approve a waiting request. Guarded on status = 'pending', so a double approval is impossible;
-- the transfer's payer-side entry id is kept, so the approval can be reversed.
CREATE OR REPLACE FUNCTION public.club_request_approve(
  p_request     uuid,
  p_org         uuid,
  p_actor       uuid,
  p_on          date,
  p_method      text,
  p_method_word text,
  p_reference   text,
  p_club_words  text,
  p_team_words  text,
  p_category    text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_req         rep_team_payment_requests%ROWTYPE;
  v_general     uuid;
  v_team_ledger uuid;
  v_from        uuid;
  v_to          uuid;
  v_from_words  text;
  v_to_words    text;
  v_out         uuid := gen_random_uuid();
  v_in          uuid := gen_random_uuid();
BEGIN
  SELECT * INTO v_req FROM rep_team_payment_requests
   WHERE id = p_request AND org_id = p_org
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'state_changed', 'state', v_req.status);
  END IF;

  v_general     := club_general_ledger(p_org);
  v_team_ledger := club_team_ledger(p_org, v_req.team_id);

  IF v_req.request_type = 'payment_to_org' THEN
    -- To club: the team pays the club.
    v_from := v_team_ledger; v_from_words := p_team_words;
    v_to   := v_general;     v_to_words   := p_club_words;
  ELSE
    -- From club: the club pays the team.
    v_from := v_general;     v_from_words := p_club_words;
    v_to   := v_team_ledger; v_to_words   := p_team_words;
  END IF;

  INSERT INTO accounting_entries
    (id, ledger_id, entry_date, description, amount, entry_type, status, category, linked_entry_id,
     source_module, source_entity_id, payment_method, created_by)
  VALUES
    (v_out, v_from, p_on, v_from_words, v_req.amount, 'transfer_out', 'posted', p_category, v_in,
     'rep_payment_request', p_request, p_method_word, p_actor),
    (v_in,  v_to,   p_on, v_to_words,   v_req.amount, 'transfer_in',  'posted', p_category, v_out,
     'rep_payment_request', p_request, p_method_word, p_actor);

  UPDATE rep_team_payment_requests
     SET status = 'approved', reviewed_by = p_actor, reviewed_at = now(), updated_at = now(),
         paid_on = p_on, paid_method = p_method, paid_reference = p_reference,
         accounting_entry_id = v_out
   WHERE id = p_request;

  RETURN jsonb_build_object('ok', true, 'entryId', v_out, 'teamId', v_req.team_id);
END;
$$;

-- Club: reverse an approval. Both lines voided with the reason; the request is closed as `reversed`.
CREATE OR REPLACE FUNCTION public.club_request_reverse(
  p_request uuid,
  p_org     uuid,
  p_actor   uuid,
  p_reason  text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_req rep_team_payment_requests%ROWTYPE;
  v_ids uuid[];
BEGIN
  SELECT * INTO v_req FROM rep_team_payment_requests
   WHERE id = p_request AND org_id = p_org
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;
  IF v_req.status <> 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'state_changed', 'state', v_req.status);
  END IF;
  -- Approved before 3a: the approval threw its entry id away. Refuse; never guess the pair.
  IF v_req.accounting_entry_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unlinked');
  END IF;

  v_ids := club_void_entry_pair(v_req.accounting_entry_id, p_reason, p_actor);

  UPDATE rep_team_payment_requests
     SET status = 'reversed', reversed_at = now(), reversed_by = p_actor, reversed_reason = p_reason,
         updated_at = now()
   WHERE id = p_request;

  RETURN jsonb_build_object('ok', true, 'voided', to_jsonb(v_ids), 'teamId', v_req.team_id);
END;
$$;

-- Club: void a transfer between the club's OWN books (C13). Both halves, one reason. Refuses a
-- transfer that touches a team's book (C12) and a line written by an allocation, a request or a
-- house-league fee — those are changed where they came from, never on the ledger.
-- Extra codes: not_a_transfer · already_void · team_book · from_a_source.
CREATE OR REPLACE FUNCTION public.club_transfer_void(
  p_entry  uuid,
  p_org    uuid,
  p_actor  uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_e   accounting_entries%ROWTYPE;
  v_p   accounting_entries%ROWTYPE;
  v_bad integer;
  v_ids uuid[];
BEGIN
  SELECT e.* INTO v_e
    FROM accounting_entries e
    JOIN accounting_ledgers l ON l.id = e.ledger_id
   WHERE e.id = p_entry AND l.org_id = p_org;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;
  IF v_e.entry_type NOT IN ('transfer_in', 'transfer_out') OR v_e.linked_entry_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_a_transfer');
  END IF;

  PERFORM 1 FROM accounting_entries WHERE id IN (p_entry, v_e.linked_entry_id) ORDER BY id FOR UPDATE;
  SELECT * INTO v_e FROM accounting_entries WHERE id = p_entry;
  SELECT * INTO v_p FROM accounting_entries WHERE id = v_e.linked_entry_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'not_a_transfer'); END IF;

  IF v_e.status = 'void' OR v_p.status = 'void' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_void');
  END IF;

  SELECT count(*) INTO v_bad FROM accounting_ledgers
   WHERE id IN (v_e.ledger_id, v_p.ledger_id) AND (org_id <> p_org OR entity_type = 'team');
  IF v_bad > 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'team_book'); END IF;

  IF v_e.source_module IS NOT NULL OR v_p.source_module IS NOT NULL
     OR coalesce(v_e.category, '') IN ('rep_allocation', 'team_payment_to_org', 'team_charge_to_org')
     OR coalesce(v_p.category, '') IN ('rep_allocation', 'team_payment_to_org', 'team_charge_to_org')
     OR EXISTS (SELECT 1 FROM rep_allocation_installments WHERE accounting_entry_id IN (v_e.id, v_p.id))
     OR EXISTS (SELECT 1 FROM rep_team_payment_requests  WHERE accounting_entry_id IN (v_e.id, v_p.id))
  THEN
    RETURN jsonb_build_object('ok', false, 'code', 'from_a_source');
  END IF;

  v_ids := club_void_entry_pair(p_entry, p_reason, p_actor);
  RETURN jsonb_build_object('ok', true, 'voided', to_jsonb(v_ids));
END;
$$;

-- Club: merge one of the club's payees into another (C01). Every line that names it moves to the one
-- kept, then it is removed — one step, so a line written in between cannot be left pointing at a
-- payee that is gone. The club's payees only (team_id IS NULL); a team's payees are the coach's.
-- Codes: not_found · same_payee.
CREATE OR REPLACE FUNCTION public.club_payee_merge(p_org uuid, p_from uuid, p_into uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_found    integer;
  v_entries  integer;
  v_expenses integer;
BEGIN
  IF p_from = p_into THEN RETURN jsonb_build_object('ok', false, 'code', 'same_payee'); END IF;

  PERFORM 1 FROM org_payees WHERE id IN (p_from, p_into) ORDER BY id FOR UPDATE;
  SELECT count(*) INTO v_found FROM org_payees
   WHERE id IN (p_from, p_into) AND org_id = p_org AND team_id IS NULL;
  IF v_found <> 2 THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;

  UPDATE accounting_entries SET payee_id = p_into, updated_at = now() WHERE payee_id = p_from;
  GET DIAGNOSTICS v_entries = ROW_COUNT;
  UPDATE rep_team_expenses SET payee_id = p_into WHERE payee_id = p_from;
  GET DIAGNOSTICS v_expenses = ROW_COUNT;
  DELETE FROM org_payees WHERE id = p_from;

  RETURN jsonb_build_object('ok', true, 'moved', v_entries + v_expenses, 'entries', v_entries, 'expenses', v_expenses);
END;
$$;

-- Club: claim a reminder wave before a single email goes (Ask 4; found by /review 2026-10-01). Two
-- sends a breath apart both read "nothing sent in the last minute" and both emailed every coach. The
-- claim holds a per-club lock for its own transaction, so a second claim waits for the first, sees its
-- wave and refuses. The app sends only after the claim, then writes what actually went (or removes the
-- wave when nothing did). The single-team variant ("Remind 16U Girls") is refused only by a wave that
-- reached that team, as "last sent" reads it. Codes: just_sent.
CREATE OR REPLACE FUNCTION public.club_reminder_wave_claim(
  p_org uuid, p_actor uuid, p_team uuid, p_team_ids uuid[], p_installment_count integer, p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_last timestamptz;
  v_id   uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('club_reminder_wave:' || p_org::text, 0));

  SELECT max(sent_at) INTO v_last FROM rep_allocation_reminder_waves
   WHERE org_id = p_org AND (p_team IS NULL OR p_team = ANY (team_ids));
  IF v_last IS NOT NULL AND v_last > now() - interval '60 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'just_sent');
  END IF;

  INSERT INTO rep_allocation_reminder_waves
    (org_id, sent_by, team_id, team_ids, recipient_count, installment_count, amount)
  VALUES (p_org, p_actor, p_team, coalesce(p_team_ids, '{}'), 0, p_installment_count, p_amount)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'waveId', v_id);
END;
$$;

-- Server-only (mig 311's rule): the service role calls these; the browser key cannot.
REVOKE ALL ON FUNCTION
  public.club_general_ledger(uuid),
  public.club_team_ledger(uuid, uuid),
  public.club_void_entry_pair(uuid, text, uuid),
  public.club_installment_receive(uuid, uuid, uuid, text, date, text, text, text, text, text, text),
  public.club_installment_undo(uuid, uuid, uuid, text),
  public.club_request_approve(uuid, uuid, uuid, date, text, text, text, text, text, text),
  public.club_request_reverse(uuid, uuid, uuid, text),
  public.club_transfer_void(uuid, uuid, uuid, text),
  public.club_payee_merge(uuid, uuid, uuid),
  public.club_reminder_wave_claim(uuid, uuid, uuid, uuid[], integer, numeric)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.club_general_ledger(uuid),
  public.club_team_ledger(uuid, uuid),
  public.club_void_entry_pair(uuid, text, uuid),
  public.club_installment_receive(uuid, uuid, uuid, text, date, text, text, text, text, text, text),
  public.club_installment_undo(uuid, uuid, uuid, text),
  public.club_request_approve(uuid, uuid, uuid, date, text, text, text, text, text, text),
  public.club_request_reverse(uuid, uuid, uuid, text),
  public.club_transfer_void(uuid, uuid, uuid, text),
  public.club_payee_merge(uuid, uuid, uuid),
  public.club_reminder_wave_claim(uuid, uuid, uuid, uuid[], integer, numeric)
  TO service_role;

COMMIT;

-- Verify (dev, then prod):
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'rep_allocation_installments'
--      AND column_name IN ('sent_on','sent_method','sent_reference','sent_by','sent_at','paid_on',
--                          'paid_method','paid_reference','undone_at','undone_by','undone_reason');  -- 11 rows
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'rep_team_payment_requests_status_check';
--     -- … 'reversed' …
--   SELECT proname FROM pg_proc WHERE proname LIKE 'club\_%' ESCAPE '\' ORDER BY 1;               -- 10 rows
--   SELECT to_regclass('public.rep_allocation_reminder_waves');                                     -- not null
