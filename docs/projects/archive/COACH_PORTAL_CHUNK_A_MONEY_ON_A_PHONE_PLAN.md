# Coach Portal Chunk A — Money on a Phone — Implementation Plan

> **Status:** ✅ **COMMITTED TO DEV 2026-07-30 — `a737acbf`** (19 files, owner-approved; post-commit audit clean, zero foreign files; `TODO.md` deliberately left out per the Batch 1–4 precedent). **NOT pushed, NOT on prod.** Residual: owner phone QA on the committed state (a clean dev restart is recommended first — new shared files landed). `/simplify` + `/review` + `/docs` all DONE (records below). Earlier build record follows:
>
> **✅ BUILT ON DEV 2026-07-30.** Mockups APPROVED (rev 1) + D1–D5 ALL RATIFIED at the recommendations (owner, 2026-07-29) — the artifact is the binding visual spec. All phases built in one pass. Gate: `npx tsc --noEmit` **0 errors** · `npm test` **482/482** · focused lint on every changed file **0 errors** · **all six colour-token baselines unchanged** · date-correctness 0 · schema parity 0 · dictionary + org-guard + observability green · **Playwright 13/13 @360×740 + 1280×900**. **Remaining:** `/simplify` → `/review` (standard tier) → `/docs` → clean dev restart → owner QA → commit with per-action OK. NOT on prod. **No migration** (as predicted).
>
> **Build deviations & findings (2026-07-30) — read before reviewing against the mockups:**
> - **TWO REAL CAPABILITY GAPS FOUND BY THE PROBE, both pre-existing, both fixed.** The Expenses page's **"Add Expense" and "Add Payable"** header buttons were the *only* ungated write affordances on that page (every other one already checked `canWriteMoney`), and **Payment Requests never checked the money capability at all** — so a `read`-only money assistant was offered forms the server would refuse. Neither is a mobile bug; both were invisible until a probe logged in as a read-only coach.
> - **The phone sheet has NO BACKDROP.** Batch 1's contract makes a portal modal full-height at ≤640, so there is nothing behind it to tap — the way a coach loses work on a phone is the **back arrow**, which reads as navigation rather than destruction and is therefore the *more* dangerous path. The guard covers back-arrow, X and Cancel; the probes exercise the back arrow at 360px and the backdrop at 1280px. The mockup's "backdrop tap" framing was desktop-accurate and phone-wrong.
> - **A pinned first column lurches by exactly the row's left padding** unless the pin owns its own gutter: `left: 0` is measured from the *scroller's* edge, not the row's, so the label started 11px inset and snapped flush on the first swipe. The shared primitive now takes `--scrollx-pin-gutter`, and each row hands down its former padding **including the hierarchy indent** so category → line → period nesting still reads while the label stays put. Caught by probe, not by eye.
> - **The scroller and its hint ship as ONE component** (`CoachScrollX`), not as a class an adopter must remember to pair. That is why `.scrollX` had zero adopters and no hint class for a month: the contract was unsatisfiable. The hint is honest — it appears only while the content actually overflows and retires once the coach scrolls — which is what lets the same component be used on a surface that only overflows on small viewports.
> - **The discard guard uses the portal's shipped `ConfirmProvider`**, so "Discard" renders as the danger-coloured confirm and "Keep editing" as the focused ghost. The mockup drew "Keep editing" as the lime primary; matching that pixel would have meant a bespoke dialog. The safe action still receives focus, which is the property that matters.
> - **`formFromLine` extracted** so "open the edit modal" and "the guard's dirty baseline" share ONE mapping — two copies would drift and the guard would either nag on an untouched form or miss a real edit.
> - **Budget's "Total Amount" gained a real label association** (`htmlFor`/`id`): with label and input on separate lines at phone width, tapping the label should focus the field. ⚠ **Noted, not fixed:** most other Money form labels are still unassociated `<label>` elements — a pre-existing portal-wide pattern, out of scope here.
> - **Probe-recipe gotchas (each cost a run; error-check every insert):** `rep_team_expenses.expense_type` is CHECK-constrained to `expense | tournament_payable` (**not** `tournament`); `rep_allocation_splits.payment_schedule` is `standard | custom` (**not** `installments`) **and** `split_method` is `percentage | sessions | fixed` (**not** `manual`) — two CHECKs on one row, neither guessable from the column name.
> - **`.tableAsCards td:empty { display: none }`** is a shared fix, not a per-page one: any adopter's empty trailing cell would have drawn a blank card line, most visibly for a read-only coach whose every action cell is empty. Dues (the exemplar) benefits too.
> **Created:** 2026-07-29
> **Branch:** dev
> **Source:** `docs/agents/design/PREMIUM_COACH_PORTAL_UX_READINESS_REVIEW.md` — P1 **#10** (f4-2 / f9-1 ×2 / f4-3, money tables no mobile adaptation), P1 **#5** (f7-3 / f7-7, unsaved-changes guard), P2 **f7-6** (native `alert()` on budget-delete failure). Bundling candidates ruled at the mockup round: **f9-2** (desktop grids capped then internally scrolling), **f4-7** (Payment Requests ↔ Allocations cross-link), **f4-6** (inconsistent "(paid only)" caveats). Plus `PROGRAM_COACH_PORTAL.md` §1.3's remaining mobile-pass tables.
> **Predecessors whose contracts bind here:** Batch 1 `934e5275` (sheet default ≤640, `CoachModalHeader`, `useOverlayOpen`, one-column `.formGrid`) · Batch 2 `8040f4e6` (`CoachFormDisclosure`, >8-field rule) · Batch 4 `13e2c021`.
> **Plan gating:** Premium Coaches Portal only. No billing-plan changes.
> **Migrations: NONE EXPECTED.** This is presentation + adoption of existing primitives. If a schema change appears, stop and re-scope — it means the chunk was misread.

