# Age Group Preference Persistence & Content Filtering Plan

## Goal

Eliminate the per-page age group re-selection friction for tournament spectators. A parent following U13 should click that tab once and have it remembered across every public page for the duration of their visit.

This plan covers two phases:
- **Phase A** — Cookie-based tab persistence for Schedule, Standings, and Teams (no schema changes)
- **Phase B** — Division tagging for News and Rules, with admin UI and DB migrations

---

## 1. Persistence Mechanism — Cookie

**Chosen:** Browser cookie, key `fl_agpref_{orgSlug}`, value = age group **name** (e.g. `U13`), `max-age=604800` (7 days), `Path=/`.

### Why cookie over alternatives

| Option | Problem |
|---|---|
| `localStorage` | Cannot be read by server components (news, rules are server components) |
| URL search param `?div=U13` | Clutters every URL; nav links must all forward the param; breaks shareability |
| OrgNavContext extension | Client-side only; server components cannot access React context |
| **Cookie** | Read by both `document.cookie` (client) and `next/headers cookies()` (server); browser sends automatically with every request |

**Why age group name, not ID:** IDs are DB-specific and change between tournament years. Names (`U11`, `U13`, `U15`…) are semantically stable and match across tournaments, so a returning parent gets their division pre-selected for the new season without config.

**Per-org scoping:** The `{orgSlug}` suffix in the cookie key means preferences are isolated between different tournament organisations sharing the same browser.

---

## 2. Division Selector UI

**No changes to Navbar.** The existing per-page tab bars on Schedule, Standings, and Teams are the division selector. Making them persist via cookie gives the UX improvement with zero layout change.

**Tab interaction contract (Phase A):**
- On mount: read cookie → if value matches one of the loaded age group names, initialise `activeGroup` to that group's ID instead of always defaulting to `groups[0]`
- On tab click: write cookie with the selected group's name, then set `activeGroup` as today

