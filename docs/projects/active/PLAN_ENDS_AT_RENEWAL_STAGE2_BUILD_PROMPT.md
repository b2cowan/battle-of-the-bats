# Plans end at the renewal date · Stage 2 — a downgrade to the free plan waits for the renewal date (build prompt)

> Written 2026-11-03. Paste into a new Claude chat on `dev`. **Re-verify every lead in the code before building on it**;
> plans and summaries in this repo have been wrong before (this prompt's leads were checked by the writer only where it
> says "verified"; everything marked UNVERIFIED is a helper's reading). Recommended model: Opus 5.5 (money path, a webhook,
> a teardown, emails). Use helpers for broad reading; open every line a decision turns on yourself.
> **No new drawings.** Stage 0 drew every Stage 2 screen (the tab "Moves to the free plan · Stage 2": the page, the Downgrade
> window, Change which you keep, Kept one is gone). Build to it, apply the owner rulings below, and list every departure.

## READ FIRST (in this order)
1. `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`.
2. `docs/projects/active/PLAN_ENDS_AT_RENEWAL_PLAN.md` in full: §1.3, §1.8, §1.9, §3 (the scheduled-downgrade design), §3a
   **G1, G2, G5, G7, G9, G11**, §4 items 1–2, §5, §6.
3. `docs/projects/active/PLAN_ENDS_AT_RENEWAL_STAGE1_BUILD_PROMPT.md`: its rules, "Stage 0 rulings", "What you may not do",
   "The one rule for a subscription's future" (lines ~256–283 — **Stage 2 inherits it; it needs a pure function returning
   carry / restore / refuse, with a test per action**), and `PLAN_ENDS_AT_RENEWAL_STAGE1_PART_C_PROMPT.md` (the overdue step
   and Finish this ending now you will extend).
4. The approved drawings: https://claude.ai/artifact/VbFZCx128jT3sr1zaLyHP4 (source `PLAN_ENDS_AT_RENEWAL_STAGE0_DRAWINGS.html`)
   — the "Moves to the free plan · Stage 2" tab, plus the Keep {Plan}, billing-page and Cancel-window tabs for the shared parts.
5. Memory: `project_plans_end_at_renewal.md`, `reference_partial_commit_shared_tree.md`.

## WHERE THINGS STAND (verify with git; don't trust this list blindly)
- Stage 1 is built and **walked: §444 PASSED 51/51 on 2026-11-03** — Part A `ebffbc1c7`, Part B `b6ae3de78`, Part C `8ce1f4a14`
  (2026-11-02), and the desktop Keep door as a lime button beside "Payment method & invoices" at every width `007b18a5a`
  (2026-11-03). Migrations **424 and 425 are applied to dev only**; prod gets both before any promote.
- **Stage 1 reaches no customer without Stage 2 (G9):** a cancel that waits while a free downgrade ends at once would make
  downgrading worse than cancelling.
