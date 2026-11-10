-- House League · team-change emails after publishing (HOUSE_LEAGUE_TEAM_CHANGE_EMAILS_PLAN.md, TC·1 to TC·8, owner 2026-11-10).
--
-- After a division is published, a move saves at once and emails nobody. The families not yet told are DERIVED from the
-- children (each child remembers the team their family was last told), not queued as email rows, so the "Send the {n}
-- again" banner and the sweep never see a silent move. The convenor's Send creates one `changes` email per family in one
-- transaction with the history notice and the told stamps.
--
--   1. league_registrations.told_team_id / told_at: the team the family was last told (or chose not to be told about).
--      Backfilled for every accepted child already on a team in a published division. Cleared when the child leaves
--      accepted or changes division (they are "new" again if they come back).
--   2. league_placement_emails: kind widens to placed | moved | changes; `changes` snapshots each child's from-team.
--   3. league_season_notices: kind widens to add team_changes; skipped_count.
--   4. league_team_place: no published refusal, no email row (p_confirmed stays as an ignored argument).
--   5. league_division_publish: also stamps every accepted child on a team as told.
--   6. league_division_untold_fingerprint + league_division_tell_changes (the Send / Don't email transaction).
-- Requires 377, 378, 379, 385, 415. Additive, except the two function bodies and two CHECKs it replaces.

-- ─── 1 · What each family was last told ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.league_registrations ADD COLUMN IF NOT EXISTS told_team_id uuid;
ALTER TABLE public.league_registrations ADD COLUMN IF NOT EXISTS told_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'league_registrations_told_team_fk') THEN
    ALTER TABLE public.league_registrations
      ADD CONSTRAINT league_registrations_told_team_fk
      FOREIGN KEY (told_team_id) REFERENCES public.league_teams(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS league_registrations_told_team_idx
  ON public.league_registrations (told_team_id) WHERE told_team_id IS NOT NULL;

COMMENT ON COLUMN public.league_registrations.told_team_id IS
  'House League team-change emails (mig 459): the team this child''s family was last told, or chose not to be emailed about. '
  'Written only by Publish and league_division_tell_changes. Null = never told (a new placement); a team that differs from '
  'team_id = a move the family has not been told. Cleared when the child leaves accepted or changes division.';
COMMENT ON COLUMN public.league_registrations.told_at IS
  'When told_team_id was last written (Publish, Send, or Don''t email). A family whose children all stand on their told team '
  'but moved since told_at is "quiet": moved and moved back, nothing to send.';

-- Everyone already on a team in a published division is taken as told (the Publish email or an immediate move email).
UPDATE public.league_registrations r
   SET told_team_id = r.team_id, told_at = now()
 WHERE r.status = 'active' AND r.team_id IS NOT NULL AND r.told_team_id IS NULL
   AND EXISTS (SELECT 1 FROM public.league_divisions d WHERE d.id = r.division_id AND d.teams_published_at IS NOT NULL);

-- ─── 2 · A consolidated email row ────────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.league_placement_emails DROP CONSTRAINT IF EXISTS league_placement_emails_kind_check;
ALTER TABLE public.league_placement_emails
  ADD CONSTRAINT league_placement_emails_kind_check CHECK (kind IN ('placed', 'moved', 'changes'));

ALTER TABLE public.league_placement_emails ADD COLUMN IF NOT EXISTS changes jsonb;
ALTER TABLE public.league_placement_emails DROP CONSTRAINT IF EXISTS league_placement_emails_changes_check;
ALTER TABLE public.league_placement_emails
  ADD CONSTRAINT league_placement_emails_changes_check CHECK ((kind = 'changes') = (changes IS NOT NULL));

COMMENT ON COLUMN public.league_placement_emails.changes IS
  'House League team-change emails (mig 459): on a `changes` row, [{registration_id, from_team_id}] for each child it names, '
  'taken when the row was made (told_team_id moves on send, and a resend must still say "moved from {team}"). Null on '
  'placed / moved rows.';

-- ─── 3 · The history notice ──────────────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.league_season_notices DROP CONSTRAINT IF EXISTS league_season_notices_kind_check;
ALTER TABLE public.league_season_notices
  ADD CONSTRAINT league_season_notices_kind_check
  CHECK (kind IN ('teams_published', 'practices_changed', 'schedule_published', 'games_changed', 'practices_sent', 'team_changes'));

ALTER TABLE public.league_season_notices ADD COLUMN IF NOT EXISTS skipped_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.league_season_notices DROP CONSTRAINT IF EXISTS league_season_notices_skipped_count_check;
ALTER TABLE public.league_season_notices
  ADD CONSTRAINT league_season_notices_skipped_count_check CHECK (skipped_count >= 0 AND skipped_count <= family_count);

COMMENT ON COLUMN public.league_season_notices.skipped_count IS
  'House League team-change emails (mig 459): of family_count, the families the convenor chose NOT to email (Don''t email). '
  'Zero for every other kind.';

-- ─── 4 · A child leaves accepted, or the division: the family has not been told anything about where they are now ─────

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

  -- Mig 459: a child who leaves accepted or changes division is no longer "told" anything (new again if they return).
  IF TG_OP = 'UPDATE' AND (NEW.status <> 'active' OR NEW.division_id IS DISTINCT FROM OLD.division_id) THEN
    NEW.told_team_id := NULL;
    NEW.told_at := NULL;
  END IF;

  IF NEW.team_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.team_id IS DISTINCT FROM OLD.team_id) THEN
    IF NEW.status <> 'active' THEN RAISE EXCEPTION 'Only an accepted player is placed on a team'; END IF;
    PERFORM 1 FROM league_teams t
      WHERE t.id = NEW.team_id AND t.season_id = NEW.season_id AND t.division_id IS NOT DISTINCT FROM NEW.division_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'That team is not in this player''s division'; END IF;
  END IF;

  IF NEW.team_id IS NULL THEN NEW.team_locked_at := NULL; END IF;

  -- An ended registration takes its rating with it (/review 2026-10-25).
  IF TG_OP = 'UPDATE' AND NEW.status IN ('declined','withdrawn') AND OLD.status NOT IN ('declined','withdrawn') THEN
    DELETE FROM league_player_ratings WHERE registration_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.league_registrations_team_follows() FROM PUBLIC, anon, authenticated;

