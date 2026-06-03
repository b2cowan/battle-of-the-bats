-- Migration 107 — Fan push subscriptions (anonymous score alerts)
--
-- Parallel to push_subscriptions (101), but for ANONYMOUS public fans. Fans have
-- no auth.users account — they "follow" a team in localStorage. A subscription
-- here ties a browser push endpoint to a (tournament, team) pair so a posted
-- score can fan out to everyone following either team in that game.
--
-- One row per device per tournament (the team they currently follow there);
-- re-following a different team upserts on (endpoint, tournament_id).

CREATE TABLE IF NOT EXISTS fan_push_subscriptions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint      text        NOT NULL,
  keys_p256dh   text        NOT NULL,
  keys_auth     text        NOT NULL,
  tournament_id uuid        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id       uuid        NOT NULL REFERENCES teams(id)       ON DELETE CASCADE,
  device_label  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  UNIQUE (endpoint, tournament_id)
);

-- Fan-out lookup: "who follows either team in this game?"
CREATE INDEX IF NOT EXISTS fan_push_subscriptions_tournament_team_idx
  ON fan_push_subscriptions(tournament_id, team_id);

-- Endpoint cleanup on 410 / unsubscribe.
CREATE INDEX IF NOT EXISTS fan_push_subscriptions_endpoint_idx
  ON fan_push_subscriptions(endpoint);

-- Service-role only. The anonymous subscribe/unsubscribe API routes use
-- supabaseAdmin (service role, bypasses RLS); the anon key never touches this
-- table. RLS is enabled with no policies = deny-all to the anon/auth clients.
ALTER TABLE fan_push_subscriptions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON fan_push_subscriptions TO service_role;
