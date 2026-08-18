-- ---------------------------------------------------------------
-- Migration 253 — Families Book P2 chunk E: the duplicate queue REMEMBERS
--
-- Two small tables, both about the queue keeping its word:
--
-- (1) org_person_match_rejections — "not the same person" is a DECISION, and a
--     decision forgotten is a queue nobody trusts: the same pair resurfacing
--     weekly teaches the reviewer to stop reading it (plan §4; same tombstone
--     discipline as rep_player_continuity_links.status='rejected'). The pair is
--     stored ORDERED (person_a_id < person_b_id) so one row covers both
--     directions and the unique index cannot be dodged by swapping the columns.
--
-- (2) org_person_merges — the audit record of a merge: who was merged into
--     whom, by which admin, and a snapshot of the merged-away record. The
--     merged person's org_people row is DELETED after its addresses and source
--     rows are repointed (its identity lives on in org_person_emails, which is
--     how the merge is reversible in the only sense that matters: every
--     address still resolves, nothing about a CHILD was touched, and the
--     snapshot preserves what the merged record said).
--
--     ⚠ A merge joins the PARENT records only. person_id moves; no child row,
--     roster entry or registration is modified. "One family, three
--     registrations" claims about children are the READER's inference, and the
--     UI labels them as such (plan §5.3 gap 4).
--
--     ⚠ STRICTEST CONTACT PREFERENCE WINS BY CONSTRUCTION, not by copying:
--     preferences live in family_email_optouts/family_consents keyed (org,
--     email), and a merged person UNIONS addresses — so an opt-out under any
--     of them suppresses the household when the check runs through the person.
--     Nothing to copy means nothing to copy wrong.
--
-- Posture: service-role only — RLS enabled, NO policies (mig 251 posture).
-- Applies to: DEV. Production is a separate, explicit owner step.
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS org_person_match_rejections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Ordered pair: person_a_id < person_b_id, enforced so the unique index holds
  -- regardless of which side the reviewer clicked from.
  person_a_id   uuid NOT NULL REFERENCES org_people(id) ON DELETE CASCADE,
  person_b_id   uuid NOT NULL REFERENCES org_people(id) ON DELETE CASCADE,
  rejected_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT org_person_match_rejections_ordered CHECK (person_a_id < person_b_id)
);

-- org_id leads: tenancy-index rule (mig 249).
CREATE UNIQUE INDEX IF NOT EXISTS org_person_match_rejections_pair_uniq
  ON org_person_match_rejections (org_id, person_a_id, person_b_id);
-- Follow the FKs backwards (mig 249's rule).
CREATE INDEX IF NOT EXISTS org_person_match_rejections_person_a_idx
  ON org_person_match_rejections (person_a_id);
CREATE INDEX IF NOT EXISTS org_person_match_rejections_person_b_idx
  ON org_person_match_rejections (person_b_id);

ALTER TABLE org_person_match_rejections ENABLE ROW LEVEL SECURITY;
-- No policies, deliberately: service-role only.

CREATE TABLE IF NOT EXISTS org_person_merges (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- The surviving person. FK CASCADE: if the survivor is later deleted, the
  -- audit rows about how it was assembled go with it (org-scoped data anyway).
  kept_person_id    uuid NOT NULL REFERENCES org_people(id) ON DELETE CASCADE,
  -- The merged-away person's row is deleted, so no FK — the snapshot is the record.
  merged_person_id  uuid NOT NULL,
  merged_snapshot   jsonb NOT NULL,
  merged_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  merged_at         timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_person_merges_org_id_idx    ON org_person_merges (org_id);
CREATE INDEX IF NOT EXISTS org_person_merges_kept_idx      ON org_person_merges (kept_person_id);

ALTER TABLE org_person_merges ENABLE ROW LEVEL SECURITY;
-- No policies, deliberately: service-role only.

COMMIT;
