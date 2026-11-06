# Fee invoice alerts — the owner finds out what they owe

Plan of record. PM brief: `FEE_INVOICE_ALERTS_PM_BRIEF.md`. Drawings (owner rulings, all eight asks A, 2026-11-05):
https://claude.ai/artifact/4dmPojUsg4EspaphPVxSEc, source `FEE_INVOICE_ALERTS_DRAWINGS.html`. Design record: `memory/design_decisions.md`
2026-11-05 "A FEE INVOICE THE CLUB OWES".

## Why

Raised by the owner reading a club's Plan & billing: the Stripe fees list shows "Pay the invoice" beside one $1.25 line, and asks whether
that list is the only way an owner learns they owe. Reading the code: it is nearly the only one. Three things are true today.

1. The invoice is never shown as a thing. The list is one row per fee; the invoice number repeats on every row; the pay link is shown once
   per invoice on its newest row (`StripeFeesList.tsx`, `payShown`). **No total, no tax.** Fees are taxed on top (`RECOVERED_FEE_TAX`,
   GST/HST Stage 2 Ask 3), so an Ontario invoice of three $1.25 fees is $4.24, not $3.75.
2. Overdue is computed (`own_overdue` in `readClubFees`) and then drawn identically to open (`billedWords`).
3. The only other signals are the invoice email and one reminder email after the due date. Nothing in the app outside that page. A failed
   plan payment (`past_due`) is also only a sentence on Plan & billing. Fee invoices never suspend an account (§7 ruling 3), so the in-app
   signal is the only lever the product has.

## What is ruled (drawings asks 1–8, all A)

1. Group the fees list by invoice: one invoice row (number, due date, Overdue chip with "Was due {day}", total, ONE lime "Pay invoice"
   button, new tab) and the fee lines under it, invoice number not repeated.
2. HST is its own line; the figure comes from the invoice. Unbilled fees: a quiet "Not on an invoice yet" group. Paid: a closed "Paid invoices" row.
3. Rail door "Plan & billing": the rail's count pill (invoices owed), amber open, **red** overdue. Phone: the same on "More" and on the row in the sheet.
4. Open, not yet due: pill + one callout line (amber edge) at the top of Plan & billing. Nothing on other pages.
5. Overdue: a banner on every club admin page, one line, red-edged, words + Pay button, no dismiss, scrolls with the page, ends when paid.
   On Plan & billing it replaces the separate line.
6. Owner only (`hasBillingAccess`).
7. Failed plan payment: amber pill; the red line keeps today's sentence (`W.plan.pastDue`) and gains a button (the shipped "Payment method &
   invoices" door). No banner elsewhere.
8. The pill's red tone is the one design-system extension.

