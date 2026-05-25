# Tournament Settings JSONB + Rules/Resources Layout Controls

> **Status:** Implemented — awaiting browser verification  
> **Created:** 2026-05-25  
> **Branch:** dev  

---

## Goals

1. [x] Add `tournament_settings` JSONB column to `tournaments` for future per-tournament preferences
2. [x] Add per-tournament layout controls for Rules (1 col / 2 col) and Resources (list / grid)
3. [x] Admin UI: compact layout toggles in each section header, saving immediately
4. [x] Public rules page: honour the saved layout settings

---

## PM Brief

Org admins can now choose how their rules and resources are displayed on the public rules page — independently for each section. Rules can be shown as a 2-column grid (default, good for 2–4 short sections) or a single full-width column (better for many sections or long content). Resources can be shown as a stacked list (default) or a 2-column link grid (better for 4+ files/links).

The setting is per-tournament, saves on click, and has no impact on the admin editing experience — only the public output changes.

This also ships `tournament_settings` — a JSONB column that absorbs future small per-tournament preferences without requiring new migrations for each one.

---

## Architecture decision

| Decision | Choice | Rationale |
|---|---|---|
| Storage | `tournaments.settings jsonb NOT NULL DEFAULT '{}'` | One column for all future small prefs; no migration per new key |
| Write pattern | Read-merge-write in API route | Settings are low-contention admin-only; merge avoids overwriting unrelated keys |
| API action | `patch-settings` on existing `/api/admin/tournaments` route | Consistent with existing `set-contact-email`, `update` etc. action pattern |
| Toggle save | Immediate (no "Save Changes" flow) | Settings are not content — no dirty tracking needed |
| Default values | rules `'columns'`, resources `'list'` | Preserves current public page behaviour for all existing tournaments |

---

## TournamentSettings type

```ts
export interface TournamentSettings {
  rulesLayout?: 'columns' | 'single';     // default: 'columns' (2-col grid)
  resourcesLayout?: 'list' | 'grid';      // default: 'list' (stacked)
}
```

Future keys to add here (no migration needed):
- `scheduleCompactMode?: boolean` — compact vs. expanded schedule cards
- `registrationLayout?: 'single' | 'sidebar'` — registration page column layout

---

## Files changed

| File | Change |
|---|---|
| `supabase/migrations/086_tournament_settings_jsonb.sql` | Adds `settings jsonb NOT NULL DEFAULT '{}'` column |
| `lib/types.ts` | Adds `TournamentSettings` interface; adds `settings?` to `Tournament` |
| `lib/db.ts` | `mapTournament()` reads `settings`; adds `updateTournamentSettings()` helper |
| `app/api/admin/tournaments/route.ts` | Adds `patch-settings` action with key/value whitelist validation |
| `app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx` | Layout toggle UI in each section header; `handleLayoutChange()` saves immediately |
| `app/[orgSlug]/[tournamentSlug]/rules/page.tsx` | Reads `tournament.settings.rulesLayout` and `resourcesLayout`; applies variant class |
| `app/[orgSlug]/rules/rules.module.css` | Adds `.rulesGridSingle`, `.resourcesGrid` variant classes |

---

## Toggle UI spec

```
Tournament Rules          [▤ Single] [▥ Columns]   + Add Section   Browse Samples
Resources & Downloads     [▤ List]   [▥ Grid]       + Add Link      Upload File
```

- Two adjacent icon buttons in a pill container (`.layout-toggle`)
- Active button: logic-lime colour + faint lime background
- Inactive: `--white-30` colour
- Icons: `LayoutList` (single/list), `Columns2` (2-col rules), `LayoutGrid` (grid resources)
- Save is fire-and-forget optimistic — UI updates immediately, API call in background

---

## Public page CSS variants

```css
/* rules.module.css */
.rulesGridSingle { grid-template-columns: 1fr; }
.resourcesGrid   { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

/* both collapse to 1 col at ≤768px */
```

---

## Run migration

```sql
-- supabase/migrations/086_tournament_settings_jsonb.sql
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}';
```

Apply to dev first, then prod when deploying.
