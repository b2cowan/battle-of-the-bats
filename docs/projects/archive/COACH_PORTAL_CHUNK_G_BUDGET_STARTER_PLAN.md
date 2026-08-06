# Coach Portal Chunk G — The Budget Starter — Implementation Plan

> **Status:** ✅ **BUILT ON DEV 2026-07-30 (uncommitted).** D1–D6 ALL RATIFIED at the recommendations; mockups rev 1 (`claude.ai/code/artifact/77f5175e-7e5b-4f18-ba24-0a0eabc46729`) = binding visual spec. **Gate:** `tsc --noEmit` 0 errors · `npm test` 482/482 · focused lint 0 errors · `verify:changed` fully green (**all six colour-token baselines unchanged**; my two NEW CSS modules joined the guardrail count at zero literals — 203→205 modules) · **Playwright 18/18** (full Money suite @360×740 + desktop: all 13 Chunk A regressions + 5 new starter tests, incl. a data-level D-G1 assertion that no platform-default `budget_items.suggested_amount` is ever non-NULL). NO migration, as predicted. Remaining: `/simplify` → `/review` (standard) → `/docs` → clean dev restart → owner QA → commit with per-action OK.
>
> **Build deviations from the mockups (flag at QA, each with its reason):**
> - **Question chips render as the portal's shipped segmented control** (`.segChoice`/`.segBtnActive`), not the mock's separate rounded pills — reuses the exact control the coach already knows (Roster list/depth toggle, bulk-add tabs), inherits its warm-gate treatment for free, and avoids inventing a new on-state fill that would need its own lime-restore work.
> - **The done-state tick is a rounded SQUARE on a success tint,** not the mock's lime circle — circles are banned in the coach portal (standing medallion rule), and the success tint matches Money's existing "generated ✓" language.
> - **The sample fence's SAMPLE eyebrow is olive TEXT on the tint,** not the mock's solid olive tag — solid olive fills are out of bounds in the warm portal (olive is text/border/tint only).
> - **Entry Fees' ×N helper appears only when the tournament count is 2+** — "× 1 = " reads as noise; a single-tournament season gets the plain amount field.
> - **The coach's ×N arithmetic is stored on the line as its note** ("4 × $600") so the reasoning survives onto the budget page — their numbers, kept visible.
>
> Original planning header follows:
> **Branch:** dev (ONE shared branch; tree shared with an active concurrent session)
> **Source:** `PROGRAM_COACH_PORTAL.md` §1.1 chunk G (owner-raised 2026-07-29 — NOT a readiness-review finding). Build prompt: `COACH_PORTAL_CHUNK_G_BUDGET_STARTER_BUILD_PROMPT.md`.
> **Already decided by the owner (2026-07-30), NOT open:** **D-G1** structure only — the product never proposes a dollar figure (a number the coach types is theirs; a number the product supplies/prefills/suggests is forbidden; grounding suggestions in platform tournament data was considered and REJECTED). **D-G2** build the FULL starter in one chunk — guided questions producing a real editable starting budget AND the clearly-labelled sample.
> **Predecessors whose contracts bind here:** Batch 1 `934e5275` (sheet default ≤640, `CoachModalHeader`, `useOverlayOpen`, one-column `.formGrid`) · Batch 2 `8040f4e6` (`CoachFormDisclosure`, >8-field rule, per-row bulk outcomes) · Chunk A `a737acbf` (list-vs-grid, `CoachScrollX`, `useDiscardGuard`, layout primitives — `memory/design_decisions.md` 2026-07-30 entry is binding).
> **Plan gating:** Premium Coaches Portal only. No billing-plan changes. No pricing facts asserted anywhere in starter/sample copy (`PLAN_PRICING_FACTS.md` untouched).
> **Migrations: NONE.** Verified feasible — see ground truth. If a schema change appears mid-build, stop and re-scope.

---

## Goal

