-- 231_coach_money_import_events.sql
-- Coach page-level actions, Phase 1 — "Recent imports" at the foot of the Money hub's
-- Import ▾ menu (COACH_HEADER_ACTIONS_CONSISTENCY_PLAN.md §4.1, owner ruling 2026-08-13).
--
-- The ruling declined a coach Data Tools DESTINATION but kept its useful half: a coach must be
-- able to see WHAT was brought in, WHEN, and BY WHOM without a page of its own. Nothing recorded
-- that until now — the budget/payables importer wrote its rows and forgot the act — so the menu
-- item had no data source and this table is what gives it one.
--
-- ⚠ THIS IS A RECEIPT, NOT A STAGING TABLE. The tournament admin's import_batches/_batch_rows
-- pair stores an uncommitted preview that a second request applies; the coach importer previews
-- IN THE BROWSER and commits in one shot, so there is nothing to stage. One row is written AFTER
-- the commit loop, describing what actually landed. It is never read back into a write path.
--
-- ⚠ APPEND-ONLY at the app layer: no UPDATE route and no update helper. A receipt that can be
-- edited is not a receipt.
--
-- ⚠ BEST-EFFORT: the write is wrapped so a failure here can never fail an import that already
-- succeeded. Losing a history line is a footnote; losing forty budget lines is not.
--
-- ⚠ Coach-API-only (service role). RLS is ENABLED with no policies so prod's default anon SELECT
-- grant cannot reach it (memory: reference_supabase_rls_grants) — same treatment as migs 225/228.
--
-- program_year_id is stored rather than derived, so an archived season can answer "what was
-- imported that year" without walking anything, and so the menu's list is season-scoped by the
-- same key every other Money read uses.

CREATE TABLE IF NOT EXISTS rep_team_import_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  org_id uuid NOT NULL,
  program_year_id uuid NOT NULL,
  -- WHICH dataset was brought in, in the menu's own vocabulary — the Import ▾ rows are
  -- "Budget lines" and "Expenses & payables", so the history reads back in the same words.
  dataset text NOT NULL,
  -- The sheet SHAPE the coach chose ('month-grid' | 'list' | 'payables'). Kept because "a month
  -- grid" and "a simple list" produce very different budgets from the same dataset name.
  shape text NOT NULL,
  -- How it arrived. 'paste' is the phone path the phone-header rule 11 relies on surviving.
  source text NOT NULL,
  source_filename text,
  rows_created integer NOT NULL DEFAULT 0,
  rows_updated integer NOT NULL DEFAULT 0,
  rows_skipped integer NOT NULL DEFAULT 0,
  rows_failed integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rep_team_import_events_dataset_check CHECK (dataset IN ('budget_lines', 'payables')),
  CONSTRAINT rep_team_import_events_shape_check CHECK (shape IN ('month-grid', 'list', 'payables')),
  CONSTRAINT rep_team_import_events_source_check CHECK (source IN ('paste', 'file')),
  CONSTRAINT fk_rep_team_import_events_team FOREIGN KEY (team_id) REFERENCES rep_teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_rep_team_import_events_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_rep_team_import_events_year FOREIGN KEY (program_year_id) REFERENCES rep_program_years(id) ON DELETE CASCADE,
  CONSTRAINT fk_rep_team_import_events_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ONE read exists: the newest N for this team's season, for the menu's list. No other index —
-- an unmatched index on an append-only receipt is pure write cost.
CREATE INDEX IF NOT EXISTS idx_rep_team_import_events_season
  ON rep_team_import_events(team_id, program_year_id, created_at DESC);

COMMENT ON TABLE rep_team_import_events IS
  'Receipt for a COMMITTED coach money import (budget lines / payables). Feeds "Recent imports" '
  'in the Money hub Import menu. Append-only, written best-effort after the commit loop, never '
  'read into a write path. Distinct from import_batches, which stages an uncommitted preview.';

ALTER TABLE rep_team_import_events ENABLE ROW LEVEL SECURITY;
