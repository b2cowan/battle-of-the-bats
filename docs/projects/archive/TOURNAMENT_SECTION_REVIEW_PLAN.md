# Tournament Section — Design, UX & Bug Review

> **Status:** In Progress - Phase H responsive hardening code pass complete; user browser sign-off pending
> **Created:** 2026-05-21
> **Branch:** dev

---

## Goal

A structured, full-sweep review of every tournament admin page — across both the free Tournament tier and Tournament Plus — covering visual design consistency, UX workflow quality, plan-gate accuracy, and functional bugs. Findings are compiled into a prioritized fix backlog, organized by severity and tier, then executed in sequenced phases.

This plan consolidates and supersedes the remaining open phases (2–9) of `TOURNAMENT_ADMIN_UX_REFORMAT_PLAN.md`, which becomes a dependency reference rather than an active tracker. When this plan is complete, that file can be archived.

---

## PM Brief

**What it does:** A structured, full-sweep audit of every tournament admin page — across both the free Tournament tier and Tournament Plus — covering visual design consistency, UX workflow quality, and functional bugs. Findings are compiled into a prioritized fix backlog, organized by severity and tier.

**Why it matters:** The tournament section has been built incrementally over many months and several major feature additions (slot-first roster, Plus tier, export enhancements, the UX reformat). Pages have accumulated inconsistent headers, stacked control patterns, mismatched plan gates, and a few architectural re-exports that may be outright wrong (e.g. `/venues` re-exporting the Diamonds page). No complete audit of the full 20-page surface has been done.

**Who benefits:** Every tournament organizer — from a free single-tournament operator to a Plus multi-event org. Platform admins benefit from reduced support load. Developers benefit from a single canonical list of known issues before the next major feature phase.

**Expected impact:** After this ships, the tournament admin area will have a consistent visual language, no broken or confusing page re-exports, predictable toolbar and layout patterns across all pages, accurate plan gate placement, and a verified mobile experience.

**Priority:** High — Tournament is the primary and only live-selling product tier. Design and UX debt here directly affects trial-to-paid conversion and early organizer retention.

**Success criteria:**
- All 20 pages catalogued with tier mapping (free vs. Plus-only features)
- Zero broken or incorrectly wired re-export pages
- Plan gate accuracy confirmed on every Plus-gated surface
- Design token usage consistent with `memory/design_system.md` across all pages
- UX reformat Phases 2–9 have been executed (or explicitly deferred with rationale)
- Mobile (390px) experience verified on all primary operations pages

---

## Reconciliation With Tournament Experience Excellence

`TOURNAMENT_EXPERIENCE_EXCELLENCE_PLAN.md` is the archived umbrella journey plan. This document is the archived admin-page execution tracker for tournament admin design, UX, bugs, plan gates, Plus polish, and admin mobile verification.

The Phase 1 journey audit expands scope beyond this admin sweep into signup/onboarding, public registration, public tournament pages, participant mobile, analytics surfaces, scorekeeper strategy, and the free post-event story. Those broader items should stay in the umbrella/public phases unless they directly affect an admin page listed here.

### Alignment

- No conflict on the core admin layout strategy: Phases C-H remain the correct implementation path for the audit's Schedule, Results, Communication, Branding, Registration Questions, Dashboard, Manage/Archives, supporting page, and mobile findings.
- Branding is aligned: free Public Pages controls must stay before Plus-only branding gates, and repeated full UpgradeGate blocks should become compact locked states.
- Shared tournament admin primitives remain the preferred implementation path.
- The section review should continue to be the canonical findings register for admin-page issues, while the journey audit remains the canonical cross-journey register.

### Reconciled Decisions

- **Re-export pages:** Phase A/B evidence supersedes the initial wrapper proposal. Keep the current re-exports for Venues, Staff & Access, Organization Settings, and Subscription unless browser testing shows real context confusion. The remaining Staff & Access issue is cosmetic page-title language, not a structural bug.
- **Venues:** No wrapper is required right now. Org diamonds remain the underlying data model, but the tournament-facing page already renders as "Venue Locations" and is scoped by `useTournament()`.
- **Settings hub:** The journey audit adds a new product question. Decide whether Settings & Access should become a complete tournament setup hub, or whether Dashboard remains the primary setup orchestrator with Settings kept narrower.
- **Public/mobile issues:** Public registration review-step, public schedule mobile controls, public hidden states, acquisition analytics, and public hero polish belong to the umbrella public phases, not this admin-only sweep.

### Product Decisions Before Phase G

- **Bulk registration actions:** Resolved: basic selected-row registration updates stay available on all tournament plans; Plus owns registration exports, payment reminders, targeting, custom fields, waitlist promotion, and reporting.
- **Waitlist behavior:** Resolved: free Tournament can collect overflow/waitlist registrations; Tournament Plus owns promotion, queue management, and automation.
- **Scorekeeper flow:** Decide during the Results/mobile pass whether the existing Results page can become good enough for mobile score entry, or whether a dedicated lightweight scorekeeper route is needed.

---

## Page Catalogue

These are the 20 functional tournament admin pages. The Pre-issue column now includes Phase A/B resolution notes where the initial concern has already been closed or downgraded.

