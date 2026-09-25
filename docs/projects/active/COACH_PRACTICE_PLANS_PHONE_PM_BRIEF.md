# PM brief — Practice plans on a phone

**Date:** 2026-09-23 · **Plan:** `COACH_PRACTICE_PLANS_PHONE_PLAN.md` · **Hub (walk · stage drawings · plan · brief · QA walks, one artifact for the project's life):** `COACH_PRACTICE_PLANS_PHONE_HUB.html`, published as a Claude Artifact at `https://claude.ai/artifact/73DbeziBqDjMr4QEhRWTvp` · **Priority:** high — the plan editor is the last weekday coaching screen that has never been designed for a phone · **State:** walked and measured 23 Sep 2026; stage 1 ruled 23 Sep (K1–K4 = A), built and walked (§227 passed 24 Sep); the rotation table ruled and built 24 Sep (§229); stage 2's stations measured, drawn, ruled (S1 · S2 · S4 = A) and built 24 Sep — **walk owed (ledger §231, hub QA walk part L)**; S3, reordering, was ruled and built the same day in another session.

## The problem in one sentence

A coach writing a practice plan on their phone types into fields **half the width of the screen**, inside a block that opens to **more than two screens tall** and pushes the rest of the plan out from under them every time they open it.

Measured, not felt: on a 390px phone a writing field is 197px wide (about 28 characters a line) and the title field is 106px ("Small-sided game" does not fit); opening one block grows the page from 1,650px to 2,546px and moves the next block 895px down; the rotation grid scrolls sideways inside a 197px box. Running a practice, by contrast, is in good shape — the field screen was drawn for a phone and measures like it; only the station screen buries its "Rotate now" under the fold.

## Why it has never been fixed

The phone programme ("Coaching from a phone") deliberately stopped at the toolbar above the plan — its stage 4 names "the practice plan's sheet itself" as not reopened. The practices re-evaluation that built the editor drew every screen on a desk. Nobody has been asked to make the editor fit a phone; this project is that ask.

## What we are proposing

A staged re-shaping of the plan editor and the field screen for phones. Not a redesign: every field, word, door and permission stays. What changes is the *container* each one sits in at phone width.

## What a coach sees and does differently

**Stage 1 — the block on its own screen (drawn, ruling owed).** The plan is a short list of blocks — one line of title and one line of facts each, nothing cut off — with "+ Add a block" at the foot. Tap a block and it opens on its own screen, the shape "Add a station" already has: every field at full width, the minutes chips on one line, six players on two lines instead of six. A bar at the foot walks to the previous or next block without going back; Done returns to the list exactly where it was, with the block you edited picked out. Move up, Move down and Delete sit on the sheet's head. Stations, groups, equipment and the library doors are all in the sheet, where they are on the card today.

**Stage 2 — stations and the rotation (built 24 Sep).** The rotation table fits a phone (§229). The stations inside a rotating block are built as drawn (§231). **Each station becomes one short row**: its name, who runs it, and a "Just for tonight" flag when it has a note, with the whole row opening it. Today it's a card with a line just for the word "Open". Three stations drop from 463px to 222 while editing (measured; 387 → 177 reading), so the rotation, the groups and "Edit groups" come onto the screen the coach is on. **"+ Add a station" opens the new station with the cursor in its name.** That's one tap to the first letter instead of five, and the library is one tap in ("Start from a drill ›"), which is how a new block already works. **A station started by mistake goes away if you leave it empty.** Today it stays in the plan for good (measured), counted in the list but skipped by the rotation. Reordering stations by drag, with a tap menu, was ruled and built the same day. The station's own screen already fits a phone and is unchanged.

**Stage 3 — the field.** Back · Next · Rotate now docked above the bottom bar so the coach never scrolls to move the practice on — the station screen has that button 224px under the fold today.

**Stage 4 — the head of the page.** What sits above the first block on a phone (the "sent to" line, the when-block, the goal) — about 500px before the plan begins.

## Who it affects

Every Premium coach and assistant who writes plans on a phone or small tablet, and — read-only — anyone who opens a plan there, including a past practice's record. The desktop and larger tablets are unchanged at every stage. Plan templates get the same treatment because they are the same editor.

## Why it matters

Practice plans are the Premium portal's weekday tool and the one most often written in a car park or a kitchen, not at a desk. The phone programme made every other weekday screen fit a phone; this is the last one that does not, and it is the one with the most typing in it.

## What this touches elsewhere

Nothing moves, nothing is renamed, no data changes, no migration. The desktop editor and the tablet band keep the timeline with the block open in place. The in-app help's practice-plan articles gain a "on a phone" paragraph at build (`/docs`). The demo tour has no stop on the editor.

## Role-based access

No new differences. A coach without plan-writing rights sees the read face in the sheet, as they see it on the card today; a viewer of a finished practice reads the record the same way. Nothing a coach cannot do today becomes possible.

## Trade-offs

- A coach cannot see the rest of the plan while editing one block on a phone. The sheet's eyebrow ("Block 2 of 3 · 11:00 p.m.") and the ‹ › stepper are the mitigation; a phone cannot show both.
- The plan's look diverges more between phone and desk than any screen so far (a list vs a timeline with the block open in place). Copy and data have one source, so nothing can drift but the container.
- Stage 1 left the rotation grid scrolling a little on a phone; it was fixed on 24 Sep by keeping the table and taking out what made it too wide (the "by round" idea was drawn and withdrawn: it was the tallest shape).
- Stage 2's station row shows *that* a station has a note for tonight, not the note itself. The words are one tap in. Showing them in full is option B.
- Stage 2 puts the library one tap deeper when adding a station (the same as adding a block). Getting to a picked drill's own screen is still three taps, as today. Two doors on the add row (option B) would make it two.
- An empty new station is removed when you leave it, so a coach can't park blank placeholder stations to fill in later; typing a name keeps one.
- The alternative the owner first framed — narrow the left margin and stay in place — was measured honestly: it gives the fields back ~26px and leaves the block 1,000px tall in the flow. It is on the hub as option B.

## Sequence

Stage 1 first — it is most of the complaint and it is the container every later stage draws inside. Then stations and the rotation, then the field, then the head of the page. Each stage is drawn on the hub at true size, ruled by the owner, built, reviewed and walked before the next begins. **Open the hub's stage tab on an actual phone** — the frames are true size and that is the only test that settles a tap target.

## Success criteria

- At 390: a shut block ≤ 60px and never truncated; a writing field ≥ 350px wide; the title field holds "Small-sided game — no keepers"; the minutes chips on one line at 390 and 360.
- Opening a block moves nothing else on the page.
- A three-block plan written from blank at 390 without returning to the list.
- The station form one tap from "+ Add a station", with the cursor in its name; three stations ≤ 220px while editing (measured 222 — 2px over: the rows match the block list’s 58–59px, not the drawing’s 56); an untouched new station gone after a reload; the rotation readable on a phone without sideways scroll (stage 2 — the table part met 24 Sep, §229).
- The field's advance button reachable without scrolling on every stop and every station (stage 3).
- The layout sweep green at 361/390/768/1440 on the plan page, the sheet open, and the field.