- Already built (reuse, never re-implement): the pure ending functions and `applyEnding` (the one cancel teardown),
  `recordStripeSignal` / `endingForDeletedSubscription` in `lib/plan-ending.ts`; `lib/plan-ending-server.ts` deps;
  `lib/plan-ending-store.ts`; the emails and once-only stamps from Part C; the daily job's overdue + reminder steps;
  Finish this ending now; `readEndingAccount`; `keepEnding`; `futureMoveAnswer` (the one-rule function's start).

## OWNER RULINGS 2026-11-03 (all six asks "as recommended" — binding)
1. **Keep on a free move is the same lime "Keep {Plan}" button as on a cancel** (beside "Payment method & invoices", full
   width on its own row on a phone). The drawing shows a sentence-end link; the owner's 2026-11-03 ruling on Stage 1 replaces it.
2. **The data-keeping clock for a downgrade starts on the END DATE** (as a cancel's does), not at the click.
3. **No live paid period → the downgrade stays immediate** (comped, Founding Season, no subscription, `mock_…` ids): use
   `hasLiveSubscription`, never a null check. Say it in the window's words, as a cancel with no paid period does.
4. **Cancel stays offered while a free move waits, and REPLACES it:** the waiting downgrade row is withdrawn (logged) and the
   cancel row scheduled; a later Keep returns the club to its full paid plan — NOT to the downgrade. One waiting change at a
   time. (The drawings do not draw a Cancel window for this case — build it from the existing Cancel window and list it as a departure.)
5. **Emails are built in Stage 2:** a "your move to the free plan is scheduled for {date}" email and a "you are now on the
   free plan" email on the date (the existing `plan_downgraded` email and banner say "now" and would be WRONG at the click).
   Minimal, correct, house voice; Stage 4 polishes. Keep on a downgrade sends the existing kept email's wording adapted. Register
   every key where keys live (platform-admin email list, `/dev/email-preview`).
6. **The safety net covers downgrades:** a missed webhook for a downgraded subscription would leave a paid plan running free.
   The daily job's overdue step, the seven-day reminder and **Finish this ending now** extend to downgrade rows.

## WHAT STAGE 2 MAKES TRUE
- A paid→free downgrade by the owner is **scheduled for the renewal date, not applied at the click.** The plan card, window and
  words say so; the paid plan's limits and the account stay fully live until the date; nothing paid for is taken early; no
  refund. On the date the club moves to the free plan, the tournaments the owner did not keep are archived (recoverable for
  the usual days), online payments close, and the owner is told.
- The owner can **Keep {Plan}** (undo) or **Change which tournament you keep** until the date. The pick list includes
  tournaments created during the wait; any tournament not in the pick when the date arrives — including one created during the
  wait — is archived with restore records (G2). If the kept tournament is gone, the band asks again; with no choice by the date
  the **newest Draft or Active tournament is kept**, as the band says beforehand (Stage 0 Ask 8).
- The old immediate paid branch of `downgrade/confirm` is **closed** (refused, sending the caller to the move). Paid→paid
  down-moves already wait (§1.3); nothing to build there. Upgrades stay instant. Operators' plan moves and overrides stay instant.

## LEADS (verify each)
Verified by the writer on 2026-11-03:
- `app/api/billing/downgrade/confirm/route.ts` is entirely **immediate** today: writes an `applied` downgrade intent (~88–107),
  archives the non-kept tournaments (~109–116) **before** writing their restore records (~118–139) — the unsafe order G11 names
  (safe order: `lib/billing-retention.ts` ~263) — sets `plan_id`/`tournament_limit` (~142–150), calls `closePagesIfPaymentsEnded`
  (~152), and for a target of `tournament` calls `stripe.subscriptions.cancel()` at once (~187–192). Its only Stage 1 change is the
  refusal while a cancel waits (~55–59, `futureMoveAnswer('downgrade')`). Retention is `retentionDeadline()` from today (~81).
- ⚠ **The plan's mechanism (§3: `cancel_at_period_end:true` + a `downgrade` intent) collides with shipped Stage 1 code.**
  `recordStripeSignal` (`lib/plan-ending.ts` ~752–778) treats ANY scheduled cancel on the live subscription as a portal cancel and
  inserts a "Cancelled in the billing portal" **cancellation** row; `endingForDeletedSubscription` (~807–815) looks only for a
  pending **cancellation** first. Left alone, a free downgrade would be recorded as a cancel and **suspend the club**. Both arms
  must learn a pending downgrade row FIRST (a scheduled cancel whose subscription has our pending downgrade row is OURS, not a
  portal cancel; the `deleted` arm applies the downgrade, not a suspension). Propose and wait on the mechanism (see below).
UNVERIFIED (helper reading — open the lines):
- `applyEnding` (~644–741) is cancel-only (records → archive all → suspend → "cancelled" email). A downgrade needs its own path
  with the SAME order: records first and error-checked, reason from the intent, tournaments **re-read at the end date**,
  archive only the non-kept and only what is not already archived, restore records inserted if absent, plan + limit set, account
  stays active, pay pages closed idempotently, one platform event keyed `intent:{id}:…`, pending→applied flipped LAST (G7: replay-safe).
- `keep_tournament_ids` is written by the confirm route and never read back; paid plans store a 9999 limit, so tournaments created
  during the wait are not in the old pick (G2).
- Migration 424's unique index covers `intent_type='cancellation' AND status='pending'` only (424:~52–54): a second pending
  downgrade is not prevented. The plan's §3 says status `scheduled`; Stage 1 uses `pending` — **read the live CHECK constraint on
  `billing_retention_intents`** (the `/dba` live CHECK read is still owed) and prove from the dev snapshot what a downgrade row
  needs before writing a migration. If one is needed: write the file, apply it to dev (the owner has ruled Claude applies to dev),
  refresh the snapshots, update `DATA_DICTIONARY.md`, and say prod is owed with 424/425.
- Words/screens: `W.downgrade.when` (`lib/plan-billing-words.ts` ~283) still says "takes effect today and ends your subscription";
  `BillingBody.tsx` ~688 passes `moveDateLong(null)` (today) to the "Online payments stop on {date}" line; `downgrade/preflight`
  returns no renewal date; `W.notice.downgraded` ("Your plan is now …") and the `plan_downgraded` email are wrong at the click;
  the page's "scheduled" line is fed only by a Stripe schedule read, and its Keep link calls DELETE `/api/billing/move` (which
  cannot withdraw a free downgrade). No operator-record view of a waiting free move.
- Drawing vs shipped Stage 1 (departures to list, not to "fix" silently): Keep is now the lime button (ruling 1); the drawing's
  Reduce-or-cancel text ("Cancelling suspends…" / "Cancel and suspend {Org}…") predates `waitBody` / `W.cancel.waitDoor`; the Keep
  window is the 416px question window titled "Keep {Plan}?" with "Not now"; the drawing has no Keep variant, Cancel window
  or "the move couldn't come back" case for a free move.

## PARTS (each ends with its checks and an ask-before-commit; ONE owner walk after Part C)
**Part A — server.** Decide the Stripe mechanism (below) and the migration, if any. Scheduled free downgrade = a stored pending
downgrade row (target plan, keep set, effective date from the live subscription, retention clock from the end date, change log,
unique per org). `downgrade/confirm`: schedules instead of applying; refuses its old immediate paid branch with plain words and
the move door; keeps the immediate path ONLY for no-live-subscription (ruling 3). Teach `recordStripeSignal` and
`endingForDeletedSubscription` the downgrade row first; a downgrade teardown through the shared order (G11/G7), including the
re-read at the date and the newest-Draft/Active fallback (Ask 8). Keep (owner and operator door) withdraws a downgrade row and
clears Stripe's schedule; owner Cancel replaces a waiting downgrade (ruling 4). The one-rule function for a subscription's
future: a free downgrade meeting a waiting cheaper move carries it forward or refuses in plain words, never drops it (G1/G5) — pure, one test per action.
**Part B — screens.** The page band ("Moves to the free plan on {date}", amber chip, names the kept tournament, says anything else
— including a tournament created before the date — is archived then and kept the usual days), the lime Keep button, the
Downgrade window's dated words and its date in the preflight, **Change which tournament you keep** (a 520px form window; re-runs
the preflight choice; includes tournaments created during the wait; updates the pending row), the "kept one is gone" re-ask,
the success notice as a wait ("moves on {date}"), phone, the operator record's waiting-move line, change doors ABSENT not
disabled while a move waits (Stage 0 ruling 3). A wait message is the white callout with an amber left edge — `PageNotice` gains no amber tone.
**Part C — emails and the safety net.** The two emails (ruling 5) and the Keep email's downgrade wording; the daily job's overdue
step, the seven-day reminder and Finish this ending now extended to downgrade rows (ruling 6; Finish first retrieves the live
subscription; Stripe ended → the downgrade teardown with the data clock from the day it should have ended; still live → change
nothing, correct the record). One date formatter everywhere (G4).

