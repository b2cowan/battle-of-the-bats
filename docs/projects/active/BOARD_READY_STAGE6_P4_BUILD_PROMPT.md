# Board Ready Stage 6 · Part 4 — build prompt (Offer again, the e-transfer sweep, the close-out)

> Written 2026-11-24, after Part 3b's after-walk records (`90bc475a8`), on the owner's "write the Part 4 build prompt".
> **Two sessions, in order**, each pasted into a fresh chat (`/clear` first):
> - **4a** (Opus): *"Read and follow docs/projects/active/BOARD_READY_STAGE6_P4_BUILD_PROMPT.md — Part 4a"*
> - **4b** (Sonnet is enough; Opus if the data counts surprise): *"… — Part 4b"*
>
> The 2026-11-22 build prompt's Part 4 (`BOARD_READY_STAGE6_SPONSORSHIPS_BUILD_PROMPT.md` L234–242) put three unrelated
> jobs in one session: a new feature that sends marketing email (Offer again), a spelling sweep across the **whole**
> product (coaches portal, house league, tournaments, help), and a column drop that has to wait for a production promote.
> They share nothing but the Part number, and the sweep alone touches ~25 files and ~10 tests outside sponsorships. Split
> here so each gets its own review and its own walk. **That build prompt's "rulings the build must hold", `/legal` build
> rules and standing rules still bind both sessions — read it first.** Where this prompt and the plan (`BOARD_READY_PLAN.md`
> §5 Stage 6) differ, the plan wins; where the plan and the CODE differ, the code wins — say so out loud.

## ⛔ Start conditions (both sessions)
1. Part 3b is committed (`bb7d39a47` card, `0ca618cc3` / `6d866f1b9` / `7f2015740` after-walk) and its walks passed
   (§564 47/47, §565 30/30). Find them in plan §5 Stage 6. If not, stop and tell the owner.
2. Migrations **530–534 are on dev only** (`MANUAL_PROD_STEPS.json` `"prod": "pending"`); `check:migrations` is red until
   they reach production — known, don't chase it. Your migrations number **after 534**; check the folder at commit time
   (other sessions add migrations).
3. Other sessions are editing `BOARD_READY_PLAN.md`, `BOARD_READY_PROMPTS_INDEX.md` and the board JSON (Stage 5/7 work,
   uncommitted at writing). Commit your lines through a private index (`reference_partial_commit_shared_tree.md`).

---

## Part 4a — Offer again

### What the owner ruled (ruling 14, plan L1343–1345, verbatim)
"**Offer again** from next year's empty Deals: one window, last year's deals ticked; this year's price (last year's as a
hint); club and tournament places carry over; a division carries over by name; a team is picked again, so its row waits
until the new teams exist; a business that hasn't paid in two years, or is unsubscribed, is listed but can't be ticked."

### The drawing
Round 1, tab 9 (https://claude.ai/artifact/1z9y6ctHK3PNLaJ2HR11U8, source `BOARD_READY_STAGE6_SPONSORSHIPS_DRAWINGS.html`
pane ~L1155–1200). Click its tags. In short:
- **Empty Deals for the new year**: a callout "**14 businesses sponsored you in 2027**" / "Offer them this year's packages in
  one go." with an outline **Offer again…** button; the empty state "No deals in 2028 yet." / "Offer a deal, or offer again
  to last year's sponsors."
