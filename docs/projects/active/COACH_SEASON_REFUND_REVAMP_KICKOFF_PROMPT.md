# Kickoff prompt — the Season Refund Calculator gets a real model (paste into a fresh chat)

The coach portal can now say, to the cent, what every family paid, what the season spent, and
what each player's fundraising earned. The one screen that turns those facts into money going
BACK to families — the **Season Refund Calculator** — still runs on a hand-typed pot and a
one-size-fits-all credit rule from mig 029. The owner has ruled it gets a **complete revamp, not
a patch** (2026-08-13), and has a seeded world ready to reason against.

**This starts with LISTENING, not building.** The owner reviews the seeded portal and explains
how they expect the calculation to work. Your first job is to capture that model precisely,
play it back against the seeded numbers until the owner confirms every figure, THEN mockups
(decisions here get made from renders), then build. Do not propose a model before the owner has
described theirs.

## The review portal (already seeded on dev — verify it's intact before the walkthrough)

Org `qa-money-lab`, team **QA Season End U15** (slug `qa-season-end-u15`). Head coach login
`qa-money-head@dev.local` / `devpass123`; assistant logins printed by the seeder. Re-seed if
missing: `node --env-file=.env.local scripts/seed-qa-day-fixtures.mjs money` (idempotent — skips
teams that exist; to rebuild the U15 from scratch, delete its dues schedules first).

The world, chosen so the refund arithmetic has texture:
- **10 players** (`… Ledger` surnames; first two are siblings sharing guardian Robin Okafor).
- **Dues $600 each** in 3×$200, all due dates past, ALL fully collected — with real payment
  records behind every stamp (mig 232). Collections are DONE; this is a season wrapping up.
- **One cash overpayment:** Umar (index 7) sent $650 — a **$50 `overpayment` credit** sits on
  his row. This is the credit type that IS money the books hold.
- **Fundraising varies family to family:** the closed *Cookie Dough Drive* raised
  $0, $0, $60, $120, $180, $240, $300, $420, $500, $680 per player at **25% back** →
  `fundraiser` credits of $0–$170, **$625 total**. Two families raised nothing; one carried the
  team. The team kept 75% (= $1,875).
- **Budget $7,000, paid spending $6,350** across five categories — mostly exhausted, headroom
  real.
- Arithmetic the walkthrough can anchor on: cash in = $6,050 dues (incl. the overpay) + $1,875
  team-kept fundraising = $7,925; out = $6,350; **≈ $1,575 genuinely available**. Today's
  calculator, given a typed pot of $1,575: credits off the top ($675 = $625 fundraiser + $50
  overpayment), even pool $900 → **$90/player + their own credits**.

## The current model, verified (re-verify before changing)

`season-surplus` route (`app/api/coaches/[orgSlug]/teams/[teamId]/season-surplus/route.ts`) +
the collapsible in `accounting/dues/panel.tsx`:
1. Coach hand-types **Total Remaining Funds** (`rep_season_surplus`, one row per year). Nothing
   ties it to the books.
2. `evenPool = max(0, typedPot − ΣALLcredits)`; `evenShare = evenPool / activePlayers`.
3. Per player: `totalRefund = ownCredits + evenShare`. Credit TYPES are not distinguished —
   contribution, fundraiser, overpayment, other all count identically.
4. Rolling balance shown per row is payments-based since mig 232 (`duesPaidAmount` capped +
   credits subtracted) — that part is current and correct.

## Known defects/questions the review documented (feed these into the owner conversation)

- **Over-promise:** credits > typed pot still pays credits in full — the sheet can promise money
  that isn't there (only the even pool floors at zero).
