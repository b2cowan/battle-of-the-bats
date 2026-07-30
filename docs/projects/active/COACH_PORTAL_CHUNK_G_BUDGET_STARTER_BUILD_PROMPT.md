# Coach Portal — Chunk G: "The Budget Starter" — Build Prompt (paste into a fresh chat)

> **Created:** 2026-07-30, at the close of the Chunk A session (Chunk A committed `a737acbf` — Money now reads on a phone). Chunk G was **explicitly sequenced to follow Chunk A** because it lands on the same screens and they had to be good on a phone first. This prompt is self-contained. **Two owner decisions are already made and are NOT open — see "Already decided".**

---

## The prompt

You are planning and building **Chunk G — "The Budget Starter"** for the premium Coaches Portal.

**The problem in one line:** a first-season coach opens Season Budget Plan and gets a blank page — the Money hub tells them to "set a budget", and behind that instruction there is nothing: no structure, no example, no sense of what finished looks like. Coaches are volunteers, not accountants, and the question they actually have is **"what am I forgetting?"** — forgetting umpire fees or a tournament deposit wrecks a season; being 10% off on a line does not.

Follow the full house process: implementation plan + PM brief → mockups as an artifact (owner approval = binding visual spec, label NEW/RESTYLED/UNCHANGED) → owner decisions → build the whole approved chunk in one pass → `/simplify` → `/review` → `/docs` → owner QA → commit only with explicit per-action OK.

### Read first (in order)

1. `docs/projects/active/PROGRAM_COACH_PORTAL.md` — **§1.1 is the backlog ledger**; chunk G is defined at the bottom of it. §0 carries the current release state. **Rule: when this chunk absorbs a backlog item, tick it in §1.1 in the same unit of work.**
2. `docs/projects/active/COACH_PORTAL_CHUNK_A_MONEY_ON_A_PHONE_PLAN.md` — the immediately preceding chunk, on the same surfaces. Its build record lists the traps; its landmines are still current.
3. `memory/design_decisions.md` → the **2026-07-30 Chunk A entry**. Binding: list-vs-grid, `CoachScrollX`, `useDiscardGuard`, and the layout primitives. You will be adding to these screens, so you inherit all of it.
4. `docs/agents/strategy/BUSINESS_DECISIONS.md` — chunk G is logged there as **Proposed**. **Update it to Decided with the two rulings below in the same unit of work** (or route that through `/strategy`).
5. Auto-memory `project_premium_coach_portal_ux_eval.md`.

---

### ✅ Already decided by the owner (2026-07-30) — do NOT re-open these

**D-G1 — STRUCTURE ONLY. The product never proposes a dollar figure.**
The starter tells a coach **what** to budget for. It never tells them **how much**. Rationale, in the owner's framing: anchoring a coach low means they under-collect and end the season short, and that lands on a real family. Costs swing hard by region, sport, age and level, so any figure the product volunteers is a guess wearing a uniform.

⚠ **The line, precisely:** a number the **coach types** is their own and is fine — asking "roughly what does an entry fee cost you?" is legitimate, because they answer it. A number **the product supplies, prefills, or suggests** is not. Grounding suggestions in the platform's real tournament entry fees was considered and **rejected**.

**D-G2 — Build the FULL starter in one chunk**, not the cheapest slice: the guided questions producing a real, editable starting budget **and** the clearly-labelled sample. (The earlier plan floated shipping the sample alone first; the owner chose the whole thing.)

---

### Ground truth — VERIFIED 2026-07-30 by direct read. Do not re-derive; DO re-confirm anything you're about to build on.

**🎯 The checklist you need already exists in the database.** Migration 027 seeds a global budget taxonomy — `budget_categories` + `budget_items`, with `org_id` NULL and `is_default: true`, so it is platform-wide, not per-org:

| Category (all `scope: 'both'`) | Seeded default items |
|---|---|
| **Tournaments** | Entry Fees · Uniforms · Travel · Misc |
| **Facilities** | Diamond Permits · Dome Time · Field Equipment · Lighting Fees · Misc |
| **Officials** | Umpire Fees · Plate Fees · Certification · … |
| **Training** | … |
| **Events** | … |

**Every seeded item carries a NAME and NO AMOUNT.** So "structure, not numbers" is already the shipped posture of the taxonomy — D-G1 is not a new constraint on this data, it is a promise to keep. **Read the migration and confirm the full item list before designing the questions** (the table above is abridged).

