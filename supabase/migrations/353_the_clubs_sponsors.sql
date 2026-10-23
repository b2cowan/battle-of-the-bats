-- Club Tier Stage 4d: the club's sponsors (words CLUB_TIER_STAGE4D_COPY.md; drawings ruled 2026-10-19 Ask 17, gate 2026-10-23).
--
-- One more list on the club's public-site row, beside contacts / documents / questions (mig 343). A short list owned by one
-- row, read whole and saved whole, is a jsonb array here for the same reason as the other three: it has no rows another
-- table points at, it is never queried across clubs, and a CHECK keeps it small. A table would earn nothing and would add
-- a join to every public page. It is NOT the coach side's sponsorships (those are a team's money, a different thing).
--
-- The cap (20) is lib/public-site-patch.ts LIST_MAX.sponsors; the two numbers are held equal by a test. The row shape is
-- checked by the route and re-checked on read, so a row written some other way never reaches a page unchecked.

ALTER TABLE public.org_public_site_content
  ADD COLUMN IF NOT EXISTS sponsors jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.org_public_site_content
  DROP CONSTRAINT IF EXISTS org_public_site_content_sponsors_cap,
  ADD CONSTRAINT org_public_site_content_sponsors_cap
    CHECK (jsonb_typeof(sponsors) = 'array' AND jsonb_array_length(sponsors) <= 20);

COMMENT ON COLUMN public.org_public_site_content.sponsors IS
  'The club''s sponsors, shown as a strip on the home page and a section of the About page (mig 353): '
  '[{ id, name, logoUrl?, link?, endsOn? }], in the club''s order, at most 20. Only name is required; an absent field is an '
  'absent key. logoUrl is a file the club uploaded to org-logos/{org_id}/sponsors/; link is https; endsOn is the LAST day it '
  'shows (YYYY-MM-DD, inclusive, club zone). An ended sponsor stays here (the editor marks it Ended); the public pages filter it.';
