# Prompt — build Self-hosted fonts (option B), one session

> **❌ NO-GO: owner ruling, 2026-10-07. Do not build this, and do not re-propose it.** Archived unbuilt.
> A build that fails on the Google Fonts download is re-run (a retry passed on 2026-10-07).


Paste everything below the line into a new Claude Code session in this repo.

---

Build the **Self-hosted fonts** project, **option B** of its plan: the product keeps its own copies of
its five font families, laid out exactly as Google lays them out, and nothing a customer sees or
downloads changes. The owner asked for this build prompt on 2026-10-07 after reading the plan, whose
recommendation is B. Treat B as chosen. The one open call is the preload question below, and it has
a stop rule.

## Read first (binding)

- `CLAUDE.md`, `AGENTS.md`, `AGENCY_RULES.md`. Work on `dev`. Stage explicit pathspecs only; other
  sessions share this working copy and usually hold uncommitted lines in `TODO.md`, the Owner QA
  Ledger and `memory/design_decisions.md`.
- The plan, `docs/projects/active/SELF_HOSTED_FONTS_PLAN.md`: why (§1), what loads today (§2), the
  four promises (§3), the options (§4). Also its PM brief.
- What `next/font` does that you are replacing:
  `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`, and its Google loader
  `node_modules/next/dist/compiled/@next/font/dist/google/` (`get-google-fonts-url.js` builds the
  request, `fetch-resource.js` holds the user agent, `loader.js:122` is the crash).

## The promises (plan §3). A build that breaks one is not done

1. Every page looks identical: faces, weights, sizes, and the fallback metrics while a font loads.
2. Every name renders in the real font, including letters beyond basic Latin (ł ř ő ş …).
3. A page downloads no more font data than today.
4. The seven CSS variables keep their names: `--font-sans`, `--font-display`, `--font-mono`,
   `--font-inter`, `--font-barlow`, `--font-dm-serif`, `--font-dm-sans`.

## What is served today: the spec

Captured 2026-10-07 from deployed dev (commit `a7254540`, Amplify job 328). **Re-capture it in
step 1; where the live capture differs from this list, the capture wins, and say so.**

- **A root page (`/`) has 68 `@font-face` rules:**
  - Inter: 35 faces, 7 alphabets × weights 300/400/500/600/700. Each alphabet is ONE variable file
    shared by its five faces.
  - Barlow Condensed: 15 faces, 3 alphabets × 400/600/700/800/900.
  - IBM Plex Mono: 15 faces, 5 alphabets × 400/500/700.
  - One fallback face per family.
- **Family names are readable:** `Inter`, `Barlow Condensed`, `IBM Plex Mono`, and `<name> Fallback`.
  Every face is `font-display: swap`.
- **Fallback faces, verbatim:**
  - `Inter Fallback`: `src: local("Arial"); ascent-override: 90.44%; descent-override: 22.52%; line-gap-override: 0.00%; size-adjust: 107.12%`
  - `Barlow Condensed Fallback`: 130.73% · 26.15% · 0.00% · 76.49%
  - `IBM Plex Mono Fallback`: 76.16% · 20.43% · 0.00% · 134.59%
  - `DM Serif Display` and `DM Sans` fallbacks: capture them from a club page in step 1.
- **Files:** served from `/_next/static/media/…woff2`, `Content-Type: font/woff2`,
  `Cache-Control: public, max-age=31536000, immutable`.
- **Preloads:** sent as HTTP `Link:` response headers, not `<link>` tags.
  - **9 on every page:** the basic-Latin file of each root face (Inter 1, Barlow 5, Plex 3).
  - **11 on every page under a club address** (`/{orgSlug}/…`, e.g. `/riverdale-minor-ball`): the 9
    plus DM Serif Display and DM Sans basic Latin. That covers the whole coaches portal and admin,
    which never use those two families.
- **How it was captured:**
  1. `curl -s -D hdr.txt -o page.html <base>/`, then read `Link:` from `hdr.txt`.
  2. Collect `<link rel="stylesheet">` hrefs from `page.html` and fetch each one.
  3. Pull every `@font-face{…}` block out of the stylesheets.
  4. Repeat on a club page.

## Three traps, already checked. Do not rediscover them the hard way

