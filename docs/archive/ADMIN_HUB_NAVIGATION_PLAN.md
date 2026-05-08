> **DEPRECATED** — Superseded by [PLATFORM_ROADMAP.md](../../PLATFORM_ROADMAP.md). All tasks complete. This file is retained for historical context only.

# Admin Hub Navigation Plan

Restructures the admin shell from a flat mixed sidebar into a section-aware hub architecture: an org landing page that routes users to their relevant area, with each section (Org Admin, Tournament Operations, and future modules) getting its own URL prefix and sidebar nav.

---

## Status Legend
- [ ] Not started
- [x] Complete

---

## Goals

1. Separate **org-level administration** (members, billing, settings, tournament management, diamonds, archives) from **tournament operations** (schedule, results, registrations, etc.)
2. Give every user type a clean, unambiguous landing experience — no sidebar links to sections they cannot access
3. Establish the URL and layout pattern that every future module (house league, rep teams, public site) will follow from day one
4. Wire the module capability system (Phase A) into the hub tile visibility so access control is automatic

---

## Section Taxonomy

| Section | Contains | URL prefix | Module cap gate |
|---|---|---|---|
| **Org Admin** | Members, Settings, Billing, Diamonds, Archives, Tournament management (create/seal) | `/[orgSlug]/admin/org/` | `module_members` (or owner role) |
| **Tournament Operations** | Dashboard, Age Groups, Registrations, Contacts, Schedule, Results, Announcements, Communication, Rules | `/[orgSlug]/admin/` (unchanged) | `module_tournaments` |
| **Future modules** | House League, Rep Teams, Public Site, Accounting | `/[orgSlug]/admin/[module-slug]/` | per-module cap |

**Key distinction:** The "Tournaments" management page (create/edit/seal tournament records) is an **org admin** function — it manages the org's tournament entities. Tournament *operations* (running a tournament day-to-day) are a separate section.

---

## URL Restructure

| Current URL | New URL | Notes |
|---|---|---|
| `/[orgSlug]/admin/` | `/[orgSlug]/admin/` | **Replaced** — becomes the hub tile page |
| `/[orgSlug]/admin/` (dashboard) | `/[orgSlug]/admin/dashboard/` | Current `page.tsx` moves here |
| `/[orgSlug]/admin/tournaments/` | `/[orgSlug]/admin/org/tournaments/` | Tournaments mgmt page moves to org section |
| `/[orgSlug]/admin/members/` | `/[orgSlug]/admin/org/members/` | |
| `/[orgSlug]/admin/members/audit/` | `/[orgSlug]/admin/org/members/audit/` | |
| `/[orgSlug]/admin/settings/` | `/[orgSlug]/admin/org/settings/` | |
| `/[orgSlug]/admin/billing/` | `/[orgSlug]/admin/org/billing/` | |
| `/[orgSlug]/admin/billing/mock-portal/` | `/[orgSlug]/admin/org/billing/mock-portal/` | |
| `/[orgSlug]/admin/diamonds/` | `/[orgSlug]/admin/org/diamonds/` | |
| `/[orgSlug]/admin/archives/` | `/[orgSlug]/admin/org/archives/` | |
| `/[orgSlug]/admin/age-groups/` | unchanged | |
| `/[orgSlug]/admin/announcements/` | unchanged | |
| `/[orgSlug]/admin/communication/` | unchanged | |
| `/[orgSlug]/admin/contacts/` | unchanged | |
| `/[orgSlug]/admin/results/` | unchanged | |
| `/[orgSlug]/admin/rules/` | unchanged | |
| `/[orgSlug]/admin/schedule/` | unchanged | |
| `/[orgSlug]/admin/teams/` | unchanged | |
| `/[orgSlug]/admin/onboarding/` | unchanged | Org setup flow — keep at existing URL |
| *(new)* `/[orgSlug]/admin/tournaments/` | `/[orgSlug]/admin/tournaments/` | New smart redirect entry point |

---

## Architecture

### Hub Page (`/[orgSlug]/admin/page.tsx`)

Replaces the current tournament dashboard as the admin landing. Renders a tile grid — one tile per section the current user can access, gated by module caps. The existing dashboard stats page (`page.tsx`) moves to `/admin/dashboard/`.

**Tile definitions:**

