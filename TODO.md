# Project TODO List

This file tracks the ongoing tasks for the tournament website project. AI models and the USER use this to coordinate work.

## 🚀 Active Tasks

- [ ] **Add RESEND_API_KEY to Amplify environment variables** (AWS console → App settings → Environment variables) — required for invite emails to work in production.
- [ ] **Add NEXT_PUBLIC_APP_URL to Amplify environment variables** — set to production domain (e.g. `https://battleofthebats.ca`); used for invite email redirect and Resend `from` address.
- [ ] **Email Strategy Investigation**: 
    - [ ] Investigate best-of-breed providers (Resend, Postmark, AWS SES) for system notifications.
    - [ ] Define the architecture for a "Contact Us" inquiry system.
- [ ] **AWS Amplify Hosting Strategy**:
    - [ ] Research proper hosting for parallel Dev and Production environments on AWS Amplify.
    - [ ] Evaluate URL options: using a subdomain (e.g., `dev.battleofthebats.ca`) vs. a separate domain.
    - [ ] Document the process for pointing the Dev environment to Stripe Test products/keys and the Prod environment to Stripe Live products/keys (branch-specific environment variables).
- [ ] **Live Dev Environment**: Create the live development environment on AWS (likely via AWS Amplify `dev` branch) once the research above is finalized.

---

## 🏗️ FieldLogic Rebrand (The Architect)
*Full implementation plan: [FIELDLOGIC_IMPLEMENTATION_PLAN.md](file:///c:/Users/Robert%20Cowan/Documents/tournament-website/FIELDLOGIC_IMPLEMENTATION_PLAN.md)*

- [ ] **Phase 1: Foundation** — Update `tailwind.config.ts`, `globals.css`, and global typography.
- [ ] **Sprint 2: Admin HUD + Live Logic Rail** — Phases 2 and 8 (see [SPRINT2_PLAN.md](SPRINT2_PLAN.md))
- [ ] **Sprint 3: Phase 3 — Logic-Sync Bracket** — SVG blueprint bracket with Realtime score pulse (see [SPRINT3_PLAN.md](SPRINT3_PLAN.md))
- [ ] **Phase 4: Tactical HUD** — High-contrast mobile scorekeeper for officials (see [SPRINT4_PLAN.md](SPRINT4_PLAN.md))
- [ ] **Phase 5: Digital Ledger** — Historical archives and immutable tournament snapshots.

---

## 🎨 Design System Overhaul
*Full implementation plan: [DESIGN_SYSTEM_PLAN.md](file:///c:/Users/Robert%20Cowan/Documents/tournament-website/DESIGN_SYSTEM_PLAN.md)*

- [x] **Item 1** — Generalized design token refactor (`globals.css` + all CSS modules)
- [x] **Item 2** — Per-org color scheme selection (DB migration, `lib/themes.ts`, admin settings UI)
- [x] **Item 3** — Additional org customization: logo, hero banner, font preset, card style
- [x] **Item 4** — Platform page polish: landing page and discover page improvements
- [ ] **Item 5** — Color scheme demo pages at `/demo/themes`

---

## ⏳ Multi-Tenancy Backlog
*Detailed tasks located in [MULTI_TENANT_ARCHITECTURE.md](file:///c:/Users/Robert%20Cowan/Documents/tournament-website/MULTI_TENANT_ARCHITECTURE.md)*

- [x] **Phase 3**: Multi-Org Routing & Page Migration (Moving pages under `/[orgSlug]`)
- [x] **Phase 4**: Discovery Portal & Search
- [ ] **Phase 5**: Billing & Subscriptions (Stripe account setup and testing remaining)
- [x] **Phase 6**: Org Admin UX & Seat Management

---

## 🏆 Team & Season Management
**Goal:** Allow organizations to manage their teams outside of tournament contexts — rosters, seasons, and ongoing records across the full year.

- [ ] **Team Management MVP** — Design and implement a team management feature allowing orgs to create, edit, and archive teams independently of any tournament (see plan file TBD)

---

## 🛠️ Platform Administration (Super Admin)
**Goal:** Create a secure, restricted area for platform-wide management.

- [ ] **Site Admin Dashboard**:
    - [ ] Create `/platform-admin` route protected by specific super-user role/email check.
    - [ ] **Org Management**: View all organizations, manually override `plan_id` (free/discounted subscriptions).
    - [ ] **User Management**: View all users, trigger manual password resets via Supabase.
    - [ ] **Global Stats**: View platform-wide metrics (total orgs, total tournaments, total teams).


## ✅ Completed Tasks

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
