# Tournament admin redesign · Stage 6 drawn — The volunteers (the scorekeeper and the gate)

> Paste into a fresh session on `dev`. Written 2026-10-07, after Stage 4 (after the event) was built, walked (§275 ✅,
> §276 ✅) and released (job 277). **Design only: no product code until the owner rules.** Round 2 of the joint
> sequence: Club Tier Stage 3c's drawing may run at the same time. Read "Working beside the other sessions" before
> touching the dev server or a shared file.
>
> **Read first:**
> - `TOURNAMENT_ADMIN_REDESIGN_PLAN.md`:
>   - §1: evidence. Label every guess as a guess.
>   - §2: the rulings not reopened. One of them: **the scorekeeper and the gate are fixed Warm.**
>   - §3: **F36** (the volunteer screens, "the strongest in the tournament product", with four open items), F13
>     (the gate's board changes with the organizer's, built in Stage 1), F14 (the Staff kit works) and F37 (controls
>     under 44px).
>   - §4: the nine rules across the stations.
>   - §5: the ladder, row 6. **Phone only.**
>   - §6 Stage 1 as built: the check-in board the gate shares with the organizer, and one word per game state.
>   - **§6d Stage 4, as drawn and as built.** This is the newest method, and its record is the model for yours.
>   - §7: A2, A11, A12.
>   - §11: the formatting check. Run it before the owner sees anything.
> - **The volunteers' own journey:** `docs/projects/archive/journeys/JOURNEY_J8_SCOREKEEPER_GATE.md`. It has 23
>   findings; the hub counts 14 as fixed since June. Re-verify every one against today's code.
> - The volunteer shells' standing decisions:
>   - in-repo `memory/tournament-scorekeeper-experience.md`;
>   - the comment at the top of the shells' shared bottom bars. **Owner, 2026-08-07, Option C:** status buckets
>     under the thumb AND duties as tabs, with ~110px of fixed bottom chrome, chosen with that cost stated. Don't
>     reopen it without measured evidence.
>   - the header flip to the public pages (owner, 2026-07-24).
> - The hub (ONE artifact; republish the SAME path): `docs/projects/active/TOURNAMENT_ADMIN_REDESIGN_HUB.html` =
>   https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM.
>   - **Walk tab, station 12** (the scorekeeper and the gate).
>   - The Stage 1, 2 and 4 tabs, for the drawing method.
> - Memory: `project_tournament_admin_redesign`, `feedback_portal_is_the_formatting_benchmark`,
>   `feedback_build_to_approved_mockups`, `feedback_clickable_design_annotations`, `feedback_mockups_as_claude_artifacts`.

## The rulings your drawings follow (in-repo `memory/design_decisions.md`)

- **Phone sheets are one frame with two layers: a form covers the bar, a menu sits on top of it** (2026-10-05). Sheet
  Frame closed 2026-10-07, and its frame now answers every sheet's Escape and Back. D4: the admin's bottom sheet takes
  18px corners and the portal's dim the next time it is touched. The gate's team sheet is the organizer's, shared.
- **A waiting count is the amber pill** (2026-10-01). This is the ruled answer to F36's "the Review filter doesn't
  signal waiting scores". Draw it; don't invent a new signal.
- **2026-10-07:**
  - A filter is quiet until it filters.
  - The olive pill chooses what is read.
  - A close × is a plain glyph.
- **2026-10-06:** a row's flags go under the name on a phone. It was ruled on the coach's game-day board; it is the
  nearest precedent for a phone row in a hurry.
- **From Stage 1:**
  - One word per game state.
  - A row's worded action is olive; lime is one main action per screen.
  - A row that opens, opens from anywhere.
- **One control height is a computer rule** (34px, 2026-10-03). On a phone the floor is 44px, and these screens are
  phone only.
- **The install banner now sits under every phone sheet** (2026-10-06). Re-measure F36's banner item; it may be
  half fixed.

## Verify before drawing