1. **Do NOT put the font files in `public/`.** Reference them from a stylesheet with relative
   `url()`s, so the bundler emits them to `/_next/static/media/` hashed and immutable, exactly as
   today. A `public/fonts/` folder breaks three things:
   - **The installed app's offline cache.** `public/sw.js`, `isStaticAsset`, caches only
     `/_next/static/`, `/icons/` and the favicon, so the app would go Arial offline.
   - **The proxy's demo catch-all.** The entry
     `{ source: '/((?!api|_next/static|_next/image|favicon.ico).*)', has: flhq-in-sandbox cookie }`
     runs the proxy on every request from a browser that has opened a demo, so every font request
     from a prospect would run through it.
   - **Caching.** Long-lived caching would need a new `next.config.ts` headers rule.
2. **The club layout re-points the body and display fonts** (`buildFontVars` in
   `app/[orgSlug]/layout.tsx`: `--font-sans: var(--font-inter)` and so on). The four theme variables
   must therefore be defined everywhere a club page renders. Define all seven on `:root`.
   `buildFontVars` itself does not change.
3. `fonts` is already a reserved org slug (`lib/reserved-slugs.ts`). Nothing to do.

## The one open call: preload

`next/font` preloads through a manifest. A file the bundler names (step 3) has a hashed address that
a layout cannot know, so `ReactDOM.preload` (the documented way) cannot name it. **Default: no
preload.** That is promise 1's only exposure: on a FIRST, uncached visit, the fallback could show
for longer before the real font swaps in. The fallback is metric-matched, so nothing moves; it only
looks different until the swap. Repeat visits are cached.

**Measure it, then decide by the rule.**
- **Setup:** Playwright Chromium; CDP `Network.emulateNetworkConditions` at Chrome's Slow 4G preset;
  cache disabled; 5 cold loads each of the marketing home and the coach Overview, before and after,
  on the local dev server both times.
- **Record per load:** the time from navigation start to each font's `loadingdone` (or
  `document.fonts.ready`), and the total font bytes. Use medians.
- **≤ 150 ms later on both pages:** ship without preload. Record the numbers in the plan's build
  record. Also record the side effect: coaches and admins stop preloading the two DM families (about
  78 KB) on every first visit.
- **> 150 ms:** **stop before committing** and bring the owner the numbers and the alternative. The
  alternative is files in `public/fonts/` with content-hashed names, preloaded with
  `ReactDOM.preload`, which costs three shared-infrastructure changes, each its own decision:
  1. An immutable cache rule in `next.config.ts`. This is build config: the release's deploy-only
     check applies.
  2. `/fonts/` added to the service worker's static cache, following its cache-version rules.
  3. `fonts` excluded from the proxy's demo catch-all, which a unit test pins. Read what the
     leave-the-demo rule does with a non-page request first.

## Steps

0. **Parallel work.** `git status`, plus `git log --since=<a week ago>` for `app/layout.tsx`,
   `app/[orgSlug]/layout.tsx` and `app/globals.css`. Stage around anyone else's lines; never over
   them.
