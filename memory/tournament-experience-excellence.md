# Tournament Experience Excellence

## Current decision

Tournament and Tournament Plus UX should be treated as a top-level experience project, not only a page cleanup.

The project plan is archived at `docs/projects/archive/TOURNAMENT_EXPERIENCE_EXCELLENCE_PLAN.md`.
The PM brief is archived at `docs/projects/archive/TOURNAMENT_EXPERIENCE_EXCELLENCE_PM_BRIEF.md`.

## Product frame

Free Tournament should feel like a complete starter-event tool:

- One non-archived tournament.
- Basic registration, scheduling, scores, standings, public pages, news, and all-team email.
- FieldLogicHQ default presentation.
- Compact upgrade prompts only when the user reaches serious operations needs.

Tournament Plus should feel like the serious operating plan:

- Unlimited tournament slots and unlimited staff/admin seats.
- Custom registration questions, file collection, exports, payment-readiness tools, waitlist promotion/automation, targeted communication, cloning, full branding, post-event summaries, and results notification.

## Execution model

`TOURNAMENT_EXPERIENCE_EXCELLENCE_PLAN.md` is the archived umbrella project.

`TOURNAMENT_SECTION_REVIEW_PLAN.md` is the archived page-by-page admin sweep for bugs, design consistency, plan gates, Plus polish, and mobile verification.

`TOURNAMENT_ADMIN_UX_REFORMAT_PLAN.md` is the archived reference for records-first layout principles and shared tournament-admin primitives.

## Public mobile experience planning

Started on 2026-05-22.

- Active implementation plan: `docs/projects/active/codex_PUBLIC_TOURNAMENT_MOBILE_EXPERIENCE_PLAN.md`.
- Active PM brief: `docs/projects/active/codex_PUBLIC_TOURNAMENT_MOBILE_EXPERIENCE_PM_BRIEF.md`.
- Scope: public tournament home, registration, schedule controls, standings/results, teams, rules, news, hidden/empty states, post-event story, and mobile UAT.
- Product decisions captured: public schedule should use a compact mobile control bar plus filter bottom sheet; public registration should gain a real Info -> Review -> Next Steps flow; hidden/empty states should show organizer contact and useful next links; the no-banner hero fallback should become event-information-led instead of abstract-only.
- Tier posture: free Tournament remains a complete public event product with FieldLogicHQ default styling; Tournament Plus adds branding/customization, custom registration fields/files, targeted communication value, post-event summary/reporting, and richer branded recap moments.
- 2026-05-29 first implementation slice: public home now reads public page data through admin-safe public fetches so coach/parent-facing counts/status match schedule/register/teams, but the hero still intentionally omits Register/Join Waitlist because the nav Register action owns registration. Public registration now has Info -> Review -> Next Steps, with full-division waitlist confirmation inside the registration flow, custom answer/file review, organizer contact, fee/payment note, and Coaches Portal next links. Schedule controls were compacted with selects, segmented controls, icon calendar export, and mobile touch sizing; the planned bottom sheet remains future work. Teams, Schedule, Standings, Rules, and News empty states now include clearer next actions and organizer contact where available, and team profile mobile schedule rows were hardened for long names.
- 2026-05-29 Follow My Team slice: public visitors can save one team per tournament in browser local storage from the Teams page or Team Profile. Teams marks the followed team, Schedule auto-focuses that team's division/search context and highlights its games, and Team Profile exposes Follow/Following plus a schedule shortcut. This is public convenience only; no auth, database, registration, or Coaches Portal state changes.
- 2026-06-01 Tournament Day Home Mode slice: in-progress public tournament home pages now compact the hero and show a Tournament Day panel with Today's Games, Latest Finals, Field Shortcuts, Event Snapshot, and a browser-local My Team card when the visitor has followed a team. Register/Join Waitlist remains out of the hero by design; the nav Register flow still owns registration and waitlist entry.
- 2026-06-01 mobile schedule filter sheet slice: public schedule controls now keep desktop inline controls while phones get a compact division/filter bar, live on-page Team/Coach search, and an accessible bottom sheet for Pool Play/Playoffs plus List/Bracket. The sheet uses draft view values until Apply, includes Reset, locks body scroll while open, supports Escape close, and returns focus to the Filters button. Mobile game rows now use a looser phone-first layout so time/status, matchup, and location are not squeezed into the desktop grid.
- 2026-06-01 mobile schedule density refinement: mobile date/control text, status badges, and matchup typography were reduced; team/score matchups are centered below the time/status line while location sits beneath the matchup.
- 2026-06-01 public Results/Standings mobile slice: the public Results route still redirects to Standings, so Standings now presents the combined Results & Standings experience. The page adds final-score, pending-review, and remaining-game summary counts; a browser-local My Team standings/latest-score panel; visible Pending badges in table rows; clearer empty states with next links/contact; and a Recent Scores section for completed-tournament public record value. Public standings data now includes games, accepted teams, and venues.
- 2026-06-02 mobile density decision: Schedule owns game-by-game scores; Standings owns ranking/consequences. Mobile Standings now leads with a compact status line and slim My Team strip, uses a reduced Team/REC/RD/PTS table, and hides the duplicate Recent Scores feed on phones. Mobile Schedule rows were tightened into dense score-log rows so data-heavy schedules require less scrolling.
- 2026-06-02 visual hierarchy follow-up: Standings tie-breaker order moved out of the cramped table header and into footer context below the table. Public Schedule/result rows now intentionally mirror the admin Results & Scoring row language: short date dividers, compact date/time plus status, centered W/L/T score matchups, muted venue context, and a followed-team star in the right rail instead of the admin edit pencil.

