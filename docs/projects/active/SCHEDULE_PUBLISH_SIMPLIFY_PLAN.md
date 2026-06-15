# Schedule Publishing Simplification — Implementation Plan

> **Status:** Planning
> **Created:** 2026-06-15
> **Branch:** `fix/fp3-volunteer-dayof` (owner decision 2026-06-15: group this with the FP-3 volunteer work on the same branch and push both together when ready, rather than cutting a separate branch). Keep commits self-contained and scoped to the schedule-publish files so the two initiatives stay distinguishable in history. NOT pushed until both are done + verified.

## Goal

Collapse schedule publishing from three states to two. Today `divisions.schedule_visibility` is `'unpublished' | 'published_generic' | 'published_teams'`. The middle state — publish real game times/locations but show matchups as placeholders ("Pool A Team 1") while registration stays open — is being removed. After this work, publishing is one obvious action: **close the division's registration → publish with real team names.** Coaches reported the placeholder-publish path is not a real use case and only adds complexity. The Generator's "slot mode" (sketching a bracket from `pool_slots` placeholders before teams exist) is **kept as an admin-only draft tool** — only its *public* placeholder display goes away; the pool-slot → team seeding workflow (`pool_slots.team_id`) is preserved.

## PM Brief

See `SCHEDULE_PUBLISH_SIMPLIFY_PM_BRIEF.md` (same folder).

## Locked behavior (from /ux, user-approved — do not re-litigate)

- **States:** `'unpublished' → 'published'` (always real names). Remove `'published_generic'` **and** rename `'published_teams' → 'published'` (owner decision 2026-06-15, Q1=Option B: there are effectively no live published schedules, so do the clean rename rather than leave a misnamed legacy string). The final allowed set is `('unpublished','published')`.
- **Migration:** any row with `schedule_visibility = 'published_generic'` is flipped to `'unpublished'` (revert — never auto-expose previously hidden names). Then tighten the CHECK constraint to the two remaining values.
- **Publish action:** keep the existing combined "Close Registration & Publish" flow + confirm step. Only **remove the name-mode radio**. Do not introduce a manual "close registration first" prerequisite that dead-ends the organizer.
- **Reopen:** reopening registration on a published division **unpublishes** its schedule, with the existing confirm dialog reworded. The unpublish happens **server-side, atomically, as part of the reopen action** (owner decision 2026-06-15, Q2=Option A) — registration and schedule state can never end up out of sync.
- **Slot mode:** stays in the Generator as admin-only draft; never displayed publicly.

## Verified facts (checked against live code 2026-06-15)

- Next migration number = **129** (latest on disk is `128_member_invited_email.sql`).
- Column defined in `042_slot_first_roster.sql` (the column is on the `divisions` table; that migration also references the legacy `age_groups` name — confirm the live constraint name from snapshots, not the migration).
- `lib/db.ts` only ever writes `'unpublished'` as a default and round-trips `scheduleVisibility` verbatim (lines ~353, ~740, ~1172, ~1198, ~1215). **No logic change needed in `lib/db.ts`** beyond whatever the TS type change forces.
- `app/api/admin/divisions/route.ts` `set-visibility` handler (~350–378) accepts an **arbitrary** `scheduleVisibility` string with no allow-list — the DB CHECK is the only guard today. Add a defensive server-side reject of `'published_generic'`.
- `app/api/admin/schedule-publish/route.ts` already derives `showTeamNames = visibility === 'published_teams'` (line 88) and threads it through the publish email and the game-day-reminder opponent-name gating (lines ~182). Removing generic ⇒ `showTeamNames` is always true; simplify accordingly.
- `getTeamDisplay()` exists in **three** runtime consumers with the same `vis !== 'published_generic'` branch: `components/public/ScheduleContent.tsx` (~201–209), the game-detail page (~50–59), the OG image (~50). Plus the coach portal (`app/coaches/tournaments/[teamId]/page.tsx` ~173–174, 203) and `lib/coach-tournament-phase.ts` (~31–32, the `scheduleVisible` doc-comment).

## Phases

### Phase 1 — Database migration + dictionary (FIRST, per migration-first rule) ✅ DONE (dev) 2026-06-15
- [x] Created `supabase/migrations/129_schedule_visibility_two_state.sql`. Order: drop CHECK → revert generic → rename teams→published → re-add CHECK.
  - [x] Confirmed live constraint name from snapshots = `age_groups_schedule_visibility_check` (legacy name; table was renamed `age_groups`→`divisions`). Default confirmed `'unpublished'` (no change).
  - [x] `published_generic` → `unpublished`; `published_teams` → `published`; re-added CHECK `('unpublished','published')`.
