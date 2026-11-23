# Board Ready Stage 6 · Part 3a — finish

Paste into a fresh session: **"Read and follow docs/projects/active/BOARD_READY_STAGE6_P3A_FINISH_PROMPT.md"**

Written 2026-11-23 by the Part 3a build session. Part 3a's code is built and probed on dev; this prompt runs its close-out,
then stops for the owner's yes to commit. Plan of record: `BOARD_READY_PLAN.md` §5 Stage 6 — read "Part 3's four owner calls"
and "Part 3a code built" (both 2026-11-23). Build prompt: `BOARD_READY_STAGE6_SPONSORSHIPS_BUILD_PROMPT.md` Part 3.

## What Part 3a is (owner calls 2026-11-23, all as recommended)
Part 3 was split: **3a** the invoice PDF, the invoice / revised / "Paid in full" emails (a link, no attachment), Record a
payment and Void, the books, the revised invoice; **3b** card payment (next, with refunds drawn first). Card stays on an
invoiced deal's link at the invoice total with the club paying that fee (a 3b rule; nothing in 3a builds card).

## Part 3a's files (stage only these — the tree is shared; several have other sessions' hunks)
New: `supabase/migrations/528_a_club_records_a_sponsors_payment.sql` · `lib/club-sponsor-invoice.ts` ·
`lib/club-sponsor-invoice-pdf.ts` · `lib/sponsor-invoice-email.ts` · `components/admin/kit/club/sponsorships/DealPaymentWindows.tsx` ·
`app/api/admin/sponsorships/deals/[dealId]/payments/route.ts` · `.../payments/[paymentId]/void/route.ts` ·
`.../deals/[dealId]/invoice/route.ts` · `app/api/public/sponsorship/[token]/invoice/route.ts` ·
`tests/unit/board-ready-stage6-p3a.test.ts` · this file.
Changed: `lib/club-sponsorship-deals.ts` · `lib/club-sponsorship-deals-server.ts` · `lib/club-sponsorship-deal-words.ts` ·
`lib/sponsor-deal-view.ts` · `lib/export/pdf.ts` · `lib/email-kinds.ts` · `lib/club-ledger.ts` · `lib/club-ledger-read.ts` ·
`lib/club-money-figures.ts` · `lib/club-money-words.ts` · `lib/coach-budget-item-tiers.ts` ·
`components/admin/kit/club/money/LedgerWindows.tsx` · `components/admin/kit/club/money/MoneyKit.tsx` (MethodField `labels`) ·
`components/admin/kit/club/sponsorships/DealScreen.tsx` · `deals-api.ts` · `components/public/SponsorDealContent.tsx` ·
`components/public/SponsorDeal.module.css` · `app/api/admin/sponsorships/deals/[dealId]/route.ts` · `.../withdraw/route.ts` ·
`app/api/public/sponsorship/[token]/route.ts` · `tests/unit/board-ready-stage6-deals.test.ts` (the sample deal's new fields) ·
`tests/unit/team-move-coverage.test.ts` (one STAYS row) · `docs/agents/db/DATA_DICTIONARY.md` · the refreshed schema snapshots ·
`supabase/migrations/MANUAL_PROD_STEPS.json` (528 only) · `docs/projects/active/BOARD_READY_PLAN.md` (Stage 6 paragraphs only).
**Partial — other sessions' hunks in the same file, stage only Part 3a's lines through a private index**
(`reference_partial_commit_shared_tree.md`): `components/admin/kit/club/sponsorships/DealsList.tsx` (the "Paid {day} · {how}"
line only), `components/admin/kit/club/sponsorships/Sponsorships.module.css` (the appended Part 3a block only),
`lib/help-content/org.tsx` (the sponsorships paragraph sentence and its keywords/searchText only), and the plan file.
⚠ The working copy's `BOARD_READY_STAGE6_P2_FINISH_PROMPT.md` shows Part 2's commit line in its OLDER wording (a stale hunk left
by Part 2's private-index commit) — don't stage it; say so to the owner.

## The steps, in order
1. **`/simplify`** over Part 3a's files only (above). Watch: the PDF's shared page between the coach and club builders; the
   three money RPC wrappers; the Thanks block's two cards; anything duplicated between `club-sponsor-invoice.ts` and the email.
2. **`/review`** (high risk: money, a guarded table, shared ledger/figures code, a public route). Lenses to name: the guard
   trigger vs. Part 2's receive step and withdraw; the tax split; `countsAsActual`'s new exclusion (every Budget vs. Actual
   reader); `itemVisibleToTeam`'s id check (does every coach-side reader pass `id`? the coach budget-categories route nests
   items — check it); the invoice PDF doors (no other deal reachable); the email never fails the money step.
3. **`/marketing`** — one pass on every `// DRAFT` word Part 3a added in `lib/club-sponsorship-deal-words.ts` (the Record a
   payment errors, the Payments card, Void, the invoice/receipt emails, the receipt card's lines) and the ledger window's new
   "where" sentence. Never "donation", "gift", "tax receipt"; "e-transfer"/"E-transfer"; `npm run check:spelling`.
4. **`/ux` at 390** on the business's page after sending (the invoice card with Download) and paid (the receipt card), and on
   the deal page's Record a payment window and Payments card. Hand `/design` the two undrawn things: the **Payments card** under
   the money band, and the PDF footer's "Exported: {day}" on an invoice (the club's PDF setting).
5. **`/docs`** — the Sponsorships guide: Record a payment, part payments, Void, the revised invoice, the invoice/receipt emails,
   the PDF, the ledger's two lines (Sponsorship › Club sponsorship, GST/HST collected, opened from the Ledger), and that
   GST/HST collected is not in Budget vs. Actual. The one sentence already changed ("The invoice is emailed…") stays true.
6. **`/legal`** — the invoice and receipt emails (not offers: no stop list, no unsubscribe; the sender line), the business's
   page words now that the invoice is emailed, the unsubscribe-confirmed page's sponsor wording owed since Part 2 ("{club} will
   remove you"), and what the PDF says. Apply or record an owner question.
7. **`/accounting`** — runs **before hand-off** (CLAUDE.md): the invoice's CRA contents by tier (≥$500: buyer name, terms —
   the PDF has both), the club's number only on a taxed invoice, the proportional tax split on part payments, GST/HST
   collected kept out of Budget vs. Actual but in cash, the "Generated by FieldLogicHQ" footer (not a supplier claim?), and the
   revised invoice keeping its number. Apply or record an owner question.
