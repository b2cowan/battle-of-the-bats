-- 307 — Arrival as a lead time, and a place the team keeps
-- (owner rulings D1–D9 on the Arrival & Places hub, 2026-09-21 — plan:
--  docs/projects/active/COACH_ARRIVAL_AND_PLACES_PLAN.md)
--
-- Two asks from the first look at the rebuilt Add Event form: "default arrival to an hour before the
-- game, not the time I open the picker" and "a saved location has no address link unless I type it
-- every time". Counted before writing (read-only, 2026-09-21): dev 170 located events across 32
-- distinct places, prod 124 across 16 — and NOT ONE event on either database carries an address.
-- The Recent chips only ever refilled the address of the most recent event with that name, which
-- was always blank, which is the whole case for a book.
--
-- Four parts, all additive:
--   1. rep_team_places — a per-team book: name, address, the usual field/diamond, a note. Shaped
--      like rep_team_tags (mig 181): team_id NOT NULL (a team's places cross its seasons — the
--      archive ruling), one name per team case-insensitively, the tag book's RLS. Every route runs
--      service-role and gates on canManageSchedule; the policies are the closed direct door.
--   2. rep_team_events.place_id — a LINK, with the event's own location / location_address /
--      field_number kept as its copy (D6): nothing already recorded changes when a place is edited
--      (the route OFFERS to update upcoming events), and removing a place leaves the text alone
--      (ON DELETE SET NULL). A mirrored game's venue is the organizer's, never a place.
--   3. rep_teams.arrival_before_game_min / arrival_before_practice_min — the team's habit (D2), in
--      minutes, from the same list the form's dropdown offers. NULL = the team asks nothing. Team-
--      scoped, not season-scoped: a habit, not a fact about a year. ⚠ Not a coach_settings key: the
--      jsonb bags are read-modify-write of one shared blob; two columns are two columns.
--   4. THE SEED (data-only, idempotent, D7): every team's distinct location becomes a place — the
--      spelling on its most recent event, the most recent non-empty address (none today), the most
--      common non-empty field — and every event whose location matches is linked. Mirrored games
--      are excluded from both halves. ⚠ INVISIBLE to check:migrations (a data step) — registered
--      in MANUAL_PROD_STEPS.json. ORDER: apply to prod BEFORE promoting the code that reads
--      rep_team_places (the migration-040 lesson); independent of 306.

