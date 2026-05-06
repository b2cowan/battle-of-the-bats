# Project TODO List

This file tracks the ongoing tasks for the tournament website project. AI models and the USER use this to coordinate work.

## 🚀 Active Tasks

- [ ] **Platform Improvements — Phase 1** — Forgot password, officials seat exclusion, invite branding fix, re-invite, existing-user notification email (see [PLATFORM_IMPROVEMENTS_PLAN.md](PLATFORM_IMPROVEMENTS_PLAN.md))
- [ ] **Platform Improvements — Phase 2** — Member suspension state, officials overview page, seat meter on billing, 80% upgrade nudge (see [PLATFORM_IMPROVEMENTS_PLAN.md](PLATFORM_IMPROVEMENTS_PLAN.md))
- [ ] **Platform Improvements — Phase 3+** — Module-level capabilities, onboarding flow, audit log, display names, ownership transfer (see [PLATFORM_IMPROVEMENTS_PLAN.md](PLATFORM_IMPROVEMENTS_PLAN.md); several items gated on business decisions)

- [ ] **Add RESEND_API_KEY to Amplify environment variables** (AWS console → App settings → Environment variables) — required for invite emails to work in production.
- [ ] **Add NEXT_PUBLIC_APP_URL to Amplify environment variables** — set to production domain (e.g. `https://fieldlogichq.ca`); used for invite email redirect and Resend `from` address.
- [ ] **Email Strategy Investigation**: 
    - [ ] Investigate best-of-breed providers (Resend, Postmark, AWS SES) for system notifications.
    - [ ] Define the architecture for a "Contact Us" inquiry system.
- [ ] **AWS Amplify Hosting Strategy**:
    - [ ] Research proper hosting for parallel Dev and Production environments on AWS Amplify.
    - [ ] Evaluate URL options: using a subdomain (e.g., `dev.fieldlogichq.ca`) vs. a separate domain.
    - [ ] Document the process for pointing the Dev environment to Stripe Test products/keys and the Prod environment to Stripe Live products/keys (branch-specific environment variables).
- [ ] **Live Dev Environment**: Create the live development environment on AWS (likely via AWS Amplify `dev` branch) once the research above is finalized.


---

## 🔄 Tournament Lifecycle Cleanup
*Detailed plan in [TOURNAMENT_LIFECYCLE_PLAN.md](TOURNAMENT_LIFECYCLE_PLAN.md)*

- [x] **Item 1** — All status transitions (draft/live/completed) freely selectable via dropdown
- [x] **Item 2** — Seal button gated to completed status only (UI + server guard)
- [x] **Item 3** — Archived tournaments hidden from admin switcher and context
- [ ] **Item 4** — Admin archives page, sidebar wiring, and public ledger improvements (see [ARCHIVES_EXPANSION_PLAN.md](ARCHIVES_EXPANSION_PLAN.md))

---

## 🏗️ Tournament Redesign
*Detailed plan in [TOURNAMENT_REDESIGN_PLAN.md](TOURNAMENT_REDESIGN_PLAN.md)*

- [x] **Phase 1** — DB schema: add `status` + `slug` columns to `tournaments`, partial unique index
- [x] **Phase 2** — TypeScript: update `Tournament` type, `mapTournament`, fix multi-tenant `is_active` bug, add `getTournamentBySlug`
- [x] **Phase 3** — Admin UI: status transitions (Draft/Active/Completed/Archived), slug field, active-limit enforcement in API
- [x] **Phase 4** — Billing: usage meter counts active-only; update plan-config `tournamentLimit` semantics and Pro limit
- [x] **Phase 5** — URL restructuring: `/[orgSlug]/[tournamentSlug]/` route tree, redirect wrappers for flat URLs, OrgNavContext + TournamentNavSync, Navbar updates, YearSelector → URL-based navigation
- [ ] **Tournament Landing Page Review** — Polish `app/[orgSlug]/[tournamentSlug]/page.tsx`: make hero title dynamic from `org.name` (replace hardcoded "BATTLE OF THE BATS"), review copy/layout for multi-tenant correctness, consider adding a registration CTA when registration is open

---

