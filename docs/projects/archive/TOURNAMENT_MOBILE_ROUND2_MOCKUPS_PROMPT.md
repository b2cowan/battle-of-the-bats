# Prompt — Tournament Mobile Polish, Round 2 mockups (Standings + Bracket / Playoff Picture)

*Owner kickoff prompt for a dedicated mockup chat. Created 2026-07-14 by the review chat after
Round 1 sign-off. Paste the block below into a fresh chat verbatim. MOCKUPS ONLY — this chat
writes NO code; Track A and the Round 1 build are running in the same repo in other chats.*

---

Produce **Round 2 mockups of the Tournament Mobile Polish plan** — the Standings page and the
Bracket / Playoff Picture surfaces on mobile. Review-backed proposal mockups only; no code
changes of any kind (other chats are building in this repo right now — you touch only your
scratchpad and, at the end, the plan doc).

READ FIRST, in this order:
1. `docs/projects/active/TOURNAMENT_MOBILE_POLISH_PLAN.md` — the verified findings (with
   measurements + file:line evidence) and §5's execution split; Round 2 scope is listed there.
2. `memory/design_decisions.md` — the four 2026-07-14 entries at the top (G3 unified header,
   G4 quiet-label convention, G5 More-sheet bottom nav, plus the LIVE soft-chip standard).
   These are ACCEPTED AND BINDING — depict them in every frame; do NOT re-open or re-decide them.
3. The Round 1 mockup artifact (fetch it — artifact URLs are fetchable):
   https://claude.ai/code/artifact/d75c2884-a22e-4b86-8574-8db0543998ef
   Match its presentation language exactly: dark sheet on the platform tokens, horizontal rails
   of phone frames, REAL "before" screenshots beside DRAWN "after" frames, lime finding-ID
   chips, quiet mono kickers, a decisions grid at the end. Round 2 must read as the same series.

EVIDENCE — capture your own before-screens (the review chat's captures are in ITS session
scratchpad; you cannot read them):
- Dev server must be running on :3000 with network access (Supabase EACCES rule in AGENTS.md).
  Do not restart it unless the rules require it.
- Run `node --env-file=.env.local scripts/mobile-review-capture.mjs <your-scratchpad>/shots`
  — it re-lights the live state itself (two semifinals live, final upcoming) and emits, per
  page, top/scrolled/full screenshots + a computed-metrics JSON (fonts, rects, sticky bars,
  sub-44 tap targets). If live-demo is missing, seed first: `scripts/seed-live-tournament.mjs`.
- Your before-frames: `ld-standings-390`, `ld-standings-360`, `ld-bracket-390`, `ld-bracket-360`,
  `bl-standings-390` (light), plus `ld-standings-390-follow`. Embed them as data URIs (downscale
  with `sharp` — in the repo — to ~660px wide JPEG q≈74; artifacts have a strict CSP: every
  asset must be inline).

ROUND 2 SCOPE (from the plan — carry each finding's ID on the frames):
- **Playoff Picture page (C2, A7):** replace the repeated marketing hero with the accepted
  unified header (retitle the page, e.g. "Seeding & Matchups" — it must not echo Home's
  headline); show the championship as a visible "pending today" block while its feeder games
  play (honest copy, no "Winner SF2" jargon); trim the narrative/stat-card stack toward
  broadcast density (the three stat callouts currently spend ~900px at 360 repeating one team's
  name — show what stays and what compresses).
- **Bracket legibility (H10/H16 evidence in the plan; the first-paint zoom floor + name
  ellipsis ship in Track A):** depict the bracket at a readable default; show live games on
  bracket cards wearing the soft LIVE chip (Track A fixes the logic — mockups depict the fixed
  truth, never today's amber "Pending" on a live game).
- **Standings page (D3, D4, D8, D9, F3):** coach-name qualifier as a smaller dim second line so
  rows stop swinging 23→92px; every stat column in the data face with tabular numerals; the
  "6 final · 2 pending · 1 remaining" chips speaking the badge language with per-meaning colors;
  ONE card-header idiom; and the embedded zoomable bracket **collapsed by default behind a
  disclosure** — EXCEPT on playoff day, when the existing bracket-on-top behavior correctly
  makes it the headline (keep that; it is shipped design).
- Every frame wears the accepted Round 1 chrome: unified header (org eyebrow · title · one mono
  meta line · Share only), More-tab bottom nav, quiet mono kickers. 390×844 primary; spot-check
  360; include one light-mode frame (bl-standings) to prove theming survival.

DECISION CARDS to end with (owner answers on the artifact, like Round 1):
- R2-1 — Standings bracket embed: collapsed-by-default disclosure outside playoff day — approve?
- R2-2 — Playoff Picture structure: what survives the de-hero (seeding list + matchups + one
  stat strip is the recommended shape) — approve/adjust?
- R2-3 — Standings columns at 360px: which columns stay visible vs scroll (propose a
  recommendation from the 360 capture evidence).
Note on the artifact: G1 (my-team dock overlap policy) is Round 3 — do not ask it here.

DELIVERABLE:
- ONE new artifact (its own URL — do not update the Round 1 artifact), same format as Round 1.
- Append a short "Round 2 decisions (proposed)" subsection to the plan doc's §4 listing
  R2-1/2/3 — proposals only; the owner accepts on the artifact. Do NOT write to
  memory/design_decisions.md (the review chat logs decisions after acceptance).
- A plain-language summary in the conversation, written for a product owner.

CONSTRAINTS: mockups are directional, not pixel specs — judge hierarchy, honesty, density.
Tokens only (never raw hex in recommendations); everything must survive dark default, light
color_mode, and arbitrary org primaries; no backend changes proposed; nothing shipped gets
removed (the standings bracket embed collapses, never deletes). No code, no commits, no dev
server restarts unless the rules require one.
