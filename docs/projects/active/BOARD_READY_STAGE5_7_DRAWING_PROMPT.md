# Board Ready Stages 5 + 7 — club events, then camps and clinics (drawing session kickoff)

Paste into a fresh session: **"Read and follow docs/projects/active/BOARD_READY_STAGE5_7_DRAWING_PROMPT.md"**

Written 2026-11-24. **This session draws; it does not build.** Neither stage is drawn or started
(`BOARD_READY_PLAN.md` §5 Stage 5 and Stage 7; the order table rows 10 and 12). Stage 7 is a Stage 5 event with
sessions, a capacity, a price, a waitlist and a sign-up form on top, so the two are drawn together: the event is
the base, the camp is the layer. Owner order (20 Nov): sponsorships, then club events, then people and documents,
then camps and clinics.

## Rules of this session
1. **Plain-language UX summary first, then drawings, then rulings, then (only on his word) a build plan.** No code
   changes. Present each ask with a recommendation and get his answer; agreement is not a go to build.
2. **Disagree out loud.** If a plan line, an earlier ruling or the drawing order looks wrong, say so before drawing.
   Argue from what the code does, not from what the plan claims.
3. **Drawings are Claude Artifacts (HTML pages), never the canvas.** House layout, whole-screen before/after, drawn at
   TRUE SIZE, each control drawn from its SHIPPED component (the portal is the formatting benchmark). Every highlight
   is clickable. Phone and desktop. Run `/design` on every mockup BEFORE handing it over. Read memory
   `reference_memory_index_settled.md` § UI conventions first.
4. Shared working copy: another session may be committing. Stage explicit pathspecs only; never `git add -A`.
5. Do not commit or push without his word. Do not read production rows that hold a person's information.

## Read first (in this order)
1. `BOARD_READY_PLAN.md`: the Stage 5 and Stage 7 lists, rulings D3 and D5, Q7 (events reopened D5, ruled yes
   2026-11-15), Q8 (per-program Exempt/Taxable), the 2026-10-31 rules (no RSVP links by email; the "Your sign-up" page).
2. Stage 4 (Forms, complete 2026-11-22): a camp's sign-up form is a Stage 4 form. Read how it is built and what it
   already offers a club.
3. Stage 6 (Sponsorships): the closest recent example of a club-owned thing with a price, a form, a pay link and the
   books. Reuse its pattern; do not invent a second one.
4. The house-league sign-up path (no account at sign-up, "Your sign-up" status / pay / withdraw, placement confirmed
   by the club) and the club schedule's permit slots (a camp is a second kind of program beside house league).
5. The club calendar (read-only today) and the club site and family app, where an Events section would appear.
6. `BOARD_READY_PM_BRIEF.md` and the board line for Board Ready (`OWNER_BRIEF_PROJECTS.json`).

## Check before drawing (report what you find, do not assume)
- Is Club Tier Stage 12 (families pay online) done? Stage 7's live payment waits on it, as sponsorships did.
- What does the club calendar do today and what would "writable for club events only" change (D3: the club never
  writes a team's schedule)?
- Which plan or access gates the Events section and the camp sign-up? Route the answer through `/billing`; do not
  invent a gate.

## What to draw (asks, each with a recommendation)
**Stage 5, club events**
- Making an event: name, kind (banquet, champs day, AGM, clinic, camp, other), date and time, venue from the venue
  library, optionally held from permit time, audience (public, families, members, staff).
- Where it shows: the club calendar, an Events section on the club site, the family app. Empty state included.
- Champs day: how the house-league playoff or final games sit under one event.
- A sign-up: an event that wants one uses a Stage 4 form. No RSVP links by email.

**Stage 7, camps and clinics**
- Sessions, a capacity, a price and a waitlist on an event; how time is held from permit time and shown on the
  schedule beside house league.
- The family's side: the Events listing with a Sign up button, the form, the pay step, the "Your sign-up" page
  (status, pay, withdraw), and what a full camp and a waitlist look like.
- The club's side: placement confirmed by the club, the roster, an instructor's roster view and taking attendance.
- The books: camps as their own revenue line; the per-program tax setting.

## Routing, before handing off
- **`/legal`**: camps register children. Retention and who sees a child's information, waivers and consent, and any
  email the product sends (CASL). Apply what it finds or record it as an owner question.
- **`/accounting`**: the tax treatment of instruction and the new revenue line.
- **`/billing`**: the gate for Events and for camps. **`/marketing`**: any words a family reads.
- Mind the one-spelling rule (`npm run check:spelling`): "8:00 a.m." clock, "installment".

## Done when
- One drawing page per stage (or one page, two tabs), published as a Claude Artifact with every ask numbered, plus a
  note of what each ask changes for a family, a coach and a club admin.
- His rulings recorded exactly as ruled, adding nothing he did not rule, in `BOARD_READY_PLAN.md` §5 (Stage 5 and
  Stage 7) and the order table rows 10 and 12.
- The Board Ready line on the board moved in the same commit, and a PM brief updated if the plan changes.
- A build prompt per part written only after the rulings, and only if he says "build".