---

## Goal

A treasurer-coach standing in a parking lot can **read their own money** on a phone — the budget, what's been spent against it, what a fundraiser brought in, what the org has allocated — not just collect dues. And no Money form silently eats a hand-built budget split when a thumb lands on the backdrop.

## PM Brief

See `COACH_PORTAL_CHUNK_A_MONEY_ON_A_PHONE_PM_BRIEF.md`.

---

## Ground truth (verified by direct code read, 2026-07-29 — treat as verified, do not re-derive)

### The primitives exist; the header comment is the contract

`app/[orgSlug]/coaches/coaches.module.css` opens with the binding mobile contract: **two breakpoints only** (900px shell, 640px content), and three opt-in primitives — `.tableAsCards`, `.scrollX`/`.scrollXSticky`, `.stickyActionBar`.

- **`.tableAsCards` adopters (4):** Dues (the exemplar, 7 columns — the "≤~5 cols" guidance is already stretched and holds because every value is a short number), the Development board, Insights → Development. Mechanic: `data-label` on each `<td>` + the class on the wrapper. A `<td>` **without** `data-label` renders value-only — that is how the trailing action cell is meant to work.
- **`.scrollX` / `.scrollXSticky` adopters: ZERO.** Defined 2026-06-29, never used. **Chunk A is its first customer.** ⚠ Its documented contract says "ALWAYS pair with a visible swipe affordance" — **and no such affordance class exists anywhere in the portal.** So the hint is the one genuinely NEW shared piece in this chunk, not an adoption. Flag it for `/simplify`.

### Which surface is a LIST and which is a GRID — the central judgement, now settled by code

