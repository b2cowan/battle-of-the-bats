-- ---------------------------------------------------------------
-- Migration 338 — Club Tier Stage 5c: a payment the club receives for a rep child is HANDED to the team's head coach,
-- and the club keeps signed, dated notes about a family (owner ratification 2026-10-19, Asks 26–29; build prompt
-- docs/projects/active/CLUB_TIER_STAGE5C_BUILD_PROMPT.md; hub K4MPu4ni53Ct7yrDcmWJd9 v121 → Mockups → Stage 5c)
--
-- WHY: recording a rep payment is ONE write with TWO effects (the child's dues and an income line in the TEAM's book), and
-- the club's books already refuse a team's book (D1/D3). So the family record's "Record a payment" records only the
-- club's own house-league fee and hands a rep payment to the head coach, whose own Record money writes it (Ask 26). The
-- hand-off is a record of its own: what the club received, for whom, sent to which team, and what came of it.
-- Notes copy the coaches' player notes (a dated, signed list), never the club's single unsigned boxes (Ask 29).
--
-- WHAT CHANGES:
--   (1) family_payment_handoffs — one row per rep line the club sent: the family (guardian record) it was sent from, the
--       child's roster row, the team and season, the amount, the day received, how, the note; who sent it and when; its
--       state (sent → recorded | not_received), who answered and when, and the payment it became. It never writes either
--       book: the coach's ordinary dues-payments POST records the payment and marks the row `recorded`.
--   (2) family_notes — a family's notes: the guardian record, the words (1 to 1,000 characters), the author, when written,
--       when last edited. A deletion keeps NOTHING here (the org audit log keeps who and when, never the words).
--   (3) families_merge_people — redefined so a merge moves both to the person kept, inside its one transaction (S5C-05:
--       a merge forgets what is keyed to the merged person unless this function moves it). Otherwise mig 334's body,
--       with mig 336's search_path pinned in the definition (CREATE OR REPLACE resets a function's settings).
--   (4) mig 332's two Needs-attention partial indexes on notifications, re-made to cover the coach's new notice
--       (club_payment_handed_off) — same columns, same predicate shape, one kind more.
--
-- Both tables: RLS on, no policies, nothing to anon/authenticated — server-only, like every Families table (mig 311).
-- INVISIBLE to the drift check for the function: declared in MANUAL_PROD_STEPS.json with a prosrc check. Safe to run
-- twice. ⚠ ORDER: after 334 and 336 on every database. Prod: at or before the promote that carries Stage 5c's code.
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS public.family_payment_handoffs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  person_id        uuid NOT NULL REFERENCES public.org_people(id) ON DELETE CASCADE,
  roster_player_id uuid REFERENCES public.rep_roster_players(id) ON DELETE SET NULL,
  player_name      text NOT NULL,
  team_id          uuid NOT NULL REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  program_year_id  uuid NOT NULL REFERENCES public.rep_program_years(id) ON DELETE CASCADE,
  amount           numeric(10,2) NOT NULL CHECK (amount > 0),
  received_date    date NOT NULL,
  method           text CHECK (method IN ('etransfer', 'cash', 'cheque', 'card', 'other')),
  note             text CHECK (note IS NULL OR char_length(note) <= 500),
  sent_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at          timestamptz NOT NULL DEFAULT now(),
  sent_to          uuid[] NOT NULL DEFAULT '{}',
  state          text NOT NULL DEFAULT 'sent' CHECK (state IN ('sent', 'recorded', 'not_received')),
  resolved_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at      timestamptz,
  payment_id       uuid REFERENCES public.rep_dues_payments(id) ON DELETE SET NULL,
  CONSTRAINT family_payment_handoffs_resolved_chk CHECK ((state = 'sent') = (resolved_at IS NULL))
);

