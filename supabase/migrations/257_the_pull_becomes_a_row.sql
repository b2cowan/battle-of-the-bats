-- 257: the walkthrough pull becomes a row — Pitch Deck Studio stage B.
--
-- Plan: docs/projects/active/PITCH_DECK_STUDIO_PLAN.md (phase B). The two public walkthrough
-- pages' SHORT PULLS (which library slides the scrolling page shows) move out of code into
-- owner-editable records. ⚠ COMPOSITION ONLY: a slide's words and picture stay in CODE (owner
-- ruling 1, 2026-08-21 — "decks are data, slides are code"), so this table stores slide NUMBERS
-- and never a sentence. Every invariant the build enforces on a pull moves into the save path
-- (lib/walkthrough-content.ts pullProblems()); the pages read this with the code pull as a
-- fallback, so a missing or broken row can never render an empty marketing page.
--
-- Posture: service-role only — RLS enabled, NO policies (mig 251 posture). Written by the
-- platform-admin studio API, read by the public walkthrough pages' server render.

CREATE TABLE IF NOT EXISTS pitch_page_pulls (
  -- One row per public walkthrough page, keyed by the persona whose deck it pulls from.
  persona     text PRIMARY KEY CHECK (persona IN ('tournament', 'coach')),
  -- The pull: an ordered jsonb array of permanent library numbers, e.g. ["#11","#27","#12"].
  -- Deliberately NOT foreign-keyed to anything: the slide bank lives in code
  -- (lib/walkthrough-content.ts), so referential integrity is the save path's job — and the
  -- reader's, which drops ids the bank no longer holds rather than blanking the page (plan F5).
  slide_ids   jsonb NOT NULL CHECK (jsonb_typeof(slide_ids) = 'array'),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- Who saved it — the platform-admin's email, for the studio's "saved by" line and the audit trail.
  updated_by  text
);

ALTER TABLE pitch_page_pulls ENABLE ROW LEVEL SECURITY;
-- No policies, deliberately: service-role only.