### Navigation & Lifecycle

| # | Route | Description | Tier | File size | Pre-issue |
|---|-------|-------------|------|-----------|-----------|
| 1 | `/admin/tournaments/` | Smart redirect → dashboard or manage | Both | Tiny | — |
| 2 | `/admin/org/tournaments/` or `/admin/tournaments/manage/` | Tournament CRUD — create, rename, status, archive, slot usage | Both | 1,100 lines | Lifecycle education strip takes too much space above table |

### Core Operations (run a tournament day-to-day)

| # | Route | Description | Tier | File size | Pre-issue |
|---|-------|-------------|------|-----------|-----------|
| 3 | `dashboard/` | Draft checklist, live stats, post-event prompts | Both | 921 lines | Checklist + nudge + quicklinks overlap; Phase 7 reformat pending |
| 4 | `teams/` | Registrations — slot board, waitlist, payments, bulk | Both (+Plus tools) | (reformat done) | Phase 2C data-rich QA verified Free/Plus desktop/mobile; org-scoped data fixed |
| 5 | `schedule/` | Schedule — RR + playoffs, publish, generate, export | Both (+Plus generator) | 1,371 lines | Reformatted in C1; Phase 2C data-rich QA verified seeded games and pool labels |
| 6 | `results/` | Results & scoring — score entry, finalization, legend | Both | 480 lines | Toolbar reformat complete; Phase 2C verified seeded games, loading state, and score modal |
| 7 | `communication/` | Compose + recipient targeting — email to teams/contacts | Both (+Plus targeting) | 451 lines | Phase 4 reformat pending |
| 8 | `age-groups/` | Division management — create/edit/delete/reorder age groups | Both | 484 lines | Phase 9 consistency pending |
| 9 | `contacts/` | Tournament contacts (non-member) | Both | 295 lines | Phase 9 consistency pending |
| 10 | `announcements/` | Public news/announcements for the tournament page | Both | 251 lines | Phase 9 consistency pending |
| 11 | `archives/` | Past tournaments — seal, view, navigate history | Both | 230 lines | Phase 8 reformat pending |

### Setup & Configuration

| # | Route | Description | Tier | File size | Pre-issue |
|---|-------|-------------|------|-----------|-----------|
| 12 | `venues/` | Venue/field selection for schedule slots | Both | 1-line re-export | Resolved in Phase A: internal diamonds naming only; page title is "Venue Locations" and tournament context is acceptable |
| 13 | `rules/` | Upload / manage rules & resource documents | Both | 17 lines (shell) | Phase 9 consistency check needed |
| 14 | `branding/` | Public site — colors, logo, visibility controls | Free basic / Plus advanced | 570 lines | Public Pages order, compact locked-state polish, and Phase F visual consistency pass complete |

### Settings Hub & Sub-pages

| # | Route | Description | Tier | File size | Pre-issue |
|---|-------|-------------|------|-----------|-----------|
| 15 | `settings/` | Hub — tabbed: Tournament Setup, People & Access, Account | Both | 186 lines | Clean; verify cards link correctly |
| 16 | `settings/event/` | Event dates, registration fee schedule, score policy | Owner only | 337 lines | Phase 9 consistency check |
| 17 | `settings/registration-fields/` | Custom registration questions collection | **Plus only** | 311 lines | Phase 6 reformat pending |
| 18 | `settings/members/` | Staff & access — invite/manage org members | Both | 1-line re-export | Downgraded in Phase A: org-level staff management is intentional; title language is cosmetic |
| 19 | `settings/organization/` | Org-level settings (name, slug, etc.) | Owner only | 1-line re-export | Resolved in Phase A: acceptable for eligible users; sidebar context is sufficient |
| 20 | `settings/subscription/` | Plan & billing | Owner only | 1-line re-export | Resolved in Phase A: intentional billing re-export; tournament settings context is acceptable |

### Plus-Only Dedicated Pages

| # | Route | Description | Tier | File size | Pre-issue |
|---|-------|-------------|------|-----------|-----------|
| 21 | `summary/` | Post-event summary report — registrations, payments, recap | **Plus only** | 392 lines | Plus gate and org-scoped summary wiring verified structurally; browser sign-off remains in Phase I |

> **Note on count:** The spec says "20 admin pages." Pages 1 and the preview routes are excluded from the fix scope (preview is read-only public rendering). Page 20 (summary) is included making the working count 20 functional admin surfaces.

---

## Pre-Identified Issues (going into Phase A)

These were suspected or confirmed before the audit began. Phase A/B results later supersede this table where noted.

