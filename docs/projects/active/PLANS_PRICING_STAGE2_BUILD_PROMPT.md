# Plans & pricing · Stage 2: read-only views (kickoff prompt)

> Written 2026-11-06. Plan of record: [STRIPE_FROM_OUR_OWN_ADMIN_PLAN.md](STRIPE_FROM_OUR_OWN_ADMIN_PLAN.md) ("Stage list of record", item 2).
> Drawings already ruled: `STAGE10_PLANS_PRICING_STAFF_DRAWINGS.html` (published Artifact, tab 9 "One customer's billing", tab 10
> "Watching Stripe"; round 2 ruled as recommended 2026-10-31). Gaps and the §6 job list: `STAGE10_PLANS_PRICING_THIRD_PASS_GAPS.md`.
> Stage 0 record (what the foundation already does): `PLANS_PRICING_STAGE0_BUILD_PROMPT.md`.
> Mark each fact you rely on [V] (you verified it this session, with file:line) or [H] (handed to you, unverified). This prompt
> was written from plan and TODO text, NOT from the code: treat every claim about what exists as [H] until you open it.

## What this stage is, in one paragraph

Stage 0 made the money plumbing safe; Stage 1 made the catalogue hard to get wrong. Stage 2 lets the owner (and later the support
team) **see** billing without opening Stripe's dashboard, and changes nothing about anyone's money. Four pieces from the plan of
record: (A) one customer's billing record, built on our own copy of Stripe facts (drawings tab 9); (B) webhook health and the Stripe
settings panel (tab 10, includes the failed-payment outcome setting, S11); (C) reports: renewals this month, trials ending, failed
payments, revenue by month, Stripe fees (gaps doc §6 item 17); (D) replay one missed webhook event (§6 item 15).

## Read-only is the rule, with ONE named exception

A. B. and C. read; none may write to Stripe or move a customer's money. **D (replay) re-runs an event through our own handler, so
it writes to OUR data.** Treat it as the one write in this stage: reason required, logged in the change log (who, what, when, why),
idempotent (the Stage 0 event log and ordering guard must make a second replay harmless), super-admin/billing only, and it must
refuse an event from the wrong Stripe mode. If you cannot show that from the code, stop and say so before building D.
The failed-payment outcome setting (S11) is a stored choice, not a Stripe write; confirm that reading in the drawings before building it.

## Before any code (AGENCY_RULES, blocking)

1. **Verify what exists first** (delegate the broad read to a helper; open the cited lines yourself): does our own copy of Stripe
   facts exist as tables (subscriptions, invoices, payments, events) or does a screen still call Stripe live? What does the Stage 0
   webhook event log record? What does the daily comparison (Part 11, migrations 421-422) store, and where does it show? What does the
   billing page and the Money tab already show per customer? Report the gap between that and drawings tabs 9 and 10.
2. **Present the plan and a plain-language PM summary** (what staff see and do differently, role differences, benefits) and wait for
   the owner's go. Product-owner voice, no file names.
3. **Disagree out loud.** If the drawings, the plan or this prompt are wrong against what the code does, say so before building.
   Known soft spots to test: the plan says Stage 2 "waits on Stage 0", and Stage 0's owner checklist (O2-O6, O8-O13) is still
   open. The owner is treating that as paperwork because every Stage 0 code part is committed; confirm nothing in Stage 2 reads a
   Stripe setting the cleanup (O12) will change. Reports (C) were never drawn in detail: if tabs 9-10 don't cover them, say so and
   propose a small drawing session (a mockup Artifact through /design first, owner rules it) before building C.
4. **Re-run `ls supabase/migrations` before numbering anything.** A "local record of Stripe facts" may need a migration;
   if it does, write the table's meaning into `docs/agents/db/DATA_DICTIONARY.md` and refresh the dev+prod snapshots in the same unit
   of work, and apply to prod BEFORE the code (the pattern Stage 0 used).
5. Do not edit `.claude/settings*.json`, hooks, `package.json` scripts, database checks or anything in `WATCHED_PATHS`
   (`scripts/check-agent-automation.mjs`). A daily job or a new scheduled sync is watched automation: it needs the owner's explicit
   go in the current conversation and its own commit.
6. **Money screens are owner-visible and privacy-sensitive**: customers' names, emails and payment history. Run the `/legal`
   review before hand-off (what we show staff about people, who can see it, whether the change log records a staff view if the
   drawings say it should) and `/accounting` (what a report calls "revenue", whether tax is shown apart, currency).
7. Never touch live Stripe from a session. Test mode only, through our own code; the owner runs anything against live.

## Suggested parts (re-cut after step 1 if the code says otherwise)

- **Part 1 · Foundation check and gaps.** Whatever the verification in step 1 shows is missing for A-D (a facts table, a sync, an
  event lookup). Smallest thing that serves the screens; no screen yet.
