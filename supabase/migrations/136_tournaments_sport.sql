-- Migration 136: record the sport on every tournament (multi-sport foundation — Phase 1).
-- Until now tournaments implicitly assumed softball — the ONLY event entity without a sport,
-- while league_seasons and rep_teams already carry one (both NOT NULL DEFAULT 'softball').
-- This adds the matching anchor so the per-sport "Sport Pack" (lib/sports.ts) has a value to
-- read in later phases (score vocabulary, default tie-breakers, points-per-win, diff-cap
-- applicability, default surface, countdown verb).
--
-- Free-text (NOT an enum/CHECK) to mirror league_seasons.sport / rep_teams.sport and avoid the
-- dev↔prod CHECK drift that bites the `status` column; the app normalizes via
-- getSportPack / normalizeSportId (which fall back to 'softball').
--
-- Additive / non-destructive. DEFAULT 'softball' so every existing tournament is unchanged and
-- new tournaments stay softball with no create-path change. Phase 1 records the value only —
-- the creation picker, Event Settings field, and sport-aware labels ship in later phases.

alter table public.tournaments
  add column if not exists sport text not null default 'softball';
