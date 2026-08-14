# Build prompt — credits meet the bills, money goes out, the refund sheet derives (paste into a fresh chat)

The listening phase is **complete**. The owner walked the seeded numbers, specified the model
across four mockup rounds, ruled all ten calls, and approved. **Do not re-open the design.** Your
job is to build it.

**Plan (authoritative):** `docs/projects/active/COACH_SEASON_REFUND_REVAMP_PLAN.md`
**PM brief:** `..._PM_BRIEF.md`
**Binding mockups:** `claude.ai/code/artifact/eae663d0-56e5-46e9-a2e2-9f7220468be2`
(source `docs/projects/active/COACH_CREDIT_APPLICATION_MOCKUP.html` — tagged
NEW/RESTYLED/UNCHANGED; **the mockups ARE the spec**, including the elements marked UNCHANGED)

---

## ⛔ Before anything: the one hard blocker

**The dues-payment-record project (mig 232) is still UNCOMMITTED on `dev` awaiting the owner's OK,
and every pass here edits files it owns.** Check `TODO.md` and `git status` for the current truth.
If it is still uncommitted, **stop and ask the owner to commit it first** — building on top mixes
two projects into one indivisible working tree, and this repo's working copy is shared by
concurrent agents.

---

## The model, in one sentence

**A credit is money the team owes a family**, settled exactly one of three ways: it lowers their
remaining bills, it is paid out in cash, or it is handed back at season's end. Every credit dollar
is always in exactly one of those states, and

```
credits issued = applied to bills + paid out + owed back
```

must hold for every player, in every mode, at all times. Plan §4.2 — **this is the project's single
best test assertion; assert it over the whole seeded world, not just unit fixtures.**

The distribution rule, stated once (owner, 2026-08-14):

> Owed-back money is paid to whoever earned it. Amounts already settled — forgiven, or handed
> over — count as that family's share, already received. Whatever is left divides evenly among the
> families still taking one.

---

## Read first

1. **The plan** end to end. It carries the arithmetic spec (§4), the data model (§5), the pass
   breakdown (§6), the full reader inventory (§7), and the traps (§11). Do not re-derive any of it.
2. `docs/projects/active/COACH_DUES_PAYMENT_RECORD_PLAN.md` — the model this sits on. Payments are
   facts; paid = payments capped at the schedule total; `reconcileOverpaymentCredits` is the ONE
   overpayment-credit mechanism. **Do not create a second credit mechanism** (CLAUDE.md, binding).
3. `lib/dues-payments.ts` and `lib/dues-status.ts` — read the headers, not just the code. They
   explain *why* coverage is stamped-first and why everything is integer cents. The credit module
   you are about to write is their sibling and must earn the same standard.
4. `tests/unit/dues-definition-guard.test.ts` — the mechanism that stops copy number five. You are
   extending it.
5. `docs/agents/db/DATA_DICTIONARY.md` — `rep_dues_credits` (gotchas 1, 3, 6), `rep_dues_payments`,
   `rep_season_surplus`, `rep_team_expenses`.
6. The screens themselves, logged in as the U15 head coach, **before** reading their code.

---

## The review world (dev)

Org `qa-money-lab`, team **QA Season End U15** (`qa-season-end-u15`). Head coach
`qa-money-head@dev.local` / `devpass123`. Re-seed if missing:
`node --env-file=.env.local scripts/seed-qa-day-fixtures.mjs money`

Verified intact 2026-08-14: 10 players · $600 dues each, fully collected · 30 payment rows
totalling **$6,050** (one family over-sent $50) · credits **$675** ($625 fundraiser + $50
overpayment) · Cookie Dough Drive closed at 25%, raised **$2,500** · budget $7,000, **$6,350** paid
spending.

### ⚠ This fixture cannot tell the new model from the old one

Every family paid in full **before** the drive closed, so all $675 lands in owed-back and
**nothing exercises the applied / paid-out distinction**. **Extending the seeder is part of Pass 1,
not an afterthought** — you need a second team where the drive closes mid-season (credits applied
to real bills), plus a family still owing, a forgiven balance, and a departed player. Without it
Passes 1 and 3 are untestable end to end.

Also: the U15 fixture wrote rows directly, so **it has no ledger entries at all**. Anything you
prove about ledger-derived figures must be proven on data created through the app, or by extending
the seeder to post entries.

---

## ⚠⚠ The two verified findings that moved every number — do not re-introduce them

**1. The fundraiser flow posts the FULL amount raised to the team's books.** The player's rebate is
a credit, not a deduction from income (verified in the entries route: income entry `amount: raised`,
then a separate credit). So the **$1,575** figure that circulated for this team had the rebates
removed *once already* — and today's calculator subtracts all credits *again*, taking the same $625
out twice.

```
Dues received (UNCAPPED)   $6,050.00
Fundraising raised         $2,500.00
Spent                     −$6,350.00
                          ──────────
Cash the team holds        $2,200.00
Owed to families            −$675.00
                          ──────────
Surplus to share           $1,525.00     ÷ 10 = $152.50 each   ← NOT $90
```

**2. The pot must read UNCAPPED receipts.** `duesCollected` caps at each schedule total (via
`duesPaidAmount`) so an overpayment isn't double-counted in a *balance*. For the **pot** that cap is
wrong — the $50 physically arrived and the team holds it. Using the existing Collected/Cash tile
figure understates the pot by exactly the overpayment excess.

---