1. **Capture before**, ahead of any edit. Save to `.probe/fonts/` (probes live there, never in
   `test-results/`):
   - (a) **The served spec**, root and club page, as JSON: every face (family, weight, style,
     `unicode-range`, display, file URL), the fallback faces, and the preload list per page.
   - (b) **The look:** copy the pattern of `.probe/sf2/capture.mjs` + `diff.mjs` (a computed-style
     fingerprint of every node, class names excluded, plus a PNG clip). Wait for
     `document.fonts.ready` before every capture. Capture:
     - Screens: the marketing home, the coach Overview, the game-day console, the club admin
       Ledger, a public tournament page in each of the three theme fonts (find orgs that use
       `inter`, `barlow` and `dm-serif` by reading, never by changing an org's theme), and the
       platform-admin login.
     - In Warm and Dark, at 390 and 1440.
   - (c) **The cold-load timings** from the preload section.
2. **A generator, kept in the repo and run by hand only:** `scripts/fonts/sync-google-fonts.mjs`.
   For each of the seven calls:
   - Build Google's css2 URL exactly as `get-google-fonts-url.js` does (weights, axes,
     `display=swap`) and request it with `fetch-resource.js`'s user agent.
   - Download every file. Name each by family, weight (or `var`) and alphabet, taking the alphabet
     from the `/* latin-ext */` comment above each face. ⚠ Google's `l/font?kit=` address has no
     extension (the bug that started this): name the file from the face's `format('woff2')`, never
     from the URL.
   - Write the stylesheet: Google's faces with local relative `url()`s, the captured fallback faces
     verbatim, and the seven variables on `:root` (`'<Family>', '<Family> Fallback'`, matching
     today's values).
   - Inter and Barlow Condensed are requested twice today, once per layout. Confirm the two
     requests return the same files and declare each family once.
   - Also download each family's `OFL.txt` from the google/fonts repository into a `licenses/`
     folder beside the files.
   - **Put it all in `app/_fonts/`.** An underscore folder is private and never a route; check the
     private-folders convention in this Next version's docs.
3. **Prove the copy is identical.** Generated faces vs the capture: the same count per family, and
   the same weight, style, `unicode-range` and display per face. Every downloaded file's sha256
   equals the file served today, fetched from its captured `/_next/static/media/` URL. **Any
   difference stops the build.** Either Google changed a font since the last deploy, which you
   report, or the generator is wrong. Do not consolidate faces (for example Inter's five per
   alphabet into one `300 700` range) even where it would be equivalent: verbatim is the evidence.
4. **Swap the layouts.**
   - The root layout drops `next/font/google`, imports the stylesheet, and its `<html>` className
     loses the three font-variable classes.
   - The club layout drops its four calls and their four className entries.
   - Grep every declaration of the seven variables, so nothing now wins or loses by order or
     specificity.
5. **Preload** per the rule above.
6. **A guard** in `tests/unit/`, which must fail when broken:
   - no `next/font/google` import under `app/`, `components/` or `lib/`;
   - every `url()` in the stylesheet resolves to a file on disk;
   - each of the seven variables is declared exactly once;
   - the root layout imports the stylesheet;
   - the five fallback faces are present with the captured numbers.

   Its messages say why, in this repo's guard style: the build must not fetch from Google, see the
   plan §1.
7. **Verify.**
   - `npm run typecheck` (a shared layout changed), `npm run verify:changed`, and focused lint on
     the changed files.
   - Re-run the look capture after the change and diff it: identical. Re-run the timings.
   - **The alphabet promise:**
     - On a live page, a probe adds the text `Łukasz Dvořák Şahin` in the body font.
     - Assert the latin-ext Inter file is requested and the text renders in Inter (check
       `document.fonts` for a loaded Inter face covering it).
     - A page with only basic Latin requests no latin-ext file.
   - After a fresh dev compile, `.next/` contains no `fonts.gstatic.com` or
     `fonts.googleapis.com`.
   - New files and a shared layout changed, so **the dev server must restart before handoff**
     (AGENTS.md restart rule). Ask the owner to restart it; do not kill it unasked.
8. **`/simplify`, then `/review`.** `/simplify` because there is a new generator and stylesheet.
   No `/docs`: nothing a customer reads changes. No demo work: the demos follow the product.
9. **Record and commit.**
   - Update the plan's status line and add a **Build record**: the capture, the identical-copy
     proof, the timing numbers, and the preload decision. Update the PM brief's status line and the
     TODO line.
   - Add the next free Owner QA Ledger section with a short walk, published as a checkable Artifact
     per house convention:
     1. the portal, the club admin and a public page in both themes look as they did;
     2. a roster name with Polish, Czech or Turkish letters is in the same font as the rest;
     3. the installed app opened offline keeps its fonts.
   - **Two commits:** the code (the fonts and licences, the stylesheet, the two layouts, the
     generator, the guard), then the docs.
   - **Do not push.** The owner runs `/release dev`. That build is the real proof:
     - the deployed dev build succeeds;
     - re-running the step-1 capture against it gives the same faces, served from
       `/_next/static/media/` with the immutable cache;
     - the preloads are as decided.

## Do not

- Change any font, weight, theme choice or variable name.
- Touch `proxy.ts`, `public/sw.js` or `next.config.ts` unless the owner rules the preload
  alternative.
- Touch the PDF engine's fonts. It does not use `next/font`.
- Re-seed a demo, or let the generator run anywhere but by hand.
- Disagree silently. If the code says something this prompt does not, say so before building;
  every fact here is a lead to verify.
