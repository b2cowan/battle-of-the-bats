# Build prompt — Navigation, Phase 1 · Part B: the club's name on two lines, the one logo tile, the back link's look

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-09 after Part A was built, committed
> (`664f9113d`) and walked (§504 PASSED 31/31). Plan of record: `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md`
> (§0, §0b, §4 asks E10 and E12, §5 Phase 1 and its Part A record). Index: `ADMIN_NAV_BUILD_PROMPTS_INDEX.md`. The
> Phase 1 prompt (`ADMIN_NAV_BUILD_PHASE1_PROMPT.md`) holds the original Part B bullets and the Gotchas; read its
> hand-off block and its "What this session changes → Part B" first.

## ✅ Part B BUILT 2026-11-10 (session 2): committed `eb30602fb` 2026-11-10; walk §507 PASSED 25/25 2026-11-10; /design + /review done
Built to tab 13 as ruled (B1–B6 all A) and the owner's four answers. Measured on dev with the UAT Rep Club (first paint = scripts off, then after load, open and folded): the tile is the logo or the initials at its final size on the server's paint for a square, wide (6 : 1), tall (1 : 4), very light and made-stock logo, none, and an unmeasured logo; nothing swaps after load; a file that will not load swaps to initials once (B4, accepted); the cell is 45 px open and folded and its bottom line meets the tab band's (both at 93 px); a two-line name that fits sets no tooltip, a cut name sets the whole name, folded sets none; the Programs order, "Also on your plan" and the foot's Tournaments door are in the server's page (only the waiting counts arrive late); the back link's divider is 1 × 22 px in both bars and the hover tint clears when the pointer leaves. The real upload route stores 6, 0.25, 1 and a camera-turned picture's turned shape (probed). Mig 458 (`organizations.logo_aspect`) applied to DEV only; the one-time pass ran on dev (`scripts/backfill-org-logo-aspect.mjs`); **production: both only at the promote, with the owner's yes; the N10 census (read-only) is still owed before it.** New: `SidebarLogoTile` (props: source, aspect, name, size; the event and the team crest pass their own later, not wired), `lib/logo-aspect.ts` (the 1 : 2 … 2 : 1 rule), `lib/org-logo-measure.ts` (the one image-size reader, now also used by the family email), `lib/club-shape-read.ts` (the route and the layout read the club's shape in one place), tokens `--logo-tile-ground` / `--logo-tile-ink`. The back link's look was also applied to the paper header (`AdminPageHeader`). Stale coach-sidebar Help comments fixed. Guards: typecheck, lint, the nav and sidebar guard tests and the new `sidebar-logo-tile` test pass; `check:layout` on the Overview, Rep teams, Accounting, the tournaments list and the More sheet is clean except tap-floor findings on Overview's "Needs someone" links (another session's hub work) and a 7 px spill in the folded foot (the other session's foot hunks). /simplify applied. **/design + /review done 2026-11-10** (record in the plan's Phase 1 → Part B). **Owed:** the walk §507, the /demos look, migration 458 BEFORE the code at the promote and then the one-time pass, the N10 census. The text below is the original hand-off, kept for the record.

## Hand-off after session 1 (2026-11-09): the gate was DONE
Skip "Questions for the owner BEFORE code" and step 1 below: all answered and ruled. Start at step 2. Nothing is built,
nothing committed. Full record: the plan's Phase 1 → Part B bullets (owner answers, tab 13, the /design pass, the ruling).

