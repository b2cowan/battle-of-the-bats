-- Platform (FieldLogicHQ company) users
-- Accessed exclusively via the service-role key; RLS blocks all direct client access.

create table if not exists platform_users (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  display_name text,
  role         text not null default 'admin',
  is_active    boolean not null default true,
  invited_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table platform_users enable row level security;

-- No client-side policies — all access is via the supabaseAdmin (service role) client only.