## ⏳ Multi-Tenancy Backlog
*Detailed tasks located in [MULTI_TENANT_ARCHITECTURE.md](file:///c:/Users/Robert%20Cowan/Documents/tournament-website/MULTI_TENANT_ARCHITECTURE.md)*

- [x] **Phase 3**: Multi-Org Routing & Page Migration (Moving pages under `/[orgSlug]`)
- [x] **Phase 4**: Discovery Portal & Search
- [ ] **Phase 5**: Billing & Subscriptions (Stripe account setup and testing remaining)
- [x] **Phase 6**: Org Admin UX & Seat Management

---

---

## 🏆 Team & Season Management
**Goal:** Allow organizations to manage their teams outside of tournament contexts — rosters, seasons, and ongoing records across the full year.

- [ ] **Team Management MVP** — Design and implement a team management feature allowing orgs to create, edit, and archive teams independently of any tournament (see plan file TBD)

---

## 🔒 Auth & Membership Constraints

- [ ] **One-user-one-org enforcement** — Delete auth user on member removal; cross-org invite guard (see [ONE_ORG_CONSTRAINT_PLAN.md](ONE_ORG_CONSTRAINT_PLAN.md))

---

## 🎛️ Admin Design & Architecture
*Detailed plan in [ADMIN_DESIGN_ARCHITECTURE_PLAN.md](ADMIN_DESIGN_ARCHITECTURE_PLAN.md)*

- [x] **Phase 1 — Sidebar restructure**: Split nav into labeled Tournament / Organization sections, Contacts in Tournament, Diamonds in Organization, fix hardcoded "Battle of the Bats" in sidebar logo
- [x] **Phase 2 — Admin theme cleanup**: Replace `--primary` token leakage in admin content page CSS with HUD tokens (blueprint-blue / logic-lime); complete Option B separation from org palette
- [x] **Member roles — Phase 0** — API capability gates, score finalization enforcement, official promotion unblocked (see [USER_ROLE_ARCHITECTURE.md](USER_ROLE_ARCHITECTURE.md))
- [x] **Member roles — Phase 1** — Migration 008: `capabilities` column + `org_member_tournament_assignments` table; `getAuthContextWithScope()` + `scopeGuard()`; tournament scoping on all CRUD routes; assignment UI on members page (see [USER_ROLE_ARCHITECTURE.md](USER_ROLE_ARCHITECTURE.md))
- [x] **Member roles — Phase 2** — RLS activation: `009_rls_policies.sql` with `can_access_tournament()` helper + all table policies; `lib/db.ts` mutations switched to `authClient()` (see [USER_ROLE_ARCHITECTURE.md](USER_ROLE_ARCHITECTURE.md))

---

## 📖 Admin UX & Documentation
- [x] **In-app role/permissions documentation** — Collapsible Role Guide panel on Members page with full permission matrix; role description hints in invite modal
- [x] **Admin help gaps — second pass** — Billing: Past Due / Canceled status alerts; Settings: expanded slug-change warning; Teams: improved Randomize copy with algorithm and re-run note; Results: Pending Review / Completed legend when finalization is enabled

---

## 🛠️ Platform Administration (Super Admin)
**Goal:** Create a secure, restricted area for platform-wide management.

- [x] **Site Admin Dashboard** — Email-allowlist auth guard, org plan override, user password reset, global stats (see [PLATFORM_ADMIN_PLAN.md](PLATFORM_ADMIN_PLAN.md))


## ✅ Completed Tasks

- [x] **Brand Pivot — Copy Layer Revision**: Replaced software-deployment language with sports-authority voice across landing page, auth pages, and navbar. Visual system unchanged. (see BRAND_PIVOT_PLAN.md)
- [x] **Initial Auth Foundation**: Supabase Auth integration and organization signup flow.
- [x] **Security & RLS**: Scoped all data to `organization_id` and implemented RLS policies.
- [x] **RLS Recursion Fix**: Resolved 500 error in `organization_members` policy.
- [x] **Registrations Admin Optimizations**:
    - [x] Bulk heterogeneous updates for randomization.
    - [x] Universal status transitions (Accepted/Waitlist/Pending/Rejected).
    - [x] Confirmation modals for high-impact actions.
    - [x] Delete functionality and error reporting.
- [x] **Generalized Design System plan**: Written and approved. See `DESIGN_SYSTEM_PLAN.md`.
- [x] **Phase 3: Multi-Org Routing**: Pages moved under `/[orgSlug]` with middleware resolution.
- [x] **Phase 4: Discovery & Marketing**: Built platform landing page and `/discover` portal.
- [x] **Age Group Preference Persistence** — Cookie-based tab persistence across Schedule/Standings/Teams.
- [x] **Schedule/Results Revamp** — Unified schedule page with inline scores, team filter, bracket view, new `/standings` page, navbar update.
- [x] **Stock Logo Library** — Curated sport icon set for orgs to use as logo without uploading; plan-tiered access.
