# Tournament Mobile Polish — Review Findings & Improvement Plan

**Status:** PROPOSED — review only, no code changed. Awaiting owner sign-off before any build.
**Date:** 2026-07-14 · **Branch:** dev · **Companion:** `TOURNAMENT_MOBILE_POLISH_PM_BRIEF.md`
**Visual baseline:** Phase 3 mockups artifact (`claude.ai/code/artifact/850ceea2-…`) — directional
phone frames, ~258px art judged at qualities/hierarchy, never pixels. Extracted spec + review law
were distilled to working docs for the review agents (session scratchpad).

---

## 1. Method (how every finding was evidenced)

- **Live capture harness** (Playwright, headless Chromium, DPR 2, `isMobile`+touch): 21 captures
  across `/dev-test-org/live-demo` (re-seeded so playoff day = today, two semifinals genuinely
  in their live window at capture time, final upcoming), `branded-dark` (Battle-Purple preset),
  `branded-light` (crimson preset, light `color_mode`, glass cards), `completed-demo` (champion
  crowned). Viewports 390×844 (primary) + 360×800 spot-checks; anonymous AND followed-team
  states (device follow of Halton Hawks U11 Jr).
- **Per capture:** top/scrolled/full screenshots **plus a computed-metrics JSON** (fonts, sizes,
  weights, letter-spacing, `font-variant-numeric`, colors, rects, median row pitch, sticky/fixed
  chrome inventory with computed `backdrop-filter`, sub-44px tap-target list, horizontal-overflow
  offenders). Standing rule honored: no finding rests on a screenshot alone — every claim cites
  computed values and/or source file:line.
- **Multi-agent review:** 8 surface/cross-cut reviewers (home+news, schedule, standings,
  bracket, teams, chrome, typography/chips, theming), each finding then attacked by an
  independent adversarial verifier (default-refute). Two full passes ran (~137 agents total);
  findings below are the reconciled union — refuted claims were dropped, verifier corrections
  adopted. A handful of items were additionally hand-verified in source during synthesis.
- Evidence artifacts (screenshots + metrics JSONs + capture script) live in the session
  scratchpad; all load-bearing measurements are reproduced inline below. The harness is
  ~150 lines and trivially re-runnable against the same seeded tournaments.

## 2. What already meets the mockup bar (don't touch)

- **ScoreTicker** is essentially the mock's language already: mono `--font-data`, tabular
  scores, soft red LIVE chip (`rgba(var(--danger-rgb),.15)` + `var(--danger)` text), quiet FINAL
  captions, 40px slim bar, computed frost `blur(20px)` verified.
- **Schedule's live games get a dedicated broadcast card** (avatars, rolling-digit score, LIVE
  badge + dot, share bar) — richer than the mock's row treatment. The problems found are about
  *placement/defaults*, not the live card itself.
- **Standings becomes the bracket on playoff day by design** — `bracketOnTop` promotes the live
  bracket above pool tables once playoffs are underway (verified in source + capture: bracket
  header at y≈287, inside the first viewport). A reviewer's "no bracket tab" claim was REFUTED
  on this basis: Standings *is* the persistent bracket door. No IA change needed.
- **Zero horizontal overflow** on all 21 captures (`overflowX:false` everywhere, incl. 360px).
- **Sticky-chrome frost holds** — navbar/ticker/day-labels/bottom-nav/dock all compute real
  `blur(16–20px)` (the 2026-07-13 `-webkit-` ordering fix is intact) — two newly-found unpaired
  declarations excepted (E5 below).
- **Per-org theming survives everywhere tested**: Battle-Purple and crimson-light presets
  recolor hero, segmented controls, accents, chips correctly (three light-mode *contrast* gaps
  are findings E1–E3, but the theming plumbing itself is sound).
- **The follow loop** (pick-team banner → pinned My Team card → ★ row markers → My Team dock →
  ticker precedence) is a capability the mock doesn't even attempt — keep all of it.

## 3. Findings register (verified; ranked by fan impact within theme)

Legend: **[impact/effort/kind]** · kind `pol` = polish (restyle what exists), `NEW` = capability
today's pages don't have. Measurements are CSS px at 390×844 unless noted.

### Theme A — Live-state honesty (the broadcast promise)

- **A1 [High/M/NEW] Live games never appear in the Home page body — only in the ticker marquee.**
  Home's "Latest Finals" filters `status==='completed'`; "Next On The Schedule" filters
  `status==='scheduled'` (TournamentHomeContent.tsx:48-50, 279-285) — in-progress games fall
  through both. With two semifinals live, no card in the 1152px day-panel shows either; the only
  live signal is the auto-scrolling ticker. *Baseline:* live rows with red LIVE captions sit in
  the content itself. *Rec:* add a "Live Now" block ahead of Latest Finals (reuse the finals-row
  layout + the MyTeamCard live-badge treatment, gated on the existing `isGameLive`).
  → `components/public/TournamentHomeContent.tsx`, `app/[orgSlug]/Home.module.css`
