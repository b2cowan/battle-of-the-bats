# Project TODO List

This file tracks the ongoing tasks for the tournament website project. AI models and the USER use this to coordinate work.

---

## 🚀 Active Tasks (Priority Order)

### 1. Platform Admin — Superuser Tooling
*Authoritative plan in [PLATFORM_ADMIN_IMPROVEMENTS_PLAN.md](PLATFORM_ADMIN_IMPROVEMENTS_PLAN.md)*

- [x] **Phase A** — `enabled_addons` toggle UI + direct admin link (unblocks `module_public_site` production enablement)
- [x] **Phase B** — Users page org context enrichment (no migration)
- [x] **Phase E1+E2** — Platform audit log table + write helper (bundle with Phase A so all new routes log from day one)
- [x] **Phase C** — Org notes column + drill-down detail page
- [x] **Phase D** — `org_overrides` table: subscription status override + comp/billing grace period
- [x] **Phase E3** — Audit log read page at `/platform-admin/audit`
- [x] **Phase F** — Org search/filter + users pagination

### 2. Platform Roadmap — Add-On Modules
*Authoritative plan in [PLATFORM_ROADMAP.md](PLATFORM_ROADMAP.md)*

- [x] **Phase 1** — Archives B2: back-to-admin link on public archive detail pages
- [x] **Phase 2** — Plan entitlements architecture: `moduleEntitlements` in PlanConfig, `enabled_addons` migration, `hasModuleEntitlement()` helper
- [x] **Phase 3** — `module_public_site` (see [docs/archive/PUBLIC_SITE_MODULE_PLAN.md](docs/archive/PUBLIC_SITE_MODULE_PLAN.md))
- [x] **Phase 4** — `module_accounting` (see [ACCOUNTING_MODULE_PLAN.md](ACCOUNTING_MODULE_PLAN.md))
- [x] **Phase 5** — `module_house_league` (see [HOUSE_LEAGUE_MODULE_PLAN.md](HOUSE_LEAGUE_MODULE_PLAN.md)) — All phases 5A–5M complete: migration, roles, types/helpers, module shell, season/division management, public registration form, registration admin, team placement + draft, scheduling, standings, scoped email dispatch, accounting integration, past seasons pages, practice scheduling with recurrence.
- [ ] **Phase 6** — `module_rep_teams` (see [REP_TEAMS_MODULE_PLAN.md](REP_TEAMS_MODULE_PLAN.md))
  - [x] **6A** — DB schema: Migration 021 + Supabase Storage bucket setup
  - [x] **6B** — TypeScript types + DB helpers
  - [x] **6C** — C2 coach role expansion + module shell (5 layers: route gate, page guard, sidebar, hub tile, layout)
  - [x] **6D** — Team + program year management (admin API + pages)
  - [x] **6E** — Public tryout registration form (C5 pattern: public form, API, confirmation emails)
  - [x] **6F** — Tryout approval queue (admin): offer → accept/decline flow + status emails
  - [x] **6G** — Roster management (coaches portal: foundation + roster list + player detail; franchise model — coaches are primary operators)
  - [x] **6H** — Player documents (C4 Supabase Storage: upload API, signed URLs, template management)
  - [x] **6I** — Coaches portal foundation (pulled into 6G: layout, auth guard, sidebar, context, dashboard, team overview)
  - [x] **6J** — Coaches portal: unified team calendar (6 event types + Phase 5M practice recurrence)
  - [x] **6K** — Accounting: org cost allocation + team payment schedules + org real-time view
  - [ ] **6L** — Accounting: coach-managed team budget (player dues, expenses, tournament payables)
  - [ ] **6M** — Accounting: automated payment reminder emails with paid-status awareness
  - [ ] **6N** — Past program years (admin history + coaches portal history, read-only)
  - [ ] **Module gating test** — 5-layer verification + coach role team-scope test

### 2. Future Product Modules (detail)
*Recommended build order: Accounting → House League → Rep Teams. Each requires its own detailed plan file before implementation begins.*

