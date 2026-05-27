# Tournament Plus Enhancement Plan

## PM Brief

**Project:** Tournament Plus as the serious tournament operating plan

**Goal**

Tournament Plus should feel like the obvious plan for any real rep organization running a meaningful tournament. The free Tournament plan remains useful for a small rec event, a one-off trial, or an organization that wants to test FieldLogicHQ before committing. Plus becomes the paid tier that removes operational friction: registrations, waitlists, bulk admin work, targeted communication, repeat-event setup, reporting, and professional public presentation.

**Why we are doing this**

The current free-to-Plus difference is too easy to summarize as "a few more tournament slots and branding." That is not enough for organizers to subscribe. Rep tournaments have real operational pressure: custom registration requirements, division caps, payment/deposit tracking, coach communication, export/reporting needs, and year-over-year setup work. Plus should solve those pains directly.

The second growth opportunity is coach acquisition. Coaches who attend a tournament are high-quality leads because many of them help run tournaments for their own teams or clubs. Every public tournament page, registration confirmation, coach portal touchpoint, and post-event results email should make it easy for those coaches to imagine running their own tournament on FieldLogicHQ.

**What changes for users**

Free organizers get a clean starter tournament: one event, FieldLogicHQ default styling, basic schedule/results, basic team registration, basic communication, and public pages that show FieldLogicHQ attribution. They can experience the platform, but serious workflows surface clear upgrade prompts.

Tournament Plus organizers get the full tournament operations toolkit: unlimited tournament slots, 10 staff/admin seats, full branding control, custom registration questions, file uploads, CSV export, bulk registration actions, waitlist automation, targeted announcements, cloning, post-event summaries, and stronger payment/deposit tracking.

Coaches and visiting team contacts see subtle, useful invitations to run their own tournament. These CTAs should appear at moments of intent: public tournament pages, registration confirmation, results pages, post-tournament emails, and coach portal context.

**Business outcomes**

- Increase free-to-Plus conversion by putting upgrade triggers inside real organizer workflows, not just at a tournament-slot cap.
- Make Plus easier to sell: "Free is for trying or running a small rec event; Plus is for operating a real tournament program."
- Create a coach acquisition loop from every hosted tournament.
- Improve annual retention by reducing repeat-event setup work through cloning, templates, and summary reporting.

**Success metrics**

- Free-to-Plus upgrade rate from locked feature prompts.
- Click-through rate on public "run your own tournament" CTAs.
- Coach/signup conversion from tournament pages and post-event emails.
- Number of Plus tournaments using custom fields, export, waitlist, targeted announcements, and clone.
- Reduction in manual admin work signals: bulk actions used, CSV exports generated, waitlist promotions completed.
- Plus renewal/retention after at least one completed tournament.

---

## Product Positioning

### Free Tournament plan

Free is the starter tier. It should help an organizer prove that FieldLogicHQ works, but it should not comfortably run a serious rep tournament.

Recommended free boundaries:

- 1 non-archived tournament.
- 3 staff/admin seats.
- FieldLogicHQ default public styling only.
- "Powered by FieldLogicHQ" public attribution.
- Basic tournament setup, divisions, venues, manual scheduling, scores, standings, and public results.
- Basic team registration with standard fields only.
- Basic all-team communication only.
- No custom registration questions, file uploads, CSV export, bulk registration actions, targeted announcements, cloning, custom branding, post-event report, or online payment/deposit workflows.
- Optional starter complexity ceiling: cap free tournaments at a configurable team or division threshold, with grandfathering and platform-admin overrides. Recommended first evaluation: 16 accepted teams or 4 divisions. If implemented, this must be communicated as "starter event size" rather than a punitive limit.

### Tournament Plus plan

Plus is the serious tournament operations tier.

Recommended Plus boundaries:

- Unlimited non-archived tournament slots.
- 10 staff/admin seats.
- Full public branding control: logo, colors, presets, card style, font, and dark/light mode.
- Registration Control Bundle: custom questions, file uploads, required fields, waitlist automation, CSV export, bulk actions, and division/status targeting.
- Organizer Productivity Bundle: tournament cloning, reusable setup patterns, targeted announcements, post-event summaries, and public results notification.
- Payment Readiness Bundle: polished fee/deposit tracking now; online entry fee/deposit collection as a follow-up paid-tier feature.

