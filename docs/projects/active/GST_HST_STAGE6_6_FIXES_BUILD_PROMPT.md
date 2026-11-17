# GST/HST Stage 6 · the two 6.6 fixes — build prompt

> Written 2026-11-16 by `/plan`, after the 6.6 reviews and the owner's rulings that day (plan of record:
> [GST_HST_STAGE6_TERMS_PLAN.md](GST_HST_STAGE6_TERMS_PLAN.md) §5 "6.6", rulings 1 and 2). Both land **before 6.7** (publication).
> One small build session, two parts; Part 0 is a probe that decides how Part B is built. **Paste everything below the line
> into a fresh chat on `dev`.**
> Marks: [V] = the line was opened when this prompt was written; [H] = a helper's census, open it before relying on it.

---

You are building two small fixes the owner ruled on 2026-11-16, after the GST/HST Stage 6 step 6.6 reviews. Both protect a
promise the Terms of Service draft makes; neither changes a price, a tax or who is charged.

## 1. What this builds (owner's view)

- **A. The yearly reminder can no longer lose its date, amount or cancel line.** Today a platform-admin operator who customises
  the "Yearly renewal reminder" email template can delete the sentence with the renewal date and the amount, or the cancel
  sentence, and the Terms §8 promise ("we will email … at least 30 days before it renews, with the renewal date and the amount,
  plus applicable taxes") breaks silently. After this, those lines and the billing button are written by the product after the
  operator's text, the way the purchase email's figures already are. **What a customer receives today does not change by one
  character** while nobody customises the template.
- **A′. Both billing templates tell the operator to keep them transactional.** The descriptions of "The details of your purchase"
  and "Yearly renewal reminder" gain one line, so an edit never turns either into a promotional email (CASL).
- **B. A move up during a free trial sends "The details of your purchase".** Today a trialing club that moves up (for example
  Club → Club · Association) is charged nothing, so no email goes, and the trial email in their inbox still quotes the **old**
  plan's first payment. After this, every owner gets the details email for the new plan: "your trial continues, nothing charged
  today", the new plan's first payment and its estimated tax, and how to cancel before the trial ends.

## 2. The rulings this build implements (owner, 2026-11-16 — do not reopen)

1. **Build** the reminder's fixed block (the date-and-amount paragraph and the cancel sentence rendered by code; the template
   description says "keep this transactional") before 6.7.
