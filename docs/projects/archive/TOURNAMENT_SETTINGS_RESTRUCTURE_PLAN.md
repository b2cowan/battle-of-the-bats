# Tournament Admin — Settings & Access Restructure Plan

**Created:** 2026-05-27
**Branch:** dev
**Status:** Ready to implement
**PM Brief:** `docs/projects/active/TOURNAMENT_SETTINGS_RESTRUCTURE_PM_BRIEF.md`

---

## Background

The current Settings & Access hub uses a 3-tab structure with unevenly populated tabs, dead navigation links, and misplaced items. This plan consolidates tournament configuration into logical, role-appropriate surfaces:

1. **Event Settings** becomes the single source of truth for all per-tournament configuration (dates, fees, rules, identity, lifecycle)
2. **The sidebar** surfaces the most-used settings actions directly (create tournament, notifications, registration questions)
3. **Settings & Access hub** is simplified to a flat, tier-aware grid (or removed entirely for League/Club)
4. **Locked cards** get a real upgrade path instead of a dead `pointer-events: none` state

### What we already changed (pre-plan)
- `settings/organization/page.tsx` — dead re-export deleted
- `settings/event/page.tsx` — gate opened to admins (was owner-only)
- `org/settings/page.tsx` — Scoring (requireScoreFinalization) removed; lives in Event Settings only
- Design copy flag added to `memory/design_decisions.md` re: org/settings subtitle for T/T+

---

## Phase 1 — Event Settings: Tournament Identity + Lifecycle

**Goal:** Event Settings becomes the single place to manage all per-tournament configuration. Eliminates need for a separate edit action on the sidebar.

### What to add

**Section A — Tournament Identity** (insert at top, before Dates)
- Tournament Name — text input, max 80 chars, saves via existing `action:'update'`
- Year — number input (4-digit)
- Slug — text input with inline availability check (reuse slug-check pattern from `org/tournaments` create flow) + a prominent change warning: _"Changing your slug breaks all existing registration links, public URLs, and any coach emails already sent."_

**Section B — Tournament Lifecycle** (insert at bottom, before Save footer)
- Status selector — segmented control: `Draft` / `Active` / `Completed` (three states only — no Archive here)
  - `Draft → Active`: show inline warning if setup checklist items are incomplete (reference existing dashboard checklist logic — `hasFees`, `hasGameTiming`, etc.)
  - `Active → Completed`: standard confirmation modal
  - `Completed → Draft`: allow (useful if marked complete accidentally)

**Phase 1B — Archive button on Dashboard** (separate sub-task)
- Render an "Archive Tournament" button on the dashboard page when `currentTournament.status === 'completed'` and `userRole === 'owner'`
- Confirm modal copy: _"Archiving seals this tournament permanently. Archived tournaments are read-only and appear under Past Tournaments. This cannot be undone."_ Red confirm button.
- On confirm: `POST /api/admin/tournaments` with `action: 'update'`, `status: 'archived'` (or whichever archive action the API exposes — verify before implementing)
- After success: refresh tournament context; sidebar and switcher reflect `archived` status
- File: `app/[orgSlug]/admin/tournaments/dashboard/page.tsx`

**API:** No new routes needed. `POST /api/admin/tournaments` with `action: 'update'` already handles `name`, `slug`, `year`, `status`. Slug availability check reuses the existing slug-check route or the same inline fetch pattern from `org/tournaments` page.

**Files:**
- `app/[orgSlug]/admin/tournaments/settings/event/page.tsx`
- Import `SlugStatus` pattern for slug availability check (see `org/tournaments/page.tsx` for the existing implementation)

---

## Phase 2 — Sidebar: `+` Create Tournament Button

**Goal:** Surface tournament creation where the user already thinks about which tournament they're managing — no navigating to a separate page.

### Implementation

Add a `+` icon button immediately to the right of the tournament switcher `<select>` in the `isTournaments` sidebar section.

**Slot-limit logic:**
```
import { effectiveTournamentLimit } from '@/lib/plan-config';

const tournamentLimit = effectiveTournamentLimit(currentOrg.planId, currentOrg.storedTournamentLimit ?? null);
const atSlotLimit = tournaments.length >= tournamentLimit;
```

**Button states:**
- `atSlotLimit && userRole === 'owner'` → disabled, tooltip: _"All [N] tournament slot[s] used. Upgrade your plan to add more."_ Clicking navigates to `org/billing`.
- `atSlotLimit && userRole !== 'owner'` → disabled, tooltip: _"Tournament slot limit reached. Ask your org owner to upgrade."_
- Not at limit → opens `TournamentSetupWizard` in a modal overlay (wizard already exists at `components/admin/TournamentSetupWizard.tsx`).

**Note:** `tournamentLimit` is `9999` for Tournament Plus, League, and Club — the `+` button will effectively never be disabled for paid plans.

**No `✏` edit button needed** — name, slug, dates, status all live in Event Settings (Phase 1).

**Files:**
- `components/admin/AdminSidebar.tsx` — add button, modal state, `TournamentSetupWizard` modal wrapper
- `components/admin/AdminSidebar.module.css` — `.switcherActions` row styles (flex row containing the `<select>` + `+` button)

---

## Phase 3 — Settings & Access Hub: Flatten + Tier-Aware

**Goal:** Remove the 3-tab structure. Replace with a single flat grid that is tier-appropriate and has real upgrade paths.

### Card set after restructure