-- ─── 5 · A move saves at once and emails nobody (TC·1; supersedes 9c·12) ─────────────────────────────────────────────
-- p_confirmed stays so no caller breaks; it is ignored. After publishing, the move keeps where the player was and writes no
-- email row: the family is told when the convenor presses Send (league_division_tell_changes).

CREATE OR REPLACE FUNCTION public.league_team_place(
  p_org uuid, p_season uuid, p_registration uuid, p_team uuid, p_confirmed boolean, p_actor uuid
) RETURNS TABLE (refusal text, email uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reg league_registrations%ROWTYPE; v_status text; v_published timestamptz;
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
  ELSE
    UPDATE league_registrations r
       SET previous_team_id = v_reg.team_id, team_changed_at = now(), team_id = p_team, updated_at = now()
     WHERE r.id = p_registration;
  END IF;
  RETURN QUERY SELECT NULL::text, NULL::uuid;
END $$;

-- ─── 6 · Publish also records what every child's family was told ─────────────────────────────────────────────────────
-- 385's body, plus one stamp. EVERY accepted child on a team is stamped (a child with no email address cannot be told and
-- would otherwise wear "Not told" from the first minute).

CREATE OR REPLACE FUNCTION public.league_division_publish(
  p_org uuid, p_season uuid, p_division uuid, p_actor uuid, p_fingerprint text, p_coaches uuid[], p_hashes text[]
) RETURNS TABLE (refusal text, published_at timestamptz, published_by uuid, families integer, invited uuid[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_div league_divisions%ROWTYPE; v_status text; v_families integer; v_invited uuid[]; v_now timestamptz := now();
        v_notice uuid; v_rows uuid[];
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

  WITH ins AS (
    INSERT INTO league_placement_emails(org_id, season_id, division_id, kind, guardian_email, registration_ids, created_by)
    SELECT p_org, p_season, p_division, 'placed', lower(btrim(r.guardian_email)),
           array_agg(r.id ORDER BY r.player_first_name, r.player_last_name, r.id), p_actor
      FROM league_registrations r
     WHERE r.division_id = p_division AND r.status = 'active' AND r.team_id IS NOT NULL
       AND btrim(coalesce(r.guardian_email, '')) <> ''
     GROUP BY lower(btrim(r.guardian_email))
    RETURNING id
  ) SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_rows FROM ins;
  v_families := cardinality(v_rows);

  -- Mig 459: every accepted child on a team counts as told the team they are on.
  UPDATE league_registrations r SET told_team_id = r.team_id, told_at = v_now
   WHERE r.division_id = p_division AND r.status = 'active' AND r.team_id IS NOT NULL;

  IF v_families > 0 THEN
    INSERT INTO league_season_notices(org_id, season_id, division_id, kind, family_count, created_by, created_at)
    VALUES (p_org, p_season, p_division, 'teams_published', v_families, p_actor, v_now)
    RETURNING id INTO v_notice;
    UPDATE league_placement_emails e SET notice_id = v_notice WHERE e.id = ANY (v_rows);
  END IF;

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

REVOKE ALL ON FUNCTION public.league_division_publish(uuid, uuid, uuid, uuid, text, uuid[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_division_publish(uuid, uuid, uuid, uuid, text, uuid[], text[]) TO service_role;

-- ─── 7 · What the Review window saw, so a stale one is refused ───────────────────────────────────────────────────────
-- Over every accepted child of the division: who they are, their family's address, the team they stand on and the team
-- their family was last told. A move, a late placement, an address edit or someone else's Send all change it.

CREATE OR REPLACE FUNCTION public.league_division_untold_fingerprint(p_division uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT md5(
    coalesce((SELECT string_agg(r.id::text || ':' || coalesce(r.team_id::text, '') || ':' || coalesce(r.told_team_id::text, '')
                                || ':' || lower(btrim(coalesce(r.guardian_email, ''))), ',' ORDER BY r.id)
                FROM league_registrations r WHERE r.division_id = p_division AND r.status = 'active'), '')
  )
$$;

-- ─── 8 · Send (or choose not to email) the families not yet told ─────────────────────────────────────────────────────
-- One transaction: the notice, one `changes` email per family in p_send (a snapshot of each child's from-team), and the
-- told stamps. p_send and p_skip are lower-cased family addresses and together must be EXACTLY the families that are
-- untold now; anything else is `changed` (the window is stale). A skipped family gets no email row. Every accepted child on
-- a team is then stamped told the team they are on: sent, skipped, quiet (moved and back) and no-address children alike.

CREATE OR REPLACE FUNCTION public.league_division_tell_changes(
  p_org uuid, p_season uuid, p_division uuid, p_actor uuid, p_fingerprint text, p_send text[], p_skip text[]
) RETURNS TABLE (refusal text, notice uuid, email_ids uuid[], sent_families integer, skipped_families integer, no_email_children integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_div league_divisions%ROWTYPE; v_status text; v_now timestamptz := now();
        v_send text[] := coalesce(p_send, ARRAY[]::text[]); v_skip text[] := coalesce(p_skip, ARRAY[]::text[]);
        v_untold text[]; v_rows uuid[]; v_notice uuid; v_noemail integer; v_total integer;
BEGIN
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF v_status IN ('completed','archived') THEN
    RETURN QUERY SELECT 'finished'::text, NULL::uuid, ARRAY[]::uuid[], 0, 0, 0; RETURN;
  END IF;
  SELECT * INTO v_div FROM league_divisions d WHERE d.id = p_division AND d.season_id = p_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Division not found'; END IF;
  IF v_div.teams_published_at IS NULL THEN
    RETURN QUERY SELECT 'not_published'::text, NULL::uuid, ARRAY[]::uuid[], 0, 0, 0; RETURN;
  END IF;
  IF league_division_untold_fingerprint(p_division) IS DISTINCT FROM p_fingerprint THEN
    RETURN QUERY SELECT 'changed'::text, NULL::uuid, ARRAY[]::uuid[], 0, 0, 0; RETURN;
  END IF;

  SELECT coalesce(array_agg(DISTINCT lower(btrim(r.guardian_email))), ARRAY[]::text[]) INTO v_untold
    FROM league_registrations r
   WHERE r.division_id = p_division AND r.status = 'active' AND r.team_id IS NOT NULL
     AND r.team_id IS DISTINCT FROM r.told_team_id AND btrim(coalesce(r.guardian_email, '')) <> '';
  SELECT count(*) INTO v_noemail FROM league_registrations r
   WHERE r.division_id = p_division AND r.status = 'active' AND r.team_id IS NOT NULL
     AND r.team_id IS DISTINCT FROM r.told_team_id AND btrim(coalesce(r.guardian_email, '')) = '';

  -- The two lists are the untold families, each once.
  IF v_send && v_skip
     OR NOT (v_untold @> (v_send || v_skip) AND (v_send || v_skip) @> v_untold)
     OR cardinality(v_send) <> (SELECT count(DISTINCT e) FROM unnest(v_send) e)
     OR cardinality(v_skip) <> (SELECT count(DISTINCT e) FROM unnest(v_skip) e) THEN
    RETURN QUERY SELECT 'changed'::text, NULL::uuid, ARRAY[]::uuid[], 0, 0, 0; RETURN;
  END IF;

  v_total := cardinality(v_send) + cardinality(v_skip);
  IF v_total > 0 THEN
    INSERT INTO league_season_notices(org_id, season_id, division_id, kind, family_count, skipped_count, created_by, created_at)
    VALUES (p_org, p_season, p_division, 'team_changes', v_total, cardinality(v_skip), p_actor, v_now)
    RETURNING id INTO v_notice;
  END IF;

  WITH ins AS (
    INSERT INTO league_placement_emails(org_id, season_id, division_id, kind, guardian_email, registration_ids, changes,
                                        notice_id, created_by)
    SELECT p_org, p_season, p_division, 'changes', lower(btrim(r.guardian_email)),
           array_agg(r.id ORDER BY r.player_first_name, r.player_last_name, r.id),
           jsonb_agg(jsonb_build_object('registration_id', r.id, 'from_team_id', r.told_team_id)
                     ORDER BY r.player_first_name, r.player_last_name, r.id),
           v_notice, p_actor
      FROM league_registrations r
     WHERE r.division_id = p_division AND r.status = 'active' AND r.team_id IS NOT NULL
       AND r.team_id IS DISTINCT FROM r.told_team_id AND btrim(coalesce(r.guardian_email, '')) <> ''
       AND lower(btrim(r.guardian_email)) = ANY (v_send)
     GROUP BY lower(btrim(r.guardian_email))
    RETURNING id
  ) SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_rows FROM ins;

  UPDATE league_registrations r SET told_team_id = r.team_id, told_at = v_now
   WHERE r.division_id = p_division AND r.status = 'active' AND r.team_id IS NOT NULL
     AND (r.told_team_id IS DISTINCT FROM r.team_id OR r.told_at IS NULL OR r.team_changed_at > r.told_at);

  RETURN QUERY SELECT NULL::text, v_notice, v_rows, cardinality(v_send), cardinality(v_skip), v_noemail;
END $$;

REVOKE ALL ON FUNCTION public.league_division_untold_fingerprint(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_division_untold_fingerprint(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.league_division_tell_changes(uuid, uuid, uuid, uuid, text, text[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_division_tell_changes(uuid, uuid, uuid, uuid, text, text[], text[]) TO service_role;
REVOKE ALL ON FUNCTION public.league_team_place(uuid, uuid, uuid, uuid, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_team_place(uuid, uuid, uuid, uuid, boolean, uuid) TO service_role;

-- Verify on dev after applying (all should hold):
--   SELECT count(*) FROM league_registrations WHERE status = 'active' AND team_id IS NOT NULL AND told_team_id IS NULL
--     AND division_id IN (SELECT id FROM league_divisions WHERE teams_published_at IS NOT NULL);               -- 0
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'league_placement_emails_kind_check';  -- has changes
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'league_season_notices_kind_check';    -- has team_changes
