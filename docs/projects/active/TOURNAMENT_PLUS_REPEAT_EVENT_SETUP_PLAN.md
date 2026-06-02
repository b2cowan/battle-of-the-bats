# Tournament Plus Repeat-Event Setup V2 Plan

## Purpose

Make "never start from scratch again" the clearest Tournament Plus value proposition.

Tournament cloning already exists as a Plus-gated productivity workflow. This project improves it into a repeat-event setup experience: easier to discover, clearer about what will copy, safer about what will not copy, and connected to the post-event "start next tournament" moment.

## Product Manager UX Summary

After this work, a Tournament Plus organizer who runs annual or recurring tournaments can start the next event from a prior event with confidence. They choose a source tournament, name and date the new event, review grouped copy options, see a plain-language summary of what will be reused, and land in a draft tournament that already has divisions, venues, rules, public settings, registration questions, and fee setup ready for review.

Free Tournament remains a complete one-event manual product. Tournament Plus becomes the plan that remembers the organizer's work and reduces next-season setup time.

## Source Context

Existing implementation:

- `lib/db.ts` has `cloneTournament(sourceTournamentId, orgId, options)`.
- `app/api/admin/tournaments/[tournamentId]/clone/route.ts` validates, gates, clones, and tracks clone attempts/completions.
- `components/admin/TournamentSetupWizard.tsx` supports a clone pre-step.
- `app/[orgSlug]/admin/tournaments/summary/page.tsx` supports "Start next tournament" from a completed/post-event context.
- `memory/tournament-plus-positioning.md` records cloning as a Plus-gated productivity workflow.

Existing safe clone behavior:

- Copies setup data into a new draft tournament.
- Copies selected setup areas such as divisions, pools, empty slots, venues, branding/public-page settings, welcome content, rules/resources, custom registration fields, and fee schedule.
- Does not copy teams, registrations, scores, games, payment records, file uploads, waitlists, or private notes.
- Resets cloned divisions open and schedule-unpublished.

## Goals

- Make repeat-event setup a flagship Tournament Plus moment.
- Reduce the setup time for a returning organizer creating next year's event.
- Make clone copy behavior explicit before confirmation.
- Give organizers useful next steps immediately after the clone completes.
- Keep clone behavior safe by default: no teams, scores, payments, uploaded files, or stale schedules.
- Improve analytics around clone start, option selection, successful clone, and next-step follow-through.
- Preserve the existing Plus gate and tournament-local upgrade path.

## Non-Goals

- No public "clone this tournament format" acquisition feature in this project.
- No reusable template library in this first V2 pass.
- No copying teams, registrations, scores, games, payments, waitlist queues, uploaded files, or private admin notes.
- No online tournament payment collection.
- No broad rewrite of the tournament setup wizard outside repeat-event setup.
- No new billing/pricing behavior.

## Product Decisions

### Positioning

Use this internal product framing:

- Free Tournament: run one event cleanly.
- Tournament Plus: run every repeat event faster.

External copy should avoid generic "clone" language where a clearer outcome fits. Prefer phrases like:

- "Start next tournament from this one"
- "Reuse last year's setup"
- "Bring forward setup, not teams or scores"
- "Review the copied setup before publishing"

### Default Copy Profile

The default Plus clone profile should copy setup work that is tedious to rebuild:

- Tournament basics where safe: contact email, scoring/finalization policy, fee setup when selected.
- Divisions, pools, and empty slot structure.
- Venues and facilities.
- Public page visibility and Tournament Plus branding.
- Registration questions and active custom fields.
- Rules and resources.
- Pinned welcome/news starter content only if still appropriate.

The default profile should not copy operational records:

- Teams and registrations.
- Waitlist queues.
- Games and scores.
- Payment statuses and reminders.
- File uploads and custom registration answers.
- Archived/sealed summary snapshots.
- Private notes.

### Entry Points

Repeat-event setup should appear where the organizer is already thinking about the next event:

- Completed tournament Summary page.
- Tournament list / all tournaments page.
- Setup wizard create flow.
- Optional dashboard nudge for completed tournaments.
- Locked/educational prompt for Free Tournament users, routed to tournament subscription settings.

