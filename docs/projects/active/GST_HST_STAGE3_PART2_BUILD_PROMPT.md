# GST/HST Stage 3 · Part 2 BUILD: the Money tab lists sales with their kept tax (build prompt)

> Written 2026-11-06, after the owner ruled the Part 2 drawings (all eight Asks A, paste-back). Recommended model: Opus (money screen,
> a route's answer changes shape, a shared hook). Mark each fact [V] (opened this session, file:line) or [H] (handed to you).
> Everything below is [H] unless marked; line numbers drift, so re-open before relying on one.

## Read first (in this order)

1. **The drawings, the source of truth for every word and state:** `docs/projects/active/GST_HST_STAGE3_PART2_DRAWINGS.html`
   (published https://claude.ai/artifact/NwkZe2YiwiN7Ydua9JVntA). Tabs 1–4 and 6 are Part 2. Tab 5 is Part 3: **do not build it.**
   Read every tag's note (`data-note`): they carry the rules.
2. `GST_HST_STAGE3_PART2_PROMPT.md`, the "DRAWN AND RULED" section at the top (which ruling lands in which Part).
3. `GST_HST_STAGE3_BUILD_PROMPT.md` ▶ Progress: the Part 1 entries (what the records hold, the known gaps) and the two 2026-11-06
   Part 2 entries. `memory/design_decisions.md` 2026-11-06 "The club record's Money tab lists sales, not charges".
4. `docs/agents/db/DATA_DICTIONARY.md` sections `platform_charge_tax_records` and `platform_credit_note_tax_records` (columns,
   enums, the `tax_lines` shape). Part 2 READS these tables; it never writes them and adds **no migration**.
5. The shipped code you are changing: `app/platform-admin/orgs/[id]/MoneyTab.tsx` (+ `money.module.css`), `lib/console-money.ts`,
   `lib/console-money-stripe.ts`, `app/api/platform-admin/orgs/[id]/money/route.ts` and `.../money/charges/[chargeId]/route.ts`,
   `lib/charge-tax-record.ts` (types only), `app/platform-admin/orgs/[id]/ClubRecord.tsx` (it wraps the tab and its Story also
   calls `useClubMoney`).

⚠ **Shared, dirty tree.** `MoneyTab.tsx`, `money.module.css`, `ClubRecord.tsx` and `page.tsx` carry OTHER sessions' uncommitted
edits [V 2026-11-06: the credit note's "Download PDF" button + `.pdfButton`; the record's "Ended / data kept until" band cell]. Read
them fresh, keep them, and commit only your hunks (explicit pathspecs; a partial commit where a file is shared). Never `git add -A`.

## What the owner ruled (build exactly this)

- **Ask 1 · one row per SALE (a Stripe invoice)**, read from our kept record, with Stripe's payment details joined in when Stripe
  answers. A charge joins its sale through its payment (the record keeps `stripe_payment_intent_id`; dahlia invoices have no
  `charge` field). Failed tries fold under their sale ("after 1 failed try, {day}"; an open sale after a failure reads "Owes {total} ·
  {failure} {day}"). A charge Stripe holds with no invoice still shows, from Stripe, as "No tax record · not an invoice". A void sale
  is struck through with the Void chip and counted nowhere (count line, band). Count line: "{n} sales in the last 12 months, newest
  first"; empty: "No sales in these 12 months." "Show older sales" pages our records by issue date; before the records begin
  (2026-05-01 floor) the list is Stripe's charges as today. Find's `?charge=` opens the sale that charge paid. The duplicate check
  (`findPatterns`) keeps running on Stripe's charges; its flags show on the sale rows.
- **Ask 2 · Stripe unreachable keeps the sales.** The route must return our records in the `unreachable` state too (today it
  returns only `{state, readAt}` [V route.ts:40]). Card reads "Not read"; the state column is headed "Our record says" (open / paid
  / void / written off, with dates); the band's paid and refunded figures come from our record; Next charge "Not read"; refunds
  wait with one amber line in the window, never a dead button. The callout's words are on drawing tab 4. **The reverse is drawn too
  (tab 4 notes):** Stripe answers, our records fail → the shipped charge list, Tax "Not read", one amber line naming it.
- **Ask 3 · row vs window.** Row: a Tax column between "What it paid for" and "Card": Stripe's line name and rate ("HST 13%"),
  then "{tax} · {province}"; or "Zero-rated / {country}"; or the amber "Tax missing" chip (a button that opens the window at its
  tax); or quiet "Before we registered / no GST/HST owed"; or quiet "No tax record". The "includes $X tax" phrase leaves the period
  line. Window (the shipped KitDialog record window, same width on every path): the Amount line becomes a joined band (Before tax ·
  {tax name} · Total, each note netting credit notes), then groups **Tax** (our GST/HST answer in words; every tax line with
  Stripe's reason in plain words, our zero-rated line marked "our line"), **Where it was taxed** (Taxed for; "As it stood {day}" =
  the evidence copy; "Kept" in the three wordings on tabs 3 and its notes), **The payment** (the shipped lines + "Stripe invoice"
  beside "Stripe charge"). A non-CAD sale shows "In Canadian dollars" with the rate and its date. Footer start: "Read from Stripe at
  {clock} · tax from our record". If the billing address changed since the sale, one line says so with a door to today's block.
- **Ask 7 · roles:** only `find_stripe` roles (Super admin, Billing, Support) see any of it; the route already requires that power
  [V route.ts:23]. Product, Growth, Read only: the shipped "ours only" screen, unchanged.
- **Billing address block:** caption only, as drawn on tab 1 ("today" + "Each sale keeps the address as it stood…").
- **The Show dropdown** ships in Part 2 with "All sales" and "Not paid". "Needs a look" joins it in Part 3. Quiet until it filters.

## Words (one home, spelling-gated)

Put every new string in ONE words module beside the console's money words (e.g. extend `lib/console-money.ts` or a sibling words
file): the GST/HST answer per `gst_hst_position` and per `gst_hst_position_why`; Stripe's `taxability_reason` → plain words
("charged", "not collected: we are not registered there", "zero-rated (our line)", "exempt", "reverse charge", …; **an unknown
reason shows Stripe's own code**, never hidden); the three `evidence_captured` wordings; the row's Tax cell. Dates `formatStoredDate`
/ `consoleWhen`, times via the console clock ("8:00 a.m."). Run `npm run check:spelling`. Before adding a word with a variant, grep.

## The one dependency to settle first: the registration date

"Before we registered" needs the GST/HST registration effective date, which is the changeable Stage 4a setting, read today by
`gstRegistrationDate()` in `lib/bookkeeping-store.ts` [V :237] from the **separate Bookkeeping store** (its own database, owner
allowlist for writes). Never hard-code Sept 26 or May 1. Read it server-side in the money route (a date, nothing private). Check
first that a non-owner request may read it and what it costs; if it cannot be read (null before its migration, an error), do NOT
call untaxed sales "Tax missing": show them quietly as "Not taxed" and one caption "The GST/HST registration date could not be read,
so sales without tax are not sorted." If reading it from this route is wrong for a reason you find, stop and bring it to the owner.

## Shape of the work (suggested; checkpoint between A and B if the session gets deep)

- **A · the list.** Server: the money route reads this buyer's records + credit-note records (by `org_id`; verify how a coach's
  Premium portal maps: `buyer_kind = person`, `user_id`, and `coversOtherPortals`), filtered to the key's mode (`livemode`), in
  every state. A PURE join in `lib/` (records + Stripe charges → sales rows), unit-tested: taxed, BC with a not-collected line,
  zero-rated, missing, open after a failure, paid after a failure, written off, void, $0 trial, paid outside Stripe, bare charge,
  before registration, a record not yet written (shows from Stripe), unreachable (records only), records failing (charges only).
  Client: the table, Tax column, Show dropdown, count line, paging, unreachable copy. Keep `useClubMoney`'s Story caller working.
- **B · the window.** The charge route becomes able to open a sale by invoice (and still by charge id for Find); band, groups,
  words, "Kept", the changed-address line, the unreachable refusal line.

## Do not

- Do not build Part 3 (the needs-a-look query, the strip/dot/dropdown wiring, flag lines for tax, Today's "Sales tax" row, "Mark as
  looked at") or Part 4 (the before-tax band). Draw nothing new: if a state is not on the drawings, bring it to the owner.
- Do not write to or change the record tables; no migration. Do not touch live Stripe, production, hooks or settings.
- Do not restate plan prices; the drawings' amounts are examples.

## Done when / hand-off

- Every state on drawing tabs 1–4 and 6 renders as drawn (desktop, and the phone card layout with Tax as one more labelled line).
- Typecheck clean; the new pure join + words unit tests and the existing `console-money*` tests pass; `npm run verify:changed`
  (report other sessions' failures by file, as Part 1 did); `check:spelling`; the console window-foot and table-recipe guards.
- New files were added → restart the dev server before the owner tests (`AGENTS.md` restart rule).
- Record a ▶ Progress entry in `GST_HST_STAGE3_BUILD_PROMPT.md` (positive facts with anchors, never "uncommitted").
- Offer `/simplify` then `/review` (new shared join + a route's answer changed shape). `/docs`: platform-admin only, likely none —
  confirm. No commit without the owner's yes. The owner walk is Part 5's; list for the owner what to look at in the browser.
