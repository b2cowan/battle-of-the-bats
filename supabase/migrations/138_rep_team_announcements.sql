-- 138: Premium Coaches Portal team announcements (Premium >= Free parity).
--
-- The free Basic portal has one-way email announcements (basic_coach_team_announcements, mig 117)
-- but Premium had NONE — upgrading silently dropped the capability. This mirrors that feature on
-- the org-scoped, season-spined Premium model so a Premium coach can email their roster and keep a
-- send log. Recipient addresses are NOT stored (counts only), same minimization as the Basic table.
--
-- Org-scoped + program-year-scoped per the rep_* convention. RLS ENABLED with NO policies
-- (service-role only via supabaseAdmin — the coaches API access pattern; same posture as
-- basic_coach_team_announcements). Abuse caps (10 sends / 24h, 100 recipients) are app-enforced,
-- matching the Basic floor. Additive / non-destructive; reversible (drop the table).

create table if not exists public.rep_team_announcements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.rep_teams(id) on delete cascade,
  program_year_id uuid not null references public.rep_program_years(id) on delete cascade,
  subject text not null check (char_length(btrim(subject)) >= 1 and char_length(subject) <= 160),
  body text not null check (char_length(btrim(body)) >= 1 and char_length(body) <= 4000),
  recipient_count int not null default 0 check (recipient_count >= 0),
  sent_count int not null default 0 check (sent_count >= 0),
  failed_count int not null default 0 check (failed_count >= 0),
  status text not null default 'sent' check (status in ('sent', 'partial', 'failed')),
  sent_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rep_team_announcements_counts_check check (sent_count + failed_count <= recipient_count)
);

create index if not exists rep_team_announcements_year_idx
  on public.rep_team_announcements (program_year_id, sent_at desc);

alter table public.rep_team_announcements enable row level security;
