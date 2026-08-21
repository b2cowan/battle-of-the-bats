# Pitch Deck Studio (platform-admin → Growth)

**Plans:** `docs/projects/active/PITCH_DECK_STUDIO_PLAN.md` + `_PM_BRIEF.md` · parent
`PITCH_SLIDE_LIBRARY_PLAN.md` · **Stage A shipped dev 2026-08-21 (QA §72 owed) · Stage B shipped
dev 2026-08-21 (QA §76 owed; mig 257 dev-only) · Stages C+D shipped dev 2026-08-21 (QA §77+§78
owed; mig 258 dev-only).** Project fully built; club slides #18–#20 remain unbuilt artwork.

## What exists

`/platform-admin/pitch-deck-studio` — the library view (stage A) **plus the pull editor (stage
B) plus the deck composer (stage C) and owner decks with unlisted links (stage D)**: each deck
card edits WHICH slides its public walkthrough page shows (checkboxes over the deck; order
always follows the deck), previews the derived meta line + SEO description, and saves through
`/api/platform-admin/pitch-deck-studio/pull` into `pitch_page_pulls` (service-role-only,
audit-logged, `pitch_deck_studio` write roles). Every pitch slide with its
picture (rendered through the public page's own `SlideStage`, rings and all), its pain and claim,
every running order that names it (a LIST since stage C), which public page publishes it, and its
picture's condition. Plus both decks with running orders (public pull lit), a totals strip, and
the gaps in the number line.

## ⚠⚠ Stage C+D — the load-bearing facts

- **Decks are rows** (`pitch_decks`, mig 258): standing decks persona-keyed with the code
  `PITCH_DECKS` as fallback (fallbackPull discipline); owner-created decks (club, prospect) have
  **no fallback** — broken = does not render, the studio says why, `/pitch/<slug>` 404s.
- **Reordering a deck re-orders the live page MECHANICALLY** — `resolvePullIds(persona, stored,
  deck)` takes the LIVE deck (required param, not defaulted) and normalises saved AND fallback
  pulls against it; one guard-tested exception: a deck row that would EMPTY the page loses to
  the raw code pull ("never blank" outranks "always a subset").
- **`deckProblems()` is the deck rulebook** (one function, save API + guard test): refuses
  empty/dupes/retired/unknown, refuses `held` BY NAME (whose it is), allows `planned`, checks
  PLAN_WORDS in the deck's NAME and PURPOSE too (internal text, checked anyway). ⚠ Deliberately
  does NOT refuse cross-audience mixing — the club deck is the counter-example, ruling 4 makes
  placement a dial.
- **#18–#20 stay `held`, NOT flipped to planned** — the club deck being creatable doesn't
  commission artwork; flip is a one-line code change when the slides are agreed.
- **The prospect page renders NOTHING per-prospect by construction** — the deck's name (the
  prospect label) never reaches `ProspectDeckPage` as a prop. Fixed code copy + slides
  (`pageAnswer` — the prospect is alone) only; closing is the invitation, never "not a mockup"
  (drawings would falsify it). `noindex`, outside the proxy matcher, `share_slug` = 18 crypto
  bytes minted at creation; **deleting the deck IS the link revoke**. PDF = the link printed
  (imports WalkthroughPage.module.css — its `@media print` IS the leave-behind).
- **`AUDIENCE_LABEL` moved to lib/walkthrough-content.ts** (deck save API writes standing rows'
  names from it); `getWalkthroughPull` → `getWalkthroughRender` in lib/pitch-deck-store.ts
  (deck resolved first, pull against it); composer preview = server-rendered `SlideStage` nodes
  passed as props to the client (client never imports the library).
- Verified by Playwright driving the real buttons: reorder → publish → the public page's first
  panel changed; revert restored; create/link/noindex/no-name-leak/delete-404 all walked.

## ⚠⚠ Stage B — the load-bearing facts

- **The pages can never go blank.** The walkthrough routes are `force-dynamic` and read the saved
  row via `lib/pitch-pull-store.ts` (1.5s abort timeout); `resolvePullIds()` is the LENIENT
  read-side — drops rot, normalises to deck order, falls back to the code `fallbackPull` when
  nothing usable remains. The studio shows what was dropped; the page never does.
- **One rulebook, two callers:** `pullProblems()` (lib/walkthrough-content.ts) is the save path's
  whole law AND what the guard test runs over the code fallbacks — subset, deck order, no dupes,
  no spent numbers (status-aware refusals: held says whose), plan-words re-check. Shot-health
  pattern; do not fork it.
- **F4 CLOSED — page copy lives ON the slide.** `pageAnswer` + `seoPhrase` are REQUIRED fields on
  every slide (compile-enforced); `WalkthroughPanel` is deleted. The ten missing answers were
  written 08-21, each verified against feature code first — ⚠ two truth traps for future copy:
  the lineup "sitting too long" flag is PER-GAME only, and family connection is the FOLLOWER tier
  (guardian tier env-gated OFF — never promise a parent portal).
- **The furniture derives itself** (`derivedMeta`, `derivedSeoDescription`) and the derived
  description is **byte-identical** to the hand-written ones it replaced (verified in-session).
- **The pull editor has NO order control on purpose** — deck order is the invariant, so the UI
  cannot express breaking it. Reordering the DECK is stage C's problem.
- **DELETE = "return to the code default"** — forgets the row, so future `fallbackPull` code
  changes reach the page again; different from saving a matching list.

## ⚠⚠ THE THREE THINGS A FUTURE SESSION WILL GET WRONG