---

## Implementation Principles

- Gate by workflow value, not by annoyance. Free should be useful, but the first serious operational need should point to Plus.
- Server-side gates are mandatory. UI gates are helpful, but APIs and public rendering must enforce the plan boundary.
- Do not silently downgrade behavior. If a free org sends Plus-only filters or export requests, return a clear upgrade response instead of ignoring filters.
- Preserve existing tournament status vocabulary unless intentionally migrated. The current tournament registration status is `waitlist`, not `waitlisted`.
- New migrations must start at `054` because `050`, `051`, `052`, and `053` already exist.
- Any promotional email or outbound coach acquisition surface must account for Canadian anti-spam requirements: clear sender identity, appropriate consent basis, unsubscribe where required, and transactional copy that does not overreach.
- Instrument each upgrade surface so product decisions can be based on actual usage.

---

## Phase 0 - Packaging, Metrics, and Feature Taxonomy

*Purpose: define the paid package before building more UI. No user-facing migration required.*

### 0.1 Plan feature taxonomy

- [x] `lib/plan-features.ts` - add explicit Plus feature keys for `custom_registration_fields`, `registration_export`, `bulk_registration_actions`, `waitlist_automation`, `tournament_cloning`, `targeted_tournament_announcements`, `post_tournament_summary`, and `online_tournament_payments` if payment work is included in a later phase.
- [x] Update `requiresTournamentPlusCopy()` copy so locked states explain the operational benefit, not just the plan name.
- [x] Audit existing ad hoc `org.planId !== 'tournament'` checks and decide whether they should use `hasPlanFeature()`; Phase 0 adds the shared feature keys, and later feature gates should use them instead of adding new ad hoc plan checks.

### 0.2 Package and pricing copy audit

- [x] `lib/plan-config.ts` - set Tournament Plus `tournamentLimit` to `9999` and `seatLimit` to `10`.
- [x] Document `plan_config_overrides` rollout risk: production should be checked in Platform Admin before launch because DB overrides can still supersede code defaults.
- [x] `components/PricingSection.tsx` - rewrite public pricing copy around "starter event" vs. "serious tournament operations."
- [x] Signup/onboarding plan selection - update plan cards, feature bullets, trial copy, and default plan framing so new organizers see the same Free vs. Plus promise before they create an org.
- [x] `app/[orgSlug]/admin/org/billing/page.tsx` - update in-app billing upgrade cards to match the public pricing promise.
- [x] `app/[orgSlug]/admin/org/billing/mock-portal/MockPortalClient.tsx` - update dev/mock plan copy if it displays limits.
- [x] Platform Admin plan/pricing screens - update internal support-facing labels and feature summaries so staff see the same package definition customers see.
- [x] Help content - update tournament and billing help pages after the gates ship; Phase 0 updates the current help copy, and later user-facing gate work should refresh help again.

### 0.3 Marketing surface audit

- [x] Public marketing site - audit homepage, `/pricing`, plan comparison cards, CTAs, FAQ copy, and any "Tournament Plus" references for the new starter-vs-operations positioning.
- [x] Signup and onboarding - audit plan chooser, post-signup onboarding copy, checkout entry points, and trial messaging.
- [x] In-app upgrade surfaces - audit admin billing, `UpgradeGate` locked states, module upgrade prompts, tournament admin empty states, and feature-specific upgrade nudges.
- [x] Public tournament acquisition surfaces - audit free-tier "Powered by FieldLogicHQ" badge, public visitor CTA, registration confirmation CTA, and post-event results CTA; most of these surfaces are still Phase 2 builds, so Phase 0 defines their source vocabulary.
- [x] Transactional and lifecycle email templates - audit plan-related copy in checkout, trial, cancellation, downgrade, results, registration, and payment/deposit emails.
- [x] Support/admin surfaces - audit Platform Admin org detail, Plans & Pricing, customer support notes, and any operator-facing plan feature summaries.
- [x] Documentation - audit help hub, tournament help, billing help, and onboarding docs so users do not see stale "more slots and branding" positioning.
- [x] Tracking - every audited surface should either emit source metadata for conversion analytics or have a documented reason why tracking is not useful.

