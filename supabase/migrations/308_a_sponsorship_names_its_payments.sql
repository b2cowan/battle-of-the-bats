-- 308 — A sponsorship names the family's payments it covers
-- (owner rulings D1–D8 on the Sponsorship Applies To hub, 2026-09-21 — plan:
--  docs/projects/active/COACH_SPONSORSHIP_APPLIES_TO_PLAN.md)
--
-- The ask: a parent and a coach agree that a sponsor's money should cover THESE payments (the
-- December and February ones, say). Today one team-wide setting (rep_program_years.credit_application,
-- mig 233) decides where every credit lands, and no family can be the exception.
--
-- THE RULE THIS BENDS, AND HOW (D8): the credit engine's standing rule was "application is derived,
-- never stored — no installment id ever lands on a credit row". Its reason — a stored allocation goes
-- stale the moment the schedule, a payment or a cheque changes — is fully kept: the DOLLARS are still
-- computed on every read (lib/dues-credits.ts, three passes now). What is stored is the AGREEMENT,
-- keyed by installment POSITION (installment_number), never id: replaceRepDuesInstallments deletes
-- and reinserts, so ids are recycled and numbers survive a same-count re-run (D4).
--
-- Three columns, all nullable, NULL = the team default. No backfill — every existing share and
-- credit means what it meant yesterday.
--
--   1. rep_fundraiser_credit_plan.applies_to  — the agreement on the (sponsor × family) share:
--      a JSON array of {n, due_date, amount}: the position named, and the date/amount that payment
--      had when the arrangement was made (the snapshot the re-run cue compares against, D4).
--   2. rep_fundraiser_credit_plan.arranged_at — when the coach made or last confirmed it ("Keep
--      these" restamps). A dues re-run inserts fresh installment rows, so max(installments.created_at)
--      later than this is the "check the payments" cue — no extra column on the schedule.
--   3. rep_dues_credits.applies_to — the positions only (int[] as JSON), COPIED onto each credit the
--      arrivals writer accrues from that share, so every reader that already fetches credit rows has
--      the arrangement in hand with no join. A plan edit re-derives every arrival's credits from
--      scratch (mig 268 gotcha 2), so the copy cannot drift from the share.
--
-- ORDER: apply to prod BEFORE promoting the code that reads these columns (the migration-040
-- lesson). Additive, idempotent, independent of 305–307.

alter table public.rep_fundraiser_credit_plan
  add column if not exists applies_to  jsonb,
  add column if not exists arranged_at timestamptz;

comment on column public.rep_fundraiser_credit_plan.applies_to is
  'Sponsorship Applies To (D1/D2, 2026-09-21): the payments this family''s share of the sponsor''s credit was arranged to cover — JSON array of {n: installment_number, due_date, amount} as they stood when arranged. NULL = the team default (rep_program_years.credit_application).';
comment on column public.rep_fundraiser_credit_plan.arranged_at is
  'When the arrangement was made or last confirmed ("Keep these"). A dues re-run after this (installments created later) raises the check-the-payments cue (D4).';

alter table public.rep_dues_credits
  add column if not exists applies_to jsonb;

comment on column public.rep_dues_credits.applies_to is
  'Sponsorship Applies To (D8, 2026-09-21): installment POSITIONS (JSON int array) this credit was arranged to land on — copied from rep_fundraiser_credit_plan.applies_to by the arrivals writer. NEVER an installment id (ids are recycled by a schedule re-run). The dollars are still derived on every read (lib/dues-credits.ts). NULL = the team default.';

-- The shape is enforced at the write path (the plan PATCH validates positions against the family's
-- CURRENT schedule); the CHECKs here only refuse a non-array so a bad write can never poison a read.
alter table public.rep_fundraiser_credit_plan
  drop constraint if exists rep_fundraiser_credit_plan_applies_to_is_array;
alter table public.rep_fundraiser_credit_plan
  add constraint rep_fundraiser_credit_plan_applies_to_is_array
  check (applies_to is null or jsonb_typeof(applies_to) = 'array');

alter table public.rep_dues_credits
  drop constraint if exists rep_dues_credits_applies_to_is_array;
alter table public.rep_dues_credits
  add constraint rep_dues_credits_applies_to_is_array
  check (applies_to is null or jsonb_typeof(applies_to) = 'array');
