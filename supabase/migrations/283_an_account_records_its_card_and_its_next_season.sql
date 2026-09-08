-- 283 — An account records its card on file, and the plan it chose for its next season.
--
-- FOUNDING_SEASON_2027_DESK_PLAN.md §4.1 (owner-approved 2026-09-07). Two facts the product has
-- never held:
--
--   1. CARD ON FILE. Until now it lived only in Stripe, so "who has no card yet?" — the question the
--      September 2027 conversion runs on — could not be asked of the database at all, and the one
--      campaign email that branches on it always assumed the answer was no.
--
--      ⚠ It is its own fact, NOT derived from stripe_customer_id. lib/team-checkout.ts's comp
--      reactivation NULLs stripe_customer_id on both the workspace and its org, and the webhook's
--      subscription.deleted arms null the Stripe columns too — so a card saved in June would read as
--      "no card" the moment any of those ran, and the operator would chase somebody who had already
--      paid attention.
--
--   2. THE NEXT SEASON'S PLAN. What the account chose when asked (Founding Season: the 2028 choice,
--      made from June 1, 2027, first charged October 1, 2027). Deliberately named for "next season"
--      rather than a year: the year is derived from the Founding Season constants in
--      lib/plan-config.ts and this table must not need a migration when it moves.
--
-- ⚠⚠ WHY A TABLE AND NOT SIX COLUMNS ON `organizations` — this was the first design, and `/review`
-- (2026-09-07, security lens) killed it. Verified against LIVE PROD, not migration files:
--
--     `anon` and `authenticated` both hold the default SELECT grant on public.organizations,
--     RLS is ENABLED on it, and its only SELECT policy is
--         org_read  USING (is_org_member(id) OR is_public = true)
--     with `is_public` defaulting to true. Four of prod's five organizations are public.
--
-- RLS is ROW-level, never column-level, so ANY column added to `organizations` is readable by
-- anybody holding the anon key — which ships in every page's JS bundle — for every public org. Six
-- columns there would have published each account's card brand, last four, "card on file since",
-- and its 2028 commitment to the open internet. This is the same door migration 212 closed for
-- roster PII, and the same posture memory/reference_supabase_rls_grants.md records.
--
-- So the facts live in their own table with **RLS ENABLED AND NO POLICIES** — the platform's
-- standard service-role-only shape (rep_dues_payouts, rep_dues_payments, rep_dues_payout_credits all
-- carry it). anon and authenticated resolve to zero rows; every reader in the app goes through
-- supabaseAdmin, which bypasses RLS. It also means the two "who has NOT acted" predicates index a
-- small dedicated table rather than adding index builds to `organizations`, which nearly every
-- request touches.
--
-- Exposure at the time of writing: zero. No card-on-file fact has ever been recorded — this lands
-- before the first one exists, not after.

create table if not exists public.organization_billing_facts (
  -- One row per account, and the account IS the key: there is no version history here, only the
  -- current answer to two questions. ON DELETE CASCADE because these facts have no meaning without
  -- the account they describe.
  org_id                    uuid primary key references public.organizations(id) on delete cascade,

  -- ── Card on file ──────────────────────────────────────────────────────────────
  -- NULL card_on_file_at = no card. Brand and last4 are DISPLAY ONLY, so support can tell one card
  -- from another on the phone; nothing is ever charged from them.
  card_on_file_at           timestamptz,
  card_on_file_brand        text,
  card_on_file_last4        text,

  -- ── The next season's plan ────────────────────────────────────────────────────
  -- No CHECK on the plan key: the domain lives in code (PLAN_CONFIG) and has changed twice already;
  -- a CHECK here would turn a future plan rename into a failed webhook. The writer validates.
  -- ⚠ A plan key is NULL or a real key — never an empty string. The empty string would be a third
  -- state that SQL reads as "chosen" and JavaScript reads as "not chosen", and the desk filter and
  -- the email audience would disagree about the same account. The CHECK is the cheap way to make
  -- that unrepresentable.
  next_season_plan_id       text check (next_season_plan_id is null or length(next_season_plan_id) > 0),
  next_season_billing_cycle text check (next_season_billing_cycle in ('annual', 'monthly')),
  next_season_chosen_at     timestamptz,

  -- ⚠ THE SUBSCRIPTION THE CHOICE CREATED, AND IT IS LOAD-BEARING. Without it a second choice
  -- (a double-click, a back button, a change of mind) creates a SECOND live Stripe subscription
  -- while the first stays live — and on October 1, 2027 both charge the same card. This id is how
  -- the choice route finds the previous subscription and cancels it, and how the webhook tells
  -- "the customer withdrew their 2028 choice" apart from "the customer cancelled their account".
  next_season_subscription_id text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table public.organization_billing_facts is
  'Per-account billing facts that must NOT be world-readable: whether a card is on file (and which '
  'one), and the plan chosen for the season after the current one. Deliberately NOT columns on '
  '`organizations` — that table is anon-readable for every public org (RLS is row-level, and its '
  'policy admits is_public = true), so anything added there is published. Service-role only.';

comment on column public.organization_billing_facts.card_on_file_at is
  'When a usable card was FIRST recorded (Stripe webhook). NULL = no card. Never derived from '
  'organizations.stripe_customer_id — comp reactivation and subscription deletion null that column '
  'while the card is still there. A card swap does not move this date.';

comment on column public.organization_billing_facts.next_season_subscription_id is
  'The Stripe subscription created by the next-season choice. Used to cancel a superseded choice '
  'before creating a new one, and to recognise "the choice was withdrawn" in the webhook so it is '
  'not mistaken for an account cancellation.';

-- ⚠⚠ RLS ENABLED WITH NO POLICIES — service-role only, the treatment every sibling gets. This is
-- the whole reason the table exists; do not add a policy without re-reading the header.
alter table public.organization_billing_facts enable row level security;

-- The two questions the September 2027 conversion runs on, indexed on the ABSENCE — which is the
-- side both the desk filter and the reminder audience select for. Cheap here: this table holds one
-- row per founding account (tens), not one per organization.
create index if not exists idx_org_billing_facts_no_card
  on public.organization_billing_facts (org_id)
  where card_on_file_at is null;

create index if not exists idx_org_billing_facts_no_next_season_choice
  on public.organization_billing_facts (org_id)
  where next_season_plan_id is null;