### 0.4 Product analytics foundation

- [x] Use `platform_events` or a thin wrapper around `writePlatformEvent()` for upgrade and acquisition events.
- [x] Track locked-feature impressions and clicks for custom fields, export, bulk actions, waitlist automation, targeted announcements, clone, branding, and summaries.
- [x] Track public CTA impressions and clicks with source metadata: public badge, public banner, registration confirmation, post-event email, coach portal banner, summary page.
- [x] Add platform-admin reporting tasks for Plus funnel metrics after enough events exist; Phase 0 defines event names/source metadata and leaves dashboard reporting for a later Platform Admin analytics pass.

### 0.5 Free complexity ceiling decision

- [x] Decide whether the free plan should enforce a team/division ceiling now or after initial analytics.
- [x] If yes, design a configurable limit with platform-admin override and grandfathering for existing orgs. Not applicable for the Phase 0 decision.
- [x] If no, document the decision and rely on feature gates first. Decision: do not enforce a free team/division ceiling in Phase 0; rely on feature gates and analytics first.

---

## Phase 1 - Free vs. Plus Boundary and Branding Gate

*Purpose: make the product line visible and enforceable. No DB migration expected unless a free complexity ceiling is added.*

### 1.1 Public branding enforcement

- [x] `app/[orgSlug]/[tournamentSlug]/layout.tsx` - for free orgs, ignore all stored tournament branding fields and render platform defaults.
- [x] Free orgs must not apply tournament `themePreset`, `themePrimary`, `themeAccent`, `themeFont`, `themeCardStyle`, `colorMode`, `logoUrl`, or hero/banner styling on public tournament pages.
- [x] Plus+ orgs keep existing customization behavior.

### 1.2 Branding settings write gate

- [x] `app/api/admin/tournament-branding/route.ts` - reject all free-plan writes for Plus-only visual fields, including preset and light/dark mode.
- [x] Keep public page visibility controls separate from visual branding so free orgs can still choose which tournament pages are visible if that remains part of the free product.
- [x] `app/[orgSlug]/admin/tournaments/branding/page.tsx` - wrap Plus-only controls in `UpgradeGate requiredPlan="tournament_plus"`.
- [x] Confirm free orgs cannot "bank" custom branding while free and have it appear publicly before upgrading.

### 1.3 Pricing and billing copy

- [x] Free public pricing copy: "starter event," "default FieldLogicHQ styling," "Powered by FieldLogicHQ," and "basic registration."
- [x] Plus public pricing copy: "Registration Control Bundle," "unlimited tournament slots," "10 staff/admin seats," full branding, custom questions, export, bulk actions, waitlist automation, cloning, targeted announcements, and summaries.
- [x] Billing page upgrade copy should mirror the public pricing page so owners see the same value proposition inside the app.
- [x] Signup plan selection copy should mirror public pricing and billing copy so the value proposition is consistent from first visit through upgrade.
- [x] Locked-state copy should name the job-to-be-done: export team lists, collect custom registration info, process registrations in bulk, manage waitlists, target the right teams, or clone last year's setup.

### 1.4 Downgrade and retention review

- [x] Review downgrade/cancel flows so Plus-only fields remain stored but inactive on free, consistent with existing retention behavior.
- [x] Ensure downgrade messaging explains which Plus features become unavailable.
- [x] Ensure free public pages revert to platform defaults immediately after downgrade.

---

## Phase 2 - Coach Acquisition and Public Growth Surfaces

*Purpose: turn hosted tournaments into acquisition loops without hurting the participant experience.*

### 2.1 Free public attribution

- [x] `components/marketing/PoweredByBadge.tsx` - create a subtle badge for free public tournament pages.
- [x] Badge copy: "Powered by FieldLogicHQ" with a compact "Run your own tournament" link.
- [x] `app/[orgSlug]/[tournamentSlug]/layout.tsx` - render the badge only for free-plan tournaments.
- [x] Track badge impressions and clicks.

### 2.2 Public visitor CTA

