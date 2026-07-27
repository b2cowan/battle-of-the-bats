# Build Prompt — Free Coach Portal: A3 closeout, then Phase A4 + B1

Paste everything below this line into a fresh chat.

---

Close out Phase A3 of the Free Coach Portal Experience project, then run Phase A4
(registration-flow polish) + Phase B1 (zero-new-backend quick wins).

Context to load first, in this order:
- docs/projects/active/FREE_COACH_PORTAL_EXPERIENCE_PLAN.md — read the **A3 BUILD
  RECORD + the 2026-07-27 A3 addendum** (what's on the working tree, unreviewed by
  browser QA reruns), then the **A4** and **B1** sections (the specs to build). The
  **PROCESS GATE in the header is binding**.
- Auto-memory: project_free_coach_portal_experience (current state) and
  design_decisions (the 2026-07-27 entry — chat doorway retired, Overview order,
  auto-highlight, chat round trip — is binding).
- docs/projects/active/FREE_COACH_PORTAL_EXPERIENCE_PM_BRIEF.md — product framing.

## Step 1 — A3 closeout (do this before any new build code)

A3 + its QA addendum are BUILT and verified (typecheck/lint/verify:changed green,
dev server restarted) but sit UNCOMMITTED on dev. In order:
1. Confirm my browser re-QA verdict with me (fixtures: flhq.qa.coach@outlook.com /
   CoachQA-2026! for the completed "Live Demo — Game Day"; my personal account for
   the upcoming "Purple Classic"). Fix anything I flag.
2. Run **/docs** — the coaches help guide is stale against A3: it names the old
   record sections ("Payment", "What's next", "How to pay" → now the four zones
   Status & Payment / Schedule / Your Team / From the Organizer), references the
   A2 Overview **chat doorway (removed)**, the **"Highlight my team" button
   (removed — highlighting is automatic now)**, and "Tournament history"
   (→ "Your tournaments"). Also mention the new "Back to your Coaches Portal" bar
   on the Chat tab for coach-origin visits.
3. Commit A3 (ONLY after my explicit per-action OK): re-check `git rev-parse
   --abbrev-ref HEAD` = dev; stage **explicit pathspecs only** — use `:(literal)`
   for the `[basicTeamId]`/`[teamId]` route dirs; **EXCLUDE the foreign
   working-tree items**: `pnpm-workspace.yaml` (untracked — NEVER commit it,
   Amplify pnpm-9 aborts), `.claude/settings.json`, `memory/reference_db_schema.md`,
   `scratch_classes.json` deletion if present. Verify with `git show --stat HEAD`
   that only A3 files landed.

## Step 2 — Phase A4 (registration-flow polish; copy/logic only, no mockup gate)

Per the plan's A4 section (file:line evidence there): confirmation-email deep link
uses the existing helper (one line); Register CTA gains a one-line "sets up your
free Coaches Portal" subtext; the sign-in-failure branch must say the registration
was NOT submitted (preserve form state, offer retry); the existing-account 409
collision should continue to submission after sign-in instead of demanding
Review→Submit again; optional A4.5 off-ramp line near the CTA.

## Step 3 — Phase B1 (quick wins; MOCKUPS FIRST for anything visible)

B1.1–B1.6 per the plan: add-all-games-to-calendar (reuse the shipped ICS helpers),
tappable directions (LocationLink), "We're in!" share on the welcome banner,
organizer logo in the hero, "Meet the field" (38 teams in — 9 in your division),
and the "Where you stand" standings widget. **The PROCESS GATE applies:** B1 items
add visible surfaces — present mockups of the record page with the B1 additions
placed in the A3 zones (Schedule zone gets calendar+directions; hero gets the
logo; Meet the field + standings are new blocks — propose which zone owns them)
and get my approval BEFORE build code. A4 needs no mockups (copy/logic).

Critical constraint — SHARED SURFACE: the record component is shared free/Premium;
B1 additions land on both tiers (standing rule: tiers differ in season tools,
never tournament experience). moneyRedacted/suppressUpsell seams must hold.

Rules:
- dev branch only; this working copy is SHARED with concurrent agent sessions —
  re-check the branch before committing, stage explicit pathspecs only, verify
  `git show --stat HEAD` after every commit (an index race once swept 49 foreign
  files into a commit; this check caught it).
- Never commit without my explicit per-action OK — approval never carries over.
- The record component is shared → `npm run typecheck`, not just verify:changed.
- Full dev-server restart before handing off for browser testing (stop server
  BEFORE deleting .next).
- Run /review before calling each phase done (A3's ran 4 lenses, high-risk tier).
- Report to me in product-owner voice (UX outcomes, not file paths).