CREATE INDEX IF NOT EXISTS family_payment_handoffs_person_idx ON public.family_payment_handoffs (person_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS family_payment_handoffs_org_idx ON public.family_payment_handoffs (org_id);
CREATE INDEX IF NOT EXISTS family_payment_handoffs_player_sent_idx ON public.family_payment_handoffs (roster_player_id) WHERE state = 'sent';
CREATE INDEX IF NOT EXISTS family_payment_handoffs_team_idx ON public.family_payment_handoffs (team_id);
CREATE INDEX IF NOT EXISTS family_payment_handoffs_year_idx ON public.family_payment_handoffs (program_year_id);
-- One hand-off per payment: a stamp can never point two hand-offs at one receipt (review 2026-10-19).
CREATE UNIQUE INDEX IF NOT EXISTS family_payment_handoffs_payment_uniq ON public.family_payment_handoffs (payment_id) WHERE payment_id IS NOT NULL;
-- (dev carried a first draft of this table: safe to run twice, and a no-op on a database that never saw the draft)
DROP INDEX IF EXISTS public.family_payment_handoffs_payment_idx;
ALTER TABLE public.family_payment_handoffs ALTER COLUMN method DROP NOT NULL;

ALTER TABLE public.family_payment_handoffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.family_payment_handoffs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_payment_handoffs TO service_role;

COMMENT ON TABLE public.family_payment_handoffs IS
  'Club Tier Stage 5c (Ask 26): a payment the club received for a rep child, handed to the team''s head coach to record. '
  'It writes no book: the coach''s own Record money (the dues-payments POST, carrying this id) records the payment and marks '
  'the row recorded; Not received marks it not_received. The family record shows a Sent to coach / Not received chip and a '
  'History line from it; the family file lists it under Money.';
COMMENT ON COLUMN public.family_payment_handoffs.person_id IS 'The guardian record it was sent from. A merge moves it to the person kept (families_merge_people, mig 338).';
COMMENT ON COLUMN public.family_payment_handoffs.roster_player_id IS 'The child''s roster row (this season). SET NULL if the row is deleted: the hand-off keeps player_name.';
COMMENT ON COLUMN public.family_payment_handoffs.player_name IS 'The child''s name when it was sent — the record and the file still name the child if the roster row goes.';
COMMENT ON COLUMN public.family_payment_handoffs.program_year_id IS 'The team''s live season when it was sent; the coach''s record refuses it once that season is not the live one.';
COMMENT ON COLUMN public.family_payment_handoffs.method IS 'How the family paid — DUES_PAYMENT_METHODS (lib/types.ts), the coach''s own list; null when the club did not say (the coach''s form then asks).';
COMMENT ON COLUMN public.family_payment_handoffs.note IS 'The club''s note (a cheque number travels here; there is no reference field). Goes to the coach with the line; never to the family.';
COMMENT ON COLUMN public.family_payment_handoffs.sent_to IS 'The head coaches it was sent to (their bell; their email where they have one). Not FK-checked: a record of a send, kept when a coach leaves. History and the family file name them.';
COMMENT ON COLUMN public.family_payment_handoffs.state IS 'sent (waiting on the coach) → recorded (the coach recorded it) | not_received (the coach says it never reached the team).';
COMMENT ON COLUMN public.family_payment_handoffs.resolved_by IS 'The coach who recorded it or said Not received.';
COMMENT ON COLUMN public.family_payment_handoffs.payment_id IS 'The rep_dues_payments row it became. SET NULL when the coach later removes or corrects that receipt (a correction is remove-then-record); the row stays recorded.';

CREATE TABLE IF NOT EXISTS public.family_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  person_id  uuid NOT NULL REFERENCES public.org_people(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at  timestamptz
);

CREATE INDEX IF NOT EXISTS family_notes_person_idx ON public.family_notes (person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS family_notes_org_idx ON public.family_notes (org_id);

ALTER TABLE public.family_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.family_notes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_notes TO service_role;

COMMENT ON TABLE public.family_notes IS
  'Club Tier Stage 5c (Ask 29): what the club''s staff wrote about a family — a signed, dated list on the guardian record, '
  'read and added by anyone who can open Families, edited by its author, deleted by its author or the owner (an org audit '
  'line keeps who and when, never the words). Never on a family''s screen; the family file includes them. A merge carries them.';
COMMENT ON COLUMN public.family_notes.person_id IS 'The guardian record it was written on (no household inferred before 5d). A merge moves it to the person kept.';
COMMENT ON COLUMN public.family_notes.created_by IS 'Its author — the only person who may edit it.';
COMMENT ON COLUMN public.family_notes.edited_at IS 'When its words last changed; null when never edited ("edited Oct 3" on the note).';

CREATE OR REPLACE FUNCTION families_merge_people(
  p_org_id uuid,
  p_keep_id uuid,
  p_merge_id uuid,
  p_merged_by uuid
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_keep  org_people%ROWTYPE;
  v_merge org_people%ROWTYPE;
BEGIN
  IF p_keep_id = p_merge_id THEN
    RAISE EXCEPTION 'Cannot merge a person into themselves';
  END IF;

  -- Lock both rows: concurrent merges of the same pair serialize here, and the
  -- second transaction fails on the row the first one deleted.
  SELECT * INTO v_keep  FROM org_people WHERE org_id = p_org_id AND id = p_keep_id  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Person not found'; END IF;
  SELECT * INTO v_merge FROM org_people WHERE org_id = p_org_id AND id = p_merge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Person not found'; END IF;

  -- Addresses move and become FORMER — the keeper's current address stays the
  -- household's address. (org, email) uniqueness holds: these rows already
  -- exist only under the merged person.
  UPDATE org_person_emails
     SET person_id = p_keep_id, is_current = false
   WHERE org_id = p_org_id AND person_id = p_merge_id;

  -- Repoint the four sources. Parent pointers only; no child row is modified.
  UPDATE rep_roster_players       SET person_id = p_keep_id WHERE org_id = p_org_id AND person_id = p_merge_id;
  UPDATE rep_tryout_registrations SET person_id = p_keep_id WHERE org_id = p_org_id AND person_id = p_merge_id;
  UPDATE league_registrations     SET person_id = p_keep_id WHERE org_id = p_org_id AND person_id = p_merge_id;
  UPDATE family_links             SET person_id = p_keep_id WHERE org_id = p_org_id AND person_id = p_merge_id;

  -- (mig 334) The family's message dates move with it: the record, the export's dates and the cap stay whole.
  UPDATE family_messages          SET person_id = p_keep_id WHERE org_id = p_org_id AND person_id = p_merge_id;

  -- (mig 338) The family's notes and the payments the club handed to a coach move with it, each still signed.
  UPDATE family_notes             SET person_id = p_keep_id WHERE org_id = p_org_id AND person_id = p_merge_id;
  UPDATE family_payment_handoffs  SET person_id = p_keep_id WHERE org_id = p_org_id AND person_id = p_merge_id;

  -- (mig 334) Open re-attachment proposals follow the merged person to the keeper; the pair's own is answered here.
  DELETE FROM org_person_reattachments
   WHERE org_id = p_org_id
     AND ((from_person_id = p_merge_id AND to_person_id = p_keep_id) OR (from_person_id = p_keep_id AND to_person_id = p_merge_id));
  UPDATE org_person_reattachments SET from_person_id = p_keep_id
   WHERE org_id = p_org_id AND from_person_id = p_merge_id
     AND NOT EXISTS (SELECT 1 FROM org_person_reattachments d WHERE d.from_person_id = p_keep_id AND d.to_person_id = org_person_reattachments.to_person_id
                       AND d.source_table = org_person_reattachments.source_table AND d.source_id = org_person_reattachments.source_id);
  UPDATE org_person_reattachments SET to_person_id = p_keep_id
   WHERE org_id = p_org_id AND to_person_id = p_merge_id
     AND NOT EXISTS (SELECT 1 FROM org_person_reattachments d WHERE d.to_person_id = p_keep_id AND d.from_person_id = org_person_reattachments.from_person_id
                       AND d.source_table = org_person_reattachments.source_table AND d.source_id = org_person_reattachments.source_id);

  -- Fill the keeper's gaps from the merged person — never overwrite.
  UPDATE org_people
     SET first_name = COALESCE(first_name, v_merge.first_name),
         last_name  = COALESCE(last_name,  v_merge.last_name),
         phone      = COALESCE(phone,      v_merge.phone),
         updated_at = now()
   WHERE org_id = p_org_id AND id = p_keep_id
     AND (first_name IS NULL OR last_name IS NULL OR phone IS NULL);

  INSERT INTO org_person_merges (org_id, kept_person_id, merged_person_id, merged_snapshot, merged_by)
  VALUES (p_org_id, p_keep_id, p_merge_id, to_jsonb(v_merge), p_merged_by);

  DELETE FROM org_people WHERE org_id = p_org_id AND id = p_merge_id;
END;
$$;

REVOKE ALL ON FUNCTION families_merge_people(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION families_merge_people(uuid, uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION families_merge_people(uuid, uuid, uuid, uuid) TO service_role;

-- (4) The coach's notice (`club_payment_handed_off`) is a Needs-attention kind, so mig 332's two partial indexes are
--     re-made to cover it (a new kind needs a new migration — tests/unit/needs-attention-clears-itself.test.ts reads
--     the NEWEST definition, this one). Same columns, same predicate shape; the list gains the one kind.
drop index if exists public.notifications_user_needs_attention_idx;
create index notifications_user_needs_attention_idx
  on public.notifications (user_id, event_type)
  where cleared_at is null
    and event_type in ('assistant_coach_approval_requested', 'club_hand_back_asked', 'club_hand_back_unasked', 'club_payment_handed_off',
                         'club_schedule_review', 'payment_failed', 'team_coach_payment_reminder', 'team_money_sent', 'team_move_requested',
                         'team_no_show', 'team_request_filed', 'team_request_holding_payout');

drop index if exists public.notifications_org_needs_attention_idx;
create index notifications_org_needs_attention_idx
  on public.notifications (org_id, event_type)
  where cleared_at is null
    and event_type in ('assistant_coach_approval_requested', 'club_hand_back_asked', 'club_hand_back_unasked', 'club_payment_handed_off',
                         'club_schedule_review', 'payment_failed', 'team_coach_payment_reminder', 'team_money_sent', 'team_move_requested',
                         'team_no_show', 'team_request_filed', 'team_request_holding_payout');

COMMIT;

-- Verify (dev, then prod):
--   SELECT to_regclass('public.family_payment_handoffs'), to_regclass('public.family_notes');             -- both not null
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('family_payment_handoffs', 'family_notes');  -- t, t
--   SELECT prosrc LIKE '%UPDATE family_notes             SET person_id = p_keep_id%'
--      AND prosrc LIKE '%UPDATE family_payment_handoffs  SET person_id = p_keep_id%'
--      AND prosrc LIKE '%Open re-attachment proposals follow the merged person%'
--     FROM pg_proc WHERE proname = 'families_merge_people';                                                  -- t
--   SELECT proconfig FROM pg_proc WHERE proname = 'families_merge_people';                                   -- {search_path=public}