- **F36's four items and all 23 J8 rows.** Tag each on the hub: open, fixed (with its commit) or partly. Draw only
  what is open.
- **"Fixed Warm".** Confirm from code that both volunteer screens ignore the theme. If they do, draw Warm only and
  say why on the tab: no Dark copy, because these screens have no Dark. If they don't, draw both themes.
- **Where each volunteer lands after signing in** (J8-019, J8-020, J8-021), read from code for the `official` role
  and the `staff` role.
  - Say which of those landings is the tournament product's to decide and which belongs to the admin frame or to
    the roles.
  - ⚠ **`staff` is an org role on every plan, Club included.** Club Tier Stage 1 ruled the role defaults, so a
    change to where `staff` lands is shared.
- **The gate is Stage 1's check-in board inside a volunteer shell.** Note what Stage 1's rebuild already gave the
  gate, and what the shell adds (the tournament picker, the bottom bars, sign-out, the flip). Stage 6 draws only
  what the shell adds. The board itself is tagged UNCHANGED, Stage 1's.
- **Which sheets on these screens stand on the shared frame,** and which don't. A sheet the gate shares with the
  organizer changes for both, so that is an ask.
- **The Staff kit** (the organizer's door to the volunteers: QR codes, links, a printable page). F14 says it works.
  Run the formatting check on it and look for it in `npm run check:old-look:report`. Draw it only if it fails.

## What Stage 6 draws (phone first; measure a tablet too, since a scoring table often has one)

1. **The scorekeeper, whole screen, before and after.**
   - The list: Up next, the status buckets, the Review bucket's waiting count.
   - The score sheet: one large score box; Cancel and Submit at 44px; the policy note.
   - A submitted score's state, and what a volunteer sees when the organizer finalizes or sends it back.
   - Words such as "Submit for Review" (Title Case today) are tagged `/marketing`.
2. **The gate, whole screen, before and after:** the shell around the shared board (the tournament picker, the team
   sheet's frame, payments as Stage 1 built them). Only what the shell adds is NEW or RESTYLED.
3. **One volunteer, two jobs.** An official can score AND check teams in. The shells already carry duties as tabs
   (2026-08-07). Draw today's switch as measured, and change it only where the measuring shows a cost.
4. **Where each volunteer lands,** drawn as a flow at true size: the link or QR code → sign-in → their one screen,
   for an official and for a `staff` member, and what each meets if they guess the admin's address.
5. **The install banner** on both shells, never over their bars or sheets.
6. **The Staff kit**, only if the verification fails it.

**Include the Exhibition format.** It has no standings and no bracket. Say whether anything a volunteer sees changes
(probably nothing), and draw it only if it does.

**Not drawn. List these on the hub as the build's work:**
- any change to a landing or to a role's capabilities, which is shared and the frame's or the roles' owners' to
  build;
- **the old look's retirement** in every file Stage 6 rebuilds (the scorekeeper page and its sheet, the shells'
  shared sheet, the gate page's sheet), held by `npm run check:old-look` and the strict admin colour gate.

These are out of scope here: the scoring rules, the review-and-finalize policy (Event settings, Stage 5) and Results
(Stage 1).

## Method (Stage 4's)

1. **Measure before you draw.**
   - Put the probe in `.probe/`, never in `test-results/`.
   - Use the scorekeeper accounts on the Plus and the free test clubs (`uat-plus-org`, `uat-test-org`).
   - Measure at 390×844, 360×780 and 768×1024, and read the numbers from the browser's geometry.
   - Record:
     - taps from opening the link to a submitted score;
     - taps to check a team in;
     - taps to switch from scoring to the gate;
     - every control under 44px;
     - every sideways spill;
     - where the install banner sits;
     - how much of a 390 screen is fixed chrome.
   - ⚠ **Probes write nothing.** Refuse every non-GET. A score submission or a check-in is a write: do it only on
     the owner's word, then undo it and read the undo back.
   - The fixture may have no game today, so "Up next" may never show, and no `staff` member (check the UAT
     accounts). **Seed, move or add nothing without asking.** Where real data is missing, draw the "before" from
     the code and say so on the drawing.
2. **Draw on a new "Stage 6" tab.**
   - True size: the whole screen before (today's captures) and after.
   - Every flag and fix chip is clickable, with its `data-here` sentence.
   - Every element is tagged NEW, RESTYLED or UNCHANGED, with its own note.
   - Put the 44px block beside every phone frame.
3. **Run the formatting check before the owner sees anything.** Put it on the tab's last section, as Stages 1, 2 and
   4 did.
4. **Write the asks.** Each one gets options, a recommendation, the tradeoff, and a checkbox per option on the
   paste-back.
5. **Taps to beat.** Record today's and the drawing's for:
   - a volunteer's first score from the link they were handed;
   - the next score after that;
   - checking a team in;
   - switching jobs;
   - an organizer handing out the links.

## The asks (each with a recommendation; Decisions rows, `open`)

1. **Where a `staff` member lands** (J8-021: today, the full admin dashboard). Recommend that someone whose only
   tournament job is the gate lands on the gate, and anyone with more lands where they do today. **Shared: tagged
   "shared, Club Tier roles"**, because `staff` exists on every plan. The tradeoff is a landing rule that depends on
   capability, not on the role's name.
2. **The 44px floor on both shells.** Recommend that every control a volunteer taps meets 44px on a phone, including
   Cancel and Submit. These screens have no computer case for the 34px rule to protect.
3. **The Review bucket's waiting count.** Recommend the amber pill (ruled), shown only when a score is waiting.
4. **The shared team sheet on the frame,** if the verification finds it off the frame. Recommend moving it once, for
   the organizer and the gate together, with D4's corners and dim.
5. **Anything the measuring finds** that F36 and J8 miss. Say so; don't force-fit it.

## Working beside the other sessions

- **Club Tier Stage 3c's drawing** may run at the same time.
  - **One browser tester at a time.** Before any probe, capture or `auth-setup`, ask the owner whether another
    session is measuring. A second runner rotates the shared UAT sessions and signs the other one out mid-run.
- **A new shared pattern is an ask, not an invention.** These shells have their own bottom bars, chosen on purpose.
  The sheets have one frame, and rows have one recipe. A change to any of them is drawn as an ask tagged "shared".
- **No code, no help, no gates.** Your files:
  - the hub's Stage 6 tab, and its FINDINGS / INTENTS / Decisions additions;
  - the plan's §5 row 6 and a §6-style Stage 6 section (`§6f`, leaving `§6c` for Stage 3 and `§6e` for Stage 5);
  - the PM brief, your TODO line, and memory.

  Read the hub fresh before every edit. **Parse its scripts before every publish**, because one bad apostrophe kills
  every tab. Never `force` a refused publish.
- **Git:** use a private index and explicit pathspecs. Commit only when the owner says.

## Hand-off

- Write in product-owner voice.
- Lead with what a parent volunteer, handed a link or a QR code at the scoring table or the gate, sees and does
  differently.
- Give the measured "before" and the drawn "after" (taps, the first screen, what sits under the thumb).
- **Tell the owner to open the hub on a phone.**
- Put the asks as numbered questions with a recommendation each.
- Offer `/design` for a review pass if the session has budget.
- **Don't write the Stage 6 build prompt until Stage 6 is ruled.** Its definition of done will include the old-look
  retirement above.

## Do not

- Build anything, or change routes, gates, seeds, help or copy files.
- Change the scoring rules, the finalize policy, a role's capabilities, a price, a plan name or a gate.
- Redesign the check-in board itself (Stage 1 built it; a change is an ask), the admin frame or navigation, or the
  public pages (the flip only as a door).
- Write customer copy. Draw the placement and tag it `/marketing`.
- Remove a demo tour anchor without naming its new home.
- Mint a second artifact. The hub is the only one.
