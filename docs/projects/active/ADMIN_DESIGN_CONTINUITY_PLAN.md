# Admin Design Continuity — Implementation Plan

> **Status:** RULED 2026-09-25 (owner: *"I agree with your recommendations, go ahead"*). **Slice 0 (the
> baseline) COMMITTED `459b3bbd` 2026-09-25** — measuring tools only, no product code; results in §3a.
> **Slice 1 (the switch, the theme, the frame, Families + Public site) BUILT 2026-09-25** — results in
> §3a; /simplify + /review done; **COMMITTED `1b3cd541` 2026-09-25** (not pushed — staging shows it
> once `dev` is pushed). Owner QA walk: at slice 6 (owner, 2026-09-25). Club Stage 1's screens session
> may now start. **Slice 2 (buttons, chips, type; House league; Organization, setup, Notifications)
> BUILT 2026-09-26** — results in §3a; /simplify + /review done; **COMMITTED `ee175263` 2026-09-26**.
> **Slice 3 (Rep Teams + Accounting, the money tables restyled in place — F4) BUILT 2026-09-27** —
> results in §3a; identity + switch-on sweep done; /simplify + /review done; **COMMITTED `35705e32` 2026-09-27**.
> **Slice 4 split in three by job (2026-09-27, §3a).** **Slice 4a (tournament setup + records, and the
> tournament screens' shared parts) BUILT 2026-09-27** — results in §3a; /simplify + /review done; identity
> 58/58 + both-theme sweep done; **COMMITTED `8e76362f` 2026-09-27**. **Slice 4b (operations on game day, with
> the game list moved in from 4c) BUILT 2026-09-27** — results in §3a; identity 60/60 + both-theme sweep
> done; /simplify + /review done (owner: "go ahead with simplify, review and commit"); **COMMITTED `07808a02`
> 2026-09-27**. **Slice 4c (the schedule) BUILT 2026-09-27** — results in §3a; identity 28/28 + both-theme
> sweep done; /simplify + /review done (owner: "Go ahead with simplify, review and commit"); **COMMITTED
> `9d1b1670` 2026-09-27**. **Slice 1's open questions RULED 2026-09-27** (the shared phone bar's Dark
> labels and its case, Warm's card shadows — fixed in BOTH portals, live coaches included; the preview's
> Warm tab bar → slice 6) — results in §3a after 4c's; /review done; **COMMITTED `dca4ac25` 2026-09-27**.
> **Slice 5 (the volunteer screens in fixed warm — R3; the admin's help guide following the theme — R4)
> BUILT 2026-09-27** — results in §3a after slice 1's open questions; /simplify + /review done (owner: "go ahead with
> simplify, review, and commit"); **COMMITTED `530d87e9` 2026-09-27**. Slice 6 (prove, walk, release) is next.
> **Phase 0 desk half DONE 2026-09-25** ([ADMIN_DESIGN_CONTINUITY_PHASE0_INVENTORY.md](ADMIN_DESIGN_CONTINUITY_PHASE0_INVENTORY.md);
> results in §3 Phase 0). **Phase 1 foundation DRAWN and RATIFIED 2026-09-25** (hub v2 → v3; F1–F4
> accepted as recommended). **Build prompt written 2026-09-25**
> ([ADMIN_DESIGN_CONTINUITY_PHASE1_BUILD_PROMPT.md](ADMIN_DESIGN_CONTINUITY_PHASE1_BUILD_PROMPT.md)): built
> behind a dev-only switch in slices 0–6 and released on one day (§3a, slice ledger).
> **Created:** 2026-09-25 · **Branch:** dev
> **Companions:** [ADMIN_DESIGN_CONTINUITY_PM_BRIEF.md](ADMIN_DESIGN_CONTINUITY_PM_BRIEF.md) · project hub
> `ADMIN_DESIGN_CONTINUITY_HUB.html` = https://claude.ai/artifact/R1Zcp2s93gmgaHGHn6SLSZ (republish the
> same path every phase; v1 2026-09-25 carries the scope map and the interim-screen specimen; v2 the
> same day adds the Phase 0 measurement and the Phase 1 foundation specimens 3–7 with asks F1–F4).
> **Origin:** the owner's question during the Club Tier Stage 1 mockup session — *"is part of this project
> going to focus on the design of the club modules and how they compare to the premium coaches portal? I
> would like to have continuity there (including in the tournament modules) where we have light/dark theme
> in all and they follow the same design patterns. I want to use the coaches portal as the model since that
> one is the most recent and has had the most optimal design decisions made."*
> **Relationship to other plans:** amends Club Tier ruling **D12** (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md`
> §5) — club screens are still redesigned inside each club stage, now in both themes, and on a shared
> foundation this program lands first. Re-opens the **"admin deferred"** clause of the July theming
> ratification (TH-1, `memory/design_decisions.md` 2026-07-21) and supersedes the **2026-08-14 "help guide
> is one fixed dark surface"** ruling once the admin follows the theme.

---

## 0. Goal

Every working screen an organization's people use — the club admin, the tournament admin, house league,
and the scorekeeper and gate screens — uses the **coaches portal's design system** (its tokens, type
ladder, components and patterns) and follows the **one account theme** (warm by default, dark when the
person chooses it). Someone who moves between their coaches portal and their club or tournament admin
cannot tell where one ends. The organization's own branding stays exactly where families and visitors see
it: the public pages.

## 1. Rulings (owner, 2026-09-25 — all accepted as recommended)

| # | Ruling | Replaces / amends |
|---|---|---|
| R0 | **The admin side joins the one account theme, and the coaches portal is the model.** One preference (warm default, dark opt-in) governs every admin screen, tournament screens included. | TH-1's "admin deferred" (2026-07-21) · Club D12 amended |
| R1 | **The organization's colour leaves the admin chrome.** Today the org's brand tokens tint admin buttons, borders and glows (~76 places); the coaches portal uses no team colours. The org colour stays on the public pages. | M2 (org brand wins on org-branded surfaces) unchanged — the admin is platform chrome |
| R2 | **Public pages stay in the organization's own branding and never follow the account theme** (org home, tournament pages, team pages, tryout and registration forms, league pages, the admin's previews of them). | Restates M2 |
| R3 | **Scorekeeper and gate screens are restyled to the kit in the warm default.** Volunteers arrive by link with no account, so there is no preference to follow. | TH-1 "scorekeeper excluded" narrowed: excluded from the preference, not from the design system |
| R4 | **The help guide follows the theme** once the admin does — a dark island inside a warm app is the discontinuity this program removes. | 2026-08-14 "one fixed dark reading surface" |
| R5 | **The foundation (Phase 1) lands before the Club Stage 1 build.** Accepts the delay ("we are not rushing to production"). **Refined 2026-09-25 (§3a):** Stage 1's server half runs now; its screens are built after slice 1 behind the same switch and ship on the foundation's release day. | Club plan §6 Stage 1 gains the prerequisite |

## 2. What exists today (verified in the code, 2026-09-25)

- **Scale.** 86 admin screens (27 of them tournament screens); 54 admin stylesheets holding **~812 raw
  colour literals**; **~1,868 inline `style={{…}}` blocks** in admin components (not all carry colour — Phase
  0 counts the ones that do). The coaches portal's own warm rollout found inline literals were where screens
  broke: 52 defects after its public release (`WARM_PORTAL_THEME_OPTION_PLAN.md`, 2026-07-24 audit).
- **The theme mechanism already exists.** One account preference (`data-user-theme` on `<html>`, set
  pre-paint, warm default since 2026-07-22) plus a shell marker (`[data-coach-warm-enabled]`) under which
  `app/globals.css` redefines the dark tokens to the warm palette. The coaches portal and the consumer app
  honour it; **the admin shell carries no marker**, so it is always dark.
- **The org's colour reaches the admin.** `app/[orgSlug]/layout.tsx` sets `--primary*`, `--border`,
  `--glow*` from the org theme on the whole `[orgSlug]` tree; admin CSS reads them ~76 times. The org
  **colour mode** (`data-color-mode`) is used only by public tournament layouts and the admin's public
  preview — never by the admin itself.
- **Admin frame:** `components/admin/AdminTopStrip`, `AdminSidebar`, `AdminBottomNav`,
  `AdminEventHeader`, `admin.module.css`, `admin-common.module.css` — all dark-HUD literals and tokens.
- **Help surface** restores dark snapshots under `[data-help-surface]` (`globals.css`), fixed by ruling.
- **Verification today:** the layout sweep (`scripts/layout-screens.mjs`) covers coach + marketing routes
  only; the warm palette contrast test holds the portal's grounds only. No admin screen is swept in any theme. *(Closed by slice 0, 2026-09-25 — every admin screen swept and pictured in today's dark; §3a.)*
- **The kit to adopt:** `components/coaches/kit` (card, door card, eyebrow, figure, chip, bar, list
  toolbar, rail), `CoachPageHeader`, `CoachPageSection`, `CoachEmptyState` / `CoachNotGranted`,
  `CoachRowList`, `CoachTabBar`, `CoachFigureRows`, the dialog floor, the table standard
  (`docs/agents/design/TABLE_AND_LIST_STANDARD.md`), the type ladder (`--type-*`).
- **Kit gaps the admin will need** (first list, from the Club Stage 1 drawings): a multi-program rail
  (the coach rail serves one team), a settings switch row, a plan-and-capacity card, a role matrix, the
  tournament event header in kit form. Phase 0 completes the list.

## 3. Phases

### Phase 0 — Measure (read-only; can start now, beside the Club Stage 0 walk)
- Per-module inventory: screens, colour literals, colour-carrying inline styles, org-colour uses, and
  which kit component each admin pattern maps to. Output: a sized table per module (club, tournament,
  house league, org admin, scorekeeper/gate) and the final kit-gap list.
- Add every admin route to the layout sweep (owner, admin, treasurer, scorekeeper sessions) and record
  **today's dark baseline** — so Phase 1 can prove "renders correctly in both themes" against a known start.
- Extend the contrast test's ground list to the admin's grounds.
- No walk; a report on the hub and a go/no-go on Phase 1's size.

**Results — desk half, 2026-09-25** (full record: the inventory file; hub specimen 3):
- **The plan's sizing held exactly** — 86 screens (27 tournament), 812 literals in 54 sheets, 1,868
  inline blocks, each re-counted byte for byte. The inventory's per-area table reaches wider (help,
  `components/accounting`, the scorekeeper/official/check-in routes, TSX), so its totals run higher; the
  org-token reads are **77** in the plan's CSS scope (the plan's "~76") and **~196** in the wider scope,
  because `--border` is the org's primary at 25% (`app/[orgSlug]/layout.tsx`).
- **Go: Phase 1 is the size the plan said, and cheaper than feared in one place.** The warm block
  already remaps 111 of the 144 custom properties admin reads, and the five button classes (~1,066
  uses) already carry warm overrides under the marker the admin lacks.
- **Gaps that do not flip on their own (fill first, before any screen):** the `--white-4/-15/-25` steps
  and the whole `--black-20/-30/-40` ramp; the `.card` recipe's `--highlight-top` / `--shadow` /
  `--shadow-sm` (227 `.card` uses); `.badge-primary` pairs an org-tinted wash with olive text under the
  marker; admin-local accents (`--acct-violet`, `--help-accent`, …) each need triage; `--border-1` in
  `tournaments-admin.module.css` is an undefined token (a pre-existing bug).
- **Structural leaks:** `data-card-style` (the org's PUBLIC card style) is stamped on the whole
  `[orgSlug]` tree, admin included (T08 → F1); `--font-data` monospace is on titles, nav, buttons and
  table heads in 47 admin stylesheets (561 uses) where the kit keeps it to eyebrows, chips and
  readouts (T10 → F2); the scorekeeper's `--sk-*` palette is a separate system, not a remap (T11).
- **The build gate is an EXTENSION, not a new script:** `scripts/check-public-tokens.mjs` already runs
  an `operator` scope in `verify:changed` with an empty baseline; Phase 1 widens what it counts (the
  fixed alpha steps and inline-style colours) rather than writing a second checker.
- **Kit gaps, final list:** multi-program rail · settings switch row · plan-and-capacity card · role
  matrix · tournament event header · a themed scrim · the dense money table (untested at 6–7 columns
  → F4).
- ⚠ The inventory says the kit's eyebrow is not monospace. **That is wrong** — `CoachKit.module.css`
  `.eye` and `.chip` use `var(--font-data)`. Both hubs were corrected to draw them in mono.
- **Order inside Phase 1:** frame + Families + Public site editor → buttons and badges → Hub,
  Organization, House league → Rep Teams, Accounting → Tournaments → Scorekeeper and gate → Help guide.

### Phase 1 — Foundation (lands before the Club Stage 1 build — R5)
**Owner mockup session first** — **DRAWN 2026-09-25, hub v2**: the scope map and interim screen (v1)
plus the measurement (3), the tournament frame on a phone in both themes (4), a dense money table
restyled in place (5), the help guide in the reader's theme (6), and the scorekeeper list and score
sheet in fixed warm (7). **RATIFIED 2026-09-25 with F1–F4 as recommended** (owner: *"I agree with your
recommendations on F1-F4"*; hub v3; design log entry in `memory/design_decisions.md`):
- **F1** the admin ignores the organization's public card style [yes — R1's reasoning];
- **F2** admin type follows the kit, monospace only on eyebrows, chips and readouts [yes];
- **F3** admin page headers carry no subtitle line [none — the `CoachPageHeader` 2026-08-11 ruling; the
  ratified Club Stage 1 drawings were corrected to match, club hub v8];
- **F4** dense money tables are restyled in place in Phase 1 and redesigned only in Club Stage 3 [yes].

Then:
- **1a Theme plumbing.** The admin shell carries the same marker the coach shells carry; the one account
  preference governs every admin screen; the admin frame stops reading the organization's colour (R1);
  the account Appearance setting's copy names the admin too.
- **1b The frame.** Top strip, rail, phone bar and page header rebuilt on the kit. The club version is the
  one drawn in Club Stage 1 specimens 1, 3 and 4; the tournament version keeps its switcher and its
  Operations / Setup / Admin groups, restyled.
- **1c Every screen renders in both themes.** Colour literals become tokens both themes define; colour-
  carrying inline styles are converted; **layouts do not change** — a restyle, not a redesign. A build gate
  refuses new raw colours in admin code outside an allowlist (the portal's technique).
- **1d The help guide follows the theme** (R4).
- **1e Verification.** The layout sweep over every admin screen in both themes, the contrast test over the
  admin grounds, and an owner § walk sampling each module in both themes.
- **Release care:** every tournament organizer who never chose a theme sees the admin turn warm on the day
  this ships (warm is the default). A What's New note says where the Dark choice lives; release outside a
  peak tournament weekend.

### 3a. How Phase 1 is built — the switch and the slice ledger (owner, 2026-09-25: *"I agree"*)
**Built behind a dev-only switch, released on one day** — the coaches portal's warm rollout precedent
(`7e5c6bf0`, `lib/coach-warm-preview.ts`). Every session shares `dev` and `dev` is promoted whenever anyone
ships, so nothing Phase 1 changes may be visible on production before the release; with the switch off
every admin screen must match the slice-0 pixel baseline (the identity check). Build prompt:
[ADMIN_DESIGN_CONTINUITY_PHASE1_BUILD_PROMPT.md](ADMIN_DESIGN_CONTINUITY_PHASE1_BUILD_PROMPT.md), one slice
per session. **R5 refined the same day:** Club Stage 1 is split — its server half
(`CLUB_TIER_STAGE1_SERVER_PROMPT.md`) runs after slice 0, beside slice 1; its screens
(`CLUB_TIER_STAGE1_SCREENS_PROMPT.md`) are built after slice 1, **behind this same switch**, and replace
the club hub, Members + audit log, Plan & billing, Org Settings and the setup checklist, which the
foundation therefore does NOT restyle (restyling them first would be thrown away). They ship on the
foundation's release day.

| Slice | Scope | Status |
|---|---|---|
| 0 | Baseline: every admin + guest screen in the invariant sweep (today's dark), the switch-off identity check, contrast grounds. Needs the dev server alone. | **COMMITTED `459b3bbd` 2026-09-25** — results below |
| 1 | The switch · theme gaps · R1/F1 · the frame (top strip, rail, phone bar + More, page header, event header) · Families · Public site editor | **COMMITTED `1b3cd541` 2026-09-25** — results below; walked at slice 6 |
| 2 | Buttons, chips, F2 type · the rest of Hub/onboarding + Organization (not Stage 1's screens) · House league | **COMMITTED `ee175263` 2026-09-26** — results below; /simplify + /review done; walked at slice 6 |
| 3 | Rep Teams · Accounting (F4 dense tables) | **BUILT 2026-09-27** — results below; /simplify + /review done; COMMITTED `35705e32` 2026-09-27; walked at slice 6 |
| 4a | Tournaments — **setup and records, plus the area's shared parts** (split recorded below) | **BUILT 2026-09-27** — results below; /simplify + /review done; identity 58/58 + both-theme sweep done; COMMITTED `8e76362f` 2026-09-27; walked at slice 6 |
| 4b | Tournaments — **operations on game day**: dashboard (both frames), Teams, results, check-in, staff kit, communication, chat — **and the game list** (moved from 4c by the owner, 2026-09-27: it is Results' body) | **BUILT 2026-09-27** — results below; identity 60/60 + both-theme sweep done; /simplify + /review done; COMMITTED `07808a02` 2026-09-27; walked at slice 6 |
| 4c | Tournaments — **the schedule**: schedule, generator, playoff wizard, brackets, timeline, the schedule windows (the game list's kit block is 4b's, already in `schedule-admin.module.css`) | **BUILT 2026-09-27** — results below; identity 28/28 + both-theme sweep done; /simplify + /review done; COMMITTED `9d1b1670` 2026-09-27; walked at slice 6 |
| 5 | Scorekeeper, official, gate (R3 fixed warm) · help guide (R4) | **BUILT 2026-09-27** — results below; /simplify + /review done; COMMITTED `530d87e9` 2026-09-27; walked at slice 6 |
| 6 | Prove (both-theme sweep, contrast, identity) · the public preview's Warm tab bar (owner, 2026-09-27: "fix in slice 6") · owner § walk · release (switch deleted, legacy removed, coaches help pin removed — ⚠ AND the coaches portal's "?" drawer given its own portal root, or it stays dark: it portals outside the coach marker (found in slice 5) —, What's New, `/docs`, `/release`) | not started |

**Slice 4 — the split (2026-09-27, written before starting, as the build prompt requires).** The
tournament area measured at the start of slice 4 (same scope as the inventory's footnote 2): **54,112
lines, 1,117 colour literals, 857 inline style blocks, 191 org-colour reads** — about 3.8× slice 3 by
lines, 2.9× by literals and 2.2× by inline blocks. Slice 3 filled one session. The prompt's three jobs
(setup / operations / records) are not three equal sessions: records is small (~3.2k lines, 97 literals)
and operations is 2.5× slice 3 on its own, over half of it the schedule. So the split is still **by
job**, re-cut so each part is about slice 3's size:
- **4a — setup and records, plus the shared parts** (~340 literals, ~270 inline blocks): the Settings &
  access index, Event settings, Divisions, Venues, Rules & resources (the styled-jsx outlier), Public
  site (branding; its preview keeps the organization's colours, R2), Registration questions,
  Notification preferences, the new-tournament wizard (and its style cards, and the tie-breaker editor
  both setup screens use); Archives, Post-event summary, Data tools. **Shared parts, because they reach
  every later part:** `TournamentAdminHeader` (the page header ten tournament screens share, operations
  included — its F3 re-homings are all decided here) and `TournamentAdminUI`'s toolbar, menus and
  legend. (The prompt's `--border-1` fix is already done: the undefined token lives in the
  Organization Tournaments sheet, and slice 2 drew that divider on the kit. The legacy rule stays as
  it is until the release deletes it — fixing it now would draw a line with the switch off.)
- **4b — operations on game day** (~414 literals, ~155 inline): the dashboard in both frames (and its
  guidance rail and persona panel), Teams (and its import windows and health panel), Results (and its
  context strip and coin toss), Check-in (the admin's board; the volunteer gate is slice 5), Staff kit,
  Communication, Chat.
- **4c — the schedule** (~349 literals, ~431 inline): the schedule page, Generator, Playoff wizard, the
  bracket builder / editor / columns / connectors / zoom, the timeline, ~~the game list~~ (moved to 4b,
  owner 2026-09-27 — it is Results' body), the shift-day /
  resolve-locations / field-picker windows, the health panel, the zero-venue prompt.
- **Not in slice 4 at all:** the four tournament pages that re-export another screen — Members and its
  audit log and Plan & subscription (Club Stage 1's), PDF settings (slice 2's); "manage" re-exports the
  Organization Tournaments list (slice 2's); the two public previews (R2, proven in slice 1).

**Slice 0 — results (2026-09-25).** Ran alone on the owner's word, on a freshly restarted dev server
with every UAT session refreshed. No product code changed.
- **The screens.** 91 admin-side entries in `scripts/layout-screens.mjs`, each carrying an `area`: 82
  of the 86 admin pages, 3 role variants (the club hub as its admin, Accounting as its treasurer,
  house-league Registrations as its registrar), the phone More menu OPEN on both frames, the club's own
  tournament inside the club frame, and the volunteer screens as a real `official` (scorekeeper, its
  score sheet open, gate check-in). Club screens on `uat-rep-club`; tournament screens on
  `uat-plus-org`'s Championship (the only dev tournament with games), pinned by `?tournamentId=`; the
  scorekeeper's clock pinned to the Championship's busiest game day. **Not listed, with the reason in
  the file:** the tournaments index, Team links and Org notifications are redirects; the billing mock
  portal 404s unless the mock is on; `/official` and `/official/score` redirect to the scorekeeper.
  Families is owner-only until granted, so the registrar is measured on house league instead.
- **Runner changes** (`scripts/check-layout-invariants.mjs`): the five Club fixture sessions and a
  new `plus-official` session (`tests/uat/auth.setup.ts`); the admin fixture resolved by name only when
  an admin entry runs (`resolveAdminContext` in `scripts/uat-fixture-context.mjs`); a per-entry
  pinned `clock`; the admin rail's groups seeded open; an admin entry must END where it was sent (the
  admin gates by redirect) and not on a refusal; every admin entry waits out its "Loading…" lines
  and its wordless busy markers; `--changed` split by side: the coach stylesheet and layout sweep
  coach + marketing, the admin frame files and volunteer parts sweep the admin, and the palette, the
  root layouts and the SHARED COMPONENT FOLDERS (coach kit, admin parts, help guide) sweep both,
  because /review found each side importing the other's parts (and slice 1 puts the admin on the
  kit). A kit change therefore sweeps ~215 screens: the honest price of the admin standing on it.
- **`/review` (2026-09-25, standard tier, 3 lenses, 10 findings, 7 fixed, 2 declined, 1 advisory
  noted):** the side split above (two High); a wordless loading state the wait could not see (the
  scorekeeper's dots, High); the picture check keeps every capture run so a set built by a full run
  plus `--only` re-captures names each run's tree (Medium); the contrast parser reads `:root` in a
  selector list (Medium); the club's tournament resolved by its seeded slug, not "the most recent"
  (Low); the permission refusal matched on visible text (Low); a latent reload path now waits out
  loading too. Declined: adding `.limit(1)` to the by-name lookups (a duplicate should fail loudly,
  as it does). Re-swept the loading-sensitive screens after the fixes: baseline unchanged.
- **Found in the runner itself:** the product's own 404 page ("ROUTE_NOT_FOUND") was never a landing
  failure — the list held Next's default wording, which this app replaced — so a screen that 404ed was
  measured as a pass. Now matched on VISIBLE text for every screen, coach included (the 404 page's
  markup rides in every page's inline data, so a raw-text match fails them all).
- **The dark baseline:** 364 screen-width pairs, all measured, none unmeasured. **6,946 findings, all
  recorded as unargued debt** (owner, 2026-09-25: reasons only where argued; none argued at slice 0):
  contrast 4,065 (82 screens — the faint whites), tap floor 2,332 (all 91), control width 386,
  content overflow 116 (20 screens), type ladder 44, control off-screen 3. By area: tournaments 2,393 ·
  rep teams 1,308 · accounting 912 · house league 727 · organization 622 · help 342 · families 200 ·
  hub 140 · volunteer 125 · public site 110 · frame menus 67. The 931 coach and marketing entries are
  byte-identical. ⚠ **Real defects the sweep surfaced, written down, not fixed here:** on a phone the
  tournament **Teams** screen has a button 149–178px past the right edge with no way to reach it, and
  Event settings' "Free" is 2px past it; 20 screens scroll sideways inside a box at phone width.
- **The identity check** (`scripts/admin-identity.mjs`, `npm run identity:admin -- before | after |
  compare`, `--only=<area or id>`, `--width=phone|desktop`): 182 pictures (390 and 1440), local only in
  `.admin-identity/` (git-ignored, ~22 MB a set); clock pinned; each screen shot until two shots agree;
  compare lists what differs by area, writes diff images, and prints the commits and working-tree
  changes between the two captures for attribution. **Proven quiet:** two full captures of the unchanged tree (00:14 and 00:23 UTC) → **182 of 182 pixel-identical**, every shot settled, none failed. (The first pair, before the two masks below, reported 3 — each attributed, none noise in the tool.)
- **Found by the quiet run:** the **Members list has no defined order** (its API selects with no
  ORDER BY), so two loads of the same unchanged screen drew its eight rows in two orders. Handed to
  Club Stage 1, which redesigns Members; the identity check masks the list until then (both the club
  and the tournament Members page, which re-exports it). The tournament dashboard's Registration trend
  line is bucketed by the SERVER against the real clock and moves at midnight UTC — masked as a live
  figure.
- **Contrast** (`tests/unit/warm-palette-contrast.test.ts`, run by `npm run check:contrast`): a new
  block holds the DARK palette on six measured admin grounds (page, navy panel, main, the event
  header's lime-washed top edge, the 5% and 8% white fills), reading the tokens from the real `:root`
  blocks. **Nine inks under AA, recorded as ratcheting debt:** the whites at 45 / 40 / 35 / 30 / 25 /
  20% (4.16 down to 1.77:1), `--danger` as text 3.81, `--info` 3.90, and **`--blueprint-blue` as
  text at 1.39:1** — the platform navy on near-black, 26 uses, never held by any check before. Slice 1
  adds the admin's warm grounds to the warm block.
- **Also noticed:** a `check:layout --changed` process from 2026-09-21 is still alive and idle on this
  machine (not this program's; left alone).

**Slice 1 — results (2026-09-25).** Quiet windows on the owner's word for both captures; the "before"
set (182 pictures) and the coach "before" sweeps were taken on the untouched tree.
- **The switch** (`lib/admin-kit-preview.ts`): never on the production branch, fail-closed — it may
  be on only on the local dev server and on the **staging** build (a production build whose
  `APP_BUILD_BRANCH`, copied by `amplify.yml` from Amplify's own `AWS_BRANCH`, is `dev`; the `master`
  build names `master`, and a build naming nothing is treated as production). **Owner, 2026-09-25:**
  the first version keyed it to "any production build", which locked staging out too; widened so the
  owner can test with real test accounts on the staging site. Off by default everywhere; on per
  browser through the door `/api/dev/admin-kit?on=1&next=/<org>/admin` (`?on=0` to turn off; 404 on
  the production branch before it reads anything). The admin layout reads the cookie on the
  server and, only when on, wraps the whole shell (providers, modals, install prompt) in a box-less
  marker carrying `data-coach-warm-enabled` + `data-admin-kit`, plus the portal's theme-colour meta.
  `AdminKitProvider` / `useAdminKit()` hands the answer to client components. **Guest shells are NOT
  wired** (a deliberate change from the prompt's point 2): R3's scorekeeper is fixed-warm, not the
  account marker, so slice 5 wires them with their palette; wiring now would add a cookie read to
  volunteer pages and change nothing.
- **Theme gaps:** the warm block gained `--white-25/-15/-4` (ladder neighbours) and `--black-20/-30/-40`
  (the warm fill → hairline → strong line; read only by admin sheets). **Declined, argued:** the
  `.card` recipe's `--highlight-top` / `--shadow` / `--shadow-sm` — the coach kit's door cards paint
  those same dark values on cream today, so remapping the shared block would restyle live coach
  screens (not a fix) and remapping admin-only would break continuity. "A dark shadow on cream" is a
  portal-wide design question for the owner. *(Ruled 2026-09-27 — "soften it", both portals: see
  "Slice 1's open questions — ruled" after the 4c results.)* **Coach reach, measured:** exactly two elements —
  the setup popover's "skipped" dot and the tryout-history stat separator, both previously the dark
  white on cream (invisible); the scoped coach sweep before/after is recorded below.
- **R1:** `[data-admin-kit]` puts the platform theme back over the org's `:root` brand
  (`--primary*`, `--border`, `--glow*`, `--on-primary`; two platform constants added at `:root`). The
  warm block still wins where it speaks (same element, higher specificity).
- **R2:** `[data-admin-kit] [data-public-preview]` restores every token the warm block and R1 change,
  by reference to `--pv-*` `:root` snapshots; the 16 warm CLASS rules in `globals.css` (buttons, card
  hover, native select and date controls) gained a zero-specificity
  `:where(:not([data-public-preview] *))` — the tournament preview's navy "Register" had turned lime
  without it. On: the tournament preview shell, the tournament branding theme preview, the
  new-tournament wizard's live preview. **Proof:** the preview's schedule page is pixel-identical
  with the switch on and off, account theme Warm, 1440 and 390.
- **F1:** the org card-style variants gained `:where(:not([data-admin-kit] .card), [data-public-preview] .card)`
  — zero specificity, a no-op with the switch off.
- **The frame:** the strip wears the coach strip's own stylesheet, with warm doors and the account
  menu's Appearance choice; the event header's kit form (eyebrow = org · dates, the name, the kit
  phase chip — red Live / olive Open / quiet otherwise — and the flip pill kept); `AdminKitRail`
  (one populated rail: Overview pinned, Programs, Organization, the program you are in open, the
  tournament rail restyled inside a tournament with Overview above it); `AdminKitBottomNav` (the club
  bar Overview + first three programs + More, the tournament bar unchanged in tabs, order, counts and
  strip, More as the coach sheet over the bar; imports `CoachesBottomNav.module.css`);
  `AdminKitProgramRow` (the phone "In <program>" row on a program's first screen); the coach shell's
  ground. One nav model for all three: `lib/admin-kit-nav.ts` + `useAdminKitNav`.
- **The page header (F3):** `AdminPageHeader` — the page's own header as `legacy` while off; on the
  kit an optional eyebrow, the h1, identity chips, actions and the `backTo` corner. No subtitle slot,
  no icon tile (as drawn).
- **Restyled end to end:** Families (worklist, family page, possible duplicates) and the Public site
  editor — kit layers scoped under `[data-admin-kit]`, legacy rules untouched.
- **F3 re-homings:** Families' count line → the list's lede (same words); the family page's
  "Guardian" → an identity chip, its "N current registrations · M past" → the Children card's head;
  Possible duplicates' framing sentence → the top of the list it frames, word for word; the Public
  site editor's "Edit your org's public-facing home page" → **not re-homed** (a description of the
  page, not a fact on it; its first card already says what it edits).
- **Word changes, each from a standing rule or the ratified drawing:** "Sign out" (not "Logout" —
  the 2026-09-01 one-name ruling), "Plan & billing" (not "Subscription" — the page's own name,
  drawn), sentence case on the tournament rail ("Event settings"), mixed-case phone tab labels.
- **Deliberately not as drawn (flagged to the owner):** More is the coaches portal's real full-width
  sheet, not the narrower popover drawn (the drawing's note says "as the coach sheet does"); the
  phone tab's active mark is the coach bar's pill and dot, not the drawn top line; the Families lens
  chips are the portal's real filter chip (body face), not the drawn mono chip; club screens keep the
  org band with its flip pill (the club drawings show no band — dropping it would drop the flip
  door, an action); rail rows are the coach rail's full-bleed rows, not the drawn inset rounded rows;
  a program row is a link that opens its group because you are in it (no separate toggle). **Held
  for Club Stage 1:** the Audit log and Notifications rows (their screens are Stage 1's), the
  plan-aware order and "Also on your plan", the per-program counts. **Omitted:** the house-league
  "Past seasons" row — today's rail links `/house-league/past`, which 404s.
- **Gates:** `scripts/check-public-tokens.mjs` gained `checkAdminKit` — strict, zero literal colour in
  any kit stylesheet or `[data-admin-kit]` rule (143 rules at slice 1; proven to fail on a planted
  literal). Unit guards: `admin-kit-switch-guard` (off in production, one place turns it on, public
  layouts never carry it), `admin-kit-guard` (island parity with the warm block + R1, every warm
  class rule stops at the island, F1), `admin-kit-nav` (no dead door, today's gates, one model for
  both navs). Contrast: the warm block holds a new ground, the chosen filter chip on paper (olive
  4.66:1 — its thinnest margin anywhere). Runner: `--theme=dark|warm`, `--dump=<file>`,
  `--admin-kit`.
- **Switch-on sweep of the slice's screens** (Families ×3, Public site, both frame menus, the
  tournament dashboard, Rep Teams; both themes): on the slice's own surfaces the kit adds **no**
  tap-floor finding (72 against the baseline's 99) and clears the 4 type-ladder findings; the
  remaining contrast findings sit in pages later slices restyle, plus two inherited below.
- **Found, written down, not fixed here:** (1) the legacy house-league rail's "Past Seasons" is a
  dead link (404) today; (2) the coaches portal's DARK phone bar misses AA on its inactive tab labels
  (white 40%) and More section labels (white 25%) — the admin kit inherits both by sharing the
  stylesheet, so one fix repairs both portals *(fixed 2026-09-27, owner "fix it" — see "Slice 1's open
  questions — ruled")*; (3) an org's chosen font reaches both portals (not in
  R1's list); (4) the coaches portal's DARK theme draws ~30 borders in the org's colour (`--border`
  is never re-declared by the dark gate) — the R1 leak inside the model; (5) the family page's cards
  spill at 361 today (a 300px card minimum), unchanged by the restyle; (6) with the switch on, the
  club hub's tile titles are unreadable in Warm — the hub is Club Stage 1's to rebuild.
- **`/simplify` (4 lenses, 2026-09-25):** fixed — the door uses `lib/safe-redirect.ts` (a
  `startsWith('/')` guard is bypassable by a smuggled TAB/CR); the Coaches Portal door and the tournament
  groups are built ONCE for both navs (`kit-tournament-groups.ts` — the rail role-filtered every
  group, the phone sheet only Setup); the kit frame is `next/dynamic` in `AdminChrome`, so its ~100KB
  source downloads only with the switch on (it rode every admin page, production included); a dead
  `.divider` rule. **Skipped, argued:** `AdminPageHeader` mirrors `CoachPageHeader` rather than
  reusing it — reusing it pulls the 16,700-line `coaches.module.css` into the admin, and the deeper fix
  (move the header rules into a shared module both portals render) re-orders the coach portal's CSS,
  so it is **a post-release unification item** (one header, one stylesheet, both portals); the
  `--pv-*` island stays in `globals.css` beside the warm block it mirrors (≈1KB compressed site-wide;
  the guard reads one file); the tests' repeated `walk()` (13 older copies) and two one-line helpers.
  **For slice 2:** it retires the shell's `.adminShell h1/h2` console overrides under the switch —
  then `AdminPageHeader`'s two-class-deep title rules can relax.
- **`/review` (high-risk tier, 4 lenses + main loop, 2026-09-25):** 9 raised → 3 fixed, 2 accepted, 4
  refuted. **Fixed:** (1) the nav hook imported `canOpenModule` from Club Stage 1's `lib/member-access.ts`,
  which is not committed — this commit would not have built alone; the hook now calls the committed
  pair the legacy rail calls (`hasCapability` + `hasModuleEntitlement`), and moves onto `canOpenModule`
  when Stage 1 lands. **Proven by typechecking HEAD + this slice's files alone** (a clean copy, no
  other session's work): tsc clean, the slice's 30 tests pass, the token gate green. (2) the house-
  league season list could be overwritten by a late answer for the org just left (the legacy rail's
  fetch has the same gap; the kit's copy is guarded). (3) the door's cookie is `secure` over HTTPS.
  **Accepted:** the door is a plain GET, so another page can flip a browser's preview (presentation
  only, dev/staging only — noted in the route); the branding preview's caption follows the account
  theme (it is the admin's words, not the public page's). **Refuted:** the five rail rows today's
  sidebar lacks (Budget, Budget vs. Actual, Payment requests, Assistant coaches, Shared library) are
  ratified B12 rows whose pages check the same capability as their program — same people, sooner
  (`lib/admin-kit-nav.ts` header now says so); the phone grid is the coach shell's (it has no phone
  variant); the warm block's new `--white-15/-4` reach no coach screen (every coach reader uses them
  only as a fallback behind an always-defined `--home-*`); the tournament groups' uniform role filter
  is today's rail's rule (the phone sheet's narrower filter was the drift). ⚠ **Handoff to Club Stage 1:**
  its D8 moves the legacy rail's "tournament-only" test onto the PLAN; the kit's copy in
  `useAdminKitNav` must move in the same commit (the hook says so).
  Gate: `verify:changed` 4,963/4,963 · typecheck clean (whole tree and the isolated copy) · lint 0
  errors · `check:layout --changed` **not run** — `globals.css` widens it to every screen on a shared
  dev server; the switch-off identity check (182/182) and both-theme coach sweeps stand in, and every
  change since them is kit-only (renders only with the switch on).
- **Identity check (switch off): 182 of 182 pixel-identical** — "before" 2026-09-26T01:21Z on the
  untouched tree, "after" 02:07Z after a dev-server restart and a sign-in refresh, both @ `eec5e115`
  with this slice's working tree between them. **Coach screens, scoped sweep (14 screens × 4 widths,
  the frame + kit + both theme-gap readers' neighbourhoods), before vs after:** Warm 97 → 97 findings,
  Dark 646 → 646, none gone, none new, every pair measured. (The Warm "before" already held 28
  findings beyond the coach baseline — other sessions' work, not this slice's; recorded, not touched.)


**Slice 2 — results (2026-09-26).** Two quiet windows on the owner's word (the "before" set and the
"after" set + switch-on sweeps). Scope agreed at the start (owner, 2026-09-26): **F2 in two layers** —
the shared parts now, each area's own stylesheets with its own slice (Rep Teams/Accounting 3,
Tournaments 4, Help 5); **the Hub is Club Stage 1's** except setup (every plan but a Club owner's) and
Notifications.
- **The console look stops at the kit.** All 26 of the admin shell's console overrides
  (`admin.module.css`: square flat buttons, 2px tags, mono lime h1/h2, the mono `.font-sans` and
  `.btn-sm` shims, square form fields and cards, lime `.text-primary`) carry
  `:where(:not([data-admin-kit] *))` — zero added specificity, so with the switch off each matches and
  weighs exactly as before; with it on the global recipes and the warm skin show through, as in the
  coaches portal. Guarded (`admin-kit-guard`: every override selector carries it, ≥24 exist).
  `AdminPageHeader`'s title is one class again (slice 1's two-deep workaround existed only to beat the
  h1 override).
- **The shared parts on the kit** (`app/globals.css`, after the badge family; every rule stops at a
  public preview — `:where(:not([data-public-preview] *))`, guarded): **buttons** are the portal's own
  button (body face, 14px, 650, 6px corner, no glow or lift — the portal's `.btnPrimary`/`.btnSecondary`
  recipe, 232 uses, not its 43 global-`.btn` uses in the display face); `.btn-data` (the admin's
  compact button) leaves the console face for the body face at 12px, as written; **the primary action is
  ink-on-lime in both themes** (dark joins warm, as drawn); `.btn-secondary` — never defined, 33 uses
  rendered as bare text — becomes the portal's secondary button on the kit only. **Tags** become the
  kit's chips (data face, token step, pill, a tint of their own hue, the portal's AA badge inks).
  **`.badge-primary` settled as the quiet chip**: every use names something (a year, a season, a role,
  "trial") — not a verdict — so it shares `.badge-neutral`'s chip and the org-tinted-wash-with-olive-text
  pairing (inventory §3) cannot arise. **Labels**: `.form-label` → the portal's field label (body face,
  12px, tertiary, small capitals kept); `.hud-label` → the kit eyebrow. **Cards**: 8px, no lift, no glow.
  **Tailwind's fixed palette** (`text-fl-text`, `text-data-gray`, `text-blueprint-blue`,
  `text-logic-lime`, the green/yellow/red chips, …) is hex, not tokens — the ones admin code uses are
  mapped to tokens under the kit (Organization overview, Coaches portal links, the hub's legacy door).
- **A themed scrim token** (`--home-scrim`, the Phase 0 gap): the coach bar's own two values, in the
  warm block and the dark gate; read only by the admin kit (no coach screen changes).
- **Hand-set inline colours:** `useKitStyle()` (`AdminKitProvider`) returns `kx(legacy, kit)` — the
  EXACT legacy object while the switch is off, the legacy style with a token patch while it is on; the
  patches live in `components/admin/kit/kit-inline.ts` (buttons, card, empty box, good box, chosen /
  option, chip tones, inks). Where a dark token equals a literal exactly, the literal became the token
  (`#60a5fa`→`--info-light`, `#4ade80`→`--success-light`, `#fbbf24`→`--warning-light`,
  `#f87171`→`--danger-light`) — pixel-identical off, theme-true on.
