-- 361 · House league sign-up, payments-ready: prices per age group, one early-bird date, the club's how-to-pay words,
-- a sign-up that covers several children, and each child's price recorded when they sign up
-- (Club Tier Stage 9b-1; owner rulings 2026-10-24 Q2 · Q5 · 9b·2 · 9b·9 · 9b·13, and 2026-10-25 "record the price at
-- sign-up").
--
-- ADDITIVE ONLY. No column is dropped or renamed; `auto_generate_fees` stays (dead, kept).
--
--   league_divisions.price / early_price   the division's own price and its early-bird amount (dollars). NULL price =
--                                          the season's `registration_fee`; NULL early_price = no early bird here.
--   league_divisions.note                  a short line a family reads when two divisions share an age group (9b·13).
--   league_seasons.early_bird_until        the ONE early-bird day for the season (the club's day, a plain date).
--   league_seasons.how_to_pay              the club's own words on how to pay; required before Open registration
--                                          whenever any price is above $0 (9b·9, enforced in the app and the route).
--   league_seasons.ask_email_consent       the form asks the unticked "may email me about future seasons" line.
--   league_registrations.signup_ref        one reference shared by every child signed up together (Q5).
--   league_registrations.signup_position   the child's place in that sign-up (1, 2, …), so a sign-up reads in order.
--   league_registrations.fee_amount        what this child pays, RECORDED at sign-up and never moved by a later price
--                                          edit. NULL = owes the season's price (every row before this migration, and a
--                                          row prod's old code writes before the promote).
--
-- The one fee write `club_league_fee_set` (mig 342) is redefined with the SAME signature to post the registration's
-- recorded amount, falling back to the season's price — so prod's old code calling it keeps working unchanged.
--
-- Backfill: every existing registration records the season price it owes today, so nothing it owes changes.
BEGIN;

ALTER TABLE public.league_divisions
  ADD COLUMN IF NOT EXISTS price       numeric(10,2),
  ADD COLUMN IF NOT EXISTS early_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS note        text;

ALTER TABLE public.league_divisions DROP CONSTRAINT IF EXISTS league_divisions_price_check;
ALTER TABLE public.league_divisions ADD CONSTRAINT league_divisions_price_check CHECK (
  (price IS NULL OR price >= 0) AND (early_price IS NULL OR early_price >= 0)
  AND (note IS NULL OR char_length(note) <= 120)
);

ALTER TABLE public.league_seasons
  ADD COLUMN IF NOT EXISTS early_bird_until  date,
  ADD COLUMN IF NOT EXISTS how_to_pay        text,
  ADD COLUMN IF NOT EXISTS ask_email_consent boolean NOT NULL DEFAULT true;

ALTER TABLE public.league_seasons DROP CONSTRAINT IF EXISTS league_seasons_how_to_pay_check;
ALTER TABLE public.league_seasons ADD CONSTRAINT league_seasons_how_to_pay_check CHECK (
  how_to_pay IS NULL OR char_length(how_to_pay) <= 1000
);

ALTER TABLE public.league_registrations
  ADD COLUMN IF NOT EXISTS signup_ref      text,
  ADD COLUMN IF NOT EXISTS signup_position smallint,
  ADD COLUMN IF NOT EXISTS fee_amount      numeric(10,2);

ALTER TABLE public.league_registrations DROP CONSTRAINT IF EXISTS league_registrations_fee_amount_check;
ALTER TABLE public.league_registrations ADD CONSTRAINT league_registrations_fee_amount_check CHECK (
  fee_amount IS NULL OR fee_amount >= 0
);

CREATE INDEX IF NOT EXISTS league_registrations_signup_ref_idx
  ON public.league_registrations (org_id, signup_ref) WHERE signup_ref IS NOT NULL;

-- Every existing registration records what it owes today: the season's price.
UPDATE public.league_registrations r
   SET fee_amount = s.registration_fee
  FROM public.league_seasons s
 WHERE s.id = r.season_id AND r.fee_amount IS NULL AND s.registration_fee IS NOT NULL;

-- The one fee write posts what THIS registration owes (mig 342's body, one amount changed).
CREATE OR REPLACE FUNCTION public.club_league_fee_set(
  p_org uuid, p_season uuid, p_registration uuid, p_paid boolean, p_actor uuid, p_day date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_reg public.league_registrations%ROWTYPE; v_season public.league_seasons%ROWTYPE;
  v_old public.accounting_entries%ROWTYPE; v_entry uuid; v_book uuid; v_amount numeric;
BEGIN
  SELECT * INTO v_reg FROM league_registrations
    WHERE id=p_registration AND org_id=p_org AND season_id=p_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;
  SELECT * INTO v_season FROM league_seasons WHERE id=p_season AND org_id=p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF p_paid AND v_reg.status IN ('declined','withdrawn') THEN
    RAISE EXCEPTION 'A declined or withdrawn registration cannot be marked paid';
  END IF;
  IF v_reg.fee_entry_id IS NOT NULL THEN
    SELECT * INTO v_old FROM accounting_entries WHERE id=v_reg.fee_entry_id FOR UPDATE;
  END IF;
  IF v_reg.registration_fee_paid IS NOT DISTINCT FROM p_paid THEN
    IF p_paid AND v_old.status='posted' THEN RETURN v_reg.fee_entry_id; END IF;
    IF NOT p_paid AND (v_old.id IS NULL OR v_old.status='void') THEN RETURN NULL; END IF;
  END IF;
  IF v_old.id IS NOT NULL AND v_old.status IN ('pending','posted') THEN
    PERFORM club_fee_void(v_old.id,p_actor,'Fee payment undone or corrected');
  END IF;
  -- What this registration owes: the amount recorded at sign-up, else the season's price (lib/league-price.ts).
  v_amount := coalesce(v_reg.fee_amount, v_season.registration_fee);
  IF p_paid AND coalesce(v_amount,0)>0 THEN
    v_book := club_league_season_ledger(p_org,p_season);
    v_entry := club_fee_post(v_book,'league_registration',p_registration,p_day,
      v_reg.player_first_name || ' ' || v_reg.player_last_name || ' — registration fee',
      v_amount,p_actor);
  ELSE v_entry := NULL; END IF;
  UPDATE league_registrations SET registration_fee_paid=p_paid,fee_entry_id=v_entry,updated_at=now()
    WHERE id=p_registration;
  RETURN v_entry;
END $$;
REVOKE ALL ON FUNCTION public.club_league_fee_set(uuid,uuid,uuid,boolean,uuid,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_league_fee_set(uuid,uuid,uuid,boolean,uuid,date) TO service_role;

COMMIT;
