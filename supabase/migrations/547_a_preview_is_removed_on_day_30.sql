-- 547_a_preview_is_removed_on_day_30.sql
--
-- Club Website Track P, Session P4 (owner rulings T11–T13, 2026-11-25; drawing Tx3So1rUqL6shn7CzM93Zr, tab 7; /legal's
-- Track P review, findings 3–4). Adds what the removal, the ended page and the one email need. SCHEDULES NOTHING: the
-- nightly call that uses `remove_due_preview` is migration 548, its own commit (shared automation, the owner's go given
-- in conversation 2026-11-26, AGENCY_RULES 2026-09-26).
--
--   1. remove_due_preview(org)   — the ONE step that removes a preview by itself. It takes the claim's own locks in the
--                                  claim's order (the club, then its record), re-checks under them that the club is still
--                                  a preview, unclaimed, not removed and past its removal day, and deletes it — all in one
--                                  transaction, so a claim and a removal can never both land. Refusals PV030–PV033.
--   2. The removal record         — the AFTER DELETE stamp (535/540) now also writes ONE `preview_removed` row to
--                                  platform_audit_log, however the preview goes (this step, Remove now, platform admin's
--                                  Delete): name, address, who made it, meeting, logo source, made, removed. No person,
--                                  no sample rows, no files (/legal finding 4).
--   3. preview_email_consents     — the one email's consent record (/legal finding 3, CASL s. 13): the address, the club's
--                                  name, the role, the day it was given in person, who recorded it, the send. NO name.
--                                  One per preview. Deleted three years after the send (purge_preview_email_consents).
--   4. email_address_stops        — an unsubscribe keyed to the ADDRESS (/legal finding 3): it outlives the deleted preview
--                                  and stops every promotional email FieldLogicHQ sends to it (owner 2026-11-26).
--
-- Error codes: PV030 not_a_preview · PV031 preview_claimed · PV032 preview_already_removed · PV033 preview_not_due.

-- ── 1. The removal step ───────────────────────────────────────────────────────────────────────────────────────────────
-- The removal day is the meeting's day in the club's zone plus 30 (lib/prospect-clubs.ts removalDay, REMOVAL_AFTER_DAYS =
-- 30; the zone is ORG_TIME_ZONE, America/Toronto). It is never stored: moving the meeting moves it (T11).
-- The tables deleted before the club are platform admin's Delete's own list, in its order (the club's held time and
-- schedules name its facilities; billing records may not cascade). tests/unit/preview-club-p4-guard.test.ts holds the
-- two lists equal.
CREATE OR REPLACE FUNCTION public.remove_due_preview(p_org_id uuid, p_actor text DEFAULT 'cron-scheduler')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_org_id   uuid;
  v_is_prev  boolean;
  v_rec      public.organization_previews%ROWTYPE;
  v_due      date;
  v_today    date := (now() AT TIME ZONE 'America/Toronto')::date;
BEGIN
  -- The claim's lock order (claim_preview_club, mig 540): the club row first, then its record.
  SELECT o.id, o.is_preview INTO v_org_id, v_is_prev FROM public.organizations o WHERE o.id = p_org_id FOR UPDATE;
  SELECT p.* INTO v_rec FROM public.organization_previews p WHERE p.org_id = p_org_id FOR UPDATE;

  IF v_rec.org_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PV030', MESSAGE = 'not_a_preview';
  END IF;
  IF v_rec.claimed_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PV031', MESSAGE = 'preview_claimed';
  END IF;
  IF v_rec.removed_at IS NOT NULL OR v_org_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PV032', MESSAGE = 'preview_already_removed';
  END IF;
  IF v_is_prev IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = 'PV030', MESSAGE = 'not_a_preview';
  END IF;
  v_due := (v_rec.meeting_at AT TIME ZONE 'America/Toronto')::date + 30;
  IF v_due > v_today THEN
    RAISE EXCEPTION USING ERRCODE = 'PV033', MESSAGE = 'preview_not_due';
  END IF;

  -- The removal record (section 2) names who ran the removal, and that it was the day-30 removal (not a Remove now).
  PERFORM set_config('fieldlogichq.preview_removed_by', coalesce(nullif(btrim(p_actor), ''), 'cron-scheduler'), true);
  PERFORM set_config('fieldlogichq.preview_removal_job', 'on', true);

  DELETE FROM public.club_schedules WHERE org_id = p_org_id;
  DELETE FROM public.org_time_blocks WHERE org_id = p_org_id;
  DELETE FROM public.org_venue_facilities WHERE org_id = p_org_id;
  DELETE FROM public.billing_retained_records WHERE org_id = p_org_id;
  DELETE FROM public.billing_retention_intents WHERE org_id = p_org_id;
  DELETE FROM public.organizations WHERE id = p_org_id;

  RETURN jsonb_build_object('org_id', p_org_id, 'slug', v_rec.org_slug, 'name', v_rec.org_name, 'due', v_due);