2. **Send** the details email for a move up during a trial (trial words, the new plan's first payment) before 6.7.

Settled earlier and binding here: 6.4 rulings Q1 (live, not dark), Q3 (one email per purchase), Q4 (every active owner);
the purchase email is a summary, never a receipt; figures come from Stripe, never recomputed.

## 3. Part 0 — the probe (first; it decides Part B)

Nobody has watched what Stripe does when a **trialing** subscription moves up [H: no probe or note in the repo; the 6.4 build
had no trialing test subscription; `.probe/64/trial-preview.mjs` only answered the preview-tax question, walk §525 C7].
In Stripe **test mode**, with webhooks reaching your dev server (`stripe listen --forward-to …`; the 6.4 walk found the dev
site does not receive Stripe events on its own — read the 6.4 walk's "Before you start"):

1. Make a trialing subscription through the product (a Club or League trial on a dev club whose Stripe customer has never
   subscribed; the trial is for a first paid plan only). Keep its id in `.probe/66fix/`.
2. **Read the move window before pressing.** Open the move up and note what it says is due today. `previewUp` reads
   `invoices.createPreview(...).amount_due` [H `lib/plan-move.ts:278-311`]; for a trialing subscription Stripe may preview the
   invoice **at trial end** (the full new price) rather than today's $0. ⚠ If the window says anything but $0.00 due today,
   that is a **live defect in the move window** (the customer is told they will be charged now when they are not, and the
   press-time recheck compares against that figure). Record it in Progress and stop to tell the owner before fixing: it is a
   wording and figure fix on a shipped screen, and its words need `/legal`.
3. Press the move. Record every invoice event that arrives: `billing_reason`, `total`, `amount_due`, `status`, the
   subscription's `status`, and the metadata on `parent.subscription_details.metadata` (`flhq_plan_move`, `flhq_buyer_user_id`).
4. Read the row written to `platform_charge_tax_records` for it, if any (`billing_reason`, `total_cents`, `purchase_email_at`).

**What decides Part B:**
- **A $0 paid invoice with `billing_reason: subscription_update` and the move metadata arrives** → Part B as written below. No
  migration, no new stamp: the existing record, the `purchase_email_at` claim and the daily catch-up carry it.
- **No invoice at all** → **stop and come back to `/plan`.** A send from the move route would need a new once-only stamp (a new
  column or table, a migration, the dictionary) and would lose the daily catch-up. That is a different build and an owner call;
  do not improvise it.

## 4. Part A — the reminder's fixed block, and both descriptions

**How the purchase email does it today** [V `lib/platform-email-templates.ts:163-200`]: `renderResolvedEmail` uses the caller's
built-in html unless the row is customised; when it is, it renders the operator's heading and body (with the row's button via
`bodyWithCta`), then `fixedHtml` as `footerHtml`. `purchaseDetailsEmail` returns `fixedHtml` and the server passes it
[H `lib/purchase-details-server.ts:168-171`].

**The reminder today** [V `lib/renewal-reminder.ts:184-211`; H `lib/renewal-reminder-server.ts:167-170`]: the built-in html is
heading · `lead` · `moveDownLine` (if any) · `REMINDER_WORDS.keepOrStop(date)` · the "Your billing page" button. The send passes
**no** `fixedHtml`. The seeded row (migration 478, ~:97-105) has body `{{lead}}` / `{{moveDownLine}}` / the keep-or-stop
sentence typed out, and `cta_label` "Your billing page", `cta_url_pattern` `{{billingUrl}}`.

Build:
1. `renewalReminderEmail` returns `fixedHtml` = `lead` paragraph · `moveDownLine` paragraph (if any) · keep-or-stop paragraph ·
   the billing button. The built-in `html` = heading + `fixedHtml`, **byte-for-byte what it sends today** (add a test that pins
   it against today's output for each of the three kinds).
2. The server passes `fixedHtml: email.fixedHtml` (the purchase email's line, copied).
3. **One button, not two.** The fixed block now carries the button, so a customised row's own button must not render too.
   Recommended: a `renderResolvedEmail` option (for example `fixedCarriesButton: true`) that drops the row's cta for that send,
   used by the reminder only. Do not change how the purchase email or any other template renders.
4. **Migration 490** (the next free number [H: highest on disk 489]), data only, in the style of 478/425:
   - `yearly_renewal_reminder`: where `is_customised = false`, set `body` to one opening line (below, §6) and `cta_label` /
     `cta_url_pattern` to null; leave `subject` and `heading` as they are (both carry the date, and the fixed block carries it
     regardless).
   - Both keys, unconditionally (operators cannot edit a description): append the description line in §6.
   - The `variables` list stays as it is (the editor's chips; `lead` stays insertable for an operator who wants it twice — it is
     harmless).
   - An entry in `supabase/migrations/MANUAL_PROD_STEPS.json` (prod apply rides 6.7 with 478's siblings); `npm run
     refresh:snapshots` and the refreshed snapshots in the same commit (the snapshot-freshness check counts migrations [H]).
     No column changes, so no dictionary edit — confirm `npm run check:dictionary` passes.
5. Tests:
   - `tests/unit/gst-hst-6-4-renewal-reminder.test.ts` :260-267 reads migration 478's row [H]: point it at 490's text, and keep
     the declared-variables check.
   - A reminder twin of the purchase email's fixed-block test [H `tests/unit/gst-hst-6-4-purchase-email.test.ts:269-282`]:
     the fixed block holds the date, the amount, the keep-or-stop sentence and the button; a customised row renders them after
     the operator's text; a customised row with its own cta renders **one** button; the built-in html includes `fixedHtml`.
   - The existing "only href is the billing URL; never paid, receipt, upgrade" assertions still pass on both paths.
6. Not in scope: the editor's live preview and the test-send route render no fixed block for either template today [H
   `EmailTemplateEditor.tsx:28-50`; `test-send/route.ts:49-77`]; the description line tells the operator what the app adds.
   Do not build a preview of the fixed block.

## 5. Part B — the details email for a move up during a trial (only if Part 0 found the $0 invoice)

**Today** [V `lib/purchase-details.ts:45-60`]: `classifyPurchase` returns `plan_change` for a `subscription_update` only when
`totalCents > 0` and the move metadata is `up`; a test pins the $0 case as null [H test :40-46].

Build:
1. A new case **`trial_change`** in `PurchaseCase`: `billing_reason === 'subscription_update'`, `totalCents === 0`,
   **`subscriptionStatus === 'trialing'`**, `meta[MOVE_METADATA_KEY] === 'up'`. ⚠ The move metadata stays on the subscription
   after the move [H], so the trialing guard is what keeps a later $0 dashboard update from sending a details email; test that
   a non-trialing $0 update with `up` metadata still returns null.
2. Add it to `isFreePurchase` (the "Charged today $0.00" row, the first-payment sentence from `sub.trial_end`, and the
   trial estimate from Stripe's preview all follow [H `purchase-details-server.ts:150-161`; `trialEstimate` :94-103]). The
   first-payment price is the subscription item's price at send time, which is the **new** plan's — check it in the probe's
   email.
3. The opening and the subject in §6. "Bought by" works as for a move up (`flhq_buyer_user_id` in the move metadata).
4. Tests: classifier rows (trialing $0 up → `trial_change`; non-trialing $0 up → null; trialing $0 update without `up` → null);
   the email's words for the case; the existing trial and plan-change tests unchanged.
5. Re-run the probe's move (or make a second trialing subscription) and read the email that arrives: new plan, $0 today, the
   new plan's first payment and its estimated tax, the cancel-before-trial-end sentence, the Terms line. Keep the text in
   `.probe/66fix/`.

## 6. The words (proposed; `/legal` and `/accounting` read them before hand-off — §8)

- **Part A, the reminder template's seeded body** (shown only to an operator, and sent only if they customise it):
  > A note about {{orgName}}’s yearly plan.
- **Part A′, appended to both templates' descriptions** (staff only):
  > Keep this email transactional: no offers, no other plans’ prices, and no links. The app adds the figures, the cancel
  > line and the billing button after your text, so they cannot be removed.

  (For `purchase_details`, "the billing button" reads "the invoice, billing and Terms links".)
- **Part B, the opening** (`PURCHASE_WORDS.opening` for `trial_change`):
  > {orgName} is now on {planLabel}. Your free trial continues, and nothing has been charged today.

  Subject: unchanged (`The details of your purchase: {planLabel}`). Everything below the opening is the trial case's, as built.

## 7. Rules that bind

- Figures come from Stripe (the invoice's tax record, or its preview for the trial estimate and the reminder); nothing recomputed.
- Replay-silent and once-only: the `purchase_email_at` claim and the reminder's `renewal_reminded_for` stamp are untouched.
- Every active owner receives both emails; demo addresses never do; the dev mock paths (`mock_` ids) write no invoice.
- Dates only through `formatStoredDate`; one spelling (`npm run check:spelling`); no personal name or home address (O1′).
- `npm run verify:changed` and focused lint; `npm run typecheck` (this touches a shared email module). A failure in a file you did
  not touch: report it, don't fix it (other sessions share the tree).
- Explicit pathspecs only, on `dev`; **ask before committing**; the migration, its snapshots and its prod-step entry in the same
  commit as Part A's code; Part B in its own commit.
- Census work goes to a helper; open every cited line yourself before building on it.

## 8. After the build

1. **`/legal` and `/accounting`, light** — the three proposed sentences in §6 (CASL: still transactional; the Part B opening is
   true for a move that charges nothing), and the probe's email figures.
2. **The Terms draft and the help** (copy, same session):
   - Terms §16: "When you start a plan, or pay to move up to a higher one" → "When you start a plan, or move up to a higher one";
     §16's NOTE and §6 line B the same; the `/accounting` 6.6 record's item E closed.
   - The club guide's "Free trials, and the emails about your plan" answer: "or pay to move up" → "or move up (during a trial
     too)". `check:spelling`.
   - The legal topic files `RENEWAL_REMINDER_AND_QUEBEC_GATE.md` and `CASL_PURCHASE_DETAILS_EMAIL.md`, their 6.6 sections:
     mark the template finding closed, with the commit.
3. **The walk** — propose one short owner walk (under 20 boxes): customise the reminder template on dev and read a test reminder
   (one button; the date, amount and cancel line after the operator's text), reset it; a trialing move up on dev and the email
   it sends. Publish it only when the owner asks (ledger §534 then).
4. Update the plan's §5 6.6 rulings block and `TODO.md`'s Stage 6 line with the commits.

## Progress
- [x] Part 0 — probe (trialing move up: invoice? the move window's "due today") — 2026-11-16, `.probe/66fix/trial-move-up-run1.txt`:
  the window previews **$0.00 due today** (no defect); a **$0 paid `subscription_update` invoice with the move metadata** arrives →
  Part B as written. Run with the product's own Stripe calls on a throwaway test customer (not through the browser); the
  record-writing half is the walk's.
- [x] Part A — fixed block + one button + migration 490 + snapshots + prod-step entry + tests — committed `a9d559062` (built html
  identical to the old builder on 7 inputs; 490 applied to dev, re-run exact; `/legal`'s three wordings applied).
- [x] Part B — `trial_change` + tests + a real email read — committed `873fc7c76`. The email was BUILT from real Stripe objects,
  not sent (`.probe/66fix/trial-change-email-run1.txt`: $379.00 on December 16, 2026, HST 13% $49.27, $428.27 CAD); the end-to-end
  send is the walk's. `/review` excluded a next-season choice (trialing, no free trial) — an owner question in the plan §5 6.6.
- [x] §8 reviews, Terms/help copy, walk proposed — `/legal` + `/accounting` (item E closed), Terms §16 / §6 line B / §16 NOTE, the
  club guide; walk proposed in the plan's 6.6 block, not published.