### Clone Result

After a successful clone, the user should not be dropped into an ambiguous new draft. They should see a completion state or landing panel that confirms:

- New tournament name and date.
- Source tournament used.
- Counts copied by area.
- What was intentionally left behind.
- Immediate next steps: review Event Settings, review Divisions, review Registration Questions, review Venues, then activate/publish.

## Plan-Tier Behavior

| User state | Target behavior |
| --- | --- |
| Free Tournament | Can see repeat-event value copy, but clone action is locked and routes to tournament subscription settings. |
| Tournament Plus | Can clone from eligible source tournaments and use the repeat-event setup workflow. |
| League / Club | Inherits Tournament Plus tournament cloning behavior. |
| Completed/archived source | Can clone setup, but stale operational data is never copied. |
| Draft/active source | Can clone setup, with warning that live operational records will not copy. |

## Implementation Phases

### Phase 0 - Baseline Audit And Decisions

Tasks:

- [x] Create this implementation plan.
- [x] Create the PM brief.
- [x] Audit the current clone UI in `TournamentSetupWizard`.
- [x] Audit the Summary page "Start next tournament" flow.
- [x] Confirm exact clone options currently exposed in UI versus API defaults.
- [ ] Confirm whether clone provenance needs schema or whether existing analytics and copied counts are enough.
- [x] Decide whether pinned welcome/news content should remain copied by default for the first summary-page slice.

Acceptance criteria:

- Current clone behavior is documented before implementation.
- The V2 scope is confirmed as workflow/UI/analytics first, with schema only if needed.

### Phase 1 - Repeat-Event Entry Points

Likely files:

- `components/admin/TournamentSetupWizard.tsx`
- `app/[orgSlug]/admin/tournaments/summary/page.tsx`
- `app/[orgSlug]/admin/org/tournaments/page.tsx`
- `app/[orgSlug]/admin/tournaments/dashboard/page.tsx`
- `components/admin/AdminSidebar.tsx`

Tasks:

- [x] Rename/position clone CTAs around repeat-event language on the Summary page.
- [x] Add a completed-event prompt: "Start next tournament from this one."
- [x] Add a draft dashboard prompt/modal for reusing a previous tournament setup.
- [x] Add a tournament-list action for eligible prior tournaments.
- [x] Ensure Free Tournament sees a concise locked prompt, not a disabled mystery button.
- [x] Route Summary-page locked prompts to `/admin/tournaments/settings/subscription`, not org billing.
- [x] Track reuse setup attempt/completion metadata by source: summary, tournament list, dashboard, and setup wizard.

Acceptance criteria:

- A returning Plus organizer can discover repeat-event setup from the places they naturally revisit.
- Free users understand the value without being blocked by a confusing dead control.

### Phase 2 - Repeat-Event Setup Wizard

Likely files:

- `components/admin/TournamentSetupWizard.tsx`
- `components/admin/TournamentSetupWizard.module.css`
- Possible new `components/admin/tournament/RepeatEventSetupPanel.tsx`

Tasks:

- [x] Add a source tournament chooser optimized for prior completed/recent events in the setup wizard.
- [x] Preserve a "start blank" path.
- [x] Add grouped copy options:
  - Event structure: divisions, pools, empty slots.
  - Locations: venues/facilities.
  - Registration: custom questions, fee schedule.
  - Public presence: branding and page visibility.
  - Content: rules/resources and welcome item.
- [x] Show plain-language explanations for the default setup reuse profile.
- [x] Show a "Never copied" section for teams, registrations, scores, games, payments, and files.
- [x] Add validation for name, slug, year, and date range.
- [ ] Keep mobile layout compact and readable.

Acceptance criteria:

- The organizer can tell exactly what will copy before clicking Create.
- Long tournament names and long option labels do not overflow on mobile.
- The wizard supports both clone and blank-start flows without adding confusing extra steps.

### Phase 3 - API And Clone Result Hardening

Likely files:

- `app/api/admin/tournaments/[tournamentId]/clone/route.ts`
- `lib/db.ts`
- `lib/tournament-plus-analytics.ts`
- Optional migration only if provenance is needed.

Tasks:

- [x] Ensure UI-selected clone options are passed through to the API.
- [ ] Return a richer clone result summary if current copied counts are insufficient.
- [ ] Validate option dependencies server-side, e.g. slots require pools/divisions.
- [ ] Confirm cleanup behavior when clone partially fails.
- [ ] Confirm cloned `settings` JSONB includes safe inherited defaults for timing, fees, tie-breakers, and public layout controls where appropriate.
- [ ] Decide whether to add optional provenance fields such as `cloned_from_tournament_id` and `clone_metadata`.
- [x] Expand analytics metadata with copy option selections, source surface, source status/year, target year, and warning signals.

Acceptance criteria:

- Server behavior matches UI copy.
- Bad option combinations cannot create inconsistent cloned data.
- Clone failures do not leave partial draft tournaments behind.
- Analytics can answer which entry points and copy profiles produce completed clones.

### Phase 4 - Post-Clone Landing And Checklist

Likely files:

- `components/admin/TournamentSetupWizard.tsx`
- `app/[orgSlug]/admin/tournaments/page.tsx`
- `app/[orgSlug]/admin/tournaments/dashboard/page.tsx`
- Existing setup checklist/dashboard components.

Tasks:

- [x] After Summary-page clone completion, show source, target, copied counts, and excluded areas.
- [x] Provide Summary-page next-step links: Event Settings, Divisions, Venues, and Dashboard.
- [x] After setup-wizard clone completion, show source-aware draft confirmation and review checklist on Manage Tournaments.
- [x] Add a draft dashboard reuse callout and post-reuse reminder to review copied setup before activation.
- [x] Highlight stale-source conditions when the source is old, draft/active, or selected copy groups need review.
- [ ] Keep activation guarded by existing launch checklist requirements.

Acceptance criteria:

- The cloned tournament has an obvious next step.
- The organizer is reminded to review copied settings before publishing.
- The flow reduces setup anxiety rather than creating a hidden duplicate event.

### Phase 5 - Help, Copy, And Marketing Alignment

Likely files:

- Tournament help content under `lib/help-content/`
- Pricing and billing copy only if needed.
- `memory/tournament-plus-positioning.md`

Tasks:

- [x] Add help content explaining repeat-event setup.
- [x] Update Tournament Plus help copy to emphasize "reuse setup year after year."
- [x] Ensure billing/pricing language reflects repeat-event value without over-explaining locked features.
- [x] Document safe-copy boundaries in help so customers trust the workflow.

Acceptance criteria:

- Help docs answer "what copies?" and "what does not copy?"
- Tournament Plus positioning consistently reinforces annual/repeat-event value.

### Phase 6 - Verification And Handoff

Tasks:

- [x] Run focused lint for touched Summary page files.
- [x] Run focused lint for touched help content file.
- [x] Confirm no dev server restart is needed for content/docs-only help changes.
- [x] Prepare browser UAT scenarios for the user.
- [x] Update TODO and memory with implementation results.

Acceptance criteria:

- Focused non-browser checks are run and unrelated failures are documented.
- Browser UAT scenarios are ready and specific.
- The active plan is updated with final verification notes before archive.

## 2026-05-29 First Slice Implementation Notes

Implemented the Summary-page repeat-event setup slice:

- Replaced browser prompts with a dedicated "Reuse this tournament setup" modal.
- Defaults the next draft name, year, and public link from the completed tournament.
- Shows plain-language "Carried forward" and "Never copied" sections before confirmation.
- Sends the existing safe default clone options to the Plus-gated clone API.
- After success, shows a draft-created screen with source tournament, copied counts, safe exclusions, and next-step links.
- Replaced Summary-page `btn-primary` usage with the lime confirm style.

Verification:

- `npm.cmd run lint -- "app/[orgSlug]/admin/tournaments/summary/page.tsx"` passed.
- `npx.cmd tsc --noEmit --pretty false` still fails on a pre-existing issue in `app/[orgSlug]/admin/tournaments/settings/event/page.tsx(270,26)`, outside this slice.

