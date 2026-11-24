# Board Ready Stage 6 · Part 3b — the Payouts tab and the bank check learn sponsorship card payments — Implementation Plan

> **Status:** In Progress (planned and started 2026-11-24)
> **Created:** 2026-11-24
> **Branch:** dev
> **Parent:** `BOARD_READY_STAGE6_P3B_AFTER_WALK_FIXES_PROMPT.md` item 1 (walk §564 owner call (i), ruled "plan item, separate from this part", 2026-11-24)
> **Gate:** Club tier (Payouts tab + Bank tab). **No migration, no database change.** Must land before `ONLINE_PAYMENTS_ENABLED` is turned on for a real club.

## Goal
A sponsor's card payment, its refunds and its card fee must read as what they are on the club's **Payouts tab** ("Sponsorship", not
"House league"), and the **bank check's** "Stripe on its way" figure must clear a sponsorship payment's book lines when the
payout that carries it arrives, and a sponsorship refund's lines when its refund is paid out. Today (verified in code,
`lib/online-payouts.ts`): a sponsorship payment falls into the league branch (`what = 'House league'`, lines 248–261); of its book lines
only the card-fee cost line is keyed to a payout (flow-blind loop, line 165), so the income, GST/HST and passed-on-fee lines
keep counting as "on its way" for 30 days after the money arrived, overstating the bank check by about the sponsorship; a
sponsorship refund is never found in the refund map (`club_sponsor_deal_refunds` is read nowhere in the payout code), so its
two out-lines stay "on its way" and the payout line carries no book lines.

## PM Brief
**What it does:** When a club is paid a sponsor's card payment, the Payouts tab names it as a sponsorship from that business, and
the bank check counts it as arrived once the bank deposit lands, and counts a sponsor's refund as gone once Stripe takes it out.
**Why it matters:** The bank check is the treasurer's "does the bank agree with the books" tool. Without this, a club that sells
sponsorships by card would be told the bank is off by roughly the sponsorship amounts for a month, and the Payouts tab would call
sponsor money "House league".
**Who benefits:** Club treasurers and admins on the Club tier who take sponsorship money by card.
**Expected impact:** Payout lines read "Walk Card One · Sponsorship · card"; the bank check says "Matches" when the bank agrees; no
new screens, buttons or settings.
**Priority:** High — blocks turning online payments on for a real club.
**Success criteria:** A walked sponsorship payment, part refund and full refund each show correctly on a payout line with their
book lines tied to it, and the bank check figure equals the bank to the cent before and after the payout arrives.

## Phases

### Phase 1 — The Payouts tab names a sponsorship (`lib/online-payouts.ts`)
- [x] Widen the flow type on the payment rows to include `'sponsorship'` and read `sponsor_deal_id` in the select.
- [x] Read each sponsorship payment's business name (`club_sponsor_deals.business_name`, falling back to the sponsor's name, then the
      payment description) and name the line: `who` = the business, `what` = the one word "Sponsorship" (kept in `PAYOUT_LINE_WORDS`; draft for `/marketing`).
- [x] A sponsorship refund's Stripe `re_…` id is found: read `club_sponsor_deal_refunds` (`stripe_refund_id`, `online_payment_id`, same org)
      into the refund map beside `online_payment_refunds`.

### Phase 2 — The bank check keys every sponsorship book line to its payout
- [x] `entryIndex`: for sponsorship payments read `club_sponsor_deal_payments` by `online_payment_id` and key the **income, GST/HST,
      passed-on-fee income and fee cost** lines (`income_entry_id`, `tax_entry_id`, `fee_income_entry_id`, `fee_cost_entry_id`) to the payment
      (the fee cost line is already keyed through `processing_cost_entry_id`; keep it once). Paged read (`fetchAllIn`).
- [x] `entryIndex`: read `club_sponsor_deal_refunds` for the payout's refund ids and key the refund's **income** and **GST/HST** out-lines
      (`income_entry_id`, `tax_entry_id`) under its `stripe_refund_id`. A failed refund's lines are voided, and the bank check already ignores void lines.
- [x] No change to `lib/bank-club-read.ts`, `lib/bank-club-map.ts`, `lib/online-payouts-map.ts` logic (they key on `entryIds` and
      payment method only), and the bank code stays read-only (guard `bank-r2-server-guard`, `bank-club-read.test.ts` literals kept).

### Phase 3 — Tests and records
- [x] Add a sponsorship payment, a sponsorship refund and a sponsorship fee to the fixtures in `tests/unit/online-payouts-list.test.ts`
      and `tests/unit/bank-club-read.test.ts` (named correctly; `entryIds` carried; "on its way" cleared at arrival).
- [x] Source pins for the two new reads (style of `online-payouts-list.test.ts` 150–166).
- [ ] `/marketing` pass on the word "Sponsorship" (with the rest of the after-walk words), `npm run check:spelling`.
- [ ] Add one step to walk §564 (Payouts line reads Sponsorship; bank check clears on arrival) — owner walk after the whole after-walk list.
- [ ] Update the board line + `BOARD_READY_PLAN.md` bullet when committed (commit at the owner's yes only).

## Architectural Decisions
- **Decision:** key sponsorship lines through the sponsorship tables, not a new column on the ledger. **Rationale:** the lines already
  have back-links (`club_sponsor_deal_payments.*_entry_id`, `club_sponsor_deal_refunds.*_entry_id`); a database change is not needed, which keeps this item
  out of migration 531.
- **Decision:** a Stripe-dashboard refund of a sponsorship (not booked by us) stays unkeyed here. **Rationale:** it has no book line today; fix #8
  (book it and count it against `refundable`) will give it one, and the same key then carries it.
- **Decision:** a sponsor's lost card dispute is not handled here. **Rationale:** it is after-walk fix #8 (`/accounting` first); when it books lines they
  will be keyed in the dispute index by that fix.

## Words for /marketing
- [ ] "Sponsorship" — the Payouts tab's payout line (`Walk Card One · Sponsorship · card`) — the club's treasurer.

## Open Questions
- [ ] None blocking. Owner may want the line to name the package instead of the single word "Sponsorship"; recommendation: one word, since the business name already says who.