| ID | Page | Severity | Description |
|----|------|----------|-------------|
| BUG-01 | `venues/` | High | Re-exports `org/diamonds/page` — tournament admin sees page titled "Diamonds" instead of "Venues"; creates terminology confusion |
| BUG-02 | `settings/members/` | Medium | Re-exports `org/members/page` with no tournament scope — staff assignment capability shown to all staff; no tournament-specific context |
| BUG-03 | `teams/` (Phase 1 reformat) | Medium | Phase 1 browser visual verification is pending; known issues may exist at tablet/mobile widths |
| UX-01 | `schedule/` | High | 1,371-line page — stacked headers, view controls, generator controls, and filters before first game; Phase 2 reformat not yet done |
| UX-02 | `dashboard/` | Medium | Checklist, clone callout, optional nudges, and quick links overlap in purpose and push key status information down |
| UX-03 | `branding/` | Medium | Repeated full UpgradeGate blocks for non-Plus users instead of compact locked-state presentation |
| UX-04 | `communication/` | Medium | Expanded recipient filter cards stack before the composer, pushing message composition far below fold |
| UX-05 | `age-groups/` | Low-Med | Inconsistent header/action pattern vs. reformatted pages |
| UX-06 | `results/` | Medium | Explanatory legend paragraph sits between filters and game list; Phase 3 reformat pending |
| UX-07 | `manage/` (org/tournaments) | Medium | Lifecycle education strip permanently takes space above tournament table |
| DESIGN-01 | Multiple | Medium | Inconsistent use of `var(--bg-surface)` vs `var(--bg-raised)` card layering across settings sub-pages |
| PLAN-01 | Multiple | Verify | Plan gate accuracy — confirm `hasPlanFeature()` checks match current tier definitions for all Plus-gated surfaces |

---

## Phases

### Phase A — Inventory Audit & Pre-work
*Goal: Create the ground truth before writing a line of fix code.*

- [x] Read and document each of the 20 pages at a structural level (header → toolbar → content → actions pattern)
- [x] Confirm the settings hub cards link to the correct sub-routes and produce no 404s
- [x] Audit all 1-line re-export pages — document whether they are contextually appropriate, missing context headers, or should be replaced
- [x] Document all `hasPlanFeature` / `hasModuleEntitlement` calls in tournament pages and cross-check against `lib/plan-features.ts` plan tier definitions
- [x] Produce a **Findings Register** (append to this plan below the phases) with every confirmed issue, severity, and affected file

**Phase A Key Discoveries:**
- BUG-01 is NOT a user-facing bug: the diamonds page already renders "Venue Locations" as its `<h1>` and is properly scoped to the current tournament via `useTournament()`. The "diamonds" naming is internal only.
- BUG-02 is downgraded to Low/Cosmetic: the members page re-export is intentionally correct (staff is managed at the org level); the only issue is the page title says "Members" rather than "Staff & Access" when entered from tournament settings. Low priority.
- NEW BUG-03 (High): Branding page renders `<UpgradeGate>` (Logo + Theme — Plus-only) BEFORE the Public Pages card (free feature). Non-Plus users see the upgrade gate before they can reach the free public visibility controls. **Fixed.**
- UX-01 (Schedule) confirmed: 3 rows of controls before game list. Auto-Generate and Playoff Wizard inline as plain buttons with lock icons. **Reformatted with TournamentAdminToolbar + ToolbarMenu.**
- UX-06 (Results legend) confirmed: explanatory `<p>` tag sits between filters and game list. **Replaced with StatusLegendPopover in the filtersRow.**
- Communication page (UX-04) is BETTER than expected: already has a collapsible recipient editor (`recipientsOpen` toggle). The remaining issue is the Plus-targeted filter cards stack when expanded. Medium priority, not critical.
- Settings hub cards all link correctly; no broken routes found.
- `settings/subscription`, `settings/members`, `settings/organization` re-exports are all contextually acceptable within the tournament admin shell. The sidebar provides navigation context in all cases.

### Phase B — Bug Fixes (architectural & functional)
*Fixes BUG-01, BUG-02, and any critical findings from Phase A.*

- [x] **BUG-01: Venues page** — RESOLVED (non-issue): venues page already renders "Venue Locations" as its `<h1>` and is tournament-scoped. No fix needed.
- [x] **BUG-02: Staff & Access page** — DOWNGRADED to Low: re-export is intentionally correct. Cosmetic title mismatch deferred.
- [x] **BUG-03: Branding page order** — FIXED: moved Public Pages card before the first `<UpgradeGate>` so non-Plus users see the free feature first. (`app/[orgSlug]/admin/tournaments/branding/page.tsx`)
- [x] **Settings/organization, subscription, members** — all confirmed contextually correct in tournament admin shell. No wrappers needed.
- [x] `pnpm tsc --noEmit` — zero errors after fixes

### Phase C — UX Reformat Continuation (Phases 2–6)
*Picks up from `TOURNAMENT_ADMIN_UX_REFORMAT_PLAN.md` Phase 1. Use the shared primitives from `components/admin/tournament/TournamentAdminUI.tsx`.*

#### C1 — Schedule (Reformat Phase 2)
- [x] Adopt `TournamentAdminToolbar` for: Round Robin/Playoffs segmented control, division select, search, Add Game button
- [x] Move Auto-Generate, Playoff Wizard, and Publish All into a `ToolbarMenu` ("Tools" overflow menu)
- [x] Publish status chip remains inline beside division selector (compact, already well-designed)
- [x] Export stays in `TournamentAdminHeader` actions (correct placement)
- [x] `Search`, `Lock`, `Eye` icon imports removed (no longer used directly; handled by TournamentAdminUI primitives)
- [x] `openGenerator` / `openPlayoffWizard` still show upgrade prompt for non-Plus via `showUpgradePrompt()` — behavior unchanged
- [x] Mobile: toolbar fits without page-level horizontal overflow at 390x844; no-current-tournament empty state visible (`app/[orgSlug]/admin/tournaments/schedule/page.tsx`)
- [x] Phase 2C: seeded Free/Plus Schedule pages verified at 1440px and 390x844 with correct org-scoped games and normalized pool labels

