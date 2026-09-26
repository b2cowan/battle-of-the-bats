# Admin Design Continuity — Implementation Plan

> **Status:** RULED 2026-09-25 (owner: *"I agree with your recommendations, go ahead"*). **Slice 0 (the
> baseline) COMMITTED `459b3bbd` 2026-09-25** — measuring tools only, no product code; results in §3a.
> **Slice 1 (the switch, the theme, the frame, Families + Public site) BUILT 2026-09-25** — results in
> §3a; commit on the owner's word. Club Stage 1's screens session may now start. Next: slice 2.
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
| 1 | The switch · theme gaps · R1/F1 · the frame (top strip, rail, phone bar + More, page header, event header) · Families · Public site editor | **BUILT 2026-09-25** — results below; commit on the owner's word |
| 2 | Buttons, chips, F2 type · the rest of Hub/onboarding + Organization (not Stage 1's screens) · House league | not started |
| 3 | Rep Teams · Accounting (F4 dense tables) | not started |
| 4 | Tournaments (split by job if needed — record the split here first) | not started |
| 5 | Scorekeeper, official, gate (R3 fixed warm) · help guide (R4) | not started |
| 6 | Prove (both-theme sweep, contrast, identity) · owner § walk · release (switch deleted, legacy removed, coaches help pin removed, What's New, `/docs`, `/release`) | not started |

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
  portal-wide design question for the owner. **Coach reach, measured:** exactly two elements —
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
  stylesheet, so one fix repairs both portals; (3) an org's chosen font reaches both portals (not in
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
