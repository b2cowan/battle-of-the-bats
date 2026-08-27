# Practice Plan Staff & Equipment — Real Tag Libraries

**Status:** Planned, not started. **Owner decisions locked in (2026-08-26):** new entries always join
the team's library (no "one-off, don't save" mode); all four surfaces get it in one pass (header
equipment, block staff, station "who runs it" staff, station equipment).

## Why

The practice plan's "What this practice is about" field became a real, deliberate tag picker on
2026-08-01 — typing searches the team's existing words, and minting a new one takes a second,
explicit press, because free text is exactly what shipped a defect where two spellings of one word
split a library in half.

Staff and equipment on the same screen never got that fix. They're still `TagChips`: type anything,
press Enter or blur, it's added — no team-wide list, no duplicate protection beyond "not already on
this one plan." A coach who types "Tees (4)" one night and "tees(4)" the next gets two permanent,
separate suggestions with nothing ever merging them. Raised while testing tag editing on a QA
fixture (2026-08-26); confirmed as a real product gap, not a fixture artifact.

## What "real tag parity" requires — the decision that shapes everything else

Every existing tag library (game, money, focus) is safe to rename or merge because everything that
uses a tag stores its **id**, never its name — a drill, a template, a practice's own tags, a focus
area. Renaming "Hitting" to "Hitting mechanics" relabels every one of them at once; that's the whole
reason the vocabulary became tags.

If Staff/Equipment kept the practice plan's current storage — plain name **strings** inside the
plan's blocks/stations — a "library" on top of it would be cosmetic: minting would still work, but
renaming a library entry would never touch a name already typed into a saved plan. That directly
contradicts what "full tag parity" was asked for.

**Decision: Staff and Equipment selections are stored as tag ids** (like `planTagIds` already is for
focus tags), not strings. This is the one piece of extra work beyond "reuse the existing tag
infrastructure" — it means:
- The `PracticePlan` jsonb schema needs new id-array fields alongside the existing string fields at
  all four levels (plan-level equipment, block staff, station staff, station equipment).
- Old saved plans keep their existing string fields untouched and keep rendering/printing exactly as
  today — nothing is migrated or backfilled. A plan only gains id-backed staff/equipment the next
  time a coach actually edits it in the new picker.
- The PDF/print sheet and every other reader of a plan needs to resolve id → name using the team's
  library at render time (mirrors how the focus tag chip on the plan header already resolves
  `planTagIds` against `focusTags`).

## Scope — reuse, not reinvent

The tag-library factory this repo already has (`lib/coach-tag-routes.ts`) was built exactly for this:
*"a new one is a descriptor plus three three-line route files — which is the point."* Two new
descriptors, `STAFF_TAG_LIBRARY` and `EQUIPMENT_TAG_LIBRARY`, mirror `FOCUS_TAG_LIBRARY` (same read
gate: schedule or development-goals view; same write gate: schedule-manage — minting is a
practice-planning act, not head-coach-only, matching how minting a focus tag works today).

1. **Migration** — widen `rep_team_tags.kind` CHECK constraint to admit `'staff'` and `'equipment'`;
   widen the `RepTagKind` TS union. Update `DATA_DICTIONARY.md` and refresh dev+prod snapshots in the
   same unit of work (`check:dictionary` gate).
2. **Six new route files** — `staff-tags/route.ts` + `[tagId]/route.ts` + `merge/route.ts`, and the
   equivalent `equipment-tags/*`, each a few lines calling the existing factory (exactly like the
   three `focus-tags` files).
3. **Client hook** — generalize `use-focus-tags.ts` into a `useTeamTagLibrary(orgSlug, teamId, kind,
   opts)` the three vocabularies all call, rather than copy-pasting two more fetch/create hooks
   (matches the hook's own stated reason for existing).
4. **PracticePlan schema** — add `staffTagIds?`/`equipmentTagIds?` at the plan, block, and station
   levels beside the existing `staff`/`equipment` string arrays. `sanitizePracticePlan` validates the
   new id arrays the same way `planTagIds` is validated today (proved to belong to the team's
   'staff'/'equipment' vocabulary — never trusted from the client).
5. **One adapter component** — `TagPicker` operates on ids; the plan's UI still needs to show a
   coach-facing name. Build a thin wrapper around `TagPicker` for this one case (id-array in, id-array
   out, resolves names from the passed-in library for display) rather than forking the picker itself.
6. **Four call-site swaps** — replace `TagChips` with the new wrapper in the plan header (equipment),
   `BlockCard` (staff), and `StationCard` (staff + equipment), each wired to the matching library and
   its `onCreate`.
7. **Practice-plan GET route** — fetch the staff/equipment libraries in the same `Promise.all` as the
   existing focus-tag fetch, so the editor gets everything on one load (matches how `focusTags`
   already rides the plan GET rather than a second round trip).
8. **PDF export** (`lib/export/pdf.ts`) — resolve new id arrays to names for print, falling back to
   the legacy string fields on old plans that never gained ids.
9. **Tests** — extend the existing practice-plan/tag test files (`rep-practice-plan.test.ts`,
   `pdf-export-contract.test.ts`) rather than a new suite; a tag-kind CHECK-constraint test belongs
   beside the dictionary guard.

## Explicitly out of scope for this pass

- **Rename/merge UI** for the new libraries — the routes support it for free (same factory), but no
  manager screen is being built to expose it in this pass unless requested.
- **Plan templates and drills** — those surfaces don't currently show staff/equipment at all; not
  touched here.
- **Backfilling existing plans'** plain-text staff/equipment into the new id fields — deliberately
  left alone (see decision above); a plan only gains ids the next time it's actually edited.
- The QA seed fixture (`scripts/seed-qa-day-fixtures.mjs --practice`) — could be updated to use real
  staff/equipment tags for full consistency with the focus-tag fix already applied, but that's
  optional polish once the feature exists, not a prerequisite.