- **Part 2 · One customer's billing (A).** The drawn record: plan and price actually paid, status, next charge, payment method, invoices
  and payments, the failed-payment story, free time/credit already on the account. Reached from the customer's page in platform admin.
  Every empty, failed-read and "Stripe not answering" state drawn in tab 9 must be built (Stage 0 fix 3: "none" is not "failed read").
- **Part 3 · Watching Stripe (B).** Webhook health (last event seen per endpoint, failures, events we ignored, wrong-mode refusals),
  the Stripe settings panel (our pinned portal settings vs what Stripe reports), the daily comparison's last result, the S11 setting.
- **Part 4 · Reports (C).** Renewals this month, trials ending, failed payments, revenue by month, Stripe fees. Owner-only first.
  Each figure says what it counts and its date range; a total that mixes test and live, or tax and price, is a defect.
- **Part 5 · Replay (D).** Pick an event, say why, replay; shows the before/after and what the handler did. Last, because it is the
  only write.
- **Part 6 · Closeout.** Walk (written as a checkable Artifact, one purpose), /simplify, /review, help article via /docs for any new
  staff screen, TODO line and Stage 2 progress block in the plan, ledger entry. The migration (if any) to prod before the code.

## Out of scope (stay out)

One-customer TOOLS (retry, mark paid, credit, merge) are Stage 3. Plan rename and price retirement are Stage 4. Branded invoices are
Stage 5. Do not add a button that changes a customer's money, even "while we're here". Do not touch the Stripe cleanup (O12/O13);
that is the owner's dashboard work.

## Owner rulings, 2026-11-06 (after the step 1 report; these OVERRIDE the paragraphs above where they differ)

1. **No local mirror of Stripe facts.** The Money tab keeps reading Stripe live. Storage is added only where a report cannot work
   live (the Stripe fees figure), and only if the owner asks for it at the reports drawing session.
2. **S11 is the read-only check the drawings show** ("After the last failed try, Stripe marks the plan unpaid. The product expects
   it to cancel. Change in Stripe ›"). It is NOT a stored choice. Nothing in this stage stores a failed-payment outcome.
3. **Replay re-runs a stored event through OUR handler** (re-fetched from Stripe by id: no payload is stored). Super admin only, a
   reason required, a change-log row, refuses the wrong Stripe mode, and must be proven harmless the second time before it is built.
   The drawings' "Send again" (ask Stripe to resend) is NOT what is built.
4. **Reports get a short drawing session first** (a mockup Artifact through /design; the owner rules it), then Part 4.
5. **Roles:** Watching Stripe opens for Super admin, Billing, Support, Product (read); only Super admin replays. A new area
   (`watching_stripe`) and power (`replay_events`) were added to the rulebook rather than reusing `find_stripe`.
   Drawing tab 9 is Stage 3's tools; the record view the owner is promised is the Money tab (+ drawing tab 6), extended.

## Progress (update as you go)

- [x] Step 1 verification report to the owner (2026-11-06)
- [x] Owner's go on the PM summary (2026-11-06, five rulings above)
- [x] Part 1 foundation, committed `21b4d6617` 2026-11-06: the webhook's handler moved out of the route file into `lib/billing-webhook-handler.ts` (a pure move,
      proven line-for-line; the route keeps the signature check and the receive call; ~20 guard tests now read the new file); rulebook
      entries `watching_stripe` + `replay_events` added. No menu entry or page yet (they land with Part 3).
- [x] Part 2 failed-payment story on the Money tab: owner go 2026-11-06 on the PM summary (no "of 4": Stripe reports tries made and the
      next try only; a "do not try again" decline says the try runs only on a new card; no next try = "no further try scheduled";
      a past date = "was due… Read again"; no separate Failed rows (one row per bill, the GST Stage 3 ruling); the drawn
      "Failed payment ›" door is Stage 3's, replaced by "See the bill"). Committed `9f5823655` 2026-11-06 (`/review` reworded the
      do-not-retry line to "runs only on a new card" and dropped a retry date already past on it), built from the tab's existing read (no new
      Stripe call, nothing stored): the notice above the agree line, the row's next-try line, the bill window's Tries line, the
      bank's decline code named in fixed words everywhere a failed charge is named. Tests `console-money-failed-payment.test.ts`.
      Owner walk §483 PASSED 22 of 22 steps 2026-11-07, no defect.
