# Prompt — Tournament Mobile Experience Review (vs Phase 3 mockup baseline)

*Owner-authored kickoff prompt for a dedicated review chat. Created 2026-07-14 alongside the Phase 3 brief. Paste the block below into a fresh chat verbatim (edit scope/viewports if desired). Review-only: no code changes without sign-off.*

---

Review the public tournament MOBILE experience and propose improvements, using the Phase 3 mockups as the visual baseline.

REFERENCE — the bar to hold real pages to:
https://claude.ai/code/artifact/850ceea2-13b8-4706-abcf-c7f5b35409d4
The phone frames in that artifact show the intended feel for tournament public pages: a compact hero (org eyebrow, bold title, one monospace meta line), a slim monospace tab bar, day headers as quiet uppercase mono labels, dense game rows (matchup line + venue/game meta line, right-aligned tabular-number scores with tiny status captions, red LIVE accents), and small mono chips for statuses. Overall: broadcast-HUD density, calm chrome, the data face for every number. These are directional mockups, not pixel specs — extract the QUALITIES, not the pixels.

SCOPE — the signed-out mobile experience of the public tournament space (the fan-facing surface):
- Tournament home/news, Schedule, Standings, Bracket, Teams, and team detail pages
- The chrome around them: top bar, tab nav, score ticker, My Team dock, follow/alerts affordances, install prompt
- Primary viewport 390x844; also spot-check 360x800
- Dark mode first; spot-check light mode and at least one non-default org theme color — per-org theming must survive every recommendation

PROCESS (in this order):
1. Invoke /design first so the design system and decisions log are loaded. Design tokens are law; public pages have a no-literal-hex ratchet.
2. Start the dev server with network access (Supabase EACCES rule in AGENTS.md). Use the seeded live tournament at /dev-test-org/live-demo so live, upcoming, and final states all render — re-run the seed script if it's stale (see memory/reference_seed_live_tournament.md).
3. Review with Playwright at the mobile viewport: screenshot every page/tab AND read computed styles / scroll metrics for anything you flag (font family/size, spacing, overflow, sticky behavior). Standing rule: never diagnose layout from screenshots alone.
4. Judge each surface against the reference qualities: typographic hierarchy (is the data face used for scores/meta? tabular numerals?), row economy and density vs today, live-state legibility at a glance, chip/badge consistency across pages, hero weight, tab-bar clarity, thumb reach for primary actions, horizontal overflow, wasted vertical space, scroll jank.
5. Separately flag anything the mockup implies that today's pages don't have (e.g. inline day grouping, a playoff-picture row) — marked clearly as "new capability" vs "polish."

DELIVERABLE — review only, NO code changes:
- Findings ranked by fan impact, each with: page, evidence (screenshot + measured values), what the mockup baseline does instead, a concrete recommendation, and an effort guess (S/M/L)
- A prioritized improvement plan written to docs/projects/active/TOURNAMENT_MOBILE_POLISH_PLAN.md (with the standing PM-brief requirement), plus a plain-language summary in the conversation
- Wait for my sign-off before building anything

CONSTRAINTS: dev branch only. Public fan surfaces are shipped and verified — propose, don't rewrite. No backend changes. Anything visually binding you decide goes through /design's decisions log. Don't restart my dev server unless the rules require it.