A first-season coach opens Season Budget Plan and, instead of a blank page, answers a few plain
questions and lands on a real, editable starting budget — the right **lines**, in the right
**categories**, priced only with numbers **they themselves typed** — plus a clearly-labelled sample
budget and sample budget-vs-actual so they can see what "finished" looks like before they build it.
The question they actually have — **"what am I forgetting?"** — stays answered all season by a
derived checklist of standard budget items not yet in their plan. **Nobody is anchored: no figure
anywhere in Money originates from the product.**

## PM Brief

See `COACH_PORTAL_CHUNK_G_BUDGET_STARTER_PM_BRIEF.md`.

---

## Ground truth (verified by direct read 2026-07-30 — re-verified beyond the build prompt; two additions matter)

### The full seeded taxonomy (mig `027_budget_categories.sql`) — the prompt's table was abridged

Team-visible categories (scope `team` or `both` — exactly what `GET /api/coaches/[orgSlug]/budget-items` returns; `org`-scoped Admin and Coaching are filtered out at the API):

| Category | Scope | Default items (all name-only, `suggested_amount` NULL) |
|---|---|---|
| Tournaments | both | Entry Fees · Uniforms · Travel · Misc |
| Facilities | both | Diamond Permits · Dome Time · Field Equipment · Lighting Fees · Misc |
| Officials | both | Umpire Fees · Plate Fees · Certification · Misc |
| **Team Gear** | team | Jerseys · Hats · Balls · Bats · Bags · Misc |
| Training | both | Coaching Clinics · Off-Season Training · Batting Cages · Misc |
| Events | both | Year-End Party · Photo Day · Awards Night · Banquet · Misc |
| **Fundraising Costs** | team | Supplies · Venue · Printing · Misc |

The API sorts Misc last within each category and includes org **custom** categories/items alongside
defaults. `canViewMoney` gates the GET; `canWriteMoney` gates the item-create POST.

### ⚠ NEW FINDING 1 — a budget line CANNOT hold a blank amount. The checklist must be DERIVED, not stored.

`rep_budget_lines.total_amount` is `numeric(10,2) NOT NULL CHECK (total_amount > 0)` (mig 028), and
the lines POST enforces the same. So "the right lines with amounts blank" is **structurally
impossible as stored rows** — and that is fine, because it forces the honest design:

- A **priced** item (coach typed a number) becomes a real `rep_budget_lines` row via the EXISTING
  POST — no new write path, no migration.
- An **unpriced** item is not a row at all — it is a **derived checklist entry**: a team-relevant
  default taxonomy item with no line in the plan yet (matched by `item_id`, fallback
  case-insensitive name). Zero storage; always current; works identically for a coach who never ran
  the starter (including season-2+ coaches with a carried budget who forgot a category).
- Checklist dismissals ("we don't pay for this") are **device memory** — localStorage per
  team+season, the shipped pattern (Batch 4 Moved markers, Batch 3 winding-down dismiss). Worst
  case cross-device: a dismissed chip quietly reappears; self-healing, harmless.

Do NOT invent storage for the checklist (a `dismissed` table, a zero-amount sentinel row, a
`planned_items` join table). That is the re-scope trap the build prompt predicted.

### ⚠ NEW FINDING 2 — the `suggestedAmount` machinery is wider than the prompt said. Three touchpoints, all must stay inert for defaults.

1. `budget_items.suggested_amount` column — NULL for every default. **Stays NULL. (D-G1.)**
2. The budget page's picker `onChange` (budget page, "Item picker" block) prefills the line total
   from `v.suggestedAmount` when set — live code, inert only because defaults are NULL.
3. `POST /api/coaches/[orgSlug]/budget-items` accepts `suggestedAmount` for **coach-created custom
   items** — a coach's own number on their own item, which D-G1 explicitly permits. The starter
   never sets it; nothing in this chunk touches it.

### Everything else re-confirmed

