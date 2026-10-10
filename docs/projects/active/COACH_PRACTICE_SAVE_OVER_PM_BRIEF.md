# Save over a practice template, a drill or a circuit — PM brief

**Status:** drawn and ruled as drawn 2026-10-02 (D1–D12); built on dev 2026-10-02; owner QA §260 ✅ PASSED 2026-10-07 on the owner's word. Plan: `COACH_PRACTICE_SAVE_OVER_PLAN.md`. Hub: `COACH_PRACTICE_SAVE_OVER_HUB.html`.

## What changes for the coach
Practice plans have three saves: a whole practice as a **template**, one activity as a **drill**, and a block of stations as a **circuit**. Today each one only creates, and a name you already have is refused after you press the button. With this change, all three can **save over** the one you have, the way the lineup builder's Save as template does now:

- Each window has a **name field, already filled in**. A new name saves a new one. A name you already have turns the button into **Replace** (templates) or **Update** (drills, circuits).
- The button leads to an **are-you-sure inside the window**. It shows what the saved one holds now and what it will hold, then gives a red confirm and Keep it.
- **Tags are replaced** by the ones being saved. A drill or circuit starts with its current tags, so nothing is wiped by accident.
- **An updated drill reaches upcoming practices.** Every practice that hasn't happened yet and still has the drill linked gets the new words. Past practices keep the version they ran. The question names the upcoming practices first.
- A block placed from a circuit gets a **Save to my circuits…** door.
- Two circuit-save bugs are fixed. An untitled block can be saved, because the window asks for a name. A name clash, or the 60-circuit limit, is caught before any drills are made.

## Why it matters
Coaches refine the same few activities all season, and the natural moment to improve a drill is the practice where they improved it. Today saving that means retyping it on the Drills tab, and next week's practices still show the old words.

## Customer impact
Every coach using the practice library, most of all mid-season. One rule changes on purpose: drills used to be copied and never updated. Now upcoming practices follow the drill and past ones don't, so what a coach looks back on stays true.

## Priority
Medium. Templates and circuits reuse existing routes. The drill update is the one new piece of work: a server walk over the team's upcoming practices, on a pattern the product already uses for staff and equipment tags.

## Success criteria
- A coach improves a drill during a practice and saves it back in one window.
- Next week's practices show the improved drill untouched by hand, and last week's still read as run.
- No "You already have a … called …" dead end in any practice save.
- A circuit save never leaves drills behind for a circuit that was then refused.
