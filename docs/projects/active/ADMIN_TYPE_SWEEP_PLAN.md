# Admin type sweep — plan

**Census + plan drafted 2026-10-19** (owner: "have the helper list every admin screen that still uses the old
fonts and capitals, then make a plan to address each of them"). **A1–A14 ruled 2026-10-19, all as
recommended** (§6). **Stage 1 committed `0d5630b4` + the guard `59632e43` 2026-10-19; owner walk ✅ 2026-10-19 — 15 of 15 steps ticked, Parts A, B, D, E and F marked Pass; Part C (Help) had both steps ticked but no verdict marked; the owner marked it Pass 2026-10-19 (P2), so the Stage 1 walk is closed.** **Stage 2 drawn 2026-10-19 (bracket editor first, through `/design`); B1–B6 + P1 ruled as recommended 2026-10-19; Stage 2 built and committed `956eea005` 2026-10-19; owner walk ✅ 2026-10-19 — 22 of 22 steps ticked, Parts A–G all marked Pass, no notes, so the Stage 2 walk is closed. Stage 3 (club admin) DRAWN 2026-10-19 through `/design` (https://claude.ai/artifact/8Ypx95Zk9NP8ceihUGdw5F, from `ADMIN_TYPE_SWEEP_STAGE3_BUILD_PROMPT.md`); C1–C5 RULED as recommended 2026-10-19; Stage 3 BUILT and committed `e83c58223` 2026-10-19, owner walk ✅ 2026-10-19 (25 of 25, Parts A–H Pass, no notes) https://claude.ai/artifact/VEFsFQkei7kJA52bb5sVJM** **Stage 4 (new-look drift) DRAWN 2026-10-19 through `/design` (https://claude.ai/artifact/YQ9CZWXgL9pjo8GvXpw2wH, from `ADMIN_TYPE_SWEEP_STAGE4_BUILD_PROMPT.md`); D1–D3 RULED as recommended 2026-10-19 — every heading the plain face incl. the page title, both portals; one chosen look for the toggle; the account notification settings page swept too (§4 "Stage 4 — drawn"); build prompt rewritten for the build. Stage 4 BUILT 2026-10-20, /review done, committed `eb0a2609e` 2026-10-20, owner walk ✅ 2026-10-20 — 30 of 30 steps ticked, Parts A–J all Pass, no notes (https://claude.ai/artifact/21EACBfw6L6dTkbPVNAfGD; §4 "Stage 4 — as built").** (§4, "Stage 2 — drawn").
Hub (list, asks, brief, plan, decisions): https://claude.ai/artifact/QcQCe3yy4oqRUnUEf9uMCb (source
`ADMIN_TYPE_SWEEP_HUB.html`; the list and the asks live in its two `application/json` blocks — change them
with a parse-and-rewrite script, then `JSON.parse` both blocks before publishing).
PM brief: `ADMIN_TYPE_SWEEP_PM_BRIEF.md`.

## 1. Why this exists

On 2026-10-19 the owner sent a screenshot of the tournament bracket editor ("ROUND 1", "DONE", "100%",
"Select Team…") and asked whether it was up to date. It was not, although the code said it was "on the kit".

- **The September kit pass (Admin Design Continuity, closed 2026-09-30) changed colour, not lettering.** Its
  two tools were a `:global([data-admin-kit]) .x` layer over the old base rule and the `kx(legacy, kit)` inline
  pair. Both were written colour-first: a kit layer that sets `color`/`background`/`border` leaves the base
  rule's `font-family: var(--font-data)`, `text-transform: uppercase`, `letter-spacing` and 800–900 weights
  live. `kx()` MERGES (`{ ...legacy, ...kit }`, `components/admin/kit/kit-inline.ts:87`), so a legacy half's
  type props survive unless the kit half sets them; a scan of every `kx()` call found exactly one that leaks
  capitals this way (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:601`).
- **Nothing measures it.** `check:old-look` counts code SHAPES (kx calls, kit scopes, legacy props), not
  typography; most of this list sits in files it already counts as folded. `check:public-tokens`' strict admin
  gate counts colours.
- **The bracket editor fell between programs.** Tournament admin redesign Stage 3 redrew the bracket READ view
  (S6) and put "Edit bracket" above it, but never drew the editor behind it; only its behaviour changed (F72,
  game length). That program closed 2026-10-13.

## 2. The target — what the admin's lettering is

Owner ruling **F2** (2026-09-25, `memory/design_decisions.md:2081`): the monospace face (`--font-data`, IBM Plex
Mono) only on **eyebrows, chips and readouts**; titles, navigation, buttons and table headings in the body face.
With `TABLE_AND_LIST_STANDARD.md` §3.2/§3.4/§3.10.5 and the kit's own recipes, the roles that MAY carry the data
face and/or capitals are:

| Role | Face | Case / tracking | Source |
|---|---|---|---|
| Eyebrow over a figure, card or window title | data | caps, 0.09em, `--type-label`, 700 | F2; `KIT_INK.eyebrow` |
| Chip / badge / tag in a row | data | caps, `--type-token`, 700 | standard §3.2 |
| Table column heading | display | caps, 0.05em, `--type-support` | standard §3.2; global `th` |
| Band heading / band row | display (built) or body (written) | caps | §3.2 vs §3.10.5 — **A4** |
| Nav group heading, calendar day name | sidebar / display | caps | NAV_STANDARD; standard C8 |
| Step number, nav count, web address, count beside a heading | data | no caps | kit code |
| Tournament flat-row label row | data | — | exception K-17 |

Everything else — buttons (including a module's own button), field labels, window titles, page and section
headings, tabs, menu items, row text, loading lines, placeholders — is the **body face (Inter), sentence case,
normal tracking, 650–700**. Figures (scores, money, totals, times) are the **body face with
`tabular-nums`**, never the data face (standard §3.4) — **A1** confirms the edge cases.

## 3. The census (method and limits)

Three read-only helpers (tournament admin + volunteer shells; club side; the shared frame + global classes),
then a merge into one table (§7). Each CSS module was resolved to its final value per class (kit layer over
base), the rendering JSX read for each hit, `kx()` legacy halves checked against their kit halves, and KEEP rows
(legitimate roles) dropped.

**Totals:** about **370 on-screen places across about 40 screens** plus the top bar every screen wears;
**42 Excel/CSV column headings** (A7, recommend leave); **~161 dead** old-look leftovers no screen shows (S5);
**25 parked** (§5).

**Limits.** Static, not rendered: each stage confirms on screen (`check:layout --changed`, Warm and Dark) and in
the owner walk. Counts are approximate to a few (the merge found Teams & Draft at ~13 strings, not 16; Bracket
view 4, not 3). ⚠ **Removing an uppercase transform publishes the string it hid** — every caps fix must read
the underlying text and set it in sentence case in the same change (memory: coach type scale).

## 4. Stages

| Stage | Covers | Items / elements | Needs | Notes |
|---|---|---|---|---|
| **S0** Rulings | A1–A14 on the hub's Asks tab; standards housekeeping (K-10 in the exception register still licenses data-face figures — contradicts F2; band-heading recipe per A4) | — | owner | nothing builds before A1–A6 + A13–A14 |
| **S1** The frame every screen wears | top bar (Workspaces pill, account menu, theme buttons, flip pill), install / push banners, notification drawer, page-heading weight (37 headings, A5), the hub's loading line, the help drawer, the plan-upgrade drawer, `.text-label`, NumberStepper | 13 / 58 | A1, A5, A6, A11 | shared with the coaches portal per A6; ships the guard (A14) as a ratchet |
| **S2** Tournament admin + volunteer screens | **bracket editor first — drawn before/after through `/design`** (it also has three field heights in one card); dashboard (schedule health, Customize bar, guidance rail, Recent activity); schedule (health panel, banners, Match typed locations, generator, timeline); check-in; results; registrations; playoff bracket view; branding; event settings; scorekeeper + gate; the tournament-only `/admin` landing | 48 / 96 | A1, A2, A9, A12 | no program owns these since the tournament admin redesign closed 2026-10-13 |
| **S3** Club admin | house league (97 — mostly Title Case words), rep teams, accounting (Ledger balance rows, Budget vs. Actual), plan & billing, organization settings + PDF, public-site editor, first-run setup, notifications page, help hub, families, members, audit log, overview checklist, venues | 45 / 194 (107 are Title Case words; 47 are Excel headings) | A1, A3, A7, A8, A10, A13 | house league = Club Tier Stage 9 (to come), public-site editor = Stage 4 (to come) → **A13** |
| **S4** New-look drift | the kit's own recipes applied inconsistently: eyebrows at 0.04–0.08em / `--type-token`, chips without caps, two window section-heading recipes, Ledger balance label, help eyebrows at 0.12–0.16em / 800–900, form-table headings in the data face | 29 / 65 | A4, A10, A11 | run after S1–S3 so each screen is touched once where possible |
| **S5** Dead old look out | unreachable tile hub, `.btn-data` on ~94 buttons, unused global classes, the old tournament header branch, unused toolbar parts, legacy page-header props, unused module classes | 15 / ~161 | — | invisible; removes the trap that made this happen; lowers `check:old-look`'s baseline |

**Order.** S1 first — smallest and on every screen. S2 next — the screen that started this, and nobody else owns
it. S3, then S4 once its rulings exist. S5 can run alongside any stage (dead code), but each removal locks in
with `check:old-look --init`.

**Each stage:** build → `verify:changed` → `check:layout --changed` on the touched screens (Warm + Dark) →
`/review` → owner walk (a checkable walk on the hub's QA tab, one purpose) → commit. `/docs` per stage: help
articles quote button wording ("click **Open Registration**") and their `keywords` / `searchText` must follow
the screen (the one-spelling rule). `/demos` once per release: tour narration may quote a renamed button.

### Stage 1 — as built 2026-10-19 (committed `0d5630b4`, guard `59632e43`; owner walk ✅ 2026-10-19 — 15 of 15 steps ticked, Parts A, B, D, E and F marked Pass; Part C (Help) had both steps ticked but no verdict marked)

- **Account menu** (`components/shared/AccountMenu.module.css`): "Signed in as" = the kit eyebrow (`--type-label`,
  0.09em); the email stays the data face at 500 (A2, an address); the Warm/Dark buttons and the rows = the
  portal's menu item (body face, `--type-body` / `--type-support`, 650).
- **Workspaces list / flip list** (`WorkspacesPill.module.css`, `FlipPill.module.css`): names and rows = the
  portal's menu item; the category label = the kit eyebrow; "All workspaces" = body face.
- **Install banner** (`InstallAppPrompt.module.css`): title and button folded to the body face, sentence case, in
  the BASE rule — it is the product's own prompt on every surface, the public pages included (A6).
- **Notifications** (`notifications.module.css`, `notifications-page.module.css`): "Done" = a small body-face
  button; the day dividers = the A4 band heading (display face, 700, caps 0.05em, `--text-secondary`).
- **Weights:** the push banner's button 800 → 650; the phone bar's tab count 800 → 700.
- **Help** (`help.module.css`, shared with the coaches portal and the platform console): contents group heads =
  nav group heading (`--type-label`, 0.1em); the answer-index head, group heading, hub section label, drawer
  eyebrow and sub-topic label = the kit eyebrow (data face, `--type-label`, 0.09em); page, hub and result titles
  900/800 → 700 (A11). The search-result group heads and buttons (C61) stay in S3.
- **Plan drawer** (`PlanArticlePanel.module.css`): eyebrows to the kit eyebrow; headlines 800 → 700; the price
  900 → 700 with `tabular-nums` (A1).
- **Headings** (`app/globals.css`): `:where([data-admin-kit]) :is(h1…h6)` at 700, normal tracking, after the
  global 800 rule — specificity (0,0,1), so a module class that styles its own heading still wins (A5). The
  guest kit carries `data-admin-kit`, so the volunteer shells get it too.
- **The guard (A14):** `scripts/check-admin-type.mjs` (`npm run check:admin-type`, in `verify:changed` after
  `check:old-look`), baseline `scripts/.admin-type-baseline.json` = 93 files · face 221 · caps 193 · track 11 ·
  heavy 97 at its creation. An allowed role is marked `type-ok: <role>` on its line; every Stage 1 rule that
  keeps capitals or the data face is marked.
- **Held, owner question:** the two top-bar PILLS themselves (Workspaces, the public-site pill — S04, S08). They
  wear the platform's nav-label lettering (T1, 2026-08-01: `--nav-label-*`, data face, caps), which the public
  site's Navbar and the signed-in home bar (ConsumerShell `.utilCta`/`.utilLink`) share. Changing only the
  admin/coach strip splits one idiom across bars; changing every bar reaches the public site, which A6 did not
  ask. **Kept as rulings say:** the More sheet's trailing season name (S10, a readout) and the demo dock (A12).
- **Checks:** lint (changed files), public tokens, old look, admin type, module purity, spelling, contrast, text
  contrast, root files all pass. `npm test` fails on three tests in files this stage does not touch, red at HEAD
  from other sessions' commits: the coaches `.occGroupPermit` ink (`527079d1`), the admin rail scrollbar
  (`AdminKitFrame.module.css`, `3ea6f854`) and `check:css-selectors` on `GuidanceRail.module.css` `.context`.
  `check:layout --changed` touches shared sheets (it widens to most screens) — the warm-theme sweep of the whole product ran on staging at the 2026-10-19 promote (master job 282), owner accepted its findings; the dark-theme sweep was not run (owner accepted the skip; run it on staging).

### Stage 2 — drawn 2026-10-19; ⚖ B1–B6 + P1 RULED AS RECOMMENDED 2026-10-19; P2 = Part C PASS (Stage 1 walk closed, 15 of 15, every part Pass)

Owner paste-back 2026-10-19: B1 standard field stacked under one label column · B2 keep the card's own form · B3
read text ≥ 12 px, label over a figure 11 px, on Stage 2's screens · B4 one left edge · B5 band heading + green/amber
square · B6 typed names as typed, automatic names in the generator's words · P1 pills to the body face on the admin
and coach bars now, public bars handed to `PUBLIC_FACE_WARM_PLAN.md` (Coordination) · P2 Part C Pass. Design log
entry 2026-10-19 ("THE BRACKET EDITOR'S CARD IS A REAL FORM…").

**BUILT 2026-10-19, committed `956eea005` 2026-10-19 (owner walk ✅ 2026-10-19, 22 of 22, Parts A–G Pass, no notes: https://claude.ai/artifact/AsKKADRzuoVnkZJmg8uTHw, source
`ADMIN_TYPE_SWEEP_STAGE2_WALK.html`).** Main session: the bracket editor (BracketBuilder card restructure + CSS folded
into base rules, BracketEditor title + B6 save compare + dirty baseline), `displayRoundTitle` house words
(`lib/playoff-bracket.ts`, tests), the clock fix, NumberStepper, P1 pills (CoachTopStrip `.pill`; FlipPill base = body
face, `.strip`/`.publicLook` keep the data face; Navbar + TournamentFlipPill pass `publicLook`). Two helpers: the
schedule (T16–T30 + bracket health panel) and dashboard/check-in/branding/volunteers/landing/words (T01–T15,
T41–T50, S01–S02). Help: "Event settings" ×8, "Resolve temporary facilities" ×3, "venue library" ×1.
- **Departures:** S01 reads "Loading tournament management…" (the LoadingState guard requires "Loading…"); the
  schedule's Current / Projected tags are the kit's info / warning chips (the old tones kept on purpose — a projected
  conflict must not read as a locked one), not the quiet chip the drawing showed.
- **Checks:** lint (0 errors), typecheck, admin-type + old-look (`--init` both, drops locked in: type 87 files ·
  face 177 · caps 165 · track 8 · heavy 61), public tokens, spelling, contrast ×2, css purity, css-selectors (the
  branding `.modeToggleLabel` clash fixed; GuidanceRail `.context` pre-existing), playoff-bracket 119/119.
  `npm test`: 2 failures, both pre-existing in other sessions' files (AdminKitFrame rail scrollbar; coaches
  `.occGroupPermit`). `check:layout` NOT run: the pills and FlipPill are shared chrome, which widens the sweep to the
  whole product, and that sweep runs on staging (owner 2026-10-13).
- **`/review` 2026-10-19** (3 lenses): fixed — an untouched double-elimination bracket read as edited (Cancel asked
  "Discard changes?"); the public pills' size/tracking drift; the lost Current/Projected tone; the hard-coded "Seed
  Round" in the public bracket + PDF. Known, left: a TYPED round name that matches an automatic shape ("Grand Final")
  displays — and on a re-save stores — in the house words (rare); the tab title / legacy nav label "Event Settings"
  (`AdminTitleManager`, `admin-nav-config`, the latter mapped by `admin-kit-nav`); the PDF fixture
  (`scripts/pdf-documents.mjs`) still passes "Tournament Registrations/Results"; dashboard tile eyebrows may ellipsis on
  narrow cards (layout sweep); BracketBuilder's base rules depend on the warm scope (`--home-*`), true everywhere it
  renders today.
- **Owner call raised:** the bracket editor's Field box is its own picker, not the club's one Venue field (Club Tier
  Ask 13); `club-stage6a-guard` only missed it because the box had no label. Adding it to the not-yet list "is a
  decision, not a fix". The typed-location box stays unlabelled until ruled.
- Local "before" captures `.probe/ats2/bracket-edit-8team*.jpg` were overwritten by the after-capture; the published
  drawings keep the originals.

Drawings + calls: `ADMIN_TYPE_SWEEP_STAGE2.html` (its own artifact, linked from the hub; source and build in
`.probe/ats2/`). Bracket editor drawn whole (today from the code's values + a capture of the live demo; proposed)
plus close-ups (the card being edited with measured field heights, double elimination, the health panel open);
the rest of Stage 2 as one today/proposed pair per piece. `/design` ran on the drawings the same day: 13 of its
15 findings applied (off-ladder 13/17/18/28 px removed, the three health treatments made one, kit chip recipe,
codes 12/400, field values 400 at the kit field's 7 px corners, Show/Hide 14, the dashboard tile label moved
above its figure); two declined with reasons (a native date/time box shows the computer's own clock format, as
the Game window's does; the round name's hover outline exists today, so it is not new behaviour).

**Found while drawing, beyond the list:**
- **Clock defect (fix in this stage, not a call):** each bracket-editor game prints its stored clock,
  "16:00:00 · Diamond 2" (`BracketBuilder.tsx:117`, `matchup.time` raw) — the settled clock rule says
  "4:00 p.m."; `check:spelling` cannot see a time that comes from data. Use `formatTime()`.
- **Field heights:** the editing card's fields are 19 / 23 / 20 px at 11–12 px text on a desk
  (`BracketBuilder.module.css:125-227`); the phone rule already lifts them to 38 px (`:413`). → **B1**.
- **A second when/where form:** the editor's card edits date/time/field itself; the Game window does it
  everywhere else (and opens from a bracket card in the read view). Recommended keep (the editor is a draft
  saved whole; the Game window saves as you go). → **B2**.
- **Read text under the floor:** 8.6–10 px (health KPI labels `.54rem`, Show `.58rem`, compact meta `.62rem`,
  zoom hint `.68rem`). Size was outside the sweep's four properties. → **B3**.
- **T40 correction:** the bracket's automatic round labels ("Grand Final", "Winners Bracket") are KEYS the
  engine matches on (`lib/schedule-words.ts` `roundWord`/`bandWord` switch on them). "Sentence case in the data"
  would break that; display through the words layer instead. Organizer-typed names (`games.round_label`) show
  as typed. → **B6**.
- **P1 widened:** the Workspaces and flip pills also render on the public bars (marketing `Navbar`, public
  tournament `TournamentFlipPill`, `ConsumerNav`), whose own links are mono caps and belong to the queued
  "public face, warm" project. The admin/coach strip's pill lettering comes from the strip's own class
  (`CoachTopStrip.module.css:103`), so the signed-in bars can change alone.

### Stage 3 — drawn 2026-10-19; ⚖ C1–C5 RULED AS RECOMMENDED 2026-10-19 (owner paste-back); building

Drawings + calls: https://claude.ai/artifact/8Ypx95Zk9NP8ceihUGdw5F (source `ADMIN_TYPE_SWEEP_STAGE3.html`; build
`.probe/ats3/build.mjs`, captures `.probe/ats3/pairs.mjs`). Linked from the hub (v6). Today = read-only captures of the
live dev screens (navigate, scroll, and the help search box only; nothing clicked or saved): `uat-rep-club` owner +
treasurer, `dev-league-org` (League Plus) for Plan & billing. Proposed = the same live page with the proposed CSS (kit
tokens) and words applied in the browser. Drawn from code values instead: the next-season chooser (only inside the
founding-season card window) and first-run setup's Automation / Review rows (needs a League-plan owner with no seasons).
Tournament-plan orgs never reach `/admin/org/billing` (`proxy.ts` bounces `admin/org/*`), so "non-Club plans" = League.

**Rulings (owner paste-back 2026-10-19, all option 1):** C1 the editor's lettering handed to Club Tier Stage 4 (one
line added to its Stage 4 entry; its "Access Restricted" is the last Title Case refusal heading until then) · C2 status
words one spelling, sentence case, product-wide · C3 a screen's name in a sentence keeps the menu's spelling · C4 all
five fixed in Stage 3 · C5 done 2026-10-19 (dev `tournaments` row `uat-phase2c-plus-championship-2026`
theme_primary/theme_accent back to NULL). Design log entry 2026-10-19 (C2 + C3).

**Calls (as asked):** C1 public-site editor → hand to Club Tier Stage 4 (4c rebuilds it; rec) · C2 status words one spelling
product-wide, sentence case (rec) · C3 a screen's name inside a button keeps the menu's spelling (rec: C27, C34 "Open
Allocations", C35 = no change) · C4 four untrue words + one defect, fix in Stage 3 (rec) · C5 put Stage 2's stray theme
colours on `uat-phase2c-plus-championship-2026` back to NULL (rec).

**Census corrections found drawing (each re-read in code):**
- **C2's premise was wrong.** "Pending Review" already has two spellings: Title Case in `lib/game-day-words.ts:41`,
  `lib/coaches-status.ts:17`, HL registrations `:30,:80`, `StatusLookupForm.tsx:7`; sentence case in rep tryouts
  `:58`, `TryoutDialogs.tsx:26`, HL notifications `:31`, the HL email route `:137`, `lib/tournament-schedule-status.ts:36`,
  `lib/registration-attention.ts:101`. "Registration Open/Closed": Title Case in four duplicate maps (HL ×2, public
  `league/page.tsx:13`, `league/[seasonSlug]/page.tsx:13`); tournaments say "Registration open" (`lib/registration-words.ts:29`).
  All display-only (stored codes `pending_review`, `registration_open`); tests pin some (`game-day-rule`, `schedule-day`,
  `registrable-teams`). `REG_STATUS_LABEL` also fills the registrations export's Status cells (A7 covers headings only).
- **C05** is not Past seasons / Team history: `.detailSectionTitle` = Shared library cards; `.renameSectionLabel` =
  Rename web addresses, drawn as the A4 band heading (it splits one list), not a section title. `.summaryCardLabel` and
  `.sectionTitle` in `rep-teams.module.css` are unused → S5.
- **C64:** only `.helpLink` renders; the panel/entry/highlight/see-all classes in `whats-new.module.css` are dead → S5.
- **C56–C58:** zone pills already done (Toolbar Rules, shared ViewPills); Stage 1 fixed Done in the drawer only, the page's
  `.clearBtn` is still mono caps. Beyond the list: both `.sectionHeader` rules (page and drawer) → band face, amber kept.
- **C61:** group heads → band heading (olive, like the contents rail); the per-result label → kit eyebrow (olive). Not
  "normal font" as the census said.
- **C12, C52, C53, C28:** the words underneath are already sentence case; only the capitals CSS goes.
- **Found beyond the list:** HL Send notification's Waitlist / Pending review audiences send to nobody (page posts
  `waitlist`/`pending`, real statuses `waitlisted`/`pending_review`; the route returns `{sent:0}`, no error) — C4(5);
  billing "via Manage Subscription below" names no button (C4(1)); onboarding "Go to Dashboard" (C4(2)); PDF "in Org
  Settings" (C4(3)); history `[yearId]:312` shows every non-head staff member as "Assistant Coach" (C4(4)); onboarding
  "Free League includes…" and the League billing page's "outside your tournament" copy → /marketing.
- **Build notes:** "Access Restricted" is matched case-sensitively by `scripts/admin-identity.mjs:207` and
  `scripts/check-layout-invariants.mjs:244` (not watched automation; add the new spelling); `scripts/layout-screens.mjs:374`
  finds HL "Add Game" exactly and fails silently; `scripts/.layout-baseline.json` keys on button text (re-baseline);
  the onboarding placeholder "2026 House League" mirrors the saved default name (`:110`) — keep both.

**`/design` 2026-10-19 (15 findings):** applied — help search group heads as band headings (they had matched the
labels inside them); card prices onto the ladder (`--type-title`; the chooser's bare figure `--type-figure`); the page's
Unread/All toggle to the drawer's (`--type-body` 600) and both Needs-attention heads together; Review values to 14 px;
the colour-code capture re-taken; build notes for the PDF section part, the Shared library indent, long result labels.
Declined — a larger Ledger balance label (K-01 dense register; a 14 px label beside a 12 px amount splits the row);
flipping Stage 1's hub "GUIDES" to a band (it heads the one card set; Rename splits one list); "STATUS" on the season
lifecycle bar stays an eyebrow (it names the bar). Open for S4: the season card title's condensed display face.

### Stage 3 — as built 2026-10-19 (committed `e83c58223` 2026-10-19; owner walk ✅ 2026-10-19 — 25 of 25 steps ticked, Parts A–H all Pass, no notes: https://claude.ai/artifact/VEFsFQkei7kJA52bb5sVJM, source `ADMIN_TYPE_SWEEP_STAGE3_WALK.html`)

Four parallel helpers on disjoint files (3a house league · 3b/3c rep teams, money, PDF, billing, onboarding · C2 words +
help content · 3d shared parts), then the main session. File list: `.probe/ats3/files.txt` plus the review fixes below.
- **3a:** base `.sectionTitle` = section title (also Player / Guardian / parent / Assignment in Add registration, Sent
  history, Player pool — all group titles); the eyebrow group keeps the labels over values (`type-ok: eyebrow`); `.gameVs`
  body face; the Generate window's kx leak fixed; LeagueCapUpgrade heading; every word in the §4 words table; C4(5) the
  Send notification payload sends `waitlisted` / `pending_review`; scripts accept "Access restricted", layout-screens finds
  "Add game".
- **3b/3c:** `.detailSectionTitle` section title (+ the description's indent); `.renameSectionLabel` band heading;
  type-ok markers in RepKit / Schedules; Ledger `balLabel` caps off; "Category / line item" (admin + coach twin); PDF
  settings h2s use `repKit.sectionTitle` + a 1rem step, the colour code on `--font-data` 400; billing figures (card price
  `--type-title`, next-season price `--type-figure`, unit/save/guarantee/plan label on the body face); onboarding
  Automation + Review rows; C4(1)–(4): "Payment method & invoices", "Go to Overview" (+ "from the Tournaments page."),
  "in Settings", the past-season staff role via `staffKindWord(resolveCoachCapabilities(...))`.
- **C2 + help:** `game-day-words`, `coaches-status` ("Pending review", "Not accepted" — owner C2's rule covers every
  status word), StatusLookupForm, event settings hint, release notes, public league pages (status map + "View season",
  "Season dates", "Registration fee", "Register now", "Final standings", "Current / Past seasons", "Season active /
  complete"), tests (`game-day-rule`, `schedule-day`, `registrable-teams`); help: status words, the house league tab
  names as the screen shows them, "Org admin & setup", "Exports & downloads" (+ link labels, platform console hub), role
  names per A8, Accounting's refusal described as the redirect it is, "Organization → PDF settings", the renamed buttons
  help quotes (house league, registrations).
- **3d:** notifications page toggle = the drawer's (`--type-body` 600), Done = the drawer's small button, time body
  face, both Needs-attention heads band face (amber kept); help search group heads band, result label eyebrow (one line;
  the list column `minmax(0,1fr)` so it truncates), hub count body face, "Search results"; What's new link body face,
  "What’s new"; hub titles + role paths per A8.
- **Review fixes (main session):** "League admin" / "League registrar" on the workspace badges (`lib/user-contexts.ts`);
  Organization tile "PDF settings"; public team page "Register now →", "Past seasons"; champions "Final standings";
  coach budget "Save changes" + its help; platform help "Coach or rep program admin".
- **Departures:** the census's C61 "normal font" → band + eyebrow (`/design`); C05 → Shared library + Rename; "Not
  accepted" added under C2's rule.
- **Checks:** typecheck ✓ (after `next typegen`); `npm test` 8222 pass, the same 2 failures as at the start (club-stage6c
  rail scrollbar; coach-semantic-ink), both in files this stage does not touch; spelling ✓; admin-type + old-look `--init`:
  **type 83 files · face 154 · caps 141 · track 8 · heavy 57** (Stage 2: 87 · 177 · 165 · 8 · 61); old-look kitScope 414;
  css purity, public tokens, contrast ×2 ✓; css-selectors red only on the pre-existing GuidanceRail `.context`; eslint 0
  errors on changed files. `check:layout` NOT run: help and notifications are shared chrome (whole-product sweep → staging).
  Dev server restarted (inner process; the supervisor brought it back) and answers 200.
- **`/review` 2026-10-19 (3 lenses, no Critical/High):** fixed — the help result list could widen at 390 px; the review
  fixes above. Known, left: `scripts/.layout-baseline.json` keys ~25 entries by renamed button text (renew at the staging
  sweep, with their reasons); a send to an empty audience says "Email sent — 0 delivered" with no explanation; the past
  season's staff word comes from the grants fallback (no stored staff kind on that record); the notifications page's
  selected toggle is blue, the drawer's lime (colour, not lettering); house league's legacy `.pageTitle` / data-face
  branches (old-look, S5); `lib/email.ts` "Go to Dashboard →" (email, public face warm); the public footer's "What’s New"
  and the changelog title (/marketing); the coach portal's own "Add Game / Add Practice" help mentions (its screens not
  swept); "Season Registrations" PDF title and the Excel headings (A7); the editor's "Access Restricted" (Club Tier Stage 4,
  C1); onboarding's "Free League includes…" and the League billing page's "outside your tournament" copy (/marketing).

### Stage 4 — drawn 2026-10-19 through `/design`; ⚖ D1–D3 RULED AS RECOMMENDED 2026-10-19 (owner paste-back; design log entry the same day); build prompt `ADMIN_TYPE_SWEEP_STAGE4_BUILD_PROMPT.md`

Drawings (own artifact): https://claude.ai/artifact/YQ9CZWXgL9pjo8GvXpw2wH — source `ADMIN_TYPE_SWEEP_STAGE4.html`,
built by `node .probe/ats4/prep.cjs && node .probe/ats4/build.mjs`; captures `.probe/ats4/pairs.mjs` + `page24.mjs`
(read-only; proposed = the live page with the face/CSS changed in the browser). Hub v10 links it. `npm test` at the
start: 8225 / 8227, the same two red as Stage 3 (club-stage6c rail scrollbar; coach-semantic-ink).

- **The re-check of §7 S4 (29 rows):** done 5 (C59, S12, S13, S18, S19) · partly 5 (T09 — the dashboard pill went with
  Schedule health `ac8c4b82`, the Schedule's `.healthJumpChip` remains; T38 — "Editing bracket" is a heading, the Tiers
  sentence at `BracketEditor.tsx:497` remains; T46 — one placeholder `registrations/page.tsx:2251` + four more typed
  "..." found: onboarding `Saving...`, billing `Applying...` / `Redirecting...`, `ExportMenu.tsx:295` `Exporting...`;
  C45 — `.productEyebrow` / `.foundingSeasonEyebrow` / `.nextSeasonChosenEyebrow` remain, `.nextSeasonPlanLabel`'s
  comment at :951 is stale; S17 — `.helpRoleLine` :632, `.helpDrawerShortcutsTitle` :1694, toc heads :388/:438 at 0.1em)
  · still true 18 · **moved 1: C65 is `/account/notifications` (`AccountNotificationsClient.tsx:18`), not org settings
  → D3.** S13's sibling `.dropCount` (`CoachesBottomNav.module.css:276`, 800) joins the chips. "Event Settings" /
  "Tournament Settings" / "Tournament Branding" / "Org Notifications" remain in `AdminTitleManager.tsx:29-40` (tab
  titles); chat's `NewRoomDialog.tsx:98` too. House league `.draftTitle` (`house-league.module.css:1454`) = display face.
- **Handed-over lines (Stage 3's unmarked):** mostly ALLOWED roles → `type-ok` only (RepKit `.sectionMeta` face,
  `.rowBandCount`, `.table th`, `.chip`; Schedules `.reviewChip`, `.bandLabel`, `.dayBand`, `.gh`, `.fairTable th`,
  `.pdayHead`; onboarding `.foundingSeasonBannerEyebrow`, `.wizardChrome` = step readout; billing `.productEyebrow`,
  `.comingSoonBadge` (chip), `.foundingSeasonEyebrow`, `.nextSeasonChosenEyebrow`; rep-teams `.badge`,
  `.renameCurrentSlug`, `.renamePreview`; bring-in `.count`, `.eye`; PlanArticlePanel `.stepNum`). DRIFT: RepKit
  `.sectionMeta` caps; Schedules `.score` 800; onboarding `.title` / `.modalTitle` (data face 900), `.wizardChrome`
  caps, page.tsx:1090 sentence; billing heavies (`.billingNudgeTitle`, `.sectionTitle`, `.planCardName`,
  `.comingSoonBadge`, `.cancelImpactSection h3`, `.foundingSeasonTitle`) + 0.12/0.14em eyebrows; bring-in `.count`
  caps, `.eye` 600/0.05em. DEAD → S5: billing `.priceUnit`, rep-teams `.pageTitle`, `.summaryCardLabel`, `.sectionTitle`.
- **D1 — the census widened the page-title question.** `app/globals.css:1605` sets h1–h6 to `--font-display` 800; the
  admin override (:1615) changes only weight/tracking; so page titles (`AdminPageHeader.module.css:39`, coaches
  `.pageTitle` :1552), club card titles (`ClubKit .sectionTitle`, `Settings .cardTitle`, `Billing .planName/.cardTitle`),
  every window title (`KitDialog .title`, house league `.modalTitle`), coach `.pageSectionTitle` (inherits) and the
  coach headlines are condensed. Stage 3's A3 moves (house league `.sectionTitle`, `.detailSectionTitle`, PDF h2s) are
  plain; its cited reason "as the coaches portal's sections do" was false (coach sections are condensed); A3 stands
  on its own. **Measured on screen: the condensed face reads ~a size smaller than Inter, so a condensed 20 px page title
  over Inter 16 px card titles loses the hierarchy, and at 24 px only just clears it** (drawings tab 1, "the step").
  Recommendation therefore = **option 1, every heading in the plain face incl. the page title, both portals** (the
  written target F2 / A3 / §2). Options: 2 every heading condensed (~10 places, reverses A3; 16 px lowercase closes up) ·
  3 condensed page title only at 24 px · 4 as is. In every option a team's name stays plain (coach `.teamHeaderName`,
  owner pick 2026-08-02) and a condensed BUTTON (coach Money "Build your budget") goes plain. If ruled 1: its own part
  + walk; the global rule scoped to `[data-admin-kit]` + the coaches shell, plus ~30 explicit `--font-display` title rules.
- **D2** the Unread / All toggle: page `.segBtnActive` (`notifications-page.module.css:120`, blueprint-blue 0.35 → khaki
  on Warm) vs drawer (`notifications.module.css:217`, `--logic-lime` → solid olive on the admin; coach warm override
  :219 → dark ink). Rec: both take the ViewPills chosen look (`ViewPills.module.css:28`).
- **D3** Account → Notification settings is every signed-in person's page, mono sentences throughout; nobody owns it
  (`PUBLIC_FACE_WARM_PLAN.md:33` treats the account tab as done). Rec: the whole page in Stage 4 (PreferencesTable,
  the account client, PushDeviceTester).
- **`/design` (helper, 15 findings, all applied or answered):** D1 recommendation moved from "condensed page title only"
  to "every heading plain" after the hierarchy finding (verified with a 24 px capture); D1 reframed from the written
  target; team-name caveat; C46 savings line = body 12/650 olive, not a chip (A1); T22 foot = mono 12 px readout; T38
  sentence = 12 px secondary caption; two invisible tracking moves tagged UNCHANGED; D2 notes (replaces the coach
  drawer's dark ink; two tinted "All"s told apart by shape); **C36 reversed to UNCHANGED** — the Send email sample draws
  the real family email (`lib/family-email.ts:140`: Inter 900 0.14em caps), so it stays matched, `type-ok` only. Build
  notes: `KIT_INK.head` (`kit-inline.ts:68`) is body 650 no caps while standard §3.2 says the display face — reconcile
  before C24/C29/C66; C23 chips must fit the 6.7rem kind column and not stretch on a phone.
- Build parts after the rulings (disjoint files, as the prompt): tournament admin · club kit + money · billing +
  onboarding + handed-over lines · shared parts (FormTable, FilterPill, PayeeCombobox, help, notifications, plan drawer,
  the toggle) · the heading face (D1) as its own part · the account page (D3).

### Stage 4 — as built 2026-10-20 (committed `eb0a2609e` 2026-10-20; owner walk ✅ 2026-10-20 — 30 of 30 steps ticked, Parts A–J all Pass, no notes: https://claude.ai/artifact/21EACBfw6L6dTkbPVNAfGD, source `ADMIN_TYPE_SWEEP_STAGE4_WALK.html`)

Five parallel helpers on disjoint files (4a tournament · 4b club kit + money · 4c billing + onboarding · 4d shared parts + the
toggle · 4e the account page), then 4f in the main session after a read-only census of every `--font-display` rule. File
list: `.probe/ats4b/files.txt`; the 4f edit script `.probe/ats4b/d1.cjs` (+ `pin.cjs`).
- **4a:** `.healthJumpChip` + `.nowLabel` chips (700); Match typed locations' label = eyebrow, its count a 12 px readout;
  Tiers = eyebrow "Tiers" + caption "Split the N seeds into separate brackets."; "…" in the payment-instructions
  placeholder; browser tab titles in sentence case — the four listed plus "Organization settings", "Preview site",
  "Tournament dashboard", "Rules & resources" (the rail's words); chat's "Event settings".
- **4b:** `.sectionMeta` / bring-in `.count` caps off (readouts); `.eye`, `.bandLabel`, VenueLibrary `.sectionHead`,
  FiscalYear `.qHead` / `.pathKey` = eyebrows; `.attentionKind` = an amber chip — `.attentionRow` became a grid
  (`6.7rem 1fr auto`) so the chip sizes to its words, own row on a phone (the 13-letter kinds fit with ~3 px to spare);
  `.fairTable th`, `TeamBudgetItems .th` = column headings; `.optTier` chip (it also renders in the coaches portal's
  budget pickers); Settings labels at `--type-label`; `.score` 700; every handed-over allowed line marked.
  **C36:** `.envelopeKicker` unchanged and marked, but it is NOT an exact match to the email (sample 800 / 0.12em,
  email 900 / 0.14em, `lib/family-email.ts:140`) — left as drawn; a finding, not a fix.
- **4c:** billing eyebrows + "Coming soon" chip; `.savingsBadge` body face 12 px / 650 olive (still a bordered tint —
  design call); heavies 700; onboarding titles body face 700 (the kit layer set the display face too); the public-link
  hint a 12 px sentence with only `/league/{slug}` in the data face (the address lost its lime); "Saving…", "Applying…",
  "Redirecting…" (the last two live in the plan drawer, `PlanArticlePanel.tsx`), "Exporting…" (`components/admin/ExportMenu.tsx`).
- **4d:** PayeeCombobox group label = band heading at the menu's `--type-label`; FilterPill custom-range label = eyebrow
  (the coaches' DateRangeDropdown wears the same module); FormTable heads/bands = display face (callers: Allocation, New
  schedule, the tournament setup wizard); help role line + shortcuts title = eyebrows, contents group heads 0.09em;
  `.dropCount` 700. **D2:** the page's and the drawer's `.segBtnActive` and the coaches page's own `.segBtnNarrowOn`
  (the coaches Notifications page has its OWN toggle in `coaches.module.css`, not the shared one) = the view pill's
  tint + olive word, the pill's 1 px olive edge drawn as an inset ring (these halves have no border of their own); the
  coach drawer's dark-ink override deleted; a Warm `.segBtnNarrowOn` rule so hover keeps the olive look.
- **4e (D3):** the page is `app/(consumer)/account/notifications/`; column headings + band rows in the display face,
  sentences, notes, "Signed in as…", "Organization access" body face, role tag + "This device" chips, heavies 700.
  ⚠ The consumer shell does not remap `--text-secondary` (only the coach marker does) — those headings use `--home-dim`.
  The account page's own title stays condensed (consumer shell, outside D1's two portals) — raised to the owner.
- **4f (D1):** a face-only rule `:where([data-admin-kit], [data-coach-warm-enabled]) :is(h1…h6)` (public preview exempt)
  in `app/globals.css`, beside the A5 weight rule; the legacy admin `.modal-header h3` body face; 43 module title/figure
  rules + the coaches `.pageTitle` + the schedule's inline window-title style → body face (figures tabular); the
  coaches `.calNavLabel` normal tracking. **Wider than the prompt's list (inside D1's own words):** the coaches portal's
  ~70 GLOBAL `.btn` uses ("Build your budget", "Start session", "Done") kept the display face — the admin and the
  coach window had moved; a face-and-tracking rule `[data-coach-warm-enabled] .btn` (sizes kept). **The global rule's
  reverse side (review):** capitals headings with no face of their own fell to Inter — `.formSectionTitle` (18 form
  section heads), `.roomZoneLabel`, the helper home's `.sectionLabel` now set the display face themselves; the award
  certificate and the development handout PREVIEWS keep the condensed face so they match the printed sheet;
  `.detailSectionTitle` / `.sectionKicker` were left to fall (mostly worn by non-headings, so the odd `<h2>` now matches
  its siblings). Left: PrintedPage, mock portal, public pages, chat (paused), dead rules (branding's second
  `.sectionTitle`, rep-teams `.summaryCardValue`, coaches `.lineupAnalyticsSummary` → S5), the sign-up form title
  (`AccountForm`, The first look). CollapsibleCard's comment corrected (it cited F2 for the display face).
- **Stage 5 build prompt written 2026-10-20** (`ADMIN_TYPE_SWEEP_STAGE5_BUILD_PROMPT.md`) from a re-check of §7 S5: six census rows are NOT dead (D02 eyebrows, D04, D05, D06, D10 — live on public, consumer or platform-admin surfaces; D16 parked), D01 is reachable (owner call E1), D14 has two dead `.sectionTitle`s, onboarding has none.
- **⚖ Owner rulings 2026-10-20 on the hand-off's three calls:** (1) the account notification page's TITLE goes plain
  too — YES; (2) `KIT_INK.head` becomes the standard column heading (display face, capitals) — YES; both are Stage 5's
  part 5a (`ADMIN_TYPE_SWEEP_STAGE5_BUILD_PROMPT.md`). (3) the Send email sample kicker: owner "not sure what the
  difference is" — re-framed: the sample is drawn in the kit's colours (grey kicker on the warm card), the real email
  is a navy card with a blue 900 / 0.14em kicker, so one line matching would change nothing visible; rec leave the
  sample, and the family email's own old navy look belongs to `PUBLIC_FACE_WARM_PLAN.md` ("the other emails").
- **Findings for the owner:** `KIT_INK.head` (body 650, no caps) has two callers, both house league tables
  (notifications `page.tsx:386`, registrations `page.tsx:626` → :794) — the standard says display-face capitals;
  unchanged. The scorekeeper/gate window titles (`.sheetTitle`, empty-state `h2`) go plain with the rule (the
  volunteer shells carry the admin marker); their `h1 .title` keeps its own display face.
- **Checks:** typecheck ✓ (after `next typegen`); `npm test` at the start 8230 / 8234 (the two known + two in the coach
  join page, First look 1c); at the end 8273 / 8299 — every failure outside Stage 4 (Club Tier Stage 4a's guard, being
  built; First look 1d's warm page base; the two known; the join page). Two tests encoded the old look and now hold the
  ruled one (toolbar-rules `.segBtnNarrowOn`, event-settings card title). spelling, css purity, public tokens,
  contrast ×2 ✓; css-selectors red only on the pre-existing GuidanceRail `.context`; eslint 0 errors. admin-type
  `--init`: **type 69 files · face 112 · caps 103 · track 3 · heavy 40** (Stage 3: 83 · 154 · 141 · 8 · 57); old-look
  held (kitScope 414). `check:layout` NOT run: shared chrome in both portals → the whole-product sweep on staging (the
  coach `.btn` face widens buttons a little; `.attentionKind`'s fit wants a look there). Dev server restarted (inner
  process), 200.
- **`/review` 2026-10-20 (2 lenses, no Critical/High after fixes):** fixed — capitals headings losing the condensed face
  (above); the paper previews; the Warm coach hover turning the chosen half ink; the toggle's olive edge inert (no
  border) → inset ring; Match typed locations' label colour a silent no-op under the kit layer; BracketEditor's stale
  comment. Known, left: `.dayBand` / `.gh` / `.pdayHead` at 0.04em (recipe 0.05em, invisible); house league's base
  rules still say display under their kit layers (always in the kit); `.savingsBadge`'s box.

### Stage 5 — as built 2026-10-20 (committed `a57a9a321` 5a + `759d4972d` 5b, help names `30bd68597`, 2026-10-20; owner walk owed: https://claude.ai/artifact/H4STQyxxQQYkszGuyk9mbg, source `ADMIN_TYPE_SWEEP_STAGE5_WALK.html`)

Built from `ADMIN_TYPE_SWEEP_STAGE5_BUILD_PROMPT.md`. Every "dead" claim re-proved by two read-only helpers and a
main-session spot-check (each same-named use traced to a different module); the cut scripts and their logs are in
`.probe/ats5/` (`deadcss.cjs` + `deadcss-run.txt`, `legacy.cjs` + `legacy-removed-*.txt`, `navlabels.cjs`, `callers.cjs`).
- **⚖ E1 RULED 2026-10-20 — owner chose "go to their first door" over the prompt's "always the card"** (session push-back:
  the tile page listed doors the member could open). The tile page, its attention box, upsell teaser and setup link are
  gone; a member who cannot see tournaments goes to the first area whose own gate admits them (Organization admin →
  Public site → Accounting → House league → Rep teams), else the "Access restricted" card. **Review correction:** a
  Tournament / Tournament Plus organization has NO `/admin/org` (proxy + the org layout send it to tournaments — the area
  this member cannot see), so the hub never offers it there; Families is not offered (its gate also refuses a member
  limited to some teams, which the client cannot see — a refused door would loop). **Net:** on the tournament plans, which
  carry neither Organization admin nor Public site, such a member sees the card — the prompt's original rec, reached by the
  owner's rule. The old Organization Admin tile was itself a dead door on those plans. No fixture account is this
  person; the walk's Part B says how to make one.
- **⚖ Account title RULED 2026-10-20 (asked at the start, rec yes):** `account.module.css .title` is shared through
  `composes` by the desktop "Account" heading and the Appearance / Get the app / Help pane headings — all to the body
  face at 700 (was display 800), with the notification page's title. The face is NAMED (`--font-sans`), not deleted: the
  consumer shell has no marker, so the global `h1…h6` rule would hand the display face back.
- **5a:** `KIT_INK.head` = the global `th` values (display, `--type-support`, 700, 0.05em, capitals, `--text-secondary`),
  marked `type-ok: column heading`; its two callers' words are all short nouns. Call 3: the family email's old look is
  already in `PUBLIC_FACE_WARM_PLAN.md` (S3 Emails, Q5) — no line added.
- **5b:** D02's five global classes; D07 the tournament header's console branch (the kit is always on — only the
  `tournaments/preview` island turns it off, and no preview page renders the header) + the props only it read (`icon`,
  `eyebrow`, `subtitle`, `mobileActionsInline`, `className`) from the five callers, and `kitTitle` (Results' title is now
  "Results & scoring" itself; the UAT smoke spec follows); D08 ten unused toolbar parts + their 800 lines of module CSS
  (the module is now `.kitLockedBanner` alone, unscoped; off `ADMIN_COLOUR_DEBT`; off the overlay guard's list); D09 the
  config holds the sentence-case words, `KIT_TOURNAMENT_LABELS` / `kitTournamentLabel` deleted (nothing keyed on the
  words; the nav test now asserts sentence case in the config); D11–D14 (+ branding's dead `.segmentedControl`, schedule's
  dead `@keyframes liveChipPulse`); D15 the nine `legacy` blocks + the prop + their classes; billing `.priceUnit`;
  rep-teams' old header + summary cards (`.pageHeader` … `.summaryCard*`, `.sectionTitle`); coaches
  `.lineupAnalyticsSummary`; What's new's 20 panel classes. House league's three base titles took their kit values and
  lost the layer copy. Branding's `.modeToggle` / `.modeToggleBtn` took their kit values too (the trimmed group rules
  had left each declared twice — `check:css-selectors`, caught by review).
- **5c NOT done — not invisible:** inside the kit every `.btn-data` property is overridden except `gap` (0.28rem vs
  `.btn`'s 0.5rem): stripping it from ~96 buttons widens every icon + word button by ~3.5 px. Left for the FeedbackModal /
  One Window retirement, with the base rule (live outside the kit).
- **Checks:** typecheck ✓ (after `next typegen`); `npm test` at the start 8296 / 8297 (coach-semantic-ink, another
  session's), at the end every failure in `club-frame-guard` (Club Tier 4b-1, untracked, in flight) + coach-semantic-ink;
  the edited files' tests 131 / 131. **admin-type `--init`: 61 files · face 77 · caps 80 · track 1 · heavy 25** (Stage 4:
  69 · 112 · 103 · 3 · 40); **old-look `--init`: 18 files · useAdminKit 6 · kx 75 · helpers 25 · legacy 0 · kitScope 354**
  (Stage 4: 20 · 7 · 75 · 25 · 9 · 414). spelling, css purity, contrast ×2 ✓; public tokens ✓ for these files (red only
  on another session's new `ClubFrame.module.css`); css-selectors red only on the pre-existing GuidanceRail `.context`
  and another session's `Navbar.module.css` (its baseline still lists the classes deleted here — harmless, not
  re-initialised so the other session's dead classes are not swallowed). `check:layout --only=admin-hl-notifications,
  admin-hl-registrations`: no new defect — its 6 "new" entries are the status tabs' baseline keys still in Title Case
  ("Pending Review", "Declined / Withdrawn"), the same 34 px tabs under their sentence-case names; re-key at the next
  staging sweep. No account screen is in the layout list. `globals.css` changed → the whole-product sweep at the next
  staging release. Dev server restarted (inner process), 200.
- **`/review` 2026-10-20 (3 lenses: live-use hunt for every deleted class, prop and label; the hub rewrite + folds):**
  no live use of anything deleted. Fixed: the hub's Organization admin door on tournament plans (Medium), the Families
  door's possible loop (Low), the no-org moment flashing the card (Low), branding's duplicated rules (Medium, a gate), a
  stale test comment, and three pages that still handed Title Case to the browser tab (`usePageTitle` on Results,
  Rules, Venues — Stage 4's walk saw the sentence-case tab, so the shell's title manager usually wins; the words now
  agree either way).

## 5. Parked (owned elsewhere — not this sweep)

- **Chat** (9 items: room subtitle, pinned bar, field labels in caps, tags) — chat is PAUSED (owner 2026-10-18,
  every door hidden). Fix when chat returns; `NewRoomDialog.module.css:156` says "small capitals kept", which
  contradicts One Window Stage 1's label rule.
- **The "Send feedback" window** (7 elements, entirely old) — its own project:
  `FEEDBACK_WINDOW_THEME_HUB.html`, owner asks A1–A6 owed.
- **The old message window** (`FeedbackModal`: 800-weight title, typewriter message) — One Window Stage 3
  replaces it. Its callers' Title Case titles ("Revert Score?", "Reopen Registration?") stay in their screen's
  stage: the window goes, the words are the screen's.
- **Billing mock portal** — not reachable in production (`isBillingMockEnabled` is false there).

## 6. Owner asks — ⚖ ALL FOURTEEN RULED AS RECOMMENDED 2026-10-19

(Owner's paste-back the same day; design log entry 2026-10-19 in `memory/design_decisions.md`; the standard's
band-heading row rewritten per A4; exception register K-10 narrowed to the platform console per A1.)

- **A1 Numbers.** A figure or readout (health score "82 /100", zoom "100%", a game block's time, the stepper,
  jersey number, prices, a notification's time, help hub counts) → normal font with aligned digits. The
  scorekeeper's two big score boxes keep their size and drop to 700. *Rec: yes.*
- **A2 Codes.** A code (game code "R1-1", colour codes, web addresses, the timeline's hour labels) keeps the
  typewriter face, no capitals. *Rec: keep.*
- **A3 A small label used as a title.** Card and section titles drawn in the eyebrow style (house league season
  page, public-site editor, PDF settings, rep-teams detail) → a sentence-case section title in the normal font,
  as the coaches portal's sections do. *Rec: convert.*
- **A4 Band heading recipe.** The written standard says body face, 0.09em, accent ink; what is built (RepKit,
  schedules) is display face, 0.04–0.05em, secondary ink. *Rec: write the standard to what is built.*
- **A5 Heading weight.** Page and card headings with no style of their own fall to the global 800; the window
  title is 700. *Rec: one admin rule — 700.*
- **A6 Shared pieces.** The top bar's Workspaces pill, account menu and flip pill, the notification drawer and
  page, and the help drawer are the same parts in the coaches portal. *Rec: change them everywhere at once —
  one part, one look.* This touches the coaches portal.
- **A7 Excel / CSV column headings** (42: "First Name", "Home Team"…). *Rec: leave* — a spreadsheet heading is
  not screen copy, and a club's formulas or re-imports may key on it.
- **A8 Role names in help** ("Org Admin & Setup", "League Registrar"). *Rec: use the role names exactly as the
  Members screen shows them; everything else on the card in sentence case.*
- **A9 A typed, unverified location** (Match typed locations window) is set in the typewriter face on purpose,
  to say "typed by hand". *Rec: normal font plus an "Unverified" chip — the chip says it in words.*
- **A10 Fact labels** in read-only detail lists (the small label over each value). *Rec: keep as eyebrows* — a
  label over a value is the eyebrow role.
- **A11 The help drawer and hub** (eyebrows at 0.12–0.16em, titles at 800–900). *Rec: the standard eyebrow and
  the window title's weight.* Coordinates with Help system redesign v2 (P3/P4 open).
- **A12 Three odd ones.** Branding's font and card-style tile names → normal font, sentence case; the club name
  under the scorekeeper/gate wordmark → normal font, as typed; the demo dock → keep (the demo's own chrome).
- **A13 House league and the public-site editor** belong to Club Tier Stages 9 and 4, not built yet. *Rec: fix
  them now in S3* — League-plan clubs use house league today, a word or font fix does not constrain the
  rebuild, and the rebuild starts from the right words. Alternative: hand each stage this list as part of its
  definition of done.
- **A14 A guard.** A build check, like the spelling check, that refuses the typewriter face, forced capitals and
  wide tracking outside the roles in §2 — shipped in S1 as a ratchet (per-file counts may only go down), so
  nothing new is added while the sweep runs. *Rec: yes.* It is a new check in `verify:changed`; it needs the
  owner's yes in the conversation that builds it.

## 7. The list (generated from the census, 2026-10-19)

`ref` is the technical anchor at census time; re-read it before editing. Kinds: **old** (breaks the rule),
**ask** (waits for a ruling), **title-case** (words), **drift** (a new-look recipe applied off-recipe), **dead**
(no screen shows it).

### S1 — the frame every screen wears (13 items, 58 elements)

| id | screen | element | today | fix | kind | ask | n | owner | ref |
|---|---|---|---|---|---|---|---|---|---|
| S03 | Every page with a heading that has no style of its own | Plain page and card headings (about 37 headings in ~20 files, plus empty-state titles) | extra-bold (800), a hair of extra spacing | the window title's weight (700), one rule instead of 37 edits | ask | A5 | 37 | none | `app/globals.css:1599` |
| S04 | Top bar → Workspaces pill | The pill that opens the workspace list | typewriter font, all capitals, bold, in a pill (a door set like a chip) | normal font, sentence case | ask | A6 | 1 | none | `components/coaches/CoachTopStrip.module.css:103 (via WorkspacesPill)` |
| S05 | Top bar → Workspaces pill → list | Workspace names and the "All workspaces" link | typewriter font, bold | normal font | old | A6 | 2 | none | `components/shared/WorkspacesPill.module.css:75,82` |
| S06 | Top bar → Account menu | Signed-in name and email | typewriter font, bold, small | normal font for the name; the email may stay typewriter | ask | A6 | 1 | none | `components/shared/AccountMenu.module.css:83` |
| S07 | Top bar → Account menu | Warm / Dark theme buttons and the menu rows "Notification settings", "Send feedback", "Account settings", "Sign out" | typewriter font, bold (menu items and buttons are normal font) | normal font, standard menu items and buttons | old | A6 | 6 | none | `components/shared/AccountMenu.module.css:110,133` |
| S08 | Top bar → "Public site" / "Schedule" flip pill | The pill that flips between public site and admin | typewriter font, bold, in a pill (a door set like a chip) | normal font, sentence case | ask | A6 | 1 | none | `components/shared/FlipPill.module.css:47` |
| S09 | Top bar → flip pill → list | Row labels in the flip pill list | typewriter font, bold | normal font | old | A6 | 1 | none | `FlipPill.module.css:151` |
| S10 | Phone → More sheet | Trailing qualifier on a row (a team's season name) | typewriter font, semi-bold; shared with the coaches sheet | keep as a readout beside a row (lean keep) | ask | A6 | 1 | none | `components/coaches/CoachesBottomNav.module.css:299` |
| S11 | Banner → "Install FieldLogicHQ" | Banner title and the Install button | typewriter font, all capitals, wide spacing (only the volunteer shells get the new look) | normal font, sentence case, standard button | old |  | 2 | none | `components/InstallAppPrompt.module.css:48,75 (override :145,161)` |
| S14 | Bell → Notification drawer | "Clear" buttons in the drawer | typewriter font, all capitals, 0.06–0.08em spacing | standard small button, sentence case | old | A6 | 2 | none | `components/notifications/notifications.module.css:411` |
| S15 | Bell → Notification drawer; More → Notifications page | Day dividers "Today" / "Yesterday" | typewriter font, all capitals, 0.08em spacing | keep as a band heading (lean keep) or the standard band-heading recipe | ask | A4 | 2 | none | `components/notifications/notifications.module.css:283; notifications-page.module.css:214` |
| S20 | Plan upgrade drawer | Price in the drawer | extra-bold (900) | normal font with aligned digits, standard weight | ask | A1 | 1 | none | `PlanArticlePanel.module.css:122` |
| S21 | Demo sites only → demo dock | The whole demo dock (shop-window chrome) | typewriter font, all capitals, extra-bold (800) throughout | keep as the demo's own chrome (lean keep) | ask | A12 | 1 | none | `components/sandbox/SandboxChrome.module.css:70-464` |

### S2 — tournament admin + volunteer screens (48 items, 96 elements)

| id | screen | element | today | fix | kind | ask | n | owner | ref |
|---|---|---|---|---|---|---|---|---|---|
| T01 | Dashboard → Schedule health | Health score box "82 /100" | typewriter font, extra-bold (900) on a figure | normal font with aligned digits, standard weight (a figure) | ask | A1 | 1 | Tournament admin redesign Stage 5 — the board before the event | `app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css:68,70 (page.tsx:579)` |
| T02 | Dashboard → Schedule health | Verdict line "Healthy" / "Review" / "Needs work" | extra-bold (800) | standard weight (the window title's weight) | old |  | 1 | Tournament admin redesign Stage 5 — the board before the event | `dashboard.module.css:80` |
| T03 | Dashboard → Schedule health | Mini-metric tiles "Back-to-back", "Max/day", "Venue moves": the figure and its caption | figure in typewriter font; caption extra-bold (800) | normal font, figure with aligned digits, caption at standard weight | old | A1 | 3 | Tournament admin redesign Stage 5 — the board before the event | `dashboard.module.css:115,129 (page.tsx:592-600)` |
| T04 | Dashboard → Schedule health | Sentence "No major schedule health issues." and the top-issue link | a whole sentence in typewriter font | normal text font | old |  | 2 | Tournament admin redesign Stage 5 — the board before the event | `dashboard.module.css:147 (page.tsx:610,615)` |
| T05 | Dashboard → Customize bar | Bar title "Customize this board" | typewriter font, all capitals, extra-wide spacing, hand-sized | normal font, sentence case: "Customize this board" | old |  | 1 | Tournament admin redesign Stage 5 — the board before the event | `dashboard.module.css:185-189 (page.tsx:632)` |
| T06 | Dashboard → Customize bar | Hint "Choose what this board shows…" | extra-wide letter spacing on a sentence | normal spacing | old |  | 1 | Tournament admin redesign Stage 5 — the board before the event | `dashboard.module.css:195` |
| T07 | Dashboard → Setup guidance rail | Progress line "1 of 2 required items done" | typewriter font, all capitals, extra-wide spacing, hand-sized; a sentence set like a label | normal text font, sentence case | old |  | 1 | Tournament admin redesign Stage 5 — the board before the event | `components/admin/tournament/GuidanceRail.module.css:147-148,200 (GuidanceRail.tsx:150)` |
| T08 | Dashboard → Recent activity | Feed heading "Recent Activity" | typewriter font, all capitals, extra-wide spacing, hand-sized; also Title Case | normal font, sentence case: "Recent activity", at the section-title weight | old |  | 1 | Tournament admin redesign Stage 5 — the board before the event | `components/admin/LiveEventLog.tsx:21,124` |
| T10 | Teams (registrations) | Title and button words in Title Case: "Tournament Registrations", "Reopen Registration?", "Reopen & Unpublish", "Add Team Manually", "Save Team" | Title Case | sentence case: "Tournament registrations", "Reopen registration?", "Reopen and unpublish", "Add team manually", "Save team" | title-case |  | 5 | Tournament admin redesign Stage 2 — Teams and registration | `app/[orgSlug]/admin/tournaments/registrations/page.tsx:983,1138,1141,2158,2214` |
| T11 | Results | Confirm title "Revert Score?" and the export title "Tournament Results" | Title Case | sentence case: "Revert score?", "Tournament results" | title-case |  | 2 | none | `app/[orgSlug]/admin/tournaments/results/page.tsx:319,472` |
| T12 | Results → Export (Excel) | Excel column headings "Home Team", "Home Score", "Away Team", "Away Score", "Submitted By", "Submitted At", "Submission Source" | Title Case | leave as is, or sentence case (owner call) | ask | A7 | 7 | none | `results/page.tsx:72-79` |
| T13 | Check-in → Team sheet | Jersey number in the roster list | typewriter font, extra-bold (800) | normal font with aligned digits, standard weight (an identifier) | ask | A1 | 1 | none | `components/admin/CheckInBoard.module.css:144-146` |
| T14 | Check-in → Team sheet | Date of birth in each roster row | typewriter font on row text | normal text font | old |  | 1 | none | `CheckInBoard.module.css:151` |
| T15 | Check-in → Team sheet | Buttons "Confirm roster", "Cancel", "Save roster", "Check in", "No-show" | extra-bold (800) text (font and case already right) | standard button weight | old |  | 5 | none | `CheckInBoard.module.css:154,165,232,238,247,260,264,277` |
| T16 | Schedule → Health panel | Panel title "Schedule health" / "Bracket health" | extra-bold (800) | standard weight | old |  | 1 | Tournament admin redesign Stage 3 — the schedule | `app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css:44` |
| T17 | Schedule → Health panel | Health score "82 /100" | typewriter font, extra-bold (900) | normal font with aligned digits, standard weight | ask | A1 | 1 | Tournament admin redesign Stage 3 — the schedule | `schedule-admin.module.css:67,73` |
| T18 | Schedule → Health panel | Small labels over each figure ("Conflicts", "Back-to-back"…) | typewriter font, all capitals, extra-wide spacing, extra-bold, hand-sized | the standard small label above a figure | old |  | 4 | Tournament admin redesign Stage 3 — the schedule | `schedule-admin.module.css:358-362` |
| T19 | Schedule → Team list | Tags "Current" / "Projected" beside a team | all capitals, wide spacing, hand-sized (a chip off the chip style) | standard chip | old |  | 2 | Tournament admin redesign Stage 3 — the schedule | `schedule-admin.module.css:530-531,549-550` |
| T20 | Schedule → Banners | Banner headings "3 temporary facilities unresolved", "2 locations typed by hand" | typewriter font, all capitals, extra-wide spacing, extra-bold, on a sentence-length heading | normal font, sentence case, standard weight | old |  | 2 | Tournament admin redesign Stage 3 — the schedule | `schedule-admin.module.css:595-597,1570 (page.tsx:1395,1421)` |
| T21 | Schedule → Match typed locations window | The location name an organizer typed by hand | typewriter font on purpose (marks it unverified) | normal font plus an "Unverified" chip | ask | A9 | 2 | Tournament admin redesign Stage 3 — the schedule | `schedule-admin.module.css:1282 (ResolveLocationsModal.tsx:301,343)` |
| T23 | Schedule → Generate schedule | Score on each option card "82/100" | extra-bold (800) | standard weight | old |  | 1 | Tournament admin redesign Stage 3 — the schedule | `schedule/Generator.module.css:129 (Generator.tsx:1322)` |
| T24 | Schedule | Words in Title Case: "Schedule Health", "Remove Game?", "Could Not Save Rules", "Add Venue", "Resolve Temporary Facilities", "Update Games", "Match Typed Locations", "Import from your Venue Library" | Title Case | sentence case ("Schedule health", "Remove game?"…); "Venue library" may be a feature name | title-case |  | 8 | Tournament admin redesign Stage 3 — the schedule | `schedule/components/ScheduleHealthPanel.tsx:57; schedule/page.tsx:744,964,1409; ResolveFacilitiesModal.tsx:28,74; ResolveLocationsModal.tsx:275; ZeroVenuePrompt.tsx:56` |
| T25 | Schedule → Timeline view | Hour labels down the time axis | typewriter font | keep typewriter font (an axis readout), or normal font with aligned digits | ask | A2 | 1 | Tournament admin redesign Stage 3 — the schedule | `schedule/components/ScheduleTimeline.module.css:108` |
| T26 | Schedule → Timeline view | Venue column headings | extra-bold (800) | standard weight | old |  | 1 | Tournament admin redesign Stage 3 — the schedule | `ScheduleTimeline.module.css:142` |
| T27 | Schedule → Timeline view | Time on each game block "8:00 a.m." | typewriter font, extra-bold (800) | normal font with aligned digits, standard weight | ask | A1 | 1 | Tournament admin redesign Stage 3 — the schedule | `ScheduleTimeline.module.css:216,218` |
| T28 | Schedule → Timeline view | "vs" between the two teams on a block | extra-bold (900) | standard weight | old |  | 1 | Tournament admin redesign Stage 3 — the schedule | `ScheduleTimeline.module.css:257` |
| T29 | Schedule → Timeline view | Tray title "Unscheduled · 4" | typewriter font, all capitals, extra-wide spacing, extra-bold; a heading with a count | normal font, sentence case: "Unscheduled · 4" | old |  | 1 | Tournament admin redesign Stage 3 — the schedule | `ScheduleTimeline.module.css:291-295 (ScheduleTimeline.tsx:546,621)` |
| T30 | Schedule → Timeline view | Time shown while dragging a game | typewriter font, extra-bold (800) | normal font with aligned digits, standard weight | ask | A1 | 1 | Tournament admin redesign Stage 3 — the schedule | `ScheduleTimeline.module.css:511,513` |
| T32 | Schedule → Bracket editor | Round heading "ROUND 1" (an editable box) | typewriter font, all capitals, extra-wide spacing, extra-bold (900) | normal font, sentence case: "Round 1", band-heading weight | old |  | 1 | Tournament admin redesign Stage 3 — the schedule | `schedule/components/BracketBuilder.module.css:33-37 (BracketBuilder.tsx:606)` |
| T33 | Schedule → Bracket editor | Pool heading "POOL A PLAYOFFS" | typewriter font, all capitals, extra-wide spacing, extra-bold (900), large | normal font, sentence case: "Pool A playoffs", section-title weight | old |  | 1 | Tournament admin redesign Stage 3 — the schedule | `BracketBuilder.module.css:313-317 (BracketBuilder.tsx:690)` |
| T34 | Schedule → Bracket editor | Tags "WINNERS" / "LOSERS" above the two brackets | typewriter font, all capitals, widest spacing in the product, extra-bold (900) | the standard band heading | old | A4 | 2 | Tournament admin redesign Stage 3 — the schedule | `BracketBuilder.module.css:446-450 (BracketBuilder.tsx:657,661)` |
| T35 | Schedule → Bracket editor | Game code on each compact card "R1-1" | typewriter font, extra-wide spacing, extra-bold (900) | keep typewriter font, no capitals, standard weight (a code) | ask | A2 | 1 | Tournament admin redesign Stage 3 — the schedule | `BracketBuilder.module.css:482-485 (BracketBuilder.tsx:133)` |
| T36 | Schedule → Bracket editor | "Done" button on a game card | all capitals, wide spacing, extra-bold (800) | standard button | old |  | 1 | Tournament admin redesign Stage 3 — the schedule | `BracketBuilder.module.css:515-517 (BracketBuilder.tsx:282)` |
| T37 | Schedule → Bracket editor | Zoom button "100%" | typewriter font | normal font with aligned digits (it is a button and a figure) | ask | A1 | 1 | Tournament admin redesign Stage 3 — the schedule | `BracketBuilder.module.css:583 (BracketZoomFrame.tsx:108)` |
| T39 | Schedule → Bracket editor | Words in Title Case: "Select Team…" (twice), "Add Matchup", "Add Round", "Delete Round", "Bracket Health", "Playoff Draft Health" | Title Case | sentence case ("Select team…", "Add matchup"…) | title-case |  | 7 | Tournament admin redesign Stage 3 — the schedule | `BracketBuilder.tsx:185,197,611,638,723; BracketEditor.tsx:563; BracketHealthPanel.tsx:22` |
| T40 | Schedule → Playoff bracket view | Words in Title Case: "Grand Final", "Winners Bracket", "Losers Bracket", "Grand Final Game 2 (If Necessary)" (mostly hidden today by forced capitals) | Title Case in the data | sentence case in the data | title-case |  | 4 | Tournament admin redesign Stage 3 — the schedule | `lib/schedule-words.ts:312-337; BracketColumns.tsx:54` |
| T41 | Public site → Branding | Light / Dark mode buttons | extra-bold (800) | standard button weight | old |  | 1 | Tournament admin redesign Stage 5 — Public site | `app/[orgSlug]/admin/tournaments/branding/branding.module.css:335` |
| T42 | Public site → Branding | Font tile names (Inter, System…) and card-style tile names | typewriter font, all capitals, wide spacing (the label style used on an option's name) | normal font, the option's own name in sentence case | ask | A12 | 2 | Tournament admin redesign Stage 5 — Public site | `branding.module.css:538-542 (page.tsx:580,599)` |
| T43 | Public site → Branding | Colour code box (#A1B2C3) | typewriter font, all capitals | keep typewriter font, no capitals (a code) | ask | A2 | 1 | Tournament admin redesign Stage 5 — Public site | `branding/site.module.css:25-27` |
| T44 | Settings → Event settings | Page title "Event Settings" | Title Case | sentence case: "Event settings" | title-case |  | 1 | Tournament admin redesign Stage 5 — the settings screens | `app/[orgSlug]/admin/tournaments/settings/event/page.tsx:109` |
| T45 | Venues → Export (Excel) | Excel column headings "Venue Name", "Facility Type" | Title Case | leave as is, or sentence case (owner call) | ask | A7 | 2 | Tournament admin redesign Stage 5 — Venues | `app/[orgSlug]/admin/tournaments/venues/page.tsx:42,44` |
| T47 | Scorekeeper and Gate screens → top bar | Club name under the LogicHQ wordmark | typewriter font, all capitals, wide spacing (a proper name set in capitals) | normal font, the name as typed | ask | A12 | 1 | Tournament admin redesign Stage 6 — the volunteers | `components/volunteer/DayOfShell.module.css:99-103 (scorekeeper/layout.tsx:119; check-in/layout.tsx:115)` |
| T48 | Scorekeeper → bottom bar | Waiting pill and counts on the Review tab | extra-bold (800–900) | standard weight | old |  | 3 | Tournament admin redesign Stage 6 — the volunteers | `DayOfShell.module.css:244,250,259` |
| T49 | Scorekeeper → Games list | Score shown in each game row | typewriter font on a figure | normal font with aligned digits | old | A1 | 1 | Tournament admin redesign Stage 6 — the volunteers | `app/[orgSlug]/scorekeeper/scorekeeper.module.css:311 (page.tsx:947-952)` |
| T50 | Scorekeeper → Score entry | The two big score boxes | normal font with aligned digits, extra-bold (800) | standard weight (700), or keep heavy for gloved reading (owner call) | ask | A1 | 2 | Tournament admin redesign Stage 6 — the volunteers | `scorekeeper.module.css:410 (page.tsx:736,753)` |
| S01 | /admin landing (tournament-only workspaces) → loading line | "Opening tournament management..." | typewriter font, all capitals, wide spacing; three typed dots instead of the ellipsis | the standard loading line (normal font, sentence): "Opening tournament management…" | old |  | 1 | none | `app/[orgSlug]/admin/AdminHubClient.tsx:183 (rule app/globals.css:1493)` |
| S02 | /admin landing (tournament-only workspaces) → start-up error card | Card title "Tournament management is ready" and "Start setup ->" | extra-bold (900/800) set by hand; a typed arrow "->" | standard heading weight; the arrow mark "→" | old |  | 2 | none | `AdminHubClient.tsx:157,366` |
| S16 | Schedule → Bracket editor | Number in the "Teams advancing" stepper | typewriter font, bold (a count) | normal font with aligned digits | ask | A1 | 2 | Tournament admin redesign Stage 3 — the schedule | `components/admin/NumberStepper.module.css:38,46 (BracketEditor.tsx:465,508)` |

### S3 — club admin (45 items, 194 elements)

| id | screen | element | today | fix | kind | ask | n | owner | ref |
|---|---|---|---|---|---|---|---|---|---|
| C03 | Rep teams → lists and tables | Band row inside a list or table ("U11 Girls") | condensed display font, 0.05em spacing (standard text says normal font, 0.09em) | one band-heading recipe, per the owner ruling | ask | A4 | 1 | none | `components/admin/kit/club/RepKit.module.css:108,393` |
| C04 | Rep teams → team pages | Facts labels in a detail list (the small labels over each value) | typewriter font, all capitals, wide spacing, in a read-only list | keep as eyebrows, or sentence case | ask | A10 | 2 | none | `RepKit.module.css:447,704` |
| C05 | Rep teams → Past seasons, Team history, Rename web addresses, Shared library, Assistant coaches | Card and section titles ("Active teams", detail-section dividers) | typewriter font, all capitals, wide spacing (a small label used as a title) | a sentence-case section title in the normal font | ask | A3 | 4 | none | `app/[orgSlug]/admin/rep-teams/rep-teams.module.css:229,247,311,371` |
| C06 | Rep teams → Past seasons, History, Rename web addresses, Team year page | Words in Title Case: "Access Restricted" (four screens), "Active Teams", "Archived Teams", "Save All Renames", "Schedule & Results", "Head Coach", "Assistant Coach", "Team Event" | Title Case | sentence case ("Access restricted", "Head coach"…) | title-case |  | 11 | none | `rep-teams/past/page.tsx:59; history/page.tsx:59; history/[yearId]/page.tsx:34,116,198,312; rename-slugs/page.tsx:142,174,193,218` |
| C07 | Rep teams → Tryouts → Export (Excel) | Excel column headings "First Name", "Guardian Email", "Consent Given"… | Title Case | leave as is, or sentence case (owner call) | ask | A7 | 11 | none | `app/[orgSlug]/admin/rep-teams/teams/[teamId]/tryouts/page.tsx:68-79` |
| C08 | Rep teams → Roster → Export (Excel) | Excel column headings "First Name", "Last Name", "Date of Birth" | Title Case | leave as is, or sentence case (owner call) | ask | A7 | 3 | none | `rep-teams/teams/[teamId]/roster/page.tsx:33-35` |
| C09 | House league → Schedule → game card | "vs" between team names | small all capitals, semi-bold (the new look only recolours it) | normal text, sentence case | old |  | 1 | Club Tier Stage 9 — house league (to come) | `app/[orgSlug]/admin/house-league/house-league.module.css:1049 (seasons/[seasonId]/schedule/page.tsx:1507)` |
| C10 | House league → Schedule → Generate schedule window | Heading "Preview — N games" | all capitals, wide spacing (a leftover from the old style under the new colours) | normal font, sentence case | old |  | 1 | Club Tier Stage 9 — house league (to come) | `house-league/seasons/[seasonId]/schedule/page.tsx:601` |
| C11 | House league → season page | Card titles drawn with the small-label style | typewriter font, all capitals, wide spacing (a small label used as a title) | a sentence-case section title in the normal font | ask | A3 | 1 | Club Tier Stage 9 — house league (to come) | `house-league.module.css:269,1252` |
| C12 | House league → LeagueCap upgrade prompt (hub and season page) | Upgrade heading | display font, all capitals, wide spacing (hand-set in the code) | normal font, sentence case, the standard heading weight | old |  | 2 | none | `components/admin/LeagueCapUpgrade.tsx:79` |
| C13 | House league → Seasons list | Words in Title Case: "Open Registration", "Close Registration", "Start Season", "Mark Complete", "View Season →", "Create Season", "Access Restricted", status words "Registration Open" / "Registration Closed" | Title Case | sentence case | title-case |  | 10 | Club Tier Stage 9 — house league (to come) | `house-league/page.tsx:40,56-59,213,290,496,622` |
| C14 | House league → Season home | Words in Title Case: transition buttons (Open Registration, Close Registration, Activate Season, Complete Season, Archive Season), "Access Restricted", date labels ("Season Dates", "Registration Opens", "Registration Closes", "Registration Fee"), window titles ("Edit Season", "Add Division", "Edit Division", "Delete Division"), "Save Changes" | Title Case | sentence case | title-case |  | 17 | Club Tier Stage 9 — house league (to come) | `house-league/seasons/[seasonId]/page.tsx:71-75,345,448-468,519,556,711,723,776,827` |
| C15 | House league → Registrations | Words in Title Case: "Pending Review" (four places), "Declined / Withdrawn", "Message Registrants", "Add Registration", "Decline Registration", "Guardian / Parent", "By Division", "By Team", "By Status", "All Active Registrants" | Title Case | sentence case | title-case |  | 17 | Club Tier Stage 9 — house league (to come) | `house-league/seasons/[seasonId]/registrations/page.tsx:30,33,671-1069` |
| C16 | House league → Registrations → Export (Excel) | Excel column headings "First Name", "Guardian Email", "Fee Paid", "Jersey Pref"… | Title Case | leave as is, or sentence case (owner call) | ask | A7 | 12 | Club Tier Stage 9 — house league (to come) | `registrations/page.tsx:90-103` |
| C17 | House league → Schedule | Words in Title Case: "Recurring Series", "Cancel Practice", "Generate Schedule", "Add Game", "Preview Schedule", "Create Series", "Add Practice", "Access Restricted" | Title Case | sentence case | title-case |  | 12 | Club Tier Stage 9 — house league (to come) | `house-league/seasons/[seasonId]/schedule/page.tsx:717,811,1293,1367,1372,1422` |
| C18 | House league → Schedule → Export (Excel) | Excel column headings "Home Team", "Away Team" | Title Case | leave as is, or sentence case (owner call) | ask | A7 | 2 | Club Tier Stage 9 — house league (to come) | `schedule/page.tsx:37,38` |
| C19 | House league → Teams & Draft | Words in Title Case: "Edit Team", "Draft Mode", "Exit Draft", "Finalize Draft", "Start Draft", "Resume Draft", "Clear All Assignments", "Player Pool", "Delete Team", "Randomize Players?", "Clear All"… | Title Case | sentence case | title-case |  | 16 | Club Tier Stage 9 — house league (to come) | `house-league/seasons/[seasonId]/teams/page.tsx:361,426,433,823,847,897,904,919,935,1008,1029,1049,1058` |
| C20 | House league → Teams & Draft → Export (Excel) | Excel column headings "Team Name", "Player Count" | Title Case | leave as is, or sentence case (owner call) | ask | A7 | 2 | Club Tier Stage 9 — house league (to come) | `teams/page.tsx:38,41` |
| C21 | House league → Notifications | Words in Title Case: "Access Restricted", "Admin Only", "Preview Email", "Send Notification" | Title Case | sentence case | title-case |  | 4 | Club Tier Stage 9 — house league (to come) | `house-league/seasons/[seasonId]/notifications/page.tsx:124,134,167,259` |
| C25 | Schedules → schedule detail | Facts labels over each value | typewriter font, all capitals, wide spacing, in a read-only list | keep as eyebrows, or sentence case | ask | A10 | 1 | none | `Schedules.module.css:424` |
| C27 | Organization → Venues | Loading line "Loading the Venue library…" (stray capital V) | Title Case | sentence case: "Loading the venue library…" | title-case |  | 1 | Club Tier Stage 6 — the venue library (built) | `app/[orgSlug]/admin/org/venues/page.tsx:197,421` |
| C28 | Accounting → Ledger | Rows "Starting balance" and "Ending balance" | all capitals, 0.04em spacing | sentence case at the group row's size | old |  | 2 | none | `components/admin/kit/club/money/Money.module.css:134 (accounting/ledger/page.tsx:483-484)` |
| C34 | Accounting → Budget vs. Actual; By activity | Column heading "Category / Line Item"; button "Open Allocations" (Budget window) | Title Case | sentence case ("Category / line item", "Open allocations") | title-case |  | 3 | Club Tier Stage 3 — Accounting (built) | `accounting/budget-vs-actual/page.tsx:373,522; components/admin/kit/club/money/BudgetWindows.tsx:698` |
| C35 | Overview → Club setup checklist | Button words "Open Families", "Go to Overview" | Title Case | sentence case ("Open families", "Go to overview") | title-case |  | 2 | none | `components/admin/kit/club/ClubSetupKit.tsx:152,171` |
| C37 | Members → Export (Excel) | Excel column headings "Display Name", "Last Sign In" | Title Case | leave as is, or sentence case (owner call) | ask | A7 | 2 | none | `components/admin/kit/club/MembersKit.tsx:50,54` |
| C38 | Audit log → Export (Excel) | Excel column heading "Actor Email" | Title Case | leave as is, or sentence case (owner call) | ask | A7 | 1 | none | `components/admin/kit/club/AuditLogKit.tsx:50` |
| C40 | Organization → Settings → PDF and export settings | Section headings ("Filename pattern" and the other page sections) | typewriter font, all capitals, wide spacing (a small label used as a section title) | a sentence-case section title in the normal font | ask | A3 | 1 | none | `app/[orgSlug]/admin/org/settings/pdf/page.tsx:462-466` |
| C41 | Organization → Settings → PDF and export settings | Accent colour code box | a plain "monospace" font set by hand (not the product's typewriter font) | the product's typewriter font, no capitals (a code) | ask | A2 | 1 | none | `org/settings/pdf/page.tsx:322` |
| C42 | Organization → Settings | Words in Title Case: "Save Settings", "View Upgrade Options", "Preview Error", placeholder "Your Organization" | Title Case | sentence case | title-case |  | 4 | none | `org/settings/pdf/page.tsx:119,179,199,214` |
| C43 | Plan & billing (non-Club plans) | Next-season "save" note and the first-charge guarantee sentence | whole sentences in typewriter font, small, widely spaced | normal text font | old |  | 2 | none | `app/[orgSlug]/admin/org/billing/billing.module.css:980,995` |
| C44 | Plan & billing (non-Club plans) | Plan price, next-season price, price unit and the "used / limit" count | money figures in typewriter font, extra-bold (800–900) | normal font with aligned digits | ask | A1 | 4 | none | `billing.module.css:184,469,478,964` |
| C47 | Plan & billing (non-Club plans) | Words in Title Case: "Open Tournament Records", "Reactivate Premium", "Manage Subscription" | Title Case | sentence case ("Reactivate Coaches Portal" is a product name) | title-case |  | 3 | none | `org/billing/page.tsx:662,736,954` |
| C50 | Public site (editor) | Card titles "Page Content", "Social Links", "Display Options" | typewriter font, all capitals, wide spacing (a small label used as a card title); also Title Case | a sentence-case card title in the normal font | ask | A3 | 3 | Club Tier Stage 4 — the public site editor (to come) | `app/[orgSlug]/admin/public-site/public-site.module.css:51,219 (page.tsx:176,239,267)` |
| C51 | Public site (editor) | Words in Title Case: "Page Content", "Social Links", "Display Options", the "Org Settings" link, "Access Restricted" | Title Case | sentence case | title-case |  | 5 | Club Tier Stage 4 — the public site editor (to come) | `public-site/page.tsx:122,176,180,239,267` |
| C52 | First-run setup → Automation step | Block heading "AUTOMATION" | typewriter font, all capitals, extra-wide spacing, extra-bold (900); the new look only recolours it | normal font, sentence case: "Automation" | old |  | 1 | Tournament admin redesign Stage 5 — the first-run setup (F25) | `app/[orgSlug]/admin/onboarding/onboarding.module.css:296 (page.tsx:1256)` |
| C53 | First-run setup → Review step | Row labels "SEASON", "DIVISIONS"… | all capitals, 0.04em spacing, extra-bold (800); only recoloured by the new look | the standard label (normal font, sentence case) | old |  | 4 | Tournament admin redesign Stage 5 — the first-run setup (F25) | `onboarding.module.css:426 (page.tsx:1328-1344)` |
| C55 | First-run setup | Words in Title Case: "Go to Dashboard", placeholder "2026 House League" | Title Case | sentence case | title-case |  | 2 | Tournament admin redesign Stage 5 — the first-run setup (F25) | `onboarding/page.tsx:1062,1523` |
| C56 | More → Notifications (phone page) | Unread / All toggle buttons | typewriter font, all capitals, 0.06em spacing, tiny | standard segmented buttons in the normal font, sentence case | old | A6 | 2 | none | `components/notifications/notifications-page.module.css:140 (NotificationFeedBody.tsx:226,234)` |
| C57 | More → Notifications (phone page) | "Done" button on a notification row | typewriter font, all capitals, 0.08em spacing, tiny | standard small button | old | A6 | 1 | none | `notifications-page.module.css:311 (NotificationFeedBody.tsx:141)` |
| C58 | More → Notifications (desktop) | Zone pills "All" / "Needs attention" / "Activity" | tabs in typewriter font, all capitals | standard tabs in the normal font, sentence case | old | A6 | 3 | none | `notifications-page.module.css:95` |
| C60 | More → Notifications | Time on each item | typewriter font, aligned digits | keep as a readout, or normal font with aligned digits | ask | A1 | 1 | none | `notifications-page.module.css:292` |
| C61 | Help & guides (hub and results) | Search-result group headings and result buttons | all capitals at weight 850; the result button is a button | normal font, sentence case, standard weight | old | A11 | 2 | none | `components/help/help.module.css:1088,1125` |
| C62 | Help & guides (hub) | Count on each hub card | a raw system typewriter font set by hand (not the product's typewriter font) | the product's typewriter font, or the normal font with aligned digits | ask | A1 | 1 | none | `help.module.css:1386` |
| C63 | Help & guides → hub cards | Card titles with role names: "Org Admin & Setup", "Exports & Downloads", "Owner / Org Admin", "Tournament Admin", "League Admin", "League Registrar", "Rep Program Admin", "Help & Guides" | Title Case | sentence case, or keep role names as proper nouns (owner call) | ask | A8 | 8 | none | `app/[orgSlug]/admin/help/page.tsx:90,97,107,125,139,149,160,196` |
| C64 | Help & guides → What's new panel | Panel link, panel title, entry titles, highlight text and "See all" link | typewriter font, with capitals on the link and title (no new-look layer at all) | normal font, sentence case | old | A6 | 5 | none | `components/whats-new/whats-new.module.css:56,100,154,202,217` |

### S4 — new-look drift (29 items, 65 elements)

| id | screen | element | today | fix | kind | ask | n | owner | ref |
|---|---|---|---|---|---|---|---|---|---|
| T09 | Dashboard → Schedule health; Schedule → Health summary | Small pills: "3 issues" on the dashboard and "N conflicts" on the Schedule | typewriter font, all capitals, extra-bold (800); the label style is right, the weight is too heavy | chip weight (700) | drift |  | 2 | Tournament admin redesign Stage 5 — the board before the event | `dashboard.module.css:98-102; schedule-admin.module.css:1099-1101` |
| T22 | Schedule → Match typed locations window | Band label "Already linked to a venue" and the foot line "3 changes · 5 games" | typewriter font; label has hand-sized text, foot has wider-than-standard spacing | the standard eyebrow and readout sizes | drift |  | 2 | Tournament admin redesign Stage 3 — the schedule | `schedule-admin.module.css:1365-1368,1399-1401` |
| T31 | Schedule → Timeline view | "now" marker on the time axis | typewriter font, all capitals, extra-bold (900), hand-sized | the standard chip | drift |  | 1 | Tournament admin redesign Stage 3 — the schedule | `ScheduleTimeline.module.css:540-543` |
| T38 | Schedule → Bracket editor | Small labels "Editing bracket · {division}" and "Tiers — split the N seeds into separate brackets" | an eyebrow style carrying a whole sentence (the old class under the new eyebrow) | a sentence in normal text, with only a short eyebrow word | drift |  | 2 | Tournament admin redesign Stage 3 — the schedule | `app/globals.css:1610; BracketEditor.tsx:76,425,487` |
| T46 | Bracket editor, Resolve-facilities window, Teams | Three typed dots "..." instead of the ellipsis mark: "Select Team...", "Select venue or facility...", "Updating...", "...instructions..." | three typed full stops (about 60 other places use the real ellipsis) | the ellipsis mark "…" | drift |  | 5 | none | `BracketBuilder.tsx:185,197; ResolveFacilitiesModal.tsx:44,74; registrations/page.tsx:2251` |
| C01 | Rep teams → team list and team pages | Count beside a section title ("3 teams") | typewriter font, all capitals, wide spacing (a count is typewriter, no capitals) | typewriter figure, no capitals | drift |  | 1 | none | `components/admin/kit/club/RepKit.module.css:69 (RepKit.tsx:52)` |
| C02 | Rep teams → Bring in a team | Count beside a section title; "What it costs the club" labels | typewriter font, all capitals, spacing and weight a notch off the standard | the standard count and eyebrow | drift |  | 2 | none | `app/[orgSlug]/admin/rep-teams/bring-in/bring-in.module.css:65,87 (page.tsx:297,311-321,351,375)` |
| C22 | Schedules → schedule lists | Band label in a schedule list | typewriter font, all capitals, 0.08em spacing (the standard is 0.09em) | the standard eyebrow | drift |  | 1 | none | `components/admin/kit/club/schedules/Schedules.module.css:51 (ScheduleParts.tsx:38)` |
| C23 | Schedules → Attention rows | Kind labels "Hand-back ask" / "Unsent change" | typewriter font, all capitals, 0.04em spacing (the chip style is 0.06em) | the standard chip | drift |  | 2 | none | `Schedules.module.css:253 (ScheduleAttention.tsx:41,61)` |
| C24 | Schedules → Fair shares | Fair-share table column headings | display font, all capitals, 0.06em spacing (the standard table heading is 0.05em) | the standard table heading | drift |  | 1 | none | `Schedules.module.css:399 (FairShares.tsx:197)` |
| C26 | Organization → Venues → window | Section heading inside the venue window | display font, all capitals, 0.05em (a third recipe for the same role) | the standard eyebrow | drift |  | 1 | none | `components/admin/kit/club/VenueLibrary.module.css:24` |
| C29 | Accounting → Budget → window | Column heading "Team items" table | normal font, all capitals, 0.08em spacing, heavier than standard | the standard table heading | drift |  | 1 | none | `components/accounting/TeamBudgetItems.module.css:48` |
| C30 | Accounting → Budget → item picker | Tier chip | normal font, all capitals, 0.06em (the chip is typewriter) | the standard chip | drift |  | 1 | none | `components/accounting/BudgetItemPicker.module.css:174` |
| C31 | Accounting → payee picker | Group labels "Organization" / "This team" | normal font, all capitals, 0.05em, bold | the standard menu band heading | drift |  | 2 | none | `components/accounting/PayeeCombobox.module.css:121` |
| C32 | Accounting → Fiscal year window | Question heading and path key | typewriter font, all capitals, 0.05em / 0.08em spacing (the standard is 0.09em) | the standard eyebrow | drift |  | 2 | none | `components/admin/kit/club/money/FiscalYear.module.css:107,193` |
| C33 | Accounting → Ledger → Filter → Custom date range | Small label above the custom date boxes | normal font, all capitals, 0.12em spacing | the standard eyebrow | drift |  | 1 | none | `components/shared/FilterPill.module.css:182` |
| C36 | Families → Send email | Small kicker above an email envelope | all capitals, 0.12em spacing, extra-bold (800) | the standard eyebrow | drift |  | 1 | none | `components/admin/kit/club/SendParts.module.css:21` |
| C39 | Organization → Settings | Preview label and stock-logo category label | eyebrow style at a smaller size than the standard eyebrow | the standard eyebrow size | drift |  | 2 | none | `components/admin/kit/club/Settings.module.css:80,158` |
| C45 | Plan & billing (non-Club plans) | Small labels over plan name, price and chosen plan | eyebrow style at off-standard sizes and 0.10–0.14em spacing | the standard eyebrow | drift |  | 4 | none | `billing.module.css:442,876,949,1038` |
| C46 | Plan & billing (non-Club plans) | "Coming soon" tag and savings tag | chip off the chip style: hand-sized, extra-bold (800) / no capitals | the standard chip | drift |  | 2 | none | `billing.module.css:589,668` |
| C54 | First-run setup → season name | Hint "Public link: /league/…" under the season name | a whole sentence in typewriter font, small, widely spaced (only the web address should be typewriter) | normal text sentence with the address in typewriter font | drift |  | 1 | Tournament admin redesign Stage 5 — the first-run setup (F25) | `onboarding/page.tsx:1065` |
| C59 | More → Notifications | Section header "Needs attention" and its count | typewriter font, all capitals, 0.10em, hand-sized | the standard band heading | drift | A6 | 2 | none | `notifications-page.module.css:174,194` |
| C65 | Notification settings (org settings) | Preferences table column headings; the "unsupported" note | typewriter font, all capitals (a table heading is the display font) | the standard table heading | drift |  | 2 | none | `components/notifications/PreferencesTable.module.css:27,55` |
| C66 | Accounting → Allocations, Schedules → New schedule, tournament setup wizard window | Heading row, group name and phone band of the form table | typewriter font, all capitals, 0.05–0.06em (the standard heading is the display font) | the standard table heading and band | drift |  | 3 | none | `components/shared/FormTable.module.css:30,83,167` |
| S12 | Banner → "Turn on notifications" | Enable button | extra-bold (800) | standard button weight | drift |  | 1 | none | `components/notifications/EnablePushBanner.module.css:50` |
| S13 | Phone → bottom bar | Count on a tab | extra-bold (800) | standard count weight | drift |  | 1 | none | `components/coaches/CoachesBottomNav.module.css:115` |
| S17 | Help drawer, Help & guides hub and articles | Small headings and group labels (drawer eyebrow, group headings, hub section label, answer-index head, table-of-contents group head) | all capitals with 0.12–0.16em spacing (the standard is 0.09em) | the standard eyebrow, or sentence-case titles | drift | A11 | 12 | none | `components/help/help.module.css:388,437,690,861,1310,1611,1751` |
| S18 | Help & guides → hub and search results | Page title, hub title and result header | extra-bold (800–900) | the window title's weight (700) | drift | A11 | 3 | none | `help.module.css:621,1072,1251` |
| S19 | Plan upgrade drawer (Plan & billing and every plan-gate prompt) | Drawer eyebrows, section eyebrows, headlines and step labels | eyebrow style at off-standard sizes and 0.10–0.14em spacing; headlines extra-bold (800); step label in capitals | the standard eyebrow and heading weight | drift |  | 4 | none | `components/billing/PlanArticlePanel.module.css:67,79,177,189,257` |

### S5 — dead old look (15 items, 161 elements)

> **⚠ Corrected 2026-10-20 (Stage 5 re-check — the census was wrong on six rows; read this before the table):**
> **NOT dead, left in place:** D02's two eyebrows (`.public-page-header .eyebrow`, `.section-header .eyebrow` — the public
> site, 5 pages + the club home); D04 `.form-label` base (public registration, `RegisterContent.tsx`); D05 `.modal-header
> h3`, `.modal p`, `.modal-footer` (the Send feedback widget renders them outside any marker); D06 `.table-cards
> td[data-label]::before` (three platform-admin screens); D10 CollapsibleCard `.title` / `.meta` and ExportMenu
> `.menuItemLabel` (platform-admin renders both without the kit); D16 parked (One Window Stage 3). **Reachable, not
> dead:** D01 — owner call E1, replaced (Stage 5 as built). **D03 not done** — `.btn-data`'s `gap` still shows inside the
> kit (Stage 5, 5c). **D14** had two dead `.sectionTitle`s, both deleted. Everything else in the table was deleted in
> Stage 5, plus dead neighbours the re-check found (rep-teams' old header + summary cards, branding
> `.segmentedControl`, `@keyframes liveChipPulse`, What's new's panel classes).

| id | screen | element | today | fix | kind | ask | n | owner | ref |
|---|---|---|---|---|---|---|---|---|---|
| D01 | /admin landing (tournament-only workspaces) → tile hub | The old tile hub: page title, tile names, "In League Plus and Club", "Needs attention", "Tournament Management", "Organization Admin" | the whole pre-redesign look (typewriter font, capitals, extra-bold, Title Case); the screen never shows it | delete the unreachable tile page | dead |  | 8 | none | `AdminHubClient.tsx:190,196,232,255-400` |
| D02 | (none) | Old global classes no admin screen uses: .score, .data-mono, .tab-btn, .segmented-control, and the two page-header eyebrows | typewriter font, capitals, wide spacing | delete the rules | dead |  | 6 | none | `app/globals.css:1502,1514,2325,2345,2287,1646` |
| D03 | (none) | The old .btn-data button class on about 94 admin buttons | typewriter, capitals; fully overridden by the new look so the buttons look normal | remove the class from the buttons and delete the rule | dead |  | 94 | none | `app/globals.css:1747,1805,1816` |
| D04 | Organization → Settings → PDF | Old .form-label class (6 labels) | typewriter, capitals; overridden, renders sentence case | delete the old rule | dead |  | 6 | none | `app/globals.css:2098,2048` |
| D05 | (none) | Legacy global window rules (.modal-header h3, .modal p, .modal-footer) and the legacy-window users: registrations (8), Match typed locations, Resolve facilities | typewriter, capitals, wide spacing; overridden | delete the old rules | dead |  | 3 | none | `app/globals.css:2533,2543,2567-2584,2575` |
| D06 | (none) | Old phone card-label rule (.table-cards td[data-label]::before) | capitals, 0.04em; no admin screen uses the class | delete the rule | dead |  | 1 | none | `app/globals.css:2470` |
| D07 | Every tournament screen → page header | Old tournament header branch (eyebrow, title, subtitle, locked banner) | lime capitals typewriter title; only the switched-off branch uses it | delete the branch and its rules | dead |  | 4 | none | `components/admin/tournament/TournamentAdminUI.tsx:96-109; TournamentAdminUI.module.css:21,56-82` |
| D08 | (none) | Unused toolbar parts (ToolbarSelect, SegmentedControl, Menu, SelectionActionBar, StatusLegendPopover "Status Legend", ToolbarCheckItem) | capitals, 0.04em; 0 screens use them | delete the components and rules | dead |  | 6 | none | `TournamentAdminUI.tsx:161-420,367; TournamentAdminUI.module.css:157-453,713-838` |
| D09 | (none) | Title Case navigation words in the config ("Staff Kit", "Event Settings", "Venues & Facilities", "Rules & Resources", "Settings & Access"), mapped to sentence case by a lookup | Title Case in data; the screen shows the mapped sentence case | put the sentence-case words in the config and delete the map | dead |  | 5 | none | `components/admin/admin-nav-config.ts:39,49,50,52,62; lib/admin-kit-nav.ts:310` |
| D10 | (none) | CollapsibleCard title and meta, ExportMenu item label base rules | typewriter, capitals; overridden under the new look | delete the old rules | dead |  | 3 | none | `CollapsibleCard.module.css:56,68; ExportMenu.module.css:90` |
| D11 | (none) | Old page-header styles in admin-common (.pageKicker, .pageTitle, .pageSub, .controlLabel, .controlSelect, .searchInput, .groupHeader) | lime capitals typewriter; no element uses them | delete the unused classes | dead |  | 7 | none | `app/[orgSlug]/admin/admin-common.module.css:47-207,355-400` |
| D12 | Schedule | Six unused classes in the schedule styles (.sheetSectionLabel, .sheetDone, .formLabel, .saveError, .noShowTag, .liveChip) | old caps/typewriter; nothing uses them | delete | dead |  | 6 | none | `schedule-admin.module.css:892-894,923,995,1052,1066,1130,1532` |
| D13 | Schedule → Bracket editor | Unused .roundTitleText class | old caps/typewriter; nothing uses it | delete | dead |  | 1 | none | `BracketBuilder.module.css:322-326` |
| D14 | Public site → Branding | Unused .segmentButton class | old styling; nothing uses it | delete | dead |  | 1 | none | `branding.module.css:44-45` |
| D15 | House league, Public site, Rep teams → page titles | Old page titles and subtitles inside the page-header "legacy" prop (house league ×8 pages, public site, rep teams), plus the old base rules the new look resets | typewriter capitals extra-bold (900) page titles that are never rendered | delete the legacy props and the unused classes | dead |  | 10 | none | `house-league.module.css:34,211,1238; public-site.module.css:28; rep-teams.module.css:47` |

### Parked (14 items, 25 elements)

| id | screen | element | today | fix | kind | ask | n | owner | ref |
|---|---|---|---|---|---|---|---|---|---|
| T51 | Chat (tournament) | Room subtitle under the room name | a phrase in typewriter font | normal text font — parked: Chat is paused (owner 2026-10-18; every door hidden). The components are also shared with the coaches portal chat. | old |  | 1 | Tournament admin redesign — Chat (no stage names it yet) | `components/chat/ChatPanel.module.css:52 (ChatPanel.tsx:1338)` |
| T52 | Chat (tournament) | "Pinned" bar heading | all capitals, wide spacing, extra-bold (800), hand-sized | normal font, sentence case, standard weight — parked: Chat is paused (owner 2026-10-18; every door hidden). The components are also shared with the coaches portal chat. | old |  | 1 | Tournament admin redesign — Chat (no stage names it yet) | `ChatPanel.module.css:89,99-101` |
| T53 | Chat (tournament) | Line "Searching recent messages" | a sentence in all capitals with wide spacing | normal sentence — parked: Chat is paused (owner 2026-10-18; every door hidden). The components are also shared with the coaches portal chat. | old |  | 1 | Tournament admin redesign — Chat (no stage names it yet) | `ChatPanel.module.css:221,226-227 (ChatPanel.tsx:1451)` |
| T54 | Chat (tournament) | "Organizer" and "Muted · until…" tags | all capitals, wide spacing, hand-sized (a chip off the chip style) | standard chip — parked: Chat is paused (owner 2026-10-18; every door hidden). The components are also shared with the coaches portal chat. | old |  | 2 | Tournament admin redesign — Chat (no stage names it yet) | `components/chat/ChatManagePanel.module.css:142-143` |
| T55 | Chat (tournament) | "Jump to latest" pill | extra-bold (800) | standard weight — parked: Chat is paused (owner 2026-10-18; every door hidden). The components are also shared with the coaches portal chat. | old |  | 1 | Tournament admin redesign — Chat (no stage names it yet) | `ChatPanel.module.css:636` |
| T56 | Chat (tournament) | New-room window field labels "ROOM NAME", "DIVISIONS THIS ROOM COVERS" | all capitals, wide spacing (a field label) | sentence-case field label: "Room name" — parked: Chat is paused (owner 2026-10-18; every door hidden). The components are also shared with the coaches portal chat. | old |  | 2 | Tournament admin redesign — Chat (no stage names it yet) | `components/chat/NewRoomDialog.module.css:66,68,158,160 (NewRoomDialog.tsx:80,95)` |
| T57 | Chat (tournament) | Field label in the room settings panel | drawn as an eyebrow (a field label in the label style) | sentence-case field label — parked: Chat is paused (owner 2026-10-18; every door hidden). The components are also shared with the coaches portal chat. | old |  | 1 | Tournament admin redesign — Chat (no stage names it yet) | `components/chat/ChatManagePanel.module.css:161,239` |
| T58 | Chat (tournament) | "New messages" divider and "Reacted" popup title | all capitals, wide spacing, heavy weight (band heading off the recipe) | the standard band heading — parked: Chat is paused (owner 2026-10-18; every door hidden). The components are also shared with the coaches portal chat. | drift |  | 2 | Tournament admin redesign — Chat (no stage names it yet) | `ChatPanel.module.css:359,366-368,996` |
| T59 | Chat (tournament) | Sender name kicker above a message (warm skin) | typewriter font, hand-sized, on a person's name | normal text font — parked: Chat is paused (owner 2026-10-18; every door hidden). The components are also shared with the coaches portal chat. | ask | A6 | 1 | Tournament admin redesign — Chat (no stage names it yet) | `ChatPanel.module.css:1233` |
| C48 | Plan & billing → mock payment portal | Field labels | all capitals, 0.04em spacing | normal font, sentence case — parked: Not customer-facing: the page 404s in production (isBillingMockEnabled returns false when NODE_ENV is production); a developer test stand-in for the payment portal. | old |  | 1 | none | `app/[orgSlug]/admin/org/billing/mock-portal/mock-portal.module.css:53` |
| C49 | Plan & billing → mock payment portal | Words in Title Case: "Manage Subscription", "Back to Subscription" | Title Case | sentence case — parked: Not customer-facing: the mock portal page 404s in production. | title-case |  | 2 | none | `mock-portal/MockPortalClient.tsx:69,116` |
| S22 | More sheet and Account menu → Send feedback window | Type pills, field labels, field text, "(optional)" tag, error and success text | typewriter font for pills, field text and sentences; field labels in capitals; fixed colours that ignore the theme | normal font, sentence-case labels, theme colours — parked: The "Send feedback" window is its own project (docs/projects/active/FEEDBACK_WINDOW_THEME_HUB.html, owner asks A1–A6 owed). | old |  | 7 | none | `components/feedback/FeedbackWidget.module.css:16,50,59,68,96,112` |
| S23 | Confirm and notice windows (13 admin files) | Window title | extra-bold (800) | the window title's weight (700) — parked: FeedbackModal is replaced by One Window Stage 3 (docs/projects/active/ONE_WINDOW_PLAN.md); its words stay with the screens that call it. | drift |  | 1 | none | `components/FeedbackModal.module.css:23` |
| D16 | Confirm and notice windows | Old FeedbackModal message base (typewriter 0.82rem) and its .btn-data buttons | typewriter; overridden by the shell marker | delete with the window — parked: FeedbackModal is replaced by One Window Stage 3; its dead rules go with it. | dead |  | 2 | none | `components/FeedbackModal.module.css:9,31` |