- **The window** (600 wide): meta "Deals · 2028", title "Offer again to 2027's sponsors"; shipped check rows, name then a
  hint "{package} · {place} · {price}" (+ "· last year $900.00" only when the price changed); the waiting team row
  ("Spring 2028's teams aren't made yet. Offer it once they are."); disabled rows at .55 for the unsubscribed (the Part 2
  words) and the never-paid ("Offered in 2027, never paid, so there's no reason on record to email them. Give them the link
  in person instead."); "8 more · Show"; foot "Sends 4 emails" · Cancel · lime "Send 4 offers".
- **The rules beside it**: nothing is sent until the press; a Delivered deal's page ends with **Offer again**, which opens
  the ordinary Offer window filled in; the reason to email carries over only while it holds.

### Facts read from the code (2026-11-24; re-check the lines you touch)
- **No Offer again code exists.** ⚠ A *different* feature already exists: "Send the link again" on the same deal
  (`app/api/admin/sponsorships/deals/[dealId]/again/route.ts`, bumps `link_version`). Don't reuse its name or route.
- **A deal's year is `offered_on`** (no season column; the club fiscal year of that day). The Deals GET
  (`app/api/admin/sponsorships/deals/route.ts` ~47–51) reads every deal and filters to the pill's year. "Last year" =
  the fiscal year before the one shown; offer Offer again only on the current year.
- **⚠ DEFECT, live on production today: "Full" counts every year.** `takenOf` (`lib/club-sponsorship-deals.ts` ~189) and
  the Deals GET (~83) count paid/invoiced/offered deals across **all** years, and the POST refuses with 409 `full`
  (~113). On the first day of a club's next fiscal year, any package with a "how many" that sold out last year reads
  Full and refuses every offer — Offer again included. This is an owner call (ask A below), and its fix goes first.
- **No tournament series exists.** A tournament is its own row per year with no link to last year's (nothing in the
  dictionary). The drawing's "a tournament by its series, if 2028's exists" can't be built as drawn (ask C).
- **Places** store `place_kind`, `target_id` (not an FK) and `target_name` (a snapshot). Divisions/teams point at
  `league_divisions` / `league_teams` (house league); `readPlaceTargets` (`lib/club-sponsorships-server.ts` ~152) lists every
  season's divisions and teams marked `live` (season not completed/archived). A division carries over by matching the old
  deal's `target_name` to a live division's `name` — no cross-season identity exists; check whether names are unique
  within a season before relying on it.
- **Nothing computes "hasn't paid in two years".** `REASON_MONTHS` / `reasonFloor` / `reasonHolds`
  (`lib/club-sponsorship-deals.ts` ~40–60) check only the date a club types. The window must **compute** it from the
  business's latest `paid_on` against `reasonFloor('paid_recently', today)` — `/legal`: "The 2-year clock must be
  computed, not trusted" (`BOARD_READY_STAGE6_SPONSORSHIPS_DRAWING_REVIEW.md` L17). Moved sponsors (mig 525) have no
  reason on record and are never ticked (F5).
- **⚠ The send path does not guard itself.** `sendOfferEmail` (`lib/sponsor-offer-email.ts` ~70) trusts its caller; the bar
  (`readOfferBars` + `emailBarFor`), `reasonHolds`, the mailing address and the contact are checked separately in three
  routes (`deals/route.ts` ~127, `[dealId]/email` ~60, `again` ~55). **Extract one per-offer function that does every
  check and the create → email → record-or-roll-back sequence** (today's POST ~100–160: `createDeal`, `emailDealOffer`,
  `deleteUnsentDeal` on failure, `recordOfferSafely` kind `offer`), have the single-offer POST use it, and have the batch
  call it per row with the bars and packages read once. Add a guard test that no route sends an offer without it.
- **A deal copies its package** (name, items, logo flag; `amount` posted, defaulted to `pkg.price`); `package_id` is
  RESTRICT. An **archived** package is refused (409 `archived`) and hidden from the GET. `shows_until` is the package's
  last day and pre-fills the deal's `ends_on` — last year's may have passed (ask D).
- Each deal's **Charge switch** (`chargeTax`) is forced off unless the club is registered.
- Tests to extend: `tests/unit/board-ready-stage6-deals.test.ts` (main), `board-ready-stage6-sponsorships.test.ts`
  (`packageFull`).

### The gaps — draw them, ask, then build (as Part 3b did with refunds)
The drawing leaves these open, or the code makes it wrong. **First step: one small `/design` drawing of the differences
(true size, desktop and 390, the house layout) with these asks and their recommendations; the owner rules before any
code.** Recommendations are mine (2026-11-24); argue with them if the code says otherwise.
- **A. What "Full" counts.** Recommend: a place is taken by a deal **offered in the year shown**, plus an earlier **paid**
  deal whose last day hasn't passed (a two-year club partner still holds its place). Withdrawn frees it, as today. Fix in
  `takenOf`'s callers and the POST, with tests; this part ships even if the owner holds Offer again.
- **B. Which rows are listed.** Recommend: one row per **last year's deal that wasn't withdrawn** (a business with two
  deals has two rows); a row whose business already has a deal on the same package this year is left off; ticked by
  default only when it can go.
