# Platform admin, reorganized for the support team's jobs — PM brief

Plan: `PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md` · Status: **Stage 1 (the warm foundation) built 2026-10-24 and walked by the owner
2026-10-25** (45 of 45). **Stage 2 drawn and ruled 2026-10-25** (all eleven questions as recommended,
https://claude.ai/artifact/Ub7fXLh29SC34Zp4oqKUx1). **Stage 2 built 2026-10-25 on dev**; the owner's walk is next
(https://claude.ai/artifact/GqozHVh1Bg2FLqSKEM78Xs, ledger §377), and its one database change goes to production with the release.
Runs in parallel with Club Tier (owner, 2026-10-24). **Stage 2 walked 2026-10-25 (60 of 60). Stage 4 (free time) drawn
2026-10-25** (https://claude.ai/artifact/5eawvGUPwQVPoWiAV7vQY5) **and ruled the same day, all eleven as recommended**;
the build prompt is written. Free time on a Premium Coaches Portal is proposed as a follow-on (S4b), done together with
moving Founding Season's access, and is not yet ruled. **Stage 4 built 2026-10-25 on dev and committed** (walk ledger §379); the owner's
walk is next, and its one database change (tournament fees post to the club's book during free time) goes to production
with the release.

**What the Stage 4 build added to the drawings (owner calls at the build gate, 2026-10-25).** Billing actions never see
free time: buying, moving, downgrading, cancelling and the next-season choice all read the plan the club pays for, so free
time can never be bought out of or downgraded into for keeps. A club on free time gets the given plan's limits (unless its
own are higher). The early redirect in front of the club pages is gone; the club pages' own check follows free time.
Tournament fees post to the club's Accounting book during free Club time. The customer's amber note warns when the club
will hold more tournaments than its own plan allows. Club's billing page says plainly that Club isn't open for sign-up
yet, instead of "choose it below".

**What Stage 4 means (as ruled).** Support gives a club free time on a whole plan, sections or a billing
status from one window on its record, through a day they pick and with a reason; the window says the consequence in one
sentence first. It ends by itself: nothing is scheduled, every part of the product simply stops treating the club as on
the given plan after that day. The record shows it as a chip, a figure, a list and Story entries; Today warns 14 days
ahead; a new Free time list shows everyone on it, with Founding Season as a named group. **The customer** reads "Free
through {day}" on their Plan & billing page, an amber warning in the last 14 days, and a plain line after it ends.
**Two things the drawings push back on:** a whole-plan grant is a change to how the whole product reads a plan (about
twenty places read it directly today), which makes it the biggest part of the stage; and moving Founding Season's clubs
onto grants now would decide how September 30, 2027 ends, so the recommendation is the view now and the access when the
Founding turn-off is decided. **Not in Stage 4:** pausing a paying club's charges (Stripe, Stage 3), an email when free
time ends (its own ruling), free time on a Coaches Portal. **Roles (recommended):** Super admin and Billing give it
(Billing up to 6 months, Super admin 12); nobody gives it to a club they belong to; Support and Product see it.
**Success looks like:** free time in about 5 clicks that ends by itself; no club anywhere in the product still reads
a plan whose free time has ended; the customer is never surprised by the end.

**Success for Stage 2 (to check in the walk):** a support person finds any customer from one box in a few keystrokes; a club's
record answers "what happened, who, why" without opening five tabs; a live change always says what it does and keeps its reason;
a mistaken plan, limit or section change is undone from the Story; and each role sees, and can do, only what the rulebook gives it.

**What Stage 2 means for the support team (as ruled).** Billing staff stop carrying support's account powers (renaming a club,
moving its owner, banning a person); they keep plans, subscriptions and feedback. Every job starts the same way: press / anywhere, type an
email, a name, a club or a Stripe customer number, and open the record. Every account is searched, not the first 1,000. The front
door becomes Today, the list of what is waiting on us grouped by job. A club's record opens on its Story (what happened, who, why)
instead of edit forms, and a person gets a record of their own. Changes go through one pencil and a confirm window that asks why, and
a plan, limit or section change can be put back. The menu is grouped by job, and every role sees the same menu trimmed to what it may
open, with an honest read-only marker. **Deliberately later:** Stripe charges and refunds (Stage 3), free time (Stage 4), the Status
page and the sent-email log (Stage 5). **Success looks like:** walk tasks 4 to 12 (find by email, the subscription story, a plan
change, can't sign in) start from one box and end on one record, with no trip to a second search.

**What Stage 1 means for the support team.** The console now looks and behaves like the rest of FieldLogicHQ: warm by default and
dark on the same setting everyone else uses, the product's top strip (name, "Support console", account menu with Appearance and Sign
out), a menu that folds with Help and Collapse at the foot, one page title style, joined figure bands, white buttons with one lime
action per screen, and normal type instead of all capitals in a typewriter face. Every menu entry and button is where it was; no screen
changed its job. The sign-in page is warm, like every signed-out page. **Success looks like:** a support person who knew the console
yesterday finds everything where it was, nothing reads as a different product, and nothing scrolls sideways on a narrow window.
Overview and the club record only got new colours, because Stage 2 rebuilds them.
Project index: https://claude.ai/artifact/TLP8d5Zec4xVkTSYrQU8tp · the walk: https://claude.ai/artifact/2sNNCtRUJWi9PSE1QDmCDq ·
the end state: https://claude.ai/artifact/RCpPoxNNxGDfiC4FFo4m1g

**What changes.** The platform admin is where we support customers. Today it is 36 screens arranged by what the system
holds, in the old dark look nothing else in the product still wears, with no way to search the whole thing. After this
project:
- **Find** sits on every page and finds a person, a club or a Stripe number.
- **Today** is the front door: what is waiting on us, grouped by job.
- A customer's record reads first. Its **Story** is one dated list of everything that happened, with who and why. Its
  **Money** tab shows Stripe's charges beside our record, so a double billing is answered without leaving the console.
- **Give free time** is one window. The grant ends by itself, and the customer sees when. Founding Season becomes a
  named group of these grants.
- **Status** answers "is everything working?" on one page instead of five or six.
- The Club release gets its support view of **club web addresses**.
- Everything wears the same warm kit, navigation and Warm / Dark setting as the client portals.

**Why it matters.** The walk measured the owner's three tasks:
- **A double billing:** about 14 clicks and a trip to Stripe, and nothing on our side records the refund.
- **A free month:** the only whole-plan option is a plan change that never ends unless someone remembers to undo it.
- **Is it up:** five or six places to look, one of them a file on the owner's PC.

Once customers arrive, these become money lost and trust lost.

**Customer impact.** Mostly indirect: faster, more accurate support. One direct change: a customer with free time sees
on their billing page when it ends.

**Priority and order (recommended, owner to rule).** Stage 1, the warm foundation. Then Stage 2 (Find and the customer
record, which every task runs through), Stage 4 (free time, the one that quietly costs money), Stage 3 (money), Stage 5
(health), Stage 6 (the Club release's jobs), Stage 7 (growth and product), Stage 8 (records and roles). Stage 9 is the
company accounting review, held until the bookkeeping project is complete. Stage 6 should be done before the Club plan
goes on sale.

**Success looks like.**
- Each of the owner's three tasks is measured again after its stage: double billing in about 5 clicks with a record
  written automatically; free time in 5 clicks and ending by itself; status on one page.
- Every section has passed the owner's own walk.
- Nothing in the platform admin wears the old look.
- Every change to a live account asks first, records why, and shows on the customer's story.
