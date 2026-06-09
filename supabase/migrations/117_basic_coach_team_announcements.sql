-- migration 117: basic coach team announcements (free coach floor)
-- phase 4c of the free tier + coaches project. Coach-authored, one-way email
-- announcements to roster contact_email values only. No parent accounts, chat,
-- replies inbox, SMS/push, payment reminders, or dues automation.

create table if not exists public.basic_coach_team_announcements (
  id uuid primary key default gen_random_uuid(),
  basic_coach_team_id uuid not null references public.basic_coach_teams(id) on delete cascade,
  subject text not null,
  body text not null,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  status text not null default 'sent',
  sent_at timestamptz not null default now(),
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint basic_coach_team_announcements_subject_check
    check (char_length(btrim(subject)) > 0 and char_length(subject) <= 160),
  constraint basic_coach_team_announcements_body_check
    check (char_length(btrim(body)) > 0 and char_length(body) <= 4000),
  constraint basic_coach_team_announcements_counts_check
    check (
      recipient_count >= 0
      and sent_count >= 0
      and failed_count >= 0
      and sent_count + failed_count <= recipient_count
    ),
  constraint basic_coach_team_announcements_status_check
    check (status in ('sent', 'partial', 'failed'))
);

create index if not exists basic_coach_team_announcements_team_idx
  on public.basic_coach_team_announcements(basic_coach_team_id, sent_at desc, created_at desc);

alter table public.basic_coach_team_announcements enable row level security;

alter table public.basic_coach_team_announcements
  drop constraint if exists basic_coach_team_announcements_status_counts_check;
alter table public.basic_coach_team_announcements
  add constraint basic_coach_team_announcements_status_counts_check
  check (
    (status = 'sent' and failed_count = 0)
    or (status = 'partial' and sent_count > 0 and failed_count > 0)
    or (status = 'failed' and sent_count = 0 and failed_count > 0)
  );

comment on table public.basic_coach_team_announcements is
  'One-way email announcement log for org-less basic_coach_teams (free coach floor, Phase 4c). Coach-authored subject/body sent to deduped roster contact_email values only. NOT parent accounts, chat, replies inbox, SMS/push, payment reminders, or dues automation. RLS enabled with no policies = service-role-only; ownership enforced in app code via basic_coach_team_users. Keyed on basic_coach_team_id; org-less by design.';
comment on column public.basic_coach_team_announcements.basic_coach_team_id is
  'Owning org-less Basic coach team. Cascades on team delete.';
comment on column public.basic_coach_team_announcements.subject is
  'Coach-authored email subject. Plain text; server trims and caps length.';
comment on column public.basic_coach_team_announcements.body is
  'Coach-authored announcement body. Stored as plain text and HTML-escaped before email send.';
comment on column public.basic_coach_team_announcements.recipient_count is
  'Number of deduped valid roster contact_email recipients targeted at send time. Recipient email addresses are not stored in this log.';
comment on column public.basic_coach_team_announcements.sent_count is
  'Number of recipient sends accepted by the email provider. Missing API key, provider rejection, and thrown errors are counted as failed.';
comment on column public.basic_coach_team_announcements.failed_count is
  'Number of recipient sends that were skipped or rejected by the email helper/provider, or that threw an error. Detailed per-recipient failure state is intentionally not stored in this Basic log.';
comment on column public.basic_coach_team_announcements.status is
  'sent | partial | failed, derived from sent_count and failed_count after the send loop.';
comment on column public.basic_coach_team_announcements.sent_at is
  'Timestamp when the one-way announcement send loop completed. Display/sort key for the recent announcements log.';
comment on column public.basic_coach_team_announcements.created_by_user_id is
  'Bare uuid snapshot of the coach user who initiated the send. No FK so deleted/auth-migrated users do not break the log.';
