-- Track first-run startup task progress separately from the legacy
-- onboarding_completed_at flag so skipped tasks can be resumed later.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS startup_tasks jsonb NOT NULL DEFAULT '{}'::jsonb;
