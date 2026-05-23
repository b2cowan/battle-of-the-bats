# FieldLogicHQ — Project TODO List

This file tracks the ongoing tasks for the FieldLogicHQ platform (multi-tenant sports club and league management). AI models and the USER use this to coordinate work.


---

- [x] **Standalone Team Phase 1 foundation migration** - Migration 065 applied in dev and production.

- [x] **Standalone Team Phase 2A** - Team provisioning service implemented: lightweight workspace org, rep team, active program year, coach assignment, workspace row, entitlement row, team ledger, and dev seed route.

- [x] **Standalone Team Phase 2B** - Direct Team checkout plumbing implemented: Team checkout API, mock provisioning path, Stripe metadata, webhook provisioning recovery, subscription sync, and checkout completion redirect shell.

- [x] **Standalone Team Phase 2C** - Team-first landing and access gates implemented: Team workspaces default to the coaches portal, coaches landing/success copy is Team-aware, coach APIs enforce team entitlement plus active coach assignment, and org-wide rep-team admin remains module-gated.

- [x] **Standalone Team Phase 2D** - Public Team signup surface implemented: `/team` collects team, season, billing, and coach account details, creates/signs in Team-only coach accounts, starts the existing Team checkout flow, and exposes the path from pricing/marketing navigation.

- [x] **Standalone Team Phase 2E** - Stripe sandbox checkout verification complete: readiness checker, Dev Tools mock-billing toggle, setup checklist, and real Stripe sandbox org Team add-on checkout/webhook smoke are implemented and passing.

- [x] **Standalone Team Phase 3A** - Tournament-to-Team claim funnel first slice implemented: secure claim links, prefilled claim activation page, checkout email verification, registration confirmation CTA, source tournament/team attachment, and dev claim smoke path.

- [x] **Standalone Team Phase 3B** - Organizer Team claim invites implemented: tournament admins can select team registrations, send secure Team workspace claim invitations, skip ineligible/already-claimed teams, and review generated links from the teams admin screen.

- [x] **Standalone Team Phase 4A** - Basic Team-to-org linking implemented: Team coaches can request a parent org visibility link, org owners/admins can approve or decline, link history is auditable, and help docs now explain the coach and org-admin workflow.

- [x] **Standalone Team Phase 4B** - Org-initiated Basic Team link invitations implemented: org owners/admins can invite standalone Team workspaces, coaches can accept or decline from the Coaches Portal, and acceptance preserves billing, ownership, data, and org-wide rep-team access boundaries.

- [x] **Standalone Team Phase 4C** - Org billing takeover implemented: linked Team coaches can request org billing or accept org billing invitations, org owners/admins can approve and complete the org Team add-on checkout/mock application, and the Team remains coach-operated with Basic sharing only.

- [x] **Standalone Team Phase 5A** - Ownership transfer approval foundation implemented: linked Team coaches can request ownership transfer, org owners/admins can invite or approve it, coaches can accept/decline org invitations, and mutually approved transfers are held in an auditable platform-assisted state before data reassignment.

- [x] **Standalone Team Phase 5B** - Platform-assisted ownership transfer completion implemented and smoke-tested: migration 067 applied in dev/prod, platform admin can complete mutually approved transfers from org detail, and completion moves team-scoped rep-team data/ledger ownership while retiring Team entitlements and prior workspace access.

- [x] **Standalone Team Phase 6A** - Coach-managed attendance implemented and smoke-tested: migration 069 applied in dev/prod, and coaches can mark event attendance for active roster players from the Coaches Portal schedule without changing linked-org visibility or ownership boundaries.

- [ ] **Standalone Team workspace model** — Build-ready plan and PM brief for tournament-to-team acquisition, standalone coach workspaces, org linking, billing transfer, and coaches portal enhancements (see [implementation plan](docs/active/codex_STANDALONE_TEAM_IMPLEMENTATION_PLAN.md) and [PM brief](docs/active/codex_STANDALONE_TEAM_PM_BRIEF.md))

- [ ] **Public tournament mobile experience** - Mobile-first plan and PM brief for public registration, schedule controls, hidden/empty states, post-event story, and first-viewport trust (see [implementation plan](docs/active/codex_PUBLIC_TOURNAMENT_MOBILE_EXPERIENCE_PLAN.md) and [PM brief](docs/active/codex_PUBLIC_TOURNAMENT_MOBILE_EXPERIENCE_PM_BRIEF.md))

