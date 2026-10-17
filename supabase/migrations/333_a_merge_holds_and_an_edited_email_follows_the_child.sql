-- ---------------------------------------------------------------
-- Migration 333 — Club Tier Stage 5a: a merge holds, and an edited email follows the child
-- (E01 + E02, owner ratification 2026-10-17; build prompt docs/projects/active/CLUB_TIER_STAGE5A_BUILD_PROMPT.md)
--
-- WHAT CHANGES — families_attach_people(org), the ONE home of mint-and-attach (mig 252), revised. Every rule of 252 is
-- kept verbatim (normalize lower(btrim()), the claim alias with ambiguity and chains refused, the newest non-blank name
-- and phone, the address shape gate, attach-only-the-unattached). Three changes, each named where it sits:
--
--   (E01) A person is minted only for an address NOBODY in the club's address book (org_person_emails) already owns.
--         252 checked org_people alone, so a merged person's address — moved to the keeper as a FORMER address — was
--         minted again on the next visit as a childless "ghost", and the queue proposed the pair again.
--   (E01) The address book resolves an address's canonical owner through the address book first, then org_people
--         (a new person is in org_people before the book has their row). 252 joined org_people only, so an address whose
--         canonical address had become someone's FORMER address could never be filed.
--   (E02) A source row whose typed address (normalized; a family link's claimed_email else invited_email) is no longer
--         one of its person's addresses is re-pointed to the person who owns that address (minted above under 252's
--         rules when new). 252 attached only rows with person_id IS NULL, so a coach editing a guardian's email left the
--         child on the old person forever. NOTHING MERGES: when the person left behind holds no source row any more, a
--         re-attachment record is written (org_person_reattachments) and the duplicate queue proposes the pair, for a
--         person to decide. A typed address nobody owns (blank, or failing the shape gate) moves nothing.
--         ⚠ A family_links row re-points ONLY when it is VERIFIED (/review 2026-10-17): a claim's claimed_email is the
--         claimant's own account address, recorded as evidence while the coach decides (pending_approval) — re-pointing
--         on it would move a child to whoever claimed the link before anyone approved them, and a declined or revoked
--         link would keep the move. Unverified links still count as rows a person holds.
--   (/review 2026-10-17) A claim is identity only once VERIFIED — a DEPARTURE from 252's "verbatim" rule, on purpose: 252
--         read every claimed_email (any status) as a sighting and every invited→claimed pair as an alias, so a claim a
--         coach DECLINED could still make the invited guardian's address a former address of the claimant — who then
--         became the family's person: its messages and its file (medical notes) went to them. Now a pending, declined
--         or revoked claim mints nobody, aliases nothing and attaches by the invited address.
--
-- NEW TABLE org_person_reattachments — written only by the attach function; read by the duplicate queue. Both person
-- FKs CASCADE: families_merge_people deletes the merged person, and a merged pair's proposal is answered by that merge
-- (the merge itself is kept in org_person_merges); a merge of ONE side with a third person carries the record to the
-- keeper (families_merge_people, mig 334). Service-role only (RLS on, no policies), like every Families table.
--
-- INVISIBLE to the drift check for the function: declared in MANUAL_PROD_STEPS.json with a prosrc check. Safe to run
-- twice (CREATE OR REPLACE; IF NOT EXISTS). Prod order: at or before the promote that carries Stage 5a's code (the
-- duplicate read selects from the new table).
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS org_person_reattachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_person_id  uuid NOT NULL REFERENCES org_people(id) ON DELETE CASCADE,
  to_person_id    uuid NOT NULL REFERENCES org_people(id) ON DELETE CASCADE,
  source_table    text NOT NULL CHECK (source_table IN ('rep_roster_players', 'rep_tryout_registrations', 'league_registrations', 'family_links')),
  source_id       uuid NOT NULL,
  at              timestamptz NOT NULL DEFAULT now(),
  CHECK (from_person_id <> to_person_id)
);

CREATE INDEX IF NOT EXISTS org_person_reattachments_org_idx ON org_person_reattachments (org_id);
CREATE INDEX IF NOT EXISTS org_person_reattachments_from_idx ON org_person_reattachments (from_person_id);
CREATE INDEX IF NOT EXISTS org_person_reattachments_to_idx ON org_person_reattachments (to_person_id);
-- One record per move: two Families visits at once (or a person whose several rows move) never write it twice.
CREATE UNIQUE INDEX IF NOT EXISTS org_person_reattachments_move_uniq
  ON org_person_reattachments (from_person_id, to_person_id, source_table, source_id);

