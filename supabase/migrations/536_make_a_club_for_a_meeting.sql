-- 536 — Make a club for a meeting: the one creation step (Club Website Track P, Session P2; owner rulings T2–T6,
-- 2026-11-25). Mig 535 made the marker and the record; nothing could make a preview. This is the only thing that can.
--
-- 1. organization_previews.sport / .province_code — what the make window asks that a club has no column for. A claim
--    keeps the sport (T8), and the record is the one place it outlives the sample. Neither is about a person.
-- 2. public.make_preview_club(...) — ONE transaction: the club (is_preview set in the same insert, so it is never a
--    customer first: lib/preview-org-server.ts remembers a "no"), its record, its site words, and the fixed sample (T4):
--    a house league season of 3 divisions and 12 teams open for sign-up, 4 rep teams, a one-day tournament on the
--    meeting day whose first game starts at the meeting time (T5: live by the clock, lib/game-status.ts) with its listing
--    switch OFF, and 3 sample sponsors on the home. Every name is made up; "Sample" is in the event and sponsor names
--    (/legal, CLUB_WEBSITE_TRACK_P_REVIEW.md rec. 4). NO people: no member, no team contact, no registration, no dues.
--    All or nothing: any failure rolls every row back, and the caller removes the logo file it uploaded.
--    The refusals are re-checked here under one lock, so two makes at once cannot pass the cap or take one name twice:
--      PV010 preview_cap        five previews already open (T6)
--      PV011 preview_club_exists a club of that name is already on FieldLogicHQ (exact, any case)
--      PV015 preview_already_made a preview of that name is already open
--      PV012 preview_slug_taken that web address is taken
--      PV013 preview_quebec     Club is not on sale in Québec (/legal)
--      PV014 preview_meeting    the meeting is in the past or more than 60 days out
--    (The window checks each first and says so in place; these are the backstop.)
--
-- Service role only: the platform-admin route calls it after its owner check (T2). Re-runnable.

BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.organization_previews ADD COLUMN IF NOT EXISTS sport text NULL;
ALTER TABLE public.organization_previews ADD COLUMN IF NOT EXISTS province_code text NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_previews_province_code_shape') THEN
    ALTER TABLE public.organization_previews ADD CONSTRAINT organization_previews_province_code_shape
      CHECK (province_code IS NULL OR province_code ~ '^[A-Z]{2}$');
  END IF;
END;
$$;

COMMENT ON COLUMN public.organization_previews.sport IS
  'Track P (mig 536): the sport typed in the make window (a lib/sports.ts id). Kept by a claim (T8); the sample rows carry it too until the claim clears them.';
COMMENT ON COLUMN public.organization_previews.province_code IS
  'Track P (mig 536): the province typed in the make window (two letters). QC is refused at making (Club is not on sale there).';

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
  v_name   text := btrim(p_name);
  v_slug   text := lower(btrim(p_slug));
  v_line   text := nullif(btrim(coalesce(p_line, '')), '');
  v_local  timestamp := date_trunc('minute', p_meeting_at AT TIME ZONE 'America/Toronto');
  v_day    date := (p_meeting_at AT TIME ZONE 'America/Toronto')::date;
  v_year   int;   -- the sample season's year: the first Mar 31 on or after the meeting day closes its sign-up
  v_prefix text;  -- the club's first word (two after an abbreviation: "St. Mary's"), for its sample teams ("Oakridge U11 Comets")
  v_place  text;  -- what one playing area is called in this sport
  v_season uuid := gen_random_uuid();
  v_group  uuid := gen_random_uuid();
  v_tourn  uuid := gen_random_uuid();
  v_dome   uuid := gen_random_uuid();
  v_dome2  uuid := gen_random_uuid();
  v_t_u11  uuid := gen_random_uuid();
  v_t_u13  uuid := gen_random_uuid();
  v_div    uuid;
  v_sp     uuid;
  v_teams  uuid[] := ARRAY[]::uuid[];
  i int;
  j int;