| Surface | What it actually is today | Verdict |
|---|---|---|
| **Expenses** (Expenses tab) | real `<table>`, 5 cols: Description (+ an inline tag editor), Category, Amount, Status, action | **LIST → `.tableAsCards`** |
| **Expenses** (Payables tab) | already cards — but each card holds a hard-coded inline `gridTemplateColumns: '1fr 1fr'` Deposit/Balance pair | ⚠ **not in the prompt's scope list.** Two ~150px boxes at 360px, each holding an amount, a due date and a Mark-Paid button. Same defect class → **reflow to stacked ≤640** |
| **Org Allocations** | real `<table>`, 5 cols: #, Amount, Due Date, Status, action | **LIST → `.tableAsCards`** |
| **Fundraiser detail** | real `<table>`, 6 cols: Rank, Player, Raised, Rebate, Remaining, action — where the action cell opens an **inline log form** with fixed `width: 90px` / `120px` inputs | **LIST → `.tableAsCards`**, and the inline form must go full-width in card mode (today it's a fixed-width form inside a table cell) |
| **Season Budget Plan** | **NOT a fixed grid** — `.lineMain` is flex (desc + amount + actions). It largely survives. Its real defects are elsewhere (below) | **stays structurally as-is**; fix truncation + its modals |
| **Budget vs. Actual** | genuine 2-D CSS grid: `1fr 110px 110px 110px` (category/line/grand-total rows) and `1fr 100px 110px 110px 110px` (period sub-rows) | **GRID → `.scrollXSticky` + a visible hint.** Squashing budget/actual/variance into a card list destroys the comparison that is the page's entire reason to exist |

### `budget.module.css` and `bva.module.css` contain ZERO `@media` blocks

Confirmed by read. Not "wrong at small sizes" — **no mobile handling exists at all.** Consequences beyond the grids:

- **The Add/Edit Budget Line modal uses a LOCAL `.formRow`** (flex, `align-items: flex-end`) — **not** the shared `.formGrid`. Batch 1's one-column-≤640 reflow therefore **does not reach it**: "Total Amount" and the "Split by period" checkbox stay side-by-side on a phone.
- **`.periodInputRow`** is a flex row of three inputs (Label flex:2 / Date flex:1.5 / Amount flex:1) + an optional percent readout + a remove button. At 360px inside a sheet this is the single worst control in Money — **and it is exactly the "hand-built budget split" the chunk exists to protect.**
- **`.previewTable`** (Generate Installments) is `1fr repeat(var(--cols,3), 90px)` — four installments = 1fr + 360px of fixed columns inside a ≤640 sheet. **GRID → `.scrollX` + hint.**
- `.lineDesc` / `.lineNotes` are `white-space: nowrap` + ellipsis → a long line description truncates hard rather than wrapping on a phone.
- BVA's `.unbudgetedRow` is a 4-item flex row + a Recategorize button — wraps into an unreadable pile at 360px.

### ⚠ f9-2 is NOT a Money bug — correction to the build prompt

`coaches.module.css:250` declares **`.page { max-width: 960px }` portal-wide**, with an existing opt-out **`.pageWide { max-width: 1200px }`** used by the Schedule's week/month views for exactly this reason ("structured layouts benefit from extra width"). `budget.module.css` and `bva.module.css` merely **re-declare the same 960px** locally.

So "capped to a narrow column then forced into its own internal scroll" is the **portal's reading-column convention meeting a wide grid**, not a Money defect. Raising the cap on Money alone would make Money the only wide page in the portal. **The honest fix is for Budget vs. Actual to adopt the existing `.pageWide` precedent** — a decision that already has a shipped precedent to point at. See **D2**.

### ⚠ The unsaved-changes guard is NOT adoption — correction to the build prompt

`UnsavedChangesGuard` (components/coaches → components/shared) guards **route navigation only**: a `beforeunload` listener plus a capture-phase click interceptor on `<a>` elements, resolving through `FeedbackModal`. It is used by Roster, Player Detail, Schedule, the Lineup builder and the Announcement editor — all of which are **pages**.

**Every Money form is a modal.** Each one closes on backdrop click, on the X, and on Cancel — and the route guard does nothing for any of those. Verified across all seven Money surfaces: `onClick={() => setShowX(false)}` straight on `styles.modalOverlay`, with no dirty check anywhere.

Therefore the work is **two things, not one**:
1. **A dirty-aware modal dismiss** — new, small, shared. Routes through the portal's existing `ConfirmProvider` (`useConfirm()`, already the branded `window.confirm` replacement used by Staff, Award types, Development, Announcements).
2. **The existing route-level guard**, dropped onto the Money pages so a mid-form tap on the sidebar or bottom nav is also caught.

### The native `alert()` — verified, and the prompt's suggested fix is the wrong one

`accounting/budget/page.tsx:365`, in `handleDelete`'s catch. **It is the only native dialog left anywhere under `app/[orgSlug]/coaches/`** (grep-confirmed across all seven Money pages; Batch 2 removed the Staff `window.confirm`).

⚠ **Do not route it through `ConfirmProvider`.** On failure `setDeletingId(null)` is never reached, so **the styled delete-confirm modal is still open** when the alert fires. The correct fix is an **inline error inside that already-open modal** — the same treatment every other Money modal gives its save errors. Confirming twice would be nonsense.

### f4-6 — verified, and it is worse than "inconsistent"

Money hub headline tiles: **Money Out** reads "expenses + org payments **(paid only)**". **Money In** reads "dues + fundraising + org" — with **no caveat, though it is equally collected-only**. **On Hand** reads "in − out", inheriting both bases silently. A coach reading the row concludes Money In is committed revenue and Money Out is cash — it is cash on both sides. **Copy-only fix.**

### f4-7 — verified

Org Allocations and Payment Requests are both org-linked-only pages, both reachable **only** from the Money hub, and neither mentions the other. A coach who owes the org money on the Allocations page has no path to the page that pays it.

### Capability gating — confirmed, no new gate

`capabilities.money` is three-state (`off | read | write`); every Money page reads `assignment.capabilities.money === 'write'` and server-side redaction already exists. **Every write affordance in the tables is already conditionally rendered**, so a card reflow inherits the gate for free. ⚠ One real trap: a read-only coach's trailing action `<td>` renders **empty**, which in card mode becomes a blank card line. Cells with no content must not be emitted (or must carry no `data-label` **and** collapse when empty).

### ⚠ Don't paint the empty budget state into a corner

**Chunk G — the budget starter** — is queued onto these exact surfaces (`PROGRAM_COACH_PORTAL.md` §1.1; logged **Proposed**, not decided). Budget's empty state today is a local icon + "Add First Line" button; BVA's is already a `CoachEmptyState`. **Rule for this chunk:** make them legible on a phone, leave structural room for a richer first-run surface, invest nothing in the copy — and **introduce no suggested dollar figures, benchmarks or sample amounts anywhere in Money.** That is the open decision gating chunk G and inventing figures is explicitly rejected in the proposal.

### Page inventory (lines, 2026-07-29)

dues 1336 · budget 1039 · expenses 766 · budget-vs-actual 722 · payment-requests 443 · fundraisers 293 · allocations 266 · Money hub 498.

---

## Phases

### Phase 1 — The one new shared piece

- [ ] **1.1 A visible "scrolls sideways" affordance.** `.scrollX`'s own contract demands one and none exists. Add a single shared hint to `coaches.module.css`, shown only ≤640 and only when the content actually overflows, sitting **above** the grid so it reads before the swipe. No third breakpoint; no new colour literal (warm-gate safe tokens only). This is the chunk's only new abstraction — call it out to `/simplify`.
- [ ] **1.2 A dirty-aware modal dismiss.** One small shared helper the Money modals use for backdrop / X / Cancel: when the form is dirty, `await confirm(...)` through the existing `ConfirmProvider` before discarding; when clean, close silently. Copy: names what is lost, "Keep editing" / "Discard". **Never** blocks a *save*, only a discard.

### Phase 2 — The list-shaped tables become cards (§1.3's mobile-pass remainder)

Follows the Dues exemplar exactly: `data-label` per `<td>` + the class on the wrapper.

- [ ] **2.1 Expenses — Expenses tab** → `.tableAsCards`. The inline tag editor inside the Description cell must go full-width in card mode (it carries a `maxWidth: 340` today).
- [ ] **2.2 Expenses — Payables tab** (⚠ found during ground truth, not in the prompt's list): the inline `1fr 1fr` Deposit/Balance pair stacks ≤640.
- [ ] **2.3 Org Allocations** → `.tableAsCards`. The per-split accordion header (a hand-rolled inline-styled flex button with two right-hand money chips) also needs to stack ≤640.
- [ ] **2.4 Fundraiser detail leaderboard** → `.tableAsCards`, and the inline "Log Amount" form goes full-width with real inputs instead of 90px/120px stubs.
- [ ] **2.5 Empty action cells** are not emitted, so a read-only coach never sees a blank card line.

### Phase 3 — The comparison grids learn to scroll honestly

- [ ] **3.1 Budget vs. Actual** → `.scrollXSticky` on the category/line/period/grand-total grid family, with the description column pinned so a coach always knows which line a number belongs to, plus the Phase-1 hint. **The grid keeps its shape — Budgeted / Actual / Variance stay side by side.**
- [ ] **3.2 BVA's unbudgeted-expenses rows** reflow to a stacked card ≤640 (they are a list, not a comparison).
- [ ] **3.3 Generate Installments preview** → `.scrollX` + hint (player column pinned).
- [ ] **3.4 Budget page truncation:** line descriptions and notes wrap instead of ellipsing ≤640; the summary banner's inline season-total editor stops overflowing.

### Phase 4 — Money forms stop eating work (P1 #5)

- [ ] **4.1 Adopt the Phase-1.2 dismiss guard** on the Money modals that hold real multi-field input — **scope per D3.**
- [ ] **4.2 The Add/Edit Budget Line modal joins the shared form contract:** its local `.formRow` reflows to one column ≤640 (or migrates to `.formGrid`), and `.periodInputRow` stacks label / date / amount into a full-width group per period with the remove control reachable. **This is the single most valuable fix in the chunk** — the period split is the thing coaches hate retyping.
- [ ] **4.3 Route-level guard** on the Money pages so a mid-form sidebar/bottom-nav tap is caught too.
- [ ] **4.4 Field-count check against the ≤8 rule** (Batch 2): Add Payable already carries two `CoachFormDisclosure` groups; **check the Budget Line and Payment Request forms against the rule rather than assuming** — Budget Line with periods open is well past 8 controls.

### Phase 5 — The small honest fixes

- [ ] **5.1 (f7-6) The native `alert()` dies** — replaced by an inline error in the already-open delete-confirm modal (see ground truth; **not** a second confirm).
- [ ] **5.2 (f4-6, per D4) The "(paid only)" caveat becomes consistent** across Money In / Money Out / On Hand on the Money hub. Copy only.
- [ ] **5.3 (f4-7, per D4) Allocations ↔ Payment Requests cross-link** — one quiet line each way, org-linked teams only.
- [ ] **5.4 (f9-2, per D2) Budget vs. Actual adopts the existing `.pageWide` precedent** so a wide monitor gives the grid room instead of a 960px column with its own internal scroll. **The shared 960px default is not touched.**

### Phase 6 — Verification + handoff

- [ ] `npm run typecheck` · `npm test` · focused lint on every changed file · **all six colour-token baselines unchanged** · dictionary/org-guard/observability green. (⚠ `verify:changed`'s schema-parity step may still fail on other sessions' dev-only migrations — **not ours, do not re-baseline.**)
- [ ] **Playwright probes — computed styles, never screenshots** (`memory/feedback_verify_with_playwright_not_screenshots.md`). At **360×740**, for all seven Money surfaces: (a) `document.scrollingElement.scrollWidth <= clientWidth` — **zero horizontal page scroll**; (b) no money figure clipped (each amount's `scrollWidth <= clientWidth`); (c) BVA's grid scrolls **inside its own container** with the first column pinned and the hint present; (d) the budget-line period rows are full-width and tappable; (e) a dirty modal's backdrop tap raises the discard confirm and **Keep editing preserves every field**; (f) a `read`-capability coach sees no write affordance and no blank card lines. ⚠ Scope text assertions to `main[class*="coachesMain"]` — an outer layout `<main>` wraps the phone-hidden sidebar.
- [ ] `/simplify` (the Phase-1 hint + dismiss guard are new abstractions — exactly what it exists to catch) → then `/review`. **Standard tier is defensible** — no migration, no auth change, no new write path, presentation only. Go HIGH only if the build ends up touching money *calculation* rather than money *presentation*.
- [ ] Docs: `lib/help-content/coaches.tsx` (⚠ carries foreign work — partial-stage) · `memory/design_decisions.md` (the list-vs-grid ruling + the hint primitive) · auto-memory `project_premium_coach_portal_ux_eval.md` · **tick the absorbed items in `PROGRAM_COACH_PORTAL.md` §1.1 and §1.3 in this same unit of work**.
- [ ] Fresh dev restart (shared stylesheet + new shared helper ⇒ **restart required**: stop → `rm -rf .next` → `npm run dev` → Ready, login 200, no Supabase `EACCES`) → **owner QA** → commit on `dev` with explicit per-action OK.

---

## Architectural decisions (proposed — ratify with the mockups)

- **A list becomes cards; a comparison stays a grid.** *Rationale:* the Dues exemplar works because every row is one record you read top-to-bottom. Budget vs. Actual is read *across* — Budgeted vs Actual vs Variance on one line is the whole product. Card-stacking it would technically remove the horizontal scroll and destroy the feature.
- **An honest sideways scroll beats a dishonest reflow.** *Rationale:* the review's own separate finding was Insights tables scrolling with no cue. A grid that must scroll is fine; a grid that scrolls *secretly* is the bug.
- **The discard guard lives on the modal, not the route.** *Rationale:* the shipped guard protects pages, and Money's forms are all modals — the actual loss event is a backdrop tap, which no route guard can see.
- **Don't widen the portal to fix one grid.** *Rationale:* 960px is the portal-wide reading column with a shipped 1200px opt-in for structured layouts. Budget vs. Actual is a structured layout. Use the existing opt-in; leave the default alone.
- **Presentation only — no money math is touched.** *Rationale:* every figure on these pages is already computed and already redacted server-side by capability. If a number changes during this chunk, something is wrong.

## Owner decisions (D1–D5) — ✅ ALL RATIFIED 2026-07-29 at the recommendations

| # | Decision | Recommendation — **ratified** |
|---|---|---|
| **D1** | **Cards or scroll, per surface.** | **Cards:** Expenses, Payables, Allocations, Fundraiser leaderboard, BVA's unbudgeted list. **Scrolling grid + pinned first column + visible hint:** Budget vs. Actual, the installment preview. **Structurally unchanged:** the Budget line list (already flex; just stop truncating). *What's lost each way:* cards cost you the ability to compare two rows at a glance; a scrolling grid costs a swipe to see the variance column. For a comparison report the swipe is the cheaper loss. |
| **D2** | **Does the desktop half of f9-2 ride along?** | **In — but as adopting the shipped `.pageWide` opt-in on Budget vs. Actual only.** The 960px cap is the portal's convention, not a Money bug; changing it globally is a portal-wide visual change well outside this chunk. |
| **D3** | **Which forms get the discard guard?** | **The five with real multi-field input:** Budget Line, Add Payable, Add Expense, New Payment Request, Fundraiser Settings (+ the Dues schedule form, which is the same component at two call sites). Skip the short single-purpose dialogs (Recategorize, Delete confirm) — a guard there is friction with nothing to protect. **Tryout-setup forms: leave for chunk E** — different area, different QA surface, and pulling them in doubles the probe matrix for no coach-visible gain in Money. |
| **D4** | **Bundle f4-7 (cross-link) and f4-6 (the "(paid only)" caveats)?** | **Both in.** f4-6 is copy on a surface already being reworked and it currently misleads about cash. f4-7 is one line each way. Together they are the cheapest honesty-per-token in the backlog. |
| **D5** | **Two defects found during ground truth that the prompt did not name — in scope?** | **In.** (a) The Payables tab's two-up Deposit/Balance boxes at 360px, and (b) the Budget Line modal's local form row + period-split inputs, which Batch 1's one-column reflow provably never reached. Both are the same defect class as the named items, both are on surfaces being touched anyway, and (b) *is* the "don't make me retype the budget split" promise. |

## Mockups

Visual spec artifact — owner approval is **binding** per `memory/feedback_build_to_approved_mockups.md`; every element labelled **NEW / RESTYLED / UNCHANGED**. Frames at a true 360px phone width in the shipped warm portal tokens.

**`claude.ai/code/artifact/dc2eb969-1f4d-4743-9bfc-d1cd55575e3d`** (rev 1, published 2026-07-29 — **awaiting owner approval**). 9 frame groups: Budget vs. Actual before/after (the scrolling comparison grid + the new swipe hint), Expenses before/after, the tournament-payables deposit/balance pair, Allocations + the fundraiser leaderboard (incl. the cross-link), the budget-line period split before/after **plus the discard guard**, the native-alert replacement, the Money hub's "(paid only)" captions, the desktop width fix, and the deliberately-untouched empty budget state. Plus D1–D5 as cards with recommendations marked, and the verification bar.

## Landmines & contracts (carried forward — respect, don't relearn)

- **Two breakpoints only.** 900px shell, 640px content. The CSS header comment is binding. Do not introduce a third.
- **Never a silent sideways scroll.** Any `.scrollX` adoption ships with the Phase-1 hint.
- **Money is capability-gated** (`off | read | write`). A card reflow must not leak a figure a `read` coach shouldn't see and must not surface a write affordance to one.
- **Sheet contract (Batch 1):** portal modals are full-height sheets ≤640 — `CoachModalHeader`, actions in `.modalFooter`, `useOverlayOpen(open)`, never paired with `.centeredOnMobile`; `.formGrid` one column ≤640; **>8 fields → `CoachFormDisclosure`**.
- **Budget's modals were migrated to shared chrome in Batch 1** — do not regress that. `budget.module.css` legitimately still exists for the page's own layout.
- **Warm-theme rules:** raw `--logic-lime` is NEVER a fill inside the portal; "on"-state chips use the warm lime-restore group or `--home-lime`; no raw white rgba inks; olive is text/border/tint only. All six colour-token baselines are at their current values — **do not add a literal.** (`bva.module.css` has one documented `token-exempt` orange; don't add a second.)
- **No suggested dollar figures anywhere in Money** — that is chunk G's gating decision.
- **Git: ONE shared `dev` branch, and the tree is live.** At planning time a concurrent session had uncommitted work in `TODO.md`, the team Overview page, `CoachPortalTour.tsx`, two admin components, a public component, both Quiet-Mode plan docs, **and a shared-module rename (`components/coaches/overlay-hooks.ts` → `components/shared/overlay-hooks.ts`)**. Diff every shared file, stage explicit `:(literal)` pathspecs, partial-stage interleaved files, audit `git show --stat` after committing, and **never commit or push without explicit per-action owner OK.** The `TODO.md` precedent from Batches 1–4 is to let the concurrent session's commit carry the line.
- **Dev server:** a concurrent session's supervisor auto-respawns `next dev` on port 3000. Verify health rather than fighting it; coordinate before killing it.
- **Probes:** `j2-rep-coach@dev.local` / `devpass123` (club-owned) and `coach@dev.local` / `devpass123` (standalone). Error-check every provisioning insert — a silently-failed one reads downstream as "the feature didn't work". Batch 4's suite is the reference recipe.

## Out of scope (noted, not forgotten)

- **Chunk G — the budget starter.** Same surfaces, explicitly not this chunk. This chunk must not paint its empty states into a corner.
- **Tryout-setup form guards** (the other half of P1 #5) → chunk E, per D3.
- **The Dues page** — already the mobile exemplar; untouched except where the shared schedule form gains the discard guard.
- **Money calculation, redaction, and every API** — presentation only.
