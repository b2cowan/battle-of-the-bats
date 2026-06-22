-- Migration 141: Chat engine foundation (chat_rooms, chat_room_members, chat_messages)
-- First slice of the Coach Chat program (Project 1 — Tournament Chat). Builds the shared chat
-- engine and PROVES live message delivery + tenant-privacy (RLS) before any UI is built.
-- See docs/projects/active/COACH_CHAT_PLATFORM_PLAN.md §2 and TOURNAMENT_CHAT_PLAN.md.
--
-- DEPLOY: dev-first. Apply to prod (and run `npm run refresh:snapshots`) at release time, BEFORE
-- promoting any code that reads these tables to master.
--
-- Realtime ordering: REPLICA IDENTITY FULL on chat_messages is set BEFORE the table is added to
-- the supabase_realtime publication (lesson from the games realtime bug, migrations 130/132).
-- Both statements are in this one file, in the correct order. Re-runnable (IF NOT EXISTS / DROP
-- POLICY IF EXISTS / idempotent DO blocks).

-- ── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  surface            text NOT NULL,
  ref_id             uuid NOT NULL,
  ref_sub_id         uuid,
  name               text NOT NULL,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_archived        boolean NOT NULL DEFAULT false,
  settings           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_rooms_surface_check CHECK (surface IN ('tournament', 'coach_peer', 'coach_parent'))
);

CREATE TABLE IF NOT EXISTS public.chat_room_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_role  text NOT NULL DEFAULT 'member',
  status       text NOT NULL DEFAULT 'active',
  muted_until  timestamptz,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  CONSTRAINT chat_room_members_role_check    CHECK (member_role IN ('member', 'moderator')),
  CONSTRAINT chat_room_members_status_check  CHECK (status IN ('active', 'pending', 'muted', 'removed')),
  CONSTRAINT chat_room_members_room_user_key UNIQUE (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id            uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body               text NOT NULL,
  deleted_at         timestamptz,
  deleted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at            timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS chat_rooms_org_idx          ON public.chat_rooms (org_id);
CREATE INDEX IF NOT EXISTS chat_rooms_surface_ref_idx  ON public.chat_rooms (surface, ref_id);
CREATE INDEX IF NOT EXISTS chat_room_members_room_idx  ON public.chat_room_members (room_id, status);
CREATE INDEX IF NOT EXISTS chat_room_members_user_idx  ON public.chat_room_members (user_id, status);
CREATE INDEX IF NOT EXISTS chat_messages_room_sent_idx ON public.chat_messages (room_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_sender_idx    ON public.chat_messages (sender_user_id);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- RLS ENABLED on all three (prod grants anon a default SELECT on public tables, so RLS is the only
-- reliable guard). Membership is the access key.
--
-- IMPORTANT: chat_room_members' SELECT policy is intentionally "own rows only" (user_id = auth.uid())
-- to avoid self-referential RLS recursion (a policy on chat_room_members that subqueries
-- chat_room_members triggers "infinite recursion detected in policy"). The full member roster is
-- read server-side via the service role. The chat_rooms / chat_messages policies subquery
-- chat_room_members (a DIFFERENT table) so they evaluate cleanly and do not recurse.

ALTER TABLE public.chat_rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_room_members_select_own ON public.chat_room_members;
CREATE POLICY chat_room_members_select_own ON public.chat_room_members
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS chat_room_members_update_own ON public.chat_room_members;
CREATE POLICY chat_room_members_update_own ON public.chat_room_members
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS chat_rooms_select_member ON public.chat_rooms;
CREATE POLICY chat_rooms_select_member ON public.chat_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_room_members m
      WHERE m.room_id = chat_rooms.id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS chat_messages_select_member ON public.chat_messages;
CREATE POLICY chat_messages_select_member ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_room_members m
      WHERE m.room_id = chat_messages.room_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS chat_messages_insert_member ON public.chat_messages;
CREATE POLICY chat_messages_insert_member ON public.chat_messages
  FOR INSERT WITH CHECK (
    sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.chat_room_members m
      JOIN public.chat_rooms r ON r.id = m.room_id
      WHERE m.room_id = chat_messages.room_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND r.is_archived = false
    )
  );

DROP POLICY IF EXISTS chat_messages_update_moderator ON public.chat_messages;
CREATE POLICY chat_messages_update_moderator ON public.chat_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.chat_room_members m
      WHERE m.room_id = chat_messages.room_id
        AND m.user_id = auth.uid()
        AND m.member_role = 'moderator'
        AND m.status = 'active'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_room_members m
      WHERE m.room_id = chat_messages.room_id
        AND m.user_id = auth.uid()
        AND m.member_role = 'moderator'
        AND m.status = 'active'
    )
  );

-- ── Grants (base privileges; RLS still applies on top) ──────────────────────
-- COLUMN-SCOPED on purpose, so RLS is not the ONLY guard on writes. An RLS `WITH CHECK` sees only
-- the NEW row (not the OLD), so a row-level "you may update your own membership" policy CANNOT stop
-- a member from also flipping their own `status`/`member_role`. Column grants close that at the
-- privilege layer (Postgres rejects an UPDATE/INSERT that names an ungranted column before RLS even
-- runs):
--   • chat_room_members: a member may UPDATE only `last_read_at` (NOT status/member_role — no
--     self-reinstatement past a removal/mute, no self-promotion to moderator).
--   • chat_messages: a moderator may UPDATE only the soft-delete columns (NOT body/sender/sent_at/
--     room_id — no rewriting or reattributing history); an author may INSERT only
--     room_id/sender/body/metadata (NOT sent_at — no backdating; it takes DEFAULT now()).
-- Rooms + membership rows are created and mutated by the service role. No grants to anon.
-- (REVOKEs make this safe to re-apply over an earlier blanket grant; REVOKE of an absent priv is a
-- harmless no-op on a fresh apply.)

REVOKE INSERT, UPDATE ON public.chat_rooms        FROM authenticated;
REVOKE INSERT, UPDATE ON public.chat_room_members FROM authenticated;
REVOKE INSERT, UPDATE ON public.chat_messages     FROM authenticated;

GRANT SELECT                        ON public.chat_rooms        TO authenticated;
GRANT SELECT, UPDATE (last_read_at) ON public.chat_room_members TO authenticated;
GRANT SELECT,
      INSERT (room_id, sender_user_id, body, metadata),
      UPDATE (deleted_at, deleted_by_user_id)
  ON public.chat_messages TO authenticated;

-- ── Realtime ────────────────────────────────────────────────────────────────
-- ORDER MATTERS: REPLICA IDENTITY FULL must be set BEFORE adding the table to the publication.

DO $$
BEGIN
  IF (SELECT relreplident FROM pg_class WHERE oid = 'public.chat_messages'::regclass) <> 'f' THEN
    ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;
