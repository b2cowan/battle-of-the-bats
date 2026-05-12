# Tournament Lifecycle Cleanup Plan

Four cleanup items around the tournament lifecycle. No code changes until this plan is approved.

---

## Current State Assessment

### Status Transition Logic (UI — `app/[orgSlug]/admin/tournaments/page.tsx`)

| From → To | Currently Available |
|-----------|-------------------|
| Draft → Active | ✅ |
| Active → Completed | ✅ |
| Completed → Active | ✅ |
| Completed → Archived | ✅ |
| Draft → Completed | ❌ missing |
| Active → Draft | ❌ missing |
| Completed → Draft | ❌ missing |
| Archived → anything | ❌ missing |

The server-side `set-status` handler (`app/api/admin/tournaments/route.ts:69`) has **no transition restrictions** — it accepts any valid status and only enforces the active-tournament limit when transitioning to `active`. The UI is the sole bottleneck.

### Seal Gating

- The "Seal" button currently renders for **all non-sealed tournaments regardless of status** (line 441–449 of tournaments page).
- The seal-tournament API (`app/api/admin/seal-tournament/route.ts`) checks `seal_tournaments` capability and scope but does **not** verify the tournament is in `completed` status before sealing.

### Archived Tournament Visibility

| Location | Filters archived? |
|----------|------------------|
| `lib/tournament-context.tsx` — admin sidebar switcher | ❌ No filter |
| `/api/admin/tournaments` GET — context data source | ❌ No filter |
| `app/[orgSlug]/[tournamentSlug]/schedule/page.tsx` — YearSelector | ✅ Already filters |
| `app/[orgSlug]/[tournamentSlug]/standings/page.tsx` — YearSelector | ✅ Already filters |
| `app/[orgSlug]/[tournamentSlug]/teams/page.tsx` — YearSelector | ✅ Already filters |
| `app/[orgSlug]/page.tsx` — public org home | ✅ Only shows active |
| `app/[orgSlug]/admin/tournaments/page.tsx` — admin management list | Keep all — intentional |

The gap is the **admin sidebar tournament switcher** and by extension all admin sub-pages that use `currentTournament` from context. Archived tournaments can currently be selected as the "editing tournament" in the sidebar, which makes no sense once they're archived.

### Archives Section Current State

**What exists and works:**
- `app/[orgSlug]/archives/page.tsx` — Public "Digital Ledger" table listing sealed tournaments (season, name, division, champion, teams, games, integrity badge). Functional.
- `app/[orgSlug]/archives/[archiveId]/page.tsx` — Full detail page per archive record: pool play standings, bracket results, all game scores, integrity hash verification footer. Very complete.
- Admin sidebar links to `/{orgSlug}/archives` (the public digital ledger).

**Why it looks empty today:** The ledger is populated from the `tournament_archives` table, which is only written by the seal-tournament API. Tournaments must reach `completed` status before they can be sealed. Since the status flow was incomplete (items 1 & 2 above), no tournaments have been sealed.

**What's missing:**
- No admin-specific archives view (to see both sealed records and unfinished archived-status tournaments side-by-side).
- No way for admins to navigate back from the public ledger to the admin area.

---

## Item 1 — All Status Transitions Freely Selectable

**File:** `app/[orgSlug]/admin/tournaments/page.tsx`, lines 414–435 (Actions column)

**Change:** Replace the conditional button logic with a compact `<select>` dropdown in the Status column. The dropdown lists all four statuses (`draft`, `active`, `completed`, `archived`) with the current status pre-selected. On change, it calls `handleSetStatus(t.id, newStatus)`.

This eliminates the need to enumerate every permitted transition and makes the UI self-documenting.

- Remove the four conditional `<button>` blocks for Activate / Complete / Archive.
- Render a single `<select>` element with options: `Draft`, `Live` (value=`active`), `Completed`, `Archived`.
- Disable the select when `sealedTournamentIds.has(t.id)` (sealed = permanently archived, no further status changes meaningful).
- Keep "Seal" as a separate action button — it is not a status change, it is an irreversible snapshot action.
- Server: no changes needed.

