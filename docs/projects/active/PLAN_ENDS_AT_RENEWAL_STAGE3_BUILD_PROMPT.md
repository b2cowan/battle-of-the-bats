# Plans end at the renewal date · Stage 3 — the Stripe test-clock rehearsal (G10) + the portal-settings check (G13) (build prompt)

> Written 2026-11-04. Paste into a new Claude chat on `dev`. **Re-verify every lead in the code before building on it**;
> plans and summaries in this repo have been wrong before (leads below are marked "verified" only where the writer opened the
> lines; everything else is a reading). Recommended model: Opus 5.5 (it drives a money path and reasons about what Stripe
> does). Use helpers for broad reading; open every line a decision turns on yourself.
> **No new drawings and no customer-facing screen.** Stage 3 builds a script and an evidence report. If the rehearsal shows a
> product defect, that is a FINDING for the owner (see "Findings policy"), not a licence to change Stage 1/2 code on the way past.

## READ FIRST (in this order)
1. `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`.
2. `docs/projects/active/PLAN_ENDS_AT_RENEWAL_PLAN.md`: the stage list of record, §3a **G1, G2, G3, G5, G7, G8, G10, G13**, §4
   items 1–3, §5 (the "Noted, not built" lists name cases this rehearsal should settle).
3. `lib/plan-ending.ts` (`recordStripeSignal`, `endingForDeletedSubscription`, `applyEnding`, `applyDowngrade`, overdue
   functions), `lib/plan-ending-server.ts`, `lib/plan-ending-store.ts`, `app/api/billing/webhook/route.ts` (the arms:
   `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded/failed`, `customer.subscription.trial_will_end`),
   the daily job's `plan_ending_emails` and `overdue_endings` steps.
4. The two existing fixtures, **to reuse their guards and their way of making a club that owns a real Stripe test
   subscription**: `scripts/seed-plan-ending-walk.mjs`, `scripts/seed-plan-move-walk.mjs` (the Stage 1 and Stage 2 owner-walk seeds).
5. `lib/stripe-mode.ts` (the ONLY place a key prefix is read), `lib/stripe-portal-settings.ts`, `lib/stripe-portal-config.ts`,
   `scripts/audit-stripe-billing.mjs` (`auditPortal`), `tests/unit/stripe-mode.test.ts` (the build fails on a prefix test of your own).
6. Memory: `project_plans_end_at_renewal.md`, `reference_partial_commit_shared_tree.md`, `reference_backticks_in_shell_strings.md`.

## WHERE THINGS STAND (verify with git; don't trust this list blindly)
- Stage 1 (cancel at renewal) is built and **walked: §444 PASSED 51/51, 2026-11-03**. Stage 2 (free downgrade at renewal) is built
  — Parts A `155c9a615`, B `bcb569bd7`, C `22335eae4` (2026-11-04); its owner walk **§453 is written and OWED**. Migrations
  424, 425, 431, 434 are applied to dev only.
- **Every unit test so far runs against stubs.** Nothing has watched Stripe itself deliver a renewal. That is the whole reason
  for this stage: *which events arrive at the period end, in what order, what `cancel_at` vs `cancel_at_period_end` really do, what a
  subscription schedule does to a cancel, what a failed card does while a cancel waits.*
- Stripe's test webhooks go to the **dev site** (`dev.fieldlogichq.ca`), which is how the §444 walk ran. At the writer's check
  `origin/dev` equalled `HEAD` — confirm the dev site is running Stage 2 Part C before any run (a stale dev site makes every
  result meaningless).
- The Stripe CLI is installed on the owner's machine (`stripe.exe` via winget). `stripe` npm SDK is `^22.1.0`; the audit pins API
  version `2026-04-22.dahlia` — read the version the webhook route and the lib actually use and match it.

## WHAT STAGE 3 MAKES TRUE
- **A committed, re-runnable script** that creates test-mode customers on Stripe **test clocks**, drives each case below, advances
  the clock past the renewal, waits for the webhooks to land on the dev site, and then reads **our dev database** and **Stripe's own
  event sequence** for that customer. Each case has its EXPECTED end state written down before anything runs; the run compares.
- **A readable evidence report** (per case: what was done, the exact events Stripe sent in order, what our database holds now,
  expected vs observed, PASS / FAIL / SURPRISE). It is what the owner walk reads. It names every place Stripe behaved
  differently from the plan's assumption — a surprise that still ends well is a SURPRISE, not a pass.
