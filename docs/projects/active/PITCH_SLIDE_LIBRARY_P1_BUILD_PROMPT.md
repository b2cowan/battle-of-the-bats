# Build prompt — Pitch Slide Library P1 (the model, proved on what already ships)

Paste into a fresh session. Owner has approved this phase; the PM UX summary requirement is
satisfied by the PM brief + the three approved artifacts below — re-present a one-paragraph UX
summary in-conversation before code, then build without further approval gates.

## Mission

Turn the two hand-written walkthrough panel lists into a **slide library with audience decks**, and
give the slides a format whose pictures actually read — **including on a phone, which is the open
defect this phase closes.** No new artwork in P1: the existing seven captures are re-cropped, not
replaced.

## Read first (in this order)

1. `docs/projects/active/PITCH_SLIDE_LIBRARY_PLAN.md` — the whole project. Binding.
2. The three approved artifacts, which ARE the spec:
   - Library + both deck running orders: `claude.ai/code/artifact/a5dd16a5-519b-4b92-8958-d36195b9df3e`
   - The format: `claude.ai/code/artifact/b1706db6-8f65-43d1-a5c7-39ffa722300f`
   - The three image classes: `claude.ai/code/artifact/d0cf0ea2-35fe-4f3c-a99c-dd68c2afc793`
3. `docs/projects/active/PRESALES_WALKTHROUGH_PLAN.md` — what shipped, and every capture gotcha
   already paid for.
4. `memory/design_decisions.md`, the two 2026-08-20 pitch entries — the format is already ratified;
   do not re-litigate it, and do not silently exceed it.
5. Claude auto-memory `project_presales_walkthrough.md`.

## The build

1. **Slide bank + decks, in `lib/walkthrough-content.ts`.** A slide keyed by its **permanent
   library number** (the artifact's `#01`–`#25`; note **#08 is retired** and #18–#20 are held for
   the club deck — do not renumber, the ids are how a slide is tracked as the product moves).
   A deck names slides **in order**. Each public page renders a **short pull** from its deck, not
   the whole thing. P1's pulls are exactly the panels those pages show today, so the live pages do
   not change what they say — only how their pictures render.
2. **The format, in `components/marketing/WalkthroughPage.tsx`** (already renders from data; both
   routes are two-line shells):
   - a **fixed 16:10 picture stage**, picture *contained* not stretched;
   - body copy in the **sans** face, kickers stay mono;
   - **on a phone the picture moves ABOVE the words and takes the full column** — this is the fix
     for the ~16%-scale illegibility measured at 390px, and it costs nothing on desktop;
   - **callout rings positioned OVER the image, never baked into it.** Ring geometry is per-slide
     data (percentages), so the stored PNG stays exactly what the machine captured.
3. **Re-crop, don't re-shoot.** Tighten the `clip` on the existing manifest entries where the
   artifact's deck calls a slide *composed* rather than *proof* (the dues table → the rows that
   carry the story; registration health → the score and the two wrong tiles; the bracket → two
   semifinals feeding a final). Same pipeline, same demo-world guard, same one-door-press-per-run.
   ⚠ The core now asserts demo-world membership **immediately before the shutter** and hides the
   dev-tools badge from inside the overlay's shadow root — do not undo either.
4. **Copy is already written and checked** — take it verbatim from the library artifact. It has
   been through `/marketing` against the forbidden-word list and the persona pain bank, and every
   claim was verified against code on 2026-08-20. **Do not improve it in passing.**
5. **Wire up:** plan + PM brief updated, Owner QA Ledger §-row (phone legibility is the blocking
   check), `TODO.md` pointer, auto-memory.
6. **Funnel:** `/simplify` then `/review`, then `verify:changed` — if schema-parity fails, check
   whether it is the PRE-EXISTING dev-only drift from other sessions before blaming this diff, and
   run the post-parity checks individually.
7. **Commit only on explicit owner OK.** Explicit pathspecs; any re-cropped PNGs MUST be in the
   same commit as the code (`verify:changed` hard-requires them); `git show --stat HEAD` after.

## Hard rules (do not relearn these the expensive way)

- **NO PLAN OR SUBSCRIPTION NAME ON A SLIDE.** Functionality only — it is what makes a slide
  portable between decks. ⚠ The public PAGE still carries a plan line where a feature is gated;
  a deck has a human in the room to answer, a page does not.
- **Every picture is either really our software or obviously a drawing.** Nothing in between. A
  drawn thing that looks like our UI is the forbidden fourth class and always was.
- **A composed crop must stay re-derivable** from its manifest entry, and rings stay page-side, so
  the stored image is always the unedited capture.
- Screenshots come only from the `riverdale-*` demo orgs — the capture core enforces it; extend it
  through the shared core if anything is missing, never fork it.
- Plain `<img>` on public pages, **never `next/image`** — it would be the repo's first request-time
  sharp caller on Amplify, a recorded outage class.
- **Cycle-proof alts and captions.** The coach world re-anchors nightly: describe the durable
  shape, never a number or a name. (The pain headline MAY stage invented old-way specifics.)
- Playwright full-page screenshots of these pages need a **scroll-through first** (lazy images
  photograph as empty frames), and print-emulation waits must scope to `/marketing/` images only.
- `npx next typegen` before `npm run typecheck`. Don't restart the shared dev server casually.

## Not in scope

The fourteen new slides (P2) · the contact sheet and staleness check (P3) · the club deck (P4) ·
deck assembly in platform-admin · re-shooting anything at phone width (that is the fallback if the
owner still finds a wide crop unreadable after this phase, not the opening move).

## Two things the owner has NOT ruled on — do not decide them by building

- **Lime is spent five times on the shipped walkthrough panel** against a binding one-lime-action
  rule (`design_decisions.md` 2026-08-20 rider). Leave it; it is the owner's call on the real page.
- **Whether a wide crop is still unreadable at 390px after the fixed stage lands.** Build the
  stage, measure it, and report the number — do not pre-emptively re-shoot.
