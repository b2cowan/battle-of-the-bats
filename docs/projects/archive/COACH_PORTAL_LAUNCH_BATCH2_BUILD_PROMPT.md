# Coach Portal Launch Batch 2 — Build Prompt (paste into a fresh chat)

> **Created:** 2026-07-28, at the close of the Batch 1 session. Owner-ratified direction: Batch 2 = the "first week" bundle. This prompt is self-contained — read the referenced docs before proposing anything.

---

## The prompt

You are planning and building **Coach Portal Launch Batch 2 — the "first week" bundle** for the premium Coaches Portal: P0 findings **#7 (bulk roster add), #8 (progressive-disclosure forms), #6 (onboarding that shows the whole product)** from the go-to-market UX readiness review, plus the **"setup momentum ring"** idea (wow shortlist #1) which doubles as the #6 fix. Follow the full house process: implementation plan + PM brief → mockups as an artifact (owner approval = binding visual spec, label NEW/RESTYLED/UNCHANGED) → owner decisions → build the whole approved phase in one pass → /simplify → /review → owner phone QA → commit only with explicit per-action OK.

### Read first (in order)

1. `docs/agents/design/PREMIUM_COACH_PORTAL_UX_READINESS_REVIEW.md` — the source review. Batch 2 scope = P0 #6, #7, #8 (see the P0 list) + wow idea #1. Note what the review says about each.
2. `docs/projects/active/COACH_PORTAL_LAUNCH_BATCH1_PLAN.md` — what Batch 1 shipped (commit `934e5275`, 2026-07-28) and, critically, its **Ground truth** + **build deviations** sections: the sheet-by-default modal contract, `CoachModalHeader`, the overlay hook, the budget-CSS-migration story, and the /review-confirmed invariants you must not break.
3. Auto-memory `project_premium_coach_portal_ux_eval.md` — the running state of the whole program.
4. `memory/design_decisions.md` (repo) — 2026-07-28 entries: no initials avatars on roster rows; plus the standing rules (no circular monograms, CoachEmptyState CTA rules).

### Scope — what the coach gets

1. **Bulk roster add (#7).** Today: 15 players = 15 open-fill-save-close round trips through an 11-field sheet. Target: a coach gets a whole roster in, in minutes — investigate and mock BOTH a paste-a-list flow (names + optional numbers, one per line, preview table, fix-ups inline) and a spreadsheet import (the admin side already has import parsers — see `tests/unit/import-parsers.test.ts` and the admin team-import routes for reusable parsing), and recommend one or both. Keep "save & add another" as the single-player fallback (P2 note in the review).
2. **Progressive disclosure (#8).** Add Player and Add/Edit Event show 10–13 fields at once. The FREE portal already solved this — `components/coaches/RosterEditor.tsx` / `ScheduleEditor.tsx` collapse optional fields behind toggles. Bring the same "start simple, add detail if needed" shape to the premium Add Player + Add/Edit Event sheets (and audit the other converted sheets for a consistent pattern). Also in scope from the review's #8: the assistant-coach capability grid's instant-autosave-no-confirm concern (10 access decisions incl. money) — propose the fix, owner decides.
3. **Onboarding coverage (#6) + momentum ring.** The Overview setup checklist covers 5 of 11 sections; Chat, Staff, Documents, Announcements, Development are invisible. Extend the checklist (optional steps included) and build the dismissible momentum ring on Overview for new teams (roster added → first game → first lineup → first announcement → money started), with each step lighting up from real data and doubling as the discovery door to the unmentioned sections. The Batch 1 review praised the existing checklist pattern (skippable steps, per-team memory) — extend it, don't replace it.

### Landmines & contracts (hard-won this batch — respect them)

- **Sheet contract:** every portal modal is a full-height sheet at ≤640px by default (`coaches.module.css` @640 block). New/edited sheets must render BOTH `.modalBackBtn` and `.modalCloseBtn` (use `components/coaches/CoachModalHeader.tsx`) and put actions in `.modalFooter`. Never pair `CoachModalHeader` with `.centeredOnMobile` (doc comment explains). Wire `useOverlayOpen(open)` from `@/lib/coaches-overlay` for every new modal — it throws without the provider by design; `useOverlayOpenIfAvailable` is only for components that also render outside the portal.
- **`formGrid` is one column at ≤640** (Batch 1 owner fix) — don't reintroduce two-column squeeze on phones.
- **Git:** ONE shared `dev` branch; bracket paths need `:(literal)` pathspecs; stage explicit paths only; audit `git show --stat` after committing; NEVER commit/push without explicit per-action owner OK. The working tree may hold OTHER sessions' uncommitted work (schedule-alerts stream: `lib/schedule-change-notices.ts`, mig 205, TODO.md interleaves) — never stage their files; check `git status` freshness of any shared file (TODO.md, BUSINESS_DECISIONS.md) before staging.
- **Dev server:** may be owned by a concurrent session — check port 3000 ownership before killing anything; full restart (stop → `rm -rf .next` → start, network access required) after new files/shared-module changes, before owner browser QA.
- **Verification:** `npm run typecheck` + `npm run verify:changed`; layout bugs are verified with Playwright computed styles, never screenshots. A working probe recipe exists (provision a disposable coach: `rep_teams` + `rep_program_years` + `rep_team_coaches` + `organization_members` role `coach` on the UAT org via `lib/supabase-admin` — getAuthContext requires the membership row; teardown everything). Re-probe sheet geometry after CSS changes.
- **Data entry → PII:** bulk-add ingests guardian names/emails/phones — no new tables expected, but if any schema change appears, dictionary + snapshots ride in the same unit of work (`npm run refresh:snapshots`, `npm run check:dictionary`).
- **Sport-neutral:** positions and any sport vocabulary via `lib/sports.ts` Sport Packs — no hard-codes.
- **Docs:** user-facing flow changes → sync `lib/help-content/coaches.tsx` (search matches keywords, not body). Durable design calls → `memory/design_decisions.md`. Business decisions (none expected) → /strategy.

### Owner decisions to bring to the mockup round

- Bulk-add mechanism: paste-list, spreadsheet import, or both (recommend one as primary).
- Which fields stay visible on the simplified Add Player / Add Event vs collapse (recommend: match the free tier's split, guardian contact stays prominent because dues/announcements depend on it — argue it either way with a mockup).
- Capability-grid confirm behavior (keep autosave + add confirm for money/contact toggles, vs explicit save).
- Momentum-ring step set + when it retires (dismiss vs auto-hide at N complete).
- Checklist expansion: which of Chat/Staff/Documents/Announcements/Development become optional steps vs momentum-ring-only mentions.

### Definition of done

Plan + PM brief docs (`docs/projects/active/COACH_PORTAL_LAUNCH_BATCH2_*`), approved mockups, built + /simplify + /review clean, typecheck/verify green, fresh dev restart, owner phone QA checklist delivered, committed on `dev` with per-action OK, TODO.md + memory + help docs updated. NOT pushed to prod — Batch 2 rides a future release bundle.
