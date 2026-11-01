-- ---------------------------------------------------------------
-- Migration 415 — House League Stage 9d-3 Part 1: families are told their practice times, and what they were told is
-- kept (plan HOUSE_LEAGUE_STAGE9_PLAN.md §9, rulings 9d3·1, 9d3·3, 9d3·4, 9d3·6, 9d3·7; build prompt
-- docs/projects/active/HOUSE_LEAGUE_STAGE9D3_BUILD_PROMPT.md, Part 1).
--
-- WHY: handing out practices (mig 393's league_practices_hand_out) emails nobody, and nothing recorded whether a team's
-- families had ever been told. 9d-3 adds the step after a hand-out ("Tell the families?"): one email per household,
-- every upcoming date, held until the league admin presses Send. A second hand-out for a team already told reopens that
-- step as a CHANGE (9d3·6), which needs WHAT families were told, not only when — for the Now / Was lines, the coach's
-- "told different times" line and the re-hand-out confirm's "{c} teams' practices change. {u} team's don't."
--
-- WHAT CHANGES:
--   (1) league_team_practices_told — one row per team whose families were told: when, and the practices they were told
--       (the snapshot). ⚖ ITS OWN TABLE, SERVICE ROLE ONLY, NOT COLUMNS ON league_teams (the build prompt's shape): mig
--       020's "public can read teams of active seasons" lets anyone read league_teams, so a snapshot there would publish
--       every team's practice times and places, and families have no page that shows practices (9d2·2; owner 2026-10-29,
--       the end state is a signed-in app). Written ONLY by league_practice_emails_sent (a family's email went) and by the
--       club's practice-change send refreshing a told team (lib/club-schedule-league-mail.ts).
--   (2) league_practice_tells — what one send told each of its teams (first or change) and the snapshot it sent: the
--       told row (1) is advanced from it once any of the team's families is reached, so "a family is marked as told only
--       once its email goes" and a send that reached nobody leaves the team untold.
--   (3) league_practice_emails — one row per household a practice-times send was going to (the 9d-2b shape, migs
--       409/410): claimed before it is sent, so the send, a double press and "Send again" never email a family twice.
--       The households are the app's (readHouseholds, lib/club-schedule-league-mail.ts — the one reader Stage 3 of
--       SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md widens), passed in, never re-grouped here.
--   (4) league_season_notices.kind gains practices_sent (the history's Automatic "Practice times sent: {division}").
--   (5) Functions (service role only): league_practices_tell (the press — notice, tells and household rows in ONE
--       transaction, advisory-locked on the division; refuses finished, nothing, nobody, changed, already, sending),
--       league_practice_emails_add ("Send again": a household with a usable address now joins the send; a missed row
--       its fixed address covers is skipped), league_practice_emails_claim (the mig 410 claim),
--       league_practice_emails_sent (marks rows sent and advances their teams' told rows in the same statement).
--
-- ⚖ The snapshot is an array of {s, e, v, f, l}: start and end (ISO instants; e may be null for a hand-booked practice),
-- the venue and facility ids, and the typed place when there is no venue. Upcoming, not-cancelled practices only, as of
-- the press. The app compares only FUTURE dates of it (a past practice falls off the current list while it stays here).
--
-- No row change to any existing table. INVISIBLE to the drift check: the functions (declared in MANUAL_PROD_STEPS.json).
-- Re-runnable. Requires 385 (league_season_notices), 393 (the hand-out), 409 (the kind list it extends).
-- Proved by scripts/house-league-9d3-check.sql (DEV, rolled back).
-- ---------------------------------------------------------------

BEGIN;

-- ─── 1 · What a team's families were told ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_team_practices_told (
  team_id     uuid PRIMARY KEY REFERENCES public.league_teams(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  season_id   uuid NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  told_at     timestamptz NOT NULL,
  snapshot    jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'array'),
  -- The practices_sent notice that told them; null when the club's practice-change send refreshed it.
  notice_id   uuid REFERENCES public.league_season_notices(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS league_team_practices_told_season_idx ON public.league_team_practices_told (season_id);
CREATE INDEX IF NOT EXISTS league_team_practices_told_org_idx ON public.league_team_practices_told (org_id);
CREATE INDEX IF NOT EXISTS league_team_practices_told_notice_idx
  ON public.league_team_practices_told (notice_id) WHERE notice_id IS NOT NULL;

ALTER TABLE public.league_team_practices_told ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.league_team_practices_told FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_team_practices_told TO service_role;

COMMENT ON TABLE public.league_team_practices_told IS
  'House League 9d-3 (9d3·1, 9d3·6): a team whose families were told their practice times — when, and what (the snapshot). '
  'No row = never told. Service role only: league_teams is publicly readable on a live season, and families have no page '
  'that shows practices. Advanced by league_practice_emails_sent once any of the team''s families is reached (never moved '
  'back to an older send); refreshed by the club''s practice-change send for a told team whose families it emailed.';
COMMENT ON COLUMN public.league_team_practices_told.told_at IS
  'When the send that told them was pressed (its notice''s created_at), or when the club''s change send emailed them. '
  'The coach''s "Families were told these practice times on {date}".';
COMMENT ON COLUMN public.league_team_practices_told.snapshot IS
  'The practices the families were told, as of that send: [{s, e, v, f, l}] — start, end (ISO; e null when none was '
  'stored), venue id, facility id, typed place (when no venue). Upcoming and not cancelled at the press. Compare only its '
  'FUTURE entries with the team''s practices now (lib/league-practice-tell.ts).';

-- ─── 2 · What one send told each team ────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_practice_tells (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  season_id   uuid NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  division_id uuid REFERENCES public.league_divisions(id) ON DELETE SET NULL,
  team_id     uuid NOT NULL REFERENCES public.league_teams(id) ON DELETE CASCADE,
  notice_id   uuid NOT NULL REFERENCES public.league_season_notices(id) ON DELETE CASCADE,
  -- first: the team was never told (the first email); change: told before, its practices differ (the 11b change email).
  kind        text NOT NULL CHECK (kind IN ('first', 'change')),
  snapshot    jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'array'),
  -- For a change: what the families had been told before (the Was side), so a resend days later says the same change.
  told_before jsonb CHECK (told_before IS NULL OR jsonb_typeof(told_before) = 'array'),
  created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (notice_id, team_id),
  CHECK ((kind = 'change') = (told_before IS NOT NULL))
);
ALTER TABLE public.league_practice_tells ADD COLUMN IF NOT EXISTS told_before jsonb
  CHECK (told_before IS NULL OR jsonb_typeof(told_before) = 'array');

CREATE INDEX IF NOT EXISTS league_practice_tells_team_idx ON public.league_practice_tells (team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS league_practice_tells_org_idx ON public.league_practice_tells (org_id);
CREATE INDEX IF NOT EXISTS league_practice_tells_season_idx ON public.league_practice_tells (season_id);
CREATE INDEX IF NOT EXISTS league_practice_tells_division_idx ON public.league_practice_tells (division_id);

ALTER TABLE public.league_practice_tells ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.league_practice_tells FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_practice_tells TO service_role;

COMMENT ON TABLE public.league_practice_tells IS
  'House League 9d-3: one row per team a practices_sent notice told — first or change, and the snapshot it sent (the shape '
  'of league_team_practices_told.snapshot). Written by league_practices_tell; read when a household email is marked sent '
  '(the team''s told row advances to it) and by a resend (the email says what was sent, not what the practices became).';

-- ─── 3 · Each household a practice-times send was going to ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_practice_emails (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  season_id         uuid NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  division_id       uuid REFERENCES public.league_divisions(id) ON DELETE SET NULL,
  notice_id         uuid NOT NULL REFERENCES public.league_season_notices(id) ON DELETE CASCADE,
  guardian_email    text NOT NULL CHECK (guardian_email = lower(btrim(guardian_email)) AND guardian_email <> ''),
  -- The household's children this email is about, in name order, and the teams (one part per child).
  registration_ids  uuid[] NOT NULL CHECK (cardinality(registration_ids) > 0),
  team_ids          uuid[] NOT NULL CHECK (cardinality(team_ids) > 0),
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notice_id, guardian_email)
);

CREATE INDEX IF NOT EXISTS league_practice_emails_notice_idx ON public.league_practice_emails (notice_id, status);
CREATE INDEX IF NOT EXISTS league_practice_emails_org_idx ON public.league_practice_emails (org_id);
CREATE INDEX IF NOT EXISTS league_practice_emails_season_idx ON public.league_practice_emails (season_id);
CREATE INDEX IF NOT EXISTS league_practice_emails_division_idx ON public.league_practice_emails (division_id);
CREATE INDEX IF NOT EXISTS league_practice_emails_open_idx
  ON public.league_practice_emails USING gin (team_ids) WHERE status IN ('pending', 'sending', 'failed');

ALTER TABLE public.league_practice_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.league_practice_emails FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_practice_emails TO service_role;

COMMENT ON TABLE public.league_practice_emails IS
  'House League 9d-3: one row per household a practices_sent notice was going to — the households the app read '
  '(readHouseholds), with the children and teams it is about. pending (the press) → sending (claimed by '
  'league_practice_emails_claim) → sent (league_practice_emails_sent, which also marks the teams told), failed (offered '
  'as "Send again") or skipped (nothing left to say, an address no mail can reach, or a later send superseded it). A '
  'service notice (sendFamilyServiceBatch): it reaches a family who left club news.';

-- ─── 4 · The history's new Automatic row ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.league_season_notices DROP CONSTRAINT IF EXISTS league_season_notices_kind_check;
ALTER TABLE public.league_season_notices
  ADD CONSTRAINT league_season_notices_kind_check
  CHECK (kind IN ('teams_published', 'practices_changed', 'schedule_published', 'games_changed', 'practices_sent'));

COMMENT ON COLUMN public.league_season_notices.kind IS
  'teams_published = Publish teams (9c); practices_changed = the club''s Send the changes moved or cancelled this season''s '
  'practices and emailed the teams'' families (Club Tier 11b Part 5, ruling 9d2·2); schedule_published = Publish schedule '
  '(9d-2b, 9d2·1); games_changed = a division''s Changes to send, or one urgent cancel or postpone (9d-2b, f2 / f5); '
  'practices_sent = a league admin told a division''s families their practice times, first or changed (9d-3, 9d3·1, 9d3·6).';

-- ─── 5 · The writes ──────────────────────────────────────────────────────────────────────────────────────────────────

-- The press. p_teams: [{ teamId, saw (the told_at the window read, null = never told), kind, snapshot }].
-- p_households: [{ email, registrationIds, teamIds }] — readHouseholds' answer, already filtered to these teams.
CREATE OR REPLACE FUNCTION public.league_practices_tell(
  p_org uuid, p_season uuid, p_division uuid, p_actor uuid, p_teams jsonb, p_households jsonb
) RETURNS TABLE (refusal text, notice uuid, families integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status   text;
  v_team     jsonb;
  v_hh       jsonb;
  v_ids      uuid[] := ARRAY[]::uuid[];
  v_told     timestamptz;
  v_moved    integer := 0;
  v_notice   uuid;
  v_n        integer;
  v_now      timestamptz;
  v_regs     uuid[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('league_practices_tell:' || p_division::text, 0));
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF v_status IN ('completed', 'archived') THEN
    RETURN QUERY SELECT 'finished'::text, NULL::uuid, 0; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM league_divisions d WHERE d.id = p_division AND d.season_id = p_season) THEN
    RAISE EXCEPTION 'Division not found';
  END IF;
  IF jsonb_typeof(p_teams) IS DISTINCT FROM 'array' OR jsonb_array_length(p_teams) = 0 THEN
    RETURN QUERY SELECT 'nothing'::text, NULL::uuid, 0; RETURN;
  END IF;
  IF jsonb_typeof(p_households) IS DISTINCT FROM 'array' OR jsonb_array_length(p_households) = 0 THEN
    RETURN QUERY SELECT 'nobody'::text, NULL::uuid, 0; RETURN;
  END IF;

  -- Every team is this division's, and still told as the window read it. Every one told since = a second press.
  FOR v_team IN SELECT * FROM jsonb_array_elements(p_teams) LOOP
    IF NOT EXISTS (SELECT 1 FROM league_teams t WHERE t.id = (v_team->>'teamId')::uuid
                     AND t.season_id = p_season AND t.division_id = p_division) THEN
      RETURN QUERY SELECT 'changed'::text, NULL::uuid, 0; RETURN;
    END IF;
    IF (v_team->>'kind') NOT IN ('first', 'change') OR jsonb_typeof(v_team->'snapshot') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'A team to tell has no kind or snapshot';
    END IF;
    v_ids := v_ids || (v_team->>'teamId')::uuid;
    SELECT pt.told_at INTO v_told FROM league_team_practices_told pt WHERE pt.team_id = (v_team->>'teamId')::uuid;
    IF v_told IS DISTINCT FROM (v_team->>'saw')::timestamptz THEN
      IF v_told IS NULL OR v_told < (v_team->>'saw')::timestamptz THEN
        RETURN QUERY SELECT 'changed'::text, NULL::uuid, 0; RETURN;
      END IF;
      v_moved := v_moved + 1;
    END IF;
  END LOOP;
  IF v_moved = cardinality(v_ids) THEN
    RETURN QUERY SELECT 'already'::text, NULL::uuid, 0; RETURN;
  END IF;
  IF v_moved > 0 THEN
    RETURN QUERY SELECT 'changed'::text, NULL::uuid, 0; RETURN;
  END IF;

  -- A send of these teams still going (claimed or about to be, in the last ten minutes): the double press.
  IF EXISTS (SELECT 1 FROM league_practice_emails e
              WHERE e.org_id = p_org AND e.team_ids && v_ids AND e.status IN ('pending', 'sending')
                AND e.updated_at > now() - interval '10 minutes') THEN
    RETURN QUERY SELECT 'sending'::text, NULL::uuid, 0; RETURN;
  END IF;

  -- An earlier send of these teams that never finished is superseded: this one says what is true now. Only what THIS press
  -- covers is taken off the old row — a household with a child on a team that is not in this press keeps that child on its
  -- row (still offered as "Send again"), and a row left with nothing is skipped. (Review 2026-10-31: skipping the whole
  -- row dropped the family's other child, and the team read as told.) A dead `sending` row comes back as `failed`.
  SELECT coalesce(array_agg(DISTINCT x::uuid), ARRAY[]::uuid[]) INTO v_regs
    FROM jsonb_array_elements(p_households) h, jsonb_array_elements_text(h->'registrationIds') x;
  UPDATE league_practice_emails e
     SET registration_ids = CASE WHEN cardinality(k.regs) = 0 OR cardinality(k.teams) = 0 THEN e.registration_ids ELSE k.regs END,
         team_ids = CASE WHEN cardinality(k.regs) = 0 OR cardinality(k.teams) = 0 THEN e.team_ids ELSE k.teams END,
         updated_at = now(),
         status = CASE WHEN cardinality(k.regs) = 0 OR cardinality(k.teams) = 0 THEN 'skipped'
                       WHEN e.status = 'sending' THEN 'failed' ELSE e.status END
    FROM (SELECT o.id,
                 ARRAY(SELECT r FROM unnest(o.registration_ids) r WHERE r <> ALL (v_regs)) AS regs,
                 ARRAY(SELECT t FROM unnest(o.team_ids) t WHERE t <> ALL (v_ids)) AS teams
            FROM league_practice_emails o
           WHERE o.org_id = p_org AND o.team_ids && v_ids AND o.status IN ('pending', 'sending', 'failed')) k
   WHERE e.id = k.id;

  v_now := clock_timestamp();
  INSERT INTO league_season_notices(org_id, season_id, division_id, kind, family_count, created_by, created_at)
  VALUES (p_org, p_season, p_division, 'practices_sent', jsonb_array_length(p_households), p_actor, v_now)
  RETURNING id INTO v_notice;

  -- A change's Was side is what the families were told, read here under the lock (never the caller's word for it).
  INSERT INTO league_practice_tells(org_id, season_id, division_id, team_id, notice_id, kind, snapshot, told_before, created_at)
  SELECT p_org, p_season, p_division, (t->>'teamId')::uuid, v_notice, t->>'kind', t->'snapshot',
         CASE WHEN t->>'kind' = 'change'
              THEN coalesce((SELECT pt.snapshot FROM league_team_practices_told pt WHERE pt.team_id = (t->>'teamId')::uuid), '[]'::jsonb)
         END,
         v_now
    FROM jsonb_array_elements(p_teams) t;

  FOR v_hh IN SELECT * FROM jsonb_array_elements(p_households) LOOP
    -- A household is about these teams only, and about this season's children only.
    IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_hh->'teamIds') x WHERE NOT (x::uuid = ANY (v_ids)))
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_hh->'registrationIds') x
                   WHERE NOT EXISTS (SELECT 1 FROM league_registrations r WHERE r.id = x::uuid AND r.season_id = p_season)) THEN
      RAISE EXCEPTION 'A household is not about the teams being told';
    END IF;
    INSERT INTO league_practice_emails(org_id, season_id, division_id, notice_id, guardian_email, registration_ids, team_ids)
    VALUES (p_org, p_season, p_division, v_notice, lower(btrim(v_hh->>'email')),
            ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(v_hh->'registrationIds') x),
            ARRAY(SELECT DISTINCT x::uuid FROM jsonb_array_elements_text(v_hh->'teamIds') x));
  END LOOP;
  SELECT count(*)::integer INTO v_n FROM league_practice_emails e WHERE e.notice_id = v_notice;
  RETURN QUERY SELECT NULL::text, v_notice, v_n;
