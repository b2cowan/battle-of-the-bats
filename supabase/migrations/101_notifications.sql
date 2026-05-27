-- Migration 101 — Notification system
-- Four tables: notifications, push_subscriptions,
-- notification_preferences, tournament_notification_preferences

-- ── notifications ─────────────────────────────────────────────────────────────
-- One row per in-app bell notification per user.

CREATE TABLE IF NOT EXISTS notifications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  event_type   text        NOT NULL,
  title        text        NOT NULL,
  body         text,
  link         text,         -- relative path, e.g. /slug/admin/tournaments/registrations
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  metadata     jsonb       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_org_idx
  ON notifications(org_id, created_at DESC);

-- RLS: users may only read/update their own notifications.
-- API routes use supabaseAdmin (service role) which bypasses RLS,
-- but the client-side Realtime subscription uses the anon key and requires this.
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications select" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "own notifications update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- ── push_subscriptions ────────────────────────────────────────────────────────
-- One row per browser push subscription (one user may have multiple devices).

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint      text        NOT NULL UNIQUE,
  keys_p256dh   text        NOT NULL,
  keys_auth     text        NOT NULL,
  device_label  text,         -- auto-detected from UA, e.g. "Chrome on iPhone"
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON push_subscriptions(user_id);

-- ── notification_preferences ──────────────────────────────────────────────────
-- Per-user, per-org, per-event-type channel settings (global defaults).
-- If no row exists for a given combination, system defaults apply (see lib/notify.ts).

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id       uuid    NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  org_id        uuid    NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  event_type    text    NOT NULL,
  channel_bell  boolean NOT NULL DEFAULT true,
  channel_push  boolean NOT NULL DEFAULT false,
  channel_email boolean NOT NULL DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id, event_type)
);

-- ── tournament_notification_preferences ───────────────────────────────────────
-- Per-user, per-tournament opt-out override (Layer 2).
-- opted_out = true suppresses all channels for that event in that tournament,
-- regardless of global preferences.

CREATE TABLE IF NOT EXISTS tournament_notification_preferences (
  user_id       uuid    NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  tournament_id uuid    NOT NULL REFERENCES tournaments(id)    ON DELETE CASCADE,
  event_type    text    NOT NULL,
  opted_out     boolean NOT NULL DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tournament_id, event_type)
);

CREATE INDEX IF NOT EXISTS tournament_notif_prefs_tournament_idx
  ON tournament_notification_preferences(tournament_id);

-- ── Service-role grants ───────────────────────────────────────────────────────
GRANT ALL ON notifications                        TO service_role;
GRANT ALL ON push_subscriptions                   TO service_role;
GRANT ALL ON notification_preferences             TO service_role;
GRANT ALL ON tournament_notification_preferences  TO service_role;