- **C. A tournament place.** No series exists, so recommend: the row asks for **this year's tournament** in place (a picker
  of live tournaments, pre-picked when exactly one live tournament has the same name less its year), like a team once
  teams exist. Don't build a series link.
- **D. The last day.** Recommend: the new deal takes the package's `shows_until` when it is in the year shown; when it
  has passed, the row asks for a last day in place (and the drawing shows that row).
- **E. A team row once the new teams exist.** Not drawn. Recommend: the row turns into an in-place team picker (the
  division's teams first) and is unticked until a team is picked.
- **F. A division with no match, or two matches.** Recommend: no match → the row waits like a team ("Spring 2028 has no
  U9 division yet"); two live seasons with the name → the row asks which.
- **G. Archived package.** Recommend: listed, can't be ticked, "The {package} package is archived. Offer them another one."
- **H. The reason each email rests on.** "The row says so" is not drawn. Recommend: a ticked row's hint says
  "Paid us on {date}" (the computed `paid_recently`, dated by the latest `paid_on`); a no-clock reason from last year's
  offer (gave the address · published it for business) carries over with its kept date and says so; the never-paid row
  stays disabled even when its old reason has no clock (ruling 14: listed, can't be ticked). Each email still writes its
  own offer record (reason, date, sender's name snapshot, address, club). **`/legal` checks this before build** (it is
  the CASL basis of a batch of marketing emails).
- **I. Price, tax and note.** Recommend: this year's package price (hint when different, drawn); the Charge switch copies
  last year's deal when the club is still registered; no note in the batch (not drawn; a club that wants one uses the
  single Offer window); no "Make the link only" in the batch (link-only is the single Offer window).
- **J. A partial failure.** Recommend: each row stands alone; the result says "Sent 3 of 4. Pinecrest Realty's email
  didn't go: {reason}", and the failed deal is rolled back as today.
- **K. When the callout shows.** Recommend: on the current year while any of last year's rows can still be offered (not
  only on an empty year); its count is businesses with a **paid** deal last year ("sponsored you").

### Build
- Ask A's fix first (its own commit if the owner wants it shipped ahead of the rest).
- The shared per-offer function (above), then the batch route (POST, one call, per-row results), then the window and the
  callout, then the Delivered deal's **Offer again** (opens the existing Offer window filled from the deal; no new window).
- Words in the sponsorship words files; the Part 2 refusal words reused verbatim (plan L1401–1403).
- Throttle as the Offer POST is; the batch caps at the 100-business limit.
- Tests: the computed two-year floor (a 25-month-old payment can't be ticked; a 23-month-old one can), the bars (each of
  unsubscribed / do not offer / family opt-out refused in the batch), a team row never sends, Full per ask A, a partial
  failure rolls back only its own deal, every sent row has an offer record.

### Ends with
`/simplify` → `/review` → `/marketing` (the words) → `/ux` at 390 (the window on a phone) → `/legal` (the batch, the
computed reason, the foot unchanged) → `/docs` (a new Offer again topic in the `club-sponsorships` article,
`lib/help-content/org.tsx` ~2171, with "offer again" / "next year" / "renew" keywords; no topic exists today) → a probe →
the QA walk (a checkable Artifact, 20–50 boxes, one action per step, exact logins; a club with a prior fiscal year of deals
in every case above — seed it on dev, never the demo worlds) → the commit at the owner's yes only.

---

## Part 4b — the e-transfer sweep, the old sponsor list column, the close-out

### 1. The e-transfer sweep (round 2 ruling 6, plan L1362–1363)
"**'e-transfer' in a sentence, 'E-transfer' at the start of a label or sentence;** the other two spellings go, including the
stored ledger method name (a data change for existing clubs). `/marketing` sweeps it and the spelling check holds it."
This is **product-wide**, not sponsorships only (Parts 1–3 already did sponsorships; `MoneyKit.tsx` ~217 leaves the rest
"ahead of Part 4's sweep"). It overrides the comment in `lib/payment-methods.ts` ~26 (the 2026-08-22 one-list ruling): the
list stays one list; only its spelling changes.

Census (2026-11-24; re-run it):
- **"E-Transfer"** — 16 copy hits in 9 files: the seed `lib/payment-methods.ts` ~40 and the label `lib/types.ts` ~2950
  (`DUES_PAYMENT_METHOD_LABEL.etransfer` — every "$150 by E-Transfer" on the coach, club and house-league money screens is
  derived from it), `coaches/teams/[teamId]/accounting/club/panel.tsx` ~569, `BillWindows.tsx` ~271/308,
  `LedgerWindows.tsx` ~358, `RequestWindows.tsx` ~235; help `accounting.tsx` ~163/537/551, `coaches.tsx` ~2216/2590/2604–5,
  `house-league.tsx` ~1582/1696.
- **"e-Transfer"** — `SharedPaymentDialog.tsx` ~49 (a label → "E-transfer"), `SeasonRecordBlocks.tsx` ~311,
  `house-league.tsx` ~243.
- **"E-transfer" mid-sentence or placeholders to check**: `registration-words.ts` ~206, `SponsorInvoiceWindow.tsx` ~310,
  `PaymentMethodCombobox.tsx` ~32, `registrations/page.tsx` ~2411, `settings/event/page.tsx` ~1361, `dev/email-preview` ~61.
- 76 lowercase hits are mostly right; read each at the head of a label or sentence.
- **Never change identifiers**: the `etransfer` token, CHECK values, `inv-etransfer`, `etransferEmail`, `cheque_etransfer`,
  and the fundraisers API error that lists tokens.
- **Tests that assert "E-Transfer"** and must change deliberately: `club-stage13d-coach-request`, `coach-dues-statement`
  ~239, `club-money-figures` ~246, `house-league-registrations` ~47, `notification-facts` ~114–169, `pdf-export-contract` ~540.
- **The gate**: `scripts/check-spelling-consistency.mjs` has no e-transfer rule, and its word list is case-insensitive
  (`buildPattern` ~248, `i` flag), so it can't tell the spellings apart. Add a **case-sensitive** entry in
  `ENFORCED_PATTERNS` (~116, the way the clock and "Canceled" rules are done) that bans `E-Transfer` and `e-Transfer`
  (identifiers carry no hyphen, so it is safe). The start-of-label split can only be approximated — ban the two wrong
  forms; don't try to police "E-transfer" mid-sentence by regex. (This script is not on the watched list; the ruling
  asked for the gate.)
