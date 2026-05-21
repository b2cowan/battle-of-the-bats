-- Migration 061: post-event tournament notification settings
-- Adds opt-in and idempotency fields for Tournament Plus results notifications.

alter table public.tournaments
  add column if not exists notify_teams_on_complete boolean not null default false,
  add column if not exists results_notified_at timestamptz,
  add column if not exists results_notification_sent_count integer not null default 0;

create index if not exists idx_tournaments_results_notified_at
  on public.tournaments(results_notified_at desc)
  where results_notified_at is not null;

comment on column public.tournaments.notify_teams_on_complete is
  'When true, accepted team contacts receive the public results link when the tournament is marked completed.';

comment on column public.tournaments.results_notified_at is
  'Timestamp when post-event results notification was sent for this tournament.';

comment on column public.tournaments.results_notification_sent_count is
  'Number of accepted team contact emails sent by the post-event results notification.';
