# Tournament admin redesign · Stage 3 build: the schedule, built to hub v36

> Paste into a fresh session on `dev`.
>
> **Run AFTER the Stage 3 defects pass** (`TOURNAMENT_ADMIN_REDESIGN_STAGE3_DEFECTS_PROMPT.md`), which fixes the
> generators' deleted scores and double-booking, the silent refusals, the bracket editor's silent moves and the false
> reminder sentence. Check it is committed. If it isn't, stop and tell the owner.
>
> Written 2026-10-09, the day the owner ruled Stage 3 from the hub's paste-back: **S1–S8 as drawn, and A33–A46 as
> recommended**. The drawing had been through the formatting check and a second, independent reviewer before the ruling
> (fourteen departures fixed, one kept and flagged; hub v35).
>
> **The spec is the hub:** https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM → the **Stage 3** tab (v36 or later), read
> one part at a time from its bar.
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Every NEW / RESTYLED / UNCHANGED
>   tag note on the tab is a requirement; open each one. The tags marked **"Shared candidate · Club Stage 11"** are
>   built as the tournament's own (A40: name the frame, draw the tournament's only). Build no shared generator component.
> - The **Formatting check** part is your checklist, every row, the second reviewer's included. Its seven places where
>   written rules pull apart were resolved in the drawing; the ruling takes the drawing's resolution.
> - Where you must depart, say so at build time and record why. Never depart silently.
> - The rulings' **unchosen options** are not built:
>   - A33 the day for one division / today's opening repaired
>   - A34 one "Schedule generator" / the title only
>   - A35 keep the inline edit too / the score typed in the window
>   - A36 Undo only / a draft of moves
>   - A37 the drop only warns / as today
>   - A38 a phone keeps the diagram / the winner in green
>   - A39 the board's 60 kept / as today
>   - A40 name nothing / one shared component now
>   - A41 the calendar's Week / independent
>   - A42 a door on the day / as today
>   - A43 Results only / the standings preview
>   - A44 38 everywhere / locks only
>   - A45 with the build / later (it ran first)
>   - A46 keep the promise / drop the sentence
>
> **Read first:**
> - **Plan** `TOURNAMENT_ADMIN_REDESIGN_PLAN.md`:
>   - §3: F19–F24 re-measured, F66–F76 and the 2026-10-09 re-measure;
>   - **§6c**: S1–S8 as drawn, the asks, every writer, every name for generating, plan gating, J1, the taps, the
>     formatting check, not drawn, and "Ruled 2026-10-09, and what the two prompts add";
>   - §7 and §9.
> - **Memory:** `project_tournament_admin_redesign`, `feedback_build_to_approved_mockups`,
>   `feedback_portal_is_the_formatting_benchmark`, `decision_one_toolbar_rare_tools_behind_tools`,
>   `decision_record_reads_first_edits_whole`, `decision_edit_autosaves_create_asks`, `decision_autosave_word_is_transient`,
>   `decision_waiting_count_is_amber_pill`, `decision_drawer_layers_form_vs_menu`, `decision_close_x_is_plain_glyph`,
>   `decision_final_result_is_the_finalizers`, `feedback_form_selects_are_dropdowns`,
>   `feedback_shared_component_over_shared_class`, `reference_code_gotchas_index` (dates and clocks:
>   `formatStoredDate` / `formatTime` only), `project_club_stage6_venues`, `project_club_stage11_scheduler`.
> - **The in-repo `memory/design_decisions.md`**, the top entries to 2026-10-09, and `TABLE_AND_LIST_STANDARD`
>   (§3.3 colour only on a chip or bad news, §3.10.7 no rail in a list).
> - **Stage 1's build is your model** for the row (`ResultsList.tsx` on the admin row recipe, `ClubRow*` in
>   `components/admin/kit/club/RepKit.tsx`) and Stage 2's for the record window (`KitDialog`, with the named Previous /
>   Next). **Never a second row recipe, a second record window or a second notice.**

## Preconditions (check before code)

1. **The defects pass is committed** (above). The dev server works: don't fix another session's code; start it only
   with `npm run dev`, with network access.
