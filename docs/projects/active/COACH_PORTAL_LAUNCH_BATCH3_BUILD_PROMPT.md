# Coach Portal Launch Batch 3 — Season's End — Build Prompt (paste into a fresh chat)

> **Created:** 2026-07-28, at the close of the Batch 2 session. **Order deliberately flipped** from the original sequence (owner call, 2026-07-28): the season-end lockout is the review's scariest finding *and* the smaller job, while tournament-game attendance/lineups is the bigger feature that strands nobody while it waits. Tournament games become Batch 4. This prompt is self-contained — read the referenced docs before proposing anything.

---

## The prompt

You are planning and building **Coach Portal Launch Batch 3 — "Season's End"** for the premium Coaches Portal: P0 finding **#1 (a club-owned team's coach can be locked entirely out of the portal at season's end)**, its natural companion **wow shortlist #7 ("Season Wrapped")**, and the adjacent P1 **"give the season a 'you're probably done' nudge"** — so the moment a season closes stops being a dead end and becomes the best moment in the product.

Follow the full house process: implementation plan + PM brief → mockups as an artifact (owner approval = binding visual spec, label NEW/RESTYLED/UNCHANGED) → owner decisions → build the whole approved phase in one pass → `/simplify` → `/review` → owner phone QA → commit only with explicit per-action OK.

### Read first (in order)

1. `docs/agents/design/PREMIUM_COACH_PORTAL_UX_READINESS_REVIEW.md` — the source review. Batch 3 scope = **P0 #1**, **wow #7**, **P1 "season winding-down cue" (f5-1)**, and the small **P2 f5-7** (Settings' rollover copy doesn't mention what happens to development history or awards). Read what it says about each.
2. `docs/projects/active/COACH_PORTAL_LAUNCH_BATCH2_PLAN.md` — what Batch 2 shipped (commit `8040f4e6`) and, critically, its **Ground truth**, **build deviations**, **`/simplify`** and **`/review`** sections. The shared form-disclosure control, the sheet contract, the probe recipe and the shared-working-tree landmines all live there.
3. `docs/projects/active/COACH_PORTAL_LAUNCH_BATCH1_PLAN.md` — the sheet-by-default modal contract, `CoachModalHeader`, and the overlay hook.
4. Auto-memory `project_premium_coach_portal_ux_eval.md` — running state of the whole program.
5. `memory/design_decisions.md` — the 2026-07-28 Batch 2 entry (disclosure primitive, sensitive-grant confirms, the trail-is-the-checklist rule) plus the standing rules (no circular monograms, `CoachEmptyState` CTA rules).

### Ground truth already verified (2026-07-28) — confirm it still holds, don't re-derive it

**The bug is a direct contradiction between two rules, and both are in the codebase today:**

- `getCoachingAssignmentsForUser` (`lib/db.ts`) filters a coach's assignments to program years whose status is **`draft` or `active` only**. The moment an org admin closes a season, the coach's assignment vanishes from that list.
- With zero assignments, `app/[orgSlug]/coaches/layout.tsx` renders the **"not assigned to any teams" wall** — the coach's entire portal for that org, gone.
- Meanwhile `lib/coach-rep-phase.ts` says, in its own comment: *"The afterglow/result view is ONLY shown for a season the coach has actually closed (status completed/archived)."*

So the celebratory season-complete screen is gated on exactly the state that deletes the coach's access to the page it renders on. **It can never render.** That is the review's claim, confirmed.

**Scope this carefully — it is an access-model question, not a UI patch.** Decide deliberately what a coach should be able to see and do in a closed season (read-only history? the wrap-up? nothing but a door to next season?), and where that decision belongs. A fix that merely widens the status filter would hand coaches write access to closed seasons — check every write path before doing that.

Also confirm, don't assume: whether a **standalone (team_workspace) coach** hits the same wall as a **club-owned (organization) coach**, and what "Start next season" in Settings does to the old year. The review describes the club-owned case; verify the standalone one yourself.

### Scope — what the coach gets