| Tile | Icon | Destination | Visible when |
|---|---|---|---|
| Tournament Management | `Trophy` | `/[orgSlug]/admin/tournaments/` (smart redirect) | `hasCapability(role, caps, 'module_tournaments')` |
| Organization Admin | `Building2` | `/[orgSlug]/admin/org/members` | `module_members` OR `role === 'owner'` |
| *(future)* House League | `Users` | `/[orgSlug]/admin/house-league/` | `hasCapability(role, caps, 'module_house_league')` |
| *(future)* Rep Teams | `Shield` | `/[orgSlug]/admin/rep-teams/` | `hasCapability(role, caps, 'module_rep_teams')` |
| *(future)* Public Site | `Globe` | `/[orgSlug]/admin/public-site/` | `hasCapability(role, caps, 'module_public_site')` |
| *(future)* Accounting | `DollarSign` | `/[orgSlug]/admin/accounting/` | `hasCapability(role, caps, 'module_accounting')` |

A user who only has `module_tournaments` sees exactly one tile and can be auto-forwarded (see Smart Redirect below).

### Smart Tournament Entry Point (`/[orgSlug]/admin/tournaments/page.tsx`)

A lightweight client component that reads `useTournament()` and redirects:

```tsx
const live = tournaments.filter(t => t.status === 'active');
if (live.length === 1) router.replace(`/${slug}/admin/dashboard`);
else                   router.replace(`/${slug}/admin/org/tournaments`);
```

No user-visible UI — just a loading spinner while the redirect resolves.

### Sidebar Section Detection (`components/admin/AdminSidebar.tsx`)

The sidebar detects which section it is in from the pathname and renders accordingly. No nested layout context required — pathname is sufficient.

```ts
const isHub       = pathname === base;
const isOrgAdmin  = pathname.startsWith(`${base}/org`);
// tournament operations: everything else
```

**Hub mode** (`isHub`): sidebar renders logo + footer only (no nav items). The hub tiles are the navigation.

**Org Admin mode** (`isOrgAdmin`): renders the Org Admin nav group + a `← All Sections` back link to the hub at the top.

**Tournament mode** (default): renders the Tournament Operations nav group + tournament switcher + `← All Sections` back link.

### Org Admin Nested Layout (`app/[orgSlug]/admin/org/layout.tsx`)

A minimal passthrough layout. No additional providers needed — `OrgProvider` and `TournamentProvider` are already in the parent `admin/layout.tsx`. The nested layout exists to allow future Org Admin-specific UI wrappers (e.g., an Org Admin header bar) without touching the parent layout.

```tsx
export default function OrgAdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

---

## Sidebar Navigation

### Org Admin nav (shown when `isOrgAdmin`)

```
← All Sections
─────────────────
Organization Admin
  Tournaments        /admin/org/tournaments   (RefreshCw)
  Members            /admin/org/members       (Users2)      module_members cap
  Diamonds           /admin/org/diamonds      (MapPin)
  Archives           /admin/org/archives      (Archive)
  Settings           /admin/org/settings      (Settings)    owner only
  Billing            /admin/org/billing       (CreditCard)  owner only
```

The existing owner-only guard on Settings and Billing moves from a role check to a combined role + capability check consistent with the rest of the system.

### Tournament Operations nav (shown when `!isHub && !isOrgAdmin`)

```
← All Sections
─────────────────
[ Tournament Switcher ]
─────────────────
Tournament
  Dashboard          /admin/dashboard         (LayoutDashboard)
  Announcements      /admin/announcements     (Megaphone)
  Contacts           /admin/contacts          (BookUser)
  Age Groups         /admin/age-groups        (Tag)
  Registrations      /admin/teams             (Users)
  Schedule           /admin/schedule          (Calendar)
  Results            /admin/results           (Trophy)
  Rules & Resources  /admin/rules             (BookOpen)
  Communication      /admin/communication     (Mail)