- [x] `components/marketing/TournamentAcquisitionBanner.tsx` - create a dismissible public banner for visitors who may run tournaments.
- [x] Show to unauthenticated visitors and authenticated users who do not belong to the tournament owner org.
- [x] Use session/local dismissal keyed by tournament ID and CTA source.
- [x] Link to `/pricing` or signup with source params such as `source=tournament_public`, `sport`, `orgSlug`, and `tournamentSlug`.
- [x] Avoid showing the banner on pages where it interrupts registration or score entry.

### 2.3 Registration confirmation CTA

- [x] After a successful team registration, show a small "Run a tournament like this" CTA to the coach/contact.
- [x] Link to signup/pricing with source params and tournament context.
- [x] Track confirmation CTA impressions and clicks.

### 2.4 Coach portal awareness

- [x] `app/api/admin/org/has-tournaments/route.ts` - add a scoped route that returns whether the org has non-archived tournaments.
- [x] `app/[orgSlug]/coaches/page.tsx` - show a one-time banner to coaches when their org has tournament entitlement but no tournaments.
- [x] CTA should point to tournament admin setup for same-org coaches, and to pricing/signup if the coach is outside the organizer org. Same-org coach portal path points to tournament setup; outside-org acquisition is handled by public tournament and registration CTAs because outside coaches cannot access another org's coach portal.
- [x] Dismiss via local storage keyed by org/user.

### 2.5 "Clone this format" acquisition concept

- [x] Add a post-MVP design task for a public "Use this tournament format" CTA.
- [x] Target behavior: start signup/onboarding with sport, division count, venue count, and schedule style prefilled from the viewed tournament.
- [x] Do not expose private registration data or team contact data.

### 2.6 Email compliance guardrail

- [x] Define which emails are transactional and which are promotional. Transactional registration/results/payment emails can include one secondary product CTA; repeated standalone acquisition emails are promotional.
- [x] Add unsubscribe/consent handling before sending repeated promotional coach acquisition emails. No repeated promotional email campaign should ship until consent/unsubscribe support exists.
- [x] Keep post-event transactional emails focused on results; acquisition CTA should be secondary and compliant.

---

## Phase 3 - Registration Control Bundle

*Purpose: make Plus indispensable during the highest-friction part of tournament operations.*

### 3.1 Migration 056 - custom registration fields

- [x] `supabase/migrations/056_tournament_registration_fields.sql` - create `tournament_registration_fields`.
- [x] Fields table: `id`, `tournament_id`, `org_id`, `label`, `field_type`, `options jsonb`, `required boolean`, `sort_order int`, `is_archived boolean`, `created_at`, `updated_at`.
- [x] `supabase/migrations/056_tournament_registration_fields.sql` - create `tournament_registration_field_answers`.
- [x] Answers table: `id`, `registration_id`, `field_id`, `value_text`, `value_json`, `file_url`, `created_at`, unique `registration_id + field_id`.
- [x] Add indexes for tournament field listing and registration answer lookup.
- [x] Apply migration in dev and production before UI work.

### 3.2 Custom registration fields admin

- [x] `lib/db.ts` - add helpers to list, create, update, archive/delete, reorder, and read answers for tournament registration fields.
- [x] `app/api/admin/tournaments/[tournamentId]/registration-fields/route.ts` - GET and POST with scope guard and Plus plan gate.
- [x] `app/api/admin/tournaments/[tournamentId]/registration-fields/[fieldId]/route.ts` - PATCH and DELETE/archive with scope guard and Plus plan gate.
- [x] `app/[orgSlug]/admin/tournaments/settings/registration-fields/page.tsx` - add the admin UI.
- [x] Supported field types: short text, long text, dropdown, checkbox, and file upload.
- [x] Add "Registration Questions" to tournament settings navigation.
- [x] Free orgs see an upgrade state, not editable controls.

### 3.3 Public registration form integration

- [x] `app/[orgSlug]/[tournamentSlug]/register/page.tsx` - render Plus custom fields below the standard team/contact fields.
- [x] Enforce required field validation client-side and server-side.
- [x] `app/api/register/route.ts` - accept and validate custom registration answers.
- [x] File upload fields use the private `tournament-registration-files` storage bucket path and are not exposed publicly.
- [x] Free orgs ignore stored custom fields publicly until upgraded.

### 3.4 Registration export

