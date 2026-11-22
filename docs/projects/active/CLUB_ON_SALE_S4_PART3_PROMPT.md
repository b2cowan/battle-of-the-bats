# Build prompt — On-sale pages S4, Part 3: free time falls back

> Paste everything below the line into a new chat on `dev` (`/clear` first). Written 2026-11-21, after S4 Part 2 was
> committed (`dba4cd104`, owner "commit, and go with your recommendations on the calls"). **Model: Opus** (accounts and a
> plan-ending change). Helpers read on Sonnet. **Part 3 gets its own `/review` high-risk** (the S4 build prompt's rule).
> Do not overlap a Plan & billing build session: check the board (`plan-billing`) and `git log` and say so in your first
> message.

---

You are building **Part 3 of S4 of the on-sale pages** for FieldLogicHQ: **call 40, option A — buying a plan does not end
free time, and if the paid plan then ends while plan free time runs, the organization falls back to its free plan instead
of closing.** Part 1 (the starts on Plan & billing, `28df8d79b`) and Part 2 (the move to League Plus, `dba4cd104`) are
committed. Part 4 (the second-subscription alert, the onboarding words, the /for-tournament-organizers line) comes after
this one, in its own session. The walk is written once, for the whole of S4, after Part 4.

## Read first

1. `CLAUDE.md`, `AGENCY_RULES.md`, `AGENTS.md`.
2. **The S4 build prompt, `docs/projects/active/CLUB_ON_SALE_S4_BUILD_PROMPT.md`, in full.** Its "binding constraints",
   "Proofs", "Tests and checks", "Reviews" and "Rules" sections apply unchanged. **Part 3 is its section "Part 3 — free
   time falls back".** Do not build Part 4.
3. The plan, `docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md`: S4, its "S4 drawing round" (calls 35–46, all ruled; call 40
   = A) and the **Part 1 and Part 2 entries** under S4 (what they built, decided and carried to Part 3). Owner asks are
   ruled; do not re-open one.
4. The drawing, `docs/projects/active/CLUB_ON_SALE_S4_DRAWINGS.html`, **tab 6 (A free-time org)**, desk and phone, both
   gate states, every numbered note; and tab 10's call 40. The under-the-table sentence there is the build target.
5. The free-time rules: `FREE_TIME_SAME_RULES_PLAN.md`, `lib/free-time.ts`, `lib/free-time-reclose.ts` and
   `lib/free-time-reclose-server.ts`, `lib/plan-ending.ts` (`applyEnding`), `lib/club-free-time-reminders.ts`,
   `lib/billing-webhook-handler.ts` (the subscription-deleted path and the comeback at ~:603-668).

## What the code showed (leads from the Part 1 and Part 2 sessions — open each line before building on it)

- **Today an ended paid plan closes the organization even while plan free time runs**: `applyEnding` suspends it, takes
  the site off, archives tournaments and starts the 90-day clock, and plan free time does not let it back in
  (`lib/free-time-reclose.ts` ~:6-8, `lib/free-time.ts` ~:488-500; Part 1 and Part 2 added lines to `free-time.ts`, so the
  numbers have moved). Only billing-status free time lets an ended organization back in.
- **`applyEnding` callers** (census 2026-11-21): `lib/plan-ending.ts` itself, `lib/free-time-reclose-server.ts`, and
  `app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts`; the webhook's subscription-deleted path reaches it.
  Re-run the census yourself before building (cancel at period end, End now, Stripe giving up).
- **A free-time organization's own plan is `tournament`; its given plan is read by `givenPlanOf`** (`lib/free-time.ts`,
  added in Part 2; `org.planId` is the door's, with the running whole-plan grant applied). Checkout refuses a start at or
  below the given plan (`below_free_plan`, `app/api/billing/create-checkout/route.ts`) — **only when the own plan is
  `tournament`.**
- **The comeback trap:** a free-time organization stored `canceled` would have its first purchase treated as a
  reactivation (restore, the `subscription_recovered` event, the "Welcome back" email) — `lib/billing-webhook-handler.ts`
  ~:603-606, :640-668. Dev fixtures read `active` (drawing round); check again.
- A paid plan above the granted one outranks the grant: the free-time card and its ending reminders go quiet while it runs
  (`lib/free-time.ts` ~:265-269, `lib/club-free-time-reminders.ts` ~:109). Confirm that holds after the fall-back too.
- Stripe test clocks advance subscription periods fine, but a plan MOVE cannot be rehearsed on one (the move reads
  real time). Part 3's endings are webhook-driven, so a clock should work — check how S2's probes drove the webhook
  (`.probe/club-on-sale/s2/`) and the Part 2 proofs (`.probe/club-on-sale/s4p2/`).

## Carried from Part 2's reviews (decide each in this part; say which you built and which you recorded)

1. **A lapsed paid own plan under a higher free plan.** If an ended paid plan leaves the own plan as something other than
   `tournament` while a grant runs, `below_free_plan` is skipped and a start at or below the given plan is let through.
   Part 3's fall-back decides what own plan an ended paid plan stores — make it the free own plan and prove the refusal
   still holds afterwards.
2. **A paying organization with a Club or Club · Association free-time grant can move below it.** The page hides Change
   plan while staff free time runs, but the move route does not refuse a move to a plan at or below a running grant (e.g.
   Tournament Plus paying, given Club, moves to League Plus and pays for nothing it doesn't already have). Recommend
   refusing it on the server with checkout's `below_free_plan` words.

## Owner calls — ask at the start, before code (none is ruled)

1. **The email when a paid plan ends and the organization falls back.** Today the ending sends "Your plan ends on {date}" /
   the ended email built around tournaments going offline. Recommendation: the same emails, with the fall-back sentence in
   place of the offline one ("…{org} goes back to free Tournament Plus through {date}.", no end date: "…goes back to free
   Tournament Plus."), and no "your data is kept for 90 days" line (nothing is suspended). `/legal` reads it (CASL: a
   transactional notice; the words must not promise what the ending doesn't do).
2. Anything the drawing's tab 6 leaves open once you have read the ending code — say what the code does first.

## Build (in order) — the S4 build prompt's Part 3, steps 1–5

1. In the ending (in-app cancel at period end, End now, Stripe giving up): when a running `plan_tier` grant would apply to
   the organization's free own plan, the ending stores the free own plan and does NOT suspend, take the site off, archive
   or start the clock; tournaments over the granted plan's limit follow the shipped retention rule. Free time with no end
   date behaves the same.
2. When that free time later ends with no paid plan, the shipped free-time ending applies (back to free Tournament).
3. Words (drawing tab 6): under the table for a free-time organization — "Starting a plan doesn't end your free time. If
   you stop it, {org} goes back to free Tournament Plus through {date}." (no end date: "…goes back to free Tournament
   Plus."); the cancel window and "Reduce or cancel" for such an organization say the same instead of "tournaments go
   offline". Words through `/marketing`; `/legal` reads them as built.
4. The comeback trap: a free-time organization stored `canceled` must not have its first purchase treated as a
   reactivation. Fix or prove it cannot happen; the production figure is a **count only** (how many free-time
   organizations are stored `canceled`), read by the owner or as a count, never a row.
5. Reminders and the platform-admin free-time console: a grant outranked by a paid plan reads as such (no "ending" email
   while the paid plan runs), and the console does not call it ended.
6. The two carried items above.

## Proofs (dev, Stripe TEST mode, throwaway organizations, teardown proved — the S4 prompt's "Proofs" rules)

A free-time organization (a throwaway one, or `dev-tplus-org` restored after: owner `owner@dev.local`, Tournament Plus free
through Sep 30, 2027 — record its state first) starts Club, then: **cancel at period end → at the end it falls back to free
Tournament Plus**, site on, nothing archived, no 90-day clock, no "Welcome back"; **End now** → the same; **Stripe giving
up** (a failing card through the retries, on a test clock) → the same; free time with no end date → the same; and after the
free time itself ends with no paid plan → the shipped free-time ending. Teardown with `invoices.search` / per-customer lists
(memory `reference_stripe_list_hides_test_clock_objects`).

## Tests and checks

Unit: every `applyEnding` path falls back while a plan grant runs and closes as before when none does; the no-end-date
grant; the comeback trap; the reminders stay quiet while a paid plan outranks the grant; the under-table line and the cancel
window's words for a free-time organization (and unchanged for everyone else); the carried items; a Premium coach's Plan &
billing unchanged. `npm run verify:changed` (other sessions' work fails parts of it — the Part 2 session saw 35 failures,
none its own, among them `workspace-move-money` "…a different reason tag", `account-first-signup` "sits in Workspaces…"
and the type error in `layout-run-journal.test.ts`; re-check before calling one yours), `npm run typecheck` with
`NODE_OPTIONS=--max-old-space-size=8192`, the spelling gate. Layout: `check-layout-invariants.mjs --only=<ids>` on the
screens touched (`--changed` widens to the whole product because other sessions touched `app/globals.css`; never sweep on
the dev server). ⚠ The `orgOwner` layout session has expired; refreshing it signs every other session out — ask the owner.
After-shots with the S4 capture script (`.probe/club-on-sale/s4/capture-s4.mjs`, `--out=docs/projects/active/club-on-sale-s4/after-p3`;
shots 03 and the cancel window), desk and phone, both gate states.

## Reviews before handing off (run them)

`/review` **high-risk** on Part 3 alone; `/billing` (the ending, the comeback trap, the carried items); `/accounting` (an
ended paid plan that falls back: what is invoiced, refunded or credited — call 40); **`/legal`** (the under-table line, the
cancel window and the email as built — it caught v1 promising the fall-back before it was true); `/marketing` (every word
as built); `/design` (tab 6 against the build). Offer `/docs` (help: free time, cancelling).

## Rules

The S4 prompt's "Rules" section. Branch `dev`; explicit pathspecs; **no commit without the owner's yes**; the plan, the
board, `PLAN_PRICING_FACTS.md` and `BUSINESS_DECISIONS.md` carry other sessions' uncommitted edits — stage only your hunks
on HEAD (`git hash-object -w` + `git update-index --cacheinfo`, memory `reference_partial_commit_shared_tree`). A migration
(if the fall-back needs one) updates `DATA_DICTIONARY.md` and the snapshots in the same unit and goes on
`MANUAL_PROD_STEPS.json`. Record Part 3 in the plan's S4 entry and the board's `club-tier` line in the same commit.

## Hand-back

What a free-time owner sees and what happens to their organization when a paid plan stops (product-owner voice), how to
see it on dev (Dev tools › Plan gates › "Show as closed" for the gate states), the proofs' results, the reviews' findings
and what was applied, the production count owed (free-time organizations stored `canceled`), and what Part 4 inherits.
