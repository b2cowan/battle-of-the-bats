# Pitch Deck Studio (platform-admin → Growth)

**Plans:** `docs/projects/active/PITCH_DECK_STUDIO_PLAN.md` + `_PM_BRIEF.md` · parent
`PITCH_SLIDE_LIBRARY_PLAN.md` · **Stage A shipped dev 2026-08-21, owner QA §72 owed.** B/C/D not
started.

## What exists

`/platform-admin/pitch-deck-studio` — **the library view, READ-ONLY.** Every pitch slide with its
picture (rendered through the public page's own `SlideStage`, rings and all), its pain and claim,
which deck names it and at what position, which public page publishes it, its picture's condition,
its plan line checked against the live plan configuration, and whether it has page copy. Plus both
decks with running orders (public pull lit), a totals strip, and the gaps in the number line.

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