| Card | T / T+ | League / Club | Notes |
|---|---|---|---|
| Registration Questions | ✅ Show | ✅ Show | Plus-gated; locked card is now a link |
| Staff & Access | ✅ Show | ❌ Hidden | Org admin handles members for L/C |
| Plan & Subscription | ✅ Show | ❌ Hidden | Org admin handles billing for L/C |
| Tournaments & Seasons | ❌ Remove | ❌ Remove | Replaced by Phase 1 + Phase 2 |
| Tournament Notifications | ❌ Remove | ❌ Remove | Moved to sidebar footer in Phase 4 |

**Determine tier via:** `currentOrg && ['league', 'club'].includes(currentOrg.planId)` = League/Club; otherwise T/T+.

**Locked card fix:**
- Remove `pointer-events: none` from `.lockedCard` in CSS
- Wrap locked cards in `<Link href={subscriptionHref}>` instead of `<div>` — same as enabled cards
- Keep the visual locked state (opacity, lock icon, tier label) — just make it clickable

**For League/Club:** Settings & Access hub shows only 1 card (Registration Questions). This is too sparse for a hub page — the sidebar item for Settings & Access is removed for League/Club in Phase 4 and Registration Questions becomes a direct sidebar nav item instead.

**Files:**
- `app/[orgSlug]/admin/tournaments/settings/page.tsx` — full restructure; remove tab state, tier-aware card arrays
- `app/[orgSlug]/admin/tournaments/settings/settings-access.module.css` — remove `.lockedCard { pointer-events: none }`; grid stays 2-col

---

## Phase 4 — Sidebar: Nav Additions + Role Gating

**Goal:** Surface Registration Questions and Tournament Notifications where users expect them. Clean up role-based visibility.

### Changes to `TOUR_GROUPS` / sidebar rendering

**A — Registration Questions nav item (Setup group)**
Add after `settings/event`:
```javascript
{ key: 'settings/registration-fields', icon: ClipboardList, label: 'Registration Questions' }
```
- Visible to all roles (page handles the plan gate and shows upgrade CTA if needed)
- For League/Club: this becomes their only tournament settings entry point (Settings & Access hub removed for them)

**B — Remove Settings & Access from Admin group for League/Club**
The `Admin` group's `settings` item should only render when `hasOnlyTournamentWorkspace` is true (T/T+). League/Club users manage staff and billing in org admin; they don't need the tournament admin hub.

**C — Tournament Notifications in Admin group**
Add to `TOUR_GROUPS` Admin group (not the footer — footer is reserved for the Preview Site external action):
```javascript
{ key: 'settings/notifications', icon: Bell, label: 'Notification Prefs' }
```
- No role filter — all roles can manage their own notification preferences
- Visible to all: owner, admin, staff, official
- Result by tier:
  - T/T+: Admin group = Settings & Access · **Notification Prefs** · Past Tournaments
  - League/Club: Admin group = **Notification Prefs** · Past Tournaments (Settings & Access removed per item B)

**D — Event Settings: hide from staff/official in sidebar**
Add a `roles` property to `TourNavItem`:
```typescript
type TourNavItem = { key: string; icon: React.ElementType; label: string; roles?: OrgRole[] };
```
Set `roles: ['owner', 'admin']` on the `settings/event` item. Filter at render:
```javascript
group.items.filter(item => !item.roles || item.roles.includes(userRole))
```

**E — Registration Questions: same role filter**
Set `roles: ['owner', 'admin']` — staff and officials don't need to configure registration fields.

**Files:**
- `components/admin/AdminSidebar.tsx` — TOUR_GROUPS type update, items added/filtered, footer link added

---

## Scope boundary — org/tournaments/manage page

After Phases 1–4, the `org/tournaments/manage` page (`/{orgSlug}/admin/org/tournaments`) loses its primary purpose (create + edit are gone). It still serves as a full tournament list and is linked from the "Past Tournaments" sidebar item. Leave it as-is for now. **Future goal:** retire the manage page entirely once the dashboard Archive button is in place and the `+` sidebar button is confirmed stable. The Past Tournaments sidebar item can then link to the archives page directly.

---

## File change summary

| File | Phase | Change |
|---|---|---|
| `app/[orgSlug]/admin/tournaments/settings/event/page.tsx` | 1 | Add Identity section (name, slug, year) + Status selector (Draft/Active/Completed only) |
| `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` | 1B | Add Archive button (completed status + owner only, confirm modal) |
| `app/[orgSlug]/admin/tournaments/settings/page.tsx` | 3 | Remove tabs; tier-aware flat grid; fix locked cards |
| `app/[orgSlug]/admin/tournaments/settings/settings-access.module.css` | 3 | Remove `pointer-events: none` from lockedCard |
| `components/admin/AdminSidebar.tsx` | 2, 4 | `+` button; nav additions; role gating; Admin group Notifications item |
| `components/admin/AdminSidebar.module.css` | 2, 4 | Switcher action row styles |

No new DB migrations. No new API routes. All operations use existing endpoints.

---

## Decisions resolved (2026-05-27)

1. **Slug in Event Settings** — ✅ Include in Event Settings, owner-only, strong inline warning (goal is to retire the manage page over time).

2. **Archive action** — ✅ **Not in Event Settings.** Archive button lives on the **Dashboard**, visible only when `status === 'completed'` and `userRole === 'owner'`. Requires a confirmation modal. Event Settings status selector covers Draft / Active / Completed only.

3. **Notification Prefs placement** — ✅ **Admin group in TOUR_GROUPS** (not sidebar footer). Sits alongside Settings & Access and Past Tournaments. For League/Club (no Settings & Access), the Admin group becomes: Tournament Notifications · Past Tournaments.

4. **Registration Questions role gate** — ✅ Hidden from staff and officials entirely. Owner/admin only in sidebar.
