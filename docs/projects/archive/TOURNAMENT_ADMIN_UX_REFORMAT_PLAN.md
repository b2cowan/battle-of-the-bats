# Tournament Admin UX Reformat Plan

## Purpose

Tournament admin pages have accumulated too many headers, panels, upsells, filters, and action rows above the actual work. This plan brings the tournament admin area back to a records-first operating experience, with mobile considered from the start.

The goal is not to remove functionality. The goal is to move secondary functionality into compact, consistent controls so admins can see and act on registrations, games, scores, messages, and settings without scrolling past a wall of UI.

## Product Manager UX Summary

Admins will see the primary work area much sooner. On list-heavy pages, the first registration, game, score, or record should appear directly after one compact header and toolbar. Secondary tools such as exports, bulk actions, randomization, payment reminders, generation tools, and upgrade prompts will move into menus, drawers, popovers, or selection-only action bars.

On mobile, the experience will prioritize the most common actions: choose a division, search/filter, inspect a record, and take action. Bulk actions and advanced tools will appear only when relevant instead of permanently occupying the top of the screen. Plan-gated features will remain discoverable, but they will not block the core workflow with large upsell panels.

Role and plan behavior should remain unchanged. Owners and authorized tournament staff keep the same access they have today; the visible layout becomes cleaner and more consistent.

## Design Principles

- Records first: list/table/card content should appear before secondary education or promotion.
- One compact toolbar per page: primary filters and actions share one responsive surface.
- Progressive disclosure: advanced tools belong in menus, drawers, modals, or popovers.
- Selection actions are contextual: bulk controls appear only after items are selected.
- Mobile parity: mobile should get purpose-built compressed controls, not stacked desktop rows.
- Gentle plan gates: locked features should show as disabled menu items, small badges, or compact prompts.
- Shared implementation: use common components and CSS so pages stay visually and behaviorally aligned.
- Keep page-specific logic local: shared primitives should handle layout, not business rules.

## Routes Reviewed

- Registrations: `app/[orgSlug]/admin/tournaments/teams/page.tsx`
- Schedule: `app/[orgSlug]/admin/tournaments/schedule/page.tsx`
- Results: `app/[orgSlug]/admin/tournaments/results/page.tsx`
- Communication: `app/[orgSlug]/admin/tournaments/communication/page.tsx`
- Branding: `app/[orgSlug]/admin/tournaments/branding/page.tsx`
- Registration Questions: `app/[orgSlug]/admin/tournaments/settings/registration-fields/page.tsx`
- Dashboard: `app/[orgSlug]/admin/tournaments/dashboard/page.tsx`
- Tournament Years / Manage: `app/[orgSlug]/admin/org/tournaments/page.tsx` and re-exported tournament manage route
- Supporting pages: divisions, contacts, announcements, archives, venues, and rules

## Shared Foundation

### Phase 0 - Shared UX Primitives

Build a small reusable tournament-admin UI layer before changing pages. This phase should not redesign page behavior by itself.

Status: Completed. Shared primitives now live in `components/admin/tournament/`.

Tasks:

- [x] Decide whether shared pieces live in `components/admin/` or a more focused `components/admin/tournament/` folder.
- [x] Add a compact admin toolbar pattern with responsive wrapping rules.
- [x] Add reusable toolbar controls for selects, segmented controls, search, icon buttons, overflow menus, and compact status chips.
- [x] Add a contextual selection action bar that can render inline on desktop and as a sticky bottom bar on mobile.
- [x] Add a compact locked-feature presentation for plan-gated tools.
- [x] Add a legend/popover pattern for explanatory status text.
- [x] Extend or replace duplicated page-header CSS with a shared page header pattern where useful.

Candidate primitives:

- `TournamentAdminHeader`
- `TournamentAdminToolbar`
- `ToolbarGroup`
- `ToolbarSearch`
- `ToolbarSegmentedControl`
- `ToolbarSelect`
- `ToolbarMenu`
- `SelectionActionBar`
- `CompactUpsell`
- `StatusLegendPopover`

