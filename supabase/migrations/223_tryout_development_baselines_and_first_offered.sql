-- Migration 223: the development baseline seeded from a tryout (Tryout Insights Phase 2, feature B)
--                + a sticky `first_offered_at` that makes the report's "Offered" number honest.
--
-- Plan: docs/projects/active/COACH_TRYOUT_INSIGHTS_PLAN.md §5 (work items B1–B6).
-- Rulings R1–R8: memory/design_decisions.md 2026-08-02. R3, R4 and R5 are the walls this table
-- is built inside, and each is restated below where it constrains the schema.
--
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- 1. rep_player_tryout_baselines — "where this player's season started"
-- ────────────────────────────────────────────────────────────────────────────────────────────
--
-- ONE frozen snapshot of a rostered player's tryout evaluation, written ONCE at seed time by an
-- explicit coach act, and read only on that player's development page.
--
-- ⚠ **WHY THE SNAPSHOT IS STORED AND NOT RECOMPUTED** (R4, and the whole reason this table
-- exists rather than a view). Features A and C compute their snapshots at READ time from
-- rep_tryout_scores × rep_tryout_rubrics, because a report is a live aggregate. A baseline is
-- not: the coach LOOKED at these numbers and chose focus areas from them. If a later rubric edit
-- or a corrected score silently rewrote the baseline, the card on the development page would
-- stop explaining the decision it exists to explain — and nothing would fail loudly. So the
-- jsonb is a copy, deliberately, in the same spirit as `rep_player_measurables.unit` and
-- `station.drillTags`: the words and numbers that were true when the record was made.
--
-- ⚠ **IT IS CONTEXT, NEVER A MEASURABLE** (R4). Deliberately NOT a row in
-- rep_player_measurables, and deliberately not shaped like one. A tryout composite is a
-- subjective panel rating, not a measured drill; feeding it into the measurables timeline would
-- manufacture a trend from two different kinds of number ("4.4 at tryouts → 4.9 in June" is not
-- an improvement, it is two unrelated judgments). No future surface may treat
-- tryout-composite → in-season-measurable as a trend. The dashed-border card on the development
-- page (mockups v1 frame 05) is the visual expression of this rule.
--
-- ⚠ **COACH-EYES-ONLY, PERMANENTLY** (R3). No score, category average, composite or evaluator
-- count from this table may ever reach a family-facing payload — the recap, the keepsake, the
-- offer page, any Chunk D surface. The family recap may state the FACT "earned a roster spot at
-- tryouts" and never a number. Guarded by `tests/unit/tryout-baseline.test.ts`, which scans the
-- family payload builders' source rather than trusting the convention.
--
-- ⚠ **ONE PER PLAYER PER SEASON, and it is never overwritten** (plan §5). The unique index below
-- is the mechanism; the API refuses a second seed rather than updating in place. Re-entering the
-- walkthrough shows "✓ baseline set" and skips. A coach who wants different focus areas edits the
-- focus areas — the baseline is a record of what the tryout said, not a working document.
--
-- ⚠ **ROSTERED PLAYERS ONLY.** The FK is to rep_roster_players, so a candidate who was never
-- accepted structurally cannot have a baseline; their scores stay in tryout history. That is
-- what keeps this table out of the "we kept a file on every child who tried out" territory.
--
-- ⚠ **NOT SEEDED, EVER, AND NOTHING IS BACK-FILLED.** A row exists only because a coach walked
-- the walkthrough and pressed Save for that player.
--
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- 2. rep_tryout_registrations.first_offered_at — the offer that WAS extended
-- ────────────────────────────────────────────────────────────────────────────────────────────
--
-- Queued by the Phase-1 /simplify altitude finding. `clearTryoutOffer` wipes offer_sent_at,
-- offer_expires_at and the token on any transition AWAY from 'offered' (correct — a stale
-- accept link must die), which means a coach who offers a player and then re-decides erases the
-- only trace the offer ever happened. The report's funnel could therefore claim CURRENT standing
-- only, documented as such on `TryoutReportFunnel.offered`.
--
-- This column is STICKY: stamped the first time a registration reaches status='offered', and
-- never cleared by anything. A trigger owns it rather than the application, because the stamp
-- must survive every write path — the coach decision board, the org-admin applicant screen, and
-- a future one nobody has written yet. Application code that "remembers" to stamp is exactly the
-- kind of thing one of four copies quietly stops doing.
--
-- BACKFILL IS ONLY WHAT THE DATA PROVES: existing rows take `offer_sent_at` when they have one.
-- A record-only offer (family emails switched off, D-E9) left no timestamp behind, so those rows
-- stay NULL rather than inventing a moment — and the report's funnel counts the union of
-- "ever offered" and "currently offered or accepted", so no historic count goes DOWN.
--
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- RLS posture — a deliberate answer, not a default (reference_supabase_rls_grants)
-- ────────────────────────────────────────────────────────────────────────────────────────────
--
-- ⚠ **RLS ENABLED WITH NO POLICIES — service-role only.** This table gets the SAME posture as
-- the tables it copies from: `rep_tryouts` / `rep_tryout_sessions` / `rep_tryout_scores` are all
-- RLS-on-no-policies precisely because "prod anon's default SELECT grant would leak tryout data"
-- (migs 165/167). A frozen COPY of that data cannot be laxer than the original.
--
-- ⚠ **The permissive "org members / assigned coaches can read" pair is DELIBERATELY ABSENT**
-- (/review Critical, 2026-08-02 — it was written and removed before this ever reached prod). Those
-- policies key on ASSIGNMENT, never on capability, and prod's `authenticated` role holds the
-- default SELECT grant on public tables. The coach portal ships an anon-key browser client bound
-- to the caller's own session, so an assistant coach with `tryouts: false` — or any org member at
-- all, on ANY team — could have read every rostered player's composite, per-category averages and
-- evaluator count straight from PostgREST, walking around the capability gate the app enforces on
-- both routes. That is exactly the door migration 212 closed on `rep_roster_players` /
-- `rep_player_documents`, and R3 makes this content stricter than roster PII, not looser.
--
-- With no policies, anon/authenticated resolve to ZERO rows and every legitimate read/write goes
-- through `supabaseAdmin` (service_role, BYPASSRLS) behind the app's real gate: `tryouts` AND
-- `canWriteDevelopment`. The DROP POLICY statements below are unconditional cleanup so a database
-- that already ran an earlier draft of this migration converges to the same state.
--
-- DEV-ONLY at author time; ⚠ PROD-PENDING — apply to prod at release BEFORE promoting code that
-- reads this table (else prod 500s — the migration-040 incident). It joins the existing dev-only
-- queue 214–222, all of which must reach prod before any of this promotes.