- [x] **Help center platform-admin documentation UX** - Searchable customer help hub plus protected platform-admin SOP documentation for employee support workflows (see [implementation plan](docs/archive/codex_HELP_CENTER_PLATFORM_ADMIN_PLAN.md) and [PM brief](docs/archive/codex_HELP_CENTER_PLATFORM_ADMIN_PM_BRIEF.md))
  - [x] Initial browser verification completed
  - [x] Customer-facing task-recipe content pass added across major guides
  - [x] Platform-admin Help opens separately and omits the admin side navbar on help pages
  - [x] Role-based getting started paths added for customer and platform-admin help hubs
  - [x] Accepted complete by user; future refinements are usage-driven

- [ ] **League onboarding wizard** - Guide League/Club owners through first house league setup with optional tournament setup branch (see [LEAGUE_ONBOARDING_WIZARD_PLAN.md](LEAGUE_ONBOARDING_WIZARD_PLAN.md))
  - [x] First implementation: league startup tasks, onboarding wizard, remaining-step CTAs, and create-season modal alignment
  - [ ] Browser verification

- [ ] **UAT Agent** — Browser-based acceptance test suite + `/uat` slash command; Playwright scenarios for auth, plan-gating, tournament-admin, platform-admin, coaches; two-phase run → propose → sign-off workflow (see [UAT_SETUP.md](UAT_SETUP.md))
  - [x] Playwright installed, `playwright.config.ts` created
  - [x] Auth setup (`tests/uat/auth.setup.ts`), fixtures, and type helpers
  - [x] 5 scenario suites: auth, plan-gating, tournament-admin, platform-admin, coaches
  - [x] `/uat` slash command (`.claude/commands/uat.md`) with mandatory sign-off gate
  - [x] Install Playwright browsers (`npx playwright install chromium`)
  - [x] Create UAT test accounts in dev Supabase and populate `.env.local` (see UAT_SETUP.md)

## 🚀 Active Tasks (Priority Order)

- [ ] **Tournament admin design review** — Systematic design review of all 41 tournament admin pages and shared navigation components; one checkpoint row per page with screenshotted / reviewed / decisions logged / done columns (see [agent_TOURNAMENT_DESIGN_REVIEW.md](docs/active/agent_TOURNAMENT_DESIGN_REVIEW.md))

- [x] **Export Enhancements** - Standardized XLSX-first exports, CSV secondary, iCal schedules, branded PDF reports, export catalog, help docs, plan gates, and pricing/marketing updates (see [MERGED_EXPORTS_IMPLEMENTATION_PLAN.md](docs/archive/MERGED_EXPORTS_IMPLEMENTATION_PLAN.md))
  - [x] Phase B — Shared export foundation: lib/export/ layer, ExportMenu component, plan feature keys, exceljs (replaces xlsx — CVE), ics, jspdf, jspdf-autotable installed and audited clean
  - [x] Phase C — Migrate 5 existing CSV exports to ExportMenu + xlsx default (schedule, results, registrations, ledger, early-access leads); legacy /admin routes deferred pending Open Decision #1
  - [x] Phase D1 — P0 new table exports: HL registrations, tryout registrations, coaches roster (with contact opt-in), coaches dues, budget-vs-actual
  - [x] Phase E1 — iCal: public tournament schedule — "📅 Add to Calendar" button; all games or team-filtered; standalone button (not in admin ExportMenu); links back to schedule page
  - [x] Phase D2 — P1 new table exports: coaches schedule (xlsx/csv/ics), HL schedule (xlsx/csv/ics), HL standings (xlsx/csv), HL teams (xlsx/csv), accounting budget plan (xlsx/csv), rep roster admin view (xlsx/csv/pdf-coming-soon)
  - [x] Phase E2/E3 — iCal: coaches portal schedule + HL season schedule admin
  - [x] Phase D3 — P2 new table exports: org members, member audit log, venues/diamonds, platform admin orgs, customer users, audit log (xlsx+csv; audit log route now supports format=xlsx)
  - [x] Phase G — Help docs: lib/help-content/exports.tsx, /admin/help/exports page, hub card, cross-links in tournaments + accounting help
  - [x] Phase F1 — DB migration (`ALTER TABLE organizations ADD COLUMN pdf_settings JSONB DEFAULT '{}'` run on dev + prod) + API routes (`GET`/`POST /api/admin/org/pdf-settings`) + PDF Settings admin page (`/{orgSlug}/admin/org/settings/pdf`) with all E3 spec fields + org hub tile
  - [x] Phase F2 — `lib/export/pdf.ts` full implementation: `buildTablePDF()` + `downloadPDF()` with lazy-load jsPDF/autotable, header/logo/accent/footer/density/grouping/page-numbers
  - [x] Phase F3 — PDF P0 surfaces: tournament registrations (portrait, grouped by division), schedule (landscape+compact), results (portrait, grouped, champions callout); PDF settings nudge callout on all three; `HelpCallout` added to registrations page
  - [x] Phase F4 (PDF P1 surfaces) — coaches roster, player dues statement, budget-vs-actual board report; GET pdf-settings relaxed to all org members
  - [x] Phase H (Pricing/marketing) — pricing comparison table (Data & Exports category), plan card feature lines, upgrade bridge copy, platform pages, home page, and org help subscription section

