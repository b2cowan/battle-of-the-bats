-- Club Tier Stage 9c · /review fixes (HOUSE_LEAGUE_STAGE9C_BUILD_PROMPT.md "Definition of done": /review on Parts 1 and 4).
--
--   1. A coach's invite that did not send is a fact (league_team_coaches.invite_failed_at): the card says "Invite didn't
--      send · Send again" instead of "Invited" over a link nobody received (before this, the raw token was gone and the
--      only way back was to wait seven days for the invite to expire).
--   2. The three 9c tables are the server's only: their default grants to anon / authenticated are revoked, so a future
--      permissive policy could never expose a rating, an invite's hash or a family's address (migs 339 and 365 do the same).
--   3. A rating leaves with the child (9c·2b, its spirit): ending a registration (declined or withdrawn) erases its rating
--      at once, not only when the season finishes. The same trigger that takes the child off their team does it.
-- Requires 377. Additive.

ALTER TABLE public.league_team_coaches ADD COLUMN IF NOT EXISTS invite_failed_at timestamptz;

REVOKE ALL ON TABLE public.league_player_ratings FROM anon, authenticated;
REVOKE ALL ON TABLE public.league_team_coaches FROM anon, authenticated;
REVOKE ALL ON TABLE public.league_placement_emails FROM anon, authenticated;

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

  -- An ended registration takes its rating with it (/review 2026-10-25).
  IF TG_OP = 'UPDATE' AND NEW.status IN ('declined','withdrawn') AND OLD.status NOT IN ('declined','withdrawn') THEN
    DELETE FROM league_player_ratings WHERE registration_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.league_registrations_team_follows() FROM PUBLIC, anon, authenticated;

-- Ratings already held by ended registrations go now.
DELETE FROM public.league_player_ratings p
 USING public.league_registrations r
 WHERE r.id = p.registration_id AND r.status IN ('declined','withdrawn');
