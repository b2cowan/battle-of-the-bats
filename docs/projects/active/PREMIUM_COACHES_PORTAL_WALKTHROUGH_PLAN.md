# Premium Coaches Portal — Walkthrough & Evaluation Plan

**Status:** Active — evaluation in progress (started 2026-06-26)
**Type:** Hands-on browser walkthrough (eval-first; fixes only after owner decision)
**Surface:** Premium (paid) Coaches Portal — org-scoped at `/{orgSlug}/coaches`
**Companion:** `PREMIUM_COACHES_PORTAL_WALKTHROUGH_PM_BRIEF.md`

## How we run this
Owner drives the browser on dev/local and gives plain-language feedback. Agent responds
with UX/design recommendations FIRST (no code), and builds only after the owner decides.
Every issue surfaced is logged in the Findings table below with a severity and status.
This is the *destination* eval — distinct from the now-complete Coach Premium **upgrade
flow** (the on-ramp), which is tracked in `project_coach_premium_upgrade_flow`.

**Test context:** team "toronto blue jays5" upgraded to Premium this session; Stripe TEST
mode; dev gate open. Coach = head coach on this team.

## Surfaces to walk (in nav order)

Portal entry:
- [x] **My Teams dashboard** (`/{orgSlug}/coaches`) — DONE: header-overlap fixed, banners merged, single-team auto-redirect into the portal, sidebar de-stuttered
- [x] **Team Overview** (`/teams/{id}`) — DONE (heavily reworked): merged "what's next" + setup checklist (with tooltips, retires at 100%), "Your team at a glance" snapshot, lime Premium title pill, header Help "?", Tournaments built as a first-class in-portal section (list + full record, free→premium shared), link-org moved to Settings + Overview invite banner, design converged to shared tokens. /review + /docs complete.

Team-scoped tabs:
- [ ] **Roster** (`/roster`) — add/reorder/activate players; jersey #, positions, guardian contacts; drag-sort; export XLSX/CSV/PDF  ← **NEXT (resume here)**
  - [ ] **Player profile** (`/roster/{playerId}`) — full profile + player documents
- [ ] **Schedule** (`/schedule`) — calendar (list/week/month); event types; attendance; per-inning game lineups; score entry; W-L-T; export XLSX/CSV/ICS; lineup PDF
- [ ] **Chat** (`/chat`) — full-screen team chat + unread badge
- [ ] **Announcements** (`/announcements`) — compose & email the team
- [ ] **Accounting hub** (`/accounting`) — budget/dues/expenses/net cards; payables; auto-reminders toggle
  - [ ] **Budget** (`/accounting/budget`) — cost categories + player installment schedules
  - [ ] **Budget vs Actual** (`/accounting/budget-vs-actual`) — headroom, spend vs plan, trends
  - [ ] **Dues** (`/accounting/dues`) — schedules, payment tracking, mark paid
  - [ ] **Expenses** (`/accounting/expenses`) — log expenses, tournament deposits/balances
  - [ ] **Fundraisers** (`/accounting/fundraisers`, `/{id}`) — per-player fundraising, rebates, dues credits
  - [ ] **Allocations** (`/accounting/allocations`) — read-only costs allocated by parent org
  - [ ] **Payment requests** (`/accounting/payment-requests`) — pay org / request reimbursement
- [ ] **Documents** (`/documents`) — download org templates; upload team templates
- [ ] **History** (`/history`) — read-only past-season archive (roster, dues, expenses, W-L-T, tryout rate)
- [ ] **Settings** (`/settings`) — division label; start next season (roll roster, archive season)

Cross-cutting checks during the walk:
- [ ] Empty states for a freshly-upgraded team (roster/schedule/fees migrated from free vs. blank)
- [ ] Head coach vs assistant coach gating (action-level, not nav-level)
- [ ] Mobile layout / bottom-nav parity
- [ ] Data carried over from the free team home (roster, schedule, fees) is intact & correct
- [ ] Help/docs accuracy for Premium surfaces

## Findings