- [x] Updated `docs/agents/db/DATA_DICTIONARY.md` — gotcha #5 + the `schedule_visibility` column entry (2-state, constraint name noted).
- [x] **Applied to DEV** (`node scripts/apply-migration-api.mjs …`) + `node scripts/refresh-db-snapshots.mjs` → watermark #129; dev snapshot now shows `('unpublished','published')`, prod still 3-state (expected drift).
- [x] `check:dictionary` passes. `memory/reference_db_schema.md` refreshed by the snapshot script.
- [x] Migration made idempotent (review fix): added a `DROP CONSTRAINT IF EXISTS` immediately before the final `ADD CONSTRAINT` so a retried prod apply can't hard-error. Re-applied to dev to prove it re-runs clean.
- [ ] **⚠⚠ PROD-PENDING — and the normal gate WON'T catch this.** Apply mig 129 to prod (`node scripts/apply-migration-api.mjs supabase/migrations/129_schedule_visibility_two_state.sql --prod`) + `refresh:snapshots` BEFORE this code reaches master. **`check:migrations` is BLIND to this migration** — it diffs only tables/columns via `information_schema.columns`, and mig 129 changes only a CHECK-constraint clause (no table/column change), so it reports "✓ in sync" whether or not prod is migrated. If the code ships first, any lingering `published_generic` row leaks real team names on the public schedule (the public `getTeamDisplay` no longer gates on visibility — correct only post-migration). **This is a manual, must-not-skip step**; do not rely on the release gate to enforce it.

### Phase 2 — API layer ✅ DONE 2026-06-15
- [x] `app/api/admin/schedule-publish/route.ts`: narrowed request `visibility` to `'published'` + a fast 400 reject for anything else; updated the JSDoc; `showTeamNames` is now a constant `true` and the opponent-name comment no longer references the removed mode.
- [x] `app/api/admin/divisions/route.ts`:
  - [x] `set-visibility` handler: accepts only `'unpublished' | 'published'`, else a clear 400 (DB CHECK is the backstop).
  - [x] **Reopen→unpublish, server-side + atomic (Q2=Option A):** `set-closed` now clears `schedule_visibility → 'unpublished'` in the same write when `isClosed` is set to `false`. Closing does not touch visibility. Client makes one call.
- [x] `lint:focused` on both files: 0 errors (4 pre-existing `any` warnings, unrelated). Full `typecheck` deferred to Phase 7 — the `published_teams` string still exists elsewhere until the Phase 6 rename, so a repo-wide typecheck would error by design now.
- [x] **Review fix (publish atomicity):** the publish write in `schedule-publish` now sets `is_closed: true` alongside `schedule_visibility: 'published'` in one update — closing registration server-side is the guarantee, so a failed client pre-close can no longer leave a division published-but-open (mirrors the reopen→unpublish coupling). `handlePublishDone` also marks divisions `isClosed: true` so the UI matches.

### Adversarial review (/review) — high-risk tier, 4 lenses, 2026-06-15
- Ran the funnel: deterministic gate + correctness / security-multitenant / data-migration / regression-blast-radius lenses. 6 findings → triaged → 2 High + 1 Medium confirmed; the rest refuted-to-Low or docs-drift.
- [x] **High — publish not atomic** → FIXED (see Phase 2 review fix above).
- [x] **Medium — migration not idempotent** → FIXED (DROP-before-ADD; re-applied to dev clean).
- [x] **High (deploy-ordering, not a code bug)** — public name-leak if code ships before mig 129 on prod → documented as the ⚠⚠ PROD-PENDING gate in Phase 1 (the normal `check:migrations` gate is blind to this migration).
- Reported-not-fixed (acceptable): `if (ag)` guard fallthrough in `divisions/route.ts` (pre-existing across the file, practically a no-op write — out of scope); stale bootstrap/docs references (`dev_combined_schema.sql`, design memory, J6 UAT results — historical, not runtime).
- Post-fix gate: full `typecheck` ✓ 0 errors; `lint:focused` ✓ 0 errors.

### Phase 3 — Admin UI (schedule page)
### Phase 3 — Admin UI (schedule page) ✅ DONE 2026-06-15
- [x] `app/[orgSlug]/admin/tournaments/schedule/page.tsx` — `PublishScheduleModal`:
  - [x] Removed the "Team Names" radio group + `nameMode` state. Publishing always = real names.
  - [x] `doPublish()` always sends `visibility:'published'`; always closes any still-open selected divisions first; kept the `willCloseOnPublish` confirm screen (now keyed only on "any open division selected"). Replaced the radio with an inline "registration will be closed when you publish" note; main copy now says "with real team names."
  - [x] Simplified the header status dot — only "Published" now (removed the "· names hidden" flag + conditional tooltip).
  - [x] Updated the parent `handlePublishDone` type + `onPublished` callback to `'published'`.