- [x] Part 3 Watching Stripe: owner go 2026-11-07 on the PM summary (recommendations taken as written): last morning result only, NO "Check now"
      (the morning job stays the only thing that writes a check); the failed-try outcome is a neutral "Cannot be read from here" row with a link
      to check it in Stripe, never a pass or a fail; two feeds (plan billing, family payments; the payout-accounts feed keeps no log);
      no club-payouts card, no "This month" card or export (Part 4); no "Send again" (Part 5); the sales-tax "?" row dropped (a decision,
      not a Stripe setting). BUILT and committed `514d3a2d0` 2026-11-07: a new Health › Stripe page (Super admin, Billing, Support, Product read; the
      eye for all but Super admin), no migration, no new Stripe write. The settings rows come from the SAME audit the scripts run
      (`scripts/lib/stripe-portal-audit.mjs`, imported, not copied). Tests `watching-stripe.test.ts`; two menu guards updated.
      Proven on dev with a signed-in probe (all three reading roles 200, Growth bounced to Today; a planted failed update showed in the
      row, tile, list and chip and was removed; the morning check aged and restored). Owner walk §484 PASSED 19 of 19 steps 2026-11-07. /simplify (one shared feed reader, the four top figures moved into the tested words module, one clock for the chip and the stale warning) and /review (a Stripe key fragment in a stored error is masked before it is shown; a missing count now reads as "could not read") done and applied; owner ruled Product may see the page (/legal question closed); platform-admin help entry owed (/docs). Local production build proved the audit import resolves. Open: the failed-try link `/settings/billing/automatic` is UNVERIFIED (walk step D3 asked the owner); a failing feed has no count on the menu or Today (Part 3 scope); "Still failing" and "Last update" show the readable feed alone when the other cannot be read.
      ⚠ Found on dev: the morning comparison reads "differs" on every run (11 clubs on 2026-11-07), mostly Coaches Portals whose
      billing cycle we hold as blank while Stripe says monthly. A report only; the check's logic and the daily job were not touched.
      **For Part 6:** `/legal`: staff with the Stripe power now see the bank's decline reason in fixed words ("not enough funds";
      "card reported lost/stolen" were already shown; `fraudulent`/`pickup_card` read as "declined by the bank"); viewing is NOT
      logged (the drawings do not ask for it). `/accounting`: nothing charged, recorded or invoiced changed; the notice says the
      amount owed and "It includes $X tax" only when the whole bill is owed.
