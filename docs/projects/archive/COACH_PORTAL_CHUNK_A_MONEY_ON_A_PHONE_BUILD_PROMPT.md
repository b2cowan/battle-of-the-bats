# Coach Portal — Chunk A: "Money on a Phone" — Build Prompt (paste into a fresh chat)

> **Created:** 2026-07-29, at the close of the Batch 4 session (Batch 4 committed `13e2c021` — the last launch P0). This is the **recommended next build** from the readiness-review backlog: the first post-P0 chunk, and the only one that collides with nothing in flight. This prompt is self-contained — read the referenced docs before proposing anything.

---

## The prompt

You are planning and building **Chunk A — "Money on a Phone"** for the premium Coaches Portal. Scope is the **Money area only**: P1 **#10** (Money's reports have zero mobile adaptation — found independently by two reviewers), the remaining **mobile-pass tables** from `PROGRAM_COACH_PORTAL.md` §1.3 (expenses, allocations, budget-vs-actual, fundraiser detail), P1 **#5** (no unsaved-changes guard on Accounting forms), and the P2 **native `alert()` on budget-delete failure**.

**The problem in one line:** a treasurer-coach can collect dues on a phone today but cannot read their own budget on one — and a hand-built budget split, the most annoying thing in the product to retype, has no "don't lose my work" guard.

Follow the full house process: implementation plan + PM brief → mockups as an artifact (owner approval = binding visual spec, label NEW/RESTYLED/UNCHANGED) → owner decisions → build the whole approved chunk in one pass → `/simplify` → `/review` → owner QA → commit only with explicit per-action OK.

### Read first (in order)

1. `docs/projects/active/PROGRAM_COACH_PORTAL.md` — **§1.1 is the backlog** (the readiness review itself is a review, it has no status and never learns what shipped). Chunk A is defined at the bottom of §1.1; §1.3 lists the mobile-pass remainder. **Rule: when this chunk absorbs a review item, tick it in §1.1 in the same unit of work.**
2. `docs/agents/design/PREMIUM_COACH_PORTAL_UX_READINESS_REVIEW.md` — the source findings. Yours are **f4-2 / f9-1 (×2) / f4-3** (money tables no mobile adaptation), **f7-3 / f7-7** (unsaved-changes guard), **f7-6** (native `alert()`), **f9-2** (desktop grids capped to a narrow column then forced into their own internal scroll on wide monitors — same pages, decide whether it's in scope), plus two adjacent P2s worth ruling on: **f4-7** (no cross-link between Payment Requests and Org Allocations) and **f4-6** (inconsistent "(paid only)" caveats on Money's headline numbers).
3. `docs/projects/active/COACH_PORTAL_LAUNCH_BATCH1_PLAN.md` — Batch 1 migrated the Budget page's modals onto the shared portal chrome and made every portal modal a full-height sheet ≤640px. Its sheet contract is a hard constraint here.
4. `docs/projects/active/COACH_PORTAL_LAUNCH_BATCH4_PLAN.md` — the most recent batch; its `/simplify` + `/review` records show the standard this work is held to, and its landmines section is still current.
5. Auto-memory `project_premium_coach_portal_ux_eval.md` + repo `memory/design_decisions.md`.

### Ground truth — ALREADY VERIFIED 2026-07-29, do not re-derive

**The mobile primitives you need already exist and are documented.** The header comment at the top of `app/[orgSlug]/coaches/coaches.module.css` is the contract — read it first. It declares **two breakpoints only** (900px = shell reflow, 640px = content reflow) and forbids reintroducing 600/520/other content widths. The shared opt-in primitives:

| Primitive | What it does | Adopters today |
|---|---|---|
| `.tableAsCards` | a **list-shaped** table (≤~5 data cols, one record per row) sheds its border, hides `thead`, and each row becomes a bordered card with label/value lines via `td[data-label]::before` | **Dues** (the exemplar), the Development board, Insights → Development |
| `.scrollX` / `.scrollXSticky` | a **genuine 2-D grid**: horizontal scroll with a sticky first column. "Never silent sideways scroll — pair with a hint" | **ZERO adopters** — defined, never used. Chunk A is its first real customer |
| `.stickyActionBar` | safe-area sticky footer | modal footers, attendance footer, save bar |