- **Restyled end to end:** House league (all 8 screens: seasons, a season, ledger, notifications,
  registrations incl. the registrar's view, schedule, standings, teams & draft — cards, chips, fields,
  switches, windows, the draft board, the schedule, the tables), setup (for every plan but a Club owner;
  the plan chooser's inside is the marketing pricing component and is not the admin's to restyle),
  Notifications (the admin frame; the feed body is the portal's own and already themed), Organization
  overview, the Venue library's cards and fields (Stage 1 had its header), Coaches portal links, the
  organization's Tournaments list and its windows, PDF settings, the billing mock portal.
- **F3 re-homings:** House league — the subtitle's organization name → the eyebrow ("all seasons" is
  the list itself). A season's Ledger / Standings — the breadcrumb → the eyebrow (still a link to House
  league) + the way up to the season (its name). Registrations / Schedule / Teams & draft — the season's
  name (the subtitle) → the way up, in the leading corner. Send notification — the "← Registrations" link
  → the header's way up (same door); "Email registrants for this season" → not re-homed (a description;
  the Recipients choice says it). Preview email — "To: {audience}" → the preview's first row (TO), where
  a reader looks for who an email is addressed to. Organization overview — no subtitle. Coaches portal
  links, Tournaments, PDF settings, Notifications — their description lines are **not re-homed**: each
  describes the page, not a fact on it, and the sections below say the same in their own words. The
  Tournaments slot count ("2 / 3 slots") stays with the action it limits. The setup page's welcome line
  is **kept** — a greeting in a centred welcome, not a page header (flagged to the owner).
