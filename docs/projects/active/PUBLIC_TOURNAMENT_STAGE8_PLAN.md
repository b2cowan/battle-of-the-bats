# Public tournament pages — Stage 8: the new look on for everyone (plan)

**Status:** asks A to D RULED 2026-11-03, all as recommended (logged in `BUSINESS_DECISIONS.md`, "Tournament branding is a logo, colours and type"). **Part 1 committed `d4af280e6` 2026-11-03** (record §10; it releases with the flip, ruling D). **Part 2 committed `02e29f453` 2026-11-03** (record §11; it releases with the flip too). **Part 3a committed `3304c77fe` 2026-11-03**
(record §12; releases with the flip). **Part 3b committed `9b6252e8a` 2026-11-04** (record §13; releases with the flip). **Part 3c committed `62f5841f9` 2026-11-04**
(record §14; releases with the flip). **Part 3d committed `33386d5df` 2026-11-04** (record §15; releases with the flip; the
switch-off half-state ends for every public tournament page). **The public feed fix committed `55045ecf4` 2026-11-04** (record §16; its own change,
releasable on its own; it does not cherry-pick onto production — §16 handed on). **Part 4 split (owner 2026-11-04): Part 4a (the public side —
the pay page, the admin preview's old chrome, the old tab row and rail, the Rules layout menus, the team page's flag) committed `ecffa177f`
2026-11-04** (record §17; releases with the flip). **Part 4b (the admin side, then the switch itself — deleted) committed
`72cd94a46` 2026-11-04** (record §18; releases with the flip). **Part 4 committed.** **Part 5 (the data and the wording
around it: no second `theme_font` empty, 426's prod timing note; the dictionary and the dead fields un-mapped; the help;
the drift check; the demos) committed `393b78045` 2026-11-04** (record §19; releases with the flip). **Part 5 committed.** Next: Part 6 (verify, walk, release). Brief: `PUBLIC_TOURNAMENT_STAGE8_PM_BRIEF.md`.
**Parent plan:** `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` §9 (the ladder). Stages 0–7 and Stage 1a are built and walked; Stage 8 is the one stage that
changes what a customer sees.
**Sequencing rule (standing):** by dependency and rework risk, never by date. One part per session, `/clear` between.

## 1. What Stage 8 is

Until now every new public page has been built behind a **preview switch** (on in development and in any browser that opened the preview
link; off for customers and the public demo). Stage 8 does three things in one release:

1. **Turns the new look on for everyone, and deletes the old look** (the dark-ground pages, the old Branding page cards, the switch itself).
2. **Makes the installed-app icon always FieldLogicHQ's** (owner ruling 2026-11-03, §2).
3. **Tells customers and the demo about it** (`/docs`, `/demos`, and a `/strategy` drift check on what the plans promise).

Prod today holds **6 tournaments** (read-only count, 2026-11-03): none with a stray default colour; 3 holding an old font value.

## 2. Owner rulings folded in (all 2026-11-03)

| Call | Ruling | What it means here |
|---|---|---|
| 1 Old Font card | Empty `tournaments.theme_font` **once, as a data step at the flip**; no code change before | Part 5. The count says 3 prod rows hold an old value. |
| 2 Old colour picks | Count first, then decide | **Done: 0 need cleanup.** Keep the "own colours" ruling; nothing to run. |
| 3 Installed-app icon | **Always the FieldLogicHQ logo** (reason: one branded ecosystem where one app reaches many teams and tournaments, not a stand-alone builder) | Part 1. See the correction below. |
| 4 Preview-window links | Turn prefetch off before the flip | Part 2. |
| 5 Swatch size | 44 px from tablet width down | **Built and committed 2026-11-03.** |

**Correction to what was said earlier in this chat (checked in the code 2026-11-03):** the installed app's manifest has been FieldLogicHQ-only
since 2026-07-11 (`app/manifest.json/route.ts`; the per-tournament manifest is a redirect to it). The **only** thing a tournament or
organization logo still reaches is the **iOS "Add to Home Screen" icon** (`apple-icon.tsx`); the Android maskable route is orphaned (nothing
links to it). So the ruling removes one iOS icon behaviour and the settings behind it — it does not remove branded installed apps. This is
also a **packaging statement** (§7): PLAN_PRICING_FACTS still promises a custom app name, and BUSINESS_DECISIONS names "the app icon".

## 3. What the code says (census 2026-11-03; every figure re-opened where it drives a decision)

- **The switch** is read in one place (`isPublicFrameOn`, cookie `flhq_public_frame`, on in development) and reaches **17 public-page files,
  13 client components, 5 admin files, 4 API routes, 14 test files and 7 scripts**. About **29 stylesheets** carry rules keyed to
  `data-public-frame`.
- **The old halves are large:** the old Overview is ~1,000 of ~1,200 lines of one file; the old Schedule, Standings, Teams, Rules and legacy
  team-profile components are ~3,800 lines between them; plus the old halves of the game page, Playoffs and Champions pages, the score
  ticker, the old preview nav, and the tournament parts of the Navbar and side rail.
- **Not everything with a frame selector is old.** The light-mode rules in the global stylesheet are **still live under the new look** (the
  tournament layout always sets light). The org-level `theme_font` / `theme_card_style` are **live on club surfaces**. `Home`, `register` and
  `news` styles are shared with pages that never had the switch. Deleting by pattern would break club pages: every removal is by reading
  its importers first.
- **Tests assert source text** (14 files, ~150 lines): they must be rewritten with the code, not just deleted.
- **The demo breaks on the flip** unless fixed first: the tour's step 1 anchors to a section that exists only in the old Overview, and
  step 2 anchors to a bracket that exists only in the old Standings. Both anchors are build-checked, so the build will tell us, but the
  story is wrong either way.

## 4. The parts (one per session)

