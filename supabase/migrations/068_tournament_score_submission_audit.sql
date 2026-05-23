-- Tournament score submission audit metadata.
--
-- Records who last submitted/corrected the visible score, when it happened,
-- and which scoring surface wrote it. NULL values mean the game has not been
-- scored yet or predates this migration.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS score_submitted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS score_submitted_by_email text,
  ADD COLUMN IF NOT EXISTS score_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS score_submission_source text;

ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_score_submission_source_check;

ALTER TABLE public.games
  ADD CONSTRAINT games_score_submission_source_check
  CHECK (
    score_submission_source IS NULL
    OR score_submission_source IN ('scorekeeper', 'admin_results', 'system')
  );

CREATE INDEX IF NOT EXISTS games_score_submitted_at_idx
  ON public.games(tournament_id, score_submitted_at DESC)
  WHERE score_submitted_at IS NOT NULL;

COMMENT ON COLUMN public.games.score_submitted_by_user_id IS
  'Authenticated user who last submitted or corrected the game score.';

COMMENT ON COLUMN public.games.score_submitted_by_email IS
  'Email snapshot for the user who last submitted or corrected the game score.';

COMMENT ON COLUMN public.games.score_submitted_at IS
  'Timestamp when the current score was submitted or corrected.';

COMMENT ON COLUMN public.games.score_submission_source IS
  'Surface that last submitted or corrected the game score: scorekeeper, admin_results, or system.';
