# The free tournament tier — what it has, what it shows locked, what it hides — plan

**Status:** QUEUED 2026-10-10 (owner). Not started.
**Starts:** when the tournament admin redesign is done (its Stage 5 built). It may run while Club Tier finishes (owner,
2026-10-10: *"if tournament admins finish first, we can tackle the tournament free tier project while club tier
finishes up"*).
**PM brief:** `FREE_TOURNAMENT_TIER_REVIEW_PM_BRIEF.md`.
**A packaging decision:** every ruling here goes through `/strategy` (`BUSINESS_DECISIONS.md`), and the Facts doc
(`PLAN_PRICING_FACTS.md`) and `lib/plan-config.ts` change in the same unit of work as the build.

## The owner's ask (2026-10-10)

*"reviewing and updating the functionality of the free tournament subscription tier, most notably the amount of
functionality visible in the application and what should be available, visible with a subscription lock, and not
visible at all. I expect the free tier to only be used by those running small exhibition tournaments, including the
coaches with coach portals, and we need to think of the differences between those and premium tournaments (i.e. there
should be no public or internal registration management, no payment tracking, no staff kits, etc.). do a deep review of
these, provide your findings to me, ask questions for me to answer, and then update accordingly."*

## The method (the owner's order)

1. **A deep review.** Every feature a tournament organizer can meet, on every screen, at a desk and on a phone:
   what the free tier gets today, and how a lock is shown (or not).
2. **Findings to the owner.**
3. **Questions for the owner** (below, plus whatever the review finds).
4. **Rulings, logged by `/strategy`;** the Facts doc and the plan config change with the build.
5. **Mockups** of what a free organizer sees, screen by screen: available, visible with a lock, or not shown.
6. **The build,** then `/marketing` (the pricing page and comparison table), `/docs` (help) and the demos.

## What exists (read 2026-10-10; re-verify at kickoff)

- **The free Tournament plan today:**
  - one tournament, with "one at a time" ruled 2026-10-10 (a Completed event stops holding the slot; built by the
    tournament redesign's Stage 5);
  - three staff seats, with officials and scorekeepers exempt;
  - announcements free, the communications workflow paid.
- **The paid features gate on Tournament Plus.** For example:
  - the round-robin and playoff generators, and the rain-delay tool;
  - schedule-change notices and fan score alerts;
  - custom registration questions;
  - advanced branding;
  - reuse of a past tournament.

  The free plan builds playoff brackets by hand. The full list is in `lib/plan-features.ts`; the review reads it whole.
- **The Premium Coaches Portal ($29 a month) includes one tournament on the free tier's rules.** So "free" also
  describes part of a paid product.
- **Founding Season:** Tournament Plus is $0 for orgs that sign up by 2026-12-31, until the season ends. Those orgs
  drop to the free tier when it does.
- **Teams can already get into a tournament without registration:** the organizer adds them; Add Team finds teams
  already on the platform; a hosting coach enters their own team in one click (mig 297).
- **Earlier strategy:** `FREE_TIER_STRATEGY_PLAN.md` (per-operator free floors, one account, 2026-06-07), and the "three
  free floors" positioning in the brand canon. This project may change what one of those floors promises.
- **The tournament redesign's Stage 5** draws the paid setup path and tags every free-tier lock or hidden section it
  meets "free tier review" (added to its prompt 2026-10-10). That list is this project's starting inventory.

## Questions the review will have to answer (asked after the findings, not before)

1. **Exhibition only, or small?** Is the free tier the Exhibition format only, or any format at a small size? If small,
   how small (teams, divisions, days)?
2. **How teams get in** without registration: the organizer adds them, and a coach already on the platform is found by
   name. Does an added coach get anything to accept?
3. **The Coaches Portal's included tournament:** does a paying Premium coach's tournament get the free tier's limits,
   or more?
4. **Founding Season orgs:** when their comped Tournament Plus ends, what happens to registrations, payments and staff
   kits they set up during it?
5. **Existing free tournaments on production:** count them, then grandfather or not.
6. **Lock or hide:** the principle for when a paid feature is shown locked (it sells the upgrade) and when it is
   hidden (less clutter for a small event).
7. **The public pages:** what a free tournament's public site shows (schedule, standings, results) and what it doesn't
   (a registration page).
8. **Volunteers:** without a staff kit, can a free organizer still have someone score?
9. **The marketing promise:** what the pricing page and comparison table say the free plan includes, and the "three free
   floors" positioning.

## Not in scope

Prices; the Club or League plans; the coach portal's own features outside its tournament.
