# The public face, warm: S5, the system screens (build prompt)

> **Written 2026-10-23.** **Paste this into a new chat on `dev`.** **Model: Sonnet, effort medium** (the plan's row: small
> screens, drawn and worded). Run `/review` before the commit. The plan is `PUBLIC_FACE_WARM_PLAN.md` (the S5 row); the identity
> rules are `docs/agents/brand/VISUAL_IDENTITY.md`; **the words are `PUBLIC_FACE_WARM_S5_COPY.md`** (already ruled by
> `/marketing`); **the drawings are the contract:** https://claude.ai/artifact/Jshmg1RJSYXn5VzJM9yiGj (source
> `PUBLIC_FACE_WARM_S5_DRAWINGS.html`). Open the drawings first and keep them open. Every chip on them opens its reason.
> **Order (owner, Ask 11): S1 ✓ → S3a ✓ → S4 ✓ → S5 → S3b.** The tree is shared: run `git status` first, stage explicit
> paths, check the branch is `dev`, and **ask before committing.** `TODO.md`, the plan and the ledger carry other sessions’
> uncommitted edits: commit only your own hunks (see the partial-commit note in the auto-memory).

## What this build carries out

Six screens get one family look: a small line-icon tile, a plain headline, one sentence, one obvious next step and the name at
the foot. The owner ruled **every ask as recommended** and **every drawing change from the `/design` pass** (2026-10-23).

| Ask | Ruling |
|---|---|
| 1 | The 404 button goes to Home (`/discover`) for everyone. The page stays static and reads no session. |
| 2 | An icon tile on all six screens, a different line icon on each. |
| 3 | The root-layout crash is paper for everyone. No theme script. |
| 4 | “Go to Home” sits beside “Try again” on both crash screens. |
| 5 | Both crash screens switch from `reset()` to `retry()`. |
| 6 | The offline page’s words change to say only what is true. No auto-reload. |
| 7 | One unsubscribe sentence that is true for all three opt-out kinds. No route change. |
| 8 | The “not affected” note comes **off** the page until the owner confirms it. |
| 9 | On the suspended page Sign out becomes the quiet button. The page has **no lime button**. |
| 10 | The neutral share card is card A: the name and the tile, no sentence. |
| 11 | The suspended-page reach gap (F5) is noted for its own plan. **Not part of this build.** |

## Step 0: the words are already settled

Apply every line marked **Approved** in `PUBLIC_FACE_WARM_S5_COPY.md`. Leave **Held** lines exactly as they are or off the page
as that file says. Do not reword a sentence while restyling it. The buttons say “Go to Home”, never “the home page”.

## The six screens (each census line is a lead from 2026-10-23: open it before you rely on it)

1. **404** (`app/not-found.tsx`, `app/system-screens.module.css`). Server component, outside every shell. Keep the existing
   theme mechanism (`warm.warmVars` plus the `data-user-theme` rules): warm for everyone, Dark only for a signed-in person who
   chose it. Eyebrow, headline, sentence, one lime button to `/discover`, the name at the foot as plain text.
2. **Crash inside a page** (`app/error.tsx`). Same stylesheet and look as the 404, no red frame, no eyebrow, two buttons: lime
   “Try again” (**calls `retry()`**, not `reset()`) and a quiet “Go to Home” (a normal link). Keep `reportClientError` exactly
   as it is. Keep the development-only raw message block (restyled to the paper card). The `retry` prop is typed in Next 16.3
   (`node_modules/next/dist/client/components/error-boundary.d.ts`); read the error file convention page in
   `node_modules/next/dist/docs/` before you change the prop (AGENTS.md).
3. **Crash in the root layout** (`app/global-error.tsx`). ⚠ **It can only do what the drawings say it can:** inline styles,
   the system font stack, fixed colours (paper `#F8F4ED`, ink `#241E15`, lime button with ink text), the mark and name as inline
   SVG and text drawn from `lib/brand-mark.ts` (the constants, never a redrawn path), plain `<a>` links. It cannot use the
   heading face, Inter, a CSS module, `BrandLockup`, or a theme. Paper for everyone. Same words as the page crash except the
   sentence in the words file. Same `reportClientError`. `retry()`. ⚠ **Check it on a phone width:** because this file replaces
   the root layout, the viewport tag the layout provides is not there. Confirm it does not render desktop-scaled, and add a
   viewport tag inside the file if it does.
