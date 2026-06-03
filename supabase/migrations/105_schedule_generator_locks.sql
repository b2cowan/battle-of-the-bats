alter table public.games
  add column if not exists generator_locked boolean not null default false;

comment on column public.games.generator_locked is
  'When true, automated schedule generation treats this game as fixed during build-from-current regeneration.';

create index if not exists idx_games_generator_locked
  on public.games (tournament_id, division_id, generator_locked)
  where generator_locked = true;
