# Project TODO List

This file tracks the ongoing tasks for the tournament website project. AI models and the USER use this to coordinate work.

---

## 🚀 Active Tasks (Priority Order)

### 1. Platform Roadmap — Add-On Modules
*Authoritative plan in [PLATFORM_ROADMAP.md](PLATFORM_ROADMAP.md)*

- [x] **Phase 1** — Archives B2: back-to-admin link on public archive detail pages
- [x] **Phase 2** — Plan entitlements architecture: `moduleEntitlements` in PlanConfig, `enabled_addons` migration, `hasModuleEntitlement()` helper
- [x] **Phase 3** — `module_public_site` (see [docs/archive/PUBLIC_SITE_MODULE_PLAN.md](docs/archive/PUBLIC_SITE_MODULE_PLAN.md))
- [ ] **Phase 4** — `module_accounting` (requires plan file first)
- [ ] **Phase 5** — `module_house_league` (requires plan file first)
- [ ] **Phase 6** — `module_rep_teams` (requires plan file first)

### 2. Future Product Modules (detail)
*Recommended build order: Accounting → House League → Rep Teams. Each requires its own detailed plan file before implementation begins.*

- [x] **Public Website Module (`module_public_site`)** — Shipped. (see [docs/archive/PUBLIC_SITE_MODULE_PLAN.md](docs/archive/PUBLIC_SITE_MODULE_PLAN.md))
- [ ] **Accounting Module (`module_accounting`)** — The org's own financial management: income/expense tracking, invoicing teams for fees, registration payment reconciliation. Requires plan file.
- [ ] **House League Module (`module_house_league`)** — Season-long recreational league management: player registration, waitlists, team placement, scheduling, standings. Requires plan file.
- [ ] **Rep Team Module (`module_rep_teams`)** — Competitive team program management: coaches portal, rosters, tryout management, player documents, accounting integration. Requires plan file.

### 3. Tournament Landing Page Polish
*One outstanding item from the completed Tournament Redesign project*

- [ ] **Tournament Landing Page Review** — Polish `app/[orgSlug]/[tournamentSlug]/page.tsx`: make hero title dynamic from `org.name` (replace hardcoded "BATTLE OF THE BATS"), review copy/layout for multi-tenant correctness, consider adding a registration CTA when registration is open

### 4. Multi-Tenancy — Billing & Subscriptions
*Detailed tasks in [MULTI_TENANT_ARCHITECTURE.md](MULTI_TENANT_ARCHITECTURE.md)*

- [ ] **Phase 5** — Billing & Subscriptions: Stripe account setup and testing remaining

### 5. Infrastructure — Dev Environment
- [ ] **AWS Amplify Hosting Strategy**:
    - [ ] Research proper hosting for parallel Dev and Production environments on AWS Amplify
    - [ ] Evaluate URL options: subdomain (`dev.fieldlogichq.ca`) vs. separate domain
    - [ ] Document branch-specific Stripe key configuration (Test for dev, Live for prod)
- [ ] **Live Dev Environment** — Create the live development environment on AWS Amplify `dev` branch once research above is finalized

### 6. Email Strategy
- [ ] **Email Strategy Investigation**:
    - [ ] Investigate best-of-breed providers (Resend, Postmark, AWS SES) for system notifications
    - [ ] Define the architecture for a "Contact Us" inquiry system

### 7. Auth & Membership Constraints
- [ ] **One-user-one-org enforcement** — Delete auth user on member removal; cross-org invite guard (see [ONE_ORG_CONSTRAINT_PLAN.md](ONE_ORG_CONSTRAINT_PLAN.md))

---

## 🧭 Strategy (Post-Roadmap)

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