END $$;

-- "Send again" (the See them window): a household of the send's teams that has a usable address now — one added since,
-- or one fixed after its email was refused — joins the send as a pending row; a missed row whose children are all now
-- covered by another row (its address was fixed) is skipped, so it is never counted as missed twice. p_households as in
-- league_practices_tell. Returns how many rows were added.
CREATE OR REPLACE FUNCTION public.league_practice_emails_add(p_org uuid, p_notice uuid, p_households jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_season uuid; v_division uuid; v_status text; v_teams uuid[]; v_hh jsonb; v_added integer := 0; v_one integer;
BEGIN
  SELECT n.season_id, n.division_id INTO v_season, v_division
    FROM league_season_notices n WHERE n.id = p_notice AND n.org_id = p_org AND n.kind = 'practices_sent';
  IF NOT FOUND THEN RAISE EXCEPTION 'Notice not found'; END IF;
  IF v_division IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('league_practices_tell:' || v_division::text, 0));
  END IF;
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = v_season;
  IF v_status IN ('completed', 'archived') THEN RAISE EXCEPTION 'finished'; END IF;
  SELECT coalesce(array_agg(tl.team_id), ARRAY[]::uuid[]) INTO v_teams FROM league_practice_tells tl WHERE tl.notice_id = p_notice;

  FOR v_hh IN SELECT * FROM jsonb_array_elements(coalesce(p_households, '[]'::jsonb)) LOOP
    IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_hh->'teamIds') x WHERE NOT (x::uuid = ANY (v_teams)))
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_hh->'registrationIds') x
                   WHERE NOT EXISTS (SELECT 1 FROM league_registrations r WHERE r.id = x::uuid AND r.season_id = v_season)) THEN
      RAISE EXCEPTION 'A household is not about the teams of this send';
    END IF;
    INSERT INTO league_practice_emails(org_id, season_id, division_id, notice_id, guardian_email, registration_ids, team_ids)
    VALUES (p_org, v_season, v_division, p_notice, lower(btrim(v_hh->>'email')),
            ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(v_hh->'registrationIds') x),
            ARRAY(SELECT DISTINCT x::uuid FROM jsonb_array_elements_text(v_hh->'teamIds') x))
    -- An address already in this send (its row was skipped, failed or not yet going) takes the new children and teams too —
    -- DO NOTHING dropped them, so a child added under a skipped row's address, or a fixed address another family already
    -- had, was never emailed (review 2026-10-31). A row already sent or going is left alone.
    ON CONFLICT (notice_id, guardian_email) DO UPDATE
      SET registration_ids = ARRAY(SELECT DISTINCT r FROM unnest(league_practice_emails.registration_ids || excluded.registration_ids) r),
          team_ids = ARRAY(SELECT DISTINCT t FROM unnest(league_practice_emails.team_ids || excluded.team_ids) t),
          status = 'pending', updated_at = now()
      WHERE league_practice_emails.status IN ('skipped', 'failed')
        AND NOT league_practice_emails.registration_ids @> excluded.registration_ids;
    GET DIAGNOSTICS v_one = ROW_COUNT;
    v_added := v_added + v_one;
  END LOOP;

  UPDATE league_practice_emails e SET status = 'skipped', updated_at = now()
   WHERE e.notice_id = p_notice AND e.status = 'failed'
     AND e.registration_ids <@ (SELECT coalesce(array_agg(DISTINCT r), ARRAY[]::uuid[])
                                  FROM league_practice_emails o, unnest(o.registration_ids) r
                                 WHERE o.notice_id = p_notice AND o.id <> e.id AND o.guardian_email <> e.guardian_email
                                   AND o.status IN ('pending', 'sending', 'sent'));
  UPDATE league_season_notices n SET family_count = (SELECT count(*) FROM league_practice_emails e
                                                      WHERE e.notice_id = p_notice AND e.status <> 'skipped')
   WHERE n.id = p_notice;
  RETURN v_added;
