# GST/HST · Stage 1 · Part 4: the guard (build prompt)

> Written 2026-11-04 at the end of the session that committed Part 3. Parent prompt (read its ▶ Progress block FIRST: every
> ruling and the open owner follow-ups are there): [GST_HST_STAGE1_BUILD_PROMPT.md](GST_HST_STAGE1_BUILD_PROMPT.md) (its
> "Part 4 · The guard" section is three sentences; this prompt replaces it). Plan of record:
> [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §4 Stage 1. Recommended model: **Sonnet is enough** for the build; the
> three asks below are small. Mark facts [V] (verified by you this session, file:line) or [H] (handed over, unverified).
> Everything here is [H] unless marked: it was read on 2026-11-04, and other sessions (Plans end at the renewal date especially)
> add billing code fast.

## Why this part exists (one paragraph)

Stage 2 will turn tax on, and it promises that **every** paid checkout knows where the buyer is. Parts 1–3 made that true for
the five paid paths that existed on 2026-11-03. Nothing stops the next person who adds a plan, a "Keep" button or a reactivation
from opening a Stripe charge that skips the address — and a missing address silently becomes the wrong tax (plan §7). Part 4 is a
build-time check that fails the build, with a sentence naming the file and what to do, the moment that happens. **No buyer sees
anything change.** No migration, no screen, no Stripe setting.

## Already true when you start

- **Parts 1–3 are COMMITTED on `dev`**: `fd55a1df3` (Parts 1+2, mig 433 dev only), `32d466e59` (Part 3), records `fb6f580a3`,
  `012eef1e4`. Not pushed.
- **The five known paths are already pinned, one by one**, by `tests/unit/billing-location-checkout-guard.test.ts` (Part 2): each of
  A–E calls the ONE shared check `requireBillingLocation` (`lib/billing-location-server.ts`) before its Stripe call and before its
  dev-mock branch, and every caller opens the address window on the refusal. **Do not rewrite that file; Part 4 is what it does not
  do**: it only looks at files it already knows. Part 4 adds the **census** (every Stripe call that can charge, anywhere) and the
  **one-level-down pins** (a new caller of a helper that charges).
- `tests/unit/_source-code.ts` already has `readCode` (comments stripped), `filesUnder(dir, ext)`, `functionBody`, `between` and
  `reachableFrom`. Build the guard from those; do not write a new file walker.
- **Census taken 2026-11-04 [V by grep, line numbers will move]:** the Stripe calls in `app/`, `lib/` and `components/` that create a
  session, a subscription, a schedule, an invoice or an invoice item:

  | Call | Where | What it is | Address? |
  |---|---|---|---|
  | `checkout.sessions.create` | `app/api/billing/create-checkout/route.ts:406` | paths A + B (club plan; Premium → Club) | checked (Part 2) |
  | `checkout.sessions.create` | `app/api/billing/create-team-checkout/route.ts:332` | path C (coach Premium) | checked |
  | `checkout.sessions.create` | `app/api/billing/choose-next-season/route.ts:186` | path D (Founding next season) | checked |
  | `subscriptions.update` | `lib/plan-move.ts:375` (`applyMove`) | path E (a move up, prorated invoice) | checked **in the route**, not in `applyMove` |
  | `subscriptionSchedules.create/update` | `lib/plan-move.ts:424/429` | a move down, at renewal | no: charges a buyer who already paid through a checked path |
  | `subscriptions.update` | `lib/plan-ending-server.ts:506/508` | cancel at renewal / Keep {Plan} | no: same subscription, no new charge |
  | `checkout.sessions.create` mode `setup` | `lib/billing-setup.ts:125` (`createCardSetupSession`) | saves a card, charges nothing | no |
  | `checkout.sessions.create` | `lib/team-org-billing.ts:825` (`startOrgTeamAddonCheckout`) | **dead**: no route calls it | **none — Ask 1** |
  | `checkout.sessions.create` mode `payment` | `lib/stripe-connect.ts:141` (`createCheckout`) | a family paying a CLUB, on the club's account | no: not our plan sale (Ask 2) |
  | `invoiceItems.create`, `invoices.create` | `lib/platform-stripe-fees.ts:243/315/448/493` | the monthly Stripe-fee recovery invoice | **none — Ask 2** (Stage 5 finding) |
  | `billingPortal.sessions.create` | `app/api/billing/portal/route.ts:66` | Stripe's billing page | no: edits no address since Part 3 |
  | `subscriptions.cancel` | several | stops charging | no |
  | `invoices.createPreview` | `lib/plan-move.ts:247`, `lib/workspace-upgrade-preview.ts:29`, `lib/console-money-stripe.ts:178` | a quote, charges nothing | no |

  `scripts/seed-plan-move-walk.mjs` and `scripts/seed-plan-ending-walk.mjs` call `subscriptions.create` against Stripe TEST for
  owner walks. `app/api/billing/mock-apply` is the dev-only plan toggle (404 outside dev [H: line 14]); it takes no address
  (parent follow-up 7).

## Before any code: verify, then ask (no code)

**Verify, reading the code** (a helper agent is fine for the census; open the cited lines yourself):
1. **Re-take the census.** Grep `app/`, `lib/`, `components/` for every Stripe method that can charge or open a charge:
   `checkout.sessions.create`, `subscriptions.create|update|resume`, `subscriptionSchedules.create|update`, `invoices.create|pay|
   finalizeInvoice`, `invoiceItems.create`, `paymentIntents.create`, `paymentLinks.create`. Compare with the table. **Anything new
   since 2026-11-04 is the most important finding of this part**: say which path it is, whether it charges, and whether it checks
   the address. If a new path charges without the check, stop and report before building (that is a Part 2 gap, the owner decides).
2. **Aliases.** Say how each file reaches Stripe (`stripe.` from `lib/stripe`, `getStripe()`, a destructured or passed-in client such
   as `plan-ending-server.ts`'s injected functions) so the census pattern catches every form. A guard that matches only
   `stripe.checkout.sessions.create(` misses `getStripe().checkout.sessions.create(` — the census above already has both.
3. **One level down.** For each checked path whose Stripe call sits in a shared helper (`applyMove`; any other you find), list every
   caller. The guard has to pin the callers, not only the helper, because the address check lives in the route. (Chunk F's
   expensive defects in this repo were all one level down.)
4. **`startOrgTeamAddonCheckout` really is dead**: no importer in `app/`, `lib/`, `components/`; and whether any active plan
   (`docs/projects/active/`, grep the name and "add-on"/"bring in") intends to wire it up.
5. **`/api/billing/mock-apply` cannot run outside dev.** Read the gate; say what it checks.
6. **The two UAT specs** from parent follow-up 1 (`tests/uat/**/team-direct-checkout-smoke*`, `premium-to-club-path*`): read them and
   say exactly where they now meet the address refusal and the smallest fix (seed a `billing_locations` row in their fixture, or PUT
   one through `/api/billing/location` first). Check that `tests/uat/` and its seed helpers are **not** in `WATCHED_PATHS`
   (`scripts/check-agent-automation.mjs`) before proposing to touch them.

**Asks for the owner (present each with a recommendation; do not build before they are answered):**
- **Ask 1 · The dead club add-on checkout** (`startOrgTeamAddonCheckout`, a club paying for a coach's team). It opens a paid Stripe
  checkout with no address check, and nothing calls it today. *Recommendation:* **leave it, and let the guard fail the day anything
  calls it** unless that caller checks the address first. Deleting it reaches into the rep-teams "bring in" program, which owns it
  and may revive it; a guard costs nothing and says exactly what to add. If verify item 4 finds no plan names it at all, say so and
  offer deletion as the alternative.
- **Ask 2 · Two Stripe charges that are allowed without an address, each listed with its reason.** (a) A family paying a club
  through the club's own Stripe account (`createCheckout` in `lib/stripe-connect.ts`): the buyer is the family and the seller is the
  club, so it isn't our plan sale; our payment fee on it is a later stage's tax question. (b) The monthly Stripe-fee recovery
  invoice (`lib/platform-stripe-fees.ts`): it can bill a club that has no paid plan and so no address. It is already recorded as a
  **Stage 5 finding**, and requiring an address here would stop fee recovery. *Recommendation:* **allow both, with the reason
  written in the guard**, so the next reader sees each was a decision and where its tax question lives. Say plainly that until
  Stage 5, (b) is the one FieldLogicHQ charge that can go out with no address on file.
- **Ask 3 · The two broken UAT walks** (parent follow-up 1: they stop at the address window since the Founding window closed).
  *Recommendation:* **fix them in this part** with the smallest fixture change from verify item 6 — they're the only automated
  end-to-end proof that paths A/B and C still reach Stripe. The alternative is to leave them for the owner's walk, where a failing
  spec reads as a regression that isn't one.
- *(Not an ask; state it):* the census covers `app/`, `lib/` and `components/`. `scripts/` is left out on purpose, because the
  seed scripts create TEST subscriptions for owner walks and never run for a buyer. Say so in the guard's header.

## Build

**A · The census** — a new test, e.g. `tests/unit/billing-location-every-path-guard.test.ts`, in the house style (reads source text,
like `tests/unit/promotions-record-only-guard.test.ts` and the Part 2 guard):
- Walk `app/`, `lib/` and `components/` with `filesUnder`; strip comments (`readCode`); find every charging call (verify items 1–2).
- Every hit must be in ONE list, keyed by file and call, each entry carrying either `checked: <how>` (the Part 2 guard pins it) or
  `allowed: <one-sentence reason>` (move down, Keep, setup, Connect, fee recovery, the dead add-on). A hit in no list fails with a
  sentence that names the file and the call and says what to do: *"`<file>` opens a Stripe charge (`<call>`) that isn't on the
  billing-address list. Call `requireBillingLocation` before it (see GST_HST_STAGE1_BUILD_PROMPT.md Part 2), then add it to
  CHARGING_CALLS in this file with `checked`, or with `allowed` and the reason it needs no address."*
- **The list cannot rot the other way either:** an entry whose file or call no longer exists fails too ("remove it from the list"),
  so a deleted path doesn't leave a stale allowance behind.
- Build the matcher as a small function and **test it on fixture strings** (both `stripe.` and `getStripe().` forms, a call split
  across lines, one inside a comment that must NOT count). This proves the guard can fail without planting a fake call in the
  shared tree.

**B · One level down** — pin the callers of each shared helper that charges (verify item 3): e.g. `applyMove` is called only from
files that call `requireBillingLocation` before it (or an `allowed` reason per caller). The same failure sentence, naming the caller.
For Ask 1 as recommended: `startOrgTeamAddonCheckout` has no importer, and the failure for a new one says to add the address check.

**C · Ask 3's fix** (if ruled): the smallest fixture change to the two UAT specs. They need the dev server and the seeded UAT fixture
to run. If no dev server is up, **say "UAT specs not run, no dev server"** — never let an unrun spec read as a pass.

## Rules (from AGENCY_RULES and memory; blocking)

- Present a short task list and the three asks first, and wait. Disagree out loud if the code says something here is wrong
  (the census table is the likeliest thing to be wrong by the time you read it).
- Do not edit `.claude/settings*.json`, hooks, `package.json` scripts, `scripts/check-*.mjs` or anything in `WATCHED_PATHS`. A new unit
  test is picked up by `npm test` on its own.
- Change no product behaviour. If making a path pass the guard seems to need a code change in the path itself, that is a finding:
  stop and report it (the owner decides), don't fix it quietly.
- Verify: the new test, `tests/unit/billing-location*.test.ts`, `npm run check:spelling` on any changed copy, `npm run lint:focused`
  on your files. `npm run typecheck` only if you touched anything outside `tests/`. Other sessions' tests fail in the shared tree
  (on 2026-11-04: `plan-billing-usage`, `public-tournament-stage6-walk`, `stripe-mode`, `support-console-stage3`, `workspace-move-money`,
  `plan-reader-door-guard` at HEAD). Check `git log` on each before calling one theirs, and leave them alone.
- Offer `/review` once before committing (a test-only diff is the standard tier at most; `/simplify` only if you added a shared
  helper to `_source-code.ts`).
- **Commit** on `dev` (re-check the branch), explicit pathspecs, only your hunks in shared files (partial-commit method, memory
  `reference_partial_commit_shared_tree`), `git show --stat HEAD` after; **do not push**. Record "committed `<hash>` <date>" in the
  parent Progress block (Part 4 line), the plan's Stage 1 status line, the PM brief status and the TODO GST line, as a small follow-up
  commit. Grep the TODO line before staging: another session's commit cut it once already (memory `reference_shared_ledger_truncation`).

## After this part

Stage 1 then owes only **Part 5, the closeout** (parent prompt): the **`/accounting` review** (blocking before hand-off; it should
also answer parent follow-up 3, the `ON DELETE CASCADE` against record keeping), **`/docs`** (where we ask for the address and why;
Stripe's billing page no longer edits it), the **owner walk** on the dev site (one purpose; every path, Canada and US, a PO Box
refusal, a disagreeing US card, and the Money-tab block), and the records.

## Out of scope

Tax of any kind; any change to how a path behaves; the removed-last-card webhook gap (parent Part 3 follow-up 1, owned by the
card-on-file reminders); the address strictness items; Stage 5's fee-recovery address; help articles (Part 5).