- **Word casing only, from the kit:** kit headers are in sentence case ("House league", "Teams & draft",
  "Send notification", "PDF settings", "Coaches portal links"); body text and button labels untouched.
  The required-field asterisk is in the label's own ink on the kit (the portal-wide 2026-08-25 ruling —
  red means something went wrong).
- **Found and fixed on the kit only** (a legacy fix would change a switch-off pixel): the org
  Tournaments pool-names divider reads `--border-1`, an undefined token, so it has never drawn — the kit
  draws it. Registrations' row hover painted `--white-03`, which is the page's own paper on warm.
- **Found, written down, not fixed:** (1) the Rep Teams **program-year pages answer "not found"** for the
  rep club's current and past program years (they rendered at slice 1) — five identity screens could not
  be captured either side; a fixture or data change since slice 1, not this slice (Club Stage 1's
  sessions or a reseed); (2) the coaches portal's own notifications feed paints its filter-chip and
  segment grounds with fixed whites (invisible on cream) — the admin copy is fine because the feed body
  is shared and its INK is already semantic; the portal's grounds are the portal's to fix; (3)
  `--plan-badge-ok` in setup's stylesheet is defined and never read.
- **Deliberately not as drawn (flagged):** button radius is the portal's real 6px and height its real
  padding, not the drawing's 9px/40px (slice 1's rule: the real portal over the drawing); field labels
  are the portal's real small-capitals label, not the drawing's sentence-case label; House league's
  "Completed" season is the quiet chip (a finished season is not a verdict; its purple had no token);
  practices wear the portal's own practice colour.
- **Gates:** `scripts/check-public-tokens.mjs` gained `checkRestyledAreas` — every colour literal
  (white/black alphas and one-off tints included, which the older ratchets skip) in a restyled area's
  files may only go down: slice 1's Families + Public site and slice 2's areas, 16 files, 187 legacy
  literals held (`scripts/.admin-restyled-baseline.json`; proven to fail on a planted literal). The
  strict kit check now holds 659 kit rules. Unit: `admin-kit-guard` rules 4 and 5.