Acceptance criteria:

- Shared controls work at 390px, 768px, and desktop widths without horizontal overflow.
- Shared controls do not force pages into card-inside-card layouts.
- Existing page business logic can adopt the primitives incrementally.
- No page loses functionality during adoption.

## Page Phases

### Phase 1 - Registrations

Target: `app/[orgSlug]/admin/tournaments/teams/page.tsx`

Status: First implementation complete. Phase 2B smoke/mobile verification passed for desktop and 390x844; richer data-state verification remains.

Problem:

Registrations currently stacks page header, action buttons, summary/randomize controls, division/view/search controls, payment readiness, bulk actions, and status filters before the first registrant. This is the highest-priority page because the core record list can be pushed entirely below the fold.

Plan:

- [x] Replace the separate controls bar, payment panel, bulk panel, and status/search row with one compact toolbar plus contextual surfaces.
- [x] Keep primary desktop controls visible: division, view mode when relevant, search, status filters, Add Team.
- [x] Move Summary, Randomize, Swap Mode, payment readiness, and locked Plus tools into an overflow Tools menu where possible.
- [x] For Plus orgs, compress payment metrics into the Tools menu instead of a full-width panel.
- [x] For non-Plus orgs, remove the full Payment Readiness upsell panel from above the list. Show a locked payment item in Tools.
- [x] Show bulk actions only after selection. Use a contextual action bar, sticky at the bottom on mobile.
- [x] Replace ambiguous "Select current division" wording with "Select all visible" and hide it when no rows can be selected.
- [x] Preserve slot-board behavior, waitlist promotion, payment status display, row expansion, and add-team modal.
- [x] Route manual team creation through the admin teams API and reset the Add Team modal on open, cancel, close, and successful save.
- [x] Browser visual verification at desktop and mobile smoke widths; tablet/data-rich verification remains for Phase H.

Mobile requirements:

- First team or slot should be visible after the compact header and toolbar.
- Toolbar should reduce to title/actions, division selector, search/filter, and Tools menu.
- Bulk actions should open as a bottom action sheet or sticky bottom bar after selection.
- Row/card labels should not overflow or force horizontal scrolling.

Acceptance criteria:

- At 1366x768, the first registration row or slot is visible without scrolling.
- At 390x844, the first registration card/slot is visible without scrolling past more than one compact toolbar area.
- Bulk actions are not visible when zero registrations are selected.
- Locked Plus features remain discoverable without full-width upsell panels above the list.

### Phase 2 - Schedule

Target: `app/[orgSlug]/admin/tournaments/schedule/page.tsx`

Problem:

Schedule has separate header, view controls, division/publish controls, generator controls, count chip, and search row before games. It is not as severe as registrations but follows the same stacked pattern.

Plan:

- Adopt the shared toolbar.
- Keep primary controls visible: Round Robin/Playoffs, division, search, Add Game.
- Move Export, Auto-Generate, Playoff Wizard, Publish All, and division publish controls into toolbar actions or a Tools menu.
- Convert publish state into a compact status chip beside the division selector.
- Keep empty-state guidance inside the game list area, not as another top-level instructional band.

Mobile requirements:

- View mode and division must stay reachable without horizontal scrolling.
- Advanced generator/publish actions should live behind Tools.
- First game or empty list state should appear immediately after toolbar.

Acceptance criteria:

- First scheduled game is visible without scrolling on desktop when games exist.
- Mobile toolbar fits in two compact rows or less.
- Plan-gated generator tools do not expand the top of the page.

### Phase 3 - Results & Scoring

Target: `app/[orgSlug]/admin/tournaments/results/page.tsx`

Problem:

Results repeats the Schedule pattern with page header, controls bar, filters row, search, and explanatory legend before the game list.

Plan:

- [x] Adopt the shared toolbar.
- [x] Keep view mode, division, score-status filter, search, and Export in one compact toolbar.
- [x] Move the Pending Review explanation into a `StatusLegendPopover`.
- [x] Preserve scoring modal, finalization behavior, and existing GameList modes.
- [x] Browser/mobile smoke verification passed at desktop and 390x844; data-rich score-entry verification remains for Phase H.

Mobile requirements:

- The first scoreable game should appear immediately below toolbar.
- Status filters should collapse into a segmented dropdown or filter sheet if space is tight.

Acceptance criteria:

- No explanatory paragraph sits between filters and games by default.
- Status meanings remain available through a legend control.
- Desktop and mobile match the Schedule toolbar pattern.

### Phase 4 - Communication Hub

Target: `app/[orgSlug]/admin/tournaments/communication/page.tsx`

Problem:

The Communication page has improved recipient collapsing, but expanded recipient editing can become a large grid of filter cards before the composer.

Plan:

- Make Compose Message the persistent primary task.
- Convert recipient editing into a side drawer on desktop and bottom sheet or accordion on mobile.
- Keep recipient summary compact and always visible.
- Organize recipient controls into clear sections: Audience, Status, Divisions, Individual Teams, Contacts.
- Remove repeated helper copy from filter cards; use concise section labels and one help/tooltip if needed.
- Keep recipient preview compact with a "view all" drawer when the list is long.

Mobile requirements:

- Subject and message body should be reachable quickly.
- Recipient editing should not push the composer far below the fold.
- Send button should remain clear and not overlap mobile browser/bottom nav areas.

Acceptance criteria:

- Composer is visible after the compact recipient summary when recipient details are closed.
- Expanded recipient controls do not create a long stack of full-width cards unless the admin explicitly opens them.
- Locked targeting stays compact for non-Plus plans.

### Phase 5 - Public Site & Branding

Target: `app/[orgSlug]/admin/tournaments/branding/page.tsx`

Problem:

Branding has multiple large cards and repeated UpgradeGate regions. It is a settings page, so it can tolerate more vertical space than a list page, but it should still be easier to scan.

Plan:

- Introduce tabs or a segmented layout: Basics, Public Pages, Advanced.
- Keep public page visibility controls above advanced paid styling.
- Replace repeated full UpgradeGate blocks with a single compact locked-state banner plus disabled inline controls.
- Consider a sticky preview panel on desktop and collapsible preview on mobile.
- Keep the save footer sticky or consistently placed after the active tab content.

Mobile requirements:

- Tabs should be horizontally scrollable or collapse into a select.
- Image upload and preview controls should not create oversized panels.
- Save action should be easy to find after edits.

Acceptance criteria:

- Public Pages controls are reachable without scrolling through advanced branding upsells.
- Non-Plus users see a concise locked state, not repeated full cards.
- Preview remains useful without dominating the page.

### Phase 6 - Registration Questions

Target: `app/[orgSlug]/admin/tournaments/settings/registration-fields/page.tsx`

Problem:

The page shows "Add a Question" before existing questions. For an ongoing admin workflow, reviewing and editing active questions should come first.

Plan:

- Show Active Questions first.
- Move Add Question into a compact inline row, drawer, or modal.
- Keep locked non-Plus state concise.
- Reuse shared page header and compact settings section styles.

Mobile requirements:

- Existing questions should appear before a large create form.
- Editing a question should be comfortable in a stacked layout without nested cards.

Acceptance criteria:

- Existing questions are visible above the creation form.
- Adding a question remains one clear action.
- Locked state stays concise and does not look like the primary workflow.

### Phase 7 - Tournament Dashboard

Target: `app/[orgSlug]/admin/tournaments/dashboard/page.tsx`

Problem:

The draft dashboard contains a clone callout, launch checklist, optional nudges, and setup links. Several areas overlap in purpose and can lengthen the page before admins reach key status information.

Plan:

- Compress draft status into a small progress strip with blocker count and Activate action.
- Make checklist expandable after showing the top blockers.
- Merge optional setup nudges with setup quick links so each setup destination appears once.
- Keep live and completed dashboard analytics mostly intact, but apply shared compact panel spacing where needed.

Mobile requirements:

- Status, blockers, and primary next action should fit in the first screen.
- Checklist details should expand on demand.

Acceptance criteria:

- Draft dashboard shows current state and next action immediately.
- Optional items do not duplicate quick links.
- Existing activation guards and warnings remain unchanged.

### Phase 8 - Tournament Years / Manage

Targets:

- `app/[orgSlug]/admin/org/tournaments/page.tsx`
- `app/[orgSlug]/admin/tournaments/manage/page.tsx`

Problem:

The lifecycle strip is useful onboarding copy, but it permanently takes vertical space above the tournament table.

Plan:

- Collapse lifecycle education into a compact status legend or help popover.
- Keep slot usage visible as a small header chip.
- Keep limit-reached warnings visible only when actionable.
- Preserve create/edit tournament modal behavior, slot enforcement, sealing, previews, and status transitions.

Mobile requirements:

- Tournament table or cards should begin soon after header.
- Status legend should not consume a full block.

Acceptance criteria:

- Users can see the first tournament record sooner.
- Lifecycle information remains accessible.
- Limit and sealed-record states remain clear.

### Phase 9 - Supporting Tournament Pages

Targets:

- Divisions
- Contacts
- Announcements
- Archives
- Venues
- Rules & Resources

Problem:

These pages are mostly acceptable, but they use slightly different header, callout, and action patterns.

Plan:

- Apply the shared header and compact toolbar patterns where it improves consistency.
- Keep callouts slim and only show them when actionable.
- Move low-frequency actions such as seed/default tools into a Tools menu.
- Avoid large instructional panels above populated tables/lists.

Mobile requirements:

- Tables should remain usable or convert to stacked rows/cards where the existing table is cramped.
- Header actions should collapse into compact icon/overflow controls when needed.

Acceptance criteria:

- No supporting page regresses into stacked full-width action bands.
- Common page header and action placement are consistent with the redesigned pages.
- Empty states stay helpful without replacing populated content.

## Verification Plan

For each phase:

- Run the relevant static checks available in the repo, such as lint/typecheck/build scripts when practical.
- Verify no business logic or plan gate behavior changed unintentionally.
- Check desktop, tablet, and mobile widths: 1366x768, 768x1024, and 390x844.
- Confirm populated pages show at least the first record without unnecessary scrolling.
- Confirm empty states still explain what to do next.
- Confirm keyboard focus order remains logical through toolbar controls and menus.

Browser-based visual verification is owned by the user per `AGENCY_RULES.md`, unless the user explicitly asks the assistant to run browser checks.

## Implementation Order

Recommended order:

1. Phase 0 - Shared UX primitives
2. Phase 1 - Registrations
3. Phase 2 - Schedule
4. Phase 3 - Results & Scoring
5. Phase 4 - Communication Hub
6. Phase 5 - Public Site & Branding
7. Phase 6 - Registration Questions
8. Phase 7 - Tournament Dashboard
9. Phase 8 - Tournament Years / Manage
10. Phase 9 - Supporting pages consistency pass

This order fixes the worst UX regression first, then carries the same reusable layout pattern across pages with similar problems.

## Open Decisions

- Resolved: Phase 0 introduces shared React components in `components/admin/tournament/`, with CSS modules colocated there. Existing page CSS can be migrated incrementally during page phases.
- Should toolbar overflow menus use an existing local menu pattern, a lightweight custom component, or plain disclosure buttons?
- Should Registrations payment metrics remain visible for Plus users as a compact strip, or move fully into a drawer?
- Should mobile bulk actions be a sticky bottom bar or an explicit bottom sheet opened by a selected-count button?
- Should Schedule and Results share a single page-toolbar implementation with page-specific action slots?