END $$;

-- The claim (the mig 410 pattern): a row left `sending` for ten minutes, by a send that died, can be claimed again.
CREATE OR REPLACE FUNCTION public.league_practice_emails_claim(p_org uuid, p_ids uuid[])
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE league_practice_emails e
     SET status = 'sending', updated_at = now()
   WHERE e.org_id = p_org AND e.id = ANY (p_ids)
     AND (e.status IN ('pending', 'failed') OR (e.status = 'sending' AND e.updated_at < now() - interval '10 minutes'))
  RETURNING e.id
$$;

-- A household's email went: the row is sent, and each of its teams is told what that send told it — never moved back to
-- an older send's snapshot (a resend of an old notice after a newer one reached the team).
CREATE OR REPLACE FUNCTION public.league_practice_emails_sent(p_org uuid, p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  WITH sent AS (
    UPDATE league_practice_emails e SET status = 'sent', updated_at = now()
     WHERE e.org_id = p_org AND e.id = ANY (p_ids) AND e.status = 'sending'
    RETURNING e.notice_id, e.team_ids
  ), told AS (
    SELECT DISTINCT ON (tl.team_id) tl.team_id, tl.org_id, tl.season_id, tl.snapshot, tl.notice_id, n.created_at
      FROM (SELECT DISTINCT s.notice_id, unnest(s.team_ids) AS team_id FROM sent s) x
      JOIN league_practice_tells tl ON tl.notice_id = x.notice_id AND tl.team_id = x.team_id
      JOIN league_season_notices n ON n.id = x.notice_id
     ORDER BY tl.team_id, n.created_at DESC
  )
  INSERT INTO league_team_practices_told AS pt (team_id, org_id, season_id, told_at, snapshot, notice_id, updated_at)
  SELECT team_id, org_id, season_id, created_at, snapshot, notice_id, now() FROM told
  ON CONFLICT (team_id) DO UPDATE
    SET told_at = excluded.told_at, snapshot = excluded.snapshot, notice_id = excluded.notice_id, updated_at = now()
    WHERE pt.told_at < excluded.told_at;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION public.league_practices_tell(uuid, uuid, uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_practice_emails_claim(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_practice_emails_sent(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_practice_emails_add(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_practices_tell(uuid, uuid, uuid, uuid, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.league_practice_emails_claim(uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.league_practice_emails_sent(uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.league_practice_emails_add(uuid, uuid, jsonb) TO service_role;

COMMIT;

-- Verify (dev, then prod):
--   SELECT count(*) FROM pg_proc WHERE proname IN ('league_practices_tell', 'league_practice_emails_add',
--     'league_practice_emails_claim', 'league_practice_emails_sent');                                          -- 4
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'league_season_notices_kind_check';    -- has practices_sent
--   SELECT relrowsecurity FROM pg_class WHERE relname IN ('league_team_practices_told', 'league_practice_tells',
--     'league_practice_emails');                                                                              -- t, t, t
