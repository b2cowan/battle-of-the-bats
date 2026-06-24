-- 149_chat_rooms_dedupe_unique.sql
-- Fix + prevent DUPLICATE chat rooms for the same conversation. A TOCTOU race in
-- ensureTournamentChatRoom (no unique constraint on the room's identity) let two rooms be created for
-- the same (surface, ref_id, ref_sub_id) within milliseconds — so a coach saw the SAME tournament chat
-- listed twice. This migration:
--   1. MERGES each duplicate group into its canonical (oldest) room — re-pointing messages, reactions,
--      poll votes, and memberships (de-duping members already present in the canonical), then deleting
--      the now-empty duplicate rooms.
--   2. Adds PARTIAL UNIQUE INDEXES so a duplicate can never be created again (the existing
--      ensureTournamentChatRoom already catches the unique-violation and re-fetches the winner).
--
-- ref_sub_id is nullable and Postgres treats NULLs as distinct in a plain unique index, so we use TWO
-- partial indexes: one for the room-level rooms (ref_sub_id IS NULL) keyed on (surface, ref_id), and
-- one for sub-scoped rooms keyed on (surface, ref_id, ref_sub_id). Idempotent + safe to re-run.

-- ── 1. Merge duplicates into the canonical (oldest) room ──────────────────────
DO $$
DECLARE
  grp RECORD;
  canonical uuid;
BEGIN
  FOR grp IN
    SELECT surface, ref_id, ref_sub_id
    FROM public.chat_rooms
    GROUP BY surface, ref_id, ref_sub_id
    HAVING count(*) > 1
  LOOP
    -- Oldest room in the group wins (matches getTournamentChatRoom's order-by created_at ASC).
    SELECT id INTO canonical
    FROM public.chat_rooms
    WHERE surface = grp.surface AND ref_id = grp.ref_id
      AND ref_sub_id IS NOT DISTINCT FROM grp.ref_sub_id
    ORDER BY created_at, id
    LIMIT 1;

    -- Memberships: move rows whose user is NOT already in the canonical room, then drop the leftovers
    -- (members already present in canonical) so the (room_id, user_id) unique constraint can't trip.
    UPDATE public.chat_room_members cm
       SET room_id = canonical
     WHERE cm.room_id IN (
             SELECT id FROM public.chat_rooms
             WHERE surface = grp.surface AND ref_id = grp.ref_id
               AND ref_sub_id IS NOT DISTINCT FROM grp.ref_sub_id AND id <> canonical)
       AND NOT EXISTS (
             SELECT 1 FROM public.chat_room_members c2
             WHERE c2.room_id = canonical AND c2.user_id = cm.user_id);

    -- For a user present in BOTH a duplicate and the canonical room, advance the canonical row's read
    -- watermark to the LATER of the two before the duplicate row is dropped below. A read watermark
    -- only ever moves forward, so this is strictly safe — it can never re-mark already-read messages
    -- as unread, but it preserves a more-recent read position that lived only on the duplicate row.
    -- (member_role / status are intentionally NOT folded: status preserves any moderation/removal on
    -- the canonical, and the duplicates were created by the same sync so roles already match.)
    UPDATE public.chat_room_members canon
       SET last_read_at = dupe.last_read_at
      FROM public.chat_room_members dupe
     WHERE canon.room_id = canonical
       AND dupe.user_id = canon.user_id
       AND dupe.room_id IN (
             SELECT id FROM public.chat_rooms
             WHERE surface = grp.surface AND ref_id = grp.ref_id
               AND ref_sub_id IS NOT DISTINCT FROM grp.ref_sub_id AND id <> canonical)
       AND dupe.last_read_at IS NOT NULL
       AND (canon.last_read_at IS NULL OR dupe.last_read_at > canon.last_read_at);

    DELETE FROM public.chat_room_members cm
     WHERE cm.room_id IN (
             SELECT id FROM public.chat_rooms
             WHERE surface = grp.surface AND ref_id = grp.ref_id
               AND ref_sub_id IS NOT DISTINCT FROM grp.ref_sub_id AND id <> canonical);

    -- Messages + their denormalized-room_id children move to the canonical room.
    UPDATE public.chat_messages
       SET room_id = canonical
     WHERE room_id IN (
             SELECT id FROM public.chat_rooms
             WHERE surface = grp.surface AND ref_id = grp.ref_id
               AND ref_sub_id IS NOT DISTINCT FROM grp.ref_sub_id AND id <> canonical);

    UPDATE public.chat_message_reactions
       SET room_id = canonical
     WHERE room_id IN (
             SELECT id FROM public.chat_rooms
             WHERE surface = grp.surface AND ref_id = grp.ref_id
               AND ref_sub_id IS NOT DISTINCT FROM grp.ref_sub_id AND id <> canonical);

    UPDATE public.chat_poll_votes
       SET room_id = canonical
     WHERE room_id IN (
             SELECT id FROM public.chat_rooms
             WHERE surface = grp.surface AND ref_id = grp.ref_id
               AND ref_sub_id IS NOT DISTINCT FROM grp.ref_sub_id AND id <> canonical);

    -- Drop the now-empty duplicate rooms.
    DELETE FROM public.chat_rooms
     WHERE surface = grp.surface AND ref_id = grp.ref_id
       AND ref_sub_id IS NOT DISTINCT FROM grp.ref_sub_id AND id <> canonical;
  END LOOP;
END $$;

-- ── 2. Prevent recurrence: one room per conversation identity ─────────────────
CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_surface_ref_nosub_uniq
  ON public.chat_rooms (surface, ref_id)
  WHERE ref_sub_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_surface_ref_sub_uniq
  ON public.chat_rooms (surface, ref_id, ref_sub_id)
  WHERE ref_sub_id IS NOT NULL;
