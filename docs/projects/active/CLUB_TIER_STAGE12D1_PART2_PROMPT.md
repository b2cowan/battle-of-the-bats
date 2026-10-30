# Club Tier Stage 12d-1, Part 2: a team never overpays silently (handoff prompt)

> **Written 2026-10-27** at the end of Part 1's session. Paste this into a new chat on `dev`. The parent prompt is
> `CLUB_TIER_STAGE12D1_BUILD_PROMPT.md`: its rulings, its "Do not" list and its Git rules all apply. **Re-verify every
> lead below before building on it.** Other sessions share this working copy: commit only your own hunks. The data
> dictionary and `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` carry another session's uncommitted edits, so commit them from a
> temporary index (memory: "Partial commit out of shared files").
>
> **Recommended model: Opus 5.5.** Helpers stay on Sonnet.

## Where things stand

- **Part 1 is committed on dev:** `c938e871a` (migration 390) and `380528304` (migration 391, the /review fixes). Both
  migrations are applied to dev only and declared pending in `MANUAL_PROD_STEPS.json`.
  - Both SQL checks pass: `node scripts/db-query.mjs --dev -f scripts/online-payments-12d1-check.sql` (ends in
    `ONLINE_PAYMENTS_12D1_PASSED`) and the 12c one.
  - Rerun both after any SQL change.
- **The UX summary is approved.** All rulings to date are in plan §0, "12d-1 build state": the four build asks, the Stripe
  facts, the sandbox probe and rulings 5–6. Read that block first; it is the record. It also says:
  - every hand-recording path closes an open pay page, and only the three drawn screens warn;
  - one daily scheduled job is approved (Part 3/4's, not this part's);
  - own invoices go out monthly;
  - the club reads its fees on Plan & billing;
  - "bill only what Stripe charged us".
- **What the database already does for this part (mig 390/391):**
  - `online_payment_land` books a team's online payment in full and records any extra on `online_payments.over_amount` /
    `over_whole`. It returns `over` and `overWhole`, but **not on a replay**: a replay returns `{already:true}`, so read
    the row.
  - `online_payment_over_left(id)` is the extra still standing, read live. It is 0 once refunded, once a refund is
    recorded another way, once the entry is raised, or once kept.
  - A part refund now returns what was paid past the entry first, and never lowers the entry for it.
  - "Keep it" is `over_kept_reason` / `over_kept_by` / `over_kept_at`, all three set together (reason 1–500 characters).
    The trigger does not guard them, so the server writes them.
  - `online_payments.card_country` exists. The server writes it after landing, from the charge's
    `payment_method_details.card.country`, in both flows. Write it in this part; Part 4 bills from it.
  - The Needs attention kind for this part is `online_payment_over`. It is already in the SQL partial indexes and in the
    one-open index (keyed on `onlinePaymentId`).

## Part 2: what to build (prompt §"Part 2", frame 2, words §2.1–2.3)

1. **Landing (tournament flow).** After `online_payment_land`, when the row has `over_amount` and
   `online_payment_over_left > 0`:
   - Raise `online_payment_over` once, through `raiseOnce`, to whoever runs tournaments and the owner.
   - Words: `attention.twice.*` when `over_whole`, else `attention.more.*`. On the bank rail, say "bank debit" and
     "Refund it to the bank account".
   - Its buttons: **Refund to the card**, which opens the refund window preset, and **Open the team**.
   - Raise it on a replay too: the row is the truth.
   - It clears itself when the extra is 0 (`clearSettled`), with the settled lines in words §2.2.