```

---

## Build Order

### Step 1 — Move org admin pages to `/admin/org/`

- [x] **1.1** — Move `app/[orgSlug]/admin/members/` → `app/[orgSlug]/admin/org/members/` (page.tsx + members.module.css + audit/)
- [x] **1.2** — Move `app/[orgSlug]/admin/settings/` → `app/[orgSlug]/admin/org/settings/`
- [x] **1.3** — Move `app/[orgSlug]/admin/billing/` → `app/[orgSlug]/admin/org/billing/` (including mock-portal/)
- [x] **1.4** — Move `app/[orgSlug]/admin/diamonds/` → `app/[orgSlug]/admin/org/diamonds/`
- [x] **1.5** — Move `app/[orgSlug]/admin/archives/` → `app/[orgSlug]/admin/org/archives/`
- [x] **1.6** — Move `app/[orgSlug]/admin/tournaments/` → `app/[orgSlug]/admin/org/tournaments/` (page.tsx + CSS)

### Step 2 — Relocate the tournament dashboard

- [x] **2.1** — Move `app/[orgSlug]/admin/page.tsx` and `dashboard.module.css` → `app/[orgSlug]/admin/dashboard/`
- [x] **2.2** — Fix the dashboard's internal `base` links (all `${base}/...` hrefs are unchanged — they don't include `/dashboard/` in the path)

### Step 3 — Create new hub entry points

- [x] **3.1** — Create `app/[orgSlug]/admin/page.tsx` — hub tile grid (see Hub Page spec above). Import `hasCapability` from `@/lib/roles`, destructure `userRole` + `userCapabilities` from `useOrg()`. Single-module users (only `module_tournaments`) are auto-forwarded to `/admin/tournaments/`.
- [x] **3.2** — Create `app/[orgSlug]/admin/tournaments/page.tsx` — smart redirect (live count → dashboard or org/tournaments).
- [x] **3.3** — Create `app/[orgSlug]/admin/org/layout.tsx` — passthrough layout (see spec above).

### Step 4 — Rework AdminSidebar

- [x] **4.1** — Add section detection (`isHub`, `isOrgAdmin`) based on pathname
- [x] **4.2** — Hub mode: render logo + footer only (no nav groups)
- [x] **4.3** — Org Admin mode: render org nav list + `← All Sections` link. Move Diamonds and Archives from `ORG_NAV` to this group. Add Tournaments (management), Members, Settings, Billing here. Apply module cap gate on Members.
- [x] **4.4** — Tournament mode: render tournament ops nav + switcher + `← All Sections` link. Remove Diamonds, Archives, Members, Billing, Settings from this sidebar.
- [x] **4.5** — Update all `navLink` hrefs that point to moved pages (`/admin/members` → `/admin/org/members`, etc.)
- [x] **4.6** — Add `← All Sections` link component at top of both org and tournament sidebars (links to `/${orgSlug}/admin`)

### Step 5 — Update internal links across the codebase

- [x] **5.1** — Audit all `href` / `router.push` references to `/admin/members`, `/admin/settings`, `/admin/billing`, `/admin/diamonds`, `/admin/archives`, `/admin/tournaments` — update to `/admin/org/[page]`
- [x] **5.2** — Update `AdminBottomNav` if it references any moved pages
- [x] **5.3** — Update the audit log page's back-link (`/admin/members` → `/admin/org/members`)
- [x] **5.4** — Update onboarding page's completion redirect (likely points to `/admin/`)
- [x] **5.5** — Search for any hardcoded org admin paths in API routes, emails, or redirect helpers

---

## Future Module Integration Pattern

When a new module is added (e.g., House League):

1. Create route directory: `app/[orgSlug]/admin/house-league/` with its own `layout.tsx` and pages
2. Add a tile entry to the hub page (`admin/page.tsx`) — the module cap gates visibility automatically
3. Add a sidebar nav group to `AdminSidebar.tsx` for the new section (detected when `pathname.startsWith(`${base}/house-league`)`)
4. Follow the Phase B checklist from `MODULE_CAPABILITIES_PLAN.md` (route handler gate, page guard, sidebar gate)

No changes to other sections are required — the hub is additive by design.

---

## What Does NOT Change

- All tournament operations page components and their CSS — no content changes, only file location for `/admin/dashboard/`
- The admin `layout.tsx` — `OrgProvider`, `TournamentProvider`, auth redirect unchanged
- The `TournamentContext` and `OrgContext`
- All API routes under `app/api/admin/`
- RLS policies and capability checks within page components
- The `AdminBottomNav` component (except any org admin links it may contain — see Step 5.2)
- The onboarding flow page component itself
