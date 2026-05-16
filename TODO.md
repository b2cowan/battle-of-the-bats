# FieldLogicHQ — Project TODO List

This file tracks the ongoing tasks for the FieldLogicHQ platform (multi-tenant sports club and league management). AI models and the USER use this to coordinate work.


---

- [ ] **League onboarding wizard** - Guide League/Club owners through first house league setup with optional tournament setup branch (see [LEAGUE_ONBOARDING_WIZARD_PLAN.md](LEAGUE_ONBOARDING_WIZARD_PLAN.md))
  - [x] First implementation: league startup tasks, onboarding wizard, remaining-step CTAs, and create-season modal alignment
  - [ ] Browser verification

## 🚀 Active Tasks (Priority Order)

- [ ] **Tournament help documentation UX review** - Upgrade tournament help with grouped contents, search, quick answers, and FAQs (see [TOURNAMENT_HELP_DOCS_REVIEW_PLAN.md](TOURNAMENT_HELP_DOCS_REVIEW_PLAN.md))

- [ ] **Free Tournament organizer UX cleanup** - Resolve signup/onboarding, publish, operations, and free-tier guardrail findings (see [docs/archive/TOURNAMENT_FREE_TIER_UX_IMPLEMENTATION_PLAN.md](docs/archive/TOURNAMENT_FREE_TIER_UX_IMPLEMENTATION_PLAN.md))
  - [x] Reusable Manage Tournaments setup wizard with existing-venue reuse
  - [x] Tournament Settings & Access section
  - [x] Phase 1 trust fixes: mobile activation API path, secured message sending, active contact mapping
  - [x] Phase 2 signup and onboarding clarity copy
  - [x] Phase 3 item 8: draft-to-publish dashboard checklist
  - [x] Phase 3 item 10: draft public-page messaging and preview-link clarity
  - [x] Phase 4 item 11: external payment expectations and fee-mode alignment
  - [x] Phase 4 item 12: admin score entry respects finalization rules
  - [x] Phase 4 item 13: public announcement posting is clearly separated from email communication
  - [x] Phase 4 item 14: communication targeting now supports teams, divisions, statuses, and contacts
  - [x] Phase 4 item 15: mobile tournament More menu includes day-of tools
  - [ ] Phase 5 item 16: plan feature gates and pricing copy align free Tournament with Tournament Plus-and-above benefits

### 0. Tournament Signup Experience
*Detailed tasks in [TOURNAMENT_SIGNUP_EXPERIENCE_FIXES.md](TOURNAMENT_SIGNUP_EXPERIENCE_FIXES.md)*

