-- ---------------------------------------------------------------
-- Migration 539 — Club Website Stage 2, Session 2A (Close a place; rulings K1–K17, plan
-- docs/projects/active/CLUB_WEBSITE_ENHANCEMENTS_PLAN.md §7; build prompt CLUB_WEBSITE_STAGE2_BUILD_PROMPT.md; the
-- drawing's tab 9 is the shape, /db's review its source).
--
-- WHY: a wet Saturday meant a Rainout per house league season, a message to each rep coach and a notice typed by hand,
-- and the notice could not say which field or for how long. One press now closes a place (or one diamond of it, or every
-- place) for every program: the house league games are postponed or cancelled across every season (the Rainout's own
-- record, one per season per day), the rep games are MARKED for their coaches (never moved, Stage 0 A5), the typed-in
-- games the admin chose are linked, and the closure itself is recorded, so the site's strip reads it from the press to the
-- end of Until with no job.
--
-- WHAT CHANGES:
--   (1) place_name_in_typed / place_closure_match — the ONE matching rule (K7): a game on the place's id first (a
--       one-diamond closure takes that diamond's games, and a game on the place with no diamond as "maybe"); then a game
--       with no place id whose typed text holds the place's name, any case ("maybe", listed unticked). lib/place-closures.ts
--       mirrors it for the window; a guard pins the two.
--   (2) org_place_closures — one row per closed place per press: the place and optional diamond (by id, and by NAME, so a
--       deleted place still reads), the first day, Until, when it shows from and when it ends (the end of Until in the
--       club's day), postpone or cancel, the families' line, who closed it, who reopened it and when. Service role only.
--   (3) league_rainouts gains closure_id + org_venue_id, and a unique (closure, season, day): a retried press cannot write
--       a season's day twice. A closure "until Sunday" over two seasons is four Rainout records.
--   (4) rep_event_closure_marks — the rep mark as its own record beside the game (NOT a column on it: a second closure
--       would overwrite the first, and reopening one would clear the other's mark). It keeps the time and place the game
--       had when marked; "the coach moved it" is READ, never written (lib/place-closures.ts, markSpent).
--   (5) league_games_record_change learns that "Link both" is not news (K7): while the closure press says so (the
--       transaction-local league.quiet_link, on only around its own link step), a game that gains the place whose name
--       is already in its typed text, its typed text kept, records NO change, so no email can follow. Every other writer
--       records exactly as migration 409's recorder did. lib/league-game-changes.ts reads the gap the quiet link leaves.
--   (6) org_place_closure_press — the whole press in ONE step, all or nothing. Every refusal is decided after the locks
--       and BEFORE the first write, so a refusal anywhere (the second season's, a rep game's) writes nothing anywhere; a
--       failure after the first write RAISES and the call rolls back whole. (Migration 427's league_rainout_press RETURNS
--       its refusals, so calling it once per season would leave the first season written when the second refused; this
--       step does not call it.) A retried press (same press key) answers with what the first one wrote.
--   (7) org_place_closure_reopen — stamps the closure reopened. The strip and the marks come down by READ; no game moves
--       (K11 A).
--
-- No change to the send, Undo, Put all back or any existing column. Additive and re-runnable.
-- check:migrations sees the two new tables and the two new columns; the five functions and the recorder's new body are
-- invisible to it (MANUAL_PROD_STEPS.json). Apply BEFORE promoting the code that reads it.
-- ---------------------------------------------------------------

BEGIN;

-- ─── 1 · The one matching rule (K7) ──────────────────────────────────────────────────────────────────────────────────

-- The place's name inside typed text, any case. A blank name or blank text matches nothing.
CREATE OR REPLACE FUNCTION public.place_name_in_typed(p_name text, p_typed text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(btrim(p_name), '') <> '' AND coalesce(btrim(p_typed), '') <> ''
     AND position(lower(btrim(p_name)) IN lower(p_typed)) > 0;
$$;

-- How a game stands to one closed place: 'linked' (it is there), 'maybe' (listed unticked), or null (not there).
--   p_scope 'all'      every game that day is there.
--   on the place's id  'linked', or for a one-diamond closure: that diamond 'linked', no diamond 'maybe', another null.
--   no place id        'maybe' when its typed text holds the place's name (a rep game's typed text includes its team
--                      place's name — the caller passes both; see org_place_closure_press).
--   another place's id null: the id wins over the text.
CREATE OR REPLACE FUNCTION public.place_closure_match(
  p_scope text, p_venue uuid, p_facility uuid, p_name text, g_venue uuid, g_facility uuid, g_typed text
) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_scope = 'all' THEN 'linked'
    WHEN g_venue IS NOT NULL AND g_venue = p_venue THEN
      CASE WHEN p_facility IS NULL OR g_facility = p_facility THEN 'linked'
           WHEN g_facility IS NULL THEN 'maybe'
           ELSE NULL END
    WHEN g_venue IS NULL AND place_name_in_typed(p_name, g_typed) THEN 'maybe'
    ELSE NULL END;
$$;

-- ─── 2 · The closure ─────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_place_closures (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  press_key              uuid NOT NULL,
  press_seq              smallint NOT NULL CHECK (press_seq BETWEEN 1 AND 10),
  scope                  text NOT NULL CHECK (scope IN ('place', 'diamond', 'all')),
  org_venue_id           uuid REFERENCES public.org_venues(id) ON DELETE SET NULL,
  org_venue_facility_id  uuid REFERENCES public.org_venue_facilities(id) ON DELETE SET NULL,
  place_name             text,
  facility_name          text,
  first_day              date NOT NULL,
  last_day               date NOT NULL,
  shows_from             timestamptz NOT NULL,
  ends_at                timestamptz NOT NULL,
  verb                   text NOT NULL CHECK (verb IN ('postponed', 'cancelled')),
  line                   text CHECK (line IS NULL OR char_length(line) BETWEEN 1 AND 120),
  closed_by              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  reopened_at            timestamptz,
  reopened_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT org_place_closures_days CHECK (last_day >= first_day AND last_day - first_day <= 13),
  CONSTRAINT org_place_closures_shows CHECK (ends_at > shows_from),
  CONSTRAINT org_place_closures_all_has_no_name CHECK ((scope = 'all') = (place_name IS NULL)),
  CONSTRAINT org_place_closures_diamond_named CHECK ((scope = 'diamond') = (facility_name IS NOT NULL)),
  CONSTRAINT org_place_closures_press_once UNIQUE (press_key, press_seq)
);

-- The strip's read: the club's closures not reopened, by when they end.
CREATE INDEX IF NOT EXISTS org_place_closures_showing_idx ON public.org_place_closures (org_id, ends_at) WHERE reopened_at IS NULL;
CREATE INDEX IF NOT EXISTS org_place_closures_org_id_idx ON public.org_place_closures (org_id);
CREATE INDEX IF NOT EXISTS org_place_closures_venue_idx ON public.org_place_closures (org_venue_id) WHERE org_venue_id IS NOT NULL;

ALTER TABLE public.org_place_closures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.org_place_closures FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_place_closures TO service_role;

COMMENT ON TABLE public.org_place_closures IS
  'Club Website Stage 2 (Close a place): one row per closed place per press. Written only by org_place_closure_press; '
  'reopened_* stamped only by org_place_closure_reopen. The site''s strip reads the rows showing now (shows_from <= now < '
  'ends_at, not reopened) — no job ends a closure. Service role only.';
COMMENT ON COLUMN public.org_place_closures.press_key IS
  'The window''s key for one press (a uuid the window makes when it opens). A retried press with the same key answers with '
  'what the first wrote. One press closing two places is two rows with one key (press_seq 1, 2).';
COMMENT ON COLUMN public.org_place_closures.scope IS
  'place = the whole place; diamond = one diamond of it (org_venue_facility_id, facility_name); all = every place the club '
  'has ("All our fields"), with no place named.';
COMMENT ON COLUMN public.org_place_closures.place_name IS
  'The place''s name as it was at the press (null only for scope all), so a closure still reads after its place is deleted.';
COMMENT ON COLUMN public.org_place_closures.facility_name IS 'The diamond''s name at the press; set exactly when scope = diamond.';
COMMENT ON COLUMN public.org_place_closures.first_day IS 'The first club day closed (the window''s Day), never before the club''s today at the press.';
COMMENT ON COLUMN public.org_place_closures.last_day IS 'Until: the last club day closed (= first_day for "The end of that day"); at most 13 days after first_day.';
COMMENT ON COLUMN public.org_place_closures.shows_from IS 'When the strip starts saying it: the press (K3, so one set tonight reads "closed tomorrow").';
COMMENT ON COLUMN public.org_place_closures.ends_at IS 'Midnight at the end of last_day in the club''s zone (America/Toronto, as mig 427 reads the day). The strip is gone after it by itself.';
COMMENT ON COLUMN public.org_place_closures.verb IS 'What the press did to the house league games: postponed or cancelled.';
COMMENT ON COLUMN public.org_place_closures.line IS
  'The admin''s line for the families'' email (at most 120 characters, verbatim; null = none). Also on each Rainout record '
  'the press wrote, which is where the send reads it. NEVER shown on the site (K16).';
COMMENT ON COLUMN public.org_place_closures.reopened_at IS
  'When Reopen took the strip and the rep marks down (null = not reopened). Reopen moves no game (K11 A).';

-- ─── 3 · Each Rainout record knows its closure ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.league_rainouts
  ADD COLUMN IF NOT EXISTS closure_id uuid REFERENCES public.org_place_closures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS org_venue_id uuid REFERENCES public.org_venues(id) ON DELETE SET NULL;

-- The retry guard: one Rainout record per closure, season and day.
CREATE UNIQUE INDEX IF NOT EXISTS league_rainouts_closure_day_uq
  ON public.league_rainouts (closure_id, season_id, day) WHERE closure_id IS NOT NULL;
-- "Why was this game postponed?" (the club home's "Place closed" row, Session 2C), from a game id.
CREATE INDEX IF NOT EXISTS league_rainouts_venue_idx
  ON public.league_rainouts (org_venue_id) WHERE org_venue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS league_rainouts_closure_games_idx
  ON public.league_rainouts USING gin (game_ids) WHERE closure_id IS NOT NULL;

COMMENT ON COLUMN public.league_rainouts.closure_id IS
  'The closure that made this Rainout (Close a place); null for a Rainout pressed from the Rainout window alone.';
COMMENT ON COLUMN public.league_rainouts.org_venue_id IS
  'The closed place (null for an "All our fields" closure, a Rainout window press, or a place deleted since).';

-- ─── 4 · The rep mark ────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rep_event_closure_marks (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  closure_id           uuid NOT NULL REFERENCES public.org_place_closures(id) ON DELETE CASCADE,
  event_id             uuid NOT NULL REFERENCES public.rep_team_events(id) ON DELETE CASCADE,
  team_id              uuid NOT NULL REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  marked_starts_at     timestamptz NOT NULL,
  marked_org_venue_id  uuid,
  marked_facility_id   uuid,
  marked_place_id      uuid,
  marked_location      text,
  coach_emailed_at     timestamptz,
  reopen_told_at       timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rep_event_closure_marks_once UNIQUE (closure_id, event_id)
);

CREATE INDEX IF NOT EXISTS rep_event_closure_marks_event_idx ON public.rep_event_closure_marks (event_id);
CREATE INDEX IF NOT EXISTS rep_event_closure_marks_org_id_idx ON public.rep_event_closure_marks (org_id);
CREATE INDEX IF NOT EXISTS rep_event_closure_marks_team_idx ON public.rep_event_closure_marks (team_id);

ALTER TABLE public.rep_event_closure_marks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rep_event_closure_marks FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_event_closure_marks TO service_role;

COMMENT ON TABLE public.rep_event_closure_marks IS
  'Club Website Stage 2: a rep game a closure MARKED for its coach (Stage 0 A5: marked, not moved). One row per closure per '
  'game, so a second closure over the same game never clears the first''s mark. A mark STANDS while its closure is not '
  'reopened and the game still has the time and place it had when marked and is not cancelled; "the coach moved it" is '
  'read from rep_team_events, never written here (lib/place-closures.ts markStanding). Written only by '
  'org_place_closure_press. Service role only.';
COMMENT ON COLUMN public.rep_event_closure_marks.marked_starts_at IS 'The game''s starts_at when marked. A different starts_at now = the coach moved it (the mark is spent).';
COMMENT ON COLUMN public.rep_event_closure_marks.marked_org_venue_id IS 'The game''s club place when marked (after any "Link" in the same press). No foreign key: a snapshot.';
COMMENT ON COLUMN public.rep_event_closure_marks.marked_place_id IS 'The game''s team place (rep_team_places) when marked. No foreign key: a snapshot.';
COMMENT ON COLUMN public.rep_event_closure_marks.marked_location IS 'The game''s typed place when marked.';
COMMENT ON COLUMN public.rep_event_closure_marks.coach_emailed_at IS 'When the team''s coach was emailed about the mark (Session 2B; null = not yet, or no coach to email).';
COMMENT ON COLUMN public.rep_event_closure_marks.reopen_told_at IS 'When the coach got Reopen''s one line (Session 2B, K11; null = not reopened, or not told).';

-- ─── 5 · "Link both" is not news (K7) ────────────────────────────────────────────────────────────────────────────────

-- Migration 409's recorder, with one rule added (v_link). Everything else is 409's text.
CREATE OR REPLACE FUNCTION public.league_games_record_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_published timestamptz;
  v_first     league_game_changes%ROWTYPE;
  v_sent      jsonb;
  v_when      boolean;
  v_where     boolean;
  v_link      boolean;
  v_state     boolean;
  v_kind      text;
  v_source    text := CASE WHEN current_setting('league.change_source', true) = 'club' THEN 'club' ELSE 'league' END;
BEGIN
  SELECT d.schedule_published_at INTO v_published FROM league_divisions d WHERE d.id = NEW.division_id;
  IF v_published IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO league_game_changes(org_id, season_id, division_id, game_id, kind, before, after, source)
    VALUES (NEW.org_id, NEW.season_id, NEW.division_id, NEW.id, 'added', NULL, league_game_snapshot(NEW), v_source);
    RETURN NEW;
  END IF;

  v_when  := NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at;
  -- ⚖ "LINK BOTH" IS NOT NEWS (Club Website Stage 2, K7), and ONLY "Link both": the closure press turns
  -- league.quiet_link on (transaction-local) around its own link step and off again. Any other writer — the game window,
  -- the club schedule's time move (mig 411 keeps the typed text while it sets a place) — records exactly as before, so a
  -- real move to a place whose name happens to be inside old typed text is still news. The game had no place id and no
  -- diamond, gains a place (no diamond), keeps its typed text, and that text holds the place's name. The send's half of
  -- the rule is lib/league-game-changes.ts quietLinkOf (the gap this leaves between held rows).
  v_link  := coalesce(current_setting('league.quiet_link', true), '') = 'on'
         AND OLD.org_venue_id IS NULL AND OLD.org_venue_facility_id IS NULL
         AND NEW.org_venue_id IS NOT NULL AND NEW.org_venue_facility_id IS NULL
         AND NEW.location IS NOT DISTINCT FROM OLD.location
         AND place_name_in_typed((SELECT v.name FROM org_venues v WHERE v.id = NEW.org_venue_id), OLD.location);
  v_where := NOT v_link AND (NEW.location IS DISTINCT FROM OLD.location OR NEW.org_venue_id IS DISTINCT FROM OLD.org_venue_id
          OR NEW.org_venue_facility_id IS DISTINCT FROM OLD.org_venue_facility_id);
  v_state := league_game_public_state(NEW.status) <> league_game_public_state(OLD.status);
  IF NOT (v_when OR v_where OR v_state) THEN
    RETURN NEW;
  END IF;

  -- The date families last heard: the earliest held change's `before`, or the game as it stood (nothing held).
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    SELECT * INTO v_first FROM league_game_changes c
     WHERE c.game_id = NEW.id AND c.sent_at IS NULL ORDER BY c.created_at, c.id LIMIT 1;
    IF FOUND AND v_first.kind = 'added' THEN
      NEW.moved_from := NULL;
    ELSE
      v_sent := CASE WHEN FOUND THEN v_first.before ELSE league_game_snapshot(OLD) END;
      IF NEW.scheduled_at IS DISTINCT FROM (v_sent->>'scheduledAt')::timestamptz THEN
        NEW.moved_from := (v_sent->>'scheduledAt')::timestamptz;
      ELSE
        NEW.moved_from := (v_sent->>'movedFrom')::timestamptz;
      END IF;
    END IF;
  END IF;

  v_kind := CASE
    WHEN v_state AND league_game_public_state(NEW.status) = 'cancelled' THEN 'cancelled'
    WHEN v_state AND league_game_public_state(NEW.status) = 'postponed' THEN 'postponed'
    WHEN v_state AND OLD.status = 'postponed' THEN 'given_date'
    WHEN v_state THEN 'back_on'
    WHEN v_when THEN 'moved'
    ELSE 'place' END;

  INSERT INTO league_game_changes(org_id, season_id, division_id, game_id, kind, before, after, source)
  VALUES (NEW.org_id, NEW.season_id, NEW.division_id, NEW.id, v_kind, league_game_snapshot(OLD), league_game_snapshot(NEW),
          v_source);
  RETURN NEW;
END $$;

-- ─── 6 · The press ───────────────────────────────────────────────────────────────────────────────────────────────────

-- p_places: [{"venueId": uuid|null, "facilityId": uuid|null}] in the window's order; one entry with no venueId = every
--           place ("All our fields"); otherwise one entry per place (a whole place, or one diamond of it).
-- p_league: [{"id", "seen"}] the house league games to postpone or cancel (seen = updated_at as the window read it).
-- p_rep:    [{"id", "seen"}] the rep games to mark.
-- p_links:  [{"kind": "league"|"rep", "id", "venueId"}] typed-in games to link to a closed place ("Link both"); a game
--           may be linked and left on.
-- Returns refusal null + what it wrote (replay true when this press key already ran), or a refusal with NOTHING written:
--   invalid, past (the Day is before the club's today), not_found, finished (a game's season is over), draft (a game in a
--   division whose schedule is not out), changed (`changed` names the games: moved, called off, scored, removed, edited
--   since the window read it, or no longer at the place).
CREATE OR REPLACE FUNCTION public.org_place_closure_press(
  p_org uuid, p_actor uuid, p_press_key uuid, p_places jsonb, p_first_day date, p_last_day date,
  p_verb text, p_line text, p_league jsonb, p_rep jsonb, p_links jsonb
) RETURNS TABLE (refusal text, changed uuid[], closures uuid[], rainouts uuid[], marks integer, replay boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_line text;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_places jsonb;
  v_np integer; v_nall integer;
  v_league uuid[]; v_rep uuid[]; v_link_league uuid[]; v_link_rep uuid[];
  v_all_league uuid[]; v_all_rep uuid[];
  v_divs uuid[]; v_div uuid;
  v_changed uuid[];
  v_assign_league jsonb; v_assign_rep jsonb;
  v_t0 timestamptz; v_ends timestamptz;
  v_closures uuid[]; v_rainouts uuid[]; v_marks integer := 0; v_held integer;
BEGIN
  -- ── The request's shape ──
  v_line := nullif(btrim(coalesce(p_line, '')), '');
  IF p_org IS NULL OR p_press_key IS NULL OR p_verb IS NULL OR p_verb NOT IN ('postponed', 'cancelled')
     OR p_first_day IS NULL OR p_last_day IS NULL OR p_last_day < p_first_day OR p_last_day - p_first_day > 13
     OR (v_line IS NOT NULL AND char_length(v_line) > 120)
     OR jsonb_typeof(p_places) IS DISTINCT FROM 'array' OR jsonb_typeof(p_league) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_rep) IS DISTINCT FROM 'array' OR jsonb_typeof(p_links) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_places) NOT BETWEEN 1 AND 10
     OR jsonb_array_length(p_league) > 500 OR jsonb_array_length(p_rep) > 200 OR jsonb_array_length(p_links) > 500 THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
  END IF;

  -- ── A retried press runs once ── (the key's lock first, so two copies of one press cannot both pass this check)
  PERFORM pg_advisory_xact_lock(hashtextextended('place_closure_press:' || p_press_key::text, 0));
  IF EXISTS (SELECT 1 FROM org_place_closures c WHERE c.press_key = p_press_key) THEN
    IF EXISTS (SELECT 1 FROM org_place_closures c WHERE c.press_key = p_press_key AND c.org_id <> p_org) THEN
      RETURN QUERY SELECT 'invalid'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
    END IF;
    RETURN QUERY SELECT NULL::text, ARRAY[]::uuid[],
      (SELECT array_agg(c.id ORDER BY c.press_seq) FROM org_place_closures c WHERE c.press_key = p_press_key),
      (SELECT coalesce(array_agg(r.id ORDER BY r.id), ARRAY[]::uuid[]) FROM league_rainouts r
         JOIN org_place_closures c ON c.id = r.closure_id WHERE c.press_key = p_press_key),
      (SELECT count(*)::integer FROM rep_event_closure_marks m
         JOIN org_place_closures c ON c.id = m.closure_id WHERE c.press_key = p_press_key),
      true;
    RETURN;
  END IF;

  IF p_first_day < v_today THEN
    RETURN QUERY SELECT 'past'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
  END IF;

  -- ── The places: the club's own, one entry per place, or "every place" alone ──
  SELECT count(*), count(*) FILTER (WHERE nullif(e->>'venueId', '') IS NULL) INTO v_np, v_nall
    FROM jsonb_array_elements(p_places) e;
  IF v_nall > 0 THEN
    IF v_np <> 1 OR nullif(p_places->0->>'facilityId', '') IS NOT NULL THEN
      RETURN QUERY SELECT 'invalid'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
    END IF;
    v_places := jsonb_build_array(jsonb_build_object('seq', 1, 'scope', 'all', 'v', NULL, 'f', NULL, 'name', NULL, 'fname', NULL));
  ELSE
    -- The places held still for the press (a rename would change what "Link both" may link; a delete would fail the
    -- closure's foreign key mid-press) — and FIRST, before any game row, in the order a place's delete takes them.
    PERFORM 1 FROM org_venues ov
     WHERE ov.org_id = p_org AND ov.id IN (SELECT (e->>'venueId')::uuid FROM jsonb_array_elements(p_places) e)
     ORDER BY ov.id FOR SHARE;
    PERFORM 1 FROM org_venue_facilities fac
     WHERE fac.id IN (SELECT nullif(e->>'facilityId', '')::uuid FROM jsonb_array_elements(p_places) e)
     ORDER BY fac.id FOR SHARE;
    SELECT jsonb_agg(jsonb_build_object(
             'seq', x.ord, 'scope', CASE WHEN x.f IS NULL THEN 'place' ELSE 'diamond' END,
             'v', x.v, 'f', x.f, 'name', ov.name, 'fname', fac.name) ORDER BY x.ord)
      INTO v_places
      FROM (SELECT ord, (e->>'venueId')::uuid v, nullif(e->>'facilityId', '')::uuid f
              FROM jsonb_array_elements(p_places) WITH ORDINALITY t(e, ord)) x
      JOIN org_venues ov ON ov.id = x.v AND ov.org_id = p_org
      LEFT JOIN org_venue_facilities fac ON fac.id = x.f AND fac.org_venue_id = x.v;
    IF coalesce(jsonb_array_length(v_places), 0) <> v_np
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_places) pl WHERE pl->>'f' IS NOT NULL AND pl->>'fname' IS NULL)
       OR (SELECT count(DISTINCT pl->>'v') FROM jsonb_array_elements(v_places) pl) <> v_np THEN
      RETURN QUERY SELECT 'invalid'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
    END IF;
  END IF;

  -- ── The games named ──
  SELECT coalesce(array_agg(DISTINCT (e->>'id')::uuid), ARRAY[]::uuid[]) INTO v_league FROM jsonb_array_elements(p_league) e;
  SELECT coalesce(array_agg(DISTINCT (e->>'id')::uuid), ARRAY[]::uuid[]) INTO v_rep FROM jsonb_array_elements(p_rep) e;
  IF cardinality(v_league) <> jsonb_array_length(p_league) OR cardinality(v_rep) <> jsonb_array_length(p_rep)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_links) e
                 WHERE e->>'kind' IS NULL OR e->>'kind' NOT IN ('league', 'rep') OR e->>'id' IS NULL
                    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_places) pl
                                    WHERE pl->>'scope' <> 'all' AND (pl->>'v')::uuid = (e->>'venueId')::uuid))
     OR (SELECT count(DISTINCT (e->>'kind') || ((e->>'id')::uuid)::text) FROM jsonb_array_elements(p_links) e) <> jsonb_array_length(p_links) THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
  END IF;
  SELECT coalesce(array_agg((e->>'id')::uuid), ARRAY[]::uuid[]) INTO v_link_league FROM jsonb_array_elements(p_links) e WHERE e->>'kind' = 'league';
  SELECT coalesce(array_agg((e->>'id')::uuid), ARRAY[]::uuid[]) INTO v_link_rep FROM jsonb_array_elements(p_links) e WHERE e->>'kind' = 'rep';
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x), ARRAY[]::uuid[]) INTO v_all_league FROM unnest(v_league || v_link_league) x;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x), ARRAY[]::uuid[]) INTO v_all_rep FROM unnest(v_rep || v_link_rep) x;

  -- Every game the club's own (cross-tenant): another club's game is not_found. A game that no longer exists at all is a
  -- change (it was removed after the window read it) and is named with the others, after the locks, below.
  IF EXISTS (SELECT 1 FROM league_games g WHERE g.id = ANY (v_all_league) AND g.org_id <> p_org)
     OR EXISTS (SELECT 1 FROM rep_team_events ev WHERE ev.id = ANY (v_all_rep) AND ev.org_id <> p_org) THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
  END IF;
  -- ── The locks: every division of every season the press touches, ONE AT A TIME IN ID ORDER (the send, Undo and the
  --    Rainout take the same lock in the same order, so two closures — or a closure and a send — cannot deadlock); then
  --    the rows, so the game window's save and the coach's edit cannot land between the check and the write. ──
  SELECT coalesce(array_agg(DISTINCT g.division_id ORDER BY g.division_id), ARRAY[]::uuid[]) INTO v_divs
    FROM league_games g WHERE g.id = ANY (v_all_league);
  FOREACH v_div IN ARRAY v_divs LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('league_schedule:' || v_div::text, 0));
  END LOOP;
  PERFORM 1 FROM league_games g WHERE g.id = ANY (v_all_league) ORDER BY g.id FOR UPDATE;
  -- Only rep GAMES are locked: a practice id (never offered, so stale or made up) is refused below as changed without
  -- taking a lock the club schedule's practice moves could be waiting on in the other order.
  PERFORM 1 FROM rep_team_events ev
   WHERE ev.id = ANY (v_all_rep) AND ev.event_type IN ('league_game', 'tournament_game') ORDER BY ev.id FOR UPDATE;

  -- A season finished while this waited for the locks (read after them, as the send reads it).
  IF EXISTS (SELECT 1 FROM league_games g JOIN league_seasons s ON s.id = g.season_id
              WHERE g.id = ANY (v_all_league) AND s.status IN ('completed', 'archived')) THEN
    RETURN QUERY SELECT 'finished'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
  END IF;

  -- ── Every refusal, decided BEFORE the first write ──
  -- A game removed while this waited for a lock is a change, not a failure.
  SELECT coalesce(array_agg(x ORDER BY x), ARRAY[]::uuid[]) INTO v_changed FROM (
    SELECT x FROM unnest(v_all_league) x WHERE NOT EXISTS (SELECT 1 FROM league_games g WHERE g.id = x)
    UNION SELECT x FROM unnest(v_all_rep) x WHERE NOT EXISTS (SELECT 1 FROM rep_team_events ev WHERE ev.id = x)) gone;
  IF cardinality(v_changed) > 0 THEN
    RETURN QUERY SELECT 'changed'::text, v_changed, NULL::uuid[], NULL::uuid[], 0, false; RETURN;
  END IF;

  -- A draft division's (or a draft season's) game is never called off (a draft records nothing and emails nobody).
  IF EXISTS (SELECT 1 FROM league_games g JOIN league_divisions d ON d.id = g.division_id
               JOIN league_seasons s ON s.id = g.season_id
              WHERE g.id = ANY (v_league) AND (d.schedule_published_at IS NULL OR s.status = 'draft')) THEN
    RETURN QUERY SELECT 'draft'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
  END IF;

  SELECT coalesce(array_agg(DISTINCT id ORDER BY id), ARRAY[]::uuid[]) INTO v_changed FROM (
    -- House league: still to play (a scored game is `completed`, never touched, K6; a started game is still `scheduled`
    -- and is touched only because the admin ticked it), on a closed day, as the window saw it, at a closed place.
    SELECT g.id FROM jsonb_array_elements(p_league) e JOIN league_games g ON g.id = (e->>'id')::uuid
     WHERE g.status <> 'scheduled' OR g.scheduled_at IS NULL
        OR (g.scheduled_at AT TIME ZONE 'America/Toronto')::date NOT BETWEEN p_first_day AND p_last_day
        OR (e->>'seen') IS NULL
        OR date_trunc('milliseconds', g.updated_at) <> date_trunc('milliseconds', (e->>'seen')::timestamptz)
        OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_places) pl
                        WHERE place_closure_match(pl->>'scope', (pl->>'v')::uuid, (pl->>'f')::uuid, pl->>'name',
                                                  g.org_venue_id, g.org_venue_facility_id, g.location) IS NOT NULL)
    UNION ALL
    -- Rep: a game (not a club tournament's, which only its own Rain delay moves), on, unscored, on a closed day, as the
    -- window saw it, at a closed place. Its typed text is its own typed place and its team place's name, together.
    SELECT ev.id FROM jsonb_array_elements(p_rep) e JOIN rep_team_events ev ON ev.id = (e->>'id')::uuid
      LEFT JOIN rep_team_places tp ON tp.id = ev.place_id
     WHERE ev.event_type NOT IN ('league_game', 'tournament_game') OR ev.source_tournament_game_id IS NOT NULL
        OR ev.status <> 'scheduled'
        OR ev.team_score IS NOT NULL OR ev.opponent_score IS NOT NULL OR ev.result IS NOT NULL
        OR (ev.starts_at AT TIME ZONE 'America/Toronto')::date NOT BETWEEN p_first_day AND p_last_day
        OR (e->>'seen') IS NULL
        OR date_trunc('milliseconds', ev.updated_at) <> date_trunc('milliseconds', (e->>'seen')::timestamptz)
        OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_places) pl
                        WHERE place_closure_match(pl->>'scope', (pl->>'v')::uuid, (pl->>'f')::uuid, pl->>'name',
                                                  ev.org_venue_id, ev.org_venue_facility_id,
                                                  concat_ws(' · ', ev.location, tp.name)) IS NOT NULL)
    UNION ALL
    -- A link: the game still has no place id and no diamond, is on a closed day, and its typed text holds the name of the
    -- place it is linked to (so the recorder reads it as "Link both", not as a move).
    SELECT g.id FROM jsonb_array_elements(p_links) e JOIN league_games g ON g.id = (e->>'id')::uuid
      JOIN org_venues ov ON ov.id = (e->>'venueId')::uuid
     WHERE e->>'kind' = 'league'
       AND (g.status <> 'scheduled' OR g.org_venue_id IS NOT NULL OR g.org_venue_facility_id IS NOT NULL OR g.scheduled_at IS NULL
            OR (g.scheduled_at AT TIME ZONE 'America/Toronto')::date NOT BETWEEN p_first_day AND p_last_day
            OR NOT place_name_in_typed(ov.name, g.location))
    UNION ALL
    SELECT ev.id FROM jsonb_array_elements(p_links) e JOIN rep_team_events ev ON ev.id = (e->>'id')::uuid
      JOIN org_venues ov ON ov.id = (e->>'venueId')::uuid
      LEFT JOIN rep_team_places tp ON tp.id = ev.place_id
     WHERE e->>'kind' = 'rep'
       AND (ev.event_type NOT IN ('league_game', 'tournament_game') OR ev.source_tournament_game_id IS NOT NULL
            OR ev.status <> 'scheduled'
            OR ev.team_score IS NOT NULL OR ev.opponent_score IS NOT NULL OR ev.result IS NOT NULL
            OR ev.org_venue_id IS NOT NULL OR ev.org_venue_facility_id IS NOT NULL
            OR (ev.starts_at AT TIME ZONE 'America/Toronto')::date NOT BETWEEN p_first_day AND p_last_day
            OR NOT place_name_in_typed(ov.name, concat_ws(' · ', ev.location, tp.name)))
  ) bad;
  IF cardinality(v_changed) > 0 THEN
    RETURN QUERY SELECT 'changed'::text, v_changed, NULL::uuid[], NULL::uuid[], 0, false; RETURN;
  END IF;

  -- ════ From here on nothing refuses: a failure RAISES, and the whole call rolls back. ════
  v_t0 := clock_timestamp();
  v_ends := ((p_last_day + 1)::timestamp AT TIME ZONE 'America/Toronto');

  INSERT INTO org_place_closures(org_id, press_key, press_seq, scope, org_venue_id, org_venue_facility_id, place_name,
                                 facility_name, first_day, last_day, shows_from, ends_at, verb, line, closed_by)
  SELECT p_org, p_press_key, (pl->>'seq')::smallint, pl->>'scope', (pl->>'v')::uuid, (pl->>'f')::uuid, pl->>'name',
         pl->>'fname', p_first_day, p_last_day, now(), v_ends, p_verb, v_line, p_actor
    FROM jsonb_array_elements(v_places) pl;
  SELECT array_agg(c.id ORDER BY c.press_seq) INTO v_closures FROM org_place_closures c WHERE c.press_key = p_press_key;

  -- Each game belongs to the first closed place (in the window's order) it is at — decided BEFORE any link moves an id.
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'closure', m.id, 'season', g.season_id, 'division', g.division_id,
                                               'day', (g.scheduled_at AT TIME ZONE 'America/Toronto')::date)), '[]'::jsonb)
    INTO v_assign_league
    FROM league_games g CROSS JOIN LATERAL (
      SELECT c.id FROM org_place_closures c
       WHERE c.press_key = p_press_key
         AND place_closure_match(c.scope, c.org_venue_id, c.org_venue_facility_id, c.place_name,
                                 g.org_venue_id, g.org_venue_facility_id, g.location) IS NOT NULL
       ORDER BY c.press_seq LIMIT 1) m
   WHERE g.id = ANY (v_league);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', ev.id, 'closure', m.id)), '[]'::jsonb) INTO v_assign_rep
    FROM rep_team_events ev LEFT JOIN rep_team_places tp ON tp.id = ev.place_id
    CROSS JOIN LATERAL (
      SELECT c.id FROM org_place_closures c
       WHERE c.press_key = p_press_key
         AND place_closure_match(c.scope, c.org_venue_id, c.org_venue_facility_id, c.place_name,
                                 ev.org_venue_id, ev.org_venue_facility_id, concat_ws(' · ', ev.location, tp.name)) IS NOT NULL
       ORDER BY c.press_seq LIMIT 1) m
   WHERE ev.id = ANY (v_rep);
  IF jsonb_array_length(v_assign_league) <> cardinality(v_league) OR jsonb_array_length(v_assign_rep) <> cardinality(v_rep) THEN
    RAISE EXCEPTION 'A closure game matched no closed place';
  END IF;

  -- "Link both": the place id only; the typed text stays. The recorder writes no change for it (section 5) — only while
  -- league.quiet_link is on, which is only here, and off again before the games are called off.
  PERFORM set_config('league.quiet_link', 'on', true);
  UPDATE league_games g SET org_venue_id = (e->>'venueId')::uuid, updated_at = now()
    FROM jsonb_array_elements(p_links) e WHERE e->>'kind' = 'league' AND g.id = (e->>'id')::uuid;
  PERFORM set_config('league.quiet_link', 'off', true);
  UPDATE rep_team_events ev SET org_venue_id = (e->>'venueId')::uuid, updated_at = now()
    FROM jsonb_array_elements(p_links) e WHERE e->>'kind' = 'rep' AND ev.id = (e->>'id')::uuid;

  -- House league: called off; the recorder writes one held row per game (mig 409, source 'league').
  UPDATE league_games g SET status = p_verb, updated_at = now() WHERE g.id = ANY (v_league);
  SELECT count(*) INTO v_held FROM league_game_changes c
   WHERE c.game_id = ANY (v_league) AND c.sent_at IS NULL AND c.created_at >= v_t0 AND c.kind = p_verb;
  IF v_held <> cardinality(v_league) THEN
    RAISE EXCEPTION 'A closure game did not record its change';
  END IF;

  -- One Rainout record per closure, season and day: how the families' emails already go (per division, per record).
  WITH a AS (
    SELECT (x->>'id')::uuid AS id, (x->>'closure')::uuid AS closure, (x->>'season')::uuid AS season,
           (x->>'division')::uuid AS division, (x->>'day')::date AS day
      FROM jsonb_array_elements(v_assign_league) x
  ), ch AS (
    SELECT c.game_id, c.id FROM league_game_changes c
     WHERE c.game_id = ANY (v_league) AND c.sent_at IS NULL AND c.created_at >= v_t0 AND c.kind = p_verb
  ), ins AS (
    INSERT INTO league_rainouts(org_id, season_id, day, verb, line, game_ids, division_ids, change_ids, created_by,
                                closure_id, org_venue_id)
    SELECT p_org, a.season, a.day, p_verb, v_line, array_agg(a.id ORDER BY a.id),
           array_agg(DISTINCT a.division ORDER BY a.division), array_agg(ch.id ORDER BY a.id), p_actor, a.closure, cl.org_venue_id
      FROM a JOIN ch ON ch.game_id = a.id JOIN org_place_closures cl ON cl.id = a.closure
     GROUP BY a.season, a.day, a.closure, cl.org_venue_id
    RETURNING id
  )
  SELECT coalesce(array_agg(ins.id ORDER BY ins.id), ARRAY[]::uuid[]) INTO v_rainouts FROM ins;

  -- Rep: marked, never moved (A5). The mark keeps the game as it is now (after any link above).
  INSERT INTO rep_event_closure_marks(org_id, closure_id, event_id, team_id, marked_starts_at, marked_org_venue_id,
                                      marked_facility_id, marked_place_id, marked_location)
  SELECT p_org, (x->>'closure')::uuid, ev.id, ev.team_id, ev.starts_at, ev.org_venue_id, ev.org_venue_facility_id,
         ev.place_id, ev.location
    FROM jsonb_array_elements(v_assign_rep) x JOIN rep_team_events ev ON ev.id = (x->>'id')::uuid;
  GET DIAGNOSTICS v_marks = ROW_COUNT;

  RETURN QUERY SELECT NULL::text, ARRAY[]::uuid[], v_closures, v_rainouts, v_marks, false;
