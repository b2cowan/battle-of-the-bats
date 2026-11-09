# Plans & pricing · Stage 2 · Part 5: replay a missed Stripe update (build prompt)

> Written 2026-11-08, after the owner ruled the drawings (all six asks as recommended, by paste-back).
> Drawings of record: https://claude.ai/artifact/Chw946z38BkoFa91XafRGh (`PLANS_PRICING_STAGE2_PART5_REPLAY_DRAWINGS.html`);
> PM brief `PLANS_PRICING_STAGE2_PART5_REPLAY_PM_BRIEF.md`; stage prompt `PLANS_PRICING_STAGE2_BUILD_PROMPT.md` (Progress block, and the
> "Owner rulings, 2026-11-06" that still bind, esp. ruling 3 and 5). Stage 0 prompt `PLANS_PRICING_STAGE0_BUILD_PROMPT.md` (the event log).
> Mark each fact you rely on [V] (verified this session, file:line) or [H] (handed to you). Everything about the code below is
> [V] as of 2026-11-08 unless marked [H]; **re-open every cited line first.**
>
> **Two sessions, in order. Do not merge them.** Session 1 committed `3817838e8` 2026-11-08 (/review high done; its fixes in). Session 1 is the engine and its proof, with no screen. Session 2 is the screen.
> Session 1 changes how a billing event is run, so a mistake there can silently write a wrong plan onto a real club: **run it on
> the strongest model available and have `/review` (high) read it before Session 2 starts.** Session 2 is ordinary console work.

## The rulings (owner)

From 2026-11-06 (stage prompt, rulings 3 and 5): replay re-runs a stored event through OUR handler, re-fetched from Stripe by id
(no payload is stored); **Super admin only** (power `replay_events`, already in the rulebook, `lib/platform-areas.ts:91,126,233` [V]);
a reason is required; a change-log row; it refuses the wrong Stripe mode; **it must be proven harmless the second time before it is
built.** The drawings' "Send again" (ask Stripe to resend) is NOT what is built.

From 2026-11-08 (this drawing session, all as recommended):

1. **No customer message from a replay**, and the window and the result say so.
2. **The door** sits on a failed update in the Stripe page's "What failed in …" list, plus a line **"Replay an update by its id"**
   for anything else. Only Super admin sees either; for every other role they are not drawn (and the server refuses).
3. **Before and after** = the club's billing record (status, plan, paid through, billing cycle, plan end) read just before and just
   after the run, with the limit stated in the window ("Bill and charge records the run keeps are not shown here").
4. **Only an update that did not finish can be replayed** (failed, taken but never finished, set aside with no customer). A finished
   one answers "This update already finished".
5. **Plan billing only.** Family payments are not replayable.
6. **No Sign in again step:** a reason and the change log are enough.

## Do not

Call Stripe's resend. Store a payload or a copy of any Stripe fact. Write to Stripe. Replay a finished update, a wrong-mode one, or a
family-payments one. Send any message to a customer from a replay. Add a dry-run. Touch `.claude/settings*.json`, hooks,
`package.json` scripts or anything in `WATCHED_PATHS`. Run anything against production. `git add -A` / `git add .`. Commit without
the owner's yes. Start Part 6.

## What the code does today [V]

- **Receiver** `receiveBillingEvent` (`lib/stripe-billing-events.ts:135-173`): mode check → atomic claim → run → outcome. A finished
  row answers `duplicate`, so **a replay cannot go through the receiver**. It calls the seam `runVerifiedBillingEvent(event,
  customerId)` (`lib/billing-webhook-handler.ts:224`) and does the mode check, the claim and the outcome itself.
- **The claim** is the database function `stripe_billing_event_claim` (`416_…sql:70-93`): `new` (inserted), `retry` (an unfinished row
  with no claim, or a claim older than five minutes, atomically re-claimed, `attempts + 1`), `duplicate` (**processed OR any
  `ignored_reason`**), `busy`. So a **failed or stuck** update is already re-claimable by this function; **a set-aside
  (`no_customer`) row is `duplicate` to it and is NOT.** Ruling 4 says set-aside updates can be replayed, so Session 1 must add an
  atomic way to reclaim a `no_customer` row. Prefer one conditional `UPDATE … WHERE id = $1 AND ignored_reason = 'no_customer'
  AND processed_at IS NULL … RETURNING` from code (no migration). If the session concludes a database function is needed instead, it is
  additive, goes with `DATA_DICTIONARY.md` + `npm run refresh:snapshots`, and is recorded as prod-owed. `not_ours` (a dispute or refund on
  a charge that paid no subscription invoice) and `wrong_mode` are **not** replayable: say so in the window.