- [ ] **First tournament signup path** - Fix onboarding, setup, public registration, and route polish for new tournament organizers
  - [x] Phase 1 trust and blocking fixes implemented
  - [x] Phase 2 setup polish implemented
  - [x] Phase 3 conversion and public experience implemented
  - [x] Phase 4 plan-aware onboarding refinement implemented
  - [x] Walkthrough blocker: post-signup onboarding plan chooser no longer blanks on org-context 403
  - [x] Walkthrough polish: create-tournament onboarding opens the modal and post-create optional launch steps are shown
  - [x] Walkthrough cleanup: create modal initializes immediately and admin archive console errors are removed
  - [x] Walkthrough cleanup: launch steps visible up front and first-run create modal no longer shows migration/seed controls
  - [x] Walkthrough polish: onboarding workflow uses focused chrome without admin side navigation
  - [x] Walkthrough polish: division presets are editable starter rows instead of hardcoded youth brackets
  - [x] Walkthrough polish: startup workflow steps open modals over onboarding with save/skip progress and dashboard reminder
  - [x] Walkthrough blocker: post-signup onboarding render fault guarded
  - [x] Walkthrough polish: onboarding division rows label capacity, expand pool controls, and tolerate missing startup-task migration
  - [x] Walkthrough polish: startup workflow is now a single step-by-step modal wizard with save/skip advancement
  - [x] Walkthrough polish: first-run plan selection stays editable until setup starts
  - [x] Walkthrough polish: wizard plan selection advances automatically and every modal has Back navigation
  - [x] Walkthrough polish: tournament details update saved drafts, with divisions and welcome message split into standalone wizard steps
  - [x] Walkthrough polish: skipping first tournament skips dependent setup modals as a group
  - [x] Walkthrough polish: skipping tournament setup requires confirmation and manual tournament creation retires the wizard
  - [x] Walkthrough polish: venue setup uses one-at-a-time structured entry with editable added venues
  - [x] Walkthrough polish: venue addresses are optional and missing required venue names show validation
  - [x] Walkthrough refactor: startup wizard is draft-first and only persists setup at final review
  - [x] Walkthrough polish: new tournament start dates cannot be before today
  - [x] Walkthrough polish: first-run setup saves tournaments as private drafts without an activation step
  - [x] Walkthrough polish: first-run setup removes staff invites so role management stays in admin settings
  - [x] Walkthrough copy: setup review explains public visibility without private-draft jargon
  - [x] Walkthrough blocker: Tournament-plan owners land in tournament management and only see entitled modules
  - [x] Walkthrough high: production signup requires email verification before plan selection/onboarding
  - [x] Walkthrough blocker: Tournament-only workspaces bypass the org hub before paint and dashboard stats use an authorized admin API
  - [x] Walkthrough polish: subscription defaults to monthly pricing and unfinished tournament setup resumes on login
  - [x] Walkthrough high: admin tournament preview uses authorized reads and shows preview navigation
  - [x] Walkthrough polish: division setup uses explicit optional age limits instead of name guessing
  - [x] Walkthrough follow-up: add tournament-level public site customization separate from org site customization
  - [x] Non-browser hardening pass completed
  - [ ] Browser verification of signup-to-registration flow

### 2. Rep Teams — Groups & Per-Team Billing
*Detailed tasks in [docs/archive/REP_TEAMS_ENHANCEMENTS_PLAN.md](docs/archive/REP_TEAMS_ENHANCEMENTS_PLAN.md) (Phases 1+2 archived; Phase 3 tracked in Stripe plan)*

- [x] **Phase 1** — Rep team groups: `rep_team_groups` table, group management UI, team assignment, group filter on lists and accounting views — migration 035 applied dev+prod, complete
- [x] **Phase 2** — Staff group scoping: `org_member_rep_group_scopes` junction table, multi-group selection per member, `repGroupIds` on auth context, hard 403 gating on all rep team admin routes, group access UI in Manage Member modal (migration 036, apply to dev+prod)
- [ ] **Phase 3** — Per-team billing: moved to [STRIPE_INTEGRATION_PLAN.md](STRIPE_INTEGRATION_PLAN.md) Phase E

### 3. Chart Library Investigation
- [ ] **Investigate chart libraries** — Evaluate recharts, chart.js, or @nivo for use in budget vs. actual and dashboard screens; assess bundle size, SSR compatibility, and dark-theme support before adding a dependency

### 3. Light / Dark Theme Toggle
- [ ] **Per-user light/dark theme preference** — Allow each user to toggle light/dark theme from their own settings screen (org admins in org settings, coaches in coach portal settings, etc.). Theme preference stored per-user (not per-org). Also expose a light/dark toggle on the public org and tournament websites so visitors can choose their preferred mode.

### 4. Stripe Integration — End-to-End Billing & Subscriptions
*Detailed tasks in [STRIPE_INTEGRATION_PLAN.md](STRIPE_INTEGRATION_PLAN.md)*

- [ ] **Billing downgrade and data retention flow** - Add FieldLogicHQ-guided downgrade/cancel review with over-limit data retention choices (see [BILLING_DOWNGRADE_RETENTION_PLAN.md](BILLING_DOWNGRADE_RETENTION_PLAN.md))
  - [x] First implementation slice: retention schema, owner review APIs/UI, cancellation suspension, and platform-admin retention queue
  - [x] Migration 038 applied in dev and production
  - [x] Retention expiry warnings and pending-purge processing
  - [x] Migration 039 applied in dev and production
  - [x] Dev/mock upgrades restore retained downgrade tournaments when plan limits allow
  - [ ] Hard purge job after pending-purge review policy is finalized