**Owner answers (all as recommended):** (1) seed the club's shape on the server **in this part**; (2) the logo's size is
**stored at upload**, plus a one-time pass that measures logos already uploaded (dev in the build; **production only at
the promote, with the owner's yes**); (3) the logo **open (24px beside the name) and collapsed (40px)**; (4) the N10
census on production, read-only, **before the next promote — not this session**.

**Drawings:** tab **13 · Part B** (v10, https://claude.ai/artifact/S7XXbtLwNeZUjEWXzbUcw4#partb; source
`ADMIN_NAV_EVALUATION_DRAWINGS.html`, the `partb` section). Build to it. **Ruled B1–B6 all A:**
- **B1** the collapsed cell stays 45px (its line meets the band's); the 40px tile has 2px of air above and below.
- **B2** the strip's back-link look in both: `--home-olive-soft` tint, a 22px divider in `--home-line-strong`. The bar's
  `.back:hover` (`--white-8` = `--home-card`, white on white) and its stretched `--home-line` rule go. Tint under
  `@media (hover: hover)` plus `:active` and `:focus-visible`, so it never sticks after a tap; apply to the strip's too.
- **B3** the whole name = the native `title`, set only when the name is cut (measure overflow: scrollHeight > clientHeight,
  on mount and resize) and **never while collapsed** (the `SidebarStripTip` bubble already shows it; it reads the cell's
  `.rowLabel` text, `SidebarStrip.tsx` ~L62 — keep that class on the name).
- **B4** initials when the size is unknown **or the image fails to load** (`onError` → initials; the one accepted swap,
  only for a broken file).
- **B5** initials also for a logo **taller than 1 : 2** (extends E10's "wider than 2 : 1"). The rule: logo only when the
  stored aspect is within 1 : 2 … 2 : 1.
- **B6** ONE frame for logo and initials: white ground, thin outline (inset 1px `--home-line-strong`, the shipped 40px
  strip tile's ring), 6px corners at 24, 8px at 40; initials in ink — 24px Inter 700 10px, 40px data font 700 11px. The
  club's olive initials tile goes.

**Facts found at the gate (verified in the code):**
- `organizations.logo_url` is already on the server's first paint: `lib/api-auth.ts` ~L202 maps it; the admin layout
  seeds `OrgProvider initialOrg` (`app/[orgSlug]/admin/layout.tsx` ~L120); `useOrg().currentOrg.logoUrl`. **No size is
  stored.** The only size is the family-email cache `pdf_settings.logoSize` (`lib/club-email-context.ts` ~L40–82), which
  a PDF-settings save wipes — do not lean on it (you may reuse its `measureLogo` sharp read, which handles EXIF turns).
- Upload: `app/api/admin/org-logo/route.ts` (holds the bytes at ~L45; JPEG/PNG/WebP ≤ 2 MB; `logo_url = …?v=<ms>`).
  Stock: `lib/stock-logo-render.ts` — always a 512×512 PNG (`parseStockLogoUrl` recognises it); the stock route
  `app/api/admin/org-logo-stock/route.ts`. Both write `logo_url`; both must write the size (stock = 1 : 1). DELETE clears.
  Store the size with the logo (decide the column shape; schema = dictionary + snapshots in the same unit of work).
  The tile reads the stored aspect through `Organization` (`mapOrganization` / `lib/types.ts`).
- The club cell: `components/admin/kit/AdminKitRail.tsx` ~L121–126 (`stripTileText` initials), CSS
  `AdminKitFrame.module.css` `.clubCell` ~L58–93 (one line today, ellipsis; `--admin-band-h` 45px). Collapsed width 64px.
- The shared 40px tile today: `SidebarStripTile` (`components/shared/SidebarStrip.tsx` ~L317, CSS
  `SidebarStrip.module.css` ~L115–135, focus = 2px olive outline offset 2px). The coach team tile uses it
  (`CoachesSidebar.tsx` ~L318). Build the new tile so the event (Phase 2) and team crest (Phase 4) can pass their own
  source and fallback later — **do not wire them now**.
- The club's shape: `GET /api/admin/club-brief` → `shape = { runsHouseLeague, hostsTournaments }` (route ~L110–120);
  `ClubBriefProvider` (`components/admin/kit/club/ClubBriefProvider.tsx`) uses `fallbackShape` (~L132) until it lands;
  `useAdminKitNav.ts` → Programs order, "Also on your plan", and the foot's Tournaments door. Seed it the Phase 0 way
  (the layout's server read on tournament paths → a prop; `lib/admin-tournament-list.ts` `readAdminTournamentSeed`,
  never throws) — a server read of the route's shape logic on club pages, handed to `ClubBriefProvider` in place of
  `fallbackShape`. The brief's counts still arrive later (they decorate rows; they don't move them).
- Back links: `AdminTopStrip.module.css` ~L44–59; `AdminKitEventHeader.module.css` ~L80–88 and the ≤900px block ~L140–144
  (the 44px arrow alone on a phone — keep). `AdminPageHeader.tsx` ~L71 has a third `back`/`backRule` pair: check it.
- **Dark theme:** the logo's white ground is a FIXED white (not `--home-card`, which turns dark). The admin kit is
  token-only (`scripts/check-public-tokens.mjs`): add a named token or a baselined literal, deliberately.
- Stale comments to fix (comments only): `CoachesChrome.tsx` L22–24 and L57–59, `CoachPageHelpSlot.tsx` L33–35 (the coach
  sidebar's Help is the sandbox's only now; Help IS in the account menu).
- Uncommitted hunks of another session in `AdminKitRail.tsx`, `AdminKitFrame.module.css`, `AdminKitBottomNav.tsx` (the
  unpinned foot + spacer, the every-group-wears-its-heading rule). Build on top; commit only your own hunks.

**Not done, for the record:** the tab 12 phone foot is still drawn as one column (redraw only if that tab is touched).

## What Part A shipped that this part stands on
- The sidebar foot (Plan & billing · hairline · other portals · Collapse), Help in the desktop account menu, the strip
  word "Club" / "Events" decided from the address on the server, Tournaments out of Programs. All walked.
- **Phase 0's rule still binds:** nothing in the sidebar's head may swap after the first paint. The strip word and the
  tournament event are right in the server's HTML. **A logo or a name that appears late is a regression**, not polish.
- **The owner reversed the pinned foot after Part A** (the whole nav scrolls, the foot is its last rows, a spacer rests
  it at the bottom on a tall screen). Another session's rail/CSS hunks for that and for the More-sheet heading rule may
  still be uncommitted in `AdminKitRail.tsx`, `AdminKitFrame.module.css`, `AdminKitBottomNav.tsx`. `git diff` each file
  before editing, build on top, and commit only your own hunks.

## Read first
1. The plan: §4 rows E10 and E12, the "Inside the club admin itself" paragraph (the three inconsistencies), the Phase 1
   section including the Part A record and its "Known and kept" note.
2. The drawings (https://claude.ai/artifact/S7XXbtLwNeZUjEWXzbUcw4, source `ADMIN_NAV_EVALUATION_DRAWINGS.html`): tab
   **10 · Logo** (open + collapsed + phone sheet, a wide and a very light logo), tab **4 · The standard** (the club
   before/after), tab **12**, tab **11 · Asks** (E10, E12 as ruled, option A each).
3. Code: `components/admin/kit/AdminKitRail.tsx` (club cell, `TournamentRail`, collapsed tile), `AdminKitFrame.module.css`,
   `components/shared/SidebarStrip.tsx` (the strip menu and its tiles — the 24px club tile and 40px tournament tile
   live in different places today), `components/admin/AdminTopStrip.tsx` + `AdminTopStrip.module.css` (~L58, the back
   link), `AdminKitEventHeader.module.css` (~L87, the phone bar's back link), `components/coaches/CoachesSidebar.tsx`
   (the coach team's collapsed tile, so the shared tile fits it later), and where `organizations.logo_url` reaches the
   admin layout today (find out whether the server already has it on the first paint).

Broad reading goes to a helper (CLAUDE.md); check its claims against the code.

## Questions for the owner BEFORE code (blocking; give a recommendation on each)
1. **Seed the club's shape on the server?** Today on a club page the sidebar changes after load, when the club's brief
   arrives ("Also on your plan · House league, Tournaments" and no Tournaments foot door for 5–20 s on dev). Part A added
   the Tournaments door to what moves. Recommendation: **yes, in this part** — the same fix Phase 0 made for the
   tournament event, and the logo needs the same server seed anyway (see below). If you disagree, say why.
2. **Read prod, read-only, for the N10 census** (which clubs' tiles or bars changed when Tournaments left the fill)? Dev
   found one person's tiles and six More-sheet rows. Recommendation: yes, before the next promote, not this session's
   work — ask, don't assume.
3. If any of the three Part B pieces is **not** fully shown in the drawings (check the back link's look in particular —
   the plan calls it a tidy-up, so it may only be described), draw it as a new tab of the same drawings file, republish to
   the same artifact, `/design` on it, then my ruling. Nothing undrawn gets built.
4. Present the **product-manager UX summary** and the task list.

## What this part changes
- **The club cell on up to two lines** (E2/E10 round 2): the name 14px bold, 16px leading, clamped to two lines, the
  whole name on hover; still opens Overview (no chevron — the club has nothing to choose between); still the tab band's
  height (45px) so the hairlines meet.
- **One 40px tile, built once, for all three portals** (E10): the organization's logo (`organizations.logo_url`, an
  upload or a made stock logo) on a white ground with a hairline ring; **initials when there is none or when the logo
  is wider than 2 : 1** (a wordmark is a sliver at 40px). It replaces the club's 24px initials tile now; the tournament's
  (Phase 2: event logo, then the org's) and the team's (Phase 4: crest, then colour) adopt it later, so give it a props
  shape that already allows a different source and fallback — but do not wire those two portals' sources now.
  **Decide the wide-logo rule without a flash:** if the width is only known after the image loads, the tile will swap
  from logo to initials after first paint. Prefer a rule that the server can apply (stored dimensions, or reserve the
  tile's size and fade) and measure it. A very light logo must stay visible on white (the ring does that; check it).
- **The back link's look, one answer** (E12 (1)): the phone bar's and the desktop strip's back link share one hover and
  one divider. Pick the strip's or the bar's as the survivor from the drawings; do not invent a third.

**Not this part:** the event in the cell, page names in the strip, folding, widths, the tournament's or the coach's
logo source, anything in the coach strip or team bar, E12 (2) list status words (Phase 2).

## Also settle on the way
- Two stale comments say the coach sidebar carries Help (`CoachesChrome.tsx` ~L23, `CoachPageHelpSlot.tsx` ~L34): fix
  the comments only.
- The drawings' phone foot is one column; the shipped foot is a 2 × 2 grid. Redraw to the shipped grid when the tab is
  touched (draw from the shipped component, per the standing rule).
- Spelling gate: `npm run check:spelling`. Any new word has one spelling.

## Steps
1. The questions above, then any drawing, `/design`, my ruling.
2. Build. A new shared tile means new files: restart the dev server before handing off (stop it, then delete `.next`,
   then `npm run dev` — never delete `.next` while it runs).
3. `npm run verify:changed`, `npm run typecheck` (the tile is a shared module), `npm run check:spelling`,
   `npm run check:demos`, `npm run check:layout --changed` on Overview, Rep teams, Accounting and a club tournament page
   at 1440, 1366 × 768 and 390. Never a whole-product sweep on the dev server.
4. **Measure and report** (reuse `.probe/nav-phase0/firstpaint.mjs` and `.probe/nav-phase1/`; refresh saved sign-ins
   first): the cell's name on one line, on two, and clamped, open and collapsed; its rule against the tab band; the tile
   with a logo, a wide logo, a very light logo, a made stock logo and none, on the server's first paint (scripts off)
   and after load — **nothing swaps**; the club's sidebar rows and foot door on the first paint if question 1 is yes; the
   back link's hover and divider in the phone bar and the strip.
5. `/design` on the built screens against the drawings; `/simplify` (a new shared tile); `/review`.
6. `/docs` only if a help article names the cell, the tile or the back link.
7. Write the owner walk (checkable Artifact, **one purpose**: the cell, the tile, the back link), the next free ledger §
   (read the ledger's tail — do not assume the number), the plan's Phase 1 section with the measurements, the TODO line,
   this prompt's hand-off block, the index row and project memory (positive facts, "built 2026-MM-DD").
8. **Do not commit without asking me.** On my yes, only this session's files, through a private index on HEAD; confirm
   with `git show --stat HEAD` that nothing foreign landed.

## Done when
- A long club name takes two lines and the cell still meets the tab band's rule; the whole name shows on hover.
- The collapsed sidebar shows one 40px tile: the logo on white with a hairline ring, or initials when there is no logo
  or it is wider than 2 : 1 — right on the server's first paint, never swapping afterwards.
- The phone bar's and the desktop strip's back link look and divide the same way.
- If the owner said yes to question 1: the club page's sidebar rows and foot door are right on first paint.
- Guards, typecheck, spelling, demos and the changed-screen layout check pass; `/design`, `/simplify`, `/review` findings
  applied or recorded.
