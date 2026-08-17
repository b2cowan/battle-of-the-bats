-- ---------------------------------------------------------------
-- Migration 251 — Families Book Phase 1: a guardian becomes a person
--
-- Today a parent has NO ROW ANYWHERE. Their identity is a text email typed onto
-- each child's record, re-typed per child, per season, per program. 70 distinct
-- guardians are named on roster rows; exactly one has a login. A parent with two
-- children on two teams is two unrelated entries, and changing their email
-- address does not update a parent — it creates a stranger.
--
-- This migration mints the missing row. NOTHING IN THE PRODUCT READS ANY OF IT.
-- No screen, no route, no API, no capability. Phase 1 ends with a report
-- (scripts/report-families-backfill.mjs), not with a feature.
--
-- Plan:    docs/projects/active/CLUB_FAMILIES_BOOK_PLAN.md
-- Brief:   docs/projects/active/CLUB_FAMILIES_BOOK_PM_BRIEF.md
-- Origin:  Finding #35, docs/agents/db/DB_ARCHITECTURE_REVIEW.md (2026-08-17)
--
-- ── WHAT THIS DOES ─────────────────────────────────────────────────────────────
--
-- (1) league_registrations.org_id — denormalized, NOT NULL, indexed.
--     It is the only one of the four sources that cannot name its own tenant; it
--     reaches org 2-hop via season_id → league_seasons.org_id. Every tenant-scoped
--     read of it is therefore a join, and the standing 1-hop tenancy rule
--     (Findings #4/#5) says that is wrong. Verified before adding: all 23 live
--     rows reach an org through the season, so NOT NULL is safe without a
--     fallback.
--
-- (2) org_people — the person record. ORG-SCOPED, NEVER PLATFORM-WIDE. The same
--     parent at two clubs is DELIBERATELY two records: a platform-wide person
--     would let one club's data confirm that a guardian exists at another. That
--     is a privacy leak dressed as a convenience, and the scoping is the whole
--     defence against it.
--
-- (3) org_person_emails — every address ever seen for a person, current and
--     former, all searchable. This is what closes the "they changed their email
--     and became a stranger" failure rather than papering over it, and it is what
--     makes a later merge safe: you can see WHY two addresses are one person.
--
-- (4) person_id on the four sources — nullable, ON DELETE SET NULL. The
--     relationship "who are this child's guardians" is "every source row for that
--     child carrying a person_id", unioned across rep and league. It is NOT a new
--     relationship table.
--
--     ⚠ family_links is NOT promoted into that role, and an earlier draft of the
--     plan was wrong to propose it. family_links.rep_team_id is NOT NULL, so it is
--     rep-team-bound BY CONSTRUCTION and cannot represent a house-league child's
--     guardian at all. It keeps its existing job (portal access for a rep team's
--     guardians) and merely gains person_id. It also covers only the 12 invited
--     families against 70 named guardians — it was never going to be the spine.
--
--     ⚠ basic_coach_team_players is deliberately NOT a source. basic_coach_teams
--     has NO org_id — the free coach product hangs off team_workspaces, not an
--     org — so an ORG-SCOPED person record has no org to scope those rows to.
--
-- (5) The backfill, applying the plan's §4 matching rules.
--
-- ── WHAT THIS DELIBERATELY DOES NOT DO ─────────────────────────────────────────
--
-- ⚠ NO CONTACT PREFERENCE IS COPIED ONTO THE PERSON, and that is the correctness
--   decision in this file, not an omission.
--
--   The plan's rule is "where preferences meet, the STRICTEST wins" — a merged
--   person must never inherit a weaker preference than any of its sources,
--   because a "newest wins" default silently re-subscribes people who asked not
--   to be contacted. The safest way to honour that rule in Phase 1 is to store
--   NOTHING: family_email_optouts (org_id, email) and family_consents
--   (org_id, guardian_email) are ALREADY keyed on exactly the identity key
--   org_people uses, so a person inherits them by join, for free, with no second
--   copy that could drift. Copying them here would be the twin-table problem
--   (Finding #34) reappearing in the one place where being wrong means emailing
--   someone who opted out. Plan §6 puts "contact preferences attached to the
--   person" in Phase 3; that is where a stored, strictness-resolved preference
--   belongs, and the report counts today's conflicts so Phase 3 starts with real
--   numbers.
--
--   ⚠ ONE THING PHASE 3 MUST NOT MISS, recorded here while the reason is fresh:
--   once org_person_emails holds FORMER addresses, an opt-out recorded against a
--   former address must suppress sends to the CURRENT one. The suppression check
--   has to run through the PERSON, not through the address it was filed under.
--   Today's (org, email) lookup would let an email change quietly undo an opt-out
--   — the precise failure this project exists to prevent.
--
-- ⚠ NOTHING IS MERGED. Phase 1 auto-matches on EXACT NORMALIZED EMAIL ONLY. Same
--   surname + same phone, and same surname + a shared child, are DETECTED AND
--   COUNTED by the report, never acted on. A wrong merge shows one parent another
--   parent's children, which is strictly worse than leaving duplicates.
--
-- ⚠ NO EXISTING COLUMN IS DROPPED OR REWRITTEN. Every guardian_email stays
--   exactly as typed — the honest record of what was actually entered. That is
--   what keeps every phase of this project reversible.
--
-- ⚠ source-row updated_at is NOT bumped when person_id is attached. Attaching a
--   person is not an edit anyone made, and touching updated_at would make whole
--   rosters look freshly changed to every surface that reads recency. Same
--   precedent as migration 214's normalization backfill. Verified before relying
--   on it: none of the four source tables carries an updated_at trigger.
--
-- Posture: both new tables are SERVICE-ROLE ONLY — RLS enabled, NO POLICIES
-- (migration 091 / 212 / 214 posture, Finding #30). They concentrate contact
-- details for minors' guardians across an entire club. There is no client-side
-- read path today and there must never be one; Phase 2 reads them server-side
-- behind the Families capability.
--
-- Safety: additive only. No column, constraint, policy or row is destroyed. Every
-- statement is IF NOT EXISTS / idempotent, so re-running is a no-op — the
-- backfill's ON CONFLICT DO NOTHING and IS DISTINCT FROM guards make a second run
-- attach nothing new. Plain CREATE INDEX (not CONCURRENTLY) is correct at this
-- size (the largest source table is 163 rows) and keeps the migration
-- transactional.
--
-- Applies to: DEV. Production is a separate, explicit owner step.
-- ---------------------------------------------------------------

BEGIN;

-- ── (1) league_registrations learns its own tenant ─────────────────────────────

ALTER TABLE league_registrations
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE league_registrations lr
   SET org_id = ls.org_id
  FROM league_seasons ls
 WHERE ls.id = lr.season_id
   AND lr.org_id IS DISTINCT FROM ls.org_id;

-- Safe because every live row reaches an org through its season; a row that
-- somehow does not would fail here rather than silently becoming untenanted.
ALTER TABLE league_registrations ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS league_registrations_org_id_idx
  ON league_registrations (org_id);

-- ── (2) org_people — the person record ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_people (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- The person's CURRENT address, and their identity within this org. Always
  -- normalized by the one rule in lib/guardian-email.ts (trim + lowercase,
  -- nothing cleverer — no dot-stripping or plus-tag folding, which are
  -- provider-specific guesses that would MERGE two distinct families).
  -- Former addresses live in org_person_emails, which also carries a row for
  -- this one; see the invariant note under that table.
  email_normalized  text NOT NULL,

  first_name        text,
  last_name         text,
  phone             text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT org_people_email_normalized_check
    CHECK (email_normalized = lower(btrim(email_normalized)) AND email_normalized <> '')
);

-- One person per (org, address). This uniqueness IS the "auto-match on exact
-- normalized email" rule, expressed where it cannot be forgotten by a caller.
-- It also covers org_id for the tenancy-index rule (mig 249): org_id LEADS it,
-- so a plain org_id index would be redundant debt.
CREATE UNIQUE INDEX IF NOT EXISTS org_people_org_email_uniq
  ON org_people (org_id, email_normalized);

-- No name/phone index here on purpose. Nothing searches this table yet, and the
-- duplicate scan is a one-off report over a few hundred rows. Phase 2's search
-- decides what it actually needs; a speculative index now is debt with a
-- plausible-sounding justification.

ALTER TABLE org_people ENABLE ROW LEVEL SECURITY;
-- No policies, deliberately: service-role only.

-- ── (3) org_person_emails — current AND former addresses, all searchable ───────

CREATE TABLE IF NOT EXISTS org_person_emails (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Denormalized so the tenant is 1 hop from the address, which is how search
  -- will read this table (Findings #4/#5).
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id         uuid NOT NULL REFERENCES org_people(id) ON DELETE CASCADE,

  email_normalized  text NOT NULL,
  is_current        boolean NOT NULL DEFAULT true,

  -- When this address was first and last seen on any source row. Distinct from
  -- created_at/updated_at, which record when WE wrote the row.
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT org_person_emails_email_normalized_check
    CHECK (email_normalized = lower(btrim(email_normalized)) AND email_normalized <> '')
);

-- An address belongs to at most ONE person within an org. This is what makes
-- resolution unambiguous: a source row's typed address is looked up here, and
-- lands on exactly one person whether that address is their current one or one
-- they abandoned three seasons ago.
-- org_id leads it, so it also satisfies the tenancy-index rule.
CREATE UNIQUE INDEX IF NOT EXISTS org_person_emails_org_email_uniq
  ON org_person_emails (org_id, email_normalized);

-- Exactly one CURRENT address per person. Together with the unique index above
-- this holds the invariant that org_people.email_normalized is always mirrored
-- here by the person's single is_current row — the two tables cannot disagree
-- about which address is live.
CREATE UNIQUE INDEX IF NOT EXISTS org_person_emails_one_current_uniq
  ON org_person_emails (person_id)
  WHERE is_current;

-- Follow the FK backwards: "every address for this person" (mig 249's rule).
CREATE INDEX IF NOT EXISTS org_person_emails_person_id_idx
  ON org_person_emails (person_id);

ALTER TABLE org_person_emails ENABLE ROW LEVEL SECURITY;
-- No policies, deliberately: service-role only.

-- ── (4) person_id on the four sources ──────────────────────────────────────────
-- Nullable forever: a roster row with no guardian email, or a malformed one, has
-- no person and must stay usable. ON DELETE SET NULL — removing a person must
-- never remove a child's roster row.

ALTER TABLE rep_roster_players
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES org_people(id) ON DELETE SET NULL;
ALTER TABLE rep_tryout_registrations
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES org_people(id) ON DELETE SET NULL;
ALTER TABLE league_registrations
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES org_people(id) ON DELETE SET NULL;
ALTER TABLE family_links
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES org_people(id) ON DELETE SET NULL;

-- Partial on IS NOT NULL — the ONE predicate that still serves a plain equality
-- lookup (mig 249 trap 1), and the right shape while most rows are unattached.
CREATE INDEX IF NOT EXISTS rep_roster_players_person_id_idx
  ON rep_roster_players (person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rep_tryout_registrations_person_id_idx
  ON rep_tryout_registrations (person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS league_registrations_person_id_idx
  ON league_registrations (person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS family_links_person_id_idx
  ON family_links (person_id) WHERE person_id IS NOT NULL;

-- ── (5) BACKFILL ───────────────────────────────────────────────────────────────
--
-- Deliberately conservative. Read the four rules before changing any of it:
--
--   a. SHAPE GATE. An address that is not plausibly an address mints NOTHING.
--      The pattern is the same one lib/guardian-email.ts uses to decide an
--      address is sendable, so "we made a person for them" and "we would email
--      them" can never disagree. Rows failing it keep person_id NULL and are
--      counted by the report as children we could not confidently attach —
--      which is the honest outcome, not a failure to try harder.
--
--   b. ONE ALIAS HOP, NEVER A CHAIN. A family_links row whose claimed_email
--      differs from its invited_email is the strongest identity evidence the
--      platform has: the same human opened a signed invitation sent to A and
--      signed in as B. That is one person with two addresses, recorded as such —
--      NOT two people merged on a guess. But chains (A→B where B→C) and
--      ambiguity (A→B and A→C) are refused outright and reported, because
--      resolving them means choosing, and choosing wrong shows one parent
--      another parent's children.
--
--   c. NEWEST NON-BLANK WINS, PER FIELD INDEPENDENTLY. A person's name comes
--      from the most recent source row that actually carried a name; their phone
--      from the most recent row that carried a phone — which may be a different
--      row. Resolving the whole record from one "winning" row would let a recent
--      registration that omitted the phone number erase a phone number we hold.
--      ⚠ This applies to NAME AND PHONE ONLY. It is emphatically NOT applied to
--      contact preferences — see the header. Newest-wins on a preference is how
--      you re-subscribe someone who opted out.
--
--   d. NO ROW IS EVER REASSIGNED. Every write is guarded so a re-run attaches
--      only what is still unattached.

WITH observed AS (
  -- Every (org, address) sighting across the four sources, with whatever the
  -- typist gave us alongside it and when that row was last touched.
  SELECT r.org_id,
         lower(btrim(r.guardian_email))            AS email_normalized,
         NULLIF(btrim(r.guardian_first_name), '')  AS first_name,
         NULLIF(btrim(r.guardian_last_name),  '')  AS last_name,
         NULLIF(btrim(r.guardian_phone),      '')  AS phone,
         r.updated_at                              AS observed_at
    FROM rep_roster_players r
   WHERE r.guardian_email IS NOT NULL AND btrim(r.guardian_email) <> ''

   UNION ALL

  SELECT t.org_id,
         lower(btrim(t.guardian_email)),
         NULLIF(btrim(t.guardian_first_name), ''),
         NULLIF(btrim(t.guardian_last_name),  ''),
         NULLIF(btrim(t.guardian_phone),      ''),
         t.updated_at
    FROM rep_tryout_registrations t
   WHERE t.guardian_email IS NOT NULL AND btrim(t.guardian_email) <> ''

   UNION ALL

  -- org_id is populated by step (1) above, so no season join is needed here.
  SELECT lr.org_id,
         lower(btrim(lr.guardian_email)),
         NULLIF(btrim(lr.guardian_first_name), ''),
         NULLIF(btrim(lr.guardian_last_name),  ''),
         NULLIF(btrim(lr.guardian_phone),      ''),
         lr.updated_at
    FROM league_registrations lr
   WHERE lr.guardian_email IS NOT NULL AND btrim(lr.guardian_email) <> ''

   UNION ALL

  -- family_links carries no guardian name or phone of its own — it contributes
  -- addresses only, which is exactly its value here (it is the one source that
  -- can witness the SAME person under TWO addresses).
  SELECT f.org_id, lower(btrim(f.invited_email)), NULL, NULL, NULL, f.updated_at
    FROM family_links f
   WHERE btrim(f.invited_email) <> ''

   UNION ALL

  SELECT f.org_id, lower(btrim(f.claimed_email)), NULL, NULL, NULL, f.updated_at
    FROM family_links f
   WHERE f.claimed_email IS NOT NULL AND btrim(f.claimed_email) <> ''
),

-- ── rule (b): one alias hop, never a chain ─────────────────────────────────────
alias_raw AS (
  SELECT f.org_id,
         lower(btrim(f.invited_email)) AS from_email,
         lower(btrim(f.claimed_email)) AS to_email
    FROM family_links f
   WHERE f.claimed_email IS NOT NULL
     AND btrim(f.claimed_email) <> ''
     AND btrim(f.invited_email) <> ''
     AND lower(btrim(f.claimed_email)) IS DISTINCT FROM lower(btrim(f.invited_email))
),
-- Refuse ambiguity: one old address that points at two different new ones is not
-- evidence, it is a contradiction. Left unresolved, reported.
alias_unambiguous AS (
  SELECT org_id, from_email, min(to_email) AS to_email
    FROM alias_raw
   GROUP BY org_id, from_email
  HAVING count(DISTINCT to_email) = 1
),
-- Refuse chains: resolving A→B→C means deciding C is A, which is two hops of
-- inference and one hop more than we are willing to make automatically.
alias AS (
  SELECT s.*
    FROM alias_unambiguous s
   WHERE NOT EXISTS (SELECT 1 FROM alias_unambiguous t
                      WHERE t.org_id = s.org_id AND t.from_email = s.to_email)
     AND NOT EXISTS (SELECT 1 FROM alias_unambiguous t
                      WHERE t.org_id = s.org_id AND t.to_email = s.from_email)
),

canonical AS (
  SELECT o.*,
         COALESCE(a.to_email, o.email_normalized) AS canon_email
    FROM observed o
    LEFT JOIN alias a
      ON a.org_id = o.org_id AND a.from_email = o.email_normalized
)

-- ── rule (a) + (c): mint the people ────────────────────────────────────────────
INSERT INTO org_people (org_id, email_normalized, first_name, last_name, phone)
SELECT c.org_id,
       c.canon_email,
       (array_agg(c.first_name ORDER BY (c.first_name IS NULL), c.observed_at DESC))[1],
       (array_agg(c.last_name  ORDER BY (c.last_name  IS NULL), c.observed_at DESC))[1],
       (array_agg(c.phone      ORDER BY (c.phone      IS NULL), c.observed_at DESC))[1]
  FROM canonical c
 WHERE c.canon_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 GROUP BY c.org_id, c.canon_email
ON CONFLICT (org_id, email_normalized) DO NOTHING;

-- ── the address book: every sighting, current and former ───────────────────────
-- Recomputes the same CTEs deliberately rather than materializing them: this runs
-- once, over hundreds of rows, and a temp table here would be a moving part with
-- no benefit.

WITH observed AS (
  SELECT r.org_id, lower(btrim(r.guardian_email)) AS email_normalized, r.updated_at AS observed_at
    FROM rep_roster_players r
   WHERE r.guardian_email IS NOT NULL AND btrim(r.guardian_email) <> ''
   UNION ALL
  SELECT t.org_id, lower(btrim(t.guardian_email)), t.updated_at
    FROM rep_tryout_registrations t
   WHERE t.guardian_email IS NOT NULL AND btrim(t.guardian_email) <> ''
   UNION ALL
  SELECT lr.org_id, lower(btrim(lr.guardian_email)), lr.updated_at
    FROM league_registrations lr
   WHERE lr.guardian_email IS NOT NULL AND btrim(lr.guardian_email) <> ''
   UNION ALL
  SELECT f.org_id, lower(btrim(f.invited_email)), f.updated_at
    FROM family_links f
   WHERE btrim(f.invited_email) <> ''
   UNION ALL
  SELECT f.org_id, lower(btrim(f.claimed_email)), f.updated_at
    FROM family_links f
   WHERE f.claimed_email IS NOT NULL AND btrim(f.claimed_email) <> ''
),
alias_raw AS (
  SELECT f.org_id,
         lower(btrim(f.invited_email)) AS from_email,
         lower(btrim(f.claimed_email)) AS to_email
    FROM family_links f
   WHERE f.claimed_email IS NOT NULL
     AND btrim(f.claimed_email) <> ''
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
SELECT c.org_id,
       p.id,
       c.email_normalized,
       (c.email_normalized = c.canon_email),
       min(c.observed_at),
       max(c.observed_at)
  FROM canonical c
  JOIN org_people p
    ON p.org_id = c.org_id AND p.email_normalized = c.canon_email
 -- BOTH must be well-shaped: a malformed old address does not become searchable
 -- history just because its replacement is valid.
 WHERE c.canon_email       ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
   AND c.email_normalized  ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 GROUP BY c.org_id, p.id, c.email_normalized, (c.email_normalized = c.canon_email)
ON CONFLICT (org_id, email_normalized) DO NOTHING;

-- ── rule (d): attach the source rows ───────────────────────────────────────────
-- Resolution goes through org_person_emails, NOT org_people. That is the whole
-- point of the address book: a row still carrying a parent's OLD address lands on
-- the same person as a row carrying their new one.
--
-- updated_at is deliberately untouched (see header).

UPDATE rep_roster_players r
   SET person_id = pe.person_id
  FROM org_person_emails pe
 WHERE pe.org_id = r.org_id
   AND pe.email_normalized = lower(btrim(r.guardian_email))
   AND r.guardian_email IS NOT NULL
   AND r.person_id IS NULL;

UPDATE rep_tryout_registrations t
   SET person_id = pe.person_id
  FROM org_person_emails pe
 WHERE pe.org_id = t.org_id
   AND pe.email_normalized = lower(btrim(t.guardian_email))
   AND t.guardian_email IS NOT NULL
   AND t.person_id IS NULL;

UPDATE league_registrations lr
   SET person_id = pe.person_id
  FROM org_person_emails pe
 WHERE pe.org_id = lr.org_id
   AND pe.email_normalized = lower(btrim(lr.guardian_email))
   AND lr.guardian_email IS NOT NULL
   AND lr.person_id IS NULL;

-- Prefer the address they actually signed in with; fall back to the one we
-- invited. Both resolve to the same person when the alias hop was accepted.
UPDATE family_links f
   SET person_id = pe.person_id
  FROM org_person_emails pe
 WHERE pe.org_id = f.org_id
   AND pe.email_normalized = lower(btrim(COALESCE(NULLIF(btrim(f.claimed_email), ''), f.invited_email)))
   AND f.person_id IS NULL;

COMMIT;

-- ---------------------------------------------------------------
-- WHAT HAPPENS NEXT — do not skip this.
--
--   node scripts/report-families-backfill.mjs --dev
--
-- Phase 1 is NOT "the migration ran". It is the report the owner reads: families
-- created per org and per source, suspected duplicates, children we could not
-- confidently attach, and guardians appearing in more than one source. If those
-- numbers look wrong, matching gets fixed BEFORE any screen exists. A clean run
-- is not approval.
-- ---------------------------------------------------------------