- [x] `app/api/admin/tournaments/[tournamentId]/registrations/export/route.ts` - create a server-side CSV export route.
- [x] Auth: org admin/staff with tournament scope and tournament module access.
- [x] Plan gate: Plus only; free returns 403 with upgrade copy.
- [x] CSV columns: team name, division, status, contact name, email, phone, registered at, payment/deposit fields, waitlist position, and one column per custom field label.
- [x] `app/[orgSlug]/admin/tournaments/teams/page.tsx` - replace or supplement current client-side export with the gated server export.
- [x] Track export attempts and completed exports.

### 3.5 Bulk registration actions

- [x] `app/api/admin/tournaments/[tournamentId]/registrations/bulk/route.ts` - create a scoped POST route.
- [x] Actions: approve/accept, reject, waitlist, mark deposit paid, and mark paid.
- [x] Email selected action shares the Phase 5.2 targeted communication workflow.
- [x] Use current tournament status vocabulary: `pending`, `accepted`, `rejected`, `waitlist`.
- [x] Plan gate bulk actions to Plus in the existing admin team update API foundation.
- [x] `app/[orgSlug]/admin/tournaments/teams/page.tsx` - add row selection and a stable bulk action bar.
- [x] Free orgs see locked bulk action affordance with upgrade copy.
- [x] Track bulk action use and selected row counts.

### 3.6 Waitlist automation completion

- [x] Audit existing tournament waitlist implementation before adding schema. Current code already has `age_groups.capacity`, `teams.waitlist_position`, and `status: 'waitlist'`.
- [x] Do not add a new `waitlisted` status unless the whole tournament registration model is intentionally migrated.
- [x] `app/[orgSlug]/[tournamentSlug]/register/page.tsx` - show division capacity and "Join Waitlist" state when accepted slots are full.
- [x] `app/api/register/route.ts` - when a division is full, create registration as `waitlist` with the next `waitlist_position`.
- [x] `app/api/admin/teams/route.ts` or a new scoped route - gate waitlist promotion automation to Plus.
- [x] Send appropriate confirmation emails for pending/accepted/waitlist outcomes.
- [x] On promotion, clear `waitlist_position`, assign an open slot when slot-first roster is configured, and close position gaps.
- [x] Track waitlist joins and promotions.

### 3.7 Free registration limits

- [x] If Phase 0 chooses a free team/division ceiling, enforce it in public registration and admin add-team flows. Phase 0 did not choose a free team/division ceiling for launch, so no enforcement was added.
- [x] Show upgrade copy before the organizer hits a hard wall. Not needed until a free complexity ceiling is explicitly chosen.
- [x] Add platform-admin override support if needed. Not needed for the launch scope because no free complexity ceiling exists.

---

## Phase 4 - Payment and Deposit Value

*Purpose: strengthen the Plus value proposition around money collection and payment tracking.*

### 4.1 Deposit tracking polish

- [x] Review existing fee/deposit UI in `app/[orgSlug]/admin/tournaments/teams/page.tsx`.
- [x] Make payment/deposit status visible in registration detail, CSV export, and summary views.
- [x] Add filters for unpaid, deposit paid, paid in full, and past due.
- [x] Gate advanced payment reporting/export to Plus if basic payment status remains free.

### 4.2 Payment reminder workflow

- [x] Add a Plus-gated "Send payment reminder" action for selected teams.
- [x] Use templates that include amount due, due date, tournament contact, and public payment instructions.
- [x] Track reminders sent.

### 4.3 Online entry fee/deposit collection research

- [x] Decide whether tournament entry payments should be processed through Stripe Connect, manual payment instructions, or a simpler invoice/payment-link workflow. Decision for this project: keep online tournament payment collection out of the Tournament Plus launch scope.
- [x] Document fees, refund flow, payout ownership, disputes, and tax/accounting implications. Deferred to a separate online tournament payment collection research task before any payment-processing build.
- [x] If approved, create a dedicated implementation plan for online tournament payments before building. Tracked as a separate follow-up task, not part of this completed launch project.

**Phase 4 implementation note:** Manual payment readiness shipped without new payment-processing schema. `payment_readiness_tools` is Plus-gated and covers the registration payment dashboard, payment filters, and selected-team payment reminders. Online fee/deposit collection remains a separate research and architecture decision before any Stripe Connect or payment-link workflow is built.

---