**This is the single most important judgement in the chunk: which table is a LIST and which is a GRID.**
- **List-shaped → `.tableAsCards`.** Verified `<table>`-based today: **expenses** and **allocations**. Dues already does this and is the exemplar to copy.
- **Genuinely 2-D → `.scrollX`/`.scrollXSticky` + a visible hint.** **Budget** and **Budget vs Actual** are NOT tables at all — they are CSS-grid layouts with **fixed pixel columns** (`grid-template-columns: 1fr 110px 110px 110px`, and one at `1fr 100px 110px 110px 110px`; Budget uses `1fr repeat(var(--cols,3), 90px)`). Squashing budget-vs-actual-variance into a card list would destroy the comparison that is the entire point of the page. Decide deliberately and bring it to the owner.
- **`budget.module.css` and `bva.module.css` contain ZERO `@media` blocks.** Not "wrong at small sizes" — literally no mobile handling exists. Both also set a page `max-width: 960px`, which is the other half of f9-2 (capped on a wide monitor *and* scrolling internally).
- **Fundraiser detail** (`accounting/fundraisers/[fundraiserId]/page.tsx`) is the fourth surface from §1.3 — classify it the same way.

**The unsaved-changes guard already exists and is proven.** `UnsavedChangesGuard` (components/coaches) is used by Roster, Player Detail, Schedule, the Lineup builder and the Announcement editor — and by **none** of the seven Accounting pages. This is adoption, not invention. (§1.1's P1 #5 also names Tryout-setup forms; they are NOT in chunk A — decide whether to pull them in or leave them for chunk E.)

**The native `alert()` is a single line:** `accounting/budget/page.tsx` — the only native dialog left anywhere under `app/[orgSlug]/coaches/`. Batch 2 replaced the equivalent `window.confirm` on the Staff panel with the portal's `ConfirmProvider`; do the same here. Verify the claim yourself (`grep` for it) before writing it into a plan — it may have moved.

**Page inventory (line counts, 2026-07-29):** dues 1336 · budget 1039 · expenses 766 · budget-vs-actual 722 · payment-requests 443 · fundraisers 293 · allocations 266 · the Money hub 498.

### Scope — what the coach gets

1. **Every Money surface is usable on a phone.** A treasurer-coach standing in a parking lot can read their budget, check what's been spent against it, and see what a fundraiser brought in — not just collect dues.
2. **No Money form silently eats work.** The longest, most annoying-to-redo forms in the product warn before discarding.
3. **No native browser dialogs anywhere in Money.**
4. **Owner bundling decisions (rule at the mockup round, build only if approved):** the desktop half of f9-2 (the 960px cap forcing internal scroll on a wide monitor), the Payment Requests ↔ Allocations cross-link (f4-7), and the inconsistent "(paid only)" caveats on the Money hub's headline numbers (f4-6). All three sit on the exact surfaces this chunk reworks.

### ⚠ Don't paint the empty budget state into a corner

**Chunk G — "the budget starter" — is queued to land on these same surfaces** (owner-raised 2026-07-29; `PROGRAM_COACH_PORTAL.md` §1.1, logged as **Proposed** in the Business Decisions Log). It will replace the blank Budget page a first-season coach currently meets with a guided starter plus a worked sample. **It is NOT in chunk A's scope and must not be built here.**

What that means for this chunk: when you restyle the Budget and Budget-vs-Actual empty states, leave room for a richer first-run surface rather than hard-coding a minimal "Set a budget" CTA as the permanent answer. Do not invest in polishing the empty state itself — it is about to be replaced. And **do not introduce any suggested dollar figures, benchmarks or sample amounts anywhere in Money**: whether the product may suggest costs at all is the open decision gating chunk G, and inventing figures is explicitly rejected in that proposal.

### Landmines & contracts (hard-won — respect them)

- **Two breakpoints only.** 900px shell, 640px content. Do not introduce a third. The CSS header comment is binding.
- **Never silent sideways scroll.** If a surface genuinely needs `.scrollX`, it must carry a visible hint that it scrolls — the review flagged Insights tables scrolling with no cue as its own finding.
- **Money is capability-gated.** `capabilities.money` is three-state (`off | read | write`); server-side redaction already exists and every Money route enforces it. A card reflow must not leak a figure a `read` coach shouldn't see, and must not surface a write affordance to one.
- **The Budget page's modals were migrated to shared chrome in Batch 1** (they previously used a duplicated local modal CSS that shared fixes could not reach). Do not regress that — and note `budget.module.css` still exists for the page's own grid.
- **Sheet contract (Batch 1):** portal modals are full-height sheets ≤640px — `CoachModalHeader`, actions in `.modalFooter`, `useOverlayOpen(open)`, never paired with `.centeredOnMobile`; `.formGrid` is one column ≤640. **>8 fields → `CoachFormDisclosure`** (Batch 2) — Add Payable already has two disclosures; check the others against the ≤8 rule rather than assuming.
- **Warm-theme rules:** raw `--logic-lime` is NEVER a fill inside the portal (the warm gate remaps it to olive); "on"-state chips use the warm lime-restore group or `--home-lime`; no raw white rgba inks; olive is text/border/tint only. All six colour-token baselines are at their current values — do not add a literal.
- **Batch 4 added organizer-owned mirrored tournament games to the calendar.** Money doesn't touch events directly, but tournament *payables* reference tournaments — if you touch anything that writes an event, respect `isMirroredEvent`.
- **Git:** ONE shared `dev` branch. ⚠ The tree is shared with **at least one active concurrent session** (a Coach Onboarding "Quiet Mode" stream and a chat/history stream). At Batch 4's commit they had uncommitted work in `TODO.md`, the Overview page, the portal stylesheet, the data dictionary, chat files and `lib/help-content/*`, plus migrations 204/208/209 — and they committed mid-session, sweeping Batch 4's help-content edits into *their* commit. **Diff every shared file, stage explicit `:(literal)` pathspecs, partial-stage where a file is interleaved, audit `git show --stat` after committing, and never commit or push without explicit per-action owner OK.**
- **Dev server:** a supervisor from a concurrent session auto-respawns `next dev` on port 3000 when it frees. Verify health (login 200, no Supabase `EACCES`) rather than fighting it; coordinate before killing it.
- **Playwright probes (computed styles, never screenshots):** accounts `j2-rep-coach@dev.local` / `devpass123` (club-owned) and `coach@dev.local` / `devpass123` (standalone). ⚠ Scope text assertions to `main[class*="coachesMain"]` — an outer layout `<main>` wraps the phone-hidden sidebar. ⚠ **Provisioning gotchas that each cost a full run in Batch 4:** `rep_team_coaches.coach_role` is CHECK-constrained to `head_coach|assistant_coach` and the table has **no** `email`/`name` columns; `rep_roster_players` uses `player_first_name`/`player_last_name`/`player_number`; `rep_teams.slug` is NOT NULL. **Error-check every insert** — a silently-failed one reads downstream as "the feature didn't work". Batch 4's suite (`tests/uat/scenarios/team-tournament-game-mirror-smoke.spec.ts`) is the current reference for the self-provision + verified-teardown recipe.
- **Docs:** user-facing flow changes → `lib/help-content/coaches.tsx` (⚠ carries foreign work; partial-stage). Durable design calls → `memory/design_decisions.md`. Tick the absorbed items in `PROGRAM_COACH_PORTAL.md` §1.1.

### Owner decisions to bring to the mockup round

- **Cards vs scroll, per surface.** Which Money tables become stacked cards and which stay a scrollable grid with a sticky first column — recommend one per surface, and say plainly what is lost each way. Budget vs Actual is the contested one: a comparison grid squashed into cards stops being a comparison.
- **Does the desktop half of f9-2 ride along?** The 960px page cap that forces an internal horizontal scroll on a wide monitor — in or out.
- **Which forms get the unsaved-changes guard** — all seven Money surfaces, or only the ones with real multi-field input (budget line, payable, payment request, fundraiser settings)? And do Tryout-setup forms come along, or wait for chunk E?
- **Bundle f4-7 (Payment Requests ↔ Allocations cross-link) and f4-6 (inconsistent "(paid only)" caveats)** — in or out.

### Definition of done

Plan + PM brief docs (`docs/projects/active/COACH_PORTAL_CHUNK_A_*`), approved mockups, built + `/simplify` + `/review` clean (**standard tier is defensible here** — no migration, no auth change, no new write path; go HIGH only if the build turns out to touch money *calculation* rather than money *presentation*), typecheck/tests/lint green, colour-token baselines unchanged, Playwright probes at 360×740 proving every Money surface reflows with **zero horizontal page scroll** and no clipped figures, fresh dev restart, owner QA, committed on `dev` with per-action OK, and §1.1 / TODO / memory / help docs updated.

**Expect NO migration.** This is presentation and adoption of existing primitives. If a schema change appears, stop and re-scope — it means the chunk was misread.

---

## Program state at handoff (2026-07-29)

- **All 8 launch P0s are CLOSED.** Batch 1 `934e5275` · Batch 2 `8040f4e6` · Batch 3 `85d2a015` · Batch 4 `13e2c021`. All on `dev`, **none on prod**.
- **A release of Batches 1–4 is planned by the owner**, bundled with other in-flight streams once their reviews are done and verified. Several migrations across those streams are dev-only — the release pass owns that inventory. **Chunk A does not block on it and must not wait for it**, but expect `dev` to move underneath you.
- **Chunk A is the recommended next build** — the only chunk with no dependency and no collision. The other five: **B** findability & portal chrome (unblocked, but overlaps the live Quiet Mode stream), **C** schedule intelligence (unblocked), **D** the parent-facing set (largest commercial upside; needs an owner ruling on retention-vs-acquisition first), **E** tryouts & development tidy-up (small, collision-free), **F** the frozen past season (owner-DECIDED, no decision outstanding — `PROGRAM_COACH_PORTAL.md` §1.5).
- **One decision the owner still owes, unrelated to this chunk:** **CP-7** — when a player has two guardians, does the dues reminder go to both or to one nominated payer? It gates the guardian model (§1.4).