-- ============================================================
-- 1. rep_player_tryout_baselines
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rep_player_tryout_baselines (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id                 uuid        NOT NULL REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  program_year_id         uuid        NOT NULL REFERENCES public.rep_program_years(id) ON DELETE CASCADE,
  roster_player_id        uuid        NOT NULL REFERENCES public.rep_roster_players(id) ON DELETE CASCADE,
  -- Provenance only, and nullable on purpose: the snapshot below already carries everything the
  -- card renders, so a purged registration (the PII-retention policy, when it lands) must not
  -- take the baseline down with it. SET NULL, never CASCADE.
  tryout_registration_id  uuid        REFERENCES public.rep_tryout_registrations(id) ON DELETE SET NULL,
  -- The frozen snapshot. Shape + validation live in lib/tryout-baseline.ts (the `practice_plan`
  -- stance, mig 213): a CHECK over jsonb could not express it and would be a second, drifting
  -- answer. The object-ness IS checked, because a scalar here would break every reader.
  snapshot                jsonb       NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  seeded_by               uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  seeded_at               timestamptz NOT NULL DEFAULT now()
);

-- ⚠ THE ONE-TIME RULE, as a constraint rather than a convention. program_year_id is redundant
-- with the roster row (a roster row is already season-scoped) and is carried anyway: it is what
-- lets "which baselines exist for this season" be one indexed read from the walkthrough, and it
-- makes the uniqueness rule readable as the sentence it is.
CREATE UNIQUE INDEX IF NOT EXISTS rep_player_tryout_baselines_player_year_uniq
  ON public.rep_player_tryout_baselines(roster_player_id, program_year_id);

-- The walkthrough's own read: every baseline already set for the season being seeded.
CREATE INDEX IF NOT EXISTS rep_player_tryout_baselines_year_idx
  ON public.rep_player_tryout_baselines(program_year_id);

CREATE INDEX IF NOT EXISTS rep_player_tryout_baselines_team_idx
  ON public.rep_player_tryout_baselines(team_id);

-- ⚠ RLS ON, NO POLICIES — see the header. Enabling RLS is what makes the default SELECT grant
-- resolve to zero rows; it must never be turned off "because nothing reads it that way".
ALTER TABLE public.rep_player_tryout_baselines ENABLE ROW LEVEL SECURITY;

