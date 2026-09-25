# PM brief — Coaching from a phone

**Date:** 2026-09-19 · **Plan:** `COACH_MOBILE_EXPERIENCE_PLAN.md` · **Hub (mockup · plan · brief · QA walks):** `COACH_MOBILE_EXPERIENCE_HUB.html`, published as a Claude Artifact · **Priority:** high — the phone is how most coaches will use the Premium portal in-season · **State:** walked and drawn 19 Sep 2026; stage 0 ruled, built, walked (§208 · Coaching from a phone, 25/25) and committed 20 Sep; **stage 1 drawn 20 Sep, ruled 21 Sep (B1 · B3 · B4 as drawn, B2 = B) and BUILT ON DEV 21 Sep; §210 walked 21 Sep, 24/24, all four parts pass — committed ff0068bb 21 Sep; stage 2 (the Schedule) DRAWN 20 Sep, redrawn on three owner reads 21 Sep, RULED 21 Sep (C1–C4 build as drawn; the desktop phone-first), BUILT ON DEV and COMMITTED `bb928e41` 21 Sep — §216 WALKED 21 Sep, 35/35 PASS across all six parts, no findings.** **Stage 3 (Game week) built + §220 walked complete 22 Sep (`c9ed52b8`), with D12/D13 — the builder's four phone panels as drawers — ruled, built and §223 passed the same day. Stage 4 (Practice week & skills) DRAWN 22 Sep, RULED 22 Sep (E1 = option A; E2 · E3 · E4 · E5 as drawn) and BUILT ON DEV 22 Sep — §225 walk owed, uncommitted. What a coach gets: the practice plan's toolbar 148px → 44px with the desk work behind a "⋯" drawer; a player on the recording screen 117px → 56px with the whole row as the door; the observation dialog a coach opens twelve times a practice re-cut so its Save is 56px and DOCKED rather than 33px floating over 392px of dead space, with "Save & next player" carrying the coach through twelve players without one page scroll; the running count docked above the nav; one date in one place and the hub's create a 44px "+". No migration. ⚠ Two things for the owner beyond the walk: a skill row's state now reads "Recorded" rather than "Saved" at every width (the Review table has said Recorded since stage 2, so the row was the odd one out), and the stage surfaced a finding wider than itself — NO dialog footer anywhere in the portal has a phone or tablet tap floor, which wants a ruling of its own because fixing it moves every sheet in the product.** **A /review pass then found four High defects in the new recording dialog, all fixed before handoff: two of them lost a coach's work — a sentence typed beside "Not assessed today" was discarded on save (it is now kept as that mark's reason, visible on the row and editable), and the two-step save cleared the not-assessed mark before writing the record, so a failed write could leave a player with neither. Neither was findable by an automated check; both needed a coach to make a specific pair of choices.** **Since then:** stage 4 committed `3a8c69da` and §225 passed 23 Sep; stage 5 (People) ruled 23 Sep, built, §228 walked and passed 24 Sep, committed `5a3e6888` 24 Sep. **Stage 6 (Reports) — the last stage — DRAWN 24 Sep, RULED the same day (every ask as recommended) and BUILT ON DEV 24 Sep; ledger §232 walk owed (hub tab "QA walk · 6"); uncommitted; plan §14.10.** One change beyond the rulings is flagged for the owner's veto: the tab row's scroll arrows are now a finger wide on touch screens.

## What we are proposing
A staged re-shaping of the Premium Coaches Portal for phones. Not a redesign: every screen, word, door and figure stays. What changes is the *container* each one sits in at phone width, so a coach with one thumb reaches the day's tool in one tap and reads the day's facts on the first screen.

