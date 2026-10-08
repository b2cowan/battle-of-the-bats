# Self-hosted fonts — the build stops downloading fonts from Google

> **❌ NO-GO: owner ruling, 2026-10-07. Do not build this, and do not re-propose it.** Archived unbuilt.
> A build that fails on the Google Fonts download is re-run (a retry passed on 2026-10-07).


**Status:** PROPOSED 2026-10-07 (owner: "plan 2" on the `/release fix logs dev` proposal). Option B
build prompt written the same day at the owner's request: `SELF_HOSTED_FONTS_BUILD_PROMPT.md`. It
carries the served baseline captured from deployed dev and corrects §4 B's file placement (see the
note there). Not built. PM brief: `SELF_HOSTED_FONTS_PM_BRIEF.md`.

---

## 1 · Why

**The dev build failed on 2026-10-07 (Amplify job 327, commit `a7254540`) for a reason that had
nothing to do with the release.** `next build` downloads every `next/font/google` family from Google
Fonts at build time. Google answered one request with a font file address that has no file
extension (the `fonts.gstatic.com/l/font?kit=…` form instead of `…/file.woff2`), and Next's loader
crashes on it:

```
app/[orgSlug]/layout.tsx · app/layout.tsx
An error occurred in `next/font`.
TypeError: Cannot read properties of null (reading '1')
  at …/next/dist/compiled/@next/font/dist/google/loader.js:122:78
```

Line 122 is `/\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1]`, with no null check.

- **Upstream:** vercel/next.js #99114, opened 2026-09-23, open, no fix released. It reports the
  extensionless address in about 1 in 60 responses and calls the failure a flake that clears on
  rebuild. Other projects hit by it are moving to self-hosted fonts.
- **A retry of the same commit** (job 328) was the immediate fix. Nothing in the failed release
  touched fonts or build config, and the build's two standing warnings (cache write 404,
  `process.env.secrets`) are also in the last good build (job 326).
- **Production carries the same exposure.** A failed master build leaves the live site untouched,
  but it stalls a promote at random.
- **The same dependency caused the 2026-10-05 "fonts changed overnight" scare on the local dev
  server.** The PC woke from sleep with the server running, the network was down for a few seconds,
  and the dev server rebuilt the font modules while Google was unreachable. It kept only the Arial
  fallbacks with their size adjustments, so mono labels were about 35% bigger and the condensed
  headings were gone until a restart. Self-hosting removes that too.

## 2 · What the product loads today

Seven `next/font/google` calls in two layouts, five families, `subsets: ['latin']` throughout,
`display` left at its default (`swap`), and `adjustFontFallback` on (Arial with `size-adjust`):

| Layout | Family | Weights | CSS variable | Used by |
|---|---|---|---|---|
| root | Inter (variable) | 300–700 | `--font-sans` | the whole product's body text |
| root | Barlow Condensed | 400 600 700 800 900 | `--font-display` | headings, wordmark |
| root | IBM Plex Mono | 400 500 700 | `--font-mono` (→ `--font-data`) | figures, labels |
| org | Inter (again) | 300–700 | `--font-inter` | public-site themes (`lib/themes.ts`) |
| org | Barlow Condensed (again) | 400–900 | `--font-barlow` | public-site themes |
| org | DM Serif Display | 400 | `--font-dm-serif` | public-site themes |
| org | DM Sans (variable) | full range | `--font-dm-sans` | public-site themes |

⚠ **`subsets: ['latin']` only decides what is PRELOADED.** Google's CSS returns every alphabet it
has for a family, each `@font-face` restricted by `unicode-range`, and `next/font` downloads and
serves all of them. So today a player named Łukasz Dvořák renders in real Inter, because the
browser fetches the small latin-ext file only when a page contains one of those letters. An
option that keeps only the latin files changes how those names render.

Inter and Barlow Condensed are declared twice (once per layout). The files are the same; the
declarations are not.

**Measured 2026-10-07** (woff2 bytes from Google, per alphabet, for the weights above):