## DECISIONS TO PROPOSE AND WAIT ON (say them in your first message, each with a recommendation)
1. **The Stripe mechanism.** The plan says `cancel_at_period_end` + a downgrade row; the alternative is a subscription schedule with
   a "release to free" phase, or metadata. The collision above is real either way. Recommend the plan's mechanism with both webhook
   arms taught the downgrade row first, because it reuses what Stage 1 walked. Say what each arm does on an `updated` storm and on a replayed `deleted`.
2. **What a downgrade row needs** (status value, unique index, any column) — from the live CHECK read, not from migration files.
3. **Where the Stage 1 words live:** which Stage 1 words/emails you reuse vs add (Stage 4 owns the polish).
4. Any small leftover you find — each with a recommendation; the owner may rule them.

## NOT STAGE 2
Help articles and the full words pass (Stage 4 — append any newly untrue help lines to plan §6). The Stripe test-clock rehearsal
(Stage 3; a free downgrade with a tournament created during the wait is one of its cases). Prices, plan names, gates,
`lib/plan-config.ts`. Refunds or proration. Widening who may cancel, keep or downgrade (owner only). Paid→paid moves.
Premium→Club. The Coaches Portal's plans (no plan switching there). Undoing an applied downgrade (Reactivation stays as it is).

## RULES
- Branch `dev`; never push. Other sessions share this working copy: stage explicit paths only; `TODO.md` is shared — commit
  only the plan's own line (HEAD plus that edit; read the partial-commit memory first). After committing, `git diff HEAD~1 HEAD` on
  every file the previous commit also touched, then `git show --stat HEAD`. **Ask before every commit.**
