# Session prompt — PDF Export Quality, Phase 1 (the shared plumbing)

**A BUILD session. Open in a fresh chat. Written 2026-08-22.**

Every decision this build executes is already made — by the owner, on 2026-08-21, against rendered
evidence. **Do not re-open decisions; build them.** If the code contradicts something below, say so
before building (AGENCY_RULES: disagree out loud, before the work).

**Read first, in order:**
1. `docs/projects/active/PDF_EXPORT_QUALITY_PLAN.md` — §1 corrected inventory, §2 decisions 1–9,
   §3 defects D1–D5, §4 Phase 1. This prompt implements **Phase 1 only.**
2. The evidence gallery linked at the top of the plan — it is the visual definition of "broken"
   and the proof standard for "fixed".
3. `docs/agents/strategy/BUSINESS_DECISIONS.md` entry **2026-08-21 — Premium Coaches Portal
   includes PDF document customization** — the packaging authority for the gating change below.

---

## Scope — Phase 1, nothing else

**In:** D1–D4 plumbing, per-report shape declarations, the team-level branding card, the standalone
gating change, removal of the three lying menu options, and the rendered proof.
**Out (do not touch):** the Phase 2 group passes and every content call in them (column diets,
per-family dues statement, check-in branding, month-grid statement swap) · the practice sheet's
FORM (plan decision 9 — held; only the generic plumbing below may reach it) · the D5 CI check
(Phase 3).

## Step 0 — present BEFORE any code (blocking, owner-directed 2026-08-22)

No code may be written until the owner has seen and approved, in this order:

1. **The high-level Phase 1 plan, in product-owner language** — what changes on which screens and
   documents, in what order, and what stays untouched (the practice sheet's form, the Phase 2
   content calls). Plain UX terms, no implementation mechanics.
2. **A mockup of the one NEW surface: the "How your documents look" card** in coaches-portal team
   settings — published as a Claude Artifact (mockups are the spec in this repo). It must show
   **three states:** a club-owned team with the club's look inherited (and how "this is your club's
   look — make it yours" reads), a customized team, and a standalone team's blank slate. Include
   the phone layout — the portal is phone-first and this card will be used from a phone.
3. **Any other new-looking thing discovered during planning** that the evidence gallery does not
   already define — e.g. what the declared "table cannot fit" behaviour shows a reader instead of
   shredding. The rendered documents themselves (single title, identity, true page counts) need no
   new mockups: the gallery's branded exhibits are already the approved "after".

Only after explicit owner approval of 1–2 (and 3 where raised) does the build below begin. An
approved mockup then outranks this prompt's prose where they differ — but remember the standing
lesson: the mockup owes FUNCTIONALITY; verify claims against the code before drawing them.

## The build, in dependency order

**1 · D1 — identity fallback.** The shared table engine's header falls back to the layered
identity, never the report title: **coach-portal documents → the team's name; admin documents →
the org's name.** The doubled title dies for every untouched org. Also remove the practice sheet's
empty dark header band (blank-header section) — a plumbing bug, not a form change. Make the PDF
Settings page's hint text true.

**2 · D2 — shape is the report's property.** Add a declared shape (orientation, and density where
it matters) to the export contract; the org-wide preference applies only where a report declares it
fits either way. Officialize the three existing hand-forks (Schedule, Bracket, admin Budget vs.
Actual) through the contract, and declare landscape for the documents the evidence showed shredding
(Results, Team Roster, Tryout full detail — **shape only; their column content is Phase 2**).
With it, the fit contract: a minimum legible column width, no row-splitting across page breaks,
and a declared behaviour when a table still cannot fit — never the current one-character-per-line
fallback. "Silently unreadable" must become impossible, not rarer.

**3 · D3 — true page totals.** "Page X of Y" must be true on every page (the tryout board summary's
post-pass is the in-repo reference for doing this right).

**4 · D4 — the identity pipeline + the team card.** Server-side, resolve what a document carries:
**team settings → club settings → defaults; team logo → club logo → none.** Draw logos aspect-fit
(the fixed 2:1 slot must not squash a square crest) with a size guard/downscale. Build the
**"How your documents look" card in the coaches portal team settings** — team logo, accent colour,
footer line — for every coach, standalone and club-owned (head-coach edit rights; club-owned teams
see their club's look as the inherited default). Team-level storage is new: schema change ⇒ data
dictionary + `npm run refresh:snapshots` in the same unit of work, and check the next free
migration number against the live snapshots (257–258 exist dev-only).

**5 · Gating.** Extend the PDF customization feature to the standalone premium coach plan per the
Business Decisions entry. **Same unit of work:** `lib/plan-config.ts` + the inclusions in
`docs/agents/strategy/PLAN_PRICING_FACTS.md`, then run the drift checklist at the bottom of the
Facts doc. Free Basic coaches: unchanged (no PDF export at all).

**6 · Honest menus.** The PDF option comes OUT of the three stub menus (House League season
registrations, Rep program-year roster, Rep tryout applicants) along with their "coming soon"
feedback paths; true-up the export catalog entries. Each PDF gets built for real in Phase 2 — do
not build them now.

**7 · Proof — rendered, not asserted.** Regenerate the exhibit set through the real renderers and
LOOK at it (the working harness + its gotchas are documented in auto-memory
`reference_pdf_exhibit_harness`; the untouched-org variants must now show one title, the right
name for the layer, true page counts, and no vertical shredding anywhere). Add one new exhibit: a
club-owned team carrying its own look distinct from its club's. Compare against the gallery.

## Verification & process

- AGENCY_RULES apply in full: PM-style UX summary in-chat **before code**, `dev` branch only,
  explicit pathspecs, no commit without the owner's OK.
- Shared modules + plan config + a migration are touched ⇒ `npm run typecheck` (after
  `npx next typegen`) as well as `npm run verify:changed`; unit tests for the fallback order, the
  fit contract, and the identity resolution order.
- New user-facing surface (the team card) ⇒ offer `/docs` for the help system, and ask the demo
  question (CLAUDE.md): should the coach demo's seeded world set a team look, and do any demo
  sentences mention exports/branding? Offer `/simplify` then `/review` when the build lands.
- Add the owner QA ledger entry for the phase.

## What done looks like (owner-visible)

A brand-new club exports any report: **one title, the club's name, its logo if one is uploaded,
true page counts, nothing shredded.** A coach opens team settings, sees "How your documents look"
with the club's look inherited (or their own blank slate if standalone), uploads a crest, picks a
colour — and the next roster they print is theirs. No export menu offers a button that apologises.
