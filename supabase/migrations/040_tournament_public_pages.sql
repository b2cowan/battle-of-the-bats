alter table tournaments
  add column if not exists public_hidden_pages jsonb not null default '[]'::jsonb;

comment on column tournaments.public_hidden_pages is
  'Array of public tournament page keys hidden from nav/direct public access, e.g. ["standings","rules"].';
