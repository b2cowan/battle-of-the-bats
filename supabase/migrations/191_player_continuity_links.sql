-- Migration 191: Player Development slice 3C — returning-player continuity links.
--
-- Coach-confirmed identity links between a CURRENT entity (roster row OR tryout
-- registration — the Decision-Board verify moment precedes any roster row) and a PRIOR
-- season's entity (roster row OR registration — a kid who tried out but never made the
-- team exists only as a registration), same team. Design ratified as DBA Finding #31:
--   • dual-nullable REAL FKs per side + CHECK exactly-one-per-side (no polymorphic pairs —
--     identity records about minors must be FK-guaranteed; mig-190 direction)
--   • ONE ROW PER (current, prior) PAIR for the whole lifecycle: suggested → confirmed |
--     rejected are status transitions on that row — a rejected row IS the never-re-suggest
--     tombstone, by construction
--   • at most one CONFIRMED link per current entity (one identity per player)
--   • sides are IMMUTABLE — acceptance never rewrites a link; reads resolve through the
--     roster row's tryout_registration_id back-reference
--   • FK-only + confidence + status + decided_by/decided_at — NEVER a copy of guardian PII
--   • ON DELETE CASCADE on all four side-FKs (a link missing either side is meaningless;
--     SET NULL would violate the exactly-one CHECKs)
--   • head-coach-only writes at BOTH layers (D1 posture; migs 189/190 precedent),
--     DROP-guarded → re-runnable
--
-- DEV-ONLY at author time; ⚠ PROD-PENDING — promote with migs 189+190.

-- Composite-FK targets on the two side tables: a link's side must belong to the LINK's OWN
-- team, guaranteed structurally (the mig-190 lesson, caught again by the 3C adversarial
-- review — a single-column FK would let a direct PostgREST write reference ANY roster/
-- registration row on the platform, with cross-tenant CASCADE side effects).
ALTER TABLE public.rep_roster_players
  DROP CONSTRAINT IF EXISTS rep_roster_players_id_team_uniq;
ALTER TABLE public.rep_roster_players
  ADD CONSTRAINT rep_roster_players_id_team_uniq UNIQUE (id, team_id);
ALTER TABLE public.rep_tryout_registrations
  DROP CONSTRAINT IF EXISTS rep_tryout_registrations_id_team_uniq;
ALTER TABLE public.rep_tryout_registrations
  ADD CONSTRAINT rep_tryout_registrations_id_team_uniq UNIQUE (id, team_id);

CREATE TABLE IF NOT EXISTS public.rep_player_continuity_links (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id                  uuid        NOT NULL REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  current_roster_id        uuid,
  current_registration_id  uuid,
  prior_roster_id          uuid,
  prior_registration_id    uuid,
  status                   text        NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'confirmed', 'rejected')),
  confidence               text        NOT NULL CHECK (confidence IN ('high', 'possible')),
  decided_by               uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at               timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rep_player_continuity_links_one_current CHECK (
    (current_roster_id IS NOT NULL)::int + (current_registration_id IS NOT NULL)::int = 1
  ),
  CONSTRAINT rep_player_continuity_links_one_prior CHECK (
    (prior_roster_id IS NOT NULL)::int + (prior_registration_id IS NOT NULL)::int = 1
  )
);

-- Composite side-FKs (added separately + DROP-guarded so the file stays re-runnable and
-- upgrades an existing dev table in place). MATCH SIMPLE skips NULL sides; CASCADE deletes
-- the LINK ROW when a side row goes (a link missing either side is meaningless).
ALTER TABLE public.rep_player_continuity_links
  DROP CONSTRAINT IF EXISTS rep_player_continuity_links_current_roster_id_fkey,
  DROP CONSTRAINT IF EXISTS rep_player_continuity_links_current_registration_id_fkey,
  DROP CONSTRAINT IF EXISTS rep_player_continuity_links_prior_roster_id_fkey,
  DROP CONSTRAINT IF EXISTS rep_player_continuity_links_prior_registration_id_fkey,
  DROP CONSTRAINT IF EXISTS rep_player_continuity_links_current_roster_team_fkey,
  DROP CONSTRAINT IF EXISTS rep_player_continuity_links_current_registration_team_fkey,
  DROP CONSTRAINT IF EXISTS rep_player_continuity_links_prior_roster_team_fkey,
  DROP CONSTRAINT IF EXISTS rep_player_continuity_links_prior_registration_team_fkey;