END;
$$;
REVOKE ALL ON FUNCTION public.remove_due_preview(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_due_preview(uuid, text) TO service_role;
COMMENT ON FUNCTION public.remove_due_preview(uuid, text) IS
  'Track P (mig 547, T11): removes ONE preview 30 days after its meeting, in one transaction under the claim''s locks: refuses a club that is not a preview (PV030), claimed (PV031), already removed (PV032) or not yet due (PV033). Deletes Delete''s pre-cascade tables, then the club (the cascade takes the sample). Files are the caller''s, after (lib/preview-removal-server.ts).';

-- ── 2. The removal record, on every removal ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.organization_previews_mark_removed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_rec public.organization_previews%ROWTYPE;
BEGIN
  UPDATE public.organization_previews p
     SET removed_at = now(), updated_at = now(), claim_code = NULL
   WHERE p.org_id = OLD.id AND p.claimed_at IS NULL AND p.removed_at IS NULL
  RETURNING p.* INTO v_rec;

  IF v_rec.org_id IS NOT NULL THEN
    -- org_id NULL: the club row is gone (its FK would refuse). The record holds no person (/legal finding 4).
    INSERT INTO public.platform_audit_log (actor_email, org_id, action, field, old_value, new_value, reason)
    VALUES (
      coalesce(nullif(current_setting('fieldlogichq.preview_removed_by', true), ''), 'platform-admin'),
      NULL,
      'preview_removed',
      'org_slug',
      to_jsonb(v_rec.org_slug),
      jsonb_build_object(
        'orgId', v_rec.org_id,
        'name', v_rec.org_name,
        'slug', v_rec.org_slug,
        'madeBy', (SELECT u.email FROM auth.users u WHERE u.id = v_rec.made_by),
        'meetingAt', v_rec.meeting_at,
        'logoSource', v_rec.logo_source_url,
        'madeAt', v_rec.created_at,
        'removedAt', v_rec.removed_at,
        'how', CASE WHEN current_setting('fieldlogichq.preview_removal_job', true) = 'on'
                    THEN 'day_30' ELSE 'removed_now' END
      ),
      NULL
    );
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.organization_previews_mark_removed() FROM PUBLIC, anon, authenticated;

-- ── 3. The one email's consent record ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.preview_email_consents (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id       uuid NOT NULL,
  org_name     text NOT NULL CHECK (char_length(btrim(org_name)) BETWEEN 1 AND 200),
  email        text NOT NULL CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 320 AND position('@' IN email) > 1),
  role         text NOT NULL CHECK (role IN ('president', 'vice_president', 'secretary', 'treasurer', 'registrar', 'board_member')),
  given_on     date NOT NULL,
  given_how    text NOT NULL DEFAULT 'in_person' CHECK (given_how = 'in_person'),
  recorded_by  text NOT NULL,
  sent_at      timestamptz NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preview_email_consents_one_per_preview UNIQUE (org_id)
);
ALTER TABLE public.preview_email_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.preview_email_consents FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preview_email_consents TO service_role;
COMMENT ON TABLE public.preview_email_consents IS
  'Track P (mig 547, T13; /legal finding 3, CASL s. 13 puts the proof on us): the one email''s consent record. The address, the club''s name, the person''s ROLE (an officer: implied consent s. 10(9)(c) rests on it; no "Other"), the day it was given (the meeting day), how (in person), which staff member recorded it, and the send. NEVER the person''s name. One per preview (the one email). No FK on org_id (outlives the club). Deleted three years after the send by purge_preview_email_consents (the nightly removal calls it); a row whose send failed is deleted at once.';

-- ── 4. The address-keyed stop ─────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_address_stops (
  email       text PRIMARY KEY CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 320 AND position('@' IN email) > 1),
  source      text NOT NULL CHECK (source IN ('preview_link')),
  stopped_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_address_stops ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_address_stops FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_address_stops TO service_role;
COMMENT ON TABLE public.email_address_stops IS
  'Track P (mig 547; /legal finding 3; owner 2026-11-26): "no more email from FieldLogicHQ" for an ADDRESS, from the unsubscribe in the one preview email. Keyed to the address alone so it outlives the deleted preview and works from a forwarded copy. Read by every promotional send FieldLogicHQ makes (the preview email and sendMarketingEmail). Kept as the address only, for as long as we send any promotional email; source = the email it came from.';

-- ── 5. Three years after the send ─────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_preview_email_consents()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_n integer;
BEGIN
  DELETE FROM public.preview_email_consents c
   WHERE coalesce(c.sent_at, c.created_at) < now() - interval '3 years';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_preview_email_consents() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_preview_email_consents() TO service_role;
COMMENT ON FUNCTION public.purge_preview_email_consents() IS
  'Track P (mig 547; /legal finding 4): deletes the one email''s consent records three years after the send. Called by the nightly removal (lib/preview-removal-server.ts).';