| # | Surface | Severity | Issue (plain language) | Status |
|---|---------|----------|------------------------|--------|
| 1 | My Teams dashboard | Blocker | Header overlap — global navbar bled through behind the portal shell on org-scoped `/{orgSlug}/coaches` (only the org-less `/coaches` hub was suppressed) | Built — navbar now suppressed on org-scoped coaches paths |
| 2 | My Teams dashboard | High | Four stacked banners push the team card below the fold; coach can't see their team on arrival | Built — hub bypassed for single team; welcome lives on the landing (Overview) |
| 3 | My Teams dashboard | High | Two redundant success banners ("Coaches Portal ready" + "Welcome to Premium") say the same thing | Built — both removed from hub; the landing's "your team came with you" summary is the single welcome |
| 4 | Sidebar / header | Med | "Coaches Portal" repeated ~5× in one fold; subtitle stutters | Built — name suffix stripped everywhere; Premium pill now lives on the sidebar "Coaches Portal" label |
| 5 | Sidebar | Med | "Back to ...Coaches Portal" implies leaving while on the home page | Built — suffix stripped; "Back to…" hidden for standalone workspaces |
| 6 | My Teams dashboard | Med | Tournaments + link-org nudges competed with the primary action | Built — link-org tip removed (unreachable post-redirect); tournament tip kept below grid for 2+ teams |
| 7 | My Teams dashboard | High | Single-team coach lands on a redundant "My Teams" hub instead of going straight into the portal (agreed: behave like the tournament switcher — go in with 1, choose with 2+) | Built — auto-redirect into the portal with exactly one team (carries post-checkout flag) |
| 8 | Sidebar | Med | "My Teams" list + team-nav label both show with a single team, repeating the team name | Built — list hidden with ≤1 team (switcher for 2+); team-nav label hidden for single team |
| 9 | Team Overview (landing) | High | No "what's next" orientation — coach must self-assemble the setup sequence | Built — stage-aware GuidanceRail (roster→schedule→budget→ready) reusing the admin rail |
| 10 | Team Overview | High | Checklist rows inert — no descriptions, help, or per-row action | Built — each row now has a what/why line, a concept "?" tooltip, and a verb action; "Link parent org" split into an Optional group (out of the %) |
| 11 | Coaches portal (all) | High | Zero in-context help/tooltips; the (good) help guide is buried behind one sidebar link | Built — help drawer wired into the Premium portal; "?" tooltips on every setup row; icon-only Help in the header; rail "common tasks" deep-link into the guide |
| 12 | Team Overview | Med | Premium signal only in the faint sidebar eyebrow | Built — lime-fill "Premium" pill on the team-name title row |
| 13 | Team Overview | Med | New-team vs migrated-team first-run not differentiated; flat panel hierarchy | Built — rail greets the brand-new team ("start with roster"); reordered rail → setup → quick-links → history; tournament-history hidden until it exists |
| 14 | Coach help guide | Med | Guide's getting-started describes the FREE "Explore" model; misleads Premium coaches | Open — deferred to /docs (Premium-specific getting-started path) |
| 15 | Team Overview | Med | First-run not scoped for assistant coaches (same rail/checklist as head) | Open — deferred to the planned assistant-capabilities work |
| 16 | Team Overview | High | Clutter — quick-links grid just duplicated the sidebar; rail + checklist duplicated the setup state | Built — quick-links dropped; "what's next" merged into the setup panel header; added a real "Your team at a glance" snapshot (roster, next event, dues) |
| 17 | Coaches portal | High | Two visual languages — reused admin rail brought the monospace data-font into the soft coach portal | Built — dropped the admin rail; setup/snapshot use coach display/sans + shared tokens (converge, keep warmth). Broader portal-wide token convergence = follow-up |
| 18 | Sidebar / header | Med | Premium shown twice; the sidebar pill looked awkward | Built — removed the sidebar pill; kept the lime title pill |
| 19 | Coaches portal | High | "Link a parent org" over-surfaced (sidebar + mobile More + setup checklist) for a self-serve coach | Built — removed from checklist + primary nav; moved to Settings; Overview shows an invite banner only when an org actually invites the team |
| 20 | Team Overview | Med | Dashboard didn't shift from setup to run-mode | Built — setup panel retires at 100%; snapshot is the standing run-mode view |
| 21 | Premium portal / Tournaments | High | Tournaments had no home in Premium — no nav entry, and the dashboard links ejected the coach into the FREE org-less portal | Built — added a **Tournaments** nav item + in-portal list (live status chips); the full tournament record (live schedule/scores, status, payment, roster, announcements) now renders inside the Premium shell via a shared component; dashboard links repointed in-portal. Free-tier upsells suppressed for Premium. A paying coach never bounces to the free portal |
| 22 | Roster | High | Subtitle stutter — "toronto blue jays5 — toronto blue jays5 2026" (season was auto-named with the team in it; team name already shown in sidebar + breadcrumb) | Built — subtitle now reads "{n} active players · {season} season"; team-name prefix stripped from the season label on display |
| 23 | Roster | High | Two players both wear #7 with no warning | Built — duplicated jersey numbers flagged inline (amber + ⚠ icon + tooltip); soft warning, not a hard block |
| 24 | Roster | High | Row actions backwards/risky — destructive "Deactivate" sat left of "View", same styling; player name not clickable | Built — player name is now the primary link into the profile; "View" dropped; single quiet "Deactivate/Activate" action moved right |
| 25 | Roster | Med | "Source / MANUAL" is internal jargon weighted equal to Status | Built → superseded — owner confirmed the field drives no functionality (display-only provenance); Source column removed from the roster table entirely. Still shown on the player profile + export (pending owner decision to retire fully) |
| 26 | Roster | Med | Empty columns dominate a migrated roster; inconsistent empty marks (hyphen vs em dash); Phone column all blank | Built — standardized the empty placeholder; merged Phone into the Guardian column (email over phone); added a "finish your roster" nudge counting players missing position/contact |
| 27 | Roster | Med | No roster summary/headcount anywhere | Built — header subtitle now shows active/inactive counts |
| 28 | Roster | High | Wide 9-column table only side-scrolls on mobile (no card reflow) — and the field is where coaches use it | Built — roster reflows into stacked, labelled cards under 640px (grip hidden, name as card header) |
| 29 | Roster | Low | Text-only rows read cold vs the coach-warm aesthetic | Built — colored initials avatar per player |
| 30 | Roster | Low | Drag-to-reorder unlabeled — coach may read it as batting/lineup order | Built — caption above the table: "Drag to set the order players appear in" |
| 31 | Roster | Low | Every edit (jersey/position/contact) requires opening the player profile — slow first-time setup | Open — deferred (inline quick-edit is a larger interaction; revisit if owner wants it) |
| 32 | Premium portal (exports) | High | PDF export locked in the paid Coaches Portal — the per-team Premium plan ranks at the free tier, so the PDF report showed an upgrade lock | Built — PDF exports now granted to the Premium "team" plan in one place; unlocks PDF across all portal export menus (roster, schedule, lineup). ⚠ packaging decision — flag to /billing + /strategy to reconcile the Facts doc |
| 33 | Roster | Med | "Source" help tooltip was clipped under the table header (table wrapper cut it off) | Built — the roster table wrapper no longer clips the popover |
| 34 | Coaches portal (all) | Med | Redundant breadcrumb path links at the top of every portal screen — clutter, especially for single-team coaches | Built — breadcrumb retired portal-wide; the sidebar is the single nav source |
| 35 | Roster | Low | Export and Add Player buttons were different heights | Built — Add Player sized down to match Export |
| 36 | Player profile | Med | Duplicated team-name subtitle ("team — team season") | Built — replaced with a useful identity line: jersey # · age (from DOB) · season |
| 37 | Player profile | Med | Literal word "null" shown/saved (legacy migrated data) | Built — stray "null"/"undefined" text scrubbed to empty on load; current saves already store true blanks; next save scrubs the data |
| 38 | Player profile | Med | Two notes fields ("Notes" + "Admin Notes") — no family-facing audience exists for a "public" note | Built — collapsed to a single private Notes field (admin-notes data left untouched in DB, just unused) |
| 39 | Player profile / export | Med | "Manual" (Source) badge still shown on profile + export | Built — removed from the profile status row and the roster export. DB field retained, hidden everywhere from coaches |
| 40 | Roster + profile | Med | Positions were free-text | Built — sport-aware position dropdown (softball/baseball diamond) + "Custom…" escape, shared via the Sport Pack; one vocabulary with game lineups |
| 41 | Player profile | Low | Guardian email/phone weren't actionable | Built — tap-to-contact links (email / call-or-text) appear under each when filled |
| 42 | Player profile | High | Missing fields a coach needs (emergency/medical, handedness, jersey size) + no attendance/dues at-a-glance | Built (Wave B, dev) — mig 157 adds medical/emergency-contact/throws/bats/jersey-size (dev-applied, ⚠PROD-PENDING); new Safety section + handedness/jersey selects + "Medical info" flag; read-only Attendance snapshot (season + last 10) and real Dues summary replace the placeholder. New fields carry across season rollover. See PREMIUM_COACHES_PORTAL_PLAYER_PROFILE_WAVE_B_PLAN.md |
| 43 | Player profile (edit UX) | Med | Save button lived at the bottom of a long form — hidden when editing fields near the top; unclear how/whether edits save | Built — **viewport-pinned** save bar (fixed to the window bottom, offset for sidebar / above mobile nav, +spacer) showing "Unsaved changes · Discard · Save changes" with inline "Saved" confirmation. Plus a reusable **UnsavedChangesGuard** that warns on leave for BOTH tab-close/refresh (native) AND in-app nav (sidebar/bottom-nav/link clicks intercepted → "Leave / Stay" modal). Reuse on other coach edit screens (follow-up). Decision: explicit save, NOT autosave (form holds medical/PII) |

Severity: **Blocker** (broken/unusable) · **High** (confusing or wrong, hurts trust) ·
**Med** (rough edge) · **Low** (polish/nit). Status: Open → Decided → Built → Verified.
