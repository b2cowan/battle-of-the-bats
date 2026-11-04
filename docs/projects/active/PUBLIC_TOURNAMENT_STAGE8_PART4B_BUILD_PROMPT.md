Public tournament pages — Stage 8 Part 4b: the admin side, THEN the switch itself. Build on `dev`, then /simplify
only if the work adds a new abstraction, then /review (blast-radius lens mandatory: this is the switch's removal).
Then show me the result and the exact file list and WAIT for my go before committing.

READ FIRST: AGENTS.md, AGENCY_RULES.md, and docs/projects/active/PUBLIC_TOURNAMENT_STAGE8_PLAN.md — §4 (Part 4), §5, §6
(asks A–D, ruled as recommended), §15 "Census", and §17 (Part 4a: what it did, what it handed on, its census). Argue from
the code, not from this prompt: re-open every claim below before acting on it. Part 4a is committed on `dev` (see §17's
title for the hash); nothing here ships until Part 6, but dev must work at every commit.

Present the plain-language UX summary first (blocking), before any code change. If the code says this prompt is wrong,
say so BEFORE doing the work and ask.

OWNER RULINGS ALREADY MADE (2026-11-04, in the 4a session — do not re-ask): Part 4 is split (this is 4b); the Rules
layout menus are removed (done in 4a); the production losses at the flip (Dark/Light, hero banner photo, per-tournament
font, card style, the Rules menus) are accepted as ruled under asks A/B — no production count is needed.

WHAT 4b IS: after 4a, the switch is read in exactly three places (re-check: `grep -rn isPublicFrameOn app components lib`):
`lib/public-frame-server.ts` (its definition), `app/api/admin/tournament-branding/route.ts`, `app/api/admin/public-site/route.ts`.
The Stage 1 frame guard's census assertion should name exactly that list (add it if 4a did not). 4b removes the two
admin readers and their old halves, then deletes the switch.

⚠ WHAT DOES NOT GO: `lib/public-frame.ts` and `lib/public-frame-server.ts` ALSO hold the frame's live helpers
(`publicFrameAttr`, `PUBLIC_FRAME_ATTR`, `publicFrameBand`, `publicFrameHost`, `publicFrameRoleCss`, `publicFrameRoles`;
`publicTournamentContactEmail`, `publicFrameBandFacts`) used by every public tournament page, the admin preview and the
Look card. Only the cookie pieces go: `PUBLIC_FRAME_COOKIE`, `publicFrameFromCookie`, `safePublicFrameReturn`,
`isPublicFrameOn`. Keep the file names (the frame's marker is also "public frame"). The `data-public-frame` marker and
every rule keyed to it stay: 4a proved the remaining marker-keyed rules are the frame's live look (§17).

THE WORK (census from 4a's helper, lines as of 2026-11-04 — re-open each)
1. Branding page (`app/[orgSlug]/admin/tournaments/branding/page.tsx`): delete the `!frameOn` block (~441-550: Theme
   with swatches/Custom/HexField/Dark-Light/low-contrast/inherit note, Hero banner, Font, Card style), `bodyOf` (~115-129;
   `frameBodyOf` in look-draft.ts stays), the `frameOn` state/Held field/setter, the Draft's `fontKey`/`cardStyle`/
   `colorMode`, `BrandingSettings.heroBannerUrl/themeCardStyle/colorMode/frameOn`, `previewTheme`/`presetName`, all banner
   state and the `'banner'` branches of upload/remove, `bannerUploading` in SavePill, the imports only that half used
   (PRESETS, FONT_OPTIONS, CARD_STYLE_OPTIONS, resolveTheme, HexField, themeSummary), the `LOCK_WORDS.branding` and
   `W.logoHint` branches (lock line → `LOCK_WORDS.brandingLook` always; logo hint → the frame's). `LookCard`, `look-draft.ts`,
   `HexField` itself (LookSwatches uses it) and `FONT_OPTIONS`/`CARD_STYLE_OPTIONS` (the org-settings route validates org
   columns with them) STAY.
   Words (`PUBLIC_SITE_WORDS`, lib/tournament-settings-words.ts ~243-286): delete the old-half keys (theme, heroBanner,
   font, cardStyle, uploadBanner, replaceBanner, logoHint, bannerHint, bannerLine, primary, accent, background, dark, light,
   lowContrast, themeLine, inheritTheme, inheritFont, inheritCard) and `themeSummary`; KEEP `custom` (LookCard), uploading,
   remove, uploadFailed, removeFailed. `LOCK_WORDS.branding` (lib/invite-only-words.ts) loses its one user — delete it if
   so (PLAN_PRICING_FACTS / `/strategy` note: the lock line's wording is a Part 5d drift check, not a rewrite here).
   CSS: branding.module.css keeps only the logo classes (logoRow, logoPreview, logoImg, logoPlaceholder, logoActions,
   logoHint); `.page`/`.card` are already unreferenced; site.module.css `.hexRow`. ⚠ `one-window-stage1-guard` requires
   branding.module.css `.label` to compose `fieldLabel` — `.label` is old-half-only, so rewrite that entry.
2. Branding API (`app/api/admin/tournament-branding/route.ts`): GET — drop `hero_banner_url`, `theme_card_style`,
   `color_mode` from the select and the response; keep `themeFont` (it seeds `typeKey`); drop `frameOn`. ⚠ COST: today
   `band = frameOn && advanced ? publicFrameBandFacts(...)` — with the switch gone, EVERY GET on an advanced plan runs the
   band-facts read, and two other callers share this route for unrelated fields: event settings
   (`settings/event/page.tsx` ~284, reads `requireScoreFinalization`) and the setup wizard (`TournamentSetupWizard.tsx`
   ~422, reads the theme). Make only the Branding page ask for the band (e.g. a query flag), and test that the other two
   do not pay for it. PATCH — delete `VALID_FONTS`, `VALID_CARD_STYLES`, their imports, the `themeFont` block (~181-193:
   the OLD rule, which maps 'system' → null and accepts e.g. 'barlow', a value that is not a type look and clashes with
   migration 426), the `themeCardStyle` block, the `colorMode` line, and `'themeFont'`/`'themeCardStyle'`/`'colorMode'`
   from `PLUS_VISUAL_FIELDS` (then a stale tab sending them is ignored, not refused — say which you chose and why).
   `typeLook`, the theme fields, pages, coach names and `requireScoreFinalization` stay.
3. Hero banner (ask A): delete `app/api/admin/tournament-hero-banner/route.ts` (its only caller is the Branding page;
   no unit test). Dashboard "branding done": `app/api/admin/tournament-dashboard/route.ts` ~154 select and ~268
   `hasBranding = logo_url || hero_banner_url || theme_preset || theme_primary` — drop the banner term.
   ⚠ OWNER QUESTION (ask up front, with a recommendation): `hasBranding` ignores a chosen type look (`theme_font` under
   its 426 meaning), so an organizer who only picks a type never sees "branding done". Count it too? (Recommend yes — it
   is a Look card choice now.) Keep the column (ask C). Leave `organizations.hero_banner_url` and its route ALONE: the club
   home's banner is live (LookPanel, the org home, club-home data).
4. Copy lists (ask C keeps the columns): `lib/db.ts` `cloneTournament` (~287-299, `includeBranding`) and
   `populateTournamentFrom` (~445-448, `areas.publicPresence`) copy `hero_banner_url`, `color_mode`, `theme_card_style`,
   `icon_bg_color`, `app_name`, `app_icon_scale`. Trim the dead ones from both lists; keep `theme_font` (live, the type
   look). The retired `rulesLayout`/`resourcesLayout` settings keys (4a) still travel with a copied event's rules in both
   functions — trim them too, or record why not. `lib/types.ts` / the `lib/db.ts` mapper may keep the fields (the
   dictionary still lists the columns); say what you did.
5. Public-site editor: `app/api/admin/public-site/route.ts` (the `isPublicFrameOn` import, comment, `frameOn` in the
   Promise.all and the response); `app/[orgSlug]/admin/public-site/page.tsx` (`frameOn` state ~172, set ~235;
   `tournamentRule = frameOn && carries.tournaments` → `carries.tournaments`; `hex={frameOn}` → gone). LookPanel's `hex`
   prop and LookSwatches' (`components/admin/kit/club/LookControls.tsx` ~60/75/84: the `if (!hex) return picker` branch)
   → the typed hex field always (LookCard already passes `hex`).
6. Only now, the switch: delete `PUBLIC_FRAME_COOKIE`, `publicFrameFromCookie`, `safePublicFrameReturn` (lib/public-frame.ts
   ~27-50 + its header comment about the switch), `isPublicFrameOn` (lib/public-frame-server.ts ~8-18), the setter route
   `app/api/public-frame/route.ts`, the preview-link lines in `scripts/seed-public-frame-fixtures.mjs` (~196-197; its
   marker string is checked by five other stage seeds — keep the marker, drop only the links), every `frameOn` prop, and
   the stale "behind the preview switch" comments (TournamentBand, TournamentFooter, TournamentFrame.module.css, the
   ~15 component stylesheets' headers, ConsumerNav ~414, lib/tournament-look.ts, PublicChampionsPage ~8,
   scripts/layout-screens.mjs ~1891-1899 and ~1738). Check `proxy.ts` and `public/sw.js` for the cookie name.
7. Dead-code: `npm run check:dead:report` (a report, network fetch) — confirm nothing you deleted is still imported
   and nothing you kept went dead; knip.jsonc's entry list is globs (no edit expected).

TESTS — rewrite, don't delete
- The Stage 1 frame guard's switch section (lines ~43-67 today: `publicFrameFromCookie`, `safePublicFrameReturn`, the
  route) becomes "the switch is gone": no cookie name, no reader, no setter route, no `frameOn` anywhere under
  app/components/lib/scripts — and the census assertion's list is now EMPTY.
- tournament-look.test.ts (~306-312, ~334, ~337, ~451-474), tournament-stage5-public-site.test.ts (~15, 29-30, 47, 51-55,
  70, 76-77), public-tournament-stage0-small-fixes-guard.test.ts (~88-93), one-window-stage1-guard.test.ts:55.
- NEW (the brief's ask): a Branding page test that the page offers only controls that do something — each remaining
  control's value is read by a public surface, with the reader NAMED in the test (Pages → the hidden-pages list the
  layout reads; Look → lib/tournament-look.ts `resolveTournamentLook`; Logo → `publicFrameBand`; coach names →
  `toPublicTeam`; …).
- Prove each "gone" rule by temporary mutation: put the old reader back, watch it fail, restore, confirm with `cmp`
  (4a's harness pattern: §17).

VERIFY — touched + neighbouring unit tests; ESLint on changed files; check-spelling-consistency; check-css-selectors
(update `scripts/.css-selector-baseline.json` / `scripts/.public-type-baseline.json` BY HAND for exactly the removed
rules, never --init); typecheck (NODE_OPTIONS=--max-old-space-size=6144); full `npm test` (name the failures and whose
they are; §16/§17 list the foreign ones); `demo-destinations-guard`; check:layout --only= on the Branding page
(`admin-t-branding`, `admin-t-branding-look`, `admin-t-branding-look-club`), the public-site editor (`admin-public-site`,
`-look`, `-look-ask`), the dashboard, event settings, at --workers=1, never a whole-product sweep. Restart the dev
server before handoff (files are deleted; stop `next dev` and its server child; stop it BEFORE deleting `.next`), then
confirm the login page, a Schedule, Register, Playoffs, the pay page, the Branding page and the public-site editor
answer 200.

SCOPE / COMMIT / AFTER — as 4a (§17): own files only; private-index commit if anything foreign is staged; `lib/types.ts`
and TODO.md are shared — commit only your hunk via a hand-built blob; explicit pathspecs; no push; never master; nothing
against production. Record as §18 of the plan (same shape as §17), update the header and the Stage 8 TODO line, then
"Part 4 committed, next Part 5 (data and the wording around it)" and recommend /clear.

STILL OWED, NOT 4b: Part 5 (the `theme_font` empty + MANUAL_PROD_STEPS, /db dictionary + snapshots — the retired
settings keys and dead columns included, /docs Branding + "public site preview" guides — the list is in §17, /strategy
log + PLAN_PRICING_FACTS custom-app-name + `LOCK_WORDS.branding` drift check, /demos). Part 6 (release; the production
port of the feed fix; the service worker CACHE_VERSION bump). The items §16/§17 hand on.
