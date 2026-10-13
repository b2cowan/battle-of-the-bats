# The free tournament tier review — session 1 prompt ("the deep review, the findings, the questions")

> Paste into a fresh session on `dev`. Written 2026-10-12. **This session reviews, reports and asks. It changes no gate,
> no plan setting, no screen, no copy and no help.** It ends when the owner has the findings and a question sheet to
> answer. The rulings, the `/strategy` log, the mockups and the build come after, in later sessions.
>
> **Started early, by the owner's choice (2026-10-12).** The plan says this project starts when the tournament admin
> redesign is done. The redesign is down to the owner's final end-to-end walk (ledger §306), 6c's four calendar
> findings and its close-out. This review is read-only, so it runs now. **The build waits for the redesign's close-out**,
> because it changes locks on the same screens.

## The owner's ask (2026-10-10)

*"reviewing and updating the functionality of the free tournament subscription tier, most notably the amount of
functionality visible in the application and what should be available, visible with a subscription lock, and not
visible at all. I expect the free tier to only be used by those running small exhibition tournaments, including the
coaches with coach portals, and we need to think of the differences between those and premium tournaments (i.e. there
should be no public or internal registration management, no payment tracking, no staff kits, etc.). do a deep review of
these, provide your findings to me, ask questions for me to answer, and then update accordingly."*

Every feature ends with exactly one of three answers: **included**, **visible with a lock**, or **not visible**.

## Read first

- `docs/projects/active/FREE_TOURNAMENT_TIER_REVIEW_PLAN.md` and `_PM_BRIEF.md`: the method, what existed on
  2026-10-10, and the nine questions. Re-verify every "what exists" line; parts of it changed after it was written
  (below).
- **The sources that say what a plan includes. They must agree, and drift between them is a finding:**
  - `lib/plan-features.ts`: the gates. Each feature has a lowest plan (`FEATURE_MIN_PLAN`), plus grants that skip the
    rank ladder (`PLAN_FEATURE_GRANTS`).
  - `lib/plan-config.ts`: limits (one tournament, three staff seats with officials exempt, and so on).
  - `docs/agents/strategy/PLAN_PRICING_FACTS.md`: the canonical facts, including the email split ("announcements
    free, communications workflow paid") and the Founding Season terms.
  - The platform admin's Plans & Pricing workspace and its feature matrix (`app/platform-admin/plans-pricing/`,
    `lib/plan-module-entitlements.ts`, `lib/platform-catalog-approval.ts`). Can it change what a plan includes at run
    time? Say so plainly.
  - The marketing surfaces: `app/pricing/`, `app/for-tournament-organizers/`, `app/for-coaches/`, and
    `docs/agents/brand/PRICING_PAGE_COPY.md`.
  - The help articles that describe the free plan (`lib/help-content/`).
- `docs/agents/strategy/BUSINESS_DECISIONS.md`, every entry about the Tournament plan, the Premium Coaches Portal, the
  free floors and Founding Season. In particular:
  - 2026-10-10, **one at a time**: a Completed event stops holding the free plan's one slot. Built 2026-10-10 in the
    tournament redesign's Stage 5.
  - 2026-10-08: the club scheduler is not on a Tournament plan.
- `docs/agents/brand/BRAND_STRATEGY.md`: the tier rules and the free floors. This project may change what one floor
  promises; that is the owner's and `/strategy`'s call, not yours.
- `docs/projects/active/FREE_TIER_STRATEGY_PLAN.md`: the 2026-06 strategy (per-operator free floors, one account). It is
  a reference, not authority.
- `docs/projects/active/TOURNAMENT_ADMIN_REDESIGN_PLAN.md` §6e (Stage 5) and its hub
  (https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM, the Stage 5 tab's overview). **Stage 5 left every free-plan lock
  or hidden section it met as it was and tagged it "free tier review". That list is your starting inventory**, for
  example:
  - Public site's six Locked cards;
  - Chat's free-plan wall (owner, 2026-10-10: "leave it as it is today, tagged for the free tournament tier review");
  - the lock line on Chat's title;
  - the free plan's view of the setup screens.

  Read the redesign's as-built records too: the screens changed this month (imports into Tools, Data tools retired,
  Event settings redrawn, the Staff kit, the board before the event).
