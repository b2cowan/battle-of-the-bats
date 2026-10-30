# Club Tier Stage 12c: refunds you can see, a team's part refund, and bank debit (build prompt)

> **Written 2026-10-26**, the day the 12c drawing gate (plan §0j) closed: all three drawings drawn, ruled and worded. **Paste
> this into a new chat on `dev` and re-verify every lead first**: the leads come from censuses at `a126ea000` (helpers' reads,
> the load-bearing ones re-read by me), so this prompt names **files, not lines**, and code moves. Other sessions share this
> working copy: stage explicit paths only and commit only your own hunks.
>
> **Recommended model: Opus 5.5** (money on two flows, a second Stripe payment method with asynchronous settlement, schema
> changes to live money tables, a new per-team money concept). Helpers stay on Sonnet as configured.
>
> Built in **parts, each committed locally after its own checks**, in the order below (the order is dependency, not timing:
> the refund parts change the shared refund email and the tournament refund window that bank debit then extends). **Nothing
> charges real money:** test mode only; production keeps the feature off until counsel signs off (`LIVE_PAYMENTS_ALLOWED`
> stays false).

## What 12c makes true

- **A card refund is visible wherever the money is read.** The house-league Fee cell carries the card's part on its second
  line ("Oct 26 · $156.75 to the card", "· pending", "· made in Stripe"), an amber "Refund didn’t reach the card" pill when
  it came back, and a dotted third line for a refund that never entered the book. The row's record has a "To the card" block
  (amount and fee split, who, when, Stripe's reference with Copy). The Money tab stays the book, with one closing line for a
  card refund that never entered it. A part refund with the rest kept no longer hides the refund; a returned refund no longer
  reads "refunded".
- **A refund made in the club's Stripe dashboard records itself** whenever it can be pinned on one child or one team; a
  person is asked only "whose was it?" (a part refund on a payment for two or more children) or "what now?" (an enrolled
  child whose fee went back).
- **One refund email block** (amount, card or account, date, reference, receipt) in every refund email, both flows; the two
  silent house-league cases now email; the ending email's misdated sentence is fixed; every refund email is dated by the
  refund, not the send.
- **A tournament can refund part of a team's card payment**, with a reason, never including the processing fee, and the part
  refund **lowers that team's entry** by the same amount, so the refund is never owed back (a new per-team entry adjustment).
- **Families and teams can pay by bank debit (Canadian pre-authorized debit)** beside card, in both flows: its own button
  and fee, "Clearing" while it settles (spot held, nothing else to pay or mark), the receipt when it clears, and clear words
  and an item when it's returned, before or after it cleared.
- **One name** for the window "Record the refund sent another way", in both flows. The Families record's "Paid online"
  line and the row ⋯'s "View the payment" (12b's b3/b4) arrive.

## The rulings (do not reopen; record nothing they did not rule)

Verbatim in `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md`: §0b (A2, A4, A11, A13, A14, L1, L2), §0c, §0e, §0f, **§0g (six asks + three
word questions)**, **§0j (ten asks + owner design notes + the word questions)**. The load-bearing ones:
- **The treasurer logs the accounting and never refunds, in either flow (§0f).** Refund doors and refund/collection
  notices go to the flow's desk: house league = owner, club admin, league admin, registrar (`takeFees`); tournaments =
  whoever runs tournaments (`create_tournaments`). The treasurer reads every block and line, with no door.
- **Families pay the processing fee by default; the club may choose to (A14).** The fee goes back only on a full refund,
  by A2's box. **A part refund never includes the fee** (§0e; §0j 1 for teams). FieldLogicHQ's application fee is never
  refunded (§0c).
- **A refund books when Stripe accepts it** (house league). **A registration's payment state is a fact on the payment, never a
  registration status.**
- **§0g:** refund on the cell's second line (fee figure first, card amount second), amber pill only when failed; dotted third
  line for never-in-the-book and "not matched yet"; one refund block in all four house-league refund emails; Money keeps the
  book + one closing line; a dashboard refund records itself whenever pinnable on one child; family emailed when Stripe
  accepts it, never for an unconfirmed or failed refund; "Record the refund sent another way" in BOTH flows (the tournament's
  walked 12a words change); no "Email the family" door on a failed refund.