#### C2 — Results & Scoring (Reformat Phase 3)
- [x] Move "Pending Review" + "Completed" explanation `<p>` tag into a `StatusLegendPopover` in the filtersRow — legend is now accessible via a "Score statuses" help button rather than always-visible paragraph
- [x] Full toolbar reformat (view mode, division, score-status filter, search, export → TournamentAdminToolbar)
- [x] Desktop/mobile page load, toolbar wrapping, and no-current-tournament empty state verified at 1440x1000 and 390x844 (`app/[orgSlug]/admin/tournaments/results/page.tsx`)
- [x] Phase 2C: seeded Free/Plus Results pages verified at 1440px and 390x844; score modal opens on both plans and both viewport sizes

#### C3 — Communication Hub (Reformat Phase 4)
- [x] Individual Teams filter card spans full grid row (`style={{ gridColumn: '1 / -1' }}`) so it doesn't crowd narrow filter cards
- [x] "Done" button added at bottom of expanded recipient section — organizers no longer need to scroll back to top to collapse (`app/[orgSlug]/admin/tournaments/communication/page.tsx`)
- [ ] *(Deferred)* Drawer/bottom-sheet layout for expanded recipient editor on desktop/mobile

#### C4 — Branding / Public Site (Reformat Phase 5)
- [x] Removed second full `<UpgradeGate>` wrapper from Advanced section — non-Plus users now see the advanced controls in locked/disabled state instead of a blank upgrade card
- [x] Added compact single-line notice for non-Plus users just below the "Advanced" section header, linking to the subscription page
- [x] All individual locked controls (Hero Banner, Font, Card Style) already have inline "Locked" badges and upgrade notes — no redundant gate needed (`app/[orgSlug]/admin/tournaments/branding/page.tsx`)

#### C5 — Registration Questions (Reformat Phase 6)
- [x] Active Questions list now renders before the Add a Question form — organizers see their existing questions first
- [x] "Add Question" anchor-link button added to Active Questions card header — links to `#add-question-form` below
- [x] Form given `id="add-question-form"` for anchor targeting
- [x] Non-Plus locked state unchanged — concise upgrade card with link to subscription (`app/[orgSlug]/admin/tournaments/settings/registration-fields/page.tsx`)

### Phase D — Dashboard & Lifecycle (Reformat Phases 7–8)

#### D1 — Tournament Dashboard (Phase 7)
- [x] Remove the `setupLinks` section entirely — Venues, Divisions, Contacts, and Rules were all duplicated below the checklist; the checklist already links to each destination
- [x] Collapse the 4 optional nudge items (Venues, Fees, Rules, Branding) behind a disclosure toggle — shows "Optional setup — N of 4 complete"; draft dashboard now shows only the 4 required checklist items by default
- [x] `ChevronDown`/`ChevronUp` toggle chevron; `MapPin`, `BookUser`, `BookOpen` removed from icon imports (no longer needed)
- [x] Activate button and ready/draft status pill remain in the checklist header — already well-placed, no repositioning needed
- [x] Live and completed dashboard analytics left intact (`app/[orgSlug]/admin/tournaments/dashboard/page.tsx`)

#### D2 — Manage Tournaments / Archives (Phase 8)
- [x] Lifecycle education strip replaced with a compact "How statuses work ▾" toggle — collapsed by default; expands to a single tight row of status definitions
- [x] Slot usage chip ("N / M slots") moved into the page header next to "New Tournament" — turns amber at limit; hidden for unlimited plans
- [x] Slot limit warnings (`HelpCallout` components) unchanged — remain contextual and actionable-only (`app/[orgSlug]/admin/org/tournaments/page.tsx`)
- [x] Archives page audited — already uses correct header/section-block pattern; seal flow and status transitions intact; no changes needed (`app/[orgSlug]/admin/tournaments/archives/page.tsx`)

### Phase E — Supporting Pages Consistency (Reformat Phase 9)

Apply shared header and compact toolbar patterns to all remaining pages that have not yet been reformatted:

- [x] **Age Groups / Divisions** (`age-groups/page.tsx`) — **Audited: already correct.** Uses `styles.pageHeader` + `styles.headerLeft` with icon/title/subtitle + "Add Division" button in header; table immediately below. No changes needed.
- [x] **Contacts** (`contacts/page.tsx`) — **Audited: already correct.** Same `admin-page.module.css`, proper pageHeader with BookUser icon, "Add Contact" in header, contextual callout below, table below that. No changes needed.
- [x] **Announcements** (`announcements/page.tsx`) — **Audited: already correct.** Uses `announcements-admin.module.css` with `styles.pageHeader` + `styles.headerLeft`, Megaphone icon, "New Public Post" in header, contextual deliveryNote callout below. No changes needed.
- [x] **Rules & Resources** (`rules/RulesAdmin.tsx`) — **Audited: already correct.** Uses `admin-common.module.css` with `<header className={styles.pageHeader}>`, BookOpen icon, title/subtitle in `styles.headerLeft`, Save + Seed buttons in `styles.headerActions`. No changes needed.
- [x] **Settings / Event** (`settings/event/page.tsx`) — Phase F consistency check complete; fee segmented control, cards, toggle rows, and Plus upsell use shared visual tokens/classes
- [ ] **Settings hub** (`settings/page.tsx`) — hub expansion deferred; decision pending
- [x] Cross-check: none of these pages use a full-width instructional band above a populated table — all pass