⚠ **`budget_items.suggested_amount` EXISTS as a column, and the budget-line form already honours it** — the item picker prefills the line's total from `suggestedAmount` when it is set. It is **NULL for every default today**. **Populating it is exactly the anchoring D-G1 forbids. Do not.** If you find yourself wanting to, that is the decision re-opening itself; stop and raise it.

**This IS a first-season problem — verified, not assumed.** `lib/rep-season-rollover.ts` carries the planned budget into the next season (lines + periods; the rollover modal offers "Carry over the planned budget (projected buckets only — actual spending stays behind)" and the success screen reports how many lines copied). So a coach staring at a blank Budget page is specifically one starting out. **Design for the first season; do not disturb rollover.**

**Chunk A deliberately left the empty states minimal for you.** The Budget empty state is an icon + one line + "Add first line"; Budget vs. Actual's is a `CoachEmptyState` pointing at Budget. Chunk A made them legible on a phone and invested nothing further, on the explicit note that this chunk replaces them. **You are not polishing an empty state — you are replacing what a first-season coach meets.**

**Release state (verified against `origin/master` 2026-07-30):** prod is `cf90d626`, the 2026-07-29 coach-portal launch release — **all four launch batches are LIVE**, migs 204–210 on prod, drift green. Five commits sit on `dev` ahead of prod: two concurrent-session refactors, the free-portal welcome (**carrying dev-only mig 211**), Chunk A `a737acbf`, and a docs record. ⚠ **Mig 211 is FUNCTION-only and the drift gate structurally cannot see it** — its "no drift" verdict says nothing about whether that function is on prod. Not your migration, but know it's there.

**Expect NO migration for this chunk.** The taxonomy, the budget-line tables and the write routes all exist. If a schema change appears, stop and re-scope — most likely you are inventing storage for something that should be derived or is already stored.

---

### Scope — what the coach gets

1. **A first-season coach answers a few plain questions and lands on a real starting budget they can edit** — the right *lines*, in the right *categories*, with amounts blank or holding only what they themselves typed.
2. **They can see what "finished" looks like before they build it** — a clearly-labelled sample budget and sample budget-vs-actual.
3. **Nobody is anchored.** No figure anywhere in Money originates from the product.

---

### Owner decisions to bring to the mockup round

- **⚠ Does the SAMPLE carry numbers?** This is the sharpest question in the chunk and it sits right on the D-G1 line. A sample budget with blank amounts teaches nothing about scale; a sample with numbers is, technically, the product showing a coach some dollar figures. The likely answer is *yes, but unmistakably another team's* — a named fictional team, visually distinct, never pre-fillable into their own budget, with no "use this" affordance. **Bring a concrete recommendation and say plainly how a coach could possibly mistake it for advice.** Same question for the sample budget-vs-actual, which needs fictional *actuals* to show variance at all.
- **What do the questions actually ask, and how many?** A volunteer on a phone will answer about three. Candidates: how many tournaments this season · do you travel/stay overnight · is there an off-season training block · do you supply uniforms · does your league bill you for officials. Recommend a set and justify each one by the *lines it produces*.
- **Does the starter write real budget lines immediately, or stage a preview first?** (The Generate-Installments flow has a preview-then-confirm precedent worth mirroring.)
- **Where does it live?** The empty Budget page only, or also the Money hub's "Plan" anchor — which today says "Start with your season budget" and leads to the blank page.
- **What happens once a budget exists?** Retire silently, stay behind a quiet link, or remain reachable for a coach who wants to add a forgotten category mid-season.
- **Does the sample survive as a permanent reference**, or is it first-run only?

---

### Landmines & contracts (hard-won — respect, don't relearn)

