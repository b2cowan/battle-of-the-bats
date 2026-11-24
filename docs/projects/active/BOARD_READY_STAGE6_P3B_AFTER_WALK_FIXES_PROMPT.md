# Board Ready Stage 6 · Part 3b — the fixes to run AFTER the owner finishes walk §564

Paste into a fresh session: **"Read and follow docs/projects/active/BOARD_READY_STAGE6_P3B_AFTER_WALK_FIXES_PROMPT.md"**

Written 2026-11-24 by the session that ran Part 3b's `/simplify` and `/review` (five lenses). Owner, same day: **"I want all of
those fixed … log it to run these fixes after I finish the walk."** So: do NOT start these before the owner pastes back the
walk result (§564, `BOARD_READY_STAGE6_P3B_CARD_WALK.html`). Fixes made during a walk change what the walk shows, which is the
reason the prompt orders review before walk; this list is what the review found that was too big, or too database-shaped, to
fold in while the walk was open.

## ⛔ Start conditions
1. The owner has pasted the walk's result. Read it first: a failing walk step may overlap an item below, or add one.
2. `git rev-parse --abbrev-ref HEAD` is `dev`. Part 3b is still uncommitted (check `git log -3 -- lib/sponsor-card-server.ts`).
3. Typecheck clean and the Part 3b suites pass (`board-ready-stage6-p3b`, `-p3a`, `-deals`, `online-payments-guard`,
   `notification-facts`). Run tests from the repo root.
4. **A database change needs the owner's word in THIS conversation** (dev applies, and any edit to migration 530, which is applied
   to dev and pending on production). Ask once, up front, for all the SQL items together, and list which.

## Already fixed in the review session (do NOT redo; verify they still hold)
- Choosing cheque/e-transfer closes an open card page first (a sponsor could pay on a stale page and be charged AND invoiced).
- A club edit of the amount or tax closes an open card page first / refuses while it is being paid.
- A refund the card refused before it booked no longer reads "lines voided, send it another way" (new `booked` flag).
- The `notification-facts` guard counts (4 and 4) for the two new sponsor notices.
- The public sponsor page and the deal GET no longer 500 when the "unrecorded card payment" read errors.
- Pinned by the last `describe` in `tests/unit/board-ready-stage6-p3b.test.ts`.

## The fixes (owner: all of them). Ranked; `{db}` = needs a database change and the owner's word
1. **Payouts tab and bank check don't know a sponsorship payment** `{no db}` (owner call (i), raised by the review to the top).
   `lib/online-payouts.ts` (`ourIndex`/`entryIndex`: the sponsorship flow falls into the league branch, labelled "House league";
   its income / GST/HST / fee lines and `club_sponsor_deal_refunds` are never listed), `lib/bank-club-read.ts`,
   `lib/bank-club-map.ts`. A sponsor's payout must read as a sponsorship, its book lines must count as "arrived" when the payout
   does, and a sponsor refund's Stripe line must match. **This must land before `ONLINE_PAYMENTS_ENABLED` is turned on for a
   real club** (card on sponsorships shares the one switch). Run `/plan` first: the bank check has its own plan and walks.
2. **A "not recorded" sponsor payment wedges the deal** `{db}`. The op stays `paid` with `landed_at` null, so the sponsor's page
   says "received" forever, card is refused, Send the invoice is refused, and a refund the club makes in Stripe (as the notice
   tells it) never sets the payment `refunded`, so `online_payment_not_recorded` and `card_refund_unmatched` never clear. Withdraw
   is the only exit today. Build: when a dashboard refund covers an unlanded sponsorship payment, set it refunded (a function, like
   `club_sponsor_card_op_state`), clear both notices, raise no "unmatched". Consider also a club action "I've refunded this".
3. **A pending card refund can stay pending forever** `{no db possible, db better}` (walk owner call (h)). `refundToCard` throwing a
   connection/API error leaves a `pending` row with no Stripe id; no event will ever arrive; it holds back the payment's refundable
   amount. Build a retry/cancel sweep (the idempotency key is the refund id, so a retry is safe) or a club "cancel this refund"
   action. Also: any OTHER thrown error currently marks the refund `failed` though Stripe may have created it, so a refund that
   landed is never settled (`applySponsorRefundEvent` skips `failed` rows). Re-read Stripe before deciding failed.
4. **`ends_deal` is fixed when a refund OPENS, never re-checked when it BOOKS** `{db}` (mig 530 ~602-605 vs ~681-687). With a
   pending refund still counted as returned, a later payment, or a pending refund that then fails, leaves a deal Withdrawn with
   money standing. Recompute under the deal lock at booking; a failed pending refund must not leave an ended deal ended
   without the club being told.
5. **`club_sponsor_deal_payments.online_payment_id` is `ON DELETE RESTRICT`** `{db}` (mig 530 line ~184). Every other FK into
   `online_payments` is NO ACTION; RESTRICT is checked immediately, so deleting an organization that has a landed sponsor card
   payment can fail depending on cascade order. Unconfirmed by running a delete: confirm on dev with a throwaway org first.
   Fix is one `ALTER` (a new migration if 530 is already on production by then; an edit of 530 plus a dev re-apply if not).