8. Re-run `.probe/stage6-p3a-money-probe.mjs` (`node --env-file=.env.local …`, dev server up; restart it first if `lib/`
   changed) — ALL PASSED, and UAT Rep Only's mailing address empty after. `npm run typecheck`; the sponsorship tests;
   `npm run verify:changed` (report the baseline failures as before).
9. **The QA walk** — a checkable Artifact (`feedback_qa_walkthroughs_as_checkable_artifacts`), 20–50 boxes, one action per step,
   exact logins (UAT Rep Club owner and treasurer; a registrar with Sponsorships on). One purpose: Part 3a's money. Set up
   through the product's own Setup save (mailing address, GST/HST registered with a number, how businesses pay), and name the
   `.local` business email so nothing is really sent. Add it to the Owner QA Ledger with its §number.
10. **The commit, at the owner's yes only.** Branch `dev`, explicit pathspecs, partial files through a private index, no
    Co-Authored-By footer. Record the hash in plan §5 Stage 6 and the board line (`OWNER_BRIEF_PROJECTS.json`) in the same
    commit; after it, `git show --stat HEAD` and confirm only Part 3a's files landed. Then write the Part 3b kickoff.

## Added 2026-11-23 by another session — a guard in Part 3a's files that belongs to Part 3a
The owner ruled (2026-11-23) that the business address is required only on a deal that charges GST/HST; committed as
`c1379882c` (form, words, help, tests). Part 3a's revised invoice needs the matching guard, and it is written into Part 3a's
own uncommitted files, so it rides with Part 3a's commit — keep it through /simplify and /review:
- `app/api/admin/sponsorships/deals/[dealId]/route.ts`, the revise branch: `terms.chargeTax && !province` → 409 `no_address`
  with `DEAL_WORDS.deal.taxNeedsAddress` (the word is already committed).