**Phase E result:** All four target pages (Age Groups, Contacts, Announcements, Rules) already follow the correct header/toolbar pattern established during the reformat. No code changes were required.

### Phase F — Design Consistency Pass

- [x] Audit CSS token usage across all 20 pages — added missing global aliases for `var(--bg-surface)`, `var(--bg-raised)`, `var(--bg-inset)`, `var(--bg-card)`, `var(--border-subtle)`, text tokens, radius aliases, and common alpha tokens used by tournament CSS
- [x] Confirm all icons are from the `lucide-react` set at consistent sizes (16px inline, 19px card, 20-22px toolbar actions)
- [x] Confirm typography: shared primitives now route page title/subtitle/helper copy through `--text-primary`, `--text-secondary`, and `--text-tertiary`
- [x] Check border/separator consistency — cleaned the repeated Rules, Schedule, Bracket Builder, Branding, Communication, Settings, and Archives border/background patterns onto `var(--border-subtle)`, `var(--bg-surface)`, and `var(--bg-inset)`
- [x] Confirm card radii: settings, rules, schedule modal, bracket, and archive empty-state cards now use the shared radius aliases instead of hard-coded one-off radii
- [x] Confirm empty states across all pages: audited; Archives empty states upgraded to icon/title/body pattern, table-row empty states remain intentionally compact and will get viewport sign-off in Phase H

**Phase F code pass (2026-05-22):**

- Added missing global design token aliases that many tournament pages already referenced but could not resolve consistently.
- Normalized card depth, borders, and radii in shared tournament admin primitives, Branding/Public Site, Event Settings, Registration Questions, Communication, Rules, Schedule generator/bracket surfaces, and Archives.
- Improved Archives empty states from single muted text lines into structured, scannable states with icons, titles, and explanatory copy.

### Phase G — Plus Tier Polish & Gate Accuracy

- [x] **Post-Event Summary** (`summary/page.tsx`) — Plus gate, print/share actions, and summary API/client wiring verified structurally; summary requests now pass the visited `orgSlug`
- [x] **Plan gate matrix** — tournament admin client calls and server-side admin API routes now pass `orgSlug` where multi-org owners previously risked first-membership drift; free/Plus registration and waitlist boundaries remain aligned
- [x] **Upgrade prompts** — touched tournament upgrade CTAs route to the tournament-local subscription context (`settings/subscription`) and no dead `href` values were found in the Phase G code pass
- [x] **CompactUpsell pattern** — Branding no longer puts a full-width `<UpgradeGate>` above list content; Logo, Theme, Hero, Font, and Card Style render as compact locked controls for non-Plus users
- [x] Confirm cloning is correctly Plus-gated and clone/populate actions are org-scoped from dashboard/manage flows

**Phase G code pass (2026-05-22):**

- Patched org-scoped auth/request resolution across tournament admin APIs for branding, schedule publish, announcements, games, teams, registration fields, exports, reminders, summary, clone/populate, setup/seal/archive, venues, divisions, contacts, dashboard, activity, and PDF settings.
- Patched org-scoped client fetches across Branding, Schedule, Generator, Playoff Wizard, Results, Registrations/Teams, Communication, Announcements, Registration Fields, Summary, Setup Wizard, Manage, Dashboard, Event Settings, Archives, Contacts, Divisions, Rules, bottom nav, and live event log.
- Replaced the remaining Branding full-gate experience with disabled/locked controls so free users can still scan the public-site settings while seeing exactly what Tournament Plus unlocks.

### Phase H — Mobile Verification Pass

**Phase 2C core operations pass (2026-05-22):**

- [x] Registrations verified for Free and Plus at desktop 1440px and mobile 390x844 with seeded registrations, no page-level horizontal overflow, and correct org-scoped tournament data.
- [x] Schedule verified for Free and Plus at desktop 1440px and mobile 390x844 with seeded games, no page-level horizontal overflow, and no duplicate pool labels.
- [x] Results verified for Free and Plus at desktop 1440px and mobile 390x844 with seeded games, no false loading/no-tournament state, and score modal entry working.
- [x] Final Playwright report written to `test-results/tournament-phase2c/phase2c-final-check.json`.

For each primary operations page (3–11 in the page catalogue), verify at 390x844:

- [ ] First record/card visible without scrolling past more than one compact toolbar
- [ ] Toolbar fits in ≤2 compact rows; no horizontal overflow
- [ ] Bulk actions not visible at zero selections; appear as sticky bottom bar after selection
- [ ] No text overflow or truncation that hides critical information
- [ ] Modals/drawers scroll correctly on mobile
- [ ] Touch targets (buttons, row actions) ≥44px height