- **Outcome rows:** `done(id, outcome)` writes `processed_at` (and `ignored_reason` for `no_customer`/`not_ours`); `fail(id, msg)`
  stores up to 500 characters and clears the claim (`:95-108`). A replay that still finds no customer therefore leaves the row set aside
  again, which is the "Set aside again" window.
- **Event facts:** `billingEventFacts(event)` (`:40`) gives `customerId` for the run; use it for a re-fetched event.
- **What a run can do outside the club's record** [V for the three sites read; the rest is the audit below]:
  - `customer.subscription.trial_will_end` emails the club owner via `sendTransactionalEmail` with **no guard and no idempotency key**
    (`billing-webhook-handler.ts:933-962`). The two welcome-back emails (`:521-551`, `:687-`) are guarded by the club having been
    cancelled, so a replay after it is active does not repeat them.
  - `invoice.payment_failed` and others send **in-app notifications to the club's owners** (`:925-927` region [H: confirm the call and
    which cases]). Ruling 1 says "no customer email"; the owner's intent is no customer message at all, so **treat an in-app
    notification to a customer as the same rule** and tell the owner you did.
  - Owner alerts (`alertOwner`, `:139`) carry an idempotency key already. Tax and charge records are written by the invoice and
    credit-note events (`lib/charge-tax-record.ts`); `org_billing` events carry `sourceEventId` (`:678`) [H: confirm they are idempotent].