- [ ] **Phase A** — Stripe dashboard setup: products, prices, webhooks, Customer Portal (test environment)
- [ ] **Phase B** — App infrastructure: Stripe SDK, lib/stripe.ts, price map, DB migration 037
- [ ] **Phase C** — Webhook handler: subscription lifecycle → org plan tier sync
- [ ] **Phase D** — Checkout + Customer Portal APIs + billing settings page
  - [ ] Stripe subscription scheduling/reconciliation for confirmed downgrade and cancellation intents
  - [ ] Trial lifecycle reminders/checkpoints for League 30-day and Club 90-day onboarding windows
- [ ] **Phase E** — Per-team billing: quantity sync, billing preview modal, program year hook
- [ ] **Phase F** — Upsell gate component + plan selection → Checkout flow
- [ ] **Phase G** — Production cutover: prod Stripe setup, Amplify env vars, smoke test

### 5. Email Strategy

- [ ] **Email Strategy Investigation**:
    - [ ] Investigate best-of-breed providers (Resend, Postmark, AWS SES) for system notifications
    - [ ] Define the architecture for a "Contact Us" inquiry system

---

## 🧭 Deferred Enhancements (Confirmed scope, build later)

- [ ] **House League — Coach Draft Room** — Shareable per-team link (no login required) that lets coaches participate in the draft live. Each team gets a token-scoped URL; coaches see the current pick state and submit their pick when it's their turn. Requires: real-time state sync (polling or WebSocket), a `draftTokens` map in `draft_state`, and a public-facing draft room page. See conversation context from Phase 5G planning. **Architecture note:** Phase 5G is designed to not block this — draft business logic is kept auth-layer-agnostic so a token path can be added to `/draft/route.ts` without restructuring the state machine.
- [ ] **House League — Practice Scheduling** — Allow league admins to schedule practices for individual teams alongside the game schedule. A practice belongs to one team (not two), has no score, and does not affect standings. Confirmed scope post-Phase 5H. Build as an extension of the schedule page: separate "Practices" tab or filter, same date/time/location fields, team selector instead of home/away. No schema migration needed — can reuse `league_games` with `away_team_id = null` and a `game_type` column, or use a separate `league_practices` table (decide at build time).
- [ ] **Calendar Sync for Team Schedules** — Allow parents/coaches to export a team's game schedule as an `.ics` file or subscribe via a calendar URL (Google/Apple Calendar). Technically straightforward (generate `.ics` from schedule query). Applies to both house league team schedules and rep team schedules in the coaches portal. Build during a parent-facing polish pass.
- [ ] **Bulk Operations for Admins** — Bulk-change registration statuses, bulk-assign teams, bulk-edit schedule slots. High value for orgs with 100+ registrations. Requires multi-select UI, confirmation flows, and async batch API routes. Revisit after Phase 3 UX ships and an org is operating at scale.
- [ ] **Custom domain investigation** — Research feasibility and effort of allowing orgs to point a custom domain (e.g. miltonbats.com) to their FieldLogicHQ public page. Covers: DNS verification flow, wildcard SSL or per-org cert provisioning, reverse proxy / Amplify routing changes, and potential upsell pricing. Do not design or implement until `module_public_site` is fully shipped.
- [ ] **Public Site Offering Evaluation** — After the first external org enables `module_public_site`, review the offering across three dimensions: (1) ease of setup — is the path from enabling the module to a live page clear enough for a non-technical org owner? (2) customization level — structured fields are correct; assess whether anything is missing without going full CMS; (3) base UX improvements. Produce a prioritized fix list before moving to the next module.

---

## ✅ Completed Projects

### Slot-First Roster & Schedule Architecture
*(Archived — all 7 phases complete. See [docs/archive/SLOT_ROSTER_PLAN.md](docs/archive/SLOT_ROSTER_PLAN.md))*
- [x] Foundation–Phase 7: pool slots as division roster, atomic slot claiming (PG fn), slot board + waitlist registrations page, publish control per division, public schedule visibility, cleanup

