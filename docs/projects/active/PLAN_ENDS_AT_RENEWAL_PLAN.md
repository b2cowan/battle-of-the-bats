# Plans end — and step down — at the renewal date (cancel, downgrade to free, downgrade to a lower paid plan)

**Status:** RULED by the owner 2026-10-31 (from walk item D3, Support Console Stage 2 walk). Planning only — nothing built.
**Gap review 2026-10-31:** a second read of this plan against the code found three money gaps, a test gap and six smaller ones; the
owner accepted every recommendation the same day. They are §1 items 7–9, §3a, and the re-cut stages in §4. Where §3 and §3a
disagree, §3a wins.
**PM brief:** `PLAN_ENDS_AT_RENEWAL_PM_BRIEF.md`. **Family:** Plan & billing (`PLAN_AND_BILLING_ONE_EXPERIENCE_PLAN.md`) — billing/entitlements program.
**Sequence rulings (owner, 2026-10-31, all as recommended; index https://claude.ai/artifact/Kua6RAqMA7ChA7QBTNE63a) — these
win over §3 G13 and §5 where they disagree:**
(1) **Portal settings live in our code.** Plans & pricing Stage 0 (S8) creates and pins our own portal configuration (cancel at
period end, no plan switching); G13's test and live checks assert on OUR configuration. "No configuration is created in code"
and "fix the Dashboard setting, do not build around it" are superseded.
(2) **Plans & pricing Stage 0 S5** (billing-webhook event log, ordering guard, live/test check) lands before Stage 1's webhook
work, or in the same session — Stage 1 does not build its own replay workaround (G7 is re-cut against S5's log).
(3) **Stage 1 carries the one rule for a subscription's future** (Plans & pricing G5): any customer or staff action that meets a
scheduled price move carries it forward or refuses with plain words, never drops it. Written into the Stage 1 prompt before
it is built; the Premium→Club move obeys it.
(6) **Help waits for this plan.** Today's screens say a downgrade "takes effect today" and the server applies a Club/Association
downgrade at once; this plan fixes both, and Plan & billing Stage 5's help rewrite is not written before it (Stage 4 here and
that Stage 5 run as one help pass).

**Order across the five plans (set by Claude at the owner's request 2026-10-31; the owner may reverse it on the index):** 0 owner desk → 1 finish Plan & billing
4b Part 4 → 2 Plans & pricing Stage 0 (S5 and S8 first — rulings 1 and 2) → **3 this plan's Stages 1–3, with GST/HST Stage 1
(the address)** → 4 tax live (GST/HST Stages 2–3 + Terms) → **5 ONE help pass (this plan's Stage 4 + Plan & billing Stage 5)** →
6 Club on sale (Coaches Portal and Tournament Plus already selling; "launch together" dropped 2026-10-31) → 7 Plans & pricing program. The Stage 1 prompt stays on its ⛔ HOLD until step 2 has landed.

## Stage list of record (owner, 2026-10-31)

Every outstanding piece of work has a home below. **Where this list and the stage text in §4 disagree, this list wins.** Stages 1–3 each END WITH AN OWNER WALK (a checkable Artifact, one purpose per walk) after `/simplify` then `/review`.

- **Stage 0 — Drawings (G12):** DONE. Nine tabs, published `VbFZCx128jT3sr1zaLyHP4`; the owner ruled all nine asks "A" (as recommended) on 2026-10-31.
- **Stage 1 — Cancel at renewal (both doors) + the stored fact:** NOT STARTED, **ON HOLD until Plans & pricing Stage 0 fixes S5 (webhook event log, ordering, live/test) and S8 (our own portal settings) land**, and until the Plans & pricing G5 rule for a subscription's future is written into its prompt (sequence-index i23). Scope: migration + dictionary, scheduled intent, owner cancel (org + Coaches Portal), operator Cancel + End now, webhook arms, Keep {Plan} restoring a waiting move (G1), overdue step + Finish this ending now (G3), one date formatter (G4), trial-email skip (G5), the click/keep/seven-day emails (G6), replay-safe teardown (G7), both cancel signals (G8). **Ends with an owner walk.**
- **Stage 2 — Downgrade to free at renewal:** NOT STARTED. Scope: the scheduled free downgrade (stored keep-set, applied at the end date as a downgrade through the shared teardown order — G11), the "Moves to the free plan on {date}" band, **Change which tournament you keep** (G2), Keep {Plan}, and `downgrade/confirm` **refusing its old immediate paid branch**. Paid-to-paid down-moves already wait for renewal (§1.3) — nothing to build there. Reaches customers together with Stage 1 (G9). **Ends with an owner walk.**
- **Stage 3 — Stripe test-clock rehearsal (G10) + portal-settings check (G13):** NOT STARTED. Test mode only; the script refuses a live key. **Ends with an owner walk** fed by the rehearsal's results.
- **Stage 4 — Words, emails, windows, help:** NOT STARTED; runs as ONE pass with Plan & billing Stage 5 (gated on the `/marketing` price-form call and GST/HST Stage 2, tax live). Full scope: both cancel windows and the downgrade windows; billing-page copy (`PLAN_AND_BILLING_COPY.md`); the five emails (ends-on, ended, downgrade scheduled, kept, seven-day reminder) **registered where template keys live (platform-admin email list and `/dev/email-preview`)**; help articles + `keywords`/`searchText` (`/docs`); **platform-admin help**; the **Support Console walk row D3** answer; the demo seed check (`/demos`); `check:spelling`.
- **Stage 5 — Ship (NEW):** NOT STARTED. The Stage 1 migration (unique index + G1 column) **applied to production**, with `DATA_DICTIONARY.md` and `npm run refresh:snapshots` current; the **live-mode portal-settings read (G13(b))** recorded with its date in this plan and the release record; **Stages 1 and 2 reach customers together (G9)**; everything on production, recorded in the release record; this plan and its PM brief moved to `docs/projects/archive/`.

**Done when** Stages 1–5 are complete.

## 1. The ruling (owner, 2026-10-31)

A customer has paid ahead and there is no refund, so **nothing they paid for is taken away early**.

1. **Cancel** — by the owner or by us — ends the plan **on the renewal date**, not now. Full access until then.
2. **Downgrade to free** — same: the plan steps down on the renewal date.
3. **Downgrade to a lower paid plan** — same: steps down on the renewal date, **no proration credit**. ⚠ **CORRECTED 2026-10-31 after the `/billing` review:** this is **already how the product's screens behave** — a paid→paid down-move is a Stripe subscription schedule at renewal with `proration_behavior: 'none'` (`lib/plan-move.ts` ~412-441; ruled 2026-09-25). Only the old server route `downgrade/confirm` still has an immediate paid branch (plan dropped at once, `create_prorations`), and **no screen reaches it** (`lib/plan-billing-profile.ts` offers `downgrade` only for Tournament Plus → free). Stage 2 therefore = downgrade to free + **close that old paid branch**, not a new paid→paid build. **Upgrades stay immediate.**
4. **Keep my plan** (undo) is offered on both doors while a change is pending. The old "never offered as Put it back" line on the operator Cancel window was about an *immediate* cancel; it applies again only once the plan has actually ended.
5. **Operators keep one immediate door**: a platform-admin-only **End now** (abuse, fraud, chargeback) — secondary, never the default, never offered to owners.
6. **Out of scope, unchanged:** the next-season choice (a Founding Season placeholder subscription that charges nothing and is replaced when the account picks again — no paid period exists to honour); operator plan moves/overrides (intentionally instant); checkout, upgrades, reactivation.
7. **Keep my plan puts back a waiting cheaper-plan move** (owner, gap review 2026-10-31). A club that scheduled a move to a
   cheaper plan and then cancelled renews on the **cheaper** plan if it keeps — never on the price it had already chosen to leave.
8. **A waiting downgrade to free can have its kept tournament changed** until the date, and the band says plainly that a
   tournament created before the date is archived then (and kept for the usual days, so it can come back) unless it is the one
   they keep (owner, gap review 2026-10-31).
9. **Customers get Stages 1 and 2 together** (owner, gap review 2026-10-31): cancel waiting for renewal while downgrade-to-free
   still ends at once would make downgrading worse than cancelling. A dependency, not a date.

## 2. What the code does today (read 2026-10-31 — argue from this, not from the plan)

- `app/api/billing/cancel/confirm/route.ts` (owner, org + Coaches Portal branches) and `app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts` (operator): write a `billing_retention_intents` row `status='applied'` **at click time**, archive tournaments, set `subscription_status='canceled'` + `billing_suspended_at`, close online-payment pages, then `stripe.subscriptions.cancel()` immediately.
- `app/api/billing/downgrade/confirm/route.ts`: sets `plan_id`/`tournament_limit` immediately, archives tournaments not kept, closes pay pages if the target has no online payments; then Stripe: to `tournament` → `subscriptions.cancel()`; to a lower paid plan → `subscriptions.update()` with `proration_behavior: 'create_prorations'` (**that paid branch is unreachable from any screen** — see §1.3). The screens' paid→paid down-moves go through `lib/plan-move.ts` (schedule at renewal, no credit) and are already correct.
- `customer.subscription.deleted` webhook arm already contains a full **Stripe-initiated ending** path (retention for an org; `applyCoachesPortalStripeRetention` for a Coaches Portal; the "cancelled" email), guarded by a dedup check that finds an *applied* intent and skips retention. A cancel through Stripe's own portal reaches this path at period end today (**verify the portal configuration is set to cancel at period end — it lives in the Stripe Dashboard, not in code** — now plan step G13).
- Nothing stores "ends on". `cancel_at_period_end` is read only by the money console and the fee ride; `currentPeriodEnd` is already on the org (`lib/types.ts`) and drives the "renews on" line.
- The next-season choice (`choose-next-season`) cancels only its own prior placeholder; its `subscription.updated`/`deleted` handling is the `choiceKind` branch that runs before the ordinary arm.

## 3. Design

**One stored fact: a scheduled change.** A pending change is `{kind: cancel | downgrade, effective_at (= current_period_end), target_plan?, keep_tournament_ids?, reason, requested_by}`.

- **Home:** a `billing_retention_intents` row (intents already carry `intent_type` cancellation/downgrade, `target_plan`, `keep_tournament_ids`, `reason`, `created_by`). **No migration is likely:** the table's status CHECK (migration 038) already allows `pending` and `canceled` — use `pending` = scheduled and `canceled` = withdrawn — and `effective_at` already exists (NOT NULL, default now(), today vestigial) to hold the end date. The webhook dedup filters `status='applied'`, so a `pending` row never suppresses retention. *Stage 1 verifies this against the dev+prod snapshots and every reader of `status` before relying on it; the alternative is a column pair on `organization_billing_facts`.* Reviving the "dead" enum values and `effective_at` means `DATA_DICTIONARY.md` is updated in the same unit of work (and `npm run refresh:snapshots` if any schema changed).
- **Click time (cancel):** Stripe `cancel_at_period_end: true`; write the `scheduled` intent (reason kept); send "Your plan ends on {date}" email. **No** status flip, **no** archiving, **no** pay-page closing, **no** suspension.
- **End date (cancel):** `customer.subscription.deleted` fires. The arm promotes the `scheduled` intent to `applied` and runs the *existing* retention, suspension, pay-page closing and "cancelled" email. A cancel made in Stripe's portal gets no intent — the existing Stripe-initiated path covers it unchanged, and the `subscription.updated` arm now also records "ends on" from Stripe so the billing page shows the band for it too.
- **Keep my plan:** Stripe `cancel_at_period_end: false`; the intent is marked `withdrawn`; the band disappears. The `updated` arm also clears it when Stripe reports `cancel_at_period_end` false (portal "Renew" button).
- **Downgrade to free:** an intent `scheduled` holding `target_plan='tournament'` and the owner's `keep_tournament_ids`; Stripe `cancel_at_period_end: true`. ⚠ The Stripe-initiated deletion path would treat this as a full cancellation and suspend the account — so the deleted arm must look for a scheduled *downgrade* intent first and apply the **downgrade** (plan → free, archive the non-kept tournaments, close pay pages) instead.
- **Downgrade to a lower paid plan:** nothing to build — `lib/plan-move.ts` already schedules it at renewal with no credit. Stage 2 **refuses** the old immediate paid branch of `downgrade/confirm` (send the caller to the move) so the server can no longer do what no screen offers.
- **While a cancel is pending (found by the `/billing` review, verified in code):** (a) an **up-move, a down-move or a downgrade-to-free is refused** with a plain sentence ("Your plan ends on {date}. Keep your plan first, then change it") — the same rule the owner already ruled for a Premium coach (`plan-move.ts` ~162, Stage 4b Part 3), generalised; otherwise an up-move charges a proration and the plan still ends, and a down-move builds a schedule on a subscription set to cancel; (b) a **schedule already on the subscription** (a waiting down-move) must be **released first** (`cancelScheduledMove`) because Stripe will not let a schedule-managed subscription be changed directly — verify in test mode; ~~Keep my plan does not restore the old schedule~~ **superseded by §3a G1: the released move is remembered and Keep my plan puts it back**; (c) **End now promotes the pending row in place** instead of inserting a second one; (d) a mock subscription (`mock_…`) is not a real one — use `hasLiveSubscription`, never `stripeSubscriptionId == null`; never key the end date off `current_period_end` (operator trials and comps carry one with no subscription).
- **Operator doors:** Cancel (default) = same scheduled path. **End now** = today's immediate path unchanged (kept as is, behind its own red window).
- **No REAL Stripe subscription** (comped / Founding Season / mock `mock_…` ids, which are non-null): nothing to wait for — cancel ends immediately as today. Test with `hasLiveSubscription` (`lib/plan-move.ts`), not a null check; a Coaches Portal's subscription id may sit only on `team_workspaces`. A *trialing* subscription ends at trial end.
- **Retention clock** starts at the effective date, not the click (the "kept for N days" line and the email use the effective date).
- **While pending the account is fully live** — site, payments, tournament creation, every tool. A pending downgrade keeps the higher plan's limits until the date.
- **Safety net:** a tested pure "overdue" function (a scheduled change past its effective date and still active — a missed webhook must not leave a paid plan running free) and a platform-admin read of it. ~~Wiring it into the daily `npm run health`…~~ **Superseded by §3a G3:** it runs as a step of the existing product daily job, with a platform-admin *Finish this ending now* door.
- **Churn and events (review S6):** the `subscription_canceled` platform event feeds churn counts (`lib/platform-metrics.ts`) and the story (`lib/platform-story.ts` labels any `source='stripe'` one "Subscription ended in Stripe"). Today an owner cancel writes it at the click and a Coaches Portal cancel can count twice; the operator route writes none. One writer (the shared teardown) at the **end date**, keyed `intent:{id}:subscription_canceled`, with who asked in its metadata; the click-time write goes. Churn then dates up to 11 months after an annual click — intended.
- **The end-date teardown is not the same code three times (review S3):** the webhook's org path archives before it writes restore records, ignores insert errors, sends **no email**, and hard-codes the reason "Stripe subscription deleted"; the routes write records first and use reasons (`account_cancellation`, `coaches_portal_cancellation`) that reactivation depends on. The one shared teardown: records first and error-checked, reason taken from the intent, **tournaments re-read at the end date** (not the click-time list), pending→applied flipped **last**, account-record insert idempotent (account rows are exempt from the unique index). `applyCoachesPortalStripeRetention` needs a `pendingIntentId` (promote, not insert) or it leaves a dangling `pending` row and loses the owner's reason.
- **Stale applied intent (review S4):** the deleted arm's dedup takes the latest `applied` cancellation/downgrade for the org with no bound; a stale applied downgrade makes a later Stripe-ended paid org skip suspension and **keep its paid plan free forever**. Minimal fix when touching the arm: look up the org's `pending` cancellation first; otherwise accept an applied row only if `applied_at >= subscription created` and, for a downgrade, only if `target_plan='tournament'`.
- **Duplicate pending rows (review S2):** Stripe-first lets the `updated` event create a "portal" row before the route's insert lands; a double click does the same. A partial unique index `(org_id) WHERE intent_type='cancellation' AND status='pending'` is **recommended** (one small migration — written, not applied); the route finds-then-updates regardless. If Stripe succeeds and the DB write fails the `updated` arm repairs it; the route says "scheduled — we'll finish recording it", not a plain failure.
- **Next-season placeholders** never get a band: the new `updated` handling runs *after* the existing `choiceKind` branch and is skipped for it (test-pinned).

## 3a. Gap review additions (owner accepted every one, 2026-10-31)

Read against the code 2026-10-31; each cites what the code does today. These are requirements for the stage named.

- **G1 · Keep my plan restores a waiting cheaper-plan move (money; Stage 1).** Today a paid→paid down-move lives **only** in Stripe
  (the schedule's `planKey` metadata, `lib/plan-move.ts` ~420-422, read back by `getScheduledMove` ~470); our DB holds only an
  `org_audit_log` row. Releasing the schedule to cancel (§3 (b)) loses it, and an undo would renew at the **higher** price. So: when
  the cancel route releases a down-move schedule, it records the move's target on the pending row (a nullable column in the same
  small migration — do not overload `target_plan`, which means "the downgrade's destination"); Keep my plan sets
  `cancel_at_period_end:false` **and then re-schedules that move** through the existing down-move path (`applyMove`), never a
  hand-built schedule. If re-scheduling fails after the keep succeeded, the owner is told plainly that the plan is kept and the move
  to {plan} needs choosing again, with that door on the page — never a silent renewal at the higher price. The Keep window says
  "Your plan renews on {date} as {cheaper plan}". Tests: cancel-with-waiting-move → keep → schedule re-created with the same target
  and no proration; keep when the move can no longer be built (plan retired) → plain sentence, plan kept.
- **G2 · A waiting free downgrade's keep-set (Stage 2).** `keep_tournament_ids` is written and never read back; a pending downgrade
  leaves the paid `plan_id`/`tournament_limit` in place (paid plans store 9999 — `hasFiniteSlots` false), so tournaments can be
  created during the wait and are not in the pick. Rule: on the date, archive (with restore records, recoverable for the usual days)
  every slot holder **not** in the pick; the "Moves to the free plan on {date}" band names the kept tournament and says anything else
  is archived then; a **Change which tournament you keep** door re-runs the existing preflight choice and updates the pending row.
  Open edge (Stage 2 proposes, owner rules): the kept tournament is deleted or archived during the wait — recommend the band turns to
  "Choose the tournament you keep" and, if the date passes with no choice, the newest Draft/Active one is kept (stated in the band).
- **G3 · The safety net acts, not just reports (Stage 1).** The overdue function runs as a **new step of the existing product daily
  job** (`app/api/platform-admin/stripe-fees-daily/route.ts` — pg_cron daily via `x-cron-secret`, or by hand with `run_jobs`; every
  step once-only-stamped and safe to re-run). It is product code, **not** a watched path, so the `npm run health` question is
  dropped. Overdue = a pending change past `effective_at` + 3 days (Stripe retries a failed webhook for up to three days). The step
  lists overdue rows on the platform-admin org record and the retention page, and each has a platform-admin **Finish this ending
  now** door that first retrieves the live subscription: if Stripe says it has ended, run the same end-date teardown the webhook
  would have; if Stripe says it is still live, change nothing and say so (the record is wrong, not the account). Never auto-acts.
- **G4 · One date, everywhere (Stage 1).** The page renders through `formatStoredDate` (fixed `America/Toronto`, `lib/timezone.ts`);
  `retentionDateLabel` (`lib/billing-retention.ts` ~433) and the trial email (`webhook` ~911) use `toLocaleDateString` with no zone
  (server = UTC), so an evening-Eastern period end reads one day later in an email. The band, both windows, the operator record and
  every email in this project use **one** formatter (`formatStoredDate`); move `retentionDateLabel` onto it. Test: a period end of
  `…T02:00Z` renders the same day on the page and in each email.
- **G5 · No "trial ending — add a card" email to an account that cancelled (Stage 1).** `customer.subscription.trial_will_end`
  (`webhook` ~897-924) does not look at `cancel_at_period_end`/`cancel_at`; skip the email while a cancel is pending.
- **G6 · Emails (Stage 1 builds, Stage 4 polishes).** (a) The "Your plan ends on {date}" email goes once per pending row
  **whatever the door** — owner, operator (honouring the `notify_owner` flag), or Stripe's portal (created by the `updated` arm);
  keyed to the row so an `updated` storm sends one. (b) **Keep my plan** sends a short "Your plan will renew on {date}" (as {cheaper
  plan} under G1). (c) **A reminder seven days before the end**, as a step of the same daily job, once-stamped per row, skipped if the
  row was withdrawn or the end is already under seven days away at the click. Register each key where template keys live (platform-admin
  email list, `/dev/email-preview`).
- **G7 · Safe to replay part-way (Stage 1).** The webhook keeps no processed-event record (signature check → switch; idempotency is
  only `sourceEventId` on platform events), so a crash mid-teardown means Stripe resends the whole event. Every step of the end-date
  teardown must be safe to run twice (archive only what is not archived; restore records insert-if-absent, the account row included;
  pay pages close idempotently; email + platform event keyed to the intent). Test: stop the teardown after each step in turn, replay,
  assert one of everything.
- **G8 · Two ways Stripe says "cancel scheduled" (Stage 1).** A cancel can be set as `cancel_at_period_end:true` **or** as a dated
  `cancel_at` (Stripe Dashboard "on a custom date"; the flexible billing mode). Pending = either is set; withdraw **only when both are
  clear** on the retrieved live subscription; the date = `cancel_at` when set, else the item's `current_period_end`. Tests for each.
- **G9 · Stages 1 and 2 reach customers together** (§1.9). Nothing in Stage 1 may leave the product in a state where a downgrade is
  worse than a cancel if it shipped alone; the walk for Stage 1 can run before Stage 2 is built.
- **G10 · A Stripe test-clock rehearsal before any customer sees it (new Stage 3).** Stubs cannot prove what Stripe does: which events
  arrive at renewal and in what order, the schedule-blocks-cancel rule, `cancel_at` vs the flag, dunning during a pending cancel. A
  script under `.probe/` that **refuses to run with a live key** (`sk_live_`/`rk_live_`) creates test customers on **test clocks**,
  drives each case, advances the clock past renewal, and reads our DB after the webhooks land (Stripe CLI forwarding to the dev server).
  Cases: monthly and annual cancel; cancel while trialing; card fails while pending; cancel in Stripe's portal then Renew there;
  cancel while a cheaper move waits, then Keep my plan (G1); free downgrade with a tournament created during the wait (G2); End now;
  a replayed `deleted` (G7). Each case's expected DB state is written before the run; the run is the evidence for the owner walk.
  Test mode only; no live object is created or read.
- **G11 · Fold the downgrade route's unsafe order into the shared teardown (Stage 2).** `downgrade/confirm` archives (~102-109)
  before writing restore records (~111-131) — the reverse of the safe order (`lib/billing-retention.ts` ~263). The Stage 2 end-date
  downgrade uses the shared teardown's order; nothing re-implements it.
- **G12 · Drawings before Stage 1 is built.** Nothing in this project has been drawn. A drawings Artifact (house layout; whole-screen
  before/after at true size, drawn from shipped components, through `/design`) covers: the owner billing page "Ends on" band + Keep
  my plan (org, Coaches Portal, Premium); the owner Cancel window (with Stripe / no Stripe / with a waiting cheaper move); the Keep
  my plan window; the operator record band, Cancel window and End now window; the "Moves to the free plan" band + Change which
  tournament you keep; the overdue row + Finish this ending now; the three emails. The builds follow the approved drawing.

- **G13 · Prove the Stripe portal's settings, test and live (owner, 2026-10-31).** A cancel made in Stripe's own portal must end at
  the period end too, and the portal must not offer plan switching (owner confirmed it does not today). Both live in the Stripe
  Dashboard, not in code, so they can change without a commit. (a) **Stage 3, test mode:** the rehearsal script reads the portal
  configurations (`billingPortal.configurations.list`) and asserts, for the default (and any active) configuration,
  `features.subscription_cancel.enabled` → `mode === 'at_period_end'`, and `features.subscription_update.enabled === false`; a
  failing assertion stops the rehearsal. (b) **Live mode, before customers get Stages 1+2:** the same two facts read from the live
  account — a **read-only** list call with a restricted read key, or the owner reading the Dashboard — recorded with the date in this
  plan's §4 and the release record. The Stage 3 script itself still refuses a live key; the live read is a separate, read-only step.
  (c) If either is ever found wrong: an immediate portal cancel still ends cleanly through the existing Stripe-initiated path, but it
  breaks the ruling — fix the Dashboard setting, do not build around it.

## 4. Stages (one session each)

0. **Drawings (G12)** — owner approves before Stage 1 starts. **Drawn 2026-10-31 + `/design` pass the same day:** `PLAN_ENDS_AT_RENEWAL_STAGE0_DRAWINGS.html`, published https://claude.ai/artifact/VbFZCx128jT3sr1zaLyHP4 (9 tabs). **Owner answered all nine asks 2026-10-31, all as recommended (A) — Stage 0 approved; Stage 1 may start.** The rulings: (1) a waiting cancel uses the plan card's shipped amber waiting-change line, "Ends on {date}… Keep {Plan}", with an amber "Ending" chip, and no page-wide notice; (2) the door is spelled **"Keep {Plan}"**, never "Keep my plan" (one-spelling rule; where this plan says "Keep my plan" it means this door); (3) Reduce or cancel is hidden while a cancel waits; (4) Keep opens a question window naming the renewal date and the charge (and "renews as {cheaper plan}" under G1); (5) End now is a quiet red link inside the operator Cancel window and on the record's waiting callout, opening its own red window; (6) its reason is a required typed Why; (7) an overdue ending's data clock starts on the day it should have ended; (8) G2 edge: the band asks again and, if the date passes with no choice, the newest Draft or Active tournament is kept, as the band says; (9) on a phone Keep is a full-width 44px lime button; the desktop keeps the olive link. The `/design` pass changes on the Asks tab stand with the drawing (change doors absent while a cancel waits; a wait is the white callout with an amber edge). Logged in `memory/design_decisions.md` 2026-10-31.
1. **Cancel at renewal (both doors) + the stored fact.** *(On hold until Plans & pricing Stage 0 fixes S5 and S8 land — see the Stage list of record.)* Migration + dictionary; scheduled intent; owner cancel route (org + Coaches Portal); operator Cancel + **End now**; webhook updated/deleted arms; Keep my plan (route + billing-page band + operator record band) **restoring a waiting move (G1)**; overdue step + Finish this ending now (G3); one date formatter (G4); trial-email skip (G5); the click, keep and seven-day emails (G6); replay-safe teardown (G7); both cancel signals (G8); tests (webhook promote, withdraw, portal-originated, next-season skip, no-Stripe immediate, retention clock date, plus each G-item's tests).
2. **Downgrade to free at renewal + close the old paid branch.** (Paid→paid already waits for renewal — see §1.3.) The scheduled free downgrade (stored keep-set, applied by the webhook at the end date as a **downgrade**, not a cancellation, through the shared teardown's order — G11); the "Moves to the free plan on {date}" band + **Change which tournament you keep (G2)**; Keep my plan; `downgrade/confirm` refuses the paid branch; tests (kept tournaments survive to the date, limits unchanged while pending, a tournament created during the wait is archived with restore records on the date).
3. **Stripe test-clock rehearsal (G10) + the portal settings check (G13).** Test mode only; the script refuses a live key, and first asserts the portal cancels at period end and offers no plan switching. Its results feed the owner walk. The live-mode read of the same two settings (G13 (b)) is recorded before customers get Stages 1+2.
4. **Words and doors.** Both cancel windows, the downgrade windows, billing-page copy (`PLAN_AND_BILLING_COPY.md`), the emails (ends-on, ended, downgrade scheduled, kept, seven-day reminder), help articles + `keywords`/`searchText` (`/docs`), platform-admin help, the Support Console walk row D3 (answer: "It should end at the end of the paid period instead"), demo seed check (`/demos` — a number in a demo sentence is computed from the seed). Run `check:spelling`.

Each stage ends with `/simplify`-then-`/review` offers and an owner walk (checkable Artifact). `/billing` gate review RUN 2026-10-31 (its verified findings are folded into §1.3, §3 and the Stage 1 prompt); `/strategy` logged the ruling 2026-10-31 (`BUSINESS_DECISIONS.md`, Facts doc bullet). Gap review 2026-10-31 → §3a (owner accepted all).

## 5. Open items (do not decide silently)

- ✅ **The portal does not let a customer switch plans** (owner confirmed 2026-10-31). No portal configuration is created in code (the
  session passes only customer + return URL), so this is a Dashboard setting; G13 re-checks it so it cannot drift silently.
- **The portal's cancellation setting (period end vs immediate) is not yet confirmed** — it is now a plan step, G13, not an owner
  memory item.
- Intent-row vs billing-facts column for the stored fact (Stage 1 decides, records here).
- ✅ End now needs a reason: a required typed Why, its own red window, reached from a link in the operator Cancel window and the
  record's waiting callout (Stage 0 Asks 5–6, owner 2026-10-31). Its exact sentence is Stage 4 words.
- Annual plans can leave up to ~11 months between click and end — accepted as "what they paid for"; no early-termination door is planned. (The seven-day reminder, G6 (c), covers the forgetting.)
- ✅ G2's open edge (the kept tournament disappears during the wait) — ruled at Stage 0 Ask 8, owner 2026-10-31: the band asks
  again; with no choice by the date, the newest Draft or Active tournament is kept, as the band says beforehand.