- [x] Reopen→unpublish: `app/[orgSlug]/admin/tournaments/registrations/page.tsx`:
  - [x] Client makes a single `set-closed { isClosed:false }` call (server unpublishes atomically). Optimistic state also clears `scheduleVisibility → 'unpublished'` on reopen.
  - [x] Reworded the warning (now keyed on `'published'`): "Reopening registration will take the public schedule offline (back to 'coming soon')." Confirm button = "Reopen & Unpublish."
- [x] `lint:focused` on both files: 0 errors (warnings all pre-existing, none in changed code). Full typecheck deferred to Phase 7.

### Phase 4 — Public consumers ✅ DONE 2026-06-15
- [x] `components/public/ScheduleContent.tsx`:
  - [x] `getTeamDisplay()`: dropped the `published_generic` branch → real name whenever a real `team_id` exists, placeholder only for byes/unseeded slots.
  - [x] `allUnpublished` gate + the other `activeVisibility` checks verified to compare only against `'unpublished'` — correct, unchanged.
  - [x] Removed the "matchups announced soon" banner + the now-unused `Info` icon import.
- [x] `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/page.tsx` — `getTeamDisplay`: same branch removal; dropped the now-unused `divisions` param at all 4 call sites + the now-unused `Division` type import.
- [x] `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx` — removed the `generic` logic + the `generic` param on `teamName`.
- [x] `lint:focused` on all three: 0 errors; the one warning I introduced (unused `Division`) fixed. Remaining warning (setState-in-effect) is pre-existing.

### Phase 5 — Coach portal + email ✅ DONE 2026-06-15
- [x] `app/coaches/tournaments/[teamId]/page.tsx`: collapsed the two-level check — `scheduleVisible = schedule_visibility === 'published'`, and the opponent-name reveal now keys on `scheduleVisible` directly. Removed the separate `namesPublished` variable.
- [x] `lib/coach-tournament-phase.ts`: updated the `scheduleVisible` doc-comment to `=== 'published'`. `deriveCoachTournamentPhase` keys off "is it published at all" — unchanged.
- [x] `lib/email.ts` `schedulePublishedHtml`: removed the `showTeamNames` prop entirely; `nameNote` is now the single "Your team name appears on the public schedule." line. Updated the sole caller (`schedule-publish/route.ts`) — dropped the prop, removed the now-redundant `showTeamNames` constant, and simplified the game-day-reminder opponent gate to depend only on a real assigned team.
- [x] `lint:focused` on all four: 0 errors, 0 warnings.

### Phase 6 — Generator slot-mode guard + types + cleanup ✅ DONE 2026-06-15
- [x] `lib/types.ts` — narrowed `Division.scheduleVisibility` to `'unpublished' | 'published'`.
- [x] **Global string rename (Q1=Option B):** swept the whole repo. No runtime `.ts/.tsx` references the old values anymore (only one explanatory comment in `schedule-publish/route.ts` documenting the removal). `lib/db.ts` needed no change (it only round-trips the value + writes the `'unpublished'` default). Historical files left untouched: migration 042, `dev_combined_schema.sql`, archived docs/journeys, `tests/uat/results/**` (audit history).
- [x] `Generator.tsx` slot mode: reworded all 3 "team names appear publicly once slots assigned" promises → slot mode is a **draft** (build the bracket shape with placeholders, assign real teams to slots, publish with real names once registration closes; placeholders never shown publicly). Slot generation still works as before — only copy changed.
- [x] Dev/seed/test hygiene: updated `scripts/add-denver-games.mjs` (comments/output), the 3 seed scripts that wrote `'published_teams'` → `'published'` (`seed-completed-tournament.mjs`, `seed-byedemo.mts`, `seed-bl-u18-splitpool.mts`; would otherwise violate the new CHECK on re-seed), and the 5 UAT spec fixtures (`tournament-scorekeeper-smoke/-invite`, `-schedule-import-smoke/-hardening`, `-data-tools-smoke`).
- [x] **Full `npm run typecheck` passes clean (0 errors)** — confirms every runtime consumer of the narrowed union was updated.

### Phase 7 — Verification
**Automated checks (done by agent 2026-06-15):**
- [x] `npm run typecheck` — 0 errors (the narrowed `Division.scheduleVisibility` union confirms every consumer updated).
- [x] `npm run verify:changed` — clean for this diff (the one ratchet failure, `check-in-volunteer.module.css` literal hex, is FP-3 volunteer work, not this initiative).
- [x] `npm run check:migrations` — green, **but blind to mig 129** (see the ⚠⚠ note in Phase 1). Not a release gate for this change.
- [x] `lint:focused` on all changed files — 0 errors (warnings pre-existing).

**⚠ Dev-server restart required before browser QA** — this change touches shared modules (`lib/types.ts`, `lib/email.ts`), `proxy`-independent API routes, and adds a migration. Stop the dev server, `rm -rf .next`, `npm run dev`, wait for "✓ Ready". (Migration 129 is already applied to dev.)

