-- 535 — A club made for a meeting: the preview marker (Club Website Track P, Session P1; owner ruling T1, 2026-11-25).
--
-- A preview is a prospect's own club site built before a sales meeting: their name, web address, logo and colours over a
-- fixed made-up sample, on production, with NO people (T3). It is claimed in the room (the club's, a customer from that
-- day, T10) or removed 30 days after the meeting (T11). Nothing makes one yet: Session P2 builds the one creation step.
--
-- 1. organizations.is_preview — THE marker. Every count, list, search and send that reads organizations reads it
--    (lib/preview-org.ts; tests/unit/preview-org-guard.test.ts holds the code to it). App code never writes it: the
--    trigger in 3 keeps it equal to "this club has an unclaimed preview row".
-- 2. organization_previews — what the marker carries, one row per preview ever made. KEPT after a claim (Prospect clubs
--    keeps one row for it; "Came from a preview") and after a removal (the list's Removed count and the 90-day "This
--    preview has ended" page, T12, read it after the club is gone). So org_id has NO foreign key, and the club's slug and
--    name are copied in (the pattern of mig 451). The removal date is not stored: it is the meeting's day + 30, so
--    moving the meeting moves it (T11) and the two cannot drift. The plan a claimer came for is read live from the club.
--    The claim code is Session P3's (its own migration).
-- 3. Triggers: the row keeps the marker in step (insert, and a change of claimed_at); a removed club stamps removed_at on
--    its unclaimed row. Deleting a preview ROW by hand leaves the marker true on purpose: the unsafe direction is a
--    preview that stops being one. T3 held by the database: a club with people never becomes a preview (made, or a
--    claim undone, or the marker written directly: PV001), the record must name a real club (PV002) and stays with it
--    (PV004), nobody joins an open preview (PV003, row-locked against the people check), and a preview holds no Stripe
--    customer or subscription (CHECK). Amended 2026-11-25 after /db, before any commit; re-applied.
--
-- Who can change is_preview from outside: nobody. `authenticated` and `anon` hold no grant on organizations (mig 311);
-- a preview has no members, so is_org_member() is false for everyone. If organizations is ever granted to
-- `authenticated`, that grant must REVOKE UPDATE (is_preview).
--
-- Re-runnable. A NEW migration: 530 to 534 are applied to dev and pending on production.

BEGIN;

-- organizations is read on every request: wait briefly for its lock, never queue behind a long transaction.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS is_preview boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organizations.is_preview IS
  'Track P (mig 535): this club is a preview made for a sales meeting, not a customer. Kept equal to "has an unclaimed organization_previews row" by trigger; app code never writes it. Read by every count, list, search and send (lib/preview-org.ts).';

CREATE TABLE IF NOT EXISTS public.organization_previews (
  org_id          uuid PRIMARY KEY,
  org_slug        text NOT NULL,
  org_name        text NOT NULL,
  meeting_at      timestamptz NOT NULL,
  made_by         uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  logo_source_url text NOT NULL,
  claimed_at      timestamptz NULL,
  claimed_by      uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  removed_at      timestamptz NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_previews_logo_source_is_web
    CHECK (logo_source_url ~* '^https?://' AND length(logo_source_url) <= 2000),
  CONSTRAINT organization_previews_claimer_needs_claim
    CHECK (claimed_by IS NULL OR claimed_at IS NOT NULL),
  CONSTRAINT organization_previews_removed_or_claimed
    CHECK (removed_at IS NULL OR claimed_at IS NULL)
);

COMMENT ON TABLE public.organization_previews IS
  'Track P (mig 535): one row per preview club ever made, kept after its claim and after its removal. No FK on org_id on purpose (the record outlives the club). Service role only.';

-- The ended page (T12) finds the record by the old web address.
CREATE INDEX IF NOT EXISTS organization_previews_org_slug_idx ON public.organization_previews (lower(org_slug));

ALTER TABLE public.organization_previews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_previews FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_previews TO service_role;

-- ── 3a. The row keeps the marker ──────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.organization_previews_keep_marker()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- The record names a club that exists (no FK, gotcha: a wrong id would otherwise set no marker and say nothing).
  -- The record belongs to one club for life (no FK; a moved row would leave the marker behind on the first club).
  IF TG_OP = 'UPDATE' AND NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION USING ERRCODE = 'PV004', MESSAGE = 'preview_org_is_fixed';
  END IF;
  -- Lock the club's row first, so nobody can join it between the people check below and this write (PV003 reads it).
  PERFORM 1 FROM public.organizations o WHERE o.id = NEW.org_id FOR UPDATE;
  IF TG_OP = 'INSERT' AND NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PV002', MESSAGE = 'preview_org_missing';
  END IF;
  -- T3, whenever the marker would become true (made, or a claim undone): a club with people in it is never a preview.
  IF NEW.claimed_at IS NULL AND (TG_OP = 'INSERT' OR OLD.claimed_at IS NOT NULL)
     AND EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = NEW.org_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'preview_org_has_people';
  END IF;
  NEW.updated_at := now();
  UPDATE public.organizations o
     SET is_preview = (NEW.claimed_at IS NULL)
   WHERE o.id = NEW.org_id
     AND o.is_preview IS DISTINCT FROM (NEW.claimed_at IS NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_previews_keep_marker ON public.organization_previews;
CREATE TRIGGER organization_previews_keep_marker
  BEFORE INSERT OR UPDATE OF claimed_at, org_id ON public.organization_previews
  FOR EACH ROW EXECUTE FUNCTION public.organization_previews_keep_marker();

-- ── 3b. A removed club stamps its record ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.organization_previews_mark_removed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.is_preview THEN
    UPDATE public.organization_previews p
       SET removed_at = now(), updated_at = now()
     WHERE p.org_id = OLD.id AND p.claimed_at IS NULL AND p.removed_at IS NULL;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS organization_previews_mark_removed ON public.organizations;
CREATE TRIGGER organization_previews_mark_removed
  AFTER DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.organization_previews_mark_removed();

-- ── 3c. Nobody joins an open preview (T3) ─────────────────────────────────────────────────────────────────────────────
-- The claim (Session P3) clears the marker in the same write BEFORE it seats the owner, so this never refuses a claim.
CREATE OR REPLACE FUNCTION public.organization_members_not_in_a_preview()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = NEW.organization_id AND o.is_preview FOR SHARE) THEN
    RAISE EXCEPTION USING ERRCODE = 'PV003', MESSAGE = 'preview_org_takes_no_people';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_members_not_in_a_preview ON public.organization_members;
CREATE TRIGGER organization_members_not_in_a_preview
  BEFORE INSERT OR UPDATE OF organization_id ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.organization_members_not_in_a_preview();

-- ── 3d. A preview is never billed: no Stripe customer or subscription while it is one ─────────────────────────────────
-- Two lists are "safe by construction" because of this (the sales-tax wait, Stripe watch): the database holds it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_preview_has_no_stripe') THEN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_preview_has_no_stripe
      CHECK (NOT is_preview OR (stripe_customer_id IS NULL AND stripe_subscription_id IS NULL));
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.organization_previews_keep_marker() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.organization_previews_mark_removed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.organization_members_not_in_a_preview() FROM PUBLIC, anon, authenticated;

-- ── 3e. The marker itself holds T3, however it is written (the creation step sets it on the new club directly) ─────────
CREATE OR REPLACE FUNCTION public.organizations_preview_has_no_people()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.is_preview AND (TG_OP = 'INSERT' OR NOT OLD.is_preview)
     AND EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = NEW.id) THEN
    RAISE EXCEPTION USING ERRCODE = 'PV001', MESSAGE = 'preview_org_has_people';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_preview_has_no_people ON public.organizations;
CREATE TRIGGER organizations_preview_has_no_people
  BEFORE INSERT OR UPDATE OF is_preview ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.organizations_preview_has_no_people();

REVOKE ALL ON FUNCTION public.organizations_preview_has_no_people() FROM PUBLIC, anon, authenticated;

COMMIT;