- **Budget page empty state** (write coach): icon + "No budget lines yet." + hint + "+ Add First
  Line". Read-only coach: same minus the button. **This chunk replaces it** — Chunk A left it
  minimal on purpose.
- **BvA empty state:** `CoachEmptyState` → "Create a budget plan" link. Kept; gains a sample door.
- **Money hub plan-stage anchor:** "Start with your season budget" → "Build your budget" →
  `/accounting/budget`. Read-only variant already explains the head coach owns this. Deep-link
  precedent exists on the same page: `?generate=1` auto-opens Generate Installments **only when
  write-capable and applicable** — `?starter=1` mirrors it exactly (write + `lineCount === 0`).
- **Rollover** (`lib/rep-season-rollover.ts`) carries lines + periods + season envelope → a blank
  Budget page is genuinely a first-season situation. **Untouched by this chunk.**
- **Preview-then-confirm precedent:** Generate Installments (same page) previews, then confirms.
- **Capability gate:** `moneyCanWrite = capabilities.money === 'write'`; server enforces via
  `canWriteMoney` on every line write. Read-only leak class is REAL — Chunk A's probe found five
  ungated write affordances across four Money pages. The read-only sweep in
  `tests/uat/scenarios/coach-money-mobile-smoke.spec.ts` (test at ~line 440) covers all eight Money
  surfaces; **extend it, don't fork it.**
- **Line form validation:** description required (≤200), `totalAmount > 0`. Description falls back
  to item name. `formFromLine` is the single form↔record mapping (discard-guard contract).

---

## Design

### 1 · The first-run surface (replaces the Budget page empty state)

When `plan.lines.length === 0`, a write-capable coach meets a first-run card, not a bare button:

- Headline: **"Build your starting budget"** — sub: "Answer a few quick questions and get the
  right cost lines for your season. You fill in only the numbers you know — nothing is guessed
  for you."
- **Primary door:** "Start — about a minute" → opens the Starter sheet.
- **Second door:** "See a finished example" → opens the Sample sheet.
- **Quiet third door:** "Or add lines yourself" → the existing Add Line modal (a coach who knows
  what they're doing is never forced through questions).

Read-only coach: informational empty state — "No budget yet. Building it is the head coach's job;
every line will show here once they do." + the sample door only (the sample is education, not a
write). **No starter, no checklist, no Add Line** — probe-asserted.

### 2 · The Starter sheet (NEW component; write-gated; full-height sheet ≤640 per Batch 1)

Three steps inside one sheet. `useOverlayOpen`, `CoachModalHeader`, footer in `.modalFooter`,
**`useDiscardGuard`** (dirty = any question moved off its default or any amount typed; detail names
the stake: "your answers and 2 amounts"; phone loss mode = back arrow — Chunk A rule 4).

**Step 1 — five questions, one screen, tap-only (sport-neutral copy):**

| # | Question | Control | Seeds (worksheet rows) | Why this question earns its slot |
|---|---|---|---|---|
| 1 | How many tournaments will you enter? | count 0·1·2·3·4·5·6+ | **Entry Fees** (Tournaments) with an N× helper | Usually the single biggest line, and the count is the one number every coach knows cold |
| 2 | Will any of them mean hotels or real travel? | Yes / No | **Travel** (Tournaments) | The classic season-wrecker when forgotten; invisible until the first away weekend |
| 3 | Does the team pay game officials directly? | Yes / No (+hint: "in some leagues the club covers this") | **Umpire Fees** (Officials) | Per-game fees compound quietly; the #1 "wrecks a season" line in the owner's own framing |
| 4 | Will you run an off-season or indoor training block? | Yes / No | **Off-Season Training** (Training) | Big, lumpy, and booked months ahead — the line most often discovered too late |
| 5 | Does the team provide uniforms or shared gear? | Yes / No | **Uniforms** (Tournaments) | First-season teams pay it once and big; second-season coaches forget replacements |

