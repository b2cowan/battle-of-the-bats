# Coach Roster — the chrome above the list, on a phone

**Status: BUILT ON DEV 2026-08-24. Owner QA §93 owed. No migration.**

Approved mockup (interactive, before/after at true 390px, self-measuring):
https://claude.ai/code/artifact/59f76b6b-9d4a-4fb4-a7f4-b3c66b7581de

Trigger: owner, on a 390px Roster screenshot — *"this mobile header is taking up way too much
space"*. The review that followed found the header was **not the larger half**: the masthead and
title band cost ~200px, and the three toolbar rows plus two hint rows below them cost about the
same again. **Two of the six causes were defects against rulings already on the books**, not design
choices.

---

## §0 · What was actually wrong

| | Defect | Severity | Ruling it broke |
| --- | --- | --- | --- |
| **A** | The view toggle spanned the full row, pushing the export off the end | High | — (cascade leak, below) |
| **B** | The export rendered **bottom-left**, under the toggle | High | House rule 2 (2026-08-23): *pinned right at every width* |
| **C** | The identity bar was four lines because the status slot refused to shrink | Medium | — |
| **D** | A stranded `·` opened the third line ("· 2026 Season") | Medium | The `.teamHeaderMeta` comment claims this cannot happen |
| **E** | A sentence set in the numeric face | Low | `design_principles.md` — that face is for scores and numeric columns |
| **F** | Two hint rows above a list the coach had not reached | Low | — |

⚠⚠ **A AND B WERE ONE ROOT, AND THE ROOT WAS A FORM FIELD'S RULE REACHING A TOOLBAR.**
`.segChoice` carries `display: flex; width: 100%` at ≤640 under a comment that names its own real
subject — *"equal-width segmented choices (Home/Away/Neutral) go full-width rather than squashing
their labels"*. That is correct for a choice inside a **form** and wrong for a view toggle riding a
**toolbar**. At 390px it took the whole row; `.listToolbarEnd` then wrapped, and a wrapping
`inline-flex` puts its second line at its own **left** edge — which is exactly where the export was
found. The house rule was not being ignored; it was being overruled by a stylesheet two hundred
lines away.

**Generalise:** a shared class whose comment names a specific context is a class with a scope its
selector does not state. Before reusing one, read what its own comment says it is for.

⚠ **D is a comment that was true about the wrong thing.** `.teamHeaderMeta`'s note reasons about a
segment being **absent** — the separator is drawn between siblings, never punctuated into a string,
so a missing middle cannot orphan a dot. All true, and not this. When the line **wraps**, the second
span's `::before` starts the next line. A comment that proves one failure impossible reads, at a
glance, as proving the whole class impossible.

---

## §1 · The ruling (owner, 2026-08-24)

> **The right-hand slot of the identity bar does not render at phone width. Game day is not an
> exception.** *"game day and practice day should be the same, just remove this from the mobile
> header. its a waste of space. coaches know they have a game that day."*

**I argued for a game-day carve-out and was overruled correctly.** The argument was that on game day
the slot is a **door** (the bench console), not a fact. Two things settled it against me:

1. **The carve-out did not fit either.** Drawn at 390px it truncated to `6:30 p.m. · O…`. A door that
   ends in an ellipsis is not a door. **Two separate attempts to keep the slot by making it smaller
   both failed** — the first printed it over the meta line — and that is the evidence for removing it
   rather than shrinking it.
2. **The door was never homeless.** *Schedule* is on the phone's bottom bar on every page, and inside
   the live window the game's row there grows its own **Game day** action. The Overview anchor card
   offers the same. The masthead link was a third shortcut, and it is the one being spent.

⚠ **What the slot's original ruling was actually solving.** 2026-08-02 (Option B) put status on the
right because *"a standalone team's bar was 70% empty space"* — **a desktop problem**. It was never
a phone argument, which is why removing it on phone does not reverse that ruling. **Desktop is
untouched.**

