# Archives Expansion Plan

Picks up from Item 4 in `TOURNAMENT_LIFECYCLE_PLAN.md`. Items 1–3 are already shipped. This plan covers the admin-side archives gap and public ledger improvements.

---

## Current State (post-items-1-3)

| Location | State |
|---|---|
| `app/[orgSlug]/archives/page.tsx` | Public Digital Ledger — working |
| `app/[orgSlug]/archives/[archiveId]/page.tsx` | Full archive detail — working |
| `app/[orgSlug]/admin/archives/page.tsx` | Does not exist |
| AdminSidebar "Archives" link | Points to public ledger (`/{orgSlug}/archives`) |
| Archived-status tournaments | Hidden from context switcher (item 3) and public pages — no admin view |

**Dead zone after item 3:** A tournament set to `status = 'archived'` without first being sealed is now invisible everywhere — it's dropped from the admin switcher, invisible on public pages, and not in the Digital Ledger. Admins have no way to find or act on it.

---

## Phase A — Admin Archives Page (core, ~1 day)

### Goal
Give admins a single screen that shows the full picture of all closed-lifecycle tournaments: what's sealed (immutable) and what's archived-but-not-yet-sealed (actionable).

### Files

| File | Action |
|---|---|
| `app/[orgSlug]/admin/archives/page.tsx` | NEW |
| `components/admin/AdminSidebar.tsx` | MODIFY — reroute Archives link |
| `app/api/admin/seal-tournament/route.ts` | MODIFY — extend status guard |

---

### A1. New admin archives page

**Path:** `app/[orgSlug]/admin/archives/page.tsx`

**Pattern:** `'use client'` — matches the tournaments page pattern; needs client-side state for the seal confirmation modal.

**Data fetching (in `useEffect` after `currentOrg` resolves):**
```typescript
const [ts, archives] = await Promise.all([
  getTournamentsByOrg(currentOrg.id),    // all statuses including archived
  getArchivesByOrg(currentOrg.id),       // sealed records
]);
```
Both functions already exist in `lib/db.ts` and use the anon Supabase client (RLS allows org members to see their own data). No new DB functions needed.

**Derived state:**
```typescript
const sealedTournamentIds = new Set(archives.map(a => a.tournamentId).filter(Boolean));
const archivedUnsealed = ts.filter(
  t => t.status === 'archived' && !sealedTournamentIds.has(t.id)
);
```

**Layout — two sections:**

**Section 1: Sealed Records**
- Columns: Season · Tournament · Division · Champion · Teams · Games · Integrity · Detail link
- Uses the admin HUD design tokens (`--hud-surface`, `--blueprint-blue`, `--logic-lime`) — NOT the public page monochrome theme
- Read-only; each row links to `/{orgSlug}/archives/{archiveId}` (public detail page)
- If empty: "No sealed records. Seal a completed tournament from the Tournaments page."

**Section 2: Archived — Pending Seal**
- Columns: Tournament · Year · "Seal Now" button
- Shows only tournaments where `status === 'archived'` and not already sealed
- "Seal Now" button opens the same `FeedbackModal` confirmation flow as the tournaments page (`openSealConfirm` → `handleSeal`)
- If empty: "All archived tournaments have been sealed." (or "No archived tournaments.")

**Seal flow (reuse):**
Copy `openSealConfirm` and `handleSeal` from `app/[orgSlug]/admin/tournaments/page.tsx` verbatim. They call `POST /api/admin/seal-tournament` and handle the confirmation modal. No refactoring of shared code — the two pages are independent enough that extraction would be premature.

**Capability guard:**
Only show the "Seal Now" button if the user has `seal_tournaments` capability. Use `useOrg()` → `userRole` as a rough guard (same as the tournaments page does implicitly). Full enforcement is server-side anyway.

---

### A2. Sidebar update

**File:** `components/admin/AdminSidebar.tsx`

Remove the hardcoded inline Archives `navLink` call (lines 118–124). Add `archives` as a proper entry in `ORG_NAV`:

```typescript
const ORG_NAV = [
  { key: 'diamonds', icon: MapPin,  label: 'Diamonds' },
  { key: 'archives', icon: Archive, label: 'Archives'  },
];
```

The `ORG_NAV` renderer already computes `href = \`${base}/${item.key}\`` and `active = pathname.startsWith(href)`, so this will correctly:
- Link to `/{orgSlug}/admin/archives`
- Highlight as active when on that page
- NOT match the public `/{orgSlug}/archives` path

