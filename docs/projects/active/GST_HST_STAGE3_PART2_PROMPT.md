# GST/HST Stage 3 · Part 2: the Money tab shows the kept tax record (session prompt)

> Written 2026-11-06, after Part 1 was committed (`976a6a7b3`, pushed to dev). Build prompt and plan of record for the whole stage:
> [GST_HST_STAGE3_BUILD_PROMPT.md](GST_HST_STAGE3_BUILD_PROMPT.md) ("Part 2" in Parts, and the ▶ Progress entries for Part 1, its
> `/simplify` and its `/review`). Plan: [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §4 Stage 3.
> Recommended model: Opus (a drawing session with owner Asks, then a money screen). Mark each fact [V] (opened this session, file:line)
> or [H] (handed to you). Everything below is [H] unless marked.

## ✅ DRAWN AND RULED 2026-11-06: the next session BUILDS

Drawings: https://claude.ai/artifact/NwkZe2YiwiN7Ydua9JVntA (source [GST_HST_STAGE3_PART2_DRAWINGS.html](GST_HST_STAGE3_PART2_DRAWINGS.html)),
after `/design` + `/ux`. **Owner ruled all eight Asks A** (paste-back, 2026-11-06); the rulings and their reasons are the build
prompt's ▶ Progress entry of that date and `memory/design_decisions.md` 2026-11-06 "The club record's Money tab lists sales, not
charges". Build to the drawings (memory: build to approved mockups); the asks tab holds the exact wording of each option chosen.

**How the rulings split across the remaining Parts** (agent's sequencing by dependency, not an owner ruling):
- **Part 2 (build next):** the list becomes one row per sale from our record with Stripe's payment joined (failed tries folded,
  bare charges kept as "No tax record", void struck through and uncounted, "Show older sales" pages our records, Find's `?charge=`
  opens the sale it paid); the Tax column; the sale window (joined band, Tax / Where it was taxed / The payment groups, the three
  "Kept" wordings, "Stripe invoice" beside "Stripe charge"); the Stripe-unreachable state from our record (and the reverse: our
  records failing); the Billing address caption ("today"); roles = `find_stripe` only (Ask 7). The Show dropdown ships with
  All sales / Not paid; Needs a look joins it in Part 3.
- **Part 3:** the needs-a-look query and its one-sentence checks (tab 5 holds the wording), wired to the shipped strip, the tab
  dot, the dropdown choice, the flag lines (incl. refund with no credit note, Ask 8), the empty state, Today's "Sales tax" queue
  row (Ask 5), and **"Mark as looked at" (Ask 6): a NEW table beside the records (never a column on them), a migration, required
  why, Super admin + Billing, "Put it back on the list" undo, a new problem re-lists the sale; Support sees one line in place of the
  door.** `/review` and `/accounting` (a looked-at sale is never left out of the return).
- **Part 4:** the before-tax band, as drawn on tab 1.

## (Kept for the record) This session was a DRAWING session first

CLAUDE.md house rule: a new screen gets an owner mockup session before it is built. So this session ends with **published drawings
and Asks**, not code, unless the owner rules every Ask in the same session and says build.

1. Read the build prompt's Part 2 + Part 3 text and the three Part 1 Progress entries.
2. Read the shipped Money tab (`app/platform-admin/orgs/[id]/MoneyTab.tsx`, its CSS module, `lib/console-money.ts`,
   `lib/console-money-stripe.ts`) and the record's columns (`DATA_DICTIONARY.md`, sections `platform_charge_tax_records` and
   `platform_credit_note_tax_records`). ⚠ `MoneyTab.tsx`, `ClubRecord.tsx` and `money.module.css` carry other sessions' uncommitted
   edits: read them fresh, draw from what is on disk.