- **A2 [High/S/pol] Schedule defaults to Pool Play + oldest day on playoff day.** `viewMode`
  initializes to `'pool'` unless the tournament is playoff-only (ScheduleContent.tsx:122); dates
  sort ascending, so the first visible row is a *finished Jul 12 game* (first `dateLabel` y=485)
  while both live semifinals sit behind the "Playoffs" segment. (Honest caveat, per verifier: the
  fixed ticker does show them on load — the page *body* doesn't.) *Rec:* default `viewMode` to
  `'playoff'` whenever the division has a playoff game live or scheduled today (helpers already
  imported); manual toggle untouched. → `components/public/ScheduleContent.tsx`
- **A3 [High/S/pol] Bracket embed shows amber "Pending" on a game that is live — same screen as
  a red LIVE ticker.** `status==='submitted'` maps straight to Pending/Final
  (PublicBracketView.tsx:56); the graph bracket's `BracketNode.isLive` is *hardcoded false*
  (LogicSyncBracket.tsx:106) though card-glow styling for it already exists (:205-210). *Rec:*
  compute `isLive` with the shared `lib/game-status.ts` helper (already used by Standings/
  Schedule) and render a LIVE label in `var(--danger)` with the ticker's dot treatment before
  the submitted/completed branches. → `components/bracket/LogicSyncBracket.tsx`,
  `components/public/PublicBracketView.tsx`
- **A4 [High/M/pol] Playoff Picture renders a live 5–3 semifinal exactly like a completed win.**
  `decided` derives from score presence alone; winner/loser classes + Final-only chip follow it
  (lib/playoff-picture.ts:165-170; playoffs/page.tsx:227-235). *Rec:* thread `isLive` through
  `PlayoffMatchup`; gate `.matchupWin/.matchupLose` on `!isLive`; add a live chip alongside the
  existing status chip; keep showing the running score. → `lib/playoff-picture.ts`,
  `app/[orgSlug]/[tournamentSlug]/playoffs/page.tsx`, `PlayoffPicture.module.css`
- **A5 [High/S/pol] Game detail hands out W/L verdicts mid-game.** (Hand-verified in synthesis.)
  `awayOutcome/homeOutcome` compute W/L/T whenever a score exists — no live guard — and
  `.detailTeamLost` dims the trailing team during play (schedule/[gameId]/page.tsx:240-241,
  319-327), so a live 3–5 already declares a loser, beside a correct LIVE badge. *Rec:* gate
  outcome chips + lost-dimming on `!isLiveGame` (already computed on :257).
- **A6 [High/S/pol] LIVE wears two skins.** Teams + team-profile use a solid `var(--danger)`
  fill with `#fff` text (teams.module.css:287-299; team-profile.module.css:~351-363) while
  ticker/schedule/game-detail use the soft mono chip (`rgba(var(--danger-rgb),.15)` bg,
  `var(--danger)` text, `--font-data`). *Baseline:* "red = live… tiny captions/dots, not
  banners." *Rec:* adopt the soft chip everywhere (2 files; reuse, no new tokens).
- **A7 [Medium/M/NEW] The championship game is invisible on Playoff Picture while its feeders
  are live.** Games with unresolved `Winner/Loser` refs are dropped entirely
  (lib/playoff-picture.ts:161) — the page has no tonight-at-5:30 row at the exact moment fans
  care. *Rec:* build a `pendingToday` stub list from the pre-filter fields and render a labeled
  block ("Championship · 5:30 PM · winners of SF1/SF2"). 
- **A8 [High/M/pol] Ticker marquee can't be paused by touch.** 48s linear loop pauses only on
  `:hover`/`:focus-visible` (ScoreTicker.module.css:29,36-38); capture caught the live item
  clipped at left:-135. *Rec:* pointerdown/up pause mirroring the hover rule.
- **A9 [Low/S/pol] Ticker leaks bracket jargon — and can dress an unstarted game as LIVE.**
  Name fallback is the raw placeholder (`teamShort()` → "Winner SF2", ScoreTicker.tsx:23-26);
  `isLive` is purely time-window (:130), so round 1 of capture photographed **"● LIVE Winner SF2
  vs Winner SF1"** for a game nobody had started. *Rec:* when both sides are unresolved, render
  round label + time ("Championship · 5:30 PM") and exclude the item from live styling until
  teams resolve.
- **A10 [Low/S/pol] Trophy + green winner treatment on every finished row competes with live
  accents.** Tempered by verification (live games use the distinct broadcast card, so direct
  competition is limited) — optional: reserve `--success` color for the score, drop the
  per-winner Trophy icon on dense lists.

### Theme B — The 44px touch floor (binding decision, violated platform-wide on these pages)

Measured sub-44px interactive elements (all confirmed in `smallTargets` + source):
- **B1 [High/S]** Navbar **Share 42×30** and **bell 34×34** on *every* public page
  (`.btn-sm` padding-only, globals.css:644; `.bellBtn` literal 34px, FanNotificationBell.module.css:15-16);
  follow-picker trigger **292×32** (`.trigger`, no min-height).
- **B2 [High/S]** Schedule: Pool Play/Playoffs stage buttons **167×34** (explicit min-height:34);
  follow star **23×23**; game-detail Share **86×31**, back link **100×36**.
- **B3 [Medium/S]** Bracket zoom controls **28×26** ×3 + the "%" reset **46×15** (inline
  width/height, LogicSyncBracket.tsx:797-800) — both mounts (Standings + Schedule).
- **B4 [Medium/S]** Playoffs hero CTAs **36px** ("Share the bracket"/"Full Bracket").
- **B5 [Medium/S]** Teams Follow button **40px** (explicit 40 in the mobile block);
  division `<select>` **41px**; team-detail "All Teams" back link **20px**.
- **B6 [Medium/S]** Install-prompt dismiss **28×28** (InstallAppPrompt.module.css:91-97).
- **B7 [Medium/S]** Game-detail "Get Directions" renders 86% *under* the fixed bottom nav on
  load (btn 768–805 vs nav top 773) — mobile spacing trim in the 390px override block.

*Rec (one workstream):* add a public `--tap-min: 44px` token (mirrors `--admin-tap-min`) and
apply scoped `min-height`/hit-area rules per component under the existing mobile breakpoints —
**never** on the bare global `.btn-sm`/`.form-select` (shared with admin's deliberate
compact-by-default density system; verifiers flagged this twice). Precedent already in-repo:
`.modal-footer .btn { min-height:44px }` @≤768px (globals.css:1200-1204). Icons/type keep their
size — only hit areas grow.

### Theme C — First-screen economy (hero + stack weight)

- **C1 [High/M/pol] Home hero eats 51–67% of the first viewport and (on default/completed
  branches) repeats the navbar's tournament name.** Measured: hero section h=565 of 844 (live),
  429 (completed); navbar `orgName` and hero `<h1>` render the identical string ~180px apart.
  *Baseline:* the entire event header ≈100px-real: org eyebrow → bold title → ONE mono meta
  line. *Rec:* split by branch — default/completed: drop the duplicate `<h1>`, slim to an
  identity band; playoff branch (headline "The Bracket Is Set" is distinct, fine): collapse the
  badge+subtitle+countdown+two-stacked-CTA stack to the band + one CTA.
- **C2 [High/M/pol] The Playoffs page replays the same marketing hero, verbatim headline
  included, one tap after Home.** Home hero (y128-523) → tap "Playoff Picture" → an identical
  `<h1>The Bracket Is Set</h1>` + second subhead + second CTA pair before any data. *Rec:*
  replace with the compact identity band + retitle (e.g. "Seeding & Matchups"); keep Share/Full
  Bracket as small actions.
- **C3 [High/M/pol] Schedule spends ~403px (48% of viewport) before the first game row.**
  Kicker+title block, pick-team banner, division select, stage segment, search stack up front.
  *Rec:* collapse the pick-team banner to a slim pill after first dismissal (persist like the
  ticker's `flhq-ticker-min-*` key; keep ≥44px), tighten `.scheduleControls` gaps in the mobile
  override (base :1071-1076, mobile :~1503-1507).
- **C4 [Medium/S/pol] Home's two playoff CTAs both funnel to the bracket** ("Playoff Picture" +
  "See the Bracket," stacked). *Rec:* one lead CTA; demote the second to a ghost link.
- **C5 [Medium/S/pol] Completed home: two identically-styled primary CTAs** ("Final Results" →
  champions recap vs "Final Standings") 250px apart. *Rec:* differentiate weight + wording
  ("Champions Recap" outline vs "Full Standings" primary).
- **C6 [Medium/S/pol] A single venue link gets a full 125px card** in What To Check Now. *Rec:*
  fold Field Shortcuts into the Event Snapshot card as one `.statusItem` row.
- **C7 [Medium/S/pol] Team-detail hero ≈40% of viewport before schedule content** (identity
  card + 3 pill actions on 2 rows + stat strip). *Rec:* icon-only secondary actions (Calendar/
  Share, per the icon-only-mobile convention with aria-labels), merge "Share team" into the
  action row, keep the stat strip.
- **C8 [Medium/M/NEW] Mobile chrome never shows the event's dates/status.** The computed
  phase-pill + date range (`TournamentNavStatus`) is in the DOM but `display:none` below 1024px
  (Navbar.module.css:149-151, 225-230). This is exactly the mock's "JUL 17–19 · 4 DIAMONDS ·
  24 TEAMS" line. *Rec:* compact mono one-liner variant on mobile (pairs with C1's identity band).
- **C9 [Low/S/pol] Mobile schedule row pitch ~83px** vs the HUD target — padding/row-gap trim
  recovers only ≈4.5px/row (verifier-tempered); do it opportunistically with C3.

### Theme D — One type system (kickers, data face, chips)

- **D1 [High/S/pol] The shared `.badge` class never sets a font-family** — every
  badge-primary/success/warning/… chip renders Inter beside genuinely-mono chips on the same
  screens (globals.css:726-735). *Rec:* one line — `font-family: var(--font-data)` on `.badge`.
- **D2 [High/S/pol] The page-header "eyebrow" is dead CSS on every tab.** Only
  `.section-header .eyebrow` is styled (globals.css:867) but Standings/Schedule/News/game-detail
  render `<span class="eyebrow">` under `.public-page-header` → computed **16px/400 plain body
  text**, duplicating the tournament name at full weight right under the navbar (Standings), and
  "Schedule"/"News" as body text elsewhere. *Rec:* add a real
  `.public-page-header .eyebrow` rule — quiet mono kicker (`--font-data`, ~0.72rem, uppercase,
  `--white-45`/`--data-gray`, tracked) — then reconsider what the line *says* (division/date
  beats repeating the name the navbar already shows).
- **D3 [High/S/pol] Standings rows swing 23px→92px because "(Coach Name)" wraps at full team-name
  weight** (sticky col fixed at 9.5rem; 4-line wrap measured). *Rec:* render the parenthetical
  qualifier as a smaller dim second line (~0.72rem, `--white-45`, 400).
- **D4 [Medium/S/pol] Standings stat row is half data-faced** — W/L/T are mono; RF/RA and the
  RD cell aren't; PTS is a sans `badge badge-primary`. *Rec:* `td`-scoped `--font-data` +
  `tabular-nums` for the rest (D1 fixes the PTS chip's face).
- **D5 [Medium/S/pol] The same record datum ("3-0-0") renders at 4 unrelated sizes/weights**
  across Playoff Picture callouts/seeds and Teams cards; live semifinal `matchupScore` and
  `seedNum` also skip `tabular-nums`. *Rec:* one record convention (~.85rem/700 mono) + add
  `font-variant-numeric: tabular-nums`.
- **D6 [Medium/S/pol] Schedule mobile rows set team NAMES in mono** (`.mobileNameAway/Home`,
  schedule.module.css:2227-2236) while Teams/Standings use sans — backwards vs the
  sans-for-identity / mono-for-data split. *Rec:* drop the mono override on names.
- **D7 [Medium/S/pol] Teams pool headers + card meta skip the data face** (`.poolHeading` on
  `--font-display`; `.cardPool/.cardRank/.nextGame` sans). *Rec:* `--font-data` across the
  card's stat/status fragments.
- **D8 [Medium/S/pol] Standings results chips don't speak badge** ("6 final · 2 pending · 1
  remaining": 11.5px sans, no casing, all three icons `--primary-light`). *Rec:* badge
  convention + per-meaning colors (final `--success`, pending `--warning`, remaining
  `--white-45`).
- **D9 [Medium/S/pol] Two card-header type systems in one Standings stack** ("PLAYOFF BRACKET"
  mono/uppercase vs "Standings - A Pool" sans). *Rec:* one idiom — the mono kicker.
- **D10 [Medium/M/pol] Team-detail Schedule & Results rows are an older 108px/116px-pitch
  non-mono pattern** vs the Schedule tab's rows. *Rec:* re-skin to the schedule row language
  (mono date/venue, tabular scores, tighter min-height).
- **D11 [Medium/S/pol] Bottom-nav labels are Inter** while every other chrome data label is
  mono. *Rec:* `--font-data` on `.label`.
- **D12 [Medium/S/pol] My Team dock name hard-clips with no ellipsis** ("Halton Hawks U11 Jr (" —
  `text-overflow` is inert on a multi-child flex container). *Rec:* nested ellipsis span,
  star icon as `flex-shrink:0` sibling.
- **D13 [Low/S/pol] Playoff Picture `matchupMeta` + round chip break that page's own mono
  convention.** *Rec:* `--font-data` + scoped round-badge class.
- **D14 [Low/M/pol] Two competing "quiet kicker" families side by side** (display-font tracked
  eyebrow vs mono kickers). *Rec:* adopt the mono kicker as THE convention — **design-system
  decision → log to `/design`'s decisions file on acceptance** — then migrate stragglers
  (includes the pill-tracking drift + `badge-primary`-for-numeric-stat cleanups).

### Theme E — Light mode & theming honesty

- **E1 [High/M/pol] The light-mode muted-text boost is silently overridden for page content** —
  kickers/results/meta measure rgba(15,17,35,.40–.45) ≈ **2.6–3.0:1** (fails 4.5:1) because a
  later plain `[data-color-mode="light"]` `--white-*` re-declaration shadows the boosted values
  from `buildPublicLightModeCssVars()`. *Rec:* one authority — remove the competing
  re-declaration; let the public wrapper's compound selector own these tokens.
- **E2 [High/M/pol] Semantic status colors have no light-mode text variant** — e.g.
  `--success` advance-note text ≈ **2.28:1** on light. *Rec:* follow the repo's own
  `--gold-strong` precedent: add `--success-strong/--warning-strong/--danger-strong/--info-strong`
  (same value on dark; deepened on light), consume only where status renders as text/glyph.
  Fills/tints/borders keep the base tokens.
- **E3 [High/S/pol] Lime as text/icon is invisible on light** — bell "alerts on" + follow star
  ≈ **1.17:1** (`--logic-lime` never remaps). *Rec:* the proven `pillOn` pattern — solid lime
  chip/dot behind an ink glyph — for the bell's on-state and the star's active state.
- **E4 [Medium/S/pol] `.btn-primary` hardcodes `#FFFFFF` text**, bypassing the theme system's
  own `--on-primary` guard (near-black is computed for pale org primaries but never consumed
  here, unlike schedule/standings modules). *Rec:* `color: var(--on-primary)` (globals.css:691).
- **E5 [Medium/S/pol] Two `backdrop-filter` declarations lack the `-webkit-` twin** (hero stats
  panel, news featured badge) — violates the binding prefixed-first/standard-last order rule.
  *Rec:* add the prefixed twin immediately before each (Home.module.css:308; news.module.css:101).

### Theme F — Structural upgrades (new capability; each needs its own scoping)

- **F1 [High/L/NEW] Day-first schedule timeline.** Pool-first grouping fragments "today":
  A-Pool Jul 12 → A-Pool Jul 13 → (scroll) → B-Pool Jul 13 — a fan reads the same day twice.
  The mock's inline day grouping (one "SATURDAY · JULY 18" header spanning all pools) is the
  single largest structural divergence. *Rec:* day-first ordering with a small inline pool chip
  per row for the common 2-pool case — scope as its own follow-up (touches the schedule's core
  render loops).
- **F2 [Medium/M/NEW] Venue/diamond meta line on schedule rows.** The mock's "DIAMOND 2 ·
  GAME 14" line is absent — yet venues are *already fetched* by the schedule page and a CSS slot
  exists; the resolver helper is already used by dock/game-detail. *Rec:* render
  `resolveGameFieldLabel(game, venues)` on desktop `.timeCell` + a new mobile grid line.
- **F3 [Medium/S/NEW] Collapse the Standings bracket embed.** The full zoomable bracket (with
  its zoom chrome) mounts identically on Standings AND Schedule. Keep both doors, but wrap the
  Standings embed in the established `<details>` collapse pattern (children stay mounted) so the
  pool tables aren't pushed below a duplicate — **except on playoff day**, when `bracketOnTop`
  correctly makes it the headline. Pair with the bracket's legibility fixes: raise the
  first-paint fit-zoom floor (≈0.55, manual zoom-out untouched) and append "…" when names
  truncate (today: hard `slice(17|20)` at 58–64% zoom → ~7px names).
- **F4 [Medium/S/NEW] Score-alerts entry on team pages.** Teams tab/team detail have Follow but
  no alerts affordance; `FollowAlertsToggle` is mounted on 9 other surfaces. *Rec:* add it to
  the team-detail action row (context data already available; don't use the `pill` variant
  until its 44px sizing is fixed — see Theme B).
- **F5 [Medium/S/pol] News empty state is a dead end** (actions array empty when unfiltered).
  *Rec:* reuse the same component's Home-style action links (schedule/standings).
- **F6 [High/S/pol] The install banner can sit exactly on top of the live My Team dock** (both
  bottom-anchored: banner z:400 h:91 at bottom:772; dock z:150 at 714–766; the banner's
  follow-suppression isn't reactive to a follow made this session). *Rec:* dock publishes
  `--dock-h` (the ticker's own pattern) and the banner offsets by it; also have the banner
  listen for the existing `fl-follow-change` event.
- **F7 [Low/S/pol] iOS install copy says "Tap Share below"** on a screen whose own navbar has a
  different Share button. *Rec:* name the browser chrome explicitly ("the Share icon in
  Safari's toolbar").

## 4. Owner decisions requested (not auto-applied)

1. **G1 — Dock overlap policy.** The My Team dock repeats live info on Schedule (inline pinned
   card) and team detail (live row). The 2026-07-03 decision says dock-vs-page overlap is a
   product call. Options: (a) keep everywhere (always-on live indicator), (b) auto-collapse the
   dock to its slim minimized form on those two routes. Recommendation: (b).
2. **G2 — Day-first timeline (F1) scope**: green-light as its own project after Phases 1–3?
3. **G3 — Unified event header (REVISED in Round 1 rev 2, per owner feedback 2026-07-14):** the
   Navbar title bar and the page hero MERGE into one header — org eyebrow · title · one mono
   meta line · bell/account chip floating inside it (exactly the Phase 3 frame treatment), which
   condenses to a slim pinned bar (title + icons) on scroll, ticker pinned beneath. Rev 1's
   "band under the existing navbar" was rejected as a double header. Covers C1/C2/C8/D2-position.
4. **G4 — Kicker convention** (D2/D14): adopt the mono quiet-kicker as the single public-pages
   convention. On acceptance this gets logged as a binding entry in `/design`'s decisions file
   (as will A6's LIVE-chip standard and the Theme B `--tap-min` floor).
5. **G5 — "More" sheet in the tournament bottom nav (owner direction + counter-proposal iterated
   2026-07-14; final shape in Round 1 rev 3 Piece 06, awaiting owner confirm):** bar becomes
   **Home · Schedule · Standings · Teams · More** (owner's tab set). **More opens a one-tap
   bottom SHEET, not a page of sub-pages** (an Account sub-page inside More would put Coach view
   three taps deep; the flat sheet keeps every door ≤2 taps and reuses the coaches-portal More-
   drawer interaction). Sheet contents: YOU — identity/sign-in row, "You coach here → Coach
   view", "You run this event → Open admin", Scorekeeper (officials), Following, **Notifications
   (the bell RELOCATES here from the header — owner call; alerts are account-gated since Phase 2
   Slice 3, so the header bell was mostly a sign-in pitch)**, Your FieldLogicHQ; THIS EVENT —
   News, Rules (both keep their pages; nothing folds into Home). Signed-out fans: sign-in row +
   device follows + news + rules — never an empty sheet. **The Phase-3 initials chip is REMOVED
   from the mobile header** (owner call — header keeps only Share); the chip becomes desktop-only.
   **⚠ CROSS-PROJECT:** supersedes the Phase 3 rev-2 account-chip-on-mobile decision. Phase 3 is
   BUILT (uncommitted) in another chat; on owner confirm this must be relayed there BEFORE either
   ships. Registration is NOT affected: mobile keeps the full register flow; the pre-event Home
   leads with the capacity-honest Register CTA (owner question answered 2026-07-14 — no
   functionality is removed on mobile anywhere in this project).

**Status 2026-07-14 (Round 1 rev 3, final): G2 + G3 + G4 + G5 ALL ACCEPTED and logged to the
design decisions log. G1 deferred to Round 3. Round 1 build sequencing (shared working copy):
Track A lands its batches first (its files overlap Schedule/Navbar/globals), Phase 3 commits its
sheet (Round 1's More tab reuses it), then the Round 1 build proceeds in the review chat:
(1) Home stage-aware body + row anatomy, (2) unified header, (3) schedule control stack,
(4) More tab + sheet relocation last. Round 2 mockups (Standings + Bracket) run in parallel in
a dedicated chat — kickoff prompt: TOURNAMENT_MOBILE_ROUND2_MOCKUPS_PROMPT.md.**

### Round 2 decisions — ALL THREE ACCEPTED 2026-07-14 · BUILT on dev 2026-07-15 (uncommitted)

**Build status 2026-07-15 (Round 2 chat):** both clusters built as accepted and Playwright-verified
(390/360/desktop/light; pool-play AND playoff-day states; live-demo restored to game day after).
Files: `components/public/StandingsContent.tsx` + `app/[orgSlug]/standings/standings.module.css`
(D8 chips, D9 headers, D3 second line, D4 data face, R2-3 dual column sets, R2-1 `<details>`
disclosure), `app/[orgSlug]/[tournamentSlug]/playoffs/page.tsx` +
`components/public/PlayoffPicture.module.css` (C2 hero retirement ≤900px via `data-live-chrome`
+ "Seeding & Matchups" kicker, R2-2 strip compression, A7 pending card, D13 mono meta),
`lib/playoff-picture.ts` (one-line narrative, `pending` stub list — today-only, honest feeder
copy via numbered `bracketRoundLabel`), `lib/utils.ts` (`splitTeamQualifier`, shared with
Round 3's Teams surfaces). Desktop keeps all seven columns + its hero; verify:changed/typecheck
green. **Owner phone pass DONE 2026-07-15/16 (game day + pool play + capped-RD completed-demo)
with 3 test-driven refinements (mobile pending clock, 10rem name col + stacked capped RD,
full-width chips). /simplify DONE 2026-07-16 (7 fixes: chips compose the global badge family,
disclosure composes .bracketSection, feeder labels via new lib/playoff-bracket.bracketGameLabel,
pending dayLabel as data, resolveSide reuse, IIFE + O(n²) hoists; 4 noted skips). /review DONE
2026-07-16 (high-risk funnel, 5 lenses, 9 findings → 6 CONFIRMED FIXED incl. [High] decided
finals never graduated into the matchup list — the championship vanished the moment it went
live (teamId-aware unresolved gate; matchup chips now fanRoundLabel), stale mobile header
override, closed-details first-open measure → bracket mounts on first reveal (per-division,
keyed), ambiguous non-QF/SF feeder labels (", Game N"), division-switch disclosure reset,
rank-flash wrap hardening; 2 intended (D4 desktop data-face, bracketOnTop remount), 1 accepted
narrow risk. /docs DONE 2026-07-16 (faq-public-playoff-bracket + faq-playoff-picture updated +
search terms). Pending: owner commit OK.**

*Mockups: `claude.ai/code/artifact/a92fc65c-60a0-4439-a7f7-f388c929241c` (Round 2 — Standings +
Bracket / Playoff Picture; fresh captures on the re-lit live-demo, two semis live). Owner
accepted R2-1 + R2-2 + R2-3 as recommended, 2026-07-14, in the Round 2 mockup chat. ⚠ The
review chat still needs to log these to `/design`'s decisions file (the mockup chat's charter
doesn't write there). **Build sequencing (owner-decided 2026-07-14):** the ENTIRE Round 2
build is SERIALIZED behind the Round 1 build — do NOT start it in parallel (owner chose the
safer queue over the available Standings-cluster parallelism). When Round 1 completes, the
owner gives the go signal in the Round 2 chat, which then builds both clusters: (1) Standings —
R2-1 embed disclosure + R2-3 REC-merge columns + D3/D4/D8/D9; (2) Playoff Picture — R2-2
de-hero/retitle/stat-strip/pending-final + D13, built on Round 1's landed unified header.
Consume Round 1's shared conventions (D1 badge font, G4 kicker rule) — don't re-add them.*

1. **R2-1 — Standings bracket embed folds outside playoff day (F3).** During pool play the
   Standings bracket embed collapses to a one-row "PLAYOFF BRACKET" disclosure after the pool
   tables (the established `<details>` pattern — children stay mounted, zoom state preserved;
   tap to expand in place). Playoff-day/completed `bracketOnTop` auto-expand is untouched.
   Schedule's embed is untouched. *Recommendation: approve.*
2. **R2-2 — Playoff Picture de-hero survivors (C2 + A7).** Under the accepted G3 unified header
   the page retitles to a quiet "Seeding & Matchups" kicker (never echoes Home's headline) and
   keeps: seeding list + opening matchups + ONE stat strip (top seed · best offense · best
   defense); the narrative trims to a single lede line; an unresolved final renders as an honest
   "pending tonight" block (real time + diamond, "winners of both semifinals" — no bracket
   jargon). *Recommendation: approve as mocked.*
3. **R2-3 — Standings columns on phones.** Evidence (fresh 390/360 captures): PTS — the ranking
   column — is off-screen at BOTH 390 and 360; RD clips at 360. Proposal: mobile-only merge of
   W/L/T into one REC column ("3-0-0", data face, tabular) so TEAM · REC · RD · PTS fit with no
   horizontal scroll at 360; RF/RA stay behind the existing swipe; desktop keeps all seven
   columns. (The stat-legend code already anticipated a mobile REC view — J6-031.)
   *Recommendation: approve the REC merge.*

### Round 3 decisions — ALL FOUR ACCEPTED by owner 2026-07-16 (in the Round 3 mockup chat, as recommended; G1 = option (b) auto-minimize)

*Mockups: `claude.ai/code/artifact/0d4161cc-0583-4167-9bc6-78683508e3b9` (Round 3 — Teams + team
detail + chrome; fresh captures on the re-lit live-demo, two semis live, 390/360/light incl. a
one-off branded-light Teams capture). Scope was re-verified against the working tree before
mocking: Track A already landed the soft LIVE chips (A6) and tap floors on both Teams and team
detail — those are NOT re-proposed; D5 is half-landed on Teams (`.cardRecord` already has the
mono face/size, `tabular-nums` still missing); C7 / D7 / D10 / F4 all still hold; **D11 checked
per the kickoff prompt — Round 1's nav rebuild did NOT put the labels in the data face, so D11
stays live scope and rides with R3-2** (one-line fix). Capture-harness side-find, flagged NOT
Round 3 scope: the schedule page lays out at a **448px mobile layout viewport** on a 390px
device (some element wider than 390 forces mobile zoom-out ~13%; also why the dock/bottom-nav
sit below the schedule screenshots' crop) — relay to the Round 1 review chat / Round 4 schedule
work. Owner accepted all four 2026-07-16; the decision cards on the artifact are stamped
accepted.*

**Post-acceptance status (2026-07-16, updated same day): BUILT on dev (uncommitted, no
migrations)** — after the Round 2 commit (`94ccc8a1`) unblocked the shared `splitTeamQualifier`
dependency, the owner directed the build in the Round 3 chat. Shipped as accepted: **G1** dock
pill (right-anchored ★ + LIVE + score, ≥44px, ticker-min idiom; tap restores; wrap
`pointer-events:none`; full bar untouched on all other routes); **R3-1** one-row team-page
header (Follow labeled + icon-only Calendar/Share ≤640px + the score-alerts bell —
`FollowAlertsToggle` gained `variant="icon"`, lime-fill + ink ON state per pillOn/E3, gated by
OrgNav's `fanAlertsEnabled && !tournamentFinished`; desktop mounts the labeled variant) + the
Recent-results live row now carries the running score; **R3-2** Teams tab data face
(tabular-nums, G4 pool kickers + counts, mono meta/status lines, coach quiet line via the
shared helper — `team.coach` wins, raw qualifier fallback; D11 nav labels → `--font-data`);
**R3-3** team rows re-skinned (mono ctx line, tabular scores, soft W/L/T chips both
breakpoints incl. the Recent-results pips, live-first ordering, ~112→~82px pitch, "N played ·
N live" kicker); **"FORM" → "Recent results"**. Files: `MyTeamDock.tsx/.module.css`,
`teams/[id]/page.tsx` + `team-profile.module.css`, `TeamsContent.tsx` + `teams.module.css`,
`BottomNav.module.css`, `FollowAlertsToggle.tsx/.module.css`, `SharePageButton.tsx` (label
span for responsive hiding). Verified: typecheck + verify:changed green; Playwright
computed-style probes at 390/360 + light org + followed/anonymous (pill on schedule+team
detail, full bar on home; mono faces + tabular-nums computed; zero overflow; action row = one
44px row). Dev server needed the stop → `.next` purge → restart protocol mid-verify (stale
jest-worker state predating the build). **✔ Design-log debt CLEARED 2026-07-16** — package
entries for R2-1/2/3 and G1 + R3-1/2/3 + the rename are in `memory/design_decisions.md`.
**/simplify DONE 2026-07-17** (4 agents; 7 fixes: single-mount alerts bell w/ `className`/
`labelClassName` passthrough replacing the icon variant + double mount, one-pass `liveById`
liveness + precomputed sort keys, shared `teamPov` score helper, shared dock `scoreOrNext`
cluster + frost recipe, explicit href route-match, named `.btnLabel` spans replacing blind
descendant selectors, merged `.formW/.resW` chip recipes; 1 skip: cross-file kicker sharing —
local repetition is the documented chrome-label altitude). **/review DONE 2026-07-17**
(standard tier, 3 lenses — correctness/regression/state; 3 confirmed FIXED: forfeit games now
count in "N played" + pips gated to scored games; dock restore keyed to pathname so
minimize→minimize navigation can't flash the full bar; `fl-push-device-change` broadcast syncs
`deviceReady` across simultaneously-mounted alert toggles (pre-existing gap widened by the new
team-page mount); 2 refuted at the rendering: 320px nav labels don't clip, legacy `/teams/[id]`
is unreachable (proxy rewrites into org scope → 404) so the shared-stylesheet bleed is moot;
2 documented no-action: pill signed-out aria "Sign in for score alerts" over the shortened
visible label is intentional + WCAG label-in-name compliant, and the static bottom-clearance
budgets on schedule/team pages are ~10px oversized while the pill shows — cosmetic, deferred
to Round 4's schedule rebuild). Gate re-run green. Remaining: owner phone pass + commit OK.

1. **G1 — dock overlap policy (deferred from Round 1; the headline).** Both options mocked on
   the followed team page (dock's LIVE 5–3 sits directly over the form card's identical live
   row; Schedule's pinned card duplicates it the same way). (a) keep the full 52px bar
   everywhere; (b) on Schedule + team detail ONLY, auto-minimize to a 44px pill (the ticker's
   existing minimize-to-pill idiom) — tap restores the full bar; full dock everywhere else;
   expand panel (share/alerts/venue/unfollow) untouched. Build honesty on the artifact: today's
   dock has exactly ONE form (bar + expand panel; `expanded` is plain component state, no
   persistence) — option (b)'s slim state is new-but-tiny. *Recommendation: (b), as on record
   since the review.*
2. **R3-1 — team-detail header shape (C7 + F4).** Identity row + ONE ≥44px action row — Follow
   stays labeled (the page's primary act), Calendar/Share become icon-only circles per the
   icon-only-mobile convention (aria-labels), and the score-alerts bell JOINS the row (F4) —
   the same `FollowAlertsToggle` the dock's expand panel already mounts, finally on the team
   page. Stat strip, playoff chip, back link unchanged. Schedule content reaches screen one.
   *Recommendation: approve.*
3. **R3-2 — Teams tab type system (D5 + D7 + D11).** `tabular-nums` completes the record
   convention; pool headings become G4 mono kickers; rank · pts + next-game lines join the data
   face; the coach qualifier renders as the quiet mono second line via the shared
   `splitTeamQualifier` helper (Round 2's D3 convention reused — no second convention; today
   `TeamsContent` strips the qualifier with a local regex). D11 rides along: bottom-nav labels
   get `--font-data`. No bell per team card — F4's entry lives on team detail (R3-1).
   *Recommendation: approve.*
4. **R3-3 — team-detail Schedule & Results rows (D10).** Re-skin to the schedule tab's built
   row language: mono context line (date · time · diamond), sans opponent, tabular mono score,
   soft outcome chips gated to finished games (a live 5–3 shows LIVE, never W), live row first
   with its running score. ~112px cards → ~64px rows (~1.7× more games per screen). Nothing
   dropped: every date, venue, result survives. *Recommendation: approve.*

**Copy rider — DECIDED by owner 2026-07-16 (in the Round 3 mockup chat):** the team page's
"FORM" card label renames to **"Recent results"** — "form" is soccer/broadcast jargon the
softball/baseball audience may not read; the W/L pips themselves are unchanged. Label-only,
ships with the Round 3 build (the card lives on the team-detail page, R3-1's surface). Artifact
frames already depict the new label. Log with the other Round 3 decisions when they're accepted.

## 5. Execution split (owner-approved 2026-07-14)

Two parallel tracks replace a strict phase sequence:

- **Track A — mechanical fixes, no mockups** (built by a dedicated chat; kickoff prompt =
  `TOURNAMENT_MOBILE_TRACK_A_PROMPT.md`): A2 A3 A4 A5 A6 A8 A9 F6 F7 · all of Theme B (+
  `--tap-min` token) · all of Theme E · D12, bracket ellipsis + first-paint zoom floor, F5.
  These have one correct answer each; verified by re-running
  `scripts/mobile-review-capture.mjs` (harness now shipped in-repo).
- **Track B — mockup rounds, decided before build** (review chat produces before/after phone-
  frame artifacts; owner decides; then that cluster builds):
  **Round 1 Home + Schedule** — C1 C3 C4 C8 A1 A10 F2 D6 + kicker/chip conventions (D1 D2, G4)
  + day-first preview (F1, decision G2). **Round 2 Standings + Bracket/Playoff Picture** —
  C2 C5 C6 D3 D4 D8 D9 D13 F3 A7. **Round 3 Teams + team detail + chrome** — C7 D5 D7 D10 D11
  F4 + dock policy (G1).
- Visual-language items (badge/eyebrow/kicker typography, hero structure, row anatomy) are
  explicitly OFF-LIMITS to Track A so mockup decisions aren't preempted.

## 5b. Phased build plan (original theme order, kept for reference)

| Phase | Contents | Effort |
|---|---|---|
| **P1 — Live honesty** | A2, A3, A4, A5, A6, A8, A9, F6 (+A1 if M is acceptable here) | mostly S, 2×M |
| **P2 — Tap-floor sweep** | B1–B7 as one pass + `--tap-min` token | S each |
| **P3 — First screen** | C1–C8 (C9 opportunistic) | S/M |
| **P4 — Type system** | D1–D13 (D14 after G4 sign-off) | S each, D10 M |
| **P5 — Light mode** | E1–E5 | S/M |
| **P6 — Structural** | F1 (own plan), F2, F3, F4, F5, A7 | M/L |

Phases 1–2 are the fan-visible payoff for game day; each phase is independently shippable.
Everything is CSS/component-level — **no backend, no migrations, no nav paradigm changes.**
All changes must hold under: dark default, light `color_mode`, arbitrary org primary (test with
`branded-dark`/`branded-light`), 390 AND 360 widths, followed + anonymous states.

## 6. Verification plan (when building)

- Re-run the capture harness per phase; diff `smallTargets` (must trend to empty), `chrome`
  backdrop values (never `none`), overflow flags (stay false), and the specific measured values
  cited per finding (e.g. hero ≤ ~120px, first schedule row on playoff day = a live playoff game).
- Playwright computed-style checks, not screenshots, for anything sticky/frost/contrast
  (standing rule). Contrast probes for E1–E3 in light mode.
- Owner browser pass on a real phone for P1+P3 (thumb reach + live feel are judgment calls).

## 7. Out of scope / explicitly not proposed

- Bottom-nav composition change (Bracket tab) — refuted; Standings already becomes the bracket
  on playoff day. Rules stays reachable.
- Removing the standings bracket embed, the follow loop, alerts, install, or share — anything
  shipped stays; F3 collapses, never deletes.
- Backend/data changes of any kind. Ticker/dock architecture. The consumer shell (Discover etc.)
  — separate surface, already reviewed 2026-07-13.
