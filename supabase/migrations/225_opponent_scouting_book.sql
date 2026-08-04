-- 225_opponent_scouting_book.sql
-- Opponent Scouting Book P1 (docs/projects/active/COACH_OPPONENT_SCOUTING_BOOK_PLAN.md,
-- owner-approved 2026-08-04). An OVERLAY keyed on normalized opponent names:
-- rep_team_events is never written by this feature, and there is deliberately NO FK from
-- events to opponents — identity is resolved at read time (normalizer + aliases).
-- All three tables are coach-API-only (service role); RLS enabled with no policies so the
-- default anon SELECT grant cannot reach them (reference_supabase_rls_grants).

-- The book: one row per (team, normalized opponent name), minted lazily on first write.
CREATE TABLE IF NOT EXISTS rep_team_opponents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  org_id uuid NOT NULL,
  display_name text NOT NULL,
  normalized_name text NOT NULL,
  summary text,
  last_note_updated_at timestamptz,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_rep_team_opponents_team FOREIGN KEY (team_id) REFERENCES rep_teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_rep_team_opponents_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_rep_team_opponents_updated_by FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT rep_team_opponents_team_name_uq UNIQUE (team_id, normalized_name)
);
CREATE INDEX IF NOT EXISTS idx_rep_team_opponents_org ON rep_team_opponents(org_id);
CREATE INDEX IF NOT EXISTS idx_rep_team_opponents_team ON rep_team_opponents(team_id);
ALTER TABLE rep_team_opponents ENABLE ROW LEVEL SECURITY;

-- Spelling-drift merges (P2 UI; table lands now so P1 reads can honor aliases from day one).
-- An alias resolves to exactly one opponent per team.
CREATE TABLE IF NOT EXISTS rep_team_opponent_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opponent_id uuid NOT NULL,
  team_id uuid NOT NULL,
  org_id uuid NOT NULL,
  normalized_alias text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_rep_team_opponent_aliases_opponent FOREIGN KEY (opponent_id) REFERENCES rep_team_opponents(id) ON DELETE CASCADE,
  CONSTRAINT fk_rep_team_opponent_aliases_team FOREIGN KEY (team_id) REFERENCES rep_teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_rep_team_opponent_aliases_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT rep_team_opponent_aliases_team_alias_uq UNIQUE (team_id, normalized_alias)
);
CREATE INDEX IF NOT EXISTS idx_rep_team_opponent_aliases_org ON rep_team_opponent_aliases(org_id);
CREATE INDEX IF NOT EXISTS idx_rep_team_opponent_aliases_opponent ON rep_team_opponent_aliases(opponent_id);
ALTER TABLE rep_team_opponent_aliases ENABLE ROW LEVEL SECURITY;

-- The capture log: dated per-game entries, open to all schedule-holders (attributed),
-- head coach curates. Append-only in spirit: no UPDATE path at the app layer; DELETE is
-- head-coach-any / author-own (mistake removal), the game-moments convention.
CREATE TABLE IF NOT EXISTS rep_team_opponent_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opponent_id uuid NOT NULL,
  team_id uuid NOT NULL,
  org_id uuid NOT NULL,
  event_id uuid,
  body text NOT NULL,
  tag text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_rep_team_opponent_obs_opponent FOREIGN KEY (opponent_id) REFERENCES rep_team_opponents(id) ON DELETE CASCADE,
  CONSTRAINT fk_rep_team_opponent_obs_team FOREIGN KEY (team_id) REFERENCES rep_teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_rep_team_opponent_obs_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_rep_team_opponent_obs_event FOREIGN KEY (event_id) REFERENCES rep_team_events(id) ON DELETE SET NULL,
  CONSTRAINT fk_rep_team_opponent_obs_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_rep_team_opponent_obs_team ON rep_team_opponent_observations(team_id);
CREATE INDEX IF NOT EXISTS idx_rep_team_opponent_obs_opponent ON rep_team_opponent_observations(opponent_id);
CREATE INDEX IF NOT EXISTS idx_rep_team_opponent_obs_event ON rep_team_opponent_observations(event_id);
ALTER TABLE rep_team_opponent_observations ENABLE ROW LEVEL SECURITY;