ALTER TABLE org_person_reattachments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE org_person_reattachments IS
  'Club Tier Stage 5a (E02): a source row whose guardian email was edited moved from one person to the person who owns '
  'the new address, and the person it left holds no source row any more. Written only by families_attach_people; read by '
  'the duplicate queue, which proposes the pair ("An email changed on <child>''s roster row, <date>"). Nothing merges on '
  'its own. Both person FKs cascade: a merge deletes the merged person and answers the proposal.';

CREATE OR REPLACE FUNCTION families_attach_people(p_org_id uuid)
RETURNS void
LANGUAGE sql
AS $$

  -- Mint people (rules a + c). New people only; ON CONFLICT leaves existing untouched.
  WITH observed AS (
    SELECT r.org_id,
           lower(btrim(r.guardian_email))            AS email_normalized,
           NULLIF(btrim(r.guardian_first_name), '')  AS first_name,
           NULLIF(btrim(r.guardian_last_name),  '')  AS last_name,
           NULLIF(btrim(r.guardian_phone),      '')  AS phone,
           r.updated_at                              AS observed_at
      FROM rep_roster_players r
     WHERE r.org_id = p_org_id AND r.guardian_email IS NOT NULL AND btrim(r.guardian_email) <> ''
     UNION ALL
    SELECT t.org_id, lower(btrim(t.guardian_email)),
           NULLIF(btrim(t.guardian_first_name), ''), NULLIF(btrim(t.guardian_last_name), ''),
           NULLIF(btrim(t.guardian_phone), ''), t.updated_at
      FROM rep_tryout_registrations t
     WHERE t.org_id = p_org_id AND t.guardian_email IS NOT NULL AND btrim(t.guardian_email) <> ''
     UNION ALL
    SELECT lr.org_id, lower(btrim(lr.guardian_email)),
           NULLIF(btrim(lr.guardian_first_name), ''), NULLIF(btrim(lr.guardian_last_name), ''),
           NULLIF(btrim(lr.guardian_phone), ''), lr.updated_at
      FROM league_registrations lr
     WHERE lr.org_id = p_org_id AND lr.guardian_email IS NOT NULL AND btrim(lr.guardian_email) <> ''
     UNION ALL
    SELECT f.org_id, lower(btrim(f.invited_email)), NULL, NULL, NULL, f.updated_at
      FROM family_links f
     WHERE f.org_id = p_org_id AND btrim(f.invited_email) <> ''
     UNION ALL
    SELECT f.org_id, lower(btrim(f.claimed_email)), NULL, NULL, NULL, f.updated_at
      FROM family_links f
     WHERE f.org_id = p_org_id AND f.claimed_email IS NOT NULL AND btrim(f.claimed_email) <> ''
       AND f.status = 'verified'   -- (mig 333) an unapproved claim is evidence, never identity
  ),
  alias_raw AS (
    SELECT f.org_id,
           lower(btrim(f.invited_email)) AS from_email,
           lower(btrim(f.claimed_email)) AS to_email
      FROM family_links f
     WHERE f.org_id = p_org_id
       AND f.claimed_email IS NOT NULL AND btrim(f.claimed_email) <> ''
       AND btrim(f.invited_email) <> ''
       AND lower(btrim(f.claimed_email)) IS DISTINCT FROM lower(btrim(f.invited_email))
       AND f.status = 'verified'   -- (mig 333) a pending, declined or revoked claim never aliases
  ),
  alias_unambiguous AS (
    SELECT org_id, from_email, min(to_email) AS to_email
      FROM alias_raw GROUP BY org_id, from_email HAVING count(DISTINCT to_email) = 1
  ),
  alias AS (
    SELECT s.* FROM alias_unambiguous s
     WHERE NOT EXISTS (SELECT 1 FROM alias_unambiguous t WHERE t.org_id = s.org_id AND t.from_email = s.to_email)
       AND NOT EXISTS (SELECT 1 FROM alias_unambiguous t WHERE t.org_id = s.org_id AND t.to_email   = s.from_email)
  ),
  canonical AS (
    SELECT o.*, COALESCE(a.to_email, o.email_normalized) AS canon_email
      FROM observed o
      LEFT JOIN alias a ON a.org_id = o.org_id AND a.from_email = o.email_normalized
  )
  INSERT INTO org_people (org_id, email_normalized, first_name, last_name, phone)
  SELECT c.org_id, c.canon_email,
         (array_agg(c.first_name ORDER BY (c.first_name IS NULL), c.observed_at DESC))[1],
         (array_agg(c.last_name  ORDER BY (c.last_name  IS NULL), c.observed_at DESC))[1],
         (array_agg(c.phone      ORDER BY (c.phone      IS NULL), c.observed_at DESC))[1]
    FROM canonical c
   WHERE c.canon_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     -- (E01, mig 333) an address the address book already files under someone — a merged person's address is the
     -- keeper's former address — is never minted again: that was the childless "ghost" a merge left behind.
     AND NOT EXISTS (SELECT 1 FROM org_person_emails owned
                      WHERE owned.org_id = c.org_id AND owned.email_normalized = c.canon_email)
   GROUP BY c.org_id, c.canon_email
  ON CONFLICT (org_id, email_normalized) DO NOTHING;

  -- The address book (same CTE shape; addresses for new AND existing people).
  WITH observed AS (
    SELECT r.org_id, lower(btrim(r.guardian_email)) AS email_normalized, r.updated_at AS observed_at
      FROM rep_roster_players r
     WHERE r.org_id = p_org_id AND r.guardian_email IS NOT NULL AND btrim(r.guardian_email) <> ''
     UNION ALL
    SELECT t.org_id, lower(btrim(t.guardian_email)), t.updated_at
      FROM rep_tryout_registrations t
     WHERE t.org_id = p_org_id AND t.guardian_email IS NOT NULL AND btrim(t.guardian_email) <> ''
     UNION ALL
    SELECT lr.org_id, lower(btrim(lr.guardian_email)), lr.updated_at
      FROM league_registrations lr
     WHERE lr.org_id = p_org_id AND lr.guardian_email IS NOT NULL AND btrim(lr.guardian_email) <> ''
     UNION ALL
    SELECT f.org_id, lower(btrim(f.invited_email)), f.updated_at
      FROM family_links f
     WHERE f.org_id = p_org_id AND btrim(f.invited_email) <> ''
     UNION ALL
    SELECT f.org_id, lower(btrim(f.claimed_email)), f.updated_at
      FROM family_links f
     WHERE f.org_id = p_org_id AND f.claimed_email IS NOT NULL AND btrim(f.claimed_email) <> ''
       AND f.status = 'verified'   -- (mig 333) an unapproved claim is evidence, never identity
  ),
  alias_raw AS (
    SELECT f.org_id,
           lower(btrim(f.invited_email)) AS from_email,
           lower(btrim(f.claimed_email)) AS to_email
      FROM family_links f
     WHERE f.org_id = p_org_id
       AND f.claimed_email IS NOT NULL AND btrim(f.claimed_email) <> ''
       AND btrim(f.invited_email) <> ''
       AND lower(btrim(f.claimed_email)) IS DISTINCT FROM lower(btrim(f.invited_email))
       AND f.status = 'verified'   -- (mig 333) a pending, declined or revoked claim never aliases
  ),
  alias_unambiguous AS (
    SELECT org_id, from_email, min(to_email) AS to_email
      FROM alias_raw GROUP BY org_id, from_email HAVING count(DISTINCT to_email) = 1
  ),
  alias AS (
    SELECT s.* FROM alias_unambiguous s
     WHERE NOT EXISTS (SELECT 1 FROM alias_unambiguous t WHERE t.org_id = s.org_id AND t.from_email = s.to_email)
       AND NOT EXISTS (SELECT 1 FROM alias_unambiguous t WHERE t.org_id = s.org_id AND t.to_email   = s.from_email)
  ),
  canonical AS (
    SELECT o.*, COALESCE(a.to_email, o.email_normalized) AS canon_email
      FROM observed o
      LEFT JOIN alias a ON a.org_id = o.org_id AND a.from_email = o.email_normalized
  ),
  -- (E01, mig 333) the canonical address's owner: the address book first (it may be someone's FORMER address since a
  -- merge), then org_people (a person minted above has no book row yet).
  owner AS (
    SELECT DISTINCT c.org_id, c.canon_email,
           COALESCE(
             (SELECT b.person_id FROM org_person_emails b WHERE b.org_id = c.org_id AND b.email_normalized = c.canon_email),
             (SELECT p.id FROM org_people p WHERE p.org_id = c.org_id AND p.email_normalized = c.canon_email)
           ) AS person_id
      FROM canonical c
  )
  INSERT INTO org_person_emails (org_id, person_id, email_normalized, is_current, first_seen_at, last_seen_at)
  SELECT c.org_id, w.person_id, c.email_normalized,
         (c.email_normalized = c.canon_email),
         min(c.observed_at), max(c.observed_at)
    FROM canonical c
    JOIN owner w ON w.org_id = c.org_id AND w.canon_email = c.canon_email AND w.person_id IS NOT NULL
   WHERE c.canon_email      ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     AND c.email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
   GROUP BY c.org_id, w.person_id, c.email_normalized, (c.email_normalized = c.canon_email)
  ON CONFLICT (org_id, email_normalized) DO NOTHING;

  -- Attach (rule d): only rows still unattached, resolved through the address
  -- book — never org_people directly — so an old address lands on the same person.
  UPDATE rep_roster_players r
     SET person_id = pe.person_id
    FROM org_person_emails pe
   WHERE r.org_id = p_org_id
     AND pe.org_id = r.org_id
     AND pe.email_normalized = lower(btrim(r.guardian_email))
     AND r.guardian_email IS NOT NULL
     AND r.person_id IS NULL;

  UPDATE rep_tryout_registrations t
     SET person_id = pe.person_id
    FROM org_person_emails pe
   WHERE t.org_id = p_org_id
     AND pe.org_id = t.org_id
     AND pe.email_normalized = lower(btrim(t.guardian_email))
     AND t.guardian_email IS NOT NULL
     AND t.person_id IS NULL;

  UPDATE league_registrations lr
     SET person_id = pe.person_id
    FROM org_person_emails pe
   WHERE lr.org_id = p_org_id
     AND pe.org_id = lr.org_id
     AND pe.email_normalized = lower(btrim(lr.guardian_email))
     AND lr.guardian_email IS NOT NULL
     AND lr.person_id IS NULL;

  UPDATE family_links f
     SET person_id = pe.person_id
    FROM org_person_emails pe
   WHERE f.org_id = p_org_id
     AND pe.org_id = f.org_id
     AND pe.email_normalized = lower(btrim(COALESCE(CASE WHEN f.status = 'verified' THEN NULLIF(btrim(f.claimed_email), '') END, f.invited_email)))
     AND f.person_id IS NULL;

  -- (E02, mig 333) Re-attach: an ATTACHED row whose typed address is now another person's address moves to that person
  -- (the address is the identity; by the book's (org, email) uniqueness, an address owned by someone else is not one of
  -- this person's). One statement, so every move and its record share one snapshot. Nothing merges: when the person a
  -- row left holds no source row any more, the move is recorded and the duplicate queue proposes the pair.
  WITH held AS (
    SELECT 'rep_roster_players'::text AS source_table, r.id AS source_id, r.person_id AS from_person,
           lower(btrim(r.guardian_email)) AS email, true AS movable
      FROM rep_roster_players r WHERE r.org_id = p_org_id AND r.person_id IS NOT NULL
     UNION ALL
    SELECT 'rep_tryout_registrations', t.id, t.person_id, lower(btrim(t.guardian_email)), true
      FROM rep_tryout_registrations t WHERE t.org_id = p_org_id AND t.person_id IS NOT NULL
     UNION ALL
    SELECT 'league_registrations', lr.id, lr.person_id, lower(btrim(lr.guardian_email)), true
      FROM league_registrations lr WHERE lr.org_id = p_org_id AND lr.person_id IS NOT NULL
     UNION ALL
    -- A link moves only once VERIFIED (header); every link is still a row its person holds.
    SELECT 'family_links', f.id, f.person_id, lower(btrim(COALESCE(NULLIF(btrim(f.claimed_email), ''), f.invited_email))),
           f.status = 'verified'
      FROM family_links f WHERE f.org_id = p_org_id AND f.person_id IS NOT NULL
  ),
  stray AS (
    SELECT h.source_table, h.source_id, h.from_person, pe.person_id AS to_person
      FROM held h
      JOIN org_person_emails pe ON pe.org_id = p_org_id AND pe.email_normalized = h.email
     WHERE h.movable AND pe.person_id <> h.from_person
  ),
  moved_roster AS (
    UPDATE rep_roster_players r SET person_id = s.to_person
      FROM stray s WHERE s.source_table = 'rep_roster_players' AND r.id = s.source_id AND r.org_id = p_org_id
    RETURNING r.id
  ),
  moved_tryout AS (
    UPDATE rep_tryout_registrations t SET person_id = s.to_person
      FROM stray s WHERE s.source_table = 'rep_tryout_registrations' AND t.id = s.source_id AND t.org_id = p_org_id
    RETURNING t.id
  ),
  moved_league AS (
    UPDATE league_registrations lr SET person_id = s.to_person
      FROM stray s WHERE s.source_table = 'league_registrations' AND lr.id = s.source_id AND lr.org_id = p_org_id
    RETURNING lr.id
  ),
  moved_link AS (
    UPDATE family_links f SET person_id = s.to_person
      FROM stray s WHERE s.source_table = 'family_links' AND f.id = s.source_id AND f.org_id = p_org_id
    RETURNING f.id
  )
  INSERT INTO org_person_reattachments (org_id, from_person_id, to_person_id, source_table, source_id)
  SELECT p_org_id, s.from_person, s.to_person, s.source_table, s.source_id
    FROM stray s
   -- the person left behind keeps no row that is not itself moving
   WHERE NOT EXISTS (
     SELECT 1 FROM held k
      WHERE k.from_person = s.from_person
        AND NOT EXISTS (SELECT 1 FROM stray m WHERE m.source_table = k.source_table AND m.source_id = k.source_id)
   )
  ON CONFLICT (from_person_id, to_person_id, source_table, source_id) DO NOTHING;

  -- Rule c on EXISTING people: refresh name/phone per field from the newest
  -- non-blank sighting, never blanking a field we hold. This is what lets a
  -- person minted from a bare family_link acquire a name when a roster row
  -- later names them.
  UPDATE org_people p
     SET first_name = COALESCE(s.first_name, p.first_name),
         last_name  = COALESCE(s.last_name,  p.last_name),
         phone      = COALESCE(s.phone,      p.phone),
         updated_at = now()
    FROM (
      SELECT pe.person_id,
             (array_agg(o.first_name ORDER BY (o.first_name IS NULL), o.observed_at DESC))[1] AS first_name,
             (array_agg(o.last_name  ORDER BY (o.last_name  IS NULL), o.observed_at DESC))[1] AS last_name,
             (array_agg(o.phone      ORDER BY (o.phone      IS NULL), o.observed_at DESC))[1] AS phone
        FROM (
          SELECT r.org_id, lower(btrim(r.guardian_email)) AS email_normalized,
                 NULLIF(btrim(r.guardian_first_name), '') AS first_name,
                 NULLIF(btrim(r.guardian_last_name),  '') AS last_name,
                 NULLIF(btrim(r.guardian_phone),      '') AS phone,
                 r.updated_at AS observed_at
            FROM rep_roster_players r
           WHERE r.org_id = p_org_id AND r.guardian_email IS NOT NULL AND btrim(r.guardian_email) <> ''
           UNION ALL
          SELECT t.org_id, lower(btrim(t.guardian_email)),
                 NULLIF(btrim(t.guardian_first_name), ''), NULLIF(btrim(t.guardian_last_name), ''),
                 NULLIF(btrim(t.guardian_phone), ''), t.updated_at
            FROM rep_tryout_registrations t
           WHERE t.org_id = p_org_id AND t.guardian_email IS NOT NULL AND btrim(t.guardian_email) <> ''
           UNION ALL
          SELECT lr.org_id, lower(btrim(lr.guardian_email)),
                 NULLIF(btrim(lr.guardian_first_name), ''), NULLIF(btrim(lr.guardian_last_name), ''),
                 NULLIF(btrim(lr.guardian_phone), ''), lr.updated_at
            FROM league_registrations lr
           WHERE lr.org_id = p_org_id AND lr.guardian_email IS NOT NULL AND btrim(lr.guardian_email) <> ''
        ) o
        JOIN org_person_emails pe
          ON pe.org_id = o.org_id AND pe.email_normalized = o.email_normalized
       GROUP BY pe.person_id
    ) s
   WHERE p.id = s.person_id
     AND p.org_id = p_org_id
     AND (p.first_name IS DISTINCT FROM COALESCE(s.first_name, p.first_name)
       OR p.last_name  IS DISTINCT FROM COALESCE(s.last_name,  p.last_name)
       OR p.phone      IS DISTINCT FROM COALESCE(s.phone,      p.phone));

$$;

-- Service-role only, matching the tables it touches.
REVOKE ALL ON FUNCTION families_attach_people(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION families_attach_people(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION families_attach_people(uuid) TO service_role;

REVOKE ALL ON TABLE org_person_reattachments FROM anon, authenticated;
grant select, insert, update, delete on public.org_person_reattachments to service_role;

COMMIT;
