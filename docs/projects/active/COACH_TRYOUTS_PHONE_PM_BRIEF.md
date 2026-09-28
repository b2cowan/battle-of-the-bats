# PM Brief — Tryouts from a phone

**Status:** measured and drawn 2026-09-25; eight decisions (T1–T8) waiting on the owner. Nothing built.
**Hub:** `COACH_TRYOUTS_PHONE_HUB.html` — https://claude.ai/artifact/QYuRFVutfDhACnjKqfAwsu (mockup · this brief · the plan · decisions). **Plan:** `COACH_TRYOUTS_PHONE_PLAN.md`.

## What changes on tryout day

**For the coach at the gate (check-in).** The list of kids already works in sunlight — big rows, big bib numbers, a clear checked-in state — so it stays. What changes is the strip above it: today it slides up *under* the team name when you scroll, taking the "9 of 14 checked in" count with it. It will stay in view, with search, Add player and Print as one row of thumb-sized buttons. Adding a walk-up puts the cursor straight in First name. And one new button, **Not here yet**, shows only the kids who haven't arrived — the question the gate asks at 8:55 a.m. with sixty names on the list.

**For the coach scoring a player.** Today, if you scroll down the list and tap the ninth player, you land halfway down their scorecard with their name and number off the top of the screen — you can score a kid without seeing which kid. Opening a player will open their scorecard as its own full screen, name and number pinned at the top and Done pinned at the bottom, every time. It is the exact screen your helpers already get on their link, so there is one scorer to learn, not two.

**For the coach watching the live board.** Today each player takes a whole card — one player per phone screen, with the rank and the bib number both printed as "#1". The board becomes a ranked list, one line per player: place, bib and name, score, and how many helpers scored them. Eight players fit on the first screen instead of one. Tap a player for the category-by-category breakdown, exactly as Decide already does.

**For the coach deciding.** Five blocks of explanation (two of them the same sentence) sit above the first player today. They fold into one short note that still says, in the owner's words, *nothing is sent to anyone*. Every button on the board — Offering / Waitlist / Not this season, Add to roster, the family's note — reaches the 44px thumb size; today 69 of them don't.

**At the top of the room.** The stage (Set up · Tryout day · Decide · Build team) moves into a chip beside the page title that opens a small menu — at phone width only three of the four stage tabs fit today, and "Build team" is off the edge with no sign it's there. That frees the top row for the three things a coach flips between all morning: Live board · Check-in · Score.

**For a helper (a volunteer scorer on their own phone).** Their link today shows FieldLogicHQ's public website bar — *Discover · Pricing · Sign in* — printed on top of the team name and the Blind badge. It goes. The "back to all players" link grows from a sliver to a real button, and the link's expiry time reads the way every other time in the product does ("12:45 p.m.").

## What is deliberately not changing
Nothing is sent to families, from any button. The boards stay ranked by score — the same order the desktop shows — with the line that explains the order kept directly above them and the helper count on every row. Coaches still see names; the names switch still governs helpers only and stays everywhere it is today. Scores stay whole numbers; the scorecard, the setup checklist and the tryout report keep their shapes. The desktop is untouched.

## Why it matters
Tryout day is the most phone-bound day of a coach's year — check-in at a gate, scoring on a diamond, helpers on cold links — and the fall tryout window is open now. Two of the findings are not cosmetic: a coach can score the wrong child without seeing it, and every volunteer who opens a scoring link sees a sales bar over the scorer.

## Priority
The helper's link first (smallest change, the most exposed screen, in front of parents this month), then the open player, then the gate and the top of the room, then the boards. A test fixture comes first of all, so each step is measured by the build and not by hand.

## Customer impact
Every coach who runs a tryout on the Premium Coaches Portal, and every helper they invite. No change for families, for club admins, or on the desktop.

## Decisions the owner is asked for (details on the hub)
T1 the top of the room · T2 check-in · T3 the scorer · T4a the live board · T4b Decide · T5 the family's sign-up page (recommended: its own small project) · T6 a test fixture on the UAT team · T7 fix the helper's site bar now, ahead of the rest (recommended) · T8 the tryout history page, which nothing links to (recommended: retire it).

## Success criteria
- On a 390px phone the first ranked player on the live board sits in the first screen, and at least six are visible at once (today: one).
- Opening any player to score — from anywhere in a long list, on either door — shows that player's name and number and the Done button without scrolling.
- Zero controls under 44px on check-in, both scorer doors and Decide at 390 and 360, and nothing under 12px on check-in and the scorer (the field floor).
- A helper's link shows no public-site bar at any width.
- The layout sweep measures seven tryout screens (today one), so none of this can quietly regress.