- **§0j:** team part refund = no fee, reason required, lowers that team's entry ("entry less net paid"; the refund is never
  owed back; a full refund still makes the team owe, as today); a dashboard part refund on a team records itself the same way;
  **"Clearing" replaces A11's "Processing"** for a debit on its way (Payment processing stays the cost line's word); while a
  debit clears there is no Pay, no Mark received/paid, no pay link, no "email families who owe"; an ending while a debit
  clears decides up front (send it back when it clears, by itself, with A2's fee box; or keep it with a reason; nothing
  picked on open); four family emails for a debit (started, receipt at clear with its number then, returned while clearing,
  reversed after clearing); both buttons when the club pays the fee; the saving line names both rails. **Owner design
  notes:** Copy is the symbol alone in a smaller window; a pay button's label is ONE row, the fee as the note under it.

## Read first

- The plan sections above, and the PM brief `CLUB_TIER_STAGE12_PAYMENTS_PM_BRIEF.md` item 5.
- **Build to the drawings:**
  - Refund visibility: https://claude.ai/artifact/RsE8QFyhsi72wjoKqn9VJR (`CLUB_TIER_STAGE12C_REFUND_VISIBLE_DRAWINGS.html`):
    frames a (Fee cell), b (record), c (Money), d (emails + send table), e (Needs attention, incl. "whose was it?" and
    "still enrolled"), f (no card payments = unchanged); the Journeys tab's review table.
  - Team part refund + bank debit: https://claude.ai/artifact/8TkVVEikg16YNS9eqb3HNE
    (`CLUB_TIER_STAGE12C_PARTREFUND_BANKDEBIT_DRAWINGS.html`): frames 1–5 and the review table.
  - The Stage 12 drawings https://claude.ai/artifact/X7quYgnDpiWV9Dh76TYm57 for b3 ("View the payment") and b4 (the Families
    record's "Paid online" line) only. **Their 12c/bank tab is superseded** by the drawing above wherever they differ.