## Phase 5 - Organizer Productivity Bundle

*Purpose: reduce repeat-event setup time and communication mistakes for Plus organizers.*

### 5.1 Tournament cloning

- [x] `lib/db.ts` - add `cloneTournament(sourceTournamentId, orgId, options)`.
- [x] Clone into a new draft tournament.
- [x] Copy selected items in safe order: tournament row, age groups/divisions, pools/slots if selected, venues, branding, page visibility, welcome/rules content, custom registration fields, and fee schedule.
- [x] Do not copy teams, registrations, scores, games, payments, or private notes unless a future workflow explicitly supports it.
- [x] `app/api/admin/tournaments/[tournamentId]/clone/route.ts` - scoped Plus-only POST route.
- [x] `components/tournaments/CloneTournamentModal.tsx` - modal with new name/date fields and copy-option checkboxes.
- [x] `app/[orgSlug]/admin/tournaments/settings/page.tsx` - add Plus-gated clone button.
- [x] Track clone starts and successful clone completions.

**Phase 5.1 implementation note:** Cloning copies setup only into a draft tournament. Divisions are reset open and schedule-unpublished, slot placeholders are empty, and only the pinned "Welcome!" message is copied from announcements. Broader announcement templates remain a future targeted-announcements workflow.

### 5.2 Targeted announcements

- [x] `app/api/send-message/route.ts` - accept scoped targeting filters for tournament email sends.
- [x] Filters: division IDs, registration statuses, payment statuses, selected team IDs, team/contact audience, and contact roles.
- [x] Plus-only filters return 403 for free orgs. They do not silently send to everyone.
- [x] `app/[orgSlug]/admin/tournaments/communication/page.tsx` - add Plus audience controls and recipient preview for targeted sends.
- [x] `app/api/admin/announcements/route.ts` - gate division-specific public News visibility to Plus.
- [x] `app/[orgSlug]/admin/tournaments/announcements/page.tsx` - show public News division visibility controls for Plus orgs.
- [x] Free orgs see locked targeted-audience prompts and can still send basic all-team email / all-division public News posts.
- [x] Track targeted vs. all-team email attempts, blocked attempts, and completions.

**Phase 5.2 implementation note:** Basic all-team email remains available on the free Tournament plan. Tournament Plus and higher can target emails by registration status, payment status, division, selected teams, and tournament contacts, and can scope public News posts to selected divisions. Server gates prevent unauthorized targeting from falling back to all recipients.

### 5.3 Tournament staff workflow

- [x] Evaluate whether 10 Plus seats are enough once registrar, scheduler, scorer, treasurer, and communications roles are separated.
- [x] Add a later-phase task for tournament-specific staff presets if current role/capability controls are too broad.
- [x] Consider Plus-gated staff role templates: Registrar, Scheduler, Communications, Scorekeeper Manager.

**Phase 5.3 implementation note:** The current role/capability model is enough for this phase. Tournament Plus's 10-seat allowance covers the expected core event crew: lead organizer, registrar, scheduler, communications lead, scorer manager, and payment/accounting contact. The product guidance now directs owners to use Admin sparingly, Staff for operators, tournament assignments for event scoping, and owner-only capability overrides for finer access. Dedicated tournament role presets should remain a later enhancement after real usage shows which presets reduce setup time.

### 5.4 Setup templates

- [x] Add a post-clone follow-up task for reusable tournament templates.
- [x] Target use case: an org runs several similar events and wants a reusable setup without choosing a prior tournament each time.

**Phase 5.4 implementation note:** Cloning remains the supported repeat-setup workflow. Reusable setup templates are deferred as a post-clone enhancement for organizations that run several similar tournaments and do not want to choose a prior event each time.

---

## Phase 6 - Post-Event Summary, Results, and Renewal Loop

*Purpose: make completed tournaments valuable records and create compliant acquisition moments.*

### 6.0 Post-event retention strategy

- [x] Treat post-event retention as part of Phase 6, not a detached TODO project.
- [x] Identify the moments where retention is helpful and not pushy: tournament completion, results finalization, summary view, archive/seal, clone-next-year, and next-year planning.
- [x] Define free vs. Plus post-event value:
  - Free Tournament keeps basic public results and manual schedule/results access.
  - Tournament Plus unlocks a polished summary/report, richer archive/recap value, clone-next-year prompts, and renewal planning nudges.
