-- 343: a club runs its own site — Club Tier Stage 4c-1 (drawings ruled 2026-10-19, Asks 6, 10, 16; owner gate 2026-10-21).
--
-- Plan: docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md §6 Stage 4c. Words: CLUB_TIER_STAGE4C1_COPY.md.
-- Additive only. The two old home switches are KEPT (deprecated) and the new code MIRRORS them whenever it saves the
-- hidden list: production code reads them until the promote, a rollback would read them again, and re-running the
-- carry-over below must not re-hide a section the club showed. A column drop goes last, in its own later migration.
--
-- Where each thing lives, and why:
--   • The home's section order and show/hide, and the About page's three lists (contacts, documents, questions), are
--     the SITE's words: few, capped, always read whole by one public page and written by one editor. They go on the
--     site's one row (org_public_site_content), as arrays, with the caps as CHECKs so no path can exceed them.
--     Rejected: a table per list. Three tables, three RLS surfaces and three joins on every public About read, to hold
--     at most 52 short rows a club edits a few times a year. The cost of the array — two admins saving the same list in
--     the same second keep the later save — is accepted and written down (dictionary gotcha 6).
--   • The club notice is an EVENT, with an author and a life: posted, maybe replaced, ended by hand or by its clock. It
--     goes in its own table, one row per post, so who posted what and when survives, and a replaced or ended notice is
--     a closed row, never an overwrite.
--     "One at a time" is a READ rule, not an index: the live notice is the newest row that is not ended and whose
--     ends_at is still ahead. Posting inserts the new row first and then closes the older ones, so a failure between
--     the two still shows the newest notice — never none. (A partial unique index would force the opposite order,
--     where a failed insert after the close leaves a field-closure night with no notice at all.)

-- ── 1. The home's sections ──────────────────────────────────────────────────────────────────────────────────────
-- Open now is not listed: it is always first and shows only while something is open (ruled, not configurable).
-- The default is today's ruled order (Ask 3A) + Past tournaments, so no existing club's home moves.
ALTER TABLE public.org_public_site_content
  ADD COLUMN IF NOT EXISTS home_section_order text[] NOT NULL
    DEFAULT ARRAY['teams','league','tournaments','about','archives']::text[],
  ADD COLUMN IF NOT EXISTS home_sections_hidden text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE public.org_public_site_content
  DROP CONSTRAINT IF EXISTS org_public_site_content_home_section_order_known,
  ADD CONSTRAINT org_public_site_content_home_section_order_known
    CHECK (home_section_order <@ ARRAY['teams','league','tournaments','about','archives']::text[]),
  DROP CONSTRAINT IF EXISTS org_public_site_content_home_sections_hidden_known,
  ADD CONSTRAINT org_public_site_content_home_sections_hidden_known
    CHECK (home_sections_hidden <@ ARRAY['teams','league','tournaments','about','archives']::text[]);

-- Carry the two old switches over: a club that turned one off keeps it off.
UPDATE public.org_public_site_content
   SET home_sections_hidden =
         (CASE WHEN show_upcoming_tournaments = false THEN ARRAY['tournaments']::text[] ELSE ARRAY[]::text[] END)
      || (CASE WHEN show_archives_link        = false THEN ARRAY['archives']::text[]    ELSE ARRAY[]::text[] END)
 WHERE (show_upcoming_tournaments = false OR show_archives_link = false)
   AND home_sections_hidden = ARRAY[]::text[];

COMMENT ON COLUMN public.org_public_site_content.home_section_order IS
  'The home''s middle sections in the club''s order (mig 343): teams, league, tournaments, about, archives. Open now is '
  'always first and is not listed. The tab row follows the same order. Normalized in code (lib/club-site-sections.ts).';
COMMENT ON COLUMN public.org_public_site_content.home_sections_hidden IS
  'Sections the club hid from its home and tab row (mig 343). Replaces show_upcoming_tournaments / show_archives_link.';
COMMENT ON COLUMN public.org_public_site_content.show_upcoming_tournaments IS
  'DEPRECATED by mig 343 (home_sections_hidden ''tournaments''). Mirrored by the 4c-1 save for older code; drop later.';
COMMENT ON COLUMN public.org_public_site_content.show_archives_link IS
  'DEPRECATED by mig 343 (home_sections_hidden ''archives''). Mirrored by the 4c-1 save for older code; drop later.';

-- ── 2. The About page's lists ───────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.org_public_site_content
  ADD COLUMN IF NOT EXISTS contacts  jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS questions jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.org_public_site_content
  DROP CONSTRAINT IF EXISTS org_public_site_content_contacts_cap,
  ADD CONSTRAINT org_public_site_content_contacts_cap
    CHECK (jsonb_typeof(contacts) = 'array' AND jsonb_array_length(contacts) <= 12),
  DROP CONSTRAINT IF EXISTS org_public_site_content_documents_cap,
  ADD CONSTRAINT org_public_site_content_documents_cap
    CHECK (jsonb_typeof(documents) = 'array' AND jsonb_array_length(documents) <= 30),
  DROP CONSTRAINT IF EXISTS org_public_site_content_questions_cap,
  ADD CONSTRAINT org_public_site_content_questions_cap
    CHECK (jsonb_typeof(questions) = 'array' AND jsonb_array_length(questions) <= 10);

COMMENT ON COLUMN public.org_public_site_content.contacts IS
  'Who to contact on the About page (mig 343): [{ id, role, email }], in the club''s order, at most 12.';
COMMENT ON COLUMN public.org_public_site_content.documents IS
  'Documents and policies on the About page (mig 343): [{ id, heading, title, url (https) }], at most 30. Links only; '
  'the site never says the club is compliant.';
COMMENT ON COLUMN public.org_public_site_content.questions IS
  'Questions families ask on the About page (mig 343): [{ id, question, answer }], at most 10.';

-- ── 3. The club notice ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_site_notices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL,
  notice             text NOT NULL CHECK (length(btrim(notice)) BETWEEN 1 AND 80),
  detail             text          CHECK (detail IS NULL OR length(detail) <= 200),
  posted_at          timestamptz NOT NULL DEFAULT now(),
  posted_by_user_id  uuid,
  posted_by_email    text NOT NULL,
  ends_at            timestamptz NOT NULL,
  ended_at           timestamptz,
  ended_by_email     text,
  CONSTRAINT org_site_notices_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT org_site_notices_ends_after_post CHECK (ends_at > posted_at)
);

-- The live read (the newest open row per club) and the tenancy anchor, in one index leading on org_id. (A first dev
-- draft had it partial, WHERE ended_at IS NULL; the index-coverage gate wants org_id covered for every row.)
DROP INDEX IF EXISTS public.org_site_notices_open_idx;
CREATE INDEX IF NOT EXISTS org_site_notices_org_idx ON public.org_site_notices (org_id, posted_at DESC);

ALTER TABLE public.org_site_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.org_site_notices FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_site_notices TO service_role;

COMMENT ON TABLE public.org_site_notices IS
  'The club notice (Club Tier Stage 4c-1, Ask 16, mig 343): one short line the club posts, shown at the top of every '
  'public page and team page until ends_at or until ended. One row per post. The live notice is the newest row with '
  'ended_at NULL and ends_at > now(); posting a new one closes the older rows. Read and written only on the server '
  '(service role): the public pages read it server-side, the editor writes it through /api/admin/public-site/notice.';