- **The words (settled; build from these, don't re-word):** `CLUB_TIER_STAGE12C_REFUND_VISIBLE_COPY.md` and
  `CLUB_TIER_STAGE12C_PARTREFUND_BANKDEBIT_COPY.md` (both §7s ruled). Where a drawing's provisional words differ, the words
  docs win (they list each contradiction).
- **12b's code is the template**: `lib/online-payment-landing.ts`, `lib/online-payment-receipt.ts`, `lib/online-payment-words.ts`,
  `lib/league-pay-words.ts`, `lib/league-pay-view.ts`, `lib/stripe-connect.ts`, `components/public/PayBlock.tsx`,
  migrations 358, 374–376; and `CLUB_TIER_STAGE12B_BUILD_PROMPT.md` for its traps.
- `AGENTS.md` (Next 16; read the route-handler guide in `node_modules/next/dist/docs/` before a new route).
- **Stripe's current docs, not memory** (memory note: Stripe knowledge went stale twice in one session). The pinned API
  version is in `lib/stripe.ts`. Read the Canadian pre-authorized debit (`acss_debit`) pages for Checkout on a connected
  account with direct charges: the mandate, verification (instant vs micro-deposits), settlement timing, the
  `checkout.session.async_payment_succeeded` / `_failed` events, returns/reversals after settlement and their window, refunds
  of a debit and their timing, any failure fee. §0i proved only that the capability turns on in the sandbox.

## Verified state (leads; re-check each)

**Refund visibility (house league)**
- The Fee cell is built by `feeCell()` in `lib/house-league-registrations.ts` from `feeState()` in `lib/league-money.ts`,
  rendered by `components/admin/kit/club/league/registrations/FeeCell.tsx`. **A refund that reached the book already reads
  "$X refunded / {day} · Online, card"**; "—" (`endedNone`) is only a payment that never went on the registration.
  `feeState` checks `kept` before `refunded`, so **a part refund + kept shows only "kept"**; a booked refund that later
  failed still reads "refunded". Neither the cell nor the record reads `online_payment_refunds`.
- The record is `RegistrationRecordWindow.tsx` (Details, Fee, History, What you can do; no footer). The door "Refund the card
  payment" / "Record the refund sent another way" lives in the row menu and the record's "What you can do"
  (`RegistrationsScreen.tsx`; words in `lib/house-league-money-words.ts`); its route is the `[regId]` PATCH
  (`refundCard`, `refundAnotherWay`).
- The Money page (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx`) reads book lines from the ledger
  route; processing-cost lines are excluded from Refunds.
- `online_payment_refunds` (20 columns; DATA_DICTIONARY) holds status pending/succeeded/failed/canceled, `origin`
  app/stripe_dashboard, `created_by`, `stripe_refund_id`, `booked_at`, `online_payment_item_id`, `partial_reason`. Card
  brand/last4 are on `online_payments`. `leagueCardShares`, `unrecordedCardShares`, `returnedCardRefunds` already read it.
- **Dashboard refunds:** `applyRefundEvent` raises `online_payment_not_recorded` for every house-league dashboard refund
  (title "A house-league card payment couldn’t be recorded") and books nothing; for tournaments it lands a FULL one and
  raises an item for a part one.
- **Emails:** `sendRefundEmail` (receipt module) is tournament-only (bails without `team_id`), called only from `landRefund`,
  and dates the refund at sending (`new Date()`). House league: the ending's refund rides in the ending email as one sentence
  built in `lib/email.ts` `noteAndMoney` from `cardMail` in the `[regId]` PATCH, whose `day` is `tournamentToday()` and reads
  "you paid on {day}" (the misdate, F3); a price correction sends `sendLeaguePriceRefundEmail`. The "couldn't go on this
  registration" door and dashboard refunds send nothing.
- Needs-attention payment items link to the season's Registrations page, not the row (F5). The failed-refund item's button
  and the row's ⋯ name the same window two ways (F6); the house-league item's button string may not exist in code — supply it.

**Tournament part refund**
- `online_payment_refund_open` (current version in mig 376) **raises "A team's card payment is refunded in full"** when an
  amount or item is passed, allows one pending/succeeded refund per payment, and sets amount = base (+ fee by the box).
  `online_payment_refund_land` (mig 358, never redefined) sets the whole `tournament_team_payments` row `refunded`, posts
  "Refunds" + "Processing fee refunded" lines, calls `team_payments_refresh`.
- `team_payments_refresh` (mig 345) sums whole `posted` rows into `teams.total_paid` / `deposit_paid` / `payment_status`; the
  client's `sumPaid` (`TeamPayments.tsx`) counts 0 for a refunded row; status allows posted/removed/refunded only.
- **There is no per-team fee.** `paymentLine` / `owedAmount` (`lib/tournament-teams.ts`) read the tournament's one
  `FeeSchedule`. Ruling 3 needs a per-team entry adjustment (new): who sets it (only a part refund, today), where it lives,
  how `owedAmount`, the team list's owed/paid filters, reminders and exports read it, and that a full refund doesn't create
  one.
- The refund window is `RefundWindow` and "View the payment" is `PaymentViewWindow`, both in
  `app/[orgSlug]/admin/tournaments/registrations/components/OnlinePaymentWindows.tsx`; words `REFUND_WORDS`,
  `TEAM_ROW_WORDS`, `PAY_VIEW_WORDS`; route `app/api/admin/tournaments/[tournamentId]/registrations/online-payments/route.ts`;
  permission `canRefundOnline` (`lib/online-payment-access.ts`). Deposit and balance are separate rows with their own receipts.
- House league's part refund is the model: `refundLeagueToCard` with `p_amount`/`p_partial_reason`, mig 375 (dropped the
  one-full-refund index, added `booked_at`), mig 376's league branch (left = amount less earlier refunds, capped by the book,
  reason required, fee only on a full refund of an untouched share), `online_payments.status` `partly_refunded`.
- Tournament help (`lib/help-content/tournaments.tsx`, "Refunding a card payment") says "full refunds only" and that a
  dashboard part refund needs a person; it also still says the treasurer can email the pay link (against §0f).

**Bank debit**
- **Nothing is built.** `createCheckout` (`lib/stripe-connect.ts`) sets `payment_method_types: ['card']`. The rate exists:
  `ONLINE_PAYMENT_RATES.bankDebit` (`lib/plan-config.ts`); `onlineFee(base, payer, rail)` and `onlineFeeRateLabel(rail)`
  already take a rail. `online_payments.status` has no clearing state; the Connect webhook
  (`app/api/payments/connect-webhook/route.ts`) handles `async_payment_succeeded` only. Card brand/last4 are the only
  "how paid" facts; a bank payment needs a rail and the account's last four.
- **The double-pay hole:** `lib/league-pay-view.ts` (`kindOf`, `receiptsFor`) and `lib/team-pay-view.ts` decide owing from
  the book and paid rows; a clearing debit is in neither, so Pay would show again. Fix at the server, not only the screen.
- The pay block (`components/public/PayBlock.tsx`): `PayButton` (left icon, label "Pay {total} by card", fee as `.note`
  under it, full width ≤640px), states confirming / not finished / paid (`ReceiptCard`, card-only), no clearing state.
  Both flows use it (`LeaguePayBlock.tsx`, `TeamPayContent.tsx`). The header says the second rail is added in one place.
- "Payment processing" is already a cost line word on the Money page (`W.what.processing`, `processingBack`). The band is
  `MoneySummaryBand` (up to 4 tiles; tones plain/good/warn/danger only — the Clearing figure is plain).
- `RepChip tone="info"` already means "sent, waiting on the other side": the clearing chip.
- The team pay view's `savingCents` is card-computed; `payOptions` (`lib/team-pay-options.ts`).
- Payouts words print one card rate (`W.ratesLine`, `before.costRate`, `record.feeRates`, `notSetUpBody`; the payouts route
  passes `onlineFeeRateLabel('card')`).

## Before any code

1. **Product-manager UX summary** (AGENCY_RULES, blocking): what a family, a team contact, the house-league desk, the
   tournament organizer, the treasurer and the owner see differently, with the role differences. Get the owner's yes.
2. **Stripe facts, from the current docs, written into plan §0j before Part 5:** the pre-authorized debit path on Checkout
   for a connected account with direct charges (mandate text is Stripe's), verification, the real "up to N business days",
   refund timing to a bank account, the reversal window after settlement, the event names, and any failure fee. Words that
   depend on them stay tokens until then (`{bankDays}` etc.); if a fact can't be stated honestly, its sentence goes.
3. **Bring these to the owner as short proposals with a recommendation, before building them:**
   a. **The per-team entry adjustment:** its shape (one adjustment per team or a list of them), where it shows besides the
      record (team list, exports, the public team page — recommend not public), and that only a part refund creates one.
   b. **Who bears a returned debit's cost** (if Stripe charges one) — `/billing` reads the Facts doc first; never a typed fee.
   c. **The landing order for an asynchronous debit:** clearing recorded at session completion, landing through the flow's own
      writer only at `async_payment_succeeded`, a return before settlement touching no book, a reversal after settlement
      writing a returned line (never deleting the receipt). Idempotent under replayed and out-of-order events.
4. **`/dba` on the migrations** (dev only; the latest on disk is 381 — check): the team part refund (drop the full-only rule
   for teams, a refunded-so-far amount or partial status on a team payment row, `team_payments_refresh` summing amount less
   refunds), the per-team entry adjustment, a rail on `online_payments` + a clearing status + the bank account's last four,
   whatever the reversal needs, and any refund-view helper. RLS on every table, `docs/agents/db/DATA_DICTIONARY.md`, both
   snapshots (`npm run refresh:snapshots`), `npm run check:dictionary`. Declare each in `MANUAL_PROD_STEPS.json` (mig 361–363,
   368–372, 374–376 and others already wait ahead).

## What to build, in parts

**Part 1 · Schema (commit first).** The migrations above, with tests on the SQL: a team part refund capped by what's left;
a second part refund; the fee never on a part refund; the entry adjustment; `team_payments_refresh` netting refunds; the
clearing status can't count as received.

**Part 2 · Refunds you can see (house league).** The Fee cell's second line and amber pill (its door is the existing
"Record the refund sent another way" window), the never-in-the-book and "not matched yet" third lines, part refund + kept,
the record's "To the card" block (Copy: word in the 640 record, symbol on a phone), Money's closing line, payment items
opening the child's record (F5). Read refunds once per screen (no per-row query). A club with no card refund sees today's
screens word for word (frame f).

**Part 3 · Refund emails and refunds made in Stripe.** One refund block for every refund email in both flows; the two silent
house-league cases email; the ending sentence fixed (F3) for every method; every refund email dated by the refund. Dashboard
refunds: house league records itself when pinnable (whole payment, or any amount on a one-child payment; a refund counts
against the fee first, anything above it is the processing fee given back); "whose was it?" (with split) and "what now?"
(Withdraw / Email the pay link / Keep enrolled, the email waiting for the answer) as items that clear only when answered;
"matches no payment we recorded" for out-of-order events. Tournaments: a dashboard part refund records itself and lowers the
entry. Book and Stripe never disagree; a replayed event writes nothing twice.

**Part 4 · A team's part refund + one name.** The refund window (nothing picked; All of it = today's choices; Part of it =
amount, reason, note, capped at what's left, "All of it" absent after a part refund, the pointer to the other row), the
payment row's tags, the entry-adjustment line and the summary ("Owes $300.00 · paid $60.00 of $360.00"; the failed-refund
summary), "View the payment" with refund blocks (Copy as the symbol: a smaller window), the team's part-refund email with
the balance line, the tournament help. **F6:** "Record the refund sent another way" in both flows, every key the words doc
lists, help keywords included.

**Part 5 · Bank debit, the family and the team.** The second rail in `createCheckout` and both pay routes; the pay block's
bank button (same shape, outlined, its own total and fee note, one-row label; both dim on press; club-pays shows both at the
base); the clearing, cleared (bank line on the receipt), returned-while-clearing (the bank's reason when Stripe gives one) and
reversed-after-cleared states; the server refusing a second payment while one clears; the four emails; siblings on one debit
clearing and returning together; the team pay page's two-rail saving line; test-mode marks.

**Part 6 · Bank debit, the desk.** The Fee cell's info chip and second lines (single, sibling, returned with reason,
reversed); Mark received / Email the pay link absent while clearing and "Email families who owe" skipping them; the ending
windows' clearing variant (send it back with A2's box, or keep with a reason; a sibling's share; not offered after payouts
are disconnected); the send-back when it clears, failing into the existing refund-failed item worded for an account; the Money
band's Clearing tile (plain, only while non-zero) and the band note; the book's bank receipt and returned lines; the items
(one per debit naming every child; reversed after cleared); the team record's clearing row and summary, no past-due while
clearing; "Disconnect payouts?" counting clearing debits; both rates on every payouts line, printed from the constant.

**Part 7 · The Families record and "View the payment" (12b's b3, b4).** As the Stage 12 drawings draw them, opening the
registration's record at its Fee section so a payment and its refunds are read in one place (§0j).

**Part 8 · Help, copy sync, demos, layout.** `/docs` for every changed flow (refunds you can see, team part refunds, bank
debit, the rename, the treasurer line in the tournament help); 12a's family lines that say "Stripe" (words doc note); comments
that say "12c" or "full refunds only". `npm run check:spelling`. Demos follow the product. `check:layout --changed` on the
touched screens at 1440 and 390, Warm and Dark; never a whole-product sweep on dev.

## Definition of done

- Parts 1–8 committed; `npm run verify:changed` and `npm run typecheck` clean; `/review` on Part 1, on Part 5 (the new rail)
  and on the whole.
- Unit tests: fee arithmetic per rail against the Facts doc line; the team part refund (cap, second part, no fee, reason,
  entry adjustment, `owedAmount`); dashboard-refund pinning (whole, one child, two children, above the fee, out of order);
  the refund block's dates; the double-pay refusal while clearing; async landing idempotency under replay and reorder; a
  return before and after settlement; the treasurer never offered a door; the switch off in production.
  `scripts/house-league-money-check.sql` extended for a bank receipt and a returned line.
- **End to end in test mode** on the test Express account from the 12a/12b walks (bank debit enabled on it for the run, then
  restored as §0i did): every refund state of frame a; a dashboard refund of each kind; a team part refund on a deposit and
  on a paid-in-full team; a family and a team paying by debit through clear, return and reversal (Stripe's test account
  numbers); a decline while clearing (send back and keep); siblings on one debit. The email checks belong to the ONE final
  end-to-end pass on Amplify dev once Stage 12 is built: write them into that pass.
- **The 12c walk:** a checkable Artifact plus the next § in `OWNER_QA_LEDGER.md` (check the latest number), one purpose per
  walk — likely two walks (refunds; bank debit). Owner, registrar, tournament organizer, treasurer, and a family and a team
  contact on a phone. Club plan on `uat-rep-club`; League Plus on `dev-league-org`.
- **Records:** plan §0 and §4 (12c state, anchors), PM brief item 5, the Club index (`ArtifactData`, artifact
  `MBKRySURVFu3V9cZJvmjVr`, stage `s12`; read first and pin `if_version`), the memory file `project_club_stage12_payments`;
  the Facts doc only if a rate or gate changed (it shouldn't).

## Do not

- Charge real money, use a live key, or switch the feature on in production.
- Build disputes, paid twice, a payouts list, the GST/HST rider or offboarding (12d), rep-team dues online (A5), saved cards.
- Give the treasurer a refund or collection door, or widen the tournament refund permission for house league.
- Write a second money writer: house league lands through `writeLeagueMoney` only; tournaments through the tournament payment
  writer only. Never delete a receipt or a book line to undo money; write the returned/refund line.
- Restate a rate or a Stripe timing anywhere; print it from the constant or from the facts recorded in Before-any-code 2.
- Reopen a ruling. If the code says one can't be built as drawn, bring it to the owner drawn, before building around it.
- Push or promote.

## Git

- `dev` only; explicit pathspecs; `git show --stat HEAD` after every commit. Another session's work may be staged: build
  your commit in a temporary index (memory: "Partial commit out of shared files").
- Part 1 in its own commit. Migrations stay on dev, declared pending in `MANUAL_PROD_STEPS.json`.
- No push and no promote without the owner's word.