- **Staff actions are logged audit-first:** `writeAuditBeforeChange` / `auditFirst` (`lib/platform-audit.ts:85,110`): the row, with its
  reason, is written strictly first; if it cannot be written nothing runs ("The change log could not be written, so nothing was
  changed. Try again."); if the change then fails a second `<action>_failed` row names the first. The action joins
  `tests/unit/platform-audit-money-first.test.ts`'s list, is NOT in `NO_REASON` (`lib/platform-audit-reason.ts`), and gets a door back to
  Watching Stripe in `lib/platform-audit-doors.ts`. `refund_charge` is the pattern to copy.
- **The Stripe page** `app/platform-admin/watching-stripe/page.tsx` (its file comment says "Part 5's replay … is not here"). Failures
  come from `lib/watching-stripe.ts`; the list shows at most `FAILURE_LINE_CAP` (5) lines and "and N more" (`lib/watching-stripe-words.ts:60`),
  which is why the find-by-id line exists.
- **The window** `app/platform-admin/RecordWindow.tsx`: title, one sentence, fields, required Why (`whyMax` 1000), foot sentence left /
  buttons right, one main action (lime). Refusal = `confirmHidden` + `cancelLabel="Close"`. **It closes when `onConfirm` returns null**,
  so the result states are new (see Session 2).

## Session 1 · the engine, and the proof (no screen)

**Do these in order. Stop and report if step 1 cannot be shown.**

1. **Audit every branch for replay-safety, in writing, before changing code.** For each event type the seam runs (`runPlanWork`'s
   switch at `:258`, the subscription-charge events via `isSubscriptionChargeEvent`, the credit-note and invoice tax-record events,
   the club fee-invoice skip at `:253`) record in the stage prompt's Part 5 block: does it write from the EVENT's own payload (stale
   by the time of a replay) or from a fresh read of Stripe; what does it write; what does it send; is a second run a no-op. A branch
   that writes the event's stale payload over newer state is the real danger: the ordering guards are at `:419`, `:465`, `:830`,
   `:893` [H: the earlier pass did not audit every branch]. For any branch that is not replay-safe, the replay **refuses that
   event type** with a sentence (it is not asked to fix the handler), and the owner is told which types.
2. **Replay input on the seam.** Add one optional input to `runVerifiedBillingEvent` (e.g. `{ replay: true }`) that suppresses every
   customer-facing message (the trial-ending email, any in-app notification to a customer) and nothing else. Live deliveries pass
   nothing and behave exactly as today (a test proves it).
3. **A pure module** `lib/billing-event-replay.ts` (no I/O; tests run it as is): the decision "may this row be replayed" and the words
   for each refusal, matching the drawings' six refusals: already finished; the other Stripe account; older than Stripe keeps; being
   delivered right now; no such id; change log unavailable. Plus the before/after record diff (which rows changed, "Nothing changed").
4. **Confirm Stripe's retention window** against Stripe's own documentation (the drawings say "about 30 days"; that figure is [H]). Use
   the documented figure in the words; handle Stripe answering that the event no longer exists by the same sentence.
5. **The engine** `lib/billing-event-replay-run.ts`: look up the log row by id (none → "No update with that id"); mode check against
   `stripeKeyIsLive()` (wrong mode → refuse; the row already says `wrong_mode`); refuse a finished row; **claim** (failed/stuck →
   the existing function's `retry`; set-aside → the conditional update above; `busy` → "being delivered right now"); re-fetch the event
   from Stripe by id; read the club's billing record (**before**); `runVerifiedBillingEvent(event, customerId, { replay: true })`;
   read it again (**after**); `done`/`fail` exactly as the receiver does; return the diff and the outcome word. A run that throws
   stores the error and returns "The replay failed" (Stripe is not told; nothing is retried by itself).
6. **The route** `POST /api/platform-admin/stripe/replay` (name to fit the neighbours): requires the `replay_events` power (Super admin
   only; see how the refund route checks its power), a non-empty reason, the audit-first wrapper around steps 5, the `_failed` row on
   failure. Returns only what the window shows: no customer details beyond the club's name and the five billing fields.
7. **The proof (the gate), in `tests/unit/`, using the fakes pattern of `stripe-billing-events.test.ts`:**
   - run a failed event twice: the second is refused as finished and **writes nothing**;
   - run it, then run a later event that already fixed the club, then replay the first: "Nothing changed";
   - a live retry and a replay at the same moment: exactly one runs (the other is `busy`);
   - a replay never calls the email or notification senders (assert with spies) and a live delivery still does;
   - a wrong-mode row, a `not_ours` row, an unknown id and a missing Stripe event each refuse before any claim or write;
   - the change-log row is written before the run, and if it cannot be written the run never starts;
   - every replayable event type from step 1 run twice leaves the club's record identical after the second run.
   If any of these cannot be made true, **stop, report which, and do not build Session 2.**
8. **Verify:** `npm run verify:changed`; `npm run typecheck` (shared handler change); the Stage 0 event-log suites stay green. Run
   `/review` at high on the diff before reporting. Do not commit; report what to commit.

## Session 2 · the screen (Session 1 committed `3817838e8` 2026-11-08; Session 2 BUILT 2026-11-08, walk C = Owner QA Ledger §496, owed; what it changed from this section, its review fixes and its accepted notes are in the stage prompt's Part 5 Progress block)

**Read first, and argue from the code, not from this list:** the Part 5 block of `PLANS_PRICING_STAGE2_BUILD_PROMPT.md` (the
audit, owner rulings **A1/A2** of 2026-11-08, "Session 1 BUILT", "Session 2 must change from the drawings"); then
`lib/billing-event-replay.ts` (every refusal's words, `replayResultWords`, the result kinds), `lib/billing-event-replay-run.ts`
(the engine) and `app/api/platform-admin/watching-stripe/replay/route.ts` (the POST). Re-open every line you rely on. **A1/A2
narrow the drawings; where the drawings and this section differ, this section wins** — and where this section and the code
differ, the code is the truth and the section is wrong (say so).

**What changed from the drawings (all from Session 1, owner-ruled):**
- **Replayable = the safe list only** (`REPLAYABLE_TYPES`). A subscription created/updated/deleted, a checkout, a card added or a
  club's Stripe-fees bill is REFUSED with its sentence. The failing list can hold such a line: its Replay door still opens the
  window, which shows that refusal with no reason asked — do not hide the door per type (a hidden door reads as "nothing failed").
- **A set-aside (no customer) update is refused** (A2); the drawings' "Set aside again" result does not exist.
- **The refusals are the code's** (`replayRefusal`): the drawings' six, plus not ours, set aside, not replayable, Stripe-fees bill,
  a later bill, not a plan bill, another Stripe format, Stripe did not answer, record unread, not claimed, say why first.
- **The results are the code's** (`ReplayResultKind`): changed (Before/After), unchanged ("Nothing changed"), **ran** (no club
  record to compare, e.g. a dispute, or the after-read failed: no table), failed ("Replay again"), set_aside (not ours),
  no_customer. When `marked` is false the foot says the run could not be marked finished.
- **Stripe keeps an update for 30 days** (Stripe's API reference, confirmed): the caption says "for 30 days", not "about".
- **Messages, not only emails:** the window's fact is **Messages: "No message is sent to the customer by a replay"** (ruling 1
  covers the in-app notice too). ⚠ State in help: a replayed failed payment does NOT put the notice on the club owners' Needs
  attention list (the silenced notice is what feeds it).

**Build:**
- **A read for the window (new, read-only):** the POST does not offer the facts the window shows before the click (Update type +
  id, Received, Club, Last result) nor a refusal before the reason is asked. Add `GET /api/platform-admin/watching-stripe/replay?id=evt_…`
  (same power, `replay_events`) answering the row's facts and `replayRowRefusal` (pure: no Stripe call, no write). Club by the
  engine's `findClub`. Never the payload.
- **Door:** on each line of "What failed in Plan billing", Super admin only: the word **Replay** inline in the row (the
  outlined-button rule does not apply in a list row; **no "›"**). Failed lines already carry the id (`lib/watching-stripe.ts`).
- **Find by id:** a card under the failures, heading **"Replay an update by its id"**, a text field (placeholder `evt_…`), an
  outlined **Find update** button, caption "Stripe keeps an update for 30 days." It opens the same window through the GET.
- **The window** (`RecordWindow`): title "Replay this update?"; the sentence "Runs Stripe's update through the product again, using
  what Stripe holds for it now. It does not charge, refund or change anything in Stripe."; facts Update, Received, Club, Last
  result, Messages; **Why \*** (placeholder "Say what you are fixing, for the change log.", `whyMax` 1000 = `REPLAY_REASON_MAX`);
  foot "Goes in the change log with your name and your reason."; Cancel + lime **Replay**. A refusal = `confirmHidden` +
  `cancelLabel="Close"` with the refusal's title and body. Dates through `lib/console-dates.ts` (`consoleWhen`, no current year).
- **The result** (new): the window stays open and turns into the answer (`words` from the POST: title, sentence, foot; the rows
  for Before/After, unchanged rows dimmed under "Show only what differs"). One lime main action each: "Done"; failed → "Replay
  again" + Close. Extend `RecordWindow` minimally (an optional result state); every other caller unchanged (a guard proves it).
- **The change log's Before → After (drawings tab 3's audit line):** the first row is written BEFORE the run and the log cannot be
  edited (mig 429), so the change is not stored today. Recommended: after the run, a best-effort companion row
  `replay_billing_event_result` (old = before, new = after, the same reason) written by the engine; the Audit line shows "Status:
  Past due → Active". It is NOT an audit-first action (the change already happened); it needs the Audit label and door, and
  `platform-audit-reason-guard` must accept it. Put it to the owner in the PM summary (or drop the line from the Audit view).
- **After:** a replayed update leaves the failing list and the "Updates still failing" count drops (the row is finished); the line
  says "Replayed" with who and when for the rest of the day (read from the change log's `replay_billing_event` rows by event id).
  The Audit log's Action filter shows "Replayed a Stripe update" and "Replay failed" (labels added in Session 1; check the filter's
  list), each line's door "Open Stripe" (added), the reason in full.
- **Roles:** Super admin sees the door and the find card; Billing, Support, Product read the page as today; the server refuses
  everyone else (POST and the new GET). Update the page's file comment ("Part 5's replay … is not here") and the guard tests that
  name the page's contents.
- **Help:** `/docs` adds "How to replay a Stripe update" to the platform-admin guide: when to use it (an update Stripe gave up on,
  or a re-run after we fixed our own fault), what it will not do (charge, refund, change Stripe, message the customer, add a Needs
  attention notice), which kinds refuse and why (the safe list), the 30 days; and updates "Stripe" help if it says the page never
  changes anything.
- **Verify:** `npm run verify:changed` (it stops at the first red step: also run the steps after `npm test` and say which reds are
  other sessions'); `npm run typecheck` with `NODE_OPTIONS=--max-old-space-size=8192` (the default heap runs out); `npm run
  check:layout --changed` on the Stripe page at 1440 and 1280; a signed-in probe on dev as Super admin (door shown, GET 200, window
  opens) and as Billing (no door, GET and POST 403). The owner does the browser walk.
- **Walk C** (checkable Artifact, one purpose: replay): plant on dev and say exactly how and how to put it back. Plant: a dev
  `stripe_billing_events` row of a REPLAYABLE type received in the last 30 days (an `invoice.payment_succeeded` whose invoice is
  still its subscription's latest makes the best walk: Before/After shows); set `processed_at = null, error = 'Planted for walk C',
  claimed_at = null`. Put back: the replay itself finishes it; if the walk stops early, `processed_at = now(), error = null`. Walk:
  replay it, see Before/After, replay again (refused as finished), a refused kind (a `customer.subscription.updated` row planted the
  same way: its refusal, no reason asked), the Audit log line, the page as Billing (no door). Then the ledger entry (next free §),
  the Progress block, the TODO line and the PM brief status.
- **Not this session:** making subscription changes replayable (A1's follow-up: drawn first, its own stage item).

## Closeout notes

`/accounting`: not required (nothing changes what we charge, invoice or report); say so in one line. `/legal`: a quick pass is cheap (the
change log keeps a staff member's name and reason; no customer data is added); apply or record. `/simplify` if a new shared helper
appears; `/review` (high) before hand-off; `/docs` as above. A migration only if Session 1 chose one (dictionary, snapshots, prod-owed).
Restart the dev server near hand-off (new files, shared handler change).