**Part 1 — The icon ruling (built on `dev` first; it releases WITH the flip, ruling D; the icon route is not behind the switch, so it must not be promoted alone).** Delete the iOS per-tournament icon (so the platform icon applies),
the orphaned maskable route and the logo helper; remove the **App icon card and the App name field** from the old Branding page (a setting
that does nothing is a lie); stop the Branding API reading/writing icon colour, app name and logo size. Keep the three DB columns for now
(§6 ask C). Edit the icon-existence test and the dead-code entry list. *Rework note:* removing the card from the old Branding page is
partly throwaway (Part 4 deletes that page's old cards); accepted, because the ruling reaches customers the moment it ships and a dead
control must not stay.

**Part 2 — Flip preparation (changes nothing customers see).** (a) Move the demo tour's two anchors to surfaces that survive: the Overview
anchor onto the new Overview, the bracket step onto Playoffs (the new Standings draws no bracket; the anchor lives only in Playoffs);
(b) prefetch off on the band's preview links (call 4); (c) re-measure the swatches at 768 on the club editor and the Look card
(`check:layout --changed`); (d) decide what survives of the old Branding page's hero banner (§6 ask A) so Part 4 has a list.

**Part 3 — Public pages: delete the old halves, one page group at a time.** Order by dependency, smallest blast radius first:
(3a) Rules, Teams + team page, Standings; (3b) Schedule + the game page; (3c) Playoffs, Champions, the three share-image routes; (3d) the
Overview (the biggest file) and the tournament layout's `frameOn` branches, the ticker, the side-rail legacy mode, the Navbar's tournament
branch and its context. Each group: remove the `frameOn` branch **and** its old half together, rewrite that group's guard tests, delete
the styles whose last importer went, `check:layout --changed` on the group's screens. The switch itself is still alive until Part 4 — so
every group can be checked on dev against exactly what customers will get.

**Part 4 — Admin side and the switch itself.** The old Branding page's Theme (Dark/Light), Hero banner, Font and Card style cards and
their words, the legacy fields and validation in the Branding API, the hero-banner upload route (per ask A), the admin preview's old
nav/body; then **delete the switch**: the cookie reader, the cookie setter route, the preview-link seed output, the `frameOn` props and
the club editor's/Branding API's `frameOn` return. Rewrite the Stage 1 frame guard (it asserts the cookie semantics). Trim the
create-from-source copy list of the dead columns.

**Part 5 — Data and the wording around it.** (a) The one-time `theme_font` empty (data-only migration + its MANUAL_PROD_STEPS entry, the
426 precedent); (b) `/db`: update the data dictionary and refresh snapshots; (c) `/docs`: the Branding and "public site preview" guides
(they list "hero banner, fonts, and a custom App Icon", an FAQ about a branded icon that gets deleted, "six closed cards: Logo, App icon,
Theme, Hero banner, Font, Card style", and the club guide's line that each tournament picks card style on its Branding page); (d)
`/strategy`: a dated BUSINESS_DECISIONS entry for the icon ruling + the drift check on PLAN_PRICING_FACTS (custom app name) and
`LOCK_WORDS.branding`; (e) `/demos`: re-curate the tour for the new look; remove the old-state theme-variant seed.

**Part 6 — Verify, walk, release.** `/review` on the whole diff (switch-removal is exactly the "touches everything" shape); a layout
sweep on **staging or a local production build, never the dev server** (standing rule); one owner walk with the switch gone (a customer's
view: no preview link needed); read the release-history record; promote; post-release truth-up checklist; `check:demos:prod` the next morning.

## 5. Guardrails that keep this safe

- **Customers never see a half-state:** nothing ships until Part 6. Parts 1–5 all land on `dev` and are promoted together in Part 6 (ruling D:
  the icon change goes WITH the flip, never as its own release).
- **Delete only what has no importer.** Each removal names its importers first; the census flags the shared files (`Home`, `register`,
  `news`, `globals`, `BottomSheet`, `ConsumerShell`, the bracket) that must not go.
- **The migration is data-only and applies BEFORE the code that depends on it** (same rule as 426).
- **No new customer words without `/docs`** and `check:spelling`.

## 6. Asks for the owner (each with my recommendation) — **A, B, C, D all RULED 2026-11-03 as recommended; E needs no ruling**

- **A. The tournament hero banner.** The new look has no hero banner; only the old Overview reads it, and a dashboard "branding done"
  flag still counts it. *Recommend retire it* (delete the upload, stop counting it; keep the column) — a banner the page never shows is the
  same dead-control problem as the icon card. Cost: any organizer who uploaded one loses it; prod has 6 tournaments.
- **B. Dark/Light, card style and per-tournament font choices disappear** for tournaments that set them (the new look is light with the
  Look card's colour and type). *Recommend yes* — it is what Stage 1a's rulings already decided; this just removes the old controls.
- **C. Drop the now-dead columns (`icon_bg_color`, `app_name`, `app_icon_scale`, `color_mode`, `theme_card_style`, hero banner)?**
  *Recommend NOT in this stage:* stop reading and writing them, drop in a later `/db` pass. A drop is irreversible and buys nothing at
  the flip; keeping them costs only a line in the dictionary.
- **D. Release shape.** Icon change (Part 1) as its own release, or together with the flip? *Recommend together:* two customer-visible
  changes to the same Branding page a week apart is worse than one, and the iOS icon is rarely noticed.
- **E. Scorekeeper, check-in, coaches and admin icons** already use the platform icon; nothing to rule. Stated so it is not asked again.

## 7. Cross-agent follow-through

`/strategy` (log the icon ruling; PLAN_PRICING_FACTS custom-app-name line; `LOCK_WORDS.branding` line — Facts doc and code move together),
`/docs` (Part 5c), `/demos` (Part 5e), `/db` (dictionary + snapshots; the optional later column drop), `/review` (Part 6), `/release` (Part 6).
`/accounting`: not involved (nothing charged, invoiced or reported changes).

## 8. Success criteria

A customer opening any public tournament page sees the new look with no step taken; the Branding page shows only controls that do
something; an installed or home-screen icon is always FieldLogicHQ's; the demo's tour lands on every step; no file, style or test
refers to the switch; the build, the unit suite and the staging layout sweep are green.

## 9. What this plan did NOT verify

Read-through of the old Branding page's frame branch was not done (it is not yet confirmed whether the App icon card shows under the new
look today — Part 1 starts there); the importer lists are the census's and are re-opened per removal; no prod state beyond the count above.
*(Answered by Part 1, §10: the card DID show under the new look, all but its App name field.)*

## 10. Part 1 record (committed `d4af280e6` 2026-11-03; releases with the flip)

**What changed for a customer (on dev; nothing promoted):** the Branding page's **App icon card is gone** on both the old page and
the new-look page. The plan's open question is answered: under the frame (`frameOn` true) the card rendered everything but the App name
field (colour chips, custom colour, Logo size slider), so the ruling reached both pages. An iPhone "Add to Home Screen" from a
tournament page now gets the FieldLogicHQ icon: the tournament page's `<head>` carries one `apple-touch-icon`,
`/icons/fl-apple-180.png` (root layout), checked on `riverdale-minor-ball/summer-classic`; `/apple-icon` and `/icon-maskable` under a
tournament now 404. Existing home-screen icons are frozen on the phone and do not change (iOS snapshots at add time).

**Removed:** `app/[orgSlug]/[tournamentSlug]/apple-icon.tsx`, `.../icon-maskable/route.tsx`, `lib/pwa-icon.tsx` (no importer left).
Branding page: the card and everything only it used (App name, the four chips, custom colour, Logo size, `ICON_SCALE_MIN/MAX`,
`ICON_DARK_FALLBACK`, `iconBgSuggested`, `effectiveIconBg`, `iconPreviewPct`, `iconBgWord`, the three draft fields and their
`draftOf`/`bodyOf` lines, the `sameHex` and `ck` imports) and **the frame branch of `previewTheme`**, which existed only for the icon's
"Brand" chip (the switch-off Theme card's low-contrast warning still reads it, now computed inline). `look-draft.ts`: `ICON_SCALE_DEFAULT`,
`iconBg`/`iconScale` in `FrameBodyDraft` and `frameBodyOf`. `branding.module.css`: every `.icon*` rule (base, kit fold, tap floor);
`.fontBtnSample`'s colour folded into its base rule (the `.iconAppName` group had been carrying it). Words: `appIcon`, `appIconSummary`.
API `tournament-branding`: the three fields out of `PLUS_VISUAL_FIELDS`, the GET select and response, the PATCH, `APP_NAME_MAX`, the
icon-scale clamp, `suggestIconBg`, and the **logo fetch + colour sample that ran on every Branding page load** (and its org-logo read);
the band read is now awaited directly (nothing left to run beside it). API `tournament-logo`: the `iconBgSuggested` sample.
`knip.jsonc` entry, the `.tsx-token-baseline.json` entry, the manifest-redirect route's stale comment.

**Kept (as ruled):** the three columns; `lib/db.ts` still reads and clones them and `lib/types.ts` still declares them (Part 4 trims the
clone list with the other dead columns). Everything Part 4 owns (Theme, Hero banner, Font, Card style, `LOCK_WORDS.branding`).
An old browser tab that still sends `iconBgColor`/`appName`/`iconScale` gets 200 and nothing is written (probed).

**Tests:** `public-face-s4-identity` now asserts the two routes and the helper are GONE (plus no file-convention icon under a tournament)
and that the root layout's `fl-apple-180.png` applies; `tournament-look` (the save body carries no icon field; the read guard; the
`PLUS_VISUAL_FIELDS` anchor; the shared `HexField` import) and `tournament-stage5-public-site` (five cards, no App icon words).

**Checks run:** typecheck clean (needs `NODE_OPTIONS=--max-old-space-size=6144`: the default 4 GB heap now runs out on this repo,
unrelated to this change); the 3 affected unit files 73/73; full `npm test` 13,485/13,492, the **7 failures all in other sessions'
uncommitted work** (PhoneWindow overlay guard, plan-billing 503, Stage 6 walk HTML, `seed-plan-ending-walk.mjs` Stripe prefix,
bookkeeping ExpenseFormWindow foot); ESLint clean on every changed file (the changed-files lint runner crashes on a foreign file's
config); tokens, spelling, CSS selectors (after the fold), admin old-look and admin type: no Branding finding. Other gates fail on
foreign work (schema parity, index coverage, org-slug callers, demos, export catalog, root files) — none touch this part. Knip not run
(report-only, no gate runs it). Branding probe (UAT club owner, Tournament Plus owner, three tournaments): page 200, read 200 with no
icon field, save 200, retired columns untouched. Dev server: fully restarted by another session at 9:24 p.m., after this part's file
deletions; `/platform-admin/login` 200, tournament page rendered from the database.

**Review (`/review` 2026-11-03):** no defect found. Confirmed unchanged: no surviving reader of the removed fields outside the kept
`lib/db.ts`/`lib/types.ts` (ruling C); the Theme card's low-contrast warning renders only with the switch off, where the inline
`previewTheme` is the old memo's switch-off branch exactly; the band read gives the same result and the same `.catch → null`; the
`.fontBtnSample` colour is unchanged (the kit-layer override folded into the base rule); `sharp` is still used by four live modules, so no
build config went stale. One gap in the guards closed: `tournament-look` now also asserts the branding route neither reads nor writes
the three icon settings (it only guarded the client's save body). Re-run: 3 unit files 74/74, typecheck, ESLint, spelling, selectors clean.

**Handed on:**
- **Part 2 (c):** `check:layout --only=admin-t-branding,admin-t-branding-look,admin-t-branding-look-club` found 10 NEW tap-floor findings,
  none in this part's code: the Look card's "Public site" link (15 px at 361/390/768) and "The club's look" button (36 px at 768), and a
  shared-chrome "Dismiss" button (34 px square at 361/390/768). Not baselined; Part 2's re-measure decides them.
- **Part 6 (release):** `/release` §1d-2 uses `/{org}/{tournament}/apple-icon` as the canonical deployed `sharp` probe. That route is gone,
  so the probe will 404 and the checklist says STOP. `sharp` is still loaded by `lib/club-email-context.ts`, `lib/export/resolve-pdf-settings.ts`,
  `lib/stock-logo-render.ts` and `lib/sponsor-logo-image.ts`; the release checklist needs a new probe on one of those paths before the promote
  (owner's call to change `.claude/commands/release.md`).
- **Part 5:** help copy, PLAN_PRICING_FACTS' custom app name, and the demo are untouched here, as scoped.
- *(Part 2 (c) decided them: §11.)*

## 11. Part 2 record (flip preparation; committed `02e29f453` 2026-11-03; releases with the flip)

**What a customer sees:** nothing (nothing promoted). An owner walking dev with the new look on would notice two things in the
demo tour, nothing else: step 1 rings the Overview's **Latest results** (the two finished semifinals its sentence names), and
step 2 lands on **Playoffs**, where the new pages draw the bracket. ⚠ **This part releases WITH the flip, never alone** — with the
switch off, step 2 would land on the old Playoffs page, which draws no bracket (the exact defect the owner's third QA pass caught
when the first build sent it there). §5 already guarantees that; stated here because it is now true of Part 2 as well as Part 1.

**(a) The demo tour's anchors.** `lib/sandbox-chrome.ts`: step 1 `#today` (an id only the switch-off Overview's day panel wrote)
→ `[data-sandbox-tour="latest-results"]`, a marker on the new Overview's Latest results section
(`components/public/TournamentOverview.tsx`; the newest three finished games, so the semifinals in the demo's daily snapshot; absent
only before any game is final, when the step's sentence still delivers). Step 2 href `/standings` → `/playoffs`; its marker
`playoff-bracket` was already on the new Playoffs (`PublicPlayoffs.tsx`, guarded by `public-tournament-stage4-guard` and
`public-playoffs-render`; the new Standings' absence of it by `public-standings-render`). The comment above step 2 rewritten (it
explained why the bracket was on Standings). **The guard had two holes, both closed** (`tests/unit/demo-destinations-guard.test.ts`):
- a bare `#id` anchor was allowed and **never checked**, so deleting the old Overview would have passed in silence. Anchors must now
  be `data-sandbox-tour` markers;
- the marker had only to exist **somewhere**. `playoff-bracket` is written by both the old Standings and the new Playoffs, so step 2
  left on `/standings` would have passed after Part 3a deleted the old Standings, ringing nothing. New check: the marker must be in
  the source the destination page imports, via `reachableFrom` — **promoted** from `notification-open-in-place-guard` into
  `tests/unit/_source-code.ts` (now cached per file; that guard imports it) rather than written a fifth time. Markers are read as code
  (comments stripped), the sweep included. Layouts are not walked (none holds a marker); while an old and a new half share a page
  both count, so the page check bites as each old half is deleted. Plus a non-vacuity test that the walk reaches
  `TournamentOverview.tsx` from the Overview page.
- **Mutation-tested** (each reverted after): step 1 back on `#today` → caught; the new Playoffs losing its marker while the old
  Standings still writes it → caught (the case the old guard missed); the new Overview losing its marker → caught; **Part 3a's state**
  (old Standings' marker gone, step 2 still on `/standings`) → caught, naming the page. Step 2 on `/standings` *today* passes, correctly:
  the old Standings still draws the bracket there until Part 3a.
- No demo was re-seeded (demos follow the product).

**(b) Prefetch off on the Look card's preview links (call 4).** `TournamentBand` takes Next's own `prefetch` and carries it to the
name link and to `TournamentTopTabs`, which puts it on every tab it draws; only the Look card passes `false` (its window is an inert iframe at the Branding
address, so the tabs point at `/…/branding/schedule` etc. — 404s a production build would fetch). The live band and the admin preview
(whose links lead somewhere) omit it and keep Next's default. Source guard in `tournament-look.test.ts`: the card passes it, the band
forwards it to both, the frame tab carries it, and the preview's host line is a span (the other Links never render there).

**(c) The swatches re-measured at 768** (`check:layout --only=admin-t-branding,admin-t-branding-look,admin-t-branding-look-club,
admin-public-site-look`, every listed width, on the dev server already up; `--changed` was not used: it reads the whole working tree's
diff, which holds other sessions' files, and measures only 361 + 1440, which skips 768). Part 1's 10 findings, decided:
- **"Public site" link (15 px at 361/390/768) — FIXED.** A link inside a sentence; stood 44 px tall at ≤768 without moving the sentence
  (`LookCard.module.css` `.inlineDoor`: inline-flex, 44 px, `margin-block: -14px` — the club editor's `.textLink` recipe, adopted
  at `/review` over FiscalYear's, which grows the line). "Change the club's look" (`.door`) had the same gap at 641–768 (32 px; it
  renders only under *Always*, so the fixture never showed it) — its compact height now starts at 769.
- **"The club's look" pill (36 px at 768) — FIXED, in the shared Look controls.** Call 5 moved the swatches to 44 px from 768 down but
  left the pill and the Custom colour pickers beside them at 640. Both now follow the swatches, and the four controls' 768 rules are
ONE block so they cannot drift apart again (`LookControls.module.css`). Blast radius:
  the Look controls' two screens only (the tournament Look card and the club editor's Look row). **It also fixed the club editor's
  "From your logo" pill**, 36 px at 768 on the committed code (measured both ways).
- **"Dismiss" (34 px square at 361/390/768) — NOT touched, NOT baselined.** It is the admin context strip's close
  (`components/admin/AdminContextStrip.module.css` `.dismiss`, 34 × 34), mounted by `AdminKitBottomNav`: the phone bar of **every admin
  screen**. It is already in the baseline on all **27** tournament admin screens (reason: null); it reads NEW on
  `admin-t-branding-look` only because that screen was added after the baseline. Baselining it there would record one more
  reasonless copy of a known defect; the honest fix is one rule (44 × 44) in shared chrome, which changes the phone bar on every
  admin screen and clears ~160 baseline entries. **Owner's call; recommend its own small change, not part of Stage 8.**
- **Found, not mine, not baselined:** the club editor (`admin-public-site-look`) has an unlabelled `<input>` 18 px tall at
  361/390/768. Present on the committed code too (measured with this part's CSS reverted). Not in the Look controls. Handed on.
- After the fixes: `admin-t-branding-look-club` clean at every width; `admin-t-branding` and `admin-t-branding-look` carry only the
  Dismiss button; `admin-public-site-look` only the 18 px input.

**(d) The hero banner's removal list (ask A ruled: retire it; delete the upload, stop counting it in "branding done", KEEP the
column).** For Part 4; nothing deleted here. Census 2026-11-03, every line re-opened. **Old look only** on the public side:
`TournamentHomeContent` returns `<TournamentOverview>` early under the frame, and `TournamentOverview` never reads it; on the Branding
page the card sits inside `{!frameOn && (<>`.
- **Column (KEEP, ruling C):** `tournaments.hero_banner_url`; no repo migration creates it (base schema, older than `001`).
  `lib/types.ts:332` (`Tournament.heroBannerUrl`), `lib/db.ts:1854` (`mapTournament`). Dictionary: `DATA_DICTIONARY.md:731` anchor,
  `:741` the branding block. `memory/reference_db_schema.md:79`.
- **Copy lists (writers to a new tournament — decide in Part 4 with the other dead columns):** `lib/db.ts:289` (`cloneTournament`
  with `includeBranding`), `lib/db.ts:446` (`populateTournamentFrom`, `publicPresence`).
- **Public reader (old look, goes with Part 3d's Overview):** `components/public/TournamentHomeContent.tsx:448-450` (the URL, falling
  back to the **org's** banner), `:1027-1037` (the hero's banner + overlay).
- **Upload route (DELETE):** `app/api/admin/tournament-hero-banner/route.ts` — POST writes `:68-72`, DELETE nulls `:103-107`; bucket
  `org-assets`, path `${orgId}/${tournamentId}/hero-banner.{ext}` (`:56`), 4 MB, plan gate `advanced_tournament_branding`. Stored files
  are not removed by deleting the route (a storage clean-up, if wanted, is a separate step).
- **Branding API (stop reading):** `app/api/admin/tournament-branding/route.ts:47` (select), `:78` (`heroBannerUrl` in the response).
  The PATCH never wrote it.
- **Branding page (old look; goes with Part 4's cards):** `app/[orgSlug]/admin/tournaments/branding/page.tsx` — `:57` the type, `:169`
  `:171` `:173` `:179` state and input ref, `:220` `setBannerUrl`, `:282-303` `upload()`'s banner branch (`:291` the route name), `:305-318`
  `removeUpload()` (`:312`), `:498-516` the card (`sectionId="hero-banner"`), `:555` `bannerUploading` in the SavePill; comments `:11`
  `:440`. `LookCard.tsx:4` header comment names it.
- **The "branding done" flag (stop counting it):** `app/api/admin/tournament-dashboard/route.ts:109` (row type), `:154` (select),
  `:268` `hasBranding = Boolean(t.logo_url || t.hero_banner_url || t.theme_preset || t.theme_primary)` → drop only the banner term.
  Read by `dashboard/DraftBoard.tsx:109` (the "public" checklist row) and `dashboard/page.tsx:292` (default). No test asserts it.
- **Words:** `lib/tournament-settings-words.ts` `heroBanner` `:244`, `uploadBanner` `:252`, `replaceBanner` `:253`, `bannerHint` `:261`,
  `bannerLine` `:262` (none used elsewhere; `uploading`/`remove` are shared with the Logo card — keep). `lib/invite-only-words.ts:18`
  `LOCK_WORDS.branding` ("…theme, banner and fonts…", the switch-off lock line; Part 4/5d).
- **Help (Part 5c):** `lib/help-content/tournaments.tsx:443` (searchText), `:453`, `:516` + `:521` ("…hero banner, fonts, and app icon
  are all unaffected"), `:2444` (the six-cards FAQ — already stale since Part 1).
- **Styles:** `branding.module.css:178-204` (`.bannerDesc` `.bannerPreview` `.bannerImg` `.bannerHint`) and those two in the shared
  colour group at `:375`/`:378` (remove the two selectors only). ⚠ `app/[orgSlug]/Home.module.css` `.heroBanner`/`.heroBannerOverlay`
  and the `:has(.heroBanner)` rules are **shared with the club home page** — keep.
- **Tests:** `tournament-stage5-public-site.test.ts:53` (loops over the cards incl. `W.heroBanner`); `:77` and `tournament-look.test.ts:459`
  assert the lock-word line. No test asserts the route or `hasBranding`.
- **Baseline:** `scripts/.layout-baseline.json` — the `admin-t-branding|361/390/768|tap-floor|button·Hero Banner` entries go stale
  with the card (prune after Part 4's re-measure).
- **No seed or demo** writes a tournament banner.
- ⚠ **NOT the tournament banner — do not delete:** `organizations.hero_banner_url` (migration `005`), `Organization.heroBannerUrl`
  (`lib/types.ts:268`), `mapOrg` (`lib/db.ts:1800`), `lib/api-auth.ts:102`/`:239`, `lib/server-organizations.ts:25`/`:62`, the org
  upload route `app/api/admin/org-hero-banner/route.ts`, `org-settings` route, the club editor's banner (`LookPanel.tsx`,
  `lib/public-site-words.ts`), the club home (`app/[orgSlug]/page.tsx`, `ClubHome.module.css`, `lib/club-home-data.ts:110`,
  `ClubSiteHome`), the org help copy (`lib/help-content/org.tsx`), `public-site-builder.test.ts`, `seed-club-fixture.mjs`. The preview
  layout's `heroBannerUrl: undefined` (`preview/[tournamentSlug]/layout.tsx:44`) is an org-field strip in tournament code: it goes with
  that code, the org field stays.

**`/simplify` (2026-11-03):** the walker promoted and cached (above; the guard's run fell from ~2.2 s to ~1.2 s), one marker
pattern and one step loop, the prefetch prop on every tab of the row, looser source-guard patterns, the 768 rules merged, comments
cut. Skipped: the global `.tap-target` utility for "Public site" (it starts at 900 px, the card's floor is 768 — a behaviour change);
one tap-token spelling per file (cosmetic, all resolve to 44 px).

**`/review` (2026-11-03, standard tier; lenses correctness + regression):** no defect in the code. Fixed: the "Public site" link
grew its sentence's line (now the `.textLink` recipe, re-measured clean at 361 and 768); one new count assertion could pass with
both counts zero (now requires > 0). Verified: step 1's ring appears on the demo's game day (the two semifinals are the newest
results); step 2's Playoffs draws the bracket for the default division (U11); `prefetch={undefined}` is Next 16's default
(`prefetch: prefetchProp = null`), so every other band and tab mount is unchanged; the promoted walker is equivalent for the
notification guard (36/36), and (a review helper's measurement, not re-run here) its regex agreed with TypeScript's own import
parser on all but one file under app/ components/ lib/ (`lib/observability/dashboard.ts`, nowhere near these routes); the merged 768 block sits after
every base rule. Accepted as known: the release coupling above (nothing at build time can see it — the guard counts a page's
old and new halves together until the old one goes).

**Checks run:** unit tests reading every touched file, 20 files 454/454 after `/simplify`; 61/61 for the two re-touched after
`/review`; `verify:changed` 13,494/13,501 — the **7 failures are the same 7 Part 1 recorded** (the admin window guard, the
plan-billing ended band, Stage 6 walk HTML ×3, the key-prefix guard, the console foot), none in this part's files. ⚠ One of them is
**this project's**: `admin-overlay-guard` names `components/admin/kit/club/PhoneWindow.tsx` (the Look card's window, committed
`cb9e17d3b`, Stage 1a) as an admin window missing from its `WINDOWS` list; it fails on HEAD, not on this part; `demo-destinations-guard` 12/12 plus the mutations above;
ESLint clean on the 7 changed TS files; spelling clean; CSS selectors — no finding in this part's files (the 4 orphans + 10 dead
classes are other sessions' platform-admin / public-site / schedule / coaches files); typecheck clean (`NODE_OPTIONS=--max-old-space-size=6144`);
layout as (c).

**Handed on:**
- **Owner's call:** the admin context strip's 34 px "Dismiss" (shared chrome, every admin screen; recommend its own small change).
- **Club editor:** the unlabelled 18 px input on `admin-public-site-look` (pre-existing; identify and fix with the club editor's next
  touch).
- **Stage 1a's window and the admin window guard:** name `PhoneWindow.tsx` in `admin-overlay-guard`'s `WINDOWS` (it is an inert
  preview, not a form or a menu — a one-line entry with its reason). Owner's go; fits Part 3a's opening or any session.
- **Part 5e (`/demos`):** the marketing shot `fan-live-score` (`lib/marketing-shots.ts:143-150`) is taken on `/standings` waiting
  for `playoff-bracket` — "the same anchor the tour's step 2 points at". After the flip the new Standings draws no bracket, so the
  shot's wait times out; retarget it to `/playoffs` with its alt text ("…public standings page…") at the re-curate. No guard covers it.
- **Advisory, owner's call (not new):** pressing tour step 1 while on any tournament page (e.g. Playoffs, where step 2 leaves the
  visitor) reads as "already here" (prefix match), so it narrates without the ring; `exactPath: true` on step 1 would fix it. The
  tournament tour was deliberately left on prefix matching. And a visitor whose remembered division is not U11 sees no bracket on
  step 2 (the old Standings had the same exposure).
- **Part 6 (release), still owed from Part 1:** `/release` §1d-2's sharp probe uses the deleted apple-icon route; changing
  `.claude/commands/release.md` is the owner's call.

## 12. Part 3a record (Rules, Teams + the team page, Standings; committed `3304c77fe` 2026-11-03; releases with the flip)

**What a customer sees:** nothing (nothing promoted). **An owner on dev, switch on (the default):** nothing changes — the four
pages and the admin preview's Rules, Teams and Standings sections already showed the new look. **Switch off:** those four pages and
three preview sections now show the new body inside the OLD layout (the frame's `--club-*` tokens and `data-public-frame` are set
only by the layout's frame branch, which Part 3d/4 owns), so they look half-styled. Accepted half-state; it ends when Part 4
deletes the switch. ⚠ **This part must not be promoted before Parts 4–6** (§5 already says so; stated because it is now true of
the public pages themselves, not only the icon and the demo).

**What changed.** Each page renders its new body with no switch: `rules/page.tsx` → `PublicRules`; `teams/page.tsx` →
`PublicTeams` and `standings/page.tsx` → `PublicStandings` **directly from the server page** (the `TeamsPageClient` /
`StandingsPageClient` wrappers only read `useParams` and forwarded two strings — deleted at `/simplify`); `teams/[id]/page.tsx` →
`PublicTeamPage`. `forwardToOwnAddress` still runs first (the team page's lives in its `[id]/layout.tsx`). The admin preview's
Standings, Teams and Rules sections collapsed the same way (they rendered the same old components behind the same switch); its
Teams section now reads games in the one `Promise.all` (same data as the old frame branch). Its Schedule, Champions, News and
Register sections and its nav are untouched (3b–4).

**Found at `/review` and fixed here — the team page's data under the switch-off state.** `app/api/public/team-profile/route.ts`
answered in the new shape only when `publicFrame=1` **and** the switch was on (to keep the old team page's contract). The new
page always sends the flag, so with the switch off it received the plain shape and showed "Couldn't load this team" with a Retry
that could never succeed. The old page was the route's only flag-less caller and is gone (guard: the new page is now the route's
only caller), so the flag alone opts in now; `isPublicFrameOn` left the route. Part 4 drops the flag and the plain shape. Not a
privacy change for customers: the plain shape already ran through `onlyPublishedGames` and the shown/hidden gates; the new shape
adds the held-back-division "withheld" answer.

**Deleted, each with its importer check (grep re-run immediately before each removal; no importer outside the deleted set):**
- `components/public/RulesContent.tsx` — importers: `rules/page.tsx` + the admin preview (both collapsed).
- `components/public/TeamsContent.tsx` — `TeamsPageClient.tsx` + the admin preview.
- `components/public/StandingsContent.tsx` — `StandingsPageClient.tsx` + the admin preview.
- `app/[orgSlug]/[tournamentSlug]/teams/[id]/LegacyTeamProfile.tsx` — `teams/[id]/page.tsx` only.
- `…/teams/[id]/team-profile.module.css` — `LegacyTeamProfile.tsx` only.
- `app/[orgSlug]/standings/standings.module.css`, `…/teams/teams.module.css`, `…/rules/rules.module.css` — each imported only by
  its old body. ⚠ The census's worry that the org-level standings styles are "shared with club/house-league pages" does not hold
  for these files: the club's `/standings` and `/rules` addresses are `clubShortcutPage` redirects that import no styles, and no
  `composes` reaches them. (`app/[orgSlug]/admin/tournaments/rules/rules.module.css` is a different file and stays.)
- `teams/TeamsPageClient.tsx`, `standings/StandingsPageClient.tsx` — their server pages only (see above).
- `app/[orgSlug]/results/results.module.css` — **no importer at all** since Club Tier Stage 4a made `/{org}/results` a redirect;
  the selector check only saw it alive by NAME through the old Standings (below).
- `lib/team-color.ts` `teamInk` — callers were `TeamsContent` and `LegacyTeamProfile`, nothing else; with it `lib/color-contrast.ts`
  `hslChannels01` (only `teamInk` used it) and the `export` on `relativeLuminance01` (now internal only). The 0.20 crossover's
  reasoning is kept in `team-color.ts`'s header (restore from this commit's parent if a team fill ever needs ink again).
- **Dead CSS rules the deletion exposed** (not in this group's files, but new findings because of it): the selector check matches
  class NAMES across modules, so the old Standings' own `styles.statValue` / `desktopOnly` / `mobileOnly` / `standingsTable`… kept
  same-named, never-rendered rules "alive" elsewhere. Removed after a whole-repo check that no TS file renders the names:
  `admin-common.module.css` `.desktopOnly`/`.mobileOnly` (+ their 900 px block), `house-league.module.css` `.statValue` (base +
  kit override), `coaches.module.css` `.statValue`. Baselines: `.css-selector-baseline.json` lost only the deleted files' entries
  (`standings`, `teams`, `results`); `.admin-old-look-baseline.json` house-league `kitScope` 71 → 70 (that one removed kit rule),
  set by hand — `--init` would also have absorbed another session's schedule-admin increase.

**Kept, and why:** the switch, its cookie and the layout's frame branches (Part 3d/4); the bracket (`TieredBracket`/
`LogicSyncBracket` — the old Playoffs still draws it, 3c); `schedule.module.css` (Schedule, Playoffs, the game page); `YearSelector`
and `MyTeamCard` (the old Schedule, 3b); `DivisionFilterBar` (News, `PublicRules`); `UnfollowConfirmSheet`, `FollowAlertsToggle`,
`lib/team-calendar.ts`, `lib/follow.ts`, `lib/rule-icons.ts` (all still used); the global classes the old bodies used (`container`,
`card`, `badge` — shared); the team page's share image (3c).

**Tests (rewritten, not deleted):** Stage 5 guard (one body per page, no switch; the old bodies, wrapper and sheets gone; the preview
Teams section's filtered data via a section slice; the route's flag-alone opt-in; the new page is the team-profile route's only
caller), Stage 4 guard (one Standings body; old body, wrapper and sheet gone; preview section), Stage 6 rules (one body on both routes;
old body and sheet gone), Stage 2 guard (Rules has one body, no layout settings reach it; the shared-parts list's comment), Stage 1
frame guard (the four deleted sheets left the readable-baseline list; the monogram ink left with its pages), Stage 6 champions
(loader mocks), the coin-toss guard (now reads `PublicStandings`), `playoff-plan` (the source regex on the old Standings became a
**behavioural** test of `qualificationCaption` + `standingsAdvancing`, incl. a non-vacuous planned case). `tests/unit/_source-code.ts`
gained `sourceExists` (pin a deletion) and `between` (anchor-checked slice — a missing anchor throws instead of handing a
`doesNotMatch` an empty string). Its own commit (`765c44638` 2026-11-03): `admin-overlay-guard` names `components/admin/kit/club/PhoneWindow.tsx` (an inert
preview; Part 2's hand-on).

**Checks run:** the touched + neighbouring unit files 457/457, then 200/200 after the route fix (incl. `demo-destinations-guard`
12/12 — step 2 on `/playoffs` passes with the old Standings gone, and nothing else in the tour points at its bracket);
`npm test` 13,503/13,513 — the **10 failures are all other sessions' uncommitted work**: Part 2's list minus the window guard (fixed
here): plan-billing ×2, Stage 6 walk HTML ×3, key-prefix ×2 (`seed-plan-ending-walk.mjs`), console foot ×1 (`ExpenseFormWindow`);
new since Part 2: families stage 5a attach, house-league gate (registrations routes), league sign-up link. Typecheck clean
(`NODE_OPTIONS=--max-old-space-size=6144`); ESLint clean on every changed file (the route's one `_notes` warning predates this
part); spelling clean; CSS selectors — back to exactly Part 2's 4 orphans + 10 dead classes, none in this part's files; admin type,
public type, module purity, contrast, text contrast, public tokens, date correctness, admin org context, observability: no finding
of this part's; admin old look: only the foreign schedule-admin increase; `check:demos` crashes loading a foreign module
(`lib/registration-attention.ts` → `lib/tournament-teams`); org-slug callers: two foreign public-site files; marketing-shots
`--check` passes (it checks the image files, not the anchors).

**Layout** (`check:layout --only=pubt-standings-own,pubt-standings-mid-pool,pubt-standings-playoffs,pubt-standings-finished,
pubt-teams-free,pubt-team-own,pubt-rules-pale`, every listed width, on the dev server already up): **0 findings** on six screens.
`pubt-standings-playoffs` could not be measured at any width, twice: its clone's championship is dated 2026-10-30, so the screen's
"championship is live now" wait can never be met on 2026-11-03 — **an expired fixture** (re-prepare with
`seed-public-stage4-fixtures.mjs`), not this part (the body is unchanged for a switch-on visitor; the other three Standings
screens measured clean). Nothing baselined.

**`/simplify`:** wrappers deleted; `between` promoted and used for the three preview-section slices; the caller scan reads raw text
first (strips comments only on hits); duplicate comments trimmed; each sheet's deletion pinned once. Skipped: folding
`coach-lineup-phone-guard`'s / `game-references-guard`'s local `between` and `team-claim-link-removed`'s `gone` into the shared
helpers (outside this part's files); caching repeated reads in tests (negligible).

**`/review` (high-risk tier for shared lib + a shared stylesheet; lenses correctness/contract + regression/blast-radius):** one
defect, fixed (the team-profile route above). Confirmed clean: the collapsed pages match the old switch-on path; the
`teams-preview`/`standings-preview` feeds are not switch-gated and stay published-only; no surviving reference to any deleted file,
export or class (code, tests, UAT specs, scripts, baselines, knip, `.claude/commands`); the removed CSS rules have no renderer; no
rewritten guard is vacuous.

**Handed on:**
- **NEW owner ask — the Rules layout menus are dead controls.** Rules & resources offers "Rules layout: one column / two columns"
  and "Resources layout: a list / two columns" (`RulesAdmin.tsx`, `tournament.settings.rulesLayout`/`resourcesLayout`). Only the
  deleted `RulesContent` read them; the new Rules page never did (since Stage 6), so they do nothing on dev now and for customers
  at the flip — the same "a setting that does nothing is a lie" ground the plan used for the App icon card and the hero banner.
  *Recommend:* remove both menus and stop writing the keys in Part 4 (keep the stored values, like ruling C); the alternative is
  to have the new Rules page honour them. Not in any plan before this.
- **Part 5e (`/demos`):** besides `fan-live-score`, the **`playoff-bracket`** marketing shot (`lib/marketing-shots.ts:186-202`,
  slide #14) photographs `/standings` and clips the OLD bracket's markup (`a[aria-label^="View game details"]`, `svg text`). With
  the old Standings gone it has nothing to photograph; retarget it to `/playoffs` and re-derive the clip from the new bracket.
- **Part 3c:** the team share image (`teams/[id]/opengraph-image.tsx:36`) still withholds a held-back division only when the
  switch is on; drop the gate with that group.
- **Part 4:** the team-profile route's `publicFrame` flag and plain shape (above); the layout's frame chrome is what the new bodies
  need with the switch off.
- **Fixture:** re-prepare the Stage 4 clones (`seed-public-stage4-fixtures.mjs`) before the next Standings/Playoffs measure.
- **Advisory, not this part:** white text on `teamColor()` fills survives in the game and team share images and several consumer
  monograms — the warm-gold contrast case `teamInk` solved. Pre-existing.
- Still owed, not this part: the admin strip's 34 px "Dismiss"; `/release` §1d-2's sharp probe; the club editor's 18 px input.

## 13. Part 3b record (Schedule + a game's page; built 2026-11-03, committed `9b6252e8a` 2026-11-04; releases with the flip)

**What a customer sees:** nothing (nothing promoted). **An owner on dev, switch on (the default):** nothing changes — the
Schedule, a game's page and the admin preview's Schedule section already showed the new look. **Switch off:** those three now
show the new body inside the OLD layout (half-styled, the same accepted half-state as §12), and a game's link-preview title and
description use the new words (round names, "Location TBD") for everyone. ⚠ Not promotable before Parts 4–6 (§5, §12).

**What changed.** `schedule/page.tsx` → `PublicSchedule` **directly from the server page** (the `SchedulePageClient` wrapper only
read `useParams` and chose between the two bodies — deleted, as 3a did for Teams/Standings); `forwardToOwnAddress` still runs
first. `schedule/[gameId]/page.tsx` → `PublicGameDetails` after the same forward → not-found → "Schedule unavailable" →
not-found order; `generateMetadata` is the old switch-on branch alone. The "Schedule unavailable" state is unchanged: both halves
already rendered it before the switch was read. The admin preview's Schedule section collapsed the same way (same published-only
data, `publicTeamsData`). `GameDetailLiveRefresher`'s score-only mode (no `requireFinalization`, the `schedule` section) existed
only for the old page: `requireFinalization` is now required and it always polls `schedule-preview` with
`publicGameRefreshSignature` — the same signature the server computes. `getPlayoffStakes`' old wording and loose `includes` match
(the default, `fanWords = false`) had the old page as its last caller (found at `/review`): the parameter is gone and the four
callers dropped their `true`; its test now pins the exact-reference rule (SF1 is not SF10) instead of the old words.

**Data feeds (3a's lesson):** `app/api/public/tournament-data` and `getPublicTournamentPageData` read no switch, cookie or header;
`schedule-preview` (the new Schedule and the refresher) and `schedule` (the game page) answer the same with the switch off.
Nothing to fix.

**Deleted, each with its importer check (grep re-run immediately before each removal; no importer outside the deleted set):**
- `components/public/ScheduleContent.tsx` — importers: `SchedulePageClient.tsx` + the admin preview (both collapsed).
- `app/[orgSlug]/[tournamentSlug]/schedule/SchedulePageClient.tsx` — `schedule/page.tsx` only.
- `components/YearSelector.tsx` + `.module.css` — `ScheduleContent` only (the last of 3a's kept list); with it the stale path in
  `scripts/check-public-tokens.mjs`' public `files` list (the check skips a missing file, so this was hygiene, not a failure).
- `components/public/MyTeamCard.tsx` + `.module.css` — `ScheduleContent` only (3a's kept list).
- `components/public/TeamFollowStar.tsx` + `.module.css` — the old game page only. Its follow helpers (`useFollowedTeam`,
  `useAccountFollowedTeamIds`, `unfollowTeamEverywhere`) all keep callers.
- `app/[orgSlug]/schedule/schedule.module.css` **trimmed, not deleted** (2,412 → ~60 lines): the old Playoffs' switch-off half
  still imports it for `liveBadge`/`liveDot` and nothing else, so only those rules, their two keyframes and their three
  frame-keyed overrides remain, unchanged in effect. **Part 3c deletes the file with the old Playoffs.** No `composes` or
  outward-reaching `:global` rule lived in the deleted part (every `:global` paired with a local class).
- **Dead CSS the deletion exposed:** `schedule-admin.module.css` `.mobileStageBtn` (base rule in its 900 px block + the kit
  restatement) — kept "alive" by NAME by the old Schedule's own `styles.mobileStageBtn`; no TS file renders it from the admin
  module (incl. `styles['…']` and template forms). Removed.
- **Baselines, by hand (never `--init`):** `.css-selector-baseline.json` lost only `schedule.module.css`'s entry (`sheetSegmented`,
  deleted); `.admin-type-baseline.json` schedule-admin face/caps/heavy 9/6/4 → 8/5/3 — exactly the removed rule's data face,
  capitals and 800 weight. `.admin-old-look-baseline.json` NOT touched: schedule-admin `kitScope` was already above its 100
  baseline at HEAD (106, another session's committed work); this part lowers it to 104, but locking 103/104 would absorb theirs.

**Kept, and why:** the switch, cookie and the layout's frame branches (3d/Part 4); the old Playoffs and Champions halves, the
bracket, and all three share-image routes incl. the game's `opengraph-image.tsx` (3c); `PublicTournamentState`, `RollingNumber`,
`Countdown`, `ShareScoreButton`, `FollowTeamPicker`, `FollowAlertsToggle`, `TieredBracket`, `lib/follow.ts`, `lib/team-color.ts`,
the `playoff-bracket` helpers (`fanGameLabel`, `clearFollowedTeam` are used inside their own modules) — all still have callers.

**Tests (rewritten, not deleted):** Stage 3 guard (one Schedule body from the server page, forward first, no switch; the old body,
wrapper, YearSelector and MyTeamCard gone; the preview section via `between()`; the trimmed sheet declares exactly
`liveBadge`/`liveDot` and Playoffs still reads it; the game page has no switch and no old helpers, TeamFollowStar gone; metadata
via a `between()` slice; the refresher's required rule and single signature path — replacing the old body's byte hash), Stage 2
guard (the three bodies render with no switch; comment names 3b), Stage 0 small fixes (D2's live-score list moves to the new view
models `lib/public-game-detail.ts` + `lib/public-game-row.ts`; D4 "no First pitch" adds them, `PublicGameDetails` and
`PublicSchedule` — the review's advisory), Stage 1 frame guard (MyTeamCard's sheet left the readable-baseline list; the
final-standings test now holds `PublicSchedule` — no inline organizer wash, the frame's own line token on `.placements`), Stage 6
champions (loader mock list), `public-game-detail` (stakes, above).

**Checks run:** the touched + neighbouring unit files (27 files) 506/509 — the 3 are the Stage 6 walk-HTML tests (other session, §12), and
`public-game-detail` + team-profile + playoffs + schedule tests 111/111 after the stakes change; `npm test` 13,644/13,681 — the **37
failures are all other sessions' uncommitted work**: billing/plan (`plan-billing-actions`, `-admin-host`, `-host-links`, `-usage`,
`plan-reader-door-guard`, `org-billing-access-guard`, `account-first-signup`), Stripe key prefix ×2 (`stripe-mode`), support
console foot ×2, Stage 6 walk HTML ×3; none reads a file of this part. Typecheck clean; ESLint clean on every changed file;
spelling clean; CSS selectors back to exactly §12's 4 orphans + 10 dead classes (none in this part's files); public tokens,
public type, module purity, contrast, text contrast, date correctness, admin org context, observability, marketing-shots `--check`:
pass; admin type: only other sessions' files left (their new lettering + their drops); admin old look: only the foreign
schedule-admin increase above; org-slug callers, export catalog, root files: other sessions' files. Demo tour guard 12/12 — no tour
step and no marketing shot points at the public Schedule or a game's page (the only public shots are the two Standings ones §12
handed to 5e). Smoke on the restarted dev server: the Schedule and a Lakeshore game's page answer 200, the game page renders the
new body with the new title.

**Layout** (`check:layout --only=` the seven `pubt-schedule-*`/`pubt-game-*` screens, every listed width, on the dev server already
up): **0 findings on the 8 screen-width pairs that measured** (`pubt-schedule-pale`, `pubt-game-pale`, ×4 widths). Not measured,
and NOT this part:
- `pubt-schedule-live`, `pubt-schedule-many-days`, `pubt-game-live` — **expired fixture**: the Stage 3 Lakeshore clone was
  prepared 2026-10-29 (read back with `seed-public-stage3-fixtures.mjs show`, read-only): its live semifinal was 2026-10-29
  17:50 and its pool days end 2026-11-01, so on 2026-11-03 there is no live card and no "today" chip to wait for.
- `pubt-schedule-playoffs`, `pubt-schedule-bracket-only` — **stale screen definition**: both wait for a link named `/The bracket/`;
  the door has read "The playoff bracket" since Stage 5 (`f2e208cb9`, 2026-10-31), so the wait can never succeed (the page's ready
  marker does render).
- The first run **aborted** on the memory floor (1,486 MB free) at `pubt-game-live`; the unreached screens were re-run alone.
  Nothing baselined. The dev server was restarted afterwards (deleted files + the abort), under the existing `dev.mjs` wrapper.

**`/simplify`:** skipped — no new abstraction (deletions, one narrowed prop, one removed parameter).

**`/review` (standard tier; lenses correctness/contract + regression/blast-radius):** no defect. Confirmed clean: each collapsed
page matches the old switch-on path (component, props, check order); server-passed slugs equal `useParams()`'s, incl. a club's own
address; the refresher's only caller passes the rule and both signatures share one format; no data feed reads the switch; the new
metadata cannot produce empty parts; no surviving reference to a deleted file, export or class (code, tests, UAT specs, scripts,
`.claude/commands`, knip, baselines); the removed CSS has no renderer; the baseline arithmetic is exact; no rewritten guard is
vacuous. Acted on: the stakes helper's dead old mode (above); D4 widened to the new view models; the standings test pins its
stylesheet rule. Dropped: the old-look ratchet and the 10 dead classes (other sessions'); "`NO_SCORE_YET` could be met by an import
alone" (advisory; both files use it).

**Handed on:**
- **Layout screens (owner/next measure):** retarget `pubt-schedule-playoffs` and `pubt-schedule-bracket-only` to
  `/The playoff bracket/` (`scripts/layout-screens.mjs`), and re-prepare the Stage 3 clone (`seed-public-stage3-fixtures.mjs
  prepare`, dev only) before the next Schedule/game measure — with the Stage 4 clones (§12).
- **Part 3c:** delete `schedule.module.css` with the old Playoffs half (its only importer); the game's share image still has its
  switch branch.
- **Part 3d/4:** the "Schedule unavailable" state on a game's page wears the old global page classes inside the new frame
  (pre-existing for switch-on visitors); look at it with the layout's frame branches.
- Still owed, not this part: the Rules layout menus (§12 → Part 4); the admin strip's 34 px "Dismiss"; `/release` §1d-2's sharp
  probe; the club editor's unlabelled 18 px input; re-seeding the Stage 4 clones.

## 14. Part 3c record (Playoffs, Champions, the three share images; committed `62f5841f9` 2026-11-04; releases with the flip)

**What a customer sees:** nothing (nothing promoted). **An owner on dev, switch on (the default):** nothing changes — Playoffs,
Champions, the admin preview's Champions section and the three link-preview images already followed the new look. **Switch
off:** Playoffs and Champions show the new body inside the OLD layout (the accepted half-state of §12/§13); the preview's
Champions section shows instead of "not found"; and the three link-preview images follow the new rules for everyone — the
team image never names a team in a held-back division, the tournament image names a champion only when Standings is shown,
every division is published and every final is done (switch-off used to name one as soon as any final was decided, Standings
hidden or not), and the game image uses the new words. Both image rules are privacy tightenings, pinned in tests. ⚠ Not
promotable before Parts 4–6 (§5).

**Owner ruling in-session (2026-11-04):** the old SVG bracket goes in 3c. The brief said "delete only if no importer survives";
the code said `TieredBracket`'s only caller (the new Playoffs) always took its new branch, so `LogicSyncBracket` was reachable
only through a dead branch. ⚠ **Correction to §12's "Kept" line:** the old Playoffs never drew the bracket (its body only linked
to Standings; the Stage 4 guard already asserted it). The old SVG's last live renderer was the old Schedule, gone in 3b.

**What changed.** `playoffs/page.tsx` → `PublicPlayoffs` **directly from the server page** after `forwardToOwnAddress` (the old
switch-on branch alone; the old body read games itself, the page now reads only `getPublicTournamentPageData(…, 'playoffs')`).
`champions/page.tsx` → `PublicChampionsPage` on all three returns (Standings hidden / not crowned or withheld / crowned), the
same check order as the old switch-on path; the held-back-division withholding is unconditional. The admin preview's Champions
section lost its `notFound()` gate; the preview page no longer imports `isPublicFrameOn`. Share images: the team's always
returns the generic card for a division that is not published (`showRecord` reduces to the Standings switch — after the early
return the division is published); the tournament's `canShowChampions` is the old switch-on expression, unconditional; the
game's always builds `publicGameDetailView` (names, score, state, round), its hand-rolled `teamName`/`NIL_UUID`, the old status
labels and `bracketRoundLabel` fallback gone. `TieredBracket` is the old `publicFrame` branch alone (props narrowed:
`publicFrame`, `tournamentId`, `highlightTeamId` gone; `requireFinalization`, `now`, `divisions` required — its one caller
passes them).

**Data feeds (3a's lesson):** no feed the new bodies or the images call reads a switch, cookie or header
(`getPublicTournamentPageData`, `app/api/public/tournament-data`, `tournament-share-look`, `public-games`, `champions`,
`public-host-card`). **Found at `/review` and fixed here:** the `playoffs` and `standings-preview` sections (one branch) sent
every game's full record to the browser — the private `notes` and the scorekeeper's `scoreSubmittedByEmail`/`UserId`/`At`/
`Source` — in the page's initial data and the live JSON. The old switch-off Playoffs rendered on the server and never shipped
them; `schedule-preview` and `teams-preview` already scrubbed through `publicFrameGame`. Both sections now map their games
through it (neither body reads those fields). Read back on the restarted server: no `scoreSubmittedBy*` and no game `notes` in
the Lakeshore or Stage 4 Playoffs payload. The `standings-preview` half is 3a's surface, fixed here because it is the same
expression.

**Deleted, each with its importer check (grep re-run immediately before each removal; only tests pinning the deletion and
historic `tests/uat/results/**` named them):**
- `components/bracket/LogicSyncBracket.tsx` (1,013 lines) + `.module.css` — importer `TieredBracket` only (its dead branch).
- `lib/types/bracket.ts` (`BracketNode`) — `LogicSyncBracket` only; the now-empty `lib/types/` directory removed.
- `lib/playoff-bracket.ts` `inferGamePool` — its last caller was `TieredBracket`'s dead branch (the admin bracket view has its
  own local copy); `poolPlaceholderTag` and `PoolInferableGame` stay (`inferGamePoolSides`).
- `components/public/PlayoffPicture.module.css` — the old Playoffs body only. `components/public/ChampionsRecap.module.css` —
  the old Champions body only. `app/[orgSlug]/schedule/schedule.module.css` — the old Playoffs' LIVE chip only (§13 hand-on).
- No `composes` reached any deleted sheet; no baseline held an entry for one.

**CSS selector check:** exactly §12/§13's 4 orphans + 10 dead classes (all other sessions'); none of the deleted TSX rendered
those names, so the deletion exposed nothing new. **Baselines:** none touched.

**Kept, and why:** the switch, cookie and the layout's frame branches (3d/Part 4); `TieredBracket`, `PublicBracket`,
`lib/playoff-picture.ts`, `PublicTournamentState` (the new bodies use them); `lib/champions` `tierBadgeLabel` (home, host card).

**Tests (rewritten, not deleted):** Stage 4 guard (one Playoffs body after the forward; old Standings/Playoffs bodies and
sheets gone; the bracket is the public one, the old SVG + types + `inferGamePool` gone; the feed's scrub pinned in source AND
behaviourally on `publicFrameGame`), Stage 6 champions (the switch mock now **throws**, so any switch read fails the per-kind
cases; the old recap gone; every return the new body, forward first; the preview section via `between()`; the share image's
gate unconditional), Stage 5 review (**privacy pin**: a held-back team — unpublished or no visibility set — always gets the
generic card; a published one keeps its image; no switch import), team-reads guard (the withhold precedes the record), Stage 3
guard (the old sheet gone; the game image always uses the view), Stage 2 guard (Champions one body), Stage 1 frame guard (the
deleted sheets left the readable-baseline lists; the bracket-colour test now holds `PublicBracket`), `public-playoffs-render`
(the dead mock gone), `public-games-guard` (Playoffs left the self-reading list, so the "no `getGames`" rule now covers it),
`playoff-plan` (the caption comes from `qualificationCaption`). **Non-vacuity checked by mutation:** putting the old switch-off
behaviour back in the team and tournament images fails 8 tests.

**Checks run:** touched + neighbouring unit files 606/606, then 359/359 after the feed fix; `npm test` 13,675/13,681 — the **6
failures are all other sessions' uncommitted work** (Stage 6 walk HTML ×3, support console foot, Stripe key prefix,
plan-billing usage), none reads a file of this part. Typecheck clean (`NODE_OPTIONS=--max-old-space-size=6144`; an earlier run
showed only another session's billing errors). ESLint clean on every changed file; spelling clean; public tokens, public type,
module purity, contrast, text contrast, date correctness, marketing-shots `--check`: pass; admin type and admin old look: only
other sessions' files; `check:demos` crashes loading a foreign module (as §12). Demo tour guard passes (step 2's anchor is on
the new Playoffs). Smoke on the restarted dev server (`next dev` relaunched by the `dev.mjs` wrapper): login, two Playoffs
pages and a Champions page answer 200.

**Layout** (`check-layout-invariants.mjs --only=pubt-playoffs-live,pubt-playoffs-seeded,pubt-playoffs-eight,pubt-playoffs-pale,
pubt-champions-after`, every listed width, on the dev server already up; a first attempt found the server mid-recompile and
was re-run): **0 findings on the 8 screen-width pairs that measured** (`pubt-playoffs-pale`, `pubt-champions-after`, ×4).
`pubt-playoffs-live`, `-seeded`, `-eight` — **expired fixture**, not this part: read back with `seed-public-stage4-fixtures.mjs
show` (read-only), the live clone's final was 2026-10-30 and every seeded/eight game is dated ≤ 2026-11-02, so all three render
`data-public-playoffs="none"` and their "live"/"upcoming" ready markers can never be met. Nothing baselined; memory never neared
the floor.

**`/simplify`:** skipped — no new abstraction (deletions, narrowed props, one removed export, one reused scrubber).

**`/review` (high-risk tier for `lib/**`; lenses correctness/contract, regression/blast-radius, privacy):** one defect, fixed
(the feed scrub above). Confirmed clean: each collapsed page and image matches the old switch-on path; the team image's
simplification holds (`scheduleVisibility` is `'unpublished' | 'published'`); no surviving reference to a deleted file, export
or class; `@/lib/types` still resolves to the file; the demo anchor survives. Advisory, not acted on: the game image reads
live/unofficial from `publicGameStatus` and its label from the view's `publicGameState` (same as switch-on; two helpers for one
fact).

**Handed on:**
- ⚠ **Pre-existing privacy findings, NOT this part (found by `/review`'s privacy lens; owner attention before the flip):**
  (a) `app/api/public/team-profile` withholds a held-back team only when the caller sends `publicFrame=1` — anyone omitting it
  gets the team's name, coach (if shown), seed, pool and division. The new page is the route's only caller and always sends
  it, so the withhold can be made unconditional now; Part 4 owns the flag (§12). (b) The legacy `schedule`/`teams`/`standings`
  sections of `/api/public/tournament-data` filter teams by status only, so a held-back division's team and division names
  are readable there (and as 0-0-0 standings rows), and they still ship game notes; their remaining callers are the game page
  and the share images (which filter through the view / the gates above). (c) The tournament share image's team and division
  counts include held-back divisions; its live score line ignores a hidden Schedule. (d) Venue and field `notes` reach the
  browser on Playoffs (empty on the fixtures). **Owner question:** are game notes private? `publicFrameGame` says so, but the
  new game page shows them as a public "Notes" fact (Stage 3).
- **Part 5e (`/demos`):** the `playoff-bracket` and `fan-live-score` marketing shots (§12) — both now wait on the bracket
  anchor at `/standings`, which draws none, and `playoff-bracket`'s clip selectors (`a[aria-label^="View game details"]`,
  `svg text`) match nothing in `PublicBracket`; retarget to `/playoffs` and `[data-bracket-game]`.
- **Fixtures:** re-prepare the Stage 4 clones before the next Playoffs/Standings measure (with §12/§13's Stage 3 clone).
- Still owed, not this part: the Rules layout menus (§12 → Part 4); the "Schedule unavailable" state's old page classes (§13 →
  3d/4); the two stale `/The bracket/` layout screens (§13); white text on team-colour fills in the share images (advisory); the
  admin strip's 34 px "Dismiss"; `/release` §1d-2's sharp probe; the club editor's unlabelled 18 px input.

## 15. Part 3d record (the Overview, the tournament layout, the ticker, the side rail's legacy mode, the Navbar's tournament branch; committed `33386d5df` 2026-11-04; releases with the flip)

**What a customer sees:** nothing (nothing promoted). **An owner on dev, switch on (the default):** nothing changes — the
Overview, every public tournament page's chrome and the admin preview's Overview already showed the new look. **Switch
off:** every public tournament page now wears the frame — the organizer's band, the white rail, the footer and the
app-only pieces — whatever the cookie says. **The switch-off half-state of §12–§14 ends here for every public tournament
page.** What the switch still changes, until Part 4: the pay page's focused heading and contact line (switch off, the
layout already drops the pay page's chrome but the page renders its ordinary heading — a new dev-only half-state, found
at `/review`, kept because the brief keeps the pay page's branch for Part 4), the admin preview's outer frame (switch off,
its Overview now shows the new body inside the old dark preview chrome — the same accepted half-state as 3a–3c's preview
sections), and the Branding page and public-site editor. One visible fix: a game's page with the Schedule hidden showed
"Schedule unavailable" inside the old global page wrappers, whose top padding cleared a bar the frame no longer has
(§13 → 3d/4); it now sits in the game page's own body (`PublicGameUnavailable`), same words. ⚠ Not promotable before
Parts 4–6 (§5).

**Owner rulings in-session (2026-11-04):** (1) **the public feed's wider leak is its own fix, straight after this part**
(recommended option) — not folded in here (below, handed on); (2) **venue and field notes are private** — stripped from
the public feed in this part (below).

**What changed.**
- `TournamentHomeContent.tsx` is the Overview's one loader (shared with the admin preview's Overview, so it stays a
  loader rather than being copied into two server pages — a deliberate departure from 3a–3c's "straight from the server
  page", said up front): the old `frameOn` block alone, ~1,200 → ~150 lines, no switch read; its independent reads run
  in one `Promise.all` (`/simplify`). `forwardToOwnAddress` still runs first in `page.tsx`. The demo tour's step 1 anchor
  is in `TournamentOverview` (Part 2) and survives.
- `app/[orgSlug]/[tournamentSlug]/layout.tsx`: every `frameOn` branch collapsed to its frame-on side — the band, the host,
  the contact email, the tab-content reads, `deskShell`, `data-card-style="default"`/`data-color-mode="light"`, the frame's
  role colours, the footer (the paid credit lives only there), the rail's frame mount, the app-only dock / prompt /
  nudges; `isPublicFrameOn`, `canUseAdvancedTournamentBranding`, `effectiveColorMode`, `cardStyle`, `lightModeVars` and
  the old `BuiltOnCredit` mount went. `/simplify`: the fan's six gated pieces sit in ONE `unlessFocused(<>…</>)` (each
  keeps its own `PublicAppOnly` wrapper — that gate draws a `<div>`, so the DOM is unchanged); the ≤900 px `--nav-event-h:
  161px` seed (the old event header's height) dropped — the frame sets its own chrome heights on `.frame`, and nothing
  outside it on a tournament page reads them.
- `components/Navbar.tsx`: the tournament branch, its event header, the `hasEventHead` effect and its `--nav-event-h` /
  `--nav-visual-h` publishing went; past the admin check only a marketing path draws a bar (`if (isAdmin || !onMarketing)
  return null;`), and the scroll listener runs only there. Checked: the only other `[tournamentSlug]` route is the admin
  preview, which the admin check drops.
- `OrgNavContext` / `TournamentNavSync`: the fields only the old bar read went (`tournamentSlug`, colour mode, hidden
  pages, bracket, register call, finished, the frame flag, and the already-unread `fanAlertsEnabled`); the context keeps
  one tournament record (`name`, `tournamentId`, start/end/status) behind one setter (`/simplify`).
- `TournamentSideRail`: the no-props legacy mode went — `hiddenPages` required, no context fallbacks for tab facts,
  `data-color-mode` defaults to light (the preview's switch-off branch passes its own), the rail card always app-only.
  `TournamentTopTabs`: the context fallback (the Navbar's no-props mount) went; `hiddenPages` required.
- `MyTeamDock`, `DesktopMyTeamRailCard`, `FollowDeepLinkPrompt`, `useTodaysTournamentGames`: the `publicFrame` prop / param
  went; each reads only the published-only section (`schedule-preview`, `teams-preview`).

**Data feeds (3a's and 3c's lessons).** The layout and the Overview read no switch, cookie or header; `getPublicTournamentPageData`
and `/api/public/tournament-data` read none either (query params only). What the chrome ships to the browser: the dock,
rail card, results line and deep-link prompt now always use `schedule-preview` / `teams-preview` (published divisions only;
games through `publicFrameGame`, so no game notes or `scoreSubmittedBy*`), where the old switch-off branches used the plain
`schedule` / `teams` sections — a strict tightening for switch-off visitors. The Overview hands raw `games`/`venues` only to
the server-rendered `TournamentOverview`, whose client children get derived words. **Fixed here (owner ruling):**
`publicVenue` (`lib/public-teams.ts`) strips venue and field `notes`; both venue reads of the public feed send through it
(no public page renders them — checked). **Recorded, not fixed (the follow-up):** the feed's `tournament` record and the
org's `tournaments` list go out whole (settings incl. `payment_instructions`; the list's raw `contact_email` skips the
contact switch); `schedule`/`schedule-preview` send every site announcement whatever News's visibility and regardless of a
post's held-back division; the plain `schedule`/`teams`/`standings` sections are still served to anyone (raw games incl.
notes, all divisions; `CoachLiveSchedule` polls `schedule` from the coach portal).

**Deleted, each with its importer check (grep re-run immediately before each removal; only tests pinning the deletion,
comments and historic `tests/uat/results/**` named them):**
- `components/public/ScoreTicker.tsx` + `.module.css` — the layout only.
- `components/public/TournamentNavStatus.tsx` + `.module.css` — the Navbar's tournament branch only; with it
  `lib/tournament-phase-display.ts` (its only other importer was the Navbar).
- `components/public/MyTournamentCard.tsx` — the old Overview only; with it `components/public/FollowTeamPicker.tsx` +
  `.module.css` (MyTournamentCard only). `FollowAlertsToggle`, `UnfollowConfirmSheet`, `lib/team-calendar.ts`,
  `LocationLink` keep callers.
- `components/public/FollowTournamentStrip.tsx` + `.module.css` — the old Overview only (`useTournamentFollowToggle` keeps
  `FollowTournamentLine`).
- `components/public/CountUp.tsx` — the old Overview only (`components/admin/CountUp.tsx` is a different file).
- **Dead CSS the deletions exposed** (selector check, attributed): `Home.module.css` — 95 classes of the old Overview (hero
  grid/orbs/scroll, live-now, day cards, My Team card, champions, record, explore row…) + the keyframes `myTeamLivePulse`,
  `float`, `scrollPulse` that only they used; the club home's classes (`hero`, `heroBanner`, `tournamentCard*`, `stats`…)
  and `fadeInUp` stay, and its frame-keyed rules on live classes stay. `Navbar.module.css` — the event header's 11 classes
  (`hasEventHead`, `eventHead`, `eh*`, `navActions`, `navStatusSlot`); the classes `TournamentPreviewNav` (the admin
  preview's switch-off bar, Part 4) shares — `nav`, `scrolled`, `inner`, `logo`, `links`, `link`, `active`, `actions` —
  stay. `schedule-admin.module.css` `.dateLine` (kept "alive" by NAME by the old Overview's `styles.dateLine`; no renderer).
  `TournamentFrame.module.css`'s `[data-tournament-nav]` hide rule (nothing renders the attribute). Removed structurally
  (postcss: a selector is dropped only if it names a dead class; a rule only when all its selectors went), never by
  pattern. Also the two long-dead baselined classes in the touched sheets: Home `championsHero`/`draftPublicNotice`, Navbar
  `logoSub`/`logoText`.
- **Baselines, by hand (never `--init`):** `.css-selector-baseline.json` lost the Home and Navbar dead entries (both
  gone); `.public-type-baseline.json` Navbar.module.css face/caps/heavy 3/4/3 → 1/1/1 and `components/Navbar.tsx` left it
  (face 4 → none) — exactly the removed rules' lettering. The check is back to exactly §12–§14's 4 orphans + 10 dead
  classes (other sessions').

**Kept, and why:** `isPublicFrameOn`, the cookie, the setter route, the pay page's focused branch, the admin preview
layout's branch, the Branding page's and the public-site editor's `frameOn` (Part 4); `TournamentTopTabs`' default skin and
`TournamentSideRail`'s dark rules (the preview's switch-off branch); `buildPublicLightModeCssVars` (the preview);
`Home.module.css` (club home); the light-mode rules in `globals.css` (live under the frame); `--ticker-h` /
`--nav-visual-h` fallbacks in `globals.css` (0-defaults, harmless; the comment now says nothing sets `--ticker-h`).

**Census — who still reads the switch (Part 4 starts here):** `lib/public-frame.ts` (cookie name, `publicFrameFromCookie`,
`safePublicFrameReturn`), `lib/public-frame-server.ts` (`isPublicFrameOn`), `app/api/public-frame/route.ts` (the setter),
`scripts/seed-public-frame-fixtures.mjs` (the preview link), `app/[orgSlug]/[tournamentSlug]/pay/[token]/page.tsx`
(`focused`), `app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/layout.tsx`, `app/[orgSlug]/admin/tournaments/branding/page.tsx`
(+ `LookCard.tsx`), `app/[orgSlug]/admin/public-site/page.tsx`, `app/api/admin/public-site/route.ts`,
`app/api/admin/tournament-branding/route.ts`, `app/api/public/team-profile/route.ts` + `PublicTeamPage.tsx` (the
`publicFrame=1` flag, §12/§14); a stale comment in `PublicChampionsPage.tsx`. ~29 stylesheets still carry
`data-public-frame` rules (the marker stays on the frame's element; the rules are the frame's look, not the switch).

**Tests (rewritten, not deleted):** Stage 1 frame guard (the layout reads no switch; marker/band/line/role colours
unconditional; light ground, no card style, no `:root` light block; the old bar and its context fields gone; the old ticker
gone and the hook on `schedule-preview` only; the footer is the credit's one home; the follow-strip/picker sheets gone),
Stage 2 guard (the loader hands every moment to `TournamentOverview`, reads no switch, draws no markup of its own; the
moment helper is the one finished rule; the strip and ticker gone), Stage 5 guard (the dock/card/prompt are app-only and
mounted once; **a sweep**: every `'use client'` reader under `components/public` and `lib/hooks` must name a
published-only section literally — a legacy name, a constant or a variable fails; found at `/review`), Stage 0 small fixes
(the Overview body reads no raw score and draws live cards through the row view; MyTournamentCard gone; the nav-status pill
left D4), Stage 6 review (the nav-context mock **throws** on any tab-fact field, so a surface that read one from the context
fails the render test), Stage 6 rules (the Navbar has no tab list), focused page (one gate per piece, everything mounted
once — `openingTags`), public games (the home reads no standings; the finished rule is the moment helper's), club frame
(the Navbar has no tournament param, any spelling), marketing set (the marketing branch is everything after the early
return), tournament look (face and card style unconditional), public teams (**privacy**: `publicVenue` drops every notes
field and keeps the facts; one scrub per venue read of the feed; the Overview's raw venues reach only a server body).
**Non-vacuity by mutation** (each old behaviour put back, the test watched fail, restored byte-for-byte, restore confirmed
by grep): the dock, the prompt and the hook back on the legacy feed; venue notes back in the Schedule feed; the scrub
keeping the notes; the layout and the Overview reading the switch again; a bare ungated dock mount; the rail reading a tab
fact from the context; a reader asking for the plain schedule / plain standings / a section through a constant — **12 of
12 fail as they should.**

**Checks run:** touched + neighbouring unit files 589/589 after the last fix (`demo-destinations-guard` included — the
tour's anchors survive); `npm test` 13,751/13,757 — the **6 failures are all other sessions' uncommitted work** (Stage 6
walk HTML ×3, support console foot, Stripe key prefix, billing ended state), none reads a file of this part. Typecheck
(`NODE_OPTIONS=--max-old-space-size=6144`): no error in this part's files (the last run showed only another session's
`billing-location-server.ts`). ESLint clean on every changed file; spelling clean; public tokens, public type (the lowered
lock above): pass; CSS selectors: exactly the foreign 4 + 10.

**Layout** (`check-layout-invariants.mjs --only=`, every listed width, on the dev server; never a whole-product sweep):
- **0 findings** on `pubt-overview-long`, `pubt-overview-after`, `pubt-schedule-pale`, `pubt-game-pale`, `pubt-standings-own`,
  `-mid-pool`, `-finished`, `pubt-teams-free`, `pubt-team-own`, `pubt-rules-pale`, `pubt-playoffs-pale`,
  `pubt-champions-after`, `pubt-pay-focused` (×4 widths each).
- **24 tap-floor findings, all pre-existing and not this part's** (attributed: their files are untouched here, and the
  layout baseline has never held these screens — last written 2026-10-21, before they joined the sweep): `pubt-overview`
  ×19 — the demo sandbox's own chrome (`Start your own — free`, the three time-travel moments, the tour's four steps and
  "See what game day looks like", `components/sandbox/SandboxChrome.tsx` / `lib/sandbox-chrome.ts`); `pubt-register-open`
  @768 ×3 and `pubt-news-pale` @768 ×2 — the old Register and News bodies' `btn-sm` doors (36 px). **Nothing baselined**:
  they are real findings for the demo chrome's and Register/News's owners, not decisions.
- The first batch **aborted on the memory floor** at `pubt-pay-focused` (4 pages at once; two other sessions' `tsc` runs
  held ~6 GB); the dev server was restarted (deleted files) and the unreached and flagged screens re-run alone at one page
  at a time.
- **Not measured, and NOT this part** (`--width=390`, one page at a time): `pubt-schedule-live`, `-many-days`, `pubt-game-live`,
  `pubt-standings-playoffs`, `pubt-playoffs-live`, `-seeded`, `-eight` — **expired fixtures** (§13/§14: the Stage 3 and Stage 4
  clones' live and upcoming games are dated before 2026-11-04, so their ready markers can never be met); `pubt-schedule-playoffs`,
  `pubt-schedule-bracket-only` — the **stale `/The bracket/` wait** (§13). Each page itself answers 200 on the restarted
  server, and with the switch cookie set to `off` the demo Overview and a Schedule still render `data-public-frame` and the
  band — the half-state is gone. Nothing baselined.

**`/simplify`** (four lenses): applied — one focused-page gate for the fan's pieces; the dead 161 px seed; the context's one
record + one setter; required props (`TournamentNavSync`, `MyTeamDock.fanAlertsEnabled`); the Navbar's one early return;
the loader's one round trip and plain names; `openingTags` for mount counts. Skipped: the layout's count-only News/Rules
reads and the layout + page double reads (need `React.cache` / count queries in `lib/db.ts` — shared, outside this diff);
moving the tournament facts out of the root context (Part 4); a `PublicVenue` type (the feed follow-up); one wording for
"schedule hidden" across the Schedule and a game's page (customer copy → `/docs`); deciding the Navbar mount in `SiteChrome`
(shared site chrome outside this diff).

**`/review`** (high-risk tier for `lib/**` + the shared Navbar/context; lenses correctness/contract, regression/blast-radius,
privacy, test non-vacuity): **no defect in this part.** Confirmed clean: the collapse equals the old switch-on path in the
layout and the loader (mount order, wrappers, attributes, props, data); no surviving reference to a deleted file, export,
field, prop, class or keyframe (code, tests, UAT specs, scripts, knip, marketing shots, demo anchors); the shared sheets'
importers (club home, `TournamentPreviewNav`) use only surviving classes; publicVenue is complete; held-back divisions
cannot reach the chrome. Acted on: the feed sweep and four weak pins strengthened (above); stale comments in
`useTodaysTournamentGames`, `NotOnFocusedPage`, `useTournamentFollowToggle`, `ClubHome.module.css`,
`dues-installment-view.ts`, `tournament-schedule-status.ts`. Recorded: the pay page's switch-off half-state and the
preview's (above); the feed findings (handed on).

**Handed on:**
- ⚠ **NEXT, owner-approved 2026-11-04 — the public feed fix (its own change, releasable on its own):** send an allow-listed
  tournament (the fields pages read — `RegisterContent` reads `settings.payment_instructions` when it is shown on the form)
  and cut or scrub the org's `tournaments` list; gate `announcements` on News's visibility and a post's divisions; decide
  whether the plain `schedule`/`teams`/`standings` sections should stop being public (their callers: the game page, the share
  images, `CoachLiveSchedule`, `lib/follow-feed.ts`); a `PublicVenue` type so the notes rule is compiler-held. Privacy lens.
- ⚠ **The team-profile feed withholds a held-back team only when the caller sends `publicFrame=1`** (pre-existing, live on
  prod; §14) — Part 4 owns the flag. **Owner question:** are game notes private? (§14: `publicFrameGame` says yes; the new
  game page shows them.)
- **Part 4:** the pay page's `focused` (now the only thing the switch changes on a live tournament page); the admin
  preview's switch-off branch (dark chrome around the new Overview); `TournamentTopTabs`' default skin + `fixed`,
  `TournamentPreviewNav` and the Navbar.module.css classes it shares; the rail's dark rules; the Rules layout menus (§12);
  moving the tournament facts out of the root `OrgNavContext` into the tournament layout (`/simplify`'s altitude note).
- **Layout owners, not this stage:** the demo sandbox chrome's tap targets (19 findings above); the old Register and News
  bodies' 36 px doors at 768.
- Still owed, not this part: the legacy tournament-data sections exposing held-back team and division names; the tournament
  share image's counts (§14 handed on); the playoff-bracket and fan-live-score marketing shots (5e); the two stale
  `/The bracket/` layout screens and the expired Stage 3 / Stage 4 fixtures; white text on team-colour fills in the share
  images (advisory); the admin strip's 34 px "Dismiss"; `/release` §1d-2's sharp probe; the club editor's unlabelled 18 px
  input; `scripts/mobile-review-capture.mjs`'s "ticker precedence" comment.

## 16. The public feed fix (committed `55045ecf4` 2026-11-04; its own change, not part of Parts 1–3d)

**What a customer sees:** nothing on a page that was working. Schedule, Standings, Teams, Playoffs, Register (payment
instructions on the form included), News, the Overview and a game's page read the same. **Three small differences:** (1) a game's
page no longer shows a "Notes" line (owner ruling, below; the page is new on `dev`, so nothing is taken from a customer on
production); (2) the tournament's share image counts only the divisions the organizer has published, shows no count tiles at all
while every division is held back (rather than a row of dashes), and its live score line follows the Schedule switch; (3) a
held-back team's page is withheld for everyone, not only for a caller that sends a flag. **For the organizer:** the Register
switch, the News switch, "show fees" and "show how to pay on the form" now decide what leaves the server, not only what the
page draws.

**Owner rulings in-session (2026-11-04):** Q1 **a game's notes are private** (the game page's "Notes" fact goes; the plain feeds
no longer carry them). Q2 **fold the team-profile gap in** (the withhold is unconditional). Q3 **own commits on `dev`, a small
hand-port for production** (below: it is not a straight cherry-pick).

**Where the brief was wrong, argued from the code:** (a) *"the scorekeeper's identity (`scoreSubmittedBy*`)"* is not in the
feed: `getGames` never maps those columns, so only `notes` leaked; the strip stays as defence and is now tested with the fields
on the fixture. (b) *"stop serving the plain sections"* is safe **on `dev`** (every browser reader was already on a published-only
section but the coach portal's live schedule) and **unsafe on production**: production's legacy `ScheduleContent`,
`StandingsContent`, `TeamsContent`, `MyTeamDock`, `TournamentNavStatus` and `useTodaysTournamentGames` still poll the plain
sections from the browser, so the production port must **scrub** them, not remove them. (c) *"keep it for server callers"*: with
notes private every server caller moved to a published-only section too, so the plain sections have no caller left and are
deleted (`scores`, the consumer feed, stays, server-only).

**What changed.**
- `lib/public-tournament-shape.ts` (new): the feed's `tournament` is a branded `PublicTournament`, built only by
  `publicTournament()` (a raw `Tournament` does not type-check against it). Fields: id, name, slug, status, dates, the public
  contact, hidden pages, finalization, champions stamp, and settings `format` / `game_duration_minutes` / `tie_breakers` /
  `tie_breaker_scope`. **Register only, and only while the page is on and the organizer shows fees** (`registerShowsFees`, the one
  answer the server and the Register page both read): the fee schedule, `fee_scope`, `show_fees_on_register`, the coach-email
  confirmation flags, and the how-to-pay text only when it is also set to appear on the form. The event's look (theme, logo) rides
  only for server readers that pass `{ look: true }` (the three share images, the scores feed); the HTTP route cannot. Also:
  `publicDivisions` (a division's fee schedule goes only where the Register page shows fees), `publicNotices` (below),
  `PublicTournamentFacts` (the structural type the pure helpers read).
- `lib/public-tournament-data.ts`: `tournaments` removed from the result; the plain `schedule` / `teams` / `standings` sections
  deleted; `getAnnouncements` is read only while News is on; the `scores` branch blanks a held-back opponent in a published
  division's crossover game and strips notes; a hidden Register page sends no fee schedule (found at `/review`: it did).
- `lib/public-teams.ts`: `PublicVenue` (`notes?: never`, compiler-held, venue and field).
- `app/api/public/tournament-data/route.ts`: serves `context`, `schedule-preview`, `teams-preview`, `standings-preview`,
  `playoffs`, `rules`, `register`. `schedule`, `teams`, `standings`, `scores` answer 400.
- `app/api/public/team-profile/route.ts`: a held-back team is withheld for every caller, and the published-only shape is the only
  shape (a crossover game no longer names a held-back opponent whatever the caller sends). `PublicTeamPage` still sends
  `publicFrame=1`; the route ignores it (the param goes with Part 4).
- Callers moved to `schedule-preview`: the coach portal's live schedule, a game's page and its share image, the team share image,
  `lib/follow-feed.ts`. The tournament share image reads `teams-preview` (counts of published divisions; champions need
  `!teamsWithheld`; the live line needs the Schedule page on). A game's page has no Notes fact.
- The admin preview builds its public data through the same shape (`publicTournament`, `publicVenue`, `publicDivisions`).
- Consumers narrowed to `PublicTournamentFacts` / `PublicTournament`: `public-standings`, `public-playoffs`, `public-schedule`,
  `playoff-picture`, `entity-follow-status`, `RegisterContent` (which now calls `registerShowsFees`). The compiler found no
  reader of a field outside the shape — the census held.
- `components/public/NewsContent.tsx` (not in the feed, found at `/review`): the client division filter gets id and name, not the
  whole division (fees, settings) in the page's RSC payload.

**Data feeds, before → after (an anonymous caller):**
| | before | after |
|---|---|---|
| `tournament` | the whole record (settings incl. `payment_instructions`, fees, directory and notification flags, `organizationId`…) | 10 fields + 4 settings keys; Register adds fees/instructions only as shown and only if the page is on |
| `tournaments` | every active/completed event of the club, raw `contact_email` | gone (nothing read it) |
| announcements | every site post, whatever News's switch or the post's division | pinned only, News on, none aimed at a held-back division |
| plain `schedule` / `teams` / `standings` | all divisions, held-back team names, 0-0-0 rows, game notes | 400 |
| `schedule-preview` etc. | notes stripped; division fees, venue notes (since 3d) | + no fee schedule, no `tournament` extras |
| team profile (no flag) | held-back team's coach, seed, pool; crossover opponent names | withheld / published-only shape |
| share image | counts and live line included held-back divisions and a hidden Schedule | published only; no tiles when nothing is published |

**Decisions made here, easy to flip:** a pinned post naming several divisions is hidden if **any** is held back (a post that
names a held-back division would give it away; the cost is that a published division's families wait for the post);
division age/capacity/closed fields still ship (the Register page shows them); `rules` and `register` still list every division
name (registration and rule tags need them; no team is named); `scores` keeps every accepted team (server-only; the follow
status counts them) but its games no longer point at a held-back team.

**Tests (`tests/unit/public-feed-privacy.test.ts`, new, 51; plus rewritten guards).** It runs the **real feed** against a fake
database holding the things that must not leave (payment text, waiver text, other events' contacts, held-back team and division
names, game and venue and field notes, scorekeeper identity, a notice aimed at a held-back division, internal flags) and reads the
JSON of **every section the route's own source lists**, so a section added there is swept without anyone remembering. Also: the
route's behaviour (a plain section is refused before the feed is asked; the look cannot be passed), the Register on/off and
fees-hidden and page-hidden cases, the crossover door on every game-bearing section, the pieces one by one, a compiler pair
(`@ts-expect-error` for the raw record, the raw venue and a raw field — enforced by `npm run typecheck`, not `npm test`), and a
source sweep. Rewritten, not loosened: the Stage 3/4/5/6 guards that pinned the old shapes, the team-reads guard, the game-detail
test (now proves the Notes line is gone), the three render fixtures; the payments-tracked census now also accepts
`registerShowsFees`. **Non-vacuity by mutation, 25 of 25** (each old behaviour put back, the test watched fail, restored
byte-for-byte, restore verified by `cmp`): the whole record back; `tournaments` back; every announcement; a notice aimed at a
held-back division; News ignored; venue notes; instructions regardless of the form switch; fees though hidden; fees while the
Register page is off; division fees everywhere; the look on every response; the plain schedule or `scores` served by the route;
an unknown section not refused; the route passing the look; the withhold only with the flag; the game page's notes; the share
image's live line ignoring a hidden Schedule; the coach portal and the game page back on the plain section; the scores crossover
door; scorekeeper/notes unscrubbed on standings and playoffs; the crossover door in the published-only feeds; the organization
contact ignoring the switch; `teamsWithheld` dropped.

**Checks run:** public unit tests 764 with the 3 foreign Stage 6 walk failures only; full `npm test` 13,853 — **8 failures, none
read a file of this change**: Stage 6 walk HTML ×3, support console foot, billing ended state (the foreign five of §15), the
practice-plan door N1 and the series date-removal taps (recent commits of other sessions), and one of mine, found and fixed in
the last run (the payments-tracked census, above). Typecheck (`NODE_OPTIONS=--max-old-space-size=6144`) clean; ESLint clean on
every changed file; spelling, public tokens, public type, CSS purity, date correctness: pass. `check-org-slug-callers` (club
own-address panel) and `check-demos` (a missing `lib/tournament-teams` under `registration-attention.ts`) fail on other
sessions' files. **Payload readback on the restarted dev server** (Lakeshore `stage1-lakeshore-lightning/fall-classic`,
Riverdale `riverdale-minor-ball/summer-classic`, Hamilton `stage1-hamilton-wentworth/spring-invitational`): all 7 sections ×
3 events: 200, no `payment_instructions`, `notes`, `scoreSubmittedBy`, `tournaments`, directory or notification field in any;
`schedule`, `teams`, `standings`, `scores`: 400; Hamilton's Register (show fees off) sends no fee schedule; the team profile
without the flag answers the published-only shape. The seeded events hold **no** held-back division and no instructions set to
show on the form, so those two rules were proved by the unit tests, not by the readback. Pages: the Overview, Schedule, Standings,
Teams, Playoffs, News, Rules, a game, a team, Register and the four share images all answer 200.

**Layout** (`--only=` on the changed public screens, 4 widths, `--workers=1`, dev server): **0 findings** on `pubt-schedule-pale`,
`-game-pale`, `-standings-own`, `-teams-free`, `-team-own`, `-playoffs-pale`, `-rules-pale`; `pubt-register-open` @768: the 3
known 36 px doors (§15), nothing new. Nothing baselined; memory never neared the floor.

**`/simplify`** (four lenses): applied — the look type is the existing `LookTournament`; one options type; the Register page
calls `registerShowsFees` instead of its own copy; one owner for the fee decision (`publicDivisions`, also used by the admin
preview's Register); the announcements read skipped when News is hidden; an early return and a local flag; stale comments; a
no-op assertion. Skipped, with reasons: a pick-list allow-list generator (a second spelling of the same list is checked by the
tests), per-function `Pick`s instead of `PublicTournamentFacts`, the team-profile route's now-dead `pool`/`teamsQualifying` (a
type in another file and Part 4 deletes the plain shape), the page's `publicFrame` param (Part 4), moving `isDivisionSchedulePublished`
into the shape module (it imports a server-only module that the Register page loads in the browser), a dedicated share-image
section.

**`/review`** (high-risk tier; lenses privacy (mandatory), correctness/contract, regression/blast radius, test non-vacuity):
**three defects found and fixed** — a hidden Register page still sent the fee schedule and how-to-pay text; the `scores` games
could name a held-back opponent to a follower of the published team (and the first fix blanked a withdrawn finalist, which would
have cost a champions card); the News page's client filter carried whole divisions. **One customer-visible regression found and
fixed:** the event's share image would have read "— TEAMS / — DIVISIONS" before any schedule is published. **Test gaps closed:**
payment instructions were never exercised off the Register section (the fixture had them switched off); the crossover door and
the scorekeeper fields were never on the fixture; no test ran the route; the facility-level `notes` type was unpinned.
Confirmed clean: every consumer of the narrowed shape, the Register page for tracked/untracked/hidden-fee events, the admin
preview, the hot paths (the polled schedule read costs what the plain one did, and drops the announcements read when News is
hidden), the team-profile caller.

**Handed on:**
- ⚠ **Production port (Q3).** This change **will not cherry-pick onto production's branch** (`origin/master`, 114 commits behind
  `dev`): `lib/public-teams.ts` (`publicVenue`, `publicFrameGame`, the `teams-preview` / `schedule-preview` scrubbers) does not
  exist there; the feed file differs by about 25 lines; the `playoffs` and `standings-preview` feeds there still ship game notes
  and venue notes; and production's legacy pages still poll the **plain** sections from the browser, so the port must scrub them
  (published divisions' teams only, no notes, the narrowed tournament, no `tournaments`, notices as above) rather than remove them.
  Production's legacy components also read more of the tournament than `dev`'s do — **re-run the field census on production's
  components before narrowing there.** The new logic is in new files (`public-tournament-shape.ts`) and the conflicts are
  `public-tournament-data.ts`, the two routes, `public-teams.ts` and every caller listed above. Not touched: `master`, production.
- **The service worker keeps old payloads.** `public/sw.js` caches `/api/public/*` JSON network-first under `CACHE_VERSION` `v13`;
  an installed device holds old full responses (raw tournament, notes) for its offline fallback until the version is bumped.
  Left alone (a shared file, every device re-downloads); bump it in the release that carries this. An open tab from before the
  deploy that polls a removed section gets a 400 and silently stops updating until reloaded (no error state, no loop).
- **Same privacy class, not in the feed, left:** the News page and the Overview's news list show a post aimed at a held-back
  division to everyone, and the News division filter lists every division name (the NewsContent change above only shrinks what
  the browser is sent). `scores` still lists every accepted team to its server-side consumers. A free-text game placeholder an
  organizer types is shown as typed.
- `getDivisions` never fills `contactMemberId`, `acceptedCount` or `settings`, so they never leave; `lib/public-teams.ts` and
  `public-team-profile.ts` read `division.settings?.game_duration_minutes`, which is therefore always empty from this feed
  (a latent default-duration bug; not verified, not this change).
- Still owed, not this change: Stage 8 Part 4 (the admin side, the switch, the pay page's focused branch, the admin preview's
  switch-off branch, the Rules layout menus, the team page's `publicFrame` param); the demo sandbox chrome's 19 tap-floor findings
  and the old Register/News 36 px doors; the playoff-bracket and fan-live-score marketing shots (5e); the two stale `/The bracket/`
  screens and the expired Stage 3 / Stage 4 fixtures; white text on team-colour fills in the share images (advisory); the admin
  strip's 34 px "Dismiss"; `/release` §1d-2's sharp probe; the club editor's unlabelled 18 px input.

## 17. Part 4a record (the public side of the switch's removal; committed `ecffa177f` 2026-11-04; releases with the flip)

**What a customer sees:** nothing (nothing promoted). **An owner on dev, switch on (the default):** nothing on a public page;
the organizer's **Rules & resources** page has no "Layout" menu on either card. **Switch off (the preview link's `off`):**
the public pages, the pay page and the admin preview now all wear the frame whatever the cookie says — the pay page's heading
is "Team payment" with the organizer's contact line, and the preview has the band, the white rail and the footer, never the
old dark bar. What the switch still changes, until 4b: the **Branding page** (the four old cards and the Look card's band
preview) and the **public-site editor** (its tournament-look part and typed colour codes) — a dev-only admin half-state
(the review's blast-radius finding), accepted by the split. ⚠ Not promotable before Parts 4b–6 (§5).

**Owner rulings in-session (2026-11-04), all as recommended:** Q1 **split Part 4**: 4a the public side (this), 4b the
admin side then the switch itself (build prompt `PUBLIC_TOURNAMENT_STAGE8_PART4B_BUILD_PROMPT.md`). Q2 **remove both Rules
layout menus** and stop accepting their keys; keep the stored values (like ask C). Q3 **production losses accepted as
ruled** (asks A/B: Dark/Light, the hero banner photo, the per-tournament font, card style; plus the Rules menus): no
production count.

**Where the brief was wrong, argued from the code (said before building):** (a) *"delete `lib/public-frame.ts` and
`lib/public-frame-server.ts`"* would break every public page — they also hold the frame's live helpers (`publicFrameAttr`,
`publicFrameBand`, `publicFrameHost`, `publicFrameRoleCss`, `publicTournamentContactEmail`, `publicFrameBandFacts`); only the
cookie pieces go (4b). (b) *"~29 stylesheets carrying switch rules"*: 18 carry `data-public-frame`, and nearly all of it is
the frame's live look (the marker is on every live page); four sheets held rules that can never match (below). (c) *"move
the tournament facts out of the root context, if small"*: not small — the installed app's bottom bar (`ConsumerNav`,
mounted by the root layout outside the tournament layout) needs `tournamentId`; moving half would leave two channels.
**Recorded, not done.** What WAS dead there is gone (below).

**What changed.**
- Pay page: `isPublicFrameOn` and `focused` gone; the contact is always looked up (it already was on dev, switch on);
  `TeamPayContent` always renders the focused heading, the contact line rule (A1/A2 unchanged), no `page-content` floor.
  `PayPageView.tournamentName` (the old eyebrow, its one reader) dropped.
- Admin preview layout: the frame branch only — the old dark top bar (`TournamentPreviewNav` + its sheet), the old tab row
  (`TournamentTopTabs` default skin + `fixed` + its whole sheet), the light-mode `:root` block (`buildPublicLightModeCssVars`,
  no caller since 3d), `getPreviewColorMode`/`getPreviewCardStyle`, the `navOrg` logo juggling — all deleted.
- `TournamentTopTabs`: one look, no `skin`/`fixed` (the band stops passing `skin`). `lib/tournament-page-tabs.ts`: the tab
  list carries no icons (its last two icon consumers went).
- `TournamentSideRail`: links only — no identity header/crumb/logo/name, no icons, no "Live on FieldLogicHQ" line (all
  hidden or never drawn under the frame), no `logoUrl`/`heading`/`colorMode` props, no nav-context read; its sheet keeps the
  marker-keyed rules and the bare hooks, `.shell` gone (both layouts drop the class; the desk grid places the rail).
- Nav context: the org's name/logo/home link and the tournament's name had one reader, the rail's hidden header — removed
  with `OrgNavSync` (its three mounts: the org layout, the tournament layout, the public-site editor's logo updates) and
  `TournamentNavSync`'s `name`. What stays: `tournamentId` (the flip pill, the app bar), the dates and status (today's line).
- Rules & resources: both Layout menus, their state, save, words and `.tool` sizing; the tournaments API's settings
  allow-list no longer accepts `rulesLayout`/`resourcesLayout` (a stale write is dropped); the type marks them RETIRED.
- Team page: `publicFrame=1` no longer sent; the team-profile route stops sending `poolRank`, `poolRankLabel`,
  `isChampion` (no reader anywhere) and stops computing the pool name and a top-N "playoff spot" the contract overwrote
  (`teamProfilePreview` supplies both through the ruled advancing rule). The runner-up fact is unchanged.
- Stylesheets: deleted rules that can never match — the club home sheet's `[data-public-frame]` and `[data-live-chrome]`
  blocks (its only importer is the club's own home page), the preview exit pill's (it mounts beside the frame), the
  rep-team subscribe panel's (outside the tournament layout), the news badge's (no renderer); `Navbar.module.css`'s old bar
  classes (`.nav`, `.inner`, `.logo`, `.logoImg`, `.orgName`, `.links`, `.link`, `.actions` and their media rules — only the
  preview bar used them); stale `globals.css` comments.
- `scripts/layout-screens.mjs`: the two admin-preview screens wait for the band (`[data-public-frame-band]`), not an `h1` —
  the frame draws no page heading, so they could not render on dev since Stage 1 Part 2; now measured.

**Importer checks (grep re-run before each deletion; nothing outside the deleted set):** `TournamentPreviewNav.tsx` + sheet
(only the preview's old branch), `TournamentTopTabs.module.css` (only the old skin), `OrgNavSync.tsx` (three mounts, all
write-only), `buildPublicLightModeCssVars` / `getPreviewColorMode` / `getPreviewCardStyle` (only the preview's old branch),
the Navbar classes (`Navbar.tsx` uses only `marketing*`/`bottomNav*`), the rail classes, `TOURNAMENT_PAGE_TABS[].Icon`, the
RULES_WORDS layout keys. Two comments elsewhere named `OrgNavSync` as a pattern (CoachPortalShell, SandboxChrome) — fixed.
Dead-code report (`knip@5`): none of this part's files listed; nothing it deleted is still imported.

**Tests (rewritten, not deleted):** Stage 1 frame guard (the preview always wears the frame and its old half's files are
gone; the rail is links only and the old rail CSS gone; the context has no identity fields and `OrgNavSync` is gone;
the band passes no skin and hands the row its `basePath`; a sheet whose classes never render in the frame carries no
frame rule — `importersOf`, a local resolved-import finder; **NEW census: who still reads the switch** — exactly the two
admin routes, the setter and the two definition files, across app/components/lib/scripts/proxy, names or the literal
cookie), focused page (the pay page is focused for everyone; no switch, no floor, no tournament-name eyebrow), club frame
guard (one tab-row look), Stage 5 guard (the team page sends no flag; the route sends nothing unread), tournament look (no
`OrgNavSync`; the preview's shell), Stage 5 settings (no Layout menus, words, API keys; the readers census), Stage 6 review
(the context mock is empty: any field read fails), playoff plan (the playoff spot is the contract's rule), the team-profile
fixture. **Non-vacuity by mutation, 33 of 33** (each old behaviour put back, the test watched fail, restored, every file's
sha1 identical after): the pay page reading the switch / the tournament-name eyebrow / the page floor; the preview's old
bar / switch read; the light-mode block and the preview helpers back; the rail reading the context / drawing an icon /
its header and page padding back; the rail shell back in the layout; the club home's frame and live-chrome rules; the exit
pill's, the subscribe panel's and the news badge's rules; the context's org name; an org sync in the org layout, the
public-site editor and the tournament layout; the tab row's `fixed`; the band's `skin`; the band dropping `basePath`; a
Rules Layout menu; the API accepting the key; a layout word; a component reading the retired key; the team page's flag;
the route's pool-rank label; a rail render reading the context; a new switch reader; the cookie spelled out by hand.

**Checks run:** touched + neighbouring unit files 512/512 (`demo-destinations-guard` included — the tour's anchors
survive); full `npm test` 13,868 — **7 failures, all other sessions' and recorded in §16** (Stage 6 walk HTML ×3, support
console foot, billing ended state, practice-plan door N1, series date-removal taps); one of mine found and fixed (the
playoff-plan test pinned the route's top-N copy). Typecheck (`NODE_OPTIONS=--max-old-space-size=6144`) clean, whole project.
ESLint clean on every changed file (two pre-existing warnings in `team-profile/route.ts` and `lib/types.ts`). Spelling,
public tokens, CSS purity: pass. Public type: `Navbar.module.css` left the baseline (its heavy/caps/face were the old bar's)
— entry removed BY HAND. CSS selectors: exactly the foreign 4 + 10 (§15). `check-demos` fails on another session's missing
`lib/tournament-teams` (§16).

**Layout** (`check-layout-invariants.mjs --only=`, 4 widths, `--workers=1`, dev server): **0 new findings** on
`pubt-schedule-pale`, `-overview-long`, `-playoffs-pale`, `-team-own`, `-rules-pale`, `-pay-focused`, `admin-t-rules`
(its baselined findings are the admin strip's 34 px "Dismiss", owed since §11), `admin-public-site-look`, and — newly
measurable — `admin-t-preview` and `-schedule`; `admin-t-branding`, `-branding-look`, `admin-public-site` @1440 clean.
**Baseline pruned: 61 `admin-t-preview*` entries** that no longer reproduce (the old dark preview's contrast and tap-floor
rows, recorded 2026-10-21) — `--prune` scoped by `--only` to those two screens, nothing else touched. The first batch's
preview screens timed out on the `h1` wait (above) and the run neared the memory floor; the dev server was restarted
(deleted files) and the preview re-run alone. After the restart the login page, an Overview, Schedule, Register, Playoffs,
Rules, Teams, the pay page and two club homes answer 200; the Branding page and editor render signed in.

**`/simplify`:** not run — no new abstraction in product code (the one new helper, `importersOf`, is local to a test).
**`/review`** (high-risk tier: `lib/**`, the org layout, `globals.css`, the shared Navbar sheet, a public endpoint; lenses
correctness, regression/blast-radius (mandatory), data & contract + privacy, test non-vacuity): **no defect in the code.**
Confirmed clean: the preview equals the old frame branch; the rail/tab row/pay page behave as before with the switch on;
the team profile's response is a superset of every reader's needs and held-back teams stay withheld; a hidden organizer
contact stays hidden on the pay page; no surviving reference to any deleted file, export, prop, class or field (code,
tests, UAT, scripts, shots, tour anchors, baselines). Acted on (test gaps): the census walks widened (components `.ts`,
scripts, proxy, the literal cookie); `importersOf` sees bare and dynamic imports; the playoff-plan test reads code without
comments; four over-pinned patterns loosened; the band's `basePath` hop pinned (unpinned since Stage 1). Recorded: the
admin half-state (above, 4b); the pay page's contact read now runs for every view (as on dev today; cached with the
footer's); an open old team-page tab loses the dropped fields until reload (no reader).

**Handed on:**
- **Part 4b** (build prompt written): the Branding page's old half and API legacy fields (+ make only the Branding page pay
  for the band-facts read — event settings and the setup wizard share the route), the hero-banner route and the dashboard's
  banner term (owner ask: count a chosen type look too?), the copy lists (dead columns; the retired Rules keys still
  travel with a copied event's rules), the public-site editor's `frameOn`/`hex`, then the cookie, its reader, the setter
  route, the preview-link lines, the stale "behind the preview switch" comments (incl. `lib/public-frame.ts`'s header and
  `layout-screens.mjs` ~1891), and the census test's list → empty.
- **Part 5c (`/docs`), add to its list:** the Rules & resources guide still describes the Layout menus
  (`lib/help-content/tournaments.tsx` ~397: "Each card's Layout sets how the public page lays it out…") — the control is gone.
- **Recorded, not done:** moving `tournamentId`/dates/status out of the root context (needs a root channel for the app bar).
- `Home.module.css` (club home) still carries the old Overview's other classes (pre-event panel, countdown…) — whether the
  club home uses them is a club-home question, not this switch's; `.featuredBadge`'s base rule is baselined dead.
- Still owed, not this part: as §16 (production port of the feed fix; the service worker's `CACHE_VERSION`; the News/
  Overview held-back-division post; the demo chrome's tap floors; the old Register/News 36 px doors; 5e's shots; the admin
  strip's 34 px "Dismiss"; `/release` §1d-2's sharp probe; the club editor's unlabelled 18 px input).

## 18. Part 4b record (the admin side, then the switch itself; committed `72cd94a46` 2026-11-04; releases with the flip)

**What a customer sees:** nothing (nothing promoted). **An owner on dev:** the Branding page is the door, Pages, the
**Look** card and **Logo** — for every browser, no step taken; a plan without advanced branding sees one lock line,
"Your logo, colours and type on this site". The club's Public site editor always shows the Tournaments part (on a plan
that carries tournaments) and always takes a typed hex code. The preview link is gone (`/api/public-frame` answers 404).
The dashboard's "branding done" ticks for a logo, own colours **or a chosen type look**, never the retired banner.
⚠ Not promotable before Parts 5–6 (§5).

**Owner ruling in-session (2026-11-04):** `hasBranding` counts a chosen type look (`theme_font`), as recommended.
**Design choice (said up front):** a stale tab's `themeFont` / `themeCardStyle` / `colorMode` is **ignored, not refused**
— refusing would drop the same save's Pages and coach-names change, and nothing reads those values; it also stops the old
font list writing values like `barlow` that clash with mig 426's meaning.

**The brief against the code:** every claim re-opened held (the three switch readers, the hero-banner route's one caller,
the two other callers of the Branding API, the words census). One adjustment: the band flag rides the GET only
(`${brandingUrl}&with=look`), so the draft's PATCH address — its identity in the edit-race guard — is unchanged.

**What changed.**
- Branding page: the old Theme (swatches, Custom, hex, Dark/Light, low-contrast, inherit note), Hero banner, Font and
  Card style cards; `bodyOf`; the `frameOn` state and Held field; the Draft's `fontKey`/`cardStyle`/`colorMode` (`Draft`
  is now look-draft.ts's `FrameBodyDraft`); `BrandingSettings.heroBannerUrl/themeCardStyle/colorMode/frameOn`;
  `previewTheme`/`presetName`; all banner state and the `'banner'` upload/remove branches (now `uploadLogo`/`removeLogo`);
  the imports only that half used; the lock line → `LOCK_WORDS.brandingLook` always; the logo hint → the frame's always.
- Words: the 19 old-half `PUBLIC_SITE_WORDS` keys and `themeSummary`; `LOCK_WORDS.branding` (its one user went). The
  lock line's wording stays a Part 5d `/strategy` drift check.
- CSS: `branding.module.css` → the six logo classes only (the kit overrides folded in; `.page`/`.card` gone);
  `site.module.css` `.hexRow`. The one-window guard's `branding.module.css .label` entry rewritten (the class went).
- Branding API: GET drops `hero_banner_url`, `theme_card_style`, `color_mode` and `frameOn`; keeps `themeFont` (seeds
  `typeKey`); band facts only on `with=look` (event settings and the setup wizard never pay for them — tested). PATCH:
  `VALID_FONTS`, `VALID_CARD_STYLES`, the old `themeFont` rule, `themeCardStyle`, `colorMode` gone; `PLUS_VISUAL_FIELDS`
  = the theme three + `typeLook`; `theme_font` is written only from `typeLook`.
- Hero banner (ask A): `app/api/admin/tournament-hero-banner/route.ts` deleted. Dashboard: the select swaps the banner for
  `theme_font`; `hasBranding` per the ruling. `organizations.hero_banner_url` and its route untouched (the club home's
  banner is live).
- Copy lists (ask C keeps the columns): `cloneTournament` and `populateTournamentFrom` copy `logo_url`, the theme three
  and `theme_font` only; the retired `rulesLayout`/`resourcesLayout` keys never travel (clone deletes them
  unconditionally; populate's `RETIRED_KEYS` are never allowed). `lib/types.ts` and the `lib/db.ts` row mapper keep the
  dead fields (the dictionary still lists the columns — Part 5b's `/db` pass decides).
- Club editor: the route's `frameOn` read and response, the page's `frameOn` state; `tournamentRule = carries.tournaments`;
  LookPanel's and LookSwatches' `hex` prop → the typed hex field always.
- The switch: `PUBLIC_FRAME_COOKIE`, `publicFrameFromCookie`, `safePublicFrameReturn` (lib/public-frame.ts, header
  rewritten), `isPublicFrameOn` (lib/public-frame-server.ts), the setter route `app/api/public-frame/route.ts`, the seed's
  preview-link lines (the marker string kept). `proxy.ts` and `public/sw.js` never named the cookie. Stale "behind the
  preview switch" comments rewritten across the frame's stylesheets and components, ConsumerNav, TournamentLookPart,
  PublicChampionsPage and `layout-screens.mjs`.
- Baselines, BY HAND for exactly the removed code: `.admin-restyled-baseline.json` (the branding sheet's entry gone; the
  page held at its two literals), `.tsx-token-baseline.json` (the page 10 → 3 hex), `.layout-baseline.json` (59
  `admin-t-branding*` rows for the removed cards pruned with `--prune --only=` the three Branding screens; the six
  "Dismiss" rows stay). `.css-selector-baseline.json` / `.public-type-baseline.json`: no entry for these files.

**Tests (rewritten, not deleted):** Stage 1 frame guard ("the preview switch is gone": no cookie/reader/redirect export,
the frame's live helpers kept, no setter route, no preview link; the census is now EMPTY and widened to every
.ts/.tsx/.js/.mjs/.cjs under app/components/lib/scripts, read raw as well as comment-stripped), tournament look, Stage 5
public site, Stage 0 small fixes (D7 now pinned on `frameBodyOf`), one-window guard. **NEW**
`public-tournament-stage8-branding-page.test.ts` (16 tests): the page's controls are exactly Pages, coach names, the Look
card and the Logo (raw form controls inventoried), each with its public reader NAMED — Pages → the layout's hidden list /
`isPublicPageEnabled`, coach names → `toPublicTeam`, colours + type → `resolveTournamentLook`, Logo → `publicFrameBand`
(the real code runs wherever it imports cleanly); the old cards, words and CSS gone; the band flag; PATCH ignores the
stale keys; the banner route, `hasBranding`, the copy lists; the editor without its switch half.
**Non-vacuity by mutation, 36 of 36** (each old behaviour put back, the tests watched fail, reversed on a fresh read,
sha1 identical after): the reader / cookie / redirect helper back; the setter route back; the seed's link; the cookie in
sw.js; a `frameOn` in a component; the editor's `frameOn` response and gate; LookPanel's and LookSwatches' `hex`; band
facts for every caller; event settings sending `with=look`; GET reading the banner; PATCH validating `colorMode`, writing
the old font rule, writing card style; a Theme card; the old lock line (page and words); a second body; Held's
`frameOn`; the save sending the font; a Theme word; `themeSummary`; a swatch rule; the hex row; the banner route back;
the dashboard counting the banner / ignoring the type look; clone copying the banner; populate copying card style; clone
carrying the Rules keys with the rules; populate letting a Rules key through; the coach-name reader leaking; the
one-window entry back.

**Checks run:** touched + neighbouring unit files green (frame guard 39, Stage 8 Branding 16, tournament look 51, Stage 5
public site 10, Stage 0 8, one-window 17, and 237 across the public-tournament stage guards, feed privacy, focused page,
site builder, Stage 5 settings and `demo-destinations-guard`); full `npm test` 13,908 — **7 failures, all other
sessions' and the same seven §16/§17 record** (Stage 6 walk HTML ×3, support console foot, billing ended state,
practice-plan door N1, series date-removal taps). Typecheck (`NODE_OPTIONS=--max-old-space-size=6144`): one error,
another session's (`tryout-report.test.ts` `childId`, Stage 14). ESLint: 0 errors on changed files (pre-existing warnings
only). Spelling, public tokens (all scopes), public type, `verify:changed`: pass. CSS selectors: only foreign findings
(4 orphans + 11 dead classes, none in these files). Dead-code report (`knip@5`): nothing deleted is still imported,
nothing kept went dead. **Layout** (`--only=`, 4 widths, `--workers=1`, dev server): 0 new findings of this part's — the
admin strip's 34 px "Dismiss" (owed since §11) and the club editor's 18 px input (owed, §17) are the only rows. Dev
server restarted (files deleted): the first restart answered 500 from a cache naming the deleted banner route — stopped,
`.next` cleared, restarted; login, Schedule, Register and Playoffs answer 200, the old preview link 404, and the
Branding page, its Look screens, the editor, the dashboard, event settings and the pay page all rendered in the layout run.

**`/simplify`:** not run — no new abstraction (one query flag). **`/review`** (high-risk tier; lenses blast radius
(mandatory), correctness + data/contract, test non-vacuity): **no defect in the code.** Acted on (test gaps): the
control inventory made as strict as its title; the census widened (.js/.mjs/.cjs, raw read) and `/api/public-frame`
matched exactly; the CSS class scan made selector-only. Recorded: the coach-names reader is pinned by source (its module
imports the database); the PATCH "ignored" claim is pinned by source; mig 426's prod step (it empties `theme_font`) must
be applied before the promote or a legacy font value would tick "branding done" — it is already a Stage 1a prod step,
and Part 5a's empty repeats it.

**Handed on:**
- **Part 5c (`/docs`), add:** the Branding help article (`lib/help-content/tournaments.tsx` ~205, ~443 searchText, ~453,
  ~521) still says a tournament has a "hero banner" and "fonts".
- **Part 5e (`/demos`):** `scripts/seed-theme-variants.mjs` still writes `color_mode` / `theme_card_style` (inert now;
  already listed as "remove the old-state theme-variant seed").
- **Part 5b (`/db`):** the dead fields stay on `lib/types.ts` and the row mapper with their columns (ask C).
- Still owed, not this part: as §16/§17.

## 19. Part 5 record (the data and the wording around it; committed `393b78045` 2026-11-04; releases with the flip)

**What a customer sees:** nothing (nothing promoted). **An organizer on dev, in the help:** the Public site page is
described as it is: the door, Pages, then **Look** (colours, a preset or your own two with a hex code each; type Classic /
Serif / Clean; the band preview "On a phone") and **Logo**. A plan without Tournament Plus branding gets one lock line,
"Your logo, colours and type on this site". The app-icon FAQ now answers **No**: the home-screen icon is always
FieldLogicHQ's (its anchor kept). ⚠ Not promotable before Part 6 (§5).

**The brief against the code.** Every claim re-opened held, with three corrections:
- **5a's filter would have been wrong on prod.** The old font list is `system | inter | barlow | dm-serif`. Prod stores
  System as null, so a prod value is `inter`, `barlow` or `dm-serif`, and **two of those are type-look words** (Clean,
  Serif). A `NOT IN ('system','dm-serif','inter')` empty would keep exactly the old picks that collide. Every prod value
  predates the Look card: Stage 1a is not in prod HEAD `3ca835a53` (checked with `merge-base`). So 426's blanket empty
  is right there.
- **5e's "delete the seed" would have broken three seeds.** `seed-byedemo.mts`, `seed-bl-u18-splitpool.mts` and
  `seed-bl-u15-doubleelim.mts` clone the `branded-light` event it creates, and `mobile-review-capture.mjs` opens both
  variants. It was reduced instead.
- **The page's menu name is "Public site"**, not "Branding" (`admin-nav-config.ts`). The help said "Branding" in
  several places; corrected where this part touched them.

**5a: no second empty (the prompt's "not needed" branch).**
- Prod has never run 426: it is pending, and prod is at the 10-30 release.
- Dev held **0 non-null of 68** (`SELECT theme_font, count(*) … GROUP BY 1`, 2026-11-04).
- So a second migration would be a no-op on dev and a repeat of 426 on prod.
- The real risk is timing. Prod's old page sends its font on **every** save, so a fresh pick, or a tab opened before 426,
  refills the column.
- `MANUAL_PROD_STEPS.json`'s 426 note is amended. Apply it **in the promote window, immediately before the push**
  (Stage 1a and Stage 8 promote together), blanket, never filtered. Verify count 0 just before the push, and re-check
  once live.
- Tournaments has no `updated_at`, so a non-null row found after the deploy cannot be dated. `barlow` is always old;
  anything else is looked at with the owner first.
- No migration file, so no `check:migrations`.

**5b: `/db`.** `DATA_DICTIONARY.md`:
- **The tournament branding block** is split in two.
  - **Live:** logo, the colours three, and `theme_font` = the type look, with the prod timing warning.
  - **⚰ Dead, kept per ask C:** `hero_banner_url`, `theme_card_style`, `color_mode`, `icon_bg_color`, `app_name`,
    `app_icon_scale`. No reader or writer, re-proved.
- **The settings catalog** marks `rulesLayout` / `resourcesLayout` RETIRED.
- **The organization block's** stale line "defaults each tournament overrides" is replaced by who reads what:
  - the colours and `theme_font` are the club layer of a tournament's look (`resolveTournamentLook`);
  - `hero_banner_url` is the club home's banner only;
  - `theme_card_style` has **no writer on any screen**. The org layout still stamps `data-card-style`, and the
    `globals.css` variants still restyle a non-kit, non-frame `.card`. Dev: all 56 orgs are `'default'`; prod was not
    counted. It is a candidate for the drop pass.
- **The call on the code: the six dead fields left the `Tournament` type and `mapTournament` now.**
  - No reader: the property, destructuring, string-key and JSON-consumer searches were all empty, and tests reference
    the fields only in `doesNotMatch`.
  - Tournaments are read with `select('*')`, so no query changes.
  - A typed field invites a new reader of a column queued for a drop. With the fields gone, the drop is a migration
    plus the dictionary entry. Typecheck clean.
- **The drop pass** is its own TODO line ("Retired branding columns — drop pass"). `seed-public-frame-fixtures.mjs`
  lost its `color_mode: null` write, so no script writes a column the drop removes.
- No schema change, so no snapshot refresh. `check:dictionary` passes.

**5c: `/docs`.**
- **`lib/help-content/tournaments.tsx`:**
  - Branding, scoring and event settings: the body, the link label "Public site", keywords and searchText. Out: hero
    banner, App icon tile, app name, logo size. In: look, type, Classic / Serif / Clean.
  - The "Built on" FAQ: "logo, colours and type".
  - `faq-tournament-branding`: where the Look and Logo cards are, following the club, the club's Always, and that each
    tournament keeps its logo.
  - `faq-app-icon`: rewritten to "No". Its keywords are kept, so an "app name" or "logo size" search lands on it.
  - `public-site-cards`: "six closed cards" becomes Look + Logo + the lock line, in the page's own words.
  - The fan app: the home-screen icon is always FieldLogicHQ's.
  - The preview guide's searchText.
  - Rules & resources: the Layout sentence removed.
  - The setup wizard's two pointers: "Branding" becomes the Public site page.
- **`org.tsx`:** the card-style line, and "from that tournament's Public site page".
- **Review:** `/review`'s copy lens found no High. Two Low precisions were applied: the lock line also reaches a Premium
  coach's hosted event, and the band preview sits beside the controls on a computer.
- Spelling passes; no section touched is over the length standard.

**5d: `/strategy`.** The drift check is recorded under the 2026-11-03 entry in `BUSINESS_DECISIONS.md`.
- **(b) closed:** `LOCK_WORDS.branding` is gone. One record still quoted the old line, `PRICING_PAGE_COPY.md`'s
  free-plan lock-line list. It is struck through with a pointer (a record fix, no new copy).
- **(d) closed by 5c.**
- **(c) re-checked clean.**
- `PLAN_PRICING_FACTS.md` "Tournament branding reframe": "not yet built" becomes built on `dev` with its anchors. The
  release state points at the release-history record.
- **No price, plan, gate or feature key moved.**

**5e: `/demos`, scoped (logged as a scoped check, not a pass).**
- The tournament dock's three lines and the tour's four steps don't describe the old look, and the dock's two figures
  stay checker-computed. **0 sentences changed, 0 moments.**
- `seed-theme-variants.mjs` was reduced (above) and now writes colours only.
- Its two events were renamed "(Branded · Upcoming)" / "(Branded · Live)" for the next re-run; the slugs are kept. The
  dev seed was not re-run.

**Tests:** `public-tournament-stage8-branding-page.test.ts` gains a Part 5c block of 3 tests:
- no guide offers a retired control;
- the page guide names Look, the type looks, the band preview, Logo, and the lock line quoted from `LOCK_WORDS`;
- the app-icon answer is "No", with its search keywords kept.

**Non-vacuity:** the committed (old) help files, put back, fail all 3; the files were restored with an identical sha1.
No guard pinned the old help wording (searched).

**Checks run:**
- Touched and neighbouring unit files are green: Stage 8 Branding, help articles and subtopics, tournament look, Stage 5
  public site, `demo-destinations-guard`.
- Full `npm test`, 13,963 tests: **8 failures, all other sessions'.** They are the seven §18 records, plus
  `coach-history-endpoint-guard.test.ts`, whose uncommitted foreign edit lost a backslash in a regex.
- Typecheck clean (`NODE_OPTIONS=--max-old-space-size=6144`). ESLint on changed files: 0 errors. Spelling and
  dictionary pass.
- `verify:changed` stops at `npm test` (`&&`) on the foreign failures. Its ratchets, run one by one, name no file of
  this part. The reds are all foreign: admin old look and type, schema parity, index coverage, org-slug callers, CSS
  selectors, export catalog, root files, and `check:demos`, which hits the tournament-seed import fault recorded at the
  10-27 release. Its focused ESLint step crashes on the tree's 55-file list (a react-hooks plugin config fault).
- No layout sweep: no screen changed.
- The dev server was not restarted: no file added or deleted.

**`/simplify`:** not run (no new abstraction).

**`/review`** (high-risk tier for `lib/**`): **no defect.** Lenses: blast radius on the six fields (main loop),
data/contract on 426 (main loop), copy correctness (Sonnet finder). Acted on: 426's note made exact (prod stores System
as null; a stale tab re-writes its pick), and the two copy precisions.

**Handed on:**
- **Part 6:** as §16–§18, plus 426 on prod **in the promote window** (the amended note) and the post-deploy re-check.
- **The drop pass** (its TODO line): the six tournament columns, and `organizations.theme_card_style` with its layout
  stamp and the `globals.css` variants. Count prod first. The org-settings PATCH still accepts `themeCardStyle` and
  should stop.
- The other "Branding" mentions in the help are generic and were left: the tournament workflow lists and the "branding
  preview" search words. A help-wide rename to the menu's "Public site" is a later `/docs` call.
- The dev rows of `branded-light` / `branded-dark` still hold their old Dark/Light and card-style values. They are
  inert, and go with the drop.
