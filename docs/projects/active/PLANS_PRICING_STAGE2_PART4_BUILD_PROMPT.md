# Plans & pricing · Stage 2 · Part 4: owner reports (build prompt)

> Written 2026-11-07, after the owner ruled the drawings (all ten asks as recommended, by paste-back).
> Drawings of record: https://claude.ai/artifact/PqUgoHqg57j1SGSo2YypjP (`PLANS_PRICING_STAGE2_PART4_REPORTS_DRAWINGS.html`);
> PM brief `PLANS_PRICING_STAGE2_PART4_REPORTS_PM_BRIEF.md`; stage prompt `PLANS_PRICING_STAGE2_BUILD_PROMPT.md` (Progress block, and
> the "Owner rulings, 2026-11-06" that still bind: no local mirror of Stripe facts, read only, no button that changes money).
> Reviews of record: `/accounting` `docs/agents/accounting/REVENUE_REPORT_DEFINITIONS.md`; `/legal`
> `docs/agents/legal/STAFF_CROSS_CLUB_BILLING_LISTS.md`.
> Mark each fact you rely on [V] (verified this session, file:line) or [H] (handed to you). Everything below about the code is [V]
> as of 2026-11-07 by the drawing session, but **other sessions are editing Bookkeeping right now**: re-open every cited line first.

## The rulings (2026-11-07, owner, paste-back; all as recommended)

