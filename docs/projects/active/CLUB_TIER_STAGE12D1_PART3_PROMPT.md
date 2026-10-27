# Club Tier Stage 12d-1, Part 3: a card dispute is seen and answered (handoff prompt)

> **Written 2026-10-27** at the end of Part 2's session. Paste this into a new chat on `dev`. The parent prompt is
> `CLUB_TIER_STAGE12D1_BUILD_PROMPT.md`: its rulings, its "Do not" list and its Git rules all apply. **Re-verify every
> lead below before building on it.** Other sessions share this working copy: commit only your own hunks, from a
> temporary index (memory: "Partial commit out of shared files"). ⚠ After a temp-index commit, resync the shared index
> for **your paths only** (`git reset -q -- <your paths>`), never `git reset -- .`: that unstages other sessions' work.
>
> **Recommended model: Opus 5.5.** Helpers stay on Sonnet. **`/review` runs on this part** (a new event family on money).

## Where things stand

- **Part 1 (schema) is committed on dev:** `c938e871a` (mig 390) and `380528304` (mig 391, its /review). Dev only, declared
  pending in `MANUAL_PROD_STEPS.json`. Both SQL checks pass (`scripts/online-payments-12d1-check.sql`, the 12c one).
- **Part 2 (paid twice) is committed on dev:** `23510b099`. No schema change. What it built, so you can lean on it:
  - `raiseOverpaid(onlinePaymentId)` and `overLeft(ids)` in `lib/online-payment-landing.ts`. ⚠ mig 391's
    `online_payment_dispute_apply` can make a payment **extra again** (a win after a loss puts the money back, "the rest
    extra"). Call `raiseOverpaid` after a dispute is applied when its answer carries `over > 0`.
  - `lib/online-pay-pages.ts`: closes open pay pages after any hand recording (nine paths).
  - The rulebook (`lib/needs-attention.ts`) already has **`card_disputed`** and **`card_dispute_lost`**, with the rule the
    words state. **The contract your raise must keep:**
    - every copy carries `onlineDisputeId` (the `online_payment_disputes.id`, which is also the one-open index key);
    - the answerer's copy (the person who set up payouts) carries `answerer: 'yes'`: it clears once `answered`, and
      every other copy waits for the decision (won, prevented and a closed inquiry read "won"; lost reads lost);
    - a lost item also carries `teamId` **or** `registrationIds` (comma-joined), like 12c's reversed debit: it clears
      when paid in full or ended, and at once if the bank later turns the loss into a win (`won_back_at`).
    - "The dispute was lost." (`SETTLED_WORDS.disputeLost`) is **derived**, not in the words file: confirm it with
      `/marketing` or replace it.
  - `raiseOnce`'s kind union already includes `online_payment_over`; add the two dispute kinds when you raise them.
  - The card's country is written after landing (`writeCardCountry`, both flows). Part 4 bills from it.

## What Part 2 learned (read before you design)

1. **A Needs-attention item has ONE link and no buttons.** `components/notifications/NotificationFeedBody.tsx` renders a
   row that opens `link`; there are no per-kind actions. The words' "buttons" (`attention.dispute.button.answer`,
   `.record`) therefore become: the item's link opens the record; **Answer in Stripe** and **Copy the facts** live on the
   record's dispute block (words §1.2), never on the item. Part 2 did the same for paid twice: one link to the team with
   `?team=…&refund=…`, which opens the refund window set. If you want the item itself to carry two doors, that is a
   drawing question for the owner, not a build call.
2. **An app route that imports `lib/online-payment-landing` or `lib/stripe-connect` must read `onlinePaymentsOn()`**
   (`tests/unit/online-payments-guard.test.ts`, except the two webhooks). A read that must work with the switch off goes
   through a `lib/` module (Part 2 moved the "extra still standing" read into `lib/team-payments-server.ts` for that).
3. **The census missed paths before; it will again.** Part 2's prompt listed seven hand-recording paths; the code had
   nine (a shared transfer split across teams, and the Families record's Record a payment). For disputes, census every
   place that shows a payment's state in **both** flows (team record row, View the payment, the house-league Fee cell
   and phone row, the Registrations band, the season book, the Refunds tab) before you call the list done.
