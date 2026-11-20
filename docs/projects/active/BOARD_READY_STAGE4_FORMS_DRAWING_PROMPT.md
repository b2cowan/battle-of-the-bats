# Board Ready · Stage 4, Custom forms — drawing kickoff prompt

**Use this to start a NEW chat with `/design`.** This is a drawing session, not a build: no product code changes until
the drawing is ruled and a build prompt is written from it. Written 2026-11-20.

## Why this session exists, and why it goes first

Item 5 of the eight things a club board asked for: "Customizable house-league registration forms: custom questions,
documents to open/download before submit, 'I have read' checkboxes."

The owner set the order of the rest of Board Ready on 2026-11-20 (`BOARD_READY_PLAN.md` §7b): **custom forms first**,
then sponsorships built on it, then club events, then people and documents, then camps and clinics. Forms leads because
three later things sit on it: house-league sign-up (its first use, and the registrar's biggest pain point on its own),
the sponsor link's questions (Stage 6) and camp sign-ups (Stage 7). Building any of those first would mean building a
fixed set of questions and moving it into a form later.

So this drawing has two readers: the club drawing its first house-league form, and the two later stages that will
reuse it. **Draw the house-league sign-up in full; draw the form itself so a sponsor's link and a camp's sign-up can use
it unchanged.** Do not draw those two pages here.

## Read first

- `BOARD_READY_PLAN.md`: Goal (items 5 to 8 are one shape asked four times, so one form, never four builders), §2
  facts 5 and 7, §5 "Stage 4 — Forms", §7b (the order and why), §9 (gates).
- `BOARD_READY_PM_BRIEF.md`.
- **The shipped pieces to draw from**, never from memory (`feedback_draw_controls_from_shipped_component`):
  - **Tournament registration questions**, the model this stage generalizes: the question editor in a tournament's
    event settings (short and long answer, dropdown, checkbox, file upload), and how the answers show in the
    tournament's registrations. Gated on Tournament Plus today.
  - **The house-league sign-up page** a family fills in: fixed fields per child, the friends block under each child's
    division line (Board Ready Stage 1), one waiver text and one "I have read and agree" tick recorded as a consent, and
    the email-consent tick.
  - **Where the club sets the waiver today:** the season's setup and its record.
  - **The registrations list** (house league), its export and the draft board's notes view, and ruling **A8**: only
    seats that can open registrations see notes and answers.
  - **The family's "Your sign-up" page** and the signed-in family direction (`project_end_state_signed_in_family_app`
    in memory: everyone signs in, no new no-login stopgaps).
- House-league seasons read **in place** when closed (CLAUDE.md, ruling Q16: locked, Money and Email open). A closed
  season's form and answers are read-only on that rule.

## What is already ruled (do not re-open; if you disagree, argue from the reason)

1. **One club form**, generalized from the tournament questions, with these types: short answer, long answer, one
   choice, many choices, yes/no, date, file upload. Each is required or optional, has help text, and sits in a set order.
2. **No branching logic in the first pass.** Push back if asked; that is where form builders get out of hand.
3. **Document blocks:** the club attaches a PDF, and the family must open it before ticking "I have read {document}".
   The tick is recorded with the document's version and the time, like today's waiver consent, and **today's waiver
   becomes one of these blocks without losing a single existing consent record.**
4. **First use: the house-league season sign-up**, with "copy last season's form". Then sponsors (Stage 6), camps
   (Stage 7) and tryouts.
5. **Answers reach** the registrations list (as columns, with a filter), the export and the draft board's notes view,
   under ruling A8.
6. **Gates (2026-11-10, §9):** Board Ready stages ride League Plus and both Club bands; forms reuse the existing
   custom-questions gate (Tournament Plus and up). **The "I have read" tick is never gated.** No pricing restated here;
   see `docs/agents/strategy/PLAN_PRICING_FACTS.md`.

## What the drawing has to decide (ranked asks for the owner at the end)

1. **Per child or per family.** A house-league sign-up carries several children. Which questions are asked once and
   which once per child, and who decides that: the club, question by question, or a fixed rule?
2. **What the form may not replace.** The fixed fields (child's name, date of birth, division, guardian's contact) and
   the friends block drive the draft, money and messaging. Draw where they sit relative to the club's own questions,
   and confirm a club can't remove them.
3. **Changing a form once sign-ups have started.** Adding, editing, reordering or removing a question, or swapping a
   document for a new version, after families have answered. What happens to answers already given, and does a family
   who ticked version 1 get asked again for version 2?
4. **File uploads from families.** Who can open them (a seat, as with permit files), how long they are kept, and how
   large they can be. Run `/legal` on this before drawing it (see below).
5. **The tournament questions.** Do tournaments move onto the same club form in this stage, later, or never? Moving
   them means one editor everywhere, but it also changes a screen that already works and that tournament-only
   organizers use.
6. **Who builds a form:** which seats can edit a season's form, matching who sets up a season today.
7. **The words:** "form", "questions" or "sign-up questions" on the club's side, and what the family sees.

## The stations to draw (desktop and phone, true size, in the house layout)

- **A.** Where a season's form lives in the season's setup, and what an untouched form looks like (today's fixed
  fields and waiver, before any question is added).
- **B.** Building the form: adding each question type, required or optional, help text, reordering, removing.
- **C.** A document block: attaching the PDF, naming it, replacing it with a new version.
- **D.** Copying last season's form.
- **E.** The family's sign-up with the club's questions: two children, per-child and per-family questions, a document
  block that has to be opened before its tick, a file upload, and the errors when something required is missing.
- **F.** Answers on the club's side: the registrations list's columns and filter, one registration's answers, the
  export, and the draft board's notes view, each as a seat that can see answers and a seat that can't.
- **G.** A closed season: the form and its answers read in place, locked.
- **H.** The plan without forms: what the club sees, with the "I have read" tick still available.

## How to run it

- **Mockups are a Claude Artifact HTML page**, never the canvas, in the house layout (sticky tabs, *Everything* /
  *Show only what differs*), whole-screen at true size (`feedback_mockups_as_claude_artifacts`). The coach portal's
  written formatting rules are the benchmark (`feedback_portal_is_the_formatting_benchmark`). Every highlight is
  clickable (`feedback_clickable_design_annotations`). Read the UI conventions in memory before drawing any control,
  window, list or export (reordering, selects, windows and export all have owner rulings).
- **Run `/design` on the mockup before it goes to the owner** (`feedback_always_run_design_on_mockups`); a `/ux` pass on
  the family's sign-up is worth it too, since it is the one page every family fills in.
- **`/legal` before hand-off, not after** (CLAUDE.md). This stage changes what the product collects about people,
  mostly about **children**: a club can now ask anything, including health or medical questions, and families can
  upload files. `/legal` checks what the product tells families, the club's role and ours under the data terms, file
  retention and access, and how the consent record works for a new document version. A policy that would promise what
  the product doesn't do is a defect for `/plan`, not wording to soften.
- **Words:** draft them in the drawing; `/marketing` confirms them after the ruling. One spelling everywhere
  (`npm run check:spelling`).
- **End with the asks**, ranked by how much they change, each with a recommendation, in a paste-back block on the page.
  Record the rulings in `BOARD_READY_PLAN.md` (Stage 4 and §7b) and the Board Ready board line in the same commit, add
  the drawing to `BOARD_READY_PROMPTS_INDEX.md`, then write the build prompt.

## Out of scope

- The sponsor link and camp sign-ups themselves (Stages 6 and 7), beyond leaving room for them.
- Branching or conditional questions.
- Payment on the form (house league's existing payment stays as it is).
- Tryouts' own forms (a later use).
