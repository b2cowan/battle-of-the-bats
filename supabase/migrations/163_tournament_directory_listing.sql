-- Migration 163: opt-in PUBLIC DISCOVERY DIRECTORY listing (per tournament).
-- (Renumbered from 158 → 163 to resolve a duplicate 158 with the rep-event relative-score migration.)
-- Backs the cross-platform tournament discovery directory (/discover). Listing is
-- OPT-IN per tournament and DEFAULT OFF — we never surface a tournament an organizer
-- didn't deliberately choose to list (youth-sport / PIPEDA privacy safeguard). The
-- directory only ever links to pages that are already public, so this flag is ANDed
-- with the existing public-status gate (status IN ('active','completed')) at query
-- time — a flagged-but-draft/archived tournament still never appears.
--
-- list_in_directory → boolean NOT NULL DEFAULT false. The organizer's opt-in choice,
--                     set from Event Settings → Tournament Overview. Default false so
--                     every existing tournament starts UNLISTED (no backfill).
--
-- directory_province → text, nullable. Optional province code (CA two-letter: 'ON',
--                      'AB', …) captured at opt-in time; powers the directory's
--                      location filter. NULL = unset (no region filter match). Value
--                      set is app-enforced via lib/canadian-provinces.ts, NOT a CHECK
--                      constraint (matches the project's allowed-values convention).
--
-- Partial index supports the hot directory query (WHERE list_in_directory = true …)
-- across all tournaments platform-wide without scanning unlisted rows.
--
-- Additive / non-destructive, IF NOT EXISTS, no data change. Apply to dev + prod
-- together (before promoting any directory-reading code).

alter table public.tournaments
  add column if not exists list_in_directory boolean not null default false;

alter table public.tournaments
  add column if not exists directory_province text;

create index if not exists tournaments_list_in_directory_idx
  on public.tournaments (list_in_directory)
  where list_in_directory = true;
