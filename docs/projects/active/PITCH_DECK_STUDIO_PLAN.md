# Pitch Deck Studio — Plan

**Status:** APPROVED 2026-08-21 (owner, in session — three rulings recorded below). **STAGE A SHIPPED
2026-08-21 (dev) — owner QA §72 owed. STAGE B SHIPPED 2026-08-21 (dev) — owner QA §76 owed; mig 257
dev-only until the next release. STAGES C + D SHIPPED 2026-08-21 (dev) — owner QA §77 (composer) +
§78 (prospect decks) owed; mig 258 dev-only with 257.**
**PM brief:** [PITCH_DECK_STUDIO_PM_BRIEF.md](PITCH_DECK_STUDIO_PM_BRIEF.md)
**Parent project:** [PITCH_SLIDE_LIBRARY_PLAN.md](PITCH_SLIDE_LIBRARY_PLAN.md) — this is the
"deck assembly in platform-admin" item that plan parked as *"later, and only if it earns it… build
once there is a library worth assembling from and evidence that per-prospect decks are a real
workflow rather than a nice idea."* **Both conditions are now met**: sixteen slides are built (all
twenty-one once P2b lands), and the owner asked for per-prospect decks unprompted.

**⚠ This project ABSORBS P3 of the parent plan** (the contact sheet + the staleness check). Do not
build P3 separately — the contact sheet *is* this project's library view, and the staleness check is
a column on it. The parent plan's phase list should be updated to say so.

## What this is

A room in platform-admin (**Growth** group, beside Early Access and Email Campaigns — it is
company-owned material aimed at people who are not customers yet) where the owner can:

- see **every slide in the library** — its picture, its words, which decks use it, and whether its
  picture has gone stale;
- see **every deck** — its audience or purpose, its running order, how many slides it holds, and
  where it is published;
- **compose**: add, remove and reorder slides in a deck, including the short pull each public
  walkthrough page shows;
- **build a deck for one prospect** and hand it over as a private link or a PDF.

## ⚠⚠ RULING 4 — THE GOAL IS A LIBRARY YOU COMPOSE FROM, NOT A SET OF PLACEMENT DECISIONS

**Owner, 2026-08-21, and it re-frames the whole project:** *"the whole point of this exercise is
when we are done I have a library of slides that I can choose what to do with on the marketing
pages, pitch decks, etc., and these decisions can change over time. So we don’t need ‘official’
decisions on what slides go where on the site yet — I would like to see the completed library and
have it allow me to select these choices and change over time."*

**What this settles, and it is not a small thing:**

- **Stop asking which slides belong where.** Placement is not an editorial ruling to be made once
  and recorded; it is a dial the owner turns. A session that presents a slide-placement question as
  a decision needing sign-off is asking the wrong question — the answer is always "make it
  selectable".
- **⚠⚠ THIS PROMOTES THE PAGE-COPY PASS FROM STAGE C TO A PREREQUISITE.** Finding F4 says a slide
  cannot go on a page without the long unattended `answer` a deck does not need. While placement
  was a rare deliberate act, writing that copy per-slide-as-needed was fine. **The moment the owner
  expects to shuffle freely, every slide needs its page copy or the composer offers choices that
  fail** — a picker where two thirds of the options cannot actually be picked is worse than no
  picker. Write it for the whole library before, or with, the composer.
