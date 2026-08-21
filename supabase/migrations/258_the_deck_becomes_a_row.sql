-- 258: the deck becomes a row — Pitch Deck Studio stages C + D.
--
-- Plan: docs/projects/active/PITCH_DECK_STUDIO_PLAN.md (phases C and D). Stage B made the two
-- public pages' SHORT PULLS owner-editable rows (mig 257); this makes the DECKS themselves —
-- name, purpose, running order — owner-editable too, plus owner-created decks (the club deck,
-- and stage D's per-prospect decks with an unlisted share link).
--
-- ⚠ COMPOSITION ONLY, same ruling as 257 (owner ruling 1, 2026-08-21 — "decks are data, slides
-- are code"): a row stores slide NUMBERS plus the deck's own NAME and PURPOSE, and never a
-- slide's sentence or picture. The save path (lib/walkthrough-content.ts deckProblems()) is the
-- single rulebook, shared with the guard test — it also refuses a NAME or PURPOSE that names a
-- plan, tier or price, because stage D renders decks on a public route and a deck called
-- "Tournament Plus pitch" is exactly the class of accident the plan warns about.
--
-- The two STANDING decks (persona = 'tournament' / 'coach') keep their code fallback
-- (PITCH_DECKS): a missing, malformed, slow or rotten row can never blank a marketing page.
-- Owner-created decks (persona NULL) have no fallback — broken means "does not render", and the
-- studio says why.
--
-- Posture: service-role only — RLS enabled, NO policies (mig 251/257 posture). Written by the
-- platform-admin studio API; read by the public walkthrough pages' server render and (stage D)
-- the unlisted /pitch/<slug> route.

CREATE TABLE IF NOT EXISTS pitch_decks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Set ONLY on the two standing decks, joining each to its public walkthrough page and its
  -- code fallback. ⚠ This CHECK is an independent copy of the code's persona list (the comment
  -- above PITCH_DECKS in lib/walkthrough-content.ts explains the trap): a new persona is a new
  -- migration in the same unit of work, or the first save 500s opaquely.
  persona     text UNIQUE CHECK (persona IN ('tournament', 'coach')),
  -- The deck's own name and purpose — INTERNAL text (a prospect deck's name is the prospect
  -- label, and the public rendering never prints either; owner ruling 2, stage D). Still checked
  -- for plan words by the save path, belt and braces.
  name        text NOT NULL,
  purpose     text NOT NULL DEFAULT '',
  -- The running order: an ordered jsonb array of permanent library numbers. NOT foreign-keyed —
  -- the slide bank lives in code, so integrity is the save path's job and the reader drops rot
  -- rather than blanking a page (plan F5).
  slide_ids   jsonb NOT NULL CHECK (jsonb_typeof(slide_ids) = 'array'),
  -- Stage D: the unlisted, unguessable link a prospect deck is shared at (/pitch/<slug>).
  -- NULL for the standing decks, which are published on their walkthrough pages instead.
  -- Minted server-side from crypto randomness; anyone holding the link can open it (owner
  -- ruling 2 — accepted knowingly: marketing material, no customer data, noindex).
  share_slug  text UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- Who saved it — the platform-admin's email, for the studio's "saved by" line and the audit trail.
  updated_by  text
);

ALTER TABLE pitch_decks ENABLE ROW LEVEL SECURITY;
-- No policies, deliberately: service-role only.