### Accounting Enhancements — Org & Rep Team Budget Planning
*(Archived — all phases complete. See [docs/archive/ACCOUNTING_ENHANCEMENTS_PLAN.md](docs/archive/ACCOUNTING_ENHANCEMENTS_PLAN.md))*

### Public Tournament UAT
- [x] Default tournament/public-site customization to FieldLogicHQ colors and remove preview-only setup CTA
- [x] Apply light/dark theme in tournament preview, group theme controls, and add public-style preview nav pages
- [x] Fix light-mode public tournament hero surfaces so text and icons remain visible
- [x] Tune public tournament palette contrast and add combined dark/light theme preview samples
- [x] Public tournament light-mode polish — solid public CTAs, readable light-mode accents, restored Battle Purple preset
- [x] Public tournament preview light-mode section backgrounds inherit the selected mode below the hero
- [x] Tournament branding palettes — normalize presets for dark/light readability and gate custom colors to Tournament Plus+
- [x] Public tournament light-mode accent tokens use readable primary text on pale surfaces
- [x] Public tournament page visibility controls for hiding News, Schedule, Standings, Teams, Rules, or Registration
- [x] Tournament branding settings reorder included controls above Tournament Plus advanced customizations
- [x] Tournament branding logo placeholder polish and branding API 500 cleanup

### In-App Documentation & Help System
*(see [HELP_SYSTEM_PLAN.md](docs/archive/HELP_SYSTEM_PLAN.md))*
- [x] **Phases A–I complete** — foundation + Tournaments + House League + Rep Teams + Coaches Portal + Accounting + Org Admin & Onboarding + Platform Admin contextual cues (H) + Help Hub & context-aware navigation (I)

### Pricing
- [x] **Phase 1** — Update plan-config (4 tiers), rewrite PricingSection component, build public `/pricing` page. Full plan in [PRICING_IMPLEMENTATION_PLAN.md](docs/archive/PRICING_IMPLEMENTATION_PLAN.md). Content spec in [PRICING_PAGE_COPY.md](docs/archive/PRICING_PAGE_COPY.md).
- [x] **Phase 2 / Functionality Audit** — Billing page rewritten (monthly/annual toggle, modules section, outcome-focused upgrade cards); onboarding checklist updated with conditional module steps; all stale plan name references removed.

### Tournament Admin URL Restructure
*(see [TOURNAMENT_URL_RESTRUCTURE_PLAN.md](docs/archive/TOURNAMENT_URL_RESTRUCTURE_PLAN.md))*
- [x] Moved all tournament operational pages from `admin/{page}` to `admin/tournaments/{page}` — matches module URL pattern used by house-league, rep-teams, and accounting

### Role-Based UX Improvement Review — Phases 1–5
*(see [UX_REVIEW_PLAN.md](docs/archive/UX_REVIEW_PLAN.md))*

**Phase 1 — Critical bugs & multi-tenancy**
- [x] **1A** — Replace default `/{orgSlug}` page: FieldLogicHQ-branded placeholder (no public site), tournament selector for 2+ active tournaments
- [x] **1B** — Fix accounting sidebar: rename "Overview" → "Ledgers", remove broken "Org Ledger" duplicate
- [x] **1C** — Remove House League "Notifications" sidebar link (currently resolves to a 404)
- [x] **1D** — Fix staff auto-redirect: change target from `/admin/tournaments` to `/admin/dashboard`

**Phase 2 — Coaches portal gaps**
- [x] **2A** — Build `CoachesBottomNav` for mobile navigation in the coaches portal
- [x] **2B** — Improve "Not assigned" screen: add org contact email and "Back to [org]" link
- [x] **2C** — Add unconfigured-state message to coaches accounting page when no dues/expenses exist
- [x] **2D** — Show program year name alongside team name in coaches sidebar team list