The `Archive` icon is already imported in the sidebar.

---

### A3. Seal API guard extension

**File:** `app/api/admin/seal-tournament/route.ts`, line 38–43

Currently blocks sealing unless `status === 'completed'`. After item 3, a tournament can reach `archived` state without being sealed first. The admin archives page shows a "Seal Now" button for those tournaments — but the API would reject them.

**Change:** Accept both `completed` and `archived` as valid pre-seal statuses.

```typescript
// Before
if (tournament.status !== 'completed') {

// After
if (tournament.status !== 'completed' && tournament.status !== 'archived') {
```

Update the error message accordingly:
```
'Tournament must be completed or archived before sealing.'
```

**Rationale:** Both `completed` and `archived` represent a tournament that is done. The seal guard's intent is to prevent sealing a live or draft tournament — not to block already-retired ones.

**Risk:** Low. The check is additive (relaxing a constraint), and the rest of the seal logic (snapshot, integrity hash, insert) is identical regardless of which done-status triggered it.

---

## Phase B — Public Ledger Improvements (assessed, not scheduled)

### B1 — Year grouping (Medium complexity)

**Problem:** If an org runs separate tournament records per age group (e.g., "Battle 2024 U11" and "Battle 2024 U13" as distinct tournament rows), the Digital Ledger shows two unrelated rows with the same `season`. Visually these feel disconnected.

**Approach:** Group the flat `archives` array by `season` before rendering. Within each year group, render a collapsible or visually separated sub-section. The existing table structure would need to become a grouped layout.

**Complexity:** Medium. All data is available from `getArchivesByOrg` — it's a pure display change. But it significantly restructures the table into a nested/grouped layout. The single-tournament-per-season common case renders identically, so there's no regression risk for existing data.

**Effort estimate:** ~2–3 hours.

**Hold for:** After real sealed data exists in production so the grouping need can be confirmed. Not urgent today.

---

### B2 — Back-to-admin link for authenticated users (Low complexity)

**Problem:** When an admin navigates from `/{orgSlug}/admin/archives` → `/{orgSlug}/archives/{archiveId}` (public detail page), the "← Archives" back link goes to the public ledger, not back to the admin page. No way to return to admin without the browser back button.

**Approach — Option 1 (server-side auth check):**
The detail page is a server component. Import `getAuthContextWithScope()` and conditionally render an admin back link if the viewer is an authenticated org member.

```tsx
// In app/[orgSlug]/archives/[archiveId]/page.tsx
const ctx = await getAuthContextWithScope().catch(() => null);
const isAdmin = ctx?.org?.id === org.id;
// render: {isAdmin && <Link href={`/${orgSlug}/admin/archives`}>← Admin Archives</Link>}
```

**Approach — Option 2 (query param):**
Pass `?from=admin` when linking from the admin page. The detail page reads the search param and conditionally renders an admin back link. No server auth check needed.

**Preferred:** Option 1 — cleaner, no URL pollution, no state management.

**Effort estimate:** ~30 minutes.

**Also applies to:** `app/[orgSlug]/archives/page.tsx` (public ledger). Same auth check to add an "Admin →" link in the header.

---

## Build Order Recommendation

| Priority | Phase | Effort | Value | Implement? |
|---|---|---|---|---|
| 1 | A — Admin archives page | ~1 day | Closes the admin dead zone | Yes — this sprint |
| 2 | B2 — Back-to-admin link | ~30 min | Quick UX win | Yes — bundle with Phase A |
| 3 | B1 — Year grouping | ~3 hours | Cosmetic, data-dependent | Defer |

**Recommended implementation order within Phase A:**
1. `app/api/admin/seal-tournament/route.ts` — status guard extension (trivial, unblocks everything)
2. `app/[orgSlug]/admin/archives/page.tsx` — admin page (main build)
3. `components/admin/AdminSidebar.tsx` — sidebar wiring (last, so the link doesn't 404 until the page exists)
4. (Optional, same session) B2 back-to-admin links on public pages

---

## What This Does NOT Change

- Public Digital Ledger layout and data — unchanged
- The public archive detail page — only an optional admin back-link addition (B2)
- The seal route snapshot logic — only the status guard is touched
- `lib/db.ts` — no new functions; existing `getTournamentsByOrg` and `getArchivesByOrg` are sufficient