- Memory: `project_queued_free_tier_and_platform_admin`, `project_tournament_admin_redesign`,
  `project_founding_season_2027`, `project_coach_host_own_team_entry`, `feedback_tournament_org_separation`,
  `feedback_mockups_as_claude_artifacts`, `feedback_project_hub_single_artifact`,
  `feedback_qa_walkthroughs_as_checkable_artifacts`, `feedback_clickable_design_annotations`,
  `feedback_past_decisions_are_reference_not_authority`.

## Facts to start from (read 2026-10-12; re-verify each)

- **The gates today:**
  - **The free Tournament plan already has:**
    - registration actions in bulk, and waitlist collection;
    - building a playoff bracket by hand;
    - schedule and results spreadsheets, the calendar file;
    - live scores, fan following and the installable app.
  - **Tournament Plus adds:**
    - the generators and the rain-delay tool;
    - custom registration questions, the registration export, waitlist automation and bulk imports;
    - reuse of a past event, targeted announcements and schedule-change notices;
    - the post-event summary and sealed archives;
    - PDF exports, payment-readiness tools and online payments;
    - fan score alerts, advanced branding and tournament chat.
- **So "no registration management, no payment tracking, no staff kits" is a real change.** On the free plan today,
  the public registration form, Accept and Reject, the waitlist and the Teams page's payment tracking all appear to be
  available. Confirm each from the code: some may be gated by a mechanism other than the feature list. The Staff kit
  page (`app/[orgSlug]/admin/tournaments/staff-kit/`) carries no gate of its own in the feature list; find out what
  decides whether a free organizer sees it.
- **The Premium Coaches Portal ($29 a month) ranks at the free tier for every tournament feature.** Its plan sits
  beside the free Tournament plan on the rank ladder, with grants only for PDF exports, PDF settings and coach chat.
  **Anything taken off the free plan comes off a paying coach's tournament too**, unless the review recommends a grant.
- **Founding Season:** Tournament Plus and the Premium Coaches Portal are free through 2027-09-30 for everyone who signs up
  by 2026-12-31. On 2027-10-01 a Tournament Plus org that doesn't pay drops to the free plan.
- **Teams can enter without registration:**
  - the organizer adds them;
  - Add Team finds teams already on the platform;
  - a hosting coach enters their own team in one click.

  Say how complete that path is if registration leaves the free plan.

## What the review covers

Every feature a tournament organizer can meet, on every screen, at a desk and on a phone:
- **Creation and setup:** the first run, New tournament, Reuse, the board before the event, and Event settings' seven
  cards (Overview, Registration Questions, Roster Requirements, Fees & Payments, Contact, Coach Emails, Schedule
  Rules).
- **Teams and registration:** the public registration form and page, Accept and Reject, the waitlist, pools, imports,
  and payments on Teams.
- **Communications:** announcements, targeted announcements, and the email the plan's volume guard limits.
- **The schedule:** generators, building by hand, the rain delay, publish, and change notices.
- **Game day:** the board, Results, Check-in, the scorekeeper and the gate, **the Staff kit**, volunteers and seats.
- **After the event:** Summary, the champions page, Reuse, archives.
- **The public site:** its pages, branding, the registration page, fan following, live scores, the installable app, and
  what the public sees of a free event.
- **Exports, chat, staff and seats.**
- **The coach's tournament:** how a Premium coach and a Basic coach host a tournament, what they meet, and how their
  teams enter other organizers' events. A free tournament with no registration changes how a Basic coach's team gets
  into it.

For each feature, record:
- what **Tournament (free)**, **Tournament Plus** and **a Premium coach's tournament** get today;
- **how a lock is shown** (a locked card, a padlock with or without words, an upsell wall, absent);
- **where the gate is enforced** (the screen only, or the server too);
- **what the pricing page, the comparison table, the organizer landing page and help claim**.

A claim the product doesn't keep, or a lock the server doesn't enforce, is a finding on its own.

**Count before you propose** (read-only, dev AND prod; put the numbers in the findings):
- free-plan organizations and their tournaments (past, live and draft);
- free tournaments that used registration, the waitlist, payment tracking or the Staff kit;
- Premium Coaches Portal teams that hosted a tournament, and what they used;
- organizations on comped Tournament Plus (Founding Season), and which paid features they have used.

