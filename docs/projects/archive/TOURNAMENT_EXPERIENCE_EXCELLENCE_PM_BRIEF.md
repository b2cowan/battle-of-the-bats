# Tournament Experience Excellence PM Brief

## Proposed Functionality

FieldLogicHQ should treat the Tournament and Tournament Plus experience as the product's sharpest customer-facing workflow. This project improves the full tournament journey across desktop and mobile: signup, first setup, event configuration, registration intake, scheduling, scoring, communication, public tournament pages, post-event wrap-up, and Plus upgrade moments.

The work builds on the existing tournament admin UX reformat and tournament section review plans. Those plans remain the page-level execution detail. This brief defines the larger product outcome: make free Tournament feel like a clean starter event tool, and make Tournament Plus feel like the serious operating system for real tournaments.

## Why It Matters

Tournament is the primary live-selling product tier, and Tournament Plus is the clearest near-term paid conversion path. If tournament organizers feel buried under controls, confused by settings, or unsupported on mobile during event day, the product will lose trust exactly where it needs to feel strongest.

The tournament experience also creates the warmest acquisition loop for FieldLogicHQ. Coaches, visiting teams, parents, and staff all touch public schedules, registrations, results, and communications. A polished tournament experience makes those users more likely to try FieldLogicHQ themselves or activate a Team workspace later.

## Customer Impact

- Free Tournament users can confidently run one starter event without training, including basic selected-row registration updates and waitlist collection.
- Tournament Plus organizers get a faster, more professional operating experience for custom registration control, exports, payment reminders, waitlist promotion, targeted communication, branding, reporting, and repeat-event setup.
- Staff and scorekeepers can complete tournament-day tasks from mobile without fighting dense desktop layouts.
- Coaches and team contacts see clearer public pages, registration confirmation, schedules, results, and post-event links.
- Platform support load should drop because settings, plan gates, and next actions become easier to understand.

## Current Progress

As of May 22, 2026, the core admin QA, Plus gate/org-scope hardening, design consistency pass, and responsive hardening code pass are complete. The latest mobile work makes supporting admin tables readable as labeled cards on phones, improves modal/action touch sizing, and tightens responsive stacking across Communication, Announcements, Branding/Event controls, Rules, Archives, and Summary. Final browser sign-off remains the last customer-visible checkpoint.

## Priority

High. This should sit above general polish work because Tournament and Tournament Plus are the most direct acquisition and revenue surfaces. The project should sequence work so operational pages improve first, then setup/settings, public experience, and final verification.

## Role And Plan Differences

This project should not loosen permissions. Owners, admins, staff, coaches, scorekeepers, and public visitors keep their current access boundaries unless a later implementation phase explicitly proposes a change.

Plan behavior should become clearer, not more permissive:

- Free Tournament remains a complete starter-event product with one non-archived tournament, basic registration, selected-row registration updates, waitlist collection, scheduling, scores, standings, public pages, news, and basic team email.
- Tournament Plus remains the paid operating plan for unlimited tournament slots, 10 staff/admin seats, custom registration questions, file collection, exports, payment reminders, waitlist promotion/automation, payment-readiness tools, targeted communication, cloning, full branding, post-event summaries, and results notification.
- Locked Plus features should appear where the workflow need arises, but they should not block free users from basic tournament operations.

## Success Criteria

- A new free Tournament owner can create, configure, publish, and complete a starter tournament without confusing detours.
- A Tournament Plus owner can find and use paid operating tools from the workflow where they matter.
- On primary admin pages, records or the useful empty state appear after one compact header/toolbar, not after stacked panels.
- Mobile tournament-day pages have no horizontal overflow, no overlapping controls, and clear touch targets.
- Every Plus-gated tournament feature has accurate UI and server-side enforcement.
- Public registration, schedule, standings/results, team pages, and post-event surfaces feel consistent and trustworthy.
- The project produces a verified findings register, implementation backlog, and final handoff checklist.
