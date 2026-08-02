-- ---------------------------------------------------------------
-- Migration 214 — Chunk D Slice 0 substrate: normalized guardian identity,
--                 a consent ledger, and a per-family email opt-out
--
-- Three independent pieces of plumbing that every later family surface rides on.
-- None of them is visible to anyone by itself; all three are what makes the
-- visible parts legal and correct.
--
-- (1) GUARDIAN EMAIL NORMALIZATION (plan 0.1)
--     `guardian_email` is described in the data dictionary as the de-facto family
--     identity, but nothing enforced its shape. Rows arriving from the public
--     tryout form kept whatever casing/whitespace the parent typed, while the
--     coach's roster entry got a different rendering of the same address. Every
--     match-by-email feature (family links, announcement dedupe, the per-family
--     unsubscribe below) then treats one parent as several people.
--     lib/guardian-email.ts is now the single write-path rule (trim + lowercase,
--     nothing cleverer — no dot-stripping or plus-tag folding, which are
--     provider-specific guesses that would MERGE distinct families).
--     This backfills the rows written before that rule existed.
--
-- (2) CONSENT LEDGER (plan 0.2)
--     `family_consents` records who consented, for which org, on what lawful
--     basis, when the basis started, and when it was withdrawn. CASL implied
--     consent from membership is real but time-boxed (24 months), so the basis
--     and its start date have to be data, not folklore. Backfilled from the
--     tryout form's existing express consents, which are the one strong trail
--     the product already had (discovery G8).
--
-- (3) FAMILY EMAIL OPT-OUT (plan 0.3)
--     "Email families" had no opt-out of its own — its lawful basis was purely
--     relational. `family_email_optouts` is the suppression list the send path
--     now honours, keyed (org, email) so a parent's choice covers every team in
--     that organization rather than only the team whose email they happened to
--     be reading.
--
-- Posture: both new tables are SERVICE-ROLE ONLY — RLS enabled, no policies.
-- The browser never queries them (mig 212 posture). They hold contact data and
-- consent records for minors' guardians; there is no client-side read path and
-- there must never be one.
-- ---------------------------------------------------------------

-- ── (1) Backfill: normalize existing guardian emails ────────────────────────────
-- Blank/whitespace-only becomes NULL where the column allows it: an empty string
-- is a value that sorts, dedupes and matches, and "no contact on file" must not
-- look like a contact. league_registrations.guardian_email is NOT NULL, so blanks
-- there are only trimmed/lowercased, never nulled.

-- `updated_at` is deliberately NOT bumped: normalizing casing is not an edit anyone made,
-- and touching every row's timestamp would make a whole roster look freshly changed to any
-- surface that reads recency.

UPDATE rep_roster_players
   SET guardian_email = NULLIF(lower(btrim(guardian_email)), '')
 WHERE guardian_email IS NOT NULL
   AND guardian_email IS DISTINCT FROM NULLIF(lower(btrim(guardian_email)), '');

UPDATE rep_tryout_registrations
   SET guardian_email = lower(btrim(guardian_email))
 WHERE guardian_email IS NOT NULL
   AND guardian_email IS DISTINCT FROM lower(btrim(guardian_email));

UPDATE league_registrations
   SET guardian_email = lower(btrim(guardian_email))
 WHERE guardian_email IS NOT NULL
   AND guardian_email IS DISTINCT FROM lower(btrim(guardian_email));

-- ── (2) Consent ledger ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS family_consents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- The consenting adult, identified the way the platform actually knows them:
  -- by normalized email always, by account only once they have one.
  guardian_email    text NOT NULL,
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- What makes contacting / holding data on this family lawful.
  --   express_link          — they ticked the boxes on a family link request (strongest)
  --   tryout_form           — the tryout registration's express consents (backfilled below)
  --   registration_implied  — CASL implied consent from an existing membership/registration;
  --                           time-boxed at 24 months from basis_started_at
  basis             text NOT NULL CHECK (basis IN ('express_link', 'tryout_form', 'registration_implied')),
  basis_started_at  timestamptz NOT NULL DEFAULT now(),
  withdrawn_at      timestamptz,

  -- Scope + provenance. `source_table`/`source_id` point at the row that carried the
  -- consent, so an auditor can walk from the ledger back to the artifact.
  scope             text NOT NULL DEFAULT 'family_comms'
                      CHECK (scope IN ('family_comms', 'child_data', 'marketing')),
  source_table      text,
  source_id         uuid,

  -- Evidence captured at the moment of consent (the tryout form already does this).
  consent_ip        text,
  consent_text      text,

  -- Jurisdiction signal so a Quebec Law 25 / future COPPA flow can branch later
  -- without a data-model rebuild (discovery §3 privacy rule 4).
  jurisdiction      text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- One live consent per (org, guardian, basis, scope). Withdrawing does not delete
