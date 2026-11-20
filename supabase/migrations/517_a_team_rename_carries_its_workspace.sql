-- ---------------------------------------------------------------
-- Migration 517 — Settings in both workspaces, Session 2 (owner rulings A5 and C1, 2026-11-20; build prompt
-- docs/projects/active/SETTINGS_BOTH_WORKSPACES_BUILD_PROMPT.md § Session 2).
--
-- WHY: a Premium Coaches Portal coach renames the TEAM (A5), and the workspace's own name — made as
-- "{team} Coaches Portal" — follows it. Nothing could change the team's name in the portal before.
--
-- WHAT CHANGES (one function; no table, no column):
--   rename_team_workspace(p_team uuid, p_name text) — in ONE transaction:
--     • rep_teams.name                         → the new name
--     • organizations.name (the workspace)     → "{new} Coaches Portal"
--     • basic_coach_teams.name/normalized_name → the workspace's free-team record behind the register picker (F3)
--     • chat_rooms.name "{old} staff"          → "{new} staff" (only while it still carries the old name)
--     • assistant_invite_tokens.team_name      → the new name, on invites still waiting
--     • rep_program_years.name "{old} {year}"  → "{new} {year}", only a season not yet closed whose label is the
--                                                untouched default it was made with
--   Records keep the name they were made with (C1): registrations, sealed results, Stripe notes, snapshots, logs.
--   Neither web address changes.
-- Refuses (raises, changing nothing): a name blank or over 40 characters, a team that is not its running Premium
-- workspace's own team (a club's team is renamed on the club side, which leaves the club's name alone).
--
-- SERVICE ROLE ONLY. Invisible to check:migrations (a function): MANUAL_PROD_STEPS.json. Apply BEFORE the Session 2
-- code. Re-runnable (CREATE OR REPLACE).
-- ---------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.rename_team_workspace(p_team uuid, p_name text)
RETURNS TABLE (team_name text, workspace_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_old text;
  v_org uuid;
  v_ws team_workspaces%ROWTYPE;
BEGIN
  IF v_name = '' OR char_length(v_name) > 40 THEN
    RAISE EXCEPTION 'rename_team_workspace: name must be 1 to 40 characters';
  END IF;

  SELECT t.name, t.org_id INTO v_old, v_org FROM rep_teams t WHERE t.id = p_team FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rename_team_workspace: no such team';
  END IF;

  SELECT w.* INTO v_ws FROM team_workspaces w WHERE w.workspace_org_id = v_org AND w.rep_team_id = p_team;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM organizations o
     WHERE o.id = v_org
       AND (o.account_kind = 'team_workspace' OR o.plan_id = 'team')
       AND coalesce(o.team_workspace_status, '') NOT IN ('org_owned', 'archived')
  ) THEN
    RAISE EXCEPTION 'rename_team_workspace: not a running Premium workspace''s team';
  END IF;

  UPDATE rep_teams SET name = v_name, updated_at = now() WHERE id = p_team;
  UPDATE organizations SET name = v_name || ' Coaches Portal' WHERE id = v_org;

  IF v_ws.basic_coach_team_id IS NOT NULL THEN
    UPDATE basic_coach_teams
       SET name = v_name, normalized_name = lower(v_name), updated_at = now()
     WHERE id = v_ws.basic_coach_team_id;
  END IF;

  UPDATE chat_rooms
     SET name = v_name || ' staff'
   WHERE org_id = v_org AND surface = 'coach_peer' AND ref_sub_id = p_team AND name = v_old || ' staff';

  UPDATE assistant_invite_tokens
     SET team_name = v_name
   WHERE team_id = p_team AND status IN ('pending', 'pending_approval');

  UPDATE rep_program_years
     SET name = v_name || ' ' || year, updated_at = now()
   WHERE team_id = p_team AND status NOT IN ('completed', 'archived') AND name = v_old || ' ' || year;

  RETURN QUERY SELECT v_name, v_name || ' Coaches Portal';
END;
$$;

REVOKE ALL ON FUNCTION public.rename_team_workspace(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rename_team_workspace(uuid, text) TO service_role;

COMMIT;