BEGIN
  IF p_org_id IS NULL OR v_name = '' OR v_slug = '' OR p_meeting_at IS NULL THEN
    RAISE EXCEPTION 'make_preview_club: missing input';
  END IF;

  -- One make at a time, so the cap and the name checks below cannot race another make.
  PERFORM pg_advisory_xact_lock(hashtext('public.make_preview_club'));

  IF (SELECT count(*) FROM public.organizations o WHERE o.is_preview) >= 5 THEN
    RAISE EXCEPTION USING ERRCODE = 'PV010', MESSAGE = 'preview_cap';
  END IF;
  -- A name already taken says which it is: a preview already made for it (PV015), or a club that runs its own (PV011).
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

  v_year := CASE WHEN v_day <= make_date(extract(year FROM v_day)::int, 3, 31)
                 THEN extract(year FROM v_day)::int
                 ELSE extract(year FROM v_day)::int + 1 END;
  v_prefix := regexp_replace(v_name, '^the\s+', '', 'i');
  v_prefix := CASE WHEN split_part(v_prefix, ' ', 1) ~ '\.$' AND split_part(v_prefix, ' ', 2) <> ''
                   THEN split_part(v_prefix, ' ', 1) || ' ' || split_part(v_prefix, ' ', 2)
                   ELSE split_part(v_prefix, ' ', 1) END;
  v_place := CASE p_sport WHEN 'hockey' THEN 'Rink'
                          WHEN 'basketball' THEN 'Court' WHEN 'volleyball' THEN 'Court'
                          ELSE 'Field' END;

  -- ── The club: the marker in the same insert (never a customer first), the free start, unlisted ───────────────────
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

  -- The club's line is its tagline under the name and its About us (the window's one free line, no people in it).
  INSERT INTO public.org_public_site_content (org_id, tagline, description)
  VALUES (p_org_id, v_line, CASE WHEN v_line IS NULL THEN NULL
                                 WHEN v_line ~ '[.!?]$' THEN v_line ELSE v_line || '.' END);

  -- ── The house league season: 3 divisions × 4 teams, open for sign-up until Mar 31 ────────────────────────────────
  -- Registration times are stored as typed with a literal Z (the house rule for league_seasons, DATA_DICTIONARY).
  INSERT INTO public.league_seasons (
    id, org_id, name, slug, sport, status, registration_open_at, registration_close_at,
    season_start_date, season_end_date
  ) VALUES (
    v_season, p_org_id, 'Sample House League ' || v_year, 'sample-house-league-' || v_year, p_sport,
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

  -- ── Four rep teams, in one "Rep" group ────────────────────────────────────────────────────────────────────────────
  INSERT INTO public.rep_team_groups (id, org_id, name, display_order) VALUES (v_group, p_org_id, 'Rep', 0);
  FOR i IN 0..3 LOOP
    INSERT INTO public.rep_teams (org_id, name, slug, sport, division, color, group_id)
    VALUES (p_org_id,
            v_prefix || ' ' || (ARRAY['U11 Comets', 'U13 Hawks', 'U15 Falcons', 'U17 Storm'])[i + 1],
            (ARRAY['u11-comets', 'u13-hawks', 'u15-falcons', 'u17-storm'])[i + 1],
            p_sport, (ARRAY['U11', 'U13', 'U15', 'U17'])[i + 1], p_theme_primary, v_group);
  END LOOP;

  -- ── The one-day tournament on the meeting day. Listing switch OFF; its first game starts at the meeting time ─────
  INSERT INTO public.tournaments (
    id, org_id, year, name, slug, status, is_active, start_date, end_date, sport, list_in_directory,
    directory_province, require_score_finalization, notify_teams_on_complete
  ) VALUES (
    v_tourn, p_org_id, extract(year FROM v_day)::int, 'Sample Indoor Classic', 'sample-indoor-classic', 'active', true,
    v_day, v_day, p_sport, false, upper(p_province_code), false, false
  );

  INSERT INTO public.diamonds (id, tournament_id, name) VALUES
    (v_dome,  v_tourn, 'Sample Dome · ' || v_place || ' 1'),
    (v_dome2, v_tourn, 'Sample Dome · ' || v_place || ' 2');

  INSERT INTO public.divisions (id, tournament_id, name, display_order, schedule_visibility) VALUES
    (v_t_u11, v_tourn, 'U11', 0, 'published'),
    (v_t_u13, v_tourn, 'U13', 1, 'published');

  -- Teams from made-up towns (invented names, not real places: /marketing 2026-11-25), and the club's own two sample
  -- teams. No coach, no email: a preview holds no people.
  FOR i IN 0..7 LOOP
    v_teams := v_teams || gen_random_uuid();
    INSERT INTO public.teams (id, tournament_id, division_id, name, status, payment_status)
    VALUES (v_teams[i + 1], v_tourn, CASE WHEN i < 4 THEN v_t_u11 ELSE v_t_u13 END,
            (ARRAY['Brindlewood Foxes', 'Marrowvale Mavericks', v_prefix || ' U11 Comets', 'Quillfield Giants',
                   v_prefix || ' U13 Hawks', 'Thistlebrook Aces', 'Ravenhollow Kestrels', 'Larkspur Ridge Panthers'])[i + 1],
            'accepted', 'paid');
  END LOOP;

  -- T5: ONE game live at the meeting time (90 minutes; live by the clock until 30 minutes after). The club's own teams
  -- play later in the evening. A game that would run past midnight is left out rather than wrapped to the morning.
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

  -- ── Three sample sponsors on the home ─────────────────────────────────────────────────────────────────────────────
  FOR i IN 0..2 LOOP
    v_sp := gen_random_uuid();
    INSERT INTO public.club_sponsors (id, org_id, name, position)
    VALUES (v_sp, p_org_id, (ARRAY['Northgate Hardware (sample)', 'Cedar Lane Physio (sample)',
                                   'Two Rivers Pizza (sample)'])[i + 1], i);
    INSERT INTO public.club_sponsor_places (org_id, sponsor_id, kind, source) VALUES (p_org_id, v_sp, 'club', 'typed');
  END LOOP;

  RETURN p_org_id;
END;
$$;

COMMENT ON FUNCTION public.make_preview_club(uuid, text, text, text, text, text, real, text, text, text, text, timestamptz, uuid) IS
  'Track P (mig 536): the ONE way a preview club is made: the club with is_preview set, its record, and the fixed sample (T4, T5), in one transaction. Service role only (the owner-only Prospect clubs route).';

REVOKE ALL ON FUNCTION public.make_preview_club(uuid, text, text, text, text, text, real, text, text, text, text, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.make_preview_club(uuid, text, text, text, text, text, real, text, text, text, text, timestamptz, uuid) TO service_role;

COMMIT;