- [x] **Platform admin Phase 1** - Support console foundation complete: nav grouping, customer users search, org support summary, reset links, owner contact, timeline, retention UI cleanup, and billing invariant follow-up (see [merged_PLATFORM_ADMIN_IMPLEMENTATION_PLAN.md](docs/archive/merged_PLATFORM_ADMIN_IMPLEMENTATION_PLAN.md))
  - [x] Free Tournament billing invariant: Tournament plan changes, mock billing, and cleanup migration no longer preserve `trialing` subscription state
- [x] **Platform admin Phase 1.5** - Information architecture and layout pass complete: org detail restructure and platform-admin-wide layout audit for clearer workflows before adding more functionality (see [merged_PLATFORM_ADMIN_IMPLEMENTATION_PLAN.md](docs/archive/merged_PLATFORM_ADMIN_IMPLEMENTATION_PLAN.md))
  - [x] Org detail layout restructured with account snapshot, needs-attention strip, primary actions, and workflow tabs
  - [x] Org detail readability spacing improved for snapshot fields, account context, and workflow tables
  - [x] Platform-admin-wide layout audit documented for Overview, Organizations, Customer Users, Retention, Plans & Pricing, Early Access, Platform Users, and Audit Log
  - [x] Organizations directory cleaned up with account snapshot, needs-attention strip, primary account search, and grouped directory table
  - [x] Organizations directory simplified to read-only account navigation; plan/limit edits moved out of directory rows
- [x] **Platform admin Phase 2** - Metrics command center: live-query dashboard, durable lifecycle events, snapshot infrastructure, and since-last-visit alerts implemented and browser-verified (see [merged_PLATFORM_ADMIN_IMPLEMENTATION_PLAN.md](docs/archive/merged_PLATFORM_ADMIN_IMPLEMENTATION_PLAN.md))
  - [x] Overview dashboard now shows subscription health, growth funnel, product usage, estimated MRR/ARR, and platform admin alerts
  - [x] Overview dashboard expanded with new organizations by plan, early-access conversion rate, top source paths, owner inactivity, and tournaments created in the last 30 days
  - [x] Apply migration 052 in dev and production for reliable tournament-created metrics
  - [x] Durable event-backed Overview metrics for cancellations, downgrades, past-due recovery counts, and recovery rate
  - [x] Apply migration 053 in dev and production for `platform_events`
  - [x] Overview dashboard lower metrics grouped into tabs to reduce scrolling, with clearer metric-note copy
  - [x] Browser verification for Overview metrics and action links
  - [x] Daily metric snapshot table/API and "since last admin visit" metrics
  - [x] Apply migration 054 in dev and production for metric snapshots, admin visits, and structured notes
- [x] **Platform admin Phase 3** - Billing and product safety complete: plan impact previews, expanded audit logging, structured timestamped org notes, override semantics, and audit log investigation tools (see [merged_PLATFORM_ADMIN_IMPLEMENTATION_PLAN.md](docs/archive/merged_PLATFORM_ADMIN_IMPLEMENTATION_PLAN.md))
  - [x] Plans & Pricing now shows subscriber impact and plan/status breakdowns before product or billing config edits
  - [x] Plan availability, limits/trials, and Stripe price ID changes now support last-change notes and audit entries
  - [x] Apply the plan/pricing change-note migration in dev and production
  - [x] Browser verification for Plans & Pricing impact summaries, note capture, and save flows
  - [x] Stripe price ID validation against Stripe where environment credentials allow it
  - [x] Structured timestamped org notes implementation
  - [x] App-native confirmation modal for structured note deletion
  - [x] Browser verification for structured org notes
  - [x] Org detail plan/limit edits moved into guarded Billing & Access workflow with reason and confirmation
  - [x] Audit log investigation tools: CSV export, org filter action, action labels, and full JSON value viewer
  - [x] Browser verification for newest org billing workflow and Audit Log investigation tools
- [x] **Platform admin Phase 4** - Permissions and governance complete: platform admin roles, guarded actions, reasons, confirmations, and role-scoped controls (see [merged_PLATFORM_ADMIN_IMPLEMENTATION_PLAN.md](docs/archive/merged_PLATFORM_ADMIN_IMPLEMENTATION_PLAN.md))
  - [x] Initial role model and permission gates implemented for support, billing, product, read-only, and super-admin roles
  - [x] Apply migration 055 in dev and production for platform admin role constraint/default
  - [x] Browser verification for role-scoped platform admin controls
