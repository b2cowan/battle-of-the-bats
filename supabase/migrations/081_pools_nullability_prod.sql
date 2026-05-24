-- Migration 081: Sync pools table between dev and prod
-- Finding #20 (corrected 2026-05-24) — actual drift after direct schema inspection:
--
--   pools.created_at   → EXISTS in prod (timestamptz NOT NULL DEFAULT now())
--                         MISSING from dev entirely
--   pools.display_order → NOT NULL in dev; nullable (default 0) in prod
--
-- This migration has TWO parts — apply the correct part to the correct env:
--
-- ─────────────────────────────────────────────────────────────────
-- PART A — DEV ONLY: add missing created_at column
-- ─────────────────────────────────────────────────────────────────
-- Dev is missing pools.created_at entirely. Add it to match prod.
-- Backfill existing rows with now() as a reasonable approximation.
-- Do NOT apply to prod — column already exists there.

ALTER TABLE public.pools
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ─────────────────────────────────────────────────────────────────
-- PART B — PROD ONLY: tighten display_order nullability
-- ─────────────────────────────────────────────────────────────────
-- display_order is nullable in prod (default 0) but NOT NULL in dev.
-- Pre-check (expect 0):
--   SELECT COUNT(*) FROM public.pools WHERE display_order IS NULL;
--
-- If 0 NULL rows, apply:
--
--   UPDATE public.pools SET display_order = 0 WHERE display_order IS NULL;
--   ALTER TABLE public.pools ALTER COLUMN display_order SET NOT NULL;
--
-- NOTE: Part B is Low severity — display_order has a default of 0 and all
-- app code provides it. Safe to apply when convenient; not urgent.
