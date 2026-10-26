-- Club Tier Stage 9c Part 1 · Teams and people (HOUSE_LEAGUE_STAGE9_PLAN.md §0f, HOUSE_LEAGUE_STAGE9C_BUILD_PROMPT.md).
--
-- What this makes true, on the database:
--   · A rating (9c·2) lives in its OWN table, never on the registration row: several house-league routes read whole
--     registration rows, and the registrar reaches some of them (9c·2a). It is erased when the season finishes (9c·2b),
--     by the trigger that stamps the season's finished-at, so no writer can forget it.
--   · A house-league coach is a ROW, not a club role (9c·1, Q17): league_team_coaches is the access truth for the coach's
--     team page and their sign-in card. Accepting an invite creates no membership (a capability-less `coach` member would
--     get a Coaches Portal card on a club with a subscription, the one place 9c must never route them).
--   · A division is published or not (9c·6): league_divisions.teams_published_at. Seasons already being played count as
--     published, with no email (the plan's build note): the backfill below.
--   · A player on a team is an ACCEPTED player of THAT team's division, structurally (T08 + a 9c finding): leaving
--     accepted, or leaving the division, takes the player off their team and keeps the previous team; a team from another
--     division, or a player who isn't accepted, is refused. One trigger, so the ending, the waitlist move, the division
--     move and every assignment path obey it without knowing.
--   · The draft and publish write through functions that lock the division and refuse a stale window (copy §4.3, §7.3).
--   · Each family's placement email is a row (argument 4): Publish writes the facts and the rows in one transaction;
--     the send afterwards marks each row, so a failure survives a reload and "Send the {n} again" re-sends only those.
--
-- league_seasons.draft_state is LEFT IN PLACE, unused from 9c (never drop a column).
-- Requires 368-372 (the 9b-2 functions this file's trigger sits beside).

-- ─── 1 · Columns ──────────────────────────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.league_seasons
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

ALTER TABLE public.league_divisions
  ADD COLUMN IF NOT EXISTS teams_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS teams_published_by uuid;

ALTER TABLE public.league_registrations
  ADD COLUMN IF NOT EXISTS team_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS draft_team_id uuid REFERENCES public.league_teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS previous_team_id uuid REFERENCES public.league_teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_changed_at timestamptz;

-- ─── 2 · Ratings (9c·2, runners only; a number 1-5 and nothing else) ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_player_ratings (
  registration_id uuid PRIMARY KEY REFERENCES public.league_registrations(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  season_id       uuid NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  rating          smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  rated_by        uuid,
  rated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS league_player_ratings_season_idx ON public.league_player_ratings(season_id);
ALTER TABLE public.league_player_ratings ENABLE ROW LEVEL SECURITY;

-- The org and season come from the registration, never the caller; a finished season takes no rating.
CREATE OR REPLACE FUNCTION public.league_player_ratings_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_season uuid; v_status text;
BEGIN
  SELECT r.org_id, r.season_id, s.status INTO v_org, v_season, v_status
    FROM league_registrations r JOIN league_seasons s ON s.id = r.season_id WHERE r.id = NEW.registration_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;
  IF v_status IN ('completed','archived') THEN RAISE EXCEPTION 'A finished season keeps no ratings'; END IF;
  NEW.org_id := v_org; NEW.season_id := v_season; NEW.rated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS league_player_ratings_guard ON public.league_player_ratings;
CREATE TRIGGER league_player_ratings_guard BEFORE INSERT OR UPDATE ON public.league_player_ratings
  FOR EACH ROW EXECUTE FUNCTION public.league_player_ratings_guard();

-- ─── 3 · A season's finish: stamped, and its ratings erased in the same statement (9c·2b) ─────────────────────────────

CREATE OR REPLACE FUNCTION public.league_seasons_finished() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('completed','archived') THEN
    IF OLD.status NOT IN ('completed','archived') THEN
      NEW.finished_at := now();
      DELETE FROM league_player_ratings WHERE season_id = NEW.id;
    END IF;
  ELSE
    -- Reopened: it is live again. Its ratings do not come back (they were erased, as ruled).
    NEW.finished_at := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS league_seasons_finished ON public.league_seasons;
CREATE TRIGGER league_seasons_finished BEFORE UPDATE OF status ON public.league_seasons
  FOR EACH ROW EXECUTE FUNCTION public.league_seasons_finished();

-- ─── 4 · A team's coaches (9c·1, 9c·10) ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_team_coaches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  season_id   uuid NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  team_id     uuid NOT NULL REFERENCES public.league_teams(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  email       text NOT NULL CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254),
  -- The person, once they accept with the invited address. Access reads this, never the email.
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  token_hash  text,
  invited_at  timestamptz,
  expires_at  timestamptz,
  accepted_at timestamptz,
  removed_at  timestamptz,
  invited_by  uuid,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS league_team_coaches_one_per_team
  ON public.league_team_coaches(team_id, email) WHERE removed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS league_team_coaches_token
  ON public.league_team_coaches(token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS league_team_coaches_user_idx ON public.league_team_coaches(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS league_team_coaches_season_idx ON public.league_team_coaches(season_id);
ALTER TABLE public.league_team_coaches ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.league_team_coaches_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_season uuid;
BEGIN
  SELECT s.org_id, t.season_id INTO v_org, v_season
    FROM league_teams t JOIN league_seasons s ON s.id = t.season_id WHERE t.id = NEW.team_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.team_id IS DISTINCT FROM OLD.team_id THEN RAISE EXCEPTION 'A coach row keeps its team'; END IF;
  NEW.org_id := v_org; NEW.season_id := v_season; NEW.email := lower(btrim(NEW.email)); NEW.name := btrim(NEW.name);
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS league_team_coaches_guard ON public.league_team_coaches;
CREATE TRIGGER league_team_coaches_guard BEFORE INSERT OR UPDATE ON public.league_team_coaches
  FOR EACH ROW EXECUTE FUNCTION public.league_team_coaches_guard();

-- The free-text coach name each team carried before 9c (every fixture team's is "Pat Volunteer") has no email, so it
-- cannot become a coach row; it stays on league_teams.coach_name, which 9c's screens stop writing.

-- ─── 5 · Each family's placement email (argument 4) ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_placement_emails (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  season_id        uuid NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  division_id      uuid NOT NULL REFERENCES public.league_divisions(id) ON DELETE CASCADE,
  -- placed: at Publish, or a player placed after it (one row per family, every child of theirs placed in that act).
  -- moved: a player moved to another team after Publish.
  kind             text NOT NULL CHECK (kind IN ('placed','moved')),
  guardian_email   text NOT NULL CHECK (guardian_email = lower(btrim(guardian_email))),
  registration_ids uuid[] NOT NULL CHECK (cardinality(registration_ids) > 0),
  -- pending until the send; sent; failed (the provider refused or could not be reached); skipped (no provider is set up,
  -- dev only). There is no "bounced": the product cannot learn of a bounce (owner, 9c build, 2026-10-25).
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  attempts         smallint NOT NULL DEFAULT 0,
  -- The move's teams, as they were (the email names both; a later move must not rewrite an earlier email's facts).
  from_team_id     uuid REFERENCES public.league_teams(id) ON DELETE SET NULL,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS league_placement_emails_division_idx ON public.league_placement_emails(division_id, status);
CREATE INDEX IF NOT EXISTS league_placement_emails_season_idx ON public.league_placement_emails(season_id);
ALTER TABLE public.league_placement_emails ENABLE ROW LEVEL SECURITY;

-- ─── 6 · Backfill, BEFORE the team trigger exists ────────────────────────────────────────────────────────────────────

-- A season finished before 9c: its finish is when it was last changed.
UPDATE public.league_seasons SET finished_at = updated_at
 WHERE status IN ('completed','archived') AND finished_at IS NULL;

-- T08: a child who is no longer accepted (declined, withdrawn, back on the waitlist, back to review) leaves their team,
-- and so does a child whose team belongs to another division. The previous team is kept; "left on" is when they ended.
UPDATE public.league_registrations r
   SET previous_team_id = r.team_id,
       team_changed_at  = coalesce(r.ended_at, r.updated_at, now()),
       team_id = NULL
 WHERE r.team_id IS NOT NULL
   AND (r.status <> 'active'
        OR NOT EXISTS (SELECT 1 FROM public.league_teams t
                        WHERE t.id = r.team_id AND t.season_id = r.season_id
                          AND t.division_id IS NOT DISTINCT FROM r.division_id));

-- Argument 5: a division that already has accepted players on teams is being played. It counts as published, and
-- nobody is emailed (no placement rows are written for it).
UPDATE public.league_divisions d SET teams_published_at = now()
 WHERE d.teams_published_at IS NULL
   AND EXISTS (SELECT 1 FROM public.league_registrations r
                WHERE r.division_id = d.id AND r.status = 'active' AND r.team_id IS NOT NULL);

-- ─── 7 · A team follows the registration (T08, and the division guard) ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.league_registrations_team_follows() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'active' THEN NEW.team_id := NULL; END IF;
  ELSIF NEW.team_id IS NOT NULL AND NEW.team_id IS NOT DISTINCT FROM OLD.team_id
        AND (NEW.status <> 'active' OR NEW.division_id IS DISTINCT FROM OLD.division_id) THEN
    -- Left accepted, or left the division: off the team, keeping where they were.
    NEW.previous_team_id := OLD.team_id;
    NEW.team_changed_at := now();
    NEW.team_id := NULL;
  END IF;

  IF NEW.team_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.team_id IS DISTINCT FROM OLD.team_id) THEN
    IF NEW.status <> 'active' THEN RAISE EXCEPTION 'Only an accepted player is placed on a team'; END IF;
    PERFORM 1 FROM league_teams t
      WHERE t.id = NEW.team_id AND t.season_id = NEW.season_id AND t.division_id IS NOT DISTINCT FROM NEW.division_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'That team is not in this player''s division'; END IF;
  END IF;

  IF NEW.team_id IS NULL THEN NEW.team_locked_at := NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS league_registrations_team_follows ON public.league_registrations;
CREATE TRIGGER league_registrations_team_follows BEFORE INSERT OR UPDATE ON public.league_registrations
  FOR EACH ROW EXECUTE FUNCTION public.league_registrations_team_follows();

-- ─── 8 · The division's fingerprint: what a window saw, so a stale one is refused (copy §4.3, §7.3) ────────────────────

CREATE OR REPLACE FUNCTION public.league_division_fingerprint(p_division uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT md5(
    coalesce((SELECT string_agg(t.id::text, ',' ORDER BY t.id) FROM league_teams t WHERE t.division_id = p_division), '')
    || '|' ||
    coalesce((SELECT string_agg(r.id::text || ':' || coalesce(r.team_id::text, '') || ':'
                                || CASE WHEN r.team_locked_at IS NULL THEN '0' ELSE '1' END, ',' ORDER BY r.id)
                FROM league_registrations r WHERE r.division_id = p_division AND r.status = 'active'), '')
  )
$$;

-- ─── 9 · The draft lands whole, or not at all ─────────────────────────────────────────────────────────────────────────
-- The deal itself is lib/house-league-draft.ts (a tested pure function). This writes its answer: every accepted,
-- unlocked player of the division gets the team it chose, and remembers it (draft_team_id: "Moved by you" reads it).

CREATE OR REPLACE FUNCTION public.league_division_draft_apply(
  p_org uuid, p_season uuid, p_division uuid, p_fingerprint text, p_regs uuid[], p_teams uuid[]
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_div league_divisions%ROWTYPE; v_status text; v_open integer; v_done integer;
BEGIN
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF v_status IN ('completed','archived') THEN RETURN 'finished'; END IF;
  SELECT * INTO v_div FROM league_divisions d WHERE d.id = p_division AND d.season_id = p_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Division not found'; END IF;
  IF v_div.teams_published_at IS NOT NULL THEN RETURN 'published'; END IF;
  IF league_division_fingerprint(p_division) IS DISTINCT FROM p_fingerprint THEN RETURN 'changed'; END IF;
  IF cardinality(p_regs) IS DISTINCT FROM cardinality(p_teams) THEN RAISE EXCEPTION 'A deal pairs each player with a team'; END IF;

  SELECT count(*) INTO v_open FROM league_registrations r
   WHERE r.division_id = p_division AND r.status = 'active' AND r.team_locked_at IS NULL;
  IF v_open IS DISTINCT FROM coalesce(cardinality(p_regs), 0) THEN RETURN 'changed'; END IF;

  UPDATE league_registrations r SET team_id = a.team, draft_team_id = a.team, updated_at = now()
    FROM unnest(p_regs, p_teams) AS a(reg, team)
   WHERE r.id = a.reg AND r.division_id = p_division AND r.status = 'active' AND r.team_locked_at IS NULL;
  GET DIAGNOSTICS v_done = ROW_COUNT;
  IF v_done IS DISTINCT FROM v_open THEN RAISE EXCEPTION 'The deal did not cover every player'; END IF;

  -- A locked player was "dealt" where they stand.
  UPDATE league_registrations r SET draft_team_id = r.team_id
   WHERE r.division_id = p_division AND r.status = 'active' AND r.team_locked_at IS NOT NULL;
  RETURN NULL;
END $$;

-- "Take all players off teams" (copy §1.5): before publishing only; locks and moves by hand go too.
CREATE OR REPLACE FUNCTION public.league_division_clear(
  p_org uuid, p_season uuid, p_division uuid, p_fingerprint text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_div league_divisions%ROWTYPE; v_status text;
BEGIN
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF v_status IN ('completed','archived') THEN RETURN 'finished'; END IF;
  SELECT * INTO v_div FROM league_divisions d WHERE d.id = p_division AND d.season_id = p_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Division not found'; END IF;
  IF v_div.teams_published_at IS NOT NULL THEN RETURN 'published'; END IF;
  IF league_division_fingerprint(p_division) IS DISTINCT FROM p_fingerprint THEN RETURN 'changed'; END IF;
  UPDATE league_registrations r SET team_id = NULL, draft_team_id = NULL, team_locked_at = NULL, updated_at = now()
   WHERE r.division_id = p_division AND r.status = 'active'
     AND (r.team_id IS NOT NULL OR r.draft_team_id IS NOT NULL OR r.team_locked_at IS NOT NULL);
  RETURN NULL;
END $$;

-- ─── 10 · One player onto a team (or off it) ─────────────────────────────────────────────────────────────────────────
-- Before publishing: immediate and silent, and it drops the player's lock (a lock is to a team).
-- After publishing (9c·12): refused unless the caller confirmed (p_confirmed, the held window), then it keeps where the
-- player was and writes the family's email row, which the caller sends. Off a team after publishing emails nobody
-- (copy §6.2 move.confirm.offTeam).

CREATE OR REPLACE FUNCTION public.league_team_place(
  p_org uuid, p_season uuid, p_registration uuid, p_team uuid, p_confirmed boolean, p_actor uuid
) RETURNS TABLE (refusal text, email uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reg league_registrations%ROWTYPE; v_status text; v_published timestamptz; v_email uuid;
BEGIN
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF v_status IN ('completed','archived') THEN RETURN QUERY SELECT 'finished'::text, NULL::uuid; RETURN; END IF;
  SELECT * INTO v_reg FROM league_registrations r
   WHERE r.id = p_registration AND r.org_id = p_org AND r.season_id = p_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;
  IF v_reg.status <> 'active' THEN RETURN QUERY SELECT 'not_accepted'::text, NULL::uuid; RETURN; END IF;
  IF v_reg.division_id IS NULL THEN RETURN QUERY SELECT 'no_division'::text, NULL::uuid; RETURN; END IF;
  IF p_team IS NOT NULL THEN
    PERFORM 1 FROM league_teams t WHERE t.id = p_team AND t.division_id = v_reg.division_id;
    IF NOT FOUND THEN RETURN QUERY SELECT 'team'::text, NULL::uuid; RETURN; END IF;
  END IF;
  SELECT d.teams_published_at INTO v_published FROM league_divisions d WHERE d.id = v_reg.division_id FOR UPDATE;
  IF v_reg.team_id IS NOT DISTINCT FROM p_team THEN RETURN QUERY SELECT NULL::text, NULL::uuid; RETURN; END IF;

  IF v_published IS NULL THEN
    UPDATE league_registrations r SET team_id = p_team, team_locked_at = NULL, updated_at = now() WHERE r.id = p_registration;
    RETURN QUERY SELECT NULL::text, NULL::uuid; RETURN;
  END IF;

  IF NOT coalesce(p_confirmed, false) THEN RETURN QUERY SELECT 'published'::text, NULL::uuid; RETURN; END IF;
  UPDATE league_registrations r
     SET previous_team_id = v_reg.team_id, team_changed_at = now(), team_id = p_team, updated_at = now()
   WHERE r.id = p_registration;
  IF p_team IS NOT NULL AND btrim(coalesce(v_reg.guardian_email, '')) <> '' THEN
    INSERT INTO league_placement_emails(org_id, season_id, division_id, kind, guardian_email, registration_ids,
                                        from_team_id, created_by)
    VALUES (p_org, p_season, v_reg.division_id, CASE WHEN v_reg.team_id IS NULL THEN 'placed' ELSE 'moved' END,
            lower(btrim(v_reg.guardian_email)), ARRAY[p_registration], v_reg.team_id, p_actor)
    RETURNING id INTO v_email;
  END IF;
  RETURN QUERY SELECT NULL::text, v_email;
END $$;

-- ─── 11 · Publish a division: the facts first, the email second (argument 4) ─────────────────────────────────────────
-- One transaction: the division's published-at, the end of its locks and moves-by-hand, one email row per family with
-- every child of theirs placed in it, and the invites for the division's coaches who have none (p_coaches paired with the
-- token hashes the caller made; the caller holds the raw tokens and sends after this commits).

CREATE OR REPLACE FUNCTION public.league_division_publish(
  p_org uuid, p_season uuid, p_division uuid, p_actor uuid, p_fingerprint text, p_coaches uuid[], p_hashes text[]
) RETURNS TABLE (refusal text, published_at timestamptz, published_by uuid, families integer, invited uuid[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_div league_divisions%ROWTYPE; v_status text; v_families integer; v_invited uuid[]; v_now timestamptz := now();
BEGIN
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF v_status IN ('completed','archived') THEN
    RETURN QUERY SELECT 'finished'::text, NULL::timestamptz, NULL::uuid, 0, ARRAY[]::uuid[]; RETURN;
  END IF;
  SELECT * INTO v_div FROM league_divisions d WHERE d.id = p_division AND d.season_id = p_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Division not found'; END IF;
  IF v_div.teams_published_at IS NOT NULL THEN
    RETURN QUERY SELECT 'already'::text, v_div.teams_published_at, v_div.teams_published_by, 0, ARRAY[]::uuid[]; RETURN;
  END IF;
  IF league_division_fingerprint(p_division) IS DISTINCT FROM p_fingerprint THEN
    RETURN QUERY SELECT 'changed'::text, NULL::timestamptz, NULL::uuid, 0, ARRAY[]::uuid[]; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM league_registrations r
                  WHERE r.division_id = p_division AND r.status = 'active' AND r.team_id IS NOT NULL) THEN
    RETURN QUERY SELECT 'not_ready'::text, NULL::timestamptz, NULL::uuid, 0, ARRAY[]::uuid[]; RETURN;
  END IF;
  IF cardinality(coalesce(p_coaches, ARRAY[]::uuid[])) IS DISTINCT FROM cardinality(coalesce(p_hashes, ARRAY[]::text[])) THEN
    RAISE EXCEPTION 'Each invited coach needs a token';
  END IF;

  UPDATE league_divisions d SET teams_published_at = v_now, teams_published_by = p_actor WHERE d.id = p_division;
  -- Locks and moves-by-hand end here (copy §5); a previous team from before today is not a move a family hears of.
  UPDATE league_registrations r
     SET team_locked_at = NULL, draft_team_id = NULL, previous_team_id = NULL, team_changed_at = NULL
   WHERE r.division_id = p_division AND r.status = 'active'
     AND (r.team_locked_at IS NOT NULL OR r.draft_team_id IS NOT NULL OR r.previous_team_id IS NOT NULL);

  INSERT INTO league_placement_emails(org_id, season_id, division_id, kind, guardian_email, registration_ids, created_by)
  SELECT p_org, p_season, p_division, 'placed', lower(btrim(r.guardian_email)),
         array_agg(r.id ORDER BY r.player_first_name, r.player_last_name, r.id), p_actor
    FROM league_registrations r
   WHERE r.division_id = p_division AND r.status = 'active' AND r.team_id IS NOT NULL
     AND btrim(coalesce(r.guardian_email, '')) <> ''
   GROUP BY lower(btrim(r.guardian_email));
  GET DIAGNOSTICS v_families = ROW_COUNT;

  WITH done AS (
    UPDATE league_team_coaches c
       SET token_hash = a.hash, invited_at = v_now, expires_at = v_now + interval '7 days', invited_by = p_actor
      FROM unnest(p_coaches, p_hashes) AS a(id, hash)
     WHERE c.id = a.id AND c.removed_at IS NULL AND c.invited_at IS NULL
       AND c.team_id IN (SELECT t.id FROM league_teams t WHERE t.division_id = p_division)
    RETURNING c.id
  ) SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_invited FROM done;

  RETURN QUERY SELECT NULL::text, v_now, p_actor, v_families, v_invited;
END $$;

-- ─── 12 · Grants: the service role only ──────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.league_player_ratings_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_seasons_finished() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_team_coaches_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_registrations_team_follows() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_division_fingerprint(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_division_fingerprint(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.league_division_draft_apply(uuid,uuid,uuid,text,uuid[],uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_division_draft_apply(uuid,uuid,uuid,text,uuid[],uuid[]) TO service_role;
REVOKE ALL ON FUNCTION public.league_division_clear(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_division_clear(uuid,uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.league_team_place(uuid,uuid,uuid,uuid,boolean,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_team_place(uuid,uuid,uuid,uuid,boolean,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.league_division_publish(uuid,uuid,uuid,uuid,text,uuid[],text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_division_publish(uuid,uuid,uuid,uuid,text,uuid[],text[]) TO service_role;
