# Public tournament pages — Stage 8: the new look on for everyone (plan)

**Status:** asks A to D RULED 2026-11-03, all as recommended (logged in `BUSINESS_DECISIONS.md`, "Tournament branding is a logo, colours and type"). **Part 1 committed `d4af280e6` 2026-11-03** (record §10; it releases with the flip, ruling D). **Part 2 committed `02e29f453` 2026-11-03** (record §11; it releases with the flip too). **Part 3a committed `3304c77fe` 2026-11-03**
(record §12; releases with the flip). **Part 3b committed `9b6252e8a` 2026-11-04** (record §13; releases with the flip). **Part 3c committed `62f5841f9` 2026-11-04**
(record §14; releases with the flip). Next Part 3d. Brief: `PUBLIC_TOURNAMENT_STAGE8_PM_BRIEF.md`.
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
