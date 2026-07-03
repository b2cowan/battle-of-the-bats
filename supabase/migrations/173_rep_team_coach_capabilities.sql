-- Per-assistant capability grants for rep-team coaching staff (Assistant Coaches, Phase 1).
-- (Renumbered from a duplicate 170 — concurrent tryout work also used 170.)
-- Additive + nullable jsonb. NULL = the assistant least-privilege defaults (resolved in app code
-- via lib/coach-capabilities.ts). Head coaches ALWAYS get full access and IGNORE this column.
-- Shape is app-enforced (AssistantCapabilityGrants); no CHECK — mirrors the loose-jsonb pattern
-- used elsewhere on rep_* tables. The head/assistant distinction lives in coach_role; this column
-- only ever refines what an assistant_coach may do, and is set by the head coach in Phase 2.
ALTER TABLE rep_team_coaches
  ADD COLUMN IF NOT EXISTS capabilities jsonb;
