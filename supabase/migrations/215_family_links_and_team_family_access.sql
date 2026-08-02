-- ---------------------------------------------------------------
-- Migration 215 — Chunk D Slice 1: the family link, the team's family access
--                 controls, and a shared rate-limit counter for no-login rails
--
-- The owner's 2026-08-01 rulings, made structural:
--
--   * TWO TIERS. A `guardian` is tied to one player (the accountable adult for money,
--     registration, the season recap). A `follower` is tied to the TEAM and to no
--     child at all (grandparents, aunts — schedule, results, game updates). The
--     CHECK below is what makes "followers are never tied to a player" a property of
--     the database rather than a promise in a code comment: the tier boundary is a
--     security boundary, so it is enforced where it cannot be forgotten.
--
--   * PARENT-INITIATED, COACH-APPROVED. There is no public search for a team or a
--     child. The team family link is the only door, it is revocable, and every
--     request lands in the coach's queue.
--
--   * VISIBILITY IS A SETTING, not a UI state. `rep_teams.schedule_visibility`
--     governs every family/public schedule read server-side. Default `families`.
--
-- THIS MIGRATION CREATES THE FULL TWO-TIER SCHEMA even though Slice 1 wires only the
-- follower path. The guardian tier is blocked on the PIPEDA/CASL counsel review, not
-- on schema — so Slice 2 adds no migration and the CHECK protecting followers exists
-- before anything can violate it.
--
-- Posture: `family_links` is SERVICE-ROLE ONLY — RLS enabled, no policies (mig 212
-- posture). The browser never queries it; every read goes through a server route that
-- resolves the link from the session.
--
-- ⚠ Contains a FUNCTION. `npm run check:migrations` is known to give a FALSE GREEN for
-- function-only changes (see mig 211) — confirm `bump_no_login_rate_limit` exists in
-- prod by querying pg_proc directly at release time, not by trusting the gate.
-- ---------------------------------------------------------------

-- ── The link object ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS family_links (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rep_team_id           uuid NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,

  role                  text NOT NULL CHECK (role IN ('guardian', 'follower')),

  -- Guardian: the season-scoped roster row they are the accountable adult for.
  -- Follower: ALWAYS NULL. Enforced by family_links_role_player_ck below.
  player_id             uuid REFERENCES rep_roster_players(id) ON DELETE CASCADE,

  -- NULL until the family creates/attaches an account. The email is the match key
  -- either way, because registrations are account-less by design.
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_email         text NOT NULL,

  -- Display label only ('Grandpa', 'Aunt'). Never used for authorization.
  relationship          text,

  status                text NOT NULL DEFAULT 'requested'
                          CHECK (status IN ('requested', 'invited', 'pending_approval',
                                            'verified', 'declined', 'revoked')),
  verified_via          text CHECK (verified_via IN ('email_match', 'coach_approved', 'registration_match')),

  -- Guardian requests only: the name the parent typed, matched against the roster by
  -- the COACH at approval time. Never matched automatically, never echoed back to the
  -- requester — the request page shows them nothing from the roster.
  requested_player_name text,

  -- Coach-sent direct invite (the secondary on-ramp, Slice 2). Hash only.
  claim_token_hash      text UNIQUE,
  claim_expires_at      timestamptz,
  invited_by_user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Per-family calendar subscription (1.10). Revocable by resetting the hash.
  calendar_token_hash   text UNIQUE,

  -- Consent evidence (guardian tier; the ledger row is written in the same transaction).
  consent_recorded_at   timestamptz,
  consent_ip            text,

  -- Adoption metrics (1.13) are derived from these stamps rather than a parallel
  -- counter table: requested → approved / declined / revoked, with abandonment being
  -- a `requested` row that never moved. One source of truth, queryable per team or org.
  approved_by_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at           timestamptz,
  declined_at           timestamptz,
  revoked_at            timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- The tier boundary, in the database.
  CONSTRAINT family_links_role_player_ck CHECK (
    (role = 'guardian' AND player_id IS NOT NULL)
    OR (role = 'follower' AND player_id IS NULL)
  )
);

-- One LIVE link per (team, email, role). `declined` and `revoked` are deliberately
-- outside the index: a coach who declines by mistake, or removes someone who later
-- rejoins the family, must be able to let them back in. Re-request spam is handled by
-- the rate limiter below, not by a permanent lockout.
CREATE UNIQUE INDEX IF NOT EXISTS family_links_live_uniq
  ON family_links (rep_team_id, invited_email, role)
  WHERE status NOT IN ('declined', 'revoked');