- **The portal-settings check (G13 a)** runs first and stops the rehearsal if wrong. **G13 (b)** — the same two facts read from the
  LIVE account, read-only — is a separate recorded step (see below); the script itself never touches a live key.
- Nothing in production, nothing in a live Stripe object, nothing a customer can see.

## DISAGREEMENTS WITH THE PLAN TO SAY OUT LOUD IN YOUR FIRST MESSAGE (the writer's, verified in code)
1. **G13 is mostly built already.** `scripts/audit-stripe-billing.mjs` `auditPortal` (lines ~386–433) already lists the portal
   configurations, finds OUR pinned version, and asserts cancel = on at `at_period_end`, plan switching = off, pause = off, against
   the same constants `lib/stripe-portal-settings.ts` creates the configuration from. The plan (written before Plans & pricing S8)
   describes new script code. **Reuse it** (import the constants, or run the audit's portal function) — do not write a third copy
   of the assertions. The audit is also exactly the **read-only live read** G13 (b) wants: `node scripts/audit-stripe-billing.mjs
   --env .env.production.local` lists, never writes. Verify it creates and updates nothing before recommending the owner run it,
   and note it prints a WARN (not a FAIL) when our configuration does not exist in that mode yet — in test mode the rehearsal
   should find-or-create it through the app's own `lib/stripe-portal-config.ts` (a test-mode write, fine) rather than treat WARN as pass.
2. **"A script under `.probe/`" (G10) is the wrong home.** `.probe/` is scratch. A rehearsal the owner wants to re-run before every
   promote that touches billing belongs in `scripts/` beside the two walk seeds; its OUTPUT goes to `.probe/`. Recommend that.
3. **Two things a script cannot honestly do:** click Stripe's hosted portal, and make a real card fail the way a bank does. The
   "cancel in the portal then Renew" case is therefore the portal's *effect* applied through the API (`cancel_at_period_end` on,
   then off) after the portal configuration is asserted — it proves OUR reaction, not Stripe's page. Say so in the report; do not
   let the case title claim more. A failing card uses Stripe's documented failing test payment method, attached before the clock moves.
4. **The rehearsal shares the dev site and the dev database with the owner's walk.** A rehearsal club and a walk fixture both
   fire webhooks at the same endpoint. Do not run while the owner is mid-walk (§453); ask first. Mark everything the script makes
   with one marker (as the seeds do) so `--reset` removes exactly that.

## THE CASES (each: setup · action · clock move · EXPECTED end state — write the expected block FIRST, in the file, before a run)
Plan G10's list, plus the cases Stages 1–2 added. Order them so a cheap, fast case fails first.
0. **Portal assertion (G13 a)** — our pinned configuration (find-or-create in test mode): cancel on at period end, plan switching off.
1. **Control: renews with nothing pending.** Advance past the first renewal. Expect: our renewal date moves, plan unchanged,
   nothing archived, no ending email, no retention row. (Proves the harness sees a normal renewal as quiet.)
2. **Cancel, monthly.** Owner cancel → advance past the period end. Expect: Stripe `deleted` arrives AT the end, club ends (suspended /
   retention per Stage 1), the ending row `applied`, "ended" email once, data clock from the END DATE.
3. **Cancel, annual.** Same, but first advance ONE MONTH and prove nothing ends early and no monthly-style event fires; then
   advance past the year. (Annual is where "up to 11 months between click and end" lives.)
4. **Cancel while trialing.** Expect: no "trial ending, add a card" email (G5); the end at trial end; no charge.
5. **A card fails while a cancel waits.** Expect (write it from the code, then see): which of `invoice.payment_failed` /
   `past_due` / `deleted` arrive and in what order, that the club is not left both "past due" and "ending" in a contradictory
   state, and that the ending still applies once.
6. **Portal-style cancel, then Renew (effect via API).** Expect the waiting row withdrawn, the kept email once; and **observe, do
   not assume,** the Part C open item: Renew does NOT put back a cheaper move the cancel set aside.
7. **Cancel while a cheaper-plan move waits, then Keep (G1).** The subscription schedule that holds the move blocks a cancel flag
   — find out exactly what Stripe says, and that Keep re-schedules the cheaper move (never renews at the higher price).