- **Demo seeds** (`scripts/seed-club-fixture.mjs`, `seed-on-sale-pictures-extras.mjs`, `seed-notification-rows-walk.mjs`,
  `pdf-documents.mjs`, `club-money-atomicity.sql`) write "E-Transfer" as data. Fix them; a changed seed re-seeds the
  affected demo on the next master build by design. `/demos` is told, never run from here.

**The stored data** — free-text columns that can hold "E-Transfer" as typed: `rep_team_expenses.payment_method`,
`rep_team_payment_requests.payment_method`, `accounting_entries.payment_method` (and any column the census finds).
Token columns need nothing (the label is read at display). Reads fold case already (`mergePaymentMethods`,
`bank-club-rules.ts` ~106), so a re-case breaks no match — but display passes stored text through, so old rows keep
"E-Transfer" until updated. **Counts first, on dev and production (counts only on production, binding), per column,
exact "E-Transfer" / "e-Transfer" and prefixed values ("E-Transfer 4471"); show the owner and stop for his yes** before a
data migration runs anywhere. It rewrites only the spelling at the start of the value, never anything else the person typed.

### 2. Retire the old sponsor list column
`org_public_site_content.sponsors` and its CHECK (mig 353) were moved by mig 525 (production had **0 clubs, 0 rows**; dev 6
rows) and nothing writes them. Still read or accepted: `lib/db.ts` ~1360/1381, `lib/types.ts` ~809,
`lib/public-site-patch.ts` ~29–31/120/216, `app/api/admin/public-site/route.ts` ~47, the editor's `LISTS.sponsors` config
(`app/[orgSlug]/admin/public-site/page.tsx` ~105–143; its UI is already only a door), `lib/club-sponsors.ts` /
`components/public/ClubSponsors.tsx` (`SiteSponsor`).
- Remove every reader in code (this session); the tests that assert the column (`club-stage4d-guard` ~40–51, the dictionary
  marker) change with it.