6. **The failed-refund and unmatched-refund notices don't fit a sponsorship** `{no db}`.
   - `card_refund_failed` says "Send the money another way, then record the refund", and the bell action is "Record the refund
     sent another way"; the deal page has no such door (only another card refund). Give the sponsor notice its own words and
     action (`/marketing` for the words), and make its resolver clear on what the club can actually do.
   - `card_refund_failed` is keyed on `onlinePaymentId`, so a second booked-then-bounced refund on the same payment raises no
     notice while the first is open. Key on the refund (`sponsorRefundId`).
   - `raiseSponsorRefundFailed` can throw after the failed RPC commits (Stripe retries; the row is `failed` so the retry
     `continue`s): the notice is lost. Raise the notice idempotently from the failed state.
   - `card_refund_unmatched` never auto-clears (its resolver only reads `online_payment_refunds`); and
     `lib/notification-labels.ts` (about lines 76-77, 164-169) still says "a team's card" / "clears when the payment arrives".
   - An early dashboard refund (event before the payment landed) is raised to the team/league desks and never re-applied after
     landing (`raiseUnmatched`, `reconcileDashboardRefunds`): route a sponsorship's to Sponsorships and reconcile after landing.
7. **Credit notes** `{db}`. A refund booked (and emailed with "…-C1") then failed keeps `credit_seq`, so the note is gone, the
   number is burned and the next is C3 with no C2 on record: either keep the note downloadable marked void, or release the number,
   and email the business a correction. A refund so small its tax rounds to $0.00 gets no credit note though the sponsorship was
   reduced (accounting ruling: every refund on a taxed invoice carries one).
8. **The said-out-loud items, now to be built** (owner: all fixed):
   - a sponsor's **card dispute** (lost) is booked: the amount back out, the dispute fee as a cost line, a notice to Sponsorships
     (`applyCardDispute` returns early today; walk owner call (b)). `/accounting` first (its advice was to build the notice and
     the books reversal before shipping).
   - a refund made in the club's own **Stripe dashboard** counts against `refundable` (and is offered to be booked) instead of
     only being announced.
   - drop Stripe's `re_…` reference from the BUSINESS-facing refund email (`lib/sponsor-invoice-email.ts` `emailDealRefund`
     passes `reference: refund.stripeRefundId`; walk owner call (e)).
   - soften "It takes 5 to 10 business days to appear" (walk owner call (d); `/legal`'s note in
     `docs/agents/legal/BOARD_READY_STAGE6_PART3B_CARD_REVIEW.md` §4).
   - a card refund on a deal that also holds a cheque leaves the deal Paid with money owing again (walk owner call (g)).
9. **Smaller** `{no db}`:
   - throttle the public "confirming your payment" GET (`app/api/public/sponsorship/[token]/pay/route.ts`) and keep the status
     poll from re-landing a not-recorded op every 2 seconds; the public pay route shares the forms' global limiter keyed on a
     client-supplied first `X-Forwarded-For` hop.
   - `expireCheckout` is not try/caught in `lib/sponsor-card-server.ts` (a session that completes between retrieve and expire
     turns into a generic 500 instead of the "card paid" answer).
   - the refund route's `left` in the "up to $X" message comes from its earlier read, not the lock (stale after a race).
   - the Checkout session is created at Stripe before its `online_payments` row is inserted (a crash between leaves a payable
     page with no record): insert first, or expire on failure, as the shipped flows do.
   - an open sponsor card page is not counted or closed by plan-ending / disconnect (`lib/online-payment-endings.ts`).
   - the refund window's `refundLeft` is computed in TS and again in SQL (the review's cheaper alternative: a unit test pinning
     the two together); "withdrawn by refund" is re-derived in five places (one predicate).
10. **Left as designed, say so if asked, no change**: any member who opens Sponsorships can refund (the ruling "who refunds = who
    records and voids", walk §562) — a design flag for a later owner call, not a defect.

## How to run it
1. Read the walk result. Then `/plan` the SQL items together (2, 4, 5, 7, and 3 if a sweep needs a column) as ONE migration
   `531_…` (or an edit of 530 if it is still not on production — the owner decides; dev needs a re-apply either way), with
   `DATA_DICTIONARY.md` and `npm run refresh:snapshots` in the same unit of work, and `MANUAL_PROD_STEPS.json` updated.
2. Build item 1 on its own plan (bank check). Items 6 and 8's words go through `/marketing`; 8's dispute books through
   `/accounting`; the Terms' dispute and refund-timing lines through `/legal` (the published Payments Terms are version
   `2026-11-24`: a change is a NEW version, never an edit).
3. `/simplify` then `/review` the new diff (re-review the fixed parts only). Re-run the probe (`.probe/stage6-p3b-money-probe.mjs`;
   add a cheque-switch, a terms-edit-with-open-page, a dashboard-refund-on-unlanded, a pending-refund-that-never-arrives case,
   and a real completed Checkout, which the earlier probe never did).
4. Update walk §564 (new steps for the changed behaviour; do NOT sort the § numbers) and tell the owner exactly which steps to
   re-walk.
5. The commit follows `BOARD_READY_STAGE6_P3B_FINISH_PROMPT.md` "The commit" section, at the owner's yes only; the post-commit
   record goes in `BOARD_READY_PLAN.md`, the board line and the ledger.
