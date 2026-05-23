-- Migration 069: Rep team event attendance
-- Adds coach-managed attendance/availability for rostered players on team events.

CREATE TABLE IF NOT EXISTS public.rep_team_event_attendance (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid        NOT NULL REFERENCES public.rep_team_events(id) ON DELETE CASCADE,
  player_id       uuid        NOT NULL REFERENCES public.rep_roster_players(id) ON DELETE CASCADE,
  program_year_id uuid        NOT NULL REFERENCES public.rep_program_years(id) ON DELETE CASCADE,
  team_id         uuid        NOT NULL REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  org_id          uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status          text        NOT NULL DEFAULT 'unknown'
                              CHECK (status IN ('unknown', 'attending', 'absent', 'late')),
  note            text,
  updated_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, player_id)
);

CREATE INDEX IF NOT EXISTS rep_team_event_attendance_event_idx
  ON public.rep_team_event_attendance(event_id);

CREATE INDEX IF NOT EXISTS rep_team_event_attendance_player_idx
  ON public.rep_team_event_attendance(player_id, event_id);

CREATE INDEX IF NOT EXISTS rep_team_event_attendance_team_idx
  ON public.rep_team_event_attendance(team_id, program_year_id);

ALTER TABLE public.rep_team_event_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read rep_team_event_attendance"
  ON public.rep_team_event_attendance FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read assigned team attendance"
  ON public.rep_team_event_attendance FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.sync_rep_team_event_attendance_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rep_team_event_attendance
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

DROP TRIGGER IF EXISTS rep_team_event_attendance_scope_sync
  ON public.rep_team_events;

CREATE TRIGGER rep_team_event_attendance_scope_sync
AFTER UPDATE OF org_id, team_id, program_year_id
ON public.rep_team_events
FOR EACH ROW
EXECUTE FUNCTION public.sync_rep_team_event_attendance_scope();

UPDATE public.rep_team_event_attendance attendance
SET
  org_id = event.org_id,
  team_id = event.team_id,
  program_year_id = event.program_year_id
FROM public.rep_team_events event
WHERE attendance.event_id = event.id
  AND (
    attendance.org_id IS DISTINCT FROM event.org_id
    OR attendance.team_id IS DISTINCT FROM event.team_id
    OR attendance.program_year_id IS DISTINCT FROM event.program_year_id
  );
