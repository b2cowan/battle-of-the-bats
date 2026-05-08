-- Module: module_public_site
-- Stores org-branded content for the public site add-on.
-- One row per org (enforced by unique index).

CREATE TABLE IF NOT EXISTS org_public_site_content (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tagline                   text,
  description               text,
  contact_email             text,
  social_instagram          text,
  social_facebook           text,
  social_x                  text,
  social_website            text,
  show_upcoming_tournaments boolean     NOT NULL DEFAULT true,
  show_archives_link        boolean     NOT NULL DEFAULT true,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS org_public_site_content_org_id_key
  ON org_public_site_content(org_id);

ALTER TABLE org_public_site_content ENABLE ROW LEVEL SECURITY;

-- Authenticated org members can read their own org's content
CREATE POLICY "org members can read public site content"
  ON org_public_site_content FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Public (anon) can read — all fields are intended for public display
CREATE POLICY "public can read public site content"
  ON org_public_site_content FOR SELECT
  TO anon
  USING (true);
