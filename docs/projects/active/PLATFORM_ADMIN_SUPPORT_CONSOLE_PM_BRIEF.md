# Platform admin, reorganized for the support team's jobs — PM brief

Plan: `PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md` · Status: **Stage 1 (the warm foundation) built 2026-10-24 and walked by the owner
2026-10-25** (45 of 45). **Stage 2 drawn and ruled 2026-10-25** (all eleven questions as recommended,
https://claude.ai/artifact/Ub7fXLh29SC34Zp4oqKUx1). **Stage 2 built 2026-10-25 on dev**; the owner's walk is next
(https://claude.ai/artifact/GqozHVh1Bg2FLqSKEM78Xs, ledger §377), and its one database change goes to production with the release.
Runs in parallel with Club Tier (owner, 2026-10-24). **Stage 2 walked 2026-10-25 (60 of 60). Stage 4 (free time) drawn
2026-10-25** (https://claude.ai/artifact/5eawvGUPwQVPoWiAV7vQY5) **and ruled the same day, all eleven as recommended**;
the build prompt is written. Free time on a Premium Coaches Portal (S4b) was ruled YES by the owner on 2026-10-26 and **drawn
2026-10-27** (https://claude.ai/artifact/4qzTiG3rUBTmihqPSUAzrW): in plain words, support gives a free-portal coach Premium for up to 90
days from the coach's person record; the coach's Premium is real while it runs; when it ends they land back on their free team as it was,
with everything they made on Premium kept (and a plain band saying so); families stop getting reminders the same minute. All twelve
questions were ruled as recommended on 2026-10-27. Success: a coach can try Premium for a set time and return with nothing lost, and
nobody on staff can give it quietly. **Building:** the safety fixes, the giving itself and the support team's screens (the coach's
Coaches Portal tab and the portal's record) are done on dev; the coach's own Plan &amp; billing screens and Keep Premium come next, then
the walks. **Stage 4 built 2026-10-25 on dev and committed** (walk ledger §379); the owner's
walk is next, and its one database change (tournament fees post to the club's book during free time) goes to production
with the release. **Stage 3 (money) drawn 2026-10-26** (https://claude.ai/artifact/FdTWB58ne1jgsBXSwutdLX) **and ruled the same day, all
twelve as recommended**; the build prompt is written. The owner also moved the audit log's raw values into its entry window
and asked that a window's foot sentence never ship unformatted again. **Stage 3 built and committed 2026-10-26 on dev**
(`270211ca0` · `4bfc9ca41` · `6c6d0da7e` · `d77ee9da9` · `e764efd90` · docs `bc9616345`): the owner walked a double charge found and refunded (ledger §384,
https://claude.ai/artifact/CBCDtZjmsd9pFr5o8toUUV) on 2026-10-26, 44 of 44 ticks and every build call accepted; the guard rails walk (§385, https://claude.ai/artifact/QNSBdd8xbeqGysxH7mTw5y) followed the same day, 26 of 26 ticks and all 6 build calls accepted.
Two things changed from the drawings, both found while building: a Coaches Portal a club pays for is billed on the club's own
Stripe account, so the Money tab names it as the club's rather than as a second subscription; and the plan refusal covers the
plan and the tournament limit (what Stripe puts back), so a custom team limit on a paying Club · Association club still saves.
Its one database change goes to production with the release.

**What Stage 3 delivers (as ruled).** Support answers "was this customer charged twice, and can you fix it?" from
the club's record, without opening Stripe. The Money tab reads Stripe when it opens and sets the subscription beside our own
record, with one line saying whether they agree. Five "charged twice" patterns are named for the person, including the common
false alarm (two charges on one day for different months). Billing and Super admin refund all or part of a charge to the
card it came from, with a reason and a one-sentence warning that it cannot be undone and the plan does not change. Purchases,
charges and refunds join the club's Story as facts. The audit log gets a Reason column. Find takes a charge or invoice
number. Nothing changes on the customer's screens; whether Stripe's own receipt email reaches them is a setting the owner
checks.

**Why it matters.** Today a double charge takes about 14 clicks and a trip to Stripe's dashboard, and a refund made there leaves
no trace in the console. The drawings also found a live money bug: a staff plan change on a club that pays through Stripe
leaves Stripe charging the old price, and Stripe's next renewal silently puts the old plan back. The recommendation is to
refuse that change and send the owner to their own billing page, the same rule Stage 4 set for free time.

**Success for Stage 3:** a duplicate charge found and refunded from the record in a few clicks; no refund ever missing on our
side or made twice; every staff change in the audit log shows why; no staff plan change can leave a paying club charged for a
plan it no longer has.

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

**Stage 7 drawn and ruled 2026-10-27** (every recommendation, plus a "How did you hear about us?" question on the public form and tags on the links we hand out, so visitors do see one new optional question; the Audit log fix ships first, on its own; build prompt `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE7_BUILD_PROMPT.md`) (https://claude.ai/artifact/QTrwrgyGqgBZugpGfvpJHM). What a growth person gets, as drawn: Leads as a pipeline over every lead, opening on "Needs you" (new, follow-up due, stuck, a sign-up to confirm); a page per lead with a timeline of everything that happened to it; a club that signs up with a lead's email offered for a person to confirm, never linked by itself; a Numbers view (signed up, paying now, time to sign up, by page, plan and source, month by month) read live with no new scheduled job; a short list for where a lead came from and a required reason when one is lost. No visitor sees anything new. Found on the way and put first: Today's six "campaigns waiting" are retired campaigns; the Audit log shows every staff role a lead's name, email and words; and anyone who knows a lead's email can rewrite it through the public form. Success is unchanged: one pipeline, one definition on every screen, a trend as far back as the dates go, and the reasons we lose leads written down.

**Stage 7 built 2026-10-27; the finish pass is done and the walks are next.** A growth person now has Leads as one pipeline with a page per lead, the offered sign-up match, a Numbers view and one definition of "signed up" and "pays now" shared by Today, Business numbers and Leads. The finish pass tightened what a customer-facing stranger's details can do: a lead who asked not to be contacted can no longer be linked back into the mailing list by accident, Copy emails now refuses unless it can record itself first, an old unaudited list of every lead is gone, Today no longer says "Nothing waiting" when it simply could not read the leads, and a lead that arrives in the evening counts on the day it arrived. Two things need the owner: whether "asked not to be contacted" should be a permanent flag rather than a step that can be changed, and scrubbing the old whole-lead audit rows before the leads migration reaches production. The public form's new question (Part 8) is still waiting on its drawing.

**Stage 10, Plans & pricing, logged 2026-10-27 (not drawn; the owner picks it up when ready).** The job: someone on the team can change what we sell without a developer and without surprising a customer. Today a price change is a code change, the Stripe products are made by hand in Stripe's dashboard and their IDs pasted into the console, and swapping an ID would cut off everyone already subscribed. Nothing tells existing customers about a price change, and the promotions screen records offers that checkout never reads. As proposed: a guided price-change workflow (who is affected, what existing customers get, the new price made in Stripe, the customer notice, the timeline); trial lengths changed in one place; the console checking Stripe so a wrong or missing price is seen before a customer hits it; promotions made honest; and a checklist, enforced by the build, for adding a plan. **A full plan builder is deliberately out** (the owner: it is rare). The policy calls (what existing customers keep, how much notice) are the owner's and are asked first. Success looks like: a price change done start to finish from one place with no customer cut off or surprised; a new plan that cannot half-ship; and the strategy doc, the code and Stripe visibly agreeing.

**What Stage 7 is for (chosen next 2026-10-27).** One job, in the owner's words: a growth person can see where every lead lands, gets metrics on historical conversions, and can input information to track and improve future growth opportunities. Today a lead is one table with a status, notes and a hand-typed link to the club it became; the conversion figure is a live percentage over leads (not paying clubs), the Leads screen counts only the 100 rows on the page, and there is no trend because nothing stores history. Success looks like: one pipeline view, one definition of "converted" and "paying" used on every screen, a trend that reaches as far back as the dates do, and a place to record where a lead came from and why one was lost. The drawings session also asks whether the four product-catalogue screens belong in this stage at all (recommended: no).

**What Stage 5 means for the support team (ruled 2026-10-26, built on dev the same day; all three walks done 2026-10-27, 13 steps Held to the release).** As built: Status shows thirteen checks and is the first entry under Health for every role; Today's health line now gives a verdict and points to Status; the delivery word on an email comes from the mail service telling us, so Sent emails and the Emails tab start filling from the release onward (nothing before it was kept); two release steps turn on the build and database-service lines and the delivery words. Originally drawn as: A new **Status** page under Health
answers "is the platform healthy right now?": the builds, our own errors and traffic, the database and its scheduled jobs, and the
database services. Every line has a plain verdict and one thing to do, and it is readable on a phone. Most of it needs no new key. Builds
and the database services need two read-only keys the owner adds at the release. **Errors** shows who an error hit, as a link to
that person and their club. **Feedback** gets its own page, and Support can **reply by email**. That reply is the only new thing a
customer ever receives, and the window says it cannot be taken back. A person's record gains an **Emails** tab: every account email
we sent them and what happened to it (delivered, bounced, marked as spam). An address with no account, such as an invite that never
arrived, is found from Find. The morning check stays on the owner's PC, unchanged (ruled). **Success looks like:** "is it up?"
answered on one page without opening Amplify, Supabase or the mail service; "I never got the email" answered in two clicks from Find;
a customer's feedback answered from the console, once, to the right person.

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
