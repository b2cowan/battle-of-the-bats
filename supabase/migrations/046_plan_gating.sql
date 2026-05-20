-- Plan gating configuration
-- Controls whether each plan is available for self-serve checkout ('live')
-- or shows an early-access CTA ('early_access') on the pricing page.
-- Platform admins can toggle rows via /platform-admin/plans without a code deploy.

CREATE TABLE public.plan_gating (
  plan_key          text        PRIMARY KEY
                                CHECK (plan_key IN ('tournament', 'tournament_plus', 'league', 'club')),
  gating_status     text        NOT NULL DEFAULT 'early_access'
                                CHECK (gating_status IN ('live', 'early_access')),
  updated_at        timestamptz DEFAULT now(),
  updated_by_email  text
);

-- Seed defaults matching PLAN_CONFIG.gatingStatus
INSERT INTO public.plan_gating (plan_key, gating_status) VALUES
  ('tournament',      'live'),
  ('tournament_plus', 'live'),
  ('league',          'early_access'),
  ('club',            'early_access');

-- Only accessible via service role (platform admin API routes); no public access needed.
REVOKE ALL ON public.plan_gating FROM anon, authenticated;
