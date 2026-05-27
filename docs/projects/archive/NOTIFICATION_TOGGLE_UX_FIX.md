# Notification Toggle UX Fix — Plan & PM Brief

**Status:** Awaiting approval  
**Branch:** dev  
**Created:** 2026-05-26  
**Scope:** UI-only — no DB changes, no API changes, no data migration

---

## PM Brief (Plain Language)

**What's wrong today:**  
On the Tournament Notifications preferences page (`/admin/tournaments/settings/notifications`), the toggles are semantically backwards. When a toggle is switched **on**, the user stops receiving that notification. When a toggle is switched **off**, the user receives it. Every toggle starts in the grey/off position by default — which *looks* like everything is disabled — but it actually means the user is receiving all notifications normally.

This breaks a universal convention. Every OS, app, and SaaS product users have encountered works the opposite way: toggle on = I receive this, toggle off = I don't. A user seeing a page full of grey toggles will assume nothing is set up, and turning one "on" to try to enable notifications will silently silence them instead.

**What changes after the fix:**  
The per-event toggles will appear **on (lit up)** by default, because that correctly reflects that the user is receiving those notifications. Turning a toggle off opts the user out. The column header will change from "MUTED" to "RECEIVE" (or similar) to match this convention. The master "Mute all" control at the top stays — it's labelled clearly enough — but its relationship to the per-event rows will also be corrected.

A secondary bug (the page shows "Failed to load preferences" on first load) will also be diagnosed and fixed as part of this work.

**Who is affected:**  
Any org admin, staff member, or owner who visits the per-tournament notification preferences page. No public users or coaches are affected. The org-level notification preferences page (`/admin/org/notifications`) uses a different model (channel toggles, not opt-out) and is **not** affected.

**Why it matters:**  
Users who encounter inverted toggles often take the wrong action and don't know why their notifications changed — or they distrust the entire preferences system. Fixing this before Phase E (web push) ships is important; Phase E will prompt users to visit preferences to configure push notifications.

**Success criteria:**  
- All per-event toggles appear ON by default (lit) when the user is receiving that notification
- Turning a toggle OFF opts the user out of that event's notifications
- Turning a toggle ON restores opt-in
- The master "Mute all" toggle correctly reflects and drives the aggregate state
- "Failed to load preferences" error is resolved

---

## Root Cause

The `tournament_notification_preferences` table stores `opted_out: boolean`. This is a valid and correct DB design — it accurately records a negative state (an opt-out, not an opt-in).

The problem is that the UI exposes this internal concept directly:

```tsx
// Current (wrong)
<Toggle checked={optedOut} onChange={v => handleEventToggle(et, v)} />
// Column header: "MUTED"
// Result: toggle ON = muted, toggle OFF = receiving
```

The fix is a pure UI translation. The DB column name and value stay exactly the same. The API contract stays exactly the same. Only the page interprets the value differently for display purposes.

---

## Files Affected

| File | Change |
|---|---|
| [app/[orgSlug]/admin/tournaments/settings/notifications/page.tsx](../../app/[orgSlug]/admin/tournaments/settings/notifications/page.tsx) | Flip `checked` prop and `onChange` inversion on per-event toggles; update column header; verify master mute computed state |
| [app/api/admin/tournaments/[tournamentId]/notification-preferences/route.ts](../../app/api/admin/tournaments/[tournamentId]/notification-preferences/route.ts) | Investigate "Failed to load preferences" error (may be a missing table check or auth scope issue — read-only diagnosis, no changes expected) |

**Files NOT changed:**
- The `tournament_notification_preferences` DB table — no schema changes
- The GET/POST API route contract — `optedOut` field name and semantics unchanged
- `lib/notify.ts` — dispatch logic unchanged
- The org-level notifications page (`/admin/org/notifications`) — different model, not affected
- Any migration files — no DB work required

---

## Exact Code Changes

### 1 — Per-event toggle: flip `checked` and `onChange`

**Location:** [page.tsx line ~208–213](../../app/[orgSlug]/admin/tournaments/settings/notifications/page.tsx#L208)

```tsx
// BEFORE
<Toggle
  checked={optedOut}
  onChange={v => handleEventToggle(et, v)}
  label={`Mute ${NOTIFICATION_EVENT_LABELS[et]} for this tournament`}
  disabled={saving}
/>

// AFTER
<Toggle
  checked={!optedOut}
  onChange={v => handleEventToggle(et, !v)}
  label={`Receive ${NOTIFICATION_EVENT_LABELS[et]} notifications for this tournament`}
  disabled={saving}
/>
```

The `handleEventToggle` function and the `save()` API call are unchanged — they still write `optedOut: boolean` to the DB. Only the direction of the UI toggle is inverted.

### 2 — Column header: rename "MUTED" → "RECEIVE"

**Location:** [page.tsx line ~188](../../app/[orgSlug]/admin/tournaments/settings/notifications/page.tsx#L188)

```tsx
// BEFORE
<th className={styles.thMuted}>Muted</th>

// AFTER
<th className={styles.thMuted}>Receive</th>
```

The CSS class name (`thMuted`) is left unchanged to avoid unnecessary style side-effects; only the display text changes.

### 3 — Master "Mute all" control: no logic change needed

The master toggle already binds `checked={isMuted}` where `isMuted = ALL_EVENT_TYPES.every(et => prefs.get(et) === true)`. This correctly computes "all are opted out = muted". Its label ("Mute all notifications for this tournament") is explicit enough that the inverted-toggle problem doesn't apply here — it reads as a deliberate silence action, not a notification enable/disable. **No change.**

### 4 — "Failed to load preferences" error: diagnosis

The page shows this error banner on load. Most likely cause is one of:
- The `tournament_notification_preferences` table does not exist on the dev DB (migration 098 not applied)
- The API route's double-async lookup (`tourRow` → `orgRow` → `getAuthContextWithScope`) fails silently when `tournamentId` is not yet in context at mount time

Diagnosis will be done before implementation. If it's a missing table, that is a pre-existing Phase A issue and will be flagged separately; the toggle fix does not depend on it.

---

## What the Team Should Know

**No database work.** No migrations, no schema changes, no data backfill. Any `opted_out = true` rows saved before this fix remain valid and will continue to suppress notifications correctly — the new toggle just visually represents the opt-out state in reverse (grey = opted out, which is now toggle-off instead of toggle-on).

**No API contract change.** The GET response still returns `{ optedOut: boolean }` per event. The POST body still expects `{ optedOut: boolean }` per event. Any future consumers of this endpoint are unaffected.

**Phase D integration.** This page was delivered as part of Phase D (notification preferences UI). The fix is a Phase D bug correction, not a new phase. Once this is resolved, Phase D can be marked complete pending browser verification.

**Phase E dependency.** Phase E (web push) should not ship until this toggle issue is corrected, since Phase E will direct users to this page to configure push notification preferences.

---

## Implementation Order

1. Diagnose "Failed to load preferences" error — confirm root cause
2. Apply the three UI changes above to `page.tsx`
3. Fix the load error if it is within scope of this file
4. Hand off for browser verification
5. Mark Phase D complete in `TODO.md` if browser verification passes

---

## Out of Scope

- Org-level notification preferences page (`/admin/org/notifications`) — uses channel toggles (bell/push/email), not opt-out; no inverted-toggle issue exists there
- Any restyling of the toggle component itself — visual design is out of scope for this fix
- Phase E (web push) — separate phase, depends on this fix being complete first
