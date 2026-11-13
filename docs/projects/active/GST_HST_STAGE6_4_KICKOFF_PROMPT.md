# GST/HST Stage 6 · step 6.4 — the purchase email, the yearly reminder and the Québec refusal (kickoff prompt for `/plan`)

> Written 2026-11-13, after the 6.3 owner walk passed 81/81 (ledger §506; build `ec90b1197`, `de5c40218`, `1b8b7c2f4`). Run it as a
> **`/plan` session on Opus**. Plan of record: [GST_HST_STAGE6_TERMS_PLAN.md](GST_HST_STAGE6_TERMS_PLAN.md) — **§5 step 6.4 is this
> session's brief**; §3's RULED block binds (**O2** build the 30-day yearly reminder, **O3** refund the unused part by hand, **O4**
> not offered in Québec). PM brief: [GST_HST_STAGE6_TERMS_PM_BRIEF.md](GST_HST_STAGE6_TERMS_PM_BRIEF.md). The customer-facing promises
> the build must make true are the Terms draft `docs/agents/legal/drafts/TERMS_OF_SERVICE.md` **§6, §8 (yearly plans), §16, §17**,
> plus its **"From the `/accounting` read"** block at the foot (the list the email must show).
> Marks: **[V]** opened by the author of this prompt 2026-11-13; **[H]** a helper's census that day — open the line before relying on it.

## What this session is

A **planning** session. It writes the **build prompt(s)** for 6.4 (Sonnet; this session decides the split), updates the PM brief and
the plan's §5 6.4 progress line, and writes the migration task list. **No product code.** Before the build prompt, present the
plain-language UX summary (house rule: what an owner receives and when, what a buyer in Québec sees) and get the owner's answers to
the questions below. Whatever 6.4 builds respects the "dark until 6.7" rule **unless the owner rules otherwise in Q1**.

## What 6.4 delivers (plan §5 6.4)
1. **The purchase email.** On a first purchase and on a paid plan change: what was bought, the price before tax, **each tax by name,
   rate and amount** (e.g. "HST (ON) 13%"; a zero-rated sale "GST/HST 0%"), the total in CAD, how often they're charged, start and
   renewal dates, how to cancel, a link to the invoice, our business name and GST/HST number, and **the exact Terms version
   accepted — as a link to that version's page** (whether a link is "a copy" under Ontario's rules is `/legal`'s call in 6.6; the
   draft's open question). For a trial: $0 today, then the amount plus tax on the charge date. **Figures come from the Stripe
   invoice, never recomputed.** It is "the details of your purchase", never called a receipt or an invoice. Closes Terms §16.
2. **The yearly-renewal reminder (O2).** At least 30 days before a yearly plan renews: the renewal date and the amount plus
   applicable taxes. A step of the existing daily job. Terms §8 says "we will", so **§8's paragraph is not published before this ships.**