- **It raises the priority of B and C and lowers the weight of any one placement.** The two slides
  added to the pulls on 2026-08-21 (#26, #27) were the owner accepting a tactical recommendation,
  **not** a standing ruling about what those pages contain. Do not treat either page’s current
  contents as settled — they are the current setting of a dial.

---
## The owner's three rulings (2026-08-21, binding)

### 1. ⚠⚠ DECKS ARE DATA. SLIDES ARE CODE. THIS IS THE LOAD-BEARING LINE.

Composition — *which slides, in what order, for what audience* — becomes owner-editable data.
**A slide's headline, claim, picture and plan line stay in code and are never editable in the
browser.**

The reason is not preciousness, and it must not be re-litigated by a future session looking at a
read-only field and deciding to "finish" the CRUD:

> A build check compares each slide's claim against what the plan configuration actually grants
> and against the screen it pictures. That check is why the 2026-08-20 persona-page audit caught
> nineteen overclaims — including one capability promised on six surfaces that the product cannot
> do at all. **Nothing watches a sentence once it is a row in a table.** The same copy also feeds
> the in-app upgrade panels, so a marketing overclaim is shown to paying customers.

Composition, by contrast, has **no truth content**. Any order of true slides is true. That is
exactly the half that should not need a developer at 11pm.

The owner was offered a middle option (edit the words in the tool, queue the change until it passes
the check) and **declined it** in favour of the clean split. A copy change stays a one-line code
edit made in chat. ⚠ If that ever becomes the bottleneck, the queue is the design to revisit —
**not** a plain editable textbox.

### 2. A prospect deck ships as a PRIVATE LINK **and** a PDF.

Both render from the same deck, so they can never disagree. The link is **unlisted, not
authenticated** — anyone holding it can open it. Accepted knowingly: it is marketing material, it
carries no customer data, and a prospect on a call cannot be asked to sign in. ⚠ It must therefore
never be able to name a real organization, and it is `noindex`.

### 3. Sequenced AFTER the parent project's P2b (the five hand-drawn explainers).

So the studio opens onto a finished library rather than a visibly half-built one. ⚠ P2b carries one
small piece of this project's groundwork — see "What P2b must land first" below.

## ⚠ Findings from the CODE that shape this, not from the plan

Every one of these was checked against what the code does. They are the difference between a tool
that works and a tool that quietly publishes a false page.

### F1 — NOTHING RENDERS A DECK TODAY. The deck is a list nobody reads.

`deckSlides()` has exactly one caller: the guard test. `WalkthroughPage` builds both its scroll
panels *and* present mode from `w.panels` — the page's short **pull**. A code comment in
`lib/walkthrough-content.ts` states the opposite (*"present mode and the printed leave-behind both
render every built slide already"*) and **is false**.

**Consequence, and it is the reason this project is worth doing at all:** the coach deck holds
eleven built slides and six are reachable. Playing time, awards, player development, the
fundraising credit and the lineup board were photographed in P2a, sit in the manifest, and cannot
be seen anywhere in the product. **Five finished slides with no audience.** Fix the comment when
this is built.

### F2 — ✅ CLOSED 2026-08-21, AND NOT THE WAY THIS PLAN FIRST PROPOSED. Do not build the fix.

**The finding was real:** both walkthroughs closed with *"Every picture above is the real
FieldLogicHQ software, photographed on a live demo we operate ourselves — not a mockup."* The moment
composition is owner-editable, dropping an **explainer** into a page makes that paragraph false, at
11pm, with nothing in the build able to see it.

**This plan originally proposed DERIVING the sentence** from what was in the pull — all-photographs
gets one wording, a pull containing a drawing gets another. ⚠ **The owner's answer was simpler and
better: remove the claim entirely** (2026-08-21, the same session that replaced the picture rule —
see `memory/design_decisions.md`). It turned out to be **ten sentences across four pages**, not one,
and all ten are gone. What replaces them points at the demo instead, which is an invitation rather
than a denial and **stays true whatever the pictures are**.

**So there is no derived-closing machinery to build**, and a future session must not add it —
there is no longer a sentence for composition to falsify. The general rule this finding produced
still stands and is the real content of F3 below: **anything a page asserts about its own contents
must be derived or must not be asserted.**

### F3 — The page's own furniture is hand-typed and build-checked, and goes stale the instant composition becomes data.

Two things break:

- **The meta line** (`"6 problems · 90 seconds · nothing to install"`) is typed, and
  `tests/unit/pitch-slide-library.test.ts` asserts the number matches the panel count. A reorder in
  the tool advertises six problems on a five-problem page and **no test can see it**. → the count
  must compute itself.
- **The SEO description** is written to name each panel in order (deliberately widened in P2a when
  the coach pull grew from two to six). It cannot be asserted the same way and would rot silently.
  → it must be generated from the slides shown, or the studio must make editing it part of the same
  save.

**The general rule this establishes:** every invariant the build check currently enforces has to
move into the SAVE PATH. The tool refuses an invalid deck and says why; it does not save one and
hope a test catches it. Today's assertions to relocate — a pull is a subset of its deck **in deck
order**, no slide appears twice, no slide names a plan, an explainer never claims a real capture,
and at most two rings per slide.

### F4 — A slide is not page-ready. It is missing two things, and one of them is the risky one.

A public page panel carries two fields the slide deliberately does not:

- the **long answer** — the unattended version, with the qualifications and "your call" clauses a
  deck doesn't need because a human is in the room;
- the **plan line**, where the pictured feature is gated.

Both are hand-written per page, per panel. So as things stand the owner could only add a slide that
already happens to have them — i.e. one already on that page. **The tool is not self-serve until
every slide in the library carries its own page copy.** That is a one-time editorial pass over
sixteen slides (twenty-one after P2b), and it belongs in this project.

⚠ **The plan line is the riskiest field in the entire system to let anyone move around freely** —
it is exactly the class of mistake the persona audit found. It stays welded to the slide in code,
where the check can verify it against the live plan configuration. Verified examples that must not
be lost in the move: copying a tournament forward is **Tournament Plus** (#17); team
self-registration and waitlist collection are **base tournament plan**, so #16 needs **no** plan
line at all.

### F5 — A deck stored as data references PERMANENT slide numbers, and a number can retire.

`#08` is already retired; `#18`–`#20` are held. The bank's key set is a compile-time literal today,
so a page naming a slide that does not exist is a **compile error**. Once decks are rows, that
becomes a runtime hole: a retired slide silently vanishes from a deck the owner believes is six
slides long. The library view must show a deck naming a missing slide as a visible problem, and the
save path must refuse to create one.

## What P2b must land first

Two things, both small, both needed by this project:

1. **The picture frame learns to hold a drawing.** Today a slide with no photograph renders with no
   picture at all — the renderer resolves a picture only through the screenshot manifest. The
   studio would otherwise show five blank stages.
2. **Present mode renders the whole DECK rather than the page's pull** (the F1 fix). It is the deck
   rendering already in every respect but its input, and it is what this project previews into.

## Phases

### A — ✅ SHIPPED dev 2026-08-21. The library view (read-only). Absorbs parent P3's contact sheet.

Every slide on one page: picture, pain, claim, image class, which decks name it, and **staleness** —
when its picture was last taken, whether the screen it pictures still exists, and whether its plan
line still matches the plan configuration. Plus every deck, its purpose, its count and where it is
published. **No editing.** This alone answers "what do we have?" and is the cheapest useful thing.

#### ⚠ What stage A actually settled — read before planning B

**1. ⚠⚠ IT IS TWELVE STRANDED SLIDES, NOT FIVE — F1's count above is stale and must not be
re-quoted.** F1 was written when the coach deck held eleven built slides. After P2b and P2c the
library is 23 (coach 15, tournament 8) and the two public pages pull 6 and 5. **Twelve built,
checked slides are shown on no public page** — NINE coach (#26, #02, #04, #05, #06, #07, #21, #22,
#23) and THREE tournament (#27, #16, #17). Present mode reaches them; no visitor does. The number is
computed on the screen, so it cannot go stale again.

**2. ⚠⚠ THE PM BRIEF'S SUCCESS CRITERION 4 IS NOT MET, AND THE PLANNED APPROACH COULD NEVER MEET
IT.** *"When a slide's pictured screen changes, the library view says so before a prospect finds
out."* The plan said to reuse the existing picture check. That check proves a file exists with its
alt, caption and size recorded — **it says nothing about whether the picture still resembles the
screen.** `lib/marketing-shots.ts` states the mechanism in its own header: a failed re-capture
LEAVES THE PREVIOUS PNG IN PLACE, so a three-month-stale photograph passes it and passes CI.

Stage A therefore **renders the gap rather than a tick**: every capture card carries the sentence
in `PICTURE_FRESHNESS_IS_UNCHECKED`. Closing it for real needs a **re-capture-and-compare** (take
the shot again, diff it, fail on drift) — a separate piece of work, not a column. **Do not mark
criterion 4 met by adding a tick.**

**3. The picture check now has ONE implementation** (`lib/shot-health.ts`), read by both
`scripts/lib/shot-capture.mjs --check` and the studio. The capture core imports Playwright at module
scope, so the studio could not have called it directly — copying the four rules was the alternative
and would have diverged.

**4. THE PLAN-LINE COLUMN WAS BUILT, THEN DELETED THE SAME DAY — AND ITS ABSENCE IS NOW THE RULE.
Do not build it back.** The build prompt called it the highest-value column on the screen, and it
was: it resolved each page panel’s plan line against `lib/plan-config.ts`. **A concurrent owner
ruling removed `planTag` from `WalkthroughPanel` entirely** — *"we don’t need to mention any
subscriptions here… we don’t want to compartmentalize features at this stage, we want to show people
all we have to offer and how we will improve their lives, period"* — deleting all nine plan lines
from the two walkthrough pages. With no producer left, the column, `lib/pitch-plan-line.ts` and its
test were permanently dead code and were removed rather than patched.

The division of labour is now by SURFACE: **the walkthrough creates desire, the pricing page
qualifies, a human answers in the room.** The invariant that replaced the column — *no plan, tier or
price appears anywhere in the pitch material* — lives in `tests/unit/pitch-slide-library.test.ts`,
which is the better home: **a build check fails on its own; a column only helps someone who happens
to be looking at it.**

⚠ One thing the column surfaced before it went: the six coach panels advertised the **Premium
Coaches Portal**, whose `gatingStatus` is `early_access` — not open for self-serve checkout. Moot
for the walkthrough now; the same wording exists on other surfaces.

⚠ And the trap it guarded, recorded in case any future surface resolves a plan name out of prose:
**"Tournament" is a prefix of "Tournament Plus"** and "Club" of "Club · Association", so a naive
scan reports correct copy as an overclaim — and **a column that cries wolf once stops being read.**
Match longest-label-first.

**⚠4a. EVERY PICTURE NOW CARRIES ITS CAPTURE DATE — and that is NOT the staleness check.**
Owner Decision 2, Option B (2026-08-21). The capture stamps the day it ran, in the org zone; the
fourteen existing pictures were backfilled from git history; the studio shows each one’s age and
the library’s worst case in a tile.

⚠⚠ **SUCCESS CRITERION 4 IS STILL NOT MET AND THIS DOES NOT MEET IT.** Age answers WHEN, never
WHETHER the picture still resembles the screen. The screen says so directly beneath the date. The
real answer is still a re-capture-and-compare, still unbuilt, still the owner’s call.

⚠ **A "re-take" BUTTON WAS PROPOSED AND IS IMPOSSIBLE — do not try again.** Re-photographing
drives a browser through the live demo world and writes files back into the repo: a developer
command, not something a deployed admin page can do. Re-taking stays a chat request, like a
wording change.

⚠ **No threshold, no colour on the age.** Every picture is days old, so an invented cutoff would
read green for months and train the eye past it. The worst case as a real number stays useful
from day one.

**5. The gaps in the number line are ONE register with a status** (`SLIDE_NUMBERS_SPOKEN_FOR` in
`lib/walkthrough-content.ts`: `planned` | `held` | `retired`), with a guard test asserting a
spoken-for number is never also built and that **only a `planned` number may be named by a deck.**
That is F5’s read-only half. The write half — a save path refusing to create a deck that names a
missing number — is still stage B’s.

⚠ It was briefly TWO registers (`PLANNED_SLIDES` plus a new `RESERVED_SLIDE_NUMBERS`) and the
cleanup pass caught it: two same-shaped maps over the same key space, ten lines apart, both
describing #18–#20, kept from overlapping only by a test assertion reading *"pick one register"*.
Merging them also bought the report something two maps could not — **a deck naming a HELD number now
says whose it is, instead of rendering the same bare cross as a number that never existed.**
**6. F1's false comment is gone** — P2b already fixed present mode to render the whole deck, and
both files now describe what the code does.

### B — ✅ SHIPPED dev 2026-08-21 (owner QA §76). The pulls become rows, and the pages stop being able to lie.

The two public pulls live in `pitch_page_pulls` (mig 257, service-role only); the pages read them
per request (`lib/pitch-pull-store.ts`, `force-dynamic`, 1.5s timeout) with the code
`fallbackPull` as the safety net, so a missing, malformed, slow or rotten row can never render an
empty marketing page. The meta line and SEO description derive themselves; every invariant moved
into the save path. The studio's deck cards gained the pull editor (checkboxes + derived preview +
refusal sentences), gated by `pitch_deck_studio` write roles and audit-logged.

#### ⚠ What stage B actually settled — read before planning C

**1. ⚠⚠ THE PAGE-COPY PASS IS DONE, AND IT LIVES ON THE SLIDE.** Ruling 4's fork ("write the
missing copy, or ship an honestly limited picker") was decided for writing the copy: every slide
now carries a REQUIRED `pageAnswer` (the long unattended answer) and `seoPhrase` (what the derived
description calls it) — the ten missing answers were written this session, each verified against
the feature's code first (the verification notes sit beside each one in
`lib/walkthrough-content.ts`). **F4 is CLOSED**; `WalkthroughPanel` is gone; stage C's composer
inherits a library where every slide is page-ready. Two truth traps met on the way, recorded so C
does not re-trip them: the lineup board's "sitting too long" flag is PER-GAME (never a season
judgment), and the family connection is the FOLLOWER tier only — the guardian tier is env-gated
off, so no sentence may promise a parent portal.

**2. THE PULL HAS NO ORDER CONTROL, ON PURPOSE.** A pull renders in deck order (the standing
invariant), so the editor is checkboxes over the deck — the invariant an owner could most easily
break is one the UI cannot express breaking. Reordering the DECK is C's composer, which will need
its own answer to this.

**3. ONE RULEBOOK, TWO CALLERS.** `pullProblems()` in `lib/walkthrough-content.ts` is the whole
save-path law (subset, deck order, no dupes, no spent numbers, plan-words re-check), and the guard
test runs THE SAME FUNCTION over the code fallbacks — the shot-health pattern. The lenient
read-side twin is `resolvePullIds()` (drop rot, normalise order, fall back when nothing usable
remains); the studio shows what it dropped, the page never does.

**4. THE DERIVED DESCRIPTION IS BYTE-IDENTICAL to the hand-written ones it replaced** for today's
fallback pulls (verified in-session, character for character) — the phrases ARE the old words,
extracted per-slide. SEO continuity paid nothing for the derivation.

**5. `force-dynamic`, not ISR.** The repo has no ISR/cache-tag convention (checked); every
DB-backed page here is per-request. One keyed single-row read with an abort timeout was chosen
over inventing a caching layer — and it also means a save is live on the very next request, with
no build baking a composition in.

### C — ✅ SHIPPED dev 2026-08-21 (owner QA §77). The composer.

The deck's running order, name and purpose become rows (`pitch_decks`, mig 258 — service-role
only, mig 251 posture): the two standing decks are persona-keyed rows with the code `PITCH_DECKS`
as fallback (`fallbackPull`'s exact discipline), owner-created decks (the club deck, prospects)
have no fallback — broken means "does not render", and the studio says why. Reorder is up/down
buttons (drag ghosts fight platform-admin's scroll container; buttons are keyboard-free), add is
a picker over every built slide, and the live preview renders the selected slide through the
page's own `SlideStage` — server-rendered nodes handed to the client, so the composer cannot
frame a slide differently from the page.

#### ⚠ What stage C actually settled — read before touching this layer

**1. REORDERING A DECK RE-ORDERS THE LIVE PAGE, MECHANICALLY.** `resolvePullIds` takes the LIVE
deck as a parameter now; the pull (saved OR code fallback) normalises against it, so decision 1
is held by code rather than convention. The composer states it above its Publish button and asks
nothing. One deliberate exception, guard-tested: a deck row so degenerate it would EMPTY the
page loses to the raw code pull — "never blank" outranks "always a subset".

**2. `pullProblems` AND `resolvePullIds` GAINED A REQUIRED DECK PARAMETER** — required rather
than defaulted so no caller can silently validate against yesterday's deck. The guard test
passes `PITCH_DECKS[persona]` (the fallbacks are the composition of record against the CODE
decks); the save APIs pass the resolved live deck.

**3. A DECK IS NOT HELD TO ONE AUDIENCE, on purpose.** The club deck is the standing
counter-example (Club = tournament + coach + three of its own), and ruling 4 makes placement a
dial — `deckProblems` refuses spent/held/unknown numbers, dupes, emptiness and plan words (in
the deck's NAME and PURPOSE too — internal text, checked anyway), and deliberately not
cross-audience mixing. The "never reused across decks" guard-test assertion still holds the CODE
fallbacks disjoint.

**4. #18–#20 STAY `held`, AND THE COMPOSER REFUSES THEM BY NAME.** The club deck being creatable
did NOT flip them to `planned` — `held` means no deck may name the number, and flipping early
would let any deck claim artwork nobody has commissioned. The flip is a one-line code change
made when the three club slides are actually agreed. The register notes say so.

**5. THE STANDING DECKS' DISPLAY NAMES MOVED TO `AUDIENCE_LABEL` in lib/walkthrough-content.ts**
(one home; the save API writes a standing row's `name` from it rather than accepting one), and a
slide's studio placement is a LIST now — one slide can sit in several running orders.

### D — ✅ SHIPPED dev 2026-08-21 (owner QA §78). Prospect decks: the private link and the PDF.

Every owner-created deck mints an unguessable `share_slug` at birth (18 crypto bytes →
base64url); `/pitch/<slug>` renders it through the walkthrough page's own frame — `noindex`,
`force-dynamic`, outside the proxy matcher (no session work), STRICT 404 on any kind of nothing
(no fallback for owner decks). The page renders slides (`pageAnswer` — the prospect opens the
link alone) and FIXED code copy only: the deck's name is the prospect label and never reaches
the component, so ruling 2 holds by construction. Its closing is the invitation, not the
"not a mockup" denial — pre-empting the F2 mistake on a page that will usually hold drawings.
The PDF is the link printed: the component imports WalkthroughPage.module.css, whose
`@media print` layout IS the leave-behind. Deleting a deck kills its link — that is the revoke.
No analytics (out of scope by plan).

## Risks

- **A marketing page gains a runtime data dependency.** Mitigated by the code-deck fallback and
  caching — the page must render correctly even if the store is unreachable.
- **The owner composing with nothing watching.** This is the whole point of F2 and F3: the checks
  move to the save path rather than disappearing.
- **The unlisted link is readable by anyone holding it.** Accepted by the owner; contains no
  customer data; must never name a real organization.
- **Scope creep toward editing slide copy.** Ruling 1 is binding. A future session that finds a
  read-only field and "completes" the form is the failure mode to guard against — hence this
  document says why, not just what.

## Explicitly NOT in scope

Editing a slide's words or picture in the browser (owner ruling 1) · per-organization or
customer-facing decks · a WYSIWYG slide editor · analytics on prospect-link opens (a reasonable
follow-up, but not a reason to delay the tool).