## What a coach sees and does differently
- **More is a real sheet.** Tap More and the whole menu rises from the bar — Practice plans, Lineups and Skills & Goals as the first three tiles — instead of a narrow list that hides half of itself and scrolls inside.
- **One line says where you are.** The team name and record sit in a slim line at the top of every screen; a chat room has one header, with back on the left where every other screen keeps it. *Stage 1 (ruled 21 Sep, built):* a coach with more than one team switches teams by tapping the team name itself — a chevron opens a short sheet of their teams, and those rows left More; and every screen, the Overview included, wears the same one line — the club and season sit in a quiet line under it on the Overview that scrolls with the page. Nothing jumps under the thumb any more and the “?” never disappears, on a phone or a tablet.
- **The first screen fits the phone.** *(Built 21 Sep.)* Overview's six tiles are six rows — the figure and one qualifier each, the whole row a door — and the game-day card's two jobs (attendance, the lineup) are two full-width taps while its call time and kit join the facts line. Measured: the Overview is 948px against 1,104, and all six rows sit above the bar at 390×844.
- **Schedule opens on today.** *(Ruled, built and committed 21 Sep; walked 21 Sep, 35/35 PASS.)* On a phone the list itself scrolls under the page title: it opens already positioned on today — today’s game directly under its month header, which pins as you slide up into the past or down into the future; no fold row, no toolbar row (the List · Week · Month switch is one icon button beside “+”, the way a phone calendar does it), and the rows share one white frame like the Overview’s; week view collapses runs of empty days to one line; month view shows dots and lists the day you tap, today pre-selected; the event sheet puts attendance and the lineup first until first pitch and the score first from then on, with Edit · Cancel · Delete as one quiet row at the foot, the attendance rows in one frame, a player’s RSVP a bottom sheet (tap the player, tap the answer — the GameChanger pattern) and every control at 44px — the September cleanup already brought the first player to the first screen, so this stage’s bigger win is the tap floor (28 of the sheet’s 29 controls were under it). One question is the owner’s: whether today-first is a phone change or the list’s change on every device (recommended: every device).
- **Lineups start with the players.** Setup folds into one self-describing line once a lineup exists; undo, redo, print, templates and clear become one icon row. *(Drawn 2026-09-21 — D1–D5 on the hub’s “3 · Game week” tab: the row opens the builder’s own panel, a new lineup wears the primary tone; on the owner’s read the grid becomes one inning at a time on a phone — a pinned ‹ Inning N of M › stepper, the previous and next inning’s positions in small type beside this inning’s control, drag to reorder — and Back from the lineup returns to the game it was opened from; the sheet’s Lineup door moves to the top and its batting order flips through innings; ruled 2026-09-21 — build as recommended; **built on dev 2026-09-21** (plan §9.8): the first player on a phone at 612px, was 844; 47 controls where there were 108; **owner walk §220 COMPLETE 2026-09-22**. Two owner fold-ins landed the same day: the Templates panel lost its per-row delete ✕, and **Clear positions moved out from under the grid into the icon row as its fifth square** — on a phone it had a whole band to itself with nothing beside it.)*
- **Recording at practice is one tap per player.** A player is a row; the dialog offers Next player; the tally and Review stay docked above the bar.
- **"Saved" stops sitting over the work.** It appears only while something is saving and fades a couple of seconds after it has; only a failed save stays, with its Retry. *(Revised 2026-09-20: drawn first as a word in the title row; on the desktop that word scrolled away with the row.)*
- **The field is readable at arm's length.** The console's positions and counts come up to body and support sizes.
- **A player opens as a record, not a form.** On a phone the player's Details tab shows what you set — number, positions, pitching, bats and throws — as plain lines you can read at the fence, with an **Edit** button on the section when you want to change something. It is the same face a coach without editing rights has seen since September; this gives it to the head coach too. Switching player becomes the same gesture as switching team: the player's name carries a small chevron, and tapping it opens a short sheet of the roster with the one you are on marked — so you go straight to Devon instead of spinning a dropdown, and the row that dropdown sat on disappears. The chat list puts your own team's rooms first. *(Drawn 2026-09-22 — F1–F4 on the hub's "5 · People" tab; **the switcher redrawn 2026-09-23 on the owner's read** — it was first drawn as back/next arrows, which made reaching the ninth player eight taps; **ruled 2026-09-23 — build as designed, F4 included.** One addition the plan never asked for: **Family & paperwork** is the other tab that opens as a form, and it is the one that answers "who do I call?" — as a record, a guardian's phone number becomes a number you tap.)*
- **Reports read down their columns.** *(Stage 6, ruled and built 24 Sep — measured: attendance 2,707 → 1,496px, playing time 3,825 → 2,268, the practice review 1,727 → 944.)* The attendance report is twelve rows, not twelve stacked cards — the whole roster in one screen once you reach it, so the player missing practice stands out in the column. Playing time, Results and the awards history keep their columns but finally do what the table standard always said: the player (or the date) stays pinned on the left while you swipe, and a small hint says what is off to the right. When you open a report further along the tab row — Development, Awards, Scouting Book — its tab is in view, so you can see which report you are reading. The week-in-review notification stops at two lines on a phone — its page says the rest; other notifications stay whole. The practice review opens on the last practice you actually held instead of next month's plan, and each practice is one short row rather than a tall card.