**Phase 3 — Owner & operator improvements**
- [x] **3A** — Expand onboarding checklist: add conditional steps for enabled modules (house league, rep teams, public site)
- [x] **3B** — Add "Modules" section to billing page: per-module plan inclusion, active status, and upgrade CTA
- [x] **3C** — Create `/admin/org` hub page (Members, Diamonds, Tournament Records, Billing, Settings tiles); update admin hub tile href
- [x] **3D** — Add inline status-transition buttons to house league season cards
- [x] **3E** — Build House League Notifications page at `/admin/house-league/seasons/[seasonId]/notifications` (email preview + sent history log); re-add Notifications sidebar link
- [x] **3F** — Season detail index page: sidebar sub-nav renders correctly on the index page; original issue no longer exists
- [x] **3G** — Add cross-module "Needs attention" strip to admin hub (pending registrations, open tryouts)

**Phase 4 — Platform admin & treasurer**
- [x] **4A** — Add health indicators to platform admin overview: `past_due` org count, new signups in 7 days
- [x] **4B** — Add org/date-range filter and pagination to platform audit log (200-row hard cap, no search)
- [x] **4C** — Add active-route highlighting to platform admin sidebar nav
- [x] **4D** — Add "Go to Admin →" link in platform admin org rows and detail page (label standardised to "↗ Admin")
- [x] **4E** — Allow treasurers (not just owners) to create tournament ledgers; expanded Add Entry / Add Transfer / Edit / Void gates to treasurer too
- [x] **4F** — Skipped: platform users list is internal staff only (no cap issue); org users found via org → users drill-down
- [x] **4G** — Treasurer: add CSV export to ledger detail page
- [x] **4H** — Treasurer: category `<datalist>` now fetches distinct categories from this org's ledger entries; falls back to static defaults for new orgs

**Phase 5 — Public experience & polish**
- [x] **5A** — Add rep teams tryout section to org home page when module enabled and tryouts open
- [x] **5B** — Add house league CTA to default `/{orgSlug}` branch when module enabled and registration open
- [x] **5C** — Improve tryout registration closed page: show org contact email (open-date field deferred — column does not exist in schema)
- [x] **5D** — Add "Contact Us" label to contact email link on public site page
- [x] **5E** — Add pending-action badges to coaches team hub cards (overdue installments, upcoming events in 7 days)
- [x] **5F** — Audit and standardise empty/loading states app-wide (coaches portal: loadingState CSS, emptyStateTitle/Sub)
- [x] **5G** — Add season switcher dropdown to House League sidebar when inside a season (client-side fetch pattern)
- [x] **5H** — Official/Scorekeeper score entry: type="number", 56px input height, 48px button height, filter selects 44px
- [x] **5I** — House league public registration form: clear capacity labels + status lookup page at `/{orgSlug}/league/{seasonSlug}/status`

### Platform Admin — Superuser Tooling
*(see [PLATFORM_ADMIN_IMPROVEMENTS_PLAN.md](docs/archive/PLATFORM_ADMIN_IMPROVEMENTS_PLAN.md))*
- [x] **Phase A** — `enabled_addons` toggle UI + direct admin link
- [x] **Phase B** — Users page org context enrichment
- [x] **Phase C** — Org notes column + drill-down detail page
- [x] **Phase D** — `org_overrides` table: subscription status override + comp/billing grace period
- [x] **Phase E1+E2** — Platform audit log table + write helper
- [x] **Phase E3** — Audit log read page at `/platform-admin/audit`
- [x] **Phase F** — Org search/filter + users pagination
- [x] Platform company users — DB-managed platform admin access (`platform_users` table, invite/deactivate/remove UI)

