# Project TODO List

This file tracks the ongoing tasks for the tournament website project. AI models and the USER use this to coordinate work.

## 🚀 Active Tasks

- [x] **Platform Improvements — Phase 1** — Forgot password, officials seat exclusion, invite branding fix, re-invite, existing-user notification email, invite acceptance flow (see [PLATFORM_IMPROVEMENTS_PLAN.md](PLATFORM_IMPROVEMENTS_PLAN.md))
- [x] **Platform Improvements — Phase 2** — Members page UX cleanup, member suspension state, officials overview page, seat meter on billing, 80% upgrade nudge (see [PLATFORM_IMPROVEMENTS_PLAN.md](PLATFORM_IMPROVEMENTS_PLAN.md))
- [x] **Platform Improvements — Phase 3** — Audit log, display names, onboarding flow, role-aware reset redirect, invite callback fix, org offboarding form (see [PLATFORM_IMPROVEMENTS_PLAN.md](PLATFORM_IMPROVEMENTS_PLAN.md))
- [ ] **Platform Improvements — Phase 4** — Module-level capabilities (implement when first new module is built), ownership transfer (support-only for now), automated org deletion (deferred) (see [PLATFORM_IMPROVEMENTS_PLAN.md](PLATFORM_IMPROVEMENTS_PLAN.md))
- [x] **Module-Level Capabilities — Phase A (foundation)** — Establishes the access control infrastructure for all 7 platform modules: extends the `Capability` type, wires module caps into the member override UI (grouped by module vs. action), and exposes the user's capabilities to the client-side context so sidebar and page guards can work. No migrations, no breaking changes — ~65 minutes of work. (see [MODULE_CAPABILITIES_PLAN.md](MODULE_CAPABILITIES_PLAN.md))
    - [x] **2A.1** — Extend `Capability` union (all 7 module caps) + update `ROLE_DEFAULTS` (default-on modules only) in `lib/roles.ts`
    - [x] **2A.2** — Add module cap labels + grouped "Module Access / Action Capabilities" sections to cap override table; update page-level guard to use `hasCapability` in `app/[orgSlug]/admin/members/page.tsx`
    - [x] **2A.4.a** — Expose `userCapabilities` in `lib/org-context.tsx` (fetch `capabilities` column, add to context type + provider value)
- [ ] **Module-Level Capabilities — Phase B (per-module pattern)** — Not a discrete build task: this is the three-layer checklist (route handler gate, page access-denied guard, sidebar nav item) applied each time a new module is added. All three layers are required; the pattern and a testing guide are documented in `MODULE_CAPABILITIES_PLAN.md` Phase B. (see [MODULE_CAPABILITIES_PLAN.md](MODULE_CAPABILITIES_PLAN.md))

- [x] **Add RESEND_API_KEY to Amplify environment variables** — resolved; key was present but not written to `.env.production` in `amplify.yml`.
- [x] **Add NEXT_PUBLIC_APP_URL to Amplify environment variables** — confirmed present, set to `https://www.fieldlogichq.ca`.
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

## 🏆 Future Product Modules (add-ons)
*Recommended build order: Public Site → Accounting → House League → Rep Teams. Each module requires its own detailed plan file before implementation begins; define functionality before pricing/tier decisions. Five cross-cutting architectural decisions (C1–C5: plan entitlements, role model expansion, communications architecture, file storage, public registration forms) must each be resolved at the trigger point documented in [MODULE_CAPABILITIES_PLAN.md](MODULE_CAPABILITIES_PLAN.md) before the module that first needs them is built.*

- [ ] **Public Website Module (`module_public_site`)** — Org-branded public landing page editor: custom hero, tournament listings, registration CTAs, social links. Lowest complexity of the add-ons — no new roles, uses existing org data, editor lives in the admin shell. Requires plan file before implementation.
- [ ] **Accounting Module (`module_accounting`)** — The org's own financial management: income/expense tracking, invoicing teams for fees (rep teams, house league), registration payment reconciliation. Distinct from the `billing` cap (Stripe subscription between org and FieldLogicHQ). Will serve as the financial backbone for house league and rep team modules. Requires plan file; scoping questions about standalone vs. integrated with other modules must be answered first.
- [ ] **House League Module (`module_house_league`)** — Season-long recreational league management: individual player registration, waitlists, team placement/draft, league scheduling, standings, results. Different model from tournaments (ongoing seasons, individual registrants, not team-entry). May require new roles (league registrar); connects to accounting for registration fee collection. Requires plan file.
- [ ] **Rep Team Module (`module_rep_teams`)** — Competitive team program management: coaches portal (separate UX from admin shell), team rosters, tryout management, player documents (waivers, medical), season scheduling, accounting integration for team invoicing. Most complex module — introduces a `coach` role, module-scoped team assignments, and triggers the Site User Admin evolution. Requires plan file; D-M3/D-M4 decisions must be resolved before planning begins.

---

## 🔒 Auth & Membership Constraints

- [ ] **One-user-one-org enforcement** — Delete auth user on member removal; cross-org invite guard (see [ONE_ORG_CONSTRAINT_PLAN.md](ONE_ORG_CONSTRAINT_PLAN.md))

---

## 🎛️ Admin Design & Architecture
*Detailed plan in [ADMIN_DESIGN_ARCHITECTURE_PLAN.md](ADMIN_DESIGN_ARCHITECTURE_PLAN.md)*

- [x] **Admin Hub Navigation** — Restructure admin shell into a section-aware hub: org landing tile grid, `/admin/org/` prefix for org admin pages (members, billing, settings, diamonds, archives, tournament management), smart tournament entry redirect, section-aware sidebar with back-to-hub link. Foundation for all future module sections. (see [ADMIN_HUB_NAVIGATION_PLAN.md](ADMIN_HUB_NAVIGATION_PLAN.md))

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

- [x] **Email stack — full investigation and fixes**: RESEND_API_KEY not reaching runtime (fixed via `amplify.yml`), invite route using unowned domain (fixed to use `RESEND_FROM`), waitlist coaches receiving wrong email (new waitlist template), hardcoded admin emails removed from templates (org owner email fallback), per-tournament notification contact via Contacts admin page (DB migration applied).

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