2. **The refund window preset (12c's RefundWindow), words §2.2:**
   - **Whole:** "All of it to the card", `refund.twice.allSub`, and the fee box ticked with `refund.twice.feeWhy`.
   - **Part:** opens on "Part of it" at the extra, with the reason prefilled (`refund.twice.prefill` /
     `refund.more.prefill`).
   - **The treasurer never gets it.**
3. **The team's record:**
   - **Pill:** `teamRec.twice` / `teamRec.more` replaces `overFee`, but only when the extra came from an online payment.
   - **Row tag:** `teamRow.twiceTag` / `moreTag`.
   - **The row's ⋯ menu:** Refund to the card, **Keep it** (§7 ruling 5: a note; the window says "The club keeps the
     money. Say why.") and Record the refund sent another way. The treasurer reads the line plain, with no pill.
4. **Open pay pages (ask 12): warn, then close.**
   - **One shared server helper:**
     - finds a team's open pay pages, or a child's (house league: open `league_signup` payments whose items include the
       registration);
     - closes each one with `expireCheckout`, then re-reads the session;
     - marks a page expired only when Stripe says it expired;
     - leaves a page that completed meanwhile for the landing, whose overpayment flag catches it. That is the race in
       the parent prompt.
   - **Call it after the hand recording succeeds** in every path:
     - Record a payment;
     - Mark paid / Deposit paid (`/api/admin/teams` → `payTeamDue`);
     - check-in (`app/api/admin/check-in/route.ts`);
     - the registrations bulk Mark paid;
     - import commit;
     - team creation marked paid;
     - house league's Mark received.
     - Re-verify this list; it came from a census.
   - **Warn in the three drawn screens only:** Record a payment, Mark paid and Mark received. Use `payOpen.*`: an info
     notice in the form, not a window, and never a block. Their GET payloads need the open pages: who opened it, the
     amount and the time.
   - **After recording:** toast `payOpen.doneToast`, with `payOpen.partNote` when the hand payment was only part.
5. **House league §2.3:** the `already_received` item's title and body change (`attention.unrecorded.titleTwice` /
   `bodyTwice`), and **Refund to the card** becomes its first button. Every other reason keeps its words.
6. **Words go in `lib/online-payment-words.ts` / `lib/league-pay-words.ts`, exactly as in the words file.**
   - Use `possessive()` and `formatTime()`.
   - Type no rate.
   - Run `npm run check:spelling`.

## Carried from Part 1's review (do these in this part)

- **TypeScript must learn the three new kinds.** Add `online_payment_over`, `card_disputed` and `card_dispute_lost` to
  `NEEDS_ATTENTION_KINDS`, the `NOTIFICATION_CATEGORY` map, the end rulebook `NEEDS_ATTENTION_END` (`lib/needs-attention.ts`)
  and the `lib/types.ts` union. Then repoint `tests/unit/needs-attention-clears-itself.test.ts`, which still reads mig 387,
  at mig 390, and update its kind count.
  - The two dispute kinds' end rules are Part 3's. Give them the rule the words state: the answerer's copy clears when
    answered, everyone else's when decided, and the lost item when the child or team is paid or excused. If that cannot
    be read without Part 3's code, leave a clear TODO in the rulebook, never a silent pass.
- **Add the new RPCs to `tests/unit/online-payments-guard.test.ts`'s `LAND_RPCS`** (only the landing module may call them):
  `online_payment_dispute_apply`, `online_payment_over_left` and `online_payment_reverse`.

## Tests and checks for this part

- **Unit tests:**
  - over by part;
  - over by all;
  - the race (the page completes before the expire, so the landing flags it);
  - house league unchanged (`already_received` refused as today);
  - the treasurer is never offered a refund door;
  - a replayed landing still raises the item once.
- **Gates:** `npm run verify:changed`, `npm run typecheck`, and `npm run check:layout -- --changed` on the touched screens
  at 1440 and 390, in Warm and Dark, if a dev server is up. If it isn't, say "skipped".
- **Commit Part 2 locally on dev** (explicit pathspecs; `git show --stat HEAD`). No push.
- **Offer `/docs`** for the paid-twice flow and the hand-recording warning. Prompt Part 5 also lists them.

## Not this part

- Card disputes (Part 3).
- Fee billing, own invoices, the scheduled job and the Plan & billing list (Part 4).
- Help and the walks (Part 5).
- Anything in 12d-2.
- At the end, write the same kind of handoff for Part 3 to `CLUB_TIER_STAGE12D1_PART3_PROMPT.md`, including what this
  part learned.
