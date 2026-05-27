# In-App Documentation & Help System Plan

> Created: 2026-05-12 | Status: Ready — UX Review Phases 1–5 complete as of 2026-05-12
> See TODO.md for the tracking entry.

### Prerequisites: Complete (as of 2026-05-12)

All UX Review Phases 1–5 are done. Previous blockers resolved:

- **UX 5F (empty state standardization)** — complete. Phase A now absorbs the established `.loadingState` / `.emptyStateTitle` / `.emptyStateSub` CSS pattern rather than defining it from scratch.
- **UX 3C and 3E** — org hub and notifications pages are built. Help cue targets now exist.
- **UX 2A** — coaches bottom nav is built. Layout integration points are stable.
- **UX 3D and 3G** — status-transition buttons and "Needs attention" strip are in place.
- **UX 3A and 3B** — onboarding checklist and billing modules section are built (Phase G prerequisites met).

Phase A (shared components only) is safe to build immediately.

---

### Locked decisions (2026-05-12)

- **Phasing**: Each module ships complete (contextual cues + help page together). Module order: Tournaments → House League → Rep Teams → Coaches Portal → Accounting → Org Admin → Platform Admin → Help Hubs.
- **Content format**: Data-driven. Content lives in `lib/help-content/` (one `.ts` file per module). `HelpPageLayout` renders from data — text updates never touch component code.
- **Route location**: In-shell. Help pages live inside existing portal shells. Sidebar Help link is context-aware — deep-links to the section matching the current module. `AdminSidebar` uses `usePathname()` to resolve the target.
- **Coach help depth**: All three — first-visit welcome screen (dismissible via localStorage) + contextual cues per page + persistent help section in coaches sidebar.
- **Public-facing cues**: In scope. Woven into the house league and rep teams module phases.
- **Platform admin**: In scope (Phase H).
- **Existing inline help**: Unified during each module pass — migrate existing scattered prose to `HelpTooltip`/`HelpCallout` components.

---

## Overview

Two-tier help layer built across all modules and roles:

1. **Contextual cues** — Empty-state banners, decision-point tooltips, and transition callouts placed at natural friction points. Always opt-in (never interrupt the user's flow). Never rendered when the section already has data.

2. **Role-scoped help pages** — Structured walkthrough pages accessible via a "Help" entry in each portal's sidebar. Tailored to the role seeing them — admins, coaches, treasurers, officials, and platform admins each see only the guides relevant to their access.

---

## Audit: Modules & Roles in Scope

### Modules

| Module | Admin pages audited | Coached pages | Public pages |
|---|---|---|---|
| Tournaments | 6 pages (list, dashboard, schedule, results, teams, age groups) | — | Schedule, results, bracket |
| House League (`module_house_league`) | 7 pages (seasons, registrations, teams, schedule, standings, ledger) | — | 5 public pages (season, register, schedule, standings) |
| Rep Teams (`module_rep_teams`) | 12 admin pages + 11 coaches portal pages | 11 pages (overview, roster, schedule, accounting, documents, history) | 4 public pages (teams, tryout, register) |
| Accounting (`module_accounting`) | 2 pages (overview, ledger detail) | 4 coaches pages (overview, allocations, dues, expenses) | — |
| Public Site (`module_public_site`) | 1 admin config page | — | Org homepage |
| Org Admin | 8 pages (members, audit, billing, settings, diamonds, tournaments, onboarding) | — | — |
| Platform Admin | 5 pages (overview, orgs, org detail, users, audit) | — | — |

### Roles

| Role | Primary surfaces | Help priority |
|---|---|---|
| Owner | Onboarding, org admin, billing, hub | High — first user, sets up everything |
| Admin | All admin modules | High — broadest surface |
| Treasurer | Accounting module | Medium — accounting is complex |
| League Admin | House league module | High — multi-step seasonal workflow |
| League Registrar | Registrations sub-section | Medium — workflow-specific |
| Coach | Coaches portal (franchise model is non-obvious) | High — least technical, separate portal |
| Official/Scorekeeper | Score entry only | Low — narrow, single workflow |
| Public visitor | Registration & tryout forms | Low — contextual cues only, no help pages |

---

## Phase A — Foundation: Shared Components

**Goal:** Build the 3 reusable components used by all subsequent phases. No page changes yet.

### A1 — `HelpCallout` component

**File:** `components/help/HelpCallout.tsx`

An inline card for empty-state guidance and transition confirmations.

Props:
- `variant`: `"info" | "tip" | "warning"` — controls icon and color
- `title`: string — heading line
- `body`: string or ReactNode — 2–4 sentence explanation
- `cta`?: `{ label: string; href: string }` — optional action link
- `dismissible`?: boolean — if true, stores dismissed state in localStorage and doesn't re-render once dismissed

Visual: muted background, left-border accent in variant color, icon (info/lightbulb/warning), heading, body, optional link. No close button by default (use `dismissible` only for first-visit banners).

### A2 — `HelpTooltip` component

**File:** `components/help/HelpTooltip.tsx`

A small `?` icon that opens a popover with a title and explanation text on hover (desktop) or tap (mobile).

Props:
- `title`: string
- `body`: string
- `size`?: `"sm" | "md"` (default `"sm"`)

Implementation: a `<button>` with `role="tooltip"`, controlled by `useState` open/close, positioned with CSS `position: absolute`. No third-party popover library — keep it native.

Usage pattern: render inline next to a form label or section heading:

```tsx
<label>Program Year <HelpTooltip title="What is a program year?" body="A program year groups a team's roster, schedule, and finances for one competitive season. Create a new one at the start of each season." /></label>
```

### A3 — `HelpPageLayout` component

**File:** `components/help/HelpPageLayout.tsx`

A structured page wrapper for full help/walkthrough pages.

Props:
- `title`: string — page H1
- `role`: string — shown as a badge ("For: League Admin")
- `intro`: string — 1–2 sentence summary
- `sections`: `Array<{ heading: string; content: ReactNode }>`

Visual: clean single-column layout, matches admin typography tokens. Sections use `<h2>` + body text + optional callout boxes. No sidebar — rendered inside the existing admin shell frame.

### A4 — CSS module

**File:** `components/help/help.module.css`

Shared styles for all three components. Tokens from the existing design system (`--color-text-muted`, `--color-border`, etc.).

---

## Phase B — Tournament Module Coverage

### Contextual cues

| Page | Cue type | Trigger | Content |
|---|---|---|---|
| `admin/tournaments` | `HelpCallout` (info) | No tournaments exist | "Tournaments are the core of FieldLogicHQ. Create your first one to get started — you can configure age groups, teams, schedule, and scoring all from here." + "Create Tournament" CTA |
| Tournament status field | `HelpTooltip` | Always visible | "Draft: visible only to admins. Active: accepting registrations and score submissions. Completed: season is over. Archived: hidden from most views." |
| "Seal Tournament" button | `HelpCallout` (warning) | Always shown above seal button | "Sealing permanently locks the results and moves the tournament to your public archive. This cannot be undone." |
| `admin/schedule` | `HelpCallout` (info) | No schedule slots exist | "Build your schedule by adding time slots, then assigning teams. You can randomize pairings or set them manually." |
| `admin/results` | `HelpCallout` (info) | No scores submitted yet | "Scores appear here as officials submit them from the field. Results are live — no refresh needed once a game is scored." |

### Help page

**Route:** `/{orgSlug}/admin/help/tournaments`
**Role:** Admin, Owner
**Sections:**
1. Creating a tournament (name, slug, age groups, dates)
2. The tournament lifecycle (Draft → Active → Completed → Archived → Sealed)
3. Managing registrations and teams
4. Building and publishing the schedule
5. Score entry — what officials see
6. Sealing and archiving

---

## Phase C — House League Module Coverage

### Contextual cues

| Page | Cue type | Trigger | Content |
|---|---|---|---|
| `admin/house-league` | `HelpCallout` (info) | No seasons exist | "A season groups one division of players for one competitive cycle — registrations, teams, schedule, and standings all belong to a season. Create one to get started." + CTA |
| Season status badge | `HelpTooltip` | Always on status badge | "Draft: configuration only. Registration Open: parents can register online. Registration Closed: building teams and schedule. Active: games underway. Completed: season over." |
| "Open Registration" button | `HelpCallout` (tip) | Shown inline near button | "Once registration opens, the public registration form goes live for parents. You can close it again at any time." |
| `seasons/[id]/registrations` | `HelpCallout` (info) | No registrations yet | "Registrations appear here as parents submit the public form. Review each one and approve, waitlist, or decline. Approved registrants are available for team assignment." |
| `seasons/[id]/teams` | `HelpCallout` (info) | No teams exist | "Create your teams first, then assign players from your approved registrations. You can run a manual draft or use the draft room." |
| `seasons/[id]/schedule` | `HelpCallout` (info) | No games scheduled | "Generate your schedule by selecting the number of rounds and time slots. Games can be edited individually after generation." |
| Notifications page (once built) | `HelpCallout` (tip) | Always | "Emails go to all registrants in the selected audience. Preview carefully — there is no undo once sent." |

### Help pages

**Route:** `/{orgSlug}/admin/help/house-league`
**Role:** League Admin, Admin
**Sections:**
1. Understanding the season lifecycle
2. Creating and configuring a season
3. Managing registrations (pending, approved, waitlisted, declined)
4. Building teams and running a draft
5. Building the game schedule
6. Recording scores and updating standings
7. Closing out a season

**Route:** `/{orgSlug}/admin/help/registrations`
**Role:** League Registrar, League Admin
**Sections:**
1. What each registration status means
2. Handling pending registrations day-to-day
3. Waitlist management
4. Reaching out to registrants

---

## Phase D — Rep Teams Module Coverage

### Contextual cues

| Page | Cue type | Trigger | Content |
|---|---|---|---|
| `admin/rep-teams` | `HelpCallout` (info) | No teams exist | "Rep teams are competitive travel teams managed through the franchise model — the org creates and oversees teams, coaches operate them day-to-day." + CTA |
| Program year field | `HelpTooltip` | Always | "A program year represents one competitive season for a team. Roster, schedule, finances, and tryouts are all scoped to a program year. Create a new one at the start of each season." |
| Tryout open/closed toggle | `HelpTooltip` | Always | "When tryouts are open, the public registration form is live on your org page. Applicants can register; you review and approve from the Tryouts tab." |
| `admin/rep-teams/allocations` | `HelpCallout` (info) | No allocations exist | "Cost allocations define how much the org charges each team for shared costs (e.g., diamond fees, insurance). Once set, coaches see their team's allocation as a budget target." + CTA |
| `admin/rep-teams/allocations/new` | `HelpTooltip` on "allocation amount" | Always | "This is the total cost the org is assigning to this team for the program year. The coach's accounting page will show this as their budget baseline." |
| `admin/rep-teams/teams/[id]/program-years/[yearId]/tryouts` | `HelpCallout` (info) | No tryout applicants | "Applicants appear here when the public tryout form is live. Review each one and offer, accept, or decline. Accepted players become available for the coach's roster." |

### Help pages

**Route:** `/{orgSlug}/admin/help/rep-teams`
**Role:** Admin, Owner
**Sections:**
1. The franchise model explained (org HQ vs. coach operator)
2. Creating teams and program years
3. Running tryouts (opening, reviewing, offering, accepting)
4. Managing cost allocations
5. Working with coaches — what admins do vs. what coaches do
6. Team documents and templates

---

## Phase E — Coaches Portal Coverage

The coaches portal has the highest help priority — coaches are the least technical users and the franchise model is non-obvious.

### Contextual cues

| Page | Cue type | Trigger | Content |
|---|---|---|---|
| `coaches/` (hub) | `HelpCallout` (info, dismissible) | First-visit (no localStorage key) | "Welcome to your coaching portal. You're the operator — your org handles tryouts and setup; you run day-to-day. Start by exploring your team below." |
| `coaches/teams/[id]/roster` | `HelpCallout` (info) | Roster is empty | "Your roster is managed here. Players are added after tryout acceptance — contact your org admin if expected players are missing." |
| `coaches/teams/[id]/schedule` | `HelpCallout` (info) | No events exist | "Add games, practices, meetings, and tournaments to your team calendar here. Events are visible to you and your org admin." |
| `coaches/teams/[id]/accounting` | `HelpCallout` (info) | Unconfigured (no budget, no dues) — **ties to UX 2C** | "Team accounting hasn't been configured yet. Your org admin will set up dues schedules and cost allocations before this view shows data." |
| `coaches/teams/[id]/accounting/dues` | `HelpTooltip` on "Installment" | Always | "An installment is one payment in a dues schedule. For example, a $500 annual due might be split into 5 monthly installments of $100." |
| `coaches/teams/[id]/documents` | `HelpCallout` (info) | No documents | "Your org admin publishes document templates here (waivers, medical consent). Once available, you can track which players have completed each form." |

### Help pages

**Route:** `/{orgSlug}/coaches/help`
**Role:** Coach
**Sections:**
1. Getting started — understanding the franchise model
2. Your roster — how players get added and managed
3. Building your team schedule
4. Team finances — dues, expenses, and your budget allocation
5. Player documents — what coaches manage vs. what the org provides
6. Past seasons — accessing team history

---

## Phase F — Accounting Module Coverage

### Contextual cues

| Page | Cue type | Trigger | Content |
|---|---|---|---|
| `admin/accounting` | `HelpCallout` (info) | No ledgers exist | "The accounting module tracks financial activity for tournaments and your org. Create a tournament ledger when a tournament begins, or an org sub-ledger for non-tournament income and expenses." + CTA |
| "Tournament ledger" vs "Org sub-ledger" | `HelpTooltip` | Header of each section | Tournament: "Tracks income and expenses for one specific tournament event." Org: "Tracks org-wide income/expenses not tied to a specific tournament — e.g., sponsorships, general expenses." |
| Ledger entry category field | `HelpTooltip` | Always on category input | "Use consistent category names (e.g., 'Diamond Rental', 'Umpire Fees', 'Registration Income') to make filtering and year-over-year reporting easier." |
| `accounting/ledger/[id]` | `HelpCallout` (info) | No entries exist | "Add your first entry to start tracking this ledger. Income entries increase the balance; expense entries decrease it. All entries are visible to the org owner." |
| Rep teams accounting (`admin/rep-teams/allocations`) | Covered in Phase D | — | — |

### Help page

**Route:** `/{orgSlug}/admin/help/accounting`
**Role:** Treasurer, Owner, Admin
**Sections:**
1. Understanding ledgers — tournaments vs. org sub-ledgers
2. Creating and managing entries (income, expenses, transfers)
3. Using categories for filtering and reporting
4. Cost allocations for rep teams
5. Dues schedules — what they are and how coaches see them
6. Exporting for the board (CSV — ties to UX 4G once built)

---

## Phase G — Org Admin & Onboarding Coverage

### Contextual cues

| Page | Cue type | Trigger | Content |
|---|---|---|---|
| `admin/onboarding` | `HelpCallout` (tip) | Always | Supplement existing onboarding steps with module-specific guidance once UX 3A ships. |
| `admin/org/billing` | `HelpCallout` (info) | Module section (once UX 3B ships) | "Modules extend FieldLogicHQ beyond tournaments. If your plan includes a module but it's not yet enabled, use the 'Request to enable' button and we'll activate it for you." |
| `admin/org/members` | `HelpTooltip` on each role badge | Always | Per-role description: Owner, Admin, Treasurer, League Admin, League Registrar, Coach, Official descriptions. (Unified from the existing inline role content.) |
| `admin/org/settings` | `HelpCallout` (warning) on slug field | Always | "Changing your org slug will break any existing links to your public pages, registration forms, and tournament URLs. Update external links before saving." |

### Help page

**Route:** `/{orgSlug}/admin/help/org`
**Role:** Owner, Admin
**Sections:**
1. Your first 30 days — what to set up in order
2. Roles explained — who can do what
3. Inviting and managing members
4. Modules — what each one does and how to enable
5. Billing and plan management
6. Settings and your org slug

---

## Phase H — Platform Admin Coverage

### Contextual cues

| Page | Cue type | Trigger | Content |
|---|---|---|---|
| `platform-admin` | `HelpTooltip` on "past_due" count (once UX 4A ships) | Always | "Organizations with a past-due subscription have failed payment. They retain access during the grace period. Contact them directly or extend grace from the org detail page." |
| `platform-admin/orgs/[id]` | `HelpTooltip` on `enabled_addons` | Always | "Enabled addons are the modules active for this org beyond their base plan. Toggle here immediately — no deploy required." |
| `platform-admin/audit` | `HelpCallout` (info) | Always at top | "The audit log records all consequential admin actions across all orgs. Use the filters to narrow by org, date, or action type." |

### Help page

**Route:** `/platform-admin/help`
**Role:** Platform Admin
**Sections:**
1. Managing organizations — status, overrides, and addons
2. Using the audit log
3. Managing platform users and access
4. Common support workflows

---

## Phase I — Help Hubs & Navigation

### Admin help hub

**Route:** `/{orgSlug}/admin/help`
**Implementation:** New page with a grid of help topic cards — each card links to a module help page. Cards are filtered by the viewer's role and enabled modules (no card for House League if the module isn't enabled).

