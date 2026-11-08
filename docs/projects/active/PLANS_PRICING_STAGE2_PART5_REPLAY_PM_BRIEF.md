# Plans & pricing · Stage 2 · Part 5: replay a missed Stripe update (PM brief)

> 2026-11-08 · Drawings: https://claude.ai/artifact/Chw946z38BkoFa91XafRGh
> (`PLANS_PRICING_STAGE2_PART5_REPLAY_DRAWINGS.html`) · Stage prompt: `PLANS_PRICING_STAGE2_BUILD_PROMPT.md` · Status: **drawn,
> six asks ruled as recommended 2026-11-08; nothing built.**

## What changes for staff

- **Stripe page (Health › Stripe):** each update that failed gets a **Replay** word in its row, and a new line, **Replay an
  update by its id**, finds any other update. Only Super admin sees either. Billing, Support and Product read the page as today.
- **One window:** says what will run and for which club, asks **Why** (required), and states that nothing is charged or
  refunded, nothing changes in Stripe, and **no customer email is sent**.
- **The answer, in the same window:** the club's billing record before and after (status, plan, paid through, billing cycle,
  plan end), or **Nothing changed**, or why it failed or was set aside again. The window says what the table does not show.
- **Refusals before anything runs:** already finished, from the other Stripe account, older than Stripe keeps (about 30 days),
  being delivered right now, no such id, or the change log could not be written.
- **Afterwards:** the update leaves the failing list and says who replayed it and when. The Audit log gets a line for every
  replay with the person, the club, the reason and what changed.

## Why it matters

When Stripe tells the product a club paid and the product misses it, the club looks past due when it is not, and support has no
way to fix the record except by hand. Replay repairs that one record from what Stripe holds now, safely, with a reason and a
trail.

## What it is not

It does not retry Stripe's own deliveries (Stripe does that for a few days), preview changes, replay an update that already
finished, touch family payments, or ask for Sign in again. No money moves and nothing is written to Stripe.

## Impact on other areas

Customers see only the corrected plan status. No customer email is sent by a replay; the one update type that would email twice
("trial ending soon") is held back. Staff other than Super admin see no change.

## Priority and success criteria

Last piece of Stage 2 before closeout; it is the stage's only write, so it is built with the strictest checks.

- A failed update replayed by Super admin with a reason brings the club's record in line with Stripe and shows the before and
  after.
- A second replay of the same update is refused as finished; a replay that has nothing to fix says **Nothing changed**.
- A wrong-mode, unknown or too-old id is refused with a sentence that says which.
- No customer email leaves from a replay.
- Every replay, and every failed replay, leaves a change-log line with who, what, when and why; if the line cannot be written,
  nothing runs.
