-- ---------------------------------------------------------------
-- Migration 525 — Board Ready Stage 6, Part 1: the club's sponsorships place stores its sponsors as businesses with places,
-- its packages, its invoice details, the sponsorship fee choice, and owns one sponsorship form.
-- (Build prompt docs/projects/active/BOARD_READY_STAGE6_SPONSORSHIPS_BUILD_PROMPT.md Part 1; plan BOARD_READY_PLAN.md §5
-- Stage 6, round 1 asks 1, 6, 7, 8, 9, 11, 12 and round 2 asks 3, 4, 5, all ruled 2026-11-22.)
--
-- WHAT CHANGES
--   club_sponsors            NEW. A business is kept ONCE per club (ask 1, the 2026-10-27 one-list ruling): its name as it
--                            should appear, logo, link, and the business details the sponsorship form asks (contact, email,
--                            phone, invoice address — Part 2 fills them). Up to 100 per club (ask 11), held by a trigger.
--   club_sponsor_places      NEW. Where a business shows: a kind (club · division · team · tournament; a club event joins
--                            later as a new kind, nothing else changes), which one (null for the club), and a last day
--                            (inclusive, club zone — the shipped sponsorEnded rule). `source` says whether the club typed it
--                            or a deal set it (Part 2 adds the deal table and this column's foreign key). A place whose
--                            division, team or tournament is deleted goes with it (triggers below).
--   club_sponsorship_packages NEW. Name, price before tax, the kind of place it is for, how many (null = no limit), the last
--                            day each deal starts with, the logo switch (the one item the product acts on), the other
--                            deliverables (an ordered list), an optional PDF (club-form-files bucket), archived (never deleted).
--   club_sponsorship_settings NEW, one row per club: "Registered for GST/HST" and the number (off by default, ask 9), how
--                            businesses pay (e-transfer address, cheques payable to, days to pay), the contact for sponsors.
--                            The mailing address is NOT here: Invoice details edits org_public_site_content.mailing_address
--                            (mig 454), the one column the offer email's foot and every invoice read.
--   org_payment_accounts.sponsor_fee_payer  NEW, 'club' (default) | 'sponsor' — the Payouts card's "Processing fee on
--                            sponsorships" (ask 3, ruled 2026-11-22). fee_payer stays the registration choice, unchanged.
--   club_forms               WIDENED: a form may be owned by the club itself (owner_table 'organizations', owner_id = org_id)
--                            for the sponsorship form (ask 8), always subject_kind 'business'; a season's form is always
--                            'child_signup'. The UNIQUE (owner_table, owner_id) stays, so a club owns exactly one. Answers,
--                            ticks and files keep their league_registrations subject until Part 2 adds the deal subject.
--   THE MOVE                 Every sponsor in org_public_site_content.sponsors becomes a business with one place, "The club",
--                            keeping its id (a non-uuid fixture id gets a fixed uuid derived from it), order, logo, link and
--                            last day, and NO reason on record for emailing it (/legal F5). Counts before it ran: production 0
--                            clubs / 0 rows, dev 2 clubs / 6 rows (owner's yes 2026-11-22). The old column and its CHECK stay
--                            until Part 4 retires them after the new code serves (the 509/511 order). Re-runnable: a sponsor
--                            already moved is skipped by id.
--
-- RLS on, no policies, nothing to anon/authenticated: every read and write goes through the server (service role), as the
-- club money tables. Re-runnable.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. The businesses ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_sponsors (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  logo_url         text CHECK (logo_url IS NULL OR char_length(logo_url) BETWEEN 1 AND 500),
  link             text CHECK (link IS NULL OR (link ~ '^https://' AND char_length(link) <= 500)),
  contact_name     text CHECK (contact_name IS NULL OR char_length(btrim(contact_name)) BETWEEN 1 AND 120),
  contact_email    text CHECK (contact_email IS NULL OR char_length(contact_email) BETWEEN 3 AND 254),
  phone            text CHECK (phone IS NULL OR char_length(btrim(phone)) BETWEEN 1 AND 40),
  invoice_street   text CHECK (invoice_street IS NULL OR char_length(btrim(invoice_street)) BETWEEN 1 AND 200),
  invoice_city     text CHECK (invoice_city IS NULL OR char_length(btrim(invoice_city)) BETWEEN 1 AND 100),
  invoice_province text CHECK (invoice_province IS NULL OR invoice_province ~ '^[A-Z]{2}$'),
  invoice_postal   text CHECK (invoice_postal IS NULL OR char_length(btrim(invoice_postal)) BETWEEN 1 AND 20),
  position         integer NOT NULL DEFAULT 0,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS club_sponsors_org_idx ON public.club_sponsors (org_id, position);

-- The list holds up to 100 (ask 11); 20 is the home strip's limit only, which the strip's reader holds.
CREATE OR REPLACE FUNCTION public.club_sponsors_cap()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('club_sponsors_cap:' || NEW.org_id::text));
  IF (SELECT count(*) FROM public.club_sponsors WHERE org_id = NEW.org_id) >= 100 THEN
    RAISE EXCEPTION 'club_sponsors_cap: a club keeps at most 100 sponsors' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.club_sponsors_cap() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS club_sponsors_cap ON public.club_sponsors;
CREATE TRIGGER club_sponsors_cap BEFORE INSERT ON public.club_sponsors FOR EACH ROW EXECUTE FUNCTION public.club_sponsors_cap();

-- ── 2. Where each business shows ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_sponsor_places (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sponsor_id  uuid NOT NULL REFERENCES public.club_sponsors(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('club', 'division', 'team', 'tournament')),
  target_id   uuid,
  ends_on     date,
  source      text NOT NULL DEFAULT 'typed' CHECK (source IN ('typed', 'deal')),
  deal_id     uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_sponsor_places_target CHECK ((kind = 'club') = (target_id IS NULL)),
  CONSTRAINT club_sponsor_places_source CHECK ((source = 'deal') = (deal_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS club_sponsor_places_sponsor_idx ON public.club_sponsor_places (sponsor_id);
CREATE INDEX IF NOT EXISTS club_sponsor_places_target_idx ON public.club_sponsor_places (org_id, kind, target_id);
-- A business is typed onto one spot once (a deal's place is the deal's, and Part 2 decides its own rule).
CREATE UNIQUE INDEX IF NOT EXISTS club_sponsor_places_typed_once
  ON public.club_sponsor_places (sponsor_id, kind, coalesce(target_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE source = 'typed';

-- A place goes with its division, team or tournament (the target has no foreign key: the kinds point at three tables).
CREATE OR REPLACE FUNCTION public.club_sponsor_places_target_gone()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  DELETE FROM public.club_sponsor_places WHERE kind = TG_ARGV[0] AND target_id = OLD.id;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_places_target_gone() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS club_sponsor_places_division_gone ON public.league_divisions;
CREATE TRIGGER club_sponsor_places_division_gone AFTER DELETE ON public.league_divisions
  FOR EACH ROW EXECUTE FUNCTION public.club_sponsor_places_target_gone('division');
DROP TRIGGER IF EXISTS club_sponsor_places_team_gone ON public.league_teams;
CREATE TRIGGER club_sponsor_places_team_gone AFTER DELETE ON public.league_teams
  FOR EACH ROW EXECUTE FUNCTION public.club_sponsor_places_target_gone('team');
DROP TRIGGER IF EXISTS club_sponsor_places_tournament_gone ON public.tournaments;
CREATE TRIGGER club_sponsor_places_tournament_gone AFTER DELETE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.club_sponsor_places_target_gone('tournament');

-- ── 3. Packages ───────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_sponsorship_packages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  price          numeric(10,2) NOT NULL CHECK (price >= 0 AND price <= 1000000),
  place_kind     text NOT NULL CHECK (place_kind IN ('club', 'division', 'team', 'tournament')),
  how_many       integer CHECK (how_many IS NULL OR how_many BETWEEN 1 AND 999),
  shows_until    date,
  logo_on_site   boolean NOT NULL DEFAULT true,
  items          jsonb NOT NULL DEFAULT '[]'::jsonb
                 CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) <= 20),
  document_path  text,
  document_name  text CHECK (document_name IS NULL OR char_length(document_name) BETWEEN 1 AND 200),
  document_size  integer CHECK (document_size IS NULL OR document_size BETWEEN 1 AND 8388608),
  archived_at    timestamptz,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_sponsorship_packages_document_whole
    CHECK ((document_path IS NULL) = (document_name IS NULL) AND (document_path IS NULL) = (document_size IS NULL))
);
CREATE INDEX IF NOT EXISTS club_sponsorship_packages_org_idx ON public.club_sponsorship_packages (org_id, created_at);

-- ── 4. Invoice details ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_sponsorship_settings (
  org_id                 uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  gst_hst_registered     boolean NOT NULL DEFAULT false,
  gst_hst_number         text CHECK (gst_hst_number IS NULL OR gst_hst_number ~ '^[0-9]{9}RT[0-9]{4}$'),
  etransfer_to           text CHECK (etransfer_to IS NULL OR char_length(etransfer_to) BETWEEN 3 AND 254),
  cheques_payable_to     text CHECK (cheques_payable_to IS NULL OR char_length(btrim(cheques_payable_to)) BETWEEN 1 AND 120),
  payment_due_days       integer NOT NULL DEFAULT 30 CHECK (payment_due_days BETWEEN 0 AND 120),
  sponsor_contact_name   text CHECK (sponsor_contact_name IS NULL OR char_length(btrim(sponsor_contact_name)) BETWEEN 1 AND 120),
  sponsor_contact_email  text CHECK (sponsor_contact_email IS NULL OR char_length(sponsor_contact_email) BETWEEN 3 AND 254),
  updated_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  -- Registered means a number is on file: an invoice that charges GST/HST must print it.
  CONSTRAINT club_sponsorship_settings_registered_number CHECK (NOT gst_hst_registered OR gst_hst_number IS NOT NULL)
);

-- ── 5. Who pays the card fee on a sponsorship ─────────────────────────────────────────────────────
ALTER TABLE public.org_payment_accounts
  ADD COLUMN IF NOT EXISTS sponsor_fee_payer text NOT NULL DEFAULT 'club';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_payment_accounts_sponsor_fee_payer_chk') THEN
    ALTER TABLE public.org_payment_accounts
      ADD CONSTRAINT org_payment_accounts_sponsor_fee_payer_chk CHECK (sponsor_fee_payer IN ('club', 'sponsor'));
  END IF;
END $$;

-- ── 6. The club owns one sponsorship form ─────────────────────────────────────────────────────────
ALTER TABLE public.club_forms DROP CONSTRAINT IF EXISTS club_forms_owner_table_check;
ALTER TABLE public.club_forms ADD CONSTRAINT club_forms_owner_table_check
  CHECK (owner_table IN ('league_seasons', 'organizations'));
ALTER TABLE public.club_forms DROP CONSTRAINT IF EXISTS club_forms_owner_kind;
ALTER TABLE public.club_forms ADD CONSTRAINT club_forms_owner_kind CHECK (
  (owner_table = 'league_seasons' AND subject_kind = 'child_signup')
  OR (owner_table = 'organizations' AND subject_kind = 'business' AND owner_id = org_id));

-- ── 6b. The platform's published module matrix may name the new module ───────────────────────────
-- The matrix writes one row per MODULE_CATALOG key (lib/plan-module-entitlements.ts publishPlanModuleEntitlements). Its CHECK
-- still lists mig 062's seven keys, so a publish already failed on module_families (in the catalog since the Families book,
-- never added here); module_sponsorships would fail the same way. Both join it. No seed rows: a missing row reads the
-- plan-config default (getEffectivePlanModuleEntitlements).
ALTER TABLE public.platform_plan_module_entitlements DROP CONSTRAINT IF EXISTS platform_plan_module_entitlements_module_check;
ALTER TABLE public.platform_plan_module_entitlements ADD CONSTRAINT platform_plan_module_entitlements_module_check
  CHECK (module_key IN ('module_tournaments', 'module_communications', 'module_members', 'module_public_site',
    'module_house_league', 'module_accounting', 'module_rep_teams', 'module_families', 'module_sponsorships'));

-- ── 7. Grants ─────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.club_sponsors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_sponsor_places       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_sponsorship_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_sponsorship_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_sponsors, public.club_sponsor_places, public.club_sponsorship_packages,
  public.club_sponsorship_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_sponsors, public.club_sponsor_places,
  public.club_sponsorship_packages, public.club_sponsorship_settings TO service_role;

-- ── 8. The move ───────────────────────────────────────────────────────────────────────────────────
WITH old AS (
  SELECT c.org_id, e.value AS s, e.ordinality AS pos
  FROM public.org_public_site_content c
  CROSS JOIN LATERAL jsonb_array_elements(c.sponsors) WITH ORDINALITY AS e(value, ordinality)
  WHERE jsonb_typeof(c.sponsors) = 'array'
    -- Once per club: a club that already has a sponsor here was moved (a re-run never brings back one deleted since).
    AND NOT EXISTS (SELECT 1 FROM public.club_sponsors s WHERE s.org_id = c.org_id)
), shaped AS (
  -- One row per sponsor id: a list that repeats an id (or two id-less rows with one name) moves it once.
  SELECT DISTINCT ON (org_id, id) * FROM (
  SELECT org_id, pos,
    CASE WHEN s->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (s->>'id')::uuid
         ELSE md5(org_id::text || ':' || coalesce(s->>'id', s->>'name'))::uuid END AS id,
    left(btrim(s->>'name'), 80) AS name,
    nullif(s->>'logoUrl', '') AS logo_url,
    CASE WHEN s->>'link' ~ '^https://' THEN s->>'link' END AS link,
    CASE WHEN s->>'endsOn' ~ '^\d{4}-\d{2}-\d{2}$' THEN (s->>'endsOn')::date END AS ends_on
  FROM old
  WHERE char_length(btrim(coalesce(s->>'name', ''))) > 0
  ) t ORDER BY org_id, id, pos
), moved AS (
  INSERT INTO public.club_sponsors (id, org_id, name, logo_url, link, position)
  SELECT id, org_id, name, logo_url, link, pos::int FROM shaped
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
INSERT INTO public.club_sponsor_places (org_id, sponsor_id, kind, ends_on, source)
SELECT s.org_id, s.id, 'club', s.ends_on, 'typed' FROM shaped s JOIN moved m ON m.id = s.id;

COMMENT ON TABLE public.club_sponsors IS
  'A club''s sponsor, kept once (Board Ready Stage 6, mig 525): the business and its details. Where it shows is club_sponsor_places. At most 100 per club (trigger). Moved in from org_public_site_content.sponsors with no reason on record for emailing.';
COMMENT ON TABLE public.club_sponsor_places IS
  'Where a club sponsor shows (mig 525, ask 1): kind club|division|team|tournament, target_id (null for club; league_divisions / league_teams / tournaments id), ends_on = last day shown (inclusive, club zone). source typed = set on the Sponsors tab; deal = set by a paid deal (Part 2 adds the FK).';
COMMENT ON TABLE public.club_sponsorship_packages IS
  'A club''s sponsorship package (mig 525, asks 6 and 7): price before tax, the kind of place it is for, how many (null = no limit), the logo switch and the other deliverables (items: [{id,text}]), an optional PDF in club-form-files. Archived, never deleted.';
COMMENT ON TABLE public.club_sponsorship_settings IS
  'A club''s invoice details for sponsorships (mig 525, ask 9 and round 2 ask 4): GST/HST registration and number (stored without spaces), how businesses pay, the contact for sponsors. The mailing address is org_public_site_content.mailing_address.';
COMMENT ON COLUMN public.org_payment_accounts.sponsor_fee_payer IS
  'Who pays the card processing fee on a sponsorship payment (mig 525, ask 3 ruled 2026-11-22): club (default) | sponsor. fee_payer is the registration choice and never decides for sponsorships.';

COMMIT;
