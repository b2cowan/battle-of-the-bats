-- ---------------------------------------------------------------
-- Migration 254 — Families P2 review fix: a merge is ONE transaction
--
-- The first cut of mergePeople ran five sequential writes from the app
-- (move addresses → repoint four tables → patch the keeper → audit → delete).
-- The /review funnel confirmed the obvious cost (2026-08-17): any failure
-- partway leaves a half-merged person — reachable, address-less, breaking the
-- "org_people mirrored in org_person_emails" invariant until an admin happens
-- to retry. It also left a narrow race where two concurrent merges of the same
-- pair could both "succeed" and write two audit rows for one event.
--
-- A database function is the honest altitude: the whole sequence commits or
-- none of it does, and the SELECT ... FOR UPDATE serializes concurrent merges
-- of the same pair (the loser finds the merged person gone and errors cleanly).
--
-- Same rules as before, now enforced in one place:
--   · both persons must exist IN THIS ORG (two-check rule)
--   · a merge joins the PARENT records only — no child row is touched
--   · moved addresses become FORMER; the keeper's current address stays current
--   · keeper's blank name/phone fields fill from the merged person, never overwrite
--   · the merged row is snapshotted to org_person_merges, then deleted
--   · strictest contact preference wins BY CONSTRUCTION (preferences stay keyed
--     on (org, email); the keeper unions both address sets)
--
-- Posture: service-role EXECUTE only, like families_attach_people (mig 252).
-- Applies to: DEV. Production is a separate, explicit owner step.
-- ---------------------------------------------------------------

BEGIN;

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