Also done in this round (committed with this plan's first commit): **billing address tidy** — a street line or city typed entirely in lower
case or entirely in capitals is capitalised ("123 fake st" → "123 Fake St"); directions (NW) and unit letters (4B) stay capitals; mixed
case is never touched; the postal code keeps its own rule. `tidyAddressCase` in `lib/billing-location.ts`, applied inside
`checkBillingLocation` (so the one save path and the re-read of stored addresses both get it). Tests in `billing-location.test.ts` (107
pass across the four billing-location files).

## Open questions for the owner (found while planning, NOT in the drawings)

- **Q1 · Banner position.** The drawing put the banner full-width under the top bar, above the rail. The cheapest honest build puts it at
  the top of the content column, beside the rail, because the rail and every sticky toolbar read `--admin-topstrip-h` for their offset and a
  full-bleed banner above the rail would have to be counted into all of them (≈10 sticky consumers). Because ruling 5 says it scrolls away,
  the content-column version loses nothing the owner can see except the rail starting beside it, not under it. **Recommend: content column.**
- **Q2 · A cancelled club.** A cancelled club is still billed Stripe fees (ruling 2 of 12d-1) and its shell renders only the strip, with no
  rail and no pill. **Recommend: draw the banner in that shell too** (owner only), since that is the club least likely to open Plan & billing.
  Needs a short drawing check.
- **Q3 · Words.** The banner, the page line, the chip, the HST line label and the pill's spoken label go to `/marketing` before the build
  (new words, via `lib/plan-billing-words.ts`; amounts through `money()`; the source guard forbids literals with `$ <digit>`).

**Q1 and Q2 ruled 2026-11-05 (owner):** Q1 = the simpler build, the banner at the top of the content column beside the rail. Q2 = yes,
a cancelled club sees the banner too (owner only), drawn in the strip-only shell; needs a short drawing check before Part 4. Q3 (words)
is with `/marketing`.

## Build, in order (each part: Product Manager UX summary → build → verify → `/review`)

**Part 1 — the fees list, by invoice.** Server: `readClubFees` must stop dropping what it already selects. `INVOICE_COLUMNS` has
`amount_due` but `ClubFeeView` never copies it, and the table has no tax or total column. Decision: **persist at sync time** (extend
`writeInvoiceState` to store subtotal, total and the named tax lines from `namedTaxLines(inv.total_taxes, …)`; one migration, a jsonb
column, dictionary + snapshots refreshed) rather than a live Stripe call per page view; open rows written before the migration fill lazily
on first read. Route returns an `invoices[]` summary beside `fees` (never a total on each fee). Client: `StripeFeesList` groups by invoice.
Keep the route `allowSuspendedOrg` + behind `billing` (guard: `stripe-fees-owner-rulings`); platform admin's panel reads the same view.
Guards to update: `plan-billing-body` (fees render `''` until read, section order), `plan-billing-source-guard`.

**Part 2 — the signal's data and the pill.** `ClubBriefProvider` already fetches once per org and serves the rail, the bar and the hub, so
**no new fetch**: add an owner-only `feesOwed` (`{ count, overdue }`, from `platform_fee_invoices` where `status = 'open'`, right
`livemode`, cheap query, no Stripe call) to `/api/admin/club-brief`, present only where `hasBillingAccess`. `past_due` needs no fetch
(`useOrg().subscriptionStatus`). Counts are not supported on `kitBillingLink` today (no `count` field); add it WITHOUT changing the exact
`const billingLink = kitBillingLink({…})` call that `nav-standard-guard` pins. Render `WaitingCount` in the rail foot row, `dropCount` in the
More sheet row, add to `moreBadge`; the More tab's aria text says "unread", reword. Red variant: new tokens-only rules in
`AdminKitFrame.module.css` (`.count`) and `CoachesBottomNav.module.css` (`.tabCount`, `.dropCount`); check the token name in globals.css
(`--home-live` / `--danger`). Guards: `nav-standard-guard`, `admin-kit-nav`, `admin-kit-guard` (tokens only).

**Part 3 — the page line and the failed-payment button.** A `PageNotice`-area callout in `BillingBody` (the `waitCallout` recipe, amber
edge; red variant `.calloutDanger`); the failed-payment line gains its button. Words in `plan-billing-words.ts` (+ its test).

**Part 4 — the banner.** In `AdminChrome`, inside `<main>` above `AdminEventHeader` (Q1), owner-only, overdue-only, reads the brief's
`feesOwed.overdue`; on Plan & billing the banner stands in for the separate line. Phone: one row, 44 px button. Cancelled shell: per Q2.

**Part 5 — close.** `/docs` (help articles for Plan & billing and the coaches/club equivalents; the build-time spelling gate applies:
"installment", "fiscal year"), `/accounting` check of the HST line wording (display only, but it names a tax), `/review`, then an owner walk
as a checkable Artifact. Dev site only: the demo sandboxes follow the product (CLAUDE.md), nothing to do for them.

## Not in scope

No change to when invoices are issued, the one reminder email, or the "nothing switches off" rule. No dismiss on the banner. No second
approver. Coaches portal untouched (the coach portal has no fee invoices).

## Progress

- 2026-11-05 (Part 4 built, **uncommitted**; walk §468 published): **the overdue banner.** **Rulings this session (owner, all as recommended):**
  Q6 = the brief carries the one overdue invoice (number, total, due day, https pay link) so the banner names and pays it; Q5 = the fees read
  always includes every open invoice, however old its fees; Q4 = a cancelled club draws the same line (both tones) at the top of its own
  Plan & billing page, NOT a shell banner (so no drawing check and no widening of the cancelled-org brief opt-out; changes Q2's "in the
  shell"); slot = top of the content column above the page header, brief re-read when the tab returns. **Built:** `FeeOverdueBanner`
  (dynamic in `AdminChrome`, `{!suspended && …}`, own stylesheet, tokens only, `role="status"`, no dismiss, not sticky, one row on a phone with a
  44 px button); owner test = `billingLink != null`; `feesOwed` gained `earliestOverdue` and, when exactly one is overdue, `overdueInvoice`
  (still owner only, still one read, no Stripe call); `overdueBannerFor` and a shared `oneInvoiceLine` in `lib/fee-invoice-line.ts` so the
  banner and the page line say the same sentences (no new words, so no `/marketing` run); on Plan & billing the line is amber only
  (`feeLineFor(read, { overdue: false })`) unless the club is cancelled; the line now also opens the cancelled card and the failed free-time
  read (Part 3 review item 1); `readClubFeesAndInvoices` fetches every fee under the club's open invoices beyond the newest-50 window (and an
  open invoice is never "incomplete" because of the cap); scroll helper moved to `seeFeeInvoices.ts` so the banner never imports billing's CSS.
  **Verified:** typecheck clean; `fee-overdue-banner` (new), `fee-invoice-alert`, `fee-invoice-line` + nav-standard, admin-kit, org-billing-access,
  plan-billing-source and plan-billing-body guards pass (113 + 60); `check:spelling` clean; `check:layout` on admin-org-billing, admin-hub,
  admin-org-members, admin-club-more, admin-org-settings at 361/390/768/1440: nothing new on a screen the banner touches (the four new
  Settings @768 tap-floor findings are on a page the banner does not draw on; the treasurer screen could not run, its session is signed out).
  **`verify:changed` failures not from this part:** `plan-billing-usage` (free-time route), `support-console-stage3-guard` (ExpenseFormWindow),
  the Stage 6 owner-walk summary and N1 door tests, `series-date-groups`, the coach form grouped list, practice plans phone stage 4.
  **Not browsed:** the banner itself (it needs an overdue invoice made by hand, which is walk §468 Part A); a cancelled club's page with the line.
  **Known, left:** (a) with a failed brief read the banner is absent and the page's line is amber-only, so a red state would show on the
  pill's absence too (the door count and banner share the brief); (b) a banner + failed-payment red line + an amber line can stack on one
  page only with a second open invoice (not makeable by hand; pinned by tests only); (c) a failed first fees read still never retries
  (Part 3 item 2, hook not touched). **Owed:** the owner's walk §468, `/simplify` (new shared builder and component), `/review` (billing,
  high-risk tier), the commit (explicit pathspecs; `AdminChrome`/`BillingBody` hunks may sit beside other sessions' edits), Part 5.

- 2026-11-05 (Part 4 build prompt written): [FEE_INVOICE_ALERTS_PART4_BUILD_PROMPT.md](FEE_INVOICE_ALERTS_PART4_BUILD_PROMPT.md). **Not started;
  Step 0 is a short drawing check and three owner rulings first.** Found while reading the code: (Q4) a cancelled club can reach only Plan
  & billing, so the ruled "banner in the strip-only shell" sits above the page that already lists the invoice, and the brief is never
  fetched for a cancelled club (the club-brief route refuses it; widening that is a decision point in `org-billing-access-guard`) —
  recommend drawing the same line on the cancelled layout from the page's own read instead, with the shell banner as the alternative;
  (Q5) the fees read's 50-row window can hide an old open invoice the pill counts (Part 3's "Known, left (a)") — recommend the reader always
  includes every open invoice; (Q6) the brief's `feesOwed` is only `{count, overdue}`, which cannot fill the drawn banner (invoice number,
  amount, day, pay link) — recommend widening it with the one overdue invoice. The plan's "reads `feesOwed.overdue`" decides whether to
  draw, not what to say.

