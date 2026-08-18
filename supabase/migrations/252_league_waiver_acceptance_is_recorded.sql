-- ---------------------------------------------------------------
-- Migration 252 — Families Book Phase 2, chunk 0:
--                 league waiver acceptance is finally RECORDED,
--                 and attaching people becomes a callable, org-scoped operation
--
-- Two findings from the Phase 2 mockup session (plan §5.3), both verified
-- against the live code before this file was written:
--
-- (1) THE LEAGUE WAIVER WAS REQUIRED BUT NEVER STORED. The public registration
--     form refuses to submit unless the guardian ticks the waiver box — and then
--     writes nothing. No column exists. The club can prove no guardian ever
--     agreed to anything. `waiver_accepted_at` records the moment of acceptance;
--     the register route also files a family_consents ledger row carrying the
--     season's waiver text as evidence (family_consents already has consent_text
--     for exactly this). Historical rows are NOT backfilled: their acceptance
--     was never witnessed, and NULL = "not recorded" is the honest value.
--     The basis CHECK gains 'league_registration' for those ledger rows.
--
-- (2) ATTACHING A GUARDIAN TO A PERSON MUST NOT BE RE-IMPLEMENTED PER WRITE
--     PATH. ~10 routes create or edit guardian emails (public league form,
--     admin manual registration, coach roster add/edit/bulk-paste, tryout
--     accept, public tryout form, family links...). Wiring person-minting into
--     each is how ten slightly different copies of one rule appear — the exact
--     failure lib/guardian-email.ts exists to prevent. Instead, migration 251's
--     backfill (already idempotent by construction: ON CONFLICT DO NOTHING +
--     "attach only where person_id IS NULL") becomes `families_attach_people(org)`,
--     an org-scoped function the Families area runs when it opens. One home for
--     the matching rules; the write paths stay untouched; the worklist is always
--     current the moment an admin looks at it. At club sizes (hundreds of rows,
--     partial indexes on person_id IS NULL) this is milliseconds.
--
--     The function repeats 251's rules deliberately and exactly:
--       a. SHAPE GATE — a malformed address mints nothing.
--       b. ONE ALIAS HOP, NEVER A CHAIN — family_links invited→claimed only,
--          refusing ambiguity and chains.
--       c. NEWEST NON-BLANK WINS, PER FIELD — for name/phone on NEW people only;
--          an existing person's fields are refreshed per-field from newer
--          sightings, never blanked.
--       d. NO ROW IS EVER REASSIGNED — attach only where person_id IS NULL.
--
-- ALSO FIXED IN THIS CHUNK (code, not schema): migration 251 made
-- league_registrations.org_id NOT NULL, but createRegistration() never set it —
-- every league registration INSERT (public form AND admin manual add) has
-- failed on dev since 251 was applied. The insert now carries org_id.
--
-- Posture: unchanged. org_people / org_person_emails / family_consents remain
-- service-role only (RLS enabled, no policies). The new function is EXECUTE-able
-- by service_role only.
--
-- Safety: additive. No column dropped, no row destroyed, idempotent.
-- Applies to: DEV. Production is a separate, explicit owner step.
-- ---------------------------------------------------------------

BEGIN;

-- ── (1) League waiver acceptance ───────────────────────────────────────────────

ALTER TABLE league_registrations
  ADD COLUMN IF NOT EXISTS waiver_accepted_at timestamptz;

COMMENT ON COLUMN league_registrations.waiver_accepted_at IS
  'When the guardian accepted the season waiver on the public form. NULL = not '
  'recorded: admin-manual rows (no guardian saw a waiver) and every row written '
  'before migration 252 (acceptance was required but never stored — mockup '
  'session finding, plan §5.3 gap 7). Never backfilled.';

-- family_consents.basis learns the new lawful-basis value. The original CHECK
-- was declared inline in migration 214; its auto-name is family_consents_basis_check.
ALTER TABLE family_consents DROP CONSTRAINT IF EXISTS family_consents_basis_check;
ALTER TABLE family_consents ADD CONSTRAINT family_consents_basis_check
  CHECK (basis IN ('express_link', 'tryout_form', 'registration_implied', 'league_registration'));

-- ── (2) families_attach_people(org) — the one home for mint-and-attach ─────────
-- Body mirrors migration 251's backfill, scoped to one org. Read 251's header
-- before changing ANY rule here; the two must never diverge, and when 251 is
-- superseded this function is the single survivor.

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
  INSERT INTO org_person_emails (org_id, person_id, email_normalized, is_current, first_seen_at, last_seen_at)
  SELECT c.org_id, p.id, c.email_normalized,
         (c.email_normalized = c.canon_email),
         min(c.observed_at), max(c.observed_at)
    FROM canonical c
    JOIN org_people p ON p.org_id = c.org_id AND p.email_normalized = c.canon_email
   WHERE c.canon_email      ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     AND c.email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
   GROUP BY c.org_id, p.id, c.email_normalized, (c.email_normalized = c.canon_email)
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
     AND pe.email_normalized = lower(btrim(COALESCE(NULLIF(btrim(f.claimed_email), ''), f.invited_email)))
     AND f.person_id IS NULL;

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

COMMIT;