## Phase 1 audit

Phase 1 static journey audit is complete in `docs/projects/archive/TOURNAMENT_EXPERIENCE_PHASE_1_JOURNEY_AUDIT.md`.

Top findings:

- Bulk registration boundary resolved: basic selected-row status/payment updates stay available on all tournament plans; Plus owns exports, payment reminders, targeting, custom fields, waitlist promotion, and reporting.
- Waitlist boundary resolved: collection is available on all tournament plans; promotion/queue management remains Plus-gated.
- Public registration shows a three-step indicator with a Review step but submits directly from the form.
- Tournament setup is split between dashboard nudges, Settings cards, and re-exported org pages.
- Branding Public Pages ordering and compact Plus locked-state polish are fixed; advanced Branding controls now render as disabled/locked controls for non-Plus users instead of repeated broad upgrade gates.
- Phase 2C verified Registrations, Schedule, and Results with data-rich Free/Plus UAT checks at desktop and 390x844. All returned HTTP 200 with seeded content visible, no page-level horizontal overflow, no duplicate pool labels, and working Results score modals.
- Multi-org owner auth and tournament data scoping were fixed after UAT exposed that multiple organization memberships could either redirect to login or load the first membership's tournament data. Route-aware layouts and client fetches now pass the visited `orgSlug`.
- Phase G extended the org-scoping fix across tournament admin/Plus API routes and client calls for branding, schedule publish, announcements, games, teams, registration fields, exports, reminders, summary, clone/populate, setup/seal/archive, venues, divisions, contacts, dashboard, activity, PDF settings, bottom nav, rules, and event/supporting pages.
- Registrations and Results no longer show indefinite loading when no tournament is selected; they clear state and Results shows "No tournament selected."
- Phase H responsive hardening converted supporting-page tables and action rows toward mobile-card/touch-friendly layouts.
- Scorekeeper route planning and public tournament mobile planning were split into separate future project prompts.

## Section review reconciliation

`TOURNAMENT_SECTION_REVIEW_PLAN.md` has been reconciled with the Phase 1 journey audit and archived with the completed project record.

Reconciled decisions:

- Re-export wrapper work is no longer assumed after Phase A/B; Venues, Staff & Access, Organization Settings, and Subscription stay as current re-exports unless browser testing shows real context confusion.
- Phase 1 audit JNY-06 is downgraded/reconciled to match that section-review finding.
- Bulk registration and waitlist boundaries are now settled for Phase G plan-gate signoff: free includes basic selected-row updates and waitlist collection; Plus includes waitlist promotion/automation and advanced registration operations.
- Settings hub completeness and scorekeeper/mobile scoring strategy are now explicit open questions in the section review.

## Phase 2C core admin QA

Phase 2C is complete as of 2026-05-22.

- Data-rich UAT seed now covers a Free tournament and a Tournament Plus tournament with divisions, teams, registrations, venues, games, pool slots, and Plus custom registration answers.
- Org-scoped tournament context was fixed: org context, tournament context, tournament list APIs, registrations, teams, games, divisions, venues, and pool-slot requests now pass the visited `orgSlug` and selected `tournamentId` so multi-org owners do not drift into the first membership's tournament data.
- Pool-label rendering was normalized so seeded names like "Red Pool" render as "RED POOL", not "RED POOL POOL".
- Schedule and Results refresh/loading behavior was hardened around tournament-context loading; Results score buttons now have accessible labels.
- Final matrix passed for Registrations, Schedule, and Results across Free/Plus and desktop 1440px/mobile 390x844: HTTP 200, seeded content visible, no page-level horizontal overflow, no duplicate pool labels, no false no-tournament/loading state, no console errors, no request failures, and Results score modal opens.
- Verification artifact: `test-results/tournament-phase2c/phase2c-final-check.json`.

