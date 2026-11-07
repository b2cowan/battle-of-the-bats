# GST/HST Stage 3 · Part 3 BUILD: "Needs a look" (build prompt)

> Written 2026-11-06, after Part 2 was committed (`e8b51380c`). Recommended model: Opus (a tax rule set, a new table + migration,
> a shared Today queue, money-adjacent). Mark each fact [V] (opened this session, file:line) or [H] (handed to you). Everything
> below is [H] unless marked; line numbers drift, so re-open before relying on one.
> Plan of record for the stage: [GST_HST_STAGE3_BUILD_PROMPT.md](GST_HST_STAGE3_BUILD_PROMPT.md) (Part 3 text + ▶ Progress).

## Read first (in this order)

1. **The drawings, tab 5 "Needs a look" and tab 3's third sale (the mark's window):**
   `docs/projects/active/GST_HST_STAGE3_PART2_DRAWINGS.html` (published https://claude.ai/artifact/NwkZe2YiwiN7Ydua9JVntA).
   Tab 5 is the source of truth for every sentence and state in this Part. Read every tag's `data-note`. Tabs 1–4 and 6 are built (Part 2).
2. `memory/design_decisions.md` 2026-11-06 "The club record's Money tab lists sales, not charges": Asks 4, 5, 6, 8 below are rulings
   (all "A"). Build exactly them; a different answer is an owner question, not a tidy-up.
3. `GST_HST_STAGE3_BUILD_PROMPT.md` ▶ Progress: the Part 1 entries (what a record holds, **the known gaps**: refunded_cents has its
   own writer; the buyer is frozen at the first event; the backfilled records are not evidence as at the sale) and the three 2026-11-06
   Part 2 entries (built, `/simplify`, `/review` + the six fixes). Part 2's pure join, words and `chargeUnread` are what you extend.
4. `docs/agents/db/DATA_DICTIONARY.md` sections `platform_charge_tax_records`, `platform_credit_note_tax_records`: the columns every
   check reads (`gst_hst_position`, `gst_hst_position_why`, `review_reason`, `review_note`, `evidence_missing`, `evidence_*`,
   `taxed_country/region`, `tax_lines`, `refunded_cents`, `status`, `issued_at`).
5. The shipped code you extend [V by a helper, 2026-11-06; re-open each]:
   - `lib/console-money-sales.ts` (`SALE_RECORD_COLUMNS` :28 already selects the check inputs; `joinSales`, `SaleRow`,
     `beforeRegistration` :207, `gstAnswerWords` :392, `SALES_WORDS` :212, `saleTaxCell`), `lib/console-money-sales-store.ts`
     (`readSaleRecords`, `registrationDateOrNull`), `lib/charge-tax-record.ts` (`GST_HST_POSITIONS`, `GST_HST_POSITION_WHYS` :26–28).
   - `app/platform-admin/orgs/[id]/MoneyTab.tsx` (`SaleFilter` :85 — its comment already says "Needs a look joins it in Part 3"; the
     Show `<select>` ~:303; the strip `reviewStripWith` ~:175 built from `reviewOf(billing)`; `SaleWindow`), `ClubRecord.tsx`
     (`useBillingAddress` :335, `moneyNeedsReview` :336, the tab dot :685), `BillingAddressPanel.tsx` (`reviewOf`, `ReviewText`).
   - `lib/platform-waiting.ts` (Today's queues: `QueueDef` :59, `QUEUES` :62, `queuesFor` :88, `getWaitingSnapshot` :161, the counts
     :205–221, `notRead` :232), `app/platform-admin/page.tsx` :39–51.
   - `lib/platform-areas.ts` (`PLATFORM_POWERS`: `find_stripe` :114 = Super admin/Billing/Support; `refund` :115 = Super admin/Billing),
     `lib/platform-audit.ts` (`writePlatformAuditLog` :27), `lib/platform-audit-reason.ts`.
   - The undo precedent: `app/api/platform-admin/orgs/[id]/put-back/route.ts` (required `reason`, 400 "Say why before…", an undo writes a
     NEW entry naming the old one, never edits it).
   - The migration pattern: `supabase/migrations/451_every_charge_keeps_its_tax.sql` (RLS on, no policies, `REVOKE ALL … FROM anon,
     authenticated`, `GRANT … TO service_role`); the next number is 452 [V `ls`, 2026-11-06; re-check, other sessions add migrations].

⚠ **Shared, dirty tree.** Other sessions' uncommitted hunks sit in files you will touch [V 2026-11-06]: `MoneyTab.tsx` (the credit note's
`FileDown` "Download PDF" button), `money.module.css` (`.pdfButton`), `lib/console-money.ts` (the portal flag words), `lib/billing-location.ts`
(`tidyAddressCase`), and `ClubRecord.tsx` / `page.tsx` (the record's "Ended / data kept until" cell). Read them fresh, keep them, commit only
your hunks with explicit pathspecs. `.probe/gst3/commit.cjs` is a working template for a partial commit (private index on the CURRENT HEAD,
exact reverse-edits of the foreign lines, the hook, `commit-tree`, compare-and-swap `update-ref`). Never `git add -A`.

## Disagree out loud: split this Part in two sessions

Part 3 is two different jobs. **3a** is rules + reading + club surfaces and needs no migration. **3b** is the mark, a new table, a
migration, Today's row and a new Clubs filter. Do 3a, run its `/review`, then 3b. The mark's effect on the list is one parameter
(the set of looked-at sales, empty in 3a), so 3a is complete and shippable on its own. If the owner wants one session, keep the order.

## What the owner ruled (build exactly this)

- **Ask 4 · on a club: the SHIPPED parts, no second strip.** The shipped amber "Needs review" strip, the Money tab's dot, a **"Needs a
  look" choice in the list's Show dropdown**, and the shipped flag line under the sale's row. Draw nothing new: build tab 5's first frame
  (the strip line "{n} sales need a look at their tax." with **Show them**, which sets the dropdown to Needs a look; the count line
  "{n} sales need a look, newest first"; each row's amber "Needs a look: {sentence}" under "What it paid for"). Read the frame to see how
  it sits beside the billing-address review line; "no second strip" means reuse the strip recipe, not stack a new design.
- **Nothing needs a look.** The strip and the tab's dot are gone. "Needs a look" **stays in the dropdown** (the choice never appears and
  disappears). With it chosen and none left: "No sales need a look" / "Nothing needs a look. Every sale since {registration date}, when our
  GST/HST registration took effect, has a GST/HST answer that matches what was kept with it." + **Show all sales**. The date is the
  changeable registration setting, read when the tab opens.
- **It reaches every sale on record, whatever its date**, not only the 12 months the list first shows. So the choice is a **server read of
  all the customer's records that need a look**, not a client filter over the loaded pages. Rows older than Stripe's loaded charges speak
  from our record (Part 2's `chargeUnread` already does that: feed it the right `chargesFrom`). The strip's count and the dot come from a
  light read the club record makes on open (like `useBillingAddress`); the dot must light before the Money tab is ever opened.
- **Each sale shows once, with its first reason; the window lists all of them.** The order of the seven sentences below is the priority.
- **A sale issued before the registration effective date is never on the list**, and neither is a void sale (counted nowhere). The date is
  `registrationDateOrNull()` (Stage 4a setting, Bookkeeping store), never hard-coded. **If it cannot be read, nothing is called missing:**
  the count reads "Not read", the strip says so quietly, the same rule as Part 2.
- **A coach who pays for several portals has one set of sales:** each portal's Money tab shows them, and Today counts each sale ONCE
  (distinct invoice, not per portal).
- **Ask 5 · across clubs: one new row in Today's Customers queues, "Sales tax"** (amber pill = count of SALES, why-line "A sale whose
  GST/HST answer is missing or doesn't match what was kept with it"), same recipe as Past due. The row opens **Clubs & portals filtered to
  clubs with a sale to look at**; each opens on its Money tab with Needs a look chosen. Only roles that read Stripe (`find_stripe`) see it.
- **Ask 6 · "Mark as looked at"** (3b): a **new table kept BESIDE the records, never a column on them**; a **required why** ("What did you
  find, and what was done? Never a card number."); **Super admin + Billing only** (`refund` power); it goes in the audit log and on the
  sale's window; the window says "Looked at {day}, {clock} by {email}: {why}" where the flag line was, after the green notice "Marked as
  looked at."; **"Put it back on the list"** is the undo and asks for a why too (append-only, like put-back: an undo is a new row naming the
  old one); **a new problem on the same sale puts it back on the list**; Support sees the list and Today's count but not the door, and the
  window says in one line "Billing or Super admin marks a sale as looked at." (never a dead button). The mark changes nothing in the
  record or its tax, and **the GST/HST return still counts a looked-at sale as it stands.**
- **Ask 8 · a refund with no credit note** (the tax was not reduced) is the shipped flag line: sentence below.

## The seven checks (one sentence each, wording drawn on tab 5; unit-test every one)

In priority order. Each is a pure function over the stored record (+ the registration date, + whether a credit note exists), in `lib/`.
1. `position = missing`, why `stripe_did_not_work_out` → "Stripe did not work out the tax on this invoice."
2. `missing`, why `canadian_buyer_not_charged` → "a Canadian buyer was not charged GST/HST."
3. `missing`, why `no_evidence_for_zero_rating` → "zero-rated, but there is no proof the buyer is outside Canada (no US address or no US declaration)."
4. **Rate contradicts the kept address:** "taxed at HST 13%, but the address kept with the sale is in Alberta (GST 5%)." (taxed, and the GST/HST
   line's rate differs from the rate for the province of the evidence copy).
5. `review_reason` set → "flagged for review when it was sold." + the review's own sentence (the same words the billing-address strip uses).
6. `evidence_missing` → "no billing address could be read when it was sold."
7. A refund on the payment with **no issued credit note** → "refunded {amount} in Stripe's dashboard with no credit note, so the tax was not
   reduced." (`refunded_cents > 0` and no `status = issued` note for the invoice; mind Part 1's known gap on `refunded_cents`'s writer.)

Every sentence is prefixed "Needs a look: " in the row; a window lists every sentence that applies.

### Questions to settle FIRST (bring to the owner or `/accounting`; do not guess)

- ⚠ **Check 4 needs a province → GST/HST rate table that does not exist in the repo** [V grep, 2026-11-06: no table in `lib/`;
  `lib/billing-tax.ts` mentions 5/13/14/15 only in a comment]. Rates change (Nova Scotia's HST fell to 14% in 2025). Route this to
  `/accounting` (CLAUDE.md: tax facts go there): it supplies the table and a dated source in `docs/agents/accounting/`; the code table cites
  it and a guard test names the date. Compare only the GST/HST line (a BC "PST not collecting" line and Québec's QST are not GST/HST).
- **Undrawn states** (CLAUDE.md: if it is not drawn, ask). Recommend and record: (a) `unexpected_reason` has no drawn sentence: reuse
  Part 2's `gstAnswerWords` text for it as check 1.5; (b) the empty-state sentence when the registration date is unreadable (recommend
  "Every sale has a GST/HST answer that matches what was kept with it." without the date, plus the existing unread caption); (c) are
  written-off and open (unpaid) sales on the list? Recommend yes (an open sale still owes the tax), void no; (d) `looked at` row in the
  "All sales" list: recommend no flag line, the window explains.
- Check 7 on a **partly** refunded sale with a partial credit note: recommend "no credit note covering it" = no issued note at all, as drawn.

## 3a · rules, reading, club surfaces (no migration)

- **Pure** `lib/console-money-needs-look.ts` (or beside the sales join): `needsLook(record, { registration, hasCreditNote, looked? })` →
  `{ reasons: Reason[] }` in priority order, empty when clear; words in ONE home next to `SALES_WORDS`. `looked` is an empty set until 3b.
- **Server read** of every record of the customer (by Stripe customer + livemode, the same key Part 2 uses) that needs a look, all dates.
  ⚠ PostgREST returns at most 1000 rows per request: page it. Select the narrow columns the rules need; run the pure rules; return the
  records plus the count. The money route returns the count with the first page; a small route (like `money/billing-address`) feeds the
  club record's dot and strip before the Money tab opens. Roles without `find_stripe` get nothing (same gate as the money route).
- **Screen:** the dropdown choice + the server list + the strip's "Show them" + the row flag line + the window's reasons + both empty
  states + the dot (extend `moneyNeedsReview` with a second read). Phone: the card layout, the flag line stays under the title.
- **Tests:** a unit test per check (taxed/clear, the reason fires, the reason does not fire; pre-registration sale; void sale; registration
  unread; credit note present/absent; two reasons → the first shows once, both in the window); the paging past 1000; a guard that the
  roles gate is the same as the money route's.

## 3b · the mark, the table, Today

- **Migration 452 (re-check the number)** `platform_*` table beside the records, e.g. `platform_charge_tax_looks`: the sale (`stripe_invoice_id`
  + `livemode`), the **reason codes it was marked for** (so a new reason re-lists it: looked-at holds only while the current reasons are
  all in the marked set), `looked_by` (email), `looked_at`, `why` (required, non-blank, length-capped), and the undo as a NEW row naming the
  old one (`put_back_of`, with its own why). RLS on, no policies, service-role only (`migration-table-grants-guard.test.ts`). No cascade from
  organizations or users: the mark outlives a deleted club like the records do. **Dev only: do not touch production.** Add the prod step to
  `supabase/migrations/MANUAL_PROD_STEPS.json`; update `DATA_DICTIONARY.md` (`<!-- dict:table: -->` / `dict:col`) and run
  `npm run refresh:snapshots`, `check:dictionary`, `check:migrations`, `check:manual-migrations`.
- **Routes:** mark and put-back under `money/charges/...` or beside `put-back`, behind `requirePlatformPower('refund')`; 400 "Say why before…"
  on a blank why; 409 on a stale target; write the audit row (`writePlatformAuditLog`, with the reason; check
  `platform-audit-reason-guard` and `platform-audit-money-first` tests); never accept a card-number-looking why (reuse the refund reason check).
- **The window:** the door (small window = the shipped record-window recipe, "Mark the {day} sale as looked at"), the green notice, the
  "Looked at … by …: …" line, "Put it back on the list", and Support's one line.
- **Today:** a `sales_tax` row in `QUEUES` (copy the Past due row). `QueueDef.entry` is a `PlatformArea`, and no area is visible to exactly
  the Stripe-reading roles [V: `organizations` = all roles; `free_time` includes product]. Prefer a small optional `power` on `QueueDef`
  that `queuesFor` checks, over a new area; check the tests that census the queues. Count = distinct sales that need a look and are not looked
  at, across clubs, via the same pure rules; a registration date that cannot be read → `notRead`. The 30 s snapshot cache applies.
- **The Clubs list filter** the row opens (`/platform-admin/orgs?filter=sales_tax` or the shipped filter idiom) does not exist [V: no
  `needs review` count or filter anywhere today]: build it, mapping a sale's record to the clubs/portals that show it (verify how a coach's
  Premium portal maps: `buyer_kind = person`, `user_id`, `coversOtherPortals`), and a link from each club to its Money tab with Needs a look
  chosen (find the record page's existing deep-link idiom, e.g. `?charge=`).
- **`/accounting` guard (required by the owner's ruling):** the mark must never remove a sale from the return. Add a guard test that the
  looks module is imported only by the needs-a-look reader, its routes and the window, and by nothing that sums, exports or reports tax
  (Stage 4's worksheet will read the records, not the marks).

## Words (one home, spelling-gated)

Every new string lives with the console's money words; the seven sentences, the strip line, the count line, both empty states, the mark's
window and its Support line. Dates `formatStoredDate` / `consoleWhen`, times via the console clock ("8:00 a.m."). `npm run check:spelling`;
grep for the variant before adding a word. Plain words for every reason; an unknown reason shows Stripe's own code.

## Do not

- Do not change the record tables, their writer or their reader contract (Part 1 is committed: a change is a new migration and a new
  `/review`). The ONLY new table is the mark's. Do not write to the records.
- Do not build Part 4 (the before-tax band) or Stage 4's worksheet. Do not draw anything new: a state not on the drawings is an owner question.
- Do not hard-code the registration date or a tax rate without its dated `/accounting` source. Do not touch live Stripe, production, hooks
  or settings; the migration is dev only.
- Do not add a second strip, a second dot, or a new Today group.

## Done when / hand-off

- Every frame of tab 5 renders as drawn (desktop and phone), the seven checks are unit-tested, the count agrees across the strip, the dot,
  the dropdown and Today for the same data, and a looked-at sale drops out everywhere and comes back on a new reason.
- `npm run typecheck`; the new unit tests; the existing `console-money*`, `support-console-stage3-guard`, `table-recipe-guard`,
  `migration-table-grants-guard` and audit-reason tests; `check:spelling`; `check:dictionary`; `verify:changed` (report failures by file
  and mark other sessions' as such, as Part 2 did, baseline in `.probe/gst3/`).
- New files and a migration: **restart the dev server** before the owner tests (`AGENTS.md`).
- `/simplify` then `/review` (high risk: a rule set, a table, a shared queue) **and `/accounting` BEFORE hand-off** (CLAUDE.md: it changes
  what we record; check the looked-at-is-still-in-the-return guard and the rate table's source). `/legal`: a mark stores a staff email and a
  free-text why in an audit trail: confirm none is due. `/docs`: platform-admin only, likely none, confirm.
- A ▶ Progress entry per step in `GST_HST_STAGE3_BUILD_PROMPT.md` (positive facts with anchors, never "uncommitted"); list the commit
  pathspecs and which shared files need a partial commit. No commit without the owner's yes. The owner's browser walk is Part 5's; say what
  to look at.