**1. DO NOT ADD AN EDIT AFFORDANCE.** Owner ruling 2026-08-21: **decks are data, slides are CODE.**
Composition becomes editable in stage B; a slide's words and picture never do. The owner
was offered edit-with-review-queue and declined it. The reason is not preciousness — a build check
compares each claim against what the plans grant (that check caught nineteen persona-page overclaims,
one advertised on six surfaces for a capability we do not have), and **nothing watches a sentence
once it is a row in a table.** The same copy feeds the in-app upgrade panels, so an overclaim reaches
paying customers.

**2. THE PICTURE COLUMN IS DECLARATION HEALTH, NOT FRESHNESS — and saying so is the feature.**
`lib/shot-health.ts` (shared with `scripts/lib/shot-capture.mjs --check`) proves a file exists with
its alt, caption and size recorded. It cannot prove the picture still resembles the screen: **a
failed re-capture leaves the previous PNG in place**, so a three-month-stale photograph passes it and
passes CI. Every capture card renders `PICTURE_FRESHNESS_IS_UNCHECKED` instead of a tick. **The PM
brief's success criterion 4 is therefore NOT met and cannot be met this way** — closing it needs a
re-capture-and-compare. Do not mark it met by adding a tick.

**⚠ 2b. EVERY PICTURE CARRIES ITS CAPTURE DATE, AND IT IS NOT THE FRESHNESS CHECK** (owner
Decision 2 / Option B, 2026-08-21). The capture stamps the day it ran (org zone, never the
server’s); the fourteen existing ones were backfilled from git history; the studio shows each
age plus an "oldest picture" tile. **Age answers WHEN, never WHETHER** — the screen prints it
directly above the "nothing checks whether this still looks like the screen" sentence, and that
adjacency is the design. ⚠ **A "re-take" button is IMPOSSIBLE** (it drives a real browser and
writes to the repo — a dev command, not a deployed page’s); proposed and walked back. ⚠ **No
threshold and no colour on the age**: everything is days old, so an invented cutoff reads green
for months and trains the eye past it.

**3. A DRAWING HAS NO MANIFEST ENTRY, so it is neither passed nor failed.** Nearly half the library is
hand-drawn inline SVG — nearly half the screen. Four vacuous passes wearing a tick would be worse
than nothing, so the card says it in words.

## ⚠⚠ THE PLAN-LINE COLUMN WAS BUILT AND DELETED THE SAME DAY

The build prompt called it the highest-value column on this screen, and it was — it resolved each
page panel’s plan line against `lib/plan-config.ts`. **A concurrent owner ruling deleted `planTag`
from `WalkthroughPanel` entirely** (*"we don’t need to mention any subscriptions here… we don’t
want to compartmentalize features at this stage"*), taking all nine plan lines off the walkthrough
pages. The column had no producer left, so it and `lib/pitch-plan-line.ts` were **deleted, not
patched.** Do not build it back.

The rule that replaced it is a BUILD CHECK in `tests/unit/pitch-slide-library.test.ts`: no plan,
tier or price appears anywhere in the pitch material. **That is the better home — a check fails on
its own; a column only helps someone who happens to be looking at it.**

⚠ The trap it guarded, in case any future surface resolves a plan name out of prose:
`'Tournament'` is a prefix of `'Tournament Plus'` and `'Club'` of `'Club · Association'`, so a
naive scan reports correct copy as an overclaim. **A column that cries wolf once stops being read.**

## What the screen found

- **TWELVE slides sit outside both pages’ pulls**, not the five both plans say (that count predates
  P2b/P2c). Library 23 — coach 15, tournament 8; the pages pull 6 and 5. Nine coach (#26 #02 #04
  #05 #06 #07 #21 #22 #23) + three tournament (#27 #16 #17). Computed on screen, so it cannot go
  stale again.
- **⚠⚠ The first version of this screen said "reachable nowhere" and that was FALSE.** The
  "▸ Present the full deck" button is unconditional in each walkthrough page’s hero and renders the
  whole DECK (since P2b), so any visitor is one click from every slide. The real gap is narrower and
  still worth a screen: **the reader who only scrolls never meets them.** A surface making a false
  claim about itself is precisely the failure this project exists to stop — recorded, not quietly
  fixed. The badge now reads "Slideshow only".
- Before the plan-line column was removed it caught that **the six coach panels advertised the
  Premium Coaches Portal, whose `gatingStatus` is `early_access`** — not open for self-serve
  checkout. Moot for the walkthrough now; the same wording exists on other surfaces.

## The number line is ONE register

`SLIDE_NUMBERS_SPOKEN_FOR` (`planned` | `held` | `retired`) in `lib/walkthrough-content.ts`.
⚠ It was briefly two registers — `PLANNED_SLIDES` plus a new `RESERVED_SLIDE_NUMBERS` — two
same-shaped maps over the same key space, ten lines apart, both describing #18–#20, kept apart only
by a test assertion reading *"pick one register"*. **Two same-shaped maps over one key space want a
status field.** Merging also let the report distinguish a deck naming a HELD number ("that is the
club deck’s") from one naming a number that never existed — two maps could only render both as the
same bare cross.
## Verified by looking at it

Logged in as `growth@dev.local` / `devpass123` (a `seed-platform-staff.mjs` account, role=growth) and
photographed the rendered page — 23 cards, 12 stranded badges, 13 pictures loading, no console
errors, no horizontal overflow. ⚠ The `UAT_PLATFORM_ADMIN_*` credentials in `.env.local` DO
authenticate against Supabase directly, but the login form must be given ~3s to hydrate or the
submit posts an empty form and reports "check your credentials".
