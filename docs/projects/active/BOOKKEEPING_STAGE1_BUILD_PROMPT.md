# Bookkeeping, Stage 1: easy to use (build prompt)

> **Execution checkpoint — owner hold, 2026-10-30:** Parts 1–2 are committed and checked: foundations `cbdd5ccde`, lettering guard `bf8ba972c`, restore mapping `86fd8c5e2`, shared form/USD evidence `974fc7208`. Migration 005 was applied to development, preserving the existing 28 revisions / 15 expenses before S1 browser fixtures. The owner asked to finish committing and log progress, then **hold before Part 3 until he is ready**. On his resume, start at Part 3 after reading [plan §13's resume checklist](BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md#resume-after-the-owners-hold-2026-10-30). Parts 3–6 remain ordered work; retain the completed form/window/address behaviour and test evidence recorded there.

> **Written 2026-10-30.** Paste into a new Codex chat on `dev`. **Re-verify every lead before building on it**: they were read in the
> code on 2026-10-30, and code moves. Read first, in this order: `BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md` (§3 Stage 1 row, §11, §12),
> then the hub `BOOKKEEPING_HOLISTIC_REEVAL_HUB.html` (open it in a browser; the drawn Overview, Expenses, Add, Record and Void
> frames and the Asks tab are the ruled list; the file is large because of embedded images, so grep it rather than reading it
> whole), then `BOOKKEEPING_ACCOUNTANT_FIXES_BUILD_PROMPT.md` for the shape of a prior bookkeeping build.
>
> **Other sessions share this working copy.** Stage explicit paths only, commit only your own hunks, ask the owner before each
> commit (an earlier yes does not carry over), never push. Run `git show --stat HEAD` after every commit.
>
> **Recommended model: Opus 5.5** (money records, a data change, an API contract change). Helpers stay on Sonnet.
>
> Parts, in order. Each part is committed on its own after its own checks, and only after the owner says yes in your chat.

## What this build makes true

The owner opens Bookkeeping and sees the console's standard page header and four tabs: **Overview · Expenses · Ledger · Reports**,
with **+ Add expense** always reachable. Adding an expense is a short window, not a page of fifteen fields: the common case needs
supplier, category, one line for what it was for, date, amount, how it was paid, and an optional receipt; Save is always on
screen. The Expenses tab is a dense table that shows a month on one screen, with search that matches amounts. Opening an expense
shows a record window that reads first; the pencil corrects the whole record and is held until the owner confirms with the reason.
Voiding is a small question that carries the entry's own values unchanged, and the server refuses a void whose values differ.
Copy as new and a gentle duplicate warning save retyping. A USD purchase asks for what the receipt says and what the card
actually charged, shows the rate, and records where the CAD figure came from. Every view and an open record has its own address.
The whole tool wears the console's own lettering and house dates.

Nothing here changes tax fields (Stage 4), accounts, registers, statement tick-off or "closed through" (Stage 2), the report
views (Stage 3), production, AWS, backups, or Stripe (Stage 6). The Sources preview stays hidden.

## The rulings (owner, 2026-10-27, plan §12; do not reopen, record nothing they did not rule)

Q1-Q3 (Overview, console header with Add on the tab row, four tabs with Needs attention folded in) · Q4 (Add and Correct in the
shared window, Save pinned, "What was it for?" one line, More details closed but showing its values) · Q5 (Expenses as a table,
Active by default) · Q6 (Copy as new, duplicate warning, search by amount ride in Stage 1) · Q7 ("where the CAD figure came from"
is a pick list with an optional note) · Q15 (the record opens as a window, the pencil corrects the whole record held until ✓,
Void is a small question; closes BKX-5.9 by construction) · Q16 (each view and an open record has its own address) · F22-F24
(console lettering, quiet-bordered fields, house dates). USD: two amounts in (the receipt's USD and the CAD actually charged),
the rate shown and stored. Q8-Q14 and Q17 are later stages: build none of them.

## Part 1 · Foundations: header, tabs, addresses, lettering (do first, everything else sits on it)

- **Header:** `components/admin/AdminPageHeader.tsx` (eyebrow "Private finance", title "Bookkeeping"). Today the header is hand-built
  in `app/platform-admin/bookkeeping/BookkeepingClient.tsx`.
- **Tabs with the action on the row. ⚠ Conflict, propose before building:** the drawing puts **+ Add expense** at the right end of
  the tab row; `components/shared/HubTabBar.tsx` carries a written owner ruling (2026-08-23) that tab bars have **no action slot**
  and hub-wide actions live in the page header. Options: (a) a bookkeeping-local row built from the console's own tab styles
  (`kit.tabs`, `kit.tab`, `kit.tabOn`, `kit.tabCount` in `app/platform-admin/console.module.css`) that holds the action;
  (b) the action in the page header (the shared pattern); (c) ask the owner to rule an exception to the 08-23 ruling. **Recommend (a)
  as drawn, but write the choice into your first message and wait for his word before wiring.** On a phone the action becomes a
  44px lime "+" in the heading (aria-label "Add expense"); the drawing gives no visible label there.
- **Addresses (Q16):** Overview, Expenses, Ledger, Reports, and an open expense each get an address; reload keeps the place and Back
  works. Today all state is one `view` variable with no URLs. Reuse `KitDialog`'s `address` prop for the record, and the
  `?query` + `router.replace` pattern in `app/platform-admin/orgs/[id]/ClubRecord.tsx`. **Route shape (nested paths versus
  `?view=&record=`) and the address of an open Add or Correct window are undrawn: propose one, with the reason.**
- **Lettering (BKX-5.10, F22-F24):** drop the typewriter face (`--font-data`, 31 uses) for the `--type-*` tokens; the data face
  stays only on eyebrows, chips and codes, each marked `type-ok: <role>`. Fields become 8px-rounded with the quiet border
  (`kit.field`/`kit.select`/`kit.textarea`). Dates become house dates ("Oct 27, 2026"; "Oct 1" on ledger rows) through
  `lib/console-dates.ts` or `formatStoredDate`; history times must stop using `toLocaleString('en-CA')` and read "Oct 27, 10:44 a.m."
  through `consoleClock`/`consoleWhen`. **Un-hold the guards:** remove `app/platform-admin/bookkeeping/` from `HELD_OUT` in
  `scripts/check-admin-type.mjs` and from the filter in `tests/unit/platform-admin-stage1-guard.test.ts`, then make the files
  pass (the eyebrow's `.14em` tracking is over the cap). Delete the Sources-preview CSS only if you also delete its dead code;
  otherwise it must pass too. **This edits shared checks; the owner's 2026-09-26 ruling applies: tell him, and keep these two edits
  in their own commit with the message saying what behaviour changes.**

## Part 2 · Add and Correct in the shared window; USD; the data change

- Use `components/shared/KitDialog.tsx` (`kind="form"`, `size="medium"`, the 640px window; full screen with ← on a phone; Save
  pinned in the foot; `dirty` gives "Keep writing / Discard"; the foot's left sentence goes in `footerStart`; a refusal goes in the
  `DialogReason` slot; a foot submit names its form). No hand-built dialog, no `window.confirm`.
- **Fields as drawn (Add, 2-column grid):** Supplier* | Category* (with "+ Add a category") · "What was it for?*" full width, one line,
  growing · Expense date* | Amount* (currency prefix inside the field) · a full-width checkbox row **Paid on a different date**
  (44px on a phone; unchecking restores the incurred date) · "How did you pay?*" | Receipt (a drop target, "Attach · or add it
  later") · the duplicate notice · a closed **▸ More details** line that shows its values ("Tax unknown · 100% business · no
  notes"). Foot: left sentence "A missing receipt shows in Needs attention.", **Cancel** and lime **Save expense**. GST/HST fields are
  deliberately not drawn (Stage 4). Copy comes from the hub; do not reword it.
- **USD (Q7):** field order Supplier · [Expense date | "Receipt shows*" USD ▾] · "Your card or bank charged (CAD)*" · "Rate" (read-only,
  computed: "1 USD = 1.4064 CAD from your two amounts") · "Where the CAD figure came from*" pick list (**Card statement · Bank
  statement · Bank of Canada rate · Invoice shows CAD**; defaults to the last one used for that payment source) · optional note.
  Older entries keep their sentence as the note.
- **Additive data change (dev only):** a stored rate and a stored source. Follow the `002`/`003` pattern: an additive
  `scripts/bookkeeping-aws/005_*.sql` with `ADD COLUMN IF NOT EXISTS`, and a dev-host-only inspect/apply runner with post-count
  checks (copy `scripts/bookkeeping-dsql-tax-migration.mjs`). The new columns must also go into `lib/bookkeeping-store.ts`
  (`insertExpenseRevision`), `ExpenseRevision` (optional, so old fixtures still compile), `validateExpenseFields`, the CSV columns
  in `lib/bookkeeping-export.ts`, the **hard-coded restore insert** in `scripts/bookkeeping-backup.mjs` and the seed in
  `scripts/bookkeeping-seed-b2-qa.mjs`. **Update `docs/agents/db/DATA_DICTIONARY.md` by hand** (the DSQL paragraph near line 7403);
  `check:dictionary` reads Supabase snapshots and will not catch a miss. **Do not apply to production**; its migration state
  belongs to the bookkeeping release record.
- **⚠ Constraint conflict:** the table has `CHECK (original_currency = 'CAD' OR conversion_note IS NOT NULL)`, which forbids a USD
  revision with no note, but Q7 makes the note optional. DSQL may not support relaxing the constraint. **Propose** writing the
  source's label into `conversion_note` when the owner types no note (no schema change), and say what you verified about DSQL.
- Replace `hasValidConversionEvidence` (needs a date and a non-generic word) with "a source was picked"; the attention reason becomes
  **USD source not picked**. A legacy USD row with only a sentence counts as picked only if you can say why; **propose**.
- The pinned existing tests assert on the old shape (the tab-row regex in the accountant-fixes test, the receipt-size source assertion,
  `CONVERSION_NOTE_HINT`): update them with the code, never delete a guard to get green.

## Part 3 · Expenses table, toolbar, search, Needs attention

- A register-density table, **Active by default**: Date · Supplier · What for · Category · Paid from · Receipt (✓ or amber **Missing**) ·
  Amount (right-aligned) · chevron; house dates; a USD row's "What for" shows "· USD 45.59". Row about 31px so a month fits one screen;
  phone rows become cards (`table-cards`; see `app/platform-admin/customer-users/PeopleClient.tsx`).
  **Register density is a claimed exception**: use claim K-01 (`docs/agents/design/TABLE_AND_LIST_STANDARD.md`,
  `TABLE_EXCEPTION_REGISTER.md`) and mark literal sizes `table-exception: K-01` as `table-recipe-guard.test.ts` requires.
- Toolbar: olive rounded **period** pill with "N expenses · $total" beside it; square quiet pills Category ▾ · Paid from ▾ · Active ▾; an
  amber **Needs attention [n]**; search (16rem) and **Export** at the far right. Use the console's `kit.toolbar`/`kit.search`
  recipe. **Undrawn, propose with a default each:** the period pill's options and its default (drawn "October 2026"; today the
  default is all confirmed dates); the status filter's options (Active / Voided / All) and whether voided rows show struck through;
  whether Export is one button or a menu for CSV and Accountant package, and whether it stays on Reports too.
- **Needs attention** moves from a tab into Overview and this filter. `attentionReasons` is client-local today; move it to `lib` so the
  export and the count share it. The chip words: **Receipt missing · Tax amount unknown · USD source not picked · Dates to review**.
  Voided entries are excluded from the count (as today).
- **Search by amount:** today it matches supplier + purpose + category (client and `selectExpenseRevisions` in the export). Add amounts
  to **both** or the export will disagree with the screen. **Undrawn, propose:** which amounts match (business, CAD, original,
  tax) and which typed forms ("18.08", "$18.08", "1,200") are accepted.
- Update `lib/export/catalog.ts` if the exporting file moves (`check-export-catalog`).

## Part 4 · Overview

Stage 1 ships: the **Spent in {month}** tile (restyled), the **Needs attention** card (compact table: Supplier · Why chips · Amount ·
chevron, "See all ›" opening the Expenses filter) and **Recent** (Date · Supplier · Paid from · Amount · chevron, "Expenses ›"). The other
three figures, the "Closed through" chip and anything about a business-account balance are **Stage 2: do not build them, and do not
reuse the drawing's "Business chequing" wording** (the code's sources are Business bank, Business card, Paid personally, Other).
**Undrawn, propose:** the drawn tile says "Up $… on September" and "opens Reports › Compare", but Compare is Stage 3. Say what the tile
shows in Stage 1 (recommend: the month's total only, opening Reports) and whether the tile ships at all, since plan §3's Stage 1 row
omits Q1.

## Part 5 · Record window, pencil, Void, Copy as new, duplicate warning, transfers

- **Record window (Q15):** `KitDialog` with `edit` (pencil becomes ✓ in the same place), `steps` (drawn "1 of 12", "Next: {supplier} ›"; no
  button at a list end), `address`, `size="medium"`. Head: eyebrow "Expense · {date}", title the supplier, the category and purpose
  line, ✎ and ×. Facts: Amount · Paid from · Expense date · Payment date ("Same day") · Purchase tax · Business use; the receipt row
  ("Attached Oct 27, 10:44 a.m. · opens in a new tab"); **Changes · n** (revision lines with the reason); at the end of the body two
  outline buttons **Copy as new** and **Void this expense…**. Precedents: `app/platform-admin/customer-users/[id]/PersonRecord.tsx`
  (pencil held until ✓) and `app/platform-admin/RecordWindow.tsx`. The club ledger windows autosave; **the owner ruled bookkeeping
  must not**, because each correction writes a permanent revision.
- **Undrawn, propose:** how the correction's reason is asked on ✓ (a question window, as `PersonRecord`/`RecordWindow` do, or a field
  in the window); what ✓ with no changes does; what × does mid-correction (the window's own "Close without saving?" ask); what a
  **voided** record shows (the plan says no actions; the drawing does not show its head, and whether it still steps).
- **Void question (BKX-5.9):** `KitDialog kind="question"` at 416px using the `ReasonQuestion` pattern in
  `components/admin/kit/club/money/MoneyKit.tsx`; both buttons quiet ("Keep it" / "Void expense"). Text as drawn: "**{supplier} · {amount} ·
  {date}** leaves your totals. It stays in the history with its receipt, exactly as entered." (The drawn "and the business card's
  balance" clause is Stage 2: leave it out.) Any name in a possessive goes through `possessive()`.
- **Server refusal (new, with a failing test first):** `app/api/platform-admin/bookkeeping/expenses/route.ts` and
  `owner-movements/route.ts` must refuse a void whose values differ from the latest revision (today the server takes whatever the form
  sends, and the owner-movement void skips the repayment-limit check). The ruling says "refuses", so compare and refuse; the new
  question window carries no value fields, so decide how the client sends the values and say so. Both paths need a unit test.
- **Copy as new:** opens Add with supplier, category, purpose, account and amount filled and today's date. **Undrawn, propose:** whether
  tax fields, business-use share, notes, USD amounts and rate are copied, and what happens to the receipt (recommend: not copied).
- **Duplicate warning:** same supplier and amount within 7 days; **warns, never blocks**; a monthly repeat 30 days apart says
  nothing; drawn text "{supplier} · {amount} is already recorded for **{date}**. Same purchase twice?" with an "Open it ›" link.
  **Undrawn, propose:** the amount basis (business, CAD or original), supplier match (exact or case-insensitive), that voided entries
  and the entry being corrected are excluded, and whether it also runs on Correct.
- **Transfers** (owner contributions, draws, reimbursements) get the same record window and question in place of the hand-built inline
  form and always-open void form in `OwnerLedger.tsx`. The Ledger itself is not redrawn in Stage 1 (its redraw is Stage 2); the drawing
  shows no transfer record, form or add door. **Propose** the window width (520 or 640) and keep the existing "+ Add owner transfer".

## Guards and gates this build will trip (re-read the failing output; never weaken a guard)

`check-admin-type` and the console lettering guard (Part 1) · `check-public-tokens --scope=all` (tokens only, no literal colours) ·
the clock gate (12-hour clock "10:44 a.m.", no `hour: '2-digit'`) · `possessive-guard` · the KitDialog guards (record opens on its panel,
foot sentence in `footerStart`, foot submit names its form, no hand-built dialog, no `window.confirm`) · `table-recipe-guard` ·
`check-export-catalog` · `check-css-selectors` (dead classes in the module) · `check-observability-coverage` (a new route needs
`withObservability`). `lib/console-money.ts` imports `parseCents` from `lib/bookkeeping-expenses.ts`: do not change its signature.
Spelling: "instalment" only if a word is needed. `verify:changed` currently stops at a known ESLint plugin-config error that is not
yours; say so and run the focused checks and `npm run typecheck` instead. The layout-invariants sweep does not cover Bookkeeping.

## Testing access and data

Bookkeeping is private to the `BOOKKEEPING_OWNER_EMAILS` allowlist; the **dev store is the only working store**, and nothing here
touches production or AWS beyond the dev migration. Name your test entries with the prefix **S1-** and never delete them (the store is
append-only anyway). Earlier probe and walk scripts live in `.probe/bkr/`, `.probe/acct-fix/` and `.probe/pasc/`. Prove each part in a
real browser at 1440 and 390 before you hand it over, including: a CAD entry with no scrolling to Save, a USD entry, a missing receipt,
a different payment date, a correction held until ✓, a void with the server refusing a changed value, Copy as new, the duplicate
warning, reload and Back on a record address.

## Part 6 · One owner walk

Write one checkable walk (ledger entry, paste-back, one purpose) after the last part, covering the five journeys in §383 plus the
new doors. Do not number a ledger section without checking the ledger's last § right before writing it.

## Not in this build

Accounts, registers, running balances, statement tick-off, "closed through", "Your money in the business" (Stage 2, **redraw owed for
the personal-account shape**) · the five report views and T2125 (Stage 3) · GST/HST capture (Stage 4) · the real books going live,
the production store, backups and the May-October backfill (Stage 5) · Stripe income and the Sources tab (Stage 6) · the outside
accountant's review (out of scope, owner 2026-10-27).

**Owed after:** `/review` (this touches money records and an API contract), `/docs` only if a help article names these screens (the
platform-admin help mentions only the menu entry), the owner walk, a dev-server restart (new files, shared modules).
