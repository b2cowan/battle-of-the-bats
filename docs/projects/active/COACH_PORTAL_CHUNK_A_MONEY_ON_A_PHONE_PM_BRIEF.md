# Coach Portal Chunk A — Money on a Phone — PM Brief

> **Created:** 2026-07-29 · **Status:** awaiting owner decisions D1–D5 + mockup approval · **Plan:** `COACH_PORTAL_CHUNK_A_MONEY_ON_A_PHONE_PLAN.md`
> **Mockups (binding once approved):** `claude.ai/code/artifact/dc2eb969-1f4d-4743-9bfc-d1cd55575e3d`

## What it does

A coach who handles their team's money can currently **collect** dues on a phone but cannot **read** their own finances on one. The Money hub, the Dues page and the payment flows already reflow properly. Everything a treasurer looks at to answer "can we afford this?" — the season budget, budget vs. actual, expenses, the org's allocations, what a fundraiser brought in — was built desktop-only and has no phone handling at all.

This chunk finishes the job:

- **Every Money page becomes readable on a phone.** Lists of records (expenses, allocations, fundraiser results) turn into stacked cards, the same way the Dues page already does. The one true comparison report — Budget vs. Actual — keeps its side-by-side Budgeted / Actual / Variance shape and instead **scrolls sideways with the line-item name pinned in place**, and it now says out loud that it scrolls.
- **No Money form throws away work any more.** Today every Money form is a pop-up that closes instantly if a thumb brushes the background — including the budget line with a hand-built payment split, the most tedious thing in the whole product to retype. It will now ask before discarding.
- **The one remaining raw browser pop-up in the portal disappears.** A failed budget-line delete currently throws a grey system alert; it becomes a normal in-app message.
- **Two small honesty fixes on the same surfaces:** the Money hub's headline numbers stop implying that money-in is committed revenue while money-out is cash (both are cash), and the two org-money pages finally link to each other.
- **On a wide monitor, Budget vs. Actual stops being squeezed into a narrow reading column and then scrolling inside itself anyway** — it gets the same extra width the Schedule's calendar views already use.

## Why it matters

This is the highest-frequency unmet need left in the paid Coaches Portal after the launch blockers. Coaches are volunteers doing this between a day job and a practice — the phone is where they actually are. Two independent reviewers flagged Money's reports as having zero mobile adaptation, which is what makes it the top P1 rather than one of thirty.

The unsaved-work half matters for a different reason: it is the only defect in the set that **destroys** something. Everything else is "I can't read this here" — the budget split is "I did twenty minutes of work and it's gone." That is the kind of experience a paying coach tells other coaches about.

## Who benefits

Every premium coach with money access, on a phone. Head coaches and assistants alike — an assistant with **read-only** money access gets the same readable pages and, by design, still sees no buttons they can't use. Coaches on desktop see one change: Budget vs. Actual gets more room. **No plan-gating changes; no pricing changes; no new capability.**

## Expected impact

A treasurer-coach can stand in a parking lot and answer "have we got room for another tournament?" — read the budget, see what's been spent against it, check what the fundraiser raised, see what the org has billed them. Today they have to go home and open a laptop.

Second-order: this is also the last set of surfaces in the portal that never got a mobile pass, so it closes the mobile programme rather than nibbling at it.

## Priority

**High — first post-launch chunk.** It collides with nothing in flight (Money is untouched by every other active workstream), needs no database change, and unblocks the queued "budget starter" work, which lands on these same screens and should meet coaches on a phone that already works.

## Tradeoffs made

- **Budget vs. Actual keeps a horizontal swipe instead of becoming cards.** A card stack would remove the sideways scroll — and remove the comparison, which is the only reason the page exists. We are choosing "one swipe to see the variance column, clearly signposted" over "no swipe, no report". This is the call worth pushing back on if you disagree.
- **We are not polishing the empty budget screen.** The queued budget-starter work replaces it. This chunk makes it legible on a phone and deliberately leaves room, rather than shipping a nice empty state that gets thrown away.
- **No suggested dollar amounts appear anywhere.** That is still an open decision, and inventing figures could anchor a coach low and leave a real family short at season's end.
- **Tryout-setup forms are left out of the unsaved-work fix.** They share the underlying problem but sit in a different area with its own testing pass; they belong with the small tryouts/development clean-up chunk.

## How to test it (owner QA)

On a phone, as a coach with **write** money access:

1. **Money → Season Budget Plan** — add a line, tick "Split by period", and add two or three periods. Every field should be full-width and tappable, not three stubs crammed into a row. Then **tap the background** — it should ask before discarding, and "keep editing" should preserve everything you typed.
2. **Money → Budget vs. Actual** — the page should say that the table scrolls sideways, the line-item name should stay put as you swipe, and no part of the *page* should scroll sideways. Expand a category and a line with periods.
3. **Money → Expenses** — both tabs. Expenses should read as stacked cards; a tournament payable's Deposit and Balance should sit one above the other, not two half-width boxes.
4. **Money → Fundraisers → open one** — the leaderboard should read as cards, and "Log Amount" should give you real inputs.
5. **Money → Org Allocations** (org-linked teams only) — installments as cards, and a link across to Payment Requests.
6. **Money hub** — the three headline numbers should now agree with each other about what "paid only" means.
7. Then repeat step 1 and step 3 as an **assistant with read-only money access** — you should see the same readable pages with no buttons, and no empty rows where buttons would have been.
8. **On a desktop/laptop:** Budget vs. Actual should use more of the window instead of sitting in a narrow column with its own scrollbar.

## Success criteria

- Zero horizontal *page* scroll on all seven Money surfaces at a 360px-wide phone, with no money figure clipped.
- Budget vs. Actual still shows Budgeted / Actual / Variance side by side, scrolls only inside its own frame, keeps the line name pinned, and visibly announces that it scrolls.
- Every multi-field Money form asks before discarding; "keep editing" loses nothing.
- No native browser dialog anywhere in Money.
- A read-only money coach sees no write affordance and no empty card rows.
- Owner phone pass clean in both the warm and dark themes, on a club-owned and a standalone team.