4. **`formatTime()` ends in "p.m."**: a sentence that ends on a clock must absorb its own full stop. `{due}` in
   "Answer in Stripe by {due}." hits this ("…by Nov 11 at 7:59 p.m.."). Part 2's `PAY_OPEN_WORDS.notice` shows the fix.
5. **The gates on this tree right now** (none from Part 2; re-check, another session may have fixed them):
   - `npm test` has 6 failures in files no 12d-1 part touched (coach-membership projection, migration grants, the
     possessive guard on `TryoutCoachAddressLine.tsx`, team-move coverage, the Teams toolbar regex, which also fails at
     HEAD). `verify:changed` stops at `npm test`, so run its later checks one by one (`package.json` lists them) and
     sort yours from theirs.
   - `check:layout` needs the UAT fixture: on 2026-10-27 **every** house-league and tournament screen landed on "Page not
     found" (untouched screens too), after the sessions were refreshed. Re-seeding signs every session out (memory:
     "A seed's password reset signs everyone out"): ask before you seed.
6. **"Keep it" words were adapted** to ruling 5 (a note, never a credit): the title, toast and settled line drop "as a
   credit" (`OVER_WORDS.keepTitle`, `keepDone`, `SETTLED_WORDS.overKept` "Kept by the club"). Flag for `/marketing`
   with Part 3's own derived words.

## Part 3: what to build (parent prompt §"Part 3", frame 1, words §1.1–1.6)

- **The webhook** (`app/api/payments/connect-webhook/route.ts`) handles `charge.dispute.created`, `.updated`,
  `.closed`, `.funds_withdrawn` and `.funds_reinstated` for a **card**, through the landing module only.
  - **Re-read the dispute from Stripe on every event** (events state no order; plan §0 "Stripe facts"), then
    `online_payment_dispute_apply` (mig 391: stale reads change nothing, a loss books once, a win after a loss restores
    once). A `closed` before its `created` writes once and correctly.
  - **A bank debit keeps 12c's path exactly** (`reverseDebit`, which returns early for a card today). Keep its test.
  - The fee: ruling 5 ("bill only what Stripe charged us"). The sandbox showed a **card** dispute's fee taken from the
    **club's** Stripe balance: record it on the dispute (`stripe_fee`, `fee_paid_from = 'club'`), never invoice it. A fee
    on the **platform's** balance (a platform balance transaction whose source is the dispute) is Part 4's to bill.
    Ruling 6's two sentences print only when Stripe reports each figure.
- **The record, both flows:** status, reason (mapped or nothing; "fraud" never printed), amount, `{held}`, the due date,
  the outcome. No refund door while a dispute is open (words H). A lost dispute writes the returned line; the child or
  team owes again; FieldLogicHQ's fee is not returned. A won dispute is plain paid.
- **Amber and the item go to the person who set up payouts only** (`canConnectPayouts`; the owner in the usual case).
  Everyone else who reads the payment sees it in the info colour, with that person's name.
- **Answer in Stripe** (the Express dashboard login link, `dashboardLink`; never emailed) and **Copy the facts**
  (words §1.3; the symbol alone in a small window, the longer words its accessible name). Nothing is submitted.
- **No family email.** The two emails to the answerer (§1.6: opened, and three days before due) are the daily job's
  (owner ruling 2 in plan §0): **the job itself is its own commit** (AGENCY_RULES watched paths) and may be Part 4's. If
  you build the "opened" email here, stamp `opened_emailed_at`.
- **Tests:** a card dispute's whole life (created → won; created → lost; replayed; out of order; a loss then a win); a
  bank-debit dispute exactly as 12c; amber only for the answerer; no refund door while open; "fraud" never printed.
- **Gates:** `npm run typecheck`, the checks above, the two SQL checks if SQL changes, `check:layout` on the touched
  screens at 1440 and 390, Warm and Dark, if the fixture is whole (else say "skipped" and why).
- **Commit locally on dev; `/review` on this part.** Write the Part 4 handoff (`CLUB_TIER_STAGE12D1_PART4_PROMPT.md`)
  at the end, with what this part learned.

## Not this part

- Fee billing, own invoices, the scheduled job's invoice and reminder runs, the Plan & billing list (Part 4).
- Help, the Stripe setup guide's event list (the owner adds the events in Stripe himself), the walks (Part 5).
- Anything in 12d-2.
