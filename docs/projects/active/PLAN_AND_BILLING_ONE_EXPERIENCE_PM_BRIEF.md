# PM brief — Plan & billing, one experience for every plan

**Stage 1 Parts 1–3 implemented 2026-10-28 · validation and owner gates in plan §9 · plan: `PLAN_AND_BILLING_ONE_EXPERIENCE_PLAN.md`**

## What changes for a customer

- **Plan & billing looks and reads the same on every plan.** Premium Coaches Portal, Tournament,
  Tournament Plus, League Plus and Club all show the same sections in the same order: your plan, what
  you're using, changing plan, what's included, reducing or cancelling (the Club order, Stage A ruling 6). Only the middle (what you're using,
  what's included) differs, because it describes a different plan.
- **A standalone coach never leaves the Coaches Portal for billing.** There is a **Plan & billing** row in
  their own navigation (desktop and phone), and the page wears the portal's look. The "Admin" door that
  dropped them onto a tournament-setup screen goes away for them.
- **Moving up a tier doesn't move the furniture.** A coach who becomes a club owner finds Plan & billing in
  the same kind of spot, laid out the same way, with the same words and the same buttons.
- **Emails, notifications and payment-return links land you in the right place** — your own portal, not an
  admin area you've never used.
- **A lapsed or cancelled owner can always get back in to reactivate**, from the page they land on.
- **Coaches on a club's team see who pays** ("Covered by <Club>") without any billing controls.

## Why it matters

Right now a customer who grows sees billing change shape at every step, and a solo coach is sent somewhere
that makes no sense. That is a trust problem at exactly the moment money is involved. It also costs us: the
same page is built twice and worded differently in each, so every plan change means editing several screens.

## What we gain for later

Plans are described once, in a single list. Adding a plan, renaming one, or changing what it includes means
editing that list and the shared wording — the screens follow. A build check will stop anyone from
hand-typing a plan name or price into a billing screen again.

## Tradeoffs, with eyes open

- **The admin area isn't fully retired for coaches.** A coach who hosts a tournament still manages it in the
  tournament pages, which have no portal equivalent today. Only the confusing entry point, the Admin door and
  the admin-style billing page go. The owner ruled a workspace-level “Tournaments you run” door with a quiet
  “Tournament helpers” link; their small placement drawing is owed before Stage 3.
- **It reverses last month's "just restyle the other plans" decision** — on purpose, at your direction.
- **No invoice list is added.** Invoices stay in the secure payment portal, as they are today.
- **Pricing isn't touched.** Whether a coach should see a "move up to Club" option in the plan table is a
  pricing call for `/strategy`.

## Priority and sequence

High, because it affects every paying customer's first impression of billing. Built in stages, each one
shippable on its own: drawn first (you rule on every plan and state), then one shared page, then the
Coaches Portal version and its door, then retiring the coach's admin view, then the remaining pieces and the
help guides. Each stage ends with a walk you can follow.

## Stage 1 copy review checkpoint — 2026-10-28

`PLAN_AND_BILLING_COPY.md` compares both existing pages and records the accepted vocabulary and the dated decisions. It corrects contradictory
Premium retention messages and removes promises of accounting features the shipped Club page does not claim.
Owners keep the real plan-specific actions; everyone else gets the same locked explanation. The proposed list
structure keeps published plan-drawer and marketing wording unchanged. Billing has its own approved display variant;
the owner chose the drawing's seven-item Premium billing list, preserving the eight-item published article.

The owner accepted Part 0 and gave these follow-up rulings:

- Use the local drawing source and report every difference from the copy document for the owner's decision. It has
  now been read end to end, including all six plan lists, every state, both page styles and all 13 Asks. The full
  comparison is in the copy document §12; the owner's drawing file was kept intact.
- Leave the token-check script alone. Its obsolete deleted-CSS entry is harmless. Any stronger coverage for the new
  shared billing body is a separate recommendation and, if requested, a separate commit.
- In the organization's ending free-time message, say “To keep {given}, contact us.” and give a working contact door.
  Preserve the running message and the coach's Keep Premium path. List readers/tests before changing the builder.
- Keep both billing and article wording in each plan's registry entry. Guard against missing variants and changes to
  any published article feature string. The rest of the proposal is approved subject to the trial and details-door
  checks and the explicit drawing comparison.
- Verify actual trial/payment behavior before promising a card or first-charge date. Keep a visible “See what {plan}
  includes” door in Change plan on every plan with a table; if the drawings omit it, report that instead of inventing
  its placement.

Findings for review: only Premium's included list differs between drawing and proposal; the five other lists match.
The tables draw no visible details link. Checkout collects a payment method, but the code does not require it to be
a card; eligibility also depends on prior subscriptions and configurable trial days. The copy document records the
wording choices and recommendations. These are findings, not new owner rulings. This follow-up changes documentation
only at that checkpoint; the owner subsequently authorised Part 1, whose result is below. No commit is authorised.

## Success looks like

- Open Plan & billing as a coach, a tournament organizer, a league owner and a club owner: the same page
  structure and words every time.
- A solo coach can find, change, cancel and reactivate their plan without ever seeing an admin screen.
- Every billing email and payment return takes the person to their own portal's page.
- Adding a new plan in a test needs one list entry, no screen edits.

## Part 1 result — 2026-10-28

Owners and non-owners keep their current screens and actions. Plan facts and both included-list versions now live
together. The Premium billing variant has the seven ruled items ready for the shared body, and every published
article keeps its exact existing text/order. Shared words include the settled owner decisions; the public trial
sentence stays in its separate marketing step. Tests enforce both list variants and prevent new billing screens
from adding another handwritten plan name, price or included item.

The unit suite, TypeScript and focused lint passed. Full verification still stops on shared lint setup, and a separate
lettering check reports unrelated CSS debt. The owner requires that full gate to clear before Part 1 is called done;
this is an implementation hand-off with those findings, not a clean release sign-off. No Part 2 work or commit.

The next-chat prompt, `PLAN_AND_BILLING_STAGE1_PART2_BUILD_PROMPT.md`, is prepared for use after Part 1's cleanup,
review and verification. It builds the reusable billing body and connects the existing Club screen first; moving every
admin plan onto it and changing navigation remain Part 3. The coach's own billing host is Stage 2. No build was started
by preparing the prompt.

## Part 2 entry check — 2026-10-28

The requested build's entry checks were run before implementation. All 11,638 unit tests passed, but full
verification exited at three lint errors in an unrelated development crash-test page. The earlier missing-plugin
error did not recur. Part 1's cleanup and review are still listed as owed in the latest project hand-off, with no
later completion record found. Exact findings are in the plan's Part 2 entry-gate audit.

Customers keep their existing screens and actions. The shared-body build can proceed when the required review
completion is established and full verification passes. This check changes tracking documents only; it does not
certify Part 1, start Part 2 implementation, or change the remaining Part 3 and Stage 2 boundaries.

## Part 2 result — 2026-10-28

After the owner confirmed Part 1's cleanup/review and instructed the build to proceed, the reusable billing body was
built and connected to the existing Club screen. Club owners keep their familiar connected plan/renewal/usage band,
with real usage counts, plan details beneath each target name, honest contact doors, and cancellation wording that
names their programs and explains retention and plan limits. Non-owners see only the owner-locked card.

The body renders every current plan and an isolated future-plan fixture through the same component. Other plans'
live admin screens remain for Part 3. The coach host stays in Stage 2. Ended coach free time remains distinct from
cancellation, including older ended grants; it keeps the existing Premium work instead of starting a second portal.
The shared organization ending message now has a working contact door on both live billing implementations.

The full unit suite and TypeScript checks passed; full verification still stops on unrelated crash-test lint errors.
Additional shared CSS/lettering findings and exact check results are recorded in the plan's Part 2 hand-off. The
completion gate is not called green. The dev server was restarted, its required login check returned HTTP 200, and
its logs showed no Supabase EACCES failures. The owner still owes the browser/390px/real Stripe walk; Part 2 owes its
own cleanup, review and targeted help review. No commit, push or production operation.

## Part 2 review fixes — 2026-10-28

This follow-up fixes gaps found after Part 2's cleanup and review. Priority is reliable recovery: if free time cannot
be read, an owner sees an honest unavailable status, Try again and Contact us, without a guessed charge, renewal or
cancellation. Once free time is known, cancelled customers can still reactivate or contact support even when the
Founding or availability read fails. Free Tournament recovery continues through support. Ended Premium free time
keeps its own Keep Premium route instead of being described as a cancellation. Non-owner access stays locked.

Club owners regain the team-growth and team-preservation explanations. Premium owners regain their free-time billing
sentence and cancelled customers' Basic tournament records door. Founding customers see the saved-payment-method
promise, can open the portal to change their choice/card, and can recover their chooser after browser Back or a delayed
confirmation. Routine refreshes keep the controls and open reviews stable. Every requested retained sentence is restored.

Success criteria are covered by rendered-state and executable request tests: no unreadable grant is treated as absent,
no stranded cancelled owner, exact money-request fields, and stable refresh/return behavior. The final check results
and failed-read state table live in the plan's Part 2 review-fix hand-off. These fixes reach the existing Club host;
other admin plans still cut over in Part 3 and the dedicated coach host remains Stage 2. The owner browser/Stripe walk,
`/simplify` on the delta, `/review` of the fixes and `/docs` remain owed. Stage 1 is not declared complete.


## Part 3 result — 2026-10-28

Every admin plan now opens the same Plan & billing body. Tournament and Tournament Plus keep their existing
subscription address; League Plus, both Club sizes and the standalone coach workspace keep organization billing.
The sidebar door sits beside Help, and the phone door is in More > You. The tournament settings card stays.
Standalone coaches keep the admin chrome until Stage 2 adds their own host.

The owner ruled billing delegable in this build: only the owner can grant it in Members, and a granted board member
can read billing and manage the plan, payment method and invoices, and upgrade. **Cancelling the subscription or moving to a smaller plan stays with the owner** (ruling 2026-10-29): a delegate sees neither option. On a cancelled organization a delegate can still reactivate. No role receives billing automatically.
Members without that access see a locked card, without loading billing data. Suspended billing users retain the
usage read so they can assess a recovery plan. Member chips and access-change emails name the grant.

Owners and delegates can select Monthly or Yearly before an upgrade. That selection does not rewrite the price
of the plan they already have. Staff free time continues to remove purchases, payment, move and cancel controls.
Stripe portal, card-save and next-season returns now resolve to the correct existing billing home. The old screen
and its stylesheet are retired. Success criteria, exact validation results, remaining owner/Stripe checks and the
Claude cleanup/review/docs steps live in the Part 3 hand-off in plan section 9. Stage 1 awaits those gates.