### Platform Roadmap — Add-On Modules
*(see [PLATFORM_ROADMAP.md](PLATFORM_ROADMAP.md))*
- [x] **Phase 1** — Archives B2: back-to-admin link on public archive detail pages
- [x] **Phase 2** — Plan entitlements architecture: `moduleEntitlements` in PlanConfig, `enabled_addons` migration, `hasModuleEntitlement()` helper
- [x] **Phase 3** — `module_public_site` (see [docs/archive/PUBLIC_SITE_MODULE_PLAN.md](docs/archive/PUBLIC_SITE_MODULE_PLAN.md))
- [x] **Phase 4** — `module_accounting` (see [ACCOUNTING_MODULE_PLAN.md](docs/archive/ACCOUNTING_MODULE_PLAN.md))
- [x] **Phase 5** — `module_house_league` — All phases 5A–5M complete (see [HOUSE_LEAGUE_MODULE_PLAN.md](docs/archive/HOUSE_LEAGUE_MODULE_PLAN.md))
- [x] **Phase 6** — `module_rep_teams` — All phases 6A–6N complete (see [REP_TEAMS_MODULE_PLAN.md](REP_TEAMS_MODULE_PLAN.md))
  - [x] 6A — DB schema: Migration 021 + Supabase Storage bucket setup
  - [x] 6B — TypeScript types + DB helpers
  - [x] 6C — Coach role expansion + module shell
  - [x] 6D — Team + program year management (admin API + pages)
  - [x] 6E — Public tryout registration form
  - [x] 6F — Tryout approval queue (admin): offer → accept/decline flow + status emails
  - [x] 6G — Roster management (coaches portal; franchise model)
  - [x] 6H — Player documents (Supabase Storage: upload API, signed URLs, template management)
  - [x] 6I — Coaches portal foundation (layout, auth guard, sidebar, context, dashboard)
  - [x] 6J — Coaches portal: unified team calendar (6 event types + recurrence)
  - [x] 6K — Accounting: org cost allocation + team payment schedules
  - [x] 6L — Accounting: coach-managed team budget (dues, expenses, tournament payables)
  - [x] 6M — Accounting: automated payment reminder emails (coach-initiated)
  - [x] 6N — Past program years (admin history + coaches portal history, read-only)
  - [x] Franchise model audit — 9 violations fixed across admin/coaches layers

### Infrastructure — Dev Environment
*(see [AMPLIFY_DEV_ENV_PLAN.md](docs/archive/AMPLIFY_DEV_ENV_PLAN.md))*
- [x] AWS Amplify Hosting Strategy — branch-based deployment, `dev.fieldlogichq.ca`, per-branch env var scoping
- [x] Live Dev Environment — AWS Amplify `dev` branch live
- [x] RESEND_API_KEY added to Amplify environment variables
- [x] NEXT_PUBLIC_APP_URL added to Amplify environment variables
- [x] Signup DB hardening - `025_service_role_api_grants.sql` applied in dev and production; secret-key prefix logging removed locally
- [x] Platform admin/dev tools hardening - bootstrap admin preservation, DB-aware platform access, and auth-gated seed/wipe APIs
- [x] Local Supabase safety guard - localhost refuses the known production Supabase project and signup key-prefix logging is removed

### Auth & Membership Constraints
- [x] One-user-one-org enforcement — delete auth user on member removal; cross-org invite guard (see [docs/archive/ONE_ORG_CONSTRAINT_PLAN.md](docs/archive/ONE_ORG_CONSTRAINT_PLAN.md))

### Code Quality
- [x] Fix 9 implicit `any` parameters in `lib/db.ts` row-mapper callbacks

### Tournament Landing Page Polish
- [x] Hero title now dynamic from `tournament.name`; remaining registration CTA polish deferred

### Platform Improvements — Phases 1–3
*(see [PLATFORM_IMPROVEMENTS_PLAN.md](docs/archive/PLATFORM_IMPROVEMENTS_PLAN.md))*
- [x] Forgot password / password reset flow
- [x] Invite and re-invite flow with PKCE, display names, existing-user notifications
- [x] Member suspension (status column, suspend/reinstate API + UI)
- [x] Officials seat exclusion + 80% upgrade nudge
- [x] Onboarding flow (3-step checklist, redirect, skip logic)
- [x] Audit log (`org_audit_log` table, read-only view)
- [x] Display names (column, members list, invite acceptance)
- [x] Org offboarding — "Request Account Deletion" form

