-- pool_slots: named team placeholders within a pool, assignable to real teams after registration
create table if not exists pool_slots (
  id             uuid        primary key default gen_random_uuid(),
  pool_id        uuid        not null references pools(id) on delete cascade,
  tournament_id  uuid        not null references tournaments(id) on delete cascade,
  age_group_id   uuid        not null references age_groups(id) on delete cascade,
  slot_number    int         not null,
  display_name   text        not null,
  team_id        uuid        references teams(id) on delete set null,
  created_at     timestamptz default now(),
  unique(pool_id, slot_number)
);

create index if not exists idx_pool_slots_pool_id       on pool_slots(pool_id);
create index if not exists idx_pool_slots_tournament_id on pool_slots(tournament_id);
create index if not exists idx_pool_slots_team_id       on pool_slots(team_id);

-- link games back to their slots so assignment cascades can target them precisely
alter table games
  add column if not exists home_slot_id uuid references pool_slots(id) on delete set null,
  add column if not exists away_slot_id uuid references pool_slots(id) on delete set null;

create index if not exists idx_games_home_slot_id on games(home_slot_id);
create index if not exists idx_games_away_slot_id on games(away_slot_id);