- **No product-supplied dollar figures. Anywhere in Money.** (D-G1.) This includes placeholder text that reads as a suggestion (`placeholder="1500.00"` is a suggestion).
- **Chunk A's design rules are binding** (`memory/design_decisions.md`, 2026-07-30): a LIST becomes cards, a COMPARISON stays a scrolling grid; use `CoachScrollX` (never a bare `.scrollX`) — it owns the scroller *and* its mandatory hint; use `useDiscardGuard` for any new multi-field modal, and remember **a phone sheet has no backdrop, so the dangerous dismiss is the back arrow**; compose `.stack640` / `.block640` / `.wrap640` / `.inlineField` / `.cardStackCell` / `.cardActionCell` rather than writing new page-level `@640` rules. **Check the primitives list at the top of `coaches.module.css` before writing any reflow rule** — Chunk A shipped three page rules that duplicated primitives added in the same commit precisely because that list wasn't consulted.
- **Two breakpoints only** — 900px shell, 640px content. The CSS header comment is binding.
- **Money is capability-gated** three-state (`off | read | write`). A starter is a WRITE surface: a `read` coach must not be offered it. ⚠ **Probe as a read-only assistant, not just a head coach** — Chunk A's review found five ungated write controls across four Money pages, because a page can miss the gate that every row on it has. The existing probe (`tests/uat/scenarios/coach-money-mobile-smoke.spec.ts`) already sweeps all eight Money surfaces for exactly this; **extend it rather than writing a new one.**
- **Warm-theme rules:** raw `--logic-lime` is NEVER a fill inside the portal; "on"-state chips use the warm lime-restore group or `--home-lime`; no raw white rgba inks; olive is text/border/tint only. **All six colour-token baselines are at their current values — do not add a literal.**
- **Sport-neutral:** category/item vocabulary is seeded data, but any *new* copy must not hard-code diamond-sport assumptions (`lib/sports.ts` Sport Pack). "Diamond Permits" is existing seeded data; your questions should not assume baseball.
- **Git: ONE shared `dev` branch, tree shared with an active concurrent session** (free-coach onboarding + admin refactors). Diff every shared file, stage explicit `:(literal)` pathspecs — ⚠ a bare `git add` on an `[orgSlug]`/`[teamId]` path stages NOTHING, brackets are globs — audit `git show --stat` after committing, and **never commit or push without explicit per-action owner OK.** `TODO.md` precedent: leave it out, the concurrent session's commit carries it.
- **Dev server:** a concurrent session's supervisor auto-respawns `next dev` on port 3000. Verify health (login 200, no Supabase `EACCES`) rather than fighting it; coordinate before killing it. New files ⇒ stop → `rm -rf .next` → restart before handing off.
- **Probes:** `j2-rep-coach@dev.local` / `devpass123` (club-owned), `coach@dev.local` / `devpass123` (standalone). Computed styles, never screenshots. Scope text assertions to `main[class*="coachesMain"]`. **Error-check every provisioning insert** — a silent failure reads downstream as "the feature didn't work". Known CHECK gotchas: `rep_team_expenses.expense_type` ∈ `expense|tournament_payable`; `rep_allocation_splits.payment_schedule` ∈ `standard|custom` and `.split_method` ∈ `percentage|sessions|fixed`; `rep_team_coaches.coach_role` ∈ `head_coach|assistant_coach`; `rep_teams.slug` NOT NULL.

### Definition of done

Plan + PM brief (`docs/projects/active/COACH_PORTAL_CHUNK_G_*`), approved mockups, built + `/simplify` + `/review` (**standard tier defensible** — no migration, no auth change; go HIGH only if it turns out to write budget lines through a new path rather than the existing one) + `/docs`, typecheck/tests/lint green, **colour-token baselines unchanged**, the Money probe extended and passing at 360×740 including the read-only sweep, fresh dev restart, owner QA, committed on `dev` with per-action OK, and §1.1 / the Business Decisions Log / `memory/design_decisions.md` / help content updated.

---

## Program state at handoff (2026-07-30)

- **All 8 launch P0s are CLOSED and LIVE ON PROD** (2026-07-29 release `cf90d626`).
- **Chunk A is committed on `dev` (`a737acbf`), not yet on prod.** Money reads on a phone; the last native browser dialog in the portal is gone; five pre-existing capability gaps closed.
- **Remaining chunks:** **B** findability & portal chrome — ⚠ **currently colliding** with the live concurrent stream (notification bell, portal chrome, welcome card); leave it. **C** schedule intelligence (unblocked). **D** the parent-facing set — largest commercial upside, **needs an owner ruling first: retention play or acquisition play?** **E** tryouts & development tidy-up — small, collision-free, and it has quietly grown two orphans from Chunk A's decisions (the unsaved-work guard on Tryout-setup forms, and the Depth Chart half of the desktop-width fix). **F** the frozen past season — owner-DECIDED, no decision outstanding, collision-free.
- **One decision the owner still owes, unrelated to this chunk:** **CP-7** — when a player has two guardians, does the dues reminder go to both or to one nominated payer? It gates the guardian model (§1.4).