4. **Offline** (`public/offline.html`). Three changes only: the words (copy file), headline weight 800 to 700, and the tab
   title’s separator. Do **not** touch the name at the foot (the identity test pins its copy) or the pre-paint theme rule.
   ⚠ **Raise the service worker’s cache version from v11 to v12** with a dated comment, as S4 did, or installed phones keep the
   old page. Say in the commit message what the bump does (it clears installed phones’ saved copy of the offline page).
5. **Unsubscribe confirmed** (`app/unsubscribe/confirmed/page.tsx`). Always warm (paper, the first look’s always-warm kit, never
   a Dark island). Move it off inline styles into a stylesheet and **add that stylesheet to `scripts/check-public-type.mjs`’s
   scope** (the scope list is hand-kept). Three states: **done** (`?error` absent), **bad link** (`?error=invalid`, and any other
   unknown value), **our failure** (`?error=db`, a new state). Do **not** change `app/unsubscribe/route.ts` or what it does.
   The “not affected” note is **off the page** (Ask 8 B). The foot line `FieldLogicHQ · Canada` stays exactly as is, quiet, at the
   bottom of the card, away from the name (it is Held). Keep the CASL sentence word for word.
6. **Suspended account** (`app/(consumer)/auth/suspended/page.tsx`, `SignOutButton.tsx`). Same family look inside the shell
   (the shell is unchanged). The headline and sentence use the club name, with the no-name fallbacks in the words file. Keep the
   `CHAT_PAUSED` variant of the reassurance. Sign out is the **quiet** button; the page has **no lime button**. Keep every
   redirect (active workspace to `/discover`, no suspended membership to `/start`, signed out to login). ⚠ The sign-in
   stylesheet `app/(consumer)/auth/auth.module.css` is still imported by `app/(consumer)/auth/layout.tsx` for `.authSurface`
   (the warm colour remap for the whole sign-in group): **do not delete the file.** Remove only the rules the suspended page
   was the last to use, and keep `.authSurface` and its warm remap. Confirm with a search that nothing else reads the removed
   classes.
7. **The neutral share card** (`lib/club-share-card-image.tsx`, `neutralShareCard()`, called by the three `opengraph-image`
   files for a missing or closed club, team or tryout page). Card A on paper: the olive tile with the mark, and the name
   beneath it at about 64 px so the whole thing sits inside the middle 600 px of the 1200 × 630 card (a squarer preview crops
   the sides). Drawn from `lib/brand-mark.ts` only. It stays `no-store` and names no club. The marketing card
   (`app/share-card.png/route.tsx`) fetches Inter and Barlow from Google on every render; the neutral card is uncached and
   asked for by crawlers, so **move that font loader to one shared module that keeps the fonts in memory and falls back to the
   renderer’s own face if the fetch fails**, and use it from both cards. ⚠ `neutralShareCard()` is synchronous today and will
   become async; its three callers return it from async functions, so check each one still returns a response.

## Family look (all six)

- Tile: 64 px, 16 px corners, a 30 px line icon (the offline page’s tile is the origin), olive on a soft olive wash on warm; on
  Dark the lime-washed version the offline page already uses. Icons: no-signal (offline), broken link (404 and unsubscribe bad
  link), alert circle (both crashes and our-failure), mail with a tick (unsubscribe done), circle-slash (suspended).
- Headline: Barlow Condensed 700, sentence case, 36 px on a computer and 32 px on a phone; the sentence in Inter 16; buttons
  Inter 700, 48 px, 10 px corners, sentence case, no arrow. **One lime button per view** (the suspended and unsubscribe pages
  have none).
- The secondary button’s edge must clear **3:1** against its ground, warm and Dark (the drawings use `#8E8576` and
  `rgba(255,255,255,.45)`). Use the portal’s existing edge token if one passes; otherwise flag it as a design-system extension
  rather than inventing one silently.
