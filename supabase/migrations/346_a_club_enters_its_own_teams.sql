-- 346: a club enters its own teams in one step (Club Tier Stage 7b, "Add our teams").
-- Prompt: docs/projects/active/CLUB_TIER_STAGE7B_BUILD_PROMPT.md. Ruling: Stage 7 Ask 5 A (design log 2026-10-20), and the owner's
-- answers of 2026-10-21: all entered or none; the head coach's name and email written on the entry; a full division is not a
-- refusal; an invite-only event needs no invitation for the club's own team; a team with no head coach yet may be entered.
--
-- Until now the club entered its team by hand ("Add team"), then linked it to the rep team from the record. Until the link was made
-- the coach never saw the tournament (finding G03). club_enter_own_teams writes, for every team in the set, the registration and
-- its rep-team link in ONE transaction: a refusal for any team rolls the whole set back and names that team.
--
-- One entry per rep team per tournament was never enforced (the only unique index is on tournament_team_id, mig 196; the link table
-- has no tournament column). The link guard now refuses a second link for the same rep team in the same tournament, under an
-- advisory lock keyed on the tournament, so two presses, two admins or the record's "Link to a rep team" racing this window enter
-- the team once.
--
-- ⚠ LOCK ORDER (mig 345's rule, kept): tournament row → team rows. club_enter_own_teams takes the tournament row FOR SHARE (a status
-- change to completed waits for it), then the advisory lock, then inserts new team rows only. The guard takes its team row, then the
-- same advisory lock (re-entrant inside this function). Nothing that holds the advisory lock waits for an existing team row.
--
-- The new registration: status 'accepted', payment_status 'paid' (mig 345: a status-only "paid" is how the club's own team owes
-- nothing), deposit_paid / total_paid left at their default 0, and the link inserted right after it, before any payment could exist
-- (Stage 7a's "Consequence for 7b"). No email is sent by anything here.
BEGIN;

-- ── 1. The link guard: one entry per rep team per tournament ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.club_tournament_own_link_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_team public.teams%ROWTYPE; v_host uuid;
BEGIN
  SELECT * INTO v_team FROM teams
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.tournament_team_id ELSE NEW.tournament_team_id END
    FOR UPDATE;
  IF NOT FOUND THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  SELECT org_id INTO v_host FROM tournaments WHERE id = v_team.tournament_id;
  IF TG_OP = 'DELETE' THEN
    IF OLD.org_id = v_host AND EXISTS (SELECT 1 FROM rep_teams WHERE id = OLD.rep_team_id AND org_id = v_host)
       AND EXISTS (SELECT 1 FROM tournament_team_payments WHERE team_id = v_team.id AND status = 'posted') THEN
      RAISE EXCEPTION 'Undo this team''s paid status before removing its club-team link';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.org_id <> v_host OR NOT EXISTS (SELECT 1 FROM rep_teams WHERE id = NEW.rep_team_id AND org_id = v_host) THEN
    RAISE EXCEPTION 'The rep team and tournament must belong to the same club';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('club_own_team_entry:' || v_team.tournament_id::text, 0));
  IF EXISTS (SELECT 1 FROM rep_team_tournament_registrations l JOIN teams t ON t.id = l.tournament_team_id
             WHERE l.rep_team_id = NEW.rep_team_id AND t.tournament_id = v_team.tournament_id
               AND l.tournament_team_id <> NEW.tournament_team_id) THEN
    RAISE EXCEPTION '% is already in this tournament.', (SELECT name FROM rep_teams WHERE id = NEW.rep_team_id);
  END IF;
  IF EXISTS (SELECT 1 FROM tournament_team_payments p JOIN accounting_entries e ON e.id = p.entry_id
             WHERE p.team_id = v_team.id AND p.status = 'posted' AND e.status = 'posted') THEN
    RAISE EXCEPTION 'Undo the recorded entry fee before linking this as our team';
  END IF;
  RETURN NEW;
END $$;