8. **Free downgrade, a tournament created during the wait (G2).** Expect: limits unchanged until the date; on the date the kept
   tournament survives and the new one is archived WITH restore records; account stays active; the "now on the free plan" email once.
9. **Free downgrade then owner Cancel (replaces), then Keep.** Expect the full paid plan back, not the downgrade.
10. **End now (operator, immediate).** Expect Stripe stopped, the plan ended at once, typed reason recorded.
11. **A replayed `deleted` (G7).** Re-deliver the SAME event (Stripe CLI `events resend`, or a correctly signed POST) after the
    ending has applied — and once more part-way if you can pause it. Expect one of everything: one email, one platform event, one set
    of restore records.
12. **An `updated` storm on a pending cancel and on a pending downgrade.** Replay several `updated` events; expect ONE pending row,
    NO cancellation row for a downgrade (the Stage 2 collision), emails once.

If a case cannot be driven honestly, say so and cut it; do not fake it. Missed-message / Finish-this-ending-now is already
exercised by the §444 and §453 fixtures — do not rebuild it here.

## LEADS (verify each)
- Test clocks: a customer is attached to a clock **at creation** (it cannot be moved later); the clock advances by setting a new
  frozen time and processes **asynchronously** (poll its status until it is ready before reading anything); one advance may not
  jump more than about two billing intervals; a clock holds only a few customers and the account has a clock cap. **Read Stripe's
  current limits and the SDK v22 call shapes from the docs, not from memory.** A reasonable default is one clock per case.
- Deleting a clock deletes its customers and subscriptions. **Observe whether that fires `customer.subscription.deleted` at the dev
  site** — the Stage 1 reset learned that stopping Stripe BEFORE removing the clubs ends the club and sends mail. Reset order:
  remove our rows first, then the clocks. Write the finding either way.
- The dev site is reached by webhook, the script is not: record Stripe's own sequence from the events API (`events.list` for the
  customer, ordered), then poll our dev database until the expected state appears or a timeout passes. A timeout is a FAIL that
  names what never arrived.
- Reuse the seeds' guard. Decide test/live **only** through `lib/stripe-mode.ts` (`stripeKeyIsTest`): refuse anything that is not a
  test key, a missing key included. Writing your own `sk_live_` test trips the build (the Stage 2 walk seed tripped it once). Also
  refuse to start unless the Supabase URL is the DEV project.
- `lib/stripe-portal-config.ts` may or may not import cleanly under plain node (`.mjs`) — check; the audit loads
  `lib/stripe-portal-settings.ts` because it has no runtime imports. If the config module cannot load, create nothing new in the
  script: ask the dev site to open the portal once, or call the Stripe API with the same constants.
- Existing fixtures make clubs on real Stripe TEST subscriptions with no clock. A club needs the plan/price rows the dev database
  holds (`stripe_prices`, sandbox environment) — read how the seeds pick the price; do not hard-code ids.

## DECISIONS TO PROPOSE AND WAIT ON (say each in your first message, with a recommendation)
1. **Where the script lives:** `scripts/rehearse-plan-ending.mjs` (committed, re-runnable) with output to `.probe/plan-ending-rehearsal/<timestamp>/`.
   Recommend this over the plan's `.probe/`.
2. **Where the webhooks land:** the deployed dev site (matches the walks, tests the real route) vs a local dev server with
   `stripe listen --forward-to`. Recommend the dev site, with the Stripe CLI as the fallback if it is down; the CLI's `events resend`
   for case 11 either way.
3. **Findings policy** (below) — confirm it.
4. **Evidence format:** one `results.json` + one `report.md`, plus a `--keep` flag that leaves one club per case in dev (so the owner
   can open the billing page for a waiting cancel / a waiting move during the walk) and a `--reset` that removes exactly the marker.
5. **G13 (b):** recommend the owner (or you, with his go) runs the existing audit read-only against the live env and the result is
   written, with the date, into plan §4 item 3 and the release record — a separate step, not part of the build.
6. Any small leftover you find — each with a recommendation; the owner may rule them.