- [x] **Platform admin Phase 5** - Growth and product catalog complete for launch scope: early-access conversion tracking, plan versions, add-ons, effective dates, campaigns, approvals, and bulk operations (see [merged_PLATFORM_ADMIN_IMPLEMENTATION_PLAN.md](docs/archive/merged_PLATFORM_ADMIN_IMPLEMENTATION_PLAN.md))
  - [x] Early Access conversion tracking implementation: converted timestamp, org link, follow-up due date, next action, conversion metrics, CSV export fields, and growth role support
  - [x] Apply migration 057 in dev and production for early-access conversion fields and growth role constraint
  - [x] Browser verification for Early Access conversion and follow-up flows
  - [x] Product Catalog read-only foundation: plan version records, add-on catalog records, and live feature matrix review tab
  - [x] Apply migration 058 in dev and production for product catalog foundation
  - [x] Browser verification for Plans & Pricing Product Catalog tab
  - [x] Product Catalog governance implementation: change requests, approval statuses, and campaign tracking
  - [x] Apply migration 059 in dev and production for product catalog governance
  - [x] Browser verification for Product Catalog planned changes and campaign tracking
  - [x] Approval enforcement implementation: live plan availability, limits/trials, and Stripe price ID changes require an approved catalog change request
  - [x] Inline Stripe price approval workflow: editing a price row without a selected approval now opens a prefilled Product Catalog request modal, surfaces pending pricing requests on Overview and Plans & Pricing, and applies the proposed price ID automatically when the request is approved
  - [x] Central Change Requests queue: Platform Admin now has a dedicated approval workspace for filtering requests by type, status, attention owner, and submitter, with price requests approved and applied from the queue
  - [x] Change Requests queue follow-up: default Needs Review view, compact modal-driven review table, Severity filter/column, severity-then-updated sorting, and duplicate Stripe-price request closure when the live slot already matches the proposal
  - [x] Plans & Pricing header cleanup: top account/plan impact summaries were compressed, the global Live Change Approval panel was removed, and direct approval selectors now appear only beside Availability and Limits live-change tables
  - [x] Stripe Prices product-first cleanup: main table now lists products once per environment, with monthly/annual price status summaries and a modal for editing individual price IDs
  - [x] Plans & Pricing Product Catalog approval cleanup: duplicate planned-change/status controls were removed from the Product Catalog tab; approvals and implementations now live in the central Change Requests queue
  - [x] Plans & Pricing plan-centered workspace first slice: compact main table now lists plans once with status, impact, pricing, limits/trials, pending changes, and a Manage modal for scoped plan details/edits
  - [x] Plans & Pricing generated request workflow: availability and limits/trials edits now open prefilled review modals and are applied from Change Requests like Stripe price edits; plan modal pricing uses one table for subscription and related add-on prices
  - [x] Apply migration 060 in dev and production for catalog approval application logging
  - [x] Browser verification for approved-request enforcement on live pricing/config changes
  - [x] Feature Matrix draft editor implementation: product admins can toggle proposed plan/module entitlements and save the proposal as a Product Catalog change request
  - [x] Browser verification for Feature Matrix draft editor
  - [x] Feature Matrix publishing implementation: approved feature-matrix requests can be previewed and published into the live product catalog matrix with audit/application logging
  - [x] Apply migration 062 in dev and production for feature matrix publishing
  - [x] Browser verification for approved Feature Matrix publishing
  - [x] Bulk operations foundation implementation: role-gated account selection, preview, required reason, confirmation, batch logging, and audit entries for status overrides, comp-period grants, and plan changes
  - [x] Apply migration 063 in dev and production for platform bulk operation batch records
  - [x] Browser verification for bulk status override, comp-period grant, and plan change workflows
  - [x] Bulk module/add-on enablement implementation: product-gated bulk enable/remove controls for organization-specific module overrides
  - [x] Apply migration 064 in dev and production for bulk module/add-on batch records
  - [x] Browser verification for bulk module add-on enable/remove workflows
