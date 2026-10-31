# PM brief — A Premium coach becomes a club, in place (Plan & billing Stage 4b)

**Written 2026-10-30 · screens drawn and all eight rulings made the same day · plan: `PLAN_AND_BILLING_STAGE4B_PLAN.md` · drawings: `PLAN_AND_BILLING_STAGE4B_DECISIONS.html` · ships when Club opens for sale**

## What the customer sees and does

A coach who runs a club started on the standalone Premium Coaches Portal and now wants the whole product. On Plan & billing they
see a **Club** row in Change plan with a **Start my club** button. The "Part of a club?" card below it is unchanged: that one is
for joining someone else's club.

- **A paying coach** taps Start my club and gets **one window**. They type the club's name and see exactly what is charged
  today, as lines that add up: Club for the rest of this billing period, credit for unused Premium time, **Due today**, and the
  new price from renewal. Their monthly or yearly billing stays as it is. There is no second trial. One button confirms.
- **A coach on free time** (Founding Season or staff-given) sees the same window, with a warning at the top that their Premium
  free days end when the club starts and do not carry over, and the 90-day trial sentence. They continue to a secure payment
  page, add a payment method, and are first charged when the trial ends. If they leave before finishing, nothing changes.
- **Coming back from payment**, they see "Setting up your club" until it is truly ready. If it takes long, or cannot be
  confirmed, the screen says so plainly and never invites a second payment.
- **Then they land in the club's Admin side** with their team already inside it, a short setup list (name done, check your web
  address, invite staff, set up your public site), and an Open my team button. In their coaches rail, **Plan & billing** and
  **Tournaments you run** are replaced by **Admin**.

The team never moves. They stay owner of the club **and** head coach. Their web address does not change, so every link already
sent to families and coaches keeps working; changing it is offered on the setup list, with the usual warning.

## Who sees what

Plan & billing is the owner's alone. A member who types the address sees the locked card. A coach with a hosted tournament in
draft or active is **not** blocked: everything stays in the same workspace. Before Club opens for sale the Club row reads
"Contact us to move" and opens nothing.

## Why it matters

A growing coach should never hit a dead end on the plan page, and should not have to cancel one plan and start another by hand.
Until Founding Season ends (September 30, 2027) almost every Premium coach is on free time, so the common upgrade is a plain
start-paying step; that path has to be as good as the paid one.

## The honest cost

Looks small, builds large. The coach's workspace is permanently tagged as a coach portal, and about 70 places in the product
behave differently because of it. The upgrade has to change that tag and the billing records behind it in one step, and prove
that no coach-portal behaviour is left on an upgraded club (including the cancellation treatment and email). That is the bulk of
the work and the main risk; the screens are the easy part.

## Priority and sequence

After Stage 4, before Stage 5's help rewrite, so the help describes this once. Built now, held behind Club's sale gate, so it
costs nothing to customers until Club opens.

## Success looks like

1. A paying coach upgrades in one window and sees a "Due today" figure that matches what Stripe actually charges.
2. A free-time coach is told their free days end **before** confirming, and loses nothing if they walk away.
3. After the upgrade, the workspace behaves as a club everywhere: no coach-portal treatment survives, a later Club cancellation
   runs the Club path, and the team, roles and links are untouched.
4. A coach who is interrupted at any point (closes the tab, payment page cancelled, slow finish) is never charged twice and is
   never told their club is ready before it is.
5. Nothing about prices, plan names, capacity bands or the "Join a club" door changes.

## Not in this stage

Going back down from Club to Premium; Club · Association (reached afterwards by the existing larger-band move); any new plan or
discount; changes to the Founding offer; advertising the path before it exists. Words are draft until `/marketing` finishes them.
