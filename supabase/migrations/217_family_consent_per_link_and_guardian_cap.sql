-- ---------------------------------------------------------------
-- Migration 217 — two defects found by the Chunk D Slice 2 adversarial review
--
-- (1) A SECOND CHILD'S CONSENT WAS SILENTLY DROPPED.
--
--     Mig 214 made consent unique on (org_id, guardian_email, basis, scope), and the write
--     path upserts with ignoreDuplicates. That key has no PLAYER dimension — so a parent who
--     is the accountable adult for TWO children in the same organization (siblings on
--     different teams is the ordinary case) had their second consent silently no-op.
--
--     That is worse than a missing record: the first consent survives and LOOKS like
--     evidence covering both children, while the second child's actual age band — which is
--     the thing the consent flow branches on, and which differs for a younger sibling — was
--     never captured. A consent ledger that quietly under-records is the exact failure the
--     ledger exists to prevent.
--
--     Fix: a consent is per CONSENT ACT, so `source_id` (the family_links row) joins the key.
--     Two children = two links = two records. Re-consenting on the same link still dedupes.
--     Backfilled rows keep working: they carry a source_id too, and rows without one still
--     collapse on the original key because NULLs are DISTINCT in a unique index — which
--     would allow duplicates — so the index is written to treat a NULL source_id as a single
--     shared slot via COALESCE to a fixed sentinel.
--
-- (2) THE TWO-GUARDIANS-PER-PLAYER CAP HAD NO DATABASE BACKSTOP.
--
--     The app counts then inserts, in two statements. Two coaches approving different
--     requests for the same player at the same moment — or an invite racing an approve —
--     both read "1" and both proceed, landing 3+ adults on one child. Owner ruling #17 is
--     "one per household, room for a second", and a cap enforced only by a racing read is
--     not that cap. The app-level check stays (it produces the friendly message); this makes
--     the limit true even when the check loses the race.
-- ---------------------------------------------------------------

-- ── (1) Consent is per consent ACT, not per (org, email, basis, scope) ─────────

DROP INDEX IF EXISTS family_consents_live_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS family_consents_live_uniq
  ON family_consents (
    org_id,
    guardian_email,
    basis,
    scope,
    -- NULLs are DISTINCT in a unique index, so a bare `source_id` would let unlimited
    -- source-less rows accumulate. The sentinel collapses them into one slot, preserving the
    -- old behaviour for the tryout-form backfill while giving each link-sourced consent its own.
    COALESCE(source_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE withdrawn_at IS NULL;

-- ── (2) The guardian cap, enforced where it cannot be raced ───────────────────

CREATE OR REPLACE FUNCTION enforce_guardian_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_live integer;
BEGIN
  -- Only guardian rows that are LIVE and attached to a player consume a seat. `declined` and
  -- `revoked` never count, so a coach's mistake is recoverable rather than permanently
  -- burning one of the two slots.
  IF NEW.role <> 'guardian' OR NEW.player_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('declined', 'revoked') THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_live
    FROM family_links
   WHERE player_id = NEW.player_id
     AND role = 'guardian'
     AND status IN ('requested', 'invited', 'pending_approval', 'verified')
     AND id <> NEW.id;

  IF v_live >= 2 THEN
    RAISE EXCEPTION 'guardian_cap_reached: player % already has 2 live guardians', NEW.player_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_links_guardian_cap ON family_links;
CREATE TRIGGER family_links_guardian_cap
  BEFORE INSERT OR UPDATE ON family_links
  FOR EACH ROW EXECUTE FUNCTION enforce_guardian_cap();

-- ⚠ `npm run check:migrations` gives a FALSE GREEN for function/trigger-only changes (the
-- mig-211 lesson). Confirm BOTH `enforce_guardian_cap` and the `family_links_guardian_cap`
-- trigger exist in prod by querying pg_proc / pg_trigger directly at release time.