Questions map to seeded items **by name within `is_default` items** from the already-fetched
taxonomy (no hardcoded ids; a missing item — theoretically impossible for defaults — degrades to
skipping that row). One question seeds one row: everything else the coach might need is the
checklist's job, not a sixth question.

**Step 2 — the worksheet ("Your starting budget" — this IS the preview):**

- Seeded rows grouped by category. Each row: item name + an **optional** amount field labelled
  "If you know it — leave blank to price later". Amount placeholders are **"$" only, never a
  numeral** (a numeric placeholder is a suggestion — D-G1 landmine).
- The Entry Fees row shows a per-event helper when Q1 > 1: "About what does one entry cost you?"
  [$ input] × N — with the arithmetic shown in full ("4 × $600 = $2,400"). **The product multiplies
  the coach's own two numbers and shows its work; it estimates nothing.** (Flagged to the owner as
  part of D2 — veto point.)
- Rows are removable (X). Footer names the rest of the taxonomy: "Also worth checking: Facilities ·
  Team Gear · Events · Fundraising Costs" — tapping a chip appends that category's default items as
  unpriced rows.
- Primary CTA counts honestly: **"Add 2 priced lines · keep 3 on your checklist"** (disabled only
  when there are zero rows). All-blank is a legitimate outcome: zero lines created, checklist
  seeded, still a win.

**Step 3 — done:** "Your budget has 2 lines — $3,380, all your numbers — and 3 items on your
checklist to price when you know them." CTA closes to the live page. Quiet sample link.

