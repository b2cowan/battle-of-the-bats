-- ---------------------------------------------------------------
-- Migration 409 — House League Stage 9d-2b Part 1: a division's schedule is a draft until it is published, and a
-- published game's change waits to be sent (plan HOUSE_LEAGUE_STAGE9_PLAN.md §0h, rulings 9d2·1, ·7–·11, ·13, ·16 and
-- the build-start rulings 9d2b·A–D, 2026-10-28; build prompt docs/projects/active/HOUSE_LEAGUE_STAGE9D2B_BUILD_PROMPT.md).
--
-- WHY: until now a saved game was on the public schedule at once (9d2a·A). 9d-2b gives a division a publish mark,
-- emails each family once when it is pressed, and holds every later change to a published game until the league admin
-- sends it (one email per family per send).
--
-- WHAT CHANGES:
--   (1) league_divisions.schedule_published_at / _by — the schedule's mark, separate from teams_published_at (9d2·8:
--       teams first). Written only by league_division_schedule_publish (and the backfill). Never cleared (9d2·1).
--   (2) league_games.slot_use_id — the division game time a game sits on (9d2b·B). ⚠ It references
--       league_slot_uses(slot_id), the use's KEY, ON UPDATE CASCADE: when the club moves house league's time,
--       club_schedule_apply_changes re-keys the use to the new slot (mig 392 §6), and its games' link follows. ON DELETE
--       SET NULL: the club taking the time back ends the use; the game stays (9d2·16 decides what becomes of it).
--       league_games.moved_from — the date families last heard, once a published game is re-dated (9d2b·D, "Moved · Was").
--   (3) league_game_changes — what changed on a PUBLISHED division's game since families last heard: one row per edit,
--       `before` = the game as it was, `after` = as it became. Held while sent_at is null.
--       ⚖ WRITTEN BY A TRIGGER, NOT BY THE ROUTES (the build prompt's "inside the same transaction as the game write —
--       never a second call that can fail alone"): a row trigger is in the writer's own statement, so every writer —
--       the add, the window's save, Postpone, Cancel, a put-back, and Part 5's club time move — records its change
--       without knowing to. A route cannot forget; the guard test pins that the trigger exists, not each caller.
--       ⚖ WHAT A SEND SAYS IS THE NET EFFECT (the reducer, lib/league-game-changes.ts): the game as families last heard
--       it (the earliest held row's `before`; null for a game added since) against the game now. A game moved twice
--       reads once; added then cancelled reads nothing; moved then moved back reads nothing. So the kinds are labels
--       for the list, not the email's source, and Undo removes the rows (there is no `removed_before_send` row).
--       ⚖ THE PUBLIC PAGE AND THE COACH'S PAGE READ THE LAST-SENT GAME (9d2·16 "until the league admin sends, families
--       see the old dates"): a game with a held row reads its earliest `before`; a game added since is not shown.
--       A score or a note is never a change (no row): only when, where and whether it is on.
--   (4) league_schedule_emails — one row per family a schedule notice was going to (the 9c placement-email shape:
--       grouped by lower(btrim(guardian_email)), the children's registrations), status pending → sent / failed, so a
--       stopped send finishes from the rows it missed. Written in the publish / send transaction.
--   (5) league_season_notices.kind gains schedule_published and games_changed (the history's Automatic rows, f4).
--   (6) Functions (service role only, advisory-locked on the division, never a row lock inside a trigger — 9b-2):
--       league_division_schedule_publish (mark + notice + family rows, one transaction; refuses teams_first, already,
--       no_games, changed, finished), league_division_changes_send (claims exactly the held rows the sender saw, once;
--       a second press is `already`, nothing held is `nothing`), league_game_undo (a held change put back: the game
--       as families last heard it, its rows gone; a game added since is deleted), league_games_generate_save (the
--       Generate Save, atomic and locked: two simultaneous Saves can no longer both insert; refuses published and
--       has_games).
--   (7) Backfill (9d2b·A): a division that already has games AND published teams counts as published, silently — no
--       notice, no family rows (the mig 377 rule: a season being played never emails because a feature turned on).
--       Every other division with games returns to draft and leaves the public page.
--
-- INVISIBLE to the drift check: the functions and the trigger (declared in MANUAL_PROD_STEPS.json with prosrc checks).
-- Re-runnable. Requires 377 (teams_published_at), 385 (league_season_notices), 392 (league_slot_uses).
-- Proved by scripts/house-league-schedule-publish-check.sql (DEV, rolled back).
-- ---------------------------------------------------------------

BEGIN;

-- ─── 1 · The schedule's publish mark ─────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.league_divisions ADD COLUMN IF NOT EXISTS schedule_published_at timestamptz;
ALTER TABLE public.league_divisions
  ADD COLUMN IF NOT EXISTS schedule_published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.league_divisions.schedule_published_at IS
  'When the division''s schedule was published (House League 9d-2b, 9d2·1): its games go on the public schedule and each '
  'family was emailed once. Null = a draft (the public page says the schedule is coming). Never cleared — there is no '
  'unpublish. Written only by league_division_schedule_publish (and mig 409''s silent backfill, 9d2b·A). Offered only once '
  'teams_published_at is set (9d2·8).';
COMMENT ON COLUMN public.league_divisions.schedule_published_by IS
  'Who pressed Publish schedule. Null for mig 409''s backfill and a deleted user.';

-- ─── 2 · A game's division game time, and the date families last heard ───────────────────────────────────────────────

ALTER TABLE public.league_games
  ADD COLUMN IF NOT EXISTS slot_use_id uuid REFERENCES public.league_slot_uses(slot_id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.league_games ADD COLUMN IF NOT EXISTS moved_from timestamptz;
CREATE INDEX IF NOT EXISTS league_games_slot_use_idx ON public.league_games (slot_use_id) WHERE slot_use_id IS NOT NULL;

COMMENT ON COLUMN public.league_games.slot_use_id IS
  'The division game time this game sits on (9d-2b, 9d2b·B): league_slot_uses(slot_id), the use''s key. ON UPDATE CASCADE — '
  'the club moving house league''s time re-keys the use and the game follows it (9d2·13); ON DELETE SET NULL — the club '
  'taking the time back. Set by Generate''s Save and by a move onto division game time; null for a game outside every '
  'use (it stays as it is and says nothing).';
COMMENT ON COLUMN public.league_games.moved_from IS
  'A published game re-dated since families last heard: the date they heard (9d2b·D — "Moved · Was {date}"). Kept by the '
  'league_games_record_change trigger, never by a route: on a re-date it is the last-SENT date (the earliest held change''s '
  '`before`), so a game moved twice before a send still says the date families know, and a game moved back reads as it '
  'was. Null for a draft game, a game never re-dated, and a game added since the last send.';

-- ─── 3 · What changed on a published game since families last heard ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_game_changes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  season_id    uuid NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  division_id  uuid NOT NULL REFERENCES public.league_divisions(id) ON DELETE CASCADE,
  game_id      uuid NOT NULL REFERENCES public.league_games(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('added', 'moved', 'place', 'cancelled', 'postponed', 'given_date', 'back_on')),
  -- league_game_snapshot(): scheduledAt, endsAt, location, venueId, facilityId, status, movedFrom. Null = not yet a game.
  before       jsonb,
  after        jsonb NOT NULL,
  -- 'club' when the club's Send the changes moved the division's time (9d2·13; the tray's "The club moved …" line).
  source       text NOT NULL DEFAULT 'league' CHECK (source IN ('league', 'club')),
  created_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
  sent_at      timestamptz,
  notice_id    uuid REFERENCES public.league_season_notices(id) ON DELETE SET NULL,
  CHECK ((kind = 'added') = (before IS NULL))
);

CREATE INDEX IF NOT EXISTS league_game_changes_held_idx
  ON public.league_game_changes (division_id, created_at) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS league_game_changes_game_idx ON public.league_game_changes (game_id, created_at);
CREATE INDEX IF NOT EXISTS league_game_changes_season_idx ON public.league_game_changes (season_id) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS league_game_changes_org_idx ON public.league_game_changes (org_id);
CREATE INDEX IF NOT EXISTS league_game_changes_notice_idx ON public.league_game_changes (notice_id) WHERE notice_id IS NOT NULL;

ALTER TABLE public.league_game_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.league_game_changes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_game_changes TO service_role;

COMMENT ON TABLE public.league_game_changes IS
  'House League 9d-2b (Changes to send, f2): one row per change to a PUBLISHED division''s game — when, where or whether it '
  'is on; never a score or a note. Held while sent_at is null; league_division_changes_send stamps sent_at (and notice_id '
  'when families were emailed). Written only by the league_games_record_change trigger; removed by league_game_undo. '
  'What a send says is the NET effect (the earliest held `before` against the game now), so the kinds label the list only.';
COMMENT ON COLUMN public.league_game_changes.before IS
  'The game as it was before this edit (league_game_snapshot). The EARLIEST held row''s `before` is the game as families '
  'last heard it — what the public page and the coach''s page read until the send. Null only for kind = added.';
COMMENT ON COLUMN public.league_game_changes.notice_id IS
  'The games_changed notice that emailed this change. Null while held, and for a sent change that emailed nobody (its '
  'net effect was nothing, or the game had been played).';

-- The fields a family reads. One function, so the trigger, the undo and the reads never disagree on what "the game" is.
CREATE OR REPLACE FUNCTION public.league_game_snapshot(g public.league_games) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'scheduledAt', g.scheduled_at, 'endsAt', g.ends_at, 'location', g.location,
    'venueId', g.org_venue_id, 'facilityId', g.org_venue_facility_id, 'status', g.status, 'movedFrom', g.moved_from);
$$;

-- Whether a game is on, as a family hears it: a played game and a scheduled one are both on (a score is not news).
CREATE OR REPLACE FUNCTION public.league_game_public_state(p_status text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_status WHEN 'cancelled' THEN 'cancelled' WHEN 'postponed' THEN 'postponed' ELSE 'on' END;
$$;

-- ⚖ The recorder. BEFORE UPDATE so it can keep moved_from on the row being written; AFTER INSERT so the new game exists
-- for its change row's foreign key. Reads the division's mark; takes no lock (9b-2).
CREATE OR REPLACE FUNCTION public.league_games_record_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_published timestamptz;
  v_first     league_game_changes%ROWTYPE;
  v_sent      jsonb;
  v_when      boolean;
  v_where     boolean;
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
  v_where := NEW.location IS DISTINCT FROM OLD.location OR NEW.org_venue_id IS DISTINCT FROM OLD.org_venue_id
          OR NEW.org_venue_facility_id IS DISTINCT FROM OLD.org_venue_facility_id;
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

DROP TRIGGER IF EXISTS league_games_record_change_upd ON public.league_games;
CREATE TRIGGER league_games_record_change_upd
  BEFORE UPDATE ON public.league_games
  FOR EACH ROW EXECUTE FUNCTION public.league_games_record_change();
DROP TRIGGER IF EXISTS league_games_record_change_ins ON public.league_games;
CREATE TRIGGER league_games_record_change_ins
  AFTER INSERT ON public.league_games
  FOR EACH ROW EXECUTE FUNCTION public.league_games_record_change();

-- ─── 4 · Each family a schedule notice was going to ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_schedule_emails (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  season_id         uuid NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  division_id       uuid REFERENCES public.league_divisions(id) ON DELETE SET NULL,
  notice_id         uuid NOT NULL REFERENCES public.league_season_notices(id) ON DELETE CASCADE,
  guardian_email    text NOT NULL CHECK (guardian_email = lower(btrim(guardian_email)) AND guardian_email <> ''),
  -- The family's children whose teams' games this email is about, in name order (one part each, f3).
  registration_ids  uuid[] NOT NULL CHECK (cardinality(registration_ids) > 0),
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS league_schedule_emails_notice_idx ON public.league_schedule_emails (notice_id, status);
CREATE INDEX IF NOT EXISTS league_schedule_emails_org_idx ON public.league_schedule_emails (org_id);
CREATE INDEX IF NOT EXISTS league_schedule_emails_season_idx ON public.league_schedule_emails (season_id);

ALTER TABLE public.league_schedule_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.league_schedule_emails FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_schedule_emails TO service_role;

COMMENT ON TABLE public.league_schedule_emails IS
  'House League 9d-2b (f3): one row per family a Schedule published or Schedule changes notice was going to — grouped as '
  'Publish teams groups them (lower(btrim(guardian_email))), with the children it is about. Written pending in the publish / '
  'send transaction; the app marks each sent or failed as it goes, so a stopped send finishes from its pending rows. A '
  'service notice about the family''s own children (sendFamilyServiceBatch), so it reaches a family who left club news.';

-- ─── 5 · The history's two new Automatic rows ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.league_season_notices DROP CONSTRAINT IF EXISTS league_season_notices_kind_check;
ALTER TABLE public.league_season_notices
  ADD CONSTRAINT league_season_notices_kind_check
  CHECK (kind IN ('teams_published', 'practices_changed', 'schedule_published', 'games_changed'));

COMMENT ON COLUMN public.league_season_notices.kind IS
  'teams_published = Publish teams (9c); practices_changed = the club''s Send the changes moved or cancelled this season''s '
  'practices and emailed the teams'' families (Club Tier 11b Part 5, ruling 9d2·2); schedule_published = Publish schedule '
  '(9d-2b, 9d2·1); games_changed = a division''s Changes to send, or one urgent cancel or postpone (9d-2b, f2 / f5).';

-- ─── 6 · The writes ──────────────────────────────────────────────────────────────────────────────────────────────────

-- The family rows of a notice: the season's active children on these teams, one row per guardian email.
CREATE OR REPLACE FUNCTION public.league_schedule_emails_write(
  p_org uuid, p_season uuid, p_division uuid, p_notice uuid, p_teams uuid[]
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  INSERT INTO league_schedule_emails(org_id, season_id, division_id, notice_id, guardian_email, registration_ids)
  SELECT p_org, p_season, p_division, p_notice, lower(btrim(r.guardian_email)),
         array_agg(r.id ORDER BY r.player_first_name, r.player_last_name, r.id)
    FROM league_registrations r
   WHERE r.season_id = p_season AND r.status = 'active' AND r.team_id = ANY (p_teams)
     AND btrim(coalesce(r.guardian_email, '')) <> ''
   GROUP BY lower(btrim(r.guardian_email));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

-- How many families a set of teams reaches (the confirm windows' counts, the same grouping as the rows).
CREATE OR REPLACE FUNCTION public.league_schedule_family_count(p_season uuid, p_teams uuid[]) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(DISTINCT lower(btrim(r.guardian_email)))::integer
    FROM league_registrations r
   WHERE r.season_id = p_season AND r.status = 'active' AND r.team_id = ANY (p_teams)
     AND btrim(coalesce(r.guardian_email, '')) <> '';
$$;

-- Publish schedule (e2). p_games = how many games the window counted (the "changed while open" refusal).
CREATE OR REPLACE FUNCTION public.league_division_schedule_publish(
  p_org uuid, p_season uuid, p_division uuid, p_actor uuid, p_games integer
) RETURNS TABLE (refusal text, published_at timestamptz, published_by uuid, families integer, notice uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_div league_divisions%ROWTYPE; v_status text; v_games integer; v_teams uuid[]; v_notice uuid; v_n integer;
        v_now timestamptz := now();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('league_schedule:' || p_division::text, 0));
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF v_status IN ('completed', 'archived') THEN
    RETURN QUERY SELECT 'finished'::text, NULL::timestamptz, NULL::uuid, 0, NULL::uuid; RETURN;
  END IF;
  SELECT * INTO v_div FROM league_divisions d WHERE d.id = p_division AND d.season_id = p_season;
  IF NOT FOUND THEN RAISE EXCEPTION 'Division not found'; END IF;
  IF v_div.schedule_published_at IS NOT NULL THEN
    RETURN QUERY SELECT 'already'::text, v_div.schedule_published_at, v_div.schedule_published_by, 0, NULL::uuid; RETURN;
  END IF;
  IF v_div.teams_published_at IS NULL THEN
    RETURN QUERY SELECT 'teams_first'::text, NULL::timestamptz, NULL::uuid, 0, NULL::uuid; RETURN;
  END IF;
  SELECT count(*) INTO v_games FROM league_games g WHERE g.division_id = p_division AND g.status <> 'cancelled';
  IF v_games = 0 THEN
    RETURN QUERY SELECT 'no_games'::text, NULL::timestamptz, NULL::uuid, 0, NULL::uuid; RETURN;
  END IF;
  IF p_games IS DISTINCT FROM v_games THEN
    RETURN QUERY SELECT 'changed'::text, NULL::timestamptz, NULL::uuid, 0, NULL::uuid; RETURN;
  END IF;

  UPDATE league_divisions d SET schedule_published_at = v_now, schedule_published_by = p_actor WHERE d.id = p_division;

  SELECT coalesce(array_agg(t.id), ARRAY[]::uuid[]) INTO v_teams FROM league_teams t WHERE t.division_id = p_division;
  v_n := league_schedule_family_count(p_season, v_teams);
  IF v_n > 0 THEN
    INSERT INTO league_season_notices(org_id, season_id, division_id, kind, family_count, created_by, created_at)
    VALUES (p_org, p_season, p_division, 'schedule_published', v_n, p_actor, v_now)
    RETURNING id INTO v_notice;
    v_n := league_schedule_emails_write(p_org, p_season, p_division, v_notice, v_teams);
  END IF;
  RETURN QUERY SELECT NULL::text, v_now, p_actor, v_n, v_notice;
END $$;

-- Changes to send (f2), and one urgent cancel or postpone (f5): the caller names exactly the held rows it showed
-- (p_changes) and the games whose net effect is news to families (p_news, the reducer's answer). Claimed once.
CREATE OR REPLACE FUNCTION public.league_division_changes_send(
  p_org uuid, p_season uuid, p_division uuid, p_actor uuid, p_changes uuid[], p_news uuid[]
) RETURNS TABLE (refusal text, sent_at timestamptz, sent_by uuid, families integer, notice uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_games uuid[]; v_held uuid[]; v_teams uuid[]; v_notice uuid; v_n integer := 0;
        v_now timestamptz := now(); v_last record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('league_schedule:' || p_division::text, 0));
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM league_divisions d WHERE d.id = p_division AND d.season_id = p_season) THEN
    RAISE EXCEPTION 'Division not found';
  END IF;
  IF cardinality(coalesce(p_changes, ARRAY[]::uuid[])) = 0 THEN
    RETURN QUERY SELECT 'nothing'::text, NULL::timestamptz, NULL::uuid, 0, NULL::uuid; RETURN;
  END IF;

  -- A second press: every row it names has gone already. Say who sent them and when.
  IF NOT EXISTS (SELECT 1 FROM league_game_changes c WHERE c.id = ANY (p_changes) AND c.sent_at IS NULL) THEN
    SELECT n.created_by, n.created_at INTO v_last
      FROM league_game_changes c JOIN league_season_notices n ON n.id = c.notice_id
     WHERE c.id = ANY (p_changes) ORDER BY n.created_at DESC LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT 'already'::text, v_last.created_at, v_last.created_by, 0, NULL::uuid; RETURN;
    END IF;
    RETURN QUERY SELECT 'already'::text, NULL::timestamptz, NULL::uuid, 0, NULL::uuid; RETURN;
  END IF;
  IF v_status IN ('completed', 'archived') THEN
    RETURN QUERY SELECT 'finished'::text, NULL::timestamptz, NULL::uuid, 0, NULL::uuid; RETURN;
  END IF;

  -- The games the sender showed, and every row still held on them: they must be exactly what was shown, or a change
  -- landed (or was undone) while the window was open.
  SELECT coalesce(array_agg(DISTINCT c.game_id), ARRAY[]::uuid[]) INTO v_games
    FROM league_game_changes c WHERE c.id = ANY (p_changes) AND c.division_id = p_division;
  SELECT coalesce(array_agg(c.id ORDER BY c.id), ARRAY[]::uuid[]) INTO v_held
    FROM league_game_changes c WHERE c.game_id = ANY (v_games) AND c.sent_at IS NULL;
  IF v_held IS DISTINCT FROM (SELECT coalesce(array_agg(x ORDER BY x), ARRAY[]::uuid[])
                                FROM (SELECT DISTINCT unnest(p_changes) AS x) u) THEN
    RETURN QUERY SELECT 'changed'::text, NULL::timestamptz, NULL::uuid, 0, NULL::uuid; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(p_news, ARRAY[]::uuid[])) AS n(id) WHERE NOT (n.id = ANY (v_games))) THEN
    RAISE EXCEPTION 'A game to tell families about is not among the changes sent';
  END IF;

  SELECT coalesce(array_agg(DISTINCT x), ARRAY[]::uuid[]) INTO v_teams
    FROM league_games g, LATERAL unnest(ARRAY[g.home_team_id, g.away_team_id]) AS x
   WHERE g.id = ANY (coalesce(p_news, ARRAY[]::uuid[]));
  IF cardinality(v_teams) > 0 THEN
    v_n := league_schedule_family_count(p_season, v_teams);
  END IF;
  IF v_n > 0 THEN
    INSERT INTO league_season_notices(org_id, season_id, division_id, kind, family_count, created_by, created_at)
    VALUES (p_org, p_season, p_division, 'games_changed', v_n, p_actor, v_now)
    RETURNING id INTO v_notice;
    v_n := league_schedule_emails_write(p_org, p_season, p_division, v_notice, v_teams);
  END IF;

  UPDATE league_game_changes c SET sent_at = v_now, notice_id = v_notice WHERE c.id = ANY (v_held);
  RETURN QUERY SELECT NULL::text, v_now, p_actor, v_n, v_notice;
END $$;

-- Undo a held change (f2): the game goes back to what families last heard, and its held rows go. A game added since the
-- last send is deleted (families never heard of it). A game played since is not put back: its result is a record.
CREATE OR REPLACE FUNCTION public.league_game_undo(p_org uuid, p_season uuid, p_game uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_game league_games%ROWTYPE; v_first league_game_changes%ROWTYPE; v_b jsonb;
BEGIN
  SELECT * INTO v_game FROM league_games g WHERE g.id = p_game AND g.season_id = p_season AND g.org_id = p_org;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('league_schedule:' || v_game.division_id::text, 0));
  SELECT * INTO v_first FROM league_game_changes c
   WHERE c.game_id = p_game AND c.sent_at IS NULL ORDER BY c.created_at, c.id LIMIT 1;
  IF NOT FOUND THEN RETURN 'nothing'; END IF;
  IF v_game.status = 'completed' THEN RETURN 'played'; END IF;

  IF v_first.kind = 'added' THEN
    DELETE FROM league_games g WHERE g.id = p_game;
    RETURN NULL;
  END IF;

  v_b := v_first.before;
  UPDATE league_games g SET
    scheduled_at = (v_b->>'scheduledAt')::timestamptz, ends_at = (v_b->>'endsAt')::timestamptz,
    location = v_b->>'location', org_venue_id = (v_b->>'venueId')::uuid,
    org_venue_facility_id = (v_b->>'facilityId')::uuid, status = v_b->>'status',
    moved_from = (v_b->>'movedFrom')::timestamptz, updated_at = now()
   WHERE g.id = p_game;
  -- The put-back recorded itself as one more change; with the rest it goes (the game is as families last heard it).
  DELETE FROM league_game_changes c WHERE c.game_id = p_game AND c.sent_at IS NULL;
  RETURN NULL;
END $$;

-- Generate games' Save (c4), atomic: one division's Saves queue on the lock, and the second sees the first's games.
-- p_games: [{homeTeamId, awayTeamId, scheduledAt, endsAt, venueId, facilityId, location, slotUseId}].
CREATE OR REPLACE FUNCTION public.league_games_generate_save(
  p_org uuid, p_season uuid, p_division uuid, p_games jsonb
) RETURNS TABLE (refusal text, ids uuid[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_div league_divisions%ROWTYPE; v_ids uuid[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('league_schedule:' || p_division::text, 0));
  SELECT * INTO v_div FROM league_divisions d
   WHERE d.id = p_division AND d.season_id = p_season
     AND EXISTS (SELECT 1 FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org);
  IF NOT FOUND THEN RAISE EXCEPTION 'Division not found'; END IF;
  IF v_div.schedule_published_at IS NOT NULL THEN
    RETURN QUERY SELECT 'published'::text, ARRAY[]::uuid[]; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM league_games g WHERE g.division_id = p_division) THEN
    RETURN QUERY SELECT 'has_games'::text, ARRAY[]::uuid[]; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_games) AS x("homeTeamId" uuid, "awayTeamId" uuid)
              WHERE NOT EXISTS (SELECT 1 FROM league_teams t WHERE t.id = x."homeTeamId" AND t.division_id = p_division)
                 OR NOT EXISTS (SELECT 1 FROM league_teams t WHERE t.id = x."awayTeamId" AND t.division_id = p_division)) THEN
    RAISE EXCEPTION 'A team is not the division''s';
  END IF;

  WITH ins AS (
    INSERT INTO league_games(org_id, season_id, division_id, home_team_id, away_team_id, scheduled_at, ends_at,
                             org_venue_id, org_venue_facility_id, location, slot_use_id)
    SELECT p_org, p_season, p_division, x."homeTeamId", x."awayTeamId", x."scheduledAt", x."endsAt",
           x."venueId", x."facilityId", x.location, x."slotUseId"
      FROM jsonb_to_recordset(p_games) AS x("homeTeamId" uuid, "awayTeamId" uuid, "scheduledAt" timestamptz,
           "endsAt" timestamptz, "venueId" uuid, "facilityId" uuid, location text, "slotUseId" uuid)
    RETURNING id
  ) SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_ids FROM ins;
  RETURN QUERY SELECT NULL::text, v_ids;
END $$;

REVOKE ALL ON FUNCTION public.league_schedule_emails_write(uuid, uuid, uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_schedule_family_count(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_division_schedule_publish(uuid, uuid, uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_division_changes_send(uuid, uuid, uuid, uuid, uuid[], uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_game_undo(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_games_generate_save(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_games_record_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_schedule_emails_write(uuid, uuid, uuid, uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.league_schedule_family_count(uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.league_division_schedule_publish(uuid, uuid, uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.league_division_changes_send(uuid, uuid, uuid, uuid, uuid[], uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.league_game_undo(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.league_games_generate_save(uuid, uuid, uuid, jsonb) TO service_role;

-- ─── 7 · Backfill (9d2b·A) ───────────────────────────────────────────────────────────────────────────────────────────

UPDATE public.league_divisions d SET schedule_published_at = now()
 WHERE d.schedule_published_at IS NULL
   AND d.teams_published_at IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.league_games g WHERE g.division_id = d.id);

COMMIT;

-- Verify (dev, then prod):
--   SELECT to_regclass('public.league_game_changes'), to_regclass('public.league_schedule_emails');           -- both not null
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('league_game_changes', 'league_schedule_emails'); -- t, t
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.league_games'::regclass AND tgname LIKE 'league_games_record_change%'; -- 2
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'league_season_notices_kind_check';    -- has games_changed
--   SELECT count(*) FROM pg_proc WHERE proname IN ('league_division_schedule_publish', 'league_division_changes_send',
--     'league_game_undo', 'league_games_generate_save', 'league_schedule_emails_write', 'league_schedule_family_count',
--     'league_games_record_change', 'league_game_snapshot', 'league_game_public_state');                     -- 9
--   Backfill: SELECT count(*) FROM league_divisions WHERE schedule_published_at IS NOT NULL AND teams_published_at IS NULL; -- 0