**Teams page special case:** Teams has an "All" tab (`activeGroup === 'all'`). Selecting "All" does **not** write or clear the cookie (it's a teams-only view mode, not a division preference signal). Selecting a specific division tab writes the cookie as normal.

**News and Rules (Phase B):** When a division preference is set AND division-tagged content exists, show a compact filter chip above the content:
> Filtering for: **U13** · [View all →](#)

"View all" links to the same URL with `?view=all` appended. The server component checks `searchParams.view` and skips cookie filtering when set.

**Mobile consideration:** No navbar changes = no mobile regression. The tab bars are already horizontally scrollable on narrow viewports.

---

## 3. News Tagging Model (Phase B)

### Schema change

```sql
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS age_group_ids uuid[] DEFAULT NULL;
```

`NULL` means "broadcast — show to all divisions." An empty array `{}` is treated identically to NULL (no filter).

### Type change (`lib/types.ts`)

```ts
export interface Announcement {
  id: string;
  tournamentId: string;
  title: string;
  body: string;
  date: string;
  pinned: boolean;
  ageGroupIds?: string[] | null; // null = all divisions
}
```

### Filter logic (JS, post-fetch)

```ts
// In getAnnouncements or in the news page
const filtered = preferredGroupId
  ? raw.filter(a => !a.ageGroupIds?.length || a.ageGroupIds.includes(preferredGroupId))
  : raw;
```

Records with `ageGroupIds = null` or `[]` always pass the filter.

### Admin UI change

In the add/edit modal (`app/[orgSlug]/admin/announcements/page.tsx`), add a collapsible "Division Visibility" section below the body textarea:

```
[ ] All divisions (default)
[ ] U11
[x] U13
[ ] U15
[ ] U17
```

"All divisions" is checked when `ageGroupIds` is null/empty; checking it clears all individual selections. Selecting any individual division unchecks "All divisions". Age groups are loaded from `getAgeGroups(currentTournament.id)`.

---

## 4. Rules Tagging Model (Phase B)

Tagging is at the **section level** only (not individual rule items). A whole card ("U17 batting order rules") is shown or hidden. Item-level tagging is deferred — it would require a checkbox on every bullet and adds admin complexity without proportionate benefit.

### Schema change

```sql
ALTER TABLE rules
  ADD COLUMN IF NOT EXISTS age_group_ids uuid[] DEFAULT NULL;
```

### Type change (`lib/types.ts`)

```ts
export interface RuleSection {
  id: string;
  tournamentId: string;
  title: string;
  icon?: string;
  order: number;
  items: RuleItem[];
  ageGroupIds?: string[] | null; // null = all divisions
}
```

### Filter logic

Same pattern as announcements — sections without `ageGroupIds` (or with empty array) always show.

### Admin UI change

In `RulesAdmin.tsx`, add an "Applies to" row in the `rule-card-header` for each section, after the title/icon controls:

```
Applies to: [All ▼]  (dropdown or inline checkboxes)
```

A compact multi-select popover (or inline checkbox row) with the tournament's age groups. Defaults to "All" (null).

---

## 5. Pages Changed

| Page | Component type | Phase | Changes |
|---|---|---|---|
| `app/[orgSlug]/schedule/page.tsx` | Client | A | Read cookie on mount to init `activeGroup`; write cookie on tab change |
| `app/[orgSlug]/standings/page.tsx` | Client | A | Same as schedule |
| `app/[orgSlug]/teams/page.tsx` | Client | A | Read cookie on mount for specific division tabs; "All" tab does not write cookie |
| `app/[orgSlug]/news/page.tsx` | Server | B | Read cookie via `cookies()`; resolve name → ID via `getAgeGroups`; filter announcements; render filter chip |
| `app/[orgSlug]/rules/page.tsx` | Server | B | Add `export const dynamic = 'force-dynamic'`; same pattern as news |
| `app/[orgSlug]/admin/announcements/page.tsx` | Client | B | Add `ageGroupIds` to form state; add division checkboxes to modal; load age groups on mount |
| `app/[orgSlug]/admin/rules/RulesAdmin.tsx` | Client | B | Add `ageGroupIds` per section; "Applies to" control in each rule card header |

---

## 6. DB Function Updates (Phase B)

### `getAnnouncements`
- Map `a.age_group_ids` → `ageGroupIds` in the returned object
- Accept optional second param `ageGroupId?: string`; filter in JS post-fetch

### `saveAnnouncement` / `updateAnnouncement`
- Include `age_group_ids: a.ageGroupIds ?? null` in the insert/update payload

### `getRules`
- Map `r.age_group_ids` → `ageGroupIds` per section

### `saveRuleSection` / `updateRuleSection`
- Include `age_group_ids: r.ageGroupIds ?? null` in the insert/update payload

---

## 7. Cookie Helper (`lib/age-group-cookie.ts`)

A thin client-side utility to centralise the cookie read/write logic (server-side reads use `next/headers` directly in each server component):

```ts
// Exported for use in client components
export function getAgPref(orgSlug: string): string | null { ... }
export function setAgPref(orgSlug: string, name: string): void { ... }
```

Server components import `cookies` from `next/headers` directly — no shared helper needed there.

---

## 8. Build Order

### Phase A — No schema changes, safe to ship independently

1. Create `lib/age-group-cookie.ts` (client cookie helpers)
2. Update `app/[orgSlug]/schedule/page.tsx` — read cookie on mount, write on tab change
3. Update `app/[orgSlug]/standings/page.tsx` — same
4. Update `app/[orgSlug]/teams/page.tsx` — same (with "All" tab exclusion)

### Phase B — Requires schema migration to be run first

1. Run migration SQL on Supabase (add `age_group_ids` to `announcements` and `rules`)
2. Update `lib/types.ts` — add `ageGroupIds` fields
3. Update `lib/db.ts` — map new fields, update save/update functions
4. Update `app/[orgSlug]/news/page.tsx` — cookie filter + chip UI
5. Update `app/[orgSlug]/rules/page.tsx` — `force-dynamic` + cookie filter + chip UI
6. Update `app/[orgSlug]/admin/announcements/page.tsx` — age group checkboxes
7. Update `app/[orgSlug]/admin/rules/RulesAdmin.tsx` — "Applies to" per section

---

## 9. Migration SQL

```sql
-- Run in Supabase SQL editor

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS age_group_ids uuid[] DEFAULT NULL;

ALTER TABLE rules
  ADD COLUMN IF NOT EXISTS age_group_ids uuid[] DEFAULT NULL;

COMMENT ON COLUMN announcements.age_group_ids IS 'NULL = broadcast to all divisions. Non-null = only show to listed age group IDs.';
COMMENT ON COLUMN rules.age_group_ids IS 'NULL = applies to all divisions. Non-null = only show to listed age group IDs.';
```

No backfill needed — existing rows with `NULL` correctly default to "all divisions."

---

## 10. Test Cases for User Verification

### Phase A

1. Navigate to `/[orgSlug]/schedule` — note the default tab (first age group)
2. Click a different tab (e.g. "U13") — schedule filters correctly
3. Navigate to `/[orgSlug]/standings` — confirm "U13" tab is already active (not reset to first)
4. Navigate to `/[orgSlug]/teams` — confirm "U13" tab is active
5. Open the same org in a new browser tab — confirm "U13" is still pre-selected
6. On the teams page, click "All" — teams shows all; navigate back to schedule and confirm "U13" is still selected (All did not clear the cookie)
7. Clear browser cookies → all pages revert to first age group

### Phase B

8. As org admin: create an announcement, leave "All divisions" checked → appears for all visitors regardless of preference
9. As org admin: create an announcement with only "U13" checked
10. Visit `/[orgSlug]/news` with no cookie set → both announcements appear
11. Set cookie to "U11" (via clicking U11 on schedule) → visit news → universal announcement shows, U13-only announcement is hidden; filter chip reads "Filtering for: U11"
12. Click "View all →" chip → both announcements appear again (URL shows `?view=all`)
13. Set cookie to "U13" → visit news → both announcements appear; chip reads "Filtering for: U13"
14. Repeat steps 8–13 for a rules section tagged "U11 + U13 only"
15. Confirm rules section tagged for U11+U13 is hidden when preference is U17, and shown when preference is U11 or U13
