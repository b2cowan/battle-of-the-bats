-- Migration 108: divisions.min_age / max_age are optional.
--
-- The tournament setup flow now allows ageless divisions (gender / skill /
-- format categories), inserting NULL for min_age / max_age. Dev had these
-- NOT NULL constraints dropped ad-hoc and never captured in a migration, so
-- production still enforced them — every age-less division insert failed with
-- Postgres 23502 ("null value in column min_age violates not-null constraint"),
-- surfacing in the setup wizard as a generic 500.
--
-- TARGET: prod (dev is already nullable). Safe + idempotent — DROP NOT NULL is
-- a no-op if the column is already nullable.
ALTER TABLE divisions ALTER COLUMN min_age DROP NOT NULL;
ALTER TABLE divisions ALTER COLUMN max_age DROP NOT NULL;