END $$;

-- ─── 7 · Reopen ──────────────────────────────────────────────────────────────────────────────────────────────────────

-- Returns refusal null + when it was reopened (already true when it had been), or 'not_found'. Moves no game (K11 A):
-- the strip and the marks read reopened_at.
CREATE OR REPLACE FUNCTION public.org_place_closure_reopen(p_org uuid, p_closure uuid, p_actor uuid)
RETURNS TABLE (refusal text, reopened timestamptz, already boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_at timestamptz;
BEGIN
  SELECT c.reopened_at INTO v_at FROM org_place_closures c WHERE c.id = p_closure AND c.org_id = p_org FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::timestamptz, false; RETURN;
  END IF;
  IF v_at IS NOT NULL THEN
    RETURN QUERY SELECT NULL::text, v_at, true; RETURN;
  END IF;
  UPDATE org_place_closures c SET reopened_at = now(), reopened_by = p_actor WHERE c.id = p_closure RETURNING c.reopened_at INTO v_at;
  RETURN QUERY SELECT NULL::text, v_at, false;
END $$;

REVOKE ALL ON FUNCTION public.place_name_in_typed(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.place_closure_match(text, uuid, uuid, text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.org_place_closure_press(uuid, uuid, uuid, jsonb, date, date, text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.org_place_closure_reopen(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_games_record_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_name_in_typed(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.place_closure_match(text, uuid, uuid, text, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.org_place_closure_press(uuid, uuid, uuid, jsonb, date, date, text, text, jsonb, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.org_place_closure_reopen(uuid, uuid, uuid) TO service_role;

COMMIT;

-- Verify (dev, then prod):
--   SELECT count(*) FROM information_schema.tables WHERE table_name IN ('org_place_closures', 'rep_event_closure_marks'); -- 2
--   SELECT count(*) FROM information_schema.columns WHERE table_name = 'league_rainouts'
--     AND column_name IN ('closure_id', 'org_venue_id');                                                          -- 2
--   SELECT count(*) FROM pg_proc WHERE proname IN ('place_name_in_typed', 'place_closure_match',
--     'org_place_closure_press', 'org_place_closure_reopen');                                                     -- 4
--   SELECT count(*) FROM pg_proc WHERE proname = 'league_games_record_change' AND prosrc LIKE '%v_link%';         -- 1
--   routine_privileges EXECUTE on the four = postgres + service_role only.
-- Proof (rolled back): node scripts/db-query.mjs --dev -f scripts/club-website-stage2-closure-check.sql
