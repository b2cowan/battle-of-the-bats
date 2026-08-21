# Build prompt — Pitch Slide Library P2b (the five drawings, and the only pictures we author ourselves)

Paste into a fresh session. P2a shipped to dev 2026-08-20 (commit `3d6802fc`, owner QA §69 owed).

## ⚠⚠ THIS PHASE DOES NOT START WITH CODE

Every other phase of this project photographed the product. **This one draws.** Five illustrations
are an editorial and visual exercise before they are a build, and the owner's standing rule is
binding here: **build to approved mockups — the mockups ARE the spec** (auto-memory
`feedback_build_to_approved_mockups`), and **mockups are published as Claude Artifacts**
(`feedback_mockups_as_claude_artifacts`).

So the first deliverable is a **mockup round**, not a commit. Do not write slide data until the
owner has seen and approved the drawings.

**And say this to the owner out loud in that round, because it is bigger than five slides:** these
are the ONLY pictures in the entire library we author. Every other slide is a photograph of the
product, so it inherits the product's visual identity. The explainers are where the deck decides
what *we* look like when we are not showing software. Treat the first mockup as a house-style
proposal with five instances, not as five unrelated drawings.

## Mission

Complete both decks. P2b takes the **coach deck from 11 built slides to 14** and the **tournament
deck from 5 to 7** — the first time either is finished. After this, only the three club-held slides
(#18–#20) remain unbuilt in the whole library.

## Read first (in this order)

1. `docs/projects/active/PITCH_SLIDE_LIBRARY_PLAN.md` — the whole project, and **especially the P1
   and P2a entries**, which record what those phases paid for. Binding.
2. The approved library artifact — the binding spec for every slide's number, order, pain, claim
   and intended image: `claude.ai/code/artifact/a5dd16a5-519b-4b92-8958-d36195b9df3e`
3. **The three image classes** — this is the phase that document exists for:
   `claude.ai/code/artifact/d0cf0ea2-35fe-4f3c-a99c-dd68c2afc793`
4. The format: `claude.ai/code/artifact/b1706db6-8f65-43d1-a5c7-39ffa722300f`
5. `memory/design_decisions.md`, the 2026-08-20 pitch entries **including both riders**. The format
   is ratified; do not re-litigate it and do not silently exceed it.
6. Claude auto-memory `project_pitch_slide_library.md` — the P1 + P2a lessons in short form.

## ⚠⚠ THE ONE RULE THIS PHASE EXISTS TO NOT BREAK

**THE FORBIDDEN FOURTH CLASS: a drawn picture that LOOKS like our interface but isn't.** Prettified
fake screens, invented layouts, numbers we wish the product showed. This is what the 2026-08-19
"no drawn/faked screenshots" ruling was protecting against, and it stands.

**The test: could a reasonable person mistake this for a screenshot? If yes, it must BE one.**

An explainer is safe precisely because it never claims to be our software — it draws the *old way*,
the mess the product replaces. A drawing of an inbox, a group text, a spreadsheet, a whiteboard is
fine. A drawing of anything that looks like a FieldLogicHQ screen is the failure this phase is most
exposed to, because "just make it a bit more polished" walks straight into it.

## The five slides

Copy is **verbatim from the approved library artifact** — the same discipline as P1 and P2a.
⚠ But the P1/P2a lesson holds and has now bitten four times: **the artifact's IMAGE NOTES have been
wrong repeatedly** (#13's "three send switches" don't exist; #15's "two wrong tiles" aren't stable;
#12's paired shot was never built; #01's ring target had no equivalent on the phone layout).
**The code outranks the artifact.** For an explainer there is no code to check against — so the
equivalent discipline is: does the drawing depict a *real* old-way problem this product actually
solves? Verify the answer half against the product before drawing the pain half.

| # | Deck & position | Pain (verbatim) | Claim (verbatim) | Artifact's image note |
|---|---|---|---|---|
| **#02** | coach, money run, before #01 | The e-transfers arrive with no name on them. | The inbox, the spreadsheet and the bank app stop being three separate jobs. | Three scattered sources converging on one settled line |
| **#05** | coach, "the team forms", 2nd | The roster lives in a group text. | One roster with positions, numbers and contact details — and families who can see their own schedule without asking you for it. | A chat thread dissolving into a roster card with a family link |
| **#07** | coach, mid-season, after #24 | Parents text "score?" while you are coaching third base. | Families follow the score themselves; ending the game sends them one message, not one per run. | Must be drawn — the live console can only be photographed on a Saturday morning |
| **#16** | tournament, 5th | Teams register by email. | Teams enter themselves, see their fee and due date, and land in your list already sorted — you approve, waitlist or decline. | An inbox of forwarded attachments resolving into one accepted-teams list |
| **#17** | tournament, 7th (last) | Next year, you start from scratch. | Last year's tournament is this year's starting point — divisions, venues, registration setup and your public site, copied forward. | Two seasons side by side, the second pre-filled from the first |

⚠ **#07 is the only slide in the library that is an explainer BECAUSE IT CANNOT BE PHOTOGRAPHED**,
not because drawing is the better answer. The demo world's live game console exists about seven
hours a week, the seeded Saturday game deliberately has no lineup, and game rows take a fresh id
every reseed. Do not "solve" this by trying to capture it.

⚠ **#17's claim is the one to verify hardest.** The library marks its scope "to confirm" — it is
the only claim in the five that was never checked against the product. Confirm what a tournament
rollover actually copies forward before the slide says it.

## ⚠ #02 carries a live-page improvement, not just a new slide

Slide #01 currently reads **"Team fees are tracked in your head."** — the shorter half. The visceral
half it gave up ("and the e-transfers arrive with no name on them") is #02's entire subject. The
owner accepted the short version in QA §67 as a **temporary state, not a preference**.

So when #02 ships: **check whether #01 reads better restored**, and put the two versions in front of
the owner rather than deciding it. Two slides side by side both leading on e-transfers would be
worse than the current state — that is the actual risk, and it is why this is a question and not a
task.

## The build, once mockups are approved

### 1. ⚠ THE RENDERER HAS NO PATH FOR A DRAWN PICTURE — THIS IS THE REAL WORK

Do not assume this phase is "add five entries". `WalkthroughPage.tsx`'s `pictureFor()` resolves a
slide's picture **only** through the screenshot manifest and returns `null` when a slide has no
`shotId`. Every explainer therefore renders today as text with no picture at all.

`SlideStage` takes a `SlidePicture` of `{ src, width, height, maxWidth, alt, rings }` and draws an
`<img>`. An inline SVG is not an `<img>` src, has no manifest entry, and has no captured size. So
P2b must decide and build **how a drawn picture enters the stage** — and that decision has to
satisfy everything the stage already guarantees:

- the picture is **contained**, never stretched (`design_decisions.md` 2026-08-20);
- ⚠ **"CONTAIN" IS NOT A HEIGHT CAP** — every limit is spent on the WIDTH, or tall pictures squash.
  This nearly shipped distorted screenshots once;
- on a phone the aspect lock is released and the picture takes the full column;
- print keeps it at full size on a dark ground.

An SVG with a sensible intrinsic `viewBox` is the natural fit — it is resolution-free, so the
"never enlarge a phone capture" rule has no analogue and the width-only sizing gets simpler, not
harder. **But confirm that against the real stylesheet rather than assuming it.**

Also decide where an explainer's **alt text and caption** live. Captures keep theirs in the shot
manifest beside the picture; an explainer has no manifest entry, so they need a home — most likely
on the slide itself. Whatever you choose, `check:marketing-shots` must not start passing vacuously
over slides that have neither.

### 2. The slide data

Each explainer is `imageClass: 'explainer'` with **no `shotId`** — `tests/unit/pitch-slide-library.test.ts`
already asserts an explainer never names a real capture, and that guard must keep passing.
Remove each id from `PLANNED_SLIDES` as it is built; the test fails if an id is both built and planned.

### 3. Rings

Explainers almost certainly need none — a drawing can put the emphasis *in* the drawing. If one
wants a ring, the standing rules still bind: **a ring marks a structural region, never a row**, max
two per slide, and (P2a's addition) **a ring earns its place from the picture's SCALE, not the
sentence beside it** — at full legibility it is marking what is already marked.

### 4. Colour, and the rider you must not resolve by accident

⚠ **Lime is spent SIX times on the shipped walkthrough panel** against a binding one-lime-action
rule (`design_decisions.md` 2026-08-20 rider). Five new drawings are five new chances to spend it
again. **The owner has not ruled on this** — raise it in the mockup round rather than deciding it
by drawing. The explainers depict the *old way*, which argues for them being the least lime thing
in the deck, but that is a proposal, not a decision.

The stage sits on pitch-black, and print keeps the dark ground. A drawing must read on both.

### 5. What the public pages should show

**Ask before changing either page's pull.** The coach page grew from two panels to six in P2a on
the owner's call; the tournament page still shows the five it always has. #02 sits immediately
before #01 in the coach deck and #16/#17 sit inside the tournament deck's order — so both pages
*could* grow, and neither should without a ruling.

⚠ If a pull changes, its **meta line count** and its **SEO description** must change with it — both
are asserted by the test suite, and the description is written to name exactly the panels shown.

### 6. Wire up

Plan + PM brief updated · Owner QA §-row · `TODO.md` pointer · both memory stores. **The
demo-drift question applies weakly here** — explainers depict the old way, so no demo screen backs
them — but #05's and #07's *claims* describe real coach features, so check the demo tells those
stories.

### 7. Funnel

`/simplify` then `/review`, then `verify:changed`. ⚠ **Schema parity is currently RED with
pre-existing dev-only drift from other sessions** (`org_people`, `rep_payable_*`) — confirm it is
not yours, then run the post-parity checks individually. `npx next typegen` before `npm run typecheck`.

### 8. Commit only on explicit owner OK

Explicit pathspecs. **⚠ Other sessions are working in this tree** — at P2a time, four were. Check
`git status` before staging, and **filter foreign hunks out of shared documents** (`TODO.md`, the QA
ledger, `memory/MEMORY.md`) rather than sweeping another session's work in. P2a had to split the QA
ledger by hand for exactly this. `git show --stat HEAD` after.

## Hard rules carried forward (P1 and P2a paid for these)

- **The forbidden fourth class** — restated at the top because it is this phase's whole risk.
- **NO PLAN OR SUBSCRIPTION NAME ON A SLIDE.** Functionality only; the public PAGE adds a plan line
  where a feature is gated. A build check enforces it.
- **Cycle-proof alts, captions and claims** — describe the durable shape, never a number or a name.
  (A pain headline MAY stage invented old-way specifics; that licence matters more here than
  anywhere, since the whole picture is the old way.)
- **Plain `<img>` / inline markup on public pages, never `next/image`** — it would be the repo's
  first request-time sharp caller on Amplify, a recorded outage class.
- Don't restart the shared dev server casually.

## Not in scope

P3 (the contact sheet + the staleness check) · P4 (the club deck) · the marketing header defect
(QA §68 — real, logged, shared site chrome, deserves its own review) · **the production demo
rebuild** — P2a fixed three empty demo screens in the seed, but production still shows them empty
until the sandbox is rebuilt there, which is a release-time action for the owner. It is the most
time-sensitive open item on this project and it is NOT this phase.

## The three questions the owner still owes a ruling on (QA §69)

Do not decide these by building on top of them:

1. Whether slide #01 should have something marked now that its rings are gone.
2. Whether six Premium plan lines in a row on the coach page read as disclosure or as drumbeat.
3. Whether the three coach page pictures that are desktop screens (34–52% of readable size on a
   phone) should be re-photographed at phone width — which makes them small on a laptop instead.
