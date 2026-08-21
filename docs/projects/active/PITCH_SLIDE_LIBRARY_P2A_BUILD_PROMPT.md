# Build prompt — Pitch Slide Library P2a (the nine slides that have a real screen, and the phone defect)

Paste into a fresh session. Owner approved this phase in the P1 walk (QA §67 PASSED 2026-08-20).
The PM UX summary requirement is satisfied by the PM brief + the approved library artifact —
re-present a one-paragraph UX summary in-conversation before code, then build without further
approval gates.

## Why this is P2**a** and not P2

P2 as the plan writes it is fourteen slides. They are two different jobs and they are being split
by KIND OF WORK, not by size:

- **P2a — this phase.** The **nine slides whose picture is a real screen** (eight composed, one
  proof), plus **the phone re-captures that close the open §65/§66 defect.** All machine-capture
  work: one pipeline, one discipline, one set of gotchas.
- **P2b — next.** The **five hand-drawn explainers**. Illustration, not capture. No pipeline
  involved, a different review test (the forbidden-fourth-class question), and a different skill.
  **Do not start it in this session.**

## Mission

Take the coach and tournament decks from 7 built slides to 16, and make the coach money screens
legible on a phone. Every picture in this phase is **really our software** — captured by machine
from the demo world, never drawn.

## Read first (in this order)

1. `docs/projects/active/PITCH_SLIDE_LIBRARY_PLAN.md` — the whole project, and especially the **P1
   entry**, which records seven things this phase would otherwise relearn expensively. Binding.
2. The approved library artifact, which IS the spec for every slide's number, order, pain, claim
   and intended image: `claude.ai/code/artifact/a5dd16a5-519b-4b92-8958-d36195b9df3e`
3. The format: `claude.ai/code/artifact/b1706db6-8f65-43d1-a5c7-39ffa722300f` ·
   the three image classes: `claude.ai/code/artifact/d0cf0ea2-35fe-4f3c-a99c-dd68c2afc793`
4. `docs/projects/active/PRESALES_WALKTHROUGH_PLAN.md` — every capture gotcha already paid for.
5. `memory/design_decisions.md`, the two 2026-08-20 pitch entries **including the built-and-corrected
   riders**. The format is ratified; do not re-litigate it and do not silently exceed it.
6. Claude auto-memory `project_pitch_slide_library.md` — the P1 lessons in their shortest form.

## The build

### 1. Close the phone defect first (it is the only thing here with an owed QA row)

**Re-capture the two coach money screens at phone width.** The Money hub has a real phone card
layout — the desktop table is hidden behind a desktop-only rule, so the phone layout is a genuinely
different and genuinely legible surface, not the same table shrunk.

- Slides **#01** (Player Dues) and **#03** (Season settlement).
- ⚠ **Measure before and after and report both numbers.** P1's measured baseline is 33% and 39% of
  true size at 390px. The bar is "a coach can read it on a phone", not "it changed".
- ⚠ **Re-check the callout rings on #01.** They are percentages of the picture, and the phone card
  layout has no Balance/Status *columns* to ring. Either re-point them at the equivalent structural
  region in the card layout, or drop them and say so — **a ring left pointing at the wrong thing is
  worse than no ring.**
- ⚠ Alt text and caption must be re-written to describe the picture that now exists.
- Doing this first means the rest of the phase builds on a closed defect rather than an open one.

### 2. The eight composed slides

`#04` fundraising credit · `#06` lineup board · `#10` tryout scorecard · `#21` awards ·
`#22` player development · `#23` playing time · `#24` scouting book *(headline)* ·
`#25` practice plans *(headline)*

For each: a manifest entry, a real capture from the demo world, copy taken **verbatim from the
library artifact**, and rings only where they earn their place.

- **⚠ THE SEASON PHASE IS THE PICTURE.** Every coach slide is shot on the demo team whose phase
  makes that screen true. The settlement sheet photographed mid-season shows every family in debt
  and argues the opposite of what it means to. Pick the team deliberately and record why.
- **⚠ `#24` scouting book — the capture route is an open question the plan carries.** The game
  console is Saturday-only, so shoot it from the opponents report instead. Confirm the report
  actually tells the story before writing the claim.
- **⚠ `#23` playing time — never the word "fair".** Measurement in context, per the standing ruling.
- Two of these are the owner's named **headline** features (`#24`, `#25`). They should be the best
  pictures in the deck; if a capture is merely adequate, say so rather than shipping it.

### 3. The one proof slide

`#09` Season Wrapped — **whole and unretouched.** It is designed to be looked at; that is the
point of the class. Do not crop it.

### 4. Rules the pictures must obey (P1 paid for all of these)