-- Cleanup only (an earlier draft of this migration created these). A database that never had
-- them is unaffected; one that did converges to the service-role-only posture.
DROP POLICY IF EXISTS "org members can read rep_player_tryout_baselines"    ON public.rep_player_tryout_baselines;
DROP POLICY IF EXISTS "coaches can read assigned team tryout baselines"     ON public.rep_player_tryout_baselines;
DROP POLICY IF EXISTS "head coaches can insert rep_player_tryout_baselines" ON public.rep_player_tryout_baselines;

COMMENT ON TABLE public.rep_player_tryout_baselines IS
  'Tryout Insights Phase 2 (mig 223): ONE frozen tryout snapshot per rostered player per season — "where the season started". Written ONCE by an explicit coach act in the seeding walkthrough; never updated. ⚠ CONTEXT, NOT A MEASURABLE (R4) — never enters rep_player_measurables or any trend. ⚠ COACH-EYES-ONLY (R3) — never reaches a family-facing payload; guarded by tests/unit/tryout-baseline.test.ts. Snapshot shape + validation in lib/tryout-baseline.ts. See DATA_DICTIONARY.md.';

COMMENT ON COLUMN public.rep_player_tryout_baselines.snapshot IS
  'Frozen per-player tryout evaluation: {version, tryoutId, seasonLabel, dateLabel, scaleMax, composite, evaluatorCount, blindUsed, categories:[{key,label,avg}]}. A COPY, not a join — a later rubric or score edit must never rewrite a baseline the coach already acted on (R4).';

COMMENT ON COLUMN public.rep_player_tryout_baselines.tryout_registration_id IS
  'Provenance only, nullable, ON DELETE SET NULL — the snapshot already carries everything the card renders, so purging a registration must not delete the baseline.';

-- ============================================================
-- 2. rep_tryout_registrations.first_offered_at (sticky)
-- ============================================================

ALTER TABLE public.rep_tryout_registrations
  ADD COLUMN IF NOT EXISTS first_offered_at timestamptz;

COMMENT ON COLUMN public.rep_tryout_registrations.first_offered_at IS
  'STICKY: when an offer was FIRST extended to this candidate. Stamped by trigger on the first transition to status=''offered'' and NEVER cleared — unlike offer_sent_at, which clearTryoutOffer wipes on any transition away from ''offered''. Exists so the tryout report can claim offers EXTENDED rather than merely offers currently standing (mig 223). Backfilled from offer_sent_at where one survived; NULL on rows whose record-only offer left no timestamp.';

-- The stamp. A trigger and not application code, because the fact must hold on EVERY write path —
-- the coach decision board, the org-admin applicant screen, and the next one nobody has written.
CREATE OR REPLACE FUNCTION public.stamp_rep_tryout_first_offered()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sticky in both directions: stamped only when it is still NULL, so a re-offer keeps the
  -- ORIGINAL moment; and there is no branch anywhere that sets it back to NULL.
  --
  -- ⚠ **A REAL TRANSITION, not merely a statement that mentions `status`** (/review, 2026-08-02).
  -- `UPDATE OF status` fires whenever the column is TARGETED, and
  -- `updateRepTryoutRegistrationStatus` always puts `status` in its SET clause — including the
  -- org-admin route's notes-only branch, which passes the row's CURRENT status back unchanged.
  -- Without the DISTINCT check, editing the admin notes on a legacy 'offered' row would stamp
  -- "first offered" as the moment someone typed a note — a fabricated timestamp, which is exactly
  -- what the backfill below refuses to do. A legacy row that never transitions again keeps a NULL
  -- stamp, and the report's union counts it by its current standing instead.
  IF NEW.status = 'offered'
     AND NEW.first_offered_at IS NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.first_offered_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_tryout_first_offered ON public.rep_tryout_registrations;
CREATE TRIGGER trg_rep_tryout_first_offered
  BEFORE INSERT OR UPDATE OF status ON public.rep_tryout_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_rep_tryout_first_offered();

-- Backfill: only what the data proves. A surviving offer_sent_at is a real moment an offer went
-- out; everything else stays NULL rather than inventing one from updated_at.
UPDATE public.rep_tryout_registrations
   SET first_offered_at = offer_sent_at
 WHERE first_offered_at IS NULL
   AND offer_sent_at IS NOT NULL;
