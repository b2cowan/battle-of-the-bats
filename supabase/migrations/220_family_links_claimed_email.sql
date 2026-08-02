-- ---------------------------------------------------------------
-- Migration 220 — the coach reviewing a mismatched claim can finally SEE the mismatch
--
-- Chunk D Slice 2 left a blocking follow-up behind (plan §9.3), found by that slice's review:
--
--   A coach invites a guardian at the address on the player's roster row. The parent claims
--   the link while signed in as a DIFFERENT address. That is not a failure — it is the exact
--   case the design routes to the approval queue on purpose, because a parent who signed up
--   with their work email should still get in, with the coach's eyes on it.
--
--   But the row the coach then reviews showed only `invited_email` — the address the COACH
--   themselves typed. The one fact that sent the row to the queue was the only fact not on it,
--   so the coach was asked to adjudicate a mismatch they could not see. That is a blind
--   approval on a surface that grants standing access to a child's records.
--
-- WHY A STORED COLUMN AND NOT A LIVE LOOKUP of the account's current email:
--   This is EVIDENCE behind an approval decision about a minor's data, and it sits beside
--   `consent_recorded_at` / `consent_ip`, which are captured the same way for the same reason.
--   A parent who changes their account email next season must not silently rewrite what the
--   coach was looking at when they approved. Capture the assertion at the moment it was made.
--
-- Written on EVERY claim, not only mismatches, so the column has one unambiguous meaning:
-- "the address the person who claimed this link actually held". The UI decides what is worth
-- surfacing (it shows it only when it differs). NULL therefore means "never claimed" — a
-- parent-initiated request, a coach invite still outstanding, or a row predating this column —
-- and never "claimed, but we didn't record it".
--
-- No backfill: no claimed row exists on prod (the guardian tier has never been switched on),
-- and inventing a value for a dev row would fabricate the very evidence this column exists to
-- hold honestly.
-- ---------------------------------------------------------------

ALTER TABLE family_links
  ADD COLUMN IF NOT EXISTS claimed_email text;

COMMENT ON COLUMN family_links.claimed_email IS
  'The normalized email the account that CLAIMED this invite actually holds, captured at claim '
  'time. Differs from invited_email exactly when the claim went to the approval queue for a '
  'mismatch. NULL = never claimed. Evidence for the coach''s approval decision — never used for '
  'authorization.';