ALTER TABLE public.rep_player_continuity_links
  ADD CONSTRAINT rep_player_continuity_links_current_roster_team_fkey
    FOREIGN KEY (current_roster_id, team_id) REFERENCES public.rep_roster_players(id, team_id) ON DELETE CASCADE,
  ADD CONSTRAINT rep_player_continuity_links_current_registration_team_fkey
    FOREIGN KEY (current_registration_id, team_id) REFERENCES public.rep_tryout_registrations(id, team_id) ON DELETE CASCADE,
  ADD CONSTRAINT rep_player_continuity_links_prior_roster_team_fkey
    FOREIGN KEY (prior_roster_id, team_id) REFERENCES public.rep_roster_players(id, team_id) ON DELETE CASCADE,
  ADD CONSTRAINT rep_player_continuity_links_prior_registration_team_fkey
    FOREIGN KEY (prior_registration_id, team_id) REFERENCES public.rep_tryout_registrations(id, team_id) ON DELETE CASCADE;

-- One lifecycle row per (current, prior) pair — uuids are globally unique, so coalescing
-- across the two source tables is collision-safe.
CREATE UNIQUE INDEX IF NOT EXISTS rep_player_continuity_links_pair_uniq
  ON public.rep_player_continuity_links(
    (coalesce(current_roster_id, current_registration_id)),
    (coalesce(prior_roster_id, prior_registration_id))
  );

-- One identity per player: a single CONFIRMED link per current entity.
CREATE UNIQUE INDEX IF NOT EXISTS rep_player_continuity_links_confirmed_uniq
  ON public.rep_player_continuity_links((coalesce(current_roster_id, current_registration_id)))
  WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS rep_player_continuity_links_prior_idx
  ON public.rep_player_continuity_links((coalesce(prior_roster_id, prior_registration_id)));
CREATE INDEX IF NOT EXISTS rep_player_continuity_links_team_idx
  ON public.rep_player_continuity_links(team_id);
CREATE INDEX IF NOT EXISTS rep_player_continuity_links_org_idx
  ON public.rep_player_continuity_links(org_id);

ALTER TABLE public.rep_player_continuity_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can read rep_player_continuity_links" ON public.rep_player_continuity_links;
CREATE POLICY "org members can read rep_player_continuity_links"
  ON public.rep_player_continuity_links FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "coaches can read assigned team continuity links" ON public.rep_player_continuity_links;
CREATE POLICY "coaches can read assigned team continuity links"
  ON public.rep_player_continuity_links FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "head coaches can insert rep_player_continuity_links" ON public.rep_player_continuity_links;
CREATE POLICY "head coaches can insert rep_player_continuity_links"
  ON public.rep_player_continuity_links FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid() AND coach_role = 'head_coach'
    )
  );

DROP POLICY IF EXISTS "head coaches can update rep_player_continuity_links" ON public.rep_player_continuity_links;
CREATE POLICY "head coaches can update rep_player_continuity_links"
  ON public.rep_player_continuity_links FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid() AND coach_role = 'head_coach'
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid() AND coach_role = 'head_coach'
    )
  );

DROP POLICY IF EXISTS "head coaches can delete rep_player_continuity_links" ON public.rep_player_continuity_links;
CREATE POLICY "head coaches can delete rep_player_continuity_links"
  ON public.rep_player_continuity_links FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM public.rep_team_coaches
      WHERE user_id = auth.uid() AND coach_role = 'head_coach'
    )
  );