### Manual browser QA checklist (owner / user performs)
Suggested test data: a tournament with at least one division that has **registration open** + accepted teams, and ideally a second **unpublished** division for the negative case. Free-tier login if needed: `free-owner@dev.local` / `devpass123`.

**1. Admin publish — the core simplification**
- [ ] Schedule page → click **Publish** on an open division. Modal shows **no "Placeholder vs Real names" choice** (it's gone). Copy says the schedule goes live "with real team names."
- [ ] Because registration is open, an inline note appears ("registration will be closed when you publish"). Click Publish → the **"Close Registration & Publish"** confirm screen appears → confirm.
- [ ] Success state shows "Schedule Published." The header status reads just **"Published"** — no "· names hidden" flag.

**2. Publish closes registration (review-fix: atomicity)**
- [ ] After step 1, go to the **Registrations** page for that division → its registration is now **Closed**. (Publishing must always leave it closed — this is the invariant the server now enforces.)

**3. Public view — real names only**
- [ ] Open the public schedule for the published division → games show **real team names** (not "Team 1/2"). Byes / unseeded bracket slots still show TBD.
- [ ] Open an individual **game-detail page** → real names.
- [ ] (Optional) The shareable link/social preview image for a game shows real names.
- [ ] The **unpublished** division still shows **"Schedule coming soon"** publicly. No "matchups announced soon" banner anywhere.

**4. Reopen takes the schedule offline (review-fix mirror)**
- [ ] Registrations page → reopen registration on the published division. Confirm dialog warns the schedule will be **unpublished / go offline**; button reads **"Reopen & Unpublish."** Confirm.
- [ ] Public schedule for that division reverts to **"Schedule coming soon."** Registration is open again.

**5. Coach portal**
- [ ] As an accepted coach in a published division → real **opponent names** show; the tournament card is in the schedule-live phase.

**6. Email (Tournament Plus only)**
- [ ] Publish with **"Notify registered teams"** checked → the "Your schedule is live" email says **"Your team name appears on the public schedule"** with **no** placeholder/"until registration closes" caveat.

**7. Slot-mode draft stays internal**
- [ ] In the schedule Generator, use **slot mode** to build a draft bracket before teams are final → it's usable for planning; helper copy frames it as a **draft** ("assign real teams, then publish once registration closes"). Placeholders **never** appear on the public schedule (publishing requires real names).

### ⚠ Production apply (must happen BEFORE this code reaches master) — see Phase 1
- [ ] `node scripts/apply-migration-api.mjs supabase/migrations/129_schedule_visibility_two_state.sql --prod`
- [ ] `node scripts/refresh-db-snapshots.mjs` → re-verify the prod snapshot now shows `('unpublished','published')`.
- [ ] Remember: `check:migrations` will be green either way — do not let that substitute for actually applying mig 129 to prod.

## Architectural Decisions
- **Decision:** Revert existing `published_generic` rows to `unpublished` rather than promoting to published. **Rationale:** promoting would suddenly expose team names that were deliberately hidden mid-registration; reverting forces an intentional re-publish and can never leak names. (User-approved.)
- **Decision:** Keep slot mode as an admin-only draft tool instead of deleting it. **Rationale:** the seeding workflow (`pool_slots.team_id`) is structurally needed for brackets; only the *public placeholder display* was the coach complaint. (User-approved.)
- **Decision:** Reuse the existing combined "Close Registration & Publish" flow; only remove the name-mode radio. **Rationale:** a separate "close registration first" prerequisite would dead-end the organizer (force a trip to the Registrations page). Keeping the combined action is the actual simplification. (From /ux review.)
- **Decision:** The DB CHECK constraint is the source of truth for allowed values; add a defensive API reject too. **Rationale:** `set-visibility` currently accepts any string, so the API must not silently pass a now-invalid value and surface a raw DB error.
- **Decision (Q1, owner 2026-06-15):** Rename the stored value `'published_teams' → 'published'` (full cleanup, not keep-the-legacy-string). **Rationale:** there are effectively no live published schedules to migrate, so the blast radius of the rename is small and it leaves the codebase clean rather than carrying a misnamed legacy value. Done via migration 129 + a repo-wide string rename.
- **Decision (Q2, owner 2026-06-15):** Reopen→unpublish is **server-side and atomic** (the `set-closed` handler also unpublishes when reopening a published division; the client makes one call). **Rationale:** guarantees registration-open and a live schedule can never coexist — no half-done state if a second client call were to fail.

## Open Questions
- [ ] **Confirm the live CHECK constraint name** from the snapshots / `information_schema` (the `042` migration references the legacy `age_groups` table name, which can mislead). Do this in Phase 1 before writing the `ALTER`. *(Verification step, not a decision — handled during build.)*
