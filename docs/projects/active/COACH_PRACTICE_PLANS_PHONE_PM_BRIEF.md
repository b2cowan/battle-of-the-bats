# PM brief — Practice plans on a phone

**Date:** 2026-09-23 · **Plan:** `COACH_PRACTICE_PLANS_PHONE_PLAN.md` · **Hub (walk · stage drawings · plan · brief · QA walks, one artifact for the project's life):** `COACH_PRACTICE_PLANS_PHONE_HUB.html`, published as a Claude Artifact at `https://claude.ai/artifact/73DbeziBqDjMr4QEhRWTvp` · **Priority:** high — the plan editor is the last weekday coaching screen that has never been designed for a phone · **State:** walked and measured 23 Sep 2026; stage 1 ruled 23 Sep (K1–K4 = A), built and walked (§227 passed 24 Sep); the rotation table ruled and built 24 Sep (§229); stage 2's stations measured, drawn, ruled (S1 · S2 · S4 = A) and built 24 Sep — **walked and passed 25 Sep (ledger §231, committed 6d775e85)**; S3, reordering, was ruled and built the same day in another session. **Stage 3 (the field) measured and drawn 25 Sep; its four questions were re-framed with the owner before drawing (M1–M4); ruled the same day (all four as recommended, plus Back on a station), built, reviewed and committed `a44987b1` + `d81e4523`. **Stage 3b (the field, full screen) asked, drawn, ruled (M5 = A, M6 = B) and built the same day; it replaced stage 3's phone bar. One walk for both, ledger §240 — walked and passed 25 Sep.**

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

**Stage 3 — the field (ruled and built 25 Sep; its phone bar replaced by stage 3b the same day; walked and passed with 3b, §240).** The coach never scrolls to move the practice on. **Back and Next block (or Rotate now) sit at the foot of the screen**, just above the tab bar, in the same place on every stop and every station. Today every station hides Rotate now below the tab bar (all 9 on the real plan, 118–302px; up to 795px on a long plan), a stop with a real paragraph hides Next block, and on the stops that fit the button sits anywhere from 270 to 619px down. **Each tap opens its screen at the top**: today, after Rotate now on a long station, "With you now" (the new group, the one thing that changed) opens above the top of the screen. **A station gets Back beside Rotate now** (the owner's ask), so a round moved on by accident is one tap back. Today it takes three taps out through the stop and back in. **A stop reads like a station**, with the same headings (What you're doing · What you're watching for · Coaching points). A stop built from a drill shows the drill's setup, equipment and note for tonight, which it leaves out today. **"Just for tonight" comes first on a station**, not eighth after Setup, Equipment and Running it. **No swipe between stops**: the phone's back gesture already goes up one level, and a swipe beside it would go somewhere else. These four were re-framed with the owner from the planned three once the screen was measured. The "does the note lead?" question turned out not to be the lever, and it stays as an option.

**Stage 3b — the field, full screen (asked, drawn, ruled, built, walked and passed 25 Sep; §240).** The owner asked for Run practice to open over the app, like the block sheet does, so a stray tap can't leave the practice. The run keeps nothing once you leave it, so a stray tap used to lose the coach's place. Now Run practice fills the phone, with no team line and no tab bar. The foot becomes a stepper like the sheet's, **‹ Block 2 of 4 ›**, which can jump to the next block even mid-rotation. A rotating block adds a row above it with **Rotate now** and, from round 2, a labelled **‹ Round 1**. Each block remembers its round while the run is open. The coach gets 109px more screen (713px of words on a plain block at 390, from 604), and the foot is always in the same place. The trade-off: checking Chat mid-practice means leaving the run and coming back to the list. Built with every foot button at 56px, so a rotation's foot is 135px (651px of words), and the last block's › place reads "Done" (on a computer too), taking the coach to the plan and "How it went".

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
- The field's foot takes 73px of a plain block on a phone and 135px of a rotation, and a short stop gets an empty stretch between its words and the foot. That is the price of the buttons being in the same place every time — paid for by the 109px the covered team line and tab bar give back. Chat mid-practice is ← Plan and back in (stage 3b). With headings on a stop, a long plan's last coaching points need one short scroll; putting "What you're watching for" first (option B) avoids that, but the drill then reads backwards for an assistant arriving cold.
- The alternative the owner first framed — narrow the left margin and stay in place — was measured honestly: it gives the fields back ~26px and leaves the block 1,000px tall in the flow. It is on the hub as option B.

## Sequence

Stage 1 first — it is most of the complaint and it is the container every later stage draws inside. Then stations and the rotation, then the field, then the head of the page. Each stage is drawn on the hub at true size, ruled by the owner, built, reviewed and walked before the next begins. **Open the hub's stage tab on an actual phone** — the frames are true size and that is the only test that settles a tap target.

## Success criteria

- At 390: a shut block ≤ 60px and never truncated; a writing field ≥ 350px wide; the title field holds "Small-sided game — no keepers"; the minutes chips on one line at 390 and 360.
- Opening a block moves nothing else on the page.
- A three-block plan written from blank at 390 without returning to the list.
- The station form one tap from "+ Add a station", with the cursor in its name; three stations ≤ 220px while editing (measured 222 — 2px over: the rows match the block list’s 58–59px, not the drawing’s 56); an untouched new station gone after a reload; the rotation readable on a phone without sideways scroll (stage 2 — the table part met 24 Sep, §229).
- The field's advance button reachable without scrolling on every stop and every station, at the same place on each, at 390 and 360, on the real plan and a long one (stage 3). After Rotate now, "With you now" on screen. "Just for tonight" on screen one of every station on the real plan.
- On a phone, no tab or team switcher on screen during a run; a block skipped by mistake is one tap back, on the round and station the coach left (stage 3b — met on the build, 25 Sep).
- The layout sweep green at 361/390/768/1440 on the plan page, the sheet open, and the field.