| Family | latin | latin-ext | other alphabets |
|---|---|---|---|
| Inter (1 variable file per alphabet) | 47.3 KB | 83.3 KB | cyrillic, cyrillic-ext, greek, greek-ext, vietnamese: 83.1 KB |
| Barlow Condensed (5 weights) | 71.4 KB | 45.0 KB | vietnamese: 22.6 KB |
| IBM Plex Mono (3 weights) | 29.5 KB | 25.8 KB | cyrillic, cyrillic-ext, vietnamese: 40.6 KB |
| DM Serif Display | 17.4 KB | 6.6 KB | none |
| DM Sans (1 variable file) | 61.1 KB | 30.6 KB | none |

All of it, every alphabet, is about 560 KB in the repo. A product page today downloads only its
latin files: about 148 KB for the three root families.

## 3 · What must not change

1. **Every page looks identical:** same faces, weights, sizes, and the same fallback metrics while
   a font loads.
2. **Every name renders in the real font**, including letters outside basic Latin, as today.
3. **First-visit download size does not grow** for the common page (latin only).
4. **The CSS variable names stay** (`--font-sans`, `--font-display`, `--font-mono`, `--font-inter`,
   `--font-barlow`, `--font-dm-serif`, `--font-dm-sans`). About 2,000 rules read them.

## 4 · Options

### A · `next/font/local`, one file per weight (Next's own self-hosting)

Swap each `next/font/google` call for `localFont({ src: [...], variable })`, with the files in the
repo. Next still hashes them, preloads them and computes the Arial fallback.

**The catch:** `next/font/local` cannot split a family by alphabet. A `src` entry takes `path`,
`weight` and `style` only, and `declarations` (where `unicode-range` would go) applies to the whole
call. Two ways to live with it, and neither meets §3:
- **A1, latin + latin-ext merged into one file per weight:** names render correctly, but every
  first visit downloads about +154 KB of fonts (148 → ~302 KB for the root families), most of it
  for letters the page doesn't contain. Breaks §3.3.
- **A2, latin only:** no size change, but ł, ř, ő, ş and the like fall back to Arial in the middle
  of an Inter name. Breaks §3.2.

### B · Self-hosted files with Google's own CSS copied verbatim (RECOMMENDED)

Download every file Google serves today for these seven calls. Write one font stylesheet that
reproduces Google's `@font-face` rules exactly (same alphabet split and `unicode-range`, `swap`),
plus one fallback face per family carrying the `size-adjust` / `ascent-override` /
`descent-override` / `line-gap-override` values `next/font` generates today, **copied from today's
built CSS, not recomputed**. Set the seven CSS variables to `'<Family>', '<Family> Fallback'`.
Drop the `next/font/google` imports.

- Meets all of §3: same files, same split, same fallback metrics, same variables.
- Declares Inter and Barlow Condensed once. `--font-inter` / `--font-barlow` alias the root
  families instead of declaring them again.
- ⚠ **Corrected 2026-10-07 while writing the build prompt: the files must NOT go in `public/`.**
  The installed app's service worker caches only `/_next/static/`, `/icons/` and the favicon, so it
  would lose the fonts offline. The proxy's demo catch-all would run on every font request from a
  browser that has opened a demo. Reference the files from the stylesheet with relative `url()`s,
  and the bundler serves them from `/_next/static/media/`, hashed and immutable, as today. The cost
  is preload: a layout cannot name a hashed file. Today 9 basic-Latin files are preloaded on every
  page, and 11 under a club address (the two DM families too, including on every coaches-portal and
  admin page, which never use them). The build prompt measures what losing the preload costs on a
  first visit, with a stop rule. The `public/` route below survives only as that stop rule's
  alternative.
