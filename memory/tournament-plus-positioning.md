# Tournament Plus Subscription Positioning

## Current decision

Tournament Plus is being repositioned from "more slots and branding" to the serious tournament operations tier.

Free Tournament remains the starter tier:
- 1 non-archived tournament.
- 3 staff/admin seats.
- Standard team registration fields.
- Basic selected-row registration updates and overflow waitlist collection.
- FieldLogicHQ default public styling.
- Basic scheduling, scores, standings, public results, news, and team/contact email.

Tournament Plus is the paid operations tier:
- Unlimited tournament slots via `tournamentLimit: 9999`.
- 10 staff/admin seats.
- Registration control: custom questions, file collection, Excel/PDF exports, payment reminders, waitlist promotion, and queue management.
- Payment readiness: Plus-gated payment dashboard, payment filters, and selected-team reminders for manual fee/deposit collection.
- Full tournament branding.
- Automation, playoffs, sealed archives, cloning, targeted announcements, and post-event summaries.

## Phase 0 implementation notes

- `lib/plan-config.ts` now sets Tournament Plus to unlimited tournament slots and 10 seats.
- `lib/plan-features.ts` now has explicit Plus feature keys for the planned registration, productivity, and reporting bundle.
- `lib/tournament-plus-analytics.ts` defines event names, locked-feature IDs, acquisition sources, and marketing surfaces for future tracking.
- Public pricing, signup/onboarding plan selection, admin billing, mock billing, platform-admin plan support copy, tournament marketing, and help content were updated to use the starter-vs-operations framing.

## Phase 1 implementation notes

- Free public tournament pages now force FieldLogicHQ default visual styling and ignore saved tournament logo, theme preset, custom colors, card style, light mode, and hero/banner values.
- Plus and higher plans keep the existing custom tournament branding behavior.
- Tournament branding writes are Plus-gated in admin APIs; free orgs can still save public page visibility settings.
- The admin tournament branding page gates visual controls behind `UpgradeGate`, while public page visibility remains editable on the free plan.
- Downgrade messaging now calls out that Plus-only branding and operations features become inactive on the free plan while saved branding remains stored.

## Phase 2 implementation notes

- Free public tournament pages now render a subtle `PoweredByBadge` with a "Run your own tournament" link.
- Public tournament visitors who are unauthenticated or outside the owner org can see a dismissible acquisition banner; the banner is hidden on registration and score-entry style flows.
- Successful public team registration now shows a secondary "Run a tournament like this" CTA.
- `app/api/public/tournament-plus-event/route.ts` records public acquisition CTA impressions and clicks into `platform_events` using the Phase 0 event vocabulary.
- Coaches in an org with tournament entitlement and no non-archived tournaments see a one-time coach portal banner pointing to tournament setup.
- Public "clone this format" remains a post-MVP concept; it must not expose private registration or team contact data.
- Repeated promotional coach acquisition email should not ship until unsubscribe/consent handling exists.

## Phase 3 implementation notes

- Custom registration questions now use `tournament_registration_fields` and `tournament_registration_field_answers` in migration `056_tournament_registration_fields.sql`; migration numbers `054` and `055` were already used by platform-admin work.
- Migration `056_tournament_registration_fields.sql` has been applied in dev and production.
- Tournament Plus and higher can manage Registration Questions under Tournament Settings. Free Tournament users see an upgrade state instead of editable controls.
- Public team registration renders Plus-only custom questions and validates required answers on both the client and `/api/register`.
- File answers upload through the public registration route into the private `tournament-registration-files` bucket path; stored answer rows keep the storage path in `file_url`, not a public link.
- Admin registration detail rows include submitted custom answers. The server-side registration CSV export is Plus-gated and includes standard registration, payment/waitlist fields, and one column per custom question.
- Basic multi-row registration updates are available on all tournament plans. The Registrations page has row selection and a stable bulk action bar for accept, reject, waitlist, mark deposit paid, and mark paid.
- Waitlist collection is available on all tournament plans. Waitlist promotion/queue management remains Plus-gated.
- Basic bulk registration actions and waitlist joins write `tournament_registration_operation_used` events. Plus waitlist promotions continue to write `tournament_plus_feature_used` events with `feature: waitlist_automation`.
- The separate "email selected" workflow remains deferred; it should likely share targeting and safety behavior with the planned targeted announcements work.

## Phase 4 implementation notes

- `payment_readiness_tools` is a Tournament Plus feature key for manual fee/deposit operations before online payment collection exists.
- The tournament Registrations page now shows a Plus-gated payment summary for the selected division: expected fees, collected amount, outstanding amount, deposit completion, and past-due count.
- Plus organizers can filter non-slot registration lists by unpaid, deposit paid, paid in full, and past due. Slot-board divisions keep the roster board stable while showing payment badges on accepted teams.
- Selected-team payment reminders are sent through a scoped Plus-gated route at `/api/admin/tournaments/[tournamentId]/registrations/payment-reminders`. Reminders include amount due, due date, tournament contact, and organizer-entered payment instructions.
- Payment reminder attempts, blocked sends, and completions write `tournament_plus_feature_used` events with `feature: payment_readiness_tools`.
- The existing Phase 3 registration CSV route now includes computed payment readiness status, amount due, and payment due date. Future export upgrades should still migrate this into the merged xlsx-first export plan instead of expanding the one-off CSV pattern.
- Online tournament entry fee/deposit collection remains unbuilt. It needs a dedicated research and implementation plan before choosing Stripe Connect, manual payment links, or another payment architecture.

## Phase 5 implementation notes

