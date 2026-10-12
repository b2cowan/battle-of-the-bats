# Platform admin, reorganized for the support team's jobs — plan

**Status:** QUEUED 2026-10-10 (owner). Not started, nothing drawn.
**Starts:** when Club Tier and the tournament admin redesign are both done (owner, 2026-10-10). If the tournament
redesign finishes first, the free tournament tier review (`FREE_TOURNAMENT_TIER_REVIEW_PLAN.md`) runs while Club Tier
finishes; this project waits for both. **To confirm at kickoff:** whether "Club Tier done" means the Club release
(Stage 8) or also house league (Stage 9) and the Families redesign drawings. Recommended: the Club release.
**PM brief:** `PLATFORM_ADMIN_SUPPORT_CONSOLE_PM_BRIEF.md`.

## The owner's ask (2026-10-10)

*"reformat and reorganize platform admin to be more user friendly to the different business use cases and user types
that exist on the support team (i.e. troubleshooting technical issues, marketing resources, plan/subscription
modifications, user/org subscription observability and editability, etc.). part of the project should making the
design more of a warm theme like the rest of the app and then go section by section analyzing the design/ux so I can do
a serious review and testing to ensure they fit my needs."*

## What exists (read 2026-10-10; re-verify at kickoff)

- **About 35 pages** under the platform admin. Its sections:
  - **Overview, people and orgs:** overview, orgs, users, customer users.
  - **Plans and billing:** plans, plans & pricing, Stripe prices, Founding Season, early access, change requests, bulk
    operations, retention.
  - **Exports, email and help:** exports, email, email templates, feedback, help.
  - **Engineering:** observability, audit, dev tools.
  - **Marketing:** the pitch deck studio.
- **It is the only working surface still in the old dark look.** None of its pages uses the admin kit. Admin Design
  Continuity (closed 2026-09-30) moved every club, tournament, house-league and volunteer screen onto the coaches
  portal's design system and the one Warm / Dark setting; the platform admin was never in it.
- **Open work to fold in, not duplicate:**
  - `PROGRAM_PLATFORM_ADMIN_CONSOLE.md`: the operator walkthroughs. About 25 issues found by persona, most fixed, a long
    tail never verified, and **several areas never walked**.
  - `PLATFORM_ADMIN_ACTION_ENFORCEMENT_PLAN.md` and its audit findings: do the actions do what their screens promise?
  - Timed entitlement grants (comps and trials), the Stripe price-guard (H8), single-source-of-truth hardening (plan
    limits shown vs enforced), and observability / in-app feedback. Each has its own TODO line; this project decides
    which land inside it.
- Platform-admin sign-in is checked in the request proxy. Any change to who can open what is a security change.

## Proposed shape (the tournament redesign's method, which the owner has walked six times)

0. **A job inventory and a measured walk.** Every section mapped to the jobs the owner named:
   - troubleshooting a technical issue;
   - marketing resources;
   - changing a plan or a subscription;
   - seeing and editing a user's or an org's subscription;
   - plus any job the walk finds.

   Measure each job's path today (screens, taps, dead ends), at a desk (and on a phone only if the owner uses one
   there). Re-verify the program doc's open issues against today's code.
1. **The warm foundation.** The platform admin moves onto the admin kit and the one Warm / Dark setting. The old look
   is retired area by area, held by the old-look gate.
2. **Section by section, each drawn → ruled → built → walked.** True-size mockups on ONE hub, the owner's ruling, the
   build, then a checkable QA walk the owner tests against real support jobs. Order by the job the owner does most.

## Questions for the kickoff (not now)

1. **Who is on the support team today, and in the next year?** If it is the owner alone, organize by JOB, not by
   permission tier, and don't build staff roles until a second person exists. If there will be staff, what may each one
   change?
2. **Editing live customer data:** what needs a confirmation, what needs a reason in the audit log, and what should be
   undoable?
3. **Which job first:** the one done most, or the one that hurts most today?
4. **The phone:** is any support job done from a phone?
5. **Which of the open lines** (grants, the price guard, single source of truth, observability) land inside this
   project?

## Not in scope

Customer-facing screens; price, plan or gate changes (`/strategy` decides; this project only shows them); the
marketing site.
