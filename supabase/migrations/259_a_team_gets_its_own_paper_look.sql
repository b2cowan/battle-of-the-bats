-- 259: a team gets its own paper look — PDF Export Quality Phase 1 (decision 7, owner 2026-08-21).
--
-- Plan: docs/projects/active/PDF_EXPORT_QUALITY_PLAN.md (§2 decision 7, §3 D4). Document branding
-- becomes TWO LAYERS: the club's PDF settings (organizations.pdf_settings) stay the source for
-- club-admin paper and are the INHERITED DEFAULT for team paper; this column is the team layer —
-- what the "How your documents look" card in the coaches-portal team settings writes.
--
-- Shape (all keys optional; an absent key means "inherit the club's"):
--   { "logoDataUrl": "data:image/png;base64,...",   -- the team crest, normalized ≤256px PNG
--     "accentColor": "#7a1f2b",                     -- the band across the page top + table heads
--     "footerText":  "Go Hawks — hawksu13.ca" }     -- one line at the foot of every page
--
-- Resolution (server-side, lib/export/resolve-pdf-settings.ts): team field → club field → default;
-- the NAME on team paper is always the team's name and is not stored here (it is not a setting).
-- Empty object = fully inherited. The card's "Use club look" writes {} back.

ALTER TABLE rep_teams
  ADD COLUMN IF NOT EXISTS pdf_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN rep_teams.pdf_settings IS
  'Team-layer document branding (logoDataUrl/accentColor/footerText), inherited from organizations.pdf_settings where absent. Written by the coaches-portal "How your documents look" card (head coach, pdf_template_settings plans).';