## FINDINGS POLICY (recommended — propose it)
The rehearsal exists to find defects, so some run will. **Do not change Stage 1/2 product code inside Stage 3.** For each failure or
surprise: classify it (product defect · wrong expectation in the plan · harness/fixture mistake · Stripe test-mode artifact),
cite the evidence, give a recommendation, and list it. Harness/fixture mistakes you fix yourself. Product defects go to the owner as a
numbered list with a proposed fix; he rules, and the fix is its own small, reviewed change. This keeps the evidence the walk reads
from being rewritten by the thing it tests.

## NOT STAGE 3
Words, emails, help (Stage 4). Any screen. Shipping, production migrations, the live-mode read itself being automated (Stage 5).
Changing the portal configuration (bump `PORTAL_CONFIG_VERSION` is a separate decision). Prices, plan names, gates. Refund or
proration behaviour (the ruling is none). A Playwright/browser run of the hosted portal. Missed-message and Finish-this-ending-now
(the §444/§453 fixtures). Paid→paid moves except as case 7 touches them.

## RULES
- Branch `dev`; **never push**. Other sessions share this working copy: stage explicit paths only; `TODO.md` is shared — commit
  only the plan's own line (HEAD plus that edit; read the partial-commit memory first). After committing, `git diff HEAD~1 HEAD`
  on every file a previous commit also touched, then `git show --stat HEAD`. **Ask before every commit.**
- **First message, before any code:** a short plain-language summary for a product owner (what this proves, what he will be able
  to read at the end, what it costs him — the dev site is busy during a run), your plan, the decisions above, and any
  disagreement with this prompt — say it out loud.
- **Real Stripe test-mode calls and dev-database writes are the point of this stage — but ask for the owner's go before the FIRST
  real run** (the owner may be mid-walk on the same dev site). Never a live key, never the production database. Unit tests with
  stubs for the script's pure parts; the run itself is the integration evidence.
- No browser, no UAT. One spelling; `npm run check:spelling`. Absent beats disabled.
- Do not edit hooks, `.claude/settings*.json`, `scripts/check-agent-automation.mjs`, any database check or gate, or any script a hook
  runs; do not run `npm run health`. The new script is run by hand and is not a hook script — check it is not on `WATCHED_PATHS`
  and do not add it.
- No schema change is expected. If one seems needed, stop and ask (the `DATA_DICTIONARY.md` rule applies).
- Nothing here changes what we charge, collect, invoice or record for a customer, so `/accounting` is not required — say that, and
  if a case shows otherwise, stop and report.

## TESTS (the contract)
- The refusal: not a test key (live, restricted live, empty, missing) and a production Supabase URL each make the script exit before
  any call; decided through `lib/stripe-mode.ts`.
- The expectation comparer (pure): PASS / FAIL / SURPRISE classification, a timeout names what never arrived, an event-order
  assertion catches the wrong order.
- The portal assertion uses the same constants as the audit (one source — a test fails if the two drift).
- Reset removes exactly the marker's rows and clocks and nothing else.
- Nothing in the script decides live/test with a prefix literal (the existing guard enforces it).

## ORDER OF WORK AND HAND-OFF
Read → report back (summary + plan + decisions + disagreements) → write the expectations block and the pure parts with their tests →
`/simplify` offer (the two walk seeds and this script will share setup — reuse rather than a third copy) → owner's go for the first real
run → run case 0, then 1–2, then the rest, one at a time; stop and report on a surprise → write `report.md` → `/review` offer (the
comparer and the guard are the parts worth an adversarial read) → ask before the commit → record the hash in plan §4 item 3, the
stage-list line and the TODO line → update the auto-memory file.
Checks: `npm run typecheck`; `npm test` (known failures at the Stage 2 hand-off: plan-billing-usage, public-tournament-stage6-walk
×3, support-console-stage3-guard — re-check, don't trust); `check:spelling`; `check:dictionary` only if a schema file moved;
`check:layout` needs a browser — skip and say so.
Hand-off in product-owner voice: how many cases ran and what each showed, every SURPRISE and FAIL with its classification and a
recommendation, what remains unproven (the hosted portal's page, a real bank decline), the G13 (b) live read still owed, and
that **the one Stage 3 owner walk is written in its own session from `report.md`** (a checkable Artifact that reads the report and
opens the `--keep` clubs). Owed items: the dev-server restart if shared modules moved, prod migrations 424 → 425 → 431 → 434 before any
promote, **Stages 1 and 2 reach customers together**, and the Stage 2 walk §453 if it is still unwalked.