- **Verification:** **Identity (switch off): 166 of 172 pictures pixel-identical**; the 6 that differ are
  live data from another session's walk during the window (a new tryout application → the hub's "Needs
  attention" panel ×3 desktop screens and a "Pending 1" stat on Rep Teams; the Families counts ×2) —
  styling identical in each (diff images read); 10 not compared = the five Rep Teams program-year screens,
  which 404 today. The screens touched after the full capture were retaken: 24 of 24 identical. The
  "before" set was built in five passes and the "after" in four, each on a freshly restarted dev server —
  a single 86-screen capture trips the 1.5 GB memory floor after ~35–40 screens on this machine. **Switch-on
  sweep** (16 slice screens + three global-reach samples, 361/390/768/1440): **Warm** — contrast 916 → 106,
  tap floor 418 → 379, control width 81 → 69, overflow 21 → 21, type ladder 12 → 12 against the switch-off
  dark baseline, and **no screen-width-rule group worse**; the last two warm findings in this slice's
  screens (the Venue library empty-state heading — the global `.empty-state` inherits `--white-30`, a
  hairline on cream — and the help callout's link) → the first fixed in the kit layer, the second is the
  help guide's palette (slice 5). **Dark** — contrast 916 → 572 overall; on this slice's own screens,
  after moving the faint dark-ramp greys used as text (`--white-30…45`, ~3.8:1 on the kit's pitch-black
  ground) to the tertiary ink, **182 contrast findings remain and 174 are the phone bar's inactive labels**
  (the shared coach bar, slice 1's open question) + 8 the help tooltip button (slice 5). The dark groups
  that are worse than the baseline are all outside this slice's restyle: the phone bar, and Rep Teams /
  Accounting legacy greys now on the kit's darker ground (slice 3). Gate: typecheck clean, lint 0 errors,
  `verify:changed` green, unit 5,042/5,042, token gate green (659 kit rules, 187 restyled legacy literals held).
- **`/simplify` (4 lenses, 2026-09-26):** fixed — one `useKitButtons` hook for the pages' three hand-set
  buttons (House league schedule + teams had each built it inline); status tags swap onto the global
  `.badge-*` classes instead of an inline chip patch (`KIT_CHIP` removed); `KIT_INK.asterisk`; org
  Tournaments on `kx` like every other page; per-row inline styles hoisted out of render (registrations,
  standings); Club Stage 1's `KitDialog` scrim onto the new `--home-scrim` token instead of its own
  warm override; the gate's two exemption checks into one `exemptAt`, one `COLOR_LITERAL` pattern, and the
  restyled-area ratchet held **by value** (a count alone let one literal be swapped for a new one —
  proven to catch it). Declined: one shared kit stylesheet across the area modules (the release slice's
  unification — moving rules between sheets now risks bundle-order changes switch-off), remapping the faint
  dark-ramp tokens at token level (reaches every legacy screen), and a Tailwind config change (same reach).
- **`/review` (standard tier, 3 lenses, 2026-09-26):** switch-off identity + page logic — none; the global
  layer's reach (coaches portal, public previews, switch-off) — none; the build check + guard test — **2
  fixed**: the strict kit check read a selector as kit by *substring*, so the legacy exclusion
  `:where(:not([data-admin-kit] *))` swept the 19 console-look rules it fences off into the zero-literal
  kit check (passing only because none held a literal yet — kit rules 678 → 659 once read correctly), and
  the restyled ratchet counted `#fff` and `#ffffff` as different colours (short hex now written long).
  Advisory, not fixed: the ratchet does not count the bare keywords `white`/`black` (the strict kit check
  does; the ratchet's scope is literals with a value), and `.test.ts`/`.d.ts` would be walked if one ever
  lands in a restyled directory (none does). check:layout `--changed` not run — globals.css widens it to
  every screen; the identity capture and the switch-on sweep above stand in.

**Slice 3 — results (2026-09-27).** Two quiet windows on the owner's word (the "before" set; the "after"
set + switch-on sweeps). All 23 Rep Teams + Accounting entries (17 + 6, the treasurer's Accounting
included), both themes, 92 screen-widths each.
- **Found at the start — slice 2's "Rep Teams program-year pages answer not found" was the DEV SERVER, not
  data.** Its page-building worker had crashed ("Jest worker encountered 2 child process exceptions"), so
  every admin route with an id in its path returned 500 while flat routes loaded. The 15U AAA seasons and
  their API were intact. A full restart cleared it; all five season screens were pictured and swept.
- **The kit layers:** the four area stylesheets (`accounting.module.css`, `budget/budget.module.css`,
  `budget-vs-actual/bva.module.css`, `rep-teams/rep-teams.module.css` — which also dresses Accounting's
  "Allocate to teams") gain their `[data-admin-kit]` layer, the slice 2 recipes by value: kit card,
  eyebrow, chips, the table standard's ground, the portal's field, tab bar (`CoachTabBar`), window and
  buttons. The navy the legacy rules use as TEXT (1.39:1 on the Dark ground) is olive on the kit.
  Strict kit check: 659 → 878 kit rules, no literal colour. The shared `components/accounting` parts were
  NOT restyled: they are the coaches portal's too, already on its `--home-*` tokens, so they render in the
  admin kit exactly as in the portal (continuity by construction).
- **F4, the money tables, as ADC specimen 5:** same columns, actions and order. Amounts right-aligned in
  even-width digits through a kit-only `.num` class (no legacy rule, so switch-off unchanged): the ledger's
  Amount, the allocations list's Total / Collected / Outstanding, an allocation's installment Amount,
  payment-request history (Budget and Budget vs. Actual were already right-aligned). Chips as drawn:
  Income and Posted green, Expense and Pending amber, a transfer blue, Void quiet; the old violet accent
  retired. **A void row is struck through as well as tagged** — the legacy rule meant to do it never
  matched (the cell names `className="entryDesc"` as a plain string, which a module rule cannot reach);
  reached on the kit only through `:global(.entryDesc)`, since fixing the legacy class changes a
  switch-off pixel.
- **Chips, Rep Teams:** a group, a draft / finished / archived season and an assistant are the quiet chip
  (a finished season is not a verdict — House league's the same); a division, a head coach, an offer and
  a document type the blue identity chip; live green; pending review amber. The allocation page borrows
  "completed" for an OVERDUE installment — on the kit it gets its own `.badgeOverdue` (amber, the legacy
  hue). Payment requests' hand-set tags move onto the admin's `.badge-*`: pending amber, approved green,
  denied red (a verdict); "Pay Org" amber (money going out — the ledger's expense chip), "Request from
  Org" green. Approve / Deny become the portal's primary and danger buttons.
- **Hand-set inline colours:** 115 → 30 colour literals in the areas' TSX. Byte-equal literals became
  the token (`#4ade80` → `--success-light`, `#f87171` → `--danger-light`, `#fbbf24` → `--warning-light`,
  `#22c55e` / `#ef4444` / `#f59e0b` → `--success` / `--danger` / `--warning`) — pixel-identical off,
  theme-true on (the warm inks clear ~6:1 on white). The schedule's event hues wear the portal's `--evt-*`
  on the kit (`EVENT_TOKENS`; the hex map stays for the legacy pill, which appends an alpha). The dark
  ramp's faint inks as TEXT (`--white-30…45`, ~3.8:1 on the kit's Dark ground, a hairline in Warm) take
  `KIT_INK.tertiary` through `kx`. New patches in `kit-inline.ts`: `KIT_SURFACE.alert` / `.door`,
  `KIT_STEP` (the two allocation steppers). The 275 legacy stylesheet literals stay until the release
  slice deletes the legacy rules.
- **F3 re-homings (every subtitle in both areas):** Rep Teams hub — "N of M teams" → beside the Teams
  heading; the connected-families line → word for word under it; the organization → the eyebrow ("all
  teams", said only to an uncapped club, describes the list and is not re-homed). A team — sport and
  division → chips beside its name (the colour swatch too); its description → the top of the body. A
  season — its team → the way up; a season's Coaches / Schedule / Tryouts — the season → the way up, the
  team → the eyebrow. A finished season — team → the eyebrow, status → a chip, the year → a chip only
  where the season's name does not already carry it; "Read-only archive" stays at the header's end. A
  team's History — the team → the way up. An allocation — "Created {date}" → the top of the body.
  Assistant coaches — the framing sentence ("Oversight across your teams…") → the top of the body, word
  for word. Allocate to teams — the line and total are NOT re-homed: the Budget Line card directly below
  states both. Budget vs. Actual — "{year} season" is not re-homed: the season picker directly below says
  it. Not re-homed as descriptions: "all ledgers", "season planning", "shared expenses split across
  teams", "completed and archived program years", "inbound team payment requests", "Split a shared
  expense across teams", "Tags, award types & drills every team can use".
- **The eyebrow and the way up, one rule for both areas:** a program's home page — the eyebrow is the
  organization. Every other page — "{Program} · {organization}", the program a link back (ADC specimen 5
  draws the ledger's that way). A page inside a team or a season — the way up is the page above it and
  the eyebrow names the team, so the eyebrow plus the way up always spell the path. A legacy "← Rep
  Teams" back link becomes the eyebrow's link (the same door) rather than a second one. ⚠ Slice 2's House
  league sub-pages carry the program alone — unify at the release slice.
- **Words, casing only:** kit titles in sentence case ("Accounting overview", "Org budget", "Allocate to
  teams", "Cost allocations", "New cost allocation", "Document templates", "Payment requests", "Past
  seasons", "Rename team URLs"); "Rep Teams" and "Budget vs. Actual" keep the rail's and the PDF's one
  spelling. Button labels untouched (slice 2's rule).
- **Deliberately not as drawn (flagged to the owner at the start):** the ledger's Export / Add Entry /
  Add Transfer stay above the table where they are today — specimen 5's header actions followed a
  "before" that drew them there; amounts keep their + / − signs and their green / red (the drawing's
  plain amounts would change what the screen says).
- **Identity (switch off):** "before" 2026-09-27T01:22Z on the untouched tree after a full dev restart;
  "after" 12:2xZ after a second restart — **45 of 46 pixel-identical**; the 46th (Rep Teams hub, desktop)
  differs only in the Upcoming Bills panel's day counts ("56d overdue" → "57d"): the SERVER counts days on
  its real clock, which the pinned page clock cannot reach, and midnight passed between the captures.
  **Mask added** (`identityMask` on `admin-rep-teams`: the panel's rows, lane counts and overdue pill;
  its frame stays checked) and proven quiet by a back-to-back before/after (2/2). After the reminder-row
  fix, the Accounting overview (owner + treasurer) was retaken: phone identical; desktop 120px shorter —
  the "Tournaments without a ledger" row for the club's Invitational is gone because the cancellation
  below archived that tournament; every other pixel identical.
- **Switch-on sweep vs the switch-off dark baseline (23 screens, 92 pairs each, none unmeasured).**
  Baseline: contrast 1,594 · tap floor 538 · control width 43 · overflow 21 · type ladder 24. **Warm:
  contrast 0**, tap floor 490, control width 49, overflow 23, type ladder 8. **Dark: contrast 354**, tap
  floor 490, control width 49, overflow 23, type ladder 8. The Dark remainder is none of this slice's:
  270 the shared phone bar's inactive labels (slice 1's open question), 60 the coaches portal's Upcoming
  Bills panel (below), 24 the help "?" buttons (slice 5). Every "worse" screen × rule group was re-swept
  with the switch OFF and shows the same findings there — the fixture gained staff, shared tags, tryout
  applicants, team budget items and a payment request since slice 0 — so none is the kit's.
  **Fixed from the sweep:** (1) the Accounting overview's reminder rows spilled 16px at 361 on the kit
  only (the body-face buttons are ~35px wider than the condensed console face; the row had 2px spare) —
  the row wraps on the kit, the buttons drop below the description on a phone; (2) blue identity chips
  measured 4.40:1 in Dark — the ink is `--info-light` (Warm: the same `--home-blue`), also on the global
  kit `.badge-info` (slice 2's, which can sit on a card); (3) the danger button's red measured 4.41:1 in
  Dark — `KIT_BUTTON.danger` ink is `--danger-light` (Warm: the same `--home-live`). (2) and (3) lift Dark
  on slice 2's screens too; Warm is byte-identical. Warm re-swept on the 8 touched screens: contrast 0,
  overflow 11 → 8, nothing else moved.
- **An interruption in window 2, attributed:** at 12:25:26Z the test club's plan was CANCELLED through
  Plan & billing by the club-owner test account — a hand-driven Organization → Plan & billing → cancel
  preview → Confirm cancellation on this dev server, interleaved with the sweep (the sweep only loads
  pages). The owner restored it (now `club_large` on a Stripe test subscription). ⚠ **Found, for the
  billing work, not fixed here:** after the re-subscription `billing_suspended_at` is still set (pages load
  regardless) and the club's Invitational stays archived (the retained-tournament restore did not run on
  this path).
- **Found, written down, not fixed:** (1) the coaches portal's Upcoming Bills panel (shared, rendered on
  the Rep Teams hub) misses AA in Dark — `--home-dim` (45% white) at 4.48:1 on its card, and its active
  day tab and "Review queue →" in the platform navy at 1.61 / 1.71:1 — the same in the portal's own Dark
  theme; one fix repairs both; (2) the data growth above leaves real phone findings in both themes and
  switch-off (27px "Remove" / "Publish to all teams", 24×30px library Rename / Delete, a payment-request
  card spilling 16px at 361, the tryout table's off-ladder cell sizes) — pre-existing styling on new data;
  (3) pre-existing lint in these pages (unused `orgParam`, a component defined during render in Document
  templates, unescaped quotes) left alone.
- **Gates:** the restyled-area ratchet now holds Rep Teams + Accounting (`RESTYLED_DIRS`; 59 files, 490
  legacy literals held by value — the baseline change is additive only); strict kit check 878 rules;
  typecheck clean; lint 0 errors on the 26 slice files; `verify:changed` green; unit 5,042 / 5,042.
- **`/simplify` (4 lenses, 2026-09-27):** fixed —
  - **The eyebrow's "way up" is one `crumbs` prop on `AdminPageHeader`:** `{ href?, label }` items joined
    by " · "; a falsy item drops out. Every page had built the same link-plus-org fragment by hand, with
    its own `.kitCrumb` rule; those rules are gone from all five area sheets, House league's included.
  - **One `useKitAsterisk()`** replaces the inline asterisk patch on nine pages, House league's two
    among them. Its legacy ink is `var(--danger-light)`, byte-equal to the `#f87171` it replaces, so
    the ratchet dropped two held literals (487).
  - **The schedule imports the portal's `EVENT_COLORS`** instead of keeping its own copy.
  - **Row-invariant `kx(...)` calls are hoisted out of `.map()` loops** on 11 pages.
  - **Assistant coaches' `panelStyle()` builder is two constants.**
  - **Dead code removed:** Budget's dead kit selectors, and imports the change left unused.
  - **The blue-ink reason is written once,** on the global `.badge-info` rule.

  Declined:
  - **A `composes: from global` chip:** it would put the legacy `.badge` rules on the switch-off pixels.
  - **A shared hook for the two allocation wizards' `dimInk` / `reviewHead`:** they are page-local
    duplicates that predate the slice.
  - **Splitting `.categoryGroupLabel`:** cosmetic only.
  - **Per-sheet `.num`:** it follows the per-sheet convention.

  Gates re-run green: typecheck, lint (0 errors, no new warnings), the token gate, CSS selectors, CSS
  purity, spelling, and unit 5,042 / 5,042.
- **`/review` (Standard tier, 2 lenses — correctness, regression / blast radius, 2026-09-27):** 3
  findings, 1 fixed, 0 refuted; none reached Stage 4 (none High, none uncertain).
  - **Fixed (Low):** Document templates' kit crumb could point at `/undefined/admin/rep-teams` in the
    moment before the club loads (the page has no loading guard). The crumb is plain text until then.
    The legacy "← Rep Teams" link has the same flaw from before this slice and is left alone, because
    fixing it changes the switch-off markup.
  - **Confirmed as intended, now named screen by screen for the slice 6 walk (Medium, kit-on only):**
    - **The danger button's lighter red** reaches House league's registrations, schedule and teams.
    - **The blue chip's lighter ink** reaches Organization → Members (the role chips) and the tournament
      dashboard (the deposit-paid count).
    - Both are the Dark contrast fixes above, and Warm is byte-identical. No kit-on picture gate exists
      yet; the slice 6 walk is where they are seen.
  - **Dropped (Advisory):** the crumbs' index keys (static lists of one to three items).
  - **Not re-run after `/simplify`:** the switch-off identity and the switch-on sweep, because they need
    a quiet window. Two things change in what the screens send:
    - **The one switch-off change:** House league's two required-field asterisks write their colour as
      `var(--danger-light)`, byte-equal to the `#f87171` they replaced.
    - **The kit's crumbs** are the same link in the same place, now styled by the shared header.

**Slice 4a — results (2026-09-27).** Two quiet windows on the owner's word. The split above was written
first; the owner answered the start message with "the window is quiet". Four page agents built the page
bodies in parallel against one brief; every diff was reviewed in the main loop.
- **Found at the start:** the dev server's page worker had crashed again ("Jest worker encountered 2 child
  process exceptions", plus a stream of `write EPIPE` — its terminal pipe was gone), so the first "before"
  capture hung on its first screen. A full restart inside the window cleared it; the "before" set was
  retaken whole (58 pictures, none failed). ⚠ The dev server now runs from the slice's own session.
- **The shared parts** (they reach 4b/4c's screens too, so they were decided once, here):
  - `TournamentAdminHeader` on the kit is `AdminPageHeader` as ADC specimen 2 draws a tournament page: the
    **eyebrow is the tournament's name, plain text** (`useTournamentCrumb()`, one home), the page's name in
    sentence case (`kitTitle`), the page's own actions and "?" (named after the title on screen), the
    read-only banner as a kit amber notice under it, no icon tile, no subtitle. The Schedule's `meta`
    ("Published") becomes a state chip beside the title.
  - `TournamentAdminUI.module.css` (toolbar, fields, segmented control, menus, selection bar, upsell,
    legend), `admin-common.module.css` (the tournament list: controls bar, filter chips, table standard,
    division and pool headings, the opened row, the row menu), `ExportMenu.module.css` (the portal's
    popover — reaches the export menu on Rep Teams, Accounting, House league and Members too, which the
    earlier slices had left in the console look), `CollapsibleCard.module.css` (the kit card).
  - `app/globals.css`: the admin's **plain window** (`.modal*`) and **form fields** (`.form-input` /
    `.form-select` / `.form-textarea`) on the kit, written at the marker's ZERO weight
    (`:where([data-admin-kit]) …`) so they beat only the legacy rules and never a page's own skin —
    `FeedbackModal`'s portal dialog carries both `modal` and its own `.dialog` skin and keeps the skin.
    The fields: card ground, strong hairline, 7px, olive focus in place of the platform blue glow,
    tertiary placeholder (`--white-30` is a hairline in Warm).
- **Restyled end to end** (kit layers in each sheet, inline colours through `kx`): Settings & access (the
  portal's door cards), Event settings, Divisions (the fill board keeps filling / almost / full), Venues
  (the Organization venue library's kit layer already covered every coloured class), Rules & resources
  (its styled-jsx global block untouched; the whole kit layer is a new `rules-kit.module.css` hung off a
  local `.rulesKit` class that joins the root ONLY while the switch is on), Public site (chrome only — the
  colour swatches, the app-icon tile and its background chips, the font samples and the light/dark preview
  island are the organization's and untouched; the card-style thumbnails, drawn in white alphas for a dark
  ground, are redrawn as token icons of each style), Registration questions, Notification preferences
  (the kit switch — olive when on, Club Stage 1's drawn switch), Archives, Post-event summary, Data tools,
  the new-tournament wizard and its style cards (the same recipes as the setup wizard's slice 2 layer —
  the two share a class vocabulary), and the tie-breaker editor.
- **F3 re-homings.** Every tournament subtitle that was the tournament's name → the eyebrow. Not re-homed,
  as descriptions of the page: Public site's "logo, colors, pages, and advanced styling", Data tools',
  Divisions', Teams', Venues' and Rules' description lines, Event settings' "identity, dates & status",
  Registration questions' "collect tournament-specific team details", Settings & access's two lines,
  Notifications' "Mute notifications for…", Archives' "Sealed records and archived tournaments pending a
  snapshot", the summary's "recap". Not re-homed because the event header directly above states it: the
  year after the name (Results, Schedule) and the summary's date range (the same tournament start/end
  columns). **Re-homed, word for word, kit-only:** Registration questions (upsell variant) "Every
  registration already collects team name, coach, email, and division." → the first line of the card it
  frames; Notifications "Personal to your account." → the opening words of "Want push on, or a channel
  changed?…"; Archives (a plan that cannot seal) "Archived tournaments are available on free; permanent
  sealed records require Tournament Plus or higher" → the top of the body; the summary's success header
  "{new} now starts from {source}" → the first line of the success section; the Schedule's "Published" →
  a chip beside the title. The "Game Day" / "Tournament Admin" eyebrows (rail-group names, not facts) give
  way to the tournament's name, as drawn.
- **Deliberately not as drawn / decided at build time (flag to the owner):** (1) the tournament eyebrow
  is plain text — it first shipped as a link to the dashboard (slice 3's crumb rule), and the sweep
  measured it at 14px tall, under the tap floor on every tournament screen at 361/390/768; the drawing
  shows plain text and the dashboard is the rail's and the phone bar's first row; (2) Archives lists every
  archived tournament of the organization, so its eyebrow is the organization's name; (3) a chosen filter
  chip is the portal's own chosen filter chip (`rgba(--logic-lime-rgb, .16)` + olive, as Families and the
  portal's lineup / tag chips), and each status keeps its colour in the dot — a filter is a choice, not a
  verdict; (4) the champion chip and badge are a solid ink-on-lime highlight, not a tinted verdict chip;
  (5) Registration questions' back link becomes the kit header's `backTo` (same door, same words).
- **Identity (switch off):** "before" 2026-09-27T15:51Z (tournaments + the organization's Tournaments list
  + setup, 58 pictures) on the untouched tree after the restart; "after" 16:50Z after a second restart —
  **58 of 58 pixel-identical**. Branding, Settings and Divisions retaken after the sweep fixes: 6 of 6.
  The shared field / window / export-menu rules reach other areas only with the switch on — the widened
  gate proves every global kit rule carries `[data-admin-kit]` (slice 3's precedent: picture your areas).
- **Switch-on sweep** (21 screens × 361/390/768/1440: the 11 restyled, the 5 operations screens whose
  header changed, and 5 earlier screens the shared field / window rules reach), against the switch-off
  dark baseline — contrast 773 → **Warm 91 / Dark 393**; tap floor 754 → 735 / 690; overflow 28 → 23;
  type ladder 4 → 4; control width 201 → 202. **This slice's own screens: Warm 0 contrast; Dark only the
  shared phone bar's inactive labels** (slice 1's open question). The rest: the Teams and Schedule bodies
  (4b/4c — 142 + 30 in Dark) and Coaches portal links' help-callout link (slice 5). **Fixed from the
  sweep:** the eyebrow link (above); the chosen swatch's tick (`--white` is the warm INK — 1.59:1 on the
  navy preset → `--white-fixed`, today's white in both themes); the island's "Preview" caption (4.45:1 in
  Dark → `--home-ink-soft`). Re-swept: Warm 0 contrast, Dark phone bar only, tap floor back to baseline.
  **Worse groups, attributed:** Organization → Tournaments control width +1 = the archived Invitational's
  Delete button (present switch-off too, proven by a switch-off sweep — the slice 3 cancellation);
  Coaches portal links' Dark contrast = the phone bar, identical to slice 2's own sweep.
- **Gates:** `checkAdminKit` now also reads `app/globals.css` — the kit's shared parts (R1, the island,
  buttons, chips, windows, fields) had never been checked for literals (in no scope's dirs); 1,308 → 1,354
  kit rules, a planted literal proven caught. The restyled ratchet gained the slice's 9 directories and 9
  shared files (627 legacy literals held; the baseline change is additive — no existing entry moved). The
  guard (`admin-kit-guard`) now sees the zero-weight `:where([data-admin-kit])` form and indented rules,
  and requires the public-preview exclusion on the rule's SUBJECT (the element it styles), not anywhere in
  the selector — three rules only excluded their ancestor (slice 2's `.empty-state … h3` and this slice's
  window `h3` / `p`), all fixed. `kit-inline.ts` gained `KIT_INK.danger/.success/.warning` (the light
  tier) and `KIT_SURFACE.menu`. Unit 5,042/5,042 · typecheck clean · lint 0 errors · `verify:changed` green.
- **`/simplify` (4 lenses):** fixed — one `useTournamentCrumb()` for six hand-built crumbs; the new
  `KIT_INK` states and `KIT_SURFACE.menu` used where patches were hand-typed; the Rules error box on
  `KIT_SURFACE.alert`; Divisions on `KIT_LINE` and one hint style for seven copies; the wizard's patch
  constants hold only the patch; row-invariant `kx(...)` hoisted out of `.map()` (Archives, the wizard's
  venue search, Registration questions); the shared header builds its legacy markup only when it renders
  it; the two champion rules merged. Declined: the filter-chip colour (it is the portal's); the heavier
  `[data-admin-kit] .modal` weight (it would TIE with the portal dialog's skin and leave the winner to CSS
  load order); one shared wizard stylesheet (the two modules' class names are hashed per file — sharing
  needs markup or `composes`, a switch-off change → the release slice); a shared `.kitLede` class and a
  two-line duplicate const.
- **`/review` (standard tier, 3 lenses — switch-off identity + logic, blast radius + R2, gate contract):**
  7 findings, 0 refuted. **Fixed:** (Medium) Rules' `.rulesKit` anchor rendered in both states — no pixel,
  but not today's markup → now switch-gated; (Medium, latent) the three subject-less exclusions above +
  the guard's blind spot; (Low) the "?" was named after the title-case title while the kit showed sentence
  case; (Advisory) the guard's column-0 anchor. **Accepted:** the Schedule's "Published" chip wears its
  legacy styling in the kit header until 4c; `transparent` is not refused by the kit literal check (not a
  colour that drifts). `check:layout --changed` not run (globals.css widens it to every screen) — the
  identity check and the both-theme sweep stand in.
- **Found, written down, not fixed:** (1) the slice 3 crumb links (Rep Teams, Accounting, House league's
  way up) are the same sub-floor link on a phone — unify at the release slice; (2) the wizard's upgrade
  notice uses `alert alert-warning`, classes that exist nowhere (an unstyled div today, switch on or off);
  (3) dead CSS left alone: Data tools (the old tool-card layout), Settings & access (`.actionCard`,
  `.comingSoonCard`, `.cardAction`), Notifications (the removed channel block); (4) `{ color:
  'var(--danger-light)' }` is hand-typed ~50 times in earlier slices — adopt `KIT_INK.danger` as those
  files are touched; (5) the kit's `.kitLede` (a re-homed fact at the top of a body) is written three
  times — a shared recipe at the release slice.
- **For 4b and 4c:** the header, the toolbar / menus / legend, the tournament list sheet (filter chips,
  table, group headings), the export menu, the plain window and the form fields are ALREADY on the kit —
  4b/4c restyle only the page bodies and their own sheets (`dashboard.module.css`,
  `teams-admin.module.css`, `results-admin.module.css`, `check-in` + `CheckInBoard`, `staff-kit`,
  `communication`, `chat-admin`; 4c `schedule-admin.module.css`, `ScheduleTimeline`, `BracketBuilder` and
  the schedule windows) and add their directories to `RESTYLED_DIRS`. The dashboard's own header
  (`AdminEventHeader` + page) and the Schedule's "Published" chip are theirs.

**Slice 4b — results (2026-09-27).** One quiet window on the owner's word ("Quiet — go ahead"), covering
the "before" set, the build, the "after" set and the switch-on sweeps. The dev server was restarted
fresh from this session at the start (it held 3.7 GB after 4a's sweeps) and again before the "after" set.
- **Scope, corrected from the code at the start** (the ledger line had been written from the plan, not
  the code):
  - **The coin toss is not Results'.** `CoinTossRecorder` renders only in the PUBLIC standings
    (`components/public/StandingsContent`) and the admin's preview of it — R2, the organization's
    colours. Out of slice 4.
  - **Results' "context strip" is the phone bar's strip** (`AdminContextStrip`), already on the kit
    since slice 1.
  - **The game list moved from 4c into 4b** (owner, at the start: "Move it to 4b"). Results' body IS
    `schedule/components/GameList.tsx` in `mode="scoring"`, styled from the schedule's sheet, so game day
    is finished in one slice. 4b wrote the game list's kit block at the end of
    `schedule-admin.module.css` (only the classes `GameList.tsx` reads, both modes, since the Schedule's
    list view is the same component); **4c restyles the rest of that sheet** — the schedule page,
    timeline, brackets, generator, playoff wizard, the shift-day / resolve-locations / field-picker
    windows, the health panel, the zero-venue prompt. `TournamentFieldPicker` stays 4c's (scoring mode
    never renders it).
  - **Chat's conversation panel is the coaches portal's own** (`ChatPanel`, whose warm rules key on
    `html[data-user-theme="warm"] [data-coach-warm-enabled]` — the admin marker carries that attribute,
    so it wears the portal look already). 4b restyled only the three admin-only parts (rooms list, manage
    panel, new-room window — imported by nothing but the admin chat page).
  - **The check-in board is shared with the volunteer gate**; every rule is kit-scoped, and the gate is
    in the identity set to prove it untouched. The gate's own palette is slice 5's.
  - The Teams import windows open from Data tools (4a's screen) and were still 4b's.
- **Built by five parallel page builders against one shared brief** (dashboard · Teams + import windows
  · Results + game list · Communication + Chat · Check-in + Staff kit), each diff reviewed in the main
  loop. Two mechanical audits were written during the review and run over every 4b sheet (kept in
  `.probe/`, not the repo — candidates for the release slice's gate):
  - **A kit base rule shadows a legacy STATE rule of equal weight.** `[data-admin-kit] .x` weighs
    (0,2,0), the same as a legacy `.x[data-status=…]` / `.x.active` / `.x:hover`, and comes later, so
    it silently wipes the state colour; a `border-color` shorthand also wipes a `border-left-color`
    stripe. **Caught on the check-in board** (the checked-in / no-show row stripe vanished on the kit) —
    fixed by restating the stripe after the base rule; the builders were told mid-flight and every sheet
    was audited after.
  - **A kit `background:` shorthand resets `background-image`.** **Caught on Teams**: the transfer and
    per-row pool pickers draw their arrow as a data-URI image (`appearance: none`), and the kit's
    `background:` wiped it — a dropdown with no arrow. Fixed with `background-color` plus the chevron
    redrawn from two `currentColor` gradients at the legacy arrow's place (the legacy arrow is a fixed
    white / lime / red image an SVG stroke cannot re-theme).
  - Also fixed in review: the check-in sheet's "Add roster" was made a solid ink-on-lime button, giving
    the sheet two primaries; legacy is a lime TINT, so on the kit it is the olive accent.
- **Restyled end to end** (kit layers; inline colours through `kx`): the dashboard in both frames (stat
  tiles, game-day tiles, gauges, checklist, attention panels, coin-toss and reuse prompts, Customize
  mode, the guidance rail, the persona panel, the live feed, the four confirm windows' scrims → 
  `--home-scrim`, the sparkline's stroke → olive through a stylesheet rule — an SVG presentation
  attribute loses to any rule), Teams (rows, status and payment chips, the expanded detail, capacity and
  health panels, waitlist, slot board, bulk bar, the phone settings sheet, the rep-link picker, both
  import windows), Results (the phone settings sheet and summary strip) and the game list in both modes
  (date line, matchup, score steppers and inputs, action bar, forfeit, status and live chips, conflict
  badges and banner, the inline edit form), Check-in (gauges, toolbar, rows, the detail sheet, roster
  editor), Staff kit, Communication (result banners, compose window's channels / templates / divisions,
  the history tables and tabs, the email detail and recipients windows) and Chat's admin chrome.
- **F3.** The dashboard's own header → `AdminPageHeader`: eyebrow = the organization (a tournament's
  home page), title = the tournament's name (words unchanged), the status + "game day / registration"
  label → a state chip beside the title (same words, toned like the event header's phase chip —
  `resolvePhase`; desktop-only as today), Customize → the header's action. **Not re-homed:** the
  dashboard's date line (the event header directly above prints the same `startDate`/`endDate` —
  verified), Communication's "Post updates to your site, email your teams, or both — from one place."
  and Teams' "Manage all teams and signups in one place" (descriptions of the page). Check-in's and Staff
  kit's subtitle is the tournament's name (→ the eyebrow, 4a's shared header); its "Select a tournament"
  fallback is restated by each page's own empty state. Chat draws no header.
- **Decided at build time / not as drawn (flag to the owner):**
  1. **Finalize** is the kit's primary (ink-on-lime) where it was a green `btn-success` — a
     switch-gated class, the one primary action of a submitted-score row.
  2. **Revert score and Forfeit move from amber to the kit's danger red** (they erase a recorded
     result); **Cancel game stays amber** (Reinstate undoes it).
  3. **The game list's team names** leave the console mono face for the body face, bold (specimen 4);
     the stacked away-over-home layout is unchanged, so the drawing's one-line "A vs B" is not adopted.
     The dashboard's game-day tiles keep their layout too — specimen 4 draws a different row shape
     (a redesign question for Phase 3).
  4. **Dashboard tones:** the guidance rail's "live" tone amber → red (the same `isGameDay` fact the
     header's Live chip shows in red); its "ready to finalize" milestone and the "+N this week" velocity
     chip lime → green (a good outcome); the "done" family (checklist ticks, done rows) olive, as 4a's
     summary; the live feed's registration events blue, scores olive.
  5. **Check-in:** the jersey-number field leaves mono for the body face (a field, not a readout); "Add
     roster" is the olive accent (above).
  6. **Staff kit:** the QR code's backing is `--white-fixed` on the kit — `--white` is the warm INK, so
     the QR would have sat on a dark square in Warm and failed to scan. (Legacy and Dark unchanged.)
  7. **Chat:** the "Organizer" role tag is the quiet chip (it names, it does not judge — was blue); the
     "Muted" tag gains the amber tint fill; the reports badge's number is `--white-fixed` on its red.
  8. **Teams:** the phone status marker for a waitlisted team is the quiet chip (as drawn); a neutral
     health note is the info blue.
- **Identity (switch off):** "before" 2026-09-27T17:36Z @ `81461b40` on the untouched tree after the
  restart (tournaments + volunteer, 30 screens, 60 pictures — the volunteer gate included because it
  shares the check-in board); "after" 18:27Z after a second restart — **60 of 60 pixel-identical**.
- **Switch-on sweep** (the 10 screens 4b touches — dashboard ×2 frames, Teams, Results, Check-in, Staff
  kit, Communication, Chat, the Schedule (the game list), Data tools (the import windows) — × 361/390/
  768/1440, 40 pairs each, none unmeasured) against the switch-off dark baseline: **contrast 460 → Warm 7 /
  Dark 142**; tap floor 445 → 353 (both); control width 99 → 96; overflow 14 → 13; type ladder 4 → 4;
  control off-screen 2 → 2. **No screen × rule group worse in either theme.** Attributed: **Warm 7** = the
  Schedule's own health panel ("Team detail", "Show") and venue filter ("All venues") — 4c; **Dark 142** =
  120 the shared phone bar's inactive labels (slice 1's open question, every screen), 16 + 2 the
  Schedule's health-panel figures and venue filter (4c), 4 the coaches portal's conversation panel's
  empty line ("Be the first to say something." — `--home-dim` at 4.48:1, the same Dark `--home-dim`
  finding slice 3 made on the portal's Upcoming Bills; one fix repairs both portals). **This slice's own
  surfaces: 0 in Warm; in Dark only the phone bar.**
- **Gates:** the strict kit check now reads **every `.module.css` under `app/` and `components/`** plus
  `app/globals.css` — a kit rule is recognised by its selector, not by which scope owns its sheet. (The
  build first added the three admin-only chat sheets by hand — `components/chat` is the shared scope, so
  the operator scope never read them — and /simplify replaced the hand list with the repo-wide walk; the
  file set is a strict superset of the old one and finds no other kit sheet; a planted literal in a chat
  sheet proven caught.) 2,070 kit rules after /simplify's merges, no literal colour. The restyled ratchet gains the slice's 8 directories
  and 8 files — the game list, the whole schedule sheet (held now; 4c lowers it), the check-in board, the
  live feed, the three chat sheets (127 files, 701 legacy literals held; the baseline change is
  additive — 16 entries added, none moved). Byte-equal swaps: `#f87171`/`#fbbf24` → `--danger-light`/
  `--warning-light` in the game list's conflict banner and `#fbbf24` → `--warning-light` in Teams'
  capacity strip. Typecheck clean (whole tree, after `next typegen`); lint 0 errors, and the six changed
  pages' findings match HEAD rule for rule (no new warnings); `verify:changed` green, unit 5,042 / 5,042.
- **Found, written down, not fixed:**
  1. **The Teams phone defect, now located:** at 361/390 the Pools view's slot rows ("Red Team 1 ·
     Falcons U11 Girls · Coach Falcons …") spill ~170–225px with no scroller, which carries a row button
     152–181px off-screen. Unchanged by the kit (same findings switch-off). A layout fix — not a
     restyle. (A builder's kit-only `flex-wrap` on the Pools action row is harmless but was not the
     cause.)
  2. **Teams' status tags disagree:** an accepted team is green in the flat list, the quiet chip in the
     slot board and lime in the phone marker; and a waitlisted team has no tone of its own in the
     `badge-*` ternaries (it falls in with pending, amber), so specimen 2's "Waitlisted quiet" is met only
     on the phone marker. A logic change, not a restyle.
  3. **The dashboard's header repeats the event header directly above it** (organization, name, dates —
     and on the kit a status chip beside the event header's phase chip). Phase 3's question.
  4. **Dead CSS left alone:** Communication (~25 classes from an earlier card layout), Chat's
     `.manageBtnCount`, Results' venue-filter classes (a removed feature), Teams' `--teams-select-bg`
     (now dead under the kit, live switch-off).
  5. Communication's history tab: hovering the ACTIVE tab has always reverted it to the hover colours
     (legacy `:hover` outranks the active class); the kit mirrors it.
- **`/simplify` (4 lenses — reuse, simplification, efficiency, altitude):** fixed —
  - **The live feed built four styles per event row on every render**, and it re-renders on every live
    event: its styles are module constants patched once per render (`useMemo`), switch-off objects
    byte-identical in keys, values and order.
  - **`KIT_INK.info`** (the `-light` blue ink) joins `kit-inline.ts`; the dashboard and the live feed
    stop hand-typing it, and the feed's per-type inks reference `KIT_INK` instead of repeating strings.
  - **The dashboard gauge's two parallel ternary chains** (fill and ink, each re-deciding legacy vs kit)
    are one tone lookup (`GAUGE_TONE` / `GAUGE_KIT_FILL` + `KIT_INK[tone]` through `kx`); a duplicate
    legacy constant removed.
  - **Merged in place, within one sheet:** Teams' six identical eyebrow blocks, Communication's two
    identical banner pairs, the dashboard checklist's paired tone rules (11 rules fewer).
  - **The gate's hand list → the repo-wide walk** (above).
  - Declined: **sharing recipes across sheets** (the chosen chip, the bottom sheet, the empty card) —
    `composes` adds a class name to today's markup, a switch-off change; the release slice folds the
    kit layers (slices 2–4a declined the same); **the scattered same-recipe groups inside the Teams and
    dashboard sheets** (moving rules hundreds of lines apart in a cascade-ordered layer needs the page
    structure to prove harmless, and the release slice folds them anyway); the Teams chevron as a shared
    token (two uses in one sheet); a "third select" that is a checkbox, already styled.
- **`/review` (standard tier, 3 lenses — switch-off identity + correctness, regression / blast radius,
  gate contract):** switch-off identity holds in every TSX hunk (every legacy style object byte-identical
  in keys, values and order; hooks before every early return; `AdminPageHeader` renders only `legacy`
  when off); every CSS hunk is a pure append; the check-in board cannot reach the volunteer gate, the
  game list's kit block serves both modes and never renders in a public preview, the chat sheets are
  admin-only, nothing reaches the coaches portal; the gate's new walk is a strict superset and the
  baseline change additive. **Fixed (Low):** the dashboard's kit eyebrow went blank while the
  organization loads (legacy says "Admin") — same fallback now; Teams' kit "Done" lost its hover to an
  equal-weight kit rule — restated, as Results' own; (Advisory) the guidance rail comment claimed the
  "ready" state turns green — only its border does. Refuted: the Results "Done" hover tint (the portal's
  chosen-chip tint, 4a precedent); a crash on an unknown feed event type (today's code already fails
  first on the same input). Gates re-run green (verify:changed 5,042 / 5,042; typecheck; lint = HEAD;
  token gate 2,070 kit rules). `check:layout --changed`, the identity check and the switch-on sweep were
  **not retaken after /simplify + /review** (a quiet window) — everything changed since them is kit-only
  or legacy-byte-identical by construction, as the correctness lens confirmed.

**Slice 4c — results (2026-09-27).** Started after 4b's commit (`07808a02`), in one quiet window on the
owner's word ("Go ahead, it's all yours"). The dev server was NOT restarted: the stop was refused by the
session's permission guard (it counts as interfering with a running workload), and the running server
was healthy (no crashed page worker, 3 GB, 5.6 GB free), so the captures ran on it in a narrowed set.
⚠ A context provider changed (below) — restart before the owner browser-tests.
- **Coverage first — the proof could not see the schedule.** The identity check and the sweep pictured
  only the Schedule's opening view, which on the Championship is "No games match your filters". Ten
  entries were added to `scripts/layout-screens.mjs` before the "before" set: the health panel open, the
  timeline in both stages, the bracket, the bracket editor, the Round-Robin Generator, the playoff
  wizard, the game form, and the rain-delay window (its entry pins the clock to the Championship's
  busiest game day, 7:00 a.m. — the tool is offered only while a scheduled game lies ahead). Each opens
  its surface by the product's own names and writes nothing. ⚠ **The page remembers its view in
  localStorage and the sweep keeps one browser context per session**, so the first switch-on sweep
  measured the plain Schedule entry in the PLAYOFF BRACKET at 390/768 and the game form in Playoffs
  (no "Add game" there) — and the first baseline seed was contaminated the same way. Every schedule
  entry now states its stage and view first (`setScheduleView`, a no-op when already there, so the
  identity check's fresh contexts never move — re-proven 20/20); the nine new entries were re-seeded
  switch-off (8,976 entries, the change additive to every other screen).
- **Built by six parallel builders** against one brief (`.probe/4c/BRIEF.md` + `ASSIGNMENTS.md`, local):
  the page · the health panels + typed-locations window + zero-venue prompt + field picker · the
  generator + number stepper · the playoff wizard · the brackets · the timeline + bottom sheet +
  rain-delay window. **The 4,200-line shared sheet was written by the main loop alone**: each builder
  wrote its kit rules for the classes it owned (a class → builder map computed from the code, zero
  overlap, none of 4b's) to a fragment, and the fragments were appended in one pass after review. Every
  diff reviewed; three audits kept in `.probe/4c/` (local): `kit-literals.mjs` (the gate's regex + the
  wrong-theme token traps), `coverage.mjs` (an owned class painted by legacy with no kit rule),
  `inline-left.mjs` (an inline colour left outside `kx`).
- **Found and fixed — the shared bottom sheet was unreachable by any kit rule.** `BottomSheet` portals to
  `document.body`, a SIBLING of the admin shell, so no `[data-admin-kit]` rule could match it or the
  caller's content inside it — the timeline's reschedule sheet AND 4b's check-in detail sheet were
  silently legacy under the switch. Now: `PortalKitRoot` (AdminKitProvider; final form after /review,
  below) — the one door besides the admin layout that may touch `adminKitAttr`: a `display: contents`
  wrapper above the portal's root while the switch is on, the children bare while it is off; it forwards
  the layout's context decision and decides nothing. The tournament preview island turns the kit OFF in context for everything inside it
  (`AdminChrome`: `<AdminKitProvider on={false}>` inside `[data-public-preview]`) — so a portal opened in
  a public preview is the public page (R2); the builder's first version did this with a pathname test
  and spread the attribute in a shape `admin-kit-switch-guard` could not see. **The guard now fails on
  ANY mention of `adminKitAttr`** outside the layout and the provider, pins the hook to exactly "context
  on → marker, else nothing", and pins the island's provider. Switch-off: no provider value changes, no
  attribute — pixel-proven.
- **Restyled end to end** (kit layers; inline colours through `kx`): the page (the "Published" tag as the
  kit's good state, toolbar, phone stage toggle, settings sheet and nested venue list, summary strip and
  tallies, venue filter menu, the temporary-facility and typed-location banners, the "All divisions"
  headers, the two Tools menus on 4a's menu recipe with kit-branched hover handlers, the Unpublish menu,
  the add/edit game window, the resolve-facilities window, the publish window, the bracket read view's
  section titles); both health panels (score, KPIs, issues, rules editor, team table); the typed-locations
  window; the zero-venue prompt and field picker; the Round-Robin Generator (its own overlay → the kit
  window, the ≤540px sheet's square bottom kept, the local `.form-label` override restated) and every
  widget it shares with the playoff wizard; the number stepper; the playoff wizard (seed drag list, pool
  and tier panels, both confirm windows); the bracket builder, connectors, zoom controls, editor and read
  columns; the timeline; the bottom sheet; the rain-delay window.
- **Decided at build time / not as the legacy did (flag to the owner):**
  1. **Brackets: the winners' path olive, the losers' path quiet grey and dashed** (dashed as today), on the
     connectors and the legend alike. The final's lime glow → a plain olive ring (no tokened glow).
  2. **The filter chip "Scheduled" loses its one-off blue** when chosen — every chosen filter is olive (4a).
  3. **The settings sheet's "Done" is a quiet button**, not lime: it dismisses, it does not commit.
  4. **The zero-venue prompt's box**: today it wears the organization's colour (`--primary-faint` /
     `--border` — an R1 leak in legacy); on the kit it is the caution tint, as the temporary-facility
     banner on the same page.
  5. **The health panel's "Show"/"Hide" and "Team detail" leave the console face** (disclosures, not
     labels) — the pair 4b's sweep measured under the floor; the typed-locations window keeps a TYPED
     name in the console face and a linked (real) name in the body face, as the component already says.
  6. **Tournament Plus lock tag** blue → info; **the Tools menus' lock glyph** → caution ink (4a's menu).
  7. **Section eyebrows** in the generator and wizard → the kit's eyebrow ink (they were lime at 65%);
     accents (Add date, By seed #, Randomize, Add tier) → olive.
  8. **The timeline's "now" line** → the portal's live red (was lime); the conflict count on its solid
     fill takes the page ground as ink (above).
  9. The Save Anyway button's legacy amber hex → `--warning-light` (byte-equal in the dark root — 4b's
     precedent), and the four red strings in the bracket editor (a raw `#f87171`) → the danger ink on the
     kit only.
- **Identity (switch off):** "before" 2026-09-27T20:18Z @ `dd3787bc` on the untouched tree, 14 screens =
  every surface 4c's files can reach (the ten schedule entries, Results — it reads the schedule sheet —,
  Check-in and the volunteer gate — the bottom sheet —, the public schedule preview); "after" 21:00Z —
  **28 of 28 pixel-identical**; retaken after the entry fix — 20 of 20. The two sweep fixes below came
  after the last pictures; both are rules under `[data-admin-kit]` only (guard-checked). The remaining tournament screens
  were not recaptured: no file 4c changed is imported by them, and the one frame change (the island
  provider) renders only with the switch on.
- **Switch-on sweep** (the ten schedule entries + the public schedule preview × 361/390/768/1440, 44 pairs
  each, against the switch-off dark baseline): **contrast 473 → Warm 28 / Dark 93** (after the two fixes
  below; first pass 101); tap floor 586 → 532 (both); overflow 23 → 19; control width 150 → 150; type
  ladder 24 → 24. **No schedule screen × rule group worse in either theme.** **The slice's own surfaces:
  0 in Warm; in Dark only the shared phone bar** (72 — slice 1's open question) **and the generator's two
  help hints** (8 — `FieldHint`, the help guide's component, slice 5). The public preview holds the rest
  (its own 13, the same switch-off, + the Warm 15 below). **Fixed from the sweep:** the timeline's
  conflict count (white on Dark's red, 3.76:1) → the page ground as ink, which inverts with the theme as
  the fill does (the legacy badge used `--bg` for the same reason; 5.3 / 9.2:1 Dark, 5.5 / 6.1:1 Warm);
  the bracket editor's Clear bracket (`.btn-danger`, base red on its tint, 4.09:1 in Dark) → **a global
  kit rule for `.btn-danger`** with the light red as ink, as slice 3 did for `KIT_BUTTON.danger` — it
  reaches every admin danger button with the switch on (Warm unchanged: `--danger-light` is
  `--home-live` there). Re-swept: those two screens 0 Warm, phone bar only in Dark.
- **Worse, attributed — NOT 4c's (a pre-existing R2 leak, handed to slice 6):** the public schedule
  PREVIEW in **Warm with the switch on** has 15 more contrast findings than switch-off: its tab labels
  (Overview, News, Standings, Teams, Rules — `rgba(255,255,255,.45)` on `rgb(31,29,37)`, 4.40:1) at
  361/390/768. Switch-off Warm is unchanged (13 → 13). Proven not 4c's by removing 4c's only change that
  reaches the preview (the island provider) and re-sweeping: still 28. Slice 1 proved R2 by an on/off
  pixel diff in the default theme; the Warm pairing was never measured. The public tab bar's ground
  changes under the kit + Warm — a token the island does not restore, or a fixed bar painted outside it.
- **Gates:** the restyled ratchet gained the schedule folder (every file) plus the number stepper and the
  bottom sheet — seeded from their COMMITTED text (`.probe/4c/seed-restyled.mjs`), so a literal a builder
  added would still fail; additive (7 files, 35 literals), then page.tsx lowered by the one hex moved to
  a comment. Strict kit check 2,424 rules, no literal. `admin-kit-switch-guard` widened (above). Typecheck
  clean (after `next typegen`); lint = HEAD rule for rule on all 11 changed TSX files; `verify:changed`
  green (unit 5,042 / 5,042); `admin-kit-guard` 9 / 9 after the global `.btn-danger` rule.
- **Found, written down, not fixed:**
  1. **The preview's Warm tab bar** (above) — for slice 6's prove step, or a fix on its own.
  1a. **The generator's two help hints** (`FieldHint`, `--white-40` on the dark card, 3.81:1) — the help
     guide's component; slice 5 (R4).
  2. **The bracket read view shows no winner or score** — it renders placeholders only, so "the winner
     reads bold" has nothing to attach to; only the path colours distinguish.
  3. The generator's preview table puts the game time in the body face with its row (the time has no
     class of its own).
  4. The global `.text-muted` (`--white-60`) has no kit restatement — it follows the warm remap; the sweep
     does not flag it on these screens.
  5. **Dead CSS left alone:** `.publishButton[data-live]` (never rendered), a stale `.publishStatus`
     comment, `.roundTitleText` / `.poolGroupHeader` / the bare `.connector` in the bracket builder, the
     health panel's unpaired base rules; `text-primary-light` on the Preview Bracket heading is an
     undefined class.
  6. A hung `check:layout --changed` process from 2026-09-21 (no browser, idle) still sits on this
     machine — not this slice's; the owner may end it.
- **`/simplify` (4 lenses — reuse, simplification, efficiency, altitude; owner: "Go ahead with simplify,
  review and commit"):** fixed — the three dropdowns (Unpublish, the phone and desktop Tools menus) share
  one `useScheduleMenuStyles()` (five byte-identical style pairs, the hover handlers, the tool-icon rule;
  their panels are `KIT_SURFACE.menu`); `KIT_INK.eyebrowAccent` for five hand-written accent eyebrows
  (the bracket editor's two identical labels are one); `KIT_INK.accent` / `.info` where retyped; the
  publish window's error box built once (two copies) and its list styles hoisted; the seed row's two
  styles memoised (it re-renders on every drag frame); the rain-delay rows' six styles hoisted; the
  sheet's fragment headers lost their build-process notes and the repeated warning; the measuring
  helpers wait on the product (the chosen segment's `aria-pressed`, the settings strip's label, the open
  `<details>`, "Editing bracket", the tool's window) instead of fixed pauses, and the three tool entries
  share `openScheduleTool(page, item, ready)`. **Altitude found a sibling defect: the admin chat's rooms
  and manage panels also portal to `document.body`** — 4b's kit rules for them were unreachable. Fixed with
  `PortalKitRoot` (AdminKitProvider): a `display: contents` wrapper carries the marker while the switch is
  on, the children bare while it is off. **Declined:** clearing localStorage between entries in the sweep
  runner itself (the altitude lens's deeper fix for the view leak) — it would change how every coach screen
  is measured against the 9,000-entry baseline; recorded for slice 6. Re-proven: identity 24 of 24 (the ten
  schedule entries, Results, Chat — with the new waits); gates green (typecheck; lint = HEAD on every
  touched TSX; verify:changed 5,042 / 5,042; kit check 2,425 rules; restyled ratchet 734 held — page.tsx's
  `#f87171` lowered again).
- **`/review` (high-risk tier, 3 lenses — switch-off identity + logic, blast radius + R2, gate + tooling
  contract):** 1 real finding, fixed: **(High) the bottom sheet's marker sat ON the backdrop**, so the
  backdrop's own `[data-admin-kit] .backdrop` rule (a descendant selector) could never match — the kit sheet
  would have floated over the legacy near-black scrim. The sheet now uses `PortalKitRoot` too, and the bare
  hook is no longer exported: the wrapper is the only portal door (the guard pins its switch-off form).
  Refuted: the help drawer "uses the bottom sheet" (only a comment names it). Advisory, accepted: the
  global `.btn-danger` kit rule reaches every admin danger button with the switch on (Dark only; Warm is
  the same colour) — the `.btn-secondary` precedent, walked at slice 6; the playoff measuring entries depend
  on the Championship keeping both stages (now said in the file); the schedule folder's ratchet coverage is
  automatic for new files. Verified clean: every legacy `kx` argument byte-identical, hooks before every
  early return, no kit rule wiping a legacy state, public pages / the volunteer gate / the coaches portal /
  every R2 preview unreached, the restyled and layout baselines purely additive (the one lowered count is
  a tightening), the switch guard fails on the disguised spread and on a wrapper rendered when off.
  `check:layout --changed` not run (`app/globals.css` widens it to every screen) — the identity checks and
  the both-theme sweep stand in.

**Slice 1's open questions — ruled (owner, 2026-09-27), and built for BOTH portals.** Asked on the hub's
Progress tab after 4c; answered *"1. fix it 2. go with your recommendation 3. soften it 4. fix in slice
6"*, then *"go"* after being told that 1–3 are **not behind the switch**: the coaches portal shares the bar's
stylesheet and the warm block, so they reach live coaches with the next promote. Design log entry:
`memory/design_decisions.md` 2026-09-27.
- **1 · The Dark phone bar reads.** The inactive tab names (white 40%, 3.8:1) and the More sheet's section
  headings (white 25%) take the quiet tier, `--text-tertiary` — the data grey in Dark (7.4:1), the warm
  quiet ink in Warm (unchanged there). One stylesheet, so the coach bar, the coach More sheet, the team and
  player switch sheets' headings and the admin's kit bar all move together. The admin's LEGACY bar has its
  own stylesheet and is untouched.
- **2 · Mixed case in both portals** (the recommendation): the coach bar's labels drop the tracked
  capitals. Argued from the portal's own type ladder (2026-08-19: primary navigation in sentence case — this
  bar was the one nav surface left in capitals), the admin's "ACCOUNTI…" truncation at 390, and both hubs'
  drawings. The labels are already written as words. The admin's override that did this for its own bar is
  deleted — the shared rule now does it.
- **3 · Warm shadows are warm.** The warm block maps `--shadow-sm` / `--shadow` / `--shadow-lg` to the kit's
  warm-tinted shadow at three depths (built from `--home-line-rgb`; `--shadow` is `--home-shadow`); Dark keeps
  the black ones. R2: the three joined the `--pv-*` snapshot and the public-preview island, so previews keep
  the org's look (`admin-kit-guard`'s parity test holds it).
- **4 · The public preview's Warm tab bar** (the R2 leak found in 4c) → slice 6's row in the ledger.
- **Proof.** Coach sweep, 4 screens (Overview, the More sheet, Schedule, the player switch sheet) × 4 widths,
  before and after: **Dark 148 → 104** — all 45 bar-label and section-heading contrast findings gone, none
  new (the one "new" key is the Overview's red loss badge at 361, already flagged at the other three widths
  before the change and missed on the cold first load); **Warm 28 → 28, the same 28** (no contrast finding
  before or after; tap floor and control width unchanged, so the case change moved no control). Admin
  schedule, switch on, Dark: 82 → 70 against 4c's sweep — the bar's 12 gone, none new. Admin switch-off:
  unreachable by construction — the legacy bar has its own stylesheet and the warm block needs the marker
  the admin carries only with the switch on (the notification panel's warm prop is kit-only too). Guards
  23 / 23, `verify:changed` green, lint clean. A whole-portal coach sweep was not run (a shared-stylesheet
  change widens it to every coach screen; the scoped before/after stands in) — slice 6's prove step runs it.
- **`/review` (standard tier — shared tokens + the shared bar; 2 lenses + main loop; owner: "ok run review
  then commit"):** no defect. **Raised to the owner, open:** in Dark the inactive tab names are now as light
  as the active one (`--data-gray` #94A3B8 vs `--blueprint-light` #859BD5, 1.07:1 between them; was 1.86:1),
  so the active tab is told apart by its pill and dot — as **Warm has been since 2026-08-18** (`b291e02`):
  the warm `.tab { color: var(--text-tertiary) }` outranks `.tab.active` (0,3,1 over 0,2,0) and greys the
  active name too, where both hubs draw it olive and bolder. A one-line follow-up either way. **Refuted:**
  "the help surface re-reads `--home-line-rgb` for the warm shadows" (a custom property's `var()` resolves
  on the declaring element; no help surface consumes the tokens, and the `--dk-*` list's own rule covers the
  day one does); "the warm `.tab` override is dead" (it is what greys the active tab; the `.dropSectionLabel`
  one is redundant, kept as a harmless pin). Checked fine: no `drop-shadow()` / `inset` use of the tokens,
  every consumer has a border, no label relied on the capitals, no dangling `barLabel`. Extra rendered check
  (team hub, team switch sheet, notifications, help; both themes): no faint bar label anywhere; Dark's "new"
  items are pre-existing card and badge debt. Aside, not this diff: `--shadow-md` (ChatPanel ×5) is defined
  nowhere, so those panels have no shadow in either theme. **COMMITTED `dca4ac25` 2026-09-27.**

**Slice 5 — results (2026-09-27).** One quiet window on the owner's word ("Go — it's quiet"), covering the
coverage entries, the "before" set, the build, the "after" set and the switch-on sweeps. The dev server was not
restarted (healthy throughout: no crashed page worker, 2.8 → ~5 GB, ≥5.5 GB free).
- **Pushed back at the start, and recorded:**
  1. **R3's stated reason is wrong in the code — volunteers DO have accounts** (both shells send an unsigned
     visitor to the login page; `official` is a role on an account). The ruling holds for a better reason: the
     Warm/Dark choice lives on the DEVICE (`fl_user_theme`, read pre-paint), a gate phone is shared, so the last
     person to hold it would decide what the next volunteer sees; and a light screen reads better in the sun. The
     consequence to know: an organizer who chose Dark goes from a Dark admin to a warm scorekeeper — "fixed"
     working as ruled.
  2. **The admin's help guide was never pinned dark** — the only `[data-help-surface]` is the coaches portal's
     focused help (`CoachesChrome`). The admin's ten Help pages were dark only because the admin was, so since
     slice 1 they had been rendering in Warm with the switch on, undesigned. R4 in the admin was a styling pass
     plus the "?" drawer, which portals to `<body>` — outside the admin marker — and stayed legacy dark with the
     switch on (4c's bottom-sheet trap). **For the release slice:** deleting the coaches pin alone will NOT make
     the coaches portal's "?" drawer follow the theme — it portals outside the coach marker too (the org coaches
     layout's marker sits above the providers, but a portal to `<body>` escapes every ancestor); it needs the
     coach shell's own portal root. Recorded on slice 6's row.
  3. **Specimen 7 differences not copied** (restyle, not redesign): the drawn × and single full-width Finalize —
     today's sheet has Cancel beside Finalize and no ×, and the backdrop never closes it (owner, 2026-08-08: a
     stray tap must not throw away a half-typed score); it already covers the nav, dims, and has an explicit way
     out (Cancel, Escape). The drawn eyebrow "Scorekeeper · <tournament>" — a day can span several tournaments,
     and the cards name the tournament then; the eyebrow stays "Scorekeeper".
- **Coverage first.** Three surfaces the proof could not see were added to `scripts/layout-screens.mjs` before the
  "before" set (4c's lesson): the volunteer **Account sheet** (`guest-scorekeeper-account`, phone widths — no tab
  bar above 640), the **gate's team sheet** (`guest-check-in-sheet`, the bottom sheet), and the **"?" side panel
  open** (`admin-help-drawer`, from Results' header; it waits until the slide has finished). Each opens by the
  product's own names and writes nothing. Their switch-off baseline was seeded (additive: 9,068 entries).
- **THE GUEST MARKER (R3 — the switch reaches the volunteer shells).** `guestKitAttr` = `data-admin-kit` +
  `data-guest-kit` — deliberately NOT `data-coach-warm-enabled`, the half the dark gate keys on. Both volunteer
  layouts read the same cookie on the server; `withKit()` wraps the shell AND the two early screens (the
  subscription-ended wall, the "Access Denied" refusal); with the switch off it adds no element and no attribute
  (only the context provider). `app/globals.css`: the warm block's selector list opens with `:root
  [data-guest-kit]` — (0,2,0), above R1's `[data-admin-kit]` (0,1,0) on the same element, theme first as for the
  admin — and every warm CLASS rule (buttons, card hover, native select and date controls) gained its guest twin
  (14 rules name the marker). `AdminKitProvider` gained `guest` → a marker context, so `PortalKitRoot` carries the
  guest pair in a volunteer shell (the gate's team sheet). `kitStyler(on)` (`kit-inline.ts`) is `useKitStyle()`'s
  server twin (the hook now uses it); the header patches live once in `components/volunteer/day-of-kit.ts` so the
  twins cannot drift. The status-bar tint is fixed warm (`CoachThemeColor fixed="warm"`).
  **Guarded** (`admin-kit-switch-guard`: only the two volunteer layouts + the provider may name `guestKitAttr`,
  nobody writes `data-guest-kit` by hand, each layout decides from the cookie and renders bare when off, the
  guest pair never carries the account-theme half, public layouts never carry it; `admin-kit-guard`'s new R3
  block: the warm block answers the guest marker, the dark gate never does, every warm class rule has its guest
  twin) — **mutation-proven**: removing the pin, dropping one button twin, or giving the pair the account half
  each fails the guards.
- **Restyled end to end — the volunteer screens** (ADC specimen 7, fixed warm): the header strip (the coach
  strip: a white bar with a hairline; FIELD ink / LOGIC olive / HQ quiet), the scorekeeper's eyebrow and title,
  the refresh / Today / Filters buttons and the fields, the notices, the loading and empty states, the game cards
  (the kit's door card; the game to score next wears an olive stripe), the status chips, the matchup, the score
  sheet (a white window over the warm scrim; the kit's fields; the consequence note), the four filter buckets,
  the tab bar (the portal's bar), the Account sheet; the gate page's title, picker, messages and banner. **The
  gate's board is the admin's check-in board** — 4b's kit rules key on `[data-admin-kit]`, which the guest
  marker carries, so the gate got game day's restyle as it stands, in warm.
- **Restyled end to end — the help guide as the admin shows it** (ADC specimen 6; one Sonnet builder against
  `.probe/5/HELP_BRIEF.md`, its whole diff reviewed): callouts, the "?" hints and their popover (the hard navy
  literal → the kit's popover), field hints, the header "?" button, the drawer (now inside `PortalKitRoot`), the
  guide pages (contents rail, search, header and trail, article, pager, landing page, FAQ, search results, empty
  and loading states), the Help hub, the scannable blocks, screenshots, the export table's head. Every rule is
  `:global([data-admin-kit]) .x:where(:not([data-public-preview] *))` — two PUBLIC pages (a team's tryout page,
  the league registration form) render help parts. Appended after another session's uncommitted
  `.helpButtonIconOnly` hunk (the coaches portal's bare "?"), which is left untouched and unstyled.
- **Decided at build time / not as drawn (flag to the owner):**
  1. The chosen filter bucket is the kit's **olive** chosen state, not the lime drawn — lime is the one primary
     per view (the sheet's Finalize), and 4a/4c made every chosen filter olive.
  2. **Status words kept as written** — "To Score", "Pending Review", "Finalize Score". "Pending Review" is the
     product's name for that status across house league, tryouts and a dozen help articles; the specimen's
     sentence case would be a second spelling of a product term (the one-spelling ruling).
  3. **Two captions that already disagreed with the product's one spelling**, fixed because the kit is the first
     place they show in mixed case (drawn in capitals switch-off, so no pixel moves): the desktop header's
     "Sign Out" → "Sign out" (the Account sheet's), "Check-In →" → "Check-in →" (the gate's own title). The
     sweep baseline keys a finding by an element's words, so the Sign out's three tap-floor entries were re-keyed
     switch-off (3 removed, 3 added, the same finding).
  4. A pending or finalized game card is a **plain card**; its chip carries the state (legacy washes the card
     amber / blue) — the portal's tinted-panel retirement, as drawn. The next game's stripe keeps its 4px width.
  5. **"Up next"** = the olive accent chip (drawn), its edge inset so the chip keeps its size; "Finalized" green;
     "Pending Review" caution.
  6. **The score numerals** in the body face, as drawn; scores on the cards stay the console face (readouts).
  7. **The filter buckets 40 → 46px on a phone** (drawn; under the 44 floor today); the bottom budget grows with
     them (46 → 58px — the legacy budget already under-counted the bar by 6px).
  8. "Becomes final immediately": the lime tint → the olive accent (4b's lime-tint rule); "needs review" keeps
     the caution tint.
  9. **The public bar's 72px reservation comes off the volunteer shells** (`body > main:has([data-guest-kit])`,
     ≤900px): under their own bars it was empty page — a near-black band below the paper at tablet width, a darker
     strip behind the phone's translucent bars. There in today's dark too, where it barely shows.
  10. Help: every guide-accent blue (the `#4fa3e0` literal and the `--info` used as the guide's accent) → olive;
     only a callout's own "info" tone keeps the info blue. A tip is olive, not green. The landing H1 and the
     drawer title move from lime to ink (the article H1 already was). One "door" hover for every bordered
     link-row. The screenshot lightbox stays a dark stage in both themes (review fix: the builder had lightened
     its backdrop while its Close stayed white).
- **Identity (switch off):** "before" 2026-09-28T00:1xZ–00:57Z, 206 pictures (every admin screen + the volunteer
  screens + the three new entries), three passes on the untouched tree. ⚠ HEAD moved mid-capture (`161aa50a` →
  `5f3ee206`): another session COMMITTED work already in the tree (`dca4ac25` + its truth-up) — no byte changed.
  "after" 2026-09-28T01:00–01:32Z, three passes after the build — **206 of 206 pixel-identical** (88 + 46 + 72), no mask added.
- **Fixed warm, proven:** every volunteer surface × 390 / 768 / 1440, switch on, a phone set to **Warm vs a phone
  set to Dark: 15 of 15 pixel-identical** (`.probe/5/shots.mjs --compare`).
- **Switch-on sweep, the volunteer screens** (5 screens × 4 widths, against the switch-off dark baseline): Warm
  and Dark **identical — 130 findings each, same keys, same values**; contrast **14 → 0**, tap floor 128 → 116
  (the 46px buckets), control width 14 → 14; no screen × rule group worse.
- **Switch-on sweep, the help guide and the screens that carry help parts:** the ten Help pages and the "?" panel open (11 × 4 widths): **contrast 205 → 0 in Warm AND in Dark**, tap floor 195 → 195, control width 3 → 3, no group worse, no new finding. The 22 screens that carry help parts (callouts, "?" hints, field hints, the header "?" — Accounting, House league, Organization, Rep Teams, the tournament screens and the generator): contrast **1,279 → 0 Warm / 60 Dark** — all 60 on Rep Teams, the coaches portal's Upcoming Bills panel (`components/accounting`, slice 3's recorded Dark debt, not a help part); tap floor 729 → 645, control width 140 → 132, overflow 32 → 30, type ladder 20 → 16. Two groups "worse" and 24 / 84 "new" keys, **every one re-swept switch-off and attributed**: fixture data added since the baseline was recorded (a tryout applicant — "Pending Review1", "Extend Offer", the table's type-ladder rows; a deletable tournament — "Delete this tournament"; Rep Teams' allocation count and the bills' dates), and the Results header "?" whose NAME follows 4a's sentence-case title ("Help: Results & scoring" — the same 32px button is in the baseline as "Results & Scoring"). **No help part carries a finding in either theme.**
- **Gates:** strict kit check 2,661 rules, no literal; the restyled ratchet gained the four folders
  (`app/[orgSlug]/scorekeeper`, `app/[orgSlug]/check-in`, `components/volunteer`, `components/help`), seeded from
  their COMMITTED text (7 files, 164 literals, additive; 898 held); guards 19 / 19; typecheck clean (after `next
  typegen`); lint clean on every touched file; `verify:changed` green (unit 5,046 / 5,046; its one lint warning is another session's `lib/email.ts`).
- **`/simplify` (4 lenses — reuse, simplification, efficiency, altitude; owner: "go ahead with simplify,
  review, and commit"):** fixed —
  - **The volunteer layouts' entry onto the kit is one piece**, `GuestKitRoot` (AdminKitProvider): the two
    twins had the same wrapper copied (3 reviewers). It renders its children bare with the switch off (no
    provider, no element, no attribute) and is the ONLY file that may name `guestKitAttr`; the guard pins its
    switch-off shape and that each layout renders all three returns through it.
  - **The day-of header patches reuse the kit's own recipes** (`KIT_SURFACE.card`, `KIT_INK.eyebrow` /
    `.primary` / `.secondary` / `.tertiary` / `.accent`) instead of restating them.
  - **The scorekeeper's `--sk-*` remap is gone**: every rule that reads an `--sk-*` token is restated with the
    kit's token (the program's one convention), so the remap could never be seen. (The altitude lens argued
    the reverse — keep the remap, drop the per-rule colours; declined for consistency with slices 1–4c and
    because the release slice folds per-rule layers directly.)
  - A release-slice note on the volunteer foot rule: re-anchor it on the shell when the marker goes.
  - Declined: splitting the kit module out of the lazily-loaded help drawer's chunk (tiny; the bottom sheet
    already carries it since 4c; only the admin and the coaches portal open the drawer); collapsing the
    warm class rules' guest twins into one `:is()` selector (it would rewrite rules the live coaches portal
    uses — the release slice's call); moving the cookie read after the availability check (negligible).
  - Re-proven after /simplify: identity 10 / 10 (the volunteer area), fixed warm 10 / 10, guards 19 / 19,
    typecheck clean, token gate green.
- **`/review` (high-risk tier — a shared library module, the site stylesheet, two auth-bearing server
  layouts; 4 lenses: switch-off identity + correctness, blast radius, security + switch gating, switch-on
  CSS correctness):** 4 findings, 4 confirmed and fixed, 1 advisory refuted:
  - **(High → fixed) The "?" hint's caret when the hint opens BELOW its trigger** (`HelpTooltip` near the top of
    the screen): the kit's plain caret rule weighed the same as the legacy `.tooltipBottom` reset and came
    later, so both edges painted — a bow-tie. The kit's flipped rule now restates the transparent top edge.
  - **(Low → fixed) "Check-in →" kept a "Check-In" accessible name** — the label now matches (the sweep keys
    that element by its label, so its two baseline entries were re-keyed in place; switch-off check: no new
    finding).
  - **(Medium, doc → fixed) Two comments made untrue by this slice**: the check-in board's kit layer "can never
    reach the gate" (it now does, on purpose) and the R1 block's "only the admin shell carries the marker"
    (the volunteer shells do too; R1's platform colours reaching them is the ruling working — they are
    platform chrome).
  - Refuted (advisory): "a portal opened inside a volunteer shell would carry the guest marker" — that is the
    intent (fixed warm).
  - Verified clean: every auth / org / suspension / capability check in both volunteer layouts runs in the same
    order under the same conditions; the switch is fail-closed and single-sourced; the guards catch a
    hand-written or unconditional guest marker; the new sweep entries write nothing; the baselines only add
    (plus the documented re-keys — the layout baseline was restored to its committed entry ORDER so the diff
    is 378 / 10 lines, not 15,000); every help kit rule excludes public previews on its subject; the coaches
    portal's drawer, the bottom sheet's two public users and the chat panels are unchanged.
  - Gates after the fixes: guards 19 / 19, token gate green (2,660 kit rules), lint clean. `check:layout
    --changed` not run (the site stylesheet widens it to every screen) — the identity checks and the
    both-theme sweeps stand in.
- **Found, written down, not fixed:**
  1. **The install banner covers the phone's filter row** on the volunteer shells — it sits above the PUBLIC
     bar's height, not `--dayof-bottom-h`; switch off and on alike.
  2. The desktop Sign out and the hop link are ~15px tall (tap floor) — pre-existing.
  3. The coaches portal's "?" drawer needs its own portal root at release (above).
  4. The install banner itself is the shared one (tokens only) — legible on the kit, not restyled.
- **COMMITTED `530d87e9` 2026-09-27** from a private index: `components/help/help.module.css` as HEAD + this slice's appended
  section (another session's uncommitted `.helpButtonIconOnly` hunk and `HelpButton.tsx` left out), `TODO.md` with
  this slice's clause only; the staged tree typechecked alone (a `git archive` copy, `next typegen`, node_modules
  junctioned), guards 19 / 19, token gate green.

### Phase 2 — Club screens (inside the Club Tier stages)
Each club stage's mockup session draws its screens in **both themes** and its build adopts the kit (D12 as
amended). Club Stage 1's specimens are the first (dark copies added 2026-09-25, hub v6).

### Phase 3 — Tournament screens (its own project when it opens)
Its own PLAN / PM brief / hub, grouped by job: setup (event settings, divisions, venues, rules, public-site
branding), operations (dashboard, teams, schedule, results, check-in, staff kit, communications, chat),
records (archives, summary, data tools), and **scorekeeper and gate** (R3). Each group: owner mockup session
→ build → § walk. Runs alongside the club stages after Phase 1; **does not gate the Club release**. Paying
customers work here every weekend, so each group ships with its own release note.

### Phase 4 — House league screens (with Club Stage 9)

## 4. Out of scope
Public pages (R2); emails; PDFs and exports (their own branding system); the marketing site; the
platform-admin console (internal — may follow later); the consumer app and the coaches portal (already
themed — they are the model).

## 5. Risks
| Risk | Mitigation |
|---|---|
| Every tournament organizer sees the admin change at once (warm default) | Release note; Dark one click away; release timing outside peak weekends |
| Hidden breakage from literals and inline styles the remap cannot reach | Both-theme sweep before release; the raw-colour gate; contrast grounds extended |
| Removing the org colour from admin chrome is visible to paying organizers (R1) | Named in the release note: "your colours stay on your public pages" |
| Club stages and Phase 1 touch the same files | R5 as refined (§3a): Stage 1's server half touches no screen; its screens replace the six Stage 1 screens behind the same switch, and the foundation leaves those six alone |
| A half-built foundation reaches production on someone else's promote | The switch (§3a): off in production by construction, off by default on dev; the identity check proves switch-off is unchanged every slice |
| The help guide change (R4) also changes the coaches portal's guide | Intended: one guide, one theme rule; walked in both shells |

## 6. Build gates to add
| Gate | Pins |
|---|---|
| admin raw-colour gate — **extend `scripts/check-public-tokens.mjs`'s `operator` scope** (Phase 0) | no new hex/rgba literal in admin CSS/TSX outside an allowlist |
| layout sweep: admin routes × both themes | every admin screen renders without overflow/contrast failures in warm and dark |
| contrast grounds | the admin's grounds join the palette contrast test |
| shell-marker guard | the admin shell emits the theme marker; the public layouts never do |

## 7. Sequencing
```
Phase 1 mockups ✅ ─► slice 0 ─► slice 1 ─► slices 2–5 ──────────────► slice 6: prove · walk · RELEASE ─► Club stages 2–10
                        │           └► Club Stage 1 screens (behind the switch) ─┘   (Phase 2 inside each)
Club Stage 1 server half (after slice 0) ┘ (beside slice 1; ships on its own)
                                                            └► Phase 3 tournament project ─► Phase 4 with Club Stage 9
```

## 8. Success criteria
1. Every admin screen renders correctly in warm and in dark — sweep green, zero contrast failures.
2. No raw colour in admin code outside the allowlist, guarded by the build.
3. The owner, moving between a coaches portal and the club or tournament admin, sees one product.
4. Public pages look exactly as they do today, in each organization's own colours.
