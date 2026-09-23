# PM brief — Practice plans on a phone

**Date:** 2026-09-23 · **Plan:** `COACH_PRACTICE_PLANS_PHONE_PLAN.md` · **Hub (walk · stage drawings · plan · brief · QA walks, one artifact for the project's life):** `COACH_PRACTICE_PLANS_PHONE_HUB.html`, published as a Claude Artifact at `https://claude.ai/artifact/73DbeziBqDjMr4QEhRWTvp` · **Priority:** high — the plan editor is the last weekday coaching screen that has never been designed for a phone · **State:** walked and measured 23 Sep 2026; stage 1 drawn 23 Sep, ruling owed (K1–K4).

## The problem in one sentence

A coach writing a practice plan on their phone types into fields **half the width of the screen**, inside a block that opens to **more than two screens tall** and pushes the rest of the plan out from under them every time they open it.

Measured, not felt: on a 390px phone a writing field is 197px wide (about 28 characters a line) and the title field is 106px ("Small-sided game" does not fit); opening one block grows the page from 1,650px to 2,546px and moves the next block 895px down; the rotation grid scrolls sideways inside a 197px box. Running a practice, by contrast, is in good shape — the field screen was drawn for a phone and measures like it; only the station screen buries its "Rotate now" under the fold.

## Why it has never been fixed

The phone programme ("Coaching from a phone") deliberately stopped at the toolbar above the plan — its stage 4 names "the practice plan's sheet itself" as not reopened. The practices re-evaluation that built the editor drew every screen on a desk. Nobody has been asked to make the editor fit a phone; this project is that ask.

## What we are proposing

A staged re-shaping of the plan editor and the field screen for phones. Not a redesign: every field, word, door and permission stays. What changes is the *container* each one sits in at phone width.

## What a coach sees and does differently

**Stage 1 — the block on its own screen (drawn, ruling owed).** The plan is a short list of blocks — one line of title and one line of facts each, nothing cut off — with "+ Add a block" at the foot. Tap a block and it opens on its own screen, the shape "Add a station" already has: every field at full width, the minutes chips on one line, six players on two lines instead of six. A bar at the foot walks to the previous or next block without going back; Done returns to the list exactly where it was, with the block you edited picked out. Move up, Move down and Delete sit on the sheet's head. Stations, groups, equipment and the library doors are all in the sheet, where they are on the card today.

**Stage 2 — stations and the rotation.** A station is a row inside the block sheet that opens its form in one tap — and that form is already a proper phone screen (full-width fields, "station 1 of 3", Next in the foot); it is the *new* station that is four taps from its first field today, because "Write one" adds a blank card behind a 31px button instead of opening the form. The rotation reads *by round* on a phone instead of a grid that scrolls sideways.

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
- Stage 1 leaves the rotation grid scrolling a little on a phone (404px in a 358px box); stage 2 draws it by round rather than fixing it on the way past.
- The alternative the owner first framed — narrow the left margin and stay in place — was measured honestly: it gives the fields back ~26px and leaves the block 1,000px tall in the flow. It is on the hub as option B.

## Sequence

Stage 1 first — it is most of the complaint and it is the container every later stage draws inside. Then stations and the rotation, then the field, then the head of the page. Each stage is drawn on the hub at true size, ruled by the owner, built, reviewed and walked before the next begins. **Open the hub's stage tab on an actual phone** — the frames are true size and that is the only test that settles a tap target.

## Success criteria

- At 390: a shut block ≤ 60px and never truncated; a writing field ≥ 350px wide; the title field holds "Small-sided game — no keepers"; the minutes chips on one line at 390 and 360.
- Opening a block moves nothing else on the page.
- A three-block plan written from blank at 390 without returning to the list.
- The station form one tap from "+ Add a station"; the rotation readable on a phone without sideways scroll (stage 2).
- The field's advance button reachable without scrolling on every stop and every station (stage 3).
- The layout sweep green at 361/390/768/1440 on the plan page, the sheet open, and the field.