### Module-Level Capabilities — Phase A
*(see [MODULE_CAPABILITIES_PLAN.md](docs/archive/MODULE_CAPABILITIES_PLAN.md))*
- [x] 7 module caps in `Capability` type, `ROLE_DEFAULTS` updated
- [x] `userCapabilities` in OrgContext
- [x] Grouped module/action sections in capability override UI

### Tournament Lifecycle Cleanup
*(see [TOURNAMENT_LIFECYCLE_PLAN.md](docs/archive/TOURNAMENT_LIFECYCLE_PLAN.md))*
- [x] All status transitions freely selectable via dropdown
- [x] Seal button gated to completed status only (UI + server guard)
- [x] Archived tournaments hidden from admin switcher
- [x] Admin archives page: two-section layout, seal flow, "Past Tournaments" sidebar label

### Tournament Redesign — Phases 1–5
*(see [TOURNAMENT_REDESIGN_PLAN.md](TOURNAMENT_REDESIGN_PLAN.md))*
- [x] DB schema: `status` + `slug` columns, partial unique index
- [x] TypeScript: Tournament type, `mapTournament`, `getTournamentBySlug`
- [x] Admin UI: status transitions, slug field, active-limit enforcement
- [x] Billing: usage meter counts non-archived tournament slots, plan-config `tournamentLimit`
- [x] URL restructuring: `/[orgSlug]/[tournamentSlug]/` route tree, redirects, OrgNavContext, Navbar updates

### Multi-Tenancy — Phases 3, 4, 6
*(see [MULTI_TENANT_ARCHITECTURE.md](MULTI_TENANT_ARCHITECTURE.md))*
- [x] Phase 3: Multi-Org Routing — pages moved under `/[orgSlug]`
- [x] Phase 4: Discovery Portal & Search (`/discover`)
- [x] Phase 6: Org Admin UX & Seat Management

### Admin Design & Architecture
*(see [ADMIN_HUB_NAVIGATION_PLAN.md](docs/archive/ADMIN_HUB_NAVIGATION_PLAN.md))*
- [x] Admin Hub Navigation — hub tile grid, section-aware sidebar, smart tournament redirect
- [x] Sidebar restructure — Tournament / Organization sections, labeled nav groups
- [x] Admin theme cleanup — HUD tokens, Option B palette separation
- [x] Member roles Phase 0 — API capability gates, score finalization enforcement
- [x] Member roles Phase 1 — `capabilities` column, tournament assignments, `getAuthContextWithScope()`
- [x] Member roles Phase 2 — RLS activation, `authClient()` mutations

### Admin UX & Documentation
- [x] In-app role/permissions documentation — Role Guide panel, permission matrix, invite modal hints
- [x] Admin help gaps — Billing status alerts, slug-change warning, Randomize copy, Results legend
- [x] Walkthrough polish — subscription upgrade cards match onboarding plan chooser styling
- [x] Walkthrough polish — remove ad hoc module upgrade section from Subscription
- [x] Subscription polish — upgrade comparison appears before muted downgrade/cancel controls
- [x] Walkthrough polish — remove tournament onboarding get-started flash after wizard save
- [x] Walkthrough polish — replace tournament admin Back to Site with admin-only Preview Site
- [x] Walkthrough bugfix — admin tournament preview resolves draft tournaments without 404
- [x] Tournament branding UX — collapse dark/light choices into one toggle with a single live preview

### Platform Administration (Super Admin)
*(see [PLATFORM_ADMIN_PLAN.md](PLATFORM_ADMIN_PLAN.md))*
- [x] Site Admin Dashboard — email-allowlist auth guard, org plan override, user password reset, global stats

### Other
- [x] Brand Pivot — sports-authority copy across landing page, auth pages, navbar
- [x] Age Group Preference Persistence — cookie-based tab persistence
- [x] Schedule/Results Revamp — inline scores, team filter, bracket view, `/standings` page
- [x] Stock Logo Library — curated sport icon set, plan-tiered access
