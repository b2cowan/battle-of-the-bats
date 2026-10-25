# Club Tier Stage 9: house league, the deep dive (kickoff prompt)

> **Written 2026-10-24.** **Paste this into a new chat on `dev`.** This opens Stage 9 (house league, with the scheduler's
> house-league half, 11b). It is a **deep dive**, not a build: a measured walk of house league as a convenor meets it, a stage
> ladder, and the first stage drawn, **in one publish** (memory: "A deep dive = walk, then stages"). Nothing is built in this
> session. Other sessions share this working copy: stage explicit paths only and commit only your own files.
>
> ⚖ **The next stage after this one is payments processing (Stage 12, with 12b = paying for a house-league sign-up).** The owner's
> instruction for this stage: **everything drawn and later built here must be shaped so payments drops in without rework.** §4 is
> that contract. Read it before you draw a single registration or money screen.
>
> ⚖ **No release dates in this work.** The Club release ships when every stage is complete and tested (owner 2026-10-24). Order
> the ladder by dependency and by what avoids rework, never by "what gets us to launch sooner". Do not write go/no-go or
> launch-timing reasoning into the plan.

## 1 · Why this stage is big

House league is the club's largest program and its largest revenue line, and today it is the least finished area of the
product. A helper census on 2026-10-24 (re-verify everything; leads below, not evidence) found:

- **It is the last area still wearing the old look.** Every admin house-league screen except the public pages is pre-kit code
  (9 files on the old-look gate; the module stylesheet is on the strict colour-debt list), with about 11 browser `confirm()`s and
  hand-sized buttons.
- **A club admin can open every house-league screen and save almost nothing.** D8 gave the `admin` role the house-league
  capability, but every write route still refuses anyone who isn't `owner` or `league_admin` (finding F4, 2026-10-08, still open
  and assigned here). Verified in the schedule game route.
- **Navigation is thin and has holes.** The rail has one row ("Seasons"). Inside a season it has five rows (Registrations, Teams
  & draft, Schedule, Standings, Notifications). **The season's own overview and its Ledger are not in the rail**, so from the
  Schedule there's no rail path to the money or the settings. There is no Past seasons door; the old one 404'd and was removed,
  not rebuilt. "Notifications" names a parent email composer, a different meaning from the bell and Needs attention elsewhere
  in the product. When two seasons are live at once, the public index and the club home show only one.
- **Whole jobs a convenor expects don't exist:**
  - player evaluations or ratings, with no ratings-fed draft (the draft is a plain pick order);
  - volunteers of any kind (scorekeepers, umpires, team managers);
  - coaches as people: a coach is a typed name, with no account and no view of their own team;
  - copying last season forward;
  - bulk actions on registrations;
  - a Withdraw button (the API supports it; the screen hides it).
- **The schedule generator is thin:**
  - every game in a round gets the same date and time;
  - one division, one start date and one game time per run;
  - no days of the week, dates off, slots, game length or byes;
  - practices can be cancelled but not moved;
  - it warns about clashes it created itself.