- [x] **Public Website Module (`module_public_site`)** — Shipped. (see [docs/archive/PUBLIC_SITE_MODULE_PLAN.md](docs/archive/PUBLIC_SITE_MODULE_PLAN.md))
- [x] **Accounting Module (`module_accounting`)** — The org's own financial management: income/expense tracking, tournament ledgers, inter-ledger transfers. Plan: [ACCOUNTING_MODULE_PLAN.md](ACCOUNTING_MODULE_PLAN.md).
- [x] **House League Module (`module_house_league`)** — Season-long recreational league management: player registration, waitlists, team placement + draft, scheduling, standings, scoped email dispatch, accounting integration, past seasons, practice scheduling. Plan: [HOUSE_LEAGUE_MODULE_PLAN.md](HOUSE_LEAGUE_MODULE_PLAN.md). All phases 5A–5M complete.
- [ ] **Rep Team Module (`module_rep_teams`)** — Competitive team program management: coaches portal, rosters, tryout management, player documents, three-tier accounting integration. Plan: [REP_TEAMS_MODULE_PLAN.md](REP_TEAMS_MODULE_PLAN.md).

### 3. Tournament Landing Page Polish
*One outstanding item from the completed Tournament Redesign project*

- [x] **Tournament Landing Page Review** — Hero title now dynamic from `tournament.name`; remaining polish (registration CTA) deferred

### 4. Multi-Tenancy — Billing & Subscriptions
*Detailed tasks in [MULTI_TENANT_ARCHITECTURE.md](MULTI_TENANT_ARCHITECTURE.md)*

- [ ] **Phase 5** — Billing & Subscriptions: Stripe account setup and testing remaining

### 5. Code Quality — Pre-existing TypeScript Errors in `lib/db.ts`

- [x] **Fix 9 implicit `any` parameters in row-mapper callbacks** — `getDiamonds`, `getContacts`, `getAgeGroups`, `getPools`, `getTeams`, `getGames`, `getAnnouncements`, `getRules`, `getResources` (each `.map()` callback param needs `: any`). Also remove unused `fileExt` var and unused `data` destructure in `uploadResourceFile`. All pre-existing; discovered during accounting module work. One small commit, no behaviour change.

### 6. Infrastructure — Dev Environment
- [x] **AWS Amplify Hosting Strategy** — Branch-based deployment, `dev.fieldlogichq.ca`, per-branch env var scoping (see [AMPLIFY_DEV_ENV_PLAN.md](AMPLIFY_DEV_ENV_PLAN.md))
- [ ] **Live Dev Environment** — Create the live development environment on AWS Amplify `dev` branch (follow checklist in [AMPLIFY_DEV_ENV_PLAN.md](AMPLIFY_DEV_ENV_PLAN.md))

### 6. Email Strategy
- [ ] **Email Strategy Investigation**:
    - [ ] Investigate best-of-breed providers (Resend, Postmark, AWS SES) for system notifications
    - [ ] Define the architecture for a "Contact Us" inquiry system

### 7. Auth & Membership Constraints
- [ ] **One-user-one-org enforcement** — Delete auth user on member removal; cross-org invite guard (see [ONE_ORG_CONSTRAINT_PLAN.md](ONE_ORG_CONSTRAINT_PLAN.md))

---

## 🧭 Deferred Enhancements (Confirmed scope, build later)

- [ ] **House League — Coach Draft Room** — Shareable per-team link (no login required) that lets coaches participate in the draft live. Each team gets a token-scoped URL; coaches see the current pick state and submit their pick when it's their turn. Requires: real-time state sync (polling or WebSocket), a `draftTokens` map in `draft_state`, and a public-facing draft room page. See conversation context from Phase 5G planning. **Architecture note:** Phase 5G is designed to not block this — draft business logic is kept auth-layer-agnostic so a token path can be added to `/draft/route.ts` without restructuring the state machine.
- [ ] **House League — Practice Scheduling** — Allow league admins to schedule practices for individual teams alongside the game schedule. A practice belongs to one team (not two), has no score, and does not affect standings. Confirmed scope post-Phase 5H. Build as an extension of the schedule page: separate "Practices" tab or filter, same date/time/location fields, team selector instead of home/away. No schema migration needed — can reuse `league_games` with `away_team_id = null` and a `game_type` column, or use a separate `league_practices` table (decide at build time).

---

## 🧭 Strategy (Post-Roadmap)

