-- Migration 070: Rep team roster positions and event lineups
-- Adds coach-managed baseball/softball lineup planning tied to team events.

ALTER TABLE public.rep_roster_players
  ADD COLUMN IF NOT EXISTS primary_position text,
  ADD COLUMN IF NOT EXISTS secondary_position text;

CREATE TABLE IF NOT EXISTS public.rep_team_lineups (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid        NOT NULL REFERENCES public.rep_team_events(id) ON DELETE CASCADE,
  program_year_id uuid        NOT NULL REFERENCES public.rep_program_years(id) ON DELETE CASCADE,
  team_id         uuid        NOT NULL REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  org_id          uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lineup_mode     text        NOT NULL DEFAULT 'everyone_bats'
                              CHECK (lineup_mode IN ('nine_player', 'everyone_bats')),
  inning_count    int         NOT NULL DEFAULT 7 CHECK (inning_count BETWEEN 1 AND 12),
  notes           text,
  updated_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

CREATE TABLE IF NOT EXISTS public.rep_team_lineup_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lineup_id        uuid        NOT NULL REFERENCES public.rep_team_lineups(id) ON DELETE CASCADE,
  player_id        uuid        NOT NULL REFERENCES public.rep_roster_players(id) ON DELETE CASCADE,
  batting_order    int         CHECK (batting_order IS NULL OR batting_order > 0),
  starter          boolean     NOT NULL DEFAULT true,
  inning_positions jsonb       NOT NULL DEFAULT '{}'::jsonb,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lineup_id, player_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS rep_team_lineup_entries_batting_order_idx
  ON public.rep_team_lineup_entries(lineup_id, batting_order)
  WHERE batting_order IS NOT NULL;

CREATE INDEX IF NOT EXISTS rep_team_lineups_event_idx
  ON public.rep_team_lineups(event_id);

CREATE INDEX IF NOT EXISTS rep_team_lineups_team_idx
  ON public.rep_team_lineups(team_id, program_year_id);

CREATE INDEX IF NOT EXISTS rep_team_lineup_entries_lineup_idx
  ON public.rep_team_lineup_entries(lineup_id);

CREATE INDEX IF NOT EXISTS rep_team_lineup_entries_player_idx
  ON public.rep_team_lineup_entries(player_id);

ALTER TABLE public.rep_team_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rep_team_lineup_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read rep_team_lineups"
  ON public.rep_team_lineups FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read assigned team lineups"
  ON public.rep_team_lineups FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "org members can read rep_team_lineup_entries"
  ON public.rep_team_lineup_entries FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.rep_team_lineups lineup
    WHERE lineup.id = rep_team_lineup_entries.lineup_id
      AND lineup.org_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
  ));

CREATE POLICY "coaches can read assigned team lineup entries"
  ON public.rep_team_lineup_entries FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.rep_team_lineups lineup
    WHERE lineup.id = rep_team_lineup_entries.lineup_id
      AND lineup.team_id IN (
        SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
      )
  ));

CREATE OR REPLACE FUNCTION public.sync_rep_team_lineup_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rep_team_lineups
  SET
    org_id = NEW.org_id,
    team_id = NEW.team_id,
    program_year_id = NEW.program_year_id,
    updated_at = now()
  WHERE event_id = NEW.id
    AND (
      org_id IS DISTINCT FROM NEW.org_id
      OR team_id IS DISTINCT FROM NEW.team_id
      OR program_year_id IS DISTINCT FROM NEW.program_year_id
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rep_team_lineup_scope_sync
  ON public.rep_team_events;

CREATE TRIGGER rep_team_lineup_scope_sync
AFTER UPDATE OF org_id, team_id, program_year_id
ON public.rep_team_events
FOR EACH ROW
EXECUTE FUNCTION public.sync_rep_team_lineup_scope();

UPDATE public.rep_team_lineups lineup
SET
  org_id = event.org_id,
  team_id = event.team_id,
  program_year_id = event.program_year_id
FROM public.rep_team_events event
WHERE lineup.event_id = event.id
  AND (
    lineup.org_id IS DISTINCT FROM event.org_id
    OR lineup.team_id IS DISTINCT FROM event.team_id
    OR lineup.program_year_id IS DISTINCT FROM event.program_year_id
  );