- **What `next/font` stops doing for us, and the build session must replace:**
  1. **Preload of the latin files.** Without it, fonts start loading when the CSS is parsed rather
     than with the document, about one round trip later. Either emit `<link rel="preload"
     as="font" type="font/woff2" crossorigin>` for the root latin files from the root layout (needs
     stable URLs, so files under `public/fonts/`), or measure the difference and accept it.
  2. **Long-lived caching.** `next/font` serves from `/_next/static/media` (hashed, immutable).
     Files in `public/` need a `Cache-Control: public, max-age=31536000, immutable` rule in
     `next.config.ts` `headers()`. Fonts referenced by `url()` from bundled CSS get hashed and
     immutable automatically, but then they can't be preloaded by a stable name. Pick one and say
     why. ⚠ A `next.config.ts` change is build config, so the release's deploy-only check applies:
     verify on deployed dev before a promote.
- **Cost:** about 560 KB of font files in the repo, and the fallback numbers are hand-copied once.
  These fonts have not changed in the product's life.

### C · Patch the loader (`pnpm patch next`), keep Google

Apply the fix proposed upstream: when the address has no extension, take the type from the CSS's
`format('woff2')`. The smallest change, a few lines.

- Fixes this crash only. The build still needs Google reachable (an outage or rate limit still
  fails it), and the dev server's offline-after-sleep fallback (§1) stays.
- The patch must be carried across every Next upgrade until upstream ships its fix.
- A reasonable stopgap if B is deferred; not a fix.

### D · Do nothing; retry a failed build

Costs nothing until it fails at a bad moment (a hotfix promote). The retry is one command.

## 5 · Recommendation

**B.** It is the only option that changes nothing a customer sees or downloads, and it takes the
network out of both the build and the dev server. A fails one of the two promises in §3; C and D
leave the dependency in place. If B waits, take **C** as the stopgap, not D: the next failure will
otherwise land on a production promote.

## 6 · Build steps (option B)

0. **Capture today's truth before touching anything.** From a current production build (or the dev
   server's served CSS): every `@font-face` for the seven calls (file URL, weight, style,
   `unicode-range`), the generated fallback faces with their four override values, and the
   variable values. Keep it in the build record. It is the spec.
1. Download the files (one per alphabet per weight, as listed in Google's CSS) to one folder with
   readable names (`inter-latin.woff2`, `barlow-condensed-700-latin-ext.woff2`, …). Include each
   family's licence file. All five are SIL Open Font License families, which allows bundling;
   confirm each licence while downloading.
2. Write the font stylesheet (faces + fallback faces + the seven variables) and import it from the
   root layout. The org layout's four calls go too.
3. Preload and caching per §4 B.
4. **A guard** (`tests/unit/`): no `next/font/google` import anywhere; every `url()` in the font
   stylesheet exists on disk; every one of the seven variables is defined once.
5. Delete nothing else. The ~2,000 rules that read the variables don't change.

## 7 · Verification

- **Identical rendering:** before/after screenshots of a handful of screens in Warm and Dark at
  phone and computer widths (portal Overview, game day, a club admin list, a public tournament
  page with each theme font, a printed-style page). Diff them. Not the full `check:layout` sweep;
  the change is global, so a sample of each font is the evidence.
- **The alphabet promise:** a test player named `Łukasz Dvořák Şahin` renders in Inter, not the
  fallback (DevTools › Rendered fonts, or `document.fonts` after load).
- **Download size:** a portal page's font bytes on first load are equal to before (about 148 KB),
  and an all-basic-Latin page fetches no latin-ext file.
- **The network is gone:** `next build` succeeds with outbound HTTPS to Google blocked, and the
  build log has no `fonts.googleapis.com` / `fonts.gstatic.com` request. The dev server survives
  a network drop: restart nothing, toggle Wi-Fi, edit a layout, and fonts stay right.
- **Deploy-only:** build config changed, so the dev Amplify build must SUCCEED and a deployed page
  must be checked before a promote (release step 1d-2).

## 8 · Out of scope

- Changing any font, weight or theme choice.
- Retiring the webpack production build (its own TODO line). Self-hosted fonts work on both.
- The PDF engine's fonts. It does not use `next/font`.