## Why it matters
The portal was built desktop-first and adapted to the phone screen by screen. The adaptations are individually reasonable and cumulatively heavy: 131px pinned before content, a menu that hides half of itself, a schedule that opens in April, a lineup whose first player is under the first screen, a recording page that asks for four gestures per player. Coaches use this product at the fence. Every stage returns screen to the work and taps to the tool — measured, not guessed: the plan carries the numbers.

## What this touches elsewhere
Nothing moves, nothing is renamed, no data changes. The desktop is untouched at every stage; the sidebar and the phone sheet keep the same groups and order (the guard test that pins them equal holds). The in-app help's "getting around on a phone" guidance is updated with stage 0 (`/docs`), and the demo tour's phone stops that open More are re-checked by the build gate.

## Role-based access
No new differences. An assistant sees fewer doors in the sheet (the same gating as the sidebar today); a viewer sees the read faces they see today. Nothing a coach cannot do today becomes possible, and nothing they can do today goes away.

## Trade-offs
- Two arrangements per screen where the phone diverges (rows vs tiles; folded vs open setup). Kept to the container so copy and data have one source.
- The bottom bar's four tabs stay. The owner may swap Roster for a season tool after stage 2 if the sheet does not settle it — the question is on the hub (Q 0.2) with a recommendation to keep.
- Stage 5's gate is clear — the roster and player page walk (§182) passed 40/40 on 13 September. Its own trade-off is a real one: a head coach who opens a player to change a jersey number now taps **Edit** first. The station's job is three reads, so the trade looks right, and it is the part of that stage to push on.
- ⚠ **The test fixture's players all have blank records**, so the phone measurements on the player page are a floor rather than a total, and the People stage cannot be QA-walked until one fully filled player is seeded. Named on the hub rather than worked around.

## Sequence
Stage 0 first (the shell — cheap, and it lifts every other screen); then the first screen and the Schedule, which are the roads to everything; then game week, practice week, people, reports. Each stage is drawn on the hub at true size, ruled by the owner, built, reviewed and walked before the next begins. **Open the hub's stage tab on an actual phone** — the frames are true size and that is the only test that settles a tap target or a type size.

## Success criteria
- Practice plans, Lineups and Skills & Goals each one tap from any team screen.
- Pinned chrome at rest ≤110px on every team screen but Overview; no screen with two stacked headers.
- The Schedule's first upcoming row on the first screen at 390.
- The lineup grid's first row on the first screen at 390 once a lineup exists.
- No Saved pill at rest anywhere — it appears on an edit and fades after the save; no console text under 12px; the whole roster's attendance on one screen once reached (restated 24 Sep: the first wording, "the attendance report under 1,600px at 390", measures 1,597 with the change — a pass by three pixels that a fourteen-player team would fail, because a page height moves with the roster).
- No report opens with its own tab off the screen; no report table on a phone scrolls sideways without its first column pinned and a hint.
- The layout sweep green at 361/390/768/1440 on every touched screen, with the new field-floor rule.

## Addendum — the two drawer layers (owner ruling, 23 Sep 2026; built and guarded the same day)

**What the coach sees change.** On a phone, three drawers in the Lineup builder — **Setup &
Auto-fill**, **Templates**, and **Call up a player** — now cover the bottom navigation while they are
open, and the dimmed page includes the bar. Two others, **Print** and the **player row menu**, are
unchanged: the bar stays visible and tappable beneath them. Nothing outside the builder moves — the
More sheet, the team switcher, the practice plan's "⋯" and the position picker all behave exactly as
they do today. Two small additions come with it: the Setup drawer's close **×** now appears on a
phone (it was desktop-only), and the Templates drawer finally **says it is Templates** and has a way
out of its own.