2. **`/marketing` confirms the words before you build them.** The placements are ruled; the words are `/marketing`'s.
   Run it once, on this list:
   - **The names (A34):**
     - one verb on every door: *Generate round robin…* · *Generate playoffs…*;
     - the windows: *Round-robin generator* · *Playoff generator*;
     - the buttons: *Generate drafts* · *Save this schedule* / *Save this bracket* · *Three more drafts* (today
       *Another Set*);
     - the free *Build bracket* · *Edit bracket* · *Save bracket* keep their words;
     - *Auto-generate instead* becomes *Use the playoff generator*.

     The thirteen names to retire are listed in §6c ("Every name for generating"). The marketing page's "Schedule
     Generator" is `/marketing`'s call, in the same run.
   - **The day (S1):** *Schedule* · the view pill (*Day · All games · Timeline · Bracket*) · the Filter's four facets and
     *Filter, N on* · the day row's words · the health row's closed line · the unpublished note (S8).
   - **The game window (S2):** its head; each section's label; the score's door to Results; *Cancel game*; the
     published-game question on ✓ (*Move it? Its teams are told.*, as drawn); the red refusal under Diamond.
   - **Moving (S4):** the Undo notice (*Moved · U13, Storm vs Mustangs to 5:00 p.m., Diamond 3* · *Undo*); the drop's
     refusal; the phone sheet's lime (*Move · tells both teams* / *Move*).
   - **The generator (S3):**
     - the four headings (*What it pairs · When · Where · Rules*);
     - the taken line for another division's games;
     - each draft's measures in words;
     - the statement of what saving does;
     - the replace question.

     **⚠ "Their teams are told if U13 is published" must be made TRUE before it ships** (Part 5). Today `bulk-save`
     records no schedule change, so the generator's save tells no one.
   - **The rain delay (S5):** its title; *Cancel game* on a row (today two *Cancel*s with two meanings); the check of
     moved games; Undo; the reserved place's line, if it has words.
   - **The bracket (S6) and the toss (S7):** *Champion*; the winner's mark; the toss note naming the tie and what
     waits; *Record the toss*.
   - **Publishing (S8):** the window's sentences (what shows, *registration closes*, what reaches linked coach teams
     *From {tournament}*, what a later move does, the reminder's rule as the defects pass made it true); *Unpublish*.
   - **The free organizer's locks (A44):** *Generate round robin · Tournament Plus* and the other Tools rows, in words.
3. **Ask the owner whether another session is measuring** before any probe, `auth-setup` or sweep. One browser tester at
   a time; scope sweeps with `--only=`.
4. **The UX summary for the owner comes first** (AGENCY_RULES). Keep it short, since the drawings are ruled. Cover:
   - what a director sees on the Saturday from a phone (the day, a game moved and taken back, a rained-out afternoon);
   - what they see at the desk the week before (generate, adjust, publish);
   - what the free organizer sees;
   - the consequences below.
5. **Consequences of the ruling to say in the summary (not questions):**
   - **A39:** a game whose length is set nowhere reads *Playing now* on the board for 90 minutes, not 60. The board
     starts reading the division's length (today game → tournament → 60).
   - **A37:** a drop onto a busy slot is refused in the browser, so the demo tour's step 4 sentence (*"Drag any game
     onto a slot that is already busy. The health score reacts as you drop it…"*, `lib/sandbox-chrome.ts` ~428) becomes
     false. Route it to `/demos` in the same release cycle. Don't edit the demo yourself.
   - **A33:** the schedule stops remembering its filter between visits (the view pill remembers nothing, 1 October).
     Today's stored `flhq-schedule-{id}` filter (`page.tsx` ~355–374) must not hide played games on the first visit
     after the build: stop reading it.

## ⚠ Running beside other work (as of 2026-10-09)