Record "verified" or "issue" for each page in the Findings Register below.

**Phase H responsive hardening code pass (2026-05-22):**

- Converted simple supporting-page tables on Manage Tournaments, Divisions, Contacts, and Archives into labeled mobile-card rows below phone/tablet breakpoints so the pages no longer depend on horizontal table scanning.
- Improved shared mobile modal ergonomics: bottom-aligned dialogs, tighter viewport max-height, wrapping 44px action buttons, and safer long-title wrapping.
- Added responsive stacking/touch polish for Communication recipient controls, Announcements cards/callouts, Branding/Event shared controls, Rules add/resource sections, Post-Event Summary action buttons, and shared admin header actions.
- Verification: `pnpm.cmd tsc --noEmit`, focused ESLint on touched TSX files with zero errors, `git diff --check`, dev-server restart after clearing `.next`, and `GET /platform-admin/login?next=%2Fplatform-admin` returned HTTP 200 with no Supabase `EACCES`; existing warnings remain. Browser visual sign-off remains assigned to the user per project workflow.

#### Phase H Final Browser Sign-Off Checklist

Use the UAT orgs from `UAT_SETUP.md` unless another seeded org is fresher:

- Free Tournament: `uat-test-org`
- Tournament Plus: `uat-plus-org`
- Desktop viewport: about `1440x1000`
- Mobile viewport: about `390x844`

Global pass criteria for every route:

- No page-level horizontal scrollbar at mobile width.
- Header title, subtitle, and primary action are readable and reachable.
- First useful record/card/empty state appears without scrolling past stacked instructional content.
- Controls wrap into readable rows; touch actions are at least comfortable thumb targets.
- Modals fit inside the viewport and scroll internally when needed.
- Plus locks remain compact and do not hide free features.
- No obvious 500 state, stuck loading state, or wrong-org data.

| Area | Route(s) | Plans | Sign-off focus |
|------|----------|-------|----------------|
| Dashboard | `/admin/tournaments/dashboard` | Free + Plus | Checklist/analytics stack cleanly; optional setup disclosure does not bury primary state; activate/completed actions remain reachable. |
| Manage Tournaments | `/admin/org/tournaments` and `/admin/tournaments/manage` | Free + Plus | Tournament rows render as readable mobile cards; status select and row actions are usable; lifecycle help stays compact. |
| Registrations | `/admin/tournaments/teams` | Free + Plus | Previously data-rich verified; re-check selected-row bulk bar, filters, add-team/reminder modals, and no horizontal overflow. |
| Schedule | `/admin/tournaments/schedule` | Free + Plus | Previously data-rich verified; re-check toolbar, Add Game modal, Tools menu, generator/wizard entry points, and no horizontal overflow. |
| Results | `/admin/tournaments/results` | Free + Plus | Previously data-rich verified; re-check score modal, score-status legend, filters, and mobile score-entry ergonomics. |
| Communication | `/admin/tournaments/communication` | Free + Plus | Recipient summary stays compact; expanded targeting filters do not obscure the composer too badly; Done button is reachable. |
| Divisions | `/admin/tournaments/age-groups` | Free + Plus | Division rows render as labeled cards; add/edit division modal scrolls; pool and fee controls remain usable. |
| Contacts | `/admin/tournaments/contacts` | Free + Plus | Contact rows render as labeled cards; public-contact selector and edit/delete actions are easy to tap. |
| Announcements | `/admin/tournaments/announcements` | Free + Plus | Delivery note, announcement cards, pinned state, and add/edit modal stack cleanly. |
| Archives | `/admin/tournaments/archives` | Free + Plus | Empty states look intentional; sealed/pending rows render as labeled cards; Seal/Public Ledger actions are reachable. |
| Branding | `/admin/tournaments/branding` | Free + Plus | Public Pages controls appear before Plus-only branding; locked controls stay inspectable and compact; footer save action is reachable. |
| Settings Hub | `/admin/tournaments/settings` | Free + Plus | Tabs and setup cards fit without clipped labels; locked/coming-soon cards do not confuse navigation. |
| Event Settings | `/admin/tournaments/settings/event` | Free + Plus owner | Fee segmented control stacks cleanly; save footer is reachable; Plus notification upsell stays compact. |
| Registration Questions | `/admin/tournaments/settings/registration-fields` | Plus; Free locked state | Free locked state is clear; Plus active-question cards and Add Question form fit without clipped actions. |
| Rules & Resources | `/admin/tournaments/rules` | Free + Plus | Add section/resource controls stack; rule cards, applies-to chips, and resource rows remain editable on mobile. |
| Post-Event Summary | `/admin/tournaments/summary` | Plus | Print/share actions stack; metric cards and division recap stay readable; locked state is clear for non-Plus. |

### Phase I — Final Verification & Handoff