## Phase G Plus gate and org-scope pass

Phase G code pass is complete as of 2026-05-22.

- Tournament admin APIs and client calls now pass the visited `orgSlug` so multi-org owners remain in the org shown in the URL for Plus/free actions such as branding, exporting, reminders, summary, clone/populate, schedule publish, setup/seal/archive, and supporting admin data.
- Branding/Public Site now exposes Logo, Theme, Hero Banner, Font, and Card Style as compact locked controls for non-Plus users, with free Public Pages controls still visible and usable.
- Verification passed: `pnpm.cmd tsc --noEmit`, focused ESLint on touched tournament admin/API files with zero errors, `git diff --check`, dev-server restart after clearing `.next`, and `GET /platform-admin/login?next=%2Fplatform-admin` returned HTTP 200 with no Supabase `EACCES`.
- Remaining scorekeeper and public-mobile work should start as separate plans rather than extending this archived admin sweep.

## Phase F design consistency pass

Phase F code pass is complete as of 2026-05-22.

- Added missing global aliases for tournament CSS tokens: surface/card depth, raised/inset backgrounds, subtle borders, text hierarchy, radius aliases, and common alpha tokens.
- Normalized repeated card, divider, and inset-panel styles across shared tournament admin primitives, Branding/Public Site, Event Settings, Registration Questions, Communication, Rules, Schedule generator/bracket surfaces, and Archives.
- Archives empty states now use the structured icon/title/body pattern instead of one muted line of copy.
- Verification passed: `pnpm.cmd tsc --noEmit`, focused ESLint on touched TSX files with zero errors, whitespace check, dev-server restart after clearing `.next`, and `GET /platform-admin/login?next=%2Fplatform-admin` returned HTTP 200; existing lint warnings remain.

## Phase H responsive hardening pass

Phase H code hardening is complete as of 2026-05-22.

- Manage Tournaments, Divisions, Contacts, and Archives now have labeled mobile-card table layouts below mobile/tablet breakpoints.
- Shared mobile modal behavior now gives dialogs better viewport fit and action buttons better touch sizing.
- Communication, Announcements, Branding/Event controls, Rules, Summary, and shared admin headers received responsive stacking/touch-target polish.
- Verification passed: `pnpm.cmd tsc --noEmit`, focused ESLint on touched TSX files with zero errors, `git diff --check`, dev-server restart after clearing `.next`, and `GET /platform-admin/login?next=%2Fplatform-admin` returned HTTP 200 with no Supabase `EACCES`; existing warnings remain.
- Project files were archived after final sign-off prep; follow-up findings should be tracked in new scorekeeper/public-mobile plans.

## Final browser sign-off prep

Prepared as of 2026-05-22.

- The final browser sign-off checklist lives in `docs/projects/archive/TOURNAMENT_SECTION_REVIEW_PLAN.md` under Phase H.
- Use `uat-test-org` for Free Tournament and `uat-plus-org` for Tournament Plus unless newer seeded orgs are available.
- Check desktop around 1440x1000 and mobile around 390x844.
- Material issues to record: horizontal overflow, unreachable row/header actions, broken or clipped modals, stuck loading/wrong-org data, confusing Plus locks, or first useful content buried below excessive controls.

## Archive status

Archived on 2026-05-22.

- Active docs moved to `docs/archive`: Tournament Experience Excellence plan/PM brief, Phase 1 journey audit, Tournament Section Review plan, Tournament Review Findings, and Tournament Admin UX Reformat plan/PM brief.
- `TODO.md` moved the tournament experience/admin review/reformat work to Completed Projects.
- Stripe planning docs are now archived, but Stripe cutover/trial-email work still has live `TODO.md` references.

## Key principles

- Records first on admin operation pages.
- Mobile is a tournament-day operating mode, not a squeezed desktop layout.
- Plus value should be contextual and compact.
- Public pages should build trust and avoid interrupting registration.
- Role and plan access should remain explicit unless a later phase proposes a deliberate change.