**Club Tier Stage 6b** (the club calendar, the venue library, a migration) has its build prompt
(`CLUB_TIER_STAGE6B_BUILD_PROMPT.md`) and may be building. Club Stages 10 + 11 (the club's scheduler) draw after this
stage and read its rulings. What you may share with them:

- **6a's clash work:**
  - `lib/booking-length.ts`, `lib/venue-clash*.ts`, `lib/venue-clash-lookup.ts`, `lib/schedule-conflict.ts`;
  - `components/venue/WhereField.tsx` and `useClashCheck.ts`;
  - the 6a guard `tests/unit/club-stage6a-guard.test.ts`, whose not-yet lists only shrink.
- **The booking row the club calendar wears (A41):**
  - 6b builds the calendar on the admin team schedule's and the coach schedule's parts (*"a second week grid is
    drift"*). The Day's booking row (time · who · what · where, the clash marks, the arrows on their own row) is the
    same shape.
  - **Check where 6b is before Part 2.** If it has built the row, wear it. If not, build the Day's row as the kit part
    and name it for 6b in its header. Either way, one row, never two.
- **The admin kit** (`RepKit.*`, `KitDialog.*`, `NoticePill`), the admin bottom sheet (Stage 6 moved it for its five
  users) and the Sheet Frame. Also shared: the old-look baseline, the dev server, the UAT sessions, the owner's walks,
  and the shared docs (`TODO.md`, the Owner QA Ledger, the data dictionary).

Five rules, Stage 2's:
1. **Neither session edits the other's files.** If any shared file has someone else's uncommitted edits, stop and tell
   the owner. Typecheck your commit's own tree in an isolated copy (`git archive` of the staged tree, `node_modules`
   junctioned in) when the whole tree is red from other work.
2. **`check:old-look --init` reads the whole tree.** `git status` the baseline's other files first; if another session
   has any modified, run `--init` in the isolated copy and commit only your lines.
3. **Stay off the dev server during another session's captures or sweeps.**
4. **Stage by explicit pathspecs from a private index**; commit only your hunks of shared docs.
5. **Take the next free Owner QA Ledger §** when you write the walk, after re-reading the ledger.

## Fixtures, and what never gets written

- **The demo's Summer Classic** is the drawn event:
  - live on its seed's game day;
  - U11 semifinals played and its final to play; U13's round robin;
  - Diamonds 1–4 shared by both divisions; 75-minute games;
  - both divisions unpublished, registration open.

  **The demo door allows 10 entries per 10 minutes per IP**: enter once, save the session, reuse it. The demo re-seeds
  on the master build; read the dates before relying on "today".
- **The finished Season Opener** (the demo) draws the bracket with its real games. **The UAT Plus Championship** (June)
  is the organizer fixture. **The free club** proves the locks. No test event uses the coin-toss tie-breaker: picture S7
  with a read-only probe that sets it in the read.
- **Probes write nothing** (refuse every non-GET). A move, a generate-and-save, a rain delay or a publish happens only on
  the owner's word, then undone and read back. **Dev email is live:** never publish, notify or move a published game
  from a probe. A published game's move queues a family alert.

## Retire the old look as you rebuild (definition of done)

Every file this stage rebuilds loses its old look in the same build, by Stage 1's method:
- fold `kx()`;
- drop `useAdminKit()` false branches and `legacy` props;
- fold `[data-admin-kit] .x` rules one at a time, with the kit-shadow and background-shorthand audits;
- keep every `:where(:not([data-public-preview] *))` guard.

`npm run check:old-look:report` on 2026-10-09, the group "Tournament admin redesign Stage 3 — the schedule": **13 files ·
useAdminKit 1 · kx 164 · helpers 16 · kitScope 405**:

| File | Old look |
|---|---|
| `schedule/page.tsx` | useAdminKit 1 · kx 55 · helpers 7 |
| `schedule-admin.module.css` | kitScope 275 |
| `PlayoffWizard.tsx` | kx 35 · helpers 2 |
| `components/ShiftDayModal.tsx` | kx 33 · helpers 1 |
| `components/ScheduleTimeline.module.css` | kitScope 72 |
| `components/BracketBuilder.module.css` | kitScope 53 |
| `components/BracketEditor.tsx` | kx 11 · helpers 1 |
| `components/BracketColumns.tsx` | kx 9 · helpers 1 |
| `components/GameList.tsx` | kx 9 · helpers 1 |
| `Generator.tsx` | kx 7 · helpers 1 |
| `components/ZeroVenuePrompt.tsx` | kx 4 · helpers 1 |
| `components/TournamentFieldPicker.tsx` | kx 1 · helpers 1 |
| `components/admin/NumberStepper.module.css` | kitScope 5 |

Lock in every drop with `--init` in the same commit (rule 2).
- **Never fold** `globals.css`'s kit layer, `ExportMenu`, `CollapsibleCard`, `admin-common.module.css`, the shared
  tournament header and toolbar parts in `components/admin/tournament/`, or the shared helpers (`useKitStyle`,
  `kitStyler`, `useKitButtons`, `useKitAsterisk`).
- **`NumberStepper` is shared:** fold it only with every consumer proven.
- Report what was retired and anything left.

## What to build (all ruled 2026-10-09)

Commits, one per part. Part 0 first, then Part 1 on its own: it is shared with the club and changes what the board says.

### Part 0 · The page split (no pixel changes): its own commit

- `app/[orgSlug]/admin/tournaments/schedule/page.tsx` is 3,529 lines. It holds the list, the timeline's wiring, the
  bracket view, four windows (Add, the dead Edit, publish, the upgrade), two menus and the publish flow.
- Split it into the parts the later commits rebuild, as a **pure move**: no behaviour, no look.
- Prove it identical with a probe at 390 and 1440, Warm and Dark. The coach schedule deep dive's stage 1 did the same
  (4,211 → 1,116 lines). Every tour anchor and `?tool=rain-delay` keeps working.

### Part 1 · One game length (A39, F76): its own commit, shared with Club Stage 6a

- **One chain, everywhere:** the game's own length, else its division's, else the tournament's, else the shared 90
  (`DEFAULT_BOOKING_MINUTES`, `lib/booking-length.ts`). `resolveGameTiming` (`lib/schedule-conflict.ts:56`) already reads
  it.
- **Readers to move onto it:**
  - the board's window: `app/api/admin/tournament-dashboard/route.ts` ~361 reads game → tournament → 60;
  - `lib/game-live-state.ts` (`DEFAULT_GAME_DURATION_MINUTES = 60`): its callers are the dashboard route, Results,
    `GameList` and the scorekeeper;
  - Results and the scorekeeper wherever they read `game-live-state`;
  - the timeline and the clash check, which already read the chain;
  - the club calendar (6a's lookup), which must read the same answer.
- **Both generators save the length they spaced by** on every game. The round-robin generator saves none today; the
  playoff generator does (`PlayoffWizard.tsx` ~1195).
- **Correct the shared note** in `lib/booking-length.ts`. Its header says the board's 60 is *"a different question with
  its own number"*; A39 ruled it is the same question. One number, one place. `game-live-state`'s own constant goes, or
  reads the shared one.
- **Proof:** a unit test that every reader gives the same length for a game with each link of the chain set or unset;
  a test that the board's *Playing now* ends at the chain's length.

### Part 2 · The day (S1, A33, A44's toolbar)

- **The opening:** today during the event, its first day before it, its last after it. Every division, both stages,
  every state (played with scores, waiting, playing, still to play, forfeited, cancelled), in time order.
  - Today: one division, one stage, `scheduled` only (`selectedStatuses` defaults to `['scheduled']`, `page.tsx` ~141).
    Only three status chips exist, so a submitted game and a forfeit match no filter (F67).
  - *All games* is one tap away in the view pill.
- **One toolbar line in every view and at every width** (1 October): the view (*Day · All games · Timeline · Bracket*,
  the olive pill) · Search · Filter · Tools.
  - Filter has four facets: Division · Stage · State · Field. It is quiet until it filters.
  - No doubled stage switch at 768. Publish and Tools present in every view: today the phone's timeline loses both.
  - The day on its own row with its arrows (the club calendar's week arrows, A41).
- **The row is Results' row** (Stage 1 G4) and opens the game window (Part 3). It shows the score on the row for a
  played game.
- **Title band:** *Schedule* at both widths; *Add game* the one lime; Publish into Tools, plus the note (Part 7).
- **Schedule health** is one closed row at the foot of the day, read **across every division** (today one division at a
  time). The tour anchor `data-sandbox-tour="schedule-health"` (`components/ScheduleHealthPanel.tsx` ~95) stays on that
  row. Step 4 scrolls to it.
- **The phone (A44):**
  - 44px for the toolbar, the day's arrows, the rows, the sheets and Undo: today 12 controls under 44 at 390, 11 of them
    under 38.
  - The generator's settings, a desk job, keep the admin's 38 (K-18).
  - A free organizer's Tools names the plan in words (*Generate round robin · Tournament Plus*); a tap opens that plan's
    panel. Today it is a bare padlock with a hover title.
- **Targets, from the drawing (390):** the first game at 250px; all 4 of the day's games on screen one.

### Part 3 · The game window (S2, A35, F74)

One window: the kit's form window, full screen with ← on a phone, 640 at a desk. It opens from the day, the timeline
and the bracket.

- **It reads first:**
  - when and where;
  - the score, with its door opening Results with this game's editor (the link the board's rows use). One score editor
    in the product;
  - the bracket slots with their teams;
  - who sees it.
- **One pencil edits the whole game** (1 October).
- **Add game opens the same window to create**, with a Save (24 September: create asks).
- **It retires three surfaces:** the row's inline edit (`GameList.tsx`); the Add Game window; and the Edit Game window
  (`openEdit`, `page.tsx` ~513, is never called).
- **Venue + Diamond is the club's field** (`WhereField`, drawn as built in 6a).
  - The tournament's own overlap is refused in red under Diamond before Save, in house league's shape (`useClashCheck`,
    `components/venue/useClashCheck.ts`). A club booking is 6a's amber line, read from the `crossProgram` every writer
    already returns.
  - **The 6a guard's `WHERE_NOT_YET` loses** `schedule/page.tsx` and `components/GameList.tsx`.
  - If no form still wears `TournamentFieldPicker`, its exemption goes too, and so does the file.
- **Saving:** an unpublished game autosaves. A published game's change to when or where is **held until ✓**, which asks
  once (*its teams are told*). The coaches portal keeps that save for the same reason: it tells families. Other fields of
  a published game autosave.
- **The rest:** *Cancel game* (amber) and Delete (the 9 October look: trash icon, red words at body weight, ending the
  body) inside the record; Previous · Next at the foot.

### Part 4 · Moving a game, with Undo, and one overlap rule (S4, A36, A37, S6-03)

- **One overlap rule, refused at every door and on the server (A37):**
  - **The doors:** the game window, the timeline's drop, the phone's move sheet, Reinstate, the generators, the rain
    delay and the bracket editor. The import already refuses on the server, the only door that does today.
  - **The rule:** a same-event overlap on the same surface for the chain's length (Part 1). A too-short buffer still
    warns.
  - **The club's other programs** stay 6a's amber line, which never refuses.
  - The server refusal lives in the games route's writers (`app/api/admin/games/route.ts`: `create`, `update`,
    `bulk-save`, `save-bracket`, `bulk-reschedule`, `revert-to-scheduled`) and the locations route. The writers list in
    §6c is the checklist.
  - **A tournament pre-save check** like house league's shows the red line before Save.
  - **The 6a guard** names every writer. Add the tournament's own refusal to its assertions, or a guard of your own
    that fails when a new writer skips it.
- **Undo after every move** (the drop, the phone's sheet, the game window's when/where save, the rain delay's Apply, the
  bracket editor):
  - The notice floats above the bar for about 8 seconds, as a sentence notice, and carries **Undo**. That is
    **`NoticePill` gaining one action** (`RepKit.tsx` ~416: today a message only; its `news` linger is the ~8 s), never
    a second notice component. Club screens share the kit, so say so in the commit.
  - Undo puts back day, time and diamond, and un-cancels.
  - It is the browser session's, like the location resolver's (`ResolveLocationsModal.tsx`, owner decision
    2026-08-10). No new data.
  - The rain delay's Undo puts back the whole batch.
- **A published game asks once before it moves** (*its teams are told*); an unpublished game moves at once.
- **Undo inside the alerts' quiet window tells nobody.** That rests on today's rule: `collapse()` in
  `lib/schedule-change-notices.ts` drops a game moved and moved back inside `ORGANIZER_ANNOUNCE_HOLD_MINUTES` (10).
  **Prove it with a test** before you rely on it.
- **Played games don't drag.**
- **The timeline shows every division's games on every diamond of the day.** A drop that would overlap turns the band
  red with its reason and springs back. A club booking drops, with the amber line.
- **The phone's move sheet** (`ScheduleTimeline.tsx` ~196, on the admin bottom sheet Stage 6 moved for all its users)
  takes the Sheet Frame's form layer (A29): a **Day** field, Venue + Diamond, the line, and a lime that names who it
  tells.

### Part 5 · The generators (S3, A34, A40, F21)

- **The round-robin generator, one name**, in two steps:
  1. **Settings:** *What it pairs · When · Where · Rules*. Today's content under plain headings; the other divisions'
     saved games shown as taken (the defects pass made the drafts respect them; here they are drawn).
  2. **Drafts:**
     - three ranked cards (*Best overall · Fewest moves · Best rest*, *Three more drafts*), each naming in words what
       decides between them: clashes inside the tournament, back-to-backs, field moves, rest, and the games that land
       on a club booking (6a's amber, counted from the cross-program lookup: it warns, never refuses);
     - the chosen draft's games by day;
     - **one statement of what saving does** (how many it adds, what it replaces, what it keeps, that nothing is
       published yet).
- **The replace asks once.** The switch went in the defects pass.
- **"Their teams are told if U13 is published" must be true.** Record the generator's replacement through the schedule
  change recorder (`recordGameScheduleChanges`): a removed game and its replacement are a change for those teams. Its
  publish gate already tells nobody about an unpublished division. Or, if a replacement can't be told honestly as a
  change, the words say what happens: tell the owner which, before building it.
- **Every name for generating** follows A34 (Precondition 2). The free hand-built bracket keeps *Build / Edit / Save
  bracket*.
- **The playoff generator:** names only, plus the retired look. Its gate key was fixed in the defects pass.
- **Not built:** a shared component for Club Stage 11 (A40's unchosen option). The tags on the tab are the club
  session's starting point.

### Part 6 · The rain delay in its home (S5, A42, F24)

- **Doors:** keep Stage 1's door on the board (*Running late?*, `?tool=rain-delay`); add one row in Tools at every
  width, 3 taps or fewer.
- **The window:** today's tool (`ShiftDayModal.tsx`) on the kit's form window:
  - one ×;
  - a row's *Cancel game* (today two *Cancel*s with two meanings);
  - every moved game checked against the overlap rule and the club's bookings;
  - Undo after (Part 4);
  - **Storm Mode's place reserved at the window's top.** Not designed; leave the place, not a feature.
- The shift is a dropdown, as drawn (22 August).

### Part 7 · The bracket, the coin toss and publishing (S6, S7, S8, A38, A43, A46)

- **The bracket reads like the public bracket (A38):**
  - the team, with its seed or slot under it (*Seed N* everywhere);
  - the score; the winner bold with a check; the champion where it ends (the finished board's sentence);
  - every game whatever the filter (today it follows the list's filter, so a played semifinal reads *"No playoff
    bracket yet"*);
  - a card opens the game window;
  - *Edit bracket* a white button above it.
  - **Read who won from the public bracket's model** (`buildPlayoffPicture`, `lib/playoff-picture.ts`) and the
    champion rule the finished board uses. One definition, never a second.
  - `BracketColumns.tsx` prints placeholders only today.
  - **On a phone:** the rounds as bands in one frame, with the diagram one tap away.
  - **The winner's green** in Results (Stage 1's) goes to the exception register's list, as ruled. Don't add green
    here.
- **The coin toss where seeding happens (A43):**
  - A pending toss is the amber waiting count on the Bracket view and on Results.
  - A note on the bracket names the tie and what waits.
  - *Record the toss* opens today's recorder (`components/admin/CoinTossRecorder.tsx`) as a form sheet with a record
    head, from the bracket, Results and the dashboard's nudge. Its controls stay as today (tap the winner or the tied
    teams in order, Reset, Save result), and saving re-seeds the bracket as today.
  - It is mounted today only inside the organizer's preview of the public standings
    (`components/public/StandingsContent.tsx` ~819), and the dashboard's nudge links there. **The box leaves the
    preview**, as drawn ("instead of a box inside the public standings' preview"), and the nudge opens the sheet.
- **Publishing (S8, A46):**
  - A note on the day while divisions are unpublished.
  - **One Publish window** that says what shows (the public site and the app), that **registration closes** (the route
    sets `is_closed`, `schedule-publish/route.ts` ~55; the window says nothing of it today), what reaches the linked
    coach teams (*From {tournament}*), what a later move does, and the reminder's rule as the defects pass made it true.
  - One lime that counts what it publishes. *Unpublish* in Tools.
  - **Don't change the reminder's packaging**: it is A46's question for `/strategy`.

## Don't

- Draw or build the club's scheduler, Storm Mode or the Big Board. Leave Storm Mode's place.
- Redraw the Venue field or the clash line: 6a's, worn as built.
- Change a price, a plan name or a gate value. The locks only change their words.
- Count club bookings as refusals; the amber line never refuses.
- Remove a demo tour anchor without naming its new home. `schedule-health` stays on the health row.
- Add a second row recipe, record window, notice, score editor or bracket model; tint an item row; add a rail to a list.
- Store Undo history or a sent-move mark: Undo is the session's.
- Change Results' editor (Stage 1's, walked) beyond the door to it, or the public pages.
- Change Venues & facilities, the setup wizard or Event settings: Stage 5's, which also takes the clone's lost diamonds.

## Verification

- `npm run verify:changed` and `npm run typecheck`: shared libraries, the games route, the kit's notice.
- **Tests, by file:**
  - the one game length (Part 1);
  - the overlap refusal on every writer;
  - the quiet-window rule that makes Undo honest;
  - the generator's replace recorded for a published division (or the words, as ruled);
  - the 6a guard, with its shrunken lists.
- **The layout sweep:** the schedule's `admin-t-*` entries at 390 / 360 / 768 / 1440 in both themes, plus every screen
  a shared part reaches (Results, the board, the check-in board and Teams through the bottom sheet). One runner at a
  time, scoped with `--only=`; contrast 0/0.
- **Probes** (in `.probe/`), asserting on state, never on a guessed delay:
  - the day's targets at 390 (first game ≈250px, 4 games on screen one) and at 360, 768 and 1440;
  - **nothing in the phone's daily job is under 44px** at 390, 360 and 768;
  - Publish and Tools in every view at every width;
  - a waiting score and a forfeit show on the day;
  - the bracket names teams and scores on the Season Opener whatever the filter;
  - a drop onto a busy slot is refused and springs back (stubbed write);
  - the Undo notice appears after a stubbed move and puts the game back in the page;
  - a published game asks once;
  - the coin-toss count with a read-only tie-breaker flip;
  - the Publish window's sentences against the route's rules;
  - **the clock:** every time through `formatTime()`, no rendered `\d:\d\d\s?[AP]\.?M`.
- Re-measure the built screens against the hub's figures and report any gap.

## Close-out

- **Offer `/simplify`, then `/review`**, before the commits: a shared length, a server rule on every writer, a kit
  notice gaining an action, and a 3,529-line page split.
- **Commit only when the owner says**, one commit per part, on `dev`, from a private index, explicit pathspecs, then
  `git show --stat HEAD`.
- **Help:** `/docs` for the schedule guides.
  - Help says *"there is no separate schedule publish step"*, which is false (publishing is per division), and calls
    the generator *Auto-Generate*.
  - Update `keywords` / `searchText` for the retired names.
- **Demos:** route tour step 4's sentence and the demo's unpublished divisions to `/demos`.
- **The owner's walks:** checkable walks on the hub's QA tab (ONE artifact; republish the same URL after a full read of
  the live copy).
  - One purpose each:
    - **"the Saturday, from a phone"**: the day, a game moved and taken back, a rained-out afternoon, the bracket;
    - **"the desk the week before"**: generate, adjust, publish.
  - Each walk gets its own Owner QA Ledger §. Pin identities, not figures. Writes are the owner's, on dev, each put
    back.
- **Route, don't do:** A46's packaging question to `/strategy`, if not already logged.
- **Record:**
  - the plan's status header and §6c "as built", with commits;
  - the hub's stage strip (Build) and a "Built" part on the Stage 3 tab;
  - the TODO line;
  - memory `project_tournament_admin_redesign`;
  - `PROGRAM_TOURNAMENTS.md`'s pointer;
  - the club plan's Stage 11 line: "Stage 3 built; the frame's parts are on the hub" (tell the club session; don't
    edit its plan).
- **Migrations:** none expected.
