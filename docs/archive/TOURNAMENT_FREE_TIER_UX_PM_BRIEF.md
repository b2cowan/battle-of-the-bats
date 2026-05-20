# Tournament Free Tier UX PM Brief

## Summary

This work improves the first-time experience for a tournament organizer using the free Tournament plan. The current product already creates an organization, offers guided tournament setup, and supports registrations, schedules, results, rules, venues, and public tournament pages. The next step is to remove confusing handoffs, fix broken or inconsistent paths, and make the free-vs-paid boundary clear.

## Why It Matters

A new organizer should be able to sign up, create a first softball or baseball tournament, understand that it is a private draft, and know exactly what is required to publish it. Any confusion before the first tournament is live increases drop-off risk.

## Phase 1 - Trust, Safety, and Broken-Path Fixes

### 1. [x] Replace standalone tournament creation with the setup wizard

Problem: The standalone tournament manager still uses a shorter create modal, while onboarding uses a better guided wizard that covers details, divisions, welcome copy, venues, contact, and review. This creates two different tournament creation experiences, and the shorter one leaves organizers with more follow-up work.

Proposed solution: Extract the onboarding tournament setup flow into a reusable wizard and use it from Manage Tournaments. The venue step should let organizers select existing venues/diamonds to apply to the tournament and create new ones in the same flow.

Expected outcome: Every tournament creation path has the same guided flow, fewer dead ends, and a clearer route from draft setup to launch.

### 1A. [x] Expose venues inside tournament admin

Problem: Venues/diamonds are required for scheduling, results, maps, and public tournament pages, but they were only reachable through org admin. That makes tournament-tier customers feel like they are bouncing between two admin products.

Proposed solution: Add a Venues page to the tournament admin navigation and route it to the tournament-scoped diamond management experience.

Expected outcome: Tournament-tier organizers can manage the fields they need from the tournament workspace.

### 2. [x] Make mobile tournament activation use the same rules as desktop

Problem: The mobile bottom nav can set a tournament live directly, bypassing the desktop/API readiness checks for dates, divisions, contact email, open divisions, and free-tier tournament-slot limits.

Proposed solution: Route mobile activation through the same server-side activation action used by desktop.

Expected outcome: Publishing behaves the same on desktop and mobile, and the product no longer allows inconsistent tournament states.

### 3. [x] Secure tournament communication sending

Problem: The message-sending API accepts requests without validating that the sender is an authorized admin for the organization or tournament. This is a trust and abuse-prevention risk.

Proposed solution: Require authenticated admin context, verify org/tournament access, and validate recipients before sending.

Expected outcome: Communication features become safe enough to expose confidently to tournament organizers.

### 4. [x] Fix active notification contact display

Problem: Tournament context does not map the saved contact email into the shape the contacts page expects, so the active notification contact can fail to show as selected.

Proposed solution: Map `contact_email` to `contactEmail` in tournament context.

Expected outcome: Organizers can see which contact is currently used for tournament notifications.

## Phase 2 - Signup and Onboarding Clarity

### 5. [x] Clarify production email verification

Problem: In production, email verification blocks onboarding, but the current experience can feel like the user is simply waiting or repeating a verification action without enough context.

Proposed solution: Update signup and confirmation copy so it clearly explains that the organization has been created and email confirmation is required before continuing.

Expected outcome: Fewer users abandon signup because they understand what happened and what to do next.

### 6. [x] Reduce plan-selection anxiety during onboarding

Problem: The first screen after signup is plan selection, even though the organization already starts on the free Tournament plan. A first-time organizer may feel they must make a paid-plan decision before getting value.

Proposed solution: Reframe the plan chooser as "start free, upgrade when needed" and make the free Tournament path the obvious default.

Expected outcome: More organizers proceed into setup instead of pausing at pricing.

### 7. [x] Replace technical setup language with organizer language

Problem: Labels like "URL slug," "capacity," and "pools" are accurate but may be unclear to a non-technical tournament organizer setting up their first event.

Proposed solution: Rename fields and add short helper copy: "Public link," "Max teams," "Pools or groups," and simple division guidance.

Expected outcome: Setup feels like tournament administration, not software configuration.

## Phase 3 - Draft-to-Publish Checklist

### 8. [x] Add a draft-to-publish checklist

Problem: A new tournament is saved as a private draft, but the requirements to publish it are scattered across different screens and validation messages.

Proposed solution: Add a checklist on the tournament dashboard showing what is complete and what is still needed before publishing.

Expected outcome: Organizers always know the next step to make registration/public pages available.

### 9. [x] Communicate the free tournament-slot limit before failure

Problem: The free Tournament plan allows one non-archived tournament, but the limit is most clearly enforced only when lifecycle changes fail or on billing screens.

Proposed solution: Show "1 tournament slot included" near tournament creation and publish controls.

Expected outcome: The limit feels like a known plan rule instead of a surprise error.

### 10. [x] Improve draft public-page messaging

Problem: If an organizer visits or shares the org URL before activation, the public page can show a generic "public site not set up" message that does not explain the draft tournament state.

Proposed solution: For Tournament-plan orgs, show tournament-specific guidance when no tournament is active yet.

Expected outcome: Organizers understand that the tournament exists but is not public until they publish it.