- Build **one small shared presentational component** for the 404, the page crash, the unsubscribe page and the suspended page.
  `global-error` and `offline.html` stay separate copies because of what they cannot import.

## Two carry-ins (no drawings)

- **The install banner off the sign-up steps (U7).** The install prompt is mounted by the consumer layout, which the sign-up
  steps sit under. Stop mounting it on those steps. Home and the signed-in app keep it. *Owner check:* open the sign-up steps on
  a phone that never dismissed the prompt and see no banner; open Home on the same phone and see it.
- **The screen-reader pass on the shared account form** (`components/auth/AccountForm`): labels, the error announcement, the
  password eye’s name and focus order. It changes announcements, not the look. *Owner check:* with a screen reader on, sign in
  with a wrong password and hear the error read out without moving to it; tab through the form in reading order.

## Guards (the build is not done without these)

- `npm run check:public-type`: the system-screens section (12 face, 5 capitals, 1 heavy) and the sign-in stylesheet’s
  findings fall to zero. Update the baseline file (`scripts/.public-type-baseline.json`) in the same change, as the check says.
- `tests/unit/public-face-s4-identity.test.ts` fails on a second hand-drawn copy of the name. The root crash’s inline name and
  the neutral card are two new places that draw it; teach the test about them rather than loosening it.
- `npm run check:spelling`. `tests/unit/club-stage4a-guard.test.ts` mentions these screens: run it, do not edit it unless it
  pins an old string. The layout, token and contrast scripts also mention them: run them; use `check:layout --changed` on the
  few screens touched (not a whole-product sweep on the dev server).
- **Behaviour tests, not just looks:**
  1. **Try again recovers.** Force a one-time server failure locally (an uncommitted scratch route that throws on its first
     request), click Try again, expect the page to come back. This is the only way to prove `retry()` fixes what `reset()`
     did not; say plainly in the hand-off whether you saw it fail with `reset()` first.
  2. The unsubscribe route’s three redirects, the new third state, and that a bad token still opts nobody out.
  3. The 404 button from signed-in and signed-out browsers.
  4. Offline with the network off, warm and Dark.
  5. The neutral card for a missing club (the response is a PNG, `no-store`).
- Restart the dev server before the owner tests (new files, a shared module change): stop it, clear `.next`, `npm run dev`.

## Do not

- Reword a sentence the copy file does not list. Touch the foot line `FieldLogicHQ · Canada`, the CASL sentence, the error
  report, any tracking, the installed-app icons, the club-site 404 (a separate screen), or any other page’s Dark.
- Change `app/unsubscribe/route.ts`. Add an auto-reload to the offline page. Read the session in the 404.
- Build the suspended-page reach fix (F5) or change the marketing share card’s crop (an S4 follow-up).
- Commit, push or touch `master` without the owner’s say-so. Edit `TODO.md` while another session has uncommitted edits in it
  (say so instead). Add a new colour or token silently.

## Before code (AGENCY_RULES)

Present the short plan and the plain-language UX summary in the conversation first (what a person sees and does differently on
each of the six screens, the benefits, and that nothing is role-gated). The drawings are the approved mockups: tag what you
build NEW, RESTYLED or UNCHANGED against them.

## After the build

1. `/review` on the diff; offer `/simplify` for the shared component and the shared font loader.
2. **A checkable walk, published as an Artifact** (checkboxes plus a paste-back; one purpose per walk), and a new section in
   `OWNER_QA_LEDGER.md` (read its tail for the next number; never sort the section numbers). Stations: each of the six screens
   warm and Dark where it follows the setting, and on a phone; the Try again recovery; the three unsubscribe states; the
   suspended page for a one-workspace member; the neutral card in a chat preview; the two carry-ins.
3. Records, same unit of work: the plan’s S5 row, the project index artifact (a data write, not a republish), the auto-memory
   `project_public_face_warm`.
4. The offer of `/docs`: the unsubscribe and suspended wording may appear in help articles. Search `lib/help-content` for the
   old sentences and offer it if any match.
5. A What’s new line is **not** needed: nothing here is a feature. Say so to `/release` rather than leaving it blank.