- [ ] **In-App Documentation & Help System** — Research all sections and user roles across the platform and design a documentation layer that surfaces help without cluttering pages. Two tiers: (1) **Contextual in-app cues** — empty-state guidance, tooltip hints, section intros, and inline explainers placed at natural decision points (e.g. "What is a program year?", "When should I mark a season Active?"); (2) **Help pages** — role-scoped walkthroughs for first-time users covering real-world workflows such as: coach setting up a rep team for the season, house league admin building teams and running a draft, treasurer handling common accounting scenarios (entry categories, transfers, reconciling tournament income), org owner onboarding a new season from scratch. Research should audit every module (tournaments, house league, rep teams, accounting, public site, org admin) and every role (owner, admin, treasurer, league_admin, league_registrar, coach, official) before any writing or implementation begins. Do not start until all Platform Roadmap modules are complete.

- [ ] **Role-Based UX Improvement Review** — *(Deferred until House League module is complete)* Execute the UX Improvement Test Plan (`UX_IMPROVEMENT_TEST_PLAN.md`) to evaluate the platform from the perspective of all user roles (owner, admin, treasurer, coach, parent, etc.) and identify friction points for future polish.
- [ ] **Pricing & Branding Strategy Review** — Once all Platform Roadmap modules are shipped (Public Site, Accounting, House League, Rep Teams), conduct a full evaluation of: plan tier pricing in light of new module value, add-on pricing model (flat monthly vs. bundled tiers — see D-M1/D-M2 in [PLATFORM_ROADMAP.md](PLATFORM_ROADMAP.md)), whether any reserved modules should be promoted to core, and whether the Starter/Pro/Elite brand naming still fits the expanded product surface. Do not revisit pricing decisions before the roadmap is complete — functionality defines value before pricing follows.
- [ ] **Custom domain investigation** — Research feasibility and effort of allowing orgs to point a custom domain (e.g. miltonbats.com) to their FieldLogicHQ public page. Covers: DNS verification flow, wildcard SSL or per-org cert provisioning, reverse proxy / Amplify routing changes, and potential upsell pricing. Do not design or implement until `module_public_site` is fully shipped.
- [ ] **Public Site Offering Evaluation** — After the first external org enables `module_public_site`, review the offering across three dimensions: (1) ease of setup — is the path from enabling the module to a live page clear enough for a non-technical org owner? (2) customization level — structured fields are correct; assess whether anything is missing without going full CMS; (3) base UX improvements — e.g., contact email is shown on the public page with no surrounding context (needs a label like "Contact Us"), tournament cards need review, social link presentation. Produce a prioritized fix list before moving to the next module.

---

## ✅ Completed Projects

### Platform Roadmap — Foundation (Phases 1–2)
- [x] Plan entitlements architecture (`moduleEntitlements`, `enabled_addons`, `hasModuleEntitlement()`)
- [x] Archives B2: back-to-admin link on public archive pages

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
*(see [TOURNAMENT_LIFECYCLE_PLAN.md](TOURNAMENT_LIFECYCLE_PLAN.md))*
- [x] All status transitions freely selectable via dropdown
- [x] Seal button gated to completed status only (UI + server guard)
- [x] Archived tournaments hidden from admin switcher
- [x] Admin archives page: two-section layout, seal flow, "Past Tournaments" sidebar label

### Tournament Redesign — Phases 1–5
*(see [TOURNAMENT_REDESIGN_PLAN.md](TOURNAMENT_REDESIGN_PLAN.md))*
- [x] DB schema: `status` + `slug` columns, partial unique index
- [x] TypeScript: Tournament type, `mapTournament`, `getTournamentBySlug`
- [x] Admin UI: status transitions, slug field, active-limit enforcement
- [x] Billing: usage meter counts active-only, plan-config `tournamentLimit`
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

### Platform Administration (Super Admin)
*(see [PLATFORM_ADMIN_PLAN.md](PLATFORM_ADMIN_PLAN.md))*
- [x] Site Admin Dashboard — email-allowlist auth guard, org plan override, user password reset, global stats

### Infrastructure
- [x] RESEND_API_KEY added to Amplify environment variables
- [x] NEXT_PUBLIC_APP_URL added to Amplify environment variables (`https://www.fieldlogichq.ca`)

### Other
- [x] Brand Pivot — sports-authority copy across landing page, auth pages, navbar
- [x] Age Group Preference Persistence — cookie-based tab persistence
- [x] Schedule/Results Revamp — inline scores, team filter, bracket view, `/standings` page
- [x] Stock Logo Library — curated sport icon set, plan-tiered access