- [x] **Platform admin Phase 6** - Final readability QA complete; remaining punch-list items are deferred as future usage-driven cleanup (see [merged_PLATFORM_ADMIN_IMPLEMENTATION_PLAN.md](docs/archive/merged_PLATFORM_ADMIN_IMPLEMENTATION_PLAN.md))
  - [x] Shared Platform Admin shell responsiveness: sidebar stacks into a top navigation band on narrower screens and main content padding is reduced for mobile scanability
  - [x] Browser verification for shared Platform Admin shell on desktop and mobile widths
  - [x] Header/action-label consistency pass for Retention Queue, Platform Users, and Audit Log
  - [x] Complete final section-by-section readability punch list
  - [x] Browser verification for Phase 6 header/action-label consistency pass
  - [x] Plans & Pricing Product Catalog density cleanup: split catalog work into Planning, Feature Matrix, and Catalog Records inline workspaces
  - [x] Browser verification for Plans & Pricing Product Catalog sub-workspaces
  - [x] Remaining Phase 6 punch-list items deferred to future usage-driven cleanup
- [ ] **Future platform-admin Plans & Pricing workspace follow-up** - Consider folding Feature Matrix editing/publishing deeper into the plan detail workflow; keep Product Catalog/Campaigns separate unless catalog records become directly editable

- [x] **Tournament Plus enhancements** - Launch scope complete: Plus is repositioned as the serious tournament operations plan, with a clear free starter tier, coach acquisition loops, registration control tools, organizer productivity, post-event reporting, and measured upgrade funnels (see [TOURNAMENT_PLUS_ENHANCEMENT_PLAN.md](docs/archive/TOURNAMENT_PLUS_ENHANCEMENT_PLAN.md))
  - [x] Phase 0 - Packaging, metrics, and feature taxonomy
  - [x] Phase 1 - Free vs. Plus boundary and branding gate
  - [x] Phase 2 - Coach acquisition and public growth surfaces
  - [x] Phase 3 - Registration Control Bundle
    - [x] Custom registration questions, private file collection, admin answer details, CSV export foundation, and Plus gates
    - [x] Migration 056 applied in dev and production
    - [x] Bulk action bar, dedicated bulk route, and waitlist tracking
    - [x] Email-selected workflow via Phase 5.2 targeted communication
    - [x] Browser verification for registration control and communication workflows
  - [x] Phase 4 - Payment and deposit value
    - [x] Plus-gated payment dashboard, payment status filters, selected-team payment reminders, and payment-ready CSV fields
    - [x] Online tournament payment collection intentionally deferred to a separate research and architecture decision
  - [x] Phase 5 - Organizer Productivity Bundle
    - [x] Plus-gated tournament cloning into a draft setup without registrations, payments, games, scores, or private notes
    - [x] Targeted announcements and selected-recipient communication workflow
    - [x] Tournament staffing guidance and setup-template follow-up
    - [x] Settings & Access layout uses tabs for Tournament setup, People & access, and Account sections
    - [x] Tournament Plus upgrade CTAs stay inside tournament admin subscription/pricing instead of org admin billing
  - [x] Phase 6 - Post-event summary, results, and renewal loop
    - [x] Retention strategy, next-tournament prompts, and export-compatible summary/report plan
    - [x] Plus-gated manual post-event summary API/page with registration, payment, schedule, division recap, print/share actions, and completed/archived nav entry
    - [x] Automatic results notification implementation and renewal CTA tracking
    - [x] Apply migration 061 in dev and production before testing the notification toggle
  - [x] Phase 7 - Rollout, QA, and documentation
    - [x] Rollout code audit and tournament help documentation updates
    - [x] Final browser smoke pass for Phase 3 registration control before external Plus marketing

- [ ] **Online tournament payment collection research** - Decide whether future tournament entry payments should use Stripe Connect, manual payment links, or another architecture before building payment processing (see [TOURNAMENT_PLUS_ENHANCEMENT_PLAN.md](docs/archive/TOURNAMENT_PLUS_ENHANCEMENT_PLAN.md) Phase 4.3)

- [ ] **Tournament scorekeeper experience** - Dedicated mobile-first scorekeeper/day-of scoring plan for role access, route strategy, score entry, pending review, admin Results integration, data/API changes, and UAT. Slice 7 complete: shared scoring service centralizes score submit/finalize/revert rules for admin Results and Scorekeeper APIs; migrations 066 and 068 applied in dev/prod (see [implementation plan](docs/active/codex_TOURNAMENT_SCOREKEEPER_EXPERIENCE_PLAN.md) and [PM brief](docs/active/codex_TOURNAMENT_SCOREKEEPER_EXPERIENCE_PM_BRIEF.md))

- [ ] **Tournament help documentation UX review** - Upgrade tournament help with grouped contents, search, quick answers, and FAQs (see [TOURNAMENT_HELP_DOCS_REVIEW_PLAN.md](TOURNAMENT_HELP_DOCS_REVIEW_PLAN.md))