3. Run `/design`, then `/ux`, BEFORE you hand the drawings over (memory: mockups go through /design by default).
4. Draw as a **Claude Artifact** (an HTML page, never the design canvas), at **true size**, **whole Money tab before / after**, in the
   house layout: sticky tabs, minimal scroll, an **Everything / Show only what differs** toggle. Draw every control from its SHIPPED
   component (the Money tab's own row recipe, its window, its band of figures). Every flag, chip or tag you draw opens on click.
5. Present the Asks in plain words with a recommendation on each, and stop.

## What Part 1 gives you to draw from [V 2026-11-06, commit 976a6a7b3]

- **One kept record per Stripe INVOICE** on our account (a club's plan, a coach's own Premium, a club's Stripe-fees invoice, a one-off
  made in Stripe's dashboard), written when the invoice is issued, its payment state moving after (open, paid, void, written off), each
  change with its own date. **One record per credit note**, dated by the note.
- Tax **by name**: every Stripe tax line kept as it was (name, rate, jurisdiction, amount, Stripe's own reason), plus OUR 0% Canadian
  line on a zero-rated US sale.
- **Our GST/HST answer**, one of three, with a "why" when missing. These need plain words on screen:
  - taxed;
  - zero-rated (a US buyer with a US address and the US declaration);
  - missing, because: Stripe did not work the tax out / a Canadian buyer was not charged / no evidence for zero-rating / an unexpected reason.
- **Where Stripe taxed it** (country, province / state, postal code) beside **our evidence copy as it stood**: address, country,
  province, the US declaration version and date, card country, payout country, and the "needs review" answer at the time.
  `evidence_missing` when we had nothing.
- **How it was captured**: at the time / caught up by the daily job / backfilled (from 2026-05-01). Only "at the time" is evidence as
  at the sale. The screen must not claim more than the record does.
- Amounts before tax, tax, total, the CAD figures and the rate for a non-CAD sale, and what has been refunded on the payment so far.
- **Nothing reads these tables yet** [V grep]: Part 2 writes the first reader.

## Questions the drawings must answer (bring each as an Ask, with a recommendation)

1. **Invoices that are not charges.** ⚠ Disagree-out-loud point: the build prompt says "a Tax treatment on each charge row", but
   the Money tab lists CHARGES (read live from Stripe) and the record is per INVOICE. An unpaid, voided or written-off invoice, a
   $0 trial and an out-of-band payment all have a record and no charge row, and an issued-but-unpaid invoice still owes the tax. Where do
   they show? (A charge row joins its record through the payment; the record keeps the payment id.)
2. **Stripe unreachable.** Today the charge list is gone when Stripe does not answer. The stored records come from our own table, so
   they must still show. How does the tab read in that state?
3. **The charge window.** Tax lines by name ("HST 13%"), the reason in plain words, "Taxed for: {province, country}", the evidence
   *as it stood that day* (never today's address), how it was captured, and credit notes netted. What is in the row, and what only
   in the window?
4. **"Needs a look"** (Part 3 builds the query; Part 2 draws it): the list on the org's Money tab and its empty state. Its count joins
   the EXISTING "needs review" strip; do not draw a second strip. ⚠ A sale issued before the GST/HST registration effective date
   (Stage 4a's changeable setting: Sept 26, 2026 today, May 1, 2026 if CRA approves the backdate) is NOT "tax missing", because we were
   not registered yet. It stays off the list.
5. **Who sees it.** Roles without the find-in-Stripe power see "ours only" today (`page.tsx:94` `find_stripe` [V]); recommend they
   see neither tax nor location. Confirm.
6. **Refunds with no credit note** (the tax was not reduced): how the row and the list say it.

## Rules that bind the drawing

- Plain words for every reason and state; one spelling everywhere (`npm run check:spelling`); dates with `formatStoredDate`, times
  "8:00 a.m." via `formatTime`; money figures as ONE joined band if a band is drawn.
- Read the UI conventions in memory (`reference_memory_index_settled.md#ui-conventions-owner-rulings…`) before drawing a control,
  window or list.
- Platform-admin only: likely no help-doc change (confirm with `/docs` at build time).
- Do not draw Stage 4's return worksheet or Bookkeeping; do not change what the records hold (Part 1 is committed: a change to it is
  a new migration and a new `/review`).
- Never touch live Stripe or production.

## After the owner rules

Build Part 2 to the approved drawings (memory: build to approved mockups), in its own session if this one is deep. Then Part 3
(the "needs a look" query, unit-tested, one sentence per contradiction), Part 4 (revenue before tax), Part 5 (closeout: `/simplify`,
`/review`, `/accounting` before hand-off, owner walk). Record each step in the build prompt's ▶ Progress.