### Sidebar entry

Add a "Help" item at the bottom of:
- `AdminSidebar.tsx` — links to `/{orgSlug}/admin/help`
- `CoachesSidebar.tsx` — links to `/{orgSlug}/coaches/help`
- Platform admin nav — links to `/platform-admin/help`

### Official/Scorekeeper

**Route:** `/{orgSlug}/official/help` (or inline on the score entry page)
Brief inline explainer section (not a full help page) at the bottom of the game assignment list:
- What game status means
- How to submit a score
- Who to contact if something is wrong

---

## Phase J — Public-Facing Contextual Cues

Contextual cues only — no help pages for public visitors.

| Page | Cue type | Trigger | Content |
|---|---|---|---|
| House league registration form | Inline capacity label | Always on division selector | "Open (12 spots remaining)", "Waitlist only", "Closed" — ties to UX 5I |
| House league registration confirmation | `HelpCallout` (info) | Post-submit | "You'll receive an email confirmation. If you don't hear back within X days, use this link to check your registration status." — ties to UX 5I |
| Tryout registration (closed) | `HelpCallout` (info) | When `tryoutOpen = false` | "Tryouts are currently closed. [Expected open date if set.] Questions? Contact [org email]." — ties to UX 5C |

---

## Build Order

Each module ships complete (contextual cues + help page together). Public-facing cues are woven into the relevant module phase.

