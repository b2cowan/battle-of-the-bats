-- Migration 106: customer import batches
-- Stores safe preview batches for spreadsheet imports before any commit step.

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid,
  actor_email text,
  import_type text not null,
  scope_json jsonb not null default '{}'::jsonb,
  source_filename text,
  status text not null default 'previewed',
  summary_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint import_batches_status_check
    check (status in ('previewed', 'committed', 'failed', 'expired'))
);

create table if not exists public.import_batch_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null,
  operation text not null,
  target_id uuid,
  raw_json jsonb not null default '{}'::jsonb,
  normalized_json jsonb not null default '{}'::jsonb,
  before_json jsonb,
  after_json jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  errors_json jsonb not null default '[]'::jsonb,
  status text not null default 'previewed',
  created_at timestamptz not null default now(),
  constraint import_batch_rows_operation_check
    check (operation in ('create', 'update', 'unchanged', 'blocked')),
  constraint import_batch_rows_status_check
    check (status in ('previewed', 'committed', 'failed', 'skipped'))
);

create index if not exists idx_import_batches_org_time
  on public.import_batches(org_id, created_at desc);

create index if not exists idx_import_batches_actor_time
  on public.import_batches(actor_user_id, created_at desc);

create index if not exists idx_import_batch_rows_batch_row
  on public.import_batch_rows(batch_id, row_number);

alter table public.import_batches enable row level security;
alter table public.import_batch_rows enable row level security;

comment on table public.import_batches is
  'Customer spreadsheet import preview batches. Commit handlers reuse server-normalized row data.';

comment on table public.import_batch_rows is
  'Row-level raw, normalized, before, after, warning, and error details for customer imports.';