⚠ **≤640, NOT ≤900.** The masthead's other phone rules sit at ≤900 because that is where the bottom
nav replaces the sidebar. This one is about a 390px row running out of horizontal space, so it takes
the portal's phone breakpoint. **A tablet has the room and keeps the status.**

---

## §2 · What was built

**A + B — one toolbar row, export pinned right** (`coaches.module.css`, ≤640 block beside
`.listToolbarEnd`). `.listToolbarEnd` goes `nowrap` + `min-width: 0`; `.listToolbarEnd .segChoice`
is scoped back to `fit-content`; `.segBtn` side padding 1rem → 0.7rem; the live fact ellipsizes.

⚠⚠ **`.listToolbar` ITSELF DELIBERATELY KEEPS `flex-wrap: wrap`, AND THAT IS NOT AN OVERSIGHT.**
Forcing the toolbar to nowrap is what put **30px of sideways page scroll on coach-expenses at 361**
(recorded beside `.viewToggle`). With a long fact — a team with inactive players — the fact takes
line one and the toggle+export share line two: **two rows, never three, export still right-pinned.**
Degradation, not overflow. No screen may scroll sideways.

**C — the status off the phone.** `CoachTeamHeader` gained a `.teamHeaderStatus` wrapper:
`display: contents` above the breakpoint (so desktop is byte-identical and the chip/stack stay direct
flex children), `display: none` at ≤640.

⚠ **THE WRAPPER EXISTS FOR ONE REASON AND IT IS NOT TIDINESS.** The **public-site flip** shares
`.teamHeaderRight`. Hiding that container wholesale would have taken the flip with it — a **door**
removed silently by a width rule, which is the same failure class as B. Only the status hides.

**D — the meta line held to one row** at ≤640, club name ellipsizing (it is the variable segment;
season and record are short and fixed).

**E — `.teamHeaderStackValue` → `var(--font-sans)`.** The key above it keeps the data face; labels
are its other job. **Desktop-only in effect** now that C removed the slot from phones — listed
honestly as out of scope for the reported problem rather than counted toward the win.

**F — the reorder tip moved below the list**, at every width, not only on a phone. The nudge
("11 without a position") stays above it: that one is actionable state about the coach's data, while
the tip explains a control drawn on every row underneath. One control, one place to read about it.

---

## §3 · Verification

`npm test` **2450/2450**. Typecheck, CSS-module purity (252 sheets), palette contrast: clean.

**Rendered sweep** (`--only=coach-roster,coach-schedule,coach-depth-chart,coach-overview,coach-team-hub`):
**zero new findings at the screens and widths this change governs** — roster@390 36/36 baselined,
roster@768 24/24, schedule@768 19/19, and no sideways scroll anywhere.

⚠ **THE 11 "NEW" FINDINGS IN THAT RUN ARE NOT THIS CHANGE, AND THE ATTRIBUTION WAS PROVEN, NOT
ASSUMED.** Three independent checks: (1) the tap-floor pass walks `document.body.querySelectorAll`,
**the whole DOM, not the viewport** — so shorter chrome cannot reveal new elements, which kills the
obvious hypothesis; (2) the baseline's own key reads `button·Season setup3/5` where today renders
`4/5` — **the signature embeds a progress counter that moved**, the documented churn source; (3)
every flagged element (Overview's insights link, the depth chart's pitching controls) sits outside
any selector this change touches. ⚠ The baseline file is itself **another session's uncommitted
work** (` M`, generated 14:39 today) — `--init` was deliberately NOT run, as it would bake their
drift in under this change's name.

**Measured outcome** (Playwright + `resolveUatContext()`, computed geometry, not a screenshot):

