# Tournament admin redesign · the Divisions step: a ticked list, a phone window per division, headings by age

> Paste into a fresh session on `dev`.
>
> **Where it comes from.** The owner's walk §290 (Stage 5's first walk, "a first tournament, at a desk") found step 2 of
> the New tournament window too bulky. It opened six always-open youth cards (217px each, 1,520px of form in a 707px
> window at 1400 × 900; 2,140px on a phone), and the count of divisions couldn't be read at a glance. The six-card start
> was never a ruling. It came from the old wizard, and Stage 5's E1 ruled only "each a labelled card on a phone". Drawn
> in two rounds on a standalone sheet on 2026-10-11, each round through the `/design` review, and **RULED the same day**:
> the owner said *"agree with your recommendations"*, so **all seven asks are as recommended**.
>
> **The spec is the sheet:** https://claude.ai/artifact/L7ddaLNLxucvkZN1vgCLBz (v2 or later; source
> `docs/projects/archive/TOURNAMENT_DIVISIONS_STEP_OPTIONS.src.html`). It isn't on the redesign's hub yet (Close-out).
> - Build **to the drawings exactly** (memory `feedback_build_to_approved_mockups`), at true size: the 640px window at a
>   desk, 390 on a phone. The drawings are interactive. Use them: tick, open, add, change ages.
> - **Every tag note is a requirement.** Open each one.
> - **The sheet's "What the reviews changed" lists** (round 1, round 2, and what was not taken) are your checklist.
> - Where you must depart, say so at build time and record why. Never depart silently.
>
> **The ruling (2026-10-11), every ask as recommended:**
> 1. **The start:** nothing ticked.
> 2. **The shape:** the ticked list (the shared form table). *Start from* goes.
> 3. **At a desk** a division's fields open **in place** under its arrow; the window is the phone's.
> 4. **On a phone**, a ticked division opens its window and its box alone unticks it; an unticked one ticks wherever
>    tapped.
> 5. **A division you add** sits under the heading its ages decide (Youth in age order, Adult, Other), and **moves there
>    if its ages change**.
> 6. **The two written rules** (the form table's phone row opens in place; standard §3.10.8 opens a form full screen):
>    **full screen for divisions only**, written into the standard as the form table's one full-screen row. New
>    allocation's rows keep opening in place.
> 7. **One spelling:** **U12** for a tournament division (`/marketing` words it). Club team names (“13U AAA”) are not
>    touched.
>
> **The unchosen options are not built:**
> - B (one division waiting for its name), or today's six ticked
> - toggle chips, or a card per division
> - the window at every width
> - "the row always ticks, only the › opens"
> - a "Your own" heading in the order added
> - full screen for every form table's phone row
> - 12U

## Read first

- **The sheet, whole,** then **plan `TOURNAMENT_ADMIN_REDESIGN_PLAN.md` §6e** (E1 and its ruling). E1's "each a labelled
  card on a phone" is superseded for step 2 by this ruling.
- **`docs/agents/design/TABLE_AND_LIST_STANDARD.md`:** §3.6, the form table, every line, plus "Delete is never a row
  action"; §3.10.8 (a row that opens a form opens it full screen on a phone); §3.10.6 (a row that opens is a real
  button, olive-soft hover).
