# Prompt — Tournament Mobile Polish, Round 3 mockups + PM brief (Teams / team detail / chrome, decision G1)

*Owner kickoff prompt for a dedicated mockup chat. Created 2026-07-15 by the Round 2 chat after
the Round 2 build. Paste the block below into a fresh chat verbatim. MOCKUPS + PM BRIEF ONLY —
this chat writes NO code; the owner is browser-testing the Round 2 build in this repo right now.*

---

Produce **Round 3 mockups of the Tournament Mobile Polish plan** — the Teams tab, the team
detail page, and the remaining chrome — plus the round's **PM brief update**. Review-backed
proposal mockups only; no code changes of any kind (touch only your scratchpad and, at the end,
the plan doc + PM brief).

READ FIRST, in this order:
1. `docs/projects/active/TOURNAMENT_MOBILE_POLISH_PLAN.md` — the verified findings (with
   measurements + file:line evidence), §5's execution split (Round 3 = C7 D5 D7 D10 D11 F4 +
   decision G1), and §4's status trail: G3/G4/G5 accepted AND built (Round 1, committed);
   R2-1/R2-2/R2-3 accepted AND built (Round 2 — may be committed by the time you read this;
   check git log). Everything accepted is CANON — depict it, never re-ask it.
2. `memory/design_decisions.md` — every 2026-07-14/15 entry (unified header G3, quiet-label
   G4, More-sheet nav G5, LIVE soft-chip standard, day-first Round 4 decisions). Binding.
3. BOTH prior artifacts (fetchable): Round 1
   https://claude.ai/code/artifact/d75c2884-a22e-4b86-8574-8db0543998ef and Round 2
   https://claude.ai/code/artifact/a92fc65c-60a0-4439-a7f7-f388c929241c
   Match the series language exactly: dark sheet on platform tokens, horizontal rails of phone
   frames, REAL "before" screenshots beside DRAWN "after" frames, lime finding-ID chips, quiet
   mono kickers, decisions grid at the end (open decisions amber, settled ones lime "done").

EVIDENCE — capture your own before-screens:
- ⚠ STALE-SERVER TRAP (bit Round 2): confirm the dev server on :3000 is serving the CURRENT
  build before trusting any capture — load /dev-test-org/live-demo/standings at mobile width
  and check the Round 2 state is visible (status-colored result chips, REC column on the
  phone table). If it isn't, follow AGENTS.md's stop → delete .next → restart sequence
  (network access required) BEFORE capturing. Do not restart otherwise.
- Run `node --env-file=.env.local scripts/mobile-review-capture.mjs <your-scratchpad>/shots`
  — it re-lights the live state itself (two semifinals live, final upcoming). If live-demo is
  missing, seed first: `scripts/seed-live-tournament.mjs`.
- Your before-frames: `ld-teams-390`, `ld-teams-360`, `ld-teamdetail-390`,
  `ld-teamdetail-390-follow` (the My Team dock — G1's subject), `ld-schedule-390-follow`
  (the dock over the schedule's own pinned card — G1's other overlap). The harness has no
  light-mode teams target: add a one-off Playwright capture of
  `/dev-test-org/branded-light/teams` at 390×844 for the theming-proof frame. Embed all
  before-frames as data URIs (downscale with `sharp` — in the repo — to ~640px wide JPEG
  q≈74; artifacts have a strict CSP: every asset must be inline).

ROUND 3 SCOPE (carry each finding's REAL ID on the frames — never invent IDs the plan
doesn't define; verify each item against the CURRENT code first, since Rounds 1–2 + Track A
may have partially or fully landed some):
- **G1 — the dock overlap policy (the headline decision).** The My Team dock repeats live
  info on Schedule (inline pinned card) and team detail (live row). Mock BOTH options as
  frames fans can compare: (a) dock stays everywhere as an always-on live indicator, vs
  (b) dock auto-collapses to its slim minimized form on those two routes. Recommendation on
  record is (b) — argue it or overturn it with evidence, then ask the owner.
- **C7 — team-detail hero ≈40% of the viewport** before any schedule content: propose the
  compact shape (icon-only secondary actions per the icon-only-mobile convention with
  aria-labels, share merged into the action row, stat strip kept).
- **D10 — team-detail Schedule & Results rows** are an older 108/116px-pitch non-mono
  pattern: re-skin to the schedule tab's row language (mono context line, tabular scores,
  venue line, tighter rhythm) — Round 1's built row anatomy is the reference.
- **D5 + D7 — Teams tab type system:** one record convention (mono, tabular) everywhere a
  W-L-T renders; pool headers + card meta join the data face. Depict the coach-qualifier
  quiet-line treatment consistent with Round 2's built standings/seeding rows
  (`splitTeamQualifier` exists in lib — reuse language, don't invent a second convention).
- **D11 — bottom-nav labels in the data face:** Round 1 rebuilt the bottom nav (More tab) —
  CHECK whether this already landed; if yes, mark it settled on the artifact instead of
  re-proposing.
- **F4 — score-alerts entry on team pages:** the alerts toggle exists on 9 other surfaces;
  Track A fixed its tap-target blocker. Show it in the team-detail action row (and note the
  Teams-tab card treatment if you propose one).
- Every frame wears the built chrome: unified header (org eyebrow · title · one mono meta
  line · Share only), Home·Schedule·Standings·Teams·More bottom nav, quiet mono kickers,
  soft LIVE chips. 390×844 primary; spot-check 360; include the one light-mode teams frame.

DECISION CARDS to end with (owner answers on the artifact, like Rounds 1–2):
- G1 — dock policy: keep-everywhere vs auto-collapse on Schedule + team detail (side-by-side
  frames; recommendation on record is auto-collapse).
- R3-1 — team-detail header shape: approve the compact action-row anatomy (C7/F4)?
- R3-2 — Teams tab card anatomy: approve the one-record-convention + data-face meta (D5/D7)?
- R3-3 — team-detail rows: approve the schedule-row re-skin (D10)?
(Adjust numbering only if scope genuinely differs — and say why on the artifact.)

DELIVERABLE:
- ONE new artifact (its own URL — do not update the Round 1/2 artifacts), same series format.
  Adversarially verify it before publishing (bindings depicted not re-asked, real finding IDs
  only, data honesty across frames — ties show no loser, counts match rows — and CSP: no
  external assets).
- Append a "Round 3 decisions (proposed)" subsection to the plan doc's §4 listing G1 +
  R3-1/2/3 — proposals only; the owner accepts on the artifact. Do NOT write to
  memory/design_decisions.md (decisions get logged after acceptance).
- UPDATE `docs/projects/active/TOURNAMENT_MOBILE_POLISH_PM_BRIEF.md` with a Round 3 section —
  plain-language and outcome-focused for a product owner: what fans/coaches see and do
  differently, why it matters, expected impact, priority, success criteria, and the one open
  policy question (G1) in one sentence.
- A plain-language summary in the conversation, written for a product owner.

CONSTRAINTS: mockups are directional, not pixel specs — judge hierarchy, honesty, density.
Tokens only (never raw hex in recommendations); everything must survive dark default, light
color_mode, and arbitrary org primaries; no backend changes proposed; nothing shipped gets
removed (the dock may minimize, never disappear; follow/alerts/share all stay). No code, no
commits, no dev server restarts unless the stale-server check above requires one. The owner
is testing Rounds 1–2 in this working copy concurrently — leave every source file untouched.