- **Write the drop migration but hold it.** Recommend applying it on dev and production **together, after the promote that
  carries the reader-free code is serving** (the 509/511 order). Applying it on dev now would make dev lack a column
  production has, and the cure for that is a temporary schema-parity baseline entry — a database check, which changes only
  on the owner's ask in that session, in its own commit. Holding the migration avoids it. Add the `MANUAL_PROD_STEPS.json`
  entry (a drop is invisible to `check:migrations`); dictionary (~701 and ~7375) + `npm run refresh:snapshots` when it is
  applied.

### 3. The `/legal` close-out
Every owed policy sentence is **still owed** (no "sponsor" anywhere in `lib/legal-documents/**`, 2026-11-24):
- Payments Terms §2/§3 (sponsorships, a business payer), §4 (the two fee choices), §6 (a sponsorship refund never
  includes the fee), §9 (the sponsor pays; name sponsorships), Privacy §6 (Stripe row, a business payer) — drafted in
  `docs/agents/legal/drafts/PAYMENTS_TERMS_SPONSORSHIP_CARD_ADDENDUM.md` v0.2, not owner-approved.
- Privacy §5 (sponsors; who sent an offer is kept with its reason), §9 (retention of the unsubscribe record and the offer
  basis — "state the clock only once built"), §12 (the sponsorship-offer unsubscribe); Terms §4 (sponsors in Customer
  Data) — **no draft**.
- `/legal` writes the missing drafts and finishes the addendum, adding anything 4a's Offer again changes, and lays the text
  out for the owner on one page. **Publishing is a new frozen version of each document, never an edit of `2026-11-24`**;
  a new Payments Terms version asks every connected club to agree again, and the Privacy version moves with it. The owner
  ruled (§564 call (c)) to publish before the first production club connects. This session produces the text and the
  owner's approval page; the version bump happens on his word.
- Truth-ups: `LEGAL_FACTS.md` ~186 still says a sponsor's card dispute is silent (it is booked since mig 532);
  `LEGAL_INDEX.md` ~16 says 0.2 in the title and 0.1 in the version column.
- Lawyer's-eye flags for the close-out (no gate): the CASL sender question, the two-year clock, a passed-on fee under
  Québec law, the club's disclosure duty to an individual sponsor, "not a CEM" for the invoice/receipt/refund notice
  (never add "sponsor again next year" to them); for a tax professional: the province-of-the-buyer rule and whether
  recognition alone is a supply.

### 4. `/docs` and the records
- `/docs`: the e-transfer spelling across the help (and its `keywords` / `searchText`); the club money article naming
  GST/HST collected (owed since Part 3a, plan ~L1502); one read of the whole `club-sponsorships` article now that every
  part is in (P2's note: "the full sponsorships guide is Part 4's").
- Truth-ups: plan ~L1583 ("Live card payment waits on Club Tier Stage 12's production switch" — stale); the prompts index
  Stage 6 row (it stops at Part 1); the plan's Stage 6 checklist (~L1574, ~L1584) ticked where built.

### Ends with
`/simplify` (if the gate change grows a helper) → `/review` → `/marketing` (the sweep's words) → `/docs` → the QA walk (short:
a coach money screen, a club bill, a house-league payment, the shared tournament payment window, a help article, the
public site editor's sponsors door; exact logins) → the commit at the owner's yes only. The spelling sweep, the data
migration and the column work are **three commits**.

---

## Not in Part 4 (recorded elsewhere, don't build)
- The dispute reminder email to a sponsor (§565 call (b): later, worded for a sponsor).
- A refund made in Stripe's own dashboard (§565 call (d): its own small plan).
- Part 3b's three rare SQL cases and its phone keyboard check (the 3b commit plan's open list).
- The public tournament sponsors look (`PUBLIC_TOURNAMENT_SPONSORS_DESIGN_PROMPT.md`); club events as a place (Stage 5).
- Milton demo sponsorships (the board's Milton line: not dressed yet).

## Standing rules
As the 2026-11-22 build prompt's, plus: no Co-Authored-By footer (owner rule); a clean-checkout typecheck before the CAS
update; the next free ledger number at writing is §566 (check again); record each session's commits and walk in plan §5
Stage 6, the prompts index row and the board's Board Ready line, positive facts only, same commit as the work.