- 2026-11-05 (Part 3 `/simplify` + `/review`, high-risk tier, four lenses: security/tenant, refresh concurrency, line-vs-pill rule,
  regression; **Part 3 committed `ea94c4de3` 2026-11-05**): **no Critical or High; the owner-only gate holds** (the page is behind the owner check, the route resolves the org from the
  caller's own memberships and needs the billing capability, so a foreign slug is a 401; the hook never mounts for a non-owner). The pay
  link comes only from Stripe's address, https-checked on the server and again in the line, `rel` noopener. **`/simplify` applied:** the fee
  and invoice types are now the server's own (`ClubFeeView` / `ClubFeeInvoiceView`, type-only import) instead of a second copy; the owed
  rule no longer re-scans per invoice; the one-invoice branch reads `owed[0]`; `FeeLine` is no longer exported. **`/review` fixed:** the
  refresh compared only the owed COUNT, so an invoice that went overdue (or was swapped for a new one) while the count stayed put would not
  refresh the door's pill — it now compares which invoices are owed and in what state; two overlapping reads are ordered (only the newest
  answer is used); "See invoices" scrolls the fees heading clear of the club admin's fixed top strip. **Known, left:** (a) ⚠ the fees read
  covers only the newest 50 fee rows and builds invoices only from those (`readClubFeesAndInvoices`, unchanged here), while the pill reads
  the invoices table directly: an open invoice whose fees are all older than the newest 50 shows on the pill but not on the line or the
  list, and likewise an open invoice whose only in-window fees are returned/test/error rows; the same read also has no live/test-mode
  filter where the pill has one. A reader change, so it belongs with Part 4's shell or an owner call; (b) a failed first read leaves the page
  without a line until it is reloaded, and a persistent 401/5xx keeps the last owed line (by the "extra read, never a failed page" intent);
  (c) the line sits below a `PageNotice` when one is showing, not above it; (d) no-date legacy invoices sort first among open ones;
  (e) the line's alert-role tone (`status`) is polite while the failed-payment line is `alert`; (f) `fees[].payUrl` (per fee) is not
  https-checked server-side — no component links it. The 64ch cap stays on the shared `.waitCallout` (only the new line lifts it for
  itself), so the other wait callouts are unchanged. The rest of the cleanup suggestions (the shared
  callout shell, a shared scroll helper, the brief's `reload` through context, behavioural instead of source-text tests) were left as
  not worth widening this change.

- 2026-11-05 (Part 3 walk §466 PASSED, owner paste-back): all six parts A–F pass, 22 of 22 steps, no defect, no notes; the part E put-back and
  read-back passed. **Owed on Part 3:** `/simplify` (new shared module and hook), `/review`, the commit. Parts 4–5 next.

- 2026-11-05 (Part 3 built and probed on dev; walk §466 published): **the page line and the failed-payment button.** **Rulings this session:**
  overdue gets the red line NOW, in both tones (the banner in Part 4 later stands in for it on this page); words accepted as proposed by
  `/marketing` (the overdue detail is a full sentence, "$X was due Dec 1."; two or more say the count and the earliest day with a plain
  **See invoices** button that scrolls to the list; one overdue plus other open invoices names the overdue one with its own Pay invoice).
  **Decision (a):** the line reads the SAME `invoices[]` the list reads: the page now fetches the fees ONCE (`useStripeFeesRead`) and hands the
  read to the list and the line; the owed-first rule moved to `lib/fee-invoice-line.ts`, which the list and the line share, so they cannot
  disagree on the count. The figure on the line is the invoice's own total (nothing added up in the browser). Added one string the helper did
  not propose: `alertOpenNoDay` ("Invoice X for Stripe fees is open.") for a legacy invoice with no due date. **Built:** the line
  (`FeeInvoiceLine`, the `waitCallout` recipe, amber, `calloutDanger` red, Pay invoice lime to Stripe in a new tab, https only; 44 px full-width
  on a phone); the failed-payment callout keeps `W.plan.pastDue` word for word and gains the plan card's own Payment method & invoices action
  (`a.portal`, same busy and disabled states, no second door); on return to the tab, while something is owed, the fee read repeats and, if
  what is owed changed, calls the brief's `reload()` (the club admin passes it in; the coaches portal passes nothing), so the pill, the line and
  the list agree with no reload. **Proven on dev** (signed-in probe): amber line with the real figures; red-edged failed-payment line + button;
  after the invoice was marked paid and the tab came back, one fee read and one pill read ran and the line, the door's count and the open entry
  cleared; put back, read back open / due 2026-12-01 / plan active. `check:layout` clean (admin-org-billing 361 + 1440, coach-billing 361).
  Tests: `tests/unit/fee-invoice-line.test.ts` (new, 24); the Stripe-fees tests and the billing actions harness updated for the shared read.
  **Known, left:** (a) a CANCELLED club's owner sees the list but not the line (the cancelled layout is Part 4's shell); (b) a payment whose
  webhook lands after the owner returns shows on the next return or reload (one re-read per return); (c) the coaches portal's line is absent
  because its fee read is empty (tested, and the cancelled portal checked in a browser; an ACTIVE portal was not browsed);
  (d) the dev walk's two-invoice plural forms are pinned by tests only. **Owed:** the owner's walk §466, `/review`, dev server restart after the
  new files, and `/simplify` (a new shared module and hook).

