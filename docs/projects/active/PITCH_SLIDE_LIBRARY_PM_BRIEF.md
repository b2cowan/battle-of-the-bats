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
2. **The fourteen new slides — split in two, because photographing a screen and drawing a picture
   are different jobs with different ways of going wrong.**

   **P2a — DONE (dev, 2026-08-20; owner walk owed as QA §69).** Nine slides that photograph a real
   screen, and the phone fix. **The phone defect is closed and measured:** the two coach money
   pictures went from 33% and 39% of readable size on a phone to **92% each**, because they are now
   photographed on the phone layouts the product already had rather than cropped from a laptop
   screenshot. The coach walkthrough page also grew from two panels to six on the owner's call, and
   now walks a coach's year — tryout scoring on a phone, the practice plan, the book on Saturday's
   opponent, the dues, the season squared up, and a closed season kept on one page.

   ⚠ **P2a turned up something worth more than the slides it was blocked by.** Three of the nine
   could not be photographed because the screens were EMPTY in the live demo: no awards on any team
   a coach can open, no contents in the scouting book, and a single testing day where the product
   promises a trend. Two of those are the features the owner named as headline, and a prospect
   walking the production demo was finding them blank — every page rendering perfectly, which is
   why nothing caught it. The demo now seeds all three, so the shop window shows what the product
   does. **This is the maintenance rule at the bottom of this brief doing its job for the first
   time, in the opposite direction from the one anyone expected: the demo had drifted behind the
   product, not the marketing behind the demo.**

   **P2b — DONE (dev, 2026-08-21; owner walk owed as QA §70). Seven drawings, not five, and both
   decks are finished for the first time** — coach 15 slides, tournament 8. Only the three
   club-held slides remain unbuilt in the whole library.

   ⚠ **Two things changed under it that are bigger than the drawings.**

   **The picture rule was replaced.** It used to say: never draw anything that could be mistaken
   for our interface. The owner replaced it after seeing the drawings — *"I don't care about real
   screenshots vs. mockup drawings, as long as what we promise and the functionality in the
   drawings match our app… if it looks better to mock something up, use the mockup."* The
   obligation is functionality, not pixels. **That cost ten sentences on the live site**, not one:
   *"real screens, not a brochure"* appeared on both walkthroughs and both persona pages, in the
   headlines, the closings and the search descriptions. All ten are gone, and what replaced them
   points at the demo instead — an invitation rather than a denial, and one that stays true
   whatever the pictures are.

   **The owner asked for a slide type the library did not have** — a cycle diagram showing the
   whole season and the whole tournament year. The editorial find is that *every* company draws
   this wheel and their closing arrow is decoration; ours closes with a button (*Start next
   season*, or copying last year forward), so the returning arc is the only bright thing on it.

   ⚠ **And a defect worth its own line: five coach slides photographed in P2a could not be seen
   anywhere in the product.** Every surface showed the six-slide page pull, not the deck. The
   presentation mode now shows the whole deck.
3. ~~**A private page listing the whole library**, plus the staleness check.~~ **Absorbed** into
   the [Pitch Deck Studio](PITCH_DECK_STUDIO_PM_BRIEF.md), where it becomes the library view.
4. **The club deck**, inheriting from both.

Deck assembly inside the admin tools is **approved and next** — see the Deck Studio brief. The
condition this brief set ("only once there is a library worth assembling from") is now met.

## Success criteria

- A slide can be written once and appear in two decks with no edit.
- Both walkthrough pages are legible on a phone. ✅ **Met for the money screens at P2a** — measured
  92% of readable size at phone width, up from 33% and 39%. ⚠ Not met in general, and cannot be by
  page design: three of the six coach pictures are desktop screens and render at about a third on a
  phone. Fixing each means photographing that screen on a phone too — which makes it small on a
  laptop instead. Left as an owner call per slide rather than decided quietly.
- Every claim on every slide is traceable to something the product actually does — checked before
  the slide ships, not after a prospect notices.
- Producing a deck for a new audience costs a list of slide numbers, not a writing project.
