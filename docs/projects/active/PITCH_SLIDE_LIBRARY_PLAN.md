# Pitch Slide Library — Plan

**Status:** APPROVED 2026-08-20 (owner accepted the three image classes, the two deck running
orders, the slide format and the no-plan-names rule in-session). **P1 SHIPPED to dev 2026-08-20 — owner QA §67 ✅ PASSED.
P2a SHIPPED to dev 2026-08-20 — owner QA §69 owed. P2b → P3 → P4 not started.**
**PM brief:** [PITCH_SLIDE_LIBRARY_PM_BRIEF.md](PITCH_SLIDE_LIBRARY_PM_BRIEF.md)
**The library itself (owner-approved, binding spec):**
`claude.ai/code/artifact/a5dd16a5-519b-4b92-8958-d36195b9df3e` — 21 slides, two decks, in order.
**The format (owner-approved):** `claude.ai/code/artifact/b1706db6-8f65-43d1-a5c7-39ffa722300f`
**The three image classes (owner-approved):** `claude.ai/code/artifact/d0cf0ea2-35fe-4f3c-a99c-dd68c2afc793`

## What this is

The pre-sales walkthrough (`PRESALES_WALKTHROUGH_PLAN.md`) shipped two pages whose panels are
written per-page. This project turns that into a **library**: one bank of pitch slides, composed
into **decks by audience**, from which the public walkthrough pages pull a short selection.

The trigger was the owner's judgement that a slideshow rendering of the coach walkthrough was not
visually appealing. Diagnosing it produced something larger than a restyle: **a whole product
screen is not an image.** A scroll page can afford a twelve-row table because the reader can stop
and study it; a slide gets about five seconds and must land one idea. Worse, the picture showed
the tidy *after* while the headline described the messy *before*, so nothing on screen answered
the pain beside it.

## Three levels, and they are not the same thing

| Level | What it is | Size |
|---|---|---|
| **The library** | Every slide. Each keeps a permanent number so it can be tracked as the product changes underneath it. | 21 today |
| **A deck** | One audience, in a running order. | 7 tournament · 14 coach |
| **The public page** | A short pull from a deck — the 90-second version. | 2–3 |

A deck is **not** the public page and the public page is **not** the library. Conflating them is
how a fourteen-slide coach deck ends up on a marketing page nobody scrolls to the bottom of.

## Owner decisions (2026-08-20, all binding)

1. **Three image classes, roughly a handful : the bulk : a third.**
   - **Proof** — a real capture, unretouched. Carries the promise that this is genuinely our
     software. Use where proof is the job; one per deck is plenty.
   - **Composed** — the same real capture, cropped to the rows that carry the story, enlarged
     until it reads, with the point ringed. **The rings are drawn OVER the picture, never baked
     into it**, so the underlying image stays exactly what the machine took and can be re-taken
     and re-verified forever. This is the workhorse.
   - **Explainer** — an obvious illustration, for the *before* a finished screen can never show
     (the inbox, the spreadsheet and the bank statement converging on one settled line).
   - ⚠ **THE FORBIDDEN FOURTH CLASS: a drawn picture that LOOKS like our interface but isn't.**
     Prettified fake screens, invented layouts, numbers we wish the product showed. This is what
     the 2026-08-19 "no drawn/faked screenshots" ruling was actually protecting against, and it
     stands. Classes 2 and 3 do not breach it: one *is* the real software, the other never claims
     to be. **The test: could a reasonable person mistake this for a screenshot? If yes, it must
     be real.**
2. **NO PLAN OR SUBSCRIPTION NAME APPEARS ON A SLIDE.** Functionality only. This is what makes a
   slide portable — the same slide serves the coach deck and, later, the club deck untouched.
   ⚠ **The public walkthrough PAGE still carries a plan line where a feature is gated**, because
   nobody is standing there to answer "is that included?" A deck has a human in the room. The
   slide is plan-free; the *surface* decides whether to add one.
3. **Decks are per-audience.** Tournament and coach now. **The club deck inherits from both** —
   a Club customer genuinely gets the tournament product and every coach's portal — plus its own
   three held slides.
4. **The season PHASE is the picture.** Which demo team a coach slide is shot on is an editorial
   decision, not a detail. The settlement sheet photographed mid-season shows every family in
   debt and the panel argues the opposite of what it means to. The coach deck is therefore ordered
   along the **same five phases the demo world is built around**, so every slide has a team
   sitting in the right state to be photographed on.

