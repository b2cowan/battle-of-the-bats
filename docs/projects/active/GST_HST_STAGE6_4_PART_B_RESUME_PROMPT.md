# GST/HST 6.4 Part B — build the yearly reminder and the Québec refusal

> Written 2026-11-13 by the Part A close session. Run as ONE fresh Sonnet build session on `dev`. Plan of record:
> [GST_HST_STAGE6_4_BUILD_PROMPT.md](GST_HST_STAGE6_4_BUILD_PROMPT.md). Read its **Progress** block first (Part A's hand-over notes, the
> test-mode answers, the six owner calls recorded at close). **Do not re-litigate the rulings in its §2**, and restate none of the
> plan here: this file only says what is ready and what is yours.

## 0. Before anything
- `git rev-parse --abbrev-ref HEAD` must be `dev`. Other sessions share this working copy: **never** `git add -A` / `git add .`;
  explicit pathspecs only; ask the owner before committing.
- Part A is committed: `8bb8ac32f`. Mig **478** is applied to dev (prod step recorded in `MANUAL_PROD_STEPS`).
- Read: build prompt **§4** (the reminder step 4.1, the Québec refusal 4.2, done-when 4.3), **§6** (the reminder words and the
  Québec words, already reviewed — copy them exactly), **§7** (rules that bind), and **§8** (the walk is a LATER session).
- Delegate any census ("find every caller…") to an `Explore` helper asking for path:line and a verdict; open every cited line yourself.

## 1. What Part A left ready (use it, don't rebuild it)
- **Mig 478 on dev:** `renewal_reminded_for` (timestamptz) on `organizations` and `team_workspaces`; the `yearly_renewal_reminder`
  template row (variables `subjectLine`, `headingLine`, `lead`, `moveDownLine`, `date`, `billingUrl`); `purchase_email_at` and
  `billing_reason` on `platform_charge_tax_records`.
- **The kind** `yearly_renewal_reminder` is already in `lib/email-kinds.ts` (the logged count is **57** in
  `support-console-stage5-guard.test.ts`; do not bump it).
- **Every owner:** `orgOwnerEmails(orgId)` in `lib/notify-recipients.ts` (demo addresses skipped) and, in
  `lib/owners-send-outcome.ts`, `sendToOwners(recipients, send, opts)` (a throw reads as "may have gone"; returns `sent` /
  `not_sent` / `unknown`) over `ownersSendOutcome`. The purchase email does NOT pass `skippedIsSent`; the plan-ending emails do.
  Per-owner idempotency key: one key per owner (Resend refuses one key for two addresses).
- **For §4.1's "a trial whose purchase email went out under 38 days before its first charge":** the purchase email stamps
  `platform_charge_tax_records.purchase_email_at` (set before the send, given back only on a definite refusal) and the record's
  `billing_reason` is `subscription_create`; its first charge date is the subscription's trial end. A trial purchase email says
  "Your first payment … on {date}" (`lib/purchase-details.ts`), which is why the reminder must not repeat it.
- **Patterns to copy from the purchase run** (`lib/purchase-details.ts`, `lib/purchase-details-server.ts`): the once-only claim
  (conditional update, released only on a definite not-sent), a pre-filter from the stored row before any Stripe read (a renewal or
  fee invoice cost nothing), a **time budget** on the daily step (the catch-up stops starting new items after 2 minutes so a slow
  Stripe cannot starve the steps after it), `captureError` on an unknown outcome, and a swallow-and-report wrapper so nothing
  throws into the webhook or the job.

## 2. What Part B adds (the build prompt has the detail)
1. **The `renewal_reminders` daily step**, in its own `run()` in `app/api/platform-admin/stripe-fees-daily/route.ts` (§4.1; the
   route's `maxDuration` is 300 s, and `purchase_emails` already runs before it).
2. **Its own `invoices.createPreview` row** in `tests/unit/billing-location-every-path-guard.test.ts` (the purchase email's trial
   estimate already has one; a second preview needs its own row or the guard fails).
3. **`requireBillingLocation(buyer, address, { purchase: true })`** with the region check BEFORE the save (§4.2), the census
   `purchase` column in the same guard test, and the move route's `purchase: true` only when `direction === 'up'`.
4. **`billing_region_closed`** (409) added to the move window's "Check again" exclusions, and the **Province notice** in the
   address form when Québec is chosen (never blocks the save).
5. **A test-mode check that Stripe Checkout cannot take a Québec address** (§4.2 "side door"; `billing_address_collection` is set
   nowhere and `customer_update` carries `name` only — confirm against the live session, and report).

## 3. Open items to carry (decide or leave, and say which)
- **§6's trial-preview tax question:** does a trialing subscription's `invoices.createPreview` carry tax lines? Answer it in test
  mode if a trialing subscription can be made without polluting dev (webhooks fire into dev), otherwise leave it to the 6.4 walk.
  The reminder drops only the estimate sentence when the preview carries no tax, so either answer is safe.
- **The fee-invoice emails** still go to one owner (`lib/platform-stripe-fees.ts`): moving them to every owner is the recommended
  follow-up (a stamp per row); it is the owner's call, not part of Part B unless the owner says so.
- **The "paid" ruling:** `/legal` (2026-11-13) said the conflict is the *rule's* wording, not the email's. If the owner has not
  re-worded the build prompt's rule, the reminder's words still follow §6 exactly. Don't change reviewed words.
- **Six owner calls recorded at Part A's close** (build prompt Progress): none blocks Part B. Do not act on them unasked.

## 4. Known reds that are NOT yours
Other sessions' in-flight work (seen 2026-11-13; re-check, don't fix): account-first-signup, billing-plus-tax-words,
club-accounting-teams-guard, club-stage13a-doors-guard, coach-practice-plans-phone-guard, coach-schedule-phone-guard,
coach-schedule-sheet-guard, kit-dialog-floor-guard, online-payments-card-dispute-screens, org-billing-access-guard,
plan-billing-usage, plan-reader-door-guard (tournament-online-payments), possessive-guard, public-tournament-stage6-walk,
series-date-groups, support-console-stage3-guard, support-console-stage4b-inforce-guard, team-move-coverage,
workspace-flip-guard (console-money-sales-tax-wait, DeskNamedPage, kit-tournament-groups). **A red that names a Part B file is
yours: fix it.** Use `npm run typecheck` (the raw `npx tsc` runs out of memory) and `npm run verify:changed`.

## 5. Finish
1. `/simplify` then `/review` are offered, in that order; apply what survives.
2. `/legal` and `/accounting` before hand-off: any NEW sentence, and the reminder's figures (the preview's subtotal, tax lines and
   total, never `amount_due`).
3. Ask the owner before committing; show the file list and the message; end the message with the attribution lines from the
   session's system reminder. After each commit run `git show --stat HEAD` and confirm only your files landed.
4. Update the build prompt's Progress line for Part B ("COMMITTED `<hash>` <date>", a positive fact) and the GST/HST memory file
   with its MEMORY.md line.
5. The **6.4 walk** is its own session (build prompt §8): it tests the three deliverables on dev in test mode. Do not start it here.