```
Phase A — Foundation (HelpCallout, HelpTooltip, HelpPageLayout, CSS, lib/help-content/ data structure)
    ↓
Phase B — Tournaments (admin cues + help page)
Phase C — House League (admin cues + help page + public registration cues [UX 5I])
Phase D — Rep Teams (admin cues + help page + public tryout cues [UX 5C])
Phase E — Coaches Portal (first-visit screen + cues + help page)
Phase F — Accounting (admin + coaches cues + help page)
Phase G — Org Admin & Onboarding (cues + help page; coordinate with UX 3A/3B)
Phase H — Platform Admin (cues + help page)
    ↓
Phase I — Help Hubs & Navigation (admin hub page, context-aware sidebar links in all three portals)
```

### Context-aware sidebar link logic (Phase I)

`AdminSidebar.tsx` resolves the Help link target using `usePathname()`:

| Current path prefix | Help link resolves to |
|---|---|
| `.../admin/tournaments` or `.../admin/dashboard` | `help/tournaments` |
| `.../admin/house-league` | `help/house-league` |
| `.../admin/rep-teams` | `help/rep-teams` |
| `.../admin/accounting` | `help/accounting` |
| `.../admin/org` | `help/org` |
| Anything else | `help` (hub) |

`CoachesSidebar.tsx` — always links to `/{orgSlug}/coaches/help`.
Platform admin nav — always links to `/platform-admin/help`.