-- ── 2. Add our teams: every team entered, accepted and linked, or none ─────────────────────────
-- p_entries: [{"rep_team_id": uuid, "division_id": uuid, "coach": text|null, "email": text|null}, …]. The coach's name and email are
-- resolved by the server from the team's head coach (the database cannot read the account's name); everything else is checked here.
-- Returns [{"repTeamId", "registrationId", "name"}, …] in the order given.
CREATE OR REPLACE FUNCTION public.club_enter_own_teams(
  p_org uuid, p_tournament uuid, p_entries jsonb, p_actor uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_t public.tournaments%ROWTYPE; v_rep public.rep_teams%ROWTYPE; v_e jsonb; v_rep_id uuid; v_div uuid; v_reg uuid;
  v_out jsonb := '[]'::jsonb; v_n integer;
BEGIN
  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) = 0 THEN
    RAISE EXCEPTION 'Choose at least one team';
  END IF;
  v_n := jsonb_array_length(p_entries);
  IF v_n > 100 THEN RAISE EXCEPTION 'Choose at most 100 teams at once'; END IF;
  IF (SELECT count(DISTINCT e->>'rep_team_id') FROM jsonb_array_elements(p_entries) e) <> v_n THEN
    RAISE EXCEPTION 'Each team can be chosen once';
  END IF;

  SELECT * INTO v_t FROM tournaments WHERE id = p_tournament FOR SHARE;
  IF NOT FOUND OR v_t.org_id <> p_org THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  IF v_t.status = 'completed' THEN
    RAISE EXCEPTION 'This tournament is completed, so its results are locked. Reopen it from the Tournaments list to make changes.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('club_own_team_entry:' || p_tournament::text, 0));

  FOR v_e IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
    BEGIN
      v_rep_id := (v_e->>'rep_team_id')::uuid;
      v_div := (v_e->>'division_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Choose a division for every team';
    END;
    SELECT * INTO v_rep FROM rep_teams WHERE id = v_rep_id AND org_id = p_org;
    IF NOT FOUND THEN RAISE EXCEPTION 'That rep team is not in your organization.'; END IF;
    IF v_rep.is_archived THEN RAISE EXCEPTION '% is archived, so it can''t be entered.', v_rep.name; END IF;
    IF rep_team_live_season(v_rep.id) IS NULL THEN
      RAISE EXCEPTION '% has no season running, so it can''t be entered.', v_rep.name;
    END IF;
    IF v_div IS NULL THEN RAISE EXCEPTION 'Choose a division for %', v_rep.name; END IF;
    PERFORM 1 FROM divisions WHERE id = v_div AND tournament_id = p_tournament;
    IF NOT FOUND THEN RAISE EXCEPTION 'Division does not belong to this tournament.'; END IF;
    IF EXISTS (SELECT 1 FROM rep_team_tournament_registrations l JOIN teams t ON t.id = l.tournament_team_id
               WHERE l.rep_team_id = v_rep.id AND t.tournament_id = p_tournament) THEN
      RAISE EXCEPTION '% is already in this tournament.', v_rep.name;
    END IF;
    -- The one rule for "already here" (lib/utils.ts sameKey): trimmed, lower case, runs of space as one.
    IF EXISTS (SELECT 1 FROM teams WHERE tournament_id = p_tournament AND division_id = v_div
               AND lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(v_rep.name), '\s+', ' ', 'g'))) THEN
      RAISE EXCEPTION 'A team named "%" already exists in this division.', btrim(v_rep.name);
    END IF;

    v_reg := gen_random_uuid();
    INSERT INTO teams(id, tournament_id, division_id, name, coach, email, status, payment_status, registered_at)
    VALUES(v_reg, p_tournament, v_div, btrim(v_rep.name), nullif(btrim(v_e->>'coach'), ''),
           coalesce(lower(nullif(btrim(v_e->>'email'), '')), ''), 'accepted', 'paid', now());
    -- Linked before any paid figure could exist (Stage 7a's consequence for 7b): the guard above runs on this insert.
    INSERT INTO rep_team_tournament_registrations(tournament_team_id, rep_team_id, org_id, linked_by_user_id, link_source)
    VALUES(v_reg, v_rep.id, p_org, p_actor, 'explicit');
    v_out := v_out || jsonb_build_object('repTeamId', v_rep.id, 'registrationId', v_reg, 'name', btrim(v_rep.name));
  END LOOP;
  RETURN v_out;
END $$;

REVOKE ALL ON FUNCTION public.club_enter_own_teams(uuid, uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_enter_own_teams(uuid, uuid, jsonb, uuid) TO service_role;

COMMENT ON FUNCTION public.club_enter_own_teams(uuid, uuid, jsonb, uuid) IS
  'Club Tier Stage 7b, Add our teams: enters, accepts and links each of the club''s rep teams to a tournament in one transaction (all or none). Server only.';
COMMIT;