- **Families are told almost nothing during the season.** No schedule, practice, team-placement or rainout change sends a
  notice. The withdrawal path emails no one. The season email sends one at a time, emails a guardian once per child, and has no
  cap (it's listed to move onto the shared batched family sender).
- **The public schedule is dishonest.** It never shows the place; a cancelled game disappears and a postponed game reads as on
  (defect C6-04); its week labels are off-recipe.
- **Money is one number and one tick:**
  - one flat fee per season;
  - a paid tick that posts one ledger line, re-reading the season's **current** fee at the moment of the tick;
  - decline or withdraw silently voids that line, even when the family has paid;
  - nothing is filed on the club's Budget vs. Actual Statement (owed by this stage, below).
- **Registration correctness:**
  - capacity is count-then-insert, so two sign-ups at once can overfill a division;
  - waitlist position is count + 1, with no constraint;
  - approving ignores capacity;
  - the registration open and close dates are informational only (the form reads the season's status, not the dates);
  - **the form has a waiver checkbox but no CASL consent**, although the plan says both exist (verify; the plan is wrong if the
    code shows none).
- **Standings scoring is hard-coded** (win 2, tie 1, a runs tiebreak), ignoring the sport pack.

Several items on the in-season trust plan (`HOUSE_LEAGUE_INSEASON_TRUST_PLAN.md`) are **already fixed**: email escaping, rate
limits on register and status lookup, the cross-tenant IDs, the time zone, the season email's audiences and suppression. The
Club plan's §4I inventory was last verified 2026-09-25 and overstates what is open. **Re-verify the list before you walk; do not
draw a fix for something already fixed.**

## 2 · The rulings that bind this stage (do not reopen)

- **Scope** (Club plan §6 Stage 9):
  - the trust list re-verified;
  - the coupling check for a standalone League Plus club (house league with no rep teams);
  - the ledger seam under D1's pattern (C18);
  - venues under Stage 6's book;
  - confirms on one-click season changes;
  - the League Plus un-park (D11, logged as **Proposed** and confirmed when this stage opens: run `/strategy` for it);
  - the old look retired in the screens this stage rebuilds.
- **Fees reach the Budget vs. Actual Statement** (owner 2026-10-21). Today a paid fee posts in the season's own book and files
  nowhere on the Statement, so the club's largest revenue source is missing from Total revenue. This stage draws how a season's
  fees file (a row per season, or one "House league registration fees" row with seasons under it, plus the budget side), updates
  Walk 7a step 7.6, and **does not close until the Statement and the season books agree.**
- **The Stage 6c calendar recipe, C1–C12** (Club plan, Stage 9 section):
  - the admin Week and List views become one season List grouped by week (a seven-day Week kept if wanted);
  - it opens on this week;
  - date labels read "Oct 19 – 25, 2026";
  - every game shows its place, and finished games read "Final";
  - no chip on a scheduled game;
  - a reader's click opens a read window, never a greyed "Edit Game";
  - the division leads as the scope pill;
  - the public schedule shows the place, Cancelled struck through and Postponed in words, and says "Times in Eastern time."
    once.
- **The scheduler's house-league half (11b)**, `CLUB_PERMITS_AND_SCHEDULER_PLAN.md`: a house-league writer for the club
  schedule (move, cancel), the Practices view's "From {schedule}", the club-admin role path (Walk §L-b).
- **No household money** (owner 2026-10-19, Families 5d cancelled):
  - one fee per child;
  - no sibling discount, financial assistance, payment plan or household credit;
  - two children means **two registrations, one payment**.
- **Facilitated payments** (`FACILITATED_PAYMENTS_SCOPING_PLAN.md`, `PLAN_PRICING_FACTS.md`; never restate rates, point at the
  Facts doc):
  - direct charges on the club's own Stripe account; FieldLogicHQ never holds the money;
  - the family pays the processing fee;
  - every paid organization plan;
  - marking a payment received by hand stays alongside online payment and writes the same paid record;
  - counsel's sign-off gates live charging, not building.
- **The public team page is games only;** practices are never public (memory decision, 2026-10-20).
- **Optional, not ruled:** a house-league schedule health score, using the same button, window and engine as the tournament
  schedule. Draw it beside C1–C12 and let the owner pick it or the clash warning box.
- House rules: "Edit autosaves, create asks" (and a change that tells families is held until ✓ and asks), "A record reads
  first, edits whole", one window for the whole product, a window's foot (sentence left, buttons right), a rare door ends the
  body, one toolbar with rare tools behind Tools, a phone's secondary action is its symbol alone, the amber waiting-count pill,
  Export is one button, one loading line, "8:00 a.m.", the bare possessive. All are in `memory/design_decisions.md`; the
  owner's portal is the formatting benchmark.

## 3 · What this session produces

**One hub Artifact, one first publish**, holding:

1. **A measured walk.** The stations follow the order a volunteer convenor meets house league, at a desk (1440) and on a phone
   (390), captured on a fixture club (below). Each station gives:
   - *as built*: the capture plus browser-measured numbers;
   - *my read*: what works, what gets in the way, and what I'd change, with clickable finding flags;
   - **shape questions** (Keep · Reshape · Not yet), each with a recommendation, what rides on it, and a notes box.

   The stations:
   1. **Set up a season.** The seasons home, create, divisions, age cut-offs, capacity, fee, dates, waiver, settings.
   2. **The family signs up** (phone first). The public season page, the form, the receipt email, the status lookup.
   3. **Work the registrations.** Review, approve, waitlist, decline, withdraw, bulk, fees received, add by hand, exports.
   4. **Make the teams.** Evaluations (none today), the draft, balancing, placing a late registration.
   5. **Coaches and helpers.** Who coaches each team, what a coach sees, volunteers (none today).
   6. **Build the schedule.** The generator, games, practices, venues and permits, the club scheduler (11b), clashes, health.
   7. **Game day and the season.** Scores, standings, rainouts and reschedules, what families are told.
   8. **Talking to families.** The season email, the automatic notices, Families book links.
   9. **The money.** Fee per child, received by hand, the season Ledger, Budget vs. Actual, the Families book balance, what a
      family sees owing.
   10. **The public pages.** The league index, season page, schedule, standings, team pages, the club home's house-league
       section.
   11. **Season end and next season.** Completing, archiving, past seasons, copying forward, the returning family.
   12. **Getting around.** The whole area's navigation, desk and phone, owner vs club admin vs registrar vs league admin.
2. **Standing back.** The rules that cut across the stations: who may do what, one home for a season, what a family is
   told and when, and the payments contract (§4).
3. **A stage ladder.** A table of stage · covers · asks · state, sized. My proposal, to test against the walk rather than
   adopt:
   - **9a · The frame and who can do what.** The house-league home, the season's rail block with its overview and Ledger, past
     seasons, two live seasons, the admin write gate fixed to match D8, and the old look retired in the frame. Every later
     drawing sits inside this, so it goes first and stays small.
   - **9b · Registration and money, payments-ready.** Everything in §4: the price per division and early bird, real open and
     close dates, capacity that can't overfill, several children in one sign-up, CASL consent, the fee frozen per registration,
     an honest decline or withdraw when money was received, Budget vs. Actual filing, the status page and emails with a place
     for a pay link. **12b is drawn right after this is ruled.**
   - **9c · Teams.** Evaluations if ruled in, the draft, coaches as people (accounts, if ruled in), volunteers if ruled in.
   - **9d · The schedule.** The generator rebuilt, C1–C12, health (if chosen), 11b, the public schedule told honestly, change
     notices to families.
   - **9e · The season.** Scores, standings by sport pack, the season email onto the batched sender, rainouts.
   - **9f · Season end.** Complete, archive, past seasons, copy forward, the returning family.
4. **Stage 1 drawn** (9a unless the walk says otherwise) at true size on its own tab, **in the same publish**:
   - before = captures, after = drawn;
   - NEW / RESTYLED / UNCHANGED tags and fix chips;
   - one checkbox per option for each ask;
   - desk and phone, Warm and Dark.
5. **A paste-back summary** for the owner's rulings.

Also write `docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md` and `HOUSE_LEAGUE_STAGE9_PM_BRIEF.md`; the Club plan only
reserves the slot. Then add one TODO line and one news row on the Club index (`ArtifactData`, artifact
`MBKRySURVFu3V9cZJvmjVr`; read the stage first and pin `if_version`). Run **`/ux`** on the flows and **`/design`** on the
drawings **before** the hand-off, not offered after it.

## 4 · The payments contract: shape everything for 12b

Payments (Stage 12) owns the checkout. **Stage 9 owns the data and the flows the checkout will sit on.** Nothing payment-shaped
exists in the app today: Stripe is used for our own subscriptions only, and there is no payment record on house league. So
12b's rework risk lives entirely in what this stage draws and builds. Every registration or money drawing in 9b states how it
meets each line below.

**Build in Stage 9:**

1. **A price lives on the division,** with the season's price as the default. Every place that shows or uses a house-league
   price reads it through **one** resolver; today at least seven places read the season's single fee directly. Mirror the
   tournament's registration-fee rule rather than inventing a second shape.
2. **Early-bird pricing:** a price that ends at a date, in the club's time zone, resolved by that one resolver.
3. **The open and close dates become real:** the form opens and closes on them, not only on a status the convenor flips by
   hand. Early bird means nothing while the dates are decorative.
4. **The price is frozen on the registration** at the moment it's priced, recording which price applied (regular or early
   bird). Today a fee edited mid-season silently changes what every family owes, and the ledger line takes the current fee at
   the moment of the tick. This is the highest-stakes line in the contract. Which moment freezes it is an owner ask (§5).
5. **Capacity can't overfill.** The spot is taken atomically. Two sign-ups at once must not both get the last spot, and pay at
   sign-up depends on it. Waitlist positions get a real constraint.
6. **Payment stays separate from registration status.** Do **not** add a "payment pending" status. A registration is
   pending / active / waitlisted / declined / withdrawn. Whether it is paid, owing or refunded is its own fact, read through one
   function, so 12b can add "paid online, reference X" without touching a caller.
7. **One writer for money.** Received-by-hand keeps its single shared write (the Registrations screen and the family record
   both land in it). Online payment will land in the same write. **Never add a second fee writer.** The existing guard test
   holds this.
8. **Ending a registration that has money on it is honest.** Today decline and withdraw silently void the paid line: a family
   that paid $240 cash and is declined vanishes from the books, with no record that the club owes them $240. Route every ending
   through one place, and when money was received, ask the convenor (refund recorded, or kept) and **record a refund as money
   out** rather than erasing the money in. That is honest bookkeeping today and the exact hook 12b needs for "refund the card
   first". Draw it; the owner rules it.
9. **Several children in one sign-up** (if the owner rules it in, §5). Each child is still its own registration; a shared
   sign-up reference ties them together. That is what "two registrations, one payment" needs at checkout. Do not build the
   payment-to-registrations split; 12b owns it.
10. **CASL consent captured at sign-up,** beside the waiver, with the same consent ledger row the waiver writes. A checkout
    can't add it after the fact.
11. **The payer is the guardian already on the registration,** linked to the Families book person. Registration stays
    account-free; no family account is required.
12. **Filing on the Statement:** a house-league category per season, with a fees item, filed by source, so an online payment
    later lands in the same place as one received by hand. **The club's revenue is the fee.** The family's processing fee is
    never posted into the club's book.
13. **Places the pay link will go.** The approval, waitlist-promotion and receipt emails, the public status lookup and the
    Families book each get a stable spot that can later say "Pay now" or "Paid online". Draw them as ghosts in 9b so 12b drops
    into a slot the owner has already seen.
14. **The form's "payable separately to {club}" line stays** until 12b replaces it.

**Do NOT build in Stage 9, because Stage 12 owns it:**

- Stripe account onboarding;
- checkout, card or bank-debit entry;
- a payments table;
- webhooks;
- processor refunds or disputes;
- payouts;
- tax on a fee, or a "+ tax" line;
- any installment, discount, financial assistance or household credit (cancelled);
- online-payment emails.

The revenue readiness plan mentions "installments, discounts"; the 2026-10-19 ruling supersedes it, so don't build from it.

## 5 · Asks the walk must put to the owner (each with a recommendation)

Payments-boundary asks (put them in 9b; ask now so 12b doesn't reshape registration later):

- **When does a family pay:** at sign-up, or when accepted? This interacts with auto-approve under capacity, the waitlist and
  declines.
- **When is the price frozen:** at sign-up, or at acceptance? Does early bird follow the sign-up date?
- **Does an accepted, unpaid registration hold its spot,** and for how long?
- **Does a waitlisted family get a pay-later link** when promoted?
- **Can one sign-up register several children?**
- **On a decline or withdrawal after money was received:** is the refund recorded automatically, or asked each time?
- **Does Budget vs. Actual show one row per season, or one fees row with the seasons under it?** And what's on the budget side?

Scope asks (my read; the walk confirms or overturns it):

- **Coaches as people.** Do house-league coaches get accounts, and what do they see: their roster's contacts, the schedule,
  entering scores? The chat ruling E5 already assumes "once they have accounts". This is the biggest scope call in the stage.
  Recommendation to test: yes, light. A coach is invited by email, sees only their own team, and enters scores.
- **Evaluations.** A simple rating per player feeding a balanced (snake) draft, or "not yet"? Recommendation to test: the light
  version, because balancing teams is the convenor's hardest hour of the season.
- **Volunteers** (scorekeepers, umpires, team managers). Recommendation to test: not in Stage 9; its own project, with a note
  in the plan.
- **A standalone League Plus club with no accounting.** Where does a fee file on Budget vs. Actual? Check what League Plus
  carries in the Facts doc before drawing.
- **The optional schedule health score,** or keep the clash warning box.
- **The house-league email composer's name** ("Notifications" today).
- **Two live seasons at once** (spring and fall overlap): how the index, the club home and the rail show them.

## 6 · Before the walk

- **Re-verify (helpers, in parallel; a helper's summary is a lead, so open the lines yourself before you build on them):**
  - the trust plan's list against the code;
  - the Club plan's §4I and §6 Stage 9;
  - the 11b section of the permits/scheduler plan;
  - the admin-role write gate across every house-league route;
  - the CASL claim;
  - the old-look report for house league;
  - the house-league columns in the schema snapshot (decide columns from the snapshots, never from migration files).
- **A fixture.** Find or extend a house-league fixture club that exercises the walk:
  - two seasons, one live and one with registration open;
  - three or more divisions with different capacities;
  - a waitlist;
  - a registration declined after paying;
  - fees received and not;
  - a guardian with two children;
  - games with cancelled and postponed;
  - a venue with a permit.

  ⚠ A seed's password reset signs that account out everywhere, so check saved sign-ins before seeding, and never seed mid-walk.
- **Measure on the dev server with `check:layout --changed`-sized runs only;** a whole-product sweep never runs on dev.
- **Read** `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **Broad reading goes to helpers.**

## 7 · Do not

- Build anything. This session walks, ladders, draws stage 1 and writes the plan pair.
- Draw a navigation change **outside house league's own block.** The rail's top level and the phone bar are Stage 13's.
  Record anything you find there as a Stage 13 input.
- Reopen a ruling in §2, or settle an ask in §5 by drawing only one option.
- Restate a price, a rate or a plan inclusion. Point at `PLAN_PRICING_FACTS.md`.
- Gate the walk behind any owed QA of earlier work.
- Push or promote.

## Git

`dev` only. Explicit pathspecs; check `git show --stat HEAD` after every commit. Commit the plan, the PM brief and the hub
source once the owner has seen the first publish, or sooner if the owner says so.
