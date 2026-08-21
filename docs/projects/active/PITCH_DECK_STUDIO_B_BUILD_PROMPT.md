# Build prompt — Pitch Deck Studio, Stage B: composition becomes yours

Paste into a **fresh session**. Read the stop line before planning anything larger.

## Read first, in this order

1. `docs/projects/active/PITCH_DECK_STUDIO_PLAN.md` — the whole project. **Binding.** Read
   **ruling 4** and the block **"What stage A actually settled"** before anything else; between
   them they overturn several things the earlier phases assumed.
2. `docs/projects/active/PITCH_DECK_STUDIO_PM_BRIEF.md` — the plain-language version.
3. `app/platform-admin/pitch-deck-studio/report.ts` — its header is the honest account of what
   this screen can and cannot see. Do not weaken any of it.
4. `lib/walkthrough-content.ts` — the library, the decks, the pulls. Its header carries the
   copy rules.
5. `memory/project_pitch_deck_studio.md` (in-repo) and the Claude auto-memory entry of the same
   name.

## ⚠⚠ THE STOP LINE — THIS IS THE PHASE WHERE THE RISK LIVES

Stage A was read-only and could not break a customer-facing thing. **Stage B moves the two public
walkthrough pulls out of code and into owner-editable records.** Two live marketing pages gain a
data dependency they have never had, and every invariant the build currently enforces has to move
into the SAVE PATH.

**The page must render correctly even if the store is unreachable.** The code deck stays as a
fallback; a missing or broken row can never produce an empty marketing page.

**Do not start the composer (stage C) or prospect links (stage D) in this session.**

## The owner's steer, and it changes the shape of this phase

> *"The whole point of this exercise is when we are done I have a library of slides that I can
> choose what to do with on the marketing pages, pitch decks, etc., and these decisions can change
> over time. So we don't need 'official' decisions on what slides go where on the site yet — I
> would like to see the completed library and have it allow me to select these choices and change
> over time."*

**Three consequences, all binding:**

1. **Stop treating placement as an editorial ruling.** It is a dial the owner turns. A session that
   asks him "should slide X go on page Y?" is asking the wrong question — the answer is always
   "make it selectable".
2. **⚠⚠ THE PAGE-COPY PASS IS NOW A PREREQUISITE, NOT STAGE C.** A slide cannot go on a page
   without the long unattended `answer` a deck does not need (finding F4). Ten slides do not have
   one. **A picker where most options cannot actually be picked is worse than no picker** — so
   either write the missing copy in this session, or ship a composer that is honestly
   reorder-and-remove only and says so. Decide deliberately and say which you chose.
3. **Nothing about either page's current contents is settled.** #26 and #27 were added on
   2026-08-21 as a tactical call, not a ruling.

## What must move into the save path

`tests/unit/pitch-slide-library.test.ts` is the list. Today a build failure catches these; once a
deck is a row, **the save button must refuse and say why**:

- a pull is a subset of its deck, **in deck order**
- no slide appears twice on a page
- **no plan, tier, price or subscription anywhere** — slide copy AND page copy (owner ruling
  2026-08-21; the pattern is in the test)
- a drawing carries non-empty alt and caption
- at most two callout rings per slide
- **a deck may name only a `planned` number** — never a `held` or `retired` one
  (`SLIDE_NUMBERS_SPOKEN_FOR`)

⚠ **The page's own furniture must compute itself** (finding F3): the "N problems · 90 seconds"
line already counts panels via a test — once composition is data, that test cannot see a reorder,
so the number must be derived. The SEO description names each panel in order and would rot
silently; derive it or make editing it part of the same save.

## ⚠ Things stage A learned the hard way — do not re-pay for these

- **A surface must not claim more than it checks.** Stage A shipped saying twelve slides were
  "reachable nowhere". It was false — `WalkthroughPresent`'s trigger is unconditional in each
  walkthrough hero and renders the whole deck. **The screen built to police false claims made
  one.** Verify a claim against what the code does before you render it.
- **Age is not freshness.** Pictures now carry a capture date. It answers WHEN, never WHETHER the
  picture still matches the screen. Do not let any new surface present it as a staleness check.
- **A "re-take picture" button is impossible** — it drives a real browser and writes to the repo.
  Proposed once, walked back. Do not propose it again.
- **Two same-shaped maps over one key space want a status field** — that is why there is one
  slide-number register, not two.
- **Render the screen and look at it.** Log in as `growth@dev.local` / `devpass123` (a
  `seed-platform-staff.mjs` account). ⚠ The login form needs ~3s to hydrate or the submit posts an
  empty form and reports bad credentials. Platform-admin content sits in a scroll container, so
  `fullPage` screenshots and `window.scrollTo` do nothing useful and lazy images below the fold
  read as broken — scroll each into view first.
- **Backslashes do not survive shell heredocs reliably here.** Use the Edit tool for any edit
  containing `\` or `${`.

## Hard rules carried in

- ⚠⚠ **DECKS ARE DATA, SLIDES ARE CODE** (ruling 1). Composition becomes editable; a slide's
  words and picture never do. The owner declined an edit-with-review-queue option. **Do not add an
  edit affordance for slide copy.**
- **Plain `<img>` / inline markup, never `next/image`** — it would be the repo's first request-time
  sharp caller on Amplify, a recorded outage class.
- Read `AGENTS.md` before writing code — this is not the Next.js in your training data.
- **Do not restart the shared dev server casually**; other sessions use it.

## Product Manager UX plan first

`AGENCY_RULES.md` makes this blocking: present a plain-language summary of what the owner sees and
does differently **before** any code.

## Wire up

Plan + PM brief · Owner QA §-row (next free — **never renumber**) · `TODO.md` pointer · both memory
stores. Then `/simplify` → `/review` → `npm run verify:changed`.

⚠ `npx next typegen` before `npm run typecheck`. Schema parity may be RED from other sessions'
dev-only migrations — confirm it is not yours, then run the post-parity checks individually.

## Commit

Explicit pathspecs only. **⚠ Several sessions work in this tree.** Check `git status` before
staging and **filter foreign hunks out of shared documents** (`TODO.md`, the QA ledger,
`memory/MEMORY.md`) rather than sweeping another session's work in — the technique that works is to
stage `HEAD`'s copy plus only your own change, then restore the working file. `git show --stat HEAD`
after. Commit only on explicit owner OK.