- [x] Run `pnpm tsc --noEmit` — zero type errors in Phase 2C, Phase G, Phase F, and Phase H code passes
- [ ] Run `pnpm lint` — zero lint errors
- [x] Focused Phase G ESLint on touched tournament admin/API files — zero errors; existing warnings remain
- [x] Focused Phase F ESLint on touched TSX files — zero errors; existing warnings remain
- [x] Focused Phase H ESLint on touched TSX files — zero errors; existing warnings remain
- [x] Dev server restart after Phase H shared styling changes: stop → clear `.next` → `npm run dev`; `/platform-admin/login?next=%2Fplatform-admin` returned HTTP 200 with no Supabase `EACCES`
- [x] Dev server restart: stop → `rm -rf .next` → `npm run dev` → wait for Ready after Phase F shared styling changes; `/platform-admin/login?next=%2Fplatform-admin` returned HTTP 200 with no Supabase `EACCES`
- [ ] User browser sign-off at desktop and mobile widths on at least: dashboard, registrations, schedule, results, settings hub
- [ ] Archive `TOURNAMENT_ADMIN_UX_REFORMAT_PLAN.md` to `docs/projects/archive/` once Phase H is verified
- [ ] Update `TODO.md`: mark this plan complete, move to Completed Projects

---

## Architectural Decisions

- **Re-export pages (venues, members, subscription, org settings):** Phase A/B supersedes the initial wrapper proposal. Keep the current re-exports unless browser testing shows real context confusion. The remaining Staff & Access issue is a cosmetic title mismatch.
- **Venues page:** Org diamonds remain the underlying data model for tournament venue options, but the tournament-facing page already renders "Venue Locations" and is scoped by `useTournament()`. No wrapper is required now.
- **UX reformat primitives:** All reformat work in Phases C-E uses the existing `TournamentAdminUI.tsx` shared components. No new primitive components should be needed unless a Phase C-E page reveals a gap.
- **Phase ordering:** Resolved structural issues stay documented in Phase A/B; bulk action and waitlist product-boundary decisions are settled and must be verified during Phase G plan-gate signoff.

---

## Open Questions

- [x] Resolved: `settings/organization` can remain accessible from tournament admin for eligible users; Phase A found the route context acceptable.
- [ ] Should the Schedule page's massive file (~1,371 lines) be split into sub-components before reformatting, or is an in-place pass acceptable?
- [ ] Should the Reformat Plan Phase 1 browser verification be a blocking gate for Phase C work, or can it proceed in parallel?
- [x] Resolved: basic bulk registration status/payment updates remain free; advanced exports, reminders, targeting, custom fields, waitlist promotion, and reporting stay Plus.
- [x] Resolved: waitlist collection is free; waitlist promotion/automation stays Plus.
- [ ] Should Settings & Access become a complete tournament setup hub, or should Dashboard remain the main setup orchestrator?
- [ ] Should scorekeepers get a dedicated lightweight mobile scoring route, or should the Results page become sufficient for day-of score entry?

---

## Findings Register

*(Populated during Phase A audit and reconciled with the Phase 1 journey audit.)*