## ⚠ The build's first act is a REFACTOR, not a feature

**Nothing owns credit arithmetic.** Summing `rep_dues_credits` by player is re-implemented
independently in four server call sites plus once more in the UI (plan §7.1 names all five with
line numbers), and **no test anywhere exercises any of them** — `rep_season_surplus` has no test
file at all.

So **Pass 1 step 0**: build `lib/dues-credits.ts`, move all five onto it as a behaviour-preserving
refactor **with tests**, and only then add the three-state logic. Doing it the other way means
getting the same new rule right five times with no regression net.

Two more inventory findings to resolve while you are in there:
- `money-summary` reports a **second, independent credits number** summed straight off
  `rep_fundraiser_entries.rebate_amount`, bypassing the credits table. It agrees today by
  construction and **will diverge** under this model. Move it or relabel it honestly.
- `fundraisers/entries` computes a credits-subtracted, clamped figure and calls it
  **"outstanding"** — a different number wearing the shared definition's word.

And leave these alone: `budget-vs-actual`, `lib/insights-digest.ts` and the Ask routes exclude
credits **deliberately**. That is a ruling, not an oversight.

---

## Decisions already made — build these, don't re-litigate

All ten calls are ruled in plan §3. The ones most likely to be second-guessed:

- **Cover the bill, never rewrite its amount.** The $800 installment stays $800 and shows "$500
  covered by fundraising · $300 to send."
- **Cash claims a bill before a credit does.** A family who pays everything in cash frees their
  credit to owed-back. **Pin this by test** — it is what makes the model self-correcting.
- **Credit application is DERIVED, never stored.** No `installment_id` on a credit, ever.
- **Forgiveness is a credit** (new type `forgiven`) — it lowers bills like any credit but is never
  owed back and never paid out.
- **Out-of-pocket expenses post NOTHING to the cash ledger.** They count for the budget and Budget
  vs. Actual exactly as before; only the *cash* line excludes them. Plan §4.3.
- **`credit_application` defaults `last_first` for every season** — resolved 2026-08-14 (no teams
  on production; the staged-backfill machinery is dropped).
- **No free-text override of a refund total.** The bounded controls (a set amount / no share /
  forgive) keep the rows adding up to the pot.
- **Surface the cash-timing consequence** (§4.5): a forward-looking split spends money that has not
  arrived. The sheet says which family's money the others are waiting on.

---

## Traps

- ⚠ **Assume every credit sum in the tree is a defect until re-read** — a credit that already
  lowered a bill must not also reduce a balance a second time.
- ⚠ **The refund screen is ALREADY an archive door** (`season-surplus` is in
  `APPROVED_SEASON_AWARE_ROUTES`; `Money` is an approved door). No allow-list gains an entry — but
  an archived season must render the record with **no payout controls, no hold-back, no row menu**,
  and every new write route resolves the ACTIVE year only.
- ⚠ `lib/dues-status.ts` + `lib/dues-payments.ts` (+ your new module) are the ONLY homes for dues
  arithmetic — the definition-guard test fails the build on re-derivations and on naked `paid_at`
  writes. **Verify your new guard rule by BREAKING it**; a green test never shown to fail is not
  evidence.
- ⚠ Money panels stay mounted — any modal takes the caller's `tabActive` or its unsaved-changes
  guard hijacks clicks app-wide (paid for twice already).
- ⚠ Timezone: "the day money left" is an org-timezone date (`lib/timezone.ts`), like
  `received_date`.
- ⚠ Negative money stays red; "still owes" is amber, not danger. **Never colour alone** (the
  olive↔danger ΔE 1.0 deutan finding stands).
- ⚠ Shared modules change ⇒ **dev server restart** before browser testing.
- ⚠ `check:layout` must run on a **restarted** server **against a fixture with real data** — a
  green sweep over an empty Money screen proves nothing (the table-consistency pass's hardest
  lesson). An abort on the memory floor is a **failure**, not a pass; the exit code seen through a
  pipe is `tail`'s.
- ⚠ Migration ⇒ dictionary + `npm run refresh:snapshots` in the **same unit of work**
  (`check:dictionary` gates it). `verify:changed` currently fails only on schema parity (prod behind
  on migs 230/231/232) — pre-existing, resolves at release.

---

## Process

1. **PM UX summary in the conversation first** (AGENCY_RULES, blocking) before any code.
2. Build **Pass 1 → Pass 2 → Pass 3** (plan §6). Each pass is independently shippable and ends
   green. Do not start a pass before the previous one is verified.
3. Per pass: `/simplify` → `/review` → `/docs`. The Money guide describes credits as balance
   reductions, which Pass 1 makes false.
4. Per pass: typecheck (⚠ `npx next typegen` first), `verify:changed`, full unit suite, sliced
   rendered sweep (`--only=coach-dues`), `check:demos`.
5. **Demos:** the sandbox teams pick up the new default. Re-read their narration — and consider
   whether a demo moment should show fundraising lowering a bill, since it is the most sympathetic
   thing this product does. `check:demos` catches breakage, never absence.
6. Owner QA: add a section to `OWNER_QA_LEDGER.md`.

## House rules (AGENCY_RULES.md is binding)

Branch `dev` only. **No commit/push without explicit per-action OK.** Stage explicit pathspecs
only — never `git add -A`; bracketed dirs need `:(literal)`; run `git show --stat HEAD` after every
commit and confirm only your files landed. Product-owner voice in replies; technical detail lives
in the plan.