## 2026-05-29 Setup Wizard Slice Notes

Implemented the New Tournament setup wizard repeat-event slice:

- Renamed the wizard clone entry point to "Reuse a previous tournament setup."
- Sorts source choices toward completed/recent tournaments and preserves the blank-start path.
- Replaced "Create clone" language with "Create tournament draft."
- Added carried-forward and never-copied panels before draft creation.
- Passes clone source/copy counts back to the Manage Tournaments post-create confirmation.
- Manage Tournaments now shows a reused-setup checklist for cloned drafts and uses the lime confirm style in that completion modal.

Verification:

- `npm.cmd run lint -- "components/admin/TournamentSetupWizard.tsx" "app/[orgSlug]/admin/org/tournaments/page.tsx"` exited 0. Remaining warnings are pre-existing unused/any/set-state-in-effect warnings in those files.
- `npx.cmd tsc --noEmit --pretty false` still fails only on the pre-existing `app/[orgSlug]/admin/tournaments/settings/event/page.tsx(270,26)` issue.

## 2026-05-29 Help Copy Alignment Notes

Added a focused "Reuse setup for repeat tournaments" topic to tournament help. The help guide now explains where organizers can start repeat-event setup, what grouped setup areas can copy, what is never copied, why the result stays private as a draft, and what to review before activation.

Cross-links and related copy were aligned in setup, registration, and closeout help:

- Create/edit/launch now mentions Tournament Plus repeat-event drafts.
- Registration help now explains that custom questions and fee setup can copy, but submitted answers, teams, payments, and files never copy.
- Closeout help links to Summary and frames the Summary page as the repeat-event setup handoff.

Live pricing and billing copy already reflects the repeat-event value story with simple language about sustainable repeat events and avoiding spreadsheet/manual rebuild work, so this slice did not change those pages.

Verification:

- `npm.cmd run lint -- "lib/help-content/tournaments.tsx"` passed.
- `npx.cmd tsc --noEmit --pretty false` still fails on existing unrelated issues in `app/[orgSlug]/admin/tournaments/settings/event/page.tsx(269,26)` and `app/platform-admin/customer-users/CustomerUsersClient.tsx(191,93)`.
- No dev server restart needed for this content/docs-only help alignment slice.

## Browser UAT Scenarios

Per project workflow, the user owns browser verification unless explicitly requested otherwise.

Recommended scenarios:

- Free Tournament user sees locked repeat-event setup prompt and subscription route.
- Tournament Plus user starts from a completed tournament summary.
- Tournament Plus user starts from the tournament list.
- Tournament Plus user starts blank from the setup wizard.
- Source tournament with divisions, pools, slots, venues, rules, registration questions, branding, and fee setup.
- Source tournament with teams, registrations, scores, payments, and uploaded files; confirm those are not copied.
- Clone with all default options.
- Clone with only divisions/venues.
- Clone with registration questions disabled.
- Duplicate slug conflict.
- End date before start date validation.
- Mobile wizard layout at 390x844.
- Post-clone landing shows copied counts and next steps.

## Success Metrics

- Increased use of Tournament Plus cloning from summary/list/setup entry points.
- Higher percentage of completed tournaments followed by a cloned draft within 30/60/90 days.
- Lower time from new draft creation to activation for cloned tournaments versus blank tournaments.
- Fewer support questions about what cloning copies.
- More Plus renewals from organizations with at least one repeat-event clone.

## Deferred Follow-Up Ideas

These are intentionally logged but not included in this implementation:

- Registration Command Center: a unified operations view for accepted, waitlisted, unpaid, missing info/files, and follow-up needs.
- Schedule Generator Quality Report: explain conflicts avoided, venue usage, rest balance, and unscheduled warnings.
- Game-Day Command Center: scorekeeper links, unresolved games, publish state, recent changes, and quick notices.
- Post-Event Wrap V2: stronger recap/archive/renewal loop, sponsor/association packet ideas, and richer public recap decisions.