CREATE INDEX IF NOT EXISTS family_links_team_status_idx ON family_links (rep_team_id, status);
CREATE INDEX IF NOT EXISTS family_links_user_idx        ON family_links (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS family_links_org_idx         ON family_links (org_id);
CREATE INDEX IF NOT EXISTS family_links_email_idx       ON family_links (invited_email);

ALTER TABLE family_links ENABLE ROW LEVEL SECURITY;
-- No policies, deliberately: service-role only.

-- ── Team-scope family access controls ──────────────────────────────────────────
-- These sit on `rep_teams` rather than `rep_program_years` because a FOLLOWER link is
-- team-scoped and persists across seasons (owner ruling #17). A grandparent does not
-- re-apply every year.

ALTER TABLE rep_teams
  ADD COLUMN IF NOT EXISTS family_link_token_hash     text,
  ADD COLUMN IF NOT EXISTS family_link_created_at     timestamptz,
  ADD COLUMN IF NOT EXISTS family_link_created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Team-wide calendar feed. Exists only to be handed out at `public_link`; the route
  -- re-checks visibility on every read, so minting it is not itself an exposure.
  ADD COLUMN IF NOT EXISTS family_calendar_token_hash text,
  ADD COLUMN IF NOT EXISTS schedule_visibility        text NOT NULL DEFAULT 'families';

-- Added separately so re-running is safe and the CHECK name is stable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rep_teams_schedule_visibility_ck'
  ) THEN
    ALTER TABLE rep_teams
      ADD CONSTRAINT rep_teams_schedule_visibility_ck
      CHECK (schedule_visibility IN ('staff', 'families', 'public_link'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS rep_teams_family_link_token_uniq
  ON rep_teams (family_link_token_hash) WHERE family_link_token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS rep_teams_family_calendar_token_uniq
  ON rep_teams (family_calendar_token_hash) WHERE family_calendar_token_hash IS NOT NULL;

-- ── Per-game share (ruling #16: sharing one game is always its own deliberate act) ──
-- Decision #15 kept the game URL PLAIN PUBLIC rather than tokenized — it shows what the
-- scoreboard at the field shows. What makes it safe is not obscurity but the fact that
-- the page does not EXIST until the coach shares that specific game, and stops existing
-- if they set visibility back to Staff only.

ALTER TABLE rep_team_events
  ADD COLUMN IF NOT EXISTS family_shared_at timestamptz,
  ADD COLUMN IF NOT EXISTS family_shared_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rep_team_events_family_shared_idx
  ON rep_team_events (team_id) WHERE family_shared_at IS NOT NULL;

-- ── Following a REP team (1.7) ─────────────────────────────────────────────────
-- CORRECTION to the build handoff, which stated a verified follower's team could be
-- planted "through the existing consumer follow path" as an ordinary `team` follow.
-- Verified against code and mig 186: `fan_follows.entity_type` carries a CHECK limited
-- to (tournament|team|org), and `entity_id` for `team` is documented — and RESOLVED by
-- lib/fan-follows.getFollowedTeamsForUser — as `teams.id`, the TOURNAMENT team table.
-- A rep_teams id written under that type would violate the documented contract and be
-- silently dropped by the Following reader, so the family's team would simply never
-- appear. Overloading one type with two source tables would also leave the reader unable
-- to tell which table an id came from.
--
-- So the polymorphic pair gains a fourth, honest member instead.
ALTER TABLE fan_follows DROP CONSTRAINT IF EXISTS fan_follows_entity_type_check;
ALTER TABLE fan_follows ADD CONSTRAINT fan_follows_entity_type_check
  CHECK (entity_type IN ('tournament', 'team', 'org', 'rep_team'));

COMMENT ON COLUMN fan_follows.entity_type IS
  'What is followed: tournament | team | org | rep_team. `team` is teams.id (a tournament '
  'team); `rep_team` is rep_teams.id (a club/league rep team followed via the Chunk D '
  'family layer). Distinct types because the two ids resolve against different tables.';

-- ── Shared rate limiter for no-login token rails ───────────────────────────────
-- Discovery G4: none of the four existing no-login rails has any rate limiting —
-- abuse resistance is token entropy plus DB scoping and nothing else. Entropy makes
-- guessing hopeless, but it does nothing about a caller hammering a KNOWN token, and
-- nothing about the request endpoint. lib/no-login-token.ts now funnels every rail
-- through this counter.
--
-- Fixed window, keyed (rail, subject) where subject is a HASH of the caller's IP —
-- we count callers without storing who they are. On a serverless platform an
-- in-memory counter would reset per instance, so the counter has to live in the DB.

CREATE TABLE IF NOT EXISTS no_login_rate_limits (
  rail              text        NOT NULL,
  subject           text        NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempts          integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (rail, subject)
);

CREATE INDEX IF NOT EXISTS no_login_rate_limits_window_idx ON no_login_rate_limits (window_started_at);

ALTER TABLE no_login_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only.

-- Atomic increment-and-report. One statement so concurrent requests cannot both read
-- the same count and both decide they are under the limit. Returns the attempt number
-- INCLUDING this call, so the caller compares against its own limit.
CREATE OR REPLACE FUNCTION bump_no_login_rate_limit(
  p_rail           text,
  p_subject        text,
  p_window_seconds integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts integer;
BEGIN
  -- Opportunistic cleanup: without it this table grows forever, since a new hashed caller
  -- key appears for every distinct IP that ever touches a no-login rail. Sampled at ~1-in-
  -- 1000 calls so the cost is amortized to nothing and no cron job is required to exist for
  -- the table to stay bounded. Rows are only useful inside their own window; a generous
  -- 1-day floor covers the longest window any rail uses.
  IF (random() < 0.001) THEN
    DELETE FROM no_login_rate_limits WHERE window_started_at < now() - interval '1 day';
  END IF;

  INSERT INTO no_login_rate_limits (rail, subject, window_started_at, attempts)
  VALUES (p_rail, p_subject, now(), 1)
  ON CONFLICT (rail, subject) DO UPDATE
    SET attempts = CASE
          WHEN no_login_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds)
          THEN 1
          ELSE no_login_rate_limits.attempts + 1
        END,
        window_started_at = CASE
          WHEN no_login_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds)
          THEN now()
          ELSE no_login_rate_limits.window_started_at
        END
  RETURNING attempts INTO v_attempts;

  RETURN v_attempts;
END;
$$;

REVOKE ALL ON FUNCTION bump_no_login_rate_limit(text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION bump_no_login_rate_limit(text, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION bump_no_login_rate_limit(text, text, integer) TO service_role;