**Status badge** in the Status column becomes informational only (or can be removed since the select already shows current status).

---

## Item 2 — Seal Only After Completed

**UI fix — `app/[orgSlug]/admin/tournaments/page.tsx`:**

Line 436 currently checks `sealedTournamentIds.has(t.id)` to decide whether to show the SEALED badge or the Seal button. Add an outer condition: only render the Seal button (or SEALED badge) when `t.status === 'completed'`. For other statuses, render nothing in that slot.

```
// Pseudocode:
if (t.status === 'completed') {
  if (sealed) → show SEALED badge
  else        → show Seal button
}
// else → render nothing
```

**Server fix — `app/api/admin/seal-tournament/route.ts`:**

After the `if (!tournament)` not-found check (line 34), add:

```typescript
if (tournament.status !== 'completed') {
  return NextResponse.json(
    { error: 'Tournament must be in completed status before sealing.' },
    { status: 400 }
  );
}
```

This prevents a race condition where a status changes between UI render and API call.

---

## Item 3 — Archived Tournaments Hidden from Non-Archive Views

**File:** `lib/tournament-context.tsx`, `refresh()` function (line 45)

After mapping API rows to Tournament objects, filter out archived:

```typescript
const ts = rows.map(mapRow).filter(t => t.status !== 'archived');
```

This single change propagates to:
- AdminSidebar tournament switcher (no longer shows archived tournaments as selectable editing targets)
- All admin sub-pages that read `currentTournament` from context
- `currentTournament` fallback logic — if the persisted localStorage tournament ID refers to an archived tournament, the context will fall back to the active tournament or the first non-archived one (existing fallback logic at lines 50–52 already handles this correctly)

**No changes needed to:**
- Admin tournaments page — uses `getTournamentsByOrg` directly, intentionally shows all including archived so admins can manage/delete them
- Public schedule/standings/teams pages — already filter `status !== 'archived'` before passing to YearSelector
- Public org home — already only shows active

---

## Item 4 — Archives Section: Assessment and Expansion Plan (Planning Only)

### Current gaps

1. **Discoverability from admin**: The admin sidebar Archives link goes to the public digital ledger (`/{orgSlug}/archives`). There's no admin-scoped view that combines "archived status" tournaments + sealed records.
2. **Admin archives page**: No `app/[orgSlug]/admin/archives/page.tsx` exists. Admins must navigate to the public archives to see what's been sealed.
3. **Unfinished archives**: Tournaments marked `status = 'archived'` (but not sealed) are invisible everywhere once item 3 is implemented — they vanish from the admin switcher and from public pages, but aren't in the digital ledger either. This is a dead zone.

### Expansion plan (not implementing now — see dedicated plan file when ready)

**Phase A — Admin Archives Overview page** (`app/[orgSlug]/admin/archives/page.tsx`)
- Two sections: "Sealed Records" (from `tournament_archives`) and "Archived — Pending Seal" (tournaments with `status = 'archived'` not yet in `tournament_archives`)
- Sealed records link to the public detail page; pending ones show a "Seal Now" button
- Add this page to `TOURNAMENT_NAV` in AdminSidebar
- Effort: ~1 day

**Phase B — Public Digital Ledger enhancements**
- Search/filter by year or division
- Group by year when multiple divisions per year are sealed (currently each division gets its own archive row)
- Effort: ~0.5 days

**Phase C — Export**
- PDF or CSV export of a sealed archive record for record-keeping
- Effort: ~1 day

**Phase D — Public navigation improvements**
- "Back to Admin" link on the digital ledger visible only to authenticated org members
- Breadcrumb from archive detail back to ledger
- Effort: trivial

---

## Task Summary

| # | Change | Files | Risk |
|---|--------|-------|------|
| 1 | Replace conditional status buttons with a `<select>` | `page.tsx` (tournaments admin) | Low |
| 2 | Gate Seal button + server guard to `completed` only | `page.tsx`, `seal-tournament/route.ts` | Low |
| 3 | Filter archived from tournament context | `lib/tournament-context.tsx` | Low |
| 4 | Plan only — no code | — | None |

All three code changes are low-risk, localized, and independently deployable.