3. **The Québec refusal (O4).** Checkout declines a Québec billing address with a plain line. Terms §17 is true only once this ships.
4. **No build, but yours to write:** the price-rise hand procedure (30 days' email, never silent) as a short note under
   `docs/agents/legal/` (§8 "Price changes"); and the §9 "warning emails" decision — the Terms either promise them or say "we will try
   to warn you". See Q8.

## What the code looks like today (a helper's census, 2026-11-13 — the lines I opened are [V]; the rest are [H])

**There is no single "purchase completed" moment. Disagree with the plan's "on every first purchase and every paid plan change" if
that is wrong; the shape below is why it is hard.**
- **No purchase email exists** for a club, league or Tournament plan [H]. The only "you bought it" mail is the Coaches Portal (Premium)
  welcome, sent from the team-provisioning step (`lib/team-checkout.ts:664–681` [H]: calls `sendEmail` directly, **no idempotency key,
  bypasses customised templates**). The webhook's only plan-completion emails are `welcome_back` (a re-subscription) and `trial_ending` [H].
- **Three webhook arms, plus in-app paths.** `lib/billing-webhook-handler.ts` [V that the file and its arms exist]:
  `checkout.session.completed` (does not write the plan for a club — it only sets the customer), `customer.subscription.created/updated`
  (**where a club plan is actually applied**), and `invoice.payment_succeeded` (`:819` [V]; status + period only, no email; the only place
  with real tax amounts in hand). **A plan upgrade through the in-app move route is completed by the route, not the webhook**
  (`lib/plan-move.ts:428–505` [H]; the webhook's growth event skips it). A **next-season choice** records a choice and charges in
  September 2027 [H]; a **Founding Season** Tournament Plus is a comp with no Stripe at all [H].
- **The order trap [V].** `runPlanWork` runs first and the tax record is written **after** it (`:242–246` [V]). An email sent inside the
  plan arm cannot read the stored tax record — it must read the Stripe invoice itself (the tax-record code expands `total_taxes` and has the
  per-line helpers, `lib/charge-tax-record-server.ts`, `lib/billing-tax.ts:121` `namedTaxLines` [H]) or run after that step.
- **`invoice.billing_reason` is read nowhere in the webhook [V: grep]** — yet `invoice.payment_succeeded` also fires on every renewal,
  proration and fee invoice, and it can arrive before or after the subscription event (the handler's own comment at `:847–850` says so).
  A first-purchase/renewal/move classifier has to be written; fee invoices (`FEE_INVOICE_META`) must never get a plan email.
- **Replay safety is a build-enforced rule.** Customer messages go through `customerSenders` so a replayed event stays silent (owner
  ruling 2026-11-08; a replay test guards it [H]). Resend remembers an idempotency key for **24 hours only**, so "once per invoice" needs
  a database stamp, not just a key.
- **A new email kind needs three things:** an entry in the kinds registry (`lib/email-kinds.ts`; class `account` is logged), a seeded
  template row (a migration — `sendTransactionalEmail` requires one) and the sender-guard test passing [H].
- **The daily job** is `app/api/platform-admin/stripe-fees-daily/route.ts` [V]: ~14 steps, each in its own try/catch
  (`run('name', () => fn(now))`). It **already has `terms_notices`, `ending_warnings` and `plan_ending_emails` steps [V]** — read them
  before Q8; the §9 warning-email question may be half-answered. The cleanest template for a once-per-period reminder is the free-time
  reminder (`lib/portal-free-time-reminders.ts` [H]): a stamp column keyed to the period, **claimed before sending, released if nothing
  went out**, owner only, demo addresses skipped. Exclude: monthly plans, plans set to end (`readPendingEndings`), Founding comps (no
  subscription), mock subscriptions (`mock_` ids).
- **Québec — ⚠ do not put it in the shared address check.** `checkBillingLocation` (`lib/billing-location.ts:280` [V]) is the one
  validator for the form, the save, and the stored-address re-check (`storedLocationStillValid`, `:317` [V]). **That re-check is also
  read by club fee invoicing (`lib/platform-stripe-fees.ts:505` [V])** and the tax decision. A Québec rule inside it would (a) contradict
  O4's "existing Québec accounts stay" (b) quietly stop fee invoicing for any Québec club (c) change what the "on file" screens show.
  The purchase gate that every paid door shares is `requireBillingLocation` (`lib/billing-location-server.ts:269–298` [H]; called by
  create-checkout, create-team-checkout, move + its preview, choose-next-season, and the payouts connect action) — **recommend the
  refusal lives at the purchase gate and the address form's message, not in the validator**, and that you confirm with a census test.
  Stripe's portal cannot edit the address (`lib/stripe-portal-settings.ts:27` [H]), so there is no side door. No Québec account is known.
- **The Terms link.** `legalPageHref('terms', version)` (`lib/legal-links.ts:17` [H]) builds the absolute link; a version page exists
  **only when the pages are published** — in the dev preview the version is the literal `'draft'` and with the pages off it is `null`
  [V from 6.3]. The accepted version is the person's latest `legal_acceptances` row. The email must handle all three states.

## Questions this session must settle (bring a recommendation for each; the owner rules)

1. **⚠ Dark or live?** The email and the reminder are useful before the Terms publish, and §6 line B and §8 lean on them — but they're
   also the first customer mail that names a Terms version. Recommend one of: (a) everything dark behind the legal-pages switch like
   6.2/6.3, shipping at 6.7; (b) the email and the reminder live at the next promote (they need no Terms link until published —
   omit the line while the pages are off), only the Québec refusal tied to 6.7. Argue from what production does today (taxed checkout
   is **not** on production yet; the plan's 6.7 prerequisites say so). Say what a production owner would notice either way.
2. **The completion point.** Which event is "the purchase"? Options: the invoice-paid event (real tax, covers trial $0 invoices? —
   check whether a trial's first invoice is $0 and arrives), the subscription event (plan is applied, no tax yet), or each path
   separately. Recommend one classifier and say what happens on: first paid purchase, trial start, upgrade by the move route, a
   downgrade (already mailed as `plan_downgrade_scheduled` — does it also need the details?), a re-subscription (`welcome_back`
   — must not send both), the coach Premium purchase, a next-season choice, a Founding comp (recommend: no email; nothing is bought).
3. **The Premium welcome.** Replace it, keep it and add the details, or fold the details into it? It has no idempotency key and
   ignores customised templates today. Recommend, and say what a coach sees on their first purchase.
4. **Who receives it, and the language of the tax line.** "The account owner" — one address or every owner of the organization?
   And `/accounting`'s open question **B**: Stripe may show a trial's after-trial tax only as an estimate — does the email say
   "estimated tax, based on your billing address today"? (The Terms draft's own note says the email shows figures from the invoice.)
5. **The reminder's mechanics.** The window (a daily job must catch "at least 30 days" without missing a day or sending twice —
   recommend a window and the stamp column), the amount (the plan's price, or Stripe's upcoming invoice with tax — which one is true
   when a tax rate or the address has changed?), and what a plan with a scheduled price change says.
6. **Québec at the gate.** Confirm the placement above, the plain line (a `/legal` word), what a Québec buyer sees at each door
   (onboarding plan step, billing upgrade, plan panel and drawer, move window, coach Premium, next-season choice), and **what
   happens to an existing Québec account's renewal and fee invoices (nothing).** The decision itself is logged (`BUSINESS_DECISIONS.md`
   2026-11-08) — don't reopen it; widen if the code says it can't be kept.
7. **Chunking.** Recommend the split (for example A — the kind, the template migration, the invoice classifier and the stamp, dark;
   B — the email at each completion path; C — the reminder step and the Québec gate) and where the fixtures ride.
8. **§9 warning emails.** Read the existing `ending_warnings` step first. Recommend: schedule the retention run, or change the Terms
   line to "we will try to warn you" now (the plan's recommendation). That's a `/legal` wording call either way.
9. **Words for `/legal` and figures for `/accounting`.** List every sentence that isn't already in the Terms draft; the email's tax
   lines, the business-number line and the trial wording go to `/accounting` **before hand-off**, per the repo rule that any change to
   what we charge, collect, invoice or report is reviewed first. Also list the price-rise note's owner.

## Rules that bind the build prompt
- **Figures come from the Stripe invoice** (cents, tax lines by name and rate); the email never recomputes tax. The same invoice must
  read the same on the email, the billing page and the books.
- **Replay-silent and once-only.** Through `customerSenders`; a database stamp per invoice (or per period for the reminder); a test
  that a replay sends nothing and a second event for the same invoice sends nothing.
- **Dark means invisible** wherever Q1 says dark: with the legal pages off, nothing renders, sends or refuses. The tests prove the off state.
- **Dates** only through `formatStoredDate`/`formatTime` (the webhook's `trial_will_end` arm uses `toLocaleDateString` — don't copy it).
  **One spelling** (`npm run check:spelling`). No personal name or home address anywhere (O1′).
- **Demos:** demo addresses never receive these emails, and a demo tour must not change with the switch on.
- **Dev mock paths** (`shouldApplyDirectly`, the mock subscriptions) must not send a real purchase email to a real address.
- `/legal` reviews words and what the email states about the Terms **before hand-off**; `/accounting` reviews the tax lines **before
  hand-off** (apply, or record as an owner question). `/docs`: the help line is written at 6.7. Offer `/simplify` then `/review`
  after the build. No release timing in the plan.
- Explicit pathspecs only, on `dev`; ask before committing — other sessions share this working copy. Schema: migration + data
  dictionary + `npm run refresh:snapshots` in the same unit of work.
- Census work (every place a plan is bought, changed or ended; every email send in the billing code) goes to an `Explore` helper:
  "return path:line and a verdict, leave the file dumps out". **Open every cited line yourself** — the helper's 2026-11-13 report is above.
- The walk is a checkable Artifact: one purpose, fixture teardown listed at the end. Stripe test-mode cards for Canadian buyers are
  in the plan's notes (e.g. 4000 0012 4000 0000).

## Hand-over
End with: the build prompt's path(s), the migration task list, the PM-brief update, the plan's §5 6.4 progress line, the TODO line, and a
short product-owner summary (what an owner receives and when, what a Québec buyer sees, what stays dark). Next after the build: the
6.4 walk, then **6.6** reviews. **6.5** (an organization's files are deleted with it) can run any time in parallel. Owner steps still
owed before 6.7 are listed in the plan's §3 RULED block (mailing address, phone, support/privacy addresses, the two Stripe dashboard
reads, approving the final text).
