# Plans end at the renewal date · Stage 1: cancel at renewal, both doors (build prompt)

> ⛔ **HOLD — do not start this build yet (owner sequence rulings, 2026-10-31; plan header, index
> https://claude.ai/artifact/Kua6RAqMA7ChA7QBTNE63a).** (a) The one rule for a subscription's future (Plans & pricing G5:
> a customer or staff action that meets a scheduled price move carries it forward or refuses in plain words, never drops it)
> must first be written into this prompt. (b) Plans & pricing Stage 0 S5 (webhook event log, ordering, live/test) lands
> first or is built in the same session — do not build a separate replay workaround. (c) The portal configuration is created
> and pinned in our code by Plans & pricing Stage 0 S8; anything below that says the portal is a Dashboard-only setting is
> superseded. Remove this block when (a) is written and (b) is scheduled.

> **Written 2026-10-31.** Paste into a new Codex chat on `dev`. **Re-verify every lead before building on it.** The leads
> were read in the code on 2026-10-31; a plan or an audit has been wrong in this repo before. This is **Stage 1** in
> `PLAN_ENDS_AT_RENEWAL_PLAN.md` (§4: 0 drawings → 1 cancel → 2 downgrades → 3 Stripe test-clock rehearsal → 4 words).
> **Stop at this stage's boundary even if you have room left**: downgrades are Stage 2, the test-mode rehearsal Stage 3, the
> full wording/help pass Stage 4. **The Stage 0 drawings are APPROVED (owner, 2026-10-31, all nine asks as recommended)** —
> https://claude.ai/artifact/VbFZCx128jT3sr1zaLyHP4, source `PLAN_ENDS_AT_RENEWAL_STAGE0_DRAWINGS.html`. Build the screens to them.
> **"Stage 0 rulings" below win over anything earlier in this prompt that disagrees** — above all, the door is spelled
> **"Keep {Plan}"**: wherever this prompt says "Keep my plan", read it as that door and never ship the words "Keep my plan".
> **The gap review (2026-10-31, owner accepted all) added requirements — see "Added by the gap review" below and plan §3a; where
> they disagree with anything earlier in this prompt, they win.**
>
> Read first, in this order: `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`; then `docs/projects/active/PLAN_AND_BILLING_CODEX_RULES.md`
> (design, words, windows, process, hand-off format — **with the three overrides below**); then
> **`PLAN_ENDS_AT_RENEWAL_PLAN.md` in full** and `PLAN_ENDS_AT_RENEWAL_PM_BRIEF.md`.
>
> **Other sessions share this working copy.** Stage explicit paths only, **ask the owner before each commit** (an earlier yes does
> not carry over), never push, run `git show --stat HEAD` after every commit. Branch `dev`. The tree already has many uncommitted
> files from other sessions: do not fold them in.
>
> **Recommended model: Opus 5.5** (money paths, a webhook, three routes). Use helpers for broad reading; open every line a
> decision turns on yourself.
>
> **Do not run a browser, a UAT, or any Stripe call against a real account.** Tests are unit tests with stubs.

## Stage 0 rulings (owner, 2026-10-31 — build to these)

1. **Billing page:** a pending cancel shows on the plan card, on the shipped amber waiting-change line (the one that today says
   "Moves to {X} on {date}." with its olive Keep link), worded "Ends on {date}…" + **Keep {Plan}**; the status chip turns amber
   **"Ending"**. No page-wide notice and no new band.
2. **The door is "Keep {Plan}"** — Keep Tournament Plus, Keep Premium, Keep Club · Association — the spelling the product already
   ships for undoing a waiting move. This also settles the `BillingBody.tsx` ~561 "Keep Premium" collision noted in step 8: both mean
   "keep the plan", so one spelling serves both.
3. **Reduce or cancel is hidden** while a cancel waits. The change-plan doors are **absent** (not disabled), with one amber line:
   "Your plan ends on {date}. Keep {Plan} first, then change it." Prices stay readable. (This is how the drawing answers Decision 5
   below; still confirm Decision 5 in your first message.)
