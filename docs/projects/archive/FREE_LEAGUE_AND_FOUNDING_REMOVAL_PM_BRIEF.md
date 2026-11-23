# Free League retired + Founding Season removed — PM brief

**Owner ruling 2026-11-19.** Plan: `FREE_LEAGUE_AND_FOUNDING_REMOVAL_PLAN.md`.

## What changes

- **The free League plan is gone.** Nobody can start a free league; the "Free League" card, the free start form, the
  "Your free League plan includes up to 8 teams" refusals, the free-vs-paid help article and the platform-admin
  "Free League Starter" filter all disappear. House league is sold on League Plus, Club and Club · Association, with
  no team, division or season cap.
- **The Founding Season is gone from the product.** No page, banner, FAQ, lock line, email or staff desk mentions it,
  and nothing can hand out a new one.
- **The three accounts that hold it keep exactly what they were promised**, free through September 30, 2027, now as
  ordinary staff-given free time. The one still on the free plan gets Tournament Plus free to the same date. Their
  billing page reads like any free-time account's.

## Why it matters

The free League was never going to be offered, yet it still shaped behaviour: it surfaced on dev, and it would have held
a paying club to 8 house league teams. The Founding offer closed in October but kept a branch alive in billing,
pricing, sign-up and email, so every change there paid for it. Removing both makes the product say only what we sell.

## Customer impact

- No production account ever used the free League: nobody is affected.
- Three production accounts hold Founding; none loses anything, and none is charged before September 30, 2027.
- No price, plan or Stripe object changes.

## Priority and order

After On-sale pages S2 commits (its unfinished files overlap). Then: free League first; then the holders' move to free
time; then the Founding code. The production move of the three holders is a release step the owner runs.

## Success criteria

- A search of the product for the free League and Founding finds only history.
- A League Plus club can add a 9th house league team, a 2nd division and a 2nd live season.
- The three holders show free time through September 30, 2027 on the right plan; billing, renewals and business numbers
  treat them as free time.
- `/legal` and `/review` pass with nothing open.
