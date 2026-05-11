-- ---------------------------------------------------------------
-- Migration 022 — rep_team_documents
-- Player documents and document templates for module_rep_teams.
--
-- Before running: create the rep-team-documents storage bucket
-- in Supabase Dashboard → Storage → New Bucket:
--   Name:             rep-team-documents
--   Public:           false
--   File size limit:  10485760 (10 MB)
--   Allowed MIME types:
--     application/pdf
--     image/jpeg
--     image/png
--     application/vnd.openxmlformats-officedocument.wordprocessingml.document
--
-- The bucket has NO storage-level RLS. Auth is enforced at the
-- API layer (service role key; signed URLs expire in 1 hour).
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- rep_document_templates: blank forms published for download.
-- team_id NULL = org-wide; team_id set = team-specific.
-- Coaches may publish their own team-specific templates.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_document_templates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id       uuid        REFERENCES rep_teams(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  document_type text        NOT NULL
                            CHECK (document_type IN (
                              'waiver','medical_consent','code_of_conduct','other'
                            )),
  storage_path  text        NOT NULL,
  file_name     text        NOT NULL,
  file_size     bigint      NOT NULL,
  is_active     boolean     NOT NULL DEFAULT true,
  published_by  uuid        REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_document_templates_org_idx
  ON rep_document_templates(org_id, team_id);

-- ---------------------------------------------------------------
-- rep_player_documents: signed/completed forms per player.
-- template_id links back to the template the doc was uploaded against.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_player_documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     uuid        NOT NULL REFERENCES rep_roster_players(id) ON DELETE CASCADE,
  team_id       uuid        NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_type text        NOT NULL
                            CHECK (document_type IN (
                              'waiver','medical_consent','code_of_conduct','other'
                            )),
  storage_path  text        NOT NULL,
  file_name     text        NOT NULL,
  file_size     bigint      NOT NULL,
  template_id   uuid        REFERENCES rep_document_templates(id) ON DELETE SET NULL,
  uploaded_by   uuid        REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_player_documents_player_idx
  ON rep_player_documents(player_id);
CREATE INDEX IF NOT EXISTS rep_player_documents_team_idx
  ON rep_player_documents(team_id, org_id);

-- ---------------------------------------------------------------
-- Row-Level Security (defense-in-depth; API uses service role)
-- ---------------------------------------------------------------
ALTER TABLE rep_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_player_documents   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can read document_templates" ON rep_document_templates;
CREATE POLICY "org members can read document_templates"
  ON rep_document_templates FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "coaches can read assigned team templates" ON rep_document_templates;
CREATE POLICY "coaches can read assigned team templates"
  ON rep_document_templates FOR SELECT
  USING (
    team_id IN (SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid())
    OR (team_id IS NULL AND org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "org members can read player documents" ON rep_player_documents;
CREATE POLICY "org members can read player documents"
  ON rep_player_documents FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "coaches can read assigned team player documents" ON rep_player_documents;
CREATE POLICY "coaches can read assigned team player documents"
  ON rep_player_documents FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
  ));
