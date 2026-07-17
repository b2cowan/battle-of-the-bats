-- Migration 192: Player Development slice 3D — carry-forward decision audit on continuity links.
--
-- The season-rollover carry-forward prompt ("bring forward the focus areas they were
-- working on?") is a ONE-TIME explicit offer per confirmed link (plan 3D; never automatic).
-- "One-time" needs durable state: three additive, nullable columns on the link row —
--   • carry_status   — NULL = not yet asked/answered; 'carried' = working goals were copied
--                      forward; 'fresh' = the coach chose to start fresh. Either answer
--                      retires the banner forever (a rollover trust decision, audited like
--                      the link decision itself).
--   • carry_decided_by / carry_decided_at — who answered, when (decided_by idiom, mig 191).
-- App-level rules (not constraints): carry columns are only ever written on a CONFIRMED
-- link whose current side is a roster row; writes are head-coach-only (existing UPDATE
-- policy already covers these columns).
--
-- ADD COLUMN IF NOT EXISTS → re-runnable. DEV-ONLY at author time; ⚠ PROD-PENDING —
-- promote with migs 189+190+191 (one Player Development bundle).

ALTER TABLE public.rep_player_continuity_links
  ADD COLUMN IF NOT EXISTS carry_status text CHECK (carry_status IN ('carried', 'fresh')),
  ADD COLUMN IF NOT EXISTS carry_decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS carry_decided_at timestamptz;
