-- 552_house_league_takes_its_slots_part.sql
--
-- Club schedules Stage 2, Session 2E part 1: house league carries a part from club time (plan
-- docs/projects/active/SCHEDULE_FIELDS_SAME_TIME_TRADES_PLAN.md §5, /dba Finding #55; build prompt
-- SCHEDULE_PARTS_STAGE2_BUILD_PROMPT.md, Session 2E item 1; round 2 Asks 1 A and 5 A). Mig 541 made
-- league_games.section_mask and league_practices.section_mask; mig 546 taught Send the changes to move a house-league
-- game or practice onto its slot's part. Every other house-league writer still wrote the whole field.
--
-- WHAT CHANGES (each body is the live one on dev, read with pg_get_functiondef 2026-11-26, plus the part):
--   league_games_generate_save — a generated game takes its SLOT's part (league_slot_uses.slot_id = the club slot), never
--     the payload's, and only while the game sits on that slot's field; a part its field no longer offers is the whole.
--   league_practices_hand_out — a practice takes its slot's part (insert and reinstate). Teams at once counts on whole
--     facilities only (round 2 Ask 5 A): a part slot holds ONE practice at a time whatever the setting.
--   league_game_snapshot — the snapshot carries 'sectionMask', so Changes to send and Undo see the part.
--   league_games_record_change — a change of part is a change of place (round 2 tab 8: "A part change is a move"). This
--     reaches mig 546's carry too (a club send that only changes a published game's part now waits in the division's
--     Changes to send as the club's change, as a field change does).
--   league_game_undo — puts the part back from the snapshot; an older snapshot without one keeps the stored part on the
--     same field and the whole field on another.
--   league_game_club_write — writes 'section_mask' when the patch names it (the game window's hand edit sends 0 when it
--     changes the field: house league never splits a field, round 2 Ask 1 A).
--   A whole-field slot's mask is 0, so with no split field every row is written exactly as before.
--   section_mask_check (541's trigger, all five tables) — a NEW part its field doesn't offer is still refused, and a
--     field gone still clears the part, but a row keeping its field AND its part is not judged again (/review 2026-11-26):
--     the club-write function names both columns on every save, so a score alone on a field split differently since
--     (the lock ignores past and cancelled bookings) was refused with an error.
--   THE CATCH-UP (before the change record learns the part, so it is not news): games and practices still to come on a
--   part slot take their slot's part. 0 such rows on dev 2026-11-26 (no part slot exists); prod has no house-league
--   games or practices.
--   Signatures unchanged: grants as live. Function-only, so check:migrations can't see it (MANUAL_PROD_STEPS.json).
--   ORDER: after 541 and 546.
--
-- Idempotent (create or replace; the catch-up touches only rows that differ).

begin;
set local lock_timeout = '15s';

-- ── 0. The catch-up: rows already on a part slot take its part (not recorded as a change: the trigger is unchanged yet
--       and compares no part) ───────────────────────────────────────────────────────────────────────────────────────────
update league_games g set section_mask = sl.section_mask, updated_at = now()
  from club_schedule_slots sl
  left join org_venue_facilities f on f.id = sl.facility_id
 where sl.id = g.slot_use_id and sl.removed_at is null
   and g.status = 'scheduled' and g.scheduled_at > now()
   and g.org_venue_facility_id is not distinct from sl.facility_id and g.section_mask <> sl.section_mask
   and public.section_mask_legal(sl.section_mask, coalesce(f.sections, 1::smallint));

update league_practices lp set section_mask = sl.section_mask, updated_at = now()
  from club_schedule_slots sl
  left join org_venue_facilities f on f.id = sl.facility_id
 where sl.id = lp.club_schedule_slot_id and sl.removed_at is null
   and lp.status <> 'cancelled' and lp.scheduled_at > now()
   and lp.org_venue_facility_id is not distinct from sl.facility_id and lp.section_mask <> sl.section_mask
   and public.section_mask_legal(sl.section_mask, coalesce(f.sections, 1::smallint));

-- ── 1. Generated games take their slot's part ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.league_games_generate_save(p_org uuid, p_season uuid, p_division uuid, p_games jsonb)
 RETURNS TABLE(refusal text, ids uuid[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
                             org_venue_id, org_venue_facility_id, section_mask, location, slot_use_id)
    SELECT p_org, p_season, p_division, x."homeTeamId", x."awayTeamId", x."scheduledAt", x."endsAt",
           x."venueId", x."facilityId",
           -- Stage 2 (mig 552): the SLOT's part, while the game is on the slot's field (never the payload's).
           coalesce((SELECT sl.section_mask FROM league_slot_uses u
                       JOIN club_schedule_slots sl ON sl.id = u.slot_id
                       LEFT JOIN org_venue_facilities f ON f.id = sl.facility_id
                      WHERE u.slot_id = x."slotUseId" AND sl.facility_id IS NOT DISTINCT FROM x."facilityId"
                        AND section_mask_legal(sl.section_mask, coalesce(f.sections, 1::smallint))
                      LIMIT 1), 0),
           x.location, x."slotUseId"
      FROM jsonb_to_recordset(p_games) AS x("homeTeamId" uuid, "awayTeamId" uuid, "scheduledAt" timestamptz,
           "endsAt" timestamptz, "venueId" uuid, "facilityId" uuid, location text, "slotUseId" uuid)
    RETURNING id
  ) SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_ids FROM ins;
  RETURN QUERY SELECT NULL::text, v_ids;
END $function$;

-- ── 2. Handed-out practices take their slot's part; a part holds one team ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.league_practices_hand_out(p_org uuid, p_season uuid, p_division uuid, p_actor uuid, p_slots uuid[], p_rows jsonb, p_settings jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_code    text;
  v_slot    uuid;
  v_row     jsonb;
  v_sl      club_schedule_slots%rowtype;
  v_mask    smallint;
  v_cap     integer;
  v_minutes integer;
  v_written integer := 0;
  v_removed integer := 0;
  v_team    text;
begin
  v_code := league_time_refusal(p_org, p_season, p_division);
  if v_code is not null then return jsonb_build_object('ok', false, 'code', v_code); end if;
  if p_division is null then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if coalesce(p_settings->>'teamsAtOnce', '1') !~ '^[1-4]$'
     or (p_settings ? 'practiceMinutes' and coalesce(p_settings->>'practiceMinutes', '') !~ '^[0-9]{2,3}$') then
    return jsonb_build_object('ok', false, 'code', 'bad_settings');
  end if;
  v_cap := coalesce((p_settings->>'teamsAtOnce')::integer, 1);
  v_minutes := (p_settings->>'practiceMinutes')::integer;
  if v_minutes is not null and (v_minutes < 15 or v_minutes > 240) then
    return jsonb_build_object('ok', false, 'code', 'bad_settings');
  end if;

  -- One hand-out of a division at a time: "never twice at once" reads the other slots' practices, which a concurrent
  -- hand-out on other slots would be writing.
  perform pg_advisory_xact_lock(hashtextextended('league_practices_hand_out:' || p_season::text || ':' || p_division::text, 0));
  for v_slot in select distinct s from unnest(coalesce(p_slots, '{}'::uuid[])) s order by 1 loop
    perform 1 from club_schedule_slots where id = v_slot and org_id = p_org for update;
  end loop;
  foreach v_slot in array coalesce(p_slots, '{}'::uuid[]) loop
    if not exists (select 1 from club_schedule_slots sl
                     join club_schedule_slot_programs p on p.slot_id = sl.id
                     join league_slot_uses u on u.slot_id = sl.id
                    where sl.id = v_slot and sl.org_id = p_org and sl.removed_at is null and p.program = 'house_league'
                      and u.season_id = p_season and u.division_id = p_division and u.kind = 'practices') then
      return jsonb_build_object('ok', false, 'code', 'changed', 'slotId', v_slot);
    end if;
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if not ((v_row->>'slotId')::uuid = any (coalesce(p_slots, '{}'::uuid[]))) then
      return jsonb_build_object('ok', false, 'code', 'changed', 'slotId', v_row->>'slotId');
    end if;
    if not exists (select 1 from league_teams t where t.id = (v_row->>'teamId')::uuid
                                                  and t.season_id = p_season and t.division_id = p_division) then
      return jsonb_build_object('ok', false, 'code', 'changed', 'teamId', v_row->>'teamId');
    end if;
    if not exists (select 1 from club_schedule_slots sl
                    where sl.id = (v_row->>'slotId')::uuid
                      and (v_row->>'scheduledAt')::timestamptz >= sl.starts_at
                      and (v_row->>'endsAt')::timestamptz <= sl.ends_at
                      and (v_row->>'endsAt')::timestamptz > (v_row->>'scheduledAt')::timestamptz) then
      return jsonb_build_object('ok', false, 'code', 'changed', 'slotId', v_row->>'slotId');
    end if;
  end loop;

  delete from league_practices lp
   where lp.club_schedule_slot_id = any (coalesce(p_slots, '{}'::uuid[])) and lp.org_id = p_org and lp.scheduled_at > now()
     and not exists (select 1 from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
                      where (r->>'slotId')::uuid = lp.club_schedule_slot_id and (r->>'teamId')::uuid = lp.team_id);
  get diagnostics v_removed = row_count;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    select * into v_sl from club_schedule_slots where id = (v_row->>'slotId')::uuid;
    -- Stage 2 (mig 552): the slot's part; a part its field no longer offers is the whole field.
    v_mask := case when section_mask_legal(v_sl.section_mask,
                          coalesce((select f.sections from org_venue_facilities f where f.id = v_sl.facility_id), 1::smallint))
                   then v_sl.section_mask else 0 end;
    insert into league_practices (season_id, division_id, team_id, org_id, scheduled_at, ends_at, location, status,
                                  org_venue_id, org_venue_facility_id, section_mask, club_schedule_slot_id)
    values (p_season, p_division, (v_row->>'teamId')::uuid, p_org,
            (v_row->>'scheduledAt')::timestamptz, (v_row->>'endsAt')::timestamptz, nullif(v_row->>'location', ''),
            'scheduled', v_sl.org_venue_id, v_sl.facility_id, v_mask, v_sl.id)
    on conflict (club_schedule_slot_id, team_id) where club_schedule_slot_id is not null
    do update set status = 'scheduled', scheduled_at = excluded.scheduled_at, ends_at = excluded.ends_at,
                  location = excluded.location, org_venue_id = excluded.org_venue_id,
                  org_venue_facility_id = excluded.org_venue_facility_id, section_mask = excluded.section_mask,
                  division_id = excluded.division_id, updated_at = now();
    v_written := v_written + 1;
  end loop;

  -- Teams at once: no instant on a slot holds more live practices than the setting. A part holds one team (round 2
  -- Ask 5 A: Teams at once counts on whole facilities only).
  -- The refusal names the cap that refused it (1 on a part); the caller says its own fixed words for slot_full.
  select case when s.section_mask <> 0 then 1 else v_cap end into v_mask
    from league_practices a
    join club_schedule_slots s on s.id = a.club_schedule_slot_id
   where a.club_schedule_slot_id = any (coalesce(p_slots, '{}'::uuid[])) and a.status <> 'cancelled'
     and (select count(*) from league_practices b
           where b.club_schedule_slot_id = a.club_schedule_slot_id and b.status <> 'cancelled'
             and b.scheduled_at <= a.scheduled_at and b.ends_at > a.scheduled_at)
         > case when s.section_mask <> 0 then 1 else v_cap end
   limit 1;
  if found then
    raise exception 'slot_full: a slot holds % practice(s) at once', v_mask;
  end if;
  -- A team never in two of house league's club-time practices at once — asked of the practices THIS hand-out wrote. A
  -- practice booked by hand is the league admin's own call (the clash read warns of it), never a refusal here.
  select t.name into v_team
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
    join league_practices a on a.club_schedule_slot_id = (r->>'slotId')::uuid and a.team_id = (r->>'teamId')::uuid
    join league_practices b on b.team_id = a.team_id and b.id <> a.id and b.status <> 'cancelled'
                           and b.club_schedule_slot_id is not null
    join league_teams t on t.id = a.team_id
   where a.scheduled_at < b.ends_at and b.scheduled_at < a.ends_at
   limit 1;
  if found then
    raise exception 'team_twice: % has two practices at once', v_team;
  end if;

  if v_minutes is not null then
    insert into league_practice_time (season_id, division_id, org_id, practice_minutes, teams_at_once, updated_by)
    values (p_season, p_division, p_org, v_minutes, v_cap, p_actor)
    on conflict (season_id, division_id) do update set practice_minutes = excluded.practice_minutes,
      teams_at_once = excluded.teams_at_once, updated_by = excluded.updated_by, updated_at = now();
  end if;
  return jsonb_build_object('ok', true, 'written', v_written, 'removed', v_removed);
end;
$function$;

-- ── 3. The snapshot carries the part ────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.league_game_snapshot(g league_games)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT jsonb_build_object(
    'scheduledAt', g.scheduled_at, 'endsAt', g.ends_at, 'location', g.location,
    'venueId', g.org_venue_id, 'facilityId', g.org_venue_facility_id, 'sectionMask', g.section_mask,
    'status', g.status, 'movedFrom', g.moved_from, 'slotUseId', g.slot_use_id);
$function$;

-- ── 4. A change of part is a change of place ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.league_games_record_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Stage 2 (mig 552): side A → side B is a change of place, as Field 1 → Field 2 is (round 2 tab 8).
  v_where := NOT v_link AND (NEW.location IS DISTINCT FROM OLD.location OR NEW.org_venue_id IS DISTINCT FROM OLD.org_venue_id
          OR NEW.org_venue_facility_id IS DISTINCT FROM OLD.org_venue_facility_id
          OR NEW.section_mask IS DISTINCT FROM OLD.section_mask);
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
END $function$;

-- ── 5. Undo puts the part back ──────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.league_game_undo(p_org uuid, p_season uuid, p_game uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_game league_games%ROWTYPE; v_first league_game_changes%ROWTYPE; v_b jsonb;
BEGIN
  SELECT * INTO v_game FROM league_games g WHERE g.id = p_game AND g.season_id = p_season AND g.org_id = p_org;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('league_schedule:' || v_game.division_id::text, 0));
  -- Read again under the lock: a score saved while this waited must be seen (a played game is a record).
  SELECT * INTO v_game FROM league_games g WHERE g.id = p_game;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  SELECT * INTO v_first FROM league_game_changes c
   WHERE c.game_id = p_game AND c.sent_at IS NULL ORDER BY c.created_at, c.id LIMIT 1;
  IF NOT FOUND THEN RETURN 'nothing'; END IF;
  IF v_game.status = 'completed' THEN RETURN 'played'; END IF;
  -- 9d-2b Part 5: a change the CLUB made (its game time moved or went, 9d2·13 / 9d2·16) is never undone here: the game
  -- would go back onto time the club gave away, which no house-league screen may choose (9d2·3). The league admin gives
  -- it a new date instead.
  IF EXISTS (SELECT 1 FROM league_game_changes c WHERE c.game_id = p_game AND c.sent_at IS NULL AND c.source = 'club') THEN
    RETURN 'club';
  END IF;

  IF v_first.kind = 'added' THEN
    DELETE FROM league_games g WHERE g.id = p_game;
    RETURN NULL;
  END IF;

  v_b := v_first.before;
  UPDATE league_games g SET
    scheduled_at = (v_b->>'scheduledAt')::timestamptz, ends_at = (v_b->>'endsAt')::timestamptz,
    location = v_b->>'location', org_venue_id = (v_b->>'venueId')::uuid,
    org_venue_facility_id = (v_b->>'facilityId')::uuid,
    -- Stage 2 (mig 552): the part families last heard. A snapshot from before 552 names none: the stored part on the same
    -- field, the whole field on another.
    -- A part the field no longer offers (split again since) is put back as the whole field, never a refused Undo (/dba).
    section_mask = CASE WHEN jsonb_exists(v_b, 'sectionMask')
                         AND section_mask_legal(coalesce((v_b->>'sectionMask')::smallint, 0::smallint),
                               coalesce((SELECT f.sections FROM org_venue_facilities f WHERE f.id = (v_b->>'facilityId')::uuid), 1::smallint))
                        THEN coalesce((v_b->>'sectionMask')::smallint, 0)
                        WHEN jsonb_exists(v_b, 'sectionMask') THEN 0
                        WHEN (v_b->>'facilityId')::uuid IS NOT DISTINCT FROM g.org_venue_facility_id THEN g.section_mask
                        ELSE 0 END,
    status = v_b->>'status',
    moved_from = (v_b->>'movedFrom')::timestamptz,
    slot_use_id = CASE WHEN jsonb_exists(v_b, 'slotUseId')
                       THEN (SELECT u.slot_id FROM league_slot_uses u WHERE u.slot_id = (v_b->>'slotUseId')::uuid)
                       ELSE g.slot_use_id END,
    updated_at = now()
   WHERE g.id = p_game;
  -- The put-back recorded itself as one more change; with the rest it goes (the game is as families last heard it).
  DELETE FROM league_game_changes c WHERE c.game_id = p_game AND c.sent_at IS NULL;
  RETURN NULL;
END $function$;

-- ── 6. The game window's write (with a score) names the part when the patch does ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.league_game_club_write(p_org uuid, p_game uuid, p_seen timestamp with time zone, p_patch jsonb, p_user uuid, p_name text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  g league_games%ROWTYPE;
  n league_games%ROWTYPE;
BEGIN
  SELECT * INTO g FROM league_games WHERE id = p_game AND org_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RETURN 'notFound'; END IF;
  IF g.updated_at IS DISTINCT FROM p_seen THEN RETURN 'changed'; END IF;

  -- The same columns updateLeagueGame (lib/db.ts) writes; a key that is absent keeps the stored value.
  UPDATE league_games SET
    home_team_id          = CASE WHEN p_patch ? 'home_team_id'          THEN (p_patch->>'home_team_id')::uuid               ELSE home_team_id END,
    away_team_id          = CASE WHEN p_patch ? 'away_team_id'          THEN (p_patch->>'away_team_id')::uuid               ELSE away_team_id END,
    slot_use_id           = CASE WHEN p_patch ? 'slot_use_id'           THEN (p_patch->>'slot_use_id')::uuid                ELSE slot_use_id END,
    scheduled_at          = CASE WHEN p_patch ? 'scheduled_at'          THEN (p_patch->>'scheduled_at')::timestamptz        ELSE scheduled_at END,
    ends_at               = CASE WHEN p_patch ? 'ends_at'               THEN (p_patch->>'ends_at')::timestamptz             ELSE ends_at END,
    org_venue_id          = CASE WHEN p_patch ? 'org_venue_id'          THEN (p_patch->>'org_venue_id')::uuid               ELSE org_venue_id END,
    org_venue_facility_id = CASE WHEN p_patch ? 'org_venue_facility_id' THEN (p_patch->>'org_venue_facility_id')::uuid      ELSE org_venue_facility_id END,
    section_mask          = CASE WHEN p_patch ? 'section_mask'          THEN coalesce((p_patch->>'section_mask')::smallint, 0) ELSE section_mask END,
    location              = CASE WHEN p_patch ? 'location'              THEN p_patch->>'location'                           ELSE location END,
    home_score            = CASE WHEN p_patch ? 'home_score'            THEN (p_patch->>'home_score')::integer              ELSE home_score END,
    away_score            = CASE WHEN p_patch ? 'away_score'            THEN (p_patch->>'away_score')::integer              ELSE away_score END,
    status                = CASE WHEN p_patch ? 'status'                THEN p_patch->>'status'                             ELSE status END,
    notes                 = CASE WHEN p_patch ? 'notes'                 THEN p_patch->>'notes'                              ELSE notes END,
    updated_at            = now()
  WHERE id = p_game
  RETURNING * INTO n;

  IF (n.home_score, n.away_score) IS NOT DISTINCT FROM (g.home_score, g.away_score) THEN
    RETURN NULL; -- the score did not change: no stamp
  END IF;
  IF n.home_score IS NULL AND n.away_score IS NULL THEN
    DELETE FROM league_game_scores WHERE game_id = p_game;
  ELSIF EXISTS (SELECT 1 FROM league_game_scores WHERE game_id = p_game AND entered_side = 'coach') THEN
    UPDATE league_game_scores
       SET corrected_by = p_user, corrected_by_name = p_name, corrected_at = now(), updated_at = now()
     WHERE game_id = p_game;
  ELSE
    INSERT INTO league_game_scores (game_id, org_id, season_id, entered_side, entered_by, entered_by_name, entered_at)
    VALUES (p_game, n.org_id, n.season_id, 'club', p_user, p_name, now())
    ON CONFLICT (game_id) DO UPDATE
      SET entered_side = 'club', entered_by = EXCLUDED.entered_by, entered_by_name = EXCLUDED.entered_by_name,
          entered_for_team = NULL, entered_at = EXCLUDED.entered_at, updated_at = now();
  END IF;
  RETURN NULL;
END $function$;

-- ── 7. A part already stored is not judged again ────────────────────────────────────────────────────────────────────
-- 541's body plus the second test: a save that names the field and the part without changing them is history (a field
-- split differently since its past or cancelled bookings). Same trigger function for all five tables; grants as live.
create or replace function public.section_mask_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_fac uuid;
  v_sections smallint;
begin
  v_fac := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;
  if tg_op = 'UPDATE' and new.section_mask = old.section_mask
     and (to_jsonb(old) ->> tg_argv[0]) is not distinct from (to_jsonb(new) ->> tg_argv[0]) then
    return new;
  end if;
  if v_fac is null then
    -- The field went (ON DELETE SET NULL on rep events and house-league rows, or a hand edit clearing it): its part
    -- goes with it. An INSERT naming a part with no field is left to the CHECK, which refuses it.
    if tg_op = 'UPDATE' and new.section_mask <> 0 and (to_jsonb(old) ->> tg_argv[0]) is not null then
      new.section_mask := 0;
    end if;
    return new;
  end if;
  if new.section_mask = 0 then
    return new;
  end if;
  -- FOR SHARE (/dba 2026-11-25): a split change racing this booking waits for it, then its lock check sees it.
  select sections into v_sections from org_venue_facilities where id = v_fac for share;
  if v_sections is null or not public.section_mask_legal(new.section_mask, v_sections) then
    raise exception 'part_illegal: that part is not one of the field''s parts' using errcode = '23514';
  end if;
  return new;
end;
$function$;

commit;