## The format (ratified by /design 2026-08-20 — see `memory/design_decisions.md`)

One layout: a mono kicker, the pain, a second kicker, the answer, and a **single fixed 16:10
picture stage**. The picture is *contained*, never stretched — that is what lets a tall phone
capture, a wide table crop and a drawing share a deck. Body copy is set in the **sans** face;
mono at paragraph length is a large part of why the first attempt read as cramped.

**On a phone the picture leads, at full width, above the words.** Not an invention: the
2026-08-08 day-of-toolbar ruling already binds ("when a layout wraps into a stacked column,
elements take the full row"). Measured on the shipped coach walkthrough at 390px, both captures
render at **~16% scale and are illegible** — this rule is the fix, and it costs nothing on desktop.

⚠ **Flagged as a system extension:** no fixed aspect-ratio convention exists anywhere else in the
platform. Print behaviour (dark kept, one slide per page) is also now logged rather than living
only in one build's CSS.

## Architecture

- **The slide bank lives in CODE, not a database.** It is the same source the public pages already
  render from, it is reviewable in a diff, and — the part that matters — **a build check can
  compare a slide's claim against the live plan configuration.** Every plan-line mistake caught in
  review so far has been exactly that shape. Rows in a table are invisible to review and
  unverifiable by machine.
- **`lib/walkthrough-content.ts` becomes the deck composer.** Today it holds two hand-written
  panel lists. It becomes: a slide bank keyed by permanent id, plus per-audience decks that name
  slides in order, plus the short pull each public page renders.
- **`components/marketing/WalkthroughPage.tsx` already renders from data** and both routes are
  two-line shells — that extraction (P3 of the walkthrough plan, commit `4f106061`) is what makes
  this cheap. It gains the fixed stage, the phone reflow and the callout-ring overlay.
- **Captures reuse the existing pipeline** (`lib/marketing-shots.ts` + `scripts/lib/shot-capture.mjs`)
  unchanged: same demo-world-only guard, same one-door-press-per-run, same size write-back. A
  *composed* shot is an ordinary manifest entry with a tighter `clip`; the rings are page-side.
- **Explainers are hand-authored inline SVG**, committed like any other source. No image pipeline —
  they are drawings, and a drawing that needs re-taking has changed its mind about the product.

## Phases

- **P1 — the model, proved on what already ships. ✅ SHIPPED 2026-08-20 (dev), owner QA §67 PASSED.**
  Slide bank + deck composition + the format changes (fixed stage, phone reflow, rings). Both live
  walkthroughs render from the library; three of the seven captures were re-cropped from proof to
  composed. **No new artwork.**

  ### What P1 actually settled — read before planning P2

  **1. ⚠ THE PHONE DEFECT IS NOT CLOSED, AND THE FORMAT COULD NEVER HAVE CLOSED IT.** The open
  question was whether a wide capture is still unreadable at 390px once the fixed stage lands. It
  is, and the reason is arithmetic the plan had not done: **cropping ROWS reduces a picture's
  height, not its width, and the on-screen scale of a capture is set by its width.** Measured at
  390px after the build:

  | picture | before | after | why |
  |---|---|---|---|
  | Playoff bracket | 33% | **68%** | the drawing was only ~520px inside a 984px section — the rest was empty gutter |
  | Season settlement | 36% | 39% | crop trimmed height and a little chrome |
  | Player Dues | 33% | **33%** | seven rows instead of twelve is half the height and the SAME width |
  | Registration Health | 34% | 34% | untouched |

  So the bracket is fixed, and the dues table is not. **The remaining answer is the fallback the
  §66 row already named: re-capture the coach money screens at phone width** (the Money hub has a
  real phone card layout — the desktop table is behind a `duesDesktopOnly` class, so the phone
  layout is a different, genuinely legible surface). That is a P2 capture job, not a format job.
  ⚠ Do not "fix" it by widening the stage or letting the picture pan sideways: both were
  considered and both trade the format's one rhythm for a picture that is still a desktop screen.

  **2. What the format DID buy, and it is not nothing.** The pictures now read as one system at one
  size; the picture leads on a phone; a wide crop no longer wastes half a slide on empty gutter;
  and the rings mean a reader who cannot resolve the numbers can still see WHICH TWO COLUMNS the
  sentence is talking about.

  **⚠ AND ONE RULE THE OWNER CORRECTED MID-WALK, WHICH IS WORTH KEEPING STRAIGHT.** The build first
  capped EVERY picture at the size it was captured. That conflates two different things. A capture
  taken at PHONE width *is* the phone experience — enlarged on a laptop it stops looking like a
  phone and starts claiming to be a desktop app, so it must never grow. A DESKTOP capture with a
  tight crop (the bracket is 480px of bracket) misrepresents nothing by being bigger; it was simply
  cropped small, and the blunt rule was leaving it small inside a frame with room to spare. Captures
  are taken at double density, so the pixels are already there: a desktop crop now grows to fill the
  stage bounded by its own pixel count, and can never be drawn softer than 1:1. **Only the bracket
  actually moved — 480→671px, +40%, at 1.4× density.** Everything else is either a phone capture
  (capped, correctly) or already larger than the stage.

  **3. Ring geometry must mark a COLUMN, never a row.** The library artifact asked for the dues
  crop to ring "the two overdue ones". The demo's overdue families sit at rows 7 and 11 of 12 and
  move with the nightly re-anchor — a ring on a row position would start pointing at a family who
  has paid. Both rings mark a column (Balance, Status) instead, which is structural and cannot go
  stale. **This generalises: a callout marks a structural region or it is a bug waiting for a
  re-anchor.**

  **4. Two library notes the artifact got wrong, and the code won.** Slide #13's image note names
  "the three send switches" in the rain-delay dialog — that dialog has no such control, so its
  crop was left alone. Slide #15 asks to ring "the two tiles that are wrong" on Registration
  Health, but the tournament world re-anchors every two minutes and which tiles are unhealthy
  moves with it; it ships unringed.

  **5. ⚠⚠ THE CRITICAL THE REVIEW CAUGHT — "CONTAIN" IS NOT A HEIGHT CAP, AND THE OBVIOUS CSS
  SQUASHES THE PICTURE.** The fixed stage was first built as `width: 100%` + the capture's
  `aspect-ratio` + `max-height: 100%`. That does **not** contain: a definite width is not re-solved
  when a max-height clamp fires, so anything taller than 16:10 keeps its full width and loses
  height. Measured: the 350×546 Scorekeeper capture rendered **350×413**, the 560×684 rain-delay
  dialog worse — i.e. **the page was publishing distorted screenshots of our own product, on the
  project whose founding rule is that every picture is really our software.** Wide crops were
  unaffected, which is why it survived a look at the dues table. `object-fit: contain` is NOT the
  fix either: it would letterbox the image inside a box that is still the wrong shape, and the
  rings are positioned against that box, so they would drift off the picture. **The fix is to spend
  every limit on the WIDTH** — the picture's width is the smallest of the column, the capture's own
  width, and the height budget converted through its ratio — so no clamp ever fires. Now measured
  rather than asserted: 7 pictures × 4 viewport widths × 2 pages + print, all within 0.4% of true.

  **6. Three more the review closed.** The composed crop silently **clamped** a union taller than
  the capture viewport instead of failing (Playwright reads a non-`fullPage` clip in viewport space
  and trims it) — fixed by measuring in document coordinates and capturing `fullPage`. The dues
  crop matched a bare `table`, i.e. *any* visible table on a hub that deliberately keeps other
  sections mounted — now scoped to a header only the dues table has. And the settlement picture's
  alt text named three things while the crop actually contains four: **a union is a rectangle, so
  it carries whatever sits between the matches** — here the whole team's-money summary card.

  **7. A cost the owner should see: slide #01's headline got blander.** The library's pain line for
  the dues slide is "Team fees are tracked in your head." — the visceral half of the sentence the
  page used to carry ("and the e-transfers arrive with no name on them") is now slide **#02**'s
  entire subject, and #02 is a P2 explainer. Until it ships, the coach page opens one beat weaker
  than it did. Taken verbatim per the build prompt rather than quietly improved.
- **P2 — the fourteen new slides. SPLIT BY KIND OF WORK after the P1 walk**, because captures and
  illustrations are two different jobs with two different review tests:
  - **P2a — the nine slides whose picture is a REAL SCREEN** (eight composed, one proof) **plus the
    phone re-captures that close the open §65/§66 defect. ✅ SHIPPED to dev 2026-08-20, owner QA
    §69 owed.** Build prompt:
    [PITCH_SLIDE_LIBRARY_P2A_BUILD_PROMPT.md](PITCH_SLIDE_LIBRARY_P2A_BUILD_PROMPT.md). What it
    settled is recorded below — read it before P2b.

  ### What P2a actually settled — read before planning P2b

  **1. ⚠⚠ THE PHONE DEFECT IS CLOSED, AND IT COST A DEMO-WORLD CHANGE NOBODY HAD BUDGETED FOR.**
  Both coach money pictures were re-photographed on the phone layouts the product genuinely has.
  Measured on the real page at four widths: **Player Dues 33% → 92%, Season settlement 39% → 92%**
  at 390px, with shape distortion under 0.9% everywhere. The rule underneath it is the same
  arithmetic P1 found, applied to height instead of rows: **a phone capture has to be SHORT enough
  to be drawn at full width.** The settlement sheet's first crop was the whole modal — 390×1000, a
  0.39 ratio, which the fixed stage draws about 165px wide on a laptop. Dropping the team's-money
  summary from frame (nine lines of small figures, unreadable at that scale anyway) took it to
  359×395 and bought ~90% at phone width AND ~100% on a laptop. **Do not reach for a taller crop
  because it contains more.**

  **2. ⚠⚠ THREE OF THE NINE SLIDES COULD NOT BE PHOTOGRAPHED AT ALL, AND THE REASON WAS A LIVE
  DEMO DEFECT, NOT A SLIDE PROBLEM.** Awards, the scouting book's contents and a second testing
  session did not exist in the coach sandbox: awards were seeded only on the CLOSED 13U season, so
  the season gate made the report unreachable and every live team opened on "No awards given yet";
  the seed only ever DELETED the two scouting tables, so every opponent card opened on an empty
  textarea; and one testing session cannot draw a trend, on the screen whose whole promise is "put
  this month's number beside last month's". **Two of the three are features the owner names as
  headline, and a prospect walking the production demo was finding them blank.** Every page
  rendered perfectly, which is exactly why nothing caught it — `check:demos` proves the worlds are
  in a presentable STATE and cannot know the product gained a screen the world has no data for.
  The owner ruled (2026-08-20) that the seeding belonged in this phase rather than after it.

  **3. What that seeding had to carry with it, and the trap inside it.** New dated rows must ride
  the nightly re-anchor or they walk backwards past their own schedule — awards and observations
  are both dated and both print their dates, so `shiftTeamSchedule` now moves them. ⚠ **The
  expensive one was the second testing session:** `restateOffSeasonBooks` gave EVERY session the
  one date the world declared, which was correct while there was exactly one and silently
  destructive the moment a second arrived. It now matches on the session's NOTE — the only stable
  identity a row has across a re-anchor — and `check-demo-coach` asserts the two dates stay
  distinct, because the failure would have been a trend line between two readings taken the same
  morning.

  **4. Two capture-core incidents, and they are the same element twice.** The coach portal pins a
  navigation bar to the bottom of the viewport at phone width. It (a) swallows a `prepare` click
  aimed low on a long phone screen — reported as a timeout on an element Playwright has already
  resolved, with a call log about stability that sends you hunting an animation that does not
  exist — and (b) **photographs as an opaque band across the MIDDLE of a `clipAll` crop**, because
  a union is taken `fullPage` in document coordinates while a fixed element paints at its viewport
  position. (b) shipped once, wiping out a family's card, and was found by LOOKING AT THE PNG —
  nothing failed. One manifest field (`hide`) answers both; it was briefly two mechanisms, and the
  prepare-only version is what let (b) through.

  **5. Selector traps that cost a capture run each.** `text=` cannot be a member of a
  comma-separated CSS list — Playwright's text engine swallows the rest of the string as its
  argument, and it fails as "matched nothing visible" rather than as a syntax error. A union's
  x-range is the range of the MATCHED boxes, so pairing a page title with a narrow heading inside
  a column produced a crop sliced down both sides; pair it with the full-width CONTAINER instead.
  And `a:has-text()` reads text content, so a link whose label lives on `aria-label` matches
  nothing and simply waits.

  **6. The scouting book's capture route, answered.** The game console is Saturday-only, so the
  book is shot from the opponents report — and it turns out to be the better picture: the console
  shows the book, the report shows the book AND how it filled up.

  **7. A cost the owner should see: the page carries six Premium plan lines where it carried two.**
  Every one is accurate — the free portal has none of these tools — but six in a row may read as
  "everything costs extra" rather than as disclosure. Left as built and flagged in QA §69.

  **8. Three page pictures are desktop screens and render at 34–52% on a phone** (the scouting
  book, Season Wrapped, the practice plan). Same arithmetic as (1) and the same honest answer: a
  960px screen cannot be read on a 350px column. Re-photographing each at phone width would make
  it small on a laptop instead. Recorded, not decided.
  - **P2b — the five hand-drawn explainers** (#02 #05 #07 #16 #17). Illustration, no pipeline, and
    the forbidden-fourth-class test rather than a capture guard. ⚠ #02 restores the half of slide
    #01’s headline that P1 gave up, so it carries a live-page improvement, not just a new slide.
- **P3 — the contact sheet + the staleness check.** A private route rendering the whole library on
  one page, behind the same flag the demo doors use — cheap, no new data model, and it answers
  "what do we have?". Plus the check that fails when a slide's pictured screen or gated claim has
  moved.
- **P4 — the club deck.** Inherits from both decks plus its three held slides. Ends in express
  interest rather than sign-up, since Club is not self-serve.
- **Later, and only if it earns it:** deck assembly in platform-admin — pick slides, name a deck,
  hand it to a prospect. Build once there is a library worth assembling from and evidence that
  per-prospect decks are a real workflow rather than a nice idea.

## The maintenance rule (the owner's own framing, and the reason this is a project)

> "Similar to after dev is complete a review of docs and the demo databases is done to ensure the
> new functionality is reflected, the same review/update should happen to our marketing deck
> library."

Correct, and the 2026-08-20 persona-page audit is the evidence: **three of four persona pages were
describing the product that was designed, not the one that shipped** — nineteen corrections,
including a capability we claimed on six surfaces that the product cannot do at all. The same copy
also feeds the in-app upgrade panels, so every marketing overclaim was being shown to paying
customers.

**What a machine can check** (P3): that a pictured screen still exists, that a slide's claim
references a capability the plan configuration still grants, that every declared picture has a
file, alt text and a caption.

**What it cannot check, and must stay a human step:** whether a sentence is still *true*. That is
the same judgement the demo-drift paragraph in `CLAUDE.md` already reserves for a person, and it
belongs in the release checklist rather than a build gate.

## Open questions carried in

- **Phone legibility of the coach money screens (QA §65, §66) — ✅ CLOSED IN P2a.** Re-photographed
  at phone width: 33% → 92% and 39% → 92%, measured. The general case (a wide desktop screen on a
  phone) is not closed and cannot be by geometry — see the P2a entry, item 8.
- **Phone legibility of wide captures (QA §65, §66) — ANSWERED BY P1, AND THE ANSWER IS NO.** The
  fixed stage plus the phone reflow fixed the bracket (33% → 68%) and did nothing for the dues
  table (33% → 33%), because a row crop changes height and scale follows width. **The fallback is
  now the plan: re-capture the coach money screens at phone width in P2.** Numbers and reasoning in
  the P1 entry above.
- **⚠ Lime is spent five times on the shipped walkthrough panel** against a binding one-lime-action
  rule (`design_decisions.md`, 2026-08-20 rider). Defensible on a slide, which carries no call to
  action for it to compete with; open on the scroll page. Owner to judge on the real page.
- ~~**The scouting book's capture route**~~ — ✅ answered in P2a: the opponents report, and it is
  the better picture. Its book was also EMPTY in the demo world until P2a seeded it.
- **Game day cannot be photographed at all** (`PRESALES_WALKTHROUGH_PLAN.md` P3 note) — the live
  console exists ~7h/week, the seeded Saturday game deliberately has no lineup, and game rows take
  a fresh random id every reseed. Slide #07 must therefore be an **explainer**, which is exactly
  the case class 3 exists for.

## Risks

- **Editorial volume, not technical risk.** Twenty-one claims × (headline + sentence + picture) is
  a lot of judgement. The mitigation is that the copy is already written and checked, and nine of
  the twenty-one already have their picture taken or drawn.
- **A composed crop can lie by omission.** Cropping to the rows that make the point is the whole
  technique; cropping to the rows that make a *different* point is falsification. The rule that
  keeps it honest: the crop must be re-derivable from a named manifest entry, and the rings must
  be page-side so the stored image is always the unedited capture.
- **Demo-world drift** — the coach world re-anchors nightly. Every alt, caption and claim must be
  cycle-proof: describe the durable shape, never a number or a name the next re-anchor changes.