4. **Keep opens a question window** (416px) naming the renewal date and the charge, and "renews as {cheaper plan}" when a released
   move comes back (G1).
5. **End now** is a quiet red link inside the operator Cancel window and on the record's waiting callout; it opens its **own red
   window** with a **required typed Why** (like every console record window). This settles Decision 3; the exact sentence is Stage 4.
6. **An overdue ending's data clock starts on the day it should have ended**, not the day an operator finishes it.
7. **Phone:** Keep is a full-width 44px lime **Keep {Plan}** button under the line; the desktop keeps the olive link.
8. A wait message is the **white callout with an amber left edge** — `PageNotice` has no amber tone; do not add one.

(Ask 8, the G2 edge, is Stage 2: the band asks again; with no choice by the date, the newest Draft or Active tournament is kept.)

## Overrides of the Codex rules file (this project is different from Plan & billing)

1. Its "no migration is expected" and "do not rewrite the server logic of the plan-change mechanisms" lines **do not apply here**:
   this project changes the cancel server logic by owner ruling. Its *presentation* rules (words, windows, absent-beats-disabled,
   phone floors, owner-only cancel) all still bind.
2. **Cancel stays owner-only (ruling 2026-10-29)** — never widen the owner routes, never show a delegate the door. Keep my plan is
   owner-only **on the owner route**; the platform admin has its own Keep my plan door on the org record.
3. **One small migration is now RECOMMENDED (the `/billing` review, S2): a partial unique index `(org_id) WHERE intent_type='cancellation'
   AND status='pending'`, plus — only if you adopt it, see "Decisions" 6 — a `notify_owner` flag, **plus the nullable column that
   remembers a released cheaper-plan move (gap review G1), plus once-only stamps for the click / seven-day emails (G6) if no
   existing column can hold them**. Write the file and do not apply it anywhere; ask the owner how it reaches dev.** The status values themselves need no migration (Lead 1).

## The ruling (owner, 2026-10-31 — do not reopen, record nothing it did not rule)

A customer pays ahead and there is no refund, so **nothing they paid for is taken away early.** Cancel — by the owner or by us — ends
the plan **on the renewal date**, not now: full access until then, then it ends by itself. **Keep my plan** undoes a pending cancel, on
both doors. A platform-admin-only **End now** stays immediate (abuse, fraud, chargeback) — secondary, never the default, never offered
to owners. Accounts with no Stripe subscription have no date to wait for and still end immediately. Retention ("kept for N days")
starts on the end date, not the click.

## What this stage makes true

- **Owner cancel (club/league/tournament orgs AND a Coaches Portal):** the Cancel window now says the plan stays fully active until
  `{renewal date}` and then ends, no refund for unused time, tournaments kept N days after that. Confirming schedules the end; **nothing
  is archived, suspended, hidden or closed at the click.** A first email says when it ends.
- **The billing page** shows an **"Ends on {date}"** state with **Keep {Plan}**, in place of the "Renews on" line, while a cancel is
  pending (Stage 0 rulings 1–4). Keep restores everything with no charge and no lost data.
- **Operator Cancel** (platform admin → org record) works the same way, with a Keep my plan door on the record, **plus a separate
  secondary End now** that keeps today's immediate behaviour (red, reason required).
- **On the end date** Stripe fires the subscription-deleted event and the existing retention, suspension, pay-page closing and
  "cancelled" email run **then**, exactly as today's confirm routes do.
- **A cancel made in Stripe's own portal** (period-end) lights the same "Ends on" state, because the webhook records it from Stripe.
- **Next-season placeholder subscriptions never show a band** (they are not a paid plan).
- An overdue-detection (a pending cancel past its date that is still active) exists as a tested pure function; see "Health check".

## What you may not do

