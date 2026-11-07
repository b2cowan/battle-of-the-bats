# GST/HST · Stage 4: the books carry the sales side of GST/HST (DRAWING prompt first, build prompt after)

> **EXECUTED + RULED 2026-11-06 (every ask A; facts: registered Sept 26, 2026, CRA backdate to May 1 pending → a changeable
> setting; annual; no quick method). 4a build prompt: `GST_HST_STAGE4A_BUILD_PROMPT.md`. 4b's prompt waits on Stage 3 Part 0.** Drawings: https://claude.ai/artifact/LbCjjVcnZeTP8uUT3yVZan
> (source `GST_HST_STAGE4_DRAWINGS.html`, round 2 with `/design` + `/ux` applied). Return-line note written first:
> `docs/agents/accounting/GST_HST_RETURN_LINES.md`. It corrected this prompt: credit notes go on line 107 (not a 103
> reduction), recovered bad debts on 104, ITC ≠ tax × business-use % (90/10 for operating, 50% cliff for capital, meals
> 50%), simplified-registrant tax is never claimable (no GST189 path), and USD revenue → Bank of Canada on the invoice
> date (the recommendation below to use Stripe's CAD figure is reversed). Disagreed with this prompt: the worksheet as a
> Reports VIEW, not its own tab (Ask 7). New asks found: Ask 11 (Stage 3 must copy invoices since registration or they
> appear on no worksheet), Ask 12 (mark a period as filed). Next: owner paste-back → update the Bookkeeping ladder +
> plan Stage 4 → write the 4a build prompt (and 4b after Stage 3 Part 0).

> Written 2026-11-06. Plan of record: [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §4 "Stage 4"; the owner Bookkeeping's plan
> [BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md](BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md) (its six-stage ladder, §3; its R3/R4 rulings).
> **This is a drawing-and-ruling session, not a build session.** Your own R3 ruling (2026-10-27) says the tax-capture form is "designed in its
> own drawn-and-ruled owner mockup session". The output is a published drawing, rulings, and a BUILD prompt written afterwards.
> Recommended model: Opus. Run `/design` and `/ux` before the hand-off. Mockups are Claude Artifacts, true size, whole-screen before/after.
> Mark facts [V] (opened this session) or [H] (handed over). Facts below were gathered 2026-11-06 and are [H] unless marked.

## Why this is a drawing session, and the order problem

**Disagree out loud #1: Stage 4 is two different jobs wearing one name, and they have different dependencies.**
- **4a, purchase side (what we PAY):** tax split by type, the supplier's GST/HST number, a "foreign supplier charged tax" flag, a period total
  of tax paid by type. Needs only Bookkeeping Stage 1's expense form [H]. Has money on it now (input tax credits are claimable). Not drawn.
- **4b, sales side (what we COLLECT) + the return worksheet:** tax collected by province and type, zero-rated US sales, a worksheet for any
  period (sales, tax collected, credits, net owed, every figure traceable to its charges). **Needs GST/HST Stage 3's charge tax record**, which
  does not exist yet [H]: there is no income or revenue code anywhere in the owner Bookkeeping. Drawing 4b before Stage 3 settles its fields is
  drawing against a guess. **Recommend: draw 4a and 4b in ONE session (so the worksheet and the capture form agree), but BUILD 4a now and 4b
  after Stage 3.**

**Disagree out loud #2: the Bookkeeping ladder has no row for the sales side or the worksheet** [H]. Its Stage 4 row covers purchase capture only;
its Stage 6 (Stripe income) is parked behind an unaccepted Stripe-CSV contract (decision D02) [H]. Add the rows to the ladder in the same
unit of work as the drawing, or the sales side belongs to nobody.

**Disagree out loud #3: do not feed the worksheet from a Stripe CSV import.** The parked Bookkeeping Stage 6 imports a CSV; GST/HST Stage 3 will
store the charge tax record in our own database. Two sources of the same tax figures will disagree (`UNPAID_SUBSCRIPTION_INVOICES.md` also warns
against copying Stripe Tax's own summary onto a return). **Recommend the worksheet reads Stage 3's table, and Bookkeeping Stage 6 keeps only
what Stage 3 can't give it (fees, payouts, bank matching).** Put this to the owner as a ruling.

## Facts the drawing must respect [H]

- The owner Bookkeeping's store is **Aurora DSQL (AWS), not Supabase**: append-only revisions, app role SELECT + INSERT only; migrations are
  `scripts/bookkeeping-aws/00N_*.sql` (next is **006**), applied by a dev-host-only runner; no production store exists yet (Stage 5). Supabase
  snapshots/dictionary checks do not see it; the dictionary entries are by hand (~DATA_DICTIONARY lines 7867–7873). Stage 3's charge records
  live in **Supabase**. So the worksheet is a cross-store read: decide (in the build prompt, not the drawing) whether it queries Supabase directly
  from platform admin, or the Bookkeeping page receives a read-only feed. Do not copy sales rows into DSQL.
- Today's expense tax capture is one amount + a status: "Purchase tax amount · CAD" and "Tax review status" (pending / none / reviewed)
  (`ExpenseFormWindow.tsx` ~:210–211). No GST vs HST vs PST, no rate or province, no supplier number, no foreign-supplier flag. Per-expense columns
  incl. `tax_cad_cents`, `tax_amount_known`, `tax_status`, `business_use_percent`, `supplier`, `original_currency`, `original_cents`, `cad_cents`,
  `conversion_source`, `conversion_rate` (the CAD actually charged, with the source chosen).
- **FX method.** The GST plan says "Bank of Canada daily rate, or Stripe's conversion"; the Bookkeeping ruling stores the CAD actually charged
  with the source picked. CRA allows the source actually used, applied consistently (`PLATFORM_REPORTING_AND_CURRENCY.md`). For sales rows the
  method is undecided: ask the owner to pick one for revenue (recommend: Stripe's own CAD figure from the invoice, because that is what the
  buyer was charged and what the return reports).
- **A reporting rule gets overturned.** The Bookkeeping plan's §2 rule: never show profit, cash, or **"recoverable tax"**. A return worksheet
  shows tax collected minus claimable credits = net owed. Say so explicitly and get the owner to rule on it (recommend: allowed on the worksheet
  only, labelled as a worksheet for the return, never on the Overview).
- **Period.** The owner Bookkeeping has no GST reporting-period concept (it filters by month / quarter / year / custom). Filing frequency is
  unconfirmed: the facts doc says annual, Dec 31 year end [H]. The worksheet should take any start and end date and not assume a frequency.
  First return is out of scope for this project (owner); the worksheet is for "any period".
- **Tax is owed when an invoice is issued, not when paid**; bad debt goes on line 107 within four years; line 103 reports gross on all issued
  invoices; credit notes reverse with the GST/HST split (`UNPAID_SUBSCRIPTION_INVOICES.md`). The worksheet needs the issue date and must carry
  credit notes / voids / uncollectible as reversal lines. The accounting docs contain no return line layout (no GST34 file): ask `/accounting`
  to write one topic note (return lines used, what goes where) BEFORE the drawing, so the worksheet's labels are real.
- **ITC documentation tiers** (`GST_HST_ON_SUBSCRIPTIONS_CANADA.md`): under $100 name/date/total; $100–$499.99 add tax and registration number;
  $500+ add buyer name, description, terms. The expense form could prompt for the supplier number only when the total crosses $100.
  Foreign vendors do not have a number yet (Stage 0 item 3; the accountant said tax on foreign-vendor purchases may be rebatable): the form must
  allow "no number yet" without blocking the expense.
- Every new expense field must also go into: the store insert (`lib/bookkeeping-store.ts` ~:142–149), CSV export, the void snapshot
  (`lib/bookkeeping-void.ts`), `schema.sql`, the seed script, `scripts/bookkeeping-backup.mjs` restore, and a hand dictionary entry
  (Stage 1 Part 2's checklist, Bookkeeping plan ~lines 255–257).
- Records: keep six years; records outside Canada (AWS us-east-2) are "not kept in Canada" without CRA permission; the yearly in-Canada export
  (`RECORDS_RETENTION_AND_LOCATION.md`). The worksheet and its source rows should be part of the accountant package export.
- Open Bookkeeping items that sit next to this: Stage 1's owner walk (§431) is unrecorded; Stage 2's redraw (personal card/account only) is owed;
  a repayment-concurrency race must be fixed before Stage 5 live use. Do not fix these here; note them.

## Questions for the owner (put as Asks with a recommendation; plain words)

1. Draw 4a and 4b together, build 4a first, 4b after Stage 3? (Recommend yes.)
2. Worksheet source: Stage 3's own table, not a Stripe CSV? (Recommend yes.)
3. May a worksheet show "net tax owed / claimable credits" when the Overview may not? (Recommend yes, worksheet only.)
4. Revenue FX method for USD sales (only matters once US sales open; recommend Stripe's CAD figure).
5. Supplier number: required, prompted over $100, or optional with a visible "missing" flag? (Recommend prompted over $100, never blocking.)
6. Foreign-supplier flag: a yes/no per expense, or a supplier-level setting? (Recommend per expense, remembered per supplier.)
7. Where does the worksheet live: a Bookkeeping tab ("GST/HST"), or a section of Reports? (Draw both; recommend its own tab, because it is a different job from reports.)

## What to draw (one published Artifact, house layout: sticky tabs, minimal scroll, Everything / Show-only-what-differs toggle)

1. **The expense form's tax section, Today vs Proposed**, at true size: tax split by type (GST / HST / PST / other, with the rate), supplier number
   (with the $100 prompt and "no number yet"), foreign-supplier flag, business-use % effect on the credit shown in plain words.
2. **The expense record window and the register** with the new fields, and what a "missing number" looks like.
3. **Period totals of tax paid by type** (where it sits in Reports; reuse the shipped figure band: ONE joined band).
4. **The GST/HST worksheet** for a chosen period: sales (before tax), zero-rated sales as their own line, tax collected by type and province,
   credits claimable, net owed; each figure opens to the charges or expenses behind it (every highlight clickable); credit notes and voids as
   reversal lines; empty state ("nothing sold in this period"); and the state when Stage 3 data is absent (it must say so, not show zeros).
5. **The accountant package** gaining the worksheet.
6. **Phone** versions of 1 and 4 (Bookkeeping is an owner page; check it is still usable on a phone).
Draw every string from the SHIPPED wording, run `/design` then `/ux` before the hand-off, and check every drawing against the Portal's written
formatting rules.

## After the rulings: write the BUILD prompts

- **4a build prompt:** DSQL migration 006 (and the checklist above), form, register, record window, export, package, backup/restore, tests,
  dictionary, `/review`, `/accounting` before hand-off, owner walk.
- **4b build prompt:** written only after GST/HST Stage 3's Part 0 settles the record's fields. Worksheet query, traceability, reversal lines,
  the period picker, export, `/accounting` before hand-off, walk.
- Update the Bookkeeping ladder (new rows) and this plan's Stage 4 entry with the rulings; add the one-line pointers to TODO.

## Do not

- Do not build anything in this session; the output is a drawing, rulings and prompts.
- Do not add sales rows to the DSQL store, and do not build the Stripe CSV import.
- Do not show tax figures on the Overview, and do not compute "profit" or "cash".
- Do not touch Stage 5 (production store) or Stage 2 (personal-account redraw) work.
- Do not restate plan prices; link the Facts doc.