-- history — it stamps withdrawn_at — so the uniqueness applies to LIVE rows only
-- and a re-consent after withdrawal is a new row.
CREATE UNIQUE INDEX IF NOT EXISTS family_consents_live_uniq
  ON family_consents (org_id, guardian_email, basis, scope)
  WHERE withdrawn_at IS NULL;

CREATE INDEX IF NOT EXISTS family_consents_org_email_idx ON family_consents (org_id, guardian_email);
CREATE INDEX IF NOT EXISTS family_consents_user_idx      ON family_consents (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE family_consents ENABLE ROW LEVEL SECURITY;
-- No policies, deliberately: service-role only (mig 212 posture).

-- Backfill from the tryout form's express consents — the one strong existing trail.
-- Only rows that actually recorded a data-collection consent qualify; ON CONFLICT
-- keeps the earliest basis_started_at when a guardian registered more than once.
INSERT INTO family_consents (org_id, guardian_email, basis, basis_started_at, scope, source_table, source_id, consent_ip)
SELECT DISTINCT ON (r.org_id, lower(btrim(r.guardian_email)))
       r.org_id,
       lower(btrim(r.guardian_email)),
       'tryout_form',
       COALESCE(r.consent_at, r.submitted_at),
       'child_data',
       'rep_tryout_registrations',
       r.id,
       r.consent_ip
  FROM rep_tryout_registrations r
 WHERE r.consent_data_collection IS TRUE
   AND r.guardian_email IS NOT NULL
   AND btrim(r.guardian_email) <> ''
 ORDER BY r.org_id, lower(btrim(r.guardian_email)), COALESCE(r.consent_at, r.submitted_at) ASC
ON CONFLICT DO NOTHING;

-- The tryout form's OPTIONAL marketing tick is a separate lawful basis with a
-- separate scope — unbundled 2026-07-30 and it must stay unbundled here too.
INSERT INTO family_consents (org_id, guardian_email, basis, basis_started_at, scope, source_table, source_id, consent_ip)
SELECT DISTINCT ON (r.org_id, lower(btrim(r.guardian_email)))
       r.org_id,
       lower(btrim(r.guardian_email)),
       'tryout_form',
       COALESCE(r.consent_at, r.submitted_at),
       'marketing',
       'rep_tryout_registrations',
       r.id,
       r.consent_ip
  FROM rep_tryout_registrations r
 WHERE r.consent_email_comms IS TRUE
   AND r.guardian_email IS NOT NULL
   AND btrim(r.guardian_email) <> ''
 ORDER BY r.org_id, lower(btrim(r.guardian_email)), COALESCE(r.consent_at, r.submitted_at) ASC
ON CONFLICT DO NOTHING;

-- ── (3) Per-family email opt-out (suppression list) ────────────────────────────

CREATE TABLE IF NOT EXISTS family_email_optouts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Normalized (lower/trim) — the same key lib/guardian-email.ts produces.
  email         text NOT NULL,
  opted_out_at  timestamptz NOT NULL DEFAULT now(),
  -- Which surface the opt-out arrived from, for the record. Not a scope: an
  -- opt-out suppresses ALL family email from this org, which is the honest
  -- reading of a parent clicking "unsubscribe" in a team email.
  source        text NOT NULL DEFAULT 'announcement_footer',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS family_email_optouts_org_email_uniq
  ON family_email_optouts (org_id, email);

ALTER TABLE family_email_optouts ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only. The unsubscribe route runs server-side with the
-- signed token as its authorization — it never needs a browser-visible read path.
