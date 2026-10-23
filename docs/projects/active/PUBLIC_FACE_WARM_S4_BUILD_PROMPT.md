# The public face, warm: S4, the marketing set as one, with the new identity (build prompt)

> **Written 2026-10-23.** **Paste this into a new chat on `dev`.** It is a **build in two parts**, the biggest of the project.
> The plan is `PUBLIC_FACE_WARM_PLAN.md` (the S4 row of the ladder, "Round 1 rulings", "W ruled"); the identity rules are
> `docs/agents/brand/VISUAL_IDENTITY.md`; the words are `PUBLIC_FACE_WARM_S4_COPY.md` (already written, see Step 0).
> **Reference drawings:** the walk page's "End state drawn" tab, https://claude.ai/artifact/M1ehQVxvLzMiTZfJDMtcft (the
> marketing set as the owner approved it) and the wordmark refinement, https://claude.ai/artifact/9xDNVQyR3wJRcf7hCgiDBr
> (`PUBLIC_FACE_WARM_W_REFINEMENT.html`, the source of record for the mark's geometry). Open both before you start.
> **Model: Sonnet, effort high.** Run `/review` before each commit.
> **Order (owner, Ask 11): S1 ✓ → S3a ✓ → S4 → S5 → S3b.** S1 is built (`7bba2136d`), S3a is built (`26f5bdb0c`). The tree is
> shared: run `git status` first, stage explicit paths, check the branch is `dev` before committing, and ask before committing.

## Two parts, one release (read this first)

The ruling says the marketing set moves **in one release** (Ask 1) and the new identity ships **in this same release,
everywhere at once** (W ruled). It does not say one chat. The two halves have different risks, so build them as **Part A**
and **Part B**, each with its own `/review`, its own commit(s) and its own walk, and **promote them together, never one
without the other**:

- **Part A, the marketing set goes warm and plain** (a re-skin of ~10 pages plus chrome, to the approved drawings).
- **Part B, the identity** (the artwork, the mark everywhere, one shared name component). Part B needs the artwork made
  first and a name-and-logo search that is the owner's or counsel's; if either is late, Part A still lands on `dev`.

If you disagree with the split, say so before building (AGENCY_RULES: disagree out loud).

## What this build carries out

1. **The whole marketing set is warm, always** (Ask 1 + Ask 5 B). Marketing pages have **no Dark version**, whatever the
   visitor's setting. This supersedes "marketing stays dark by design" (`memory/design_decisions.md`, 2026-07-23).
2. **The public type rules P1–P10** (Ask 3 A) on every marketing surface: the typewriter face only for a plan chip and real
   data (and, until Part B ships, the wordmark), Barlow Condensed 700 sentence-case headings, sentence case everywhere a person
   reads, no forced capitals, no 800/900 weights, a button says what happens. **One named exception:** a marketing page's
   headline, one per page, Barlow 700 at **64px desktop / 40px phone**; it mints no new ladder token (the two sizes are written
   once in the ladder's comment in `app/globals.css`, and S4 gives them one shared rule).
3. **Scroll-reveal comes out** (P6): nothing waits for a scroll to appear.
4. **One warm share card for the marketing site, plus a title and description on every marketing page** (Ask 8 A, P7).
5. **The ruled identity** (W): the refined Joined FL mark, olive leading, lime kept for actions. Spec: `VISUAL_IDENTITY.md` §4
   (colours, the lockup, "every place"). Do not redraw anything: copy the canonical paths from the refinement page.

**Not in S4:** the club's logo and colour on family emails (S3b); the system screens (S5: 404, crash, offline, unsubscribed,
suspended, the neutral share-card fallback; but see Part B for the places the new *name* must also reach); the public
tournament pages' type (its own project, Ask 7); "Open app" crossing (Stage 13); pricing or plan facts (never restate a price,
`PLAN_PRICING_FACTS.md` is the home); any change to who can see what.

## Step 0: the words are already settled