- [ ] **QA Infrastructure** — Design and build a layered automated test suite (unit, integration, E2E smoke) with a test catalog, plan-gate matrix, post-release update workflow, CI/CD integration, and QA_RULES.md process documentation; use the prompt written 2026-05-21 as the starting brief for that session


### 3. Chart Library Investigation
- [ ] **Investigate chart libraries** — Evaluate recharts, chart.js, or @nivo for use in budget vs. actual and dashboard screens; assess bundle size, SSR compatibility, and dark-theme support before adding a dependency

### 3. Light / Dark Theme Toggle
- [ ] **Per-user light/dark theme preference** — Allow each user to toggle light/dark theme from their own settings screen (org admins in org settings, coaches in coach portal settings, etc.). Theme preference stored per-user (not per-org). Also expose a light/dark toggle on the public org and tournament websites so visitors can choose their preferred mode.

### 4. Stripe Integration — End-to-End Billing & Subscriptions
*Reference plan archived at [STRIPE_INTEGRATION_PLAN.md](docs/archive/STRIPE_INTEGRATION_PLAN.md); live remaining work is tracked here.*

- [ ] **Billing downgrade and data retention flow** - Add FieldLogicHQ-guided downgrade/cancel review with over-limit data retention choices (see [BILLING_DOWNGRADE_RETENTION_PLAN.md](BILLING_DOWNGRADE_RETENTION_PLAN.md))
  - [x] First implementation slice: retention schema, owner review APIs/UI, cancellation suspension, and platform-admin retention queue
  - [x] Migration 038 applied in dev and production
  - [x] Retention expiry warnings and pending-purge processing
  - [x] Migration 039 applied in dev and production
  - [x] Dev/mock upgrades restore retained downgrade tournaments when plan limits allow
  - [ ] Hard purge job after pending-purge review policy is finalized
- [x] **Phase A** — Stripe dashboard setup: products, prices, webhooks, Customer Portal, API keys + price IDs configured in dev (test environment complete)
- [x] **Phase B** — App infrastructure: Stripe SDK, price map, DB migrations
  - [x] Stripe package + lib/stripe.ts singleton complete
  - [x] ~~Price map: getPlanPriceId() in lib/plan-config.ts~~ → replaced by DB-backed stripe_prices table (migration 048)
  - [x] Migration 047: subscription_period, current_period_end, rep_team_subscription_item_id — applied dev + prod
  - [x] Migration 048: stripe_prices table — price IDs in DB, managed via Platform Admin → Plans & Pricing — applied dev + prod
  - [x] Migration 049: plan_config_overrides table — per-plan tournament limit, seat limit, trial day overrides; lib/plan-config-db.ts helpers — applied dev + prod
  - [x] Platform Configuration: Plans & Pricing admin page at /platform-admin/plans-pricing (plan availability, limits & trials, Stripe price IDs)
- [x] **Phase C** — Webhook handler: subscription lifecycle → org plan tier sync
  - [x] runtime = nodejs; checkout.session.completed; invoice.payment_succeeded; trial_will_end email; subscription.created/updated writes new columns; subscription.deleted dedup guard (intent-type aware)
- [x] **Phase D** — Checkout + Customer Portal APIs + billing settings page
  - [x] Checkout billing-cycle readiness: monthly/annual selection now flows into checkout/mock checkout with future annual Stripe price guards
  - [x] create-checkout route: full Stripe checkout with gating + mock dev path
  - [x] portal route: Stripe Customer Portal session
  - [x] Billing settings page: upgrade cards, usage meters, downgrade/cancel review
  - [x] Stripe reconciliation (D4): downgrade/confirm calls subscriptions.update() or cancel(); cancel/confirm calls subscriptions.cancel(); webhook dedup guard is intent-type aware (downgrade vs cancellation)
  - [ ] Trial lifecycle reminders for League 30-day and Club 90-day windows — deferred to F4 (see Deferred Enhancements)
