# PM brief — Plans end (and step down) at the renewal date

**Priority:** High — a fairness and trust fix on money, found in the Support Console walk (D3). **Plan:** `PLAN_ENDS_AT_RENEWAL_PLAN.md`.

## What changes for people
- **Cancelling** (by the club or coach, or by us for them) no longer cuts them off. They keep everything until the renewal date they already paid for; then the plan ends by itself.
- **Downgrading** to the free plan, or to a cheaper paid plan, works the same way: the change happens on the renewal date, and there's no credit or refund for the unused time. **Upgrading is still instant.**
- Between the click and the date the billing page shows a clear band — "Ends on [date]" or "Moves to [plan] on [date]" — with a **Keep my plan** button that undoes it.
- On the date: the plan ends or steps down, tournaments over the new limit are archived and kept for the usual number of days, and the existing "cancelled / changed" email goes out. A first email at the click says when it will happen, a reminder goes out a week before, and keeping the plan sends a short "your plan will renew" note.
- **Keep my plan never costs more than they chose.** A club that had already scheduled a move to a cheaper plan and then cancelled goes back to that cheaper move if it keeps.
- **Downgrading to free while the plan is still running:** the band names the tournament they're keeping and warns that any other tournament, including ones created before the date, is archived then (and can be brought back for the usual number of days). They can change which one they keep until the date.
- The date reads the same everywhere: on the page, in the windows and in every email.
- Someone who cancels during a trial no longer gets the "your trial is ending, add a card" email.
- **Platform admins:** Cancel now says "Ends on [date]; they keep access until then." A separate, secondary **End now** remains for abuse and chargebacks. If an ending is ever missed, the account shows as overdue on its record, with a **Finish this ending now** button that checks Stripe first.

## Who sees what
- Owner (and head coach on a Coaches Portal): cancel, downgrade, Keep my plan. Same owner-only rule as today.
- Platform admin: Cancel (at renewal), Keep my plan on their behalf, End now.
- Everyone else on the account: nothing changes; the band is information only.

## Not changing
Choosing a next-season plan (Founding Season), upgrades, reactivating a cancelled account, operator plan moves.

## Why it matters
They paid ahead with no refund — ending access the moment they click takes away time they bought, and it's the first thing a customer or a card dispute would point at. Ending at renewal is the industry-standard expectation. It also gives a retention opening: a pending cancel can be reversed in one click.

## Success
- A cancelled account stays fully usable until its renewal date, then ends on its own with no manual step.
- Keep my plan restores the plan with no charge and no lost data.
- Nobody is ever left on a paid plan past their end date: the existing daily job flags any miss, and a platform admin can finish it in one click.
- No proration credits are issued on downgrades, and Keep my plan never renews at a higher price than the customer chose.
- Every case was run in Stripe's test mode, with the clock advanced past the renewal date, before any customer sees it.
- Owner walk passes for cancel, downgrade, undo, End now, and a cancel made through Stripe's own portal.

## Rollout
Drawings first (owner approves), then four build sessions: (1) cancel at renewal + the stored date, (2) downgrades, (3) a Stripe test-mode rehearsal of every case, (4) wording, emails, help and walk updates. Customers get cancel and downgrade together: shipping one without the other would make downgrading worse than cancelling.

**The stages in plain words (2026-10-31).** Stage 0, the drawings, is done (you approved all nine choices). Stage 1 is cancel at renewal and the stored end date; it waits for the Stripe-notice and portal-settings groundwork in Plans & pricing Stage 0. Stage 2 is downgrade to free at renewal (including changing which tournament you keep) and closing the old immediate paid route; paid-to-paid moves already wait for renewal. Stage 3 is the Stripe test-mode rehearsal and the portal-settings check. Stages 1, 2 and 3 each end with a walk you follow. Stage 4 is the words, emails, windows and help, done as one pass with the Plan & billing help rewrite. Stage 5 is shipping: the database change applied to production, the live portal settings read and recorded, cancel and downgrade reaching customers together, and the project archived. The project is done when Stages 1 to 5 are complete.