- **A callout ring marks a STRUCTURAL region — a column, a header, a card — NEVER a row.** The
  coach world re-anchors nightly; a ring on a row position eventually points at the wrong family.
  Max two rings per slide, or it is two slides.
- **A composed crop must stay re-derivable from its manifest entry**, and **a union crop is a
  RECTANGLE — it publishes whatever sits between the matched elements.** Say what is actually in
  frame in the alt text, not just what the selector names.
- **Scope every crop selector to its panel.** A bare `table` on a hub that keeps visited sections
  mounted-but-hidden is a silent trap.
- **Cycle-proof alts, captions and claims.** Describe the durable shape, never a number or a name.
  (The pain headline MAY stage invented old-way specifics.)
- **NO PLAN OR SUBSCRIPTION NAME ON A SLIDE.** Functionality only. The public PAGE adds a plan line
  where a feature is gated; the slide never does. A build check enforces this.
- Screenshots come only from the `riverdale-*` demo orgs — the capture core enforces it. Extend it
  through the shared core if something is missing, never fork it.

### 5. What the public pages should show

**Ask before changing either page's pull.** P1 deliberately kept each page showing exactly the
panels it showed before. Nine new slides do not automatically belong on a page a reader has 90
seconds for — the deck is the long form, the page is the short pull. Propose a pull and get a
ruling; do not widen the pages by default.

⚠ If a page's pull does change, its **meta line count** and its **SEO description** must change with
it — both are asserted by the test suite and the description currently promises only what exists.

### 6. Wire up

Plan + PM brief updated · Owner QA §-row (**phone legibility is the blocking check**) · `TODO.md`
pointer · auto-memory. **The demo-drift question applies to this phase directly:** nine new pictures
of coach screens means re-reading the coach sandbox's own dock copy and tour narration for sentences
that stopped being true.

### 7. Funnel

`/simplify` then `/review`, then `verify:changed`. If schema-parity fails, check whether it is
PRE-EXISTING dev-only drift from other sessions before blaming this diff, and run the post-parity
checks individually. `npx next typegen` before `npm run typecheck`.

### 8. Commit only on explicit owner OK

Explicit pathspecs. **⚠ Other sessions are working in this tree** — check `git status` before
staging and filter hunks out of shared documents (`TODO.md`, the QA ledger, `memory/MEMORY.md`)
rather than sweeping another session's work into your commit. Any new PNGs MUST be in the same
commit as the code — `verify:changed` hard-requires them. `git show --stat HEAD` after.

## Hard rules (do not relearn these the expensive way — P1 did)

- **"CONTAIN" IS NOT A HEIGHT CAP.** The picture frame solves containment on the WIDTH alone,
  deliberately. Do not "simplify" it to `max-height` — that squashes every picture taller than the
  frame, and it nearly shipped distorted screenshots of the product. `object-fit: contain` is not
  the fix either: the rings are positioned against the picture's box.
- **A phone-subject capture never grows; a desktop crop may grow to fill the frame**, bounded by
  the pixels it holds. Two rules, not one.
- **Cropping rows makes a picture SHORTER, not NARROWER** — and on-screen scale follows width.
  Before promising a crop will fix legibility, ask whether it narrows the picture.
- **A non-`fullPage` screenshot clip is VIEWPORT space and is silently CLAMPED.** Union crops are
  measured in document coordinates and captured `fullPage` for exactly this reason.
- Plain `<img>` on public pages, **never `next/image`** — it would be the repo's first request-time
  sharp caller on Amplify, a recorded outage class.
- Playwright full-page screenshots of these pages need a **scroll-through first** (lazy images
  photograph as empty frames).
- Don't restart the shared dev server casually.

## Not in scope

The five hand-drawn explainers, `#02 #05 #07 #16 #17` (P2b) · the contact sheet and staleness check
(P3) · the club deck (P4) · deck assembly in platform-admin · **the marketing header defect (QA
§68)** — real, logged, and deliberately not bundled here: it is shared site chrome with a
blast radius of every marketing page and deserves its own review.

## Two things the owner has NOT ruled on — do not decide them by building

- **Lime is now spent SIX times on the shipped walkthrough panel** against a binding
  one-lime-action rule (`design_decisions.md` 2026-08-20 rider), the callout rings being the newest
  claimant. Left deliberately; it is the owner's call on the real page.
- **Whether either public page's pull should grow** — see §5 above. Propose, don't assume.

## One thing that is already true and should stay true

`#01`'s headline is currently the shorter *"Team fees are tracked in your head."* The half it lost
is slide `#02`'s whole subject, which is **P2b**. The owner accepted the short version as a
temporary state, not a preference — so when `#02` ships, check whether `#01` reads better restored.