- 2026-11-05 (Part 2 `/review`, high-risk tier, three lenses: security/tenant, correctness, regression): **no Critical or High; the owner-only
  gate holds** (non-owner, no-billing-capability and other-org cases all get the field ABSENT). Fixed: a comment overstating the route's gate;
  edge-case tests added (due exactly now; unreadable date). **Known, left, for Parts 3–4 or an owner call:** (a) ⚠ **a CANCELLED club's owner
  sees no pill** (the route refuses a cancelled org and the provider skips it, yet fee invoices exist for cancelled clubs) — this is Part 4's
  cancelled-club shell; that part must also carry the figure (the route would need the suspended-org opt-out, a decision point in
  `org-billing-access-guard`, or the figure moves to an already-exempt billing route); (b) the pill goes stale after paying until the owner
  reloads or revisits the hub, and a tournament-only owner never lands on the hub, so for them only a reload refreshes it — Part 3's page line
  should call the brief's `reload()` on a payment; (c) **RULED by the owner after the review: while a fee signal exists, More's pill shows ONLY the invoice count** (unread chat and
  notifications no longer inflate it; the label still speaks them and the sheet still lists them) — built in the follow-up change;
  the cancelled-club gap in (a) is confirmed as Part 4's; (d) a span's `aria-label` inside a link is not announced
  by most screen readers (same pattern as the existing rail and notification counts); (e) the sandbox owner receives the figure from the
  route but never sees it.