## Phase 4 - Core Operations Cleanup

### 11. [x] Clarify registration and payment expectations

Problem: FieldLogicHQ already supports fee schedules, division fee overrides, and basic deposit/balance tracking, but the public registration flow implied online payment processing through a future payment link. That conflicts with the intended model: organizers collect payment outside FieldLogicHQ while using the app as the system of record.

Proposed solution: Reframe registration payments as external payment instructions and tracking. The public form shows fee expectations from the existing tournament/division schedule and says payment is handled directly by the organizer. Admin payment status continues to use the existing fee schedule, but division overrides only apply when the tournament is set to "By Division."

Expected outcome: Teams understand how payment works before registering, organizers keep deposit/balance tracking without FieldLogicHQ processing funds, and tournament-wide vs. division-specific fee rules behave predictably.

### 12. [x] Respect score finalization rules in the admin UI

Problem: The score-entry page directly marks games completed, while the API has separate submitted/finalized behavior for score review.

Proposed solution: Send score updates through the existing score API so finalization settings are applied consistently.

Expected outcome: Score review, official submission, and finalization behave predictably.

### 13. [x] Make announcement delivery clear

Problem: Announcements can be posted to the public tournament experience, but the UI does not clearly distinguish public posting from notifying teams.

Proposed solution: Label announcements as public posts unless notification delivery is implemented as an explicit option.

Expected outcome: Organizers know whether teams will actually receive a message.

### 14. [x] Complete or hide incomplete communication filters

Problem: Communication recipient filtering is not fully wired for division/team targeting, which can make the feature look more capable than it is.

Proposed solution: Finish role, division, and team recipient targeting, or hide incomplete filters until they work.

Expected outcome: Message counts and recipient selection match what will actually happen.

### 15. [x] Improve mobile day-of navigation

Problem: Mobile navigation omits Rules & Resources, Communication, and Past Tournaments, even though these areas can matter on tournament day.

Proposed solution: Add the missing tournament sections to the mobile "More" menu.

Expected outcome: Organizers can reach key tournament tools from a phone without hunting through desktop-only navigation.

### 15A. [x] Add tournament Settings & Access

Problem: Tournament-tier organizers need staff/access, subscription, org settings, score finalization, and venue controls, but several of those lived only under org admin.

Proposed solution: Add a tournament-admin Settings & Access page with role-aware links to staff/access, subscription, organization settings, score settings, and venues.

Expected outcome: Tournament-tier customers can stay in one tournament workspace for the account-level tools they need.

## Phase 5 - Plan Guardrails and Upgrade Consistency

### 16. [x] Align free-vs-Plus feature expectations

Problem: Pricing positions automated scheduling, bracket generation, email communication, and archives as Plus features, but some of those features are visible or usable on the free Tournament plan.

Proposed solution: Treat the free Tournament plan as a complete manual tournament operations product, then reserve capacity, automation, premium presentation, and durable history for Tournament Plus and above. League and Club plans should inherit all Tournament Plus tournament features.

Free Tournament should keep manual scheduling, registrations, score entry, standings, venues, rules/resources, public news posts, basic team/contact email, and the basic close/archive flow needed to free the single tournament slot. These are the features that make the free plan feel credible enough to run a real event.

Tournament Plus, League, and Club should unlock automated schedule generation, playoff/bracket generation, permanent or sealed tournament archives, advanced tournament branding, extra tournament slots, higher admin capacity, and officials not counting against seats. These are strong upgrade benefits because they save time, support repeat events, or improve the public presentation without blocking the core free workflow.

The admin UI should keep free navigation clean. Locked Plus benefits should appear beside the relevant action rather than as dead-end menu items: "Generate Schedule" on the schedule page, "Generate Bracket" in playoffs, "Seal Archive" in past tournaments, and advanced branding controls in settings. Basic Communication Hub email should remain free; future advanced communication features such as templates, delivery history, saved audiences, attachments, or higher-volume tools can become Plus-and-above features when built.

Expected outcome: The free tier feels trustworthy, and upgrade prompts are based on clear value instead of inconsistent availability.

Customer impact: Free organizers can run a tournament without feeling bait-and-switched, while upgrade reminders appear when the user naturally wants speed, scale, polish, or permanent history. Paid League and Club customers continue receiving the full Tournament Plus tournament toolkit as part of their higher-tier plans.

## Customer Impact

- New organizers get a clearer start-free path with less plan-selection anxiety.
- Tournament setup uses familiar organizer language instead of technical labels.
- Publishing has one obvious checklist instead of scattered requirements.
- Mobile day-of admin actions behave the same as desktop actions.
- Free and Plus plan expectations match pricing, onboarding, and the admin UI.

## Priority

High. The fixes affect conversion, first value, publishing confidence, and trust in the free tier. The highest-risk items are broken links, inconsistent activation checks, unauthenticated communication sending, and plan-feature mismatch.

## Success Criteria

- A new organizer can complete signup, onboarding, first tournament creation, and draft review without reaching a dead end.
- The organizer knows what is required before publishing.
- Desktop and mobile activation enforce the same rules.
- Public-facing tournament pages are available only when intended.
- Free-tier tournament-slot limits are visible before the user hits them.
- Plus-only features are either clearly locked or intentionally included in the free plan.