- [x] Keep all renewal/upgrade CTAs inside tournament admin subscription/pricing (`/admin/tournaments/settings/subscription`) for Tournament and Tournament Plus users.
- [x] Decide before implementation whether any reminder/retention workflow needs new schema, or whether the MVP can be generated from existing tournament, registration, schedule, and results data.
- [x] Success criteria: more completed Plus tournaments view/share a summary, clone a future draft, or keep/renew Plus within a defined post-event window.

### 6.1 Migration 061 - post-event notification setting, only if needed

- [x] If automatic team notification is approved, add `supabase/migrations/061_tournament_notification_settings.sql`.
- [x] Candidate columns: `notify_teams_on_complete boolean not null default false`, `results_notified_at timestamptz`, and/or a lightweight idempotency marker.
- [x] Do not create this migration if Phase 6 starts with a manual summary/report MVP that can use existing data.
- [x] Apply any Phase 6 migration in dev and production before UI work.

### 6.2 Results notification

- [x] `app/[orgSlug]/admin/tournaments/settings/event/page.tsx` - add a Plus-gated toggle for notifying registered team contacts when results are finalized.
- [x] Identify the tournament status/finalization route and send only when the tournament transitions into the chosen completed/finalized state.
- [x] Add an idempotency guard so teams are not notified multiple times for the same tournament completion.
- [x] Email should include standings/results link, tournament name, organizer contact, and a small compliant FieldLogicHQ CTA.
- [x] Track notifications sent and email CTA clicks where possible. Notification sends are tracked in `platform_events`; the email CTA carries `source=post_event_results_email` for attribution until a dedicated redirect/campaign tracker exists.

### 6.3 Post-tournament summary view

- [x] `app/api/admin/tournaments/[tournamentId]/summary/route.ts` - return tournament summary data.
- [x] Summary data: registration totals by division/status, waitlist counts, payment/deposit status, final standings snapshot, key dates, and public result links.
- [x] `app/[orgSlug]/admin/tournaments/summary/page.tsx` - create a print-friendly Plus summary page.
- [x] Include share/copy public results link and print action.
- [x] Add "Summary" to tournament admin nav only when relevant: completed, sealed, or archived.
- [x] Track summary views, prints, and share clicks.
- [x] Export/report compatibility: if the summary adds downloadable output, use the shared export/PDF direction in `MERGED_EXPORTS_IMPLEMENTATION_PLAN.md` instead of creating another one-off CSV/PDF pattern. Current summary is print/share-only, so no downloadable output was added.
- [x] Catalog/export decision: document the summary page in `lib/export/catalog.ts` if it becomes an export surface, or mark an intentional omission if it remains a print/share-only recap. The current MVP is print/share-only, so no export catalog entry is added.

### 6.4 Sponsor and association reporting enhancement

- [x] Add a later-phase task for sponsor blocks or report notes if organizers need a polished packet for sponsors/associations. Deferred until customer demand exists.
- [x] Keep this separate from the first summary build unless a customer specifically needs it.

### 6.5 Renewal and next-tournament loop

- [x] Add a Plus-only "Start next year's tournament from this one" prompt from completed tournament summary/archive contexts.
- [x] Add a retention panel on the summary view with practical next steps: clone draft, review registration questions, export/share recap, and keep the branded archive/report available.
- [x] Consider annual-plan or renewal reminder copy only after billing/product governance is ready; do not add discounting or campaign behavior directly in tournament UI without Platform Admin campaign support.
- [x] Evaluate whether branded public recap/archive pages create enough ongoing Plus value to justify keeping Plus active after the event. Deferred to post-launch metrics from summary views, share actions, clone actions, and renewal CTA clicks.
- [x] Track retention actions separately from acquisition CTAs: summary viewed, recap/shared, clone-next-year started/completed, renewal CTA viewed/clicked. Summary view/print/share, clone attempts/completions, results notifications, and summary renewal CTA clicks are tracked; richer billing renewal campaign tracking remains tied to future product-governance work.

---

## Phase 7 - Rollout, QA, and Documentation

*Purpose: ship the new package without confusing existing customers.*