1. **Two homes.** Customers › **Renewals** (two views: Coming up, Unpaid bills) + Bookkeeping › Reports › **Sales**. No "Reports" page.
2. **Renewals readers:** Super admin, Billing, Support (Online payments' readers). A new area in the rulebook, not a reuse.
3. **Sales counts** what was invoiced by issue month, less voids and credit notes; collected and written off in their own columns;
   tax apart (`REVENUE_REPORT_DEFINITIONS.md`).
4. **Stripe's fees to us:** no storage, no report. The owner enters one Bookkeeping expense a month from Stripe's statement and tax
   invoice. Nothing is built for it; the help article says how (processing fees carry no GST/HST; Billing and Tax fees do).
5. **Fees billed back to clubs** stay on Health › Online payments; on Sales they are the "fees" kind in a month's window.
6. **No "This month" card.** Today's Past due and Trials ending rows open the dated lists.
7. **Export for the accountant** = the Bookkeeping accountant package gains `sales.csv` and `credit-notes.csv` (with GST/HST Stage 4b
   Session D: ONE file per thing, written once).
8. **F1 fixed in Part 4:** Business numbers leaves comped clubs out of the monthly figure and says how many it left out.
9. **F2 fixed in Part 4:** Trials ending counts today to 14 days ahead; a trial whose date has passed shows on Renewals as
   "Trial ended, still marked trial" (amber) and is not counted in Trials ending.
10. **Unpaid bills from our own invoice record;** the bank's reason and the next try stay on the club's Money tab.

## Do not

Store a copy of any Stripe fact. Call Stripe from Renewals or Sales (both read only our own tables). Add a button that changes
anything. Show a person's name, email, billing address, card detail or decline reason on Renewals or in its exports. Put a billing
address or postal code in `sales.csv`. Add a total that adds price and tax, test and live, or two currencies. Touch
`.claude/settings*.json`, hooks, `package.json` scripts or anything in `WATCHED_PATHS`. Start Part 5 (replay). Touch live Stripe.
`git add -A` / `git add .`. Commit without the owner's yes.

## Session 1 · the console side (Parts 4a, 4b, 4c)

### 4a · The rules, in one pure module, with tests (no screen)

- **Area:** add `renewals` to the `PlatformArea` union and the `PLATFORM_AREAS` table in `lib/platform-areas.ts` with
  `viewRoles: PLATFORM_POWERS.find_stripe, powers: []` (the `online_payments` shape, `:84` region [V]). No power: nothing writes, so
  no role sees the eye (`isPlatformAreaReadOnly`, `:242-248` [V]).
- **Menu:** `app/platform-admin/console-menu.ts`, Customers group, after Free time, label "Renewals",
  `/platform-admin/renewals`. Update the menu guards the same way Part 3 did for Health › Stripe (grep `tests/` for
  `watching-stripe` to find them).
- **Pure module** `lib/renewals.ts` (words + rules, no I/O), tested in `tests/unit/renewals.test.ts`:
  - Coming up rows: kind ∈ Renews / Trial ends / Free time ends / Founding Season ends / Trial ended, still marked trial; date;
    club or portal name (a Coaches Portal shows the TEAM's name, never its owner); plan label; price cell.
  - Price cell: the stored price on file (`organizations.subscription_amount_cents` + `subscription_currency`, migration 418,
    dictionary `DATA_DICTIONARY.md:104-106` [V]): before tax, no discount. "a month" / "a year" ONLY from
    `subscription_period`; null → the chip "cycle not on file". Null amount → the chip "no price on file" (never the list price).
    Free time / Founding → "no subscription".
  - Band: Renewals (count), Trials ending (count), Free time ending (count, free time + Founding), Price on file before tax (sum
    per currency, never across currencies; "N have no price on file"), Still marked trial (count). A figure that could not be read
    is "—", never 0.
  - Unpaid rows from `platform_charge_tax_records` (migration 451, `:42-108` [V]): `status IN ('open','uncollectible')`,
    `livemode` = the site's mode (`lib/stripe-mode.ts`; the GST read does the same, `lib/gst-return-worksheet-read.ts:49,63,79` [V]).
    Show: Unpaid (open) default, Written off (uncollectible), All. Columns Issued · Club or portal · Bill (plan label + invoice
    number) · Before tax · Tax · Total · Club's plan · door. A club `past_due` with no open record = its own row, chip "No bill
    in our record", door to the Money tab.
  - "Past due since": the newest `subscription_past_due` platform event's `created_at` for that club
    (`lib/billing-webhook-handler.ts:902-912` [V]; the same reading as `lib/online-payment-endings.ts:254-257` [V]); none →
    "Past due, date not recorded". A bill whose club is cancelled reads "Plan ended {date}".
  - Band: Unpaid bills (count + clubs), Owed before tax, Tax on them, Past due with no bill here, Written off this year (before tax).
  - Exclude sandbox orgs and free-time Coaches Portals exactly as `lib/platform-metrics.ts:206-212` does [V] (reuse, don't copy).
  - Words: "could not read" is the shipped sentence (`lib/watching-stripe-words.ts:76` [V]); never "lost revenue", "failed revenue"
    or "churn" on this page (the unpaid-bill rule, `UNPAID_SUBSCRIPTION_INVOICES.md`).
- **F2, the one rule for "trial ending":** a single exported predicate (today ≤ `current_period_end` ≤ today + 14 days, Ontario
  days) used by `lib/platform-metrics.ts:263` [V] (currently no lower bound), the Clubs & portals `trial_ending` filter
  (`app/platform-admin/orgs/page.tsx:189` [V]) and Renewals. A passed date → Renewals' amber row only.
  ⚠ The handover said Founding clubs sit in `trialing`: they do NOT. They are `active`, no subscription,
  `current_period_end = FOUNDING_SEASON_END` (`app/api/billing/create-checkout/route.ts:290-307` [V]) with a `comp_period`
  override (`lib/founding-season.ts:108` [V]). Read Founding endings from the override, not from the trial rule.

### 4b · The page, the export, Today's doors

- **Page** `app/platform-admin/renewals/` (server page + client view + module CSS on the console kit `console.module.css`; tokens
  only, D1–D5). Guard `requirePlatformAreaView('renewals')`. Title "Renewals", the mode chip, the caption, the shipped
  `ViewSwitch` (two views), the toolbar (Dates or Show dropdown first, narrows square, Export at the far right), one joined band
  (tiles that filter are `button.bandCell`), one table per view. Forward dates for Coming up: This month (from today), Next
  month, Next 14 days, Next 30 days, Custom dates. Every chip in the drawing is a chip on the page.
- **Export:** `app/api/platform-admin/renewals/export/route.ts?view=coming_up|unpaid&format=xlsx|csv`, modelled on
  `app/api/platform-admin/early-access/export/route.ts` [V]: area check, audit entry written BEFORE the file (nothing sent if it
  fails), `formulaSafeRow` on every row, CAD beside the original currency (`lib/bookkeeping-export.ts:62` [V] shape), the page's
  filters. Menu: `components/admin/ExportMenu` (Excel first, CSV).
- **Registry** (`lib/export/catalog.ts`, `check:export-catalog`): two entries, `sensitiveFieldPolicy: 'included_justified'`, the
  justification as `/legal` wrote it (`STAFF_CROSS_CLUB_BILLING_LISTS.md` Recommendation 1). The GST detail entry
  (`catalog.ts:353-367` [V]) is the model.
- **Today:** `lib/platform-waiting.ts` Past due row (`:73-76` [V]) opens `/platform-admin/renewals?view=unpaid`; Trials ending
  (`:80` [V]) opens `?view=coming_up&what=trial_ends`, for a role that can read Renewals. For a role that cannot, the door stays
  on Clubs & portals. The counts and their rules do not change except F2.
- **Viewing is not logged** (lists never are); a row's door opens the club record, which `lib/platform-record-opens.ts` logs [V].

### 4c · F1, Business numbers

- `lib/platform-metrics.ts:259-261` [V] adds the list price for every `active` org, including Founding comps (no subscription).
  Count only paying clubs. Candidate rule to verify first: active AND a Stripe subscription on file; confirm a Coaches Portal paid
  through a club add-on is not wrongly dropped (its subscription lives on another record) before choosing it.
- Business numbers (`app/platform-admin/business-numbers/page.tsx:87-88` [V]) and Today (`app/platform-admin/page.tsx:152` [V])
  keep their words and add "N comped clubs not counted" when N > 0. Test it beside the existing metrics tests.

## Session 2 · the Bookkeeping side (Parts 4d, 4e), AFTER GST/HST Stage 4b Session B is committed

Session B committed `035f5e965` 2026-11-07 (the return view in Reports, its windows and the phone half), so this session is
unblocked. Part 4d edits the same files (`ReportsGstReturn.tsx`, `GstReturnWindows.tsx`, `lib/bookkeeping-navigation.ts`,
`BookkeepingClient.tsx`, `lib/export/catalog.ts`, `lib/gst-return-worksheet-read.ts`): re-open them at their committed state
first, and check `git status` that no other session holds them modified.

### 4d · Sales by month

- `lib/bookkeeping-navigation.ts:13-16` [V]: `REPORT_VIEWS` gains `'sales'`, label "Sales"; `BookkeepingClient.tsx` registry
  (`:183-203` [V]) gains the view. Owner gate unchanged (`lib/bookkeeping-access.ts:5-11` [V]).
- Pure `lib/sales-by-month.ts` + `tests/unit/sales-by-month.test.ts`. Read the rows through the SAME loader the GST/HST return uses
  (`readGstReturnWorksheet` / its sales and notes loaders, `lib/gst-return-worksheet-read.ts:137` [V]); do not write a second query.
  Per Ontario month: Invoiced (before tax, by `issued_at`), Voided (by `voided_at`, its month), Credit notes (by the note's
  `issued_at`; a voided note excluded), Net sales, GST/HST on net sales, Collected (paid totals by `paid_at`, with tax, labelled),
  Written off (by `uncollectible_at`, before tax, outside net sales). A refund with no credit note: listed in the month's window,
  never netted silently. CAD from the record's `cad_*` columns (Bank of Canada, `fx_source`, `451:84-90` [V]); a non-CAD sale with
  no CAD value is "not yet valued in CAD", out of the CAD totals with a count. Months before the registration date (Bookkeeping's
  stored setting, Stage 4a) carry the "before registration" chip; a month split by it says "part before registration".
  Months before 2026-05-01: "Before our record starts".
- The month window: split by kind (`subscription` = plans, `premium` = Coach Premium, `fee`, `one_off`; `451:46` [V]) and its bills.
- The reconciling sentence: line 101 for the same dates = net sales + bare voids + credit notes − sales before registration, from
  the engine's own 101 (never recomputed by hand); test that the identity holds.
- The Business numbers callout, worded as drawn. The mode chip (Live sales / Test sales).
- Export: "Sales CSV" plain button (the page's convention, `ReportsGstReturn.tsx:107-110` [V]); registry entry, CSV, owner only,
  no sensitive fields (totals only).

### 4e · The accountant package

- `app/api/platform-admin/bookkeeping/package/route.ts` [V] gains `sales.csv` (one row per bill: issued, kind, buyer = club name
  or "Coach", invoice number, province taxed, before tax, tax, total, status, currency, CAD, Bank of Canada rate; **no address or
  postal code**) and `credit-notes.csv` (one row per note, its bill, its month). The package's period applies.
- `package-scope.txt` (`:61` [V]) becomes: "Stripe's fees to us, payouts and bank reconciliation are not in this package; sales and
  credit notes are."
- **Session D coordination:** the GST/HST Stage 4b build prompt (`GST_HST_STAGE4B_BUILD_PROMPT.md:87` [V]) plans
  `gst-hst-sales.csv` "each invoice and credit note" for this package. Whichever session lands first writes the files; the other
  reuses them. Read that prompt's current text before writing; if Session D has shipped, add nothing that repeats it.
- Registry: the package's entry gains the two files' justification (names the buying club; an individual is "Coach").

## Tests and checks

`tests/unit/renewals.test.ts`, `tests/unit/sales-by-month.test.ts`, the metrics tests (F1, F2), the menu guards, `check:export-catalog`,
`npm run verify:changed`; `npm run typecheck` (shared modules: platform-areas, platform-metrics). No migration (none is needed: every
column exists [V]); if one appears necessary, stop and ask.

## Walks (checkable Artifacts, one purpose each, written at the end of each session)

- **Walk A · Renewals** (Session 1): menu entry per role (Super admin, Billing, Support see it; Product, Growth, Read only do not),
  each Coming up kind and price-cell state, the F2 amber row, Unpaid bills from a planted open test-mode record, "No bill in our
  record", the export opens in Excel, Today's two doors, Business numbers' "N comped clubs not counted".
- **Walk B · Sales and the package** (Session 2): a month's figures traced to its bills, the reconciling sentence against the
  GST/HST return for the same dates, a void and a credit note in their own months, the package's two new files and scope line.

## Hand-off (Part 6 of the stage)

`/simplify` then `/review`; `/docs` for a platform-admin help entry (Renewals; Sales; how to enter Stripe's monthly fees as an
expense); `/legal`'s two privacy-policy owner items stay in the draft (§5 "club or person record", §6 the accountant row); the
Progress block of the stage prompt; the Owner QA Ledger entries for the walks; TODO line.