**Writes:** loop the EXISTING `POST /budget-plan/lines` once per priced row (description = item
name, categoryId, itemId, coach's amount, no notes, no periods). **Per-row outcome reporting**
(Batch 2 binding rule): a row that fails stays visible in the worksheet with its error; successes
are not rolled back. No new write route ⇒ `/review` standard tier holds.

### 3 · The checklist strip (the permanent "what am I forgetting?" — NEW, on the Budget page)

Once ≥1 line exists, write-capable coaches see one quiet collapsed strip under the line groups:

> **Not in your plan yet:** Umpire Fees · Travel · +4 more — *review*

- Expanded: chips grouped by category. **Tap a chip → the existing Add Line modal opens prefilled
  with that category+item, amount empty** (the coach types it — D-G1 clean).
- Per-chip dismiss ("✕ we don't pay for this") + strip-level collapse. Dismissals in localStorage
  `flhq-coach-budget-checklist:{teamId}:{programYearId}` (device memory; naming follows
  `flhq-coach-last-team`).
- Derived from default team-scope items minus (linked or name-matched) existing lines minus
  dismissed minus `is_misc`. Renders for ANY coach with gaps — first season or third — which is the
  owner's "add a forgotten category mid-season" door answered without keeping the questionnaire
  alive.
- Hidden for read-only coaches (it is a write invitation) and when nothing is missing.

### 4 · The Sample sheet (NEW component; visible to read AND write coaches)

One sheet, two tabs: **Sample budget** · **Sample budget vs. actual**. Content is a hardcoded
constant — no DB rows, no API, nothing tenant-owned, structurally incapable of leaking into a real
plan.

- **Framing (the D1 recommendation):** a named fictional team — **"Riverdale 12U — a sample
  team"** — inside a visually fenced frame: dashed border, olive-tint ground, an eyebrow reading
  **SAMPLE — A MADE-UP TEAM**, and a standing disclaimer: *"Riverdale is invented and so is every
  dollar here. Real costs swing hard by region, age and level — copy the structure, never the
  numbers."* There is **no** "use this" / "copy to my budget" affordance anywhere; amounts render
  as plain text (probe-asserted: no inputs, no write affordances inside the sample).
- **Sample budget tab:** ~7 lines across 5 categories with deliberately non-round figures, a
  per-player figure, and one period-split example (Entry Fees split May/June/July) so the coach
  sees what periods are for.
- **Sample BvA tab:** the same lines mid-season with fictional actuals engineered to teach the
  three states — one line over (Officials, red), several under, one untouched — rendered in the
  real BvA grid idiom inside `CoachScrollX` (pinned first column + hint at ≤640). Teaches
  "over shows up in red before it becomes a family's problem".
- Reached from: the first-run surface (door 2), the BvA empty state (new quiet secondary link),
  and — permanently — a quiet "See a sample budget" link beside the page's existing
  "View Budget vs. Actual →" link once lines exist.
- Static content ⇒ no discard guard (nothing to lose); plain dismiss.

### 5 · Entry points

- **Money hub plan anchor:** CTA keeps its copy, gains `?starter=1` — tapping "Build your budget"
  now lands in the questions, not on a blank page. Deep-link opens only when `moneyCanWrite` and
  `lineCount === 0` (the `?generate=1` recipe verbatim). Read-only hub variant unchanged.
- **BvA empty state:** primary unchanged; adds quiet secondary "See a finished example" opening the
  sample at the BvA tab.

### 6 · What this chunk deliberately does NOT do

- No product-supplied dollar figure, benchmark, range, or numeric placeholder anywhere — including
  `suggested_amount` (stays NULL) and sample-to-real prefill paths (none exist by construction).
- No migration, no new API route, no schema/dictionary change.
- No rollover changes; no admin/org budget planner changes (`scope='org'` surfaces untouched).
- No removal of the manual Add Line path — the starter is a ramp, not a gate.

---

## Owner decisions (D1–D6) — bring to the mockup round

| # | Decision | Recommendation |
|---|---|---|
| **D1** | **Does the SAMPLE carry numbers?** The sharpest question in the chunk, sitting right on the D-G1 line. | **Yes — but unmistakably another team's.** Named fictional team, fenced frame, SAMPLE eyebrow, invented-numbers disclaimer, non-round figures, zero prefill affordances, amounts as plain text. *How could a coach mistake it for advice?* Only by hand-copying dollars out of a frame that names them as invented — at which point they typed the number themselves, which is exactly the D-G1 line held. The alternative (blank amounts) fails the sample's one job: without magnitudes, budget-vs-actual variance is literally unillustratable, and the sample collapses into a second copy of the checklist. |
| **D2** | **What do the questions ask, and how many?** | **Five, one screen, tap-only** (table above — each justified by the line it seeds). Everything else is the checklist's job. **Rider to ratify:** the Entry Fees ×N helper — the product multiplying the coach's own count by the coach's own per-event figure, arithmetic shown in full. Calculator, not estimator; veto if it reads otherwise. |
| **D3** | **Write lines immediately, or preview first?** | **Preview-then-confirm — the worksheet IS the preview** (Generate Installments precedent). Only priced rows become lines, through the existing write route, with per-row outcome reporting. |
| **D4** | **Where does it live?** | **Empty Budget page (primary home) + the Money hub plan anchor deep-links into it (`?starter=1`).** BvA's empty state gets the *sample* door only — a coach on BvA with no budget needs to see the destination, not answer questions two pages from home. |
| **D5** | **What happens once a budget exists?** | **The questionnaire retires; the checklist strip stays.** Questions exist to seed structure and would be stale theatre afterwards; the strip is the permanent, derived, dismissible "what am I forgetting?" and the mid-season door for adding a forgotten category (one tap → prefilled Add Line). If every line is deleted, the empty page — and the starter — return. |
| **D6** | **Does the sample survive?** | **Permanent quiet reference.** First-run-only would rob the coach at exactly the moment BvA starts mattering (first expenses land mid-season). One quiet link on the Budget page + the BvA empty state; never a nag. |

---

## Phases (build in one pass after mockup approval — D-G2)

### Phase 1 — Starter sheet
- [ ] 1.1 `components/coaches/BudgetStarterSheet.tsx` — steps 1–3, question→item mapping by
  default-item name, ×N helper with visible arithmetic, removable rows, category chips, per-row
  write loop through the existing POST, per-row failure display, `useDiscardGuard` +
  `useOverlayOpen` + `CoachModalHeader` + sheet contract. No numeric placeholder anywhere.
- [ ] 1.2 Budget page: first-run surface (write) / informational empty state (read); `?starter=1`
  deep-link (write + zero lines, one-shot ref, `?generate=1` recipe).

### Phase 2 — Checklist strip
- [ ] 2.1 Derived missing-items model (item_id link, name-match fallback, exclude `is_misc`,
  exclude dismissed) + localStorage dismissals per team+season.
- [ ] 2.2 Strip UI (collapsed one-liner → grouped chips), chip-tap → Add Line modal prefilled
  (category+item, amount empty), per-chip dismiss, write-gated.

### Phase 3 — Sample sheet
- [ ] 3.1 `components/coaches/SampleBudgetSheet.tsx` — two tabs, hardcoded Riverdale content,
  fenced frame + eyebrow + disclaimer, BvA tab in the real grid idiom via `CoachScrollX`,
  no inputs/affordances, visible to read coaches.
- [ ] 3.2 Doors: first-run surface, BvA empty-state secondary link (opens BvA tab), quiet
  permanent link beside "View Budget vs. Actual →".

### Phase 4 — Entry points + copy
- [ ] 4.1 Money hub plan-anchor CTA → `?starter=1` (copy otherwise unchanged).
- [ ] 4.2 All new copy sport-neutral (officials, indoor time — never umpires/diamonds in
  QUESTION/UI copy; seeded item names appear as data).

### Phase 5 — Verification + handoff
- [ ] `npm run typecheck` · `npm test` · focused lint on changed files · **all six colour-token
  baselines unchanged** · date-correctness 0 · dictionary/org-guard/observability green (schema
  parity may still trip on the concurrent session's dev-only migs — not ours, do not re-baseline).
- [ ] **Extend `tests/uat/scenarios/coach-money-mobile-smoke.spec.ts`** (never a new file) at
  360×740: (a) starter end-to-end — questions → worksheet (2 priced, 1 blank) → create → 2 real
  lines render + strip shows the blank one → zero horizontal page scroll; (b) dirty starter
  back-arrow raises the discard confirm, Keep editing preserves answers; (c) sample opens from the
  empty state: SAMPLE eyebrow present, amounts render, **zero input/button write affordances
  inside the sample frame**, BvA tab scrolls in-frame with hint; (d) **read-only sweep extended:**
  budget page offers NO starter door, NO checklist strip, NO Add Line — sample door allowed;
  (e) the checklist chip-tap opens Add Line prefilled with the item, amount EMPTY. Probe creds:
  `j2-rep-coach@dev.local` / `coach@dev.local` (devpass123); error-check every provisioning insert;
  known CHECKs: `expense_type ∈ expense|tournament_payable`, `payment_schedule ∈ standard|custom`,
  `split_method ∈ percentage|sessions|fixed`, `coach_role ∈ head_coach|assistant_coach`,
  `rep_teams.slug` NOT NULL. Scope text assertions to `main[class*="coachesMain"]`.
- [ ] `/simplify` (new abstractions: two sheets + the derived-checklist model — exactly its
  territory) → `/review` **standard tier** (no migration, no auth change, writes through the
  existing gated route; go HIGH only if a new write path appears — it must not) → `/docs`
  (premium-money section + a "what should my budget include?" FAQ with the words a worried coach
  types; note the guide must NOT quote example dollar figures either).
- [ ] Same-unit-of-work doc updates: `PROGRAM_COACH_PORTAL.md` §1.1 chunk G entry (built) ·
  `docs/agents/strategy/BUSINESS_DECISIONS.md` Proposed → **Decided** with D-G1/D-G2 verbatim ·
  `memory/design_decisions.md` new entry (starter/sample/checklist rules) · TODO.md line
  (file edited, **left out of the commit** — concurrent session's commit carries it, Batch 1–4
  precedent).
- [ ] Fresh dev restart (new files ⇒ stop → `rm -rf .next` → `npm run dev` → Ready, login 200, no
  `EACCES`; coordinate with the concurrent session's supervisor) → **owner QA** → commit on `dev`
  with explicit per-action OK, explicit `:(literal)` pathspecs, `git show --stat` audit.

---

## Mockups

Visual spec artifact — owner approval is **binding** per `memory/feedback_build_to_approved_mockups.md`;
every element labelled **NEW / RESTYLED / UNCHANGED**. Frames at a true 360px phone width in the
shipped warm portal tokens.

**`claude.ai/code/artifact/77f5175e-7e5b-4f18-ba24-0a0eabc46729`** (rev 1, published 2026-07-30 —
**awaiting owner approval**). 10 frames: the first-run surface before/after · starter step 1 (five
questions) · step 2 (the worksheet-as-preview, incl. the ×N helper and the no-numeric-placeholder
rule) · done state + the discard-guard behaviour · the page after (real lines + the NEW checklist
strip + quiet sample link) · the sample sheet budget tab (Riverdale 12U, fenced) · the sample BvA
tab (grid idiom, one line over on purpose) · the BvA empty state's new sample door · the Money hub
anchor deep-link · the read-only assistant's empty state. Plus D1–D6 as decision cards with
recommendations marked, and the verification bar.

## Landmines & contracts (carried forward — respect, don't relearn)

- **D-G1 enforcement points:** `suggested_amount` stays NULL for defaults; no numeric placeholder
  (`placeholder="$"` only); no sample→real prefill affordance; the ×N helper multiplies only
  coach-typed values and shows the arithmetic; help-doc copy carries no example dollars.
- **A first-season coach must never be walled from the manual path** — Add Line survives on every
  state of the page.
- **Sheet contract** (Batch 1) + **discard guard on the starter** (Chunk A rule 4 — back arrow IS
  the phone's dangerous dismiss). Sample sheet holds nothing typed ⇒ no guard.
- **Two breakpoints only** (900/640). **Check the primitives header in `coaches.module.css` before
  any new reflow rule** — compose `.stack640`/`.block640`/`.wrap640`/`.inlineField`; Chunk A
  shipped duplicates precisely by skipping that list.
- **Warm-theme rules:** no raw `--logic-lime` fills; on-chips join the lime-restore group or use
  `--home-lime`; olive = text/border/tint only; **all six colour-token baselines unchanged**.
- **Capability gating:** starter/strip/Add-Line = write-only; sample = read-allowed. Probe as the
  read-only assistant — Chunk A found five page-level gate misses this way.
- **Sport-neutral new copy** (`lib/sports.ts` context): questions say "officials"/"indoor time";
  seeded names ("Umpire Fees", "Dome Time") appear only as data/sample lines.
- **Git/tree:** shared `dev`, concurrent session active — diff every shared file, explicit
  `:(literal)` pathspecs (bracket dirs stage NOTHING bare), post-commit `git show --stat` audit,
  **never commit/push without explicit per-action owner OK**.
- **Dev server:** concurrent supervisor auto-respawns port 3000 — verify health, don't fight it;
  full clean restart before handoff (new files).

## Out of scope (noted, not forgotten)

- Org/admin budget planner surfaces (`scope='org'`) — untouched.
- Any suggested-amount population, "typical cost" data product, or benchmark copy — **rejected**
  (D-G1); reintroduction requires a new owner decision via `/strategy`.
- Rollover behaviour — verified as the reason this is a first-season problem; not modified.
- Tryout-setup discard guards (chunk E), portal chrome (chunk B collision), parent-facing set (D).