| ID | Phase | Page | Severity | Status | Description | Fix task |
|----|-------|------|----------|--------|-------------|----------|
| BUG-01 | B | `venues/` | ~~High~~ | **Resolved — non-issue** | Page already renders "Venue Locations" as `<h1>` and is tournament-scoped via `useTournament()`. | No fix needed |
| BUG-02 | B | `settings/members/` | ~~Medium~~ → Low | Deferred | Re-export is correct architecture; page title says "Members" instead of "Staff & Access" — minor cosmetic. | Future cosmetic pass |
| BUG-03 | B | `branding/` | High | **Fixed** | Public Pages (free) rendered AFTER Plus UpgradeGate — non-Plus users had to scroll past upgrade prompt to reach free controls. | Reordered in `branding/page.tsx` |
| UX-01 | C1 | `schedule/` | High | **Fixed** | 3 rows of controls (pageHeader + controlsBar + filtersRow) before game list. Auto-Generate + Playoff Wizard inline as plain buttons. | Reformatted: `TournamentAdminHeader` + `TournamentAdminToolbar` + `ToolbarMenu` ("Tools") |
| UX-02 | D1 | `dashboard/` | Medium | **Fixed** | Checklist/nudges/quicklinks overlapped; key status was pushed down. | Duplicate setup links removed and optional setup collapsed behind one compact toggle |
| UX-03 | C4 | `branding/` | Medium | **Fixed** | Two UpgradeGates framed the page (Logo+Theme gate #1, Advanced gate #2) — non-Plus saw two upgrade prompts sandwiching Public Pages. | Advanced gate removed; controls render inline as locked/disabled states |
| UX-04 | C3 | `communication/` | Low-Med | **Fixed** | Recipient editor was collapsible, but Plus targeting filters stacked heavily and were awkward to close after editing. | Individual Teams spans the full grid row and a bottom Done button collapses the editor |
| UX-05 | E | `age-groups/` | Low | **Resolved — audited** | Initial concern was inconsistent header/action pattern vs reformatted pages. | Age Groups, Contacts, Announcements, and Rules already matched the shared pattern |
| UX-06 | C2 | `results/` | Medium | **Fixed + verified** | Legend paragraph replaced with `StatusLegendPopover`, controls moved into `TournamentAdminToolbar`, and Export moved from the header into the toolbar. | Phase 2B smoke/mobile pass verified page load, toolbar presence, and no page-level horizontal overflow |
| UX-07 | D2 | `manage/` | Medium | **Fixed** | Lifecycle strip above tournament table permanently consumed record space. | Replaced with collapsed "How statuses work" toggle; slot usage moved to header |
| DESIGN-01 | F | Multiple | Medium | **Fixed** | Inconsistent card depth/border token usage across settings and supporting tournament pages made surfaces feel built from different eras. | Added global token aliases and normalized repeated Branding, Event Settings, Registration Questions, Communication, Rules, Schedule, Bracket Builder, and Archives surfaces |
| DESIGN-02 | F | `schedule/` | Low | **Fixed** | `Search`, `Lock`, `Eye` icons imported but no longer rendered directly after reformat | Removed from lucide import |
| UX-08 | A | `results/` | Low | **Fixed + verified** | Results page export moved from isolated header action into the shared toolbar. | Phase 2B smoke/mobile pass verified toolbar layout at desktop and 390x844 |
| PLAN-02 | G | `teams/`, registration bulk API, pricing/help | High | **Verified in Phase G** | Basic selected-row registration updates are intentionally free. Pricing, help, memory, analytics label, and feature copy now reflect that Plus owns exports, reminders, targeting, custom fields, waitlist promotion, and reporting. | Boundary remains aligned after the Phase G gate pass |
| PLAN-03 | G | Public registration, waitlist admin APIs | High | **Verified in Phase G** | Waitlist collection is intentionally free; waitlist promotion/queue management remains Plus-gated. Public waitlist joins now use `waitlist_collection` analytics language instead of `waitlist_automation`. | Boundary remains aligned after the Phase G gate pass |
| UX-09 | E | `settings/` | Medium | Open | Settings & Access may be too narrow for a setup hub; it omits Branding/Public Site, Venues, Rules, Contacts, and Divisions. | Decide setup-hub role; add related setup cards/links if Settings should become complete |
| UX-10 | C2/H | `results/` | Medium | Open | Score entry depends on the dense Results page; mobile scorekeeper experience may need a dedicated lightweight route. | Decide during Results/mobile pass whether to simplify Results or create a scorekeeper route |
| AUTH-01 | Phase 2B | Admin auth | High | **Fixed + verified** | Multi-org owners were redirected to login because `getAuthContext()` used `.single()` for organization membership. UAT owner belongs to both free and Plus orgs, exposing the issue. | `getAuthContext({ orgSlug })` now supports route-aware membership resolution; admin, rep-teams, official, coaches, and public tournament layouts pass the visited org slug |
| UX-11 | Phase 2B | `teams/`, `results/` | Medium | **Fixed + verified** | When no tournament was selected, Registrations and Results could remain in a loading state instead of showing the same honest empty state as Schedule. | Clear page state and show "No tournament selected" instead of indefinite loading |
| DATA-01 | Phase 2C | `teams/`, `schedule/`, `results/` | High | **Fixed + verified** | Multi-org owner browser QA showed client tournament context and admin fetches could drift to the first membership's tournament data when visiting another org. | `TournamentProvider`, `OrgProvider`, and core admin APIs/fetches now pass `orgSlug` and `tournamentId`; final Free/Plus desktop/mobile matrix passed |
| UX-12 | Phase 2C | `teams/`, `schedule/` | Low-Med | **Fixed + verified** | Pool labels could render as duplicate "Pool Pool" when seeded data already included "Pool" in the name. | `formatPoolName()` now normalizes leading/trailing Pool text and pool headers no longer append a second label |
| QA-01 | Phase 2C | Core operations | Medium | **Verified** | Data-rich UAT seed covers divisions, teams, registrations, venues, games, pool slots, and Plus custom field answers for Free and Tournament Plus. | Final matrix: HTTP 200, seeded content visible, no page-level horizontal overflow, no duplicate pool labels, no console errors, Results score modal opens |
| PLAN-04 | G | Plus-gated tournament admin/API flows | High | **Fixed + verified structurally** | Plus/free tournament actions could still resolve against the first org membership if a route did not pass the visited `orgSlug`, undermining gate accuracy for multi-org owners. | Patched org-scoped client fetches and server auth across tournament admin Plus surfaces; `tsc`, focused ESLint, whitespace check, and dev-server login probe passed |
| UX-13 | G | `branding/` | Medium | **Fixed** | Non-Plus organizers needed compact, inspectable locked states across advanced public-site controls instead of broad upgrade framing. | Logo, Theme, Hero Banner, Font, and Card Style controls now render as locked/disabled with a compact Plus note |
| DESIGN-03 | F | `archives/`, shared tournament CSS | Low-Med | **Fixed** | Empty archive states and shared token aliases were visually under-specified, causing muted one-line states and unresolved CSS variables in tournament surfaces. | Added structured archive empty states and global aliases for the CSS tokens used by tournament admin modules |
| UX-14 | H | `manage/`, `age-groups/`, `contacts/`, `archives/`, supporting admin surfaces | Medium | **Fixed structurally; browser sign-off pending** | Supporting pages still depended on desktop-style tables, dense header action rows, and generic modal/button sizing at mobile widths. | Added mobile-card tables with labels, stacked header/actions, improved modal touch targets, and responsive stacking for Communication, Announcements, Branding controls, Rules, and Summary actions |
