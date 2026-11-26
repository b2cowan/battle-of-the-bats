-- 540 — Claim a club made for a meeting (Club Website Track P, Session P3; owner rulings T5, T7–T10, T14–T16,
-- 2026-11-25). Mig 535 made the marker and the record, mig 536 the one creation step. This is the room and the claim.
--
-- 1. organization_previews.claim_code — the code on the room card (T7). Six characters from 2–9 and A–Z without I and O
--    (no 0, O, 1 or I: it is read aloud). STORED so the owner's room window can show it and print it again (/legal
--    finding 5); it is never emailed. Cleared by the claim and by the removal stamp; a new code replaces the old one.
-- 2. preview_claim_tries — one row per WRONG code (T7): five in an hour for the club, or for the visitor across clubs,
--    rests the door for an hour (/legal: per club as well as per visitor, or a spread-out guess is unlimited). No FK:
--    rows are pruned after a day; the visitor is a one-way hash, never an address.
-- 3. preview_claim_records — the claim's own dated record, APPEND-ONLY (/legal finding 1: account, club, time, the exact
--    sentence shown, the code used; no IP; kept like the Terms records, mig 455). An undo is its own row.
-- 4. The sample becomes two reusable steps (preview_make_sample, preview_make_tournament), so an undo can put the
--    preview back as it was (T15) and Change the meeting can move the live game (tab 4). make_preview_club calls them;
--    what it makes is unchanged, row for row.
-- 5. The room's writes, each ONE transaction, service role only (the owner-only Prospect clubs routes call them):
--      preview_claim_door(slug, code, visitor)   the code page's read and check
--      claim_preview_club(...)                   THE CLAIM (T8, T14): all or nothing
--      undo_preview_claim(org, actor)            T15
--      move_preview_meeting(org, meeting_at)     the live game and the removal date move together
--      save_preview_score(org, home, away, final) the one write staff make in a preview (T5)
--    Refusals:
--      PV014 preview_meeting       (536's code, reused) the new meeting is past or more than 60 days out
--      PV020 preview_not_open      the preview is claimed, removed or gone
--      PV021 preview_code_wrong    the code does not match (the claim's own re-check of the pass)
--      PV022 claim_not_undoable    the club has a plan, a Stripe customer, other people or anything added
--      PV023 preview_not_claimed   nothing to undo
--      PV024 preview_game_missing  the live game is not there (a meeting moved past midnight, say)
--      PV025 preview_game_final    the game is marked final
--      PV026 preview_game_not_started
--      PV027 claimer_runs_a_club   the claiming account already runs a club (two claims at once from one account)
--
-- ⚠ The claim RESTAMPS organizations.created_at to the claim (T10: a customer from the claim day, in every count that
--   dates a club by it); the record keeps the day we made it (organization_previews.created_at).
--
-- Re-runnable.

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ── 1. The claim code ─────────────────────────────────────────────────────────────────────────────────────────────────
-- 32 characters, so each random byte maps without bias (256 = 8 × 32). The first six bytes of a v4 uuid are wholly
-- random (its version and variant bits sit in bytes 6 and 8), so one uuid gives the six characters.
CREATE OR REPLACE FUNCTION public.preview_claim_code()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE
  v_alpha constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_out   text := '';
  i int;
BEGIN
  FOR i IN 0..5 LOOP
    v_out := v_out || substr(v_alpha, (get_byte(v_bytes, i) % 32) + 1, 1);
  END LOOP;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.preview_claim_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_claim_code() TO service_role;

ALTER TABLE public.organization_previews ADD COLUMN IF NOT EXISTS claim_code text NULL DEFAULT public.preview_claim_code();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_previews_claim_code_shape') THEN
    ALTER TABLE public.organization_previews ADD CONSTRAINT organization_previews_claim_code_shape
      CHECK (claim_code IS NULL OR claim_code ~ '^[2-9A-HJ-NP-Z]{6}$');
  END IF;
END;
$$;

-- An existing open preview got its own code from the column default; a claimed or removed one holds none.
UPDATE public.organization_previews SET claim_code = NULL
 WHERE (claimed_at IS NOT NULL OR removed_at IS NOT NULL) AND claim_code IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_previews_code_only_while_open') THEN
    ALTER TABLE public.organization_previews ADD CONSTRAINT organization_previews_code_only_while_open
      CHECK (claim_code IS NULL OR (claimed_at IS NULL AND removed_at IS NULL));
  END IF;
END;
$$;

COMMENT ON COLUMN public.organization_previews.claim_code IS
  'Track P (mig 540, T7): the claim code on the room card. Six of 2-9 and A-Z without I and O. Stored so the owner''s room window shows and reprints it; never emailed. NULL once claimed or removed. New code = a fresh value (the old stops working).';

-- The removal stamp clears the code too (a removed preview has nothing to claim). 535's `IF OLD.is_preview` guard is
-- dropped on purpose: an unclaimed, unremoved record already means a marked club.
CREATE OR REPLACE FUNCTION public.organization_previews_mark_removed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.organization_previews p
     SET removed_at = now(), updated_at = now(), claim_code = NULL
   WHERE p.org_id = OLD.id AND p.claimed_at IS NULL AND p.removed_at IS NULL;
  RETURN OLD;
END;
$$;

-- ── 2. Wrong tries ────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.preview_claim_tries (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id      uuid NOT NULL,
  visitor_key text NOT NULL CHECK (char_length(visitor_key) BETWEEN 1 AND 128),
  tried_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS preview_claim_tries_org_idx ON public.preview_claim_tries (org_id, tried_at DESC);
CREATE INDEX IF NOT EXISTS preview_claim_tries_visitor_idx ON public.preview_claim_tries (visitor_key, tried_at DESC);
ALTER TABLE public.preview_claim_tries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.preview_claim_tries FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.preview_claim_tries TO service_role;
COMMENT ON TABLE public.preview_claim_tries IS
  'Track P (mig 540, T7): one row per wrong claim code. Five in an hour for a club, or for a visitor (a one-way hash, never an address) across clubs, rests the door for an hour. Pruned after a day. "Let them try again" in the room window deletes a club''s rows.';

-- ── 3. The claim record (append-only) ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.preview_claim_records (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind        text NOT NULL CHECK (kind IN ('claim', 'undo')),
  org_id      uuid NOT NULL,
  org_name    text NOT NULL,
  user_id     uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email  text NULL,
  box_text    text NULL,
  claim_code  text NULL,
  start_plan  text NULL,
  at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preview_claim_records_claim_shape CHECK (
    kind <> 'claim' OR (user_email IS NOT NULL AND char_length(btrim(user_email)) BETWEEN 1 AND 320
                        AND box_text IS NOT NULL AND char_length(btrim(box_text)) BETWEEN 1 AND 1000
                        AND claim_code IS NOT NULL AND start_plan IS NOT NULL)
  ),
  CONSTRAINT preview_claim_records_undo_shape CHECK (
    kind <> 'undo' OR (box_text IS NULL AND claim_code IS NULL AND user_email IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS preview_claim_records_org_idx ON public.preview_claim_records (org_id, at DESC);
ALTER TABLE public.preview_claim_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.preview_claim_records FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preview_claim_records TO service_role;
COMMENT ON TABLE public.preview_claim_records IS
  'Track P (mig 540, /legal finding 1): the claim''s own dated record. kind claim: the account (id, email as text), the club, the exact authority sentence ticked, the code used, the plan they came for, when; no IP. kind undo: who undid it (user_id = the staff actor). APPEND-ONLY like legal_acceptances (mig 455): only user_id to NULL on account deletion. Kept at least six years. No FK on org_id (outlives the club).';

CREATE OR REPLACE FUNCTION public.preview_claim_records_refuse_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.user_id IS NOT NULL AND NEW.user_id IS NULL
       AND (to_jsonb(NEW) - 'user_id') = (to_jsonb(OLD) - 'user_id') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'preview_claim_records is append-only'
      USING HINT = 'preview_claim_records_append_only (migration 540): only user_id, only to NULL, when the account is deleted.';
  END IF;
  RAISE EXCEPTION 'preview_claim_records is append-only'
    USING HINT = 'preview_claim_records_append_only (migration 540) refuses DELETE and TRUNCATE.';
END;
$$;
REVOKE ALL ON FUNCTION public.preview_claim_records_refuse_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS preview_claim_records_append_only ON public.preview_claim_records;
CREATE TRIGGER preview_claim_records_append_only
  BEFORE UPDATE OR DELETE ON public.preview_claim_records
  FOR EACH ROW EXECUTE FUNCTION public.preview_claim_records_refuse_change();
DROP TRIGGER IF EXISTS preview_claim_records_no_truncate ON public.preview_claim_records;
CREATE TRIGGER preview_claim_records_no_truncate
  BEFORE TRUNCATE ON public.preview_claim_records
  FOR EACH STATEMENT EXECUTE FUNCTION public.preview_claim_records_refuse_change();

-- ── 4. The sample, as two reusable steps ──────────────────────────────────────────────────────────────────────────────
-- The club's first word (two after an abbreviation: "St. Mary's"), for its sample teams.
CREATE OR REPLACE FUNCTION public.preview_sample_prefix(p_name text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE v text := regexp_replace(btrim(p_name), '^the\s+', '', 'i');
BEGIN
  RETURN CASE WHEN split_part(v, ' ', 1) ~ '\.$' AND split_part(v, ' ', 2) <> ''
              THEN split_part(v, ' ', 1) || ' ' || split_part(v, ' ', 2)
              ELSE split_part(v, ' ', 1) END;
END;
$$;
REVOKE ALL ON FUNCTION public.preview_sample_prefix(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_sample_prefix(text) TO service_role;

-- The one-day tournament on the meeting day, its first game at the meeting time (T5). Reads the club and its record.
CREATE OR REPLACE FUNCTION public.preview_make_tournament(p_org_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_org    record;
  v_rec    record;
  v_local  timestamp;
  v_day    date;
  v_prefix text;
  v_place  text;
  v_tourn  uuid := gen_random_uuid();
  v_dome   uuid := gen_random_uuid();
  v_dome2  uuid := gen_random_uuid();
  v_t_u11  uuid := gen_random_uuid();
  v_t_u13  uuid := gen_random_uuid();
  v_teams  uuid[] := ARRAY[]::uuid[];
  i int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_org_id AND o.is_preview) THEN
    RAISE EXCEPTION USING ERRCODE = 'PV020', MESSAGE = 'preview_not_open';
  END IF;
  SELECT o.name INTO v_org FROM public.organizations o WHERE o.id = p_org_id;
  SELECT p.meeting_at, p.sport, p.province_code INTO v_rec FROM public.organization_previews p WHERE p.org_id = p_org_id;
  IF v_org IS NULL OR v_rec IS NULL THEN RAISE EXCEPTION 'preview_make_tournament: no preview %', p_org_id; END IF;

  v_local  := date_trunc('minute', v_rec.meeting_at AT TIME ZONE 'America/Toronto');
  v_day    := (v_rec.meeting_at AT TIME ZONE 'America/Toronto')::date;
  v_prefix := public.preview_sample_prefix(v_org.name);
  v_place  := CASE v_rec.sport WHEN 'hockey' THEN 'Rink'
                               WHEN 'basketball' THEN 'Court' WHEN 'volleyball' THEN 'Court'
                               ELSE 'Field' END;

  INSERT INTO public.tournaments (
    id, org_id, year, name, slug, status, is_active, start_date, end_date, sport, list_in_directory,
    directory_province, require_score_finalization, notify_teams_on_complete
  ) VALUES (
    v_tourn, p_org_id, extract(year FROM v_day)::int, 'Sample Indoor Classic', 'sample-indoor-classic', 'active', true,
    v_day, v_day, v_rec.sport, false, upper(v_rec.province_code), false, false
  );

  INSERT INTO public.diamonds (id, tournament_id, name) VALUES
    (v_dome,  v_tourn, 'Sample Dome · ' || v_place || ' 1'),
    (v_dome2, v_tourn, 'Sample Dome · ' || v_place || ' 2');

  INSERT INTO public.divisions (id, tournament_id, name, display_order, schedule_visibility) VALUES
    (v_t_u11, v_tourn, 'U11', 0, 'published'),
    (v_t_u13, v_tourn, 'U13', 1, 'published');

  FOR i IN 0..7 LOOP
    v_teams := v_teams || gen_random_uuid();
    INSERT INTO public.teams (id, tournament_id, division_id, name, status, payment_status)
    VALUES (v_teams[i + 1], v_tourn, CASE WHEN i < 4 THEN v_t_u11 ELSE v_t_u13 END,
            (ARRAY['Brindlewood Foxes', 'Marrowvale Mavericks', v_prefix || ' U11 Comets', 'Quillfield Giants',
                   v_prefix || ' U13 Hawks', 'Thistlebrook Aces', 'Ravenhollow Kestrels', 'Larkspur Ridge Panthers'])[i + 1],
            'accepted', 'paid');
  END LOOP;

  INSERT INTO public.games (tournament_id, division_id, home_team_id, away_team_id, game_date, game_time,
                            duration_minutes, status, diamond_id)
  SELECT v_tourn, g.div, v_teams[g.home], v_teams[g.away], v_day, (v_local + g.after)::time, 90, 'scheduled', g.field
    FROM (VALUES
      (interval '0',                v_t_u11, 1, 2, v_dome),
      (interval '1 hour 45 minutes', v_t_u13, 5, 6, v_dome),
      (interval '1 hour 45 minutes', v_t_u11, 3, 4, v_dome2),
      (interval '3 hours 30 minutes', v_t_u13, 7, 8, v_dome)
    ) AS g(after, div, home, away, field)
   WHERE (v_local + g.after)::date = v_day;
END;
$$;
REVOKE ALL ON FUNCTION public.preview_make_tournament(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_make_tournament(uuid) TO service_role;

-- The whole fixed sample (T4): the house league season, the rep teams, the tournament, the sponsors.
CREATE OR REPLACE FUNCTION public.preview_make_sample(p_org_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_org    record;
  v_rec    record;
  v_day    date;
  v_year   int;
  v_prefix text;
  v_season uuid := gen_random_uuid();
  v_group  uuid := gen_random_uuid();
  v_div    uuid;
  v_sp     uuid;
  i int;
  j int;
BEGIN
  -- Never on a customer's club (/db 2026-11-25): every caller holds the marker set at this point.
  IF NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_org_id AND o.is_preview) THEN
    RAISE EXCEPTION USING ERRCODE = 'PV020', MESSAGE = 'preview_not_open';
  END IF;
  SELECT o.name, o.theme_primary INTO v_org FROM public.organizations o WHERE o.id = p_org_id;
  SELECT p.meeting_at, p.sport INTO v_rec FROM public.organization_previews p WHERE p.org_id = p_org_id;
  IF v_org IS NULL OR v_rec IS NULL THEN RAISE EXCEPTION 'preview_make_sample: no preview %', p_org_id; END IF;

  v_day  := (v_rec.meeting_at AT TIME ZONE 'America/Toronto')::date;
  v_year := CASE WHEN v_day <= make_date(extract(year FROM v_day)::int, 3, 31)
                 THEN extract(year FROM v_day)::int
                 ELSE extract(year FROM v_day)::int + 1 END;
  v_prefix := public.preview_sample_prefix(v_org.name);

  -- The house league season: 3 divisions × 4 teams, open for sign-up until Mar 31 (times stored as typed with a literal Z).
  INSERT INTO public.league_seasons (
    id, org_id, name, slug, sport, status, registration_open_at, registration_close_at,
    season_start_date, season_end_date
  ) VALUES (
    v_season, p_org_id, 'Sample House League ' || v_year, 'sample-house-league-' || v_year, v_rec.sport,
    'registration_open',
    ((v_day - 60)::text || 'T00:00:00Z')::timestamptz,
    (make_date(v_year, 3, 31)::text || 'T23:59:00Z')::timestamptz,
    make_date(v_year, 5, 1), make_date(v_year, 8, 31)
  );
  FOR i IN 0..2 LOOP
    v_div := gen_random_uuid();
    INSERT INTO public.league_divisions (id, season_id, name, sort_order, born_from_year, born_to_year)
    VALUES (v_div, v_season, (ARRAY['U9', 'U11', 'U13'])[i + 1], i,
            v_year - (8 + 2 * i), v_year - (7 + 2 * i));
    FOR j IN 0..3 LOOP
      INSERT INTO public.league_teams (season_id, division_id, name, color, sort_order)
      VALUES (v_season, v_div,
              (ARRAY['U9', 'U11', 'U13'])[i + 1] || ' ' || (ARRAY['Red', 'Blue', 'Green', 'Gold'])[j + 1],
              (ARRAY['#C62828', '#1565C0', '#2E7D32', '#F9A825'])[j + 1], j);
    END LOOP;
  END LOOP;

  -- Four rep teams, in one "Rep" group.
  INSERT INTO public.rep_team_groups (id, org_id, name, display_order) VALUES (v_group, p_org_id, 'Rep', 0);
  FOR i IN 0..3 LOOP
    INSERT INTO public.rep_teams (org_id, name, slug, sport, division, color, group_id)
    VALUES (p_org_id,
            v_prefix || ' ' || (ARRAY['U11 Comets', 'U13 Hawks', 'U15 Falcons', 'U17 Storm'])[i + 1],
            (ARRAY['u11-comets', 'u13-hawks', 'u15-falcons', 'u17-storm'])[i + 1],
            v_rec.sport, (ARRAY['U11', 'U13', 'U15', 'U17'])[i + 1], v_org.theme_primary, v_group);
  END LOOP;

  PERFORM public.preview_make_tournament(p_org_id);

  -- Three sample sponsors on the home.
  FOR i IN 0..2 LOOP
    v_sp := gen_random_uuid();
    INSERT INTO public.club_sponsors (id, org_id, name, position)
    VALUES (v_sp, p_org_id, (ARRAY['Northgate Hardware (sample)', 'Cedar Lane Physio (sample)',
                                   'Two Rivers Pizza (sample)'])[i + 1], i);
    INSERT INTO public.club_sponsor_places (org_id, sponsor_id, kind, source) VALUES (p_org_id, v_sp, 'club', 'typed');
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.preview_make_sample(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_make_sample(uuid) TO service_role;

-- Everything the sample is made of, and nothing else (T8's "cleared" list). Every child row goes with its parent (the
-- house league season, the rep teams, the tournament, the sponsors all cascade; dev snapshot 2026-11-25).
CREATE OR REPLACE FUNCTION public.preview_clear_sample(p_org_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Never on a customer's club (/db 2026-11-25): the claim clears BEFORE it clears the marker.
  IF NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_org_id AND o.is_preview) THEN
    RAISE EXCEPTION USING ERRCODE = 'PV020', MESSAGE = 'preview_not_open';
  END IF;
  DELETE FROM public.tournaments t WHERE t.org_id = p_org_id;
  DELETE FROM public.league_seasons s WHERE s.org_id = p_org_id;
  DELETE FROM public.rep_teams r WHERE r.org_id = p_org_id;
  DELETE FROM public.rep_team_groups g WHERE g.org_id = p_org_id;
  DELETE FROM public.club_sponsor_places sp WHERE sp.org_id = p_org_id;
  DELETE FROM public.club_sponsors s WHERE s.org_id = p_org_id;
END;
$$;
REVOKE ALL ON FUNCTION public.preview_clear_sample(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_clear_sample(uuid) TO service_role;

-- make_preview_club: unchanged refusals and rows; the sample now comes from preview_make_sample.
CREATE OR REPLACE FUNCTION public.make_preview_club(
  p_org_id uuid,
  p_name text,
  p_slug text,
  p_sport text,
  p_province_code text,
  p_logo_url text,
  p_logo_aspect real,
  p_logo_source_url text,
  p_theme_primary text,
  p_theme_accent text,
  p_line text,
  p_meeting_at timestamptz,
  p_made_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text := btrim(p_name);
  v_slug text := lower(btrim(p_slug));
  v_line text := nullif(btrim(coalesce(p_line, '')), '');
BEGIN
  IF p_org_id IS NULL OR v_name = '' OR v_slug = '' OR p_meeting_at IS NULL THEN
    RAISE EXCEPTION 'make_preview_club: missing input';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('public.make_preview_club'));

  IF (SELECT count(*) FROM public.organizations o WHERE o.is_preview) >= 5 THEN
    RAISE EXCEPTION USING ERRCODE = 'PV010', MESSAGE = 'preview_cap';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organizations o WHERE lower(btrim(o.name)) = lower(v_name) AND o.is_preview) THEN
    RAISE EXCEPTION USING ERRCODE = 'PV015', MESSAGE = 'preview_already_made';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organizations o WHERE lower(btrim(o.name)) = lower(v_name)) THEN
    RAISE EXCEPTION USING ERRCODE = 'PV011', MESSAGE = 'preview_club_exists';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organizations o WHERE lower(o.slug) = v_slug) THEN
    RAISE EXCEPTION USING ERRCODE = 'PV012', MESSAGE = 'preview_slug_taken';
  END IF;
  IF upper(coalesce(p_province_code, '')) = 'QC' THEN
    RAISE EXCEPTION USING ERRCODE = 'PV013', MESSAGE = 'preview_quebec';
  END IF;
  IF p_meeting_at <= now() OR p_meeting_at > now() + interval '60 days' THEN
    RAISE EXCEPTION USING ERRCODE = 'PV014', MESSAGE = 'preview_meeting';
  END IF;

  INSERT INTO public.organizations (
    id, name, slug, plan_id, tournament_limit, account_kind, is_public, is_discoverable, is_preview,
    logo_url, logo_aspect, theme_preset, theme_primary, theme_accent
  ) VALUES (
    p_org_id, v_name, v_slug, 'tournament', 1, 'organization', true, false, true,
    p_logo_url, p_logo_aspect, 'platform', p_theme_primary, p_theme_accent
  );

  INSERT INTO public.organization_previews (
    org_id, org_slug, org_name, meeting_at, made_by, logo_source_url, sport, province_code
  ) VALUES (
    p_org_id, v_slug, v_name, p_meeting_at, p_made_by, btrim(p_logo_source_url), p_sport, upper(p_province_code)
  );

  INSERT INTO public.org_public_site_content (org_id, tagline, description)
  VALUES (p_org_id, v_line, CASE WHEN v_line IS NULL THEN NULL
                                 WHEN v_line ~ '[.!?]$' THEN v_line ELSE v_line || '.' END);

  PERFORM public.preview_make_sample(p_org_id);

  RETURN p_org_id;
END;
$$;

-- ── 5a. The code page: its read and its check ─────────────────────────────────────────────────────────────────────────
-- p_code NULL: the page's read only (which frame to show). p_code set: the check; a wrong code is counted.
-- Returns {state: open|claimed|removed|resting|wrong|ok|missing, org_id, name, removed_at}. Never returns the code.
CREATE OR REPLACE FUNCTION public.preview_claim_door(p_slug text, p_code text, p_visitor text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_rec    record;
  v_code   text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_vis    text := left(coalesce(nullif(p_visitor, ''), 'unknown'), 128);
  v_tries  int;
  v_vtries int;
  v_base   jsonb;
BEGIN
  SELECT p.org_id, p.org_name, p.claim_code, p.claimed_at, p.removed_at INTO v_rec
    FROM public.organization_previews p
   WHERE lower(p.org_slug) = lower(btrim(coalesce(p_slug, '')))
   ORDER BY p.created_at DESC LIMIT 1;
  -- Any visit prunes the day-old wrong tries, so a removed club's rows go too (/legal 2026-11-25, P3 review item 2).
  DELETE FROM public.preview_claim_tries t WHERE t.tried_at < now() - interval '1 day';
  IF v_rec IS NULL THEN RETURN jsonb_build_object('state', 'missing'); END IF;
  v_base := jsonb_build_object('org_id', v_rec.org_id, 'name', v_rec.org_name, 'removed_at', v_rec.removed_at);
  IF v_rec.claimed_at IS NOT NULL THEN RETURN v_base || jsonb_build_object('state', 'claimed'); END IF;
  IF v_rec.removed_at IS NOT NULL OR v_rec.claim_code IS NULL THEN RETURN v_base || jsonb_build_object('state', 'removed'); END IF;

  -- One check at a time per club, so parallel guesses cannot all read a count under five (/db 2026-11-25).
  PERFORM pg_advisory_xact_lock(hashtext('preview_claim_door:' || v_rec.org_id::text));
  SELECT count(*) INTO v_tries FROM public.preview_claim_tries t
   WHERE t.org_id = v_rec.org_id AND t.tried_at > now() - interval '1 hour';
  SELECT count(*) INTO v_vtries FROM public.preview_claim_tries t
   WHERE t.visitor_key = v_vis AND t.tried_at > now() - interval '1 hour';
  IF v_tries >= 5 OR v_vtries >= 5 THEN RETURN v_base || jsonb_build_object('state', 'resting'); END IF;
  IF p_code IS NULL THEN RETURN v_base || jsonb_build_object('state', 'open'); END IF;

  IF v_code = v_rec.claim_code THEN RETURN v_base || jsonb_build_object('state', 'ok', 'code', v_code); END IF;

  INSERT INTO public.preview_claim_tries (org_id, visitor_key) VALUES (v_rec.org_id, v_vis);
  IF v_tries + 1 >= 5 OR v_vtries + 1 >= 5 THEN RETURN v_base || jsonb_build_object('state', 'resting'); END IF;
  RETURN v_base || jsonb_build_object('state', 'wrong');
END;
$$;
REVOKE ALL ON FUNCTION public.preview_claim_door(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_claim_door(text, text, text) TO service_role;

-- ── 5b. THE CLAIM (T8, T14): one transaction, all or nothing ──────────────────────────────────────────────────────────
-- The route has already checked: signed in, not staff, the current Terms, the one-club rule, Club on sale, the pass (and
-- the pass came from the code door, which counts wrong tries; a PV021 here counts nothing, its write rolls back).
-- Locks: the club's row first, then the record's, the same order as a removal (DELETE on organizations, then its
-- mark_removed trigger), so a claim and a removal at the same moment cannot deadlock (/db 2026-11-25).
-- Order matters: the sample is cleared while the marker is still set, then the marker (claimed_at), then the owner is
-- seated (PV003 refuses anyone joining a preview).
CREATE OR REPLACE FUNCTION public.claim_preview_club(
  p_org_id uuid, p_code text, p_user_id uuid, p_user_email text, p_box_text text, p_start_plan text
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_rec  record;
  v_slug text;
BEGIN
  IF p_org_id IS NULL OR p_user_id IS NULL OR coalesce(btrim(p_user_email), '') = '' OR coalesce(btrim(p_box_text), '') = ''
     OR p_start_plan IS NULL OR p_start_plan NOT IN ('club', 'club_large') THEN
    RAISE EXCEPTION 'claim_preview_club: missing input';
  END IF;

  -- One account runs one club (2026-06-19), held here against two claims at once from one account (/review 2026-11-25):
  -- one claim per account at a time, then no other real club (a coach's own portal never counts, lib/team-workspace-kind.ts).
  PERFORM pg_advisory_xact_lock(hashtext('claim_preview_club:' || p_user_id::text));
  IF EXISTS (SELECT 1 FROM public.organization_members m JOIN public.organizations o ON o.id = m.organization_id
              WHERE m.user_id = p_user_id AND m.status = 'active' AND o.id <> p_org_id
                AND o.account_kind IS DISTINCT FROM 'team_workspace' AND o.plan_id IS DISTINCT FROM 'team') THEN
    RAISE EXCEPTION USING ERRCODE = 'PV027', MESSAGE = 'claimer_runs_a_club';
  END IF;

  PERFORM 1 FROM public.organizations o WHERE o.id = p_org_id AND o.is_preview FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PV020', MESSAGE = 'preview_not_open'; END IF;
  SELECT p.* INTO v_rec FROM public.organization_previews p WHERE p.org_id = p_org_id FOR UPDATE;
  IF v_rec IS NULL OR v_rec.claimed_at IS NOT NULL OR v_rec.removed_at IS NOT NULL OR v_rec.claim_code IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PV020', MESSAGE = 'preview_not_open';
  END IF;
  IF upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) <> v_rec.claim_code THEN
    RAISE EXCEPTION USING ERRCODE = 'PV021', MESSAGE = 'preview_code_wrong';
  END IF;

  PERFORM public.preview_clear_sample(p_org_id);

  -- The trigger clears the marker here (organization_previews_keep_marker).
  UPDATE public.organization_previews
     SET claimed_at = now(), claimed_by = p_user_id, claim_code = NULL
   WHERE org_id = p_org_id;

  -- T10: a customer from the claim day (the record keeps the day we made it). The plan they came for, as Start a club
  -- records it (mig 508). Listed in the directory like any newly named club (a preview never was).
  UPDATE public.organizations
     SET created_at = now(), start_plan = p_start_plan, is_discoverable = true
   WHERE id = p_org_id
  RETURNING slug INTO v_slug;

  INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at)
  VALUES (p_org_id, p_user_id, 'owner', now());

  INSERT INTO public.preview_claim_records (kind, org_id, org_name, user_id, user_email, box_text, claim_code, start_plan)
  VALUES ('claim', p_org_id, v_rec.org_name, p_user_id, lower(btrim(p_user_email)), btrim(p_box_text), v_rec.claim_code, p_start_plan);

  DELETE FROM public.preview_claim_tries t WHERE t.org_id = p_org_id;

  RETURN v_slug;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_preview_club(uuid, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_preview_club(uuid, text, uuid, text, text, text) TO service_role;

-- ── 5c. Undo a claim (T15): only while the club holds nothing but the claim ───────────────────────────────────────────
-- "Until a plan starts", read narrowly: no plan, no Stripe customer (they reached checkout), not renamed, nobody but the
-- claimant (a pending invitation is a member row), and NO row in any table the club owns. That last check is generic and
-- fails closed (/db 2026-11-25): every single-column key onto organizations that deletes with the club (CASCADE,
-- RESTRICT, NO ACTION) is asked, except the club's own seat and its site words. Keys that SET NULL are our own logs
-- (audit, errors, email sends), which outlive any club and are not the club's. A new table is covered the day it is made.
-- Then the preview comes back as it was: the claimant leaves first (PV001), the marker returns, a NEW code, the day we
-- made it, the sample made again.
CREATE OR REPLACE FUNCTION public.undo_preview_claim(p_org_id uuid, p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_rec record;
  v_org record;
  v_key record;
  v_hit boolean;
BEGIN
  SELECT o.* INTO v_org FROM public.organizations o WHERE o.id = p_org_id FOR UPDATE;
  IF v_org IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'PV023', MESSAGE = 'preview_not_claimed'; END IF;
  SELECT p.* INTO v_rec FROM public.organization_previews p WHERE p.org_id = p_org_id FOR UPDATE;
  IF v_rec IS NULL OR v_rec.claimed_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PV023', MESSAGE = 'preview_not_claimed';
  END IF;

  IF v_org.plan_id IS DISTINCT FROM 'tournament'
     OR v_org.stripe_customer_id IS NOT NULL OR v_org.stripe_subscription_id IS NOT NULL
     OR v_org.slug IS DISTINCT FROM v_rec.org_slug OR v_org.name IS DISTINCT FROM v_rec.org_name
     OR EXISTS (SELECT 1 FROM public.organization_members m
                 WHERE m.organization_id = p_org_id AND m.user_id IS DISTINCT FROM v_rec.claimed_by) THEN
    RAISE EXCEPTION USING ERRCODE = 'PV022', MESSAGE = 'claim_not_undoable';
  END IF;

  FOR v_key IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f'
       AND c.confrelid = 'public.organizations'::regclass
       AND array_length(c.conkey, 1) = 1
       AND c.confdeltype IN ('c', 'r', 'a')
       AND c.conrelid NOT IN ('public.organization_members'::regclass, 'public.org_public_site_content'::regclass)
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE %I = $1)', v_key.tbl, v_key.col) INTO v_hit USING p_org_id;
    IF v_hit THEN
      RAISE EXCEPTION USING ERRCODE = 'PV022', MESSAGE = 'claim_not_undoable', DETAIL = v_key.tbl::text;
    END IF;
  END LOOP;

  DELETE FROM public.organization_members m WHERE m.organization_id = p_org_id;

  -- The trigger sets the marker again here, and refuses if anyone is still in the club (PV001).
  UPDATE public.organization_previews
     SET claimed_at = NULL, claimed_by = NULL, claim_code = public.preview_claim_code()
   WHERE org_id = p_org_id;

  UPDATE public.organizations
     SET start_plan = NULL, created_at = v_rec.created_at, is_discoverable = false
   WHERE id = p_org_id;

  -- The sample is made from the stored meeting, which may be past: the room window's Change the meeting moves it.
  PERFORM public.preview_make_sample(p_org_id);

  INSERT INTO public.preview_claim_records (kind, org_id, org_name, user_id)
  VALUES ('undo', p_org_id, v_rec.org_name, p_actor);
END;
$$;
REVOKE ALL ON FUNCTION public.undo_preview_claim(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_preview_claim(uuid, uuid) TO service_role;

-- ── 5d. Change the meeting: the live game and the removal date move together ──────────────────────────────────────────
-- The removal date is the meeting's day + 30 (never stored), so it moves with meeting_at. The whole sample is made again
-- on the new day (its year and sign-up dates follow the meeting; the scores were the room's, and a moved meeting has not
-- happened yet).
CREATE OR REPLACE FUNCTION public.move_preview_meeting(p_org_id uuid, p_meeting_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_rec record;
BEGIN
  PERFORM 1 FROM public.organizations o WHERE o.id = p_org_id AND o.is_preview FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PV020', MESSAGE = 'preview_not_open'; END IF;
  SELECT p.* INTO v_rec FROM public.organization_previews p WHERE p.org_id = p_org_id FOR UPDATE;
  IF v_rec IS NULL OR v_rec.claimed_at IS NOT NULL OR v_rec.removed_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PV020', MESSAGE = 'preview_not_open';
  END IF;
  IF p_meeting_at IS NULL OR p_meeting_at <= now() OR p_meeting_at > now() + interval '60 days' THEN
    RAISE EXCEPTION USING ERRCODE = 'PV014', MESSAGE = 'preview_meeting';
  END IF;

  UPDATE public.organization_previews SET meeting_at = p_meeting_at, updated_at = now() WHERE org_id = p_org_id;
  PERFORM public.preview_clear_sample(p_org_id);
  PERFORM public.preview_make_sample(p_org_id);
END;
$$;
REVOKE ALL ON FUNCTION public.move_preview_meeting(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_preview_meeting(uuid, timestamptz) TO service_role;

-- ── 5e. The live game's score (T5): the one thing staff write in a preview ────────────────────────────────────────────
-- The live game is the tournament's first game (the one at the meeting time). A save marks it 'submitted': "Live now"
-- still holds by the clock (lib/game-status.ts), and a game nobody marked final reads as its score afterwards rather
-- than "Upcoming" (/db 2026-11-25). Mark final writes 'completed'. Refused before it starts and once it is final. A
-- direct write: no score-submission columns, no fan alerts (a preview sends nothing), no game-change notices.
CREATE OR REPLACE FUNCTION public.save_preview_score(p_org_id uuid, p_home int, p_away int, p_final boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_game record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_org_id AND o.is_preview) THEN
    RAISE EXCEPTION USING ERRCODE = 'PV020', MESSAGE = 'preview_not_open';
  END IF;
  IF p_home IS NULL OR p_away IS NULL OR p_home < 0 OR p_away < 0 OR p_home > 999 OR p_away > 999 THEN
    RAISE EXCEPTION 'save_preview_score: a score is two whole numbers';
  END IF;

  SELECT g.id, g.status, g.game_date, g.game_time INTO v_game
    FROM public.games g JOIN public.tournaments t ON t.id = g.tournament_id
   WHERE t.org_id = p_org_id
   ORDER BY g.game_date, g.game_time, g.id
   LIMIT 1
   FOR UPDATE OF g;
  IF v_game IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'PV024', MESSAGE = 'preview_game_missing'; END IF;
  IF v_game.status IN ('completed', 'forfeit', 'cancelled') THEN
    RAISE EXCEPTION USING ERRCODE = 'PV025', MESSAGE = 'preview_game_final';
  END IF;
  IF (v_game.game_date + v_game.game_time) AT TIME ZONE 'America/Toronto' > now() THEN
    RAISE EXCEPTION USING ERRCODE = 'PV026', MESSAGE = 'preview_game_not_started';
  END IF;

  UPDATE public.games
     SET home_score = p_home, away_score = p_away,
         status = CASE WHEN p_final THEN 'completed' ELSE 'submitted' END
   WHERE id = v_game.id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_preview_score(uuid, int, int, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_preview_score(uuid, int, int, boolean) TO service_role;

COMMIT;
