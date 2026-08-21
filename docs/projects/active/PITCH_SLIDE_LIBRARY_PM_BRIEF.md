# Pitch Slide Library — PM Brief

**Approved 2026-08-20 · Plan:** [PITCH_SLIDE_LIBRARY_PLAN.md](PITCH_SLIDE_LIBRARY_PLAN.md)
**The library (binding spec):** `claude.ai/code/artifact/a5dd16a5-519b-4b92-8958-d36195b9df3e`

## What we're building

A reusable bank of **pitch slides** — one recognizable problem, one real picture, one sentence —
that we compose into **decks by audience** and pull from for the public walkthrough pages. Twenty-one
slides today: seven for tournament organizers, fourteen for head coaches, three more held for the
club story.

## Why it matters

Today every pitch panel is written for one page and lives only on that page. That has three costs
we have now measured rather than assumed:

- **The pictures don't work as pitch material.** A whole product screen dropped onto a slide is
  texture, not an image — fifty numbers competing for a five-second glance. On a phone, the two
  coach screenshots currently render at about a sixth of their size and are simply unreadable.
- **We can't assemble a pitch.** There is no way to put five slides in front of a prospect, or to
  hand a club president the coach story plus the tournament story, without writing new copy.
- **Copy written per-page drifts per-page.** A claim audit on 2026-08-20 found three of four
  persona pages describing the product we designed rather than the one we shipped — including one
  capability promised on six surfaces that the product cannot do at all.

## What changes for the customer

- **The two live walkthrough pages get pictures that read**, including on a phone. That is the
  visible P1 outcome.
- **Nothing else moves.** The demos stay ungated and untouched, pricing untouched, no new nav item.
  Slides carry no plan or subscription names at all — the page adds one only where a feature is
  gated and no human is present to answer for it.

## What changes for us

- One place to write a pitch, and one place to fix one.
- A **club deck becomes cheap** — it inherits the coach and tournament slides rather than
  re-arguing them, which is right, because a Club customer genuinely gets both products.
- A machine can tell us when a slide's picture or claim has moved underneath it.

## The honesty rule, in one line

Every picture is either **really our software** or **obviously a drawing**. Nothing in between. A
prettified fake screen is the one thing that makes a prospect feel lied to the moment they open
the live demo — and the demo is one click away on every page we publish.

## Sequencing

1. **The model, proved on what already ships — ✅ DONE and WALKED 2026-08-20 (QA §67 PASSED).** The slide bank and the format are in, both live walkthroughs render from the library,
   and three pictures were re-cropped. No new artwork.

   ⚠ **One promise in this brief did not survive contact: "both walkthrough pages are legible on a
   phone" is only half true, and the half that failed was always going to.** Cropping a table to
   fewer rows makes it shorter, not narrower — and how big a picture looks on a phone depends on
   its width. So the playoff bracket, which was mostly empty space, doubled in size and now reads;
   the dues table, which is genuinely 1,000 pixels of table, did not move at all. The fix is to
   photograph the coach money screens on a phone rather than on a laptop — the product already has
   a proper phone layout for them — and that is now a P2 job. What P1 did buy on a phone: the
   picture leads at full width, and the highlight rings mean a reader who can't read the numbers
   can still see which two columns the sentence is about.
2. **The fourteen new slides — now split in two, because photographing a screen and drawing a
   picture are different jobs with different ways of going wrong.**
   **P2a** is the nine slides that photograph a real screen, and it carries the phone fix above —
   so the open defect closes at the start of that phase rather than the end.
   **P2b** is the five hand-drawn explainers, including the one that gives the dues slide back the
   half of its headline P1 gave up.
3. **A private page listing the whole library**, plus the check that flags a slide whose screen or
   claim has changed.
4. **The club deck**, inheriting from both.

Deck assembly inside the admin tools comes later, and only once there is a library worth
assembling from.

## Success criteria

- A slide can be written once and appear in two decks with no edit.
- Both walkthrough pages are legible on a phone. ⚠ Partly met at P1 — see the sequencing note.
  Fully met when the coach money screens are re-photographed at phone width in P2.
- Every claim on every slide is traceable to something the product actually does — checked before
  the slide ships, not after a prospect notices.
- Producing a deck for a new audience costs a list of slide numbers, not a writing project.