- [x] **Phase E** — Per-team billing: quantity sync (E1–E2), billing preview API (E3), team creation modal (E4), program year hook (E5), billing page add-on section (E6)
- [x] **Phase F** — UpgradeGate component (F1), onboarding→Checkout verified (F2), soft upsell prompts (F3); F4 deferred (see Deferred Enhancements)
- [ ] **Phase G — Go live with Stripe** (production cutover checklist)
  - **Current state:** test Stripe keys (`sk_test_...`) set on all Amplify branches — safe while prod is not live
  - [x] D4 gap resolved: downgrade/cancel confirm routes now call Stripe after DB write
  - [ ] In Stripe Dashboard (Live mode): create products + prices matching sandbox setup; record 8 live `price_xxx` IDs
  - [ ] In Stripe Dashboard (Live mode): create production webhook endpoint at `https://fieldlogichq.ca/api/billing/webhook`; record live `whsec_...`
  - [ ] Configure Stripe Customer Portal for live mode: add business name, privacy policy URL, and terms of service URL (required before live transactions)
  - [ ] Enter the 8 live price IDs via **Platform Admin → Plans & Pricing → Stripe Price IDs** (Live Mode rows) on the production app — no Amplify deploy needed
  - [ ] In Amplify: add master-branch **override** for `STRIPE_SECRET_KEY` → `sk_live_...`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_...`, `STRIPE_WEBHOOK_SECRET` → live `whsec_...` (leave test keys on all-branches default so dev keeps working)
  - [ ] Remove now-unused `STRIPE_PRICE_*` env vars from Amplify (price IDs are DB-backed; these no longer do anything)
  - [ ] Run Phase G smoke test checklist (see docs/archive/STRIPE_INTEGRATION_PLAN.md § Phase G)
  - [ ] Monitor first real transactions in Stripe dashboard and verify webhook delivery

### 5. Email Strategy

- [ ] **Email Strategy Investigation**:
    - [ ] Investigate best-of-breed providers (Resend, Postmark, AWS SES) for system notifications
    - [ ] Define the architecture for a "Contact Us" inquiry system

---

## 🧭 Deferred Enhancements (Confirmed scope, build later)

- [ ] **F4 — Trial checkpoint emails (League + Club)** — League orgs on a 30-day trial receive setup check-in emails at day 7, day 21, and ~day 27 (3-day warning already handled by Stripe `trial_will_end` webhook). Club orgs on a 90-day trial receive check-ins at day 7, day 30, day 60, and day 80. These are proactive activation emails (not just payment warnings). Implementation requires: a daily cron route at `/api/cron/trial-emails` protected by a shared secret, called by AWS EventBridge Scheduler; a `trial_email_sent` bitmask column on `organizations` for idempotency; and 4–5 email templates in the Resend stack. **Blocked on:** decision to enable EventBridge Scheduler in the Amplify account. See [STRIPE_INTEGRATION_PLAN.md](docs/archive/STRIPE_INTEGRATION_PLAN.md) Phase F.

- [ ] **House League — Coach Draft Room** — Shareable per-team link (no login required) that lets coaches participate in the draft live. Each team gets a token-scoped URL; coaches see the current pick state and submit their pick when it's their turn. Requires: real-time state sync (polling or WebSocket), a `draftTokens` map in `draft_state`, and a public-facing draft room page. See conversation context from Phase 5G planning. **Architecture note:** Phase 5G is designed to not block this — draft business logic is kept auth-layer-agnostic so a token path can be added to `/draft/route.ts` without restructuring the state machine.
- [ ] **House League — Practice Scheduling** — Allow league admins to schedule practices for individual teams alongside the game schedule. A practice belongs to one team (not two), has no score, and does not affect standings. Confirmed scope post-Phase 5H. Build as an extension of the schedule page: separate "Practices" tab or filter, same date/time/location fields, team selector instead of home/away. No schema migration needed — can reuse `league_games` with `away_team_id = null` and a `game_type` column, or use a separate `league_practices` table (decide at build time).
- [ ] **Calendar Sync for Team Schedules** — Allow parents/coaches to export a team's game schedule as an `.ics` file or subscribe via a calendar URL (Google/Apple Calendar). Technically straightforward (generate `.ics` from schedule query). Applies to both house league team schedules and rep team schedules in the coaches portal. Build during a parent-facing polish pass.
- [ ] **Bulk Operations for Admins** — Bulk-change registration statuses, bulk-assign teams, bulk-edit schedule slots. High value for orgs with 100+ registrations. Requires multi-select UI, confirmation flows, and async batch API routes. Revisit after Phase 3 UX ships and an org is operating at scale.
- [ ] **Tournament setup templates** - Post-clone enhancement for orgs that run several similar tournaments and want reusable setup patterns without choosing a prior event each time.
- [ ] **Tournament staff role presets** - Later enhancement for Plus orgs if real usage shows registrar, scheduler, communications, and scorer-manager presets would reduce setup mistakes beyond current role/capability overrides.
- [ ] **Custom domain investigation** — Research feasibility and effort of allowing orgs to point a custom domain (e.g. miltonbats.com) to their FieldLogicHQ public page. Covers: DNS verification flow, wildcard SSL or per-org cert provisioning, reverse proxy / Amplify routing changes, and potential upsell pricing. Do not design or implement until `module_public_site` is fully shipped. **Also investigate:** pros and cons of a custom domain for the Stripe Customer Portal (e.g. `billing.fieldlogichq.ca`) — level of effort, DNS setup, whether it meaningfully improves trust vs. billing.stripe.com, and when this becomes worth prioritizing.
- [ ] **Public Site Offering Evaluation** — After the first external org enables `module_public_site`, review the offering across three dimensions: (1) ease of setup — is the path from enabling the module to a live page clear enough for a non-technical org owner? (2) customization level — structured fields are correct; assess whether anything is missing without going full CMS; (3) base UX improvements. Produce a prioritized fix list before moving to the next module.

---

## ✅ Completed Projects

### Tournament Experience Excellence
*(Archived — admin review, UX reformat, Plus/org-scope hardening, design consistency, responsive hardening, and final browser sign-off prep complete. See [experience plan](docs/archive/TOURNAMENT_EXPERIENCE_EXCELLENCE_PLAN.md), [PM brief](docs/archive/TOURNAMENT_EXPERIENCE_EXCELLENCE_PM_BRIEF.md), [journey audit](docs/archive/TOURNAMENT_EXPERIENCE_PHASE_1_JOURNEY_AUDIT.md), [section review](docs/archive/TOURNAMENT_SECTION_REVIEW_PLAN.md), [findings](docs/archive/TOURNAMENT_REVIEW_FINDINGS.md), and [admin UX reformat reference](docs/archive/TOURNAMENT_ADMIN_UX_REFORMAT_PLAN.md).)*
- [x] Phase 2C core admin data-rich QA for Registrations, Schedule, and Results across Free/Plus desktop/mobile
- [x] Phase G Plus gate and org-scope hardening across tournament admin/API flows
- [x] Phase F design consistency pass and archive empty-state improvements
- [x] Phase H responsive hardening and final browser sign-off checklist
- [x] Future scorekeeper route and public tournament mobile work split into separate planning prompts

### Tournament Signup Experience
*(Archived — all phases and browser verification complete. See [TOURNAMENT_SIGNUP_EXPERIENCE_FIXES.md](TOURNAMENT_SIGNUP_EXPERIENCE_FIXES.md))*
- [x] Phases 1–4 trust, setup, conversion, and plan-aware onboarding refinement
- [x] Full walkthrough polish series (30+ incremental improvements)
- [x] Non-browser hardening pass
- [x] Browser verification of signup-to-registration flow complete

### Free Tournament Organizer UX Cleanup
*(Archived — all items complete. See [docs/archive/TOURNAMENT_FREE_TIER_UX_IMPLEMENTATION_PLAN.md](docs/archive/TOURNAMENT_FREE_TIER_UX_IMPLEMENTATION_PLAN.md))*
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
- [x] Phase 5 item 16: plan feature gates and pricing copy align free Tournament with Tournament Plus-and-above benefits

### Rep Teams — Groups & Per-Team Billing
*(Archived — all phases complete. See [docs/archive/REP_TEAMS_ENHANCEMENTS_PLAN.md](docs/archive/REP_TEAMS_ENHANCEMENTS_PLAN.md); Phase 3 tracking moved to docs/archive/STRIPE_INTEGRATION_PLAN.md Phase E)*
- [x] **Phase 1** — Rep team groups: `rep_team_groups` table, group management UI, team assignment, group filter on lists and accounting views — migration 035 applied dev+prod
- [x] **Phase 2** — Staff group scoping: `org_member_rep_group_scopes` junction table, multi-group selection per member, `repGroupIds` on auth context, hard 403 gating on all rep team admin routes, group access UI in Manage Member modal — migration 036 applied dev+prod
- [x] **Phase 3** — Per-team billing: synced via Stripe Phase E (quantity sync, billing preview API, team creation modal with charge confirmation, program year status hook, billing page add-on section)

### Non-Billing UAT Remediation
*(Archived - all 8 items complete. See [docs/archive/NON_BILLING_UAT_REMEDIATION_PLAN.md](docs/archive/NON_BILLING_UAT_REMEDIATION_PLAN.md))*
- [x] Signup URL guardrails, legacy admin routing, public tournament reads, public registration reads, official scorekeeper scoping/states, Next.js proxy migration, and lint-gate stabilization

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
- [x] **Launch positioning update** — Public and billing pages now sell Tournament/Tournament Plus as live tiers while League/Club are marked coming soon/early access; checkout blocks League/Club self-serve purchase.
- [x] **Early-access lead capture** — Join Early Access CTAs now open a modal that collects name, email, organization, interest areas, and consent into `early_access_leads`.

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
- [x] Early Access Platform Admin — League/Club lead pipeline with protected APIs, filtering, detail/status/notes workflow, copy/export helpers, outreach templates, migrations 044/045 applied dev+prod, and browser verification complete

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