- 2026-11-05 (Part 2 built, **uncommitted**): the signal's data and the pill. **Owner rulings this session:** (1) tournament-only workspaces'
  owners are read too (the brief fetch stays on for them, owner only); (2) only `open` is owed (`uncollectible` drops out; the rest of the
  product counts open + uncollectible, so the pill and the online-payment endings can differ by that one state); (3) pill words accepted
  as proposed, with the curly apostrophe (`Plan payment didn’t go through`). **Built:** `lib/fee-invoice-alert.ts` (pure: `FeesOwed`,
  `feesOwedFrom`, `feeAlertFor`, `canSeeFeesOwed`, `FEE_ALERT_WORDS`; `PLAN_BILLING_WORDS.feeAlert` is the same object, kept in the tiny file
  so the rail does not pull the whole words module); `lib/fee-invoices-owed.ts` (one read: own `org_id`, this key's `livemode`, `open`, no
  Stripe); `feesOwed` on `/api/admin/club-brief` (owner only, ABSENT otherwise and when the read fails); `useFeeAlert` (null unless
  `billingLink != null`; `past_due` read from the org, no fetch); rail foot pill (`WaitingCount` gained a `tone`); phone: More's pill carries the
  fee count, More's spoken label is built as "More, N unread, <fee words>" (no invoice is ever "unread"), the sheet's billing row wears the
  pill. Red = the rail's tint recipe with `--danger-rgb`/`--danger-text` (`.countRed`; `.feeAmber`/`.feeRed` in the bottom nav's shared sheet):
  **no new token, so Ask 8's one extension is still unspent.** Red's number is the OVERDUE invoices (figure, colour and words agree); a
  failed plan payment adds 1 and its own phrase. `kitBillingLink` and its call are untouched (nav-standard-guard). Tests:
  `tests/unit/fee-invoice-alert.test.ts` (new) + the nav/kit/billing/contrast guards pass; typecheck clean. **Known, left:** (a) the brief
  re-reads only on arrival at the hub, so after paying, the pill clears on the next hub visit or reload; (b) `npm test` shows 7 failures in
  other areas (practice-plans phone guard, plan-billing-usage, public-tournament stage 6 walk ×3, series-date-groups, support-console
  stage 3) and `check-admin-old-look` / `check-admin-type` / `check-css-selectors` fail on other sessions' files; none touch these files;
  (c) **owed:** dev server restart (the auto-mode classifier refused the stop; new files + route field), `check:layout --changed` at 361 and
  1440 on the rail/bottom nav, the owner's walk. No help article, banner or page line (Parts 3–5).