1. **Never locked out (#1).** A coach whose season has been closed keeps a way in. Decide and mock what they land on, what is read-only, and how they reach the new season when it exists. Cover both team ownership models and the assistant-coach case.
2. **Season Wrapped (wow #7).** Turn the close of a season into the product's best moment: final record, longest streak, closest game, top award-winner, attendance rate — assembled from data the product already computes across Insights, attendance, lineups and awards. The review is explicit that the ingredients exist server-side and this is presentation work, not new plumbing — **verify that before promising it.** Consider whether it is shareable with families, and if so reuse the existing share patterns rather than inventing one.
3. **A "you're probably done" cue (P1 f5-1).** Once games stop appearing, nothing tells a coach their season may be over — the product just quietly stops. Give it an honest, non-nagging nudge that leads into closing the season properly (and therefore into Wrapped).
4. **Settings rollover honesty (P2 f5-7).** The season-rollover summary doesn't say what happens to development history or awards. Small copy fix; ride it along.

### Landmines & contracts (hard-won — respect them)

- **Reuse Batch 2's shared form-disclosure control** (`components/coaches/CoachFormDisclosure.tsx`) for any new grouped form — do not invent a second collapsing pattern. Its contract: children stay mounted while collapsed, `defaultOpen` is mount-only, and a collapsed group that holds data or a blocking error must say so via `meta`. **Any sheet over 8 fields gets a disclosure; 8 or fewer is left alone.**
- **Sheet contract:** every portal modal is a full-height sheet at ≤640px by default. New/edited sheets render BOTH the back and close buttons (use `components/coaches/CoachModalHeader.tsx`), put actions in `.modalFooter`, and wire `useOverlayOpen(open)` from `@/lib/coaches-overlay` (it throws without the provider by design). Never pair `CoachModalHeader` with `.centeredOnMobile`.
- **`.formGrid` is one column at ≤640** — no two-column squeeze on phones.
- **Empty-state rules:** `CoachEmptyState` full-card variant when the coach CAN act (lime primary + ghost secondary only, rounded-square medallion, never a circle).
- **Git:** ONE shared `dev` branch. ⚠ **The working tree is shared with an ACTIVE concurrent session** — at the time of writing, `TODO.md` and `lib/help-content/coaches.tsx` both carried that session's uncommitted work interleaved with ours. **Diff every shared file before staging**, stage explicit pathspecs only (bracket paths need `:(literal)`), audit `git show --stat` after committing, and never commit or push without explicit per-action owner OK. Partial staging of a shared file is legitimate and was done cleanly in Batch 2 — see that plan.
- **Dev server:** may be owned by a concurrent session — check port 3000 ownership before killing anything. Full restart (stop → `rm -rf .next` → start) after new files/shared-module changes. ⚠ Batch 2 hit a **corrupted build cache mid-session — 500 on every route including login**; the documented stop/purge/restart fixes it. Don't debug it, just do it.
- **Verification:** `npm run typecheck`, `npm test`, `npm run verify:changed`. ⚠ `verify:changed`'s **schema-parity check currently fails on migrations 204/205 (`game_change_notices`) from the concurrent session** — that is NOT yours. Do not re-baseline it.
- **Layout bugs are verified with Playwright computed styles, never screenshots.** Working recipe: log in as `j2-rep-coach@dev.local` / `devpass123` (lands straight in the premium portal, club-owned team with a roster) or `coach@dev.local` / `devpass123` → choose the **Dev Standalone Team** workspace (empty roster). ⚠ **The UAT coach account is assigned to a team but has no organization membership row, so it bounces out of the portal** — provisioning one temporarily is the fix (the column is `organization_id`, and the row needs `status: 'active'`); always tear it down.
- **Sport-neutral:** any season/record vocabulary via `lib/sports.ts` Sport Packs — no hard-codes.
- **Migrations:** Batches 1 and 2 needed none. **This one might** — an access-model change or a "season closed" acknowledgement could. If a schema change appears, the data dictionary and both snapshots ride in the SAME unit of work (`npm run refresh:snapshots`, `npm run check:dictionary`), and it must be applied to dev AND prod before any release.
- **Docs:** user-facing flow changes → sync `lib/help-content/coaches.tsx`. Durable design calls → `memory/design_decisions.md`. Business decisions (none expected) → `/strategy`.

### Owner decisions to bring to the mockup round

- **What a coach sees in a closed season:** full read-only portal · a wrap-up screen plus history only · a minimal "season's over" door. (Recommend one.)
- **Who may close a season**, and whether a coach is warned/notified before their access changes.
- **Does Wrapped get shared with families** (and if so, does it reuse the existing no-login share link), or is it coach-only?
- **When Wrapped appears** — automatically at close, or something the coach generates.
- **The winding-down cue's trigger** — how quiet is "quiet enough" before the product suggests the season is over, without nagging a team on a mid-season break.

### Definition of done

Plan + PM brief docs (`docs/projects/active/COACH_PORTAL_LAUNCH_BATCH3_*`), approved mockups, built + `/simplify` + `/review` clean, typecheck/tests/verify green, fresh dev restart, owner phone QA checklist delivered, committed on `dev` with per-action OK, TODO.md + memory + help docs updated. **NOT pushed to prod** — Batch 3 rides a future release bundle.

---

## Program state at handoff (2026-07-28)

- **Batch 1** (mobile overlay safety + Tournaments revival) — committed `934e5275`.
- **Batch 2** (the "first week": bulk roster add, progressive disclosure, onboarding trail) — committed `8040f4e6`. Both on `dev`, **neither on prod.**
- **Remaining launch P0s after this batch:** just **#2 — real tournament games have no attendance or lineup tools** (now Batch 4, the bigger feature).
- **Adjacent, already logged, do NOT fold in here:** the guardian model needs to become plural and ride with the unbuilt name-split item — see `PROGRAM_COACH_PORTAL.md` §1.4 and open decision **CP-7** (when a player has two guardians, who gets the dues reminder?).