- **First message, before any code:** a short plain-language UX summary for a product owner (what the owner and the operator see
  and do differently, role differences), your plan, the decisions above, and any disagreement with this prompt — say it out loud.
- No browser, no UAT, no real Stripe calls; unit tests with stubs. Absent beats disabled. One spelling; `npm run check:spelling`.
- Do not edit hooks, `.claude/settings*.json`, `scripts/check-agent-automation.mjs`, any database check or gate, or any script a
  hook runs; do not run `npm run health`. The daily job route is product code, not a watched path.
- A change to what we send, charge or record goes through `/accounting` before hand-off (CLAUDE.md).

## TESTS (the contract — plan §4 item 2 plus the collisions above)
Kept tournaments survive to the date; limits and status unchanged while pending; a tournament created during the wait is
archived with restore records on the date; an `updated` storm on a scheduled downgrade writes NO cancellation row and one
downgrade row; the `deleted` arm applies the downgrade and NEVER suspends; a replayed `deleted`, and a crash part-way through
the teardown, each leave one of everything; the confirm route's old immediate paid branch is refused; no live subscription stays
immediate; Keep withdraws and clears Stripe; Cancel replaces a waiting downgrade and Keep after returns the full plan; the
overdue step and Finish this ending now handle a downgrade row; both new emails send once per row and honour the date formatter;
the kept one gone → newest Draft/Active kept; the page's band, window words and absent-not-disabled doors render.

## ORDER OF WORK AND HAND-OFF
Read → report back (summary + plan + decisions) → build Part A → `/simplify` → `/review` (money path; weigh replay-safety of
every step) → `/billing` → ask before the commit → Part B (same) → Part C (same, plus `/accounting` for the emails) → `/docs` in
REPORT mode (append untrue help lines to plan §6) → checks (`npm run typecheck`; `npm test` — the 5 known failures are
plan-billing-usage, public-tournament-stage6-walk ×3, support-console-stage3-guard; `check:spelling`; `check:dictionary`;
`check:layout` needs a browser, so skip and say so) → record each hash in plan §4 item 2 and the TODO line → update the
auto-memory file. Then propose the one owner walk (a checkable Artifact; extend `scripts/seed-plan-ending-walk.mjs` for a
Tournament Plus club on a real Stripe test subscription) — written in its own session.
Hand-off in product-owner voice: what changed, checks and results, what review found and fixed, departures from the drawing,
owed items (dev-server restart; prod migrations 424, 425 and any new one before any promote; the live-mode read of Stripe's
portal settings (G13 b) before customers; the one owner walk; **Stages 1 and 2 reach customers together**).