- 2026-11-05 (later): **Part 1 BUILT, not yet applied or walked.** Migration `444_fee_invoice_total_and_tax.sql` written (adds `total` and
  `tax_lines`) but **NOT applied to dev: the auto-mode classifier refused the apply as a shared-resource change, so the owner applies it**
  (`node scripts/apply-migration-api.mjs supabase/migrations/444_fee_invoice_total_and_tax.sql`, then `npm run refresh:snapshots`).
  ⚠ **Until it is applied, every read of `platform_fee_invoices` on dev fails** (the column list now names the two columns): the Plan &
  billing fees section stays absent (fail-soft) and the invoice sync/email/reminder jobs on a locally running server error. Dictionary
  written (snapshots follow the apply). Code: `writeInvoiceState` stores Stripe's total + named tax lines; `readClubFeesAndInvoices`
  returns `invoices[]` beside `fees` (`readClubFees` kept for platform admin); the route returns `invoices`; `StripeFeesList` groups by
  invoice. Words added to `STRIPE_FEE_WORDS`; `payInvoice` is now "Pay invoice" (the email keeps "Pay the invoice"); help line for the
  fees list updated. Typecheck clean; 215 tests pass across the billing/fee guards. Prod: migration 444 owed before the code promotes.
  No unit test yet for the grouping itself (needs a fetch-mocked render); queue for `/review`.
- 2026-11-05 (after the owner's yes): **migration 444 applied to dev**; snapshots refreshed by the hook; `check:dictionary` passes;
  the dev-vs-prod drift lists exactly 444's three objects (`total`, `tax_lines`, `platform_fee_invoices_tax_lines_chk`) as missing on
  prod, as expected. **Prod apply owed before this code promotes.** Dev server restart owed before a browser look.
- 2026-11-05 (review): **Part 1 `/review` (high-risk tier, four lenses) done.** Fixed in the follow-up commit: the address tidy no longer
  lower-cases a small word right after the house number (45 The Esplanade), keeps French ordinals (5e avenue) and PO/RR/PH/c/o and
  directions with punctuation (NW,); the invoice read is scoped to the club's own org; the Pay link goes out only as an https address;
  the "Tax" fallback line is drawn only when every fee on the invoice is in hand (read cap, returned fee), else none; an invoice with no
  day draws no sub line; dictionary wording corrected (no backfill for paid/void rows; amount_due claim softened). **Known, left as
  is:** (a) ⚠ **migration 444 must be on prod BEFORE this code promotes** — the shared invoice column list now names `total` and
  `tax_lines`, so code first would fail the monthly fee-invoice run, its emails and reminders, and the paid/open status writes (they
  heal after the migration; nothing is double-billed); (b) a returned (credit-note) fee shows as its own plain row, not as a negative
  line under its invoice, and the invoice total is Stripe's — whether that equals the Stripe page's amount owed after a credit note is
  unconfirmed (check in test mode before the walk); (c) the fee read is capped at the newest 50 rows, so a club with more than 50
  fees may see lines that don't add up to the total; (d) test-mode vs live rows are not separated on this read (never was; every writer
  is pinned to the live key). No unit test yet for the grouping render itself.
- 2026-11-05: **Part 3 build prompt written:** [FEE_INVOICE_ALERTS_PART3_BUILD_PROMPT.md](FEE_INVOICE_ALERTS_PART3_BUILD_PROMPT.md).
  Part 2 walk §465 passed 22/22. It raises one owner question before the build (overdue on Plan & billing until Part 4's banner exists).
- 2026-11-05: **Part 2 build prompt written:** [FEE_INVOICE_ALERTS_PART2_BUILD_PROMPT.md](FEE_INVOICE_ALERTS_PART2_BUILD_PROMPT.md).
  It notes `--danger-fill` already exists, so the red pill may need no new token (check contrast first).
- Wording (marketing helper, 2026-11-05): proposals returned for the banner, page line, chips, pill spoken labels and plurals; Part 1's
  strings are in. Parts 2–4's strings are proposals pending the owner's nod (see the summary in the conversation): plural forms are
  needed because two open fee invoices can exist.

- 2026-11-05: drawings ruled (asks 1–8 all A). Design record written. **Address tidy built + tested** (uncommitted). Data path mapped and
  spot-checked against the code (fee view drops `amount_due`; no tax column; rail billing row has no count; brief route carries counts).
  Parts 1–5 not started; Q1–Q3 owed.