- [ ] Part 4 reports: drawing session 2026-11-07, drawings https://claude.ai/artifact/PqUgoHqg57j1SGSo2YypjP
      (`PLANS_PRICING_STAGE2_PART4_REPORTS_DRAWINGS.html`, PM brief `PLANS_PRICING_STAGE2_PART4_REPORTS_PM_BRIEF.md`). Re-framed:
      Customers › Renewals (Coming up + Unpaid bills, from our own records, no Stripe call) + Bookkeeping › Reports › Sales;
      no "This month" card; Stripe's fees to us = a monthly Bookkeeping expense. Reviews: `/accounting`
      REVENUE_REPORT_DEFINITIONS.md, `/legal` STAFF_CROSS_CLUB_BILLING_LISTS.md. Findings F1 (Business numbers counts Founding
      clubs at list price) and F2 (Trials ending has no lower bound). **Owner ruled all ten asks as recommended 2026-11-07**
      (paste-back): two homes (Customers › Renewals for Super admin, Billing, Support; Bookkeeping › Reports › Sales, owner only);
      sales = invoiced by issue month less voids and credit notes, collected and written off apart, tax apart; Stripe's fees to us =
      a monthly Bookkeeping expense, nothing stored; fees billed back stay on Online payments; no "This month" card, Today's two
      rows open the lists; the accountant package gains sales.csv + credit-notes.csv (with Session D); F1 and F2 fixed in Part 4;
      unpaid bills from our own record. Build prompt: `PLANS_PRICING_STAGE2_PART4_BUILD_PROMPT.md` (two sessions; the Bookkeeping
      half's wait is over: GST/HST Stage 4b Session B committed `035f5e965` 2026-11-07).
      **Session 1 (4a–4c) BUILT 2026-11-07, committed `88365b082` 2026-11-07:** Customers › Renewals (Coming up + Unpaid bills, the export and its two
      registry entries, the `export_renewals` audit entry), Today's Past due and Trials ending rows open it for its readers, F2 (one
      `isTrialEnding` rule for Today, Business numbers and Clubs & portals) and F1 (comped clubs left out of the monthly figure, "· N
      comped clubs not counted"). No migration, no Stripe call. 35 tests (`renewals.test.ts`); five guards updated (menu ×2, audit
      reason, plan-reader door, portal tag, the free-time-portal churn rule). Signed-in probe on dev: Billing, Support 200; Product,
      Growth, Read only 307 / export 403. Built beyond the drawing (recorded in ledger §487): "Plan ends" for a waiting cancellation or a waiting move to the free plan,
      two extra What happens entries for the band figures, the Bill cell as the bill's kind, "A club no longer on file" / "Not matched
      to a club". Walk A §487 published https://claude.ai/artifact/4aJRpreh7LuKj2frekaHH5. `/simplify`, `/review` and `/docs` DONE
      2026-11-07 (help entry "How to read Renewals" in the platform-admin guide, with the /legal staff note). Review changed:
      the price tile reads "—" when no row has a price on file (was "$0.00"); a Plan pick the rows no longer offer reads as All
      plans; a waiting move to the free plan counts as "Plan ends"; F1 now needs a running comp AND no Stripe subscription (a
      Founding comp holder who then paid stays in the monthly figure); the Founding comp read pages past 1,000 rows; the
      unpaid export labels only a person's bill "Coach"; the download helper is one shared function for four export screens.
      Owner questions left open: see the review notes in the commit message.
      **Session 2 (4d Sales, 4e the package) BUILT 2026-11-08, committed `5fe7ad3c7` 2026-11-08:** Bookkeeping › Reports › View ·
      Sales (owner only; months newest first, Invoiced / Voided / Credit notes / Net sales / GST/HST / Collected / Written off with
      "recovered" beneath, the chips, "Before our record starts", "not yet valued in CAD", the line-101 sentence quoting the engine's
      own 101, the Business numbers callout, a month's window split by kind with every bill, "Sales CSV" totals only) and the
      accountant package's ONE invoice file `invoices-and-credit-notes.csv` (owner ruling 2026-11-08; one row per invoice with
      anything in the dates and one per credit note, sales and GST/HST figures, buyer = club name / "Coach" / "A club no longer on
      file", no address) with the new scope lines; two registry entries (Sales by month, totals only; the Accountant package,
      included_justified, which had no entry before). No migration, no Stripe call, nothing stored. Code: `lib/sales-by-month.ts`
      (pure rules), `lib/sales-by-month-read.ts`, `app/api/platform-admin/bookkeeping/sales/route.ts`, `ReportsSales.tsx`,
      `useReportRead.ts` (the dated views' shared read). **Built differently from the spec, said before building:** the return's
      loader gained rows `every_event` (also voided and every paid bill in the dates; the return's own read is unchanged and its
      engine ignores the extra rows, tested); a refund with no credit note needs the refunded figure, which a guard keeps out of the
      return's reader, so it has its own small read with Stage 3's rule (`notesPaidBackCents`); our record holds no refund date, so
      such a refund is listed on its bill's issue month; the invoice file lists a bill issued earlier when it was paid, voided or
      written off in the dates ("Listed for"). `/accounting` before hand-off (`REVENUE_REPORT_DEFINITIONS.md` "Build review
      2026-11-08", all applied): Recovered named apart; the no-note refund sentence says it still reduces income; the 101 sentence
      reworded ("voids, which line 101 does not take off", "credit notes, which line 101 does not take off (the return puts them on
      line 107)", the cents beside a rounded 101); GST/HST treatment and Written off (before tax) columns; the registration date used
      named in the scope; "Stripe's fees to us are included only as the monthly expenses entered from Stripe's statement".
      `/simplify`: the engine's note-valuation and recovery rules exported and used by the engine itself (figures unchanged, 96
      tests); one buyer rule and one rate label shared with the return's windows; one club-name read (the return's route uses it);
      the dated views share one period picker and one read; the Sales view reads sales only (not expenses and filings); the package
      starts its sales read beside the expense reads. `/review` (high, five lenses): a bill written off then voided came off twice
      (fixed: the void only); a deleted club read "Club" (fixed: "A club no longer on file"; the record's buyer name is Stripe's
      customer name, which can be a person, so it is not used); an aborted read could paint an empty answer (fixed in the shared
      read); scope lines for Status today and the record's start. Kept by design: the Sales CSV writes positive amounts with a "below
      zero" note (the worksheet CSV's convention); a rare negative amount in the invoice file opens as text (the shared
      spreadsheet-safety rule). **Owner question:** the package is refused whole when the sales cannot be read (recommended: keep);
      the walk asks it. `/docs`: platform-admin help "How to read Sales" and "How to enter Stripe's monthly fees as an expense" (new
      group Private finance). Proved on dev with the routes' own server reads (`.probe/sales-probe.mjs`): year to date reconciles
      to the cent with the return's own line 101. Not run: `check:layout --changed` (Bookkeeping is not on the layout screen list;
      the list was not edited). Walk B = Owner QA Ledger §493 (https://claude.ai/artifact/LJoTxy3w69bzXVLapi7Qrq). Known red, not
      this work: the export registry's founding-season entry (a moved file) and the twelve unit tests listed in the review notes.
- [ ] Part 5 replay · Part 6 closeout (Part 3 committed `514d3a2d0`, above)
- Known red tests NOT from this work: `workspace-flip-guard` and `support-console-stage4b-inforce-guard` (an untracked file from another
  session and a committed one the allowlists do not list), `support-console-stage3-guard` (a modified bookkeeping window file).
