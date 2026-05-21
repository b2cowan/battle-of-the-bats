-- Migration 056: Tournament Plus registration control fields
-- Custom questions and answer storage for tournament team registrations.
--
-- File answers store a private Supabase Storage path in file_url. The runtime
-- upload route uses the private `tournament-registration-files` bucket.

CREATE TABLE IF NOT EXISTS public.tournament_registration_fields (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid     NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  org_id      uuid       NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label       text       NOT NULL,
  field_type  text       NOT NULL CHECK (field_type IN ('short_text', 'long_text', 'dropdown', 'checkbox', 'file')),
  options     jsonb      NOT NULL DEFAULT '[]'::jsonb,
  required    boolean    NOT NULL DEFAULT false,
  sort_order  int        NOT NULL DEFAULT 0,
  is_archived boolean    NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tournament_registration_fields_tournament_idx
  ON public.tournament_registration_fields(tournament_id, is_archived, sort_order);

CREATE INDEX IF NOT EXISTS tournament_registration_fields_org_idx
  ON public.tournament_registration_fields(org_id);

CREATE TABLE IF NOT EXISTS public.tournament_registration_field_answers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid       NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  field_id        uuid       NOT NULL REFERENCES public.tournament_registration_fields(id) ON DELETE CASCADE,
  value_text      text,
  value_json      jsonb,
  file_url        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registration_id, field_id)
);

CREATE INDEX IF NOT EXISTS tournament_registration_field_answers_registration_idx
  ON public.tournament_registration_field_answers(registration_id);

CREATE INDEX IF NOT EXISTS tournament_registration_field_answers_field_idx
  ON public.tournament_registration_field_answers(field_id);

ALTER TABLE public.tournament_registration_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_registration_field_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can read registration fields" ON public.tournament_registration_fields;
CREATE POLICY "org members can read registration fields"
  ON public.tournament_registration_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = tournament_registration_fields.org_id
        AND m.user_id = auth.uid()
        AND COALESCE(m.status, 'active') <> 'suspended'
    )
  );

DROP POLICY IF EXISTS "org members can read registration answers" ON public.tournament_registration_field_answers;
CREATE POLICY "org members can read registration answers"
  ON public.tournament_registration_field_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.tournament_registration_fields f
      JOIN public.organization_members m ON m.organization_id = f.org_id
      WHERE f.id = tournament_registration_field_answers.field_id
        AND m.user_id = auth.uid()
        AND COALESCE(m.status, 'active') <> 'suspended'
    )
  );