A number is the case for a recommendation; a hunch is not.

## What this session produces

1. **The project's hub: ONE artifact,** republished at the same path for the project's life:
   `docs/projects/active/FREE_TOURNAMENT_TIER_REVIEW_HUB.html`. Load the `artifact-design` skill first. Tabs:
   - **Findings:** the inventory as one table (feature · screen · free today · Plus · coach's tournament · how it's
     locked · enforced where · what we claim · the finding), filterable by area. Every row opens its note and
     captures. Captures of today's screens at true size as evidence, read-only.
   - **Questions:** the answer sheet, with checkboxes and a paste-back (see below).
   - **Plan** and **Brief:** the two documents, mirrored.
2. **Findings in product-owner voice:** what a free organizer and a coach host meet today, what they will meet if the
   owner's starting view holds, and who loses what.
3. **The question sheet.** Each question gets options, a recommendation, the tradeoff and a checkbox per option, and the
   sheet has a paste-back the owner returns. **Order:**
   1. **The coach's tournament first.** Does a paying Premium coach's tournament get the free plan's limits, or more
      (a grant)? This one decides how much the rest costs.
   2. **Founding Season organizations**, and what happens on 2027-10-01 to the registrations, payments and Staff kit
      they set up.
   3. **Exhibition only, or small?** And if small, how small (teams, divisions, days).
   4. **How teams get in** without registration, and what an added coach receives.
   5. **Lock or hide:** the principle (a lock sells the upgrade; hiding keeps a small event clean), then each area's
      answer.
   6. **The public pages** of a free event.
   7. **Volunteers** without a Staff kit: can a free organizer still have someone score?
   8. **Existing free tournaments on production:** grandfather or not (with the count).
   9. **The marketing promise:** what the pricing page, the comparison table and the free floor say after this.
   10. **Anything the review finds** that the plan's list misses.
4. **Update the plan and brief** with the findings, the counts and the questions, all as proposed. Record nothing as
   ruled until the owner rules.

## When the owner answers (still in this session, if it has budget)

- Record the rulings in the plan, the brief and the hub's Decisions.
- **Hand the packaging rulings to `/strategy`** to log in `BUSINESS_DECISIONS.md`, with the Facts doc and the plan config
  to change together at the build. Don't write the decisions log or the Facts doc yourself.
- Then write the mockup session's prompt. The mockups draw, screen by screen, what a free organizer and a coach host see
  (included, locked or hidden), with the build after.

## Working beside the other sessions

- **The tournament redesign** is closing (the owner's final walk §306, 6c's four calendar findings, the close-out). It may
  publish its own hub and edit its plan. Read them; never publish or edit them.
- **Club Tier sessions** (the scheduler's walks, house league, bank reconciliation planning) share the dev server, the test
  clubs and the browser.
- **One browser tester at a time.** Before any probe, capture or `auth-setup`, ask the owner whether another session is
  measuring. **Probes write nothing.** The free test club (`uat-test-org`) has one tournament slot: **never create an
  event there.** Never reset a test club without asking.
- **No code, no gates, no copy, no help, no Facts doc.** Your files:
  - this project's plan and brief;
  - its hub;
  - its TODO line;
  - memory.
- **Git:** use a private index and explicit pathspecs. Build a shared file as HEAD plus your own hunks, and re-read HEAD
  immediately before committing. After committing, run `git reset -q -- <paths>` on the shared index. **Commit only when
  the owner says.**

## Hand-off

- Product-owner voice. Lead with the three or four findings that change the most, then the counts, then the question
  sheet.
- **Tell the owner to open the hub on a phone** and answer the questions there.
- Say plainly which questions block the rest (the coach's tournament and Founding Season).

## Do not

- Change a gate, a plan limit, the Facts doc, the decisions log, a price, copy, help or a screen.
- Draw the free tier's future screens before the questions are ruled. Captures of today's screens are evidence, not
  mockups.
- Treat the owner's starting view as ruled. It is the question, with the owner's lean stated.
- Reopen the tournament redesign's rulings. A lock it left "as today" is yours to review; anything else it ruled stands.
- Mint a second artifact. The hub is the only one.
