# Public tournament pages — Stage 8: the new look on for everyone (plan)

**Status:** asks A to D RULED 2026-11-03, all as recommended (logged in `BUSINESS_DECISIONS.md`, "Tournament branding is a logo, colours and type"). Nothing built. Brief: `PUBLIC_TOURNAMENT_STAGE8_PM_BRIEF.md`.
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