- **Provenance:** should a fundraiser rebate (the player's earnings), an overpayment (cash held),
  and a discretionary contribution credit really behave identically in a refund?
- **The typed pot is unassisted guesswork:** "Cash on hand" understates by auto-credited
  overpayment excess (the Collected figure caps deliberately), so a coach copying the tile types
  a short number. Whether the revamp derives the pot, suggests it, or keeps it manual is an owner
  call.
- **Unpaid balances at season end:** today a family still owing appears with a positive rolling
  balance but their refund row is credits + even share regardless. Does owing money offset a
  refund? Owner call.
- The 2026-08-13 decision sheet (artifact `942aa951`, §2) rendered a guard/guide option the owner
  REJECTED in favour of this revamp — do not resurrect it as the answer.

## Read first

1. `docs/projects/active/COACH_DUES_PAYMENT_RECORD_PLAN.md` — the payment-record model this sits
   on: payments are facts; paid = payments capped at schedule total; **`reconcileOverpaymentCredits`
   is the ONE overpayment-credit mechanism (symmetric; `payment_id`-linked credits are
   auto-managed and have no delete button; NULL-linked ones are manual/deletable)**. The refund
   revamp must not create a second credit mechanism.
2. `docs/agents/db/DATA_DICTIONARY.md` — `rep_season_surplus`, `rep_dues_credits` (gotcha 3:
   clamping inconsistency; gotcha 6: `payment_id` CASCADE), `rep_dues_payments`.
3. The screen itself, logged in as the U15 head coach, BEFORE reading its code.
4. `memory/design_decisions.md` + the funding ruling in
   `docs/projects/archive/COACH_BUDGET_TOTALS_FUNDING_PLAN.md:92-96` — fundraiser rebates lower
   THAT player's dues; counting them as team income would double-count (this shaped Chunk H's
   "money in is dues only" rule and constrains what "the pot" can mean).

## Process (blocking steps, in order)

1. **Walk the owner through the U15 numbers** — what today's model produces and why — and let
   them explain the model they want. Capture it as worked examples on THESE ten players; play
   every figure back until confirmed.
2. **Mockups to Claude Artifacts** (they are the spec; tag NEW/RESTYLED/UNCHANGED; reuse the
   mockup chrome in `COACH_DUES_PAYMENT_RECORD_MOCKUP.html` so it reads as one product).
3. Plain-language PM summary (AGENCY_RULES), then plan + PM brief pair
   (`COACH_SEASON_REFUND_REVAMP_PLAN.md` + `_PM_BRIEF.md`), TODO one-liner.
4. Build in shippable passes with the funnel (/simplify → /review) and the sliced layout sweep
   (`--only=coach-dues`).

## Traps

- ⚠ **Check whether the dues-payment-record project has been committed/released before touching
  shared files** — as of 2026-08-14 it sat UNCOMMITTED on `dev` awaiting owner OK (TODO.md tells
  the current truth), and the working copy is SHARED by concurrent agents: explicit pathspecs,
  `git show --stat HEAD` after committing, bracketed dirs need `:(literal)`.
- ⚠ Refunds move money → live-season-only; nothing joins the archive allow-lists.
- ⚠ `lib/dues-status.ts` + `lib/dues-payments.ts` are the ONLY homes for dues arithmetic — the
  definition-guard test fails the build on re-derivations AND on naked `paid_at` writes.
- ⚠ Timezone: "today"/month buckets are org-timezone questions (`lib/timezone.ts`).
- ⚠ Money panels stay mounted; any modal takes the caller's `tabActive` or its unsaved-changes
  guard hijacks clicks app-wide.
- ⚠ Colour/contrast guardrails (`check:tokens`, `check:contrast`); no raw hex in TSX.
- ⚠ The Season's End DEMO team (`riverdale-ridge` 13U, archived year) shows a settled Money door
  — if the refund screen's shape changes, check the demo story and `check:demos` still hold.
- ⚠ Migration? Only if the owner's model needs new columns — then dictionary + snapshots in the
  same unit of work, and prod ordering rides the release runbook.

## House rules (short form — AGENCY_RULES.md is binding)

Branch `dev` only. No commit/push without explicit per-action OK. Owner QA rides
`OWNER_QA_LEDGER.md`. `/docs` for the Money guide in the same unit of work if behavior changes.
Product-owner voice in replies; technical detail lives in the plan.
