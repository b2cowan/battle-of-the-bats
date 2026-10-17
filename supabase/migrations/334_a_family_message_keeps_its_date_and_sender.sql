-- ---------------------------------------------------------------
-- Migration 334 — Club Tier Stage 5a: a family message keeps its date and its sender (E07, Ask 9, owner ratification
-- 2026-10-17; build prompt docs/projects/active/CLUB_TIER_STAGE5A_BUILD_PROMPT.md)
--
-- WHAT CHANGES:
--   (1) family_messages — one row per "Message this family" send: the person whose family it was, who sent it, when.
--       NEVER the words and NEVER the recipients (the 2026-08-18 ruling, read 2026-10-17 as "never the words": the send
--       window's log names its sender). The same row is three things at once, as the Families plan said in August:
--         · the CLAIM — written before any email goes, so a double press is refused;
--         · the CAP — three per person in any rolling 24 hours;
--         · the RECORD — "Last messaged … by …", and the dates in the family's export.
--   (2) family_message_claim(org, person, actor) — the claim and the cap in ONE step: a per-person transaction lock,
--       then the count, then the insert. Two presses at two-of-three serialize on the lock; the second sees three and
--       is refused 'cap' with the time the next one can go. The app removes a claim whose send reached nobody.
--   (3) families_merge_people (mig 254), revised: the merged person's message rows move to the keeper before the
--       merged person is deleted, so a merge never loses a family's message dates (or resets its cap); and an open
--       re-attachment proposal (mig 333) naming the merged person moves to the keeper too — the one between the pair
--       itself is answered by this merge and goes. (/review 2026-10-17: a cascade alone lost a still-valid proposal
--       when one side was merged with a third person.) Everything else verbatim.
--
-- INVISIBLE to the drift check for both functions: declared in MANUAL_PROD_STEPS.json with prosrc checks. Safe to run
-- twice. Prod order: at or before the promote that carries Stage 5a's code (Message this family claims through (2)),
-- and after 333.
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS family_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id  uuid NOT NULL REFERENCES org_people(id) ON DELETE CASCADE,
  sent_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS family_messages_org_idx ON family_messages (org_id);
CREATE INDEX IF NOT EXISTS family_messages_person_sent_idx ON family_messages (person_id, sent_at DESC);

ALTER TABLE family_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE family_messages FROM anon, authenticated;
grant select, insert, update, delete on public.family_messages to service_role;

COMMENT ON TABLE family_messages IS
  'Club Tier Stage 5a (Ask 9): one row per Message this family send — the person, the sender, the date. Never the '
  'words, never the recipients. The row is the send''s claim (written before any email goes, by family_message_claim), '
  'the three-a-day cap and "Last messaged … by …". A claim whose send reached nobody is removed. A merge moves the '
  'merged person''s rows to the keeper (families_merge_people, mig 334).';

CREATE OR REPLACE FUNCTION family_message_claim(p_org_id uuid, p_person_id uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_cap   constant integer := 3;   -- ⚠ FAMILY_MESSAGE_CAP in lib/families-words.ts says the same number on screen
  v_count integer;
  v_next  timestamptz;
  v_id    uuid;
BEGIN
  -- One family's sends serialize here: the second of two parallel presses waits, then counts the first.
  PERFORM pg_advisory_xact_lock(hashtextextended('family_message:' || p_person_id::text, 0));

  IF NOT EXISTS (SELECT 1 FROM org_people WHERE id = p_person_id AND org_id = p_org_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  SELECT count(*) INTO v_count
    FROM family_messages
   WHERE org_id = p_org_id AND person_id = p_person_id AND sent_at > now() - interval '24 hours';

  IF v_count >= v_cap THEN
    -- The next slot opens 24 hours after the send that made the window full: the (count - cap + 1)-th oldest.
    SELECT sent_at + interval '24 hours' INTO v_next
      FROM family_messages
     WHERE org_id = p_org_id AND person_id = p_person_id AND sent_at > now() - interval '24 hours'
     ORDER BY sent_at ASC
     OFFSET (v_count - v_cap) LIMIT 1;
    RETURN jsonb_build_object('ok', false, 'code', 'cap', 'count', v_count, 'nextAt', v_next);
  END IF;

  INSERT INTO family_messages (org_id, person_id, sent_by)
  VALUES (p_org_id, p_person_id, p_actor)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'messageId', v_id, 'count', v_count + 1);
END;
$$;

REVOKE ALL ON FUNCTION family_message_claim(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION family_message_claim(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION family_message_claim(uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION families_merge_people(
  p_org_id uuid,
  p_keep_id uuid,
  p_merge_id uuid,
  p_merged_by uuid
) RETURNS void
LANGUAGE plpgsql
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

COMMIT;