- Tournament cloning is now a Plus-gated productivity workflow from Settings & Access.
- `cloneTournament(sourceTournamentId, orgId, options)` creates a new draft tournament and copies selected setup data in dependency order.
- Safe clone data includes tournament dates/contact/scoring policy, optional fee schedule, optional branding/public page visibility, contacts, venues, divisions, pools, empty slot placeholders, active custom registration questions, rules, resources, and the pinned "Welcome!" announcement.
- Cloning intentionally does not copy teams, waitlists, custom registration answers, file uploads, games, scores, payments, or private admin notes.
- Cloned divisions reset to open and schedule-unpublished so a prior completed event does not accidentally publish stale schedule state.
- Clone attempts, blocked attempts, and completed clones write `tournament_plus_feature_used` events with `feature: tournament_cloning`.
- Targeted/selected communication is now a Plus-gated workflow in the Communication Hub. Free Tournament can send only basic all-team email, while Plus can target by team status, payment status, division, selected teams, team/contact audience, and contact role.
- Public News division visibility is also Plus-gated. Free Tournament posts remain all-division public News posts.
- Targeted email attempts, blocked attempts, and completions write `tournament_plus_feature_used` events with `feature: targeted_tournament_announcements`.
- Phase 5 staff workflow closed without new schema: the current role/capability model is enough for now. Plus's 10-seat allowance is positioned for a lead organizer, registrar, scheduler, communications lead, scorer manager, and payment/accounting contact, using Admin sparingly, Staff for operators, tournament assignments, and owner-only capability overrides.
- Reusable tournament setup templates are deferred as a post-clone enhancement. Cloning remains the supported repeat-event setup workflow.
- Settings & Access is grouped by user intent with tabs: Tournament setup, People & access, then Account. The standalone Plus productivity explanation was removed from the settings page so the page reads as a navigation surface, not mixed marketing/help copy.
- Tournament/Tournament Plus users should not be sent from tournament admin into org admin billing for Plus gates. Tournament feature upgrade CTAs route to `/admin/tournaments/settings/subscription`, and Plus-only settings cards should be locked or hidden for free orgs instead of behaving like normal navigation.
- General announcement templates are not implemented yet.

## Phase 6 planning notes

- Phase 6 should include post-event retention and renewal moments directly, not as a detached TODO item.
- Retention moments to investigate/build around: completion, results finalization, summary view, archive/seal, clone-next-year, and next-year planning.
- Free Tournament keeps basic public results. Tournament Plus should provide the polished summary/report, branded archive/recap value, clone-next-year prompts, and renewal planning nudges.
- Any Phase 6 downloadable summary/report must follow `MERGED_EXPORTS_IMPLEMENTATION_PLAN.md` and use the shared export/PDF direction rather than introducing another one-off export pattern.
- Migration `060` is already used by product catalog approval enforcement. If Phase 6 needs notification/idempotency schema, the next migration should be `061_tournament_notification_settings.sql`; avoid adding it if the MVP can be generated from existing data.

## Phase 6 implementation notes

- The first Phase 6 slice ships without a migration: a Plus-gated manual post-event summary API and page generated from existing tournament, registration, payment, schedule, results, and archive data.
- The Summary nav item appears only for completed or archived tournaments in desktop and mobile tournament admin.
- The summary page supports print, copying the public standings link, viewing public standings, and starting a next-tournament draft through the existing Plus-gated clone API.
- Summary views, print actions, share actions, clone actions, and summary renewal CTA clicks write `tournament_plus_feature_used` events. Richer billing renewal campaigns remain future work tied to billing/product governance.
- The summary remains print/share-only for now, so no export catalog entry was added. Any future downloadable PDF/xlsx report should use `MERGED_EXPORTS_IMPLEMENTATION_PLAN.md`.
- Migration `061_tournament_notification_settings.sql` adds `notify_teams_on_complete`, `results_notified_at`, and `results_notification_sent_count` for the Phase 6 automatic results notification; it has been applied in dev and production.
- Event Settings now has a Plus-gated post-event results notification toggle. When enabled, accepted team emails receive public standings/schedule/team links once when the tournament transitions to completed.
- Result notification attempts/skips/blocks/completions are tracked as `tournament_plus_feature_used` events with `feature: post_tournament_summary` and `action: send_post_event_results_notification`.
- Summary renewal CTA clicks are tracked through the summary API with `action: click_post_event_renewal_cta`.
- User testing for the Phase 6 post-event summary and automatic results notification is complete.

## Phase 7 rollout notes

- Tournament Plus rollout code audit is complete for free-vs-Plus branding behavior, locked-feature gates, registration custom fields/details/export, payment/waitlist export data, selected-row bulk action availability, waitlist queue preservation, public CTA source tracking, targeted communication safety, and post-event notification idempotency.
- Tournament help content now covers Registration Questions, bulk registration actions, waitlist queue behavior, targeted communication, tournament-local subscription prompts, post-event results notification, and post-event summaries.
- Online tournament payment collection remains separate from launch; manual payment readiness is the current Phase 4 value.
- The final browser smoke pass for Phase 3 registration control and communication workflows is complete.
- Tournament Plus launch scope is complete. Remaining ideas such as online payment collection, sponsor/association report packets, free complexity ceilings, reusable templates, and dedicated tournament role presets are separate future projects, not blockers for this launch scope.

## Rollout note

Before launch, check Platform Admin plan config overrides for `tournament_plus`. DB overrides can supersede `PLAN_CONFIG` defaults, so any old 3-slot or 5-seat override must be cleared or updated.

The free team/division complexity ceiling is deferred. The first launch should rely on feature gates and analytics before adding a size cap.
