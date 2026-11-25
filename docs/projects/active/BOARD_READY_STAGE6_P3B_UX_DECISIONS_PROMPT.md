# Board Ready Stage 6 · Part 3b — the six `/ux` decisions (kickoff)

Paste into a fresh session: **"Read and follow docs/projects/active/BOARD_READY_STAGE6_P3B_UX_DECISIONS_PROMPT.md"**

Written 2026-11-24 by the session that ran the `/ux` check at 390 and committed its fixes (`8cb12eb72`). This is the list of what that
check left for the owner to decide. **Rule of this session: present each decision to the owner with a recommendation and get his answer
BEFORE building it** (AGENCY_RULES: a plain-language UX summary first, then code). Agreement is not a go to build: for each one, ask "build
now, or leave until after walk §565?" — do not assume.

## Start conditions
1. `git rev-parse --abbrev-ref HEAD` is `dev`; `git log --oneline -6` shows `8cb12eb72` (the 390 fixes) on top of `ef7fe7d28`, `7f2015740`,
   `6d866f1b9`, `0ca618cc3` (Part 3b after the walk). Another session shares this working copy (the club schedules work, the Milton demo,
   the coach practice screens): stage **explicit pathspecs only**, never `git add -A`.
2. The dev server runs on `http://localhost:3000` and hot-reloads; sign in as `owner@dev.local` / `devpass123` (Dev Club Org). Migrations
   530 to 534 are applied to dev and pending on production. Any new database change needs the owner's word in THIS conversation.
3. Read, in order: `BOARD_READY_STAGE6_P3B_AFTER_WALK_FIXES_PROMPT.md` (the `/ux` at 390 bullet is the source of this list),
   `BOARD_READY_STAGE6_P3B_AFTER_WALK_WALK.html` (walk §565, the owner's, may be in progress: a change to a screen it walks means a changed
   step, and the published walk, https://claude.ai/artifact/YReg9zd1HjXPJdpXYAHeBk, is republished from that file), and the owner's UI rulings
   (memory `reference_memory_index_settled.md` § UI conventions: windows on a phone, one lime, no red on refunds, status as a chip).
4. Real phone-width renders: `.probe/p3b-ux390.cjs` and `.probe/p3b-ux390-after.cjs` (Playwright, signed in as the dev owner; the
   second squeezes a payment row with each chip text). Copy and adapt; never read production.

## The six decisions (my recommendation first)
1. **"Refund" is offered while the sponsor's dispute is open.** The club picks All or Part, types a reason, presses the button, and only
   then is told `errDisputed`. *Recommend: build.* Give each card payment a "disputed" fact (an open row in `online_payment_disputes`
   for its online payment; read it where the deal's payments are read, `lib/club-sponsorship-deals-server.ts` `paymentsFor`; no database
   change) and, in the payment window, show the existing `DEAL_WORDS.card.errDisputed` in the foot where the Refund button would be, as the
   refunds-switched-off line already does (`DealPaymentWindows.tsx` `startOrWhy`). No new words.
2. **"Part of it" with a blank or invalid amount: the button reads "Refund $<the whole remainder> and email".** Pressing it shows an
   amount error, so the label names money it will not move. *Recommend: hide the button until the amount is valid* (as the window already
   hides it until a choice is made). The alternative is a neutral label, which needs a word from `/marketing`.
3. **A deal refunded in full and ended still reads "Thank you, {name}" and a receipt titled "Paid, thank you" on the business's page**, with
   the refund row under it and nothing saying the sponsorship ended. *Recommend: build, wording through `/marketing`.* One line for a
   refunded-away deal instead of the paid title (the club side's `hRefundedWhole` and `calloutRefundedWithdrawn` are the model; the
   business-side words must not name Stripe or say "voided"). Pin the state with a test; `refundedAway(deal)` is the one predicate.
4. **Refund-window errors are red; every other refund-trouble surface is amber** (the failed chip, the foot lines). *Recommend: red only for
   a field that is wrong (a missing reason, a bad amount); the card company's refusal (`failedBody`) and `errDisputed` use the amber callout
   face.* Check the shipped amber callout component before drawing; no new colour.
5. **The phone keyboard may cover the refund window's Reason field and its buttons.** `KitDialog` has `followKeyboard` for exactly this
   (only `CodeAgainWindow` uses it); `VoidPaymentQuestion` and the Withdraw question have the same gap. *Recommend: add the prop to the
   three, and ask the owner to confirm on a real phone* (headless Chromium cannot raise a soft keyboard, so this one cannot be proved here).
6. **"Confirming your payment" has no way out after 20 seconds** (the poll runs forever; a network failure is hidden). *Recommend: after the
   slow point add a "Reload this page" control at the 44px floor, and open with the shipped `PAY_WORDS.confirmingBody` ("Don't pay again")
   instead of the sponsor-only line.* ⚠ The poll hook (`components/public/PayBlock.tsx` `usePaymentConfirming`) is shared with the league
   and tournament pay pages: either change it for everyone (say so to the owner) or keep this sponsor-only.

## How to run it
1. Present the six to the owner in plain language (what he would see differently, why it matters), with the recommendation and a
   build-now-or-later question each. Build only what he says yes to.
2. For each build: the smallest change, tests in `tests/unit/board-ready-stage6-p3b.test.ts` (`readCode` pins and pure-function tests, as
   the existing describes do), then the real render again at 390 with the probe, then `npx tsc --noEmit -p .` and the Part 3b test files.
   Words go through `/marketing` in one pass before the walk; anything the business reads (item 3, 6) also gets a `/legal` line if it
   states a tax or refund position.
3. If a change alters a step in walk §565, update `BOARD_READY_STAGE6_P3B_AFTER_WALK_WALK.html` (rebuild with the generator pattern in the
   session scratchpad, or edit the HTML directly), republish the artifact at the same URL, and tell the owner which steps to re-walk.
4. Record each decision (built, or left, and why) in `BOARD_READY_STAGE6_P3B_AFTER_WALK_FIXES_PROMPT.md` and the board note in
   `BOARD_READY_PLAN.md`. **Commit at the owner's yes only**, one small commit, explicit pathspecs, no `Co-Authored-By` footer, branch `dev`,
   never `master`; confirm with `git show --stat HEAD` that only your files landed.