`PUBLIC_FACE_WARM_S4_COPY.md` is the `/marketing` pass for this build (Ask 4). **Build only the wording it approves.**
Anything it marks **Held**, or does not mention, keeps today's wording; restyling a page does not reword it. Two items need
you:
- **Item 6** (the house league card's "automated game notifications") is **Approved if** Stage 9 has not made it true. Check
  Stage 9's state in `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` first and say which you found.
- **Item 8** (button labels): remove the trailing arrow wherever the label's words stay the same; **list** every label that
  needs a decision (the home persona cards' "Learn more →" names no destination) and put the list back to `/marketing` for a
  yes before you change a word.

## What the code looks like today (census 2026-10-23, verified; a lead, not evidence, re-check before you rely on a line)

**The marketing pages are dark by their own tokens, not by a setting.** The global `:root` in `app/globals.css` is the dark
set (`--pitch-black` and the Tailwind `bg-pitch-black` / `text-fl-text` / `border-blueprint` utilities); the warm `--home-*`
family is defined in the warm blocks (the `[data-guest-kit]` block near `--home-paper`, and `components/consumer/warmTheme.module.css`
for the consumer shell). Marketing CSS has no theme logic at all, so a signed-in Dark visitor and a stranger see the same dark
page. **Part A is therefore a real re-skin, not a type pass.** Find the one mechanism the first look's pages already use to be
warm and use it for the marketing layout; add no palette and no second mechanism.

**The pages** ("13 routes" in the plan does not map to a countable list; this is what exists):
- Wearing the marketing bar and footer (10): `/`, `/pricing`, `/for-clubs`, `/for-coaches`, `/for-leagues`,
  `/for-tournament-organizers`, `/for-coaches/walkthrough`, `/for-tournament-organizers/walkthrough`, `/changelog`, `/demos`.
- Marketing-adjacent: `/pitch/[slug]` (not indexed, personalised), `/see-it-live/switch` and `/see-it-live/coaches/switch`
  (not indexed).
- Chrome: `components/Navbar.tsx` (`isMarketingPath`), `components/Footer.tsx`, `components/marketing/FoundingSeasonOfferBar.tsx`,
  `SiteChrome`.
- **Four orphan pages not in the plan:** `app/platform/{accounting,house-league,rep-teams,tournaments}/page.tsx`. They get the
  marketing bar but no footer, nothing links to them and they are not in the sitemap; each is dark Tailwind with a
  `font-black` heading. **After Part A they would be dark islands under a warm bar.** This is the owner's call: **recommended,
  retire them** (delete and redirect to `/`); otherwise restyle them with the set. Stop and ask; do not guess.
- `/demos` is missing from `app/sitemap.ts`'s first list. Add it unless the owner says it is deliberate.

**Typewriter lettering on the marketing set:** `node scripts/check-public-type.mjs --report` lists 19 marketing files
(face 237 · caps 105 · heavy 36); the four `for-*` module sheets and `pricing/page.module.css` carry about 190 of it. Take the
counts down by fixing the lettering, never by adding `type-ok` markers, then run the ratchet to lock the drop in.
⚠ **The guard has a blind spot:** it reads CSS `font-family` only. **Tailwind `font-mono` utilities in TSX are not counted**
(about 65 on these pages: `/demos` h1, the home page ×24, Navbar, Footer, the walkthroughs), and neither are the **global
classes** that carry the face: `.hud-label` (home `app/page.tsx` ~526, `/demos` ~166 and ~174, Footer ~138), `.btn-data`, `.badge`,
`.form-label`, `.public-page-header .eyebrow` (`app/globals.css` ~1511, 1669, 1844, 1927, 2142). A restyle that fixes only the
CSS would leave the typewriter on screen with a green check. **Extend `check:public-type` to count `font-mono` and those classes
in the marketing scope's TSX** (follow how `tests/unit/public-type-guard.test.ts` builds scratch-tree tests), baseline what
is left, and lower it as you go.

**Scroll-reveal:** only `app/page.tsx` uses `AnimateIn` (about 8 wraps; `components/AnimateIn.tsx`, `.animateIn` in
`app/globals.css` ~2627). Remove the wraps; delete the component and its CSS if nothing else uses them.

**Titles and descriptions:** the root layout adds " | FieldLogicHQ" to every title, and about 14 pages also put the brand in
their own title (the tab reads "Pricing — FieldLogicHQ | FieldLogicHQ"). No marketing page sets `openGraph` or `twitter`, and
there is **no share image for marketing at all** (the six existing `opengraph-image` files are club and tournament cards).
`metadataBase` is already `https://www.fieldlogichq.ca`.

**The phone browser-bar colour** is a static `<meta name="theme-color" content="#0a0a0f">` in `app/layout.tsx` (~67), and
`ConsumerThemeManager` / `CoachThemeColor` reset it to that near-black on every route they do not own. So it is near-black on
every marketing page today. Make it the fixed warm value (`THEME_COLORS.warm` in `lib/user-theme.ts`) on marketing paths; check
who else relies on the default before you change the root value.

**Other lettering that rides this release (ladder row):** the `/start` chooser's leftovers (`start.module.css`: `.kicker`,
`.cardLabel`, `.basicLine` in the typewriter face, and the 800 weights on `.title` and `.ctaPrimary`), the consumer bar's
tournament strip (`ConsumerShell.module.css` ~286–306, a "Delete this rule then" comment marks it) and the flip pill
(`components/shared/FlipPill.module.css`, `.publicLook .pill`).

## Part A: build the marketing set warm and plain

1. **Open the drawings and the words doc first.** Build to the approved "End state drawn" pages; where a drawing and a rule
   disagree, the written rule wins and you say so (the portal's written rules were the formatting benchmark before).
2. **Chrome first, then pages.** Bar, footer and Founding strip are shared by all ten pages: restyle them once, then the pages
   one at a time. The Founding strip and panel are a dated offer: restyle only, never reword. Ask 14: the page's own lime
   wins, so the bar's "Get started" is white on a page that has its own lime; Pricing's one lime is on Tournament Plus.
3. **One headline rule.** One headline per page, the named exception above, defined once in the ladder comment and used by a
   shared rule, not ten copies of a `clamp()`.
4. **Lime is a fill, never text on paper** (E3). Text that is lime on a dark page becomes olive; buttons are lime with ink text,
   10px corners, 48px, one lime button per view (P4).
5. **Remove the scroll-reveal; fix the titles and descriptions per the words doc; add `openGraph` and `twitter` to the shared
   defaults.** The share card is one image for the site: the new mark's tile, the name, and the line "Less admin. More sport."
   (words doc item 7). Draw it with the same renderer the club cards use (`lib/club-share-card-image.tsx`). The neutral
   fallback card there is S5's, but note it uses the same ground.
6. **The orphan `/platform/*` pages, the sitemap, and the `/start`, tournament-strip and flip-pill leftovers** as above.
7. **Browser-bar colour** fixed warm on marketing.
8. **Do not touch** prices, plan names, plan facts or any claim the words doc does not approve. `git grep` a number before
   you keep it in a sentence; a number in marketing copy is computed or cited, never typed fresh.

### Part A guards (the build is not done without these)

- `check:public-type` extended to Tailwind `font-mono` and the global classes in marketing TSX (above), baseline lowered and
  locked.
- A guard that **no marketing page or marketing chrome carries a dark-only token or utility** (`bg-pitch-black`,
  `text-fl-text`, `border-blueprint`, `data-theme="dark"` handling and the like; name the file and line on failure). Look at how
  `tests/unit/public-face-s3a-emails.test.ts` scans source and follow it.
- A guard that **no page title contains the brand name or a dash tail** (the doubling), and that every indexed marketing page
  exports a description. The prospect and "open the live demo" pages stay not indexed.
- A guard that **nothing on a public page hides content until scrolled** (no `AnimateIn`, no reveal observer).
- `npm run check:contrast` and `check:text-contrast` pass on the new ground; the marketing token ratchet
  (`check-public-tokens.mjs`, the marketing baseline) goes **down**, not up.
- Update tests that pin what you change; read `tests/unit/club-frame-guard.test.ts` (it reads `Navbar.tsx` and bans mono on club
  pages) and `tests/uat/scenarios/anonymous-public-invariant.spec.ts` / `coach-wall-doors.spec.ts` (the wordmark door
  `header a[href="/discover"]`) before you change the bar.

## Part B: the identity, everywhere at once

Spec: `VISUAL_IDENTITY.md` §4. The mark is **one filled shape**, copied from the refinement page's canonical paths (`P.rf` main
cut for 32 px and up, `P.rf16` for 16 px; the 16 px cut is required, the main cut at 16 is mush). The app tile is olive with
the mark in paper; **lime is not in the mark anywhere**. The lockup is the bare mark + "FieldLogic" in Inter 700 ink +
"HQ" in Inter olive, one mark at every size.

1. **The artwork, made first, swapped in only at release.** `public/brand/*.svg` are the sources of
   `scripts/generate-pwa-icons.js` (its `BG` is still `#0a0a0f`); `public/favicon.svg` and `app/favicon.ico`
   (`scripts/generate-favicon-ico.js`). Produce: the tab icon (16 px cut at 16, main cut at 32, **new file names** so caches
   refetch, plus the `.ico`); the iPhone icon as a **full square** (iOS paints transparent corners black); Android "any" and
   maskable as **separate files** (the maskable glyph at 84% inside the safe circle); the push **badge** as a white silhouette
   from the 16 px cut (crisp at 16, 32, 48, 96); the large push picture is the app tile; the export mark.
   On a tile or maskable icon the glyph sits 1.5 units right of centre; in the lockup it does not.
2. **File renames need four edits in the same change:** `public/sw.js` (the precache list at ~48, the `/icons/*` rule, the
   default `icon` and `badge` at ~286–287, and **bump `CACHE_VERSION`**, now `v10`); the root head and manifest links;
   `tests/unit/demo-sandbox-exit.test.ts` (~105 lists `/favicon.svg` and `/icons/pwa-192.png` as asset requests that must not
   count as navigation); and every importer (`lib/pwa-icon.tsx`, the generated `apple-icon.tsx` and `icon-maskable` routes,
   `InstallAppPrompt`, `lib/export/brand-mark.ts`).
3. **The manifest and the root head:** `app/manifest.json/route.ts` (`background_color`, `theme_color` off `#0a0a0f`; its
   description is the one string from words doc item 1), the static `theme-color` in `app/layout.tsx`, `THEME_COLORS.dark` in
   `lib/user-theme.ts`, `ConsumerThemeManager` and `CoachThemeColor`, and the launch colours in `public/offline.html`.
4. **ONE shared name component** replacing the ~10 copies. Three DOM shapes must be absorbed: the mark + text link
   (`components/shared/BrandLockup.tsx`, used by `AdminTopStrip` and `CoachTopStrip`), the text-only link (marketing bar, consumer
   bar and tournament strip, footer) and the inert text (volunteer check-in and scorekeeper shells, `DayOfShell`). The places that
   cannot import a component (`public/offline.html`, `app/unsubscribe/confirmed/page.tsx`, and the email) each get their own
   copy **generated or pinned from the same source**, with a test that fails if they drift. Copies to cover, with the census
   line: marketing bar `components/Navbar.tsx` ~164; footer `components/Footer.tsx` ~121; consumer bar and strip
   `components/consumer/ConsumerNav.tsx` ~297; `BrandLockup`; volunteer shells `app/[orgSlug]/check-in/layout.tsx` ~110 and
   `scorekeeper/layout.tsx` ~114; platform-admin sign-in `app/platform-admin/login/page.tsx` ~77 and ~131 (in scope if the
   owner agrees; the plan says "if in scope"); `public/offline.html` ~108; the unsubscribe page ~40; `lib/email-envelope-warm.ts`
   `WORDMARK` ~160. The admin and coach top strips take the lockup in place of the ">" mark.
5. **The email name line:** Arial text, "FieldLogic" 700 ink and "HQ" 400 olive, no image (S3a kept the Courier line on purpose).
   Update `tests/unit/first-look-stage2-emails.test.ts` (~28 pins the Courier line exactly) and
   `tests/unit/public-face-s3a-emails.test.ts` as needed.
6. **Exports and print:** the one-colour lockup beside the existing "Generated by" words (`lib/export/brand-mark.ts`,
   `lib/export/pdf.ts`, `xlsx.ts`). Canvas share cards carry the name as sentence text, not a wordmark; leave their wording.
7. **Rewrite P1 and P9 in `VISUAL_IDENTITY.md`** (P1 becomes "the typewriter face is for a plan chip and real data"; P9 becomes
   the lockup), **retire the `wordmark` role** in `scripts/check-public-type.mjs` and its tests, and remove the
   `type-ok: wordmark` markers (`BrandLockup.module.css`, `Footer.module.css`, `ConsumerShell.module.css`, the unsubscribe page,
   `lib/email-envelope-warm.ts`). The doc is the place the rules live; fix the doc in the same change.
8. **A What's new line** about the new home-screen icon (an iPhone keeps the old icon until the app is added again);
   `lib/release-notes.ts` is where those live.

### Part B guards

- One component owns the name; a test fails if a second hand-drawn copy of FIELD·LOGIC·HQ appears in a rendered surface, and
  if the offline, unsubscribe and email copies drift from the component.
- A test that no icon or manifest still carries `#0a0a0f`, and that the file names in `sw.js`, the manifest and the layouts
  all exist on disk.
- `check:public-type` no longer knows a `wordmark` role.

## How to see what you built

Marketing: the real pages on the dev server (warm the routes first; a cold compile can time a page out), at 361 and 1440 wide.
`npm run check:layout -- --changed` for the screens you touched; **a whole-product sweep does not run on the dev server** (it is
the release's, on staging). Identity: render each icon size in a scratch page under `.probe/` (gitignored, not committed) next to
the refinement page's drawing, and compare by eye at 16, 32, 48 and 192 px.

## Constraints

- Shared tree. Stage explicit paths. Ask before committing. `git status` first.
- You touch shared modules and the root layout: run `npm run typecheck` and `npm run verify:changed`, and restart the dev
  server (stop it, clear `.next`, `npm run dev`) before the owner tests. The `check:public-tokens` and `check:admin-*`
  ratchets may be red from *other* sessions' work; say which, do not fix theirs.
- No migration is expected. If you find you need one, stop and say why.
- **The demos follow the product** (owner 2026-09-13): do not add demo notes, and do not gate this on a re-seed.
- No new palette, no second theme mechanism, no pricing fact written fresh.
- Unresolved owner calls: the four orphan `/platform/*` pages (retire is recommended); whether the platform-admin sign-in takes
  the new lockup; the name-and-logo search on "FieldLogic" and the new mark before anything is printed or stitched (the owner's
  or counsel's, not a gate on Part A).

## Before code (AGENCY_RULES)

Give the owner the plain-language UX summary first (what a visitor, a signed-in user and a phone user see differently, and
that the words are unchanged except what the words doc approves), then build.

## After the build

- `/review` after each part (offer `/simplify` too: a shared component and many call sites), then commit after the owner says
  yes. **Do not promote Part A without Part B.**
- **Two checkable QA walk Artifacts** (house format, one purpose each): **Walk A**, the marketing set: every page in warm, no
  typewriter lettering, no dark island, titles and shared-link previews (paste a link into a chat or a link-preview checker),
  scroll with the network slowed to confirm nothing hides, phone width, the bar's colour on a phone. **Walk B**, the identity:
  the mark at every size and place (browser tab, bookmark, iPhone home screen after adding the app again, Android install,
  a push notification's badge and picture, an exported PDF and spreadsheet, the unsubscribe page, offline, a sent email's name
  line), light and dark, with Skipped twins for devices the owner lacks.
- `/docs` if a help article names the old look or the old icon; a `/demos` note only if a demo story shows the wordmark.
- Records: the plan's S4 ladder row ("built, commit `<hash>` <date>"), the ledger (new section, never reorder the numbers),
  TODO's public-face line (only if no other session has uncommitted edits in TODO.md), the auto-memory
  `project_public_face_warm`, and `VISUAL_IDENTITY.md` §3/§4 where the email and wordmark paragraphs say "from S4".