### 7.1 Rollout order

- [x] Ship Phase 0 analytics and package taxonomy first.
- [x] Ship Phase 1 boundary/gating and copy before marketing the new value proposition.
- [x] Ship Phase 2 acquisition surfaces after public pages have the correct free/Plus distinction.
- [x] Ship Phase 3 registration control before external Plus marketing.
- [x] Ship Phase 5 clone and targeted announcements after registration workflows are stable.
- [x] Ship Phase 6 post-event loop after summary/results behavior is reliable.
- [x] Keep Phase 4 online payments as a separate decision unless manual deposit tracking polish is enough for launch.

### 7.2 Verification checklist

- [x] Free public tournament ignores stored branding and displays platform defaults.
- [x] Plus public tournament displays stored branding.
- [x] Free branding API writes for Plus-only visual fields return 403.
- [x] Pricing and billing pages use the same free vs. Plus promise.
- [x] Main marketing site, signup plan selection, onboarding, admin upgrade pages, locked feature prompts, emails, help docs, and Platform Admin support surfaces have no stale Plus positioning.
- [x] Free locked features show upgrade states and do not perform the Plus action.
- [x] Plus custom fields appear on public registration and in admin details/export.
- [x] CSV export includes custom fields and payment/waitlist data.
- [x] Bulk actions update selected registrations only.
- [x] Waitlist registration and promotion preserve queue order.
- [x] Targeted announcements never fall back to all recipients when filters are unauthorized.
- [x] Public CTAs track source metadata.
- [x] Post-event email sends once and uses compliant copy.
- [x] Final browser smoke pass for Phase 3 registration control before external Plus marketing.

### 7.3 Documentation and task tracking

- [x] Update `TODO.md` phase items as each phase is completed.
- [x] Update relevant help content after each user-facing phase.
- [x] Update `memory/` with major product decisions after implementation begins.
- [x] Keep browser-based verification with the user unless explicitly asked to run it.

---

## Migration Plan

| Migration | File | Purpose | Status |
|---|---|---|---|
| 056 | `056_tournament_registration_fields.sql` | Custom tournament registration fields and answers | Applied dev and production |
| 057 | `057_early_access_conversion_tracking.sql` | Early-access conversion fields and growth role | Applied dev and production |
| 058 | `058_product_catalog_foundation.sql` | Product catalog foundation | Applied dev and production |
| 059 | `059_product_catalog_governance.sql` | Product catalog governance | Applied dev and production |
| 060 | `060_catalog_approval_enforcement.sql` | Product catalog approval enforcement | Created |
| 061 | `061_tournament_notification_settings.sql` | Phase 6 post-event notification/idempotency fields | Applied dev and production |
| TBD | TBD only if needed | Free complexity ceiling or online tournament payment workflow schema | Optional |

Existing migration numbers already used:

- `050_free_tournament_billing_invariant.sql`
- `051_plan_pricing_change_notes.sql`
- `052_tournament_created_at_metric.sql`
- `053_platform_events.sql`
- `054_platform_metric_snapshots_visits_notes.sql`
- `055_platform_admin_roles.sql`
- `056_tournament_registration_fields.sql`
- `057_early_access_conversion_tracking.sql`
- `058_product_catalog_foundation.sql`
- `059_product_catalog_governance.sql`
- `060_catalog_approval_enforcement.sql`

---

## Recommended Build Order

| Step | Phase | Why |
|---|---|---|
| 1 | Phase 0 | Defines gates, packaging, and analytics before UI work spreads |
| 2 | Phase 1 | Makes the free vs. Plus distinction real and enforceable |
| 3 | Phase 2 | Starts coach acquisition once public surfaces are accurate |
| 4 | Phase 3.1-3.4 | Adds custom fields and export, the highest-value Plus registration tools |
| 5 | Phase 3.5-3.7 | Adds bulk actions, waitlist completion, and optional free complexity ceiling |
| 6 | Phase 5.1-5.2 | Adds clone and targeted announcements after registration data is stable |
| 7 | Phase 6 | Adds post-event summary and acquisition loop |
| 8 | Phase 7 | Completes rollout documentation, help content, and launch-readiness audit |
| 9 | Phase 4 online payments | Build after payment architecture is decided |