- `DealScreen.tsx` `DealEditWindow`: `taxBlocked` (revising, untaxed, no address) disables the tax switch and shows that line.
The words file's Part 3a hunks now sit on top of `c1379882c`; the "Paid {day} · {how}" partial in DealsList is unchanged.

### Owner ruling 2026-11-23 — the club can type the business's address (build in Part 3a, before its commit)
"Yes, let the club type it, send it to Part 3a." When a deal's business left its address blank (allowed on a deal that
charges no tax), the club does NOT have to withdraw and re-offer to charge GST/HST on a revised invoice: it types the
business's address on the deal page. /accounting (2026-11-23): an address the club already holds for the business is still
one "obtained in the ordinary course" (Memo 3-3-6), so it sets the place of supply like a typed one; all four parts, the
same Canadian province list, no fallback rate (the services fallback was never researched — don't invent one).
- Where: on the deal page, wherever `taxBlocked` / `DEAL_WORDS.deal.taxNeedsAddress` now shows (the Change window's tax
  switch) — replace the "withdraw and offer again" sentence with a way in: "Add their address" opening the four fields
  (reuse the business page's address fields and `parseBusinessInput`'s all-four-or-none rule). Saving it writes the deal's
  invoice_street/city/province/postal (and the sponsor's, as the business's own send does); then the switch unlocks and
  the revised invoice is taxed at that province's rate.
- Keep the server guard (`terms.chargeTax && !province` → 409 `no_address`): the address save is its own step.
- The address also prints under "Bill to" on the revised invoice. (Suggestion, NOT ruled — ask the owner:) say in the history line who added it ("address added by
  <name>") so the business can tell where it came from. Words DRAFT for /marketing; /design looks at the window.

## Closed 2026-11-23 (the close-out session)
- Steps 1–9 done: `/simplify`, `/review` (a real cash tie-out gap, a post-commit failure that could skip the receipt, the revise-on-unrelated-edit nit and the refusal words all fixed), `/marketing` (four wordings), `/ux` at 390 (a silent Void failure, a stale Record window and two small tap targets fixed; the club's deal page was not looked at live: the UAT owner login stops at the Terms tick-box), `/legal` (the unsubscribe-confirmed words fixed; the invoice and receipt emails are most likely not CEMs while no promotion is added), `/accounting` (a tax-timing note and three dev-only migration questions, all on the walk page as owner calls), `/docs`. The probe passed in full and the UAT club's mailing address is empty after.
- Walk: Owner QA Ledger **§562**, https://claude.ai/artifact/SaFBzF98cxoyAMEed7YpTy (8 walks, 46 steps, 8 owner calls outside the count).
- **Committed `0f2b83490`** (50 files) at the owner's yes, with the owner's ruling to **hold back the deal page, the new payment windows and the Sponsorships styles** (`DealScreen.tsx`, `DealPaymentWindows.tsx`, `Sponsorships.module.css`): another session is mid-edit on the same screens (its "record page" redesign is interleaved in those hunks). Those three go in when that session lands. Until then the committed deal page lacks Record a payment, the Payments card and Void; the committed words keep `errInvoicedChange` and an optional `emailed` argument so the older page compiles.
- The clean-checkout typecheck caught that break before the commit moved the branch: run one on any partial commit.
- Not staged and not Part 3a's: Part 2's finish prompt still shows its older commit-line wording in the working copy (a stale hunk).
- Next: `BOARD_READY_STAGE6_P3B_KICKOFF_PROMPT.md`.