| width | masthead | status slot | meta | toolbar | rows | export | first row | sideways |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 361 | 56px | not rendered | 1 line | 47px | **1** | pinned right, 44px | 244px | none |
| 390 | 56px | not rendered | 1 line | 47px | **1** | pinned right, 44px | 244px | none |
| 768 | 56px | rendered | 1 line | 33px | 1 | pinned right | 243px | none |
| 1440 | 58px | rendered | 1 line | 33px | 1 | pinned right | 309px | none |

⚠⚠ **THE EXPORT COULD NOT BE MEASURED FROM THE FIXTURE, AND A GREEN RUN THERE WOULD HAVE BEEN A LIE.**
At ≤640 the roster export's phone-surviving choices are the two PDFs, both `feature: 'pdf_exports'`
— **a plan gate**. The UAT fixture team lacks it, so its phone toolbar renders **no export at all**,
and "the export is fine" would have been a green check over an empty fixture. Proven instead by
injecting a probe control into the real `.listToolbarEnd` under the real stylesheet: **gap from the
toolbar's right edge = 0px, height 44px, one row, at 361 / 390 / 414.**

⚠ Before-numbers are **estimated** (~400px of chrome) from the reported screenshot's geometry, not
measured on this fixture — the after column is the only measured half. Do not quote a delta as
measured.

---

## §4 · Open, and deliberately not done

**The `<h1>` title band was NOT touched.** ⚠ Measured 2026-08-24: **60px** at 390px on a typical screen (44px box + 16px margin) and **116px on Overview**, where the actions wrap — NOT the ~72px first estimated here. ⚠⚠ And the 44px box **is the tap floor on the help "?"**, so deleting the title TEXT saves nothing; the saving lives in the "?" and the "+". Deleting it saves more than anything above, and
the word "Roster" already appears in the bottom nav's active pill directly beneath it. It stays
because it would break *"all forty coach screens open the same way"* (2026-08-11, ruled and shipped)
— a portal-wide call across forty screens, and the shape of **direction D**, which the 2026-08-18
note put back on the table. It deserves its own session, not a fix smuggled in behind five smaller
ones.

**✅ HELP CONTENT SYNCED in the same unit of work** (`/docs`, 2026-08-24). A full sweep of
`lib/help-content/` found **exactly two** affected places, both in `coaches.tsx`:
- **"The bar across the top"** (`premium-portal-tour-header`) — the right-hand slot is now stated as
  **computer-or-tablet**, with a new paragraph saying a phone bar is identity only, that this holds
  **on game day too**, and where "what's next" actually lives instead. The **⇄ Public site** link is
  explicitly called out as surviving on a phone (it does).
- **"Game day: running the bench from your phone"** — the sentence *"the team masthead's 'Game day'
  line becomes a link"* left the main paragraph, replaced by a second paragraph naming the **Schedule
  tab at the bottom of the screen** as the quickest way in at the field, with the masthead link
  correctly scoped to a computer or tablet.

⚠ **THE OLD SEARCH TERMS WERE KEPT, DELIBERATELY, AND THAT IS THE JUDGEMENT CALL.** The obvious move
was to delete *"game day in the header"* / *"next event in the header"* now that they describe
nothing. That is backwards: **a coach whose phone stopped showing it will search exactly those
words.** Deleting them makes the answer unfindable at the moment it is most wanted. They stay, and
the article now answers *"where did it go?"* — joined by the phrasings a coach actually types
(*"no next on my phone"*, *"where did game day go"*, *"how do i open game day on my phone"*).

**Checked and clean, needing no change:** the free-tier *"How to build your roster"* section (it
describes the separate basic-coach screen, which this pass did not touch); the depth-chart FAQ's
*"List / Depth chart toggle at the top"* (still true); the scouting book's masthead **nudge** row
(a different row, untouched); and the coach tours + demo dock copy (**no step narrates the masthead
status**). No help copy ever described the roster's above-list hints, so moving the reorder tip
needed no edit.

[[COACH_HEADER_ACTIONS_CONSISTENCY_PLAN]] · [[COACH_HEADER_VERTICAL_SPACE_PLAN]] · Owner QA §93
