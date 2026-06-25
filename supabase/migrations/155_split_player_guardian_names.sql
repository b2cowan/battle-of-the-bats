-- 155: split player + guardian names into first/last (free Basic roster) + relax Premium last name.
--
-- The free Basic roster stored a player and their guardian as a SINGLE free-text name; the Premium
-- roster stores split first/last. Upgrading therefore had to GUESS the split and surface an
-- "uncertain name" review item. This collects first + last at the source so names map 1:1.
--
-- Strategy (data is negligible — coach product unlaunched): ADD first/last columns and backfill from
-- the existing single name (last whitespace token = surname; a 1-token name keeps last = NULL).
-- KEEP `name` / `guardian_name` populated (composed from first+last on every write by the app) so the
-- tournament-roster snapshot and other read sites keep working untouched. New entry + the upgrade
-- migration use first/last as the source of truth. First name required (app-layer); last name OPTIONAL
-- so mononyms work. Premium `player_last_name` is relaxed to nullable to accept those 1:1.

alter table public.basic_coach_team_players
  add column if not exists first_name          text,
  add column if not exists last_name           text,
  add column if not exists guardian_first_name text,
  add column if not exists guardian_last_name  text;

-- Backfill player names: first = everything before the last token; last = the last token (or NULL).
update public.basic_coach_team_players
set first_name = coalesce(nullif(regexp_replace(trim(name), '\s+\S+$', ''), ''), trim(name)),
    last_name  = case when trim(name) ~ '\s' then regexp_replace(trim(name), '^.*\s+(\S+)$', '\1') else null end
where first_name is null and name is not null and trim(name) <> '';

-- Backfill guardian names the same way (guardian_name is nullable/optional).
update public.basic_coach_team_players
set guardian_first_name = coalesce(nullif(regexp_replace(trim(guardian_name), '\s+\S+$', ''), ''), trim(guardian_name)),
    guardian_last_name  = case when trim(guardian_name) ~ '\s' then regexp_replace(trim(guardian_name), '^.*\s+(\S+)$', '\1') else null end
where guardian_first_name is null and guardian_name is not null and trim(guardian_name) <> '';

-- Premium: last name optional so a free mononym carries over 1:1 (first name stays required).
alter table public.rep_roster_players
  alter column player_last_name drop not null;