- **The parts you build with, never a second one:**
  - `components/shared/FormTable.tsx` and its stylesheet: the lead tick, groups with their box, expand in place, the
    closing row, the phone frame. **The club's New allocation (`AllocationWindow.tsx`) uses it, and
    `tests/unit/club-stage3c-screens-guard.test.ts` holds that.**
  - `KitDialog` (`kind="form"`, `raised`; on a phone it fills the screen with ←; the window floor: Escape and the
    phone's Back close the top window only).
  - **`NewVenueSheet.tsx`,** the model for the add window (raised over the setup window; Cancel `btn-outline` plus a
    lime Add; it asks, and the host decides what Add does).
  - The 32px figure input (`Money.module.css` `.shareInput`, New allocation's).
- **The step today:** `components/admin/TournamentSetupWizard.tsx`, its step 2 body and these parts of it:
  - `DIVISION_PRESETS`, `DivisionRow`, `divisionRow`, `starterAges` (the ages read from a name);
  - `divisionsPayload` (today's three checks; it silently drops a nameless division);
  - the review step's Divisions row and `preview()` (the live preview's Divisions and Team Spots).
- **The words:** `lib/tournament-setup-words.ts` `CREATE_WORDS` (step 2).
- **Memory:**
  - `project_tournament_divisions_step` (this work, and its lesson: check the form table before drawing a pick-many);
  - `feedback_build_to_approved_mockups`, `decision_drawer_layers_form_vs_menu` (why full screen, not a half sheet);
  - `decision_edit_autosaves_create_asks` (the add window asks; edits apply as typed);
  - `decision_record_reads_first_edits_whole` and its 2026-10-09 note (why an arrow, not a pencil; why the edit window
    has no Done);
  - `feedback_shared_component_over_shared_class`, `feedback_portal_is_the_formatting_benchmark`.

## Preconditions (check before code)

1. **The End-date fix: committed `bf82fa60` and `a2ee9734` 2026-10-11** (owner-verified, `/review`ed). It sits in this
   same file. A filled-in End date follows the Start date. Whether the End was picked is remembered in both forms
   (`endPicked`), and the End fields store what is typed, with no clamp. The rule is `endDateFollowingStart` in
   `lib/timezone.ts`, used by both Start-date handlers; its tests are in `tournament-stage5-create.test.ts`. It was
   found on the same walk (step 4). Check `git log` shows both commits; don't change the rule here.
2. **The dev server** starts only with `npm run dev`, with network access. Don't fix another session's code.
3. **`/marketing` confirms the words before you build them** (the list below). The placements are ruled; the words are
   `/marketing`'s.
4. **The UX summary for the owner comes first** (AGENCY_RULES), short:
   - a one-division exhibition: one tick, Next;
   - a three-age-group youth event: three ticks, or the Youth heading;
   - adding "U12 Girls" on a phone;
   - what goes: *Start from*, the cards, the remove ×.
5. **Ask the owner whether another session is measuring** before any probe or sweep. One browser tester at a time.

## ⚠ Running beside other work (as of 2026-10-11)

- **Club Tier Stage 10a (permits)** may be building. On 2026-10-11 the tree held another session's uncommitted edits in
  these files:
  - venue files (`lib/venue-*`, `components/venue/*`, the venue routes);
  - **`lib/help-content/tournaments.tsx`**, `memory/design_decisions.md` and `TODO.md`;
  - the Club plan and hub.
- **The redesign's own plan and hub may also hold another session's edits.** The rules (Stage 2's):
  1. **Neither session edits the other's files.** If a file you must touch has someone else's uncommitted edits, stop
     and tell the owner.
  2. Typecheck your commit's own tree in an isolated copy (`git archive` of the staged tree, `node_modules` junctioned
     in) when the whole tree is red from other work.
  3. Stage by explicit pathspecs from a private index; commit only your hunks of shared docs.
  4. Stay off the dev server during another session's captures or sweeps.
  5. Take the next free Owner QA Ledger § when you write a walk, after re-reading the ledger (§295 was the highest on
     2026-10-11).
- **The form table is shared with Club** (New allocation). Part 1 is an **option** that leaves New allocation rendering
  exactly as today. Its guard stays green untouched.
- **Queued, don't start:** the free tournament tier review, the platform admin support console. The wizard's free-plan
  parts stay as today.

## What to build (ruled 2026-10-11)

### Part 1 · The form table's one full-screen phone row (Ask 6): its own commit

- **A table-level option on `FormTable`** (named at build), for a table whose phone rows open their own window. On a
  phone it changes four things, for that table only:
  - **Every row (group heading or record) shares one 48px lead column for its box,** padded 12px from the frame's edge.
    It clears the 44px floor, and every box lines up with its heading's box.
  - **A ticked row** is two targets that touch and never overlap (RepKit's `rowItemBeside` idea):
    - **the box alone** unticks it;
    - **one button** covers the rest of the row: the name, the row's `phoneLine` under it, and the house row chevron
      last (`ChevronRight`, 16px, `--text-tertiary`, 0.8rem from the right edge, `.rowChevron`'s). The button calls the
      row's open handler. Hover is olive-soft only. Its accessible name says the row's summary and that it opens.
  - **An unticked row** stays one label (box and name) that ticks wherever tapped. It has no line and no chevron.
  - **No `phoneFigure`** on these rows; the summary lives in `phoneLine`.
- **At a desk the option changes nothing.** Expand in place stays.
- **The tick box stays 18px.** The round-2 review's 22px was not taken, because it would change every form table.
- **The standard, in the same commit.** §3.6's form-table phone sentence becomes: "…a row opens in place the same way,
  **except the New tournament window's Divisions step, whose rows open their own window full screen (§3.10.8): the form
  table's one full-screen row** (owner, 2026-10-11, walk §290 Ask 6)." Update `FormTable.tsx`'s header comment the
  same way.
- **A guard:** New allocation does not pass the option (the 3c guard green, unchanged); the wizard does.

### Part 2 · The Divisions step as a ticked list (Asks 1, 2, 5, 7)

- **Step 2's body** is the lede (unchanged), then the form table, then an outline **"+ Add a division"** button under it
  (40px at a desk, 44 on a phone; the Plus glyph).
- **What goes:**
  - *Start from* and its select;
  - the Add-a-division field and its 12U example;
  - the division cards and their outlined ✕;
  - the "No divisions yet" hint (the closing row says it now; check its words with `/marketing`).
- **The rows.** The nine presets are always listed:
  - **Youth:** U9, U11, U13, U15, U17, U19;
  - **Adult:** Open, Competitive, Recreational.
  - **Nothing is ticked when the window opens,** and again on its reset.
  - **Only ticked rows are created:** the payload, the live preview's Divisions and Team Spots, and the review step's
    row all count ticked rows only.
  - **Next with none ticked still works,** as today; the draft's board asks for a division before Activate.
- **Columns at a desk:**
  - Division (the lead: box and name);
  - Ages, plain text: "Up to age 11", "Ages 9 to 11", "18 and over", "Any age";
  - Teams it holds, a figure: the 32px input on ticked rows, empty on unticked;
  - the arrow, on ticked rows only.
- **Group headings.**
  - The words: Youth, Adult and **Other**. Other appears only when it holds a row.
  - Each heading's box ticks its group: checked, mixed or empty.
  - The count reads "6 divisions".
  - The heading's Teams cell holds the ticked team spots.
- **The closing row.**
  - At a desk: "3 divisions" and the sum.
  - On a phone, the frame's band says "3 divisions · 24 team spots" ("team spots" matches the preview's Team Spots).
  - With nothing ticked, the closing row's words come from `/marketing` (drawn "No divisions ticked").
- **Headings follow ages (Ask 5).**
  - **The rule:**
    - an oldest age under 18 → **Youth**, sorted by oldest age (stable), so U12 Girls lands between U11 and U13;
    - a youngest age of 18 or more → **Adult**;
    - anything else → **Other**, in the order added.
  - **A row's placed heading is UI state only,** set when it's added and re-derived when its arrow (desk) or window
    (phone) **closes**, never while you type.
  - A row that lands or moves gets a brief olive-soft wash.
  - **Nothing new is stored.** Divisions have no heading column, and none is added. Confirm in the schema snapshots;
    no migration.
- **The desk's arrow (Ask 3)** opens the row's own form in place. It holds today's fields and words:
  - Division name * (a required marker, never an optional tag);
  - Youngest and Oldest;
  - Split into pools, with How many pools, the pool names and Teams pick their pool.

  Teams it holds stays in the row. **A cleared name holds the row open with the red line;** the arrow won't close it.
- **Mistakes.** Today's three checks keep their words: a name listed twice, Teams it holds under 1, Youngest over
  Oldest. Pressing Next with one of them **opens that division**, its arrow at a desk or its window on a phone, with its
  red line. An error never hides in a closed row.
- **Spelling (Ask 7).** With the field gone, the 12U example goes too. Grep the tournament division copy (screens, help
  articles and their `keywords` / `searchText`, demo lines) for the NNU form and align it to U-first. Club team names
  are out of scope.
- **Retire the step's old look** (`TournamentSetupWizard.module.css`: the starter, add-division, card, remove, grid,
  check-line and pools rules this step no longer renders). Use Stage 1's method; lock the drop with
  `check:old-look --init` (in an isolated copy if another session has files modified).

### Part 3 · A division's window: add at both widths, edit on a phone (Asks 3, 4)

**One component** (e.g. `components/admin/tournament/DivisionSheet.tsx`) on `KitDialog kind="form" raised`. It has
NewVenueSheet's shape; it is never a second window kind and never a half-height sheet.

- **Add (both widths)**, from "+ Add a division":
  - **The window:** titled "New division", centred over the setup window with its scrim at a desk, full screen with ←
    on a phone.
  - **The fields, in order:**
    - Division name *;
    - Youngest and Oldest;
    - the hint ("Its ages decide its heading: an oldest age under 18 is Youth, a youngest age of 18 or more is Adult,
      and anything else is Other.");
    - Teams it holds (8);
    - Split into pools, and its pools.
  - **Typing a name like "U12" fills Oldest** (`starterAges`) while Oldest is untouched.
  - **The footer:** Cancel and a lime **Add division**. Cancel, ← and Escape keep every tick in the list.
  - **Add division with a blank name** stops with "Give the division a name." (new words). **A name already listed**
    stops with today's `divisionDuplicate` words. Otherwise the division is ticked, placed under its heading and washed.
- **Edit (phone only):** opened by a ticked row's button (Part 1).
  - **The head:** the title is the division's name; the line under it is its summary ("8 teams · up to age 13").
  - **The fields:** the add window's, Teams it holds included.
  - **No footer.** ← and the phone's Back close it (the 2026-10-09 record-window ruling: no Done beside ←).
  - **Edits apply as typed.** Nothing saves until *Create the draft*.
  - **A cleared name holds the window** with "Give the division a name."
  - **On close** the heading is re-derived.
- **The phone summary line** reads "8 teams · up to age 11": "ages 9 to 11", "18 and over", "any age". It uses the
  desk's words, lower-cased mid-line.

## The words for `/marketing` (Precondition 3)

**New:**
- the column headings "Division" and "Ages" (Teams it holds is kept);
- the heading "Other" and the group count "N divisions";
- the closing row with nothing ticked;
- the phone band "N divisions · N team spots";
- the ages phrases (desk and phone);
- "+ Add a division";
- "New division", "Add division";
- "Give the division a name.";
- the heading hint;
- the door's accessible name ("U11: 8 teams, up to age 11. Open its fields").

**Kept:** the lede, Youth and Adult (now the headings' words), every field label, today's three mistakes.

**Retiring:** `starter`, `starterCustom`, `addDivisionPlaceholder`, `removeDivision`, and perhaps `noDivisions`.

## Don't

- Change New allocation's look or behaviour. Part 1 is an option.
- Add a stored heading, a column or a migration.
- Build a half-height sheet, a pencil with ✓, a remove × on a row, a Done beside ←, or toggle chips.
- Touch the house league onboarding's division presets (`LEAGUE_DIVISION_PRESETS` in the onboarding page); they are a
  different product.
- Change the reuse paths (*Start from a past tournament*, into this draft). They copy divisions as today.
- Redesign any free-plan part of the wizard (the free tier review's).
- Change the tick box size.

## Verification

- `npm run verify:changed` and `npm run typecheck` (the shared form table changes).
- **Tests.** Put the step's pure rules in a lib module and test them:
  - heading by ages;
  - placement order (U12 Girls between U11 and U13, Varsity under Other, a 12-to-40 range under Other);
  - re-deriving on close (U11 edited to "20 and over" moves under Adult);
  - nothing ticked on open;
  - a payload, preview and review count of ticked rows only;
  - the blank-name and duplicate refusals.

  Also guard:
  - New allocation unchanged;
  - the option on, for the wizard only;
  - the wizard with no Start-from select, no 12U example, no division cards and no row ✕.
- **Probes** (in `.probe/`, asserting on state, writing nothing):
  - **At rest:** with three ticked, the step fits the 707px window body at 1400 × 900 (the drawing measured 675px); at
    390 the drawing measured 772px.
  - **On a phone:** a ticked row's button opens its window full screen, and ← returns with the ticks kept.
  - **Add a division:** "U12 Girls", oldest 12, lands between U11 and U13; "Varsity" lands under Other.
  - **Refusals:** a cleared name holds; a duplicate stops with today's words.
  - **Tap floor:** every tap target at 390 is 44px or more (the box column is 48).
  - **Taps:** a one-division event is one tick and Next.
- **The layout sweep:** the wizard's entry, if it has one, at 390 / 360 / 768 / 1440 in both themes, with `--only=`.
- Re-measure the built step against the sheet's figures and report any gap.

## Close-out

- **Offer `/simplify`, then `/review`,** before the commits: a shared-component option, derived grouping, a new window.
- **Commit only when the owner says.** Part 1 (the form table and the standard) is one commit; Parts 2 and 3 are one;
  the records are one. Commit on `dev` from a private index with explicit pathspecs.
- **Records** (until then the ruling lives here and on the sheet):
  - plan §6e: "§290 walk finding: the Divisions step (ruled 2026-10-11, built `<hash>`)", noting E1's phone-card line
    superseded for step 2;
  - the PM brief's Stage 5 line;
  - an in-repo `memory/design_decisions.md` entry: the ticked list, a phone window per division, headings by age, the
    form table's one full-screen row;
  - the TODO line;
  - the sheet's banner set to "Built `<hash>`";
  - the sheet folded into the redesign's hub as a Stage 5 addendum. Read the live hub copy whole before publishing.
- **Help (`/docs`):** the creation article in `lib/help-content/tournaments.tsx`: ticking divisions, the headings, Add a
  division, a division's window on a phone. Check that file for another session's edits first.
- **Demos (`/demos`):** none expected (no tour anchor on step 2). Check, and say so.
- **The owner's walk:** one purpose, "divisions, at a desk and on a phone", as its own Ledger § (the next free one).
  **If §290 is still open** when you build, tell the owner which of its steps your build changes; step 13 makes one
  division.