Touch **downgrades** (`downgrade/confirm`, plan moves, `plan-move.ts`) — Stage 2 — **except the one thing Stage 1 needs: a pending cancel
makes them refuse** (see "Verified by the `/billing` gate review"); the paid branch of `downgrade/confirm` is closed in Stage 2, not here. Change `choose-next-season`'s own cancel (a
placeholder replaced by a new choice: no paid period exists; it stays immediate). Change prices, plan names, gates or
`lib/plan-config.ts`. Add a refund, a credit, or any Stripe proration. Widen who may cancel. Edit hooks, `.claude/settings*.json`,
`scripts/check-agent-automation.mjs`, any database check or gate, or any script a hook runs (owner's 2026-09-26 ruling) — see
"Health check" for the one nearby thing that needs the owner's word first. Invent a new component or a new look. Do not "tidy" anything
the plan does not name.

## Leads (verify each; they are leads, not facts)

1. **No migration is likely.** `billing_retention_intents` (migration 038) has `status` CHECK `pending|applied|canceled|restored|purged`
   and an `effective_at timestamptz NOT NULL DEFAULT now()` that is vestigial. The plan uses **`pending` = scheduled**, **`canceled` =
   withdrawn**, `effective_at` = the end date. **Prove it against the dev and prod snapshots in `docs/agents/db` (not migration
   files)**, then grep every reader of `billing_retention_intents.status` and `effective_at` (the retention sweep, the cancellation
   preflight's "cancelled" record, platform-admin records, the webhook dedup, tests) and confirm a `pending` row is invisible to each
   or handled. `retention_until` is NOT NULL: for a pending row set it to the end date plus the retention window and **recompute it at
   apply time**. The webhook dedup filters `status='applied'`, so a `pending` row will not suppress retention. Reviving "dead" enum
   values and `effective_at` means `docs/agents/db/DATA_DICTIONARY.md` changes in the same unit of work (it calls `pending`, `canceled`
   and `purged` dead — `restored` is already live — and `effective_at` vestigial) — `npm run check:dictionary` is part of `verify:changed`.
   ⚠ **The snapshots hold only PK/FK/UNIQUE — no CHECK constraints — so the status CHECK cannot be proven from them.** Ask the owner
   to have `/dba` run a read-only `pg_get_constraintdef` for `billing_retention_intents` on dev and prod before you rely on `pending`
   and `canceled`.
2. **Three cancel routes duplicate the immediate teardown:** `app/api/billing/cancel/confirm/route.ts` (owner; an org branch and a
   Coaches Portal branch), `app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts` (operator), and the webhook's
   `customer.subscription.deleted` arm (`app/api/billing/webhook/route.ts`, a team-workspace branch using
   `applyCoachesPortalStripeRetention` in `lib/billing-retention.ts`, and an org branch). Today each writes an `applied` intent at click,
   archives tournaments + writes `billing_retained_records`, sets `subscription_status='canceled'` + `billing_suspended_at` +
   `is_public=false`, runs `closePagesIfPaymentsEnded(..., {ended:true})`, writes an audit + platform event, calls
   `stripe.subscriptions.cancel`, then sends the cancellation email. **Recommended shape: extract ONE shared "apply this cancellation"
   function** that the end-date webhook, **End now**, and the no-Stripe immediate path all call, so the teardown exists once. Keep every
   existing assertion in `tests/unit/coaches-portal-cancellation-guard.test.ts`, `online-payments-leaving.test.ts`,
   `org-billing-access-guard.test.ts`, `plan-billing-actions.test.ts`, `plan-billing-delegate-and-links.test.ts`,
   `support-console-stage4b-guard.test.ts` and `support-console-stage4b-review-fixes.test.ts` true (repoint, never weaken, and never
   delete without a replacement assertion). If extracting is riskier than you can prove, say so before building and propose the smaller
   cut.
3. **The webhook's deleted arm picks the LATEST `applied` intent for the org with no time bound**, so a stale `applied` downgrade from
   an earlier year can suppress retention on an unrelated later Stripe-initiated ending. That is an existing defect, not yours — **report
   it in your hand-off, do not fix it silently**. For your path: when the deleted event arrives, look for the org's **`pending`
   cancellation** intent first, promote it (`applied`, `applied_at=now`, recomputed `retention_until`) and run the shared teardown from
   it. A team workspace has its own branch above the org branch (`syncTeamWorkspaceSubscription` → `applyCoachesPortalStripeRetention`);
   read it and make the scheduled path land in the right one.
4. **`customer.subscription.updated`** is the arm that must record and clear "ends on": it already runs for every subscription change.
   Read Stripe's `cancel_at_period_end` and the item's `current_period_end` there. **It must run AFTER the existing next-season
   `choiceKind` branch** (which `break`s for a pending choice) and never write for a placeholder. Set the pending intent when a cancel is
   scheduled in Stripe with none on file (portal door; reason = "Cancelled in the billing portal", `created_by_email='stripe-webhook'`
   per today's convention); withdraw it (`canceled`) when Stripe reports `cancel_at_period_end` false. Be careful this arm is **not**
   idempotent by itself and Stripe fires `updated` many times — read the "chosen_at IS WRITTEN ONCE" comment in `lib/billing-setup.ts`
   (~line 341) for the same trap, and key any write to the sub id + effective date.
5. **`organizations.current_period_end` already exists** and drives the "Renews on" line (`components/billing/BillingBody.tsx` ~line
   231, `W.plan.renews(...)`). The new "Ends on" state reads the pending intent (`lib/plan-billing-data.ts`'s `BillingCancellation`
   is the shape the owner page already reads; extend it, do not add a parallel fetch). Words live in `lib/plan-billing-words.ts`
   (`W.cancel.*`, `W.reactivate.*`) and the copy sheet `docs/projects/active/PLAN_AND_BILLING_COPY.md` — one spelling, `formatStoredDate`
   for dates, never invent a plan name or price.
6. **The operator window** is `CancelWindow` in `app/platform-admin/orgs/[id]/ClubRecord.tsx` (~line 1021): today "Stripe stops charging
   {org}. **This cannot be put back**…". The org record page is `app/platform-admin/orgs/[id]/page.tsx`. The old "never offered as Put it
   back" line was about an IMMEDIATE cancel; during a pending cancel Keep my plan is offered; after the end date it is not. Help text
   mirroring it is in `lib/help-content/platform-admin.tsx` (~line 1766) and `app/platform-admin/help/page.tsx` — Stage 4 owns the
   articles, but **no line may be left telling a customer or operator something false after this stage**: change the words that your
   behaviour makes untrue and list the rest for Stage 4.
7. **Stripe calls:** to schedule, `stripe.subscriptions.update(id, { cancel_at_period_end: true })`; to undo, `false`. The fee ride and money
   console already read `cancel_at_period_end` (`lib/platform-stripe-fees.ts:189`, `lib/console-money-stripe.ts:53`) — a pending cancel
   already counts there as "cancelled → its own invoice"; confirm that is still right and say if it is not. The shared `stripe` client is
   `lib/stripe.ts`. **Order of writes for a click: Stripe first, then the DB** — if Stripe refuses, nothing is scheduled and the owner is
   told plainly (today's "DB first, Stripe second" ordering exists because the DB change *was* the cancel; here the DB row is only a
   record of what Stripe now holds). An undo is the mirror.
8. **No REAL Stripe subscription** (comped, Founding Season, operator trial/comp, **mock — `mock_…` ids are NON-null**, so a null test would send them to `subscriptions.update` and throw): use `hasLiveSubscription` (`lib/plan-move.ts` ~112) or `startsWith('sub_')` (`lib/team-ownership-transfer.ts` ~534), and for a Coaches Portal fall back to the id on `team_workspaces` (`cancel/confirm/route.ts` ~195). **Never key the end date off `organizations.current_period_end`** — operator trials and comps carry one with no subscription (`lib/operator-plan-change.ts` ~206). `ClubRecord.tsx` ~731 computes `hasStripe` as `!!id`, so a mock reads as real there: fix it. There is no renewal date for these. Cancel stays
   immediate through the shared teardown; the window's sentence must say so honestly (it must not promise a date that does not exist). A
   `trialing` subscription ends at the trial's end — `current_period_end` should hold it; verify. **Also check what a Founding Season
   comp with a real next-season placeholder does** (lead 4: the placeholder is not "a plan ending").
9. **Emails:** `lib/email.ts` (`cancellationConfirmationHtml`, `teamWorkspaceCancelledHtml`) and `lib/platform-email-templates.ts`
   (`sendTransactionalEmail`, keys such as `cancellation_confirmation`, `team_workspace_cancelled`). The two existing emails say "your
   plan has been cancelled / is now inactive" — **true at the end date, false at the click.** Keep them for the end date; add **one new
   template key for the click** ("Your plan ends on {date}"; org and Coaches Portal variants if the existing ones differ), registered
   wherever template keys must be (the platform-admin email list, `/dev/email-preview`). Stage 4 polishes the wording; yours must be
   correct, plain and in the house voice (see how the existing two read).
10. **A retained-records read**: `buildCancellationPreflight` in `lib/billing-retention.ts` (~line 308) and `retentionDeadline`
    (~line 122) feed the window's "N tournaments kept for D days" line. The line now describes what happens on the end date; check the
    days and the date still compute from the right instant.

## Verified by the `/billing` gate review (2026-10-31) — these change what you build

The plan and this prompt were reviewed against the code before Stage 1; the cited lines for B2 and B4 were re-opened by the author.
Treat each as a requirement, and still re-verify.

- **While a cancel is pending, other plan changes are refused.** An up-move (`lib/plan-move.ts` ~367) would charge a proration and the
  plan would still end; a down-move (~415) would build a schedule on a subscription set to cancel; `downgrade/confirm` (immediate in
  Stage 1) would write plan=tournament and cancel — and the deleted arm would then find the pending CANCEL and suspend a now-free org.
  Generalise the refusal that already exists for a Premium coach (`plan-move.ts` ~162, owner ruling Stage 4b Part 3) to every plan and
  to `downgrade/confirm`: "Your plan ends on {date}. Keep your plan first, then change it." (Words by the existing conventions.)
- **A Stripe schedule blocks `cancel_at_period_end`.** `plan-move.ts` ~412-441 puts a down-move on a subscription schedule. The cancel
  route must **release it first** (`cancelScheduledMove`, ~481) — verify the Stripe behaviour in test-mode terms in a stubbed test — and
  ~~Keep my plan never restores it~~ **superseded by the gap review G1: remember the released move's target on the pending row and Keep
  my plan re-schedules it.**
- **End now promotes the pending row in place** (status → applied, `applied_at`, `effective_at=now`), never inserts a second intent —
  otherwise the deleted arm sees an applied AND a pending row and tears down twice. Same promotion when Stripe ends the subscription
  early (dunning).
- **`applyCoachesPortalStripeRetention` (`lib/billing-retention.ts` ~608) always INSERTS its own applied intent** (reason "Stripe
  subscription deleted", `created_by_email='stripe-webhook'`) and dedups only on retained records — it will leave a dangling `pending`
  row and lose the owner's reason. Give it a `pendingIntentId` (promote, do not insert). That webhook branch also writes
  `subscription_canceled` with no `orgId` and no dedup tie to the click-time event, so an owner Coaches Portal cancel counts twice today.
- **The three teardowns are NOT identical** (webhook org path: archives before records, ignores insert errors, **sends no email**,
  hard-codes the reason "Stripe subscription deleted"; routes: records first, supersede old rows, reasons `account_cancellation` /
  `coaches_portal_cancellation` that `billing-reactivation.ts` ~25 depends on; the operator route's email is sent only if `notifyOwner`
  was ticked and the intent has nowhere to remember that). The shared teardown: **records first and error-checked, reason from the
  intent, tournaments re-read at the end date, pending→applied flipped LAST** so a replay after a crash still runs the teardown,
  account-record insert idempotent (account rows are exempt from the active-retention unique index). The existing guard tests are
  **source scanners** (regexes on route text — e.g. `online-payments-leaving.test.ts`, `support-console-stage4b-guard.test.ts`), so
  extraction means rewriting what they scan, not just moving code: budget for it, and keep every assertion's intent.
- **The `customer.subscription.updated` helper goes right after the `choiceKind` block (~line 305)**, because the Coaches Portal branch
  `break`s at ~391 and `org_team_addon` at ~324, and everything else sits inside `if (matchedPlan)`. It must cover team AND org,
  honour the second-subscription guard (~407-411), skip a next-season placeholder **only while it is pending or withdrawn** (a
  converted one falls through legitimately), **retrieve the live subscription before writing or withdrawing** (events arrive out of
  order — a late "true" after Keep my plan's "false"), and read the date from `cancel_at`, falling back to the trial end while
  trialing (`lib/console-money-stripe.ts` ~51 already does). The repo pins Stripe API `2026-04-22.dahlia`, which keeps
  `current_period_end` on the item — the existing reads are right.
- **Duplicate pending rows**: Stripe-first lets the `updated` event create a "portal" row before the route's insert lands, and a
  double click does the same. Find-then-update in the route; the partial unique index (override 3) is the real guard. If Stripe
  succeeds and the DB write fails, the route answers "scheduled — we'll finish recording it", never a plain failure (the `updated`
  arm repairs it).
- **The stale-applied-intent defect now bites your path** (webhook ~653-661, unbounded "latest applied"; a stale applied downgrade makes
  a later Stripe-ended paid org skip suspension and keep its paid plan free forever). When you touch the arm: look up the org's
  `pending` cancellation first; otherwise accept an applied row only if `applied_at >= the subscription's creation` and, for type
  downgrade, only if `target_plan='tournament'`. Report it in the hand-off as well.
- **Churn / events**: one writer for `subscription_canceled` — the shared teardown at the end date, keyed `intent:{id}:subscription_canceled`,
  with who asked in metadata (the story labels every `source='stripe'` event "Subscription ended in Stripe"); remove the click-time
  write. The operator route writes no event today (only the audit log) — it will now count in churn; say so in the hand-off.
- **Other immediate cancels leave a dangling pending row**: `team-ownership-transfer.ts` ~538 and `cancelPriorTeamSubscription`
  (webhook ~77), plan flips/moves (`applyPlanChangeSideEffects`) and the reactivation restore (`restoreAfterReactivation` closes only
  applied intents). They stay immediate (outside the ruling) but must **withdraw a pending cancel** when they run.
- **Operator side**: `lib/operator-plan-change.ts` ~132 refuses plan moves while a subscription bills, so while a cancel is pending the
  operator's only exit is End now or Keep my plan — the window copy must say so.

## Added by the gap review (2026-10-31, owner accepted every recommendation)

Full text, code citations and tests in plan §3a; these are Stage 1's. Re-verify each lead as usual.

- **G1 · Keep my plan never renews at a higher price than the owner chose.** A paid→paid down-move lives only in Stripe (schedule
  metadata `planKey`). When the cancel route releases it, record the target on the pending row; Keep my plan sets
  `cancel_at_period_end:false` **then re-schedules the move through `applyMove`** (never a hand-built schedule). If that fails after
  the keep, say so plainly with the move door on the page. The Keep window says "Your plan renews on {date} as {cheaper plan}".
- **G3 · The safety net is a step of the existing product daily job** (`app/api/platform-admin/stripe-fees-daily/route.ts`, after
  `ending_warnings`): overdue = pending past `effective_at` + 3 days; shown on the org record and the retention page with a
  platform-admin **Finish this ending now** door that retrieves the live subscription first — ended → the same teardown the webhook
  runs; still live → change nothing and say the record is wrong. The step never acts by itself. That route is product code, not a
  watched path; `npm run health` is **not** touched.
- **G4 · One date formatter.** Band, windows, operator record and every email here use `formatStoredDate`; move
  `retentionDateLabel` (`lib/billing-retention.ts` ~433, zone-less `toLocaleDateString` = UTC on the server) onto it. Test a `…T02:00Z`
  end on page and email.
- **G5 · Skip the trial-ending email** (`customer.subscription.trial_will_end`, webhook ~897) while a cancel is pending.
- **G6 · Emails:** "ends on" once per pending row whatever the door (owner; operator honouring `notify_owner`; portal via the `updated`
  arm), keyed to the row; a "your plan will renew on {date}" on Keep my plan; a **seven-day reminder** as a once-stamped step of the
  same daily job (skipped when withdrawn, or when the end was already under seven days away at the click). Register every key.
- **G7 · Replay-safe part-way.** The webhook has no processed-event record, so a crash mid-teardown replays the whole event. Every
  teardown step is safe twice (archive only the un-archived, restore records insert-if-absent incl. the account row, pay pages close
  idempotently, email + platform event keyed to the intent). Test: stop after each step in turn, replay, one of everything.
- **G8 · Two cancel signals.** Pending = `cancel_at_period_end` **or** a dated `cancel_at`; withdraw only when both are clear on the
  retrieved live subscription; date = `cancel_at` when set, else the item's `current_period_end`.
- **G9 · Stages 1 and 2 reach customers together** — say in the hand-off that Stage 1 is not to be released alone.

## The work, in order

1. **Read, then report back before building** (your first message): the evidence for lead 1 from the snapshots and the status/`effective_at`
   readers; whether you will extract the shared teardown (lead 2) and what it covers; and your proposal for the **decisions below**. Wait
   for the owner's word on any he has not ruled.
2. Shared teardown + scheduled-cancel module (new `lib/` file; one home for "schedule", "withdraw", "apply when it ends", "overdue").
3. Owner cancel route(s): schedule for a paying account; immediate for a no-Stripe account; Coaches Portal branch the same. **Keep my
   plan** route (new; `billing` capability + owner-only like cancel; passes `orgSlug`; add the file to the `allowSuspendedOrg` guard list
   only if it truly must run for a cancelled org — a pending cancel is NOT suspended, so it probably need not).
4. Webhook: `updated` records/clears; `deleted` promotes the pending intent and runs the teardown; portal-originated cancels; placeholder
   skip. **Idempotency on replay** (a replayed `deleted` after the intent is applied must not tear down twice — today's dedup guard).
5. Operator door: Cancel (scheduled) and **End now** (immediate, reason required), Keep my plan on the record, the record shows "Ends on".
6. Billing page: the "Ends on {date}" state + Keep my plan, built **to the approved Stage 0 drawing** from shipped components (the
   existing hint line, status chip, `KitDialog` and `.btn`; absent beats disabled; non-owner who types the URL gets the same refusal as
   today). Phone at 390px. Where the drawing and the code disagree, stop and ask.
7. The emails: click (lead 9), keep, seven-day reminder (G6); the daily-job steps (G3, G6).
8. Words your behaviour makes untrue (lead 6), copy sheet, and the dictionary entry (lead 1). The review found these now-false lines —
   **fix the ones Stage 1 makes untrue, list the rest for Stage 4**: `lib/plan-billing-words.ts` ~110-113, 124, 178-179 ("suspends",
   "Cancel and suspend", "Suspending…", "is cancelled") and ~249 (sends Premium users to Stripe's portal to "keep" the plan — in-app Keep
   my plan now exists; `PlanMoveDialog.tsx` ~181 has the matching button); `lib/online-payment-words.ts` ~445 (heading "Online payments
   stop now" — the `move` kind already takes a date); `ClubRecord.tsx` ~1033-1034, 1042; `lib/help-content/platform-admin.tsx` ~1781,
   1789-1792, 1823; `lib/help-content/org.tsx` ~321, 375-380, 1329-1333; `lib/email.ts` ~1589, 1960 (fine at the end date, false at the
   click); and **`BillingBody.tsx` ~561: the Premium dismiss label "Keep Premium" collides with "Keep my plan"** — propose one wording
   for both. Do NOT touch the pricing page's "downgrade takes effect at next billing date" or the "cancel anytime" lines (already
   consistent); there is no terms/legal page in `app/`.
9. **Overdue safety net — settled by the gap review (G3).** A pure, unit-tested overdue function, run as a step of the existing product
   daily job, shown on the org record + retention page, with the Finish this ending now door. **Still do not add it to `npm run health`
   or any script/hook** (watched shared automation, owner's 2026-09-26 ruling).

## Decisions to PROPOSE and wait on (say each in your first message, with a recommendation)

1. **Home of the stored fact:** intent row (`pending`/`canceled`/`effective_at`) — *recommend* — vs a column pair on
   `organization_billing_facts`. Decide on what the readers (lead 1) show.
2. **Shared teardown extraction** (lead 2) vs the smaller cut. *Recommend* extraction, if the existing guard tests can stay true.
3. ~~End now needs a reason and its own red window~~ **Settled at Stage 0 (rulings 5):** yes — required typed Why, own red window.
   Propose only its sentence ("Ends immediately. No refund. This cannot be put back.").
4. **What the owner sees for a Coaches Portal that is on Premium** (the "premium" cancellation kind in `BillingBody`): drawn at Stage 0
   (tab 1, Premium coach) — the same line and **Keep Premium**. Build to the drawing.
5. **Other plan changes while a cancel is pending are refused** (up, down, downgrade-to-free), generalising the rule the owner already
   ruled for a Premium coach. *Recommend* yes; the alternative (an up-move withdraws the cancel) hides a decision to leave inside a
   purchase.
6. **The operator's "tell the owner" tick.** Today the cancel email goes to the owner only if `notifyOwner` was ticked, and the intent has
   nowhere to remember it. *Recommend* a `notify_owner` flag on the pending row (in the same small migration): the click email and the
   end-date email both honour it. The alternative — always email the owner on a scheduled operator cancel — removes the owner's choice.
7. **A pending cancel and a failed payment:** if the card fails before the end date and Stripe moves the subscription to `past_due`
   or ends it early, the existing Stripe-initiated path runs. *Recommend* leaving that as is and saying so.

## Tests (the contract)

Unit tests with stubs, in the repo's existing style (see `tests/unit/` neighbours listed in lead 2): schedule → Stripe called with
`cancel_at_period_end:true` BEFORE any DB write, DB untouched when Stripe throws; the click archives/suspends/hides **nothing**; Keep my
plan restores and marks the intent `canceled`; `deleted` promotes a `pending` intent and runs the teardown exactly once (and a replay is a
no-op); portal-originated `updated` creates the pending record, later `cancel_at_period_end:false` withdraws it; **a next-season
placeholder never creates a pending record on `updated` or `deleted`**; no-Stripe account cancels immediately; owner-only (a billing
delegate gets 403 on cancel and on Keep my plan); End now is platform-admin-only and requires a reason; retention date is computed from
the end date; the overdue function reports a pending cancel past its date + 3 days and ignores one still in the future; the window sentence
differs for with-Stripe / no-Stripe; and `check:spelling` / `check:dictionary` / the existing guards stay green. **Gap review tests:**
cancel with a waiting cheaper move → keep → the move re-scheduled with the same target and no proration, and the failure sentence
when it cannot be (G1); Finish this ending now runs the teardown only when the retrieved subscription has ended (G3); one date on page
and in each email for a `…T02:00Z` end (G4); no trial-ending email while pending (G5); one "ends on" email per pending row across an
`updated` storm, the keep email, the seven-day reminder once and never for a withdrawn row (G6); teardown stopped after each step and
replayed gives one of everything (G7); `cancel_at` alone records a pending cancel and does not get withdrawn (G8).

## Verification and hand-off

`npm run verify:changed` after each part; `npm run typecheck` once at the end (shared modules and routes change); expensive checks one
at a time; `check:layout --changed` on the few screens you touched only. New files mean the dev server needs a restart before the owner
walks it — say so. **Use the hand-off format in the Codex rules (§4)**, plus: (a) the state checklist for this stage — **pending cancel,
Keep my plan, ended, no-Stripe, trialing, past-due, Coaches Portal, Premium, portal-originated, replayed webhook, next-season
placeholder, non-owner by URL, phone at 390px, cancel with a waiting cheaper move then keep** — walked / not walked; (b) the Stripe return
paths you touched; (c) where the build departs from the approved Stage 0 drawing, and why; (d) the stale-`applied`-intent defect from
lead 3; (e) the words left for Stage 4; (f) owed: `/review` (money paths — yes), `/simplify` (a new shared module), `/docs`, `/billing`
gate review, the owner walk, any dev-server restart, the Stage 3 test-clock cases this stage's code must pass, and that Stage 1 is not to
reach customers without Stage 2.
Mark progress in the plan's §4 for this stage; leave `TODO.md` at one line.