**Why it matters.** The three drawers that moved are the ones a coach *works in* — settings to set,
a template name to type, a call-up's details to enter. Until now they dimmed the page like a modal
but left the navigation bar live underneath, so a thumb on *Schedule* walked the coach out of the
lineup mid-edit with no warning. Nothing on screen said the bar was still armed. Now that same tap
closes the drawer, which is what the surface already looked like it would do.

**The rule behind it, in one line:** a **form** covers the navigation; a **menu** sits on top of it.
The portal has worked this way for dialogs since July; this is the builder catching up.

**One thing a review pass caught before the walk, worth knowing.** The first build covered the bar
visually but left it reachable by **keyboard and screen reader** — so a coach using either could
still tab onto *Schedule* and leave the lineup mid-edit, on a screen that had just been declared
modal. The three drawers now use the same mechanism every other dialog in the portal already
does: the bar **removes itself** while they are open, rather than being painted over, and the page
behind them stops scrolling. Nothing changes on a desktop.

**Trade-off.** Two drawers opening from adjacent squares on the same toolbar now behave differently.
They keep the identical look, and the bar disappears exactly when there is work to lose — which is
the only moment the difference matters.

**How to test it.** On a phone: open **Setup**, confirm the bar is gone and a tap where *Schedule*
used to be closes the drawer rather than leaving the lineup; do the same with **Templates** (type a
name first) and **Call up a player**. Then open **Print** and the **row menu** and confirm the bar is
still there and still works. Full walk shape in the plan, §13.8.

**Priority:** done — folded into the phone programme rather than sequenced separately.
**Success criterion:** no drawer in the portal dims the page while leaving the navigation live
underneath it.

## Stage 6 — Reports (drawn 24 Sep 2026, for the owner's ruling)

**What we are proposing.** The season's reports read the way a report should on a phone — down a
column. Attendance stops being twelve stacked cards and becomes a three-column table (it fits a 360px
phone with room to spare). The reports that are genuinely too wide for a phone — Playing time, Results,
the awards history — keep their columns but get the finish the table standard already asked for: the
player or the date stays pinned while you swipe, and a small hint names what is off to the right. The
awards history becomes a list of cards with one "⋯" per award instead of three tiny stacked icons. When
you open a report further along the tab row, its tab is in view. The practice review opens on the last
practice you held, with what is still to come folded into one row above it, and each practice is one short row (76px, not 170–217) now that the sentence repeating its status chip goes. The week-in-review
notification stops at two lines on a phone (its page says the rest; other notifications stay whole).

**Why it matters.** The one question a coach brings to the attendance report — *who has been missing
practice?* — was answerable only by reading twelve cards over two and a half screens. Playing time was
four and a half screens tall because player names were squeezed onto three lines each, and the one
warning on that page (a pitcher over the innings cap) sat in a column you could not see and nothing said
was there. Three of the seven reports opened with their own tab off the screen, under a title that only
says "Insights".

**Expected impact (measured on the test team, each change switched on in the real page).** Attendance
2,707 → 1,597px; Playing time 3,825 → 2,272px, with every player of the summary on the first screen;
Results keeps the result beside the game at both phone widths; the awards history fits a small phone for
the first time and its twelve sub-44px icons become one 44px button per award; the practice review's
first real practice moves from the fold to a third of the way down the first screen, three practices fit on it
where none did, and the page is 1,727 → 955px; a week-in-review
notification 215 → 133px (the only notification clamped — its page says the rest).

**Two things found on the way.** The Results tab counts the season's scrimmage in its run-differential
chart while the Dashboard (and every other figure) does not — so one season reads +6 on one tab and +1
on the next. It is a one-line fix, offered as a ride-along (R6). And the phone rule the walk proposed —
"a table that fits stays a table" — turns out to be an amendment to the owner's own table standard
rather than an application of it; it is written up as one (R1).

**Role-based access.** None changes. Every figure, order, permission and word stays except one
spelling: "Playing time" (the tab said "Playing Time" beside finding chips that say "Playing time").

**Trade-offs.** On a phone, Results' type and tags, and Playing time's later columns, are a swipe away —
by design, with a hint. The column order of Results changes at every width (Type moves after Score).
The three remaining small controls on these screens stay with the separate touch-target project.

**Priority.** The last stage of the phone programme. **Success:** the whole roster's attendance on one
screen once reached; no report opens with its own tab off the screen; no report table scrolls sideways
without its first column pinned and a hint; one run differential for one season.
