# Prompt — Tournament Mobile Polish, Track A (mechanical fixes)

*Owner kickoff prompt for a dedicated build chat. Created 2026-07-14 by the review chat. Paste the
block below into a fresh chat verbatim. Track A = the fixes with exactly one correct answer — no
visual judgment calls; everything needing a mockup decision is reserved for the review chat's
mockup rounds and is OFF-LIMITS here.*

---

Build **Track A of the Tournament Mobile Polish plan** — the mechanical/compliance fixes that
need no visual sign-off. Read `docs/projects/active/TOURNAMENT_MOBILE_POLISH_PLAN.md` FIRST; it
carries the verified evidence (measurements + file:line) for every item below. Review-verified
findings only — do not re-scope.

SCOPE — exactly these plan items, grouped into build batches:

**Batch 1 — Live-state honesty guards (plan Theme A):**
- A2 — Schedule defaults to the Playoffs segment when the division has a playoff game live or
  scheduled today (manual toggle untouched).
- A3 — Bracket embed: wire the existing shared live-state helper into the graph bracket's nodes
  (its live styling hook is hardcoded false) + show LIVE (danger-token dot treatment, reusing the
  ticker's chip language) instead of amber "Pending" while a game is in its live window.
- A4 — Playoff Picture: a live game must not render winner/loser styling or read as decided;
  keep the running score, add the live chip.
- A5 — Game detail: no W/L outcome chips and no loser-dimming while the game is live (the live
  flag is already computed on the page).
- A6 — One LIVE chip: replace the solid-red/white LIVE pills on Teams + team profile with the
  soft chip already used by ticker/schedule/game-detail (danger-rgb tint bg, danger text, data
  face). Reuse, no new tokens.
- A8 — Score ticker: add a touch-hold pause mirroring the existing hover/focus pause.
- A9 — Ticker: when BOTH sides of an item are unresolved bracket placeholders, render round
  label + time (e.g. "Championship · 5:30 PM") instead of "Winner SF2 vs Winner SF1", and never
  style such an item as LIVE.
- F6 — Install banner must not cover the My Team dock: dock publishes its height as a CSS var
  (the ticker's own pattern) and the banner offsets by it; banner also reacts to the existing
  follow-change event.
- F7 — iOS install copy: name Safari's toolbar Share explicitly.

**Batch 2 — 44px tap floor (plan Theme B, one sweep):**
- Add a public `--tap-min: 44px` token (mirror of the admin tap token).
- Apply scoped mobile min-height/hit-area fixes per B1–B7: navbar Share + alerts bell,
  follow-picker trigger, schedule stage buttons + follow star, game-detail share/back, bracket
  zoom trio + % reset (both mounts), playoffs hero CTAs, Teams follow button + division select
  + team-detail back link, install-prompt dismiss, and the game-detail "Get Directions"
  clearance above the bottom nav (B7).
- ⚠ HARD RULE (verifier-flagged twice): never attach floors to the bare global `.btn-sm` /
  `.form-select` — they're shared with the admin shell's deliberate compact-density system.
  Scope every rule to public components/pages (in-repo precedent: the modal-footer 44px rule).
  Icons/type keep their size; only hit areas grow.

**Batch 3 — Light mode & theming correctness (plan Theme E):**
- E1 — Light-mode muted-text tokens: one authority (the public light-mode builder); remove the
  competing plain re-declaration that shadows the boosted values (body text currently ~2.6–3:1).
- E2 — `--success/--warning/--danger/--info`-as-TEXT on light: add `-strong` companions per the
  existing `--gold-strong` precedent; swap only text/glyph usages, fills/tints keep base tokens.
- E3 — Lime as text/icon on light (bell-on, follow star ≈1.17:1): solid-lime-chip-behind-ink-
  glyph pattern (the existing pillOn precedent), correct in both modes.
- E4 — Primary buttons: use the theme system's own on-primary text token instead of hardcoded
  white (the light-primary guard is computed but never consumed there).
- E5 — Add the missing `-webkit-backdrop-filter` twins (hero stats panel + news featured badge),
  prefixed FIRST per the binding 2026-07-13 CSS rule.

**Batch 4 — Small bug fixes:**
- D12 — My Team dock name hard-clips: nested ellipsis span (text-overflow is inert on a
  multi-child flex box); star icon stays fixed.
- Bracket name truncation: append "…" when the hard slice truncates; raise the FIRST-PAINT
  fit-zoom floor to ≈0.55 (manual zoom-out floor 0.4 untouched).
- F5 — News empty state: add the same action links the identical component already shows on
  Home (no new pattern; the hrefs are already built in that file).

OFF-LIMITS (reserved for the mockup rounds in the review chat — do NOT touch even if tempting):
hero/header structure on any page, the schedule's pre-list control stack and row anatomy/venue
line, day-first grouping, the Home "Live Now" block, chip/badge typography conventions
(including the `.badge` font-family and the eyebrow/kicker rules), standings row/type reworks,
team-card/team-detail layout, Playoff Picture page structure, dock-suppression policy (owner
decision G1), anything in plan Themes C/D/F not listed above.

PROCESS:
1. Present a short Implementation Plan + plain-language PM summary before coding (per
   AGENCY_RULES.md), then build batch by batch.
2. Verify with the shipped harness: `node --env-file=.env.local scripts/mobile-review-capture.mjs`
   (it re-seeds the live window itself via its go-live step; run
   `scripts/seed-live-tournament.mjs` first if live-demo is stale/missing). Success = the
   specific numbers cited per item in the plan move (sub-44 target count trends to zero on
   public pages; no "Pending" on a live game; contrast probes pass on branded-light; no
   overflow-X regressions; computed backdrop-filter never "none").
3. `npm run verify:changed` + typecheck if shared modules are touched. Offer `/review` when done.
4. Dev-branch only; explicit pathspecs; NO commit without the owner's per-action OK. Restart the
   dev server before owner handoff only if the session's changes require it (rules in AGENTS.md).
5. The review chat is producing mockups in parallel — it touches no code, you touch no visual
   conventions. If a fix seems to force a visual-language decision, STOP and flag it back to the
   owner instead of deciding.

CONSTRAINTS: tokens only (no literal hex — public CSS has a ratchet); every change must survive
dark default, light color_mode, arbitrary org primaries (test with branded-dark / branded-light),
390 AND 360 widths, followed + anonymous states. No backend changes. No migrations.

---

## Addendum 2026-07-14 (post Round-1 sign-off — read before building B1)

Round 1 decisions accepted the same day change two details (full record: the four 2026-07-14
entries in `memory/design_decisions.md` + plan §4):
- **The fan bell LEAVES the mobile tournament header** (it relocates into the new bottom-nav
  "More" sheet, built by the review chat in Round 1). Still fix the bell component's tap size
  (it renders elsewhere and will render in the sheet), but do NOT invest in bell-in-navbar
  positioning/styling beyond the size floor. The navbar Share fix stands as written.
- **Coordination:** the review chat builds Round 1 (unified header, Home stage bodies, schedule
  control stack, More tab) in this same working copy AFTER your batches land — please build and
  get owner commit-OKs batch-by-batch rather than one big drop, so shared files
  (ScheduleContent, schedule.module.css, Navbar.module.css, globals.css) free up quickly.
