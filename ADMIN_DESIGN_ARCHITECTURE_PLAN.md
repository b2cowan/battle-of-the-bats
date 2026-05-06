# Admin Design & Architecture Plan

**Created:** 2026-05-06  
**Status:** Under Review — pending user approval before implementation

---

## Summary

Two-track plan covering:

1. **Design System** — Completing the admin's FieldLogicHQ HUD branding by removing org `--primary` color leakage from content pages (admin chrome is already correctly branded)
2. **Architecture** — Low-effort sidebar restructure that draws a clean line between org-level and tournament-level admin, setting up future parallel modules (Leagues, Accounting, etc.) without a route rewrite

---

## Part 1: Admin Design System — Complete Option B

### Current State

The admin UI is already **split** between two styling approaches:

| Area | Current theming | Correct for Option B? |
|---|---|---|
| Admin shell (`.adminShell`, `.adminMain`) | `--pitch-black`, blueprint grid | ✅ Already done |
| Sidebar nav | `--pitch-black`, `--blueprint-blue`, `--logic-lime` | ✅ Already done |
| Dashboard stats | `--hud-surface`, `--blueprint-blue`, `--logic-lime` | ✅ Already done |
| Content page headers (`.headerIcon`) | `--primary-faint`, `--primary-light`, `--border` | ❌ Leaks org theme |
| Active states (view toggles, filter chips) | `--primary` | ❌ Leaks org theme |
| Search input focus ring | `--primary-light`, `--primary-faint` | ❌ Leaks org theme |
| Group section headings | `--primary-light` | ❌ Leaks org theme |
| Dropdown borders | `--border` (primary-derived) | ❌ Leaks org theme |
| Selected row highlight | `rgba(124, 58, 237, 0.05)` — hardcoded purple | ❌ Not even tokenized |

**The chrome is already done. Only content-page accents need updating.**

### Why this matters

When an org changes their theme to "neon" or "ocean" in Settings, the admin content pages shift color with them. An admin configuring their schedule shouldn't see lime-green filter chips because they chose a neon palette for their public site. The admin tool should always feel like the FieldLogicHQ platform, not a mirror of the public site.

### Token Replacement Map

| Current token (org theme) | Replacement (platform HUD) | Usage |
|---|---|---|
| `var(--primary)` | `var(--blueprint-blue)` | Active/selected backgrounds |
| `var(--primary-light)` | `var(--logic-lime)` | Active text, icons, accents |
| `var(--primary-faint)` | `rgba(var(--blueprint-blue-rgb), 0.12)` | Subtle icon backgrounds |
| `var(--primary-glow)` | `var(--glow-blue)` | Glow effects |
| `var(--border)` (primary-derived) | `rgba(var(--blueprint-blue-rgb), 0.3)` | Admin border contexts |
| Hardcoded `rgba(124, 58, 237, 0.05)` | `rgba(var(--blueprint-blue-rgb), 0.05)` | Row selected state |
| Focus ring `--primary-faint` | `rgba(var(--blueprint-blue-rgb), 0.15)` | Input focus |
| Focus border `--primary-light` | `var(--blueprint-blue)` | Input focus border |

**Exception — do NOT change:**
- The Settings page live preview section (uses dynamic inline `--primary` override intentionally — that IS a preview of the org theme)
- Any public-facing page CSS (outside of `admin/`)
- `globals.css` root tokens (these stay as-is)

### Files to Update

| File | Changes needed |
|---|---|
| `app/[orgSlug]/admin/admin-common.module.css` | `.headerIcon`, `.toggleActive`, `.chipActive`, `.searchInput:focus`, `.groupHeader strong`, `.dropdownMenu`, `.rowSelected` |
| `app/[orgSlug]/admin/members/members.module.css` | `.headerIcon`, `.seatBanner` border, any primary accent references |
| `app/[orgSlug]/admin/settings/settings.module.css` | `.headerIcon`, all primary accents — except the preview block |
| `app/[orgSlug]/admin/billing/billing.module.css` | `.headerIcon`, primary accent references |
| `app/[orgSlug]/admin/age-groups/admin-page.module.css` | Primary accent references |
| `app/[orgSlug]/admin/announcements/announcements-admin.module.css` | Primary accent references |
| `app/[orgSlug]/admin/diamonds/diamonds-admin.module.css` | Primary accent references |
| `app/[orgSlug]/admin/tournaments/tournaments-admin.module.css` | Primary accent references |
| `app/[orgSlug]/admin/teams/teams-admin.module.css` | Primary accent references |
| `app/[orgSlug]/admin/schedule/schedule-admin.module.css` | Primary accent references |

### Sidebar Logo Tweak (small)

The sidebar currently shows `"Admin Panel"` / `"Battle of the Bats"` hardcoded. Change to:
- Main line: `"FieldLogicHQ"` (platform brand)  
- Sub line: `org.name` (dynamic from `useOrg()` — already available)

This is a one-line change in `AdminSidebar.tsx` and removes a hardcoded string.

---

## Part 2: Admin Architecture — Nav Restructure for Platform Expansion

### Current Nav Inventory (as-built)

The sidebar currently renders items in two groups with no explicit labeling:

**Flat list (no section header):**
Dashboard, Tournaments, Announcements, Contacts, Age Groups, Registrations, Schedule, Results, Rules & Resources, Diamonds

**Owner-only `billingSection` div (also used for Archives — confusingly):**
Archives *(public link, different concept from the org-management items)*  
Billing, Settings, Members *(owner-only org management)*

### Org-Level vs. Tournament-Level Audit

| Nav Item | Current location | True scope |
|---|---|---|
| Dashboard | Flat list | Org-level (shows org-wide stats) |
| Tournaments | Flat list | Org-level (manages tournament records) |
| Announcements | Flat list | **Tournament-scoped** |
| Contacts | Flat list | **Org-level resource** (reused across tournaments) |
| Age Groups | Flat list | **Tournament-scoped** |
| Registrations (Teams) | Flat list | **Tournament-scoped** |
| Schedule | Flat list | **Tournament-scoped** |
| Results | Flat list | **Tournament-scoped** |
| Rules & Resources | Flat list | **Tournament-scoped** |
| Diamonds | Flat list | **Org-level resource** (reused across tournaments) |
| Archives | `billingSection` | Org-level (cross-tournament historical data) |
| Billing | Owner `billingSection` | **Org-level** |
| Settings | Owner `billingSection` | **Org-level** |
| Members | Owner `billingSection` | **Org-level** |

**Key insight:** Contacts and Diamonds are currently buried in the tournament nav but are org-wide resources. A user might expect to find their diamond locations alongside Settings, not next to Schedule.

### Proposed Sidebar Structure

```
──────────────────────────────
  FieldLogicHQ
  [Org Name]
──────────────────────────────
  [Editing Tournament: ▼ switcher]
──────────────────────────────
  TOURNAMENT
  ──────────
  Dashboard
  Tournaments
  Announcements
  Age Groups
  Registrations
  Schedule
  Results
  Rules & Resources
──────────────────────────────
  ORGANIZATION
  ────────────
  Members       (owner-only)
  Contacts
  Diamonds
  Archives
  Billing       (owner-only)
  Settings      (owner-only)
──────────────────────────────
  ← Back to Site
  Logout
──────────────────────────────
```

### What changes

1. **Add two labeled section headers** in `AdminSidebar.tsx` (`NAV_KEYS` split into `TOURNAMENT_NAV` and `ORG_NAV` arrays)
2. **Move Contacts and Diamonds** from the tournament section to the org section (sidebar only — no route changes)
3. **Move Archives** from the `billingSection` group to the org section (sidebar only — no route changes)
4. **Sidebar header** shows `"FieldLogicHQ"` + `org.name` (replaces hardcoded "Battle of the Bats")
5. **Section header CSS** — add `.sectionHeader` style: all-caps, monospace, `--blueprint-blue`, same treatment as HUD labels

**No route changes. No API changes. No data model changes.** This is a pure sidebar refactor.

### Future-Proofing: The Module Rail Pattern

When a second top-level module lands (e.g., "League", "Accounting"), the sidebar naturally extends by adding a third `NAV_KEYS` group. Each group would have its own section header, its own set of items, and the existing per-section divider line.

The mental model this establishes now:
- **Org section** = persistent, always visible regardless of which module you're in
- **Tournament section** = the current active module (context: one tournament at a time, switcher at top)
- **Future modules** = additional sections with their own switcher (e.g., "League: [name]")

This avoids the need for a full top-level module-picker UI now, while making it a natural incremental addition later. The route structure (`/[orgSlug]/admin/[item]`) doesn't need to change — the section headers are visual metadata, not routing.

### Low-Effort Quick Win: `communication/` Page

The `communication/` page currently exists in the route tree but has no sidebar nav entry. If it's live functionality, it should be added to the Tournament section. If it's not ready, it should either be removed or stubbed behind an owner-only flag. Worth a quick check before nav restructure.

---

## Implementation Order

This plan is sequenced so each phase is independently shippable:

### Phase 1 — Sidebar restructure (nav labels + reorder)
**Files:** `components/admin/AdminSidebar.tsx`, `components/admin/AdminSidebar.module.css`  
**Effort:** ~1–2 hours  
**Risk:** None — purely visual, no routes or data touched  
**Ships:** Section headers, Contacts/Diamonds moved to Org section, Archives moved, sidebar logo fixed

### Phase 2 — Admin content page theme cleanup
**Files:** `admin-common.module.css` + 9 individual page `.module.css` files  
**Effort:** ~2–3 hours  
**Risk:** Low — CSS only, visual review needed  
**Ships:** Full Option B theming — org color no longer leaks into admin content pages

### Phase 3 — (Future) Module rail
**When:** First new module (League or Accounting) is designed  
**Effort:** Sidebar only — add a third nav section with its own section header  
**No route changes required** if the pattern established in Phase 1 is followed consistently

---

## Out of Scope (explicitly not in this plan)

- Route restructuring (e.g., `/admin/tournament/[slug]/schedule`) — deferred; no user need triggers this yet
- Moving Contacts or Diamonds to a separate DB scope — they already belong to the org
- A top-level module picker UI — not needed until there are two modules
- Subnav or breadcrumb changes — out of scope for this phase
