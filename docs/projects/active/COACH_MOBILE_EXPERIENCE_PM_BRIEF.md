# PM brief — Coaching from a phone

**Date:** 2026-09-19 · **Plan:** `COACH_MOBILE_EXPERIENCE_PLAN.md` · **Hub (mockup · plan · brief · QA walks):** `COACH_MOBILE_EXPERIENCE_HUB.html`, published as a Claude Artifact · **Priority:** high — the phone is how most coaches will use the Premium portal in-season · **State:** walked and drawn 19 Sep 2026; stage 0 ruled 20 Sep (A1–A4 build as drawn) and BUILT ON DEV 20 Sep — owner walk §208 owed (the hub's "QA walk · 0" tab).

## What we are proposing
A staged re-shaping of the Premium Coaches Portal for phones. Not a redesign: every screen, word, door and figure stays. What changes is the *container* each one sits in at phone width, so a coach with one thumb reaches the day's tool in one tap and reads the day's facts on the first screen.

## What a coach sees and does differently
- **More is a real sheet.** Tap More and the whole menu rises from the bar — Practice plans, Lineups and Skills & Goals as the first three tiles — instead of a narrow list that hides half of itself and scrolls inside.
- **One line says where you are.** The team name and record sit in a slim line at the top of every screen; Overview keeps the fuller header. A chat room has one header, with back on the left where every other screen keeps it.
- **The first screen fits the phone.** Overview's six tiles become six one-line rows — the figure and one qualifier each — and the game-day card's taps are big enough to hit.
- **Schedule opens on today.** The season so far folds above it; week view skips empty days; month view shows dots and lists the day you tap; on game day the event opens on attendance and the lineup, not the score box.
- **Lineups start with the players.** Setup folds into one self-describing line once a lineup exists; undo, redo, print and templates become one icon row.
- **Recording at practice is one tap per player.** A player is a row; the dialog offers Next player; the tally and Review stay docked above the bar.
- **"Saved" stops sitting over the work.** It appears only while something is saving and fades a couple of seconds after it has; only a failed save stays, with its Retry. *(Revised 2026-09-20: drawn first as a word in the title row; on the desktop that word scrolled away with the row.)*
- **The field is readable at arm's length.** The console's positions and counts come up to body and support sizes.
- **Tables that fit stay tables.** The attendance report is twelve rows, not twelve stacked cards.

## Why it matters
The portal was built desktop-first and adapted to the phone screen by screen. The adaptations are individually reasonable and cumulatively heavy: 131px pinned before content, a menu that hides half of itself, a schedule that opens in April, a lineup whose first player is under the first screen, a recording page that asks for four gestures per player. Coaches use this product at the fence. Every stage returns screen to the work and taps to the tool — measured, not guessed: the plan carries the numbers.

## What this touches elsewhere
Nothing moves, nothing is renamed, no data changes. The desktop is untouched at every stage; the sidebar and the phone sheet keep the same groups and order (the guard test that pins them equal holds). The in-app help's "getting around on a phone" guidance is updated with stage 0 (`/docs`), and the demo tour's phone stops that open More are re-checked by the build gate.

## Role-based access
No new differences. An assistant sees fewer doors in the sheet (the same gating as the sidebar today); a viewer sees the read faces they see today. Nothing a coach cannot do today becomes possible, and nothing they can do today goes away.

## Trade-offs
- Two arrangements per screen where the phone diverges (rows vs tiles; folded vs open setup). Kept to the container so copy and data have one source.
- The bottom bar's four tabs stay. The owner may swap Roster for a season tool after stage 2 if the sheet does not settle it — the question is on the hub (Q 0.2) with a recommendation to keep.
- Stage 5 (the player's read face) waits for the roster and player page walk (§182).

## Sequence
Stage 0 first (the shell — cheap, and it lifts every other screen); then the first screen and the Schedule, which are the roads to everything; then game week, practice week, people, reports. Each stage is drawn on the hub at true size, ruled by the owner, built, reviewed and walked before the next begins. **Open the hub's stage tab on an actual phone** — the frames are true size and that is the only test that settles a tap target or a type size.

## Success criteria
- Practice plans, Lineups and Skills & Goals each one tap from any team screen.
- Pinned chrome at rest ≤110px on every team screen but Overview; no screen with two stacked headers.
- The Schedule's first upcoming row on the first screen at 390.
- The lineup grid's first row on the first screen at 390 once a lineup exists.
- No Saved pill at rest anywhere — it appears on an edit and fades after the save; no console text under 12px; the attendance report under 1,600px at 390.
- The layout sweep green at 361/390/768/1440 on every touched screen, with the new field-floor rule.