-- ════════════════════════════════════════════════════════════════════
-- 1. rep_team_places
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rep_team_places (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id      uuid        NOT NULL REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  name         text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  address      text        CHECK (address IS NULL OR char_length(address) <= 200),
  field_number text        CHECK (field_number IS NULL OR char_length(field_number) <= 40),
  note         text        CHECK (note IS NULL OR char_length(note) <= 160),
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- One name per team, case-insensitive — the picker finds by name, so "Sherwood Park" and
-- "sherwood park" cannot both exist.
CREATE UNIQUE INDEX IF NOT EXISTS rep_team_places_name_uniq
  ON public.rep_team_places(team_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS rep_team_places_team_idx
  ON public.rep_team_places(team_id);

CREATE INDEX IF NOT EXISTS rep_team_places_org_idx
  ON public.rep_team_places(org_id);

ALTER TABLE public.rep_team_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read rep_team_places"
  ON public.rep_team_places FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read assigned team places"
  ON public.rep_team_places FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can insert rep_team_places"
  ON public.rep_team_places FOR INSERT
  WITH CHECK (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can update rep_team_places"
  ON public.rep_team_places FOR UPDATE
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ))
  WITH CHECK (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can delete rep_team_places"
  ON public.rep_team_places FOR DELETE
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "org admins can insert rep_team_places"
  ON public.rep_team_places FOR INSERT
  WITH CHECK (org_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "org admins can update rep_team_places"
  ON public.rep_team_places FOR UPDATE
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (org_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "org admins can delete rep_team_places"
  ON public.rep_team_places FOR DELETE
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ════════════════════════════════════════════════════════════════════
-- 2. rep_team_events.place_id — the link; the text columns stay the copy
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.rep_team_events
  ADD COLUMN IF NOT EXISTS place_id uuid REFERENCES public.rep_team_places(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rep_team_events_place_idx
  ON public.rep_team_events(place_id)
  WHERE place_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════
-- 3. rep_teams — the team's arrival habit, in minutes
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.rep_teams
  ADD COLUMN IF NOT EXISTS arrival_before_game_min     integer,
  ADD COLUMN IF NOT EXISTS arrival_before_practice_min integer;

-- The same seven answers the form's dropdown offers; anything else is "A specific time", which is
-- a fact about one event, never a team default.
ALTER TABLE public.rep_teams
  DROP CONSTRAINT IF EXISTS rep_teams_arrival_before_game_min_check,
  ADD CONSTRAINT rep_teams_arrival_before_game_min_check
    CHECK (arrival_before_game_min IS NULL OR arrival_before_game_min IN (15, 30, 45, 60, 90, 120)),
  DROP CONSTRAINT IF EXISTS rep_teams_arrival_before_practice_min_check,
  ADD CONSTRAINT rep_teams_arrival_before_practice_min_check
    CHECK (arrival_before_practice_min IS NULL OR arrival_before_practice_min IN (15, 30, 45, 60, 90, 120));

-- ════════════════════════════════════════════════════════════════════
-- 4. THE SEED — every team's history becomes its book (idempotent: ON CONFLICT on the name index;
--    the link UPDATE only touches events still unlinked)
-- ════════════════════════════════════════════════════════════════════

WITH located AS (
  SELECT
    e.team_id,
    e.org_id,
    lower(btrim(e.location))                                              AS key,
    btrim(e.location)                                                     AS name,
    NULLIF(btrim(COALESCE(e.location_address, '')), '')                   AS address,
    NULLIF(btrim(COALESCE(e.field_number, '')), '')                       AS field_number,
    e.starts_at
  FROM public.rep_team_events e
  WHERE e.location IS NOT NULL
    AND btrim(e.location) <> ''
    AND e.source_tournament_game_id IS NULL          -- the organizer's venue is not the team's place
),
latest_name AS (                                     -- the spelling on the most recent event
  SELECT DISTINCT ON (team_id, key) team_id, org_id, key, name
  FROM located ORDER BY team_id, key, starts_at DESC NULLS LAST
),
latest_address AS (                                  -- the most recent NON-EMPTY address (none today)
  SELECT DISTINCT ON (team_id, key) team_id, key, address
  FROM located WHERE address IS NOT NULL ORDER BY team_id, key, starts_at DESC NULLS LAST
),
field_mode AS (                                      -- the most common NON-EMPTY field / diamond
  SELECT DISTINCT ON (team_id, key) team_id, key, field_number
  FROM (
    SELECT team_id, key, field_number, count(*) AS n
    FROM located WHERE field_number IS NOT NULL
    GROUP BY team_id, key, field_number
  ) f
  ORDER BY team_id, key, n DESC, field_number
)
INSERT INTO public.rep_team_places (org_id, team_id, name, address, field_number)
SELECT n.org_id, n.team_id, n.name, a.address, f.field_number
FROM latest_name n
LEFT JOIN latest_address a ON a.team_id = n.team_id AND a.key = n.key
LEFT JOIN field_mode    f ON f.team_id = n.team_id AND f.key = n.key
ON CONFLICT (team_id, lower(btrim(name))) DO NOTHING;

UPDATE public.rep_team_events e
SET place_id = p.id
FROM public.rep_team_places p
WHERE e.place_id IS NULL
  AND e.team_id = p.team_id
  AND e.location IS NOT NULL
  AND lower(btrim(e.location)) = lower(btrim(p.name))
  AND e.source_tournament_game_id IS NULL;

-- ── Verify (run after applying, on either database) ──────────────────────────
-- SELECT count(*) AS places FROM rep_team_places;                       -- dev ≈ 32, prod ≈ 16
-- SELECT count(*) AS linked FROM rep_team_events WHERE place_id IS NOT NULL;
--   -- dev ≈ 170, prod ≈ 118 (124 located minus the 6 mirrored)
-- SELECT count(*) AS unlinked_but_located FROM rep_team_events
--   WHERE place_id IS NULL AND location IS NOT NULL AND btrim(location) <> ''
--     AND source_tournament_game_id IS NULL;                             -- expect 0
